import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerService } from './scheduler.service';
import { Booking } from '../bookings/entities/booking.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Installment } from '../installments/entities/installment.entity';
import { AuditService } from '../audit/audit.service';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { InstallmentStatus } from '../installments/enums/installment-status.enum';

interface MockEntityManager {
  findOne: jest.Mock;
  save: jest.Mock;
}

/** Builds a fluent QueryBuilder mock that terminates with the provided mock fn. */
function makeQb(terminalMock: jest.Mock) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: terminalMock,
    getCount: terminalMock,
  };
}

describe('SchedulerService', () => {
  let service: SchedulerService;

  // Per-test QB terminals so each test can configure its own return value
  let bookingQbGetMany: jest.Mock;
  let installmentQbGetMany: jest.Mock;

  const mockBookingRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockTierRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockInstallmentRepo = {
    find: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockAuditService = {
    recordLog: jest.fn().mockResolvedValue({}),
  };

  let mockEntityManager: MockEntityManager;
  let mockDataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    bookingQbGetMany = jest.fn();
    installmentQbGetMany = jest.fn();

    mockBookingRepo.createQueryBuilder.mockReturnValue(
      makeQb(bookingQbGetMany),
    );
    mockInstallmentRepo.createQueryBuilder.mockReturnValue(
      makeQb(installmentQbGetMany),
    );

    mockEntityManager = {
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((_cls, entity) => Promise.resolve(entity)),
    };

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: MockEntityManager) => Promise<unknown>) =>
            cb(mockEntityManager),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: AuditService, useValue: mockAuditService },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(PackageTier), useValue: mockTierRepo },
        {
          provide: getRepositoryToken(Installment),
          useValue: mockInstallmentRepo,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  describe('expireSeatHolds', () => {
    it('should return 0 when no expired holds found', async () => {
      bookingQbGetMany.mockResolvedValue([]);

      const result = await service.expireSeatHolds();

      expect(result.expiredCount).toBe(0);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should atomically release held seats and expire booking', async () => {
      const expiredBooking = {
        id: 'b-1',
        package_tier_id: 'tier-1',
        pilgrim_count: 2,
        status: BookingStatus.PENDING,
      };
      bookingQbGetMany.mockResolvedValue([expiredBooking]);

      const tier = {
        id: 'tier-1',
        held_seats: 5,
      };
      mockEntityManager.findOne.mockResolvedValue(tier);

      const result = await service.expireSeatHolds();

      expect(result.expiredCount).toBe(1);
      expect(result.bookingIds).toContain('b-1');
      expect(tier.held_seats).toBe(3); // 5 - 2
      expect(expiredBooking.status).toBe(BookingStatus.EXPIRED);
      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SEAT_HOLD_EXPIRED',
          entity_type: 'Booking',
          entity_id: 'b-1',
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'booking.hold.expired',
        expect.objectContaining({ bookingId: 'b-1', seats: 2 }),
      );
    });
  });

  describe('processOverdueInstallments', () => {
    it('should mark past-due pending installments as OVERDUE', async () => {
      const installment = {
        id: 'inst-1',
        booking_id: 'b-1',
        status: InstallmentStatus.PENDING,
        due_date: '2026-01-01',
      };
      installmentQbGetMany.mockResolvedValue([installment]);

      const result = await service.processOverdueInstallments();

      expect(result.overdueCount).toBe(1);
      expect(installment.status).toBe(InstallmentStatus.OVERDUE);
      expect(mockInstallmentRepo.save).toHaveBeenCalledWith(installment);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'installment.overdue',
        expect.objectContaining({ installmentId: 'inst-1' }),
      );
    });
  });

  describe('sendInstallmentReminders', () => {
    it('should find upcoming installments and emit reminder event', async () => {
      const upcomingInstallment = {
        id: 'inst-1',
        booking_id: 'b-1',
        due_date: new Date().toISOString().slice(0, 10),
        amount: '50000.00',
      };
      installmentQbGetMany.mockResolvedValue([upcomingInstallment]);

      const result = await service.sendInstallmentReminders();

      expect(result.remindersCount).toBe(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'installment.reminder.due',
        expect.objectContaining({ installmentId: 'inst-1' }),
      );
    });
  });

  describe('getStatus', () => {
    it('should return active status with all jobs', () => {
      const status = service.getStatus();
      expect(status.status).toBe('active');
      expect(status.jobs).toHaveLength(3);
    });
  });
});
