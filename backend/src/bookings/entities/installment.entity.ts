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
import { Booking } from './booking.entity';
import { InstallmentStatus } from '../enums/installment-status.enum';

@Entity('installments')
@Index(['booking_id'])
@Index(['status'])
export class Installment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  booking_id!: string;

  @ManyToOne(() => Booking, (b) => b.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column({ type: 'int' })
  installment_number!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  paid_amount!: string;

  @Column({ type: 'date' })
  due_date!: string;

  @Column({
    type: 'enum',
    enum: InstallmentStatus,
    default: InstallmentStatus.PENDING,
  })
  status!: InstallmentStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
