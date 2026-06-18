# 🛡️ Guía: Roles, Seguridad y Administración de Productos en Angular (v17+)

Esta guía explica detalladamente cómo está implementado el control de accesos y roles en tu backend NestJS y cómo debes consumirlo, gestionarlo y validarlo en tu frontend de Angular.

---

## 1. El Sistema de Roles en el Backend (NestJS)

El backend define cuatro roles principales para los usuarios:
*   `customer`: Cliente final (rol por defecto). Solo puede ver productos, gestionar su propio carrito, crear pedidos y realizar pagos.
*   `seller`: Vendedor. Puede ver productos, crear nuevos productos, editar productos que posee y gestionar su stock.
*   `admin`: Administrador de la plataforma. Tiene control total para gestionar cualquier producto, categoría, ver todas las órdenes de la tienda y gestionar usuarios.
*   `developer`: Desarrollador. Acceso a herramientas internas de desarrollo y gestión de productos.

### Cómo protege el Backend los Endpoints
En NestJS, las rutas que requieren roles específicos están protegidas con el decorador `@Roles()` y los guards correspondientes:

```typescript
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SELLER, UserRole.DEVELOPER)
async create(@Body() dto: CreateProductDto) { ... }
```

Si un token JWT no pertenece a un usuario con alguno de los roles indicados en `@Roles`, el backend denegará la petición inmediatamente devolviendo un error **`403 Forbidden`**.

---

## 2. Endpoints Administrativos de la API (`/products`)

Todos los endpoints administrativos requieren enviar el token JWT en las cabeceras HTTP:
`Authorization: Bearer <access_token>`

### A. Crear Producto (`POST /products`)
*   **Roles Permitidos:** `admin`, `seller`, `developer`
*   **Cuerpo (Request Body):**
    ```json
    {
      "sku": "SKU-PROD-999",
      "name": "Teclado Mecánico RGB",
      "slug": "teclado-mecanico-rgb",
      "description": "Teclado mecánico gamer con switches red y retroiluminación RGB.",
      "price": 89.99,
      "comparePrice": 109.99, // Opcional (precio anterior tachado)
      "stockQuantity": 50,
      "categoryId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", // ID de categoría existente
      "status": "active" // draft, active, archived
    }
    ```
*   **Respuesta (201 Created):** Retorna el objeto del producto creado con su UUID asignado.

### B. Editar Producto (`PATCH /products/:id`)
*   **Roles Permitidos:** `admin`, `seller`
*   **Parámetro URL:** `:id` es el UUID del producto.
*   **Cuerpo (Request Body):** Se pueden enviar solo los campos que se deseen actualizar.
    ```json
    {
      "price": 79.99,
      "stockQuantity": 45
    }
    ```
*   **Respuesta (200 OK):** Retorna el objeto del producto actualizado.

### C. Eliminar Producto (`DELETE /products/:id`)
*   **Roles Permitidos:** `admin` (Únicamente administradores)
*   **Parámetro URL:** `:id` es el UUID del producto.
*   **Respuesta (200 OK):** Realiza un borrado lógico (*soft delete*) estableciendo la fecha en la columna `deletedAt`.
    ```json
    {
      "message": "Product deleted successfully"
    }
    ```

### D. Actualizar Stock Rápido (`POST /products/:id/stock`)
*   **Roles Permitidos:** `admin`, `seller`
*   **Parámetro URL:** `:id` es el UUID del producto.
*   **Cuerpo (Request Body):**
    ```json
    {
      "quantity": 100
    }
    ```
*   **Respuesta (200 OK):** Objeto del producto con el stock actualizado.

### E. Crear Nueva Categoría (`POST /products/categories`)
*   **Roles Permitidos:** `admin`
*   **Cuerpo (Request Body):**
    ```json
    {
      "name": "Accesorios Gamer",
      "slug": "accesorios-gamer",
      "description": "Mousepads, audífonos y soportes para tu setup.",
      "parentId": null // Opcional (para crear subcategorías)
    }
    ```
*   **Respuesta (201 Created):** Categoría creada correctamente.

---

## 3. Práctica de Integración de Seguridad en Angular

Para practicar la seguridad por roles en el frontend, te sugerimos programar los siguientes puntos paso a paso sin autogenerar el código, para entender cómo fluyen los datos:

### Paso A: Inspección del Rol en tu Servicio
En tu `AuthService` ya almacenas el usuario en localStorage. Asegúrate de exponer una propiedad o Signal reactiva que verifique el rol actual del usuario:

```typescript
// En tu auth.service.ts
currentUser = signal<User | null>(JSON.parse(localStorage.getItem('user') || 'null'));

// Expón señales computadas derivadas
isAdmin = computed(() => this.currentUser()?.role === 'admin');
isSeller = computed(() => this.currentUser()?.role === 'seller');
```

### Paso B: Protección de Rutas en el Enrutador
Configura un `roleGuard` funcional que lea la propiedad `data.roles` de la configuración de rutas de Angular.

1.  **Crea el Guard (`role.guard.ts`):**
    ```typescript
    import { inject } from '@angular/core';
    import { CanActivateFn, Router } from '@angular/router';
    import { AuthService } from '../../services/auth/auth-service';
    import { SnackarService } from '../../services/snackar/snackar.service';

    export const roleGuard: CanActivateFn = (route, state) => {
      const authService = inject(AuthService);
      const router = inject(Router);
      const snackbar = inject(SnackarService);
      
      const allowedRoles = route.data['roles'] as string[];
      const userRole = authService.currentUser()?.role;

      if (userRole && allowedRoles.includes(userRole)) {
        return true; // Acceso permitido
      }

      snackbar.error('No tienes permisos para acceder a esta sección');
      return router.createUrlTree(['/dashboard']); // Redirigir a panel principal
    };
    ```

2.  **Protege rutas administrativas en `dashboard.routes.ts`:**
    ```typescript
    {
      path: 'admin',
      component: AdminComponent,
      canActivate: [authGuard, roleGuard],
      data: { roles: ['admin'] } // Solo administradores
    }
    ```

### Paso C: Elementos Condicionales en la UI (Plantillas HTML)
Un usuario con rol `customer` no debe ver el botón de "Crear Producto", "Editar" ni "Eliminar". Utiliza la directiva estructural `@if` combinada con tus Signals:

1.  **Inyecta el servicio en el componente:**
    ```typescript
    export class ProductCatalog {
      public readonly authService = inject(AuthService);
      // ...
    }
    ```

2.  **Oculta botones en el HTML:**
    ```html
    <!-- Catálogo de Productos -->
    @if (authService.isAdmin() || authService.isSeller()) {
      <button class="btn-primary" routerLink="/dashboard/products/create">
        ➕ Agregar Producto
      </button>
    }
    ```

---

## 4. Ejercicios de Práctica Sugeridos 🚀

1.  **Formulario Reactivo de Creación/Edición:**
    Crea un componente único `ProductFormComponent` que sirva tanto para crear un producto como para editar uno existente. Usa `POST /products` o `PATCH /products/:id` dependiendo de si la URL recibe un ID o no.
2.  **Control de Errores 403 (Forbidden):**
    En tu Interceptor HTTP global, captura si el backend devuelve un error con código HTTP `403`. Si esto pasa, muestra un mensaje con tu `SnackarService` que diga: *"Error de autorización: Tu rol no tiene permisos para realizar esta acción."* para proteger la experiencia del usuario si falla alguna llamada.
