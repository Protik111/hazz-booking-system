import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Booking } from '../bookings/entities/booking.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Installment } from '../installments/entities/installment.entity';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { InstallmentStatus } from '../installments/enums/installment-status.enum';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(PackageTier)
    private readonly tierRepo: Repository<PackageTier>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
  ) {}

  // ─── 1. Expire Seat Holds ─────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async expireSeatHolds(): Promise<{
    expiredCount: number;
    bookingIds: string[];
  }> {
    const now = new Date();

    const expiredBookings = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.status = :status', { status: BookingStatus.PENDING })
      .andWhere('b.hold_expires_at <= :now', { now })
      .getMany();

    if (expiredBookings.length === 0) {
      return { expiredCount: 0, bookingIds: [] };
    }

    const processedBookingIds: string[] = [];

    for (const booking of expiredBookings) {
      try {
        await this.dataSource.transaction(async (manager) => {
          // Lock tier for atomic release
          const tier = await manager.findOne(PackageTier, {
            where: { id: booking.package_tier_id },
            lock: { mode: 'pessimistic_write' },
          });

          if (tier) {
            tier.held_seats = Math.max(
              0,
              tier.held_seats - booking.pilgrim_count,
            );
            await manager.save(PackageTier, tier);
          }

          booking.status = BookingStatus.EXPIRED;
          await manager.save(Booking, booking);

          await this.auditService.recordLog({
            action: 'SEAT_HOLD_EXPIRED',
            entity_type: 'Booking',
            entity_id: booking.id,
            old_value: { status: BookingStatus.PENDING },
            new_value: {
              status: BookingStatus.EXPIRED,
              releasedSeats: booking.pilgrim_count,
            },
          });
        });

        this.eventEmitter.emit('booking.hold.expired', {
          bookingId: booking.id,
          packageTierId: booking.package_tier_id,
          seats: booking.pilgrim_count,
        });

        processedBookingIds.push(booking.id);
        this.logger.log(
          `Released ${booking.pilgrim_count} held seats for expired booking ${booking.id}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to expire booking hold for ${booking.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      expiredCount: processedBookingIds.length,
      bookingIds: processedBookingIds,
    };
  }

  // ─── 2. Process Overdue Installments ──────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async processOverdueInstallments(): Promise<{
    overdueCount: number;
    installmentIds: string[];
  }> {
    const now = new Date();
    const nowDateStr = now.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const overdueList = await this.installmentRepo
      .createQueryBuilder('i')
      .where('i.status = :status', { status: InstallmentStatus.PENDING })
      .andWhere('i.due_date <= :now', { now: nowDateStr })
      .getMany();

    if (overdueList.length === 0) {
      return { overdueCount: 0, installmentIds: [] };
    }

    const updatedIds: string[] = [];

    for (const inst of overdueList) {
      inst.status = InstallmentStatus.OVERDUE;
      await this.installmentRepo.save(inst);

      this.eventEmitter.emit('installment.overdue', {
        installmentId: inst.id,
        bookingId: inst.booking_id,
        dueDate: inst.due_date,
      });

      await this.auditService.recordLog({
        action: 'INSTALLMENT_OVERDUE',
        entity_type: 'Installment',
        entity_id: inst.id,
        new_value: {
          status: InstallmentStatus.OVERDUE,
          dueDate: inst.due_date,
        },
      });

      updatedIds.push(inst.id);
    }

    this.logger.log(`Processed ${updatedIds.length} overdue installments`);
    return { overdueCount: updatedIds.length, installmentIds: updatedIds };
  }

  // ─── 3. Send Installment Reminders ────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendInstallmentReminders(): Promise<{
    remindersCount: number;
    installmentIds: string[];
  }> {
    const now = new Date();
    const reminderThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days ahead

    const upcoming = await this.installmentRepo
      .createQueryBuilder('i')
      .where('i.status = :status', { status: InstallmentStatus.PENDING })
      .andWhere('i.due_date > :now', { now })
      .andWhere('i.due_date <= :threshold', { threshold: reminderThreshold })
      .getMany();

    const remindedIds: string[] = [];

    for (const inst of upcoming) {
      this.eventEmitter.emit('installment.reminder.due', {
        installmentId: inst.id,
        bookingId: inst.booking_id,
        dueDate: inst.due_date,
        amount: inst.amount,
      });
      remindedIds.push(inst.id);
    }

    this.logger.log(`Sent ${remindedIds.length} installment reminders`);
    return { remindersCount: remindedIds.length, installmentIds: remindedIds };
  }

  // ─── 4. Health / Status ───────────────────────────────────────────────────

  getStatus() {
    return {
      status: 'active',
      jobs: [
        {
          name: 'expire-seat-holds',
          schedule: 'every minute',
          description: 'Releases held seats for expired pending bookings',
        },
        {
          name: 'process-overdue-installments',
          schedule: 'every hour',
          description: 'Marks pending installments past due as OVERDUE',
        },
        {
          name: 'send-installment-reminders',
          schedule: 'daily at 9 AM',
          description: 'Emits reminders for installments due within 3 days',
        },
      ],
    };
  }
}
