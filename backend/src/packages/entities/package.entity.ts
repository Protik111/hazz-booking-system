import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { PackageType } from '../enums/package-type.enum';
import { PackageStatus } from '../enums/package-status.enum';
import { PackageTier } from './package-tier.entity';

@Entity('packages')
@Index(['slug'], { unique: true })
export class Package {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ length: 220, unique: true })
  slug!: string;

  @Column({ type: 'enum', enum: PackageType })
  type!: PackageType;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'date' })
  departure_date!: string;

  @Column({ type: 'date' })
  return_date!: string;

  @Column({ type: 'timestamptz' })
  booking_start!: Date;

  @Column({ type: 'timestamptz' })
  booking_end!: Date;

  @Column({
    type: 'enum',
    enum: PackageStatus,
    default: PackageStatus.DRAFT,
  })
  status!: PackageStatus;

  @OneToMany(() => PackageTier, (tier) => tier.package, { cascade: true })
  tiers!: PackageTier[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at!: Date | null;
}
