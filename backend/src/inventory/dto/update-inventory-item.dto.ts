import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { InventoryStatus } from '../enums/inventory-status.enum';

export class UpdateInventoryItemDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sku?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  unit?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  minimum_stock?: number;

  @IsEnum(InventoryStatus)
  @IsOptional()
  status?: InventoryStatus;
}
