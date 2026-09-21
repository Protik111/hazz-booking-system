import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../user/enums/user-role.enum';

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get('status')
  getStatus() {
    return this.schedulerService.getStatus();
  }

  @Post('trigger/expire-holds')
  @HttpCode(HttpStatus.OK)
  triggerExpireHolds() {
    return this.schedulerService.expireSeatHolds();
  }

  @Post('trigger/process-overdue')
  @HttpCode(HttpStatus.OK)
  triggerProcessOverdue() {
    return this.schedulerService.processOverdueInstallments();
  }

  @Post('trigger/send-reminders')
  @HttpCode(HttpStatus.OK)
  triggerSendReminders() {
    return this.schedulerService.sendInstallmentReminders();
  }
}
