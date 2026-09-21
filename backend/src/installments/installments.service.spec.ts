import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InstallmentsService } from './installments.service';
import { Installment } from './entities/installment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { UserRole } from '../user/enums/user-role.enum';
import { InstallmentStatus } from './enums/installment-status.enum';

describe('InstallmentsService', () => {
  let service: InstallmentsService;

  const mockInstallmentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstallmentsService,
        {
          provide: getRepositoryToken(Installment),
          useValue: mockInstallmentRepo,
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: mockBookingRepo,
        },
      ],
    }).compile();

    service = module.get<InstallmentsService>(InstallmentsService);
  });

  describe('findByBooking', () => {
    it('should throw NotFoundException if booking does not exist', async () => {
      mockBookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByBooking('user-1', UserRole.USER, 'booking-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own booking and is not admin', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        user_id: 'user-2',
      });

      await expect(
        service.findByBooking('user-1', UserRole.USER, 'booking-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return installments ordered by installment_number when owned by user', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        user_id: 'user-1',
      });

      const mockInstallments = [
        {
          id: 'inst-1',
          booking_id: 'booking-1',
          installment_number: 1,
          amount: '100000.00',
          paid_amount: '100000.00',
          status: InstallmentStatus.PAID,
        },
        {
          id: 'inst-2',
          booking_id: 'booking-1',
          installment_number: 2,
          amount: '100000.00',
          paid_amount: '0.00',
          status: InstallmentStatus.PENDING,
        },
      ];

      mockInstallmentRepo.find.mockResolvedValue(mockInstallments);

      const result = await service.findByBooking(
        'user-1',
        UserRole.USER,
        'booking-1',
      );

      expect(result).toHaveLength(2);
      expect(mockInstallmentRepo.find).toHaveBeenCalledWith({
        where: { booking_id: 'booking-1' },
        order: { installment_number: 'ASC' },
        relations: ['allocations'],
      });
    });

    it('should allow admin to view any booking installments', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        user_id: 'user-other',
      });
      mockInstallmentRepo.find.mockResolvedValue([]);

      const result = await service.findByBooking(
        'admin-1',
        UserRole.ADMIN,
        'booking-1',
      );

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if installment does not exist', async () => {
      mockInstallmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('user-1', UserRole.USER, 'inst-999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own booking for this installment', async () => {
      mockInstallmentRepo.findOne.mockResolvedValue({
        id: 'inst-1',
        booking: { id: 'booking-1', user_id: 'user-other' },
      });

      await expect(
        service.findOne('user-1', UserRole.USER, 'inst-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return installment for owner', async () => {
      const mockInst = {
        id: 'inst-1',
        installment_number: 1,
        amount: '100000.00',
        booking: { id: 'booking-1', user_id: 'user-1' },
        allocations: [],
      };
      mockInstallmentRepo.findOne.mockResolvedValue(mockInst);

      const result = await service.findOne('user-1', UserRole.USER, 'inst-1');
      expect(result).toBe(mockInst);
    });

    it('should return installment for admin regardless of owner', async () => {
      const mockInst = {
        id: 'inst-1',
        installment_number: 1,
        booking: { id: 'booking-1', user_id: 'user-other' },
        allocations: [],
      };
      mockInstallmentRepo.findOne.mockResolvedValue(mockInst);

      const result = await service.findOne('admin-1', UserRole.ADMIN, 'inst-1');
      expect(result).toBe(mockInst);
    });
  });
});
