import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportService } from './report.service';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Installment } from '../installments/entities/installment.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Refund } from '../refunds/entities/refund.entity';
import { RefundStatus } from '../refunds/enums/refund-status.enum';
import { PaymentMethod } from '../payments/enums/payment-method.enum';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { InstallmentStatus } from '../installments/enums/installment-status.enum';

describe('ReportService', () => {
  let service: ReportService;

  const mockBookingRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockPaymentRepo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
  };

  const mockInstallmentRepo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
  };

  const mockTierRepo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
  };

  const mockRefundRepo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        {
          provide: getRepositoryToken(Installment),
          useValue: mockInstallmentRepo,
        },
        { provide: getRepositoryToken(PackageTier), useValue: mockTierRepo },
        { provide: getRepositoryToken(Refund), useValue: mockRefundRepo },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  // ─── 1. Overview Report ───────────────────────────────────────────────────

  describe('getOverviewReport', () => {
    it('should aggregate metrics across all tables correctly', async () => {
      mockBookingRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          totalBookings: '12',
          confirmedBookings: '10',
          totalCollected: '450000.00',
          totalOutstanding: '80000.00',
        }),
      });

      mockRefundRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          totalRefunded: '12000.00',
        }),
      });

      mockTierRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          totalQuota: '2000',
          heldSeats: '40',
          confirmedSeats: '1640',
        }),
      });

      mockInstallmentRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
      });

      const result = await service.getOverviewReport();

      expect(result.totalBookings).toBe(12);
      expect(result.confirmedBookings).toBe(10);
      expect(result.totalCollected).toBe(450000);
      expect(result.totalOutstanding).toBe(80000);
      expect(result.totalRefunded).toBe(12000);
      expect(result.heldSeats).toBe(40);
      expect(result.confirmedSeats).toBe(1640);
      expect(result.availableSeats).toBe(320); // 2000 - 40 - 1640
      expect(result.overdueInstallments).toBe(5);
    });
  });

  // ─── 2. Booking Report ────────────────────────────────────────────────────

  describe('getBookingReport', () => {
    it('should return financial summary and paginated data', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'b-1' }], 1]),
      };

      const aggQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          count: '1',
          confirmed: '1',
          pending: '0',
          cancelled: '0',
          totalAmount: '100000.00',
          totalReceived: '50000.00',
          totalOutstanding: '50000.00',
        }),
      };

      mockBookingRepo.createQueryBuilder
        .mockReturnValueOnce(qb)
        .mockReturnValueOnce(aggQb);

      const result = await service.getBookingReport({ page: 1, limit: 10 });

      expect(result.summary.totalBookings).toBe(1);
      expect(result.summary.totalAmount).toBe(100000);
      expect(result.data).toHaveLength(1);
    });
  });

  // ─── 3. Payment Report ────────────────────────────────────────────────────

  describe('getPaymentReport', () => {
    it('should aggregate volume and count by payment method and status', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'p-1' }], 1]),
      };
      mockPaymentRepo.createQueryBuilder.mockReturnValue(qb);

      mockPaymentRepo.find.mockResolvedValue([
        {
          id: 'p-1',
          amount: '20000.00',
          method: PaymentMethod.BKASH,
          status: PaymentStatus.SUCCESS,
        },
        {
          id: 'p-2',
          amount: '30000.00',
          method: PaymentMethod.MANUAL_BRANCH,
          status: PaymentStatus.SUCCESS,
        },
      ]);

      const result = await service.getPaymentReport({ page: 1, limit: 10 });

      expect(result.summary.totalPayments).toBe(2);
      expect(result.summary.totalVolume).toBe(50000);
      expect(result.summary.byMethod[PaymentMethod.BKASH]).toBe(20000);
      expect(result.summary.byMethod[PaymentMethod.MANUAL_BRANCH]).toBe(30000);
    });
  });

  // ─── 4. Installment Report ────────────────────────────────────────────────

  describe('getInstallmentReport', () => {
    it('should aggregate due and paid amounts across installments', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'i-1' }], 1]),
      };
      mockInstallmentRepo.createQueryBuilder.mockReturnValue(qb);

      mockInstallmentRepo.find.mockResolvedValue([
        {
          id: 'i-1',
          amount: '50000.00',
          paid_amount: '50000.00',
          status: InstallmentStatus.PAID,
        },
        {
          id: 'i-2',
          amount: '50000.00',
          paid_amount: '0.00',
          status: InstallmentStatus.OVERDUE,
        },
      ]);

      const result = await service.getInstallmentReport({ page: 1, limit: 10 });

      expect(result.summary.totalInstallments).toBe(2);
      expect(result.summary.totalDue).toBe(100000);
      expect(result.summary.totalPaid).toBe(50000);
      expect(result.summary.byStatus[InstallmentStatus.OVERDUE]).toBe(1);
    });
  });

  // ─── 5. Refund Report ─────────────────────────────────────────────────────

  describe('getRefundReport', () => {
    it('should aggregate total refunded and pending', async () => {
      mockRefundRepo.find.mockResolvedValue([
        { amount: '40000.00', status: RefundStatus.COMPLETED },
        { amount: '10000.00', status: RefundStatus.APPROVED },
      ]);

      const result = await service.getRefundReport();

      expect(result.total_refunded).toBe('40000.00');
      expect(result.total_pending).toBe('10000.00');
      expect(result.total_count).toBe(2);
    });
  });

  // ─── 6. Seat Quota Report ─────────────────────────────────────────────────

  describe('getSeatQuotaReport', () => {
    it('should calculate seat quota utilization per tier and network total', async () => {
      mockTierRepo.find.mockResolvedValue([
        {
          id: 't-1',
          name: 'VIP',
          package_id: 'pkg-1',
          package: { name: 'VIP Hajj 2026', slug: 'vip-hajj-2026' },
          price: '500000.00',
          currency: 'BDT',
          total_quota: 100,
          held_seats: 10,
          confirmed_seats: 70,
        },
      ]);

      const result = await service.getSeatQuotaReport();

      expect(result.summary.total_quota).toBe(100);
      expect(result.summary.held_seats).toBe(10);
      expect(result.summary.confirmed_seats).toBe(70);
      expect(result.summary.available_seats).toBe(20);
      expect(result.summary.overall_utilization_percent).toBe(80); // (80 / 100) * 100
      expect(result.tiers[0].utilization_rate_percent).toBe(80);
    });
  });
});
