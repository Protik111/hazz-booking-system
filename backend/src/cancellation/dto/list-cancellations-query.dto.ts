import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CancellationStatus } from '../enums/cancellation-status.enum';

export class ListCancellationsQueryDto {
  @IsEnum(CancellationStatus)
  @IsOptional()
  status?: CancellationStatus;

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
