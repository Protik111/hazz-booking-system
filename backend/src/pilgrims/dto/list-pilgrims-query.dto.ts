import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PilgrimGender, PilgrimStatus } from '../enums/pilgrim-status.enum';

export class ListPilgrimsQueryDto {
  @IsUUID()
  @IsOptional()
  booking_id?: string;

  @IsEnum(PilgrimStatus)
  @IsOptional()
  status?: PilgrimStatus;

  @IsEnum(PilgrimGender)
  @IsOptional()
  gender?: PilgrimGender;

  @IsString()
  @IsOptional()
  search?: string; // Search by name or passport number

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
