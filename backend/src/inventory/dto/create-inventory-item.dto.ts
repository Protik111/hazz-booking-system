import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { InventoryStatus } from '../enums/inventory-status.enum';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  unit?: string = 'PCS';

  @IsInt()
  @Min(0)
  @IsOptional()
  quantity?: number = 0;

  @IsInt()
  @Min(0)
  @IsOptional()
  minimum_stock?: number = 0;

  @IsEnum(InventoryStatus)
  @IsOptional()
  status?: InventoryStatus = InventoryStatus.ACTIVE;
}
