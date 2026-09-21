import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { ReconciliationRecord } from './entities/reconciliation-record.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Installment } from '../installments/entities/installment.entity';
import { PaymentMethod } from './enums/payment-method.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { WebhookEventStatus } from './enums/webhook-event-status.enum';
import { ReconciliationStatus } from './enums/reconciliation-status.enum';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { InstallmentStatus } from '../installments/enums/installment-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

interface MockEntityManager {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
}

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockPaymentRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockAllocationRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockWebhookEventRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockReconciliationRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockTierRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockInstallmentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
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
          id: 'alloc-id',
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
        PaymentsService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        {
          provide: getRepositoryToken(PaymentAllocation),
          useValue: mockAllocationRepo,
        },
        {
          provide: getRepositoryToken(PaymentWebhookEvent),
          useValue: mockWebhookEventRepo,
        },
        {
          provide: getRepositoryToken(ReconciliationRecord),
          useValue: mockReconciliationRepo,
        },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(PackageTier), useValue: mockTierRepo },
        {
          provide: getRepositoryToken(Installment),
          useValue: mockInstallmentRepo,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  // ─── Payment Initiation ───────────────────────────────────────────────────

  describe('initiatePayment', () => {
    const dto = {
      booking_id: 'booking-1',
      amount: 100000,
      method: PaymentMethod.BKASH,
    };

    it('should throw NotFoundException if booking is not found', async () => {
      mockBookingRepo.findOne.mockResolvedValue(null);

      await expect(service.initiatePayment('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not the booking owner', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        user_id: 'user-2',
        status: BookingStatus.PENDING,
      });

      await expect(service.initiatePayment('user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if booking is CANCELLED or EXPIRED', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        user_id: 'user-1',
        status: BookingStatus.CANCELLED,
      });

      await expect(service.initiatePayment('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if payment amount exceeds outstanding balance', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        user_id: 'user-1',
        status: BookingStatus.PENDING,
        amount_outstanding: '50000.00',
      });

      await expect(service.initiatePayment('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create and return PENDING payment on valid input', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        user_id: 'user-1',
        status: BookingStatus.PENDING,
        amount_outstanding: '150000.00',
      });

      const createdPayment = {
        id: 'pay-1',
        ...dto,
        status: PaymentStatus.PENDING,
      };
      mockPaymentRepo.create.mockReturnValue(createdPayment);
      mockPaymentRepo.save.mockResolvedValue(createdPayment);

      const result = await service.initiatePayment('user-1', dto);

      expect(result).toBe(createdPayment);
      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: 'booking-1',
          user_id: 'user-1',
          amount: '100000.00',
          currency: 'BDT',
          method: PaymentMethod.BKASH,
          status: PaymentStatus.PENDING,
        }),
      );
    });
  });

  // ─── Payment Retrieval ────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should filter by user_id for non-admin and paginate', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'pay-1' }], 1]),
      };
      mockPaymentRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('user-1', UserRole.USER, {
        page: 1,
        limit: 10,
        status: PaymentStatus.SUCCESS,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('p.user_id = :userId', {
        userId: 'user-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('p.status = :status', {
        status: PaymentStatus.SUCCESS,
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should allow admin to query payments across all users', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockPaymentRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('admin-1', UserRole.ADMIN, {});
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        'p.user_id = :userId',
        expect.anything(),
      );
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if payment not found', async () => {
      mockPaymentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('user-1', UserRole.USER, 'pay-999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own payment', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        user_id: 'user-other',
      });

      await expect(
        service.findOne('user-1', UserRole.USER, 'pay-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return payment for owner', async () => {
      const mockPay = { id: 'pay-1', user_id: 'user-1' };
      mockPaymentRepo.findOne.mockResolvedValue(mockPay);

      const result = await service.findOne('user-1', UserRole.USER, 'pay-1');
      expect(result).toBe(mockPay);
    });
  });

  // ─── Process Successful Payment & Oldest-Unpaid-First Allocation ──────────

  describe('processSuccessfulPayment', () => {
    it('should be idempotent and return payment if already SUCCESS', async () => {
      const existingPay = {
        id: 'pay-1',
        status: PaymentStatus.SUCCESS,
      };
      mockEntityManager.findOne.mockResolvedValueOnce(existingPay);

      const result = await service.processSuccessfulPayment('pay-1');
      expect(result).toBe(existingPay);
      expect(mockEntityManager.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if payment is already FAILED or REJECTED', async () => {
      const failedPay = {
        id: 'pay-1',
        status: PaymentStatus.FAILED,
      };
      mockEntityManager.findOne.mockResolvedValueOnce(failedPay);

      await expect(service.processSuccessfulPayment('pay-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allocate payment across installments in ascending order and confirm pending booking', async () => {
      const pendingPayment = {
        id: 'pay-1',
        booking_id: 'booking-1',
        amount: '150000.00',
        status: PaymentStatus.PENDING,
      };

      const booking = {
        id: 'booking-1',
        status: BookingStatus.PENDING,
        total_amount: '300000.00',
        amount_received: '0.00',
        amount_outstanding: '300000.00',
        package_tier_id: 'tier-1',
        pilgrim_count: 2,
        confirmed_at: null,
      };

      const installments = [
        {
          id: 'inst-1',
          booking_id: 'booking-1',
          installment_number: 1,
          amount: '100000.00',
          paid_amount: '0.00',
          status: InstallmentStatus.PENDING,
        },
        {
          id: 'inst-2',
          booking_id: 'booking-1',
          installment_number: 2,
          amount: '100000.00',
          paid_amount: '0.00',
          status: InstallmentStatus.PENDING,
        },
        {
          id: 'inst-3',
          booking_id: 'booking-1',
          installment_number: 3,
          amount: '100000.00',
          paid_amount: '0.00',
          status: InstallmentStatus.PENDING,
        },
      ];

      const tier = {
        id: 'tier-1',
        held_seats: 5,
        confirmed_seats: 10,
      };

      mockEntityManager.findOne
        .mockResolvedValueOnce(pendingPayment) // Payment lookup
        .mockResolvedValueOnce(booking) // Booking lookup
        .mockResolvedValueOnce(tier); // PackageTier lookup

      mockEntityManager.find.mockResolvedValueOnce(installments); // Installments lookup

      const result = await service.processSuccessfulPayment(
        'pay-1',
        'TX-12345',
        'REF-67890',
        { cardType: 'BKASH' },
      );

      // Payment updated
      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(result.gateway_transaction_id).toBe('TX-12345');
      expect(result.gateway_reference).toBe('REF-67890');

      // Installment 1 fully paid (100,000 allocated)
      expect(installments[0].paid_amount).toBe('100000.00');
      expect(installments[0].status).toBe(InstallmentStatus.PAID);

      // Installment 2 partially paid (50,000 allocated)
      expect(installments[1].paid_amount).toBe('50000.00');
      expect(installments[1].status).toBe(InstallmentStatus.PARTIALLY_PAID);

      // Installment 3 untouched
      expect(installments[2].paid_amount).toBe('0.00');
      expect(installments[2].status).toBe(InstallmentStatus.PENDING);

      // Booking financials updated
      expect(booking.amount_received).toBe('150000.00');
      expect(booking.amount_outstanding).toBe('150000.00');
      expect(booking.status).toBe(BookingStatus.CONFIRMED);
      expect(booking.confirmed_at).toBeInstanceOf(Date);

      // PackageTier held_seats converted to confirmed_seats
      expect(tier.held_seats).toBe(3); // 5 - 2
      expect(tier.confirmed_seats).toBe(12); // 10 + 2
    });
  });

  describe('processFailedPayment', () => {
    it('should throw NotFoundException if payment not found', async () => {
      mockPaymentRepo.findOne.mockResolvedValue(null);
      await expect(service.processFailedPayment('pay-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if payment not in PENDING state', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.SUCCESS,
      });
      await expect(service.processFailedPayment('pay-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mark payment as FAILED and save', async () => {
      const payment = { id: 'pay-1', status: PaymentStatus.PENDING };
      mockPaymentRepo.findOne.mockResolvedValue(payment);
      mockPaymentRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.processFailedPayment('pay-1');
      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(mockPaymentRepo.save).toHaveBeenCalledWith(payment);
    });
  });

  // ─── Webhooks & Idempotency ───────────────────────────────────────────────

  describe('processWebhook', () => {
    it('should return duplicate: true without modifying payment if event_id already processed', async () => {
      mockWebhookEventRepo.findOne.mockResolvedValue({
        id: 'evt-1',
        event_id: 'unique-evt-id',
      });

      const result = await service.processWebhook(
        'BKASH',
        'unique-evt-id',
        'TX-1',
        'PAYMENT_SUCCESS',
        {},
        true,
      );

      expect(result).toEqual({ processed: true, duplicate: true });
      expect(mockPaymentRepo.findOne).not.toHaveBeenCalled();
    });

    it('should store event and process successful payment', async () => {
      mockWebhookEventRepo.findOne.mockResolvedValue(null);
      const savedEvt = {
        id: 'evt-1',
        event_id: 'new-evt',
        status: WebhookEventStatus.RECEIVED,
      };
      mockWebhookEventRepo.create.mockReturnValue(savedEvt);
      mockWebhookEventRepo.save.mockResolvedValue(savedEvt);

      const payment = {
        id: 'pay-1',
        status: PaymentStatus.PENDING,
        gateway_transaction_id: 'TX-1',
      };
      mockPaymentRepo.findOne.mockResolvedValue(payment);

      jest
        .spyOn(service, 'processSuccessfulPayment')
        .mockResolvedValue(payment as Payment);

      const result = await service.processWebhook(
        'BKASH',
        'new-evt',
        'TX-1',
        'PAYMENT_SUCCESS',
        { payment_id: 'pay-1' },
        true,
      );

      expect(result).toEqual({ processed: true, duplicate: false });
      expect(service.processSuccessfulPayment).toHaveBeenCalledWith(
        'pay-1',
        'TX-1',
        undefined,
        { payment_id: 'pay-1' },
      );
      expect(savedEvt.status).toBe(WebhookEventStatus.PROCESSED);
    });

    it('should mark event as FAILED if processing throws error', async () => {
      mockWebhookEventRepo.findOne.mockResolvedValue(null);
      const savedEvt = {
        id: 'evt-1',
        event_id: 'new-evt',
        status: WebhookEventStatus.RECEIVED,
      };
      mockWebhookEventRepo.create.mockReturnValue(savedEvt);
      mockWebhookEventRepo.save.mockResolvedValue(savedEvt);

      mockPaymentRepo.findOne.mockResolvedValue({ id: 'pay-1' });
      jest
        .spyOn(service, 'processSuccessfulPayment')
        .mockRejectedValue(new Error('DB Lock failed'));

      const result = await service.processWebhook(
        'BKASH',
        'new-evt',
        'TX-1',
        'PAYMENT_SUCCESS',
        {},
        true,
      );

      expect(result).toEqual({ processed: false, duplicate: false });
      expect(savedEvt.status).toBe(WebhookEventStatus.FAILED);
      expect(savedEvt.error_message).toBe('DB Lock failed');
    });
  });

  // ─── Manual Branch Payments ───────────────────────────────────────────────

  describe('createManualPayment', () => {
    const dto = {
      booking_id: 'booking-1',
      amount: 50000,
      reference: 'BRANCH-001',
      notes: 'Cash received',
    };

    it('should throw NotFoundException if booking not found', async () => {
      mockBookingRepo.findOne.mockResolvedValue(null);
      await expect(service.createManualPayment('admin-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if booking cancelled or expired', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.EXPIRED,
      });
      await expect(service.createManualPayment('admin-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create payment with PENDING_APPROVAL and created_by_id = adminId', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        user_id: 'user-1',
        status: BookingStatus.PENDING,
      });

      const created = {
        id: 'pay-manual-1',
        ...dto,
        status: PaymentStatus.PENDING_APPROVAL,
      };
      mockPaymentRepo.create.mockReturnValue(created);
      mockPaymentRepo.save.mockResolvedValue(created);

      const result = await service.createManualPayment('admin-1', dto);
      expect(result.status).toBe(PaymentStatus.PENDING_APPROVAL);
      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: 'booking-1',
          user_id: 'user-1',
          amount: '50000.00',
          method: PaymentMethod.MANUAL_BRANCH,
          status: PaymentStatus.PENDING_APPROVAL,
          created_by_id: 'admin-1',
          reference: 'BRANCH-001',
          notes: 'Cash received',
        }),
      );
    });
  });

  describe('approveManualPayment (Separation of Duties)', () => {
    it('should throw NotFoundException if payment not found', async () => {
      mockPaymentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.approveManualPayment('admin-2', 'pay-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if payment is not PENDING_APPROVAL', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PENDING,
      });
      await expect(
        service.approveManualPayment('admin-2', 'pay-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if approver is the same as creator', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PENDING_APPROVAL,
        created_by_id: 'admin-1',
      });

      await expect(
        service.approveManualPayment('admin-1', 'pay-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow different admin to approve and trigger successful payment processing', async () => {
      const payment = {
        id: 'pay-1',
        status: PaymentStatus.PENDING_APPROVAL,
        created_by_id: 'admin-1',
        approved_by_id: null,
      };
      mockPaymentRepo.findOne.mockResolvedValue(payment);
      mockPaymentRepo.save.mockResolvedValue(payment);

      jest
        .spyOn(service, 'processSuccessfulPayment')
        .mockResolvedValue(payment as Payment);

      const result = await service.approveManualPayment('admin-2', 'pay-1');

      expect(payment.approved_by_id).toBe('admin-2');
      expect(mockPaymentRepo.save).toHaveBeenCalledWith(payment);
      expect(service.processSuccessfulPayment).toHaveBeenCalledWith('pay-1');
      expect(result).toBe(payment);
    });
  });

  describe('rejectManualPayment', () => {
    it('should throw BadRequestException if payment not PENDING_APPROVAL', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.SUCCESS,
      });
      await expect(
        service.rejectManualPayment('admin-1', 'pay-1', 'Invalid receipt'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark payment as REJECTED with rejection reason', async () => {
      const payment = {
        id: 'pay-1',
        status: PaymentStatus.PENDING_APPROVAL,
        rejection_reason: null,
      };
      mockPaymentRepo.findOne.mockResolvedValue(payment);
      mockPaymentRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.rejectManualPayment(
        'admin-1',
        'pay-1',
        'Invalid receipt',
      );

      expect(result.status).toBe(PaymentStatus.REJECTED);
      expect(result.rejection_reason).toBe('Invalid receipt');
    });
  });

  // ─── Reconciliation & Settlement Import ───────────────────────────────────

  describe('importSettlementRecords', () => {
    it('should compare internal payment and gateway amount and flag MATCHED / MISMATCH', async () => {
      // Payment 1: internal 100000 vs gateway 100000 -> MATCHED
      mockPaymentRepo.findOne
        .mockResolvedValueOnce({
          id: 'pay-1',
          amount: '100000.00',
        })
        // Payment 2: internal 50000 vs gateway 45000 -> MISMATCH
        .mockResolvedValueOnce({
          id: 'pay-2',
          amount: '50000.00',
        });

      mockReconciliationRepo.create.mockImplementation((data) => data);
      mockReconciliationRepo.save.mockImplementation((record) =>
        Promise.resolve(record),
      );

      const dto = {
        gateway: 'BKASH',
        records: [
          {
            gateway_transaction_id: 'TX-1',
            amount: 100000,
            settlement_date: '2026-09-21',
          },
          {
            gateway_transaction_id: 'TX-2',
            amount: 45000,
            settlement_date: '2026-09-21',
          },
        ],
      };

      const result = await service.importSettlementRecords(dto);

      expect(result.imported).toBe(2);
      expect(result.matched).toBe(1);
      expect(result.mismatched).toBe(1);
      expect(result.records[0].status).toBe(ReconciliationStatus.MATCHED);
      expect(result.records[1].status).toBe(ReconciliationStatus.MISMATCH);
      expect(result.records[1].difference).toBe('5000.00');
    });

    it('should parse CSV formatted input if provided', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        amount: '100000.00',
      });
      mockReconciliationRepo.create.mockImplementation((data) => data);
      mockReconciliationRepo.save.mockImplementation((r) => Promise.resolve(r));

      const dto = {
        gateway: 'BKASH',
        csv: `gateway_transaction_id,amount,settlement_date\nTX-1,100000,2026-09-21`,
      };

      const result = await service.importSettlementRecords(dto);
      expect(result.imported).toBe(1);
      expect(result.matched).toBe(1);
    });
  });

  describe('resolveMismatch', () => {
    it('should throw NotFoundException if reconciliation record not found', async () => {
      mockReconciliationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.resolveMismatch('admin-1', 'rec-1', {
          resolution: 'Manual refund issued',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if record is already RESOLVED', async () => {
      mockReconciliationRepo.findOne.mockResolvedValue({
        id: 'rec-1',
        status: ReconciliationStatus.RESOLVED,
      });

      await expect(
        service.resolveMismatch('admin-1', 'rec-1', {
          resolution: 'Already handled',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark record as RESOLVED with resolver and notes', async () => {
      const record = {
        id: 'rec-1',
        status: ReconciliationStatus.MISMATCH,
        resolution_notes: null,
        resolved_by: null,
        resolved_at: null,
      };
      mockReconciliationRepo.findOne.mockResolvedValue(record);
      mockReconciliationRepo.save.mockImplementation((r) => Promise.resolve(r));

      const result = await service.resolveMismatch('admin-1', 'rec-1', {
        resolution: 'Approved gateway fee deduction',
        notes: 'Deducted by provider',
      });

      expect(result.status).toBe(ReconciliationStatus.RESOLVED);
      expect(result.resolved_by).toBe('admin-1');
      expect(result.resolved_at).toBeInstanceOf(Date);
      expect(result.resolution_notes).toContain(
        'Approved gateway fee deduction',
      );
    });
  });

  describe('listReconciliation', () => {
    it('should filter reconciliation records and paginate', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'rec-1' }], 1]),
      };
      mockReconciliationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listReconciliation({
        status: ReconciliationStatus.MISMATCH,
        gateway: 'BKASH',
        transaction_id: 'TX-1',
        date_from: '2026-09-01',
        date_to: '2026-09-30',
        page: 1,
        limit: 10,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :status', {
        status: ReconciliationStatus.MISMATCH,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('r.gateway = :gateway', {
        gateway: 'BKASH',
      });
      expect(result.data).toHaveLength(1);
    });
  });
});
