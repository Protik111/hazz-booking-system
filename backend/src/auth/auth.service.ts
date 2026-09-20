import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { LoginUserDto } from '../user/dto/login-user.dto';
import { RegisterDto } from './dto/register.dto';
import { UserStatus } from '../user/enums/user-status.enum';
import { JwtPayload, RefreshPayload } from './types/jwt-payload.type';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.userService.create(registerDto);
    return { user };
  }

  async login(loginDto: LoginUserDto) {
    // 1. Find user by email (includes password_hash, role, status)
    const user = await this.userService.findByEmailForAuth(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Verify user status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        `Account is ${user.status.toLowerCase()}. Please contact support.`,
      );
    }

    // 4. Generate tokens
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    const jwtExpiresIn = this.config.get<string>('JWT_EXPIRES_IN');
    const jwtRefreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    const jwtRefreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    if (
      !jwtSecret ||
      !jwtExpiresIn ||
      !jwtRefreshSecret ||
      !jwtRefreshExpiresIn
    ) {
      throw new Error('Missing JWT configuration');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: jwtExpiresIn,
    } as JwtSignOptions);

    const refreshToken = this.jwtService.sign({ sub: user.id }, {
      secret: jwtRefreshSecret,
      expiresIn: jwtRefreshExpiresIn,
    } as JwtSignOptions);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.userService.toResponse(user),
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      // 1. Verify refresh token signature + expiration
      const payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      // 2. Fetch user by ID
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is not active');
      }

      // 3. Generate NEW access token with updated role/email
      const newAccessToken = this.jwtService.sign<JwtPayload>(
        { sub: user.id, email: user.email, role: user.role },
        {
          secret: this.config.get<string>('JWT_SECRET'),
          expiresIn: this.config.get<string>('JWT_EXPIRES_IN'),
        } as JwtSignOptions,
      );

      return { access_token: newAccessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Refresh token expired. Please login again.',
        );
      }
      if (error instanceof Error && error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid refresh token.');
      }
      throw new UnauthorizedException('Failed to refresh token.');
    }
  }
}
