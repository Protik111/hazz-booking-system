import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestCancellationDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @Transform(({ obj }) => obj.pilgrim_id ?? obj.pilgrimId)
  @IsUUID()
  @IsOptional()
  pilgrim_id?: string;

  @IsUUID()
  @IsOptional()
  pilgrimId?: string;
}
