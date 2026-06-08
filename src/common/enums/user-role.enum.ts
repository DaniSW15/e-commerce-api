/**
 * Roles de usuario en el sistema
 * RBAC (Role-Based Access Control)
 */
export enum UserRole {
    CUSTOMER = 'customer',       // Cliente estándar
    SELLER = 'seller',           // Vendedor en marketplace
    ADMIN = 'admin',             // Administrador con permisos amplios
    SUPER_ADMIN = 'super_admin', // Administrador con acceso total
    DEVELOPER = 'developer',     // Desarrollador con acceso técnico
    SUPPORT = 'support',         // Soporte técnico con permisos limitados
}
