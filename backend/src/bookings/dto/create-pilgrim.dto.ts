import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PilgrimGender } from '../enums/pilgrim-status.enum';

export class CreatePilgrimDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  full_name!: string;

  /** YYYY-MM-DD */
  @IsDateString()
  date_of_birth!: string;

  @IsEnum(PilgrimGender)
  gender!: PilgrimGender;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  nationality?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  passport_number!: string;

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
}
