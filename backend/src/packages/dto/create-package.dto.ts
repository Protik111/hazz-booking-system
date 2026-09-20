import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsDateString,
  MaxLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PackageType } from '../enums/package-type.enum';
import { TierName } from '../enums/tier-name.enum';

export class CreateTierInlineDto {
  @IsEnum(TierName)
  name!: TierName;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string;

  @IsNumber()
  @Min(1)
  total_quota!: number;
}

export class CreatePackageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEnum(PackageType)
  type!: PackageType;

  @IsString()
  @IsOptional()
  description?: string;

  /** ISO 8601 date string: YYYY-MM-DD */
  @IsDateString()
  departure_date!: string;

  @IsDateString()
  return_date!: string;

  /** Full ISO datetime */
  @IsDateString()
  booking_start!: string;

  @IsDateString()
  booking_end!: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateTierInlineDto)
  tiers?: CreateTierInlineDto[];
}
