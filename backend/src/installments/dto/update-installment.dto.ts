import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { InstallmentStatus } from '../enums/installment-status.enum';

export class UpdateInstallmentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  amount?: number;

  @IsDateString()
  @IsOptional()
  due_date?: string;

  @IsEnum(InstallmentStatus)
  @IsOptional()
  status?: InstallmentStatus;
}
