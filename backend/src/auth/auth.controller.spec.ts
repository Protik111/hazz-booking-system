import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/enums/user-role.enum';
import { UserStatus } from '../user/enums/user-status.enum';
import type { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let userService: UserService;

  const mockSafeUser = {
    id: 'test-user-id',
    name: 'Rahim Ahmed',
    email: 'rahim@example.com',
    phone: '01700000000',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
  };

  const mockUserService = {
    findById: jest.fn(),
    toResponse: jest.fn().mockReturnValue(mockSafeUser),
  };

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register user and return result', async () => {
      const dto = {
        name: 'Rahim Ahmed',
        email: 'rahim@example.com',
        phone: '01700000000',
        password: 'password123',
      };
      mockAuthService.register.mockResolvedValue({ user: mockSafeUser });

      const result = await controller.register(dto);

      expect(result).toEqual({ user: mockSafeUser });
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should login, set cookies, and return tokens and user', async () => {
      const dto = { email: 'rahim@example.com', password: 'password123' };
      const loginResult = {
        access_token: 'access-jwt',
        refresh_token: 'refresh-jwt',
        user: mockSafeUser,
      };
      mockAuthService.login.mockResolvedValue(loginResult);
      const res = mockResponse();

      const result = await controller.login(dto, res);

      expect(result).toEqual(loginResult);
      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'access-jwt',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-jwt',
        expect.any(Object),
      );
    });
  });

  describe('logout', () => {
    it('should clear cookies and return success message', () => {
      const res = mockResponse();

      const result = controller.logout(res);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('getMe', () => {
    it('should return current user profile', async () => {
      mockUserService.findById.mockResolvedValue(mockSafeUser);

      const result = await controller.getMe({
        userId: 'test-user-id',
        email: 'rahim@example.com',
        role: UserRole.USER,
      });

      expect(result).toEqual({ user: mockSafeUser });
      expect(userService.findById).toHaveBeenCalledWith('test-user-id');
    });
  });
});
