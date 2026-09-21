import { IsNotEmpty, IsString } from 'class-validator';

export class RejectCancellationDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
