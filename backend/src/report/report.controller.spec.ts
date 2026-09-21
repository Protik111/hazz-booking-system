import { Test, TestingModule } from '@nestjs/testing';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

describe('ReportController', () => {
  let controller: ReportController;

  const mockReportService = {
    getOverviewReport: jest.fn(),
    getBookingReport: jest.fn(),
    getPaymentReport: jest.fn(),
    getInstallmentReport: jest.fn(),
    getRefundReport: jest.fn(),
    getSeatQuotaReport: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        {
          provide: ReportService,
          useValue: mockReportService,
        },
      ],
    }).compile();

    controller = module.get<ReportController>(ReportController);
  });

  it('GET /admin/reports/overview should return overview report', async () => {
    mockReportService.getOverviewReport.mockResolvedValue({
      totalBookings: 10,
    });

    const result = await controller.getOverview();

    expect(result.totalBookings).toBe(10);
    expect(mockReportService.getOverviewReport).toHaveBeenCalled();
  });

  it('GET /admin/reports/bookings should return booking report', async () => {
    mockReportService.getBookingReport.mockResolvedValue({
      summary: {},
      data: [],
    });

    const result = await controller.getBookingsReport({});

    expect(result.data).toBeDefined();
    expect(mockReportService.getBookingReport).toHaveBeenCalledWith({});
  });

  it('GET /admin/reports/payments should return payments report', async () => {
    mockReportService.getPaymentReport.mockResolvedValue({
      summary: {},
      data: [],
    });

    const result = await controller.getPaymentsReport({});

    expect(result.data).toBeDefined();
    expect(mockReportService.getPaymentReport).toHaveBeenCalledWith({});
  });

  it('GET /admin/reports/installments should return installments report', async () => {
    mockReportService.getInstallmentReport.mockResolvedValue({
      summary: {},
      data: [],
    });

    const result = await controller.getInstallmentsReport({});

    expect(result.data).toBeDefined();
    expect(mockReportService.getInstallmentReport).toHaveBeenCalledWith({});
  });

  it('GET /admin/reports/refunds should return refunds report', async () => {
    mockReportService.getRefundReport.mockResolvedValue({
      total_refunded: '0.00',
    });

    const result = await controller.getRefundsReport();

    expect(result.total_refunded).toBe('0.00');
    expect(mockReportService.getRefundReport).toHaveBeenCalled();
  });

  it('GET /admin/reports/seat-quota should return seat quota report', async () => {
    mockReportService.getSeatQuotaReport.mockResolvedValue({
      summary: {},
      tiers: [],
    });

    const result = await controller.getSeatQuotaReport();

    expect(result.tiers).toBeDefined();
    expect(mockReportService.getSeatQuotaReport).toHaveBeenCalled();
  });
});
