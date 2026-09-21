import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Installment } from '../installments/entities/installment.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Refund } from '../refunds/entities/refund.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      Payment,
      Installment,
      PackageTier,
      Refund,
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
