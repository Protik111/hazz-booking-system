import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VendorType } from '../enums/vendor-type.enum';
import { VendorStatus } from '../enums/vendor-status.enum';

export class ListVendorsQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(VendorType)
  @IsOptional()
  type?: VendorType;

  @IsEnum(VendorStatus)
  @IsOptional()
  status?: VendorStatus;

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
