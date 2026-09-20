import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    phone: '01700000000',
    password_hash: 'hashed-password',
    name: 'Test User',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSafeUser = {
    id: 'user-id',
    email: 'test@example.com',
    phone: '01700000000',
    name: 'Test User',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    created_at: mockUser.created_at,
    updated_at: mockUser.updated_at,
  };

  const mockUserService = {
    create: jest.fn(),
    findByEmailForAuth: jest.fn(),
    findById: jest.fn(),
    toResponse: jest.fn().mockReturnValue(mockSafeUser),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string): string | null => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return config[key] || null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '01700000000',
      password: 'password123',
    };

    it('should register a new user successfully', async () => {
      mockUserService.create.mockResolvedValue(mockSafeUser);

      const result = await service.register(registerDto);

      expect(result).toEqual({ user: mockSafeUser });
      expect(userService.create).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password' };

    it('should return tokens and safe user data for valid credentials', async () => {
      mockUserService.findByEmailForAuth.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: mockSafeUser,
      });
      expect(userService.findByEmailForAuth).toHaveBeenCalledWith(
        loginDto.email,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password_hash,
      );
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      mockUserService.findByEmailForAuth.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockUserService.findByEmailForAuth.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user account is not active', async () => {
      mockUserService.findByEmailForAuth.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw Error if JWT config is missing', async () => {
      mockUserService.findByEmailForAuth.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockConfigService.get.mockReturnValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        'Missing JWT configuration',
      );
    });
  });

  describe('refreshTokens', () => {
    const refreshToken = 'valid-refresh-token';

    it('should return a new access token for a valid refresh token', async () => {
      const payload = { sub: 'user-id' };
      mockJwtService.verify.mockReturnValue(payload);
      mockUserService.findById.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshTokens(refreshToken);

      expect(result).toEqual({ access_token: 'new-access-token' });
      expect(jwtService.verify).toHaveBeenCalledWith(
        refreshToken,
        expect.any(Object),
      );
      expect(userService.findById).toHaveBeenCalledWith(payload.sub);
    });

    it('should throw UnauthorizedException if user in payload is not found', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'non-existent' });
      mockUserService.findById.mockResolvedValue(null);

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is inactive on refresh', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-id' });
      mockUserService.findById.mockResolvedValue({
        ...mockUser,
        status: UserStatus.INACTIVE,
      });

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const error = new Error('Expired');
      error.name = 'TokenExpiredError';
      mockJwtService.verify.mockImplementation(() => {
        throw error;
      });

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        'Refresh token expired',
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const error = new Error('Invalid');
      error.name = 'JsonWebTokenError';
      mockJwtService.verify.mockImplementation(() => {
        throw error;
      });

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        'Invalid refresh token.',
      );
    });
  });
});
