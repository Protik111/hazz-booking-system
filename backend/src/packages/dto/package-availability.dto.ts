import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PackageType } from '../enums/package-type.enum';

/**
 * Query DTO for `GET /packages/availability`.
 *
 * - `type` is optional; if omitted, the response aggregates across all types.
 * - `year` is optional; defaults to the current calendar year on the server.
 *   Years must be between 1900 and 2100 to keep URL params sane.
 */
export class PackageAvailabilityQueryDto {
  @IsEnum(PackageType)
  @IsOptional()
  type?: PackageType;

  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  @IsOptional()
  year?: number;
}

export interface AvailabilityMonthBucket {
  /** ISO YYYY-MM (e.g. '2026-09'). */
  month: string;
  /** Number of published packages whose departure_date falls in this month. */
  count: number;
}

export interface PackageAvailabilityResponse {
  type: PackageType | 'ALL';
  year: number;
  /** Always 12 entries, one per calendar month, even if count is 0. */
  months: AvailabilityMonthBucket[];
  /**
   * Sparse map of ISO YYYY-MM-DD → true for days that have at least one
   * published package in the given year + type filter.
   */
  days: Record<string, boolean>;
}
