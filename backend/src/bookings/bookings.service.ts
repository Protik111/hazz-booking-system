import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, LessThan, Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { Pilgrim } from './entities/pilgrim.entity';
import { Installment } from './entities/installment.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { CreatePilgrimDto } from './dto/create-pilgrim.dto';
import { UpdatePilgrimDto } from './dto/update-pilgrim.dto';
import { BookingStatus } from './enums/booking-status.enum';
import { PaymentPlan } from './enums/payment-plan.enum';
import { PackageStatus } from '../packages/enums/package-status.enum';
import { PilgrimStatus } from './enums/pilgrim-status.enum';
import { InstallmentStatus } from './enums/installment-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

@Injectable()
export class BookingsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Pilgrim)
    private readonly pilgrimRepo: Repository<Pilgrim>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    @InjectRepository(PackageTier)
    private readonly tierRepo: Repository<PackageTier>,
  ) {}

  /**
   * Atomic seat reservation and booking creation inside a PostgreSQL transaction.
   * Concurrency protection via `SELECT ... FOR UPDATE` on `PackageTier`.
   */
  async create(userId: string, dto: CreateBookingDto): Promise<Booking> {
    const pilgrimCount =
      dto.pilgrim_count ??
      (dto.pilgrims && dto.pilgrims.length > 0 ? dto.pilgrims.length : 1);

    if (dto.pilgrims && dto.pilgrims.length > pilgrimCount) {
      throw new BadRequestException(
        `Number of pilgrims (${dto.pilgrims.length}) exceeds pilgrim_count (${pilgrimCount})`,
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      // 1. Lock package tier row (SELECT ... FOR UPDATE)
      const tier = await manager.findOne(PackageTier, {
        where: { id: dto.package_tier_id },
        lock: { mode: 'pessimistic_write' },
        relations: ['package'],
      });

      if (!tier) {
        throw new NotFoundException('Package tier not found');
      }

      const pkg = tier.package;
      if (!pkg || pkg.status !== PackageStatus.PUBLISHED) {
        throw new BadRequestException(
          'Package is not published or currently available for booking',
        );
      }

      // 2. Validate booking window
      const now = new Date();
      if (pkg.booking_start && now < new Date(pkg.booking_start)) {
        throw new BadRequestException('Booking window has not opened yet');
      }
      if (pkg.booking_end && now > new Date(pkg.booking_end)) {
        throw new BadRequestException('Booking window has closed');
      }

      // 3. Verify seat availability: available = total_quota - held_seats - confirmed_seats
      const availableSeats =
        tier.total_quota - tier.held_seats - tier.confirmed_seats;
      if (availableSeats < pilgrimCount) {
        throw new BadRequestException(
          `Insufficient seats available. Requested: ${pilgrimCount}, available: ${availableSeats}`,
        );
      }

      // 4. Reserve seats: increment held_seats
      tier.held_seats += pilgrimCount;
      await manager.save(PackageTier, tier);

      // 5. Generate unique booking number atomically: BK-YYYY-NNNNNN
      const currentYear = new Date().getFullYear();
      const prefix = `BK-${currentYear}-`;
      const latestBooking = await manager
        .createQueryBuilder(Booking, 'b')
        .where('b.booking_number LIKE :prefix', { prefix: `${prefix}%` })
        .orderBy('b.booking_number', 'DESC')
        .getOne();

      let nextSeq = 1;
      if (latestBooking) {
        const parts = latestBooking.booking_number.split('-');
        const num = parseInt(parts[2], 10);
        if (!isNaN(num)) {
          nextSeq = num + 1;
        }
      }
      const bookingNumber = `${prefix}${String(nextSeq).padStart(6, '0')}`;

      // 6. Freeze unit_price and calculate amounts
      const unitPrice = parseFloat(tier.price);
      const totalAmount = (unitPrice * pilgrimCount).toFixed(2);
      // Default seat hold: 30 minutes
      const holdExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // 7. Create booking record
      const booking = manager.create(Booking, {
        booking_number: bookingNumber,
        user_id: userId,
        package_id: pkg.id,
        package_tier_id: tier.id,
        status: BookingStatus.PENDING,
        payment_plan: dto.payment_plan,
        pilgrim_count: pilgrimCount,
        unit_price: tier.price,
        total_amount: totalAmount,
        amount_received: '0.00',
        amount_outstanding: totalAmount,
        hold_expires_at: holdExpiresAt,
      });

      const savedBooking = await manager.save(Booking, booking);

      // 8. Create pilgrims if provided
      if (dto.pilgrims && dto.pilgrims.length > 0) {
        const pilgrims = dto.pilgrims.map((p) =>
          manager.create(Pilgrim, {
            booking_id: savedBooking.id,
            full_name: p.full_name,
            date_of_birth: p.date_of_birth,
            gender: p.gender,
            nationality: p.nationality ?? 'Bangladeshi',
            passport_number: p.passport_number,
            passport_issue_date: p.passport_issue_date ?? null,
            passport_expiry_date: p.passport_expiry_date ?? null,
            passport_document_url: p.passport_document_url ?? null,
            phone: p.phone ?? null,
            email: p.email ?? null,
            status: PilgrimStatus.ACTIVE,
          }),
        );
        savedBooking.pilgrims = await manager.save(Pilgrim, pilgrims);
      } else {
        savedBooking.pilgrims = [];
      }

      // 9. Generate installment schedule if payment_plan === INSTALLMENT
      if (dto.payment_plan === PaymentPlan.INSTALLMENT) {
        const schedule = this.generateInstallmentSchedule(
          savedBooking.id,
          parseFloat(totalAmount),
          pkg.departure_date,
          holdExpiresAt,
        );
        const installmentEntities = schedule.map((item) =>
          manager.create(Installment, item),
        );
        savedBooking.installments = await manager.save(
          Installment,
          installmentEntities,
        );
      } else {
        savedBooking.installments = [];
      }

      savedBooking.package = pkg;
      savedBooking.package_tier = tier;
      return savedBooking;
    });
  }

  /**
   * List bookings: filtered by user ownership (unless ADMIN). Paginated.
   */
  async findAll(
    userId: string,
    userRole: UserRole,
    query: ListBookingsQueryDto,
  ) {
    const { status, page = 1, limit = 20 } = query;
    const where: FindOptionsWhere<Booking> = {};

    if (userRole !== UserRole.ADMIN) {
      where.user_id = userId;
    }
    if (status) {
      where.status = status;
    }

    const [bookings, total] = await this.bookingRepo.findAndCount({
      where,
      relations: ['package', 'package_tier', 'pilgrims', 'installments'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: bookings,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single booking with ownership verification.
   */
  async findOne(userId: string, userRole: UserRole, bookingId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['package', 'package_tier', 'pilgrims', 'installments'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (userRole !== UserRole.ADMIN && booking.user_id !== userId) {
      throw new ForbiddenException('Access denied to this booking');
    }

    return booking;
  }

  /**
   * Update permitted booking attributes (payment plan or notes).
   * Prevents tampering with price, total_amount, seats, or payment state.
   */
  async update(
    userId: string,
    userRole: UserRole,
    bookingId: string,
    dto: UpdateBookingDto,
  ) {
    const booking = await this.findOne(userId, userRole, bookingId);

    if (dto.payment_plan && dto.payment_plan !== booking.payment_plan) {
      if (booking.status !== BookingStatus.PENDING) {
        throw new BadRequestException(
          'Payment plan can only be changed while booking is PENDING',
        );
      }
      booking.payment_plan = dto.payment_plan;
      // If switched to INSTALLMENT and no installments exist, generate them
      if (
        dto.payment_plan === PaymentPlan.INSTALLMENT &&
        (!booking.installments || booking.installments.length === 0)
      ) {
        const schedule = this.generateInstallmentSchedule(
          booking.id,
          parseFloat(booking.total_amount),
          booking.package.departure_date,
          booking.hold_expires_at ?? new Date(),
        );
        const installmentEntities = schedule.map((item) =>
          this.installmentRepo.create(item),
        );
        booking.installments =
          await this.installmentRepo.save(installmentEntities);
      }
    }

    return this.bookingRepo.save(booking);
  }

  /**
   * Cancel booking: if status is PENDING, atomically releases held seats.
   */
  async cancel(userId: string, userRole: UserRole, bookingId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ['package_tier'],
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

      if (booking.status === BookingStatus.PENDING) {
        // Release held seats
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

        booking.status = BookingStatus.CANCELLED;
        return manager.save(Booking, booking);
      }

      if (booking.status === BookingStatus.CONFIRMED) {
        throw new BadRequestException(
          'Confirmed bookings must proceed through the cancellation and refund request flow',
        );
      }

      return booking;
    });
  }

  /**
   * Periodic or scheduled seat release for expired pending bookings.
   */
  async expirePendingBookings(): Promise<number> {
    const now = new Date();
    const expiredBookings = await this.bookingRepo.find({
      where: {
        status: BookingStatus.PENDING,
        hold_expires_at: LessThan(now),
      },
    });

    if (expiredBookings.length === 0) {
      return 0;
    }

    let expiredCount = 0;
    for (const booking of expiredBookings) {
      await this.dataSource.transaction(async (manager) => {
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
        expiredCount++;
      });
    }

    return expiredCount;
  }

  // ─── Pilgrim Management ─────────────────────────────────────────────────────

  async addPilgrim(
    userId: string,
    userRole: UserRole,
    bookingId: string,
    dto: CreatePilgrimDto,
  ) {
    const booking = await this.findOne(userId, userRole, bookingId);

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Cannot add pilgrim to a ${booking.status.toLowerCase()} booking`,
      );
    }

    const currentPilgrimsCount = await this.pilgrimRepo.count({
      where: { booking_id: bookingId, status: PilgrimStatus.ACTIVE },
    });

    // If adding pilgrim exceeds reserved seats, reserve an extra seat if booking is PENDING
    if (currentPilgrimsCount >= booking.pilgrim_count) {
      if (booking.status !== BookingStatus.PENDING) {
        throw new BadRequestException(
          'Cannot add more pilgrims than reserved seats to a confirmed booking',
        );
      }

      return await this.dataSource.transaction(async (manager) => {
        const tier = await manager.findOne(PackageTier, {
          where: { id: booking.package_tier_id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!tier) throw new NotFoundException('Package tier not found');

        const availableSeats =
          tier.total_quota - tier.held_seats - tier.confirmed_seats;
        if (availableSeats < 1) {
          throw new BadRequestException(
            'No additional seats available in this tier',
          );
        }

        tier.held_seats += 1;
        await manager.save(PackageTier, tier);

        booking.pilgrim_count += 1;
        const unitPrice = parseFloat(booking.unit_price);
        const newTotal = (unitPrice * booking.pilgrim_count).toFixed(2);
        booking.total_amount = newTotal;
        booking.amount_outstanding = (
          parseFloat(newTotal) - parseFloat(booking.amount_received)
        ).toFixed(2);
        await manager.save(Booking, booking);

        const pilgrim = manager.create(Pilgrim, {
          booking_id: bookingId,
          full_name: dto.full_name,
          date_of_birth: dto.date_of_birth,
          gender: dto.gender,
          nationality: dto.nationality ?? 'Bangladeshi',
          passport_number: dto.passport_number,
          passport_issue_date: dto.passport_issue_date ?? null,
          passport_expiry_date: dto.passport_expiry_date ?? null,
          passport_document_url: dto.passport_document_url ?? null,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          status: PilgrimStatus.ACTIVE,
        });

        return manager.save(Pilgrim, pilgrim);
      });
    }

    const pilgrim = this.pilgrimRepo.create({
      booking_id: bookingId,
      full_name: dto.full_name,
      date_of_birth: dto.date_of_birth,
      gender: dto.gender,
      nationality: dto.nationality ?? 'Bangladeshi',
      passport_number: dto.passport_number,
      passport_issue_date: dto.passport_issue_date ?? null,
      passport_expiry_date: dto.passport_expiry_date ?? null,
      passport_document_url: dto.passport_document_url ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      status: PilgrimStatus.ACTIVE,
    });

    return this.pilgrimRepo.save(pilgrim);
  }

  async listPilgrims(userId: string, userRole: UserRole, bookingId: string) {
    await this.findOne(userId, userRole, bookingId);
    return this.pilgrimRepo.find({
      where: { booking_id: bookingId },
      order: { created_at: 'ASC' },
    });
  }

  async updatePilgrim(
    userId: string,
    userRole: UserRole,
    bookingId: string,
    pilgrimId: string,
    dto: UpdatePilgrimDto,
  ) {
    await this.findOne(userId, userRole, bookingId);
    const pilgrim = await this.pilgrimRepo.findOne({
      where: { id: pilgrimId, booking_id: bookingId },
    });

    if (!pilgrim) {
      throw new NotFoundException('Pilgrim not found');
    }

    Object.assign(pilgrim, {
      full_name: dto.full_name ?? pilgrim.full_name,
      date_of_birth: dto.date_of_birth ?? pilgrim.date_of_birth,
      gender: dto.gender ?? pilgrim.gender,
      nationality: dto.nationality ?? pilgrim.nationality,
      passport_number: dto.passport_number ?? pilgrim.passport_number,
      passport_issue_date:
        dto.passport_issue_date !== undefined
          ? dto.passport_issue_date
          : pilgrim.passport_issue_date,
      passport_expiry_date:
        dto.passport_expiry_date !== undefined
          ? dto.passport_expiry_date
          : pilgrim.passport_expiry_date,
      passport_document_url:
        dto.passport_document_url !== undefined
          ? dto.passport_document_url
          : pilgrim.passport_document_url,
      phone: dto.phone !== undefined ? dto.phone : pilgrim.phone,
      email: dto.email !== undefined ? dto.email : pilgrim.email,
      status: dto.status ?? pilgrim.status,
    });

    return this.pilgrimRepo.save(pilgrim);
  }

  async cancelPilgrim(
    userId: string,
    userRole: UserRole,
    bookingId: string,
    pilgrimId: string,
  ) {
    await this.findOne(userId, userRole, bookingId);
    const pilgrim = await this.pilgrimRepo.findOne({
      where: { id: pilgrimId, booking_id: bookingId },
    });

    if (!pilgrim) {
      throw new NotFoundException('Pilgrim not found');
    }

    pilgrim.status = PilgrimStatus.CANCELLED;
    return this.pilgrimRepo.save(pilgrim);
  }

  // ─── Installment Management ─────────────────────────────────────────────────

  async getInstallments(userId: string, userRole: UserRole, bookingId: string) {
    await this.findOne(userId, userRole, bookingId);
    return this.installmentRepo.find({
      where: { booking_id: bookingId },
      order: { installment_number: 'ASC' },
    });
  }

  async getInstallmentById(
    userId: string,
    userRole: UserRole,
    installmentId: string,
  ) {
    const installment = await this.installmentRepo.findOne({
      where: { id: installmentId },
      relations: ['booking'],
    });

    if (!installment) {
      throw new NotFoundException('Installment not found');
    }

    if (userRole !== UserRole.ADMIN && installment.booking.user_id !== userId) {
      throw new ForbiddenException('Access denied to this installment');
    }

    return installment;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private generateInstallmentSchedule(
    bookingId: string,
    totalAmount: number,
    departureDateStr: string,
    bookingDate: Date,
  ): Array<{
    booking_id: string;
    installment_number: number;
    amount: string;
    paid_amount: string;
    due_date: string;
    status: InstallmentStatus;
  }> {
    const departure = new Date(departureDateStr);
    const diffMs = departure.getTime() - bookingDate.getTime();
    const daysUntilDeparture = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysUntilDeparture <= 30) {
      // 2 installments: 50% deposit, 50% due 7 days before departure
      const firstAmount = Math.round(totalAmount * 0.5 * 100) / 100;
      const secondAmount = Math.round((totalAmount - firstAmount) * 100) / 100;

      const firstDue = new Date(bookingDate.getTime() + 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const secondDueDate = new Date(
        departure.getTime() - 7 * 24 * 60 * 60 * 1000,
      );
      const secondDue = (
        secondDueDate > bookingDate ? secondDueDate : departure
      )
        .toISOString()
        .split('T')[0];

      return [
        {
          booking_id: bookingId,
          installment_number: 1,
          amount: firstAmount.toFixed(2),
          paid_amount: '0.00',
          due_date: firstDue,
          status: InstallmentStatus.PENDING,
        },
        {
          booking_id: bookingId,
          installment_number: 2,
          amount: secondAmount.toFixed(2),
          paid_amount: '0.00',
          due_date: secondDue,
          status: InstallmentStatus.PENDING,
        },
      ];
    }

    // 3 installments: 30% initial deposit, 35% mid-term, 35% final (paid before departure)
    const inst1 = Math.round(totalAmount * 0.3 * 100) / 100;
    const inst2 = Math.round(totalAmount * 0.35 * 100) / 100;
    const inst3 = Math.round((totalAmount - inst1 - inst2) * 100) / 100;

    const due1 = new Date(bookingDate.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const midDays = Math.floor(daysUntilDeparture / 2);
    const due2 = new Date(bookingDate.getTime() + midDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const due3 = new Date(departure.getTime() - 15 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    return [
      {
        booking_id: bookingId,
        installment_number: 1,
        amount: inst1.toFixed(2),
        paid_amount: '0.00',
        due_date: due1,
        status: InstallmentStatus.PENDING,
      },
      {
        booking_id: bookingId,
        installment_number: 2,
        amount: inst2.toFixed(2),
        paid_amount: '0.00',
        due_date: due2,
        status: InstallmentStatus.PENDING,
      },
      {
        booking_id: bookingId,
        installment_number: 3,
        amount: inst3.toFixed(2),
        paid_amount: '0.00',
        due_date: due3,
        status: InstallmentStatus.PENDING,
      },
    ];
  }
}
