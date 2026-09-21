import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CancellationService } from './cancellation.service';
import { CancellationRequest } from './entities/cancellation.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Pilgrim } from '../bookings/entities/pilgrim.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Refund } from '../refunds/entities/refund.entity';
import { CancellationStatus } from './enums/cancellation-status.enum';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { PilgrimStatus } from '../bookings/enums/pilgrim-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

interface MockEntityManager {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
}

describe('CancellationService', () => {
  let service: CancellationService;

  const mockCancellationRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
  };

  const mockPilgrimRepo = {
    findOne: jest.fn(),
  };

  const mockTierRepo = {
    findOne: jest.fn(),
  };

  const mockRefundRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  let mockEntityManager: MockEntityManager;
  let mockDataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockEntityManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((_cls: unknown, entity: unknown) =>
          Promise.resolve(entity),
        ),
      create: jest
        .fn()
        .mockImplementation((_cls: unknown, data: Record<string, unknown>) => ({
          ...data,
          id: 'refund-uuid',
        })),
    };

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: MockEntityManager) => Promise<unknown>) => {
            return cb(mockEntityManager);
          },
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancellationService,
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: getRepositoryToken(CancellationRequest),
          useValue: mockCancellationRepo,
        },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Pilgrim), useValue: mockPilgrimRepo },
        { provide: getRepositoryToken(PackageTier), useValue: mockTierRepo },
        { provide: getRepositoryToken(Refund), useValue: mockRefundRepo },
      ],
    }).compile();

    service = module.get<CancellationService>(CancellationService);
  });

  // ─── Request Cancellation ─────────────────────────────────────────────────

  describe('requestCancellation', () => {
    const bookingId = 'b-1';
    const futureDate = new Date(Date.now() + 80 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]; // 80 days away (> 60 days)

    it('should throw NotFoundException if booking not found', async () => {
      mockBookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.requestCancellation('user-1', UserRole.USER, bookingId, {
          reason: 'Cannot make it',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not booking owner', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: bookingId,
        user_id: 'user-other',
        status: BookingStatus.CONFIRMED,
      });

      await expect(
        service.requestCancellation('user-1', UserRole.USER, bookingId, {
          reason: 'Cannot make it',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if booking is CANCELLED or EXPIRED', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: bookingId,
        user_id: 'user-1',
        status: BookingStatus.CANCELLED,
      });

      await expect(
        service.requestCancellation('user-1', UserRole.USER, bookingId, {
          reason: 'Cannot make it',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if active cancellation request exists', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: bookingId,
        user_id: 'user-1',
        status: BookingStatus.CONFIRMED,
      });
      mockCancellationRepo.findOne.mockResolvedValue({
        id: 'c-1',
        status: CancellationStatus.REQUESTED,
      });

      await expect(
        service.requestCancellation('user-1', UserRole.USER, bookingId, {
          reason: 'Cannot make it',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate 10% cancellation charge for departure > 60 days and save request', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: bookingId,
        user_id: 'user-1',
        status: BookingStatus.CONFIRMED,
        total_amount: '300000.00',
        amount_received: '100000.00',
        package: { departure_date: futureDate },
      });
      mockCancellationRepo.findOne.mockResolvedValue(null);

      const created = { id: 'c-1', status: CancellationStatus.REQUESTED };
      mockCancellationRepo.create.mockReturnValue(created);
      mockCancellationRepo.save.mockResolvedValue(created);

      const result = await service.requestCancellation(
        'user-1',
        UserRole.USER,
        bookingId,
        { reason: 'Family emergency' },
      );

      expect(result).toBe(created);
      // 10% of 300,000 = 30,000 charge.
      // Refund = 100,000 received - 30,000 charge = 70,000 refund.
      expect(mockCancellationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: bookingId,
          pilgrim_id: null,
          reason: 'Family emergency',
          cancellation_charge: '30000.00',
          refund_amount: '70000.00',
          status: CancellationStatus.REQUESTED,
        }),
      );
    });

    it('should calculate 50% charge for departure in 20 days and 100% for < 15 days', async () => {
      const nearDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      mockBookingRepo.findOne.mockResolvedValue({
        id: bookingId,
        user_id: 'user-1',
        status: BookingStatus.CONFIRMED,
        total_amount: '200000.00',
        amount_received: '150000.00',
        package: { departure_date: nearDate },
      });
      mockCancellationRepo.findOne.mockResolvedValue(null);

      mockCancellationRepo.create.mockImplementation((data) => data);
      mockCancellationRepo.save.mockImplementation((data) =>
        Promise.resolve(data),
      );

      const result = await service.requestCancellation(
        'user-1',
        UserRole.USER,
        bookingId,
        { reason: 'Emergency' },
      );

      // 50% of 200,000 = 100,000 charge. Refund = 150,000 - 100,000 = 50,000.
      expect(result.cancellation_charge).toBe('100000.00');
      expect(result.refund_amount).toBe('50000.00');
    });

    it('should support partial cancellation for single pilgrim', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: bookingId,
        user_id: 'user-1',
        status: BookingStatus.CONFIRMED,
        unit_price: '100000.00',
        total_amount: '200000.00',
        amount_received: '100000.00',
        package: { departure_date: futureDate },
        pilgrims: [{ id: 'p-1', status: PilgrimStatus.PENDING }],
      });
      mockCancellationRepo.findOne.mockResolvedValue(null);

      mockCancellationRepo.create.mockImplementation((data) => data);
      mockCancellationRepo.save.mockImplementation((data) =>
        Promise.resolve(data),
      );

      const result = await service.requestCancellation(
        'user-1',
        UserRole.USER,
        bookingId,
        { reason: 'One pilgrim cannot attend', pilgrim_id: 'p-1' },
      );

      expect(result.pilgrim_id).toBe('p-1');
      // 10% of unit_price (100,000) = 10,000 charge.
      expect(result.cancellation_charge).toBe('10000.00');
      expect(result.refund_amount).toBe('90000.00');
    });
  });

  // ─── Find All & Find One ──────────────────────────────────────────────────

  describe('findAll & findOne', () => {
    it('should filter by user_id for non-admin in findAll', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'c-1' }], 1]),
      };
      mockCancellationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('user-1', UserRole.USER, {
        status: CancellationStatus.REQUESTED,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('b.user_id = :userId', {
        userId: 'user-1',
      });
      expect(result.data).toHaveLength(1);
    });

    it('should throw NotFoundException if findOne does not find record', async () => {
      mockCancellationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('user-1', UserRole.USER, 'c-999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own request', async () => {
      mockCancellationRepo.findOne.mockResolvedValue({
        id: 'c-1',
        requested_by_id: 'user-other',
        booking: { user_id: 'user-other' },
      });

      await expect(
        service.findOne('user-1', UserRole.USER, 'c-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Approve Cancellation ─────────────────────────────────────────────────

  describe('approveCancellation', () => {
    it('should throw NotFoundException if request not found', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.approveCancellation('admin-1', 'c-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if request not in REQUESTED state', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce({
        id: 'c-1',
        status: CancellationStatus.APPROVED,
      });

      await expect(
        service.approveCancellation('admin-1', 'c-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if override refund exceeds amount received', async () => {
      const cancellation = {
        id: 'c-1',
        booking_id: 'b-1',
        status: CancellationStatus.REQUESTED,
        cancellation_charge: '10000.00',
        vendor_cost: '0.00',
        refund_amount: '50000.00',
      };
      const booking = {
        id: 'b-1',
        amount_received: '40000.00',
      };

      mockEntityManager.findOne
        .mockResolvedValueOnce(cancellation)
        .mockResolvedValueOnce(booking);

      await expect(
        service.approveCancellation('admin-1', 'c-1', {
          refund_amount: 80000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve whole booking cancellation, release confirmed seats, and spawn refund record', async () => {
      const cancellation = {
        id: 'c-1',
        booking_id: 'b-1',
        pilgrim_id: null,
        reason: 'Illness',
        status: CancellationStatus.REQUESTED,
        cancellation_charge: '20000.00',
        vendor_cost: '0.00',
        refund_amount: '80000.00',
      };

      const booking = {
        id: 'b-1',
        status: BookingStatus.CONFIRMED,
        pilgrim_count: 2,
        package_tier_id: 'tier-1',
        amount_received: '100000.00',
      };

      const tier = {
        id: 'tier-1',
        confirmed_seats: 10,
        held_seats: 0,
      };

      mockEntityManager.findOne
        .mockResolvedValueOnce(cancellation) // CancellationRequest
        .mockResolvedValueOnce(booking) // Booking
        .mockResolvedValueOnce(tier); // PackageTier

      const result = await service.approveCancellation('admin-1', 'c-1');

      expect(result.status).toBe(CancellationStatus.APPROVED);
      expect(result.approved_by_id).toBe('admin-1');

      // Inventory seats released
      expect(tier.confirmed_seats).toBe(8); // 10 - 2
      expect(booking.status).toBe(BookingStatus.CANCELLED);

      // Refund record created
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Refund,
        expect.objectContaining({
          booking_id: 'b-1',
          cancellation_request_id: 'c-1',
          amount: '80000.00',
        }),
      );
    });

    it('should approve partial single-pilgrim cancellation', async () => {
      const cancellation = {
        id: 'c-1',
        booking_id: 'b-1',
        pilgrim_id: 'p-1',
        reason: 'Pilgrim unable to travel',
        status: CancellationStatus.REQUESTED,
        cancellation_charge: '10000.00',
        vendor_cost: '0.00',
        refund_amount: '40000.00',
      };

      const booking = {
        id: 'b-1',
        status: BookingStatus.CONFIRMED,
        pilgrim_count: 3,
        package_tier_id: 'tier-1',
        amount_received: '150000.00',
      };

      const tier = {
        id: 'tier-1',
        confirmed_seats: 10,
      };

      const pilgrim = {
        id: 'p-1',
        status: PilgrimStatus.PENDING,
      };

      mockEntityManager.findOne
        .mockResolvedValueOnce(cancellation) // CancellationRequest
        .mockResolvedValueOnce(booking) // Booking
        .mockResolvedValueOnce(tier) // PackageTier
        .mockResolvedValueOnce(pilgrim); // Pilgrim

      const result = await service.approveCancellation('admin-1', 'c-1');

      expect(result.status).toBe(CancellationStatus.APPROVED);
      expect(tier.confirmed_seats).toBe(9); // 10 - 1
      expect(pilgrim.status).toBe(PilgrimStatus.CANCELLED);
      expect(booking.pilgrim_count).toBe(2); // 3 - 1
    });
  });

  // ─── Reject Cancellation ──────────────────────────────────────────────────

  describe('rejectCancellation', () => {
    it('should throw BadRequestException if not in REQUESTED state', async () => {
      mockCancellationRepo.findOne.mockResolvedValue({
        id: 'c-1',
        status: CancellationStatus.APPROVED,
      });

      await expect(
        service.rejectCancellation('admin-1', 'c-1', 'Non-refundable'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject request and store rejection reason', async () => {
      const cancellation = {
        id: 'c-1',
        status: CancellationStatus.REQUESTED,
      };
      mockCancellationRepo.findOne.mockResolvedValue(cancellation);
      mockCancellationRepo.save.mockImplementation((c) => Promise.resolve(c));

      const result = await service.rejectCancellation(
        'admin-1',
        'c-1',
        'Non-refundable tier',
      );

      expect(result.status).toBe(CancellationStatus.REJECTED);
      expect(result.rejection_reason).toBe('Non-refundable tier');
      expect(result.approved_by_id).toBe('admin-1');
    });
  });
});
