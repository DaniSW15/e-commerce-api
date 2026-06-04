import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_2FA_KEY } from '../decorators/skip-2fa.decorator';

@Injectable()
export class TwoFactorGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const skip2FA = this.reflector.getAllAndOverride<boolean>(SKIP_2FA_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (skip2FA) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (user && user.twoFactorEnabled && !request.headers['x-2fa-verified']) {
            throw new UnauthorizedException('2FA verification required');
        }

        return true;
    }
}