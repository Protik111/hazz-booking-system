import { UserRole } from '../../user/enums/user-role.enum';

export interface JwtPayload {
  sub: string; // user ID (standard JWT "subject" claim)
  email: string;
  role: UserRole;
}

export interface RefreshPayload {
  sub: string; // user ID
}

export interface JwtSignOptions {
  secret: string;
  expiresIn: string | number;
}
