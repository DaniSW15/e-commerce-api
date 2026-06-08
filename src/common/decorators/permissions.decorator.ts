import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums';

/**
 * Decorator para especificar permisos requeridos (granular)
 * Uso: @RequirePermissions(Permission.PRODUCTS_CREATE, Permission.PRODUCTS_UPDATE)
 */
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);
