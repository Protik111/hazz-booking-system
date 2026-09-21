import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { InventoryStatus } from '../enums/inventory-status.enum';
import type { InventoryTransaction } from './inventory-transaction.entity';

@Entity('inventory_items')
@Index(['sku'], { unique: true })
@Index(['status'])
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 100, unique: true })
  sku!: string;

  @Column({ length: 50, default: 'PCS' })
  unit!: string;

  @Column({ type: 'int', default: 0 })
  quantity!: number;

  @Column({ type: 'int', default: 0 })
  minimum_stock!: number;

  @Column({
    type: 'enum',
    enum: InventoryStatus,
    default: InventoryStatus.ACTIVE,
  })
  status!: InventoryStatus;

  @OneToMany(
    'InventoryTransaction',
    (tx: InventoryTransaction) => tx.inventory_item,
  )
  transactions!: InventoryTransaction[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
