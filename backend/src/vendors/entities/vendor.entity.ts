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
import { VendorType } from '../enums/vendor-type.enum';
import { VendorStatus } from '../enums/vendor-status.enum';
import type { VendorExpense } from './vendor-expense.entity';

@Entity('vendors')
@Index(['type'])
@Index(['status'])
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({
    type: 'enum',
    enum: VendorType,
    default: VendorType.OTHER,
  })
  type!: VendorType;

  /** Free-text contact info (email / phone / website / notes). Frontend
   *  renders this as the single "Contact info" field on the vendor form. */
  @Column({ type: 'text', nullable: true })
  contact_info!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  contact_name!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  contact_email!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contact_phone!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({
    type: 'enum',
    enum: VendorStatus,
    default: VendorStatus.ACTIVE,
  })
  status!: VendorStatus;

  @OneToMany('VendorExpense', (expense: VendorExpense) => expense.vendor)
  expenses!: VendorExpense[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
