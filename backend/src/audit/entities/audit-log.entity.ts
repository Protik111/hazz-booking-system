import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('audit_logs')
@Index(['actor_id'])
@Index(['action'])
@Index(['entity_type'])
@Index(['entity_id'])
@Index(['created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  actor_id!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor!: User | null;

  @Column({ length: 150 })
  action!: string;

  @Column({ length: 100 })
  entity_type!: string;

  @Column({ length: 100 })
  entity_id!: string;

  @Column({ type: 'jsonb', nullable: true })
  old_value!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  new_value!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ip_address!: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
