import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { CreatePilgrimDto } from './dto/create-pilgrim.dto';
import { UpdatePilgrimDto } from './dto/update-pilgrim.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query() query: ListBookingsQueryDto,
  ) {
    return this.bookingsService.findAll(userId, userRole, query);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.findOne(userId, userRole, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(userId, userRole, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.cancel(userId, userRole, id);
  }

  // ─── Pilgrims Sub-routes ──────────────────────────────────────────────────

  @Post(':bookingId/pilgrims')
  @HttpCode(HttpStatus.CREATED)
  async addPilgrim(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: CreatePilgrimDto,
  ) {
    return this.bookingsService.addPilgrim(userId, userRole, bookingId, dto);
  }

  @Get(':bookingId/pilgrims')
  async listPilgrims(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingsService.listPilgrims(userId, userRole, bookingId);
  }

  @Patch(':bookingId/pilgrims/:pilgrimId')
  async updatePilgrim(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('pilgrimId', ParseUUIDPipe) pilgrimId: string,
    @Body() dto: UpdatePilgrimDto,
  ) {
    return this.bookingsService.updatePilgrim(
      userId,
      userRole,
      bookingId,
      pilgrimId,
      dto,
    );
  }

  @Post(':bookingId/pilgrims/:pilgrimId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPilgrim(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('pilgrimId', ParseUUIDPipe) pilgrimId: string,
  ) {
    return this.bookingsService.cancelPilgrim(
      userId,
      userRole,
      bookingId,
      pilgrimId,
    );
  }

  // ─── Installments Sub-routes ──────────────────────────────────────────────

  @Get(':bookingId/installments')
  async getInstallments(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingsService.getInstallments(userId, userRole, bookingId);
  }
}

// ─── Standalone Installment Route: GET /api/v1/installments/:id ───────────────

@Controller('installments')
export class InstallmentsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get(':id')
  async getInstallmentById(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.getInstallmentById(userId, userRole, id);
  }
}

// ─── Admin Bookings Controller: GET /api/v1/admin/bookings ───────────────────

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('bookings')
  async listAllBookings(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query() query: ListBookingsQueryDto,
  ) {
    return this.bookingsService.findAll(userId, userRole, query);
  }
}
