import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Installment } from './entities/installment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { InstallmentsService } from './installments.service';
import { InstallmentsController } from './installments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Installment, Booking])],
  controllers: [InstallmentsController],
  providers: [InstallmentsService],
  exports: [InstallmentsService, TypeOrmModule],
})
export class InstallmentsModule {}
