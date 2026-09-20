import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(createDto: CreateUserDto): Promise<UserResponseDto> {
    const normalizedEmail = createDto.email.trim().toLowerCase();
    const exists = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });
    if (exists) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createDto.password, 10);

    const newUser = this.userRepo.create({
      name: createDto.name.trim(),
      email: normalizedEmail,
      phone: createDto.phone?.trim() || null,
      password_hash: hashedPassword,
      role: createDto.role || UserRole.USER,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepo.save(newUser);

    return this.toResponse(savedUser);
  }

  async findByEmailForAuth(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.userRepo.findOne({
      where: { email: normalizedEmail },
      select: [
        'id',
        'email',
        'phone',
        'password_hash',
        'name',
        'role',
        'status',
        'created_at',
        'updated_at',
        'deleted_at',
      ],
    });
  }

  async findByEmailPublic(email: string): Promise<UserResponseDto | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
      select: [
        'id',
        'email',
        'name',
        'phone',
        'role',
        'status',
        'created_at',
        'updated_at',
      ],
    });
    return user ? this.toResponse(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'name',
        'phone',
        'role',
        'status',
        'created_at',
        'updated_at',
      ],
    });
  }

  toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
