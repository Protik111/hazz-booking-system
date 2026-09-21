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
import { Pilgrim } from '../../bookings/entities/pilgrim.entity';
import { User } from '../../user/entities/user.entity';
import { CancellationStatus } from '../enums/cancellation-status.enum';

@Entity('cancellation_requests')
@Index(['booking_id'])
@Index(['status'])
@Index(['requested_by_id'])
export class CancellationRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  booking_id!: string;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  /**
   * Nullable: null means entire booking cancellation.
   * Non-null means partial cancellation of a specific pilgrim.
   */
  @Column('uuid', { nullable: true })
  pilgrim_id!: string | null;

  @ManyToOne(() => Pilgrim, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pilgrim_id' })
  pilgrim!: Pilgrim | null;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  cancellation_charge!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  vendor_cost!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  refund_amount!: string;

  @Column({
    type: 'enum',
    enum: CancellationStatus,
    default: CancellationStatus.REQUESTED,
  })
  status!: CancellationStatus;

  @Column('uuid')
  requested_by_id!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requested_by_id' })
  requested_by!: User;

  @Column('uuid', { nullable: true })
  approved_by_id!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by_id' })
  approved_by!: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
