import { IsNotEmpty, IsString } from 'class-validator';

export class RejectRefundDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
