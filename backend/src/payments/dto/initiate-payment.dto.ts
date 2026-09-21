import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentMethod } from '../enums/payment-method.enum';

export class InitiatePaymentDto {
  @Transform(({ obj }) => obj.booking_id ?? obj.bookingId)
  @IsUUID()
  booking_id!: string;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
