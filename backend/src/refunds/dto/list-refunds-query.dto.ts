import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RefundStatus } from '../enums/refund-status.enum';

export class ListRefundsQueryDto {
  @IsEnum(RefundStatus)
  @IsOptional()
  status?: RefundStatus;

  @IsString()
  @IsOptional()
  booking_id?: string;

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
