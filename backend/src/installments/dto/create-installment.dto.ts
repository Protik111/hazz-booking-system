import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Min,
} from 'class-validator';
import { InstallmentStatus } from '../enums/installment-status.enum';

export class CreateInstallmentDto {
  @IsUUID()
  booking_id!: string;

  @IsInt()
  @Min(1)
  installment_number!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsDateString()
  due_date!: string;

  @IsEnum(InstallmentStatus)
  @IsOptional()
  status?: InstallmentStatus;
}
