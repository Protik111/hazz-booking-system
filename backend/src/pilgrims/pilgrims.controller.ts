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
import { PilgrimsService } from './pilgrims.service';
import { UpdatePilgrimDto } from './dto/update-pilgrim.dto';
import { ListPilgrimsQueryDto } from './dto/list-pilgrims-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';

@Controller('pilgrims')
export class PilgrimsController {
  constructor(private readonly pilgrimsService: PilgrimsService) {}

  @Get(':id')
  async findOne(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pilgrimsService.findOne(userId, userRole, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePilgrimDto,
  ) {
    return this.pilgrimsService.update(userId, userRole, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pilgrimsService.cancel(userId, userRole, id);
  }
}

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/pilgrims')
export class AdminPilgrimsController {
  constructor(private readonly pilgrimsService: PilgrimsService) {}

  @Get()
  async findAll(@Query() query: ListPilgrimsQueryDto) {
    return this.pilgrimsService.adminFindAll(query);
  }
}
