import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Refund } from './entities/refund.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { CancellationRequest } from '../cancellation/entities/cancellation.entity';
import { RefundsService } from './refunds.service';
import {
  RefundsController,
  AdminRefundsController,
} from './refunds.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Refund, Booking, Payment, CancellationRequest]),
  ],
  controllers: [RefundsController, AdminRefundsController],
  providers: [RefundsService],
  exports: [RefundsService, TypeOrmModule],
})
export class RefundsModule {}
