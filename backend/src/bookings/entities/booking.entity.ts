import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Package } from '../../packages/entities/package.entity';
import { PackageTier } from '../../packages/entities/package-tier.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { PaymentPlan } from '../enums/payment-plan.enum';
import { Pilgrim } from './pilgrim.entity';
import { Installment } from './installment.entity';

@Entity('bookings')
@Index(['booking_number'], { unique: true })
@Index(['user_id'])
@Index(['package_id'])
@Index(['status'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Human-readable booking number: BK-YYYY-NNNNNN
   * Generated atomically inside the booking transaction.
   */
  @Column({ length: 30, unique: true })
  booking_number!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column('uuid')
  package_id!: string;

  @ManyToOne(() => Package, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'package_id' })
  package!: Package;

  @Column('uuid')
  package_tier_id!: string;

  @ManyToOne(() => PackageTier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'package_tier_id' })
  package_tier!: PackageTier;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @Column({ type: 'enum', enum: PaymentPlan })
  payment_plan!: PaymentPlan;

  @Column({ type: 'int' })
  pilgrim_count!: number;

  /**
   * unit_price is frozen at booking creation from the tier price.
   * It must not change even if the tier price changes later.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unit_price!: string;

  /** total_amount = unit_price * pilgrim_count */
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  total_amount!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  amount_received!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount_outstanding!: string;

  /** Seats are held until this timestamp. If not paid, expire and release. */
  @Column({ type: 'timestamptz', nullable: true })
  hold_expires_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmed_at!: Date | null;

  @OneToMany(() => Pilgrim, (pilgrim) => pilgrim.booking, { cascade: true })
  pilgrims!: Pilgrim[];

  @OneToMany(() => Installment, (installment) => installment.booking, {
    cascade: true,
  })
  installments!: Installment[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at!: Date | null;
}
