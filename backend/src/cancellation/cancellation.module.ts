import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancellationRequest } from './entities/cancellation.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Pilgrim } from '../bookings/entities/pilgrim.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Refund } from '../refunds/entities/refund.entity';
import { CancellationService } from './cancellation.service';
import {
  CancellationController,
  AdminCancellationController,
} from './cancellation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CancellationRequest,
      Booking,
      Pilgrim,
      PackageTier,
      Refund,
    ]),
  ],
  controllers: [CancellationController, AdminCancellationController],
  providers: [CancellationService],
  exports: [CancellationService, TypeOrmModule],
})
export class CancellationModule {}
