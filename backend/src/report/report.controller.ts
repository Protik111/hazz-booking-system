import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { BookingReportQueryDto } from './dto/booking-report-query.dto';
import { PaymentReportQueryDto } from './dto/payment-report-query.dto';
import { InstallmentReportQueryDto } from './dto/installment-report-query.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../user/enums/user-role.enum';

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('overview')
  getOverview() {
    return this.reportService.getOverviewReport();
  }

  @Get('bookings')
  getBookingsReport(@Query() query: BookingReportQueryDto) {
    return this.reportService.getBookingReport(query);
  }

  @Get('payments')
  getPaymentsReport(@Query() query: PaymentReportQueryDto) {
    return this.reportService.getPaymentReport(query);
  }

  @Get('installments')
  getInstallmentsReport(@Query() query: InstallmentReportQueryDto) {
    return this.reportService.getInstallmentReport(query);
  }

  @Get('refunds')
  getRefundsReport() {
    return this.reportService.getRefundReport();
  }

  @Get('seat-quota')
  getSeatQuotaReport() {
    return this.reportService.getSeatQuotaReport();
  }
}
