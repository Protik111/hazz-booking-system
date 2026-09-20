import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Package } from './package.entity';
import { TierName, TierStatus } from '../enums/tier-name.enum';

@Entity('package_tiers')
@Index(['package_id'])
export class PackageTier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  package_id!: string;

  @ManyToOne(() => Package, (pkg) => pkg.tiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'package_id' })
  package!: Package;

  @Column({ type: 'enum', enum: TierName })
  name!: TierName;

  /**
   * DECIMAL(12,2): supports up to 9,999,999,999.99 BDT.
   * Price is captured here and frozen in the booking at creation time.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: string;

  @Column({ length: 10, default: 'BDT' })
  currency!: string;

  @Column({ type: 'int' })
  total_quota!: number;

  /** Seats currently held (awaiting payment) — released on expiry or cancellation */
  @Column({ type: 'int', default: 0 })
  held_seats!: number;

  /** Seats confirmed (payment received) */
  @Column({ type: 'int', default: 0 })
  confirmed_seats!: number;

  @Column({ type: 'enum', enum: TierStatus, default: TierStatus.ACTIVE })
  status!: TierStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at!: Date | null;
}
