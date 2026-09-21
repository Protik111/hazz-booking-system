import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Pilgrim } from '../../pilgrims/entities/pilgrim.entity';
import { User } from '../../user/entities/user.entity';
import { InventoryTransactionType } from '../enums/inventory-transaction-type.enum';

@Entity('inventory_transactions')
@Index(['inventory_item_id'])
@Index(['type'])
@Index(['booking_id'])
@Index(['pilgrim_id'])
@Index(['created_at'])
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  inventory_item_id!: string;

  @ManyToOne(() => InventoryItem, (item) => item.transactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'inventory_item_id' })
  inventory_item!: InventoryItem;

  @Column({
    type: 'enum',
    enum: InventoryTransactionType,
  })
  type!: InventoryTransactionType;

  @Column({ type: 'int' })
  quantity!: number;

  @Column('uuid', { nullable: true })
  booking_id!: string | null;

  @ManyToOne(() => Booking, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking | null;

  @Column('uuid', { nullable: true })
  pilgrim_id!: string | null;

  @ManyToOne(() => Pilgrim, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pilgrim_id' })
  pilgrim!: Pilgrim | null;

  @Column('uuid', { nullable: true })
  created_by_id!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  created_by!: User | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
