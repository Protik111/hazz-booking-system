import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Payment } from './payment.entity';
import { WebhookEventStatus } from '../enums/webhook-event-status.enum';

@Entity('payment_webhook_events')
@Index(['event_id'], { unique: true, where: '"event_id" IS NOT NULL' })
@Index(['gateway_transaction_id'])
@Index(['payment_id'])
export class PaymentWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  payment_id!: string | null;

  @ManyToOne(() => Payment, (p) => p.webhook_events, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'payment_id' })
  payment!: Payment | null;

  @Column({ length: 50 })
  gateway!: string;

  /**
   * Unique event identifier from gateway.
   * Must be indexed UNIQUE to prevent double-processing.
   */
  @Column({ length: 200, nullable: true })
  event_id!: string | null;

  @Column({ length: 200, nullable: true })
  gateway_transaction_id!: string | null;

  @Column({ length: 100 })
  event_type!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: WebhookEventStatus,
    default: WebhookEventStatus.RECEIVED,
  })
  status!: WebhookEventStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  received_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;
}
