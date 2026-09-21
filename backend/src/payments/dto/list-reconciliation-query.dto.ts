import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReconciliationStatus } from '../enums/reconciliation-status.enum';

export class ListReconciliationQueryDto {
  @IsEnum(ReconciliationStatus)
  @IsOptional()
  status?: ReconciliationStatus;

  @IsString()
  @IsOptional()
  gateway?: string;

  @IsString()
  @IsOptional()
  date_from?: string;

  @IsString()
  @IsOptional()
  date_to?: string;

  @IsString()
  @IsOptional()
  transaction_id?: string;

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
