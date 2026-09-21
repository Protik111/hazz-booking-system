import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  MaxLength,
} from 'class-validator';
import { VendorType } from '../enums/vendor-type.enum';
import { VendorStatus } from '../enums/vendor-status.enum';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsEnum(VendorType)
  @IsNotEmpty()
  type!: VendorType;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  contact_name?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(150)
  contact_email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  contact_phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEnum(VendorStatus)
  @IsOptional()
  status?: VendorStatus;
}
