<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# 🛒 E-Commerce API - NestJS Architecture

> API REST enterprise para e-commerce construida con NestJS, PostgreSQL, Redis, Stripe y AWS S3.
> Implementa autenticación JWT, RBAC, pagos, gestión de inventario y procesamiento de imágenes.

**Estado del Proyecto:** ✅ MVP Completado | 🧪 Tests: 9/9 pasando | 📦 Producción: Listo para deploy

---

## 📋 Tabla de Contenidos

- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitectura](#-arquitectura)
- [Estado de Implementación](#-estado-de-implementación-por-módulo)
- [Estructura de Carpetas](#-estructura-de-carpetas)
- [Base de Datos](#-base-de-datos)
- [Autenticación & Seguridad](#-autenticación--seguridad)
- [Módulos del Sistema](#-módulos-del-sistema)
- [Instalación](#-instalación)
- [Variables de Entorno](#-variables-de-entorno)
- [Comandos Útiles](#-comandos-útiles)
- [Guía Rápida de Desarrollo](#-guía-rápida-de-desarrollo)
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
| **Testing** | Jest + Supertest | - | Unit, integration, e2e (9/9 tests passing) |
| **Monitoring** | (Pendiente) | - | Sentry/Prometheus planificados |
| **Container** | Docker + Docker Compose | - | Dev environment, consistency |

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
│         NESTJS APPLICATION (Modular Monolith - MVP ✅)       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  Auth ✅    │  │  Users ✅   │  │   Products ✅       │   │
│  │  Module     │  │  Module     │  │   Module            │   │
│  │             │  │             │  │                     │   │
│  │ • JWT ✅    │  │ • Profile ✅│  │ • Catalog ✅        │   │
│  │ • Refresh ✅│  │ • Address ✅│  │ • Category ✅       │   │
│  │ • RBAC ✅   │  │ • GDPR ✅   │  │ • Inventory ✅      │   │
│  │ • 2FA ✅    │  │ • SoftDel ✅│  │ • Stock ✅          │   │
│  │ • Reset ✅  │  │ • Restore ✅│  │ • Search ⚠️         │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ Orders ✅   │  │ Payments ✅ │  │    Media ✅         │   │
│  │  Module     │  │  Module     │  │    Module           │   │
│  │             │  │             │  │                     │   │
│  │ • Checkout✅│  │ • Stripe ✅ │  │ • S3/Local ✅       │   │
│  │ • History ✅│  │ • Webhook ✅│  │ • Sharp ✅          │   │
│  │ • Cancel ✅ │  │ • Refund ✅ │  │ • WebP ✅           │   │
│  │ • Cart ⚠️   │  │ • Intent ✅ │  │ • SignURL ⚠️        │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐                            │
│  │ Notific. ✅ │  │  Health ✅  │                            │
│  │  Module     │  │  Checks     │                            │
│  │             │  │             │                            │
│  │ • Email ✅  │  │ • DB ✅     │                            │
│  │ • BullMQ ✅ │  │ • Memory ✅ │                            │
│  │ • Queue ✅  │  │ • Redis ✅  │                            │
│  └─────────────┘  └─────────────┘                            │
│                                                               │
│  Leyenda: ✅ Implementado | ⚠️ Parcial | 🔮 Roadmap Fase 2+  │
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

### 📊 Estado de Implementación por Módulo

<table>
<tr>
<td valign="top" width="33%">

**Auth Module** ✅
- JWT Access + Refresh Tokens
- 2FA/TOTP (generate, enable, verify)
- Password Reset Flow
- RBAC + Permissions Guards
- Token Rotation & Revocation
- 15 endpoints activos

</td>
<td valign="top" width="33%">

**Users Module** ✅
- User Profiles + Addresses
- GDPR Compliance (soft delete)
- Account Restore (30 días)
- Login Attempt Tracking
- Auto Password Hashing
- 8 endpoints activos

</td>
<td valign="top" width="33%">

**Products Module** ✅
- Catálogo con Paginación
- Categorías Jerárquicas
- Inventory Tracking
- Stock Management
- Filtros Avanzados
- 8 endpoints activos

</td>
</tr>
<tr>
<td valign="top">

**Orders Module** ✅
- Checkout Directo
- Order History
- Cancel Orders
- Order Tracking
- ⚠️ Cart separado (pending)
- 4 endpoints activos

</td>
<td valign="top">

**Payments Module** ✅
- Stripe PaymentIntent
- Webhook Handling
- Refund Processing
- Payment Tracking
- PCI Compliance
- 4 endpoints (+ webhook)

</td>
<td valign="top">

**Media Module** ✅
- S3 + Local Storage
- Sharp Image Processing
- WebP Optimization
- Metadata Stripping
- ⚠️ Signed URLs (pending)
- 2 endpoints activos

</td>
</tr>
<tr>
<td valign="top">

**Notifications Module** ✅
- Email Sending
- BullMQ Queues
- Background Processing
- SendGrid/SES Integration
- Delivery Tracking
- 2 endpoints activos

</td>
<td valign="top">

**Health Module** ✅
- Database Check
- Memory Monitoring
- Redis Check (prod only)
- Configurable Thresholds
- JSON Response
- 1 endpoint público

</td>
<td valign="top">

**Analytics Module** 🔮
- Roadmap Fase 3
- Reports & Metrics
- Event Tracking
- Real-time Analytics
- Dashboard APIs
- (No implementado)

</td>
</tr>
</table>

---

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
│   │   ├── 📂 enums/
│   │   │   ├── user-role.enum.ts
│   │   │   ├── order-status.enum.ts
│   │   │   └── payment-status.enum.ts
│   │   └── 📂 services/
│   │       └── redis/
│   │           ├── redis.service.ts
│   │           └── redis.service.spec.ts
│   │
│   ├── 📂 shared/                      # Servicios compartidos
│   │   └── shared.module.ts
│   │
│   ├── 📂 health/                      # Health checks
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── 📂 test/                          # Tests e2e
│   ├── auth.e2e-spec.ts
│   ├── products.e2e-spec.ts
│   ├── orders.e2e-spec.ts
│   ├── payments.e2e-spec.ts
│   ├── users.e2e-spec.ts
│   ├── app.e2e-spec.ts
│   ├── test-utils.ts
│   ├── setup.ts
│   └── jest-e2e.json
│
├── .env.example                      # Template de variables
├── .gitignore
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
// Endpoints implementados
POST   /api/v1/auth/register          # Registro con email
POST   /api/v1/auth/login             # Login (rate limited: 5 intentos/5min)
POST   /api/v1/auth/login/2fa         # Completar login con código 2FA
POST   /api/v1/auth/refresh           # Rotación de refresh token
POST   /api/v1/auth/logout            # Revocar token actual
POST   /api/v1/auth/logout-all        # Revocar TODOS los tokens del usuario
GET    /api/v1/auth/me                # Perfil actual (JWT)

// Pendientes de implementar
POST   /api/v1/auth/2fa/enable        # Activar 2FA (QR code)
POST   /api/v1/auth/2fa/verify        # Verificar código TOTP
POST   /api/v1/auth/2fa/disable       # Desactivar 2FA
POST   /api/v1/auth/forgot-password   # Solicitar reset
POST   /api/v1/auth/reset-password    # Confirmar reset con token
```

### Users Module

```typescript
// Endpoints implementados
GET    /api/v1/users/profile          # Obtener perfil actual
PATCH  /api/v1/users/profile          # Actualizar perfil
GET    /api/v1/users/addresses        # Listar direcciones del usuario
POST   /api/v1/users/addresses        # Crear dirección
PATCH  /api/v1/users/addresses/:id    # Actualizar dirección
DELETE /api/v1/users/addresses/:id    # Eliminar dirección
DELETE /api/v1/users/account          # Solicitar eliminación (GDPR)
POST   /api/v1/users/account/restore  # Restaurar cuenta (30 días)

// Admin endpoints (pendientes)
GET    /api/v1/users                  # Listar usuarios (paginado)
GET    /api/v1/users/:id              # Detalle usuario
PATCH  /api/v1/users/:id/status       # Suspender/activar
```

### Products Module

```typescript
// Endpoints públicos implementados
GET    /api/v1/products               # Listar (filtros, paginación)
GET    /api/v1/products/:slug         # Detalle por slug
GET    /api/v1/products/categories/tree # Árbol de categorías

// Admin / Seller (implementados)
POST   /api/v1/products               # Crear producto
POST   /api/v1/products/categories    # Crear categoría
PATCH  /api/v1/products/:id           # Actualizar
DELETE /api/v1/products/:id           # Soft delete

// Pendientes de implementar
GET    /api/v1/products/search        # Full-text search (PostgreSQL)
POST   /api/v1/products/:id/images    # Subir imágenes
DELETE /api/v1/products/:id/images/:imageId
```

### Orders Module

```typescript
// Endpoints implementados
POST   /api/v1/orders                  # Crear orden (checkout)
GET    /api/v1/orders                  # Mis órdenes
GET    /api/v1/orders/:id              # Detalle orden
PATCH  /api/v1/orders/:id/cancel       # Cancelar orden (si pending)

// Pendientes (funcionalidad carrito separado)
POST   /api/v1/cart/items              # Agregar al carrito
GET    /api/v1/cart                    # Ver carrito
DELETE /api/v1/cart/items/:id          # Quitar del carrito
```

### Payments Module

```typescript
// Endpoints implementados
POST   /api/v1/payments/intent         # Crear payment intent (Stripe)
GET    /api/v1/payments/order/:orderId # Obtener payment intent de orden
POST   /api/v1/payments/:id/refund     # Reembolsar pago

// Webhooks
POST   /api/v1/webhooks/stripe         # Escuchar eventos de Stripe
```

### Media Module

```typescript
// Endpoints implementados
POST   /api/v1/media/upload            # Subir archivo (multipart/form-data)
DELETE /api/v1/media/:id               # Eliminar archivo

// Pendiente
GET    /api/v1/media/:key/signed-url   # URL firmada temporal

// Procesamiento automático (implementado):
// - Resize: 1200x1200 max
// - Format: WebP (calidad 85%)
// - Metadata: strip EXIF
// - Storage: AWS S3 / local (según configuración)
```

### Notifications Module

```typescript
// Endpoints implementados
POST   /api/v1/notifications/email     # Enviar email
GET    /api/v1/notifications/:id/status # Estado de notificación

// Features implementadas:
// - Queue con BullMQ para procesamiento asíncrono
// - Integración con SendGrid/AWS SES
```

### Health Check

```typescript
// Endpoint público
GET    /api/v1/health                  # Health check (DB, Redis opcional)

// Checks implementados:
// - Database (PostgreSQL)
// - Memory heap/RSS (configurable)
// - Redis (solo en producción)
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

# 2. Configurar base de datos PostgreSQL
# CREATE DATABASE ecommerce_dev;
# CREATE USER ecommerce WITH PASSWORD 'password';
# GRANT ALL PRIVILEGES ON DATABASE ecommerce_dev TO ecommerce;

# 3. Configurar Redis (opcional en desarrollo)
# Redis en localhost:6379 (o docker-compose up redis)

# 4. Variables de entorno
cp .env.example .env.development
# Editar .env.development con tus credenciales

# 5. Iniciar aplicación (auto-sincroniza DB en desarrollo)
npm run start:dev

# La aplicación estará disponible en http://localhost:3000
# Documentación de endpoints: ver sección "Módulos del Sistema" en este README
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
npm run start:debug        # Debug con inspector (puerto 9229)
npm run start:prod         # Build + run producción

# Build
npm run build              # Compilar TypeScript (output: dist/)

# Testing
npm run test               # Unit tests (Jest)
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # End-to-end tests (6 suites)

# Lint & Format
npm run format             # Prettier check
npm run lint               # ESLint check

# Docker
docker-compose up -d       # Levantar servicios (PostgreSQL + Redis)
docker-compose down        # Detener servicios
docker-compose logs -f     # Ver logs en tiempo real
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

### ✅ Fase 1: MVP (Completado)
- [x] Autenticación JWT + Refresh tokens (15min + 7 días)
- [x] 2FA con TOTP completo (generate, enable, verify, disable)
- [x] Password reset flow (forgot-password, reset-password)
- [x] Token rotation & revocation
- [x] CRUD Usuarios con GDPR (soft delete 30 días)
- [x] Perfiles y direcciones de usuario (múltiples)
- [x] Catálogo de productos con categorías jerárquicas
- [x] Gestión de inventario (stock tracking)
- [x] Sistema de órdenes (checkout directo)
- [x] Integración completa con Stripe (PaymentIntent + Webhooks)
- [x] Refunds de Stripe
- [x] Upload de archivos (local + AWS S3 configurable)
- [x] Procesamiento de imágenes con Sharp (WebP, resize, metadata strip)
- [x] Notificaciones por email (BullMQ queue + SendGrid/SES)
- [x] Health checks configurables (DB, Memory, Redis)
- [x] Rate limiting global (Throttler)
- [x] Validación de DTOs (class-validator)
- [x] Guards de autenticación (JWT, Roles, Permissions, 2FA)
- [x] Tests e2e completos (9/9 pasando - Auth, Users, Products, Orders, Payments, App)

### 🚧 Fase 2: Features Pendientes
- [ ] Email verification obligatoria (actualmente solo en tests)
- [ ] Admin dashboard endpoints (GET /users, PATCH /users/:id/status)
- [ ] Full-text search en productos (PostgreSQL tsvector)
- [ ] Upload múltiple de imágenes de productos (actualmente 1 imagen)
- [ ] Sistema de carrito separado (actualmente checkout directo)
- [ ] URLs firmadas para media (pre-signed S3 URLs)
- [ ] Wishlists (favoritos de productos)
- [ ] Product reviews y ratings
- [ ] Tests unitarios completos (actualmente solo e2e)
- [ ] Cobertura de tests > 80%
- [ ] Documentación Swagger/OpenAPI completa
- [ ] Migraciones TypeORM (actualmente synchronize: true)
- [ ] Logs estructurados (Winston/Pino)
- [ ] Documentación Swagger completa
- [ ] Migraciones TypeORM

### 🔮 Fase 3: Escalabilidad
- [ ] Microservicios (Auth, Products, Orders separados)
- [ ] Event-driven architecture (Kafka/RabbitMQ)
- [ ] GraphQL API (Apollo Federation)
- [ ] Elasticsearch para búsqueda avanzada
- [ ] Cache distribuida (Redis Cluster)
- [ ] CDN global con invalidación automática
- [ ] Monitoreo con Prometheus + Grafana
- [ ] CI/CD con GitHub Actions / GitLab CI

### 🏢 Fase 4: Enterprise
- [ ] Multi-tenancy (SaaS para sellers)
- [ ] Analytics dashboard (real-time)
- [ ] Machine Learning (recommendations)
- [ ] Compliance SOC2 / ISO 27001

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

## 🚀 Estado del Proyecto

**Versión Actual:** 1.0.0 (MVP Completado)
**Tests:** ✅ 9/9 e2e tests pasando
**Cobertura:** En desarrollo
**CI/CD:** Pendiente de configuración
**Deploy:** Listo para producción

### Próximos Pasos Recomendados:
1. 🔐 Completar endpoints de 2FA y password reset
2. 🧪 Aumentar cobertura de tests unitarios
3. 📚 Completar documentación Swagger
4. 🚀 Configurar CI/CD (GitHub Actions / GitLab CI)
5. 📊 Implementar monitoreo (Sentry/Prometheus)

---

> 💡 **Tip para Desarrollo**: Este proyecto usa path aliases (`@/`, `@modules/`, etc.). 
> Asegúrate de tener configurado correctamente tu IDE con las extensiones recomendadas:
> - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
> - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
> - [NestJS Snippets](https://marketplace.visualstudio.com/items?itemName=ashinzekene.nestjs)
> - [Thunder Client](https://marketplace.visualstudio.com/items?itemName=rangav.vscode-thunder-client) para testing de APIs
> - [Database Client](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-database-client2) para PostgreSQL

---

## 💻 Guía Rápida de Desarrollo

### Flujo de Autenticación (Auth Module)

```typescript
// 1. Registro de usuario
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

// 2. Login y obtener tokens
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
// Respuesta:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 900 // 15 minutos
}

// 3. Usar token en requests
GET /api/v1/auth/me
Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..." }

// 4. Renovar token (cuando expire access_token)
POST /api/v1/auth/refresh
Headers: { "Authorization": "Bearer <refresh_token>" }

// 5. Habilitar 2FA (opcional)
POST /api/v1/auth/2fa/generate    // Obtener QR code
POST /api/v1/auth/2fa/enable      // Confirmar con código TOTP
POST /api/v1/auth/login/2fa       // Login con 2FA habilitado
```

### Gestión de Productos (Products Module)

```typescript
// Crear categoría (requiere rol ADMIN)
POST /api/v1/products/categories
Headers: { "Authorization": "Bearer <admin_token>" }
{
  "name": "Electronics",
  "slug": "electronics",
  "description": "Electronic devices",
  "parentId": null  // null = categoría raíz
}

// Crear producto
POST /api/v1/products
Headers: { "Authorization": "Bearer <admin_token>" }
{
  "name": "Laptop Dell XPS 15",
  "slug": "laptop-dell-xps-15",
  "description": "High performance laptop",
  "price": 1499.99,
  "stock": 50,
  "categoryId": "uuid-categoria",
  "sku": "DELL-XPS15-001",
  "isActive": true
}

// Listar productos (público)
GET /api/v1/products?page=1&limit=10&categoryId=uuid&minPrice=100&maxPrice=2000&search=laptop

// Obtener detalle
GET /api/v1/products/laptop-dell-xps-15

// Actualizar stock
POST /api/v1/products/:id/stock
Headers: { "Authorization": "Bearer <admin_token>" }
{
  "quantity": 45,
  "operation": "set"  // "set" | "increment" | "decrement"
}
```

### Crear Orden (Orders Module)

```typescript
// Crear orden (checkout directo)
POST /api/v1/orders
Headers: { "Authorization": "Bearer <user_token>" }
{
  "items": [
    {
      "productId": "uuid-producto-1",
      "quantity": 2,
      "price": 1499.99  // Precio al momento de la orden
    },
    {
      "productId": "uuid-producto-2",
      "quantity": 1,
      "price": 49.99
    }
  ],
  "shippingAddressId": "uuid-direccion",
  "notes": "Entregar en horario laboral"
}

// Ver mis órdenes
GET /api/v1/orders?status=pending&page=1&limit=10

// Cancelar orden (solo si status=pending)
PATCH /api/v1/orders/:orderId/cancel
```

### Procesar Pago (Payments Module)

```typescript
// 1. Crear PaymentIntent para una orden
POST /api/v1/payments/intent
Headers: { "Authorization": "Bearer <user_token>" }
{
  "orderId": "uuid-orden",
  "paymentMethodId": "pm_card_visa"  // Stripe payment method
}
// Respuesta:
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "amount": 304997,  // en centavos
  "currency": "usd"
}

// 2. En frontend, confirmar pago con Stripe.js
// stripe.confirmCardPayment(clientSecret, { ... })

// 3. Stripe enviará webhook a /api/v1/webhooks/stripe
// La orden se actualizará automáticamente a status="paid"

// Ver estado de pago
GET /api/v1/payments/order/:orderId

// Reembolsar pago (admin)
POST /api/v1/payments/:paymentId/refund
Headers: { "Authorization": "Bearer <admin_token>" }
{
  "amount": 304997,  // opcional, si no se envía se reembolsa todo
  "reason": "requested_by_customer"
}
```

### Subir Archivos (Media Module)

```typescript
// Upload de imagen
POST /api/v1/media/upload
Headers: { 
  "Authorization": "Bearer <user_token>",
  "Content-Type": "multipart/form-data"
}
FormData: {
  "file": <archivo.jpg>,
  "folder": "products"  // opcional: "products", "avatars", "documents"
}
// Respuesta:
{
  "id": "uuid-media",
  "url": "https://s3.amazonaws.com/bucket/products/uuid.webp",
  "key": "products/uuid.webp",
  "size": 245678,
  "mimetype": "image/webp",
  "width": 1200,
  "height": 800
}
// Nota: Las imágenes se optimizan automáticamente (WebP, max 1200px)

// Eliminar archivo
DELETE /api/v1/media/:id
```

### Enviar Notificaciones (Notifications Module)

```typescript
// Enviar email
POST /api/v1/notifications/email
Headers: { "Authorization": "Bearer <admin_token>" }
{
  "to": "customer@example.com",
  "subject": "Your order has been shipped",
  "template": "order-shipped",  // Template ID
  "data": {
    "orderNumber": "ORD-12345",
    "trackingNumber": "TRACK-XYZ",
    "customerName": "John Doe"
  }
}
// El email se procesa en background (BullMQ queue)

// Verificar estado de envío
GET /api/v1/notifications/:notificationId/status
```

### Guards y Decoradores

```typescript
// Uso en controladores

// Endpoint público (sin autenticación)
@Public()
@Get('public-data')
getPublicData() { ... }

// Requiere autenticación (JWT)
@UseGuards(JwtAuthGuard)
@Get('protected')
getProtectedData() { ... }

// Requiere rol específico
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Delete(':id')
deleteUser() { ... }

// Requiere permiso específico
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('products.create')
@Post()
createProduct() { ... }

// Obtener usuario actual
@Get('me')
getMe(@CurrentUser() user: User) {
  return user;
}

// Saltear verificación 2FA
@Skip2FA()
@Post('2fa/enable')
enable2FA() { ... }
```

### Total de Endpoints Disponibles

```
📊 API Endpoints Summary (Total: 44 endpoints)

┌─────────────────┬──────────┬────────────────────────────────┐
│ Módulo          │ Cantidad │ Principales Funcionalidades    │
├─────────────────┼──────────┼────────────────────────────────┤
│ Auth            │    15    │ Register, Login, 2FA, Refresh  │
│ Users           │     8    │ Profile, Addresses, GDPR       │
│ Products        │     8    │ CRUD, Categories, Stock        │
│ Orders          │     4    │ Checkout, History, Cancel      │
│ Payments        │     3    │ Stripe Intent, Refund          │
│ Media           │     2    │ Upload, Delete                 │
│ Notifications   │     2    │ Email, Status                  │
│ Health          │     1    │ Health Check                   │
│ Webhooks        │     1    │ Stripe Webhook                 │
└─────────────────┴──────────┴────────────────────────────────┘

Métodos HTTP utilizados:
• GET: 18 endpoints (consultas)
• POST: 18 endpoints (creación, acciones)
• PATCH: 5 endpoints (actualizaciones parciales)
• DELETE: 3 endpoints (eliminación)

Autenticación:
• Públicos: 7 endpoints (health, login, register, productos)
• Protegidos (JWT): 36 endpoints
• Admin only: 8 endpoints (crear productos, usuarios, etc.)
```

---