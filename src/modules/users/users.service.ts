import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { LoginAttempt } from './entities/login-attempt.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(UserProfile)
        private readonly profileRepository: Repository<UserProfile>,
        @InjectRepository(LoginAttempt)
        private readonly loginAttemptRepository: Repository<LoginAttempt>,
    ) { }

    // ==================== CRUD BÁSICO ====================

    async create(createUserDto: CreateUserDto): Promise<User> {
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

        const user = this.userRepository.create({
            email: createUserDto.email,
            password: createUserDto.password,
        });

        return this.userRepository.save(user);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { email },
            relations: { profile: true, addresses: true }
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
            dateOfBirth: profileData.dateOfBirth,
            preferences: profileData.preferences || {},
        });

        return this.profileRepository.save(profile);
    }

    async updateProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
        const profile = await this.profileRepository.findOne({
            where: { userId },
        });

        if (!profile) {
            return this.createProfile(userId, profileData);
        }

        Object.assign(profile, profileData);
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
}