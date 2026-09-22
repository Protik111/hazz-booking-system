import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { ReconciliationRecord } from './entities/reconciliation-record.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Installment } from '../installments/entities/installment.entity';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { ResolveReconciliationDto } from './dto/resolve-reconciliation.dto';
import { ImportSettlementDto } from './dto/import-settlement.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { ListReconciliationQueryDto } from './dto/list-reconciliation-query.dto';
import { PaymentMethod } from './enums/payment-method.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { WebhookEventStatus } from './enums/webhook-event-status.enum';
import { ReconciliationStatus } from './enums/reconciliation-status.enum';
import { InstallmentStatus } from '../installments/enums/installment-status.enum';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentAllocation)
    private readonly allocationRepo: Repository<PaymentAllocation>,
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookEventRepo: Repository<PaymentWebhookEvent>,
    @InjectRepository(ReconciliationRecord)
    private readonly reconciliationRepo: Repository<ReconciliationRecord>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(PackageTier)
    private readonly tierRepo: Repository<PackageTier>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
  ) {}

  // ─── Payment Initiation ───────────────────────────────────────────────────

  async initiatePayment(
    userId: string,
    dto: InitiatePaymentDto,
  ): Promise<Payment> {
    const booking = await this.bookingRepo.findOne({
      where: { id: dto.booking_id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.user_id !== userId) {
      throw new ForbiddenException('Access denied to this booking');
    }
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.EXPIRED
    ) {
      throw new BadRequestException('This booking is not payable');
    }

    const outstanding = parseFloat(booking.amount_outstanding);
    if (dto.amount > outstanding + 0.01) {
      throw new BadRequestException(
        `Amount exceeds outstanding balance of ${outstanding.toFixed(2)}`,
      );
    }

    const payment = this.paymentRepo.create({
      booking_id: dto.booking_id,
      user_id: userId,
      amount: dto.amount.toFixed(2),
      currency: 'BDT',
      method: dto.method,
      status: PaymentStatus.PENDING,
    });

    return this.paymentRepo.save(payment);
  }

  // ─── Payment Retrieval ────────────────────────────────────────────────────

  async findAll(
    userId: string,
    userRole: UserRole,
    query: ListPaymentsQueryDto,
  ) {
    const { status, method, booking_id, page = 1, limit = 20 } = query;

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.booking', 'b')
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (userRole !== UserRole.ADMIN) {
      qb.andWhere('p.user_id = :userId', { userId });
    }
    if (status) qb.andWhere('p.status = :status', { status });
    if (method) qb.andWhere('p.method = :method', { method });
    if (booking_id) qb.andWhere('p.booking_id = :booking_id', { booking_id });

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    userId: string,
    userRole: UserRole,
    id: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['booking', 'allocations', 'allocations.installment'],
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (userRole !== UserRole.ADMIN && payment.user_id !== userId) {
      throw new ForbiddenException('Access denied to this payment');
    }

    return payment;
  }

  // ─── Core Payment Processing (Transactional) ───────────────────────────────

  /**
   * Atomically processes a successful payment:
   *  1. Updates payment status to SUCCESS.
   *  2. Allocates amount to oldest unpaid installments first.
   *  3. Updates booking amount_received and amount_outstanding.
   *  4. If booking was PENDING and fully paid or all installments paid, confirms it
   *     and converts held_seats → confirmed_seats on PackageTier.
   *
   * This is the single source of truth called by:
   *  - webhook handlers
   *  - mock payment success endpoint
   *  - manual payment approval
   */
  async processSuccessfulPayment(
    paymentId: string,
    gatewayTxId?: string,
    gatewayRef?: string,
    metadata?: Record<string, unknown>,
  ): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the payment row only. Don't join `booking` here — TypeORM turns
      // relations into a LEFT JOIN and Postgres refuses FOR UPDATE on the
      // nullable outer-join side ("FOR UPDATE cannot be applied to the
      // nullable side of an outer join").
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) throw new NotFoundException('Payment not found');

      if (payment.status === PaymentStatus.SUCCESS) {
        return payment; // idempotent — already processed
      }
      if (
        payment.status === PaymentStatus.FAILED ||
        payment.status === PaymentStatus.REJECTED
      ) {
        throw new BadRequestException(
          `Cannot process a ${payment.status.toLowerCase()} payment`,
        );
      }

      // Update payment record
      payment.status = PaymentStatus.SUCCESS;
      payment.payment_date = new Date();
      if (gatewayTxId) payment.gateway_transaction_id = gatewayTxId;
      if (gatewayRef) payment.gateway_reference = gatewayRef;
      if (metadata) payment.metadata = metadata;
      await manager.save(Payment, payment);

      const booking = await manager.findOne(Booking, {
        where: { id: payment.booking_id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Booking not found');

      // Allocate payment to oldest unpaid installments first
      const installments = await manager.find(Installment, {
        where: { booking_id: booking.id },
        order: { installment_number: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      let remainingAmount = parseFloat(payment.amount);

      for (const installment of installments) {
        if (remainingAmount <= 0) break;
        if (installment.status === InstallmentStatus.PAID) continue;

        const owed =
          parseFloat(installment.amount) - parseFloat(installment.paid_amount);
        if (owed <= 0) continue;

        const credit = Math.min(remainingAmount, owed);
        installment.paid_amount = (
          parseFloat(installment.paid_amount) + credit
        ).toFixed(2);
        remainingAmount -= credit;

        const newPaid = parseFloat(installment.paid_amount);
        const total = parseFloat(installment.amount);

        if (newPaid >= total) {
          installment.status = InstallmentStatus.PAID;
        } else if (newPaid > 0) {
          installment.status = InstallmentStatus.PARTIALLY_PAID;
        }

        await manager.save(Installment, installment);

        const allocation = manager.create(PaymentAllocation, {
          payment_id: paymentId,
          installment_id: installment.id,
          amount: credit.toFixed(2),
        });
        await manager.save(PaymentAllocation, allocation);
      }

      // Update booking financial totals
      const newReceived =
        parseFloat(booking.amount_received) + parseFloat(payment.amount);
      booking.amount_received = newReceived.toFixed(2);
      booking.amount_outstanding = Math.max(
        0,
        parseFloat(booking.total_amount) - newReceived,
      ).toFixed(2);

      // Confirm booking if it was PENDING
      if (booking.status === BookingStatus.PENDING) {
        booking.status = BookingStatus.CONFIRMED;
        booking.confirmed_at = new Date();

        // Convert held_seats → confirmed_seats on the tier
        const tier = await manager.findOne(PackageTier, {
          where: { id: booking.package_tier_id },
          lock: { mode: 'pessimistic_write' },
        });
        if (tier) {
          tier.held_seats = Math.max(
            0,
            tier.held_seats - booking.pilgrim_count,
          );
          tier.confirmed_seats += booking.pilgrim_count;
          await manager.save(PackageTier, tier);
        }
      }

      await manager.save(Booking, booking);
      return payment;
    });
  }

  async processFailedPayment(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment is not in PENDING state');
    }

    payment.status = PaymentStatus.FAILED;
    return this.paymentRepo.save(payment);
  }

  // ─── Webhook Processing (Idempotent) ──────────────────────────────────────

  async processWebhook(
    gateway: string,
    eventId: string | null,
    txId: string,
    eventType: string,
    payload: Record<string, unknown>,
    isSuccess: boolean,
  ): Promise<{ processed: boolean; duplicate: boolean }> {
    // Idempotency check by event_id
    if (eventId) {
      const existing = await this.webhookEventRepo.findOne({
        where: { event_id: eventId },
      });
      if (existing) {
        // Already processed — return 200 without touching financial state
        return { processed: true, duplicate: true };
      }
    }

    // Store webhook event immediately
    const webhookEvent = this.webhookEventRepo.create({
      gateway,
      event_id: eventId,
      gateway_transaction_id: txId,
      event_type: eventType,
      payload,
      status: WebhookEventStatus.RECEIVED,
    });
    const savedEvent = await this.webhookEventRepo.save(webhookEvent);

    try {
      // Find the payment by gateway_transaction_id, or by payment_id from payload, or if txId is payment id (UUID)
      let payment: Payment | null = null;
      if (txId) {
        payment = await this.paymentRepo.findOne({
          where: { gateway_transaction_id: txId },
        });
      }

      const paymentIdFromPayload =
        (payload?.payment_id as string) ||
        (payload?.paymentId as string) ||
        (payload?.merchant_invoice_number as string) ||
        (payload?.invoice_number as string);

      if (!payment && paymentIdFromPayload) {
        payment = await this.paymentRepo.findOne({
          where: { id: paymentIdFromPayload },
        });
      }

      if (
        !payment &&
        txId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          txId,
        )
      ) {
        payment = await this.paymentRepo.findOne({
          where: { id: txId },
        });
      }

      if (payment) {
        if (isSuccess) {
          await this.processSuccessfulPayment(
            payment.id,
            txId,
            undefined,
            payload,
          );
        } else {
          await this.processFailedPayment(payment.id);
        }

        savedEvent.payment_id = payment.id;
        savedEvent.status = WebhookEventStatus.PROCESSED;
        savedEvent.processed_at = new Date();
        await this.webhookEventRepo.save(savedEvent);
      }

      return { processed: true, duplicate: false };
    } catch (err) {
      savedEvent.status = WebhookEventStatus.FAILED;
      savedEvent.error_message =
        err instanceof Error ? err.message : String(err);
      savedEvent.processed_at = new Date();
      await this.webhookEventRepo.save(savedEvent);

      return { processed: false, duplicate: false };
    }
  }

  // ─── Manual Payments ──────────────────────────────────────────────────────

  async createManualPayment(
    adminId: string,
    dto: CreateManualPaymentDto,
  ): Promise<Payment> {
    const booking = await this.bookingRepo.findOne({
      where: { id: dto.booking_id },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.EXPIRED
    ) {
      throw new BadRequestException('This booking is not payable');
    }

    const payment = this.paymentRepo.create({
      booking_id: dto.booking_id,
      user_id: booking.user_id,
      amount: dto.amount.toFixed(2),
      currency: 'BDT',
      method: PaymentMethod.MANUAL_BRANCH,
      status: PaymentStatus.PENDING_APPROVAL,
      reference: dto.reference,
      notes: dto.notes ?? null,
      created_by_id: adminId,
    });

    return this.paymentRepo.save(payment);
  }

  async approveManualPayment(
    approverId: string,
    paymentId: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== PaymentStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Payment is not awaiting approval');
    }

    // Separation of duties: approver cannot be the creator
    if (payment.created_by_id === approverId) {
      throw new ForbiddenException(
        'The approver cannot be the same admin who created this payment',
      );
    }

    payment.approved_by_id = approverId;
    await this.paymentRepo.save(payment);

    return this.processSuccessfulPayment(paymentId);
  }

  async rejectManualPayment(
    adminId: string,
    paymentId: string,
    reason: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Payment is not awaiting approval');
    }

    payment.status = PaymentStatus.REJECTED;
    payment.rejection_reason = reason;
    payment.approved_by_id = adminId;
    return this.paymentRepo.save(payment);
  }

  // ─── Reconciliation ───────────────────────────────────────────────────────

  async listReconciliation(query: ListReconciliationQueryDto) {
    const {
      status,
      gateway,
      date_from,
      date_to,
      transaction_id,
      page = 1,
      limit = 20,
    } = query;

    const qb = this.reconciliationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.payment', 'p')
      .orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('r.status = :status', { status });
    if (gateway) qb.andWhere('r.gateway = :gateway', { gateway });
    if (transaction_id) {
      qb.andWhere('r.gateway_transaction_id = :tid', {
        tid: transaction_id,
      });
    }
    if (date_from) {
      qb.andWhere('r.settlement_date >= :date_from', { date_from });
    }
    if (date_to) {
      qb.andWhere('r.settlement_date <= :date_to', { date_to });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Import settlement records from gateway CSV/JSON.
   * Computes difference between internal payment and gateway amount.
   * Auto-marks as MATCHED or MISMATCH.
   */
  async importSettlementRecords(dto: ImportSettlementDto) {
    if (dto.csv && (!dto.records || dto.records.length === 0)) {
      const lines = dto.csv.trim().split(/\r?\n/);
      const parsedRecords: {
        gateway_transaction_id: string;
        amount: number;
        settlement_date: string;
      }[] = [];
      const startIdx = lines[0].toLowerCase().includes('gateway_transaction_id')
        ? 1
        : 0;
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [txId, amtStr, dateStr] = line.split(',').map((s) => s.trim());
        if (txId && amtStr) {
          parsedRecords.push({
            gateway_transaction_id: txId,
            amount: parseFloat(amtStr),
            settlement_date: dateStr || new Date().toISOString().split('T')[0],
          });
        }
      }
      dto.records = parsedRecords;
    }

    const records = dto.records || [];
    const results: ReconciliationRecord[] = [];

    for (const row of records) {
      // Find matching payment in our system
      const payment = await this.paymentRepo.findOne({
        where: {
          gateway_transaction_id: row.gateway_transaction_id,
          status: PaymentStatus.SUCCESS,
        },
      });

      const internalAmount = payment ? parseFloat(payment.amount) : 0;
      const gatewayAmount = row.amount;
      const difference = internalAmount - gatewayAmount;
      const reconciliationStatus =
        Math.abs(difference) < 0.01
          ? ReconciliationStatus.MATCHED
          : ReconciliationStatus.MISMATCH;

      const record = this.reconciliationRepo.create({
        payment_id: payment?.id ?? null,
        gateway: dto.gateway,
        gateway_transaction_id: row.gateway_transaction_id,
        internal_amount: internalAmount.toFixed(2),
        gateway_amount: gatewayAmount.toFixed(2),
        difference: difference.toFixed(2),
        status: reconciliationStatus,
        settlement_date: row.settlement_date,
      });

      results.push(await this.reconciliationRepo.save(record));
    }

    const matched = results.filter(
      (r) => r.status === ReconciliationStatus.MATCHED,
    ).length;
    const mismatched = results.filter(
      (r) => r.status === ReconciliationStatus.MISMATCH,
    ).length;

    return {
      imported: results.length,
      matched,
      mismatched,
      records: results,
    };
  }

  async resolveMismatch(
    adminId: string,
    id: string,
    dto: ResolveReconciliationDto,
  ): Promise<ReconciliationRecord> {
    const record = await this.reconciliationRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Reconciliation record not found');

    if (record.status === ReconciliationStatus.RESOLVED) {
      throw new BadRequestException('Record is already resolved');
    }

    record.status = ReconciliationStatus.RESOLVED;
    record.resolution_notes = `${dto.resolution}${dto.notes ? ' — ' + dto.notes : ''}`;
    record.resolved_by = adminId;
    record.resolved_at = new Date();

    return this.reconciliationRepo.save(record);
  }
}
