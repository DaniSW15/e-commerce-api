import {
    Controller,
    Post,
    Body,
    UseGuards,
    Request,
    Get,
    HttpCode,
    HttpStatus,
    Ip,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EnableTwoFactorDto, VerifyTwoFactorDto, DisableTwoFactorDto } from './dto/two-factor.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Skip2FA } from './decorators/skip-2fa.decorator';
import { RefreshTokenDto } from './dto/refresh-ttoken.dto';
import { RedisService } from '@/common/services/redis/redis.service';
import { Login2FADto } from './dto/login-2fa.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService, private readonly redisService: RedisService) { }

    @Public()
    @Post('register')
    @ApiOperation({ summary: 'Register new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 409, description: 'Email already exists' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Public()
     @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 intentos en 5 min (300000 ms)
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login user' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() loginDto: LoginDto, @Ip() ipAddress: string) {
        return this.authService.login(loginDto, ipAddress);
    }

    // auth.controller.ts - agregar

    @Public()
    @Post('login/2fa')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Complete login with 2FA' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid temp token or 2FA code' })
    async loginWith2FA(@Body() dto: Login2FADto, @Ip() ipAddress: string) {
        return this.authService.loginWith2FA(dto, ipAddress);
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh access token' })
    async refresh(@Body() refreshTokenDto: RefreshTokenDto, @Ip() ipAddress: string) {
        return this.authService.refreshTokens(
            refreshTokenDto.refreshToken,
            refreshTokenDto.deviceInfo,
            ipAddress,
        );
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Logout user' })
    async logout(@Body('refreshToken') refreshToken: string) {
        return this.authService.logout(refreshToken);
    }

    @Post('logout-all')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Logout from all devices' })
    async logoutAll(@CurrentUser('id') userId: string) {
        return this.authService.revokeAllUserTokens(userId, 'User logout all');
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @Skip2FA()
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get current user profile' })
    async getMe(@CurrentUser() user: any) {
        return user;
    }

    @Post('2fa/generate')
    @UseGuards(JwtAuthGuard)
    @Skip2FA()
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Generate 2FA secret' })
    async generate2FASecret(@CurrentUser('id') userId: string) {
        return this.authService.generateTwoFactorSecret(userId); // ← Simple
    }


    @Post('2fa/enable')
    @UseGuards(JwtAuthGuard)
    @Skip2FA()
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Enable 2FA' })
    async enable2FA(
        @CurrentUser('id') userId: string,
        @Body() enableDto: EnableTwoFactorDto,
    ) {
        // El secret debería venir de una sesión temporal
        return this.authService.enableTwoFactor(userId, enableDto.code);
    }

    // auth.controller.ts

    // auth.controller.ts - método verify2FA

    @Post('2fa/verify')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Verify 2FA code' })
    async verify2FA(
        @CurrentUser('id') userId: string,  // ← Solo el ID, no el objeto user
        @Body() verifyDto: VerifyTwoFactorDto,
    ) {
        // El service se encarga de buscar el usuario en DB
        const isValid = await this.authService.verifyTwoFactorCode(userId, verifyDto.code);
        return { isValid };
    }

    @Post('2fa/disable')
    @UseGuards(JwtAuthGuard)
    @Skip2FA()
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Disable 2FA' })
    async disable2FA(
        @CurrentUser('id') userId: string,
        @Body() disableDto: DisableTwoFactorDto,
    ) {
        return this.authService.disableTwoFactor(userId, disableDto.code);
    }

    @Public()
    @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 intentos en 1 hora (3600000 ms)
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Request password reset' })
    async forgotPassword(@Body('email') email: string) {
        return this.authService.forgotPassword(email);
    }

    @Public()
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reset password with token' })
    async resetPassword(
        @Body('token') token: string,
        @Body('newPassword') newPassword: string,
    ) {
        return this.authService.resetPassword(token, newPassword);
    }

    @Post('revoke')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Revoke specific token' })
    async revokeToken(
        @Body('refreshToken') refreshToken: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.authService.revokeToken(refreshToken, userId);
    }

    @Get('tokens')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get active tokens for current user' })
    async getActiveTokens(@CurrentUser('id') userId: string) {
        return this.authService.getActiveTokens(userId);
    }
}