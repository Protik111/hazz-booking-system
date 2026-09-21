import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Refund } from './entities/refund.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { CreateRefundDto } from './dto/create-refund.dto';
import { ProcessRefundDto } from './dto/process-refund.dto';
import { ListRefundsQueryDto } from './dto/list-refunds-query.dto';
import { RefundStatus } from './enums/refund-status.enum';
import { PaymentMethod } from '../payments/enums/payment-method.enum';
import { UserRole } from '../user/enums/user-role.enum';

@Injectable()
export class RefundsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  /**
   * Create a refund request enforcing the invariant:
   * total_refunded + requested_refund <= total_received
   */
  async createRefund(
    userId: string,
    userRole: UserRole,
    dto: CreateRefundDto,
  ): Promise<Refund> {
    const booking = await this.bookingRepo.findOne({
      where: { id: dto.booking_id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (userRole !== UserRole.ADMIN && booking.user_id !== userId) {
      throw new ForbiddenException('Access denied to this booking');
    }

    const amountReceived = parseFloat(booking.amount_received);

    // Sum active refunds (REQUESTED, APPROVED, PROCESSING, COMPLETED)
    const activeRefunds = await this.refundRepo.find({
      where: {
        booking_id: dto.booking_id,
        status: In([
          RefundStatus.REQUESTED,
          RefundStatus.APPROVED,
          RefundStatus.PROCESSING,
          RefundStatus.COMPLETED,
        ]),
      },
    });

    const currentTotalRefunded = activeRefunds.reduce(
      (sum, r) => sum + parseFloat(r.amount),
      0,
    );

    if (currentTotalRefunded + dto.amount > amountReceived + 0.01) {
      throw new BadRequestException(
        `Refund limit exceeded: Total refunds (${(currentTotalRefunded + dto.amount).toFixed(2)}) would exceed total received (${amountReceived.toFixed(2)})`,
      );
    }

    const refund = this.refundRepo.create({
      booking_id: dto.booking_id,
      payment_id: dto.payment_id ?? null,
      cancellation_request_id: dto.cancellation_request_id ?? null,
      amount: dto.amount.toFixed(2),
      method: dto.method ?? PaymentMethod.MANUAL_BRANCH,
      status: RefundStatus.REQUESTED,
      reason: dto.reason ?? null,
    });

    return this.refundRepo.save(refund);
  }

  /**
   * List refunds with role filtering and pagination.
   */
  async findAll(
    userId: string,
    userRole: UserRole,
    query: ListRefundsQueryDto,
  ) {
    const { status, booking_id, page = 1, limit = 20 } = query;

    const qb = this.refundRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.booking', 'b')
      .leftJoinAndSelect('r.payment', 'p')
      .leftJoinAndSelect('r.cancellation_request', 'c')
      .leftJoinAndSelect('r.approved_by', 'a')
      .leftJoinAndSelect('r.processed_by', 'pr')
      .orderBy('r.requested_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (userRole !== UserRole.ADMIN) {
      qb.andWhere('b.user_id = :userId', { userId });
    }

    if (status) {
      qb.andWhere('r.status = :status', { status });
    }

    if (booking_id) {
      qb.andWhere('r.booking_id = :booking_id', { booking_id });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Find single refund by id with ownership checks.
   */
  async findOne(
    userId: string,
    userRole: UserRole,
    id: string,
  ): Promise<Refund> {
    const refund = await this.refundRepo.findOne({
      where: { id },
      relations: [
        'booking',
        'payment',
        'cancellation_request',
        'approved_by',
        'processed_by',
      ],
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (userRole !== UserRole.ADMIN && refund.booking?.user_id !== userId) {
      throw new ForbiddenException('Access denied to this refund');
    }

    return refund;
  }

  /**
   * Admin approves a refund request (transitions REQUESTED → APPROVED).
   */
  async approveRefund(adminId: string, id: string): Promise<Refund> {
    const refund = await this.refundRepo.findOne({
      where: { id },
      relations: ['booking'],
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.status !== RefundStatus.REQUESTED) {
      throw new BadRequestException(
        `Refund is in ${refund.status} state and cannot be approved`,
      );
    }

    const amountReceived = parseFloat(refund.booking.amount_received);

    // Re-verify invariant against other active refunds
    const otherRefunds = await this.refundRepo.find({
      where: {
        booking_id: refund.booking_id,
        status: In([
          RefundStatus.APPROVED,
          RefundStatus.PROCESSING,
          RefundStatus.COMPLETED,
        ]),
      },
    });

    const otherTotal = otherRefunds
      .filter((r) => r.id !== refund.id)
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    if (otherTotal + parseFloat(refund.amount) > amountReceived + 0.01) {
      throw new BadRequestException('Refund limit exceeded');
    }

    refund.status = RefundStatus.APPROVED;
    refund.approved_by_id = adminId;
    refund.approved_at = new Date();

    return this.refundRepo.save(refund);
  }

  /**
   * Admin processes an approved refund (transitions APPROVED → PROCESSING → COMPLETED).
   */
  async processRefund(
    adminId: string,
    id: string,
    dto?: ProcessRefundDto,
  ): Promise<Refund> {
    return this.dataSource.transaction(async (manager) => {
      const refund = await manager.findOne(Refund, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        relations: ['booking'],
      });

      if (!refund) {
        throw new NotFoundException('Refund not found');
      }

      if (
        refund.status !== RefundStatus.APPROVED &&
        refund.status !== RefundStatus.PROCESSING
      ) {
        throw new BadRequestException(
          `Refund must be APPROVED or PROCESSING to be processed (current: ${refund.status})`,
        );
      }

      const amountReceived = parseFloat(refund.booking.amount_received);

      // Verify invariant again
      const allCompletedAndProcessing = await manager.find(Refund, {
        where: {
          booking_id: refund.booking_id,
          status: In([RefundStatus.COMPLETED]),
        },
      });

      const completedTotal = allCompletedAndProcessing
        .filter((r) => r.id !== refund.id)
        .reduce((sum, r) => sum + parseFloat(r.amount), 0);

      if (completedTotal + parseFloat(refund.amount) > amountReceived + 0.01) {
        throw new BadRequestException('Refund limit exceeded');
      }

      refund.status = RefundStatus.COMPLETED;
      refund.processed_by_id = adminId;
      refund.processed_at = new Date();
      if (dto?.gateway_refund_id) {
        refund.gateway_refund_id = dto.gateway_refund_id;
      }
      if (dto?.notes) {
        refund.notes = dto.notes;
      }

      return manager.save(Refund, refund);
    });
  }

  /**
   * Admin rejects a refund request.
   */
  async rejectRefund(
    adminId: string,
    id: string,
    reason: string,
  ): Promise<Refund> {
    const refund = await this.refundRepo.findOne({ where: { id } });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (
      refund.status === RefundStatus.COMPLETED ||
      refund.status === RefundStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Cannot reject a refund that is already ${refund.status.toLowerCase()}`,
      );
    }

    refund.status = RefundStatus.REJECTED;
    refund.approved_by_id = adminId;
    refund.rejection_reason = reason;

    return this.refundRepo.save(refund);
  }

  /**
   * Admin summary report of refunds:
   * total refunded, pending amounts, and breakdown by status.
   */
  async getRefundReport() {
    const all = await this.refundRepo.find();

    const totalRefunded = all
      .filter((r) => r.status === RefundStatus.COMPLETED)
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    const totalPending = all
      .filter((r) =>
        [
          RefundStatus.REQUESTED,
          RefundStatus.APPROVED,
          RefundStatus.PROCESSING,
        ].includes(r.status),
      )
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    const counts: Record<string, number> = {
      [RefundStatus.REQUESTED]: 0,
      [RefundStatus.APPROVED]: 0,
      [RefundStatus.PROCESSING]: 0,
      [RefundStatus.COMPLETED]: 0,
      [RefundStatus.REJECTED]: 0,
      [RefundStatus.FAILED]: 0,
    };

    all.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });

    return {
      total_refunded: totalRefunded.toFixed(2),
      total_pending: totalPending.toFixed(2),
      total_count: all.length,
      status_breakdown: counts,
    };
  }
}
