import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CancellationService } from './cancellation.service';
import { RequestCancellationDto } from './dto/request-cancellation.dto';
import { ApproveCancellationDto } from './dto/approve-cancellation.dto';
import { RejectCancellationDto } from './dto/reject-cancellation.dto';
import { ListCancellationsQueryDto } from './dto/list-cancellations-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

// ─── User Booking Cancellation Controller ────────────────────────────────────

@Controller()
export class CancellationController {
  constructor(private readonly cancellationService: CancellationService) {}

  @Post('bookings/:bookingId/cancellation-request')
  @HttpCode(HttpStatus.CREATED)
  async requestCancellation(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: RequestCancellationDto,
  ) {
    return this.cancellationService.requestCancellation(
      userId,
      userRole,
      bookingId,
      dto,
    );
  }

  @Get('bookings/:bookingId/cancellation-requests')
  async listBookingCancellations(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Query() query: ListCancellationsQueryDto,
  ) {
    return this.cancellationService.findAll(userId, userRole, {
      ...query,
      booking_id: bookingId,
    });
  }

  @Get('cancellations/:id')
  async findOne(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cancellationService.findOne(userId, userRole, id);
  }
}

// ─── Admin Cancellation Controller: /api/v1/admin/cancellations ─────────────

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/cancellations')
export class AdminCancellationController {
  constructor(private readonly cancellationService: CancellationService) {}

  @Get()
  async findAll(
    @CurrentUser('userId') adminId: string,
    @Query() query: ListCancellationsQueryDto,
  ) {
    return this.cancellationService.findAll(adminId, UserRole.ADMIN, query);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cancellationService.findOne(adminId, UserRole.ADMIN, id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: ApproveCancellationDto,
  ) {
    return this.cancellationService.approveCancellation(adminId, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCancellationDto,
  ) {
    return this.cancellationService.rejectCancellation(adminId, id, dto.reason);
  }
}
