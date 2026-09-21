import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Payment } from './payment.entity';
import { User } from '../../user/entities/user.entity';
import { ReconciliationStatus } from '../enums/reconciliation-status.enum';

@Entity('reconciliation_records')
@Index(['gateway_transaction_id'])
@Index(['payment_id'])
@Index(['status'])
export class ReconciliationRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  payment_id!: string | null;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id' })
  payment!: Payment | null;

  /** Which gateway this settlement row came from */
  @Column({ length: 50 })
  gateway!: string;

  @Column({ length: 200 })
  gateway_transaction_id!: string;

  /** Amount recorded in our system for this transaction */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  internal_amount!: string;

  /** Amount reported in the gateway settlement file */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  gateway_amount!: string;

  /** internal_amount - gateway_amount */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  difference!: string;

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.MISMATCH,
  })
  status!: ReconciliationStatus;

  @Column({ type: 'date', nullable: true })
  settlement_date!: string | null;

  @Column('uuid', { nullable: true })
  resolved_by!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolver!: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  resolution_notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
