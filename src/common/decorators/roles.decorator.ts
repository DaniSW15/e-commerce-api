import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums';

/**
 * Decorator para especificar roles requeridos
 * Uso: @Roles(UserRole.ADMIN, UserRole.SELLER)
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
