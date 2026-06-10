import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // verificar si el token está en blacklist
    const request = context.switchToHttp().getRequest();
    const token = request.headers.autthorization?.replace('Bearer ', '');

    if (token && this.authService.isTokenBlacklisted(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user)
      throw err || new UnauthorizedException('Invalid or expired token');

    if (info?.name === 'TokenExpiredError')
      throw new UnauthorizedException('Token has expired');
    return user;
  }
}
