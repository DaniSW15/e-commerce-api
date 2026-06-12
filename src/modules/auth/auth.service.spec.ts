import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '@users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from '@auth/entites/refresh-token.entity';
import { PasswordReset } from '@auth/entites/password-reset.entity';
import { RedisService } from '@/common/services/redis/redis.service';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@/common/enums';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

jest.mock('otplib', () => ({
  authenticator: {
    verify: jest.fn().mockReturnValue(true),
  },
}));

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<any>;
  let jwtService: jest.Mocked<any>;
  let configService: jest.Mocked<any>;
  let redisService: jest.Mocked<any>;
  let notificationsService: jest.Mocked<any>;
  let userRepo: ReturnType<typeof mockRepository>;
  let refreshTokenRepo: ReturnType<typeof mockRepository>;
  let passwordResetRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    const mockUsersService = {
      create: jest.fn(),
      createProfile: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      recordLoginAttempt: jest.fn(),
      updateLastLogin: jest.fn(),
      updatePassword: jest.fn(),
      disableTwoFactor: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, val?: any) => {
        if (key === 'JWT_ACCESS_SECRET') return 'access_secret';
        if (key === 'JWT_TEMP_SECRET') return 'temp_secret';
        return val || 'mock_secret';
      }),
    };

    const mockRedisService = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    const mockNotificationsService = {
      sendEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: getRepositoryToken(User), useValue: mockRepository() },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRepository() },
        { provide: getRepositoryToken(PasswordReset), useValue: mockRepository() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    redisService = module.get(RedisService);
    notificationsService = module.get(NotificationsService);
    userRepo = module.get(getRepositoryToken(User));
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
    passwordResetRepo = module.get(getRepositoryToken(PasswordReset));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new customer user and return tokens', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockUser = {
        id: 'user-uuid',
        email: dto.email,
        role: UserRole.CUSTOMER,
      };

      usersService.create.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('mock_token');
      refreshTokenRepo.create.mockReturnValue({
        tokenHash: 'hashed_refresh_token',
      });
      refreshTokenRepo.save.mockResolvedValue({});

      const result = (await service.register(dto)) as any;

      expect(usersService.create).toHaveBeenCalled();
      expect(usersService.createProfile).toHaveBeenCalledWith('user-uuid', {
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(redisService.setex).toHaveBeenCalled();
      expect(notificationsService.sendEmail).toHaveBeenCalled();
      expect(result).toHaveProperty('access_token');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'no@example.com', password: 'pwd' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      usersService.findByEmail.mockResolvedValue({ emailVerified: false });
      await expect(
        service.login({ email: 'unverified@example.com', password: 'pwd' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is locked', async () => {
      usersService.findByEmail.mockResolvedValue({ emailVerified: true, status: 'locked' });
      await expect(
        service.login({ email: 'locked@example.com', password: 'pwd' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException if account is deleted', async () => {
      usersService.findByEmail.mockResolvedValue({ emailVerified: true, status: 'deleted' });
      await expect(
        service.login({ email: 'deleted@example.com', password: 'pwd' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if account is suspended', async () => {
      usersService.findByEmail.mockResolvedValue({ emailVerified: true, status: 'suspended' });
      await expect(
        service.login({ email: 'suspended@example.com', password: 'pwd' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const user = {
        id: 'user-id',
        emailVerified: true,
        status: 'active',
        password: 'hashed_password',
      };
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'verified@example.com', password: 'pwd' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should require 2FA if enabled and code not provided', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        emailVerified: true,
        status: 'active',
        password: 'hashed_password',
        twoFactorEnabled: true,
      };
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('mock_temp_token');

      const result = await service.login({ email: 'test@example.com', password: 'pwd' });
      expect(result).toEqual({
        requiresTwoFactor: true,
        tempToken: 'mock_temp_token',
        userId: 'user-id',
      });
    });

    it('should login with 2FA if code matches', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        emailVerified: true,
        status: 'active',
        password: 'hashed_password',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
      };
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersService.findById.mockResolvedValue(user);
      jwtService.sign.mockReturnValue('mock_access_token');
      refreshTokenRepo.create.mockReturnValue({ tokenHash: 'hash' });
      refreshTokenRepo.save.mockResolvedValue({});

      // Mock verifyTwoFactorCode to return true
      jest.spyOn(service, 'verifyTwoFactorCode').mockResolvedValueOnce(true);

      const result = await service.login({ email: 'test@example.com', password: 'pwd', twoFactorCode: '123456' });
      expect(result).toHaveProperty('access_token');
    });

    it('should throw UnauthorizedException if 2FA code is invalid', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        emailVerified: true,
        status: 'active',
        password: 'hashed_password',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
      };
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      jest.spyOn(service, 'verifyTwoFactorCode').mockResolvedValueOnce(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'pwd', twoFactorCode: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginWith2FA', () => {
    it('should throw UnauthorizedException if temp token verification fails', async () => {
      jwtService.verify.mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(service.loginWith2FA({ tempToken: 'invalid', twoFactorCode: '123' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token already used or expired', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-id', temp: true });
      redisService.get.mockResolvedValueOnce(null); // not found in redis

      await expect(service.loginWith2FA({ tempToken: 'valid', twoFactorCode: '123' })).rejects.toThrow(UnauthorizedException);
    });

    it('should successfully login on valid 2FA code', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-id', temp: true });
      redisService.get.mockResolvedValueOnce('user-id');
      jest.spyOn(service, 'verifyTwoFactorCode').mockResolvedValueOnce(true);
      usersService.findById.mockResolvedValueOnce({ id: 'user-id', email: 'test@test.com', status: 'active', role: UserRole.CUSTOMER });
      jwtService.sign.mockReturnValue('mock_access_token');
      refreshTokenRepo.create.mockReturnValue({ tokenHash: 'hash' });

      const result = await service.loginWith2FA({ tempToken: 'valid', twoFactorCode: '123' });
      expect(result).toHaveProperty('access_token');
      expect(redisService.del).toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    it('should rotate tokens successfully', async () => {
      const mockStoredToken = {
        isExpired: () => false,
        isRevoked: () => false,
        user: { id: 'u-1', email: 't@t.com', role: 'customer' },
        revokedAt: null,
        revokedReason: null,
      };
      refreshTokenRepo.findOne.mockResolvedValueOnce(mockStoredToken);
      refreshTokenRepo.save.mockResolvedValueOnce({});
      jwtService.sign.mockReturnValue('new_access_token');
      refreshTokenRepo.create.mockReturnValue({ tokenHash: 'new_refresh' });

      const result = await service.refreshTokens('old_token');
      expect(result).toHaveProperty('access_token');
      expect(mockStoredToken.revokedAt).toBeInstanceOf(Date);
    });

    it('should throw UnauthorizedException if stored token not found or invalid', async () => {
      refreshTokenRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.refreshTokens('invalid')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user refresh tokens', async () => {
      const mockTokens = [{ id: 1, revokedAt: null } as any];
      refreshTokenRepo.find.mockResolvedValueOnce(mockTokens);

      const result = await service.revokeAllUserTokens('user-id');
      expect(result.revokedCount).toBe(1);
      expect(mockTokens[0].revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('logout', () => {
    it('should revoke refresh token and blacklist access token', async () => {
      const mockToken = { id: 1, revokedAt: null };
      refreshTokenRepo.findOne.mockResolvedValueOnce(mockToken);
      jwtService.decode.mockReturnValueOnce({ exp: Math.floor(Date.now() / 1000) + 10 });

      const result = await service.logout('refresh', 'access');
      expect(result.success).toBe(true);
      expect(mockToken.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('enableTwoFactor', () => {
    it('should throw BadRequestException if setup expired', async () => {
      redisService.get.mockResolvedValueOnce(null);
      await expect(service.enableTwoFactor('u-1', '123')).rejects.toThrow(BadRequestException);
    });

    it('should enable 2FA if setup code matches', async () => {
      redisService.get.mockResolvedValueOnce('secret');
      userRepo.update.mockResolvedValueOnce({});

      const result = await service.enableTwoFactor('u-1', '123456');
      expect(result.message).toContain('enabled successfully');
    });
  });

  describe('disableTwoFactor', () => {
    it('should disable 2FA if code matches', async () => {
      usersService.findById.mockResolvedValueOnce({ id: 'u-1', twoFactorSecret: 'secret' });
      const result = await service.disableTwoFactor('u-1', '123456');
      expect(result.success).toBe(true);
    });
  });

  describe('forgotPassword', () => {
    it('should generate password reset request', async () => {
      usersService.findByEmail.mockResolvedValueOnce({ id: 'u-1', email: 'test@test.com' });
      passwordResetRepo.create.mockReturnValue({});
      passwordResetRepo.save.mockResolvedValueOnce({});

      const result = await service.forgotPassword('test@test.com');
      expect(result.success).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('should reset password on valid request', async () => {
      const mockReset = {
        email: 'test@test.com',
        isValid: () => true,
        usedAt: null,
      };
      passwordResetRepo.findOne.mockResolvedValueOnce(mockReset);
      usersService.findByEmail.mockResolvedValueOnce({ id: 'u-1' });
      refreshTokenRepo.find.mockResolvedValueOnce([]); // revokeAllTokens

      const result = await service.resetPassword('token', 'newpassword');
      expect(result.success).toBe(true);
      expect(mockReset.usedAt).toBeInstanceOf(Date);
    });
  });

  describe('verifyEmail', () => {
    it('should throw NotFoundException if user not found', async () => {
      usersService.findByEmail.mockResolvedValueOnce(null);
      await expect(service.verifyEmail('no@test.com', 'token')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if token is invalid', async () => {
      usersService.findByEmail.mockResolvedValueOnce({ id: 'u-1', emailVerified: false });
      redisService.get.mockResolvedValueOnce('correct_token');

      await expect(service.verifyEmail('t@t.com', 'wrong_token')).rejects.toThrow(BadRequestException);
    });

    it('should verify email successfully', async () => {
      usersService.findByEmail.mockResolvedValueOnce({ id: 'u-1', emailVerified: false });
      redisService.get.mockResolvedValueOnce('token');
      userRepo.update.mockResolvedValueOnce({});

      const result = await service.verifyEmail('t@t.com', 'token');
      expect(result.message).toContain('verified successfully');
    });
  });

  describe('resendVerificationEmail', () => {
    it('should resend verification token', async () => {
      usersService.findByEmail.mockResolvedValueOnce({ id: 'u-1', email: 't@t.com', emailVerified: false });
      redisService.setex.mockResolvedValueOnce({});
      notificationsService.sendEmail.mockResolvedValueOnce({});

      const result = await service.resendVerificationEmail('t@t.com');
      expect(result.message).toContain('sent successfully');
    });
  });

  describe('token helpers', () => {
    it('should count active devices', async () => {
      refreshTokenRepo.count.mockResolvedValueOnce(3);
      const result = await service.countActiveDevices('u-1');
      expect(result).toBe(3);
    });

    it('should get active tokens', async () => {
      refreshTokenRepo.find.mockResolvedValueOnce([]);
      const result = await service.getActiveTokens('u-1');
      expect(result.total).toBe(0);
    });

    it('should revoke specific token', async () => {
      const mockToken = { id: 1, revokedAt: null };
      refreshTokenRepo.findOne.mockResolvedValueOnce(mockToken);
      refreshTokenRepo.save.mockResolvedValueOnce({});

      const result = await service.revokeToken('token', 'u-1');
      expect(result.success).toBe(true);
    });
  });
});
