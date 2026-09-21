import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { InventoryTransactionType } from '../enums/inventory-transaction-type.enum';

export class ListInventoryTransactionsQueryDto {
  @Transform(({ obj }) => obj.inventory_item_id ?? obj.inventoryItemId)
  @IsUUID()
  @IsOptional()
  inventory_item_id?: string;

  @IsEnum(InventoryTransactionType)
  @IsOptional()
  type?: InventoryTransactionType;

  @Transform(({ obj }) => obj.booking_id ?? obj.bookingId)
  @IsUUID()
  @IsOptional()
  booking_id?: string;

  @Transform(({ obj }) => obj.pilgrim_id ?? obj.pilgrimId)
  @IsUUID()
  @IsOptional()
  pilgrim_id?: string;

  @IsDateString()
  @IsOptional()
  date_from?: string;

  @IsDateString()
  @IsOptional()
  date_to?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
