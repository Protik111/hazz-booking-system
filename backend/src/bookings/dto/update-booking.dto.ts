import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentPlan } from '../enums/payment-plan.enum';

export class UpdateBookingDto {
  @IsEnum(PaymentPlan)
  @IsOptional()
  payment_plan?: PaymentPlan;

  @IsString()
  @IsOptional()
  notes?: string;
}
