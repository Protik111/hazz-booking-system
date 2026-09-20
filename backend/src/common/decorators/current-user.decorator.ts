import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../user/enums/user-role.enum';

export interface CurrentUserData {
  userId: string;
  email: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: CurrentUserData }>();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
