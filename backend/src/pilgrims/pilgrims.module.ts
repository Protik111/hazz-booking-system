import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pilgrim } from './entities/pilgrim.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { PilgrimsService } from './pilgrims.service';
import {
  PilgrimsController,
  AdminPilgrimsController,
} from './pilgrims.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pilgrim, Booking, PackageTier])],
  controllers: [PilgrimsController, AdminPilgrimsController],
  providers: [PilgrimsService],
  exports: [PilgrimsService, TypeOrmModule],
})
export class PilgrimsModule {}
