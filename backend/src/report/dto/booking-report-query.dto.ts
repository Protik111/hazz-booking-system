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
import { BookingStatus } from '../../bookings/enums/booking-status.enum';

export class BookingReportQueryDto {
  @Transform(({ obj }) => obj.package_id ?? obj.packageId)
  @IsUUID()
  @IsOptional()
  package_id?: string;

  @Transform(({ obj }) => obj.tier_id ?? obj.tierId)
  @IsUUID()
  @IsOptional()
  tier_id?: string;

  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

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
