import { Test, TestingModule } from '@nestjs/testing';
import {
  RefundsController,
  AdminRefundsController,
} from './refunds.controller';
import { RefundsService } from './refunds.service';
import { RefundStatus } from './enums/refund-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

describe('Refunds Controllers', () => {
  const mockRefundsService = {
    createRefund: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    approveRefund: jest.fn(),
    processRefund: jest.fn(),
    rejectRefund: jest.fn(),
    getRefundReport: jest.fn(),
  };

  let refundsController: RefundsController;
  let adminRefundsController: AdminRefundsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefundsController, AdminRefundsController],
      providers: [
        {
          provide: RefundsService,
          useValue: mockRefundsService,
        },
      ],
    }).compile();

    refundsController = module.get<RefundsController>(RefundsController);
    adminRefundsController = module.get<AdminRefundsController>(
      AdminRefundsController,
    );
  });

  describe('RefundsController', () => {
    it('POST /refunds should create a refund request', async () => {
      const dto = { booking_id: 'b-1', amount: 50000, reason: 'Cancelled' };
      mockRefundsService.createRefund.mockResolvedValue({
        id: 'r-1',
        status: RefundStatus.REQUESTED,
      });

      const result = await refundsController.create(
        'user-1',
        UserRole.USER,
        dto,
      );

      expect(result.status).toBe(RefundStatus.REQUESTED);
      expect(mockRefundsService.createRefund).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        dto,
      );
    });

    it('GET /bookings/:bookingId/refunds should list booking refunds', async () => {
      mockRefundsService.findAll.mockResolvedValue({
        data: [{ id: 'r-1' }],
        meta: { total: 1 },
      });

      const result = await refundsController.listBookingRefunds(
        'user-1',
        UserRole.USER,
        'b-1',
        {},
      );

      expect(result.data).toHaveLength(1);
      expect(mockRefundsService.findAll).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        expect.objectContaining({ booking_id: 'b-1' }),
      );
    });

    it('GET /refunds/:id should get a single refund', async () => {
      mockRefundsService.findOne.mockResolvedValue({ id: 'r-1' });

      const result = await refundsController.findOne(
        'user-1',
        UserRole.USER,
        'r-1',
      );

      expect(result.id).toBe('r-1');
      expect(mockRefundsService.findOne).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'r-1',
      );
    });
  });

  describe('AdminRefundsController', () => {
    it('GET /admin/refunds should list all refunds', async () => {
      mockRefundsService.findAll.mockResolvedValue({ data: [], meta: {} });

      await adminRefundsController.findAll('admin-1', {
        status: RefundStatus.REQUESTED,
      });

      expect(mockRefundsService.findAll).toHaveBeenCalledWith(
        'admin-1',
        UserRole.ADMIN,
        { status: RefundStatus.REQUESTED },
      );
    });

    it('GET /admin/reports/refunds should return refund report', async () => {
      const report = {
        total_refunded: '80000.00',
        total_pending: '35000.00',
        total_count: 5,
        status_breakdown: {},
      };
      mockRefundsService.getRefundReport.mockResolvedValue(report);

      const result = await adminRefundsController.getRefundReport();
      expect(result.total_refunded).toBe('80000.00');
    });

    it('POST /admin/refunds/:id/approve should approve refund', async () => {
      mockRefundsService.approveRefund.mockResolvedValue({
        id: 'r-1',
        status: RefundStatus.APPROVED,
      });

      const result = await adminRefundsController.approve('admin-1', 'r-1');

      expect(result.status).toBe(RefundStatus.APPROVED);
      expect(mockRefundsService.approveRefund).toHaveBeenCalledWith(
        'admin-1',
        'r-1',
      );
    });

    it('POST /admin/refunds/:id/process should process refund payout', async () => {
      mockRefundsService.processRefund.mockResolvedValue({
        id: 'r-1',
        status: RefundStatus.COMPLETED,
      });

      const dto = { gateway_refund_id: 'GW-001', notes: 'Processed' };
      const result = await adminRefundsController.process(
        'admin-1',
        'r-1',
        dto,
      );

      expect(result.status).toBe(RefundStatus.COMPLETED);
      expect(mockRefundsService.processRefund).toHaveBeenCalledWith(
        'admin-1',
        'r-1',
        dto,
      );
    });

    it('POST /admin/refunds/:id/reject should reject refund with reason', async () => {
      mockRefundsService.rejectRefund.mockResolvedValue({
        id: 'r-1',
        status: RefundStatus.REJECTED,
      });

      const result = await adminRefundsController.reject('admin-1', 'r-1', {
        reason: 'Insufficient documentation',
      });

      expect(result.status).toBe(RefundStatus.REJECTED);
      expect(mockRefundsService.rejectRefund).toHaveBeenCalledWith(
        'admin-1',
        'r-1',
        'Insufficient documentation',
      );
    });
  });
});
