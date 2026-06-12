import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RedisService } from '@/common/services/redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Login2FADto } from './dto/login-2fa.dto';
import { RefreshTokenDto } from './dto/refresh-ttoken.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import {
  EnableTwoFactorDto,
  VerifyTwoFactorDto,
  DisableTwoFactorDto,
} from './dto/two-factor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerificationEmail: jest.fn(),
      loginWith2FA: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      revokeAllUserTokens: jest.fn(),
      generateTwoFactorSecret: jest.fn(),
      enableTwoFactor: jest.fn(),
      verifyTwoFactorCode: jest.fn(),
      disableTwoFactor: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      revokeToken: jest.fn(),
      getActiveTokens: jest.fn(),
    };

    const mockRedisService = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register', async () => {
      const dto: RegisterDto = { email: 't@t.com', password: 'pwd' };
      authService.register.mockResolvedValueOnce({ id: 'u-1' });
      const result = await controller.register(dto);
      expect(result).toEqual({ id: 'u-1' });
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should call authService.login', async () => {
      const dto: LoginDto = { email: 't@t.com', password: 'pwd' };
      authService.login.mockResolvedValueOnce({ access_token: 'tok' });
      const result = await controller.login(dto, '127.0.0.1');
      expect(result).toEqual({ access_token: 'tok' });
      expect(authService.login).toHaveBeenCalledWith(dto, '127.0.0.1');
    });
  });

  describe('verifyEmail', () => {
    it('should call authService.verifyEmail', async () => {
      const dto: VerifyEmailDto = { email: 't@t.com', token: '123' };
      authService.verifyEmail.mockResolvedValueOnce({ message: 'ok' });
      const result = await controller.verifyEmail(dto);
      expect(result).toEqual({ message: 'ok' });
      expect(authService.verifyEmail).toHaveBeenCalledWith('t@t.com', '123');
    });
  });

  describe('resendVerification', () => {
    it('should call authService.resendVerificationEmail', async () => {
      const dto: ResendVerificationDto = { email: 't@t.com' };
      authService.resendVerificationEmail.mockResolvedValueOnce({
        message: 'ok',
      });
      const result = await controller.resendVerification(dto);
      expect(result).toEqual({ message: 'ok' });
      expect(authService.resendVerificationEmail).toHaveBeenCalledWith(
        't@t.com',
      );
    });
  });

  describe('loginWith2FA', () => {
    it('should call authService.loginWith2FA', async () => {
      const dto: Login2FADto = { tempToken: 'temp', twoFactorCode: '123' };
      authService.loginWith2FA.mockResolvedValueOnce({ access_token: 'tok' });
      const result = await controller.loginWith2FA(dto, '127.0.0.1');
      expect(result).toEqual({ access_token: 'tok' });
      expect(authService.loginWith2FA).toHaveBeenCalledWith(dto, '127.0.0.1');
    });
  });

  describe('refresh', () => {
    it('should call authService.refreshTokens', async () => {
      const dto: RefreshTokenDto = { refreshToken: 'ref', deviceInfo: 'dev' };
      authService.refreshTokens.mockResolvedValueOnce({ access_token: 'tok' });
      const result = await controller.refresh(dto, '127.0.0.1');
      expect(result).toEqual({ access_token: 'tok' });
      expect(authService.refreshTokens).toHaveBeenCalledWith(
        'ref',
        'dev',
        '127.0.0.1',
      );
    });
  });

  describe('logout', () => {
    it('should call authService.logout', async () => {
      authService.logout.mockResolvedValueOnce({ success: true });
      const result = await controller.logout('ref');
      expect(result).toEqual({ success: true });
      expect(authService.logout).toHaveBeenCalledWith('ref');
    });
  });

  describe('logoutAll', () => {
    it('should call authService.revokeAllUserTokens', async () => {
      authService.revokeAllUserTokens.mockResolvedValueOnce({ success: true });
      const result = await controller.logoutAll('u-1');
      expect(result).toEqual({ success: true });
      expect(authService.revokeAllUserTokens).toHaveBeenCalledWith(
        'u-1',
        'User logout all',
      );
    });
  });

  describe('getMe', () => {
    it('should return the current user', async () => {
      const user = { id: 'u-1' };
      const result = await controller.getMe(user);
      expect(result).toBe(user);
    });
  });

  describe('generate2FASecret', () => {
    it('should call authService.generateTwoFactorSecret', async () => {
      authService.generateTwoFactorSecret.mockResolvedValueOnce({
        qrCodeUrl: 'url',
      });
      const result = await controller.generate2FASecret('u-1');
      expect(result).toEqual({ qrCodeUrl: 'url' });
      expect(authService.generateTwoFactorSecret).toHaveBeenCalledWith('u-1');
    });
  });

  describe('enable2FA', () => {
    it('should call authService.enableTwoFactor', async () => {
      const dto: EnableTwoFactorDto = { code: '123' };
      authService.enableTwoFactor.mockResolvedValueOnce({ message: 'ok' });
      const result = await controller.enable2FA('u-1', dto);
      expect(result).toEqual({ message: 'ok' });
      expect(authService.enableTwoFactor).toHaveBeenCalledWith('u-1', '123');
    });
  });

  describe('verify2FA', () => {
    it('should call authService.verifyTwoFactorCode', async () => {
      const dto: VerifyTwoFactorDto = { code: '123' };
      authService.verifyTwoFactorCode.mockResolvedValueOnce(true);
      const result = await controller.verify2FA('u-1', dto);
      expect(result).toEqual({ isValid: true });
      expect(authService.verifyTwoFactorCode).toHaveBeenCalledWith(
        'u-1',
        '123',
      );
    });
  });

  describe('disable2FA', () => {
    it('should call authService.disableTwoFactor', async () => {
      const dto: DisableTwoFactorDto = { code: '123' };
      authService.disableTwoFactor.mockResolvedValueOnce({ success: true });
      const result = await controller.disable2FA('u-1', dto);
      expect(result).toEqual({ success: true });
      expect(authService.disableTwoFactor).toHaveBeenCalledWith('u-1', '123');
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword', async () => {
      authService.forgotPassword.mockResolvedValueOnce({ success: true });
      const result = await controller.forgotPassword('t@t.com');
      expect(result).toEqual({ success: true });
      expect(authService.forgotPassword).toHaveBeenCalledWith('t@t.com');
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword', async () => {
      authService.resetPassword.mockResolvedValueOnce({ success: true });
      const result = await controller.resetPassword('token', 'newpass');
      expect(result).toEqual({ success: true });
      expect(authService.resetPassword).toHaveBeenCalledWith(
        'token',
        'newpass',
      );
    });
  });

  describe('revokeToken', () => {
    it('should call authService.revokeToken', async () => {
      authService.revokeToken.mockResolvedValueOnce({ success: true });
      const result = await controller.revokeToken('ref', 'u-1');
      expect(result).toEqual({ success: true });
      expect(authService.revokeToken).toHaveBeenCalledWith('ref', 'u-1');
    });
  });

  describe('getActiveTokens', () => {
    it('should call authService.getActiveTokens', async () => {
      authService.getActiveTokens.mockResolvedValueOnce({ total: 0 });
      const result = await controller.getActiveTokens('u-1');
      expect(result).toEqual({ total: 0 });
      expect(authService.getActiveTokens).toHaveBeenCalledWith('u-1');
    });
  });
});
