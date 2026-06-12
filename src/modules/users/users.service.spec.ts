import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User, UserStatus } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { LoginAttempt } from './entities/login-attempt.entity';
import { UserAddress } from './entities/user-address.entity';
import { ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@/common/enums';
import { AddressType } from './entities/user-address.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedpassword'),
  compare: jest.fn(),
}));

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
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
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
        { provide: getRepositoryToken(UserProfile), useValue: mockRepository() },
        { provide: getRepositoryToken(LoginAttempt), useValue: mockRepository() },
        { provide: getRepositoryToken(UserAddress), useValue: mockRepository() },
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
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      userRepo.restore.mockResolvedValueOnce({});
      userRepo.findOne.mockResolvedValueOnce({ ...mockUser, deletedAt: null });

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

  describe('findByEmail', () => {
    it('should return the user matching email', async () => {
      const mockUser = { id: 'u-1', email: 'test@test.com' };
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      const result = await service.findByEmail('test@test.com');
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if user is not found', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should return the user if found', async () => {
      const mockUser = { id: 'user-id', email: 'test@test.com' };
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      const result = await service.findById('user-id');
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      userRepo.find.mockResolvedValueOnce([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('softDelete', () => {
    it('should anonymize and soft delete user', async () => {
      const mockUser = { id: 'user-id', email: 'test@test.com' };
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      userRepo.update.mockResolvedValueOnce({});
      userRepo.softDelete.mockResolvedValueOnce({});

      await service.softDelete('user-id');
      expect(userRepo.update).toHaveBeenCalledWith('user-id', {
        email: 'deleted_user-id@anonymized.local',
      });
      expect(userRepo.softDelete).toHaveBeenCalledWith('user-id');
    });
  });

  describe('restore', () => {
    it('should restore soft deleted user', async () => {
      userRepo.restore.mockResolvedValueOnce({});
      await service.restore('user-id');
      expect(userRepo.restore).toHaveBeenCalledWith('user-id');
    });
  });

  describe('createProfile', () => {
    it('should create and save profile', async () => {
      const profileData = { firstName: 'John', lastName: 'Doe' };
      profileRepo.create.mockReturnValue(profileData);
      profileRepo.save.mockResolvedValueOnce(profileData);

      const result = await service.createProfile('user-id', profileData);
      expect(result).toEqual(profileData);
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

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      userRepo.update.mockResolvedValueOnce({});
      await service.updateLastLogin('user-id');
      expect(userRepo.update).toHaveBeenCalledWith('user-id', {
        lastLoginAt: expect.any(Date),
      });
    });
  });

  describe('2FA methods', () => {
    it('should enable 2FA', async () => {
      userRepo.update.mockResolvedValueOnce({});
      await service.enableTwoFactor('user-id', 'secret');
      expect(userRepo.update).toHaveBeenCalledWith('user-id', {
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
      });
    });

    it('should disable 2FA', async () => {
      userRepo.update.mockResolvedValueOnce({});
      await service.disableTwoFactor('user-id');
      expect(userRepo.update).toHaveBeenCalledWith('user-id', {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });
    });

    it('should get 2FA secret', async () => {
      userRepo.findOne.mockResolvedValueOnce({ id: 'u-1', twoFactorSecret: 'secret' });
      const result = await service.getTwoFactorSecret('u-1');
      expect(result).toBe('secret');
    });
  });

  describe('Password methods', () => {
    it('should update password for email', async () => {
      userRepo.update.mockResolvedValueOnce({});
      await service.updatePassword('test@test.com', 'newpass');
      expect(userRepo.update).toHaveBeenCalledWith({ email: 'test@test.com' }, { password: 'hashedpassword' });
    });

    it('should change password if current matches', async () => {
      const user = { id: 'u-1', password: 'oldhashed' };
      userRepo.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      userRepo.update.mockResolvedValueOnce({});

      await service.changePassword('u-1', 'oldpass', 'newpass');
      expect(userRepo.update).toHaveBeenCalledWith('u-1', { password: 'hashedpassword' });
    });

    it('should throw BadRequestException on change password if current is incorrect', async () => {
      const user = { id: 'u-1', password: 'oldhashed' };
      userRepo.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.changePassword('u-1', 'wrongpass', 'newpass')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmail', () => {
    it('should update emailVerified to true', async () => {
      userRepo.update.mockResolvedValueOnce({});
      await service.verifyEmail('u-1');
      expect(userRepo.update).toHaveBeenCalledWith('u-1', { emailVerified: true });
    });
  });

  describe('findByIdWithTokens', () => {
    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findByIdWithTokens('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should return user with filtered active tokens', async () => {
      const futureDate = new Date(Date.now() + 100000);
      const pastDate = new Date(Date.now() - 100000);
      const user = {
        id: 'u-1',
        refreshTokens: [
          { revokedAt: null, expiresAt: futureDate },
          { revokedAt: new Date(), expiresAt: futureDate },
          { revokedAt: null, expiresAt: pastDate },
        ],
      };
      userRepo.findOne.mockResolvedValueOnce(user);
      const result = await service.findByIdWithTokens('u-1');
      expect(result.refreshTokens).toHaveLength(1);
    });
  });

  describe('getProfile', () => {
    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getProfile('u-1')).rejects.toThrow(NotFoundException);
    });

    it('should return sanitized user profile', async () => {
      const user = { id: 'u-1', password: 'pwd', twoFactorSecret: 'secret', profile: { firstName: 'John' } };
      userRepo.findOne.mockResolvedValueOnce(user);
      const result = (await service.getProfile('u-1')) as any;
      expect(result.password).toBeUndefined();
      expect(result.twoFactorSecret).toBeUndefined();
      expect(result.profile.firstName).toBe('John');
    });
  });

  describe('updateProfile', () => {
    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.updateProfile('u-1', {})).rejects.toThrow(NotFoundException);
    });

    it('should update profile and create profile object if not present', async () => {
      const user = { id: 'u-1', profile: null };
      userRepo.findOne.mockResolvedValueOnce(user);
      profileRepo.save.mockResolvedValueOnce({});
      const result = (await service.updateProfile('u-1', { firstName: 'New', dateOfBirth: '1990-01-01' })) as any;
      expect(profileRepo.save).toHaveBeenCalled();
    });
  });

  describe('Addresses', () => {
    it('should get addresses', async () => {
      addressRepo.find.mockResolvedValueOnce([]);
      const result = await service.getAddresses('u-1');
      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when creating address for non-existent user', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.createAddress('u-1', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('should create default address and unset others of same type', async () => {
      const user = { id: 'u-1' };
      userRepo.findOne.mockResolvedValueOnce(user);
      addressRepo.update.mockResolvedValueOnce({});
      addressRepo.create.mockReturnValue({});
      addressRepo.save.mockResolvedValueOnce({ id: 'addr-1' });

      const result = await service.createAddress('u-1', { type: AddressType.SHIPPING, isDefault: true } as any);
      expect(addressRepo.update).toHaveBeenCalled();
      expect(addressRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating non-existent address', async () => {
      addressRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.updateAddress('u-1', 'addr-1', {})).rejects.toThrow(NotFoundException);
    });

    it('should update address and handle isDefault logic', async () => {
      const address = { id: 'addr-1', type: AddressType.SHIPPING, isDefault: false };
      addressRepo.findOne.mockResolvedValueOnce(address);
      addressRepo.update.mockResolvedValueOnce({});
      addressRepo.save.mockResolvedValueOnce({ ...address, isDefault: true });

      const result = await service.updateAddress('u-1', 'addr-1', { isDefault: true });
      expect(addressRepo.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException on deleting non-existent address', async () => {
      addressRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.deleteAddress('u-1', 'addr-1')).rejects.toThrow(NotFoundException);
    });

    it('should delete address', async () => {
      const address = { id: 'addr-1' };
      addressRepo.findOne.mockResolvedValueOnce(address);
      addressRepo.remove.mockResolvedValueOnce({});

      const result = await service.deleteAddress('u-1', 'addr-1');
      expect(result.message).toContain('Address deleted successfully');
    });
  });

  describe('deleteAccount', () => {
    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.deleteAccount('u-1')).rejects.toThrow(NotFoundException);
    });

    it('should anonymize and soft delete account', async () => {
      const user = { id: 'u-1', profile: { firstName: 'John', lastName: 'Doe' } };
      userRepo.findOne.mockResolvedValueOnce(user);
      profileRepo.save.mockResolvedValueOnce({});
      userRepo.softDelete.mockResolvedValueOnce({});
      userRepo.update.mockResolvedValueOnce({});

      const result = await service.deleteAccount('u-1');
      expect(result.message).toContain('scheduled for deletion');
      expect(profileRepo.save).toHaveBeenCalled();
      expect(userRepo.softDelete).toHaveBeenCalledWith('u-1');
    });
  });

  describe('restoreAccount', () => {
    it('should throw NotFoundException if account cannot be restored', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.restoreAccount('u-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if restore window has expired (30 days)', async () => {
      const user = { id: 'u-1', deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) };
      userRepo.findOne.mockResolvedValueOnce(user);
      await expect(service.restoreAccount('u-1')).rejects.toThrow(ForbiddenException);
    });

    it('should restore account if within window', async () => {
      const user = { id: 'u-1', deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) };
      userRepo.findOne.mockResolvedValueOnce(user);
      userRepo.restore.mockResolvedValueOnce({});

      const result = await service.restoreAccount('u-1');
      expect(result.message).toContain('restored successfully');
    });
  });

  describe('admin methods & findFiltered', () => {
    it('should execute build query with filters', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValueOnce([[], 0]),
      };
      userRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findFiltered({ email: 'test', role: UserRole.CUSTOMER, status: 'active' });
      expect(result.items).toEqual([]);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(3);
    });

    it('should update status', async () => {
      const user = { id: 'u-1', status: 'active' };
      userRepo.findOne.mockResolvedValueOnce(user);
      userRepo.save.mockResolvedValueOnce({ ...user, status: 'suspended' });

      const result = await service.updateStatus('u-1', 'suspended');
      expect(result.status).toBe('suspended');
    });

    it('should update role', async () => {
      const user = { id: 'u-1', role: UserRole.CUSTOMER };
      userRepo.findOne.mockResolvedValueOnce(user);
      userRepo.save.mockResolvedValueOnce({ ...user, role: UserRole.ADMIN });

      const result = await service.updateRole('u-1', UserRole.ADMIN);
      expect(result.role).toBe(UserRole.ADMIN);
    });
  });
});
