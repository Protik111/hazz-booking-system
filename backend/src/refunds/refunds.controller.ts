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
import { RefundsService } from './refunds.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { ProcessRefundDto } from './dto/process-refund.dto';
import { RejectRefundDto } from './dto/reject-refund.dto';
import { ListRefundsQueryDto } from './dto/list-refunds-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

// ─── User Refunds Controller ────────────────────────────────────────────────

@Controller()
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post('refunds')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body() dto: CreateRefundDto,
  ) {
    return this.refundsService.createRefund(userId, userRole, dto);
  }

  @Get('bookings/:bookingId/refunds')
  async listBookingRefunds(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Query() query: ListRefundsQueryDto,
  ) {
    return this.refundsService.findAll(userId, userRole, {
      ...query,
      booking_id: bookingId,
    });
  }

  @Get('refunds/:id')
  async findOne(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.refundsService.findOne(userId, userRole, id);
  }
}

// ─── Admin Refunds Controller: /api/v1/admin/refunds & reports ──────────────

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminRefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get('refunds')
  async findAll(
    @CurrentUser('userId') adminId: string,
    @Query() query: ListRefundsQueryDto,
  ) {
    return this.refundsService.findAll(adminId, UserRole.ADMIN, query);
  }

  @Get('reports/refunds')
  async getRefundReport() {
    return this.refundsService.getRefundReport();
  }

  @Post('refunds/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.refundsService.approveRefund(adminId, id);
  }

  @Post('refunds/:id/process')
  @HttpCode(HttpStatus.OK)
  async process(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: ProcessRefundDto,
  ) {
    return this.refundsService.processRefund(adminId, id, dto);
  }

  @Post('refunds/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRefundDto,
  ) {
    return this.refundsService.rejectRefund(adminId, id, dto.reason);
  }
}
