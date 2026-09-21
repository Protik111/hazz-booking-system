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
import { PilgrimGender, PilgrimStatus } from '../enums/pilgrim-status.enum';

@Entity('pilgrims')
@Index(['booking_id'])
@Index(['passport_number'])
export class Pilgrim {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  booking_id!: string;

  @ManyToOne(() => Booking, (b) => b.pilgrims, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column({ length: 150 })
  full_name!: string;

  @Column({ type: 'date' })
  date_of_birth!: string;

  @Column({ type: 'enum', enum: PilgrimGender })
  gender!: PilgrimGender;

  @Column({ length: 100, default: 'Bangladeshi' })
  nationality!: string;

  @Column({ length: 50 })
  passport_number!: string;

  @Column({ type: 'date', nullable: true })
  passport_issue_date!: string | null;

  @Column({ type: 'date', nullable: true })
  passport_expiry_date!: string | null;

  @Column({ type: 'text', nullable: true })
  passport_document_url!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({
    type: 'enum',
    enum: PilgrimStatus,
    default: PilgrimStatus.ACTIVE,
  })
  status!: PilgrimStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
