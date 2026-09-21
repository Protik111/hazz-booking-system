import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentMethod } from '../../payments/enums/payment-method.enum';

export class CreateRefundDto {
  @Transform(({ obj }) => obj.booking_id ?? obj.bookingId)
  @IsUUID()
  booking_id!: string;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @Transform(({ obj }) => obj.payment_id ?? obj.paymentId)
  @IsUUID()
  @IsOptional()
  payment_id?: string;

  @IsUUID()
  @IsOptional()
  paymentId?: string;

  @Transform(
    ({ obj }) => obj.cancellation_request_id ?? obj.cancellationRequestId,
  )
  @IsUUID()
  @IsOptional()
  cancellation_request_id?: string;

  @IsUUID()
  @IsOptional()
  cancellationRequestId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @IsString()
  @IsOptional()
  reason?: string;
}
