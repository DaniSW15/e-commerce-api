import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { UserRole } from '@/common/enums';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { GetUsersFilterDto } from './dto/get-users-filter.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserStatus } from './entities/user.entity';
import { AddressType } from './entities/user-address.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<any>;

  beforeEach(async () => {
    const mockUsersService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      getAddresses: jest.fn(),
      createAddress: jest.fn(),
      updateAddress: jest.fn(),
      deleteAddress: jest.fn(),
      deleteAccount: jest.fn(),
      restoreAccount: jest.fn(),
      findFiltered: jest.fn(),
      updateStatus: jest.fn(),
      updateRole: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should call service.getProfile with user ID', async () => {
      service.getProfile.mockResolvedValueOnce({
        id: 'u-1',
        email: 'test@test.com',
      });
      const result = await controller.getProfile('u-1');
      expect(result).toEqual({ id: 'u-1', email: 'test@test.com' });
      expect(service.getProfile).toHaveBeenCalledWith('u-1');
    });
  });

  describe('updateProfile', () => {
    it('should call service.updateProfile with correct params', async () => {
      const dto: UpdateProfileDto = { firstName: 'John', lastName: 'Doe' };
      service.updateProfile.mockResolvedValueOnce({
        id: 'u-1',
        firstName: 'John',
        lastName: 'Doe',
      });
      const result = await controller.updateProfile('u-1', dto);
      expect(result.firstName).toBe('John');
      expect(service.updateProfile).toHaveBeenCalledWith('u-1', dto);
    });
  });

  describe('addresses', () => {
    it('should get addresses', async () => {
      service.getAddresses.mockResolvedValueOnce([]);
      const result = await controller.getAddresses('u-1');
      expect(result).toEqual([]);
      expect(service.getAddresses).toHaveBeenCalledWith('u-1');
    });

    it('should create address', async () => {
      const dto: CreateAddressDto = {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
        type: AddressType.SHIPPING,
        isDefault: true,
      };
      service.createAddress.mockResolvedValueOnce({ id: 'addr-1', ...dto });
      const result = await controller.createAddress('u-1', dto);
      expect(result.id).toBe('addr-1');
      expect(service.createAddress).toHaveBeenCalledWith('u-1', dto);
    });

    it('should update address', async () => {
      const dto: UpdateAddressDto = { street: '456 Main St' };
      service.updateAddress.mockResolvedValueOnce({
        id: 'addr-1',
        street: '456 Main St',
      });
      const result = await controller.updateAddress('u-1', 'addr-1', dto);
      expect(result.street).toBe('456 Main St');
      expect(service.updateAddress).toHaveBeenCalledWith('u-1', 'addr-1', dto);
    });

    it('should delete address', async () => {
      service.deleteAddress.mockResolvedValueOnce({
        message: 'Address deleted',
      });
      const result = await controller.deleteAddress('u-1', 'addr-1');
      expect(result.message).toBe('Address deleted');
      expect(service.deleteAddress).toHaveBeenCalledWith('u-1', 'addr-1');
    });
  });

  describe('account management', () => {
    it('should delete account', async () => {
      service.deleteAccount.mockResolvedValueOnce({
        message: 'Account deleted',
      });
      const result = await controller.deleteAccount('u-1', 'reasons');
      expect(result.message).toBe('Account deleted');
      expect(service.deleteAccount).toHaveBeenCalledWith('u-1');
    });

    it('should restore account', async () => {
      service.restoreAccount.mockResolvedValueOnce({
        message: 'Account restored',
      });
      const result = await controller.restoreAccount('u-1');
      expect(result.message).toBe('Account restored');
      expect(service.restoreAccount).toHaveBeenCalledWith('u-1');
    });
  });

  describe('admin endpoints', () => {
    it('should get users', async () => {
      const filterDto: GetUsersFilterDto = { page: 1, limit: 10 };
      service.findFiltered.mockResolvedValueOnce({
        items: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });
      const result = await controller.getUsers(filterDto);
      expect(result.items).toEqual([]);
      expect(service.findFiltered).toHaveBeenCalledWith(filterDto);
    });

    it('should update status', async () => {
      const statusDto: UpdateUserStatusDto = { status: UserStatus.SUSPENDED };
      service.updateStatus.mockResolvedValueOnce({
        id: 'u-1',
        status: UserStatus.SUSPENDED,
      });
      const result = await controller.updateUserStatus('u-1', statusDto);
      expect(result.status).toBe(UserStatus.SUSPENDED);
      expect(service.updateStatus).toHaveBeenCalledWith(
        'u-1',
        UserStatus.SUSPENDED,
      );
    });

    it('should update role', async () => {
      const roleDto: UpdateUserRoleDto = { role: UserRole.ADMIN };
      service.updateRole.mockResolvedValueOnce({
        id: 'u-1',
        role: UserRole.ADMIN,
      });
      const result = await controller.updateUserRole('u-1', roleDto);
      expect(result.role).toBe(UserRole.ADMIN);
      expect(service.updateRole).toHaveBeenCalledWith('u-1', UserRole.ADMIN);
    });
  });
});
