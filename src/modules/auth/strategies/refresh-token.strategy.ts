import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'refresh-token',
) {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(request: Request): Promise<any> {
    const refreshToken =
      request.body?.refreshToken || request.headers['x-refresh-token'];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const user = await this.authService.validateRefreshToken(refreshToken);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return user;
  }
}
