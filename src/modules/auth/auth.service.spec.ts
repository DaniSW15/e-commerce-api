import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '@users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshToken } from './entites/refresh-token.entity';
import { PasswordReset } from './entites/password-reset.entity';
import { RedisService } from '@common/services/redis/redis.service';

const mockUsersService = () => ({
  findByEmail: jest.fn(),
  create: jest.fn(),
  updateLastLogin: jest.fn(),
  recordLoginAttempt: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn(),
});

const mockRedisService = () => ({
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
});

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: ReturnType<typeof mockUsersService>;
  let jwtService: ReturnType<typeof mockJwtService>;
  let refreshTokenRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService() },
        { provide: JwtService, useValue: mockJwtService() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: RedisService, useValue: mockRedisService() },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRepository() },
        { provide: getRepositoryToken(PasswordReset), useValue: mockRepository() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        password: 'hashed',
        role: 'customer',
        status: 'active',
        twoFactorEnabled: false,
      };

      usersService.findByEmail.mockResolvedValue(user);
      jwtService.sign.mockReturnValue('token');

      const result = await service.login(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });
});