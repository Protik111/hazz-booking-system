import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Pilgrim } from './entities/pilgrim.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PackageTier } from '../packages/entities/package-tier.entity';
import { CreatePilgrimDto } from './dto/create-pilgrim.dto';
import { UpdatePilgrimDto } from './dto/update-pilgrim.dto';
import { ListPilgrimsQueryDto } from './dto/list-pilgrims-query.dto';
import { PilgrimStatus } from './enums/pilgrim-status.enum';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import { UserRole } from '../user/enums/user-role.enum';

@Injectable()
export class PilgrimsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Pilgrim)
    private readonly pilgrimRepo: Repository<Pilgrim>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(PackageTier)
    private readonly tierRepo: Repository<PackageTier>,
  ) {}

  /**
   * Add a pilgrim to a booking.
   * If adding exceeds currently reserved seats on a PENDING booking,
   * it atomically locks the tier and reserves an extra seat.
   */
  async create(
    userId: string,
    userRole: UserRole,
    bookingId: string,
    dto: CreatePilgrimDto,
  ): Promise<Pilgrim> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
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
        `Cannot add pilgrim to a ${booking.status.toLowerCase()} booking`,
      );
    }

    const currentPilgrimsCount = await this.pilgrimRepo.count({
      where: { booking_id: bookingId, status: PilgrimStatus.ACTIVE },
    });

    // If active pilgrims reach reserved seat count
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

        if (!tier) {
          throw new NotFoundException('Package tier not found');
        }

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

  /**
   * List all pilgrims for a specific booking.
   */
  async findAllByBooking(
    userId: string,
    userRole: UserRole,
    bookingId: string,
  ): Promise<Pilgrim[]> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (userRole !== UserRole.ADMIN && booking.user_id !== userId) {
      throw new ForbiddenException('Access denied to this booking');
    }

    return this.pilgrimRepo.find({
      where: { booking_id: bookingId },
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Get single pilgrim with ownership check.
   */
  async findOne(
    userId: string,
    userRole: UserRole,
    id: string,
  ): Promise<Pilgrim> {
    const pilgrim = await this.pilgrimRepo.findOne({
      where: { id },
      relations: ['booking'],
    });

    if (!pilgrim) {
      throw new NotFoundException('Pilgrim not found');
    }

    if (userRole !== UserRole.ADMIN && pilgrim.booking.user_id !== userId) {
      throw new ForbiddenException('Access denied to this pilgrim');
    }

    return pilgrim;
  }

  /**
   * Update pilgrim details (e.g. passport info, phone, email).
   */
  async update(
    userId: string,
    userRole: UserRole,
    id: string,
    dto: UpdatePilgrimDto,
  ): Promise<Pilgrim> {
    const pilgrim = await this.findOne(userId, userRole, id);

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

  /**
   * Cancel pilgrim (initiates partial cancellation).
   */
  async cancel(
    userId: string,
    userRole: UserRole,
    id: string,
  ): Promise<Pilgrim> {
    const pilgrim = await this.findOne(userId, userRole, id);

    pilgrim.status = PilgrimStatus.CANCELLED;
    return this.pilgrimRepo.save(pilgrim);
  }

  /**
   * Admin: List all pilgrims across bookings with search and filters.
   */
  async adminFindAll(query: ListPilgrimsQueryDto) {
    const { booking_id, status, gender, search, page = 1, limit = 20 } = query;

    const qb = this.pilgrimRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.booking', 'b')
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (booking_id) {
      qb.andWhere('p.booking_id = :booking_id', { booking_id });
    }

    if (status) {
      qb.andWhere('p.status = :status', { status });
    }

    if (gender) {
      qb.andWhere('p.gender = :gender', { gender });
    }

    if (search) {
      qb.andWhere(
        '(p.full_name ILIKE :search OR p.passport_number ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [pilgrims, total] = await qb.getManyAndCount();

    return {
      data: pilgrims,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
