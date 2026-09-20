import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PackageType } from '../enums/package-type.enum';
import { PackageStatus } from '../enums/package-status.enum';

export class ListPackagesQueryDto {
  @IsEnum(PackageType)
  @IsOptional()
  type?: PackageType;

  @IsEnum(PackageStatus)
  @IsOptional()
  status?: PackageStatus;

  /** ISO date string YYYY-MM-DD — filter packages departing after this date */
  @IsString()
  @IsOptional()
  departure_from?: string;

  /** ISO date string YYYY-MM-DD — filter packages departing before this date */
  @IsString()
  @IsOptional()
  departure_to?: string;

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

  @IsString()
  @IsOptional()
  sort?: string; // e.g. 'departure_date:asc' | 'created_at:desc'
}
