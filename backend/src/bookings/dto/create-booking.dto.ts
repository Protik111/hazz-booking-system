import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentPlan } from '../enums/payment-plan.enum';
import { CreatePilgrimDto } from './create-pilgrim.dto';

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  package_tier_id!: string;

  @IsEnum(PaymentPlan)
  payment_plan!: PaymentPlan;

  @IsInt()
  @Min(1)
  @IsOptional()
  pilgrim_count?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePilgrimDto)
  pilgrims?: CreatePilgrimDto[];
}
