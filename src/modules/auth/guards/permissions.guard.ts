import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '@/common/decorators/permissions.decorator';
import {
  Permission,
  ROLE_PERMISSIONS,
  hasPermission,
} from '@/common/enums/permission.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Obtener permisos del usuario basado en su rol
    const userPermissions = this.getUserPermissions(user);

    // Verificar si el usuario tiene todos los permisos requeridos
    const hasAllPermissions = requiredPermissions.every((permission) =>
      hasPermission(userPermissions, permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(`Insufficient permissions`);
    }

    return true;
  }

  private getUserPermissions(user: any): Permission[] {
    // Obtener permisos del rol desde el mapeo centralizado
    return ROLE_PERMISSIONS[user.role] || [];
  }
}
