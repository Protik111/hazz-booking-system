import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PilgrimGender, PilgrimStatus } from '../enums/pilgrim-status.enum';

export class UpdatePilgrimDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  full_name?: string;

  @IsDateString()
  @IsOptional()
  date_of_birth?: string;

  @IsEnum(PilgrimGender)
  @IsOptional()
  gender?: PilgrimGender;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  nationality?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  passport_number?: string;

  @IsDateString()
  @IsOptional()
  passport_issue_date?: string;

  @IsDateString()
  @IsOptional()
  passport_expiry_date?: string;

  @IsString()
  @IsOptional()
  passport_document_url?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  email?: string;

  @IsEnum(PilgrimStatus)
  @IsOptional()
  status?: PilgrimStatus;
}
