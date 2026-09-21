import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class RejectPaymentDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ResolveReconciliationDto {
  @IsString()
  @IsNotEmpty()
  resolution!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
