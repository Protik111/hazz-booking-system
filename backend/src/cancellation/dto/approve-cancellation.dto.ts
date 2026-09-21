import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ApproveCancellationDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  cancellation_charge?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  vendor_cost?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  refund_amount?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
