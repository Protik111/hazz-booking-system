import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorsService } from './vendors.service';
import {
  VendorsController,
  VendorExpensesController,
} from './vendors.controller';
import { Vendor } from './entities/vendor.entity';
import { VendorExpense } from './entities/vendor-expense.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Package } from '../packages/entities/package.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vendor, VendorExpense, Booking, Package]),
  ],
  controllers: [VendorsController, VendorExpensesController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
