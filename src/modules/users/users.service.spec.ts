import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserAddress } from './entities/user-address.entity';
import { LoginAttempt } from './entities/login-attempt.entity';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  restore: jest.fn(),
  count: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepository() },
        { provide: getRepositoryToken(UserProfile), useValue: mockRepository() },
        { provide: getRepositoryToken(UserAddress), useValue: mockRepository() },
        { provide: getRepositoryToken(LoginAttempt), useValue: mockRepository() },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const user = { id: 'uuid', email: 'test@example.com' };
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(user);
    });
  });
});