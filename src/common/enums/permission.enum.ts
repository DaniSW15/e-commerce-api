/**
 * Sistema de permisos granular (ABAC - Attribute-Based Access Control)
 * Formato: RECURSO_ACCION
 */
export enum Permission {
  // ==================== USERS ====================
  USERS_READ = 'users:read',
  USERS_READ_ALL = 'users:read_all',
  USERS_CREATE = 'users:create',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  USERS_RESTORE = 'users:restore',

  // ==================== PRODUCTS ====================
  PRODUCTS_READ = 'products:read',
  PRODUCTS_CREATE = 'products:create',
  PRODUCTS_UPDATE = 'products:update',
  PRODUCTS_DELETE = 'products:delete',

  // ==================== CATEGORIES ====================
  CATEGORIES_READ = 'categories:read',
  CATEGORIES_CREATE = 'categories:create',
  CATEGORIES_UPDATE = 'categories:update',
  CATEGORIES_DELETE = 'categories:delete',

  // ==================== ORDERS ====================
  ORDERS_READ = 'orders:read',
  ORDERS_READ_ALL = 'orders:read_all',
  ORDERS_CREATE = 'orders:create',
  ORDERS_UPDATE = 'orders:update',
  ORDERS_UPDATE_STATUS = 'orders:update_status',
  ORDERS_CANCEL = 'orders:cancel',
  ORDERS_DELETE = 'orders:delete',

  // ==================== PAYMENTS ====================
  PAYMENTS_READ = 'payments:read',
  PAYMENTS_CREATE = 'payments:create',
  PAYMENTS_REFUND = 'payments:refund',

  // ==================== CART ====================
  CART_READ = 'cart:read',
  CART_CREATE = 'cart:create',
  CART_UPDATE = 'cart:update',
  CART_DELETE = 'cart:delete',

  // ==================== MEDIA ====================
  MEDIA_READ = 'media:read',
  MEDIA_UPLOAD = 'media:upload',
  MEDIA_DELETE = 'media:delete',

  // ==================== NOTIFICATIONS ====================
  NOTIFICATIONS_READ = 'notifications:read',
  NOTIFICATIONS_SEND = 'notifications:send',

  // ==================== ANALYTICS ====================
  ANALYTICS_READ = 'analytics:read',
  ANALYTICS_EXPORT = 'analytics:export',

  // ==================== ADMIN WILDCARDS ====================
  ALL_READ = '*:read',
  ALL_CREATE = '*:create',
  ALL_UPDATE = '*:update',
  ALL_DELETE = '*:delete',
  ALL_ALL = '*:*', // Super admin - acceso total
}

/**
 * Mapeo de roles a permisos
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  customer: [
    Permission.PRODUCTS_READ,
    Permission.CATEGORIES_READ,
    Permission.ORDERS_READ,
    Permission.ORDERS_CREATE,
    Permission.ORDERS_CANCEL,
    Permission.CART_READ,
    Permission.CART_CREATE,
    Permission.CART_UPDATE,
    Permission.CART_DELETE,
    Permission.PAYMENTS_CREATE,
    Permission.MEDIA_UPLOAD,
  ],
  seller: [
    Permission.PRODUCTS_READ,
    Permission.PRODUCTS_CREATE,
    Permission.PRODUCTS_UPDATE,
    Permission.PRODUCTS_DELETE,
    Permission.CATEGORIES_READ,
    Permission.ORDERS_READ,
    Permission.ORDERS_UPDATE_STATUS,
    Permission.MEDIA_UPLOAD,
    Permission.MEDIA_DELETE,
    Permission.ANALYTICS_READ,
  ],
  admin: [
    Permission.ALL_READ,
    Permission.ALL_CREATE,
    Permission.ALL_UPDATE,
    Permission.ALL_DELETE,
  ],
  super_admin: [Permission.ALL_ALL],
  developer: [Permission.ALL_ALL],
  support: [
    Permission.USERS_READ_ALL,
    Permission.PRODUCTS_READ,
    Permission.ORDERS_READ_ALL,
    Permission.ORDERS_UPDATE_STATUS,
  ],
};

/**
 * Verifica si un usuario tiene un permiso específico
 */
export function hasPermission(
  userPermissions: Permission[],
  requiredPermission: Permission,
): boolean {
  // Super admin tiene todos los permisos
  if (userPermissions.includes(Permission.ALL_ALL)) {
    return true;
  }

  // Verificar wildcards
  const [resource, action] = requiredPermission.split(':');

  // Verificar permiso exacto
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Verificar wildcard de recurso (e.g., *:read para cualquier read)
  if (userPermissions.includes(`*:${action}` as Permission)) {
    return true;
  }

  // Verificar wildcard de acción (e.g., products:* para cualquier acción en products)
  if (userPermissions.includes(`${resource}:*` as Permission)) {
    return true;
  }

  return false;
}
