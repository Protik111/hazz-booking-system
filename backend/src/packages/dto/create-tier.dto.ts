import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TierName } from '../enums/tier-name.enum';

export class CreateTierDto {
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
