import { IsInt, Min } from 'class-validator';

export class UpdateTierQuotaDto {
  /**
   * The new total_quota value.
   * Must be >= held_seats + confirmed_seats (enforced in service).
   */
  @IsInt()
  @Min(1)
  total_quota!: number;
}
