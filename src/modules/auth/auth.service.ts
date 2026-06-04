import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from './entites/refresh-token.entity';
import { PasswordReset } from './entites/password-reset.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RegisterDto } from './dto/register.dto';
import { AUTH_CONSTANTS } from './auth.cnstants';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { UnauthorizedException } from '@nestjs/common/exceptions/unauthorized.exception';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @InjectRepository(RefreshToken)
        private readonly refreshTokenRepository: Repository<RefreshToken>,
        @InjectRepository(PasswordReset)
        private readonly passwordResetRepository: Repository<PasswordReset>,
    ) { }

    // ==================== REGISTRO ====================
    async register(registerDto: RegisterDto) {
        const user = await this.usersService.create({
            email: registerDto.email,
            password: registerDto.password,
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
            },
        };
    }

    // ==================== LOGIN ====================
    async login(loginDto: LoginDto, ipAddress?: string) {
        const user = await this.usersService.findByEmail(loginDto.email);

        if (!user) {
            throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS);
        }

        // Verificar bloqueo
        if (user.status === 'locked') {
            throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.ACCOUNT_LOCKED);
        }

        // Validar contraseña
        const isValidPassword = await bcrypt.compare(loginDto.password, user.password);
        if (!isValidPassword) {
            await this.usersService.recordLoginAttempt(user.id, false, ipAddress);
            throw new UnauthorizedException(AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS);
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

            const isValid2FA = await this.verifyTwoFactorCode(user, loginDto.twoFactorCode);
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

    // ==================== TOKEN MANAGEMENT ====================
    async generateTokens(user: any, deviceInfo?: string, ipAddress?: string) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
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

    async logout(refreshToken: string) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        const storedToken = await this.refreshTokenRepository.findOne({
            where: { tokenHash },
        });

        if (storedToken) {
            storedToken.revokedAt = new Date();
            storedToken.revokedReason = 'User logout';
            await this.refreshTokenRepository.save(storedToken);
        }

        return { success: true };
    }

    // ==================== 2FA ====================
    async generateTwoFactorSecret(userId: string) {
        const user = await this.usersService.findById(userId);
        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(user.email, AUTH_CONSTANTS.TOTP_ISSUER, secret);

        return {
            secret,
            qrCodeUrl: otpauth,
        };
    }

    async enableTwoFactor(userId: string, code: string, secret: string) {
        const isValid = authenticator.verify({
            token: code,
            secret: secret,
        });

        if (!isValid) {
            throw new BadRequestException('Invalid 2FA code');
        }

        await this.usersService.enableTwoFactor(userId, secret);
        return { success: true, message: AUTH_CONSTANTS.MESSAGES.TWO_FACTOR_ENABLED };
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

    async verifyTwoFactorCode(user: any, code: string): Promise<boolean> {
        return authenticator.verify({
            token: code,
            secret: user.twoFactorSecret,
        });
    }

    private async generateTempToken(user: any) {
        const payload = {
            sub: user.id,
            temp: true,
            expiresIn: '5m',
        };

        return this.jwtService.sign(payload, {
            expiresIn: '5m',
            secret: this.configService.get('JWT_ACCESS_SECRET'),
        });
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
}