import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ExpenseStatus } from '../enums/expense-status.enum';

export class CreateVendorExpenseDto {
  @Transform(({ obj }) => obj.vendor_id ?? obj.vendorId)
  @IsUUID()
  @IsNotEmpty()
  vendor_id!: string;

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
  @IsNotEmpty()
  @MaxLength(100)
  expense_type!: string;

  @IsString()
  @IsOptional()
  expenseType?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string = 'BDT';

  @Transform(({ obj }) => obj.exchange_rate ?? obj.exchangeRate ?? 1)
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @IsOptional()
  exchange_rate?: number = 1.0;

  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @Transform(({ obj }) => obj.expense_date ?? obj.expenseDate)
  @IsDateString()
  @IsNotEmpty()
  expense_date!: string;

  @IsDateString()
  @IsOptional()
  expenseDate?: string;

  @IsEnum(ExpenseStatus)
  @IsOptional()
  status?: ExpenseStatus = ExpenseStatus.PENDING;

  @IsString()
  @IsOptional()
  notes?: string;
}
