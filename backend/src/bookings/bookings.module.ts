import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { Pilgrim } from './entities/pilgrim.entity';
import { Installment } from './entities/installment.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { BookingsService } from './bookings.service';
import {
  BookingsController,
  InstallmentsController,
  AdminBookingsController,
} from './bookings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Pilgrim, Installment, PackageTier]),
  ],
  controllers: [
    BookingsController,
    InstallmentsController,
    AdminBookingsController,
  ],
  providers: [BookingsService],
  exports: [BookingsService, TypeOrmModule],
})
export class BookingsModule {}
