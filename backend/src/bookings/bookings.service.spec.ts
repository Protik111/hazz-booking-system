import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { Pilgrim } from './entities/pilgrim.entity';
import { Installment } from './entities/installment.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Package } from '../packages/entities/package.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { PaymentPlan } from './enums/payment-plan.enum';
import { PackageStatus } from '../packages/enums/package-status.enum';
import { PackageType } from '../packages/enums/package-type.enum';
import { TierName, TierStatus } from '../packages/enums/tier-name.enum';
import { UserRole } from '../user/enums/user-role.enum';
import { PilgrimGender } from './enums/pilgrim-status.enum';

interface MockEntityManager {
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  createQueryBuilder: jest.Mock;
}

describe('BookingsService', () => {
  let service: BookingsService;

  const mockPackage: Package = {
    id: 'pkg-1',
    name: 'Hajj 2027',
    slug: 'hajj-2027',
    type: PackageType.HAJJ,
    description: null,
    departure_date: '2027-05-20',
    return_date: '2027-06-05',
    booking_start: new Date('2026-01-01'),
    booking_end: new Date('2027-04-01'),
    status: PackageStatus.PUBLISHED,
    tiers: [],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockTier: PackageTier = {
    id: 'tier-1',
    package_id: 'pkg-1',
    package: mockPackage,
    name: TierName.ECONOMY,
    price: '450000.00',
    currency: 'BDT',
    total_quota: 50,
    held_seats: 5,
    confirmed_seats: 10,
    status: TierStatus.ACTIVE,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockBooking = {
    id: 'booking-1',
    booking_number: 'BK-2026-000001',
    user_id: 'user-1',
    package_id: 'pkg-1',
    package: mockPackage,
    package_tier_id: 'tier-1',
    package_tier: mockTier,
    status: BookingStatus.PENDING,
    payment_plan: PaymentPlan.INSTALLMENT,
    pilgrim_count: 2,
    unit_price: '450000.00',
    total_amount: '900000.00',
    amount_received: '0.00',
    amount_outstanding: '900000.00',
    hold_expires_at: new Date(Date.now() + 30 * 60 * 1000),
    confirmed_at: null,
    pilgrims: [],
    installments: [],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  } as unknown as Booking;

  const mockBookingRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockPilgrimRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockInstallmentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTierRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  let mockEntityManager: MockEntityManager;
  let mockDataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockEntityManager = {
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((_entityClass: unknown, entity: unknown) =>
          Promise.resolve(entity),
        ),
      create: jest
        .fn()
        .mockImplementation(
          (_entityClass: unknown, data: Record<string, unknown>) => ({
            ...data,
            id: 'gen-id',
          }),
        ),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          (callback: (manager: MockEntityManager) => Promise<unknown>) => {
            return callback(mockEntityManager);
          },
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Pilgrim), useValue: mockPilgrimRepo },
        {
          provide: getRepositoryToken(Installment),
          useValue: mockInstallmentRepo,
        },
        { provide: getRepositoryToken(PackageTier), useValue: mockTierRepo },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should atomically reserve seats and create booking with frozen price and installments', async () => {
      mockEntityManager.findOne.mockResolvedValue({
        ...mockTier,
        total_quota: 50,
        held_seats: 5,
        confirmed_seats: 10,
        package: { ...mockPackage, status: PackageStatus.PUBLISHED },
      });

      const dto = {
        package_tier_id: 'tier-1',
        payment_plan: PaymentPlan.INSTALLMENT,
        pilgrim_count: 2,
        pilgrims: [
          {
            full_name: 'Rahim Ahmed',
            date_of_birth: '1990-01-01',
            gender: PilgrimGender.MALE,
            passport_number: 'A12345678',
          },
          {
            full_name: 'Karima Begum',
            date_of_birth: '1992-02-02',
            gender: PilgrimGender.FEMALE,
            passport_number: 'A87654321',
          },
        ],
      };

      const result = await service.create('user-1', dto);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(
        PackageTier,
        expect.objectContaining({
          where: { id: 'tier-1' },
          lock: { mode: 'pessimistic_write' },
        }),
      );
      expect(result.status).toBe(BookingStatus.PENDING);
      expect(result.total_amount).toBe('900000.00'); // 450000 * 2
      expect(result.booking_number).toBe('BK-2026-000001');
      expect(result.installments.length).toBeGreaterThan(0);
      expect(result.pilgrims.length).toBe(2);
    });

    it('should throw BadRequestException if available seats are insufficient', async () => {
      mockEntityManager.findOne.mockResolvedValue({
        ...mockTier,
        total_quota: 10,
        held_seats: 8,
        confirmed_seats: 2, // 10 - 8 - 2 = 0 available
        package: { ...mockPackage },
      });

      const dto = {
        package_tier_id: 'tier-1',
        payment_plan: PaymentPlan.FULL_PAYMENT,
        pilgrim_count: 2,
      };

      await expect(service.create('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if package is not published', async () => {
      mockEntityManager.findOne.mockResolvedValue({
        ...mockTier,
        package: { ...mockPackage, status: PackageStatus.DRAFT },
      });

      const dto = {
        package_tier_id: 'tier-1',
        payment_plan: PaymentPlan.FULL_PAYMENT,
        pilgrim_count: 1,
      };

      await expect(service.create('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should filter by user_id for normal USER', async () => {
      mockBookingRepo.findAndCount.mockResolvedValue([[mockBooking], 1]);

      const result = await service.findAll('user-1', UserRole.USER, {
        page: 1,
        limit: 10,
      });

      expect(mockBookingRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'user-1' },
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('should not filter by user_id for ADMIN', async () => {
      mockBookingRepo.findAndCount.mockResolvedValue([[mockBooking], 1]);

      await service.findAll('admin-user', UserRole.ADMIN, {
        page: 1,
        limit: 10,
      });

      expect(mockBookingRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return booking when user owns it', async () => {
      mockBookingRepo.findOne.mockResolvedValue(mockBooking);

      const result = await service.findOne(
        'user-1',
        UserRole.USER,
        'booking-1',
      );

      expect(result.id).toBe('booking-1');
    });

    it('should throw ForbiddenException when user does not own booking and is not ADMIN', async () => {
      mockBookingRepo.findOne.mockResolvedValue(mockBooking); // owned by user-1

      await expect(
        service.findOne('different-user', UserRole.USER, 'booking-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to access any booking', async () => {
      mockBookingRepo.findOne.mockResolvedValue(mockBooking);

      const result = await service.findOne(
        'admin-id',
        UserRole.ADMIN,
        'booking-1',
      );

      expect(result.id).toBe('booking-1');
    });

    it('should throw NotFoundException if booking does not exist', async () => {
      mockBookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('user-1', UserRole.USER, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel pending booking and release held seats', async () => {
      const tierWithSeats = { ...mockTier, held_seats: 5 };
      mockEntityManager.findOne
        .mockResolvedValueOnce({
          ...mockBooking,
          status: BookingStatus.PENDING,
        })
        .mockResolvedValueOnce(tierWithSeats);

      const result = await service.cancel('user-1', UserRole.USER, 'booking-1');

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(tierWithSeats.held_seats).toBe(3); // 5 - 2 = 3
    });

    it('should reject cancelling a confirmed booking directly', async () => {
      mockEntityManager.findOne.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      });

      await expect(
        service.cancel('user-1', UserRole.USER, 'booking-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('expirePendingBookings', () => {
    it('should release held seats and mark expired bookings as EXPIRED', async () => {
      const expiredBooking = {
        ...mockBooking,
        status: BookingStatus.PENDING,
        hold_expires_at: new Date(Date.now() - 1000),
      };
      const tierWithSeats = { ...mockTier, held_seats: 4 };

      mockBookingRepo.find.mockResolvedValue([expiredBooking]);
      mockEntityManager.findOne.mockResolvedValue(tierWithSeats);

      const count = await service.expirePendingBookings();

      expect(count).toBe(1);
      expect(tierWithSeats.held_seats).toBe(2); // 4 - 2 = 2
    });
  });
});
