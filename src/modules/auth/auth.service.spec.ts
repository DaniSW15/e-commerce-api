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

jest.mock('bcrypt');

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
      get: jest.fn((key: string, val?: any) => val || 'mock_secret'),
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
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(PasswordReset),
          useValue: mockRepository(),
        },
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

      expect(usersService.create).toHaveBeenCalledWith({
        email: dto.email,
        password: dto.password,
        role: UserRole.CUSTOMER,
        workEmail: undefined,
        metadata: undefined,
      });
      expect(usersService.createProfile).toHaveBeenCalledWith('user-uuid', {
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(redisService.setex).toHaveBeenCalled();
      expect(notificationsService.sendEmail).toHaveBeenCalled();
      expect(result).toHaveProperty('access_token');
      expect(result.user.email).toBe(dto.email);
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
      expect(usersService.recordLoginAttempt).toHaveBeenCalledWith(
        'user-id',
        false,
        undefined,
      );
    });

    it('should return tokens on valid credentials', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        emailVerified: true,
        status: 'active',
        password: 'hashed_password',
        role: UserRole.CUSTOMER,
      };
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('mock_access_token');
      refreshTokenRepo.create.mockReturnValue({
        tokenHash: 'refresh_token_hash',
      });
      refreshTokenRepo.save.mockResolvedValue({});

      const result = (await service.login({
        email: 'test@example.com',
        password: 'pwd',
      })) as any;

      expect(usersService.recordLoginAttempt).toHaveBeenCalledWith(
        'user-id',
        true,
        undefined,
      );
      expect(usersService.updateLastLogin).toHaveBeenCalledWith('user-id');
      expect(result).toHaveProperty('access_token');
      expect(result.user.id).toBe('user-id');
    });
  });
});
