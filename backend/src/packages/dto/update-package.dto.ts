import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PackageType } from '../enums/package-type.enum';
import { PackageStatus } from '../enums/package-status.enum';
import { CreateTierInlineDto } from './create-package.dto';

export class UpdatePackageDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsEnum(PackageType)
  @IsOptional()
  type?: PackageType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  departure_date?: string;

  @IsDateString()
  @IsOptional()
  return_date?: string;

  @IsDateString()
  @IsOptional()
  booking_start?: string;

  @IsDateString()
  @IsOptional()
  booking_end?: string;

  @IsEnum(PackageStatus)
  @IsOptional()
  status?: PackageStatus;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateTierInlineDto)
  tiers?: CreateTierInlineDto[];
}
