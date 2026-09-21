import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { InventoryTransactionType } from '../enums/inventory-transaction-type.enum';

export class CreateInventoryTransactionDto {
  @Transform(({ obj }) => obj.inventory_item_id ?? obj.inventoryItemId)
  @IsUUID()
  @IsNotEmpty()
  inventory_item_id!: string;

  @IsUUID()
  @IsOptional()
  inventoryItemId?: string;

  @IsEnum(InventoryTransactionType)
  @IsNotEmpty()
  type!: InventoryTransactionType;

  @IsInt()
  @IsNotEmpty()
  quantity!: number;

  @Transform(({ obj }) => obj.booking_id ?? obj.bookingId)
  @IsUUID()
  @IsOptional()
  booking_id?: string;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @Transform(({ obj }) => obj.pilgrim_id ?? obj.pilgrimId)
  @IsUUID()
  @IsOptional()
  pilgrim_id?: string;

  @IsUUID()
  @IsOptional()
  pilgrimId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
