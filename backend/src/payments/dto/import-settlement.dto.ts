import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SettlementRowDto {
  @IsString()
  @IsNotEmpty()
  gateway_transaction_id!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsDateString()
  settlement_date!: string;
}

export class ImportSettlementDto {
  @IsString()
  @IsNotEmpty()
  gateway!: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SettlementRowDto)
  records?: SettlementRowDto[];

  @IsString()
  @IsOptional()
  csv?: string;
}
