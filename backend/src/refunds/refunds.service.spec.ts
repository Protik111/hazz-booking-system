import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { Refund } from './entities/refund.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { RefundStatus } from './enums/refund-status.enum';
import { PaymentMethod } from '../payments/enums/payment-method.enum';
import { UserRole } from '../user/enums/user-role.enum';

interface MockEntityManager {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
}

describe('RefundsService', () => {
  let service: RefundsService;

  const mockRefundRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
  };

  const mockPaymentRepo = {
    findOne: jest.fn(),
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
        RefundsService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Refund), useValue: mockRefundRepo },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
  });

  // ─── createRefund ─────────────────────────────────────────────────────────

  describe('createRefund', () => {
    const dto = {
      booking_id: 'b-1',
      amount: 50000,
      reason: 'Cancelled booking',
    };

    it('should throw NotFoundException if booking not found', async () => {
      mockBookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createRefund('admin-1', UserRole.ADMIN, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-admin user does not own booking', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'b-1',
        user_id: 'user-other',
        amount_received: '100000.00',
      });

      await expect(
        service.createRefund('user-1', UserRole.USER, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if refund exceeds total received', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'b-1',
        user_id: 'user-1',
        amount_received: '30000.00',
      });

      // Active refunds of 0 but request for 50,000 vs 30,000 received
      mockRefundRepo.find.mockResolvedValue([]);

      await expect(
        service.createRefund('user-1', UserRole.USER, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if cumulative refunds exceed total received', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'b-1',
        user_id: 'user-1',
        amount_received: '100000.00',
      });

      // Existing active refunds: 70,000 already requested
      mockRefundRepo.find.mockResolvedValue([
        { id: 'r-existing', amount: '70000.00', status: RefundStatus.APPROVED },
      ]);

      await expect(
        // 70,000 + 50,000 = 120,000 > 100,000 received
        service.createRefund('user-1', UserRole.USER, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create refund when invariant is satisfied', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'b-1',
        user_id: 'user-1',
        amount_received: '100000.00',
      });

      mockRefundRepo.find.mockResolvedValue([
        { amount: '30000.00', status: RefundStatus.COMPLETED },
      ]);

      const created = { id: 'r-1', ...dto, status: RefundStatus.REQUESTED };
      mockRefundRepo.create.mockReturnValue(created);
      mockRefundRepo.save.mockResolvedValue(created);

      const result = await service.createRefund('user-1', UserRole.USER, dto);

      expect(result.status).toBe(RefundStatus.REQUESTED);
      expect(mockRefundRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: 'b-1',
          amount: '50000.00',
          method: PaymentMethod.MANUAL_BRANCH,
          status: RefundStatus.REQUESTED,
        }),
      );
    });
  });

  // ─── findAll & findOne ────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should filter by user_id for non-admin', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'r-1' }], 1]),
      };
      mockRefundRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('user-1', UserRole.USER, {});

      expect(qb.andWhere).toHaveBeenCalledWith('b.user_id = :userId', {
        userId: 'user-1',
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if refund not found', async () => {
      mockRefundRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('user-1', UserRole.USER, 'r-99'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-admin does not own booking', async () => {
      mockRefundRepo.findOne.mockResolvedValue({
        id: 'r-1',
        booking: { user_id: 'user-other' },
      });

      await expect(
        service.findOne('user-1', UserRole.USER, 'r-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return refund for owner', async () => {
      const refund = { id: 'r-1', booking: { user_id: 'user-1' } };
      mockRefundRepo.findOne.mockResolvedValue(refund);

      const result = await service.findOne('user-1', UserRole.USER, 'r-1');
      expect(result).toBe(refund);
    });
  });

  // ─── approveRefund ────────────────────────────────────────────────────────

  describe('approveRefund', () => {
    it('should throw NotFoundException if refund not found', async () => {
      mockRefundRepo.findOne.mockResolvedValue(null);

      await expect(service.approveRefund('admin-1', 'r-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if refund is not in REQUESTED state', async () => {
      mockRefundRepo.findOne.mockResolvedValue({
        id: 'r-1',
        status: RefundStatus.APPROVED,
        booking: { amount_received: '100000.00' },
      });

      await expect(service.approveRefund('admin-1', 'r-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should approve refund and record approver and timestamp', async () => {
      const refund = {
        id: 'r-1',
        booking_id: 'b-1',
        amount: '50000.00',
        status: RefundStatus.REQUESTED,
        booking: { amount_received: '100000.00' },
        approved_by_id: null,
        approved_at: null,
      };
      mockRefundRepo.findOne.mockResolvedValue(refund);
      mockRefundRepo.find.mockResolvedValue([]);
      mockRefundRepo.save.mockImplementation((r) => Promise.resolve(r));

      const result = await service.approveRefund('admin-1', 'r-1');

      expect(result.status).toBe(RefundStatus.APPROVED);
      expect(result.approved_by_id).toBe('admin-1');
      expect(result.approved_at).toBeInstanceOf(Date);
    });
  });

  // ─── processRefund ────────────────────────────────────────────────────────

  describe('processRefund', () => {
    it('should throw BadRequestException if not in APPROVED or PROCESSING state', async () => {
      const refund = {
        id: 'r-1',
        status: RefundStatus.REQUESTED,
        booking: { amount_received: '100000.00' },
      };
      mockEntityManager.findOne.mockResolvedValueOnce(refund);

      await expect(service.processRefund('admin-1', 'r-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should process approved refund and transition to COMPLETED', async () => {
      const refund = {
        id: 'r-1',
        booking_id: 'b-1',
        amount: '50000.00',
        status: RefundStatus.APPROVED,
        booking: { amount_received: '100000.00' },
        processed_by_id: null,
        processed_at: null,
        gateway_refund_id: null,
      };
      mockEntityManager.findOne.mockResolvedValueOnce(refund);
      mockEntityManager.find.mockResolvedValueOnce([]); // no other COMPLETED refunds

      const dto = { gateway_refund_id: 'GW-REFUND-123', notes: 'Processed' };
      const result = await service.processRefund('admin-1', 'r-1', dto);

      expect(result.status).toBe(RefundStatus.COMPLETED);
      expect(result.processed_by_id).toBe('admin-1');
      expect(result.processed_at).toBeInstanceOf(Date);
      expect(result.gateway_refund_id).toBe('GW-REFUND-123');
    });

    it('should throw BadRequestException if processing would exceed total received', async () => {
      const refund = {
        id: 'r-1',
        booking_id: 'b-1',
        amount: '80000.00',
        status: RefundStatus.APPROVED,
        booking: { amount_received: '100000.00' },
      };
      mockEntityManager.findOne.mockResolvedValueOnce(refund);
      // Other COMPLETED refunds already have 50,000, total would be 50,000 + 80,000 = 130,000 > 100,000
      mockEntityManager.find.mockResolvedValueOnce([
        { id: 'r-old', amount: '50000.00', status: RefundStatus.COMPLETED },
      ]);

      await expect(service.processRefund('admin-1', 'r-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── rejectRefund ─────────────────────────────────────────────────────────

  describe('rejectRefund', () => {
    it('should throw BadRequestException if refund is already COMPLETED or REJECTED', async () => {
      mockRefundRepo.findOne.mockResolvedValue({
        id: 'r-1',
        status: RefundStatus.COMPLETED,
      });

      await expect(
        service.rejectRefund('admin-1', 'r-1', 'Already processed'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark refund as REJECTED with reason', async () => {
      const refund = {
        id: 'r-1',
        status: RefundStatus.REQUESTED,
        rejection_reason: null,
      };
      mockRefundRepo.findOne.mockResolvedValue(refund);
      mockRefundRepo.save.mockImplementation((r) => Promise.resolve(r));

      const result = await service.rejectRefund(
        'admin-1',
        'r-1',
        'No valid receipt',
      );

      expect(result.status).toBe(RefundStatus.REJECTED);
      expect(result.rejection_reason).toBe('No valid receipt');
      expect(result.approved_by_id).toBe('admin-1');
    });
  });

  // ─── getRefundReport ──────────────────────────────────────────────────────

  describe('getRefundReport', () => {
    it('should aggregate totals by status', async () => {
      mockRefundRepo.find.mockResolvedValue([
        { amount: '50000.00', status: RefundStatus.COMPLETED },
        { amount: '30000.00', status: RefundStatus.COMPLETED },
        { amount: '20000.00', status: RefundStatus.REQUESTED },
        { amount: '15000.00', status: RefundStatus.APPROVED },
        { amount: '10000.00', status: RefundStatus.REJECTED },
      ]);

      const result = await service.getRefundReport();

      expect(result.total_refunded).toBe('80000.00'); // 50,000 + 30,000 COMPLETED
      expect(result.total_pending).toBe('35000.00'); // 20,000 REQUESTED + 15,000 APPROVED
      expect(result.total_count).toBe(5);
      expect(result.status_breakdown[RefundStatus.COMPLETED]).toBe(2);
      expect(result.status_breakdown[RefundStatus.REQUESTED]).toBe(1);
      expect(result.status_breakdown[RefundStatus.REJECTED]).toBe(1);
    });
  });
});
