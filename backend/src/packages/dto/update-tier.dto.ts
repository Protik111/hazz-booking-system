import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TierName, TierStatus } from '../enums/tier-name.enum';

export class UpdateTierDto {
  @IsEnum(TierName)
  @IsOptional()
  name?: TierName;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  total_quota?: number;

  @IsEnum(TierStatus)
  @IsOptional()
  status?: TierStatus;
}
