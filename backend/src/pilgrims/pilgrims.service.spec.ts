import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PilgrimsService } from './pilgrims.service';
import { Pilgrim } from './entities/pilgrim.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { PilgrimGender, PilgrimStatus } from './enums/pilgrim-status.enum';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { UserRole } from '../user/enums/user-role.enum';
import { TierName, TierStatus } from '../packages/enums/tier-name.enum';

interface MockEntityManager {
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
}

describe('PilgrimsService', () => {
  let service: PilgrimsService;

  const mockBooking = {
    id: 'booking-1',
    user_id: 'user-1',
    package_tier_id: 'tier-1',
    status: BookingStatus.PENDING,
    pilgrim_count: 2,
    unit_price: '450000.00',
    total_amount: '900000.00',
    amount_received: '0.00',
    amount_outstanding: '900000.00',
  } as unknown as Booking;

  const mockPilgrim = {
    id: 'pilgrim-1',
    booking_id: 'booking-1',
    booking: mockBooking,
    full_name: 'Rahim Ahmed',
    date_of_birth: '1990-01-01',
    gender: PilgrimGender.MALE,
    nationality: 'Bangladeshi',
    passport_number: 'A12345678',
    status: PilgrimStatus.ACTIVE,
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as Pilgrim;

  const mockTier = {
    id: 'tier-1',
    name: TierName.ECONOMY,
    price: '450000.00',
    currency: 'BDT',
    total_quota: 50,
    held_seats: 5,
    confirmed_seats: 10,
    status: TierStatus.ACTIVE,
  } as unknown as PackageTier;

  const mockPilgrimRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
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
            id: 'gen-pilgrim-id',
          }),
        ),
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
        PilgrimsService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Pilgrim), useValue: mockPilgrimRepo },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(PackageTier), useValue: mockTierRepo },
      ],
    }).compile();

    service = module.get<PilgrimsService>(PilgrimsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      full_name: 'Rahim Ahmed',
      date_of_birth: '1990-01-01',
      gender: PilgrimGender.MALE,
      passport_number: 'A12345678',
    };

    it('should add pilgrim when reserved seat is available', async () => {
      mockBookingRepo.findOne.mockResolvedValue(mockBooking);
      mockPilgrimRepo.count.mockResolvedValue(1); // 1 < 2 reserved
      mockPilgrimRepo.create.mockReturnValue(mockPilgrim);
      mockPilgrimRepo.save.mockResolvedValue(mockPilgrim);

      const result = await service.create(
        'user-1',
        UserRole.USER,
        'booking-1',
        createDto,
      );

      expect(result.id).toBe('pilgrim-1');
      expect(mockPilgrimRepo.save).toHaveBeenCalled();
    });

    it('should atomically reserve extra seat when pilgrim_count is reached on PENDING booking', async () => {
      mockBookingRepo.findOne.mockResolvedValue({ ...mockBooking });
      mockPilgrimRepo.count.mockResolvedValue(2); // 2 >= 2 reserved
      mockEntityManager.findOne.mockResolvedValue({ ...mockTier });

      const result = await service.create(
        'user-1',
        UserRole.USER,
        'booking-1',
        createDto,
      );

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result.id).toBe('gen-pilgrim-id');
    });

    it('should throw ForbiddenException if booking is owned by someone else', async () => {
      mockBookingRepo.findOne.mockResolvedValue(mockBooking); // user_id: user-1

      await expect(
        service.create('intruder', UserRole.USER, 'booking-1', createDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if booking is CANCELLED', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });

      await expect(
        service.create('user-1', UserRole.USER, 'booking-1', createDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllByBooking', () => {
    it('should return list of pilgrims for booking', async () => {
      mockBookingRepo.findOne.mockResolvedValue(mockBooking);
      mockPilgrimRepo.find.mockResolvedValue([mockPilgrim]);

      const result = await service.findAllByBooking(
        'user-1',
        UserRole.USER,
        'booking-1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pilgrim-1');
    });
  });

  describe('findOne', () => {
    it('should return pilgrim when user owns the booking', async () => {
      mockPilgrimRepo.findOne.mockResolvedValue(mockPilgrim);

      const result = await service.findOne(
        'user-1',
        UserRole.USER,
        'pilgrim-1',
      );

      expect(result.id).toBe('pilgrim-1');
    });

    it('should throw ForbiddenException when user does not own booking', async () => {
      mockPilgrimRepo.findOne.mockResolvedValue(mockPilgrim);

      await expect(
        service.findOne('other-user', UserRole.USER, 'pilgrim-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if pilgrim does not exist', async () => {
      mockPilgrimRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('user-1', UserRole.USER, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update pilgrim details', async () => {
      const pilgrimToUpdate = { ...mockPilgrim };
      mockPilgrimRepo.findOne.mockResolvedValue(pilgrimToUpdate);
      mockPilgrimRepo.save.mockImplementation((p: Pilgrim) =>
        Promise.resolve(p),
      );

      const result = await service.update(
        'user-1',
        UserRole.USER,
        'pilgrim-1',
        { phone: '01800000000' },
      );

      expect(result.phone).toBe('01800000000');
    });
  });

  describe('cancel', () => {
    it('should set pilgrim status to CANCELLED', async () => {
      const pilgrimToCancel = { ...mockPilgrim, status: PilgrimStatus.ACTIVE };
      mockPilgrimRepo.findOne.mockResolvedValue(pilgrimToCancel);
      mockPilgrimRepo.save.mockImplementation((p: Pilgrim) =>
        Promise.resolve(p),
      );

      const result = await service.cancel('user-1', UserRole.USER, 'pilgrim-1');

      expect(result.status).toBe(PilgrimStatus.CANCELLED);
    });
  });

  describe('adminFindAll', () => {
    it('should return paginated list of pilgrims with search and filters', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockPilgrim], 1]),
      };
      mockPilgrimRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.adminFindAll({
        search: 'Rahim',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
