import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAuditLogDto {
  @IsUUID()
  @IsOptional()
  actor_id?: string | null;

  @IsString()
  @IsNotEmpty()
  action!: string;

  @IsString()
  @IsNotEmpty()
  entity_type!: string;

  @IsString()
  @IsNotEmpty()
  entity_id!: string;

  @IsOptional()
  old_value?: Record<string, unknown> | null;

  @IsOptional()
  new_value?: Record<string, unknown> | null;

  @IsString()
  @IsOptional()
  ip_address?: string | null;

  @IsString()
  @IsOptional()
  user_agent?: string | null;
}
