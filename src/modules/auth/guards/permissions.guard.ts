import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermissions) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // Aquí puedes implementar la lógica de permisos
        // Ejemplo: verificar si el usuario tiene los permisos necesarios
        const userPermissions = this.getUserPermissions(user);

        const hasPermissions = requiredPermissions.every(permission =>
            userPermissions.includes(permission)
        );

        if (!hasPermissions) {
            throw new ForbiddenException(`Insufficient permissions`);
        }

        return true;
    }

    private getUserPermissions(user: any): string[] {
        // Lógica para obtener permisos del usuario basado en su rol
        const rolePermissions = {
            customer: ['products:read', 'orders:create', 'orders:read'],
            seller: ['products:read', 'products:create', 'products:update', 'orders:read'],
            admin: ['*:read', '*:create', '*:update', '*:delete'],
            super_admin: ['*:*'],
        };

        return rolePermissions[user.role] || [];
    }
}