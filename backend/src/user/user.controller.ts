import {
  Controller,
  Get,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from './enums/user-role.enum';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: CurrentUserData) {
    const foundUser = await this.userService.findById(user.userId);
    if (!foundUser) {
      throw new NotFoundException('User not found');
    }
    return this.userService.toResponse(foundUser);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    const foundUser = await this.userService.findById(id);
    if (!foundUser) {
      throw new NotFoundException('User not found');
    }
    return this.userService.toResponse(foundUser);
  }
}
