import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateManualPaymentDto {
  @Transform(({ obj }) => obj.booking_id ?? obj.bookingId)
  @IsUUID()
  booking_id!: string;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsString()
  @MaxLength(200)
  reference!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
