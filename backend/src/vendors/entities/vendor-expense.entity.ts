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
import { Vendor } from './vendor.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Package } from '../../packages/entities/package.entity';
import { User } from '../../user/entities/user.entity';
import { ExpenseStatus } from '../enums/expense-status.enum';

@Entity('vendor_expenses')
@Index(['vendor_id'])
@Index(['booking_id'])
@Index(['package_id'])
@Index(['expense_type'])
@Index(['currency'])
@Index(['expense_date'])
export class VendorExpense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  vendor_id!: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.expenses, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor!: Vendor;

  @Column('uuid', { nullable: true })
  booking_id!: string | null;

  @ManyToOne(() => Booking, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking | null;

  @Column('uuid', { nullable: true })
  package_id!: string | null;

  @ManyToOne(() => Package, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'package_id' })
  package!: Package | null;

  @Column({ length: 100 })
  expense_type!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ length: 10, default: 'BDT' })
  currency!: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: '1.0000' })
  exchange_rate!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount_bdt!: string;

  @Column({ type: 'timestamptz' })
  expense_date!: Date;

  @Column({
    type: 'enum',
    enum: ExpenseStatus,
    default: ExpenseStatus.PENDING,
  })
  status!: ExpenseStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column('uuid', { nullable: true })
  created_by_id!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  created_by!: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
