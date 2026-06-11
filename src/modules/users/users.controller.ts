import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { GetUsersFilterDto } from './dto/get-users-filter.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { Roles } from '@/common/decorators';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { UserRole } from '@/common/enums';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  // ==================== PROFILE ====================

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  // ==================== ADDRESSES ====================

  @Get('addresses')
  @ApiOperation({ summary: 'Get all user addresses' })
  async getAddresses(@CurrentUser('id') userId: string) {
    return this.usersService.getAddresses(userId);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Create new address' })
  async createAddress(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.usersService.createAddress(userId, dto);
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: 'Update address' })
  async updateAddress(
    @CurrentUser('id') userId: string,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(userId, addressId, dto);
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete address' })
  async deleteAddress(
    @CurrentUser('id') userId: string,
    @Param('id') addressId: string,
  ) {
    return this.usersService.deleteAddress(userId, addressId);
  }

  // ==================== ACCOUNT MANAGEMENT ====================

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete account (GDPR soft delete)' })
  @ApiResponse({ status: 200, description: 'Account scheduled for deletion' })
  async deleteAccount(
    @CurrentUser('id') userId: string,
    @Body('reason') reason?: string,
  ) {
    if (reason) {
      this.logger.log(
        `Account deletion requested by user ${userId}. Reason: ${reason}`,
      );
    }
    return this.usersService.deleteAccount(userId);
  }

  @Post('account/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore deleted account (within 30 days)' })
  @ApiResponse({ status: 200, description: 'Account restored' })
  @ApiResponse({ status: 403, description: 'Account permanently deleted' })
  async restoreAccount(@CurrentUser('id') userId: string) {
    return this.usersService.restoreAccount(userId);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get paginated list of users (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async getUsers(@Query() filterDto: GetUsersFilterDto) {
    return this.usersService.findFiltered(filterDto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user status (Admin only)' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  async updateUserStatus(
    @Param('id') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(userId, dto.status);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  async updateUserRole(
    @Param('id') userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(userId, dto.role);
  }
}
