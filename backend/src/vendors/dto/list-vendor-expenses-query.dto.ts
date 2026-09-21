import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ExpenseStatus } from '../enums/expense-status.enum';

export class ListVendorExpensesQueryDto {
  @Transform(({ obj }) => obj.vendor_id ?? obj.vendorId)
  @IsUUID()
  @IsOptional()
  vendor_id?: string;

  @Transform(({ obj }) => obj.booking_id ?? obj.bookingId)
  @IsUUID()
  @IsOptional()
  booking_id?: string;

  @Transform(({ obj }) => obj.package_id ?? obj.packageId)
  @IsUUID()
  @IsOptional()
  package_id?: string;

  @Transform(({ obj }) => obj.expense_type ?? obj.expenseType)
  @IsString()
  @IsOptional()
  expense_type?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(ExpenseStatus)
  @IsOptional()
  status?: ExpenseStatus;

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
