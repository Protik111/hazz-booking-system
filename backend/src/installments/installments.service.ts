import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Installment } from './entities/installment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { UserRole } from '../user/enums/user-role.enum';

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async findByBooking(
    userId: string,
    userRole: UserRole,
    bookingId: string,
  ): Promise<Installment[]> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (userRole !== UserRole.ADMIN && booking.user_id !== userId) {
      throw new ForbiddenException(
        'Access denied to this booking installments',
      );
    }

    return this.installmentRepo.find({
      where: { booking_id: bookingId },
      order: { installment_number: 'ASC' },
      relations: ['allocations'],
    });
  }

  async findOne(
    userId: string,
    userRole: UserRole,
    id: string,
  ): Promise<Installment> {
    const installment = await this.installmentRepo.findOne({
      where: { id },
      relations: ['booking', 'allocations'],
    });

    if (!installment) {
      throw new NotFoundException('Installment not found');
    }

    if (userRole !== UserRole.ADMIN && installment.booking.user_id !== userId) {
      throw new ForbiddenException('Access denied to this installment');
    }

    return installment;
  }
}
