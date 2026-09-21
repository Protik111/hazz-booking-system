import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ExpenseStatus } from '../enums/expense-status.enum';

export class UpdateVendorExpenseDto {
  @Transform(({ obj }) => obj.vendor_id ?? obj.vendorId)
  @IsUUID()
  @IsOptional()
  vendor_id?: string;

  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @Transform(({ obj }) => obj.booking_id ?? obj.bookingId)
  @IsUUID()
  @IsOptional()
  booking_id?: string;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @Transform(({ obj }) => obj.package_id ?? obj.packageId)
  @IsUUID()
  @IsOptional()
  package_id?: string;

  @IsUUID()
  @IsOptional()
  packageId?: string;

  @Transform(({ obj }) => obj.expense_type ?? obj.expenseType)
  @IsString()
  @IsOptional()
  @MaxLength(100)
  expense_type?: string;

  @IsString()
  @IsOptional()
  expenseType?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string;

  @Transform(({ obj }) => obj.exchange_rate ?? obj.exchangeRate)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @IsOptional()
  exchange_rate?: number;

  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @Transform(({ obj }) => obj.expense_date ?? obj.expenseDate)
  @IsDateString()
  @IsOptional()
  expense_date?: string;

  @IsDateString()
  @IsOptional()
  expenseDate?: string;

  @IsEnum(ExpenseStatus)
  @IsOptional()
  status?: ExpenseStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
