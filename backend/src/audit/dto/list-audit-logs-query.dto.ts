import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ListAuditLogsQueryDto {
  @Transform(({ obj }) => obj.actor_id ?? obj.actor)
  @IsUUID()
  @IsOptional()
  actor_id?: string;

  @IsString()
  @IsOptional()
  action?: string;

  @Transform(({ obj }) => obj.entity_type ?? obj.entityType)
  @IsString()
  @IsOptional()
  entity_type?: string;

  @Transform(({ obj }) => obj.entity_id ?? obj.entityId)
  @IsString()
  @IsOptional()
  entity_id?: string;

  @IsDateString()
  @IsOptional()
  date_from?: string;

  @IsDateString()
  @IsOptional()
  date_to?: string;

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
