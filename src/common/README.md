# Common Module

Módulo compartido con utilidades, decorators, filters, interceptors y enums centralizados.

## 📁 Estructura

```
src/common/
├── decorators/              # Decorators reutilizables
│   ├── api-version.decorator.ts
│   ├── current-user.decorator.ts
│   ├── permissions.decorator.ts
│   ├── public.decorator.ts
│   └── roles.decorator.ts
├── enums/                   # Enums centralizados
│   ├── permission.enum.ts
│   └── user-role.enum.ts
├── filters/                 # Exception filters
│   ├── all-exceptions.filter.ts
│   └── http-exception.filter.ts
├── interceptors/            # Interceptors globales
│   ├── logging.interceptor.ts
│   └── transform.interceptor.ts
├── services/               # Servicios compartidos
│   └── redis/
│       ├── redis.service.ts
│       └── redis.service.spec.ts
└── utils/                  # Utilidades
    ├── crypto.utils.ts
    └── password.utils.ts
```

## 🎯 Enums

### UserRole
```typescript
export enum UserRole {
    CUSTOMER = 'customer',       // Cliente estándar
    SELLER = 'seller',           // Vendedor en marketplace
    ADMIN = 'admin',             // Administrador con permisos amplios
    SUPER_ADMIN = 'super_admin', // Administrador con acceso total
    DEVELOPER = 'developer',     // Desarrollador con acceso técnico
    SUPPORT = 'support',         // Soporte técnico con permisos limitados
}
```

### Permission (ABAC - Attribute-Based Access Control)
```typescript
export enum Permission {
    // Users
    USERS_READ = 'users:read',
    USERS_READ_ALL = 'users:read_all',
    USERS_UPDATE = 'users:update',
    // ... 40+ permisos granulares
}
```

**Mapeo de Roles → Permisos:**
```typescript
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    customer: [Permission.PRODUCTS_READ, Permission.ORDERS_CREATE, ...],
    seller: [Permission.PRODUCTS_CREATE, Permission.ORDERS_READ, ...],
    admin: [Permission.ALL_READ, Permission.ALL_CREATE, ...],
    super_admin: [Permission.ALL_ALL],
};
```

## 🎨 Decorators

### @Public()
Marca rutas como públicas (sin autenticación)
```typescript
@Public()
@Get('products')
async getProducts() { ... }
```

### @Roles(...roles)
Especifica roles requeridos
```typescript
@Roles(UserRole.ADMIN, UserRole.SELLER)
@Post('products')
async createProduct() { ... }
```

### @RequirePermissions(...permissions)
Control granular de permisos
```typescript
@RequirePermissions(Permission.PRODUCTS_CREATE, Permission.PRODUCTS_UPDATE)
@Post('products')
async createProduct() { ... }
```

### @CurrentUser(field?)
Obtiene usuario actual del request
```typescript
async getOrders(@CurrentUser() user: User) { ... }
async getUserId(@CurrentUser('id') userId: string) { ... }
```

### @ApiVersion(...versions)
Especifica versión de API
```typescript
@ApiVersion('1', '2')
@Get('products')
async getProducts() { ... }
```

## 🚨 Exception Filters

### AllExceptionsFilter
Captura **todas** las excepciones (HTTP y no-HTTP)
- Respuestas consistentes
- Logging centralizado
- Stack traces en errores 500

### HttpExceptionFilter
Captura solo excepciones HTTP
- Formato estructurado
- Correlation IDs
- Detalles de validación

**Uso:**
```typescript
// En main.ts
app.useGlobalFilters(new AllExceptionsFilter());
```

## 🔄 Interceptors

### LoggingInterceptor
Logging automático de requests/responses
- Tiempo de respuesta
- Usuario autenticado
- Sanitización de datos sensibles (passwords, tokens)

**Output:**
```
→ GET /api/v1/products - User: john@example.com (uuid)
← GET /api/v1/products - 200 - 45ms
✕ POST /api/v1/orders - 400 - 12ms - Validation failed
```

### TransformInterceptor
Transforma respuestas a formato estándar
```typescript
{
  statusCode: 200,
  data: { ... },
  timestamp: "2026-06-07T18:00:00.000Z",
  path: "/api/v1/products"
}
```

## 🛠️ Utils

### Password Utils
```typescript
// Hash de contraseña
const hash = await hashPassword('myPassword123');

// Comparar contraseña
const isValid = await comparePassword('myPassword123', hash);

// Validar fortaleza
const { valid, errors } = validatePasswordStrength('weak');

// Generar contraseña aleatoria
const password = generateRandomPassword(16);
```

### Crypto Utils
```typescript
// Generar token seguro
const token = generateToken(32); // 64 hex chars

// UUID v4
const id = generateUUID();

// Hashing
const hash = sha256('data');
const md5Hash = md5('data');

// HMAC
const signature = hmacSha256('message', 'secret');

// Encriptación AES-256-GCM
const { encrypted, iv, tag } = encrypt('sensitive data', 'secretKey');
const decrypted = decrypt(encrypted, 'secretKey', iv, tag);

// Código 2FA
const code = generateNumericCode(6); // "123456"

// Slug seguro
const slug = generateSlug('My Product Name!'); // "my-product-name"

// Comparación segura (timing-safe)
const match = secureCompare(token1, token2);
```

## 📦 Uso

### Importar desde common
```typescript
// Decorators
import { Public, Roles, CurrentUser, RequirePermissions } from '@/common/decorators';

// Enums
import { UserRole, Permission } from '@/common/enums';

// Filters
import { AllExceptionsFilter, HttpExceptionFilter } from '@/common/filters';

// Interceptors
import { LoggingInterceptor, TransformInterceptor } from '@/common/interceptors';

// Utils
import { hashPassword, generateToken } from '@/common/utils';

// Todo desde el barrel export
import { UserRole, Permission, Public, hashPassword } from '@/common';
```

### Configuración Global (main.ts)
```typescript
// Exception filters
app.useGlobalFilters(new AllExceptionsFilter());

// Interceptors
app.useGlobalInterceptors(new LoggingInterceptor());
app.useGlobalInterceptors(new TransformInterceptor());
```

## ✅ Beneficios

1. **Centralización** - Un solo lugar para código compartido
2. **Type Safety** - Enums en lugar de strings mágicos
3. **Reutilización** - DRY (Don't Repeat Yourself)
4. **Mantenibilidad** - Cambios en un solo lugar
5. **Consistencia** - Mismo formato en toda la API
6. **Seguridad** - Utils validadas y probadas

## 🧪 Testing

Todos los tests siguen pasando (30/30 ✅)
```bash
npm run test:e2e
```

## 📚 Referencias

- [NestJS Guards](https://docs.nestjs.com/guards)
- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [Custom Decorators](https://docs.nestjs.com/custom-decorators)
