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
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import {
  RejectPaymentDto,
  ResolveReconciliationDto,
} from './dto/resolve-reconciliation.dto';
import { ListReconciliationQueryDto } from './dto/list-reconciliation-query.dto';
import { ImportSettlementDto } from './dto/import-settlement.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

// ─── User Payments Controller: /api/v1/payments ─────────────────────────────

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async initiate(
    @CurrentUser('userId') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiatePayment(userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.paymentsService.findAll(userId, userRole, query);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.findOne(userId, userRole, id);
  }
}

// ─── Mock Payment Gateway Controller: /api/v1/mock-payments ───────────────────

@Public()
@Controller('mock-payments')
export class MockPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':paymentId/success')
  @HttpCode(HttpStatus.OK)
  async mockSuccess(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body()
    body?: {
      gateway_transaction_id?: string;
      gateway_reference?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const txId = body?.gateway_transaction_id ?? `MOCK-TX-${Date.now()}`;
    const ref = body?.gateway_reference ?? `MOCK-REF-${Date.now()}`;
    return this.paymentsService.processSuccessfulPayment(
      paymentId,
      txId,
      ref,
      body?.metadata,
    );
  }

  @Post(':paymentId/fail')
  @HttpCode(HttpStatus.OK)
  async mockFail(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.paymentsService.processFailedPayment(paymentId);
  }
}

// ─── Gateway Webhooks Controller: /api/v1/webhooks ────────────────────────────

@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('bkash')
  @HttpCode(HttpStatus.OK)
  async bkashWebhook(@Body() payload: Record<string, unknown>) {
    const eventId =
      (payload?.event_id as string) ||
      (payload?.eventId as string) ||
      (payload?.messageId as string) ||
      (payload?.trxID as string) ||
      null;

    const txId =
      (payload?.trxID as string) ||
      (payload?.gateway_transaction_id as string) ||
      (payload?.transactionId as string) ||
      (payload?.paymentID as string) ||
      (payload?.payment_id as string) ||
      '';

    const statusVal =
      typeof payload?.transactionStatus === 'string'
        ? payload.transactionStatus
        : typeof payload?.status === 'string'
          ? payload.status
          : 'SUCCESS';
    const statusStr = statusVal.toUpperCase();
    const isSuccess =
      statusStr === 'COMPLETED' ||
      statusStr === 'SUCCESS' ||
      statusStr === 'PAID';
    const eventType =
      (payload?.eventType as string) ||
      (payload?.event_type as string) ||
      'PAYMENT_STATUS';

    return this.paymentsService.processWebhook(
      'BKASH',
      eventId,
      txId,
      eventType,
      payload,
      isSuccess,
    );
  }

  @Post('nagad')
  @HttpCode(HttpStatus.OK)
  async nagadWebhook(@Body() payload: Record<string, unknown>) {
    const txId =
      (payload?.issuerPaymentRefNo as string) ||
      (payload?.gateway_transaction_id as string) ||
      (payload?.payment_id as string) ||
      (payload?.order_id as string) ||
      '';

    const eventId =
      (payload?.event_id as string) ||
      (payload?.eventId as string) ||
      (payload?.payment_ref_id as string) ||
      txId ||
      null;

    const statusVal =
      typeof payload?.status === 'string' ? payload.status : 'SUCCESS';
    const statusStr = statusVal.toUpperCase();
    const isSuccess = statusStr === 'SUCCESS' || statusStr === 'COMPLETED';
    const eventType =
      (payload?.eventType as string) ||
      (payload?.event_type as string) ||
      'PAYMENT';

    return this.paymentsService.processWebhook(
      'NAGAD',
      eventId,
      txId,
      eventType,
      payload,
      isSuccess,
    );
  }

  @Post('visa')
  @HttpCode(HttpStatus.OK)
  async visaWebhook(@Body() payload: Record<string, unknown>) {
    const txId =
      (payload?.transaction_id as string) ||
      (payload?.gateway_transaction_id as string) ||
      (payload?.reference as string) ||
      '';

    const eventId =
      (payload?.event_id as string) ||
      (payload?.eventId as string) ||
      txId ||
      null;

    const statusVal =
      typeof payload?.status === 'string' ? payload.status : 'SUCCESS';
    const statusStr = statusVal.toUpperCase();
    const isSuccess =
      statusStr === 'SUCCESS' ||
      statusStr === 'COMPLETED' ||
      statusStr === 'CAPTURED';
    const eventType =
      (payload?.eventType as string) ||
      (payload?.event_type as string) ||
      'CHARGE.SUCCESS';

    return this.paymentsService.processWebhook(
      'VISA',
      eventId,
      txId,
      eventType,
      payload,
      isSuccess,
    );
  }
}

// ─── Admin Payments Controller: /api/v1/admin/manual-payments & reconciliation

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('manual-payments')
  @HttpCode(HttpStatus.CREATED)
  async createManualPayment(
    @CurrentUser('userId') adminId: string,
    @Body() dto: CreateManualPaymentDto,
  ) {
    return this.paymentsService.createManualPayment(adminId, dto);
  }

  @Post('manual-payments/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveManualPayment(
    @CurrentUser('userId') approverId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.approveManualPayment(approverId, id);
  }

  @Post('manual-payments/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectManualPayment(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.paymentsService.rejectManualPayment(adminId, id, dto.reason);
  }

  @Get('reconciliation')
  async listReconciliation(@Query() query: ListReconciliationQueryDto) {
    return this.paymentsService.listReconciliation(query);
  }

  @Post('reconciliation/import')
  @HttpCode(HttpStatus.OK)
  async importSettlement(@Body() dto: ImportSettlementDto) {
    return this.paymentsService.importSettlementRecords(dto);
  }

  @Post('reconciliation/:id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveMismatch(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReconciliationDto,
  ) {
    return this.paymentsService.resolveMismatch(adminId, id, dto);
  }

  @Get('payments')
  async listAllPayments(
    @CurrentUser('userId') adminId: string,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.paymentsService.findAll(adminId, UserRole.ADMIN, query);
  }
}
