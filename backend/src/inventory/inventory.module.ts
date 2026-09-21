import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import {
  InventoryItemsController,
  InventoryTransactionsController,
} from './inventory.controller';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Pilgrim } from '../pilgrims/entities/pilgrim.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryTransaction,
      Booking,
      Pilgrim,
    ]),
  ],
  controllers: [InventoryItemsController, InventoryTransactionsController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
