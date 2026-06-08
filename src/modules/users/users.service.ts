import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '@users/entities/user.entity';
import { UserRole } from '@/common/enums';
import { UserProfile } from '@users/entities/user-profile.entity';
import { LoginAttempt } from '@users/entities/login-attempt.entity';
import { CreateUserDto } from '@users/dto/create-user.dto';
import { RefreshToken } from '@auth/entites/refresh-token.entity';
import { UserAddress } from './entities/user-address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(UserProfile)
        private readonly profileRepository: Repository<UserProfile>,
        @InjectRepository(LoginAttempt)
        private readonly loginAttemptRepository: Repository<LoginAttempt>,
        @InjectRepository(UserAddress)
        private readonly addressRepository: Repository<UserAddress>,
    ) { }

    // ==================== CRUD BÁSICO ====================

    async create(createUserDto: {
        email: string;
        password: string;
        role?: UserRole;
        workEmail?: string;
        metadata?: Record<string, any>;
    }): Promise<User> {
        const existingUser = await this.userRepository.findOne({
            where: { email: createUserDto.email },
            withDeleted: true,
        });

        if (existingUser) {
            if (existingUser.deletedAt) {
                await this.userRepository.restore(existingUser.id);
                return this.userRepository.findOne({ where: { id: existingUser.id } });
            }
            throw new ConflictException('Email already exists');
        }
        // No hashear aquí - UserSubscriber lo hace automáticamente en beforeInsert
        const user = this.userRepository.create({
            email: createUserDto.email,
            password: createUserDto.password,
            role: createUserDto.role || UserRole.CUSTOMER,
            workEmail: createUserDto.workEmail,
            metadata: createUserDto.metadata,
        });

        return this.userRepository.save(user);
    }

    // For AuthService
    async findByEmail(email: string) {
        return this.userRepository.findOne({
            where: { email },
            select: { id: true, email: true, password: true, role: true, status: true, twoFactorEnabled: true, twoFactorSecret: true, lastLoginAt: true },
        });
    }

    async findById(id: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id },
            relations: { profile: true, addresses: true }
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async findAll(): Promise<User[]> {
        return this.userRepository.find({
            relations: { profile: true },
        });
    }

    async softDelete(id: string): Promise<void> {
        const user = await this.findById(id);
        await this.userRepository.update(id, {
            email: `deleted_${id}@anonymized.local`,
        });
        await this.userRepository.softDelete(id);
    }

    async restore(id: string): Promise<void> {
        await this.userRepository.restore(id);
    }

    // ==================== PROFILE METHODS ====================

    async createProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
        const profile = this.profileRepository.create({
            userId,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            phone: profileData.phone,
            dateOfBirth: profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : undefined,
            preferences: profileData.preferences || {},
        });

        return this.profileRepository.save(profile);
    }

    // ==================== LOGIN ATTEMPTS ====================

    async recordLoginAttempt(userId: string, success: boolean, ipAddress?: string): Promise<void> {
        const attempt = this.loginAttemptRepository.create({
            userId,
            success,
            ipAddress,
        });

        await this.loginAttemptRepository.save(attempt);

        // Verificar intentos fallidos recientes (últimos 30 minutos)
        if (!success) {
            const recentAttempts = await this.loginAttemptRepository.count({
                where: {
                    userId,
                    success: false,
                    createdAt: new Date(Date.now() - 30 * 60 * 1000), // últimos 30 minutos
                },
            });

            // Bloquear usuario después de 5 intentos fallidos
            if (recentAttempts >= 5) {
                await this.userRepository.update(userId, { status: 'locked' });
            }
        }
    }

    async updateLastLogin(userId: string): Promise<void> {
        await this.userRepository.update(userId, {
            lastLoginAt: new Date()
        });
    }

    // ==================== 2FA METHODS ====================

    async enableTwoFactor(userId: string, secret: string): Promise<void> {
        await this.userRepository.update(userId, {
            twoFactorEnabled: true,
            twoFactorSecret: secret,
        });
    }

    async disableTwoFactor(userId: string): Promise<void> {
        await this.userRepository.update(userId, {
            twoFactorEnabled: false,
            twoFactorSecret: null,
        });
    }

    async getTwoFactorSecret(userId: string): Promise<string | null> {
        const user = await this.findById(userId);
        return user.twoFactorSecret;
    }

    // ==================== PASSWORD METHODS ====================

    async updatePassword(email: string, newPassword: string): Promise<void> {
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await this.userRepository.update({ email }, { password: hashedPassword });
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
        const user = await this.findById(userId);

        const isValidPassword = await bcrypt.compare(oldPassword, user.password);
        if (!isValidPassword) {
            throw new BadRequestException('Current password is incorrect');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await this.userRepository.update(userId, { password: hashedPassword });
    }

    // ==================== STATUS METHODS ====================

    async updateStatus(userId: string, status: 'active' | 'inactive' | 'locked'): Promise<void> {
        await this.userRepository.update(userId, { status });
    }

    async verifyEmail(userId: string): Promise<void> {
        await this.userRepository.update(userId, { emailVerified: true });
    }

    // ==================== TOKEN METHODS ====================
    // Otener usuario con sus tokens activos (no revocados ni expirados)
    async findByIdWithTokens(id: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id },
            relations: { profile: true, addresses: true, refreshTokens: true },
        });

        if (!user) throw new NotFoundException('User not found');

        user.refreshTokens = user.refreshTokens.filter(token => !token.revokedAt && token.expiresAt > new Date());

        return user;
    }

    // ==================== PROFILE METHODS ====================
    async getProfile(userId: string): Promise<UserProfile> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: { profile: true },
        });

        if (!user) throw new NotFoundException('User not found');

        return this.sanitizeUser(user);
    }

    // users.service.ts - CORREGIR

    async updateProfile(userId: string, profileData: UpdateProfileDto): Promise<UserProfile> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: { profile: true },
        });

        if (!user) throw new NotFoundException('User not found');

        if (!user.profile) {
            user.profile = new UserProfile();
            user.profile.userId = userId;  // ← Asignar userId manualmente
        }

        // Solo copiar campos permitidos del DTO
        if (profileData.firstName !== undefined) user.profile.firstName = profileData.firstName;
        if (profileData.lastName !== undefined) user.profile.lastName = profileData.lastName;
        if (profileData.phone !== undefined) user.profile.phone = profileData.phone;
        if (profileData.dateOfBirth !== undefined) {
            user.profile.dateOfBirth = profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : null;
        }
        if (profileData.avatarUrl !== undefined) user.profile.avatarUrl = profileData.avatarUrl;
        if (profileData.preferences !== undefined) user.profile.preferences = profileData.preferences;

        await this.profileRepository.save(user.profile);

        return this.sanitizeUser(user);
    }

    async getAddresses(userId: string): Promise<UserAddress[]> {
        return this.addressRepository.find({
            where: { user: { id: userId } },
            order: { isDefault: 'DESC', createdAt: 'DESC' },
        });
    }

    async createAddress(userId: string, dto: CreateAddressDto) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        // If setting as default, unset others
        if (dto.isDefault) {
            await this.addressRepository.update(
                { user: { id: userId }, type: dto.type },
                { isDefault: false },
            );
        }

        const address = this.addressRepository.create({
            ...dto,
            user,
        });

        return this.addressRepository.save(address);
    }

    async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
        });

        if (!address) throw new NotFoundException('Address not found');

        // If setting as default, unset others
        if (dto.isDefault) {
            await this.addressRepository.update(
                { user: { id: userId }, type: address.type },
                { isDefault: false },
            );
        }

        Object.assign(address, dto);
        return this.addressRepository.save(address);
    }

    async deleteAddress(userId: string, addressId: string) {
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
        });

        if (!address) throw new NotFoundException('Address not found');

        await this.addressRepository.remove(address);
        return { message: 'Address deleted successfully' };
    }

    async deleteAccount(userId: string, reason?: string) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: { profile: true },
        });

        if (!user) throw new NotFoundException('User not found');

        // Anonymize profile
        if (user.profile) {
            Object.assign(user.profile, {
                firstName: 'Deleted',
                lastName: 'User',
                phone: null,
                avatarUrl: null,
            });
            await this.profileRepository.save(user.profile);
        }

        // Soft delete user
        await this.userRepository.softDelete(userId);

        // Update to anonymized email
        await this.userRepository.update(userId, {
            email: `deleted_${userId}@anonymized.local`,
            password: 'ANONYMIZED',
            status: UserStatus.DELETED,
        });

        return { message: 'Account scheduled for deletion', deletionDate: new Date() };
    }

    async restoreAccount(userId: string) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            withDeleted: true,
        });

        if (!user || !user.deletedAt) {
            throw new NotFoundException('Account cannot be restored');
        }

        // Check 30-day window
        const daysSinceDelete = (Date.now() - user.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDelete > 30) {
            throw new ForbiddenException('Account permanently deleted');
        }

        await this.userRepository.restore(userId);
        return { message: 'Account restored successfully' };
    }

    // ==================== HELPERS ====================

    private sanitizeUser(user: User) {
        const { password, twoFactorSecret, ...safe } = user as any;
        return safe;
    }
}