import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ProcessRefundDto {
  @IsString()
  @MaxLength(200)
  @IsOptional()
  gateway_refund_id?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
