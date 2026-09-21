import { Test, TestingModule } from '@nestjs/testing';
import {
  CancellationController,
  AdminCancellationController,
} from './cancellation.controller';
import { CancellationService } from './cancellation.service';
import { CancellationStatus } from './enums/cancellation-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

describe('Cancellation Controllers', () => {
  const mockCancellationService = {
    requestCancellation: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    approveCancellation: jest.fn(),
    rejectCancellation: jest.fn(),
  };

  let cancellationController: CancellationController;
  let adminCancellationController: AdminCancellationController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CancellationController, AdminCancellationController],
      providers: [
        {
          provide: CancellationService,
          useValue: mockCancellationService,
        },
      ],
    }).compile();

    cancellationController = module.get<CancellationController>(
      CancellationController,
    );
    adminCancellationController = module.get<AdminCancellationController>(
      AdminCancellationController,
    );
  });

  describe('CancellationController', () => {
    it('POST /bookings/:bookingId/cancellation-request should request cancellation', async () => {
      const dto = { reason: 'Family emergency' };
      mockCancellationService.requestCancellation.mockResolvedValue({
        id: 'c-1',
        status: CancellationStatus.REQUESTED,
      });

      const result = await cancellationController.requestCancellation(
        'user-1',
        UserRole.USER,
        'b-1',
        dto,
      );

      expect(result.status).toBe(CancellationStatus.REQUESTED);
      expect(mockCancellationService.requestCancellation).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'b-1',
        dto,
      );
    });

    it('GET /bookings/:bookingId/cancellation-requests should list booking cancellations', async () => {
      mockCancellationService.findAll.mockResolvedValue({
        data: [{ id: 'c-1' }],
        meta: { total: 1 },
      });

      const result = await cancellationController.listBookingCancellations(
        'user-1',
        UserRole.USER,
        'b-1',
        {},
      );

      expect(result.data).toHaveLength(1);
      expect(mockCancellationService.findAll).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        expect.objectContaining({ booking_id: 'b-1' }),
      );
    });

    it('GET /cancellations/:id should get cancellation by id', async () => {
      mockCancellationService.findOne.mockResolvedValue({ id: 'c-1' });

      const result = await cancellationController.findOne(
        'user-1',
        UserRole.USER,
        'c-1',
      );

      expect(result.id).toBe('c-1');
      expect(mockCancellationService.findOne).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'c-1',
      );
    });
  });

  describe('AdminCancellationController', () => {
    it('GET /admin/cancellations should list all cancellations', async () => {
      mockCancellationService.findAll.mockResolvedValue({
        data: [],
        meta: {},
      });

      await adminCancellationController.findAll('admin-1', {
        status: CancellationStatus.REQUESTED,
      });

      expect(mockCancellationService.findAll).toHaveBeenCalledWith(
        'admin-1',
        UserRole.ADMIN,
        { status: CancellationStatus.REQUESTED },
      );
    });

    it('GET /admin/cancellations/:id should get single cancellation', async () => {
      mockCancellationService.findOne.mockResolvedValue({ id: 'c-1' });

      await adminCancellationController.findOne('admin-1', 'c-1');

      expect(mockCancellationService.findOne).toHaveBeenCalledWith(
        'admin-1',
        UserRole.ADMIN,
        'c-1',
      );
    });

    it('POST /admin/cancellations/:id/approve should approve with optional overrides', async () => {
      mockCancellationService.approveCancellation.mockResolvedValue({
        id: 'c-1',
        status: CancellationStatus.APPROVED,
      });

      const dto = { cancellation_charge: 20000, refund_amount: 80000 };
      const result = await adminCancellationController.approve(
        'admin-1',
        'c-1',
        dto,
      );

      expect(result.status).toBe(CancellationStatus.APPROVED);
      expect(mockCancellationService.approveCancellation).toHaveBeenCalledWith(
        'admin-1',
        'c-1',
        dto,
      );
    });

    it('POST /admin/cancellations/:id/reject should reject with reason', async () => {
      mockCancellationService.rejectCancellation.mockResolvedValue({
        id: 'c-1',
        status: CancellationStatus.REJECTED,
      });

      const result = await adminCancellationController.reject(
        'admin-1',
        'c-1',
        {
          reason: 'Non-refundable',
        },
      );

      expect(result.status).toBe(CancellationStatus.REJECTED);
      expect(mockCancellationService.rejectCancellation).toHaveBeenCalledWith(
        'admin-1',
        'c-1',
        'Non-refundable',
      );
    });
  });
});
