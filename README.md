<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# 🛒 E-Commerce API - NestJS Architecture

> Arquitectura semi-senior/senior para e-commerce con NestJS, PostgreSQL, Redis y AWS S3.
> Diseñada para escalabilidad, seguridad enterprise y cumplimiento GDPR.

---

## 📋 Tabla de Contenidos

- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitectura](#-arquitectura)
- [Estructura de Carpetas](#-estructura-de-carpetas)
- [Base de Datos](#-base-de-datos)
- [Autenticación & Seguridad](#-autenticación--seguridad)
- [Módulos del Sistema](#-módulos-del-sistema)
- [Instalación](#-instalación)
- [Variables de Entorno](#-variables-de-entorno)
- [Comandos Útiles](#-comandos-útiles)
- [Convenciones de Código](#-convenciones-de-código)
- [Roadmap](#-roadmap)

---

## 🚀 Stack Tecnológico

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|-----------|
| **Framework** | [NestJS](https://nestjs.com) | ^10.x | Arquitectura modular, DI, TypeScript nativo |
| **Runtime** | [Node.js](https://nodejs.org) | >=20 LTS | Performance, native fetch, Web Crypto |
| **Lenguaje** | TypeScript | ^5.x | Type safety, decorators, modern JS |
| **DB Principal** | [PostgreSQL](https://postgresql.org) | >=15 | ACID, JSONB, Full-text search, UUID nativo |
| **ORM** | [TypeORM](https://typeorm.io) | ^0.3.x | Migrations, relations, query builder, soft delete |
| **Cache / Sessions** | [Redis](https://redis.io) | >=7 | Rate limiting, sessions, pub/sub, distributed locks |
| **Colas (Jobs)** | [BullMQ](https://bullmq.io) | ^5.x | Background jobs, retries, delayed jobs, flows |
| **Auth** | Passport + JWT + bcrypt | - | JWT access/refresh tokens, token rotation, 2FA |
| **Storage** | AWS S3 + CloudFront | - | CDN global, image optimization, lifecycle policies |
| **Email** | SendGrid / AWS SES | - | Templates, tracking, deliverability |
| **Pagos** | [Stripe](https://stripe.com) | - | PCI compliance, webhooks, subscriptions |
| **Image Processing** | [Sharp](https://sharp.pixelplumbing.com) | ^0.33.x | WebP optimization, resizing, metadata stripping |
| **Validación** | class-validator + class-transformer | - | DTOs, sanitización, pipe validation |
| **Documentación** | Swagger (OpenAPI) | - | Auto-generated API docs |
| **Testing** | Jest + Supertest | - | Unit, integration, e2e |
| **Monitoring** | Sentry + Prometheus | - | Error tracking, metrics, alerting |
| **Container** | Docker + Docker Compose | - | Dev environment, CI/CD consistency |

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTES                              │
│  (Web App / Mobile / Admin Dashboard / Third-party APIs)    │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS / HTTP2
┌────────────────────▼────────────────────────────────────────┐
│                    API GATEWAY (Nginx / AWS ALB)               │
│  • Rate limiting (Layer 7)                                   │
│  • SSL termination                                           │
│  • Request routing                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              NESTJS APPLICATION (Modular Monolith)           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Auth      │  │   Users     │  │     Products        │   │
│  │  Module     │  │  Module     │  │     Module          │   │
│  │             │  │             │  │                     │   │
│  │ • JWT/2FA   │  │ • Profiles  │  │ • Catalog           │   │
│  │ • OAuth2    │  │ • Addresses │  │ • Inventory         │   │
│  │ • RBAC      │  │ • GDPR      │  │ • Categories        │   │
│  │ • Sessions  │  │ • Soft Del  │  │ • Search            │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Orders    │  │   Payments  │  │      Media          │   │
│  │  Module     │  │  Module     │  │     Module          │   │
│  │             │  │             │  │                     │   │
│  │ • Cart      │  │ • Stripe    │  │ • S3 Upload         │   │
│  │ • Checkout  │  │ • Webhooks  │  │ • Image Proc        │   │
│  │ • History   │  │ • Refunds   │  │ • CDN URLs          │   │
│  │ • Saga      │  │ • Invoices  │  │ • Bulk Delete       │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐                            │
│  │Notifications│  │  Analytics  │                            │
│  │  Module     │  │   Module    │                            │
│  │             │  │             │                            │
│  │ • Email     │  │ • Reports   │                            │
│  │ • SMS       │  │ • Metrics   │                            │
│  │ • Push      │  │ • Events    │                            │
│  └─────────────┘  └─────────────┘                            │
└────────────────────┬────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼────┐    ┌─────▼─────┐   ┌─────▼──────┐
│PostgreSQL│    │  Redis    │   │   AWS S3   │
│          │    │           │   │            │
│• Users   │    │• Sessions │   │• Images    │
│• Products│    │• Cache    │   │• Documents │
│• Orders  │    │• Queues   │   │• Backups   │
│• Payments│    │• Pub/Sub  │   │            │
└──────────┘    └───────────┘   └────────────┘
```

### Patrones Arquitectónicos Implementados

| Patrón | Implementación | Módulo(s) |
|--------|---------------|-----------|
| **Modular Monolith** | Cada dominio es un módulo NestJS independiente | Global |
| **Repository Pattern** | TypeORM Repositories + Custom Repositories | Todos |
| **Dependency Injection** | NestJS IoC Container | Global |
| **CQRS** | Separación comandos/queries en Orders | Orders |
| **Saga Pattern** | Transacciones distribuidas: Orden → Pago → Inventario | Orders, Payments |
| **Outbox Pattern** | Consistencia eventual en notificaciones | Notifications |
| **Event Sourcing** | Audit trail para pagos y cambios de estado | Payments |
| **Soft Delete (Paranoid)** | `deletedAt` en Users, Products | Users, Products |
| **Token Rotation** | Refresh tokens de un solo uso | Auth |
| **Circuit Breaker** | Fallbacks para servicios externos (Stripe, S3) | Payments, Media |

---

## 📁 Estructura de Carpetas

```
.
├── 📂 src/
│   ├── 📂 modules/                    # Dominios de negocio
│   │   ├── 📂 auth/                   # Autenticación & Autorización
│   │   │   ├── 📂 dto/
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── register.dto.ts
│   │   │   │   ├── refresh-token.dto.ts
│   │   │   │   └── two-factor.dto.ts
│   │   │   ├── 📂 entities/
│   │   │   │   ├── refresh-token.entity.ts
│   │   │   │   └── password-reset.entity.ts
│   │   │   ├── 📂 guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   ├── permissions.guard.ts
│   │   │   │   └── two-factor.guard.ts
│   │   │   ├── 📂 strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── refresh-token.strategy.ts
│   │   │   ├── 📂 decorators/
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   ├── permissions.decorator.ts
│   │   │   │   └── current-user.decorator.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   └── auth.constants.ts
│   │   │
│   │   ├── 📂 users/                   # Gestión de usuarios
│   │   │   ├── 📂 entities/
│   │   │   │   ├── user.entity.ts
│   │   │   │   ├── user-profile.entity.ts
│   │   │   │   ├── user-address.entity.ts
│   │   │   │   └── login-attempt.entity.ts
│   │   │   ├── 📂 dto/
│   │   │   ├── 📂 subscribers/
│   │   │   │   └── user.subscriber.ts    # TypeORM hooks (hash password)
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   │
│   │   ├── 📂 products/                # Catálogo de productos
│   │   │   ├── 📂 entities/
│   │   │   │   ├── product.entity.ts
│   │   │   │   ├── category.entity.ts
│   │   │   │   └── product-image.entity.ts
│   │   │   ├── 📂 dto/
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts
│   │   │   └── products.module.ts
│   │   │
│   │   ├── 📂 orders/                  # Pedidos & Carrito
│   │   │   ├── 📂 entities/
│   │   │   │   ├── order.entity.ts
│   │   │   │   └── order-item.entity.ts
│   │   │   ├── 📂 dto/
│   │   │   ├── 📂 sagas/
│   │   │   │   └── order-processing.saga.ts
│   │   │   ├── orders.controller.ts
│   │   │   ├── orders.service.ts
│   │   │   └── orders.module.ts
│   │   │
│   │   ├── 📂 payments/                # Pagos (Stripe, PayPal)
│   │   │   ├── 📂 entities/
│   │   │   │   └── payment.entity.ts
│   │   │   ├── 📂 dto/
│   │   │   ├── 📂 webhooks/
│   │   │   │   └── stripe-webhook.controller.ts
│   │   │   ├── payments.controller.ts
│   │   │   ├── payments.service.ts
│   │   │   └── payments.module.ts
│   │   │
│   │   ├── 📂 inventory/               # Inventario & Stock
│   │   │   ├── 📂 entities/
│   │   │   │   └── inventory-log.entity.ts
│   │   │   ├── inventory.service.ts
│   │   │   └── inventory.module.ts
│   │   │
│   │   ├── 📂 media/                   # Imágenes & Archivos
│   │   │   ├── 📂 dto/
│   │   │   ├── 📂 processors/
│   │   │   │   └── image.processor.ts
│   │   │   ├── media.controller.ts
│   │   │   ├── media.service.ts
│   │   │   └── media.module.ts
│   │   │
│   │   └── 📂 notifications/           # Emails, SMS, Push
│   │       ├── 📂 templates/
│   │       ├── 📂 queues/
│   │       │   └── email.processor.ts
│   │       ├── notifications.service.ts
│   │       └── notifications.module.ts
│   │
│   ├── 📂 common/                      # Shared utilities
│   │   ├── 📂 filters/
│   │   │   ├── all-exceptions.filter.ts
│   │   │   └── http-exception.filter.ts
│   │   ├── 📂 interceptors/
│   │   │   ├── transform.interceptor.ts
│   │   │   ├── logging.interceptor.ts
│   │   │   └── cache.interceptor.ts
│   │   ├── 📂 pipes/
│   │   │   └── validation.pipe.ts
│   │   ├── 📂 decorators/
│   │   │   ├── public.decorator.ts
│   │   │   └── api-version.decorator.ts
│   │   ├── 📂 utils/
│   │   │   ├── password.utils.ts
│   │   │   └── crypto.utils.ts
│   │   └── 📂 enums/
│   │       ├── user-role.enum.ts
│   │       ├── order-status.enum.ts
│   │       └── payment-status.enum.ts
│   │
│   ├── 📂 config/                      # Configuración centralizada
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── security.config.ts
│   │   ├── aws.config.ts
│   │   └── stripe.config.ts
│   │
│   ├── 📂 database/                  # Migrations & Seeds
│   │   ├── 📂 migrations/
│   │   │   ├── 001-create-users.ts
│   │   │   ├── 002-create-products.ts
│   │   │   └── 003-create-orders.ts
│   │   ├── 📂 seeds/
│   │   │   ├── user.seed.ts
│   │   │   └── product.seed.ts
│   │   └── data-source.ts             # TypeORM CLI config
│   │
│   ├── 📂 shared/                      # Servicios compartidos
│   │   ├── 📂 services/
│   │   │   ├── redis.service.ts
│   │   │   ├── s3.service.ts
│   │   │   └── email.service.ts
│   │   └── shared.module.ts
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── 📂 test/                          # Tests e2e
│   ├── auth.e2e-spec.ts
│   ├── users.e2e-spec.ts
│   └── jest-e2e.json
│
├── 📂 docs/                          # Documentación adicional
│   ├── api-versioning.md
│   ├── deployment.md
│   └── security-checklist.md
│
├── .env.example
├── .env.development
├── .env.production
├── docker-compose.yml
├── Dockerfile
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── package.json
└── README.md
```

---

## 🗄️ Base de Datos

### Diagrama Entidad-Relación (Core)

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│     users       │       │  user_profiles   │       │ user_addresses  │
├─────────────────┤       ├──────────────────┤       ├─────────────────┤
│ PK id (UUID)    │◄──────┤ PK id (UUID)     │       │ PK id (UUID)    │
│ email (UNIQUE)  │   1:1 │ FK user_id       │       │ FK user_id      │
│ password_hash   │       │ first_name       │       │ type            │
│ role            │       │ last_name        │       │ street          │
│ status          │       │ phone            │       │ city            │
│ email_verified  │       │ date_of_birth    │       │ country         │
│ 2fa_enabled     │       │ avatar_url       │       │ is_default      │
│ last_login_at   │       │ preferences(JSONB│       └─────────────────┘
│ deleted_at      │       └──────────────────┘
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│ refresh_tokens  │       │ password_resets  │       │ login_attempts  │
├─────────────────┤       ├──────────────────┤       ├─────────────────┤
│ PK id (UUID)    │       │ PK id (UUID)     │       │ PK id (UUID)    │
│ FK user_id      │       │ FK user_id       │       │ email           │
│ token_hash      │       │ token_hash       │       │ ip_address      │
│ device_info     │       │ expires_at       │       │ success         │
│ expires_at      │       │ used_at          │       │ created_at      │
│ revoked_at      │       └──────────────────┘       └─────────────────┘
└─────────────────┘

┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│    products     │       │  product_images  │       │   categories    │
├─────────────────┤       ├──────────────────┤       ├─────────────────┤
│ PK id (UUID)    │◄──────┤ PK id (UUID)     │       │ PK id (UUID)    │
│ sku (UNIQUE)    │   1:N │ FK product_id    │       │ parent_id (FK)  │
│ name            │       │ url              │       │ name            │
│ price           │       │ alt_text         │       │ slug (UNIQUE)   │
│ stock_quantity  │       │ is_primary       │       │ description     │
│ status          │       │ sort_order       │       │ is_active       │
│ attributes(JSONB│       └──────────────────┘       └─────────────────┘
│ FK category_id  │◄─────────────────────────────────────┘
│ deleted_at      │
└────────┬────────┘
         │
         │ 1:N (en order_items)
         ▼
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│     orders      │◄──────┤   order_items    │       │    payments     │
├─────────────────┤   1:N ├──────────────────┤       ├─────────────────┤
│ PK id (UUID)    │       │ PK id (UUID)     │       │ PK id (UUID)    │
│ order_number    │       │ FK order_id      │       │ FK order_id     │
│ FK user_id      │──────►│ FK product_id    │       │ provider        │
│ status          │       │ product_name     │       │ provider_tx_id  │
│ payment_status  │       │ product_price    │       │ amount          │
│ shipping_addr   │       │ quantity         │       │ status          │
│ billing_addr    │       │ attributes(JSONB│       │ metadata(JSONB) │
│ subtotal        │       │ subtotal         │       └─────────────────┘
│ total           │       └──────────────────┘
│ currency        │
└─────────────────┘
```

### Convenciones de Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Tablas | snake_case, plural | `user_profiles`, `order_items` |
| Columnas | snake_case | `created_at`, `email_verified` |
| Claves primarias | `id` (UUID v4) | `550e8400-e29b-41d4-a716-446655440000` |
| Claves foráneas | `{tabla}_id` | `user_id`, `product_id` |
| Timestamps | `created_at`, `updated_at`, `deleted_at` | - |
| JSONB | Sufijo implícito por tipo | `attributes`, `preferences`, `metadata` |
| Índices | `idx_{tabla}_{columnas}` | `idx_users_email` |
| Constraints | `chk_{tabla}_{regla}` | `chk_products_price_positive` |

### Soft Delete (TypeORM Paranoid)

```typescript
// TODAS las entidades de usuario y producto implementan:
@Entity()
export class User {
  // ... campos

  @DeleteDateColumn({ type: 'timestamp' })
  deletedAt: Date | null;
}

// En el repositorio:
const user = await userRepo.findOne({ where: { id }, withDeleted: true });
await userRepo.softDelete(id);        // Marca deleted_at
await userRepo.restore(id);           // Restaura (dentro de 30 días)
await userRepo.find({ withDeleted: true }); // Incluye eliminados
```

---

## 🔐 Autenticación & Seguridad

### Flujo de Tokens (JWT + Refresh Rotation)

```
┌─────────┐                    ┌─────────────┐                    ┌─────────┐
│ Cliente │ ──(1) Login──────► │   Auth      │ ──(2) Validate──►│   DB    │
│         │                    │   Service   │                    │         │
│         │ ◄─(3) Access+Refresh│             │ ◄─────────────────│         │
└────┬────┘                    └─────────────┘                    └─────────┘
     │
     │ (4) Request con Access Token (Header: Authorization: Bearer <token>)
     ▼
┌─────────┐
│  API    │ ──(5) Verify JWT──► ┌─────────┐
│         │ ◄─(6) Payload──────│  JWT    │
│         │                    │ Service │
│         │ ──(7) Check Redis──►│         │ (blacklist/validación)
│         │ ◄─(8) OK/Revoked───│         │
└────┬────┘                    └─────────┘
     │
     │ (9) Access Token expirado (401)
     ▼
┌─────────┐                    ┌─────────────┐
│ Cliente │ ──(10) Refresh────►│   Auth      │ ──(11) Verify hash en DB
│         │    {refreshToken}   │   Service   │
│         │ ◄─(12) Nuevo Access+Refresh       │
│         │                    │ (13) Revocar token anterior) │
└─────────┘                    └─────────────┘
```

### Seguridad Implementada

| Capa | Implementación | Detalle |
|------|---------------|---------|
| **Passwords** | bcrypt (cost: 12) | Salt automático, nunca en texto plano |
| **JWT Access** | HS256, 15 minutos | Payload mínimo: `{sub, email, role}` |
| **JWT Refresh** | SHA-256 hash en DB | Rotación: 1 uso = 1 nuevo token |
| **2FA** | TOTP (RFC 6238) | Compatible con Google Authenticator, Authy |
| **Rate Limiting** | Redis sliding window | 5 intentos/login, 100 req/min por IP |
| **Brute Force** | `login_attempts` table | Bloqueo progresivo, alerta admin |
| **Headers** | Helmet.js | CSP, HSTS, X-Frame-Options, Referrer-Policy |
| **CORS** | Whitelist dinámica | Configurable por entorno |
| **Input** | class-validator | Sanitización XSS, SQL injection prevention |
| **Audit** | `updated_at` + triggers | Registro de cambios en datos sensibles |
| **GDPR** | Anonimización en delete | `deleted_{uuid}@anonymized.local` |

### Roles y Permisos (RBAC + ABAC)

```typescript
// Roles predefinidos
enum UserRole {
  CUSTOMER = 'customer',    // Comprador estándar
  SELLER = 'seller',        // Vendedor (marketplace)
  ADMIN = 'admin',          // Administrador
  SUPER_ADMIN = 'super_admin', // Acceso total
}

// Permisos granulares (ABAC)
enum Permission {
  USERS_READ = 'users:read',
  USERS_READ_ALL = 'users:read_all',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  PRODUCTS_CREATE = 'products:create',
  PRODUCTS_UPDATE = 'products:update',
  PRODUCTS_DELETE = 'products:delete',
  ORDERS_READ = 'orders:read',
  ORDERS_READ_ALL = 'orders:read_all',
  ORDERS_UPDATE_STATUS = 'orders:update_status',
  PAYMENTS_REFUND = 'payments:refund',
  ANALYTICS_READ = 'analytics:read',
}
```

---

## 🧩 Módulos del Sistema

### Auth Module

```typescript
// Endpoints principales
POST   /api/v1/auth/register          # Registro con email
POST   /api/v1/auth/login             # Login + 2FA si aplica
POST   /api/v1/auth/refresh           # Rotación de refresh token
POST   /api/v1/auth/logout            # Revocar tokens
POST   /api/v1/auth/logout-all        # Revocar TODOS los tokens
POST   /api/v1/auth/2fa/enable        # Activar 2FA (QR code)
POST   /api/v1/auth/2fa/verify        # Verificar código TOTP
POST   /api/v1/auth/forgot-password   # Solicitar reset
POST   /api/v1/auth/reset-password    # Confirmar reset
GET    /api/v1/auth/me                # Perfil actual (JWT)
```

### Users Module

```typescript
// Endpoints
GET    /api/v1/users/profile          # Obtener perfil
PATCH  /api/v1/users/profile          # Actualizar perfil
POST   /api/v1/users/addresses        # Crear dirección
PATCH  /api/v1/users/addresses/:id    # Actualizar dirección
DELETE /api/v1/users/addresses/:id    # Eliminar dirección
DELETE /api/v1/users/account          # Solicitar eliminación (GDPR)
POST   /api/v1/users/account/restore  # Restaurar (30 días)

// Admin only
GET    /api/v1/users                  # Listar usuarios (paginado)
GET    /api/v1/users/:id              # Detalle usuario
PATCH  /api/v1/users/:id/status       # Suspender/activar
```

### Products Module

```typescript
// Endpoints públicos
GET    /api/v1/products               # Listar (filtros, paginación)
GET    /api/v1/products/:slug         # Detalle por slug
GET    /api/v1/categories             # Árbol de categorías
GET    /api/v1/products/search        # Full-text search (PostgreSQL)

// Admin / Seller
POST   /api/v1/products               # Crear producto
PATCH  /api/v1/products/:id           # Actualizar
DELETE /api/v1/products/:id           # Soft delete
POST   /api/v1/products/:id/images    # Subir imágenes
DELETE /api/v1/products/:id/images/:imageId
```

### Orders Module

```typescript
// Endpoints
POST   /api/v1/cart/items              # Agregar al carrito
GET    /api/v1/cart                    # Ver carrito
DELETE /api/v1/cart/items/:id          # Quitar del carrito
POST   /api/v1/orders                  # Crear orden (checkout)
GET    /api/v1/orders                  # Mis órdenes
GET    /api/v1/orders/:id             # Detalle orden
POST   /api/v1/orders/:id/cancel       # Cancelar (si pending)

// Webhooks (Stripe)
POST   /api/v1/webhooks/stripe         # Escuchar eventos de pago
```

### Media Module

```typescript
// Endpoints
POST   /api/v1/media/upload            # Subir imagen (multipart/form-data)
DELETE /api/v1/media/:key              # Eliminar imagen
GET    /api/v1/media/:key/signed-url   # URL firmada temporal

// Procesamiento automático:
// - Resize: 1200x1200 max
// - Format: WebP (calidad 85%)
// - Metadata: strip EXIF
// - CDN: CloudFront invalidation
```

---

## ⚙️ Instalación

### Requisitos Previos

- [Node.js](https://nodejs.org/) >= 20 LTS
- [PostgreSQL](https://postgresql.org/) >= 15
- [Redis](https://redis.io/) >= 7
- [Docker](https://docker.com/) (opcional, recomendado)

### Opción 1: Docker Compose (Recomendado)

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-org/ecommerce-api.git
cd ecommerce-api

# 2. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Levantar infraestructura
docker-compose up -d postgres redis

# 4. Instalar dependencias
npm install

# 5. Ejecutar migraciones
npm run migration:run

# 6. Cargar datos de prueba (opcional)
npm run seed

# 7. Iniciar en modo desarrollo
npm run start:dev
```

### Opción 2: Instalación Manual

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar base de datos
# Crear base de datos PostgreSQL:
# CREATE DATABASE ecommerce_dev;
# CREATE USER ecommerce WITH PASSWORD 'password';
# GRANT ALL PRIVILEGES ON DATABASE ecommerce_dev TO ecommerce;

# 3. Configurar Redis (por defecto en localhost:6379)

# 4. Variables de entorno
cp .env.example .env.development
# Editar .env.development

# 5. Migraciones
npm run typeorm:run-migrations

# 6. Desarrollo
npm run start:dev
```

---

## 🔑 Variables de Entorno

### `.env.example`

```env
# ============================================
# APP
# ============================================
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1
API_VERSION=1

# ============================================
# DATABASE (PostgreSQL)
# ============================================
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=ecommerce
DB_PASSWORD=change_me_in_production
DB_NAME=ecommerce_dev
DB_SSL=false
DB_SYNCHRONIZE=false
DB_LOGGING=true

# ============================================
# REDIS
# ============================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ============================================
# JWT SECURITY
# ============================================
JWT_ACCESS_SECRET=super_secret_access_key_min_32_chars
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=super_secret_refresh_key_min_32_chars
JWT_REFRESH_EXPIRATION=7d

# ============================================
# BCRYPT
# ============================================
BCRYPT_ROUNDS=12

# ============================================
# AWS S3 / CDN
# ============================================
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=ecommerce-media-prod
S3_ENDPOINT=s3.amazonaws.com
CDN_DOMAIN=cdn.tu-ecommerce.com
S3_FORCE_PATH_STYLE=false

# ============================================
# STRIPE
# ============================================
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=usd

# ============================================
# EMAIL (SendGrid)
# ============================================
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=noreply@tu-ecommerce.com
EMAIL_FROM_NAME=Tu E-Commerce

# ============================================
# RATE LIMITING
# ============================================
THROTTLE_TTL=60
THROTTLE_LIMIT=100
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=30

# ============================================
# FEATURE FLAGS
# ============================================
FEATURE_2FA=true
FEATURE_SOCIAL_LOGIN=false
FEATURE_MARKETPLACE=false
```

---

## 🛠️ Comandos Útiles

```bash
# Desarrollo
npm run start:dev          # Watch mode con hot reload
npm run start:debug        # Debug con inspector
npm run start:prod         # Build + run producción

# Build
npm run build              # Compilar TypeScript
npm run build:prod         # Optimizado para producción

# Testing
npm run test               # Unit tests (Jest)
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # End-to-end tests

# Database (TypeORM CLI)
npm run migration:generate -- -n CreateUsersTable
npm run migration:run
npm run migration:revert
npm run schema:drop        # ⚠️ Elimina TODO (dev only)
npm run seed               # Cargar datos de prueba

# Lint & Format
npm run lint               # ESLint
npm run lint:fix             # ESLint auto-fix
npm run format             # Prettier

# Docker
npm run docker:up          # Levantar servicios
npm run docker:down        # Detener servicios
npm run docker:logs        # Ver logs
```

---

## 📐 Convenciones de Código

### Principios SOLID aplicados

| Principio | Aplicación en NestJS |
|-----------|---------------------|
| **S**ingle Responsibility | Un módulo = un dominio de negocio |
| **O**pen/Closed | Extensión via decorators, no modificación |
| **L**iskov Substitution | Repositories implementan interfaces comunes |
| **I**nterface Segregation | DTOs pequeños, específicos por endpoint |
| **D**ependency Inversion | Inyección de dependencias en constructores |

### Estilo de Código

```typescript
// ✅ Nomenclatura
// Clases: PascalCase
export class UserService { }
// Interfaces: PascalCase con prefijo descriptivo
export interface IUserRepository { }
// Variables/funciones: camelCase
const userProfile = await this.getProfile(userId);
// Constantes: UPPER_SNAKE_CASE
const MAX_LOGIN_ATTEMPTS = 5;
// Enums: PascalCase, miembros UPPER_SNAKE_CASE
enum OrderStatus { PENDING = 'pending', PAID = 'paid' }

// ✅ Inyección de dependencias
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly paymentService: PaymentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
}

// ✅ Manejo de errores
// Nunca devolver stack traces al cliente
throw new NotFoundException(`Product with id ${id} not found`);
throw new ConflictException('Email already registered');
throw new ForbiddenException('Insufficient permissions');

// ✅ Transacciones
await this.dataSource.transaction(async (manager) => {
  await manager.save(order);
  await manager.decrement(Product, { id: productId }, 'stock', quantity);
});

// ✅ Logging estructurado
this.logger.log(`Order ${orderId} created by user ${userId}`);
this.logger.error(`Payment failed for order ${orderId}`, error.stack);
```

### API Response Standard

```typescript
// Éxito (200-299)
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}

// Error (400-599)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Must be a valid email" }
    ]
  }
}
```

---

## 🗺️ Roadmap

### Fase 1: MVP (Actual)
- [x] Autenticación JWT + Refresh tokens
- [x] CRUD Usuarios con GDPR
- [x] Catálogo de productos
- [x] Carrito y checkout básico
- [x] Integración Stripe
- [x] Upload de imágenes a S3
- [x] Notificaciones por email

### Fase 2: Escalabilidad
- [ ] Microservicios (Auth, Products, Orders separados)
- [ ] Event-driven architecture (Kafka/RabbitMQ)
- [ ] GraphQL API (Apollo Federation)
- [ ] Elasticsearch para búsqueda avanzada
- [ ] Cache distribuida (Redis Cluster)
- [ ] CDN global con invalidación automática

### Fase 3: Enterprise
- [ ] Multi-tenancy (SaaS para sellers)
- [ ] Analytics dashboard (real-time)
- [ ] Machine Learning (recommendations)
- [ ] Blockchain (certificados de autenticidad)
- [ ] Compliance SOC2 / ISO 27001

---

## 📚 Documentación Adicional

- [API Versioning Strategy](./docs/api-versioning.md)
- [Deployment Guide (AWS/GCP/Azure)](./docs/deployment.md)
- [Security Checklist](./docs/security-checklist.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)

---

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commits con [Conventional Commits](https://conventionalcommits.org):
   - `feat: add two-factor authentication`
   - `fix: resolve race condition in inventory`
   - `docs: update API examples`
   - `refactor: optimize product queries`
4. Push y crea un Pull Request

---

## 📄 Licencia

[MIT](./LICENSE) © 2026 Tu E-Commerce Team

---

> 💡 **Tip**: Para configurar este proyecto en VS Code con Cursor Agent, asegúrate de tener instaladas las extensiones:
> - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
> - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
> - [NestJS Snippets](https://marketplace.visualstudio.com/items?itemName=ashinzekene.nestjs)
> - [Thunder Client](https://marketplace.visualstudio.com/items?itemName=rangav.vscode-thunder-client) (para probar APIs)
> - [Database Client](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-database-client2) (para PostgreSQL)
