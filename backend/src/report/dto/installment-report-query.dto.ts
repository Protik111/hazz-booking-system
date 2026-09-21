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
import { InstallmentStatus } from '../../installments/enums/installment-status.enum';

export class InstallmentReportQueryDto {
  @IsEnum(InstallmentStatus)
  @IsOptional()
  status?: InstallmentStatus;

  @Transform(({ obj }) => obj.package_id ?? obj.packageId)
  @IsUUID()
  @IsOptional()
  package_id?: string;

  @IsDateString()
  @IsOptional()
  due_date_from?: string;

  @IsDateString()
  @IsOptional()
  due_date_to?: string;

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
