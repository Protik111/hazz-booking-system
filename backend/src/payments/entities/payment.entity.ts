import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../user/entities/user.entity';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import type { PaymentAllocation } from './payment-allocation.entity';
import type { PaymentWebhookEvent } from './payment-webhook-event.entity';

@Entity('payments')
@Index(['booking_id'])
@Index(['user_id'])
@Index(['status'])
@Index(['gateway_transaction_id'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  booking_id!: string;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /** Amount the user intends to pay / the amount processed */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ length: 10, default: 'BDT' })
  currency!: string;

  @Column({ type: 'enum', enum: PaymentMethod })
  method!: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  /** Set by the payment gateway on success */
  @Column({ type: 'varchar', length: 200, nullable: true })
  gateway_transaction_id!: string | null;

  /** Auxiliary reference such as bKash trxID */
  @Column({ type: 'varchar', length: 200, nullable: true })
  gateway_reference!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  payment_date!: Date | null;

  /** Raw gateway metadata (JSON) */
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  /** Admin who initiated a MANUAL_BRANCH payment */
  @Column('uuid', { nullable: true })
  created_by_id!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  created_by!: User | null;

  /** Admin who approved a MANUAL_BRANCH payment (must differ from creator) */
  @Column('uuid', { nullable: true })
  approved_by_id!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approved_by!: User | null;

  /** Free-text reference for branch payments (e.g. BRANCH-2026-00123) */
  @Column({ type: 'varchar', length: 200, nullable: true })
  reference!: string | null;

  /** Internal notes for manual payments */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Rejection reason populated on REJECTED status */
  @Column({ type: 'text', nullable: true })
  rejection_reason!: string | null;

  @OneToMany('PaymentAllocation', (alloc: PaymentAllocation) => alloc.payment)
  allocations!: PaymentAllocation[];

  @OneToMany('PaymentWebhookEvent', (evt: PaymentWebhookEvent) => evt.payment)
  webhook_events!: PaymentWebhookEvent[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
