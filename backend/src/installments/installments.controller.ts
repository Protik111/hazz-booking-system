import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { InstallmentsService } from './installments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../user/enums/user-role.enum';

@Controller()
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Get('installments/:id')
  async findOne(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.installmentsService.findOne(userId, userRole, id);
  }

  @Get('bookings/:bookingId/installments')
  async findByBooking(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.installmentsService.findByBooking(userId, userRole, bookingId);
  }
}
