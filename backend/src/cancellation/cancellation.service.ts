import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { CancellationRequest } from './entities/cancellation.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Pilgrim } from '../bookings/entities/pilgrim.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { Refund } from '../refunds/entities/refund.entity';
import { RequestCancellationDto } from './dto/request-cancellation.dto';
import { ApproveCancellationDto } from './dto/approve-cancellation.dto';
import { ListCancellationsQueryDto } from './dto/list-cancellations-query.dto';
import { CancellationStatus } from './enums/cancellation-status.enum';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { PilgrimStatus } from '../bookings/enums/pilgrim-status.enum';
import { RefundStatus } from '../refunds/enums/refund-status.enum';
import { PaymentMethod } from '../payments/enums/payment-method.enum';
import { UserRole } from '../user/enums/user-role.enum';

@Injectable()
export class CancellationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CancellationRequest)
    private readonly cancellationRepo: Repository<CancellationRequest>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Pilgrim)
    private readonly pilgrimRepo: Repository<Pilgrim>,
    @InjectRepository(PackageTier)
    private readonly tierRepo: Repository<PackageTier>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
  ) {}

  /**
   * Request booking cancellation (full or single-pilgrim partial).
   * Automatically calculates initial cancellation charge estimate based on departure date.
   */
  async requestCancellation(
    userId: string,
    userRole: UserRole,
    bookingId: string,
    dto: RequestCancellationDto,
  ): Promise<CancellationRequest> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['package', 'package_tier', 'pilgrims'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (userRole !== UserRole.ADMIN && booking.user_id !== userId) {
      throw new ForbiddenException('Access denied to this booking');
    }

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Booking is already ${booking.status.toLowerCase()}`,
      );
    }

    const pilgrimId = dto.pilgrim_id ?? null;

    // Check for existing active cancellation request
    const existingActive = await this.cancellationRepo.findOne({
      where: {
        booking_id: bookingId,
        pilgrim_id: pilgrimId ? pilgrimId : IsNull(),
        status: In([
          CancellationStatus.REQUESTED,
          CancellationStatus.APPROVED,
          CancellationStatus.PROCESSING,
        ]),
      },
    });

    if (existingActive) {
      throw new BadRequestException(
        'An active cancellation request already exists for this booking/pilgrim',
      );
    }

    let totalTarget = parseFloat(booking.total_amount);

    if (pilgrimId) {
      const pilgrim = booking.pilgrims?.find((p) => p.id === pilgrimId);
      if (!pilgrim) {
        throw new NotFoundException('Pilgrim not found on this booking');
      }
      if (pilgrim.status === PilgrimStatus.CANCELLED) {
        throw new BadRequestException('Pilgrim is already cancelled');
      }
      totalTarget = parseFloat(booking.unit_price);
    }

    // Dynamic cancellation charge calculation based on days to departure (§8)
    const departureDateStr = booking.package?.departure_date;
    let daysRemaining = 999;
    if (departureDateStr) {
      const depDate = new Date(departureDateStr).getTime();
      const now = Date.now();
      daysRemaining = Math.ceil((depDate - now) / (1000 * 60 * 60 * 24));
    }

    let chargeRate = 0.1; // > 60 days: 10%
    if (daysRemaining < 15) {
      chargeRate = 1.0; // < 15 days: 100%
    } else if (daysRemaining < 30) {
      chargeRate = 0.5; // 15–29 days: 50%
    } else if (daysRemaining <= 60) {
      chargeRate = 0.25; // 30–60 days: 25%
    }

    const calculatedCharge = totalTarget * chargeRate;
    const amountReceived = parseFloat(booking.amount_received);
    const proportionalReceived = pilgrimId
      ? Math.min(amountReceived, totalTarget)
      : amountReceived;

    const estimatedRefund = Math.max(
      0,
      proportionalReceived - calculatedCharge,
    );

    const cancellation = this.cancellationRepo.create({
      booking_id: bookingId,
      pilgrim_id: pilgrimId,
      reason: dto.reason,
      cancellation_charge: calculatedCharge.toFixed(2),
      vendor_cost: '0.00',
      refund_amount: estimatedRefund.toFixed(2),
      status: CancellationStatus.REQUESTED,
      requested_by_id: userId,
    });

    return this.cancellationRepo.save(cancellation);
  }

  /**
   * List cancellations with filtering and pagination.
   */
  async findAll(
    userId: string,
    userRole: UserRole,
    query: ListCancellationsQueryDto,
  ) {
    const { status, booking_id, page = 1, limit = 20 } = query;

    const qb = this.cancellationRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.booking', 'b')
      .leftJoinAndSelect('c.pilgrim', 'p')
      .leftJoinAndSelect('c.requested_by', 'u')
      .leftJoinAndSelect('c.approved_by', 'a')
      .orderBy('c.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (userRole !== UserRole.ADMIN) {
      qb.andWhere('b.user_id = :userId', { userId });
    }

    if (status) {
      qb.andWhere('c.status = :status', { status });
    }

    if (booking_id) {
      qb.andWhere('c.booking_id = :booking_id', { booking_id });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get single cancellation request by id.
   */
  async findOne(
    userId: string,
    userRole: UserRole,
    id: string,
  ): Promise<CancellationRequest> {
    const cancellation = await this.cancellationRepo.findOne({
      where: { id },
      relations: ['booking', 'pilgrim', 'requested_by', 'approved_by'],
    });

    if (!cancellation) {
      throw new NotFoundException('Cancellation request not found');
    }

    if (
      userRole !== UserRole.ADMIN &&
      cancellation.requested_by_id !== userId &&
      cancellation.booking?.user_id !== userId
    ) {
      throw new ForbiddenException(
        'Access denied to this cancellation request',
      );
    }

    return cancellation;
  }

  /**
   * Admin approves cancellation: releases inventory seats and spawns a refund if refund_amount > 0.
   */
  async approveCancellation(
    adminId: string,
    id: string,
    dto?: ApproveCancellationDto,
  ): Promise<CancellationRequest> {
    return this.dataSource.transaction(async (manager) => {
      const cancellation = await manager.findOne(CancellationRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        relations: ['booking'],
      });

      if (!cancellation) {
        throw new NotFoundException('Cancellation request not found');
      }

      if (cancellation.status !== CancellationStatus.REQUESTED) {
        throw new BadRequestException(
          `Cancellation request is already ${cancellation.status.toLowerCase()}`,
        );
      }

      const booking = await manager.findOne(Booking, {
        where: { id: cancellation.booking_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      const amountReceived = parseFloat(booking.amount_received);

      // Apply overrides or keep calculated values
      const charge =
        dto?.cancellation_charge !== undefined
          ? dto.cancellation_charge
          : parseFloat(cancellation.cancellation_charge);

      const vendorCost =
        dto?.vendor_cost !== undefined
          ? dto.vendor_cost
          : parseFloat(cancellation.vendor_cost);

      const refundAmount =
        dto?.refund_amount !== undefined
          ? dto.refund_amount
          : parseFloat(cancellation.refund_amount);

      if (refundAmount > amountReceived + 0.01) {
        throw new BadRequestException(
          `Refund amount of ${refundAmount.toFixed(2)} exceeds amount received (${amountReceived.toFixed(2)})`,
        );
      }

      cancellation.status = CancellationStatus.APPROVED;
      cancellation.approved_by_id = adminId;
      cancellation.approved_at = new Date();
      cancellation.cancellation_charge = charge.toFixed(2);
      cancellation.vendor_cost = vendorCost.toFixed(2);
      cancellation.refund_amount = refundAmount.toFixed(2);
      if (dto?.notes) {
        cancellation.notes = dto.notes;
      }

      await manager.save(CancellationRequest, cancellation);

      // Release inventory seats atomically
      const tier = await manager.findOne(PackageTier, {
        where: { id: booking.package_tier_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (cancellation.pilgrim_id === null) {
        // Whole booking cancellation
        if (booking.status === BookingStatus.CONFIRMED && tier) {
          tier.confirmed_seats = Math.max(
            0,
            tier.confirmed_seats - booking.pilgrim_count,
          );
          await manager.save(PackageTier, tier);
        } else if (booking.status === BookingStatus.PENDING && tier) {
          tier.held_seats = Math.max(
            0,
            tier.held_seats - booking.pilgrim_count,
          );
          await manager.save(PackageTier, tier);
        }

        booking.status = BookingStatus.CANCELLED;
        await manager.save(Booking, booking);
      } else {
        // Partial single-pilgrim cancellation
        if (booking.status === BookingStatus.CONFIRMED && tier) {
          tier.confirmed_seats = Math.max(0, tier.confirmed_seats - 1);
          await manager.save(PackageTier, tier);
        } else if (booking.status === BookingStatus.PENDING && tier) {
          tier.held_seats = Math.max(0, tier.held_seats - 1);
          await manager.save(PackageTier, tier);
        }

        const pilgrim = await manager.findOne(Pilgrim, {
          where: { id: cancellation.pilgrim_id },
        });
        if (pilgrim) {
          pilgrim.status = PilgrimStatus.CANCELLED;
          await manager.save(Pilgrim, pilgrim);
        }

        booking.pilgrim_count = Math.max(0, booking.pilgrim_count - 1);
        await manager.save(Booking, booking);
      }

      // Automatically spawn a Refund record if refund_amount > 0
      if (refundAmount > 0) {
        const refund = manager.create(Refund, {
          booking_id: booking.id,
          cancellation_request_id: cancellation.id,
          amount: refundAmount.toFixed(2),
          method: PaymentMethod.MANUAL_BRANCH,
          status: RefundStatus.REQUESTED,
          reason: cancellation.reason,
        });
        await manager.save(Refund, refund);
      }

      return cancellation;
    });
  }

  /**
   * Admin rejects cancellation request.
   */
  async rejectCancellation(
    adminId: string,
    id: string,
    reason: string,
  ): Promise<CancellationRequest> {
    const cancellation = await this.cancellationRepo.findOne({ where: { id } });

    if (!cancellation) {
      throw new NotFoundException('Cancellation request not found');
    }

    if (cancellation.status !== CancellationStatus.REQUESTED) {
      throw new BadRequestException(
        `Cancellation request is already ${cancellation.status.toLowerCase()}`,
      );
    }

    cancellation.status = CancellationStatus.REJECTED;
    cancellation.approved_by_id = adminId;
    cancellation.rejection_reason = reason;

    return this.cancellationRepo.save(cancellation);
  }
}
