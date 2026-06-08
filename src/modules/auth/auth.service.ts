import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '@users/users.service';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from '@auth/entites/refresh-token.entity';
import { PasswordReset } from '@auth/entites/password-reset.entity';
import { MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RegisterDto } from '@auth/dto/register.dto';
import { AUTH_CONSTANTS } from '@auth/auth.cnstants';
import { LoginDto } from '@auth/dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { UnauthorizedException } from '@nestjs/common/exceptions/unauthorized.exception';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@/common/services/redis/redis.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { User } from '../users/entities/user.entity';
import { UserRole } from '@/common/enums';
import { Login2FADto } from './dto/login-2fa.dto';

@Injectable()
export class AuthService {
    private tokenBlacklist: Set<string> = new Set();
    private readonly otplibAuthenticator = authenticator;


    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @InjectRepository(RefreshToken)
        private readonly refreshTokenRepository: Repository<RefreshToken>,
        @InjectRepository(PasswordReset)
        private readonly passwordResetRepository: Repository<PasswordReset>,
        private readonly redisService: RedisService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    // ==================== REGISTRO ====================
    async register(registerDto: RegisterDto) {
        // No hashear aquí - UserSubscriber lo hace automáticamente en beforeInsert
        const user = await this.usersService.create({
            email: registerDto.email,
            password: registerDto.password,
            role: registerDto.role || UserRole.CUSTOMER,
            workEmail: registerDto.workEmail,
            metadata: registerDto.metadata,
        });

        // Crear perfil si se proporcionaron datos adicionales
        if (registerDto.firstName || registerDto.lastName) {
            await this.usersService.createProfile(user.id, {
                firstName: registerDto.firstName,
                lastName: registerDto.lastName,
            });
        }

        const tokens = await this.generateTokens(user);

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                workEmail: user.workEmail,
                metadata: user.metadata,
            },
        };
    }

    // ==================== LOGIN ====================
    async login(loginDto: LoginDto, ipAddress?: string) {
        const user = await this.usersService.findByEmail(loginDto.email);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (user.status === 'locked') {
            throw new UnauthorizedException('Account locked');
        }

        if (user.status === 'deleted') {
            throw new NotFoundException('User not found');
        }

        if (user.status === 'suspended') {
            throw new ForbiddenException('Account suspended');
        }

        const isValidPassword = await bcrypt.compare(loginDto.password, user.password);
        if (!isValidPassword) {
            await this.usersService.recordLoginAttempt(user.id, false, ipAddress);
            throw new UnauthorizedException('Invalid credentials');
        }

        // Verificar 2FA
        if (user.twoFactorEnabled) {
            if (!loginDto.twoFactorCode) {
                return {
                    requiresTwoFactor: true,
                    tempToken: await this.generateTempToken(user),
                    userId: user.id,
                };
            }

            const isValid2FA = await this.verifyTwoFactorCode(user.id, loginDto.twoFactorCode);
            if (!isValid2FA) {
                throw new UnauthorizedException('Invalid 2FA code');
            }
        }

        await this.usersService.recordLoginAttempt(user.id, true, ipAddress);
        await this.usersService.updateLastLogin(user.id);

        const tokens = await this.generateTokens(user, loginDto.deviceInfo, ipAddress);

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                twoFactorEnabled: user.twoFactorEnabled,
            },
        };
    }

    // ==================== LOGIN WITH 2FA ====================
    async loginWith2FA(dto: Login2FADto, ipAddress?: string) {
        // 1. Verificar JWT temp
        let payload;
        try {
            payload = this.jwtService.verify(dto.tempToken, {
                secret: this.configService.get('JWT_TEMP_SECRET'),
            });
        } catch {
            throw new UnauthorizedException('Invalid or expired temp token');
        }

        // 2. Verificar que es temp token
        if (!payload.temp) {
            throw new UnauthorizedException('Invalid token type');
        }

        // 3. Verificar single-use en Redis
        const tokenHash = crypto.createHash('sha256').update(dto.tempToken).digest('hex');
        const userId = await this.redisService.get(`2fa:temp:${tokenHash}`);

        if (!userId) {
            throw new UnauthorizedException('Token already used or expired');
        }

        // 4. Eliminar de Redis (single-use)
        await this.redisService.del(`2fa:temp:${tokenHash}`);

        // 5. Verificar 2FA
        const isValid2FA = await this.verifyTwoFactorCode(payload.sub, dto.twoFactorCode);
        if (!isValid2FA) {
            throw new UnauthorizedException('Invalid 2FA code');
        }

        // 6. Buscar usuario y generar tokens
        const user = await this.usersService.findById(payload.sub);
        if (!user || user.status === 'deleted') {
            throw new NotFoundException('User not found');
        }

        await this.usersService.recordLoginAttempt(user.id, true, ipAddress);
        await this.usersService.updateLastLogin(user.id);

        const tokens = await this.generateTokens(user, dto.deviceInfo, ipAddress);

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                twoFactorEnabled: user.twoFactorEnabled,
            },
        };
    }

    // ==================== TOKEN MANAGEMENT ====================
    async generateTokens(user: any, deviceInfo?: string, ipAddress?: string) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            permissions: this.getUserPermissions(user.role), // ← Agregar permisos
            deviceId: deviceInfo ? this.hashDeviceInfo(deviceInfo) : undefined,
            iat: Math.floor(Date.now() / 1000),
            jti: crypto.randomBytes(16).toString('hex'), // ← ID único del token
        };

        const accessToken = this.jwtService.sign(payload, {
            expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY,
            secret: this.configService.get('JWT_ACCESS_SECRET'),
        });

        const refreshToken = await this.createRefreshToken(user, deviceInfo, ipAddress);

        return {
            access_token: accessToken,
            refresh_token: refreshToken.tokenHash,
            expires_in: 900, // 15 minutos en segundos
            token_type: 'Bearer',
        };
    }

    private getUserPermissions(role: string): string[] {
        const permissions = {
            customer: ['products:read', 'orders:create', 'orders:read'],
            seller: ['products:read', 'products:create', 'products:update', 'orders:read'],
            admin: ['*:read', '*:create', '*:update', '*:delete'],
            super_admin: ['*:*'],
        };
        return permissions[role] || [];
    }

    private hashDeviceInfo(deviceInfo: string): string {
        return crypto.createHash('sha256').update(deviceInfo).digest('hex').substring(0, 16);
    }

    private async createRefreshToken(user: any, deviceInfo?: string, ipAddress?: string) {
        const token = crypto.randomBytes(40).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const refreshToken = this.refreshTokenRepository.create({
            userId: user.id,
            tokenHash,
            deviceInfo,
            ipAddress,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        });

        await this.refreshTokenRepository.save(refreshToken);

        return { tokenHash: token }; // Retornar token sin hash para el cliente
    }

    async refreshTokens(refreshToken: string, deviceInfo?: string, ipAddress?: string) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        const storedToken = await this.refreshTokenRepository.findOne({
            where: { tokenHash },
            relations: { user: true },
        });

        if (!storedToken || storedToken.isExpired() || storedToken.isRevoked()) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        // Revocar el token actual (rotation)
        storedToken.revokedAt = new Date();
        storedToken.revokedReason = 'Used for rotation';
        await this.refreshTokenRepository.save(storedToken);

        // Generar nuevos tokens
        const newTokens = await this.generateTokens(storedToken.user, deviceInfo, ipAddress);

        return newTokens;
    }

    async revokeAllUserTokens(userId: string, reason: string = 'User logout all') {
        const tokens = await this.refreshTokenRepository.find({
            where: { userId, revokedAt: null },
        });

        for (const token of tokens) {
            token.revokedAt = new Date();
            token.revokedReason = reason;
            await this.refreshTokenRepository.save(token);
        }

        return { success: true, revokedCount: tokens.length };
    }

    async logout(refreshToken: string, accessToken?: string) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        const storedToken = await this.refreshTokenRepository.findOne({
            where: { tokenHash },
        });

        if (storedToken) {
            storedToken.revokedAt = new Date();
            storedToken.revokedReason = 'User logout';
            await this.refreshTokenRepository.save(storedToken);
        }

        // Blacklist acces token
        if (accessToken) {
            try {
                const decoded = this.jwtService.decode(accessToken) as any;
                if (decoded && decoded.exp) {
                    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                    if (ttl > 0) {
                        this.tokenBlacklist.add(accessToken);
                        setTimeout(() => this.tokenBlacklist.delete(accessToken), ttl * 1000);
                    }
                }
            } catch (e) {
                console.error('Error decoding access token for blacklist:', e);
            }
        }

        return { success: true };
    }

    async isTokenBlacklisted(token: string): Promise<boolean> {
        return this.tokenBlacklist.has(token);
    }

    // ==================== 2FA ====================
    async generateTwoFactorSecret(userId: string) {
        const secret = speakeasy.generateSecret({ name: 'E-Commerce' });

        // Guardar en Redis temporalmente
        await this.redisService.setex(`2fa:setup:${userId}`, 600, secret.base32);

        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
        return { qrCodeUrl }; // NO devolver el secret
    }

    // auth.service.ts - enableTwoFactor

    async enableTwoFactor(userId: string, code: string): Promise<any> {
        // 1. Obtener de Redis
        const secret = await this.redisService.get(`2fa:setup:${userId}`);
        if (!secret) {
            throw new BadRequestException('2FA setup expired or not started');
        }

        // 2. Verificar código
        const isValid = this.otplibAuthenticator.verify({
            secret,
            token: code,
        });

        if (!isValid) {
            throw new BadRequestException('Invalid 2FA code');
        }

        // 3. Guardar EN LA BASE DE DATOS (crítico)
        await this.userRepository.update(userId, {
            twoFactorSecret: secret,      // ← ASEGURAR QUE SE GUARDA
            twoFactorEnabled: true,
        });

        // 4. Limpiar Redis
        await this.redisService.del(`2fa:setup:${userId}`);

        return { message: '2FA enabled successfully' };
    }

    async disableTwoFactor(userId: string, code: string) {
        const user = await this.usersService.findById(userId);

        const isValid = authenticator.verify({
            token: code,
            secret: user.twoFactorSecret,
        });

        if (!isValid) {
            throw new BadRequestException('Invalid 2FA code');
        }

        await this.usersService.disableTwoFactor(userId);
        return { success: true, message: AUTH_CONSTANTS.MESSAGES.TWO_FACTOR_DISABLED };
    }

    // ==================== GENERATE TEMP TOKEN ====================
    private async generateTempToken(user: any): Promise<string> {
        const tempToken = this.jwtService.sign(
            {
                sub: user.id,
                temp: true,
            },
            {
                expiresIn: '5m',
                secret: this.configService.get('JWT_TEMP_SECRET'),
            }
        );

        // Guardar hash en Redis para single-use
        const tokenHash = crypto.createHash('sha256').update(tempToken).digest('hex');
        await this.redisService.setex(
            `2fa:temp:${tokenHash}`,
            300, // 5 min
            user.id
        );

        return tempToken;
    }

    // ==================== PASSWORD RESET ====================
    async forgotPassword(email: string) {
        const user = await this.usersService.findByEmail(email);

        if (!user) {
            // Por seguridad, no revelar si el email existe
            return { success: true, message: AUTH_CONSTANTS.MESSAGES.PASSWORD_RESET_SENT };
        }

        // Generar token
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Guardar en DB
        const passwordReset = this.passwordResetRepository.create({
            email,
            tokenHash,
            expiresAt: new Date(Date.now() + AUTH_CONSTANTS.RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
        });
        await this.passwordResetRepository.save(passwordReset);

        // Aquí enviar email con el token
        await this.sendPasswordResetEmail(email, token);

        return { success: true, message: AUTH_CONSTANTS.MESSAGES.PASSWORD_RESET_SENT };
    }

    async resetPassword(token: string, newPassword: string) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const resetRequest = await this.passwordResetRepository.findOne({
            where: { tokenHash, usedAt: null },
        });

        if (!resetRequest || !resetRequest.isValid()) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        // Marcar como usado
        resetRequest.usedAt = new Date();
        await this.passwordResetRepository.save(resetRequest);

        // Actualizar contraseña
        await this.usersService.updatePassword(resetRequest.email, newPassword);

        // Revocar todos los refresh tokens por seguridad
        const user = await this.usersService.findByEmail(resetRequest.email);
        await this.revokeAllUserTokens(user.id, 'Password reset');

        return { success: true, message: AUTH_CONSTANTS.MESSAGES.PASSWORD_RESET_SUCCESS };
    }

    // ==================== HELPERS ====================
    async validateUser(userId: string) {
        return this.usersService.findById(userId);
    }

    async validateRefreshToken(token: string) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const storedToken = await this.refreshTokenRepository.findOne({
            where: { tokenHash, revokedAt: null },
            relations: { user: true },
        });

        if (!storedToken || storedToken.isExpired()) {
            return null;
        }

        return storedToken.user;
    }

    private async sendPasswordResetEmail(email: string, token: string) {
        // Implementar envío de email
        console.log(`Password reset token for ${email}: ${token}`);
        // Aquí integrar con SendGrid o SES
    }

    async revokeToken(refreshToken: string, userId: string) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        const storedToken = await this.refreshTokenRepository.findOne({
            where: { tokenHash, userId },
        });

        if (!storedToken) throw new NotFoundException('Token not found');


        storedToken.revokedAt = new Date();
        storedToken.revokedReason = 'User revoke specific token';
        await this.refreshTokenRepository.save(storedToken);

        return { success: true, message: 'Token revoked successfully' };
    }

    async getActiveTokens(userId: string) {
        const activeTokens = await this.refreshTokenRepository.find({
            where: { userId, revokedAt: null },
            select: { id: true, deviceInfo: true, ipAddress: true, createdAt: true, expiresAt: true },
        });

        return {
            total: activeTokens.length,
            tokens: activeTokens,
        };
    }

    async countActiveDevices(userId: string): Promise<number> {
        const result = await this.refreshTokenRepository.count({
            where: {
                userId,
                revokedAt: null,
                expiresAt: MoreThan(new Date()),
            },
        });
        return result;
    }

    // ==================== VERIFY 2FA CODE ====================
    async verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!user.twoFactorEnabled) {
            throw new BadRequestException('2FA is not enabled for this user');
        }

        if (!user.twoFactorSecret) {
            throw new BadRequestException('2FA secret not found. Please re-enable 2FA.');
        }

        return this.otplibAuthenticator.verify({
            secret: user.twoFactorSecret,
            token: code,
        });
    }
}