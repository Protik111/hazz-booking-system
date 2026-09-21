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
import { Installment } from '../../installments/entities/installment.entity';

@Entity('payment_allocations')
@Index(['payment_id'])
@Index(['installment_id'])
export class PaymentAllocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  payment_id!: string;

  @ManyToOne(() => Payment, (p) => p.allocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment!: Payment;

  @Column('uuid')
  installment_id!: string;

  @ManyToOne(() => Installment, (i) => i.allocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installment_id' })
  installment!: Installment;

  /** Amount of this payment credited to this installment */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
