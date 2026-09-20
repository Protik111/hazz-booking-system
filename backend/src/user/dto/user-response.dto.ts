import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

export class UserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string | null;
  role!: UserRole;
  status!: UserStatus;
  created_at!: Date;
  updated_at!: Date;
}
