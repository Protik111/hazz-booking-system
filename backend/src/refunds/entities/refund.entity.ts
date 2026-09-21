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
import { Booking } from '../../bookings/entities/booking.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { CancellationRequest } from '../../cancellation/entities/cancellation.entity';
import { User } from '../../user/entities/user.entity';
import { PaymentMethod } from '../../payments/enums/payment-method.enum';
import { RefundStatus } from '../enums/refund-status.enum';

@Entity('refunds')
@Index(['booking_id'])
@Index(['status'])
@Index(['payment_id'])
@Index(['cancellation_request_id'])
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  booking_id!: string;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column('uuid', { nullable: true })
  payment_id!: string | null;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id' })
  payment!: Payment | null;

  @Column('uuid', { nullable: true })
  cancellation_request_id!: string | null;

  @ManyToOne(() => CancellationRequest, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'cancellation_request_id' })
  cancellation_request!: CancellationRequest | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.MANUAL_BRANCH,
  })
  method!: PaymentMethod;

  @Column({
    type: 'enum',
    enum: RefundStatus,
    default: RefundStatus.REQUESTED,
  })
  status!: RefundStatus;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  gateway_refund_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  requested_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at!: Date | null;

  @Column('uuid', { nullable: true })
  approved_by_id!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by_id' })
  approved_by!: User | null;

  @Column('uuid', { nullable: true })
  processed_by_id!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'processed_by_id' })
  processed_by!: User | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
