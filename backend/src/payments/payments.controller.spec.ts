import { Test, TestingModule } from '@nestjs/testing';
import {
  PaymentsController,
  MockPaymentsController,
  WebhooksController,
  AdminPaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { UserRole } from '../user/enums/user-role.enum';
import { PaymentMethod } from './enums/payment-method.enum';
import { PaymentStatus } from './enums/payment-status.enum';

describe('Payments Controllers', () => {
  const mockPaymentsService = {
    initiatePayment: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    processSuccessfulPayment: jest.fn(),
    processFailedPayment: jest.fn(),
    processWebhook: jest.fn(),
    createManualPayment: jest.fn(),
    approveManualPayment: jest.fn(),
    rejectManualPayment: jest.fn(),
    listReconciliation: jest.fn(),
    importSettlementRecords: jest.fn(),
    resolveMismatch: jest.fn(),
  };

  let paymentsController: PaymentsController;
  let mockPaymentsController: MockPaymentsController;
  let webhooksController: WebhooksController;
  let adminPaymentsController: AdminPaymentsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        PaymentsController,
        MockPaymentsController,
        WebhooksController,
        AdminPaymentsController,
      ],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
      ],
    }).compile();

    paymentsController = module.get<PaymentsController>(PaymentsController);
    mockPaymentsController = module.get<MockPaymentsController>(
      MockPaymentsController,
    );
    webhooksController = module.get<WebhooksController>(WebhooksController);
    adminPaymentsController = module.get<AdminPaymentsController>(
      AdminPaymentsController,
    );
  });

  // ─── PaymentsController ───────────────────────────────────────────────────

  describe('PaymentsController', () => {
    it('POST /payments should initiate payment', async () => {
      const dto = {
        booking_id: 'booking-1',
        amount: 100000,
        method: PaymentMethod.BKASH,
      };
      mockPaymentsService.initiatePayment.mockResolvedValue({
        id: 'pay-1',
        ...dto,
      });

      const result = await paymentsController.initiate('user-1', dto);
      expect(result.id).toBe('pay-1');
      expect(mockPaymentsService.initiatePayment).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });

    it('GET /payments should list payments', async () => {
      mockPaymentsService.findAll.mockResolvedValue({
        data: [{ id: 'pay-1' }],
        meta: { total: 1 },
      });

      const result = await paymentsController.findAll('user-1', UserRole.USER, {
        status: PaymentStatus.SUCCESS,
      });

      expect(result.data).toHaveLength(1);
      expect(mockPaymentsService.findAll).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        { status: PaymentStatus.SUCCESS },
      );
    });

    it('GET /payments/:id should get payment', async () => {
      mockPaymentsService.findOne.mockResolvedValue({ id: 'pay-1' });

      const result = await paymentsController.findOne(
        'user-1',
        UserRole.USER,
        'pay-1',
      );
      expect(result.id).toBe('pay-1');
      expect(mockPaymentsService.findOne).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'pay-1',
      );
    });
  });

  // ─── MockPaymentsController ───────────────────────────────────────────────

  describe('MockPaymentsController', () => {
    it('POST /mock-payments/:paymentId/success should trigger successful payment processing', async () => {
      mockPaymentsService.processSuccessfulPayment.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.SUCCESS,
      });

      const result = await mockPaymentsController.mockSuccess('pay-1', {
        gateway_transaction_id: 'CUSTOM-TX',
        gateway_reference: 'CUSTOM-REF',
        metadata: { info: 'test' },
      });

      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(mockPaymentsService.processSuccessfulPayment).toHaveBeenCalledWith(
        'pay-1',
        'CUSTOM-TX',
        'CUSTOM-REF',
        {
          info: 'test',
        },
      );
    });

    it('POST /mock-payments/:paymentId/success with empty body should generate mock IDs', async () => {
      mockPaymentsService.processSuccessfulPayment.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.SUCCESS,
      });

      await mockPaymentsController.mockSuccess('pay-1');

      expect(mockPaymentsService.processSuccessfulPayment).toHaveBeenCalledWith(
        'pay-1',
        expect.stringContaining('MOCK-TX-'),
        expect.stringContaining('MOCK-REF-'),
        undefined,
      );
    });

    it('POST /mock-payments/:paymentId/fail should trigger failed payment processing', async () => {
      mockPaymentsService.processFailedPayment.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.FAILED,
      });

      const result = await mockPaymentsController.mockFail('pay-1');
      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(mockPaymentsService.processFailedPayment).toHaveBeenCalledWith(
        'pay-1',
      );
    });
  });

  // ─── WebhooksController ───────────────────────────────────────────────────

  describe('WebhooksController', () => {
    it('POST /webhooks/bkash should process bkash webhook payload', async () => {
      mockPaymentsService.processWebhook.mockResolvedValue({
        processed: true,
        duplicate: false,
      });

      const payload = {
        trxID: 'BKASH-TX-123',
        transactionStatus: 'Completed',
        amount: '10000',
        payment_id: 'pay-1',
      };

      const result = await webhooksController.bkashWebhook(payload);
      expect(result).toEqual({ processed: true, duplicate: false });
      expect(mockPaymentsService.processWebhook).toHaveBeenCalledWith(
        'BKASH',
        'BKASH-TX-123',
        'BKASH-TX-123',
        'PAYMENT_STATUS',
        payload,
        true,
      );
    });

    it('POST /webhooks/nagad should process nagad webhook payload', async () => {
      mockPaymentsService.processWebhook.mockResolvedValue({
        processed: true,
        duplicate: false,
      });

      const payload = {
        payment_ref_id: 'NAGAD-REF-1',
        issuerPaymentRefNo: 'NAGAD-TX-1',
        status: 'SUCCESS',
        payment_id: 'pay-1',
      };

      const result = await webhooksController.nagadWebhook(payload);
      expect(result).toEqual({ processed: true, duplicate: false });
      expect(mockPaymentsService.processWebhook).toHaveBeenCalledWith(
        'NAGAD',
        'NAGAD-REF-1',
        'NAGAD-TX-1',
        'PAYMENT',
        payload,
        true,
      );
    });

    it('POST /webhooks/visa should process visa webhook payload', async () => {
      mockPaymentsService.processWebhook.mockResolvedValue({
        processed: true,
        duplicate: false,
      });

      const payload = {
        transaction_id: 'VISA-TX-1',
        status: 'SUCCESS',
        payment_id: 'pay-1',
      };

      const result = await webhooksController.visaWebhook(payload);
      expect(result).toEqual({ processed: true, duplicate: false });
      expect(mockPaymentsService.processWebhook).toHaveBeenCalledWith(
        'VISA',
        'VISA-TX-1',
        'VISA-TX-1',
        'CHARGE.SUCCESS',
        payload,
        true,
      );
    });
  });

  // ─── AdminPaymentsController ──────────────────────────────────────────────

  describe('AdminPaymentsController', () => {
    it('POST /admin/manual-payments should create manual payment', async () => {
      const dto = {
        booking_id: 'booking-1',
        amount: 25000,
        reference: 'BRANCH-99',
        notes: 'Hand cash',
      };
      mockPaymentsService.createManualPayment.mockResolvedValue({
        id: 'pay-1',
        ...dto,
      });

      const result = await adminPaymentsController.createManualPayment(
        'admin-1',
        dto,
      );
      expect(result.id).toBe('pay-1');
      expect(mockPaymentsService.createManualPayment).toHaveBeenCalledWith(
        'admin-1',
        dto,
      );
    });

    it('POST /admin/manual-payments/:id/approve should approve manual payment', async () => {
      mockPaymentsService.approveManualPayment.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.SUCCESS,
      });

      const result = await adminPaymentsController.approveManualPayment(
        'admin-2',
        'pay-1',
      );
      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(mockPaymentsService.approveManualPayment).toHaveBeenCalledWith(
        'admin-2',
        'pay-1',
      );
    });

    it('POST /admin/manual-payments/:id/reject should reject manual payment', async () => {
      mockPaymentsService.rejectManualPayment.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.REJECTED,
      });

      const result = await adminPaymentsController.rejectManualPayment(
        'admin-1',
        'pay-1',
        { reason: 'Fraud suspected' },
      );
      expect(result.status).toBe(PaymentStatus.REJECTED);
      expect(mockPaymentsService.rejectManualPayment).toHaveBeenCalledWith(
        'admin-1',
        'pay-1',
        'Fraud suspected',
      );
    });

    it('GET /admin/reconciliation should list reconciliation records', async () => {
      mockPaymentsService.listReconciliation.mockResolvedValue({
        data: [],
        meta: {},
      });

      const result = await adminPaymentsController.listReconciliation({});
      expect(result.data).toEqual([]);
      expect(mockPaymentsService.listReconciliation).toHaveBeenCalledWith({});
    });

    it('POST /admin/reconciliation/import should import settlement rows', async () => {
      const dto = {
        gateway: 'BKASH',
        records: [
          {
            gateway_transaction_id: 'TX-1',
            amount: 50000,
            settlement_date: '2026-09-20',
          },
        ],
      };
      mockPaymentsService.importSettlementRecords.mockResolvedValue({
        imported: 1,
        matched: 1,
        mismatched: 0,
      });

      const result = await adminPaymentsController.importSettlement(dto);
      expect(result.imported).toBe(1);
      expect(mockPaymentsService.importSettlementRecords).toHaveBeenCalledWith(
        dto,
      );
    });

    it('POST /admin/reconciliation/:id/resolve should resolve discrepancy', async () => {
      const dto = {
        resolution: 'Settlement difference cleared',
        notes: 'Fee waived',
      };
      mockPaymentsService.resolveMismatch.mockResolvedValue({
        id: 'rec-1',
        status: 'RESOLVED',
      });

      const result = await adminPaymentsController.resolveMismatch(
        'admin-1',
        'rec-1',
        dto,
      );
      expect(result.status).toBe('RESOLVED');
      expect(mockPaymentsService.resolveMismatch).toHaveBeenCalledWith(
        'admin-1',
        'rec-1',
        dto,
      );
    });

    it('GET /admin/payments should list all payments using UserRole.ADMIN', async () => {
      mockPaymentsService.findAll.mockResolvedValue({
        data: [],
        meta: {},
      });

      await adminPaymentsController.listAllPayments('admin-1', {});
      expect(mockPaymentsService.findAll).toHaveBeenCalledWith(
        'admin-1',
        UserRole.ADMIN,
        {},
      );
    });
  });
});
