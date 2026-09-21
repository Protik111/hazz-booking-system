import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Installment } from '../installments/entities/installment.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Refund } from '../refunds/entities/refund.entity';
import { BookingReportQueryDto } from './dto/booking-report-query.dto';
import { PaymentReportQueryDto } from './dto/payment-report-query.dto';
import { InstallmentReportQueryDto } from './dto/installment-report-query.dto';
import { RefundStatus } from '../refunds/enums/refund-status.enum';

/** Convert a raw query result field (typed as any) to a string safely. */
function rawStr(v: unknown, fallback = '0'): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v || fallback;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint')
    return String(v) || fallback;
  return fallback;
}

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    @InjectRepository(PackageTier)
    private readonly tierRepo: Repository<PackageTier>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
  ) {}

  // ─── 1. Overview Report ───────────────────────────────────────────────────

  async getOverviewReport() {
    const bookingStats = await this.bookingRepo
      .createQueryBuilder('b')
      .select('COUNT(*)', 'totalBookings')
      .addSelect(
        `COUNT(CASE WHEN b.status = 'CONFIRMED' THEN 1 END)`,
        'confirmedBookings',
      )
      .addSelect('COALESCE(SUM(b.amount_received), 0)', 'totalCollected')
      .addSelect('COALESCE(SUM(b.amount_outstanding), 0)', 'totalOutstanding')
      .getRawOne();

    const refundStats = await this.refundRepo
      .createQueryBuilder('r')
      .select(
        `COALESCE(SUM(CASE WHEN r.status = 'COMPLETED' THEN r.amount ELSE 0 END), 0)`,
        'totalRefunded',
      )
      .getRawOne();

    const seatStats = await this.tierRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.total_quota), 0)', 'totalQuota')
      .addSelect('COALESCE(SUM(t.held_seats), 0)', 'heldSeats')
      .addSelect('COALESCE(SUM(t.confirmed_seats), 0)', 'confirmedSeats')
      .getRawOne();

    const raw = bookingStats as Record<string, unknown> | undefined;
    const rawR = refundStats as Record<string, unknown> | undefined;
    const rawS = seatStats as Record<string, unknown> | undefined;

    const totalQuota = parseInt(rawStr(rawS?.totalQuota), 10);
    const heldSeats = parseInt(rawStr(rawS?.heldSeats), 10);
    const confirmedSeats = parseInt(rawStr(rawS?.confirmedSeats), 10);
    const availableSeats = Math.max(0, totalQuota - heldSeats - confirmedSeats);

    const overdueInstallments = await this.installmentRepo
      .createQueryBuilder('i')
      .where(`i.status = 'OVERDUE'`)
      .getCount();

    return {
      totalBookings: parseInt(rawStr(raw?.totalBookings), 10),
      confirmedBookings: parseInt(rawStr(raw?.confirmedBookings), 10),
      totalCollected: parseFloat(rawStr(raw?.totalCollected)),
      totalOutstanding: parseFloat(rawStr(raw?.totalOutstanding)),
      totalRefunded: parseFloat(rawStr(rawR?.totalRefunded)),
      availableSeats,
      heldSeats,
      confirmedSeats,
      overdueInstallments,
    };
  }

  // ─── 2. Booking Report ────────────────────────────────────────────────────

  async getBookingReport(query: BookingReportQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.package', 'p')
      .leftJoinAndSelect('b.package_tier', 'tier')
      .leftJoinAndSelect('b.user', 'u');

    if (query.package_id) {
      qb.andWhere('b.package_id = :packageId', {
        packageId: query.package_id,
      });
    }

    if (query.tier_id) {
      qb.andWhere('b.package_tier_id = :tierId', { tierId: query.tier_id });
    }

    if (query.status) {
      qb.andWhere('b.status = :status', { status: query.status });
    }

    if (query.date_from) {
      qb.andWhere('b.created_at >= :dateFrom', {
        dateFrom: new Date(query.date_from),
      });
    }

    if (query.date_to) {
      qb.andWhere('b.created_at <= :dateTo', {
        dateTo: new Date(query.date_to),
      });
    }

    qb.orderBy('b.created_at', 'DESC');

    // Financial aggregates across filtered set
    const aggregateQb = this.bookingRepo
      .createQueryBuilder('b')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(b.total_amount), 0)', 'totalAmount')
      .addSelect('COALESCE(SUM(b.amount_received), 0)', 'totalReceived')
      .addSelect('COALESCE(SUM(b.amount_outstanding), 0)', 'totalOutstanding')
      .addSelect(
        `COUNT(CASE WHEN b.status = 'CONFIRMED' THEN 1 END)`,
        'confirmed',
      )
      .addSelect(`COUNT(CASE WHEN b.status = 'PENDING' THEN 1 END)`, 'pending')
      .addSelect(
        `COUNT(CASE WHEN b.status = 'CANCELLED' THEN 1 END)`,
        'cancelled',
      );

    if (query.package_id) {
      aggregateQb.andWhere('b.package_id = :packageId', {
        packageId: query.package_id,
      });
    }
    if (query.tier_id) {
      aggregateQb.andWhere('b.package_tier_id = :tierId', {
        tierId: query.tier_id,
      });
    }
    if (query.status) {
      aggregateQb.andWhere('b.status = :status', { status: query.status });
    }
    if (query.date_from) {
      aggregateQb.andWhere('b.created_at >= :dateFrom', {
        dateFrom: new Date(query.date_from),
      });
    }
    if (query.date_to) {
      aggregateQb.andWhere('b.created_at <= :dateTo', {
        dateTo: new Date(query.date_to),
      });
    }

    const [rawAgg, [data, total]] = await Promise.all([
      aggregateQb.getRawOne(),
      qb.skip(skip).take(limit).getManyAndCount(),
    ]);

    return {
      summary: {
        totalBookings: parseInt(rawStr(rawAgg?.count), 10),
        confirmed: parseInt(rawStr(rawAgg?.confirmed), 10),
        pending: parseInt(rawStr(rawAgg?.pending), 10),
        cancelled: parseInt(rawStr(rawAgg?.cancelled), 10),
        totalAmount: parseFloat(rawStr(rawAgg?.totalAmount)),
        totalReceived: parseFloat(rawStr(rawAgg?.totalReceived)),
        totalOutstanding: parseFloat(rawStr(rawAgg?.totalOutstanding)),
      },
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── 3. Payment Report ────────────────────────────────────────────────────

  async getPaymentReport(query: PaymentReportQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.booking', 'b')
      .leftJoinAndSelect('p.user', 'u');

    if (query.method) {
      qb.andWhere('p.method = :method', { method: query.method });
    }

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }

    if (query.date_from) {
      qb.andWhere('p.created_at >= :dateFrom', {
        dateFrom: new Date(query.date_from),
      });
    }

    if (query.date_to) {
      qb.andWhere('p.created_at <= :dateTo', {
        dateTo: new Date(query.date_to),
      });
    }

    qb.orderBy('p.created_at', 'DESC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    // Volume and count aggregations
    const allFiltered = await this.paymentRepo.find();
    let totalVolume = 0;
    const byMethod: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const pay of allFiltered) {
      const amt = parseFloat(pay.amount) || 0;
      totalVolume += amt;
      byMethod[pay.method] = (byMethod[pay.method] || 0) + amt;
      byStatus[pay.status] = (byStatus[pay.status] || 0) + 1;
    }

    return {
      summary: {
        totalPayments: allFiltered.length,
        totalVolume: parseFloat(totalVolume.toFixed(2)),
        byMethod,
        byStatus,
      },
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── 4. Installment Report ────────────────────────────────────────────────

  async getInstallmentReport(query: InstallmentReportQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.installmentRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.booking', 'b')
      .leftJoinAndSelect('b.package', 'p');

    if (query.status) {
      qb.andWhere('i.status = :status', { status: query.status });
    }

    if (query.package_id) {
      qb.andWhere('b.package_id = :packageId', {
        packageId: query.package_id,
      });
    }

    if (query.due_date_from) {
      qb.andWhere('i.due_date >= :from', {
        from: new Date(query.due_date_from),
      });
    }

    if (query.due_date_to) {
      qb.andWhere('i.due_date <= :to', { to: new Date(query.due_date_to) });
    }

    qb.orderBy('i.due_date', 'ASC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    // Summary counts & financial totals
    const all = await this.installmentRepo.find();
    let totalDue = 0;
    let totalPaid = 0;
    const byStatus: Record<string, number> = {};

    for (const inst of all) {
      totalDue += parseFloat(inst.amount) || 0;
      totalPaid += parseFloat(inst.paid_amount) || 0;
      byStatus[inst.status] = (byStatus[inst.status] || 0) + 1;
    }

    return {
      summary: {
        totalInstallments: all.length,
        totalDue: parseFloat(totalDue.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        byStatus,
      },
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── 5. Refund Report ─────────────────────────────────────────────────────

  async getRefundReport() {
    const refunds = await this.refundRepo.find();

    let totalRefunded = 0;
    let totalPending = 0;
    const statusBreakdown: Record<string, number> = {};

    for (const r of refunds) {
      const amt = parseFloat(r.amount) || 0;
      statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1;

      if (r.status === RefundStatus.COMPLETED) {
        totalRefunded += amt;
      } else if (
        r.status === RefundStatus.REQUESTED ||
        r.status === RefundStatus.APPROVED ||
        r.status === RefundStatus.PROCESSING
      ) {
        totalPending += amt;
      }
    }

    return {
      total_refunded: totalRefunded.toFixed(2),
      total_pending: totalPending.toFixed(2),
      total_count: refunds.length,
      status_breakdown: statusBreakdown,
    };
  }

  // ─── 6. Seat Quota Report ─────────────────────────────────────────────────

  async getSeatQuotaReport() {
    const tiers = await this.tierRepo.find({
      relations: ['package'],
      order: { created_at: 'ASC' },
    });

    let networkTotalQuota = 0;
    let networkHeldSeats = 0;
    let networkConfirmedSeats = 0;

    const tierBreakdown = tiers.map((tier) => {
      const totalQuota = tier.total_quota;
      const held = tier.held_seats;
      const confirmed = tier.confirmed_seats;
      const available = Math.max(0, totalQuota - held - confirmed);
      const booked = held + confirmed;
      const utilizationRate =
        totalQuota > 0
          ? parseFloat(((booked / totalQuota) * 100).toFixed(1))
          : 0;

      networkTotalQuota += totalQuota;
      networkHeldSeats += held;
      networkConfirmedSeats += confirmed;

      return {
        package_id: tier.package_id,
        package_name: tier.package ? tier.package.name : 'Unknown',
        package_slug: tier.package ? tier.package.slug : '',
        tier_id: tier.id,
        tier_name: tier.name,
        price: tier.price,
        currency: tier.currency,
        total_quota: totalQuota,
        held_seats: held,
        confirmed_seats: confirmed,
        available_seats: available,
        utilization_rate_percent: utilizationRate,
      };
    });

    const networkAvailable = Math.max(
      0,
      networkTotalQuota - networkHeldSeats - networkConfirmedSeats,
    );
    const networkBooked = networkHeldSeats + networkConfirmedSeats;
    const overallUtilization =
      networkTotalQuota > 0
        ? parseFloat(((networkBooked / networkTotalQuota) * 100).toFixed(1))
        : 0;

    return {
      summary: {
        total_quota: networkTotalQuota,
        held_seats: networkHeldSeats,
        confirmed_seats: networkConfirmedSeats,
        available_seats: networkAvailable,
        overall_utilization_percent: overallUtilization,
      },
      tiers: tierBreakdown,
    };
  }
}
