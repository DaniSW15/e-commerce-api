import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User, UserStatus } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { LoginAttempt } from './entities/login-attempt.entity';
import { UserAddress } from './entities/user-address.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@/common/enums';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  restore: jest.fn(),
  softDelete: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof mockRepository>;
  let profileRepo: ReturnType<typeof mockRepository>;
  let loginAttemptRepo: ReturnType<typeof mockRepository>;
  let addressRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepository() },
        {
          provide: getRepositoryToken(UserProfile),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(LoginAttempt),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(UserAddress),
          useValue: mockRepository(),
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(User));
    profileRepo = module.get(getRepositoryToken(UserProfile));
    loginAttemptRepo = module.get(getRepositoryToken(LoginAttempt));
    addressRepo = module.get(getRepositoryToken(UserAddress));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException if user email already exists and not deleted', async () => {
      userRepo.findOne.mockResolvedValueOnce({
        id: 'user-id',
        deletedAt: null,
      });
      await expect(
        service.create({ email: 'exists@test.com', password: 'password' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should restore and return user if email exists but soft deleted', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'exists@test.com',
        deletedAt: new Date(),
      };
      userRepo.findOne.mockResolvedValueOnce(mockUser); // first check
      userRepo.restore.mockResolvedValueOnce({});
      userRepo.findOne.mockResolvedValueOnce({ ...mockUser, deletedAt: null }); // second check after restore

      const result = await service.create({
        email: 'exists@test.com',
        password: 'password',
      });
      expect(userRepo.restore).toHaveBeenCalledWith('user-id');
      expect(result.deletedAt).toBeNull();
    });

    it('should create and save a new user', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      const mockUser = {
        id: 'user-id',
        email: 'new@test.com',
        role: UserRole.CUSTOMER,
      };
      userRepo.create.mockReturnValue(mockUser);
      userRepo.save.mockResolvedValue(mockUser);

      const result = await service.create({
        email: 'new@test.com',
        password: 'password',
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if user is not found', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return the user if found', async () => {
      const mockUser = { id: 'user-id', email: 'test@test.com' };
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      const result = await service.findById('user-id');
      expect(result).toEqual(mockUser);
    });
  });

  describe('recordLoginAttempt', () => {
    it('should record login attempt and lock account after 5 recent failures', async () => {
      loginAttemptRepo.create.mockReturnValue({});
      loginAttemptRepo.save.mockResolvedValue({});
      loginAttemptRepo.count.mockResolvedValueOnce(5);

      await service.recordLoginAttempt('user-id', false, '127.0.0.1');

      expect(loginAttemptRepo.save).toHaveBeenCalled();
      expect(userRepo.update).toHaveBeenCalledWith('user-id', {
        status: 'locked',
      });
    });

    it('should record login attempt without locking if success', async () => {
      loginAttemptRepo.create.mockReturnValue({});
      loginAttemptRepo.save.mockResolvedValue({});

      await service.recordLoginAttempt('user-id', true, '127.0.0.1');

      expect(loginAttemptRepo.save).toHaveBeenCalled();
      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update user status and return sanitized user', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@test.com',
        status: 'active',
        password: 'hash',
      };
      userRepo.findOne.mockResolvedValueOnce(mockUser); // findById
      userRepo.save.mockResolvedValueOnce({ ...mockUser, status: 'suspended' });

      const result = await service.updateStatus('user-id', 'suspended');

      expect(result.status).toBe('suspended');
      expect(result.password).toBeUndefined();
    });
  });

  describe('updateRole', () => {
    it('should update user role and return sanitized user', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@test.com',
        role: UserRole.CUSTOMER,
        password: 'hash',
      };
      userRepo.findOne.mockResolvedValueOnce(mockUser); // findById
      userRepo.save.mockResolvedValueOnce({
        ...mockUser,
        role: UserRole.ADMIN,
      });

      const result = await service.updateRole('user-id', UserRole.ADMIN);

      expect(result.role).toBe(UserRole.ADMIN);
      expect(result.password).toBeUndefined();
    });
  });
});
