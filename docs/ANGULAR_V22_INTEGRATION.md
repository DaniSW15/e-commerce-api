# Guía de Integración Angular v22 + E-Commerce API

Esta guía detalla cómo consumir la **E-Commerce API** (NestJS) desde una aplicación de **Angular v22** utilizando las mejores y más modernas prácticas del framework: **Signals**, **rxResource** (para carga reactiva), **Signal Inputs/Outputs**, **Model Inputs**, **Route Component Input Binding** e **interceptores funcionales**.

---

## 📋 Estructura General del Proyecto Angular

Se recomienda organizar el código del frontend de la siguiente manera:

```
src/app/
├── core/
│   ├── guards/
│   │   ├── auth.guard.ts        - Verifica sesión activa
│   │   └── roles.guard.ts       - Limita vistas (admin, seller, etc.)
│   ├── interceptors/
│   │   └── auth.interceptor.ts  - Agrega JWT y renueva con refresh token
│   ├── models/
│   │   ├── auth.models.ts       - UserRole enum, credenciales, 2FA
│   │   ├── product.models.ts    - Product, Category, filtros de búsqueda
│   │   ├── cart.models.ts       - CartItem, Cart
│   │   └── order.models.ts      - Order, OrderItem, PaymentDetails
│   └── services/
│       ├── auth.service.ts      - Gestión de sesión, 2FA, perfiles
│       ├── products.service.ts  - Catálogo, categorías, inventario
│       ├── cart.service.ts      - Carrito reactivo con Signals
│       ├── orders.service.ts    - Creación de órdenes y listados
│       └── payments.service.ts  - Integración de Stripe intents y reembolsos
├── features/
│   ├── layout/
│   │   └── main-layout.component.ts - Layout global con Navbar y badge de carrito
│   ├── auth/
│   │   ├── login/
│   │   │   └── login.component.ts   - Formulario de login + modal 2FA
│   │   └── register/
│   │       └── register.component.ts
│   ├── products/
│   │   ├── products-list/
│   │   │   └── products-list.component.ts - Grid de productos, filtros y búsqueda
│   │   └── product-detail/
│   │       └── product-detail.component.ts - Detalle con signal inputs de ruta
│   ├── cart/
│   │   └── cart-detail.component.ts    - Vista de carrito y control de cantidades
│   └── checkout/
│       └── checkout.component.ts       - Creación de orden + Stripe Payment Element
├── app.config.ts
├── app.routes.ts
└── app.component.ts
```

---

## 1. Configuración de la Aplicación (`app.config.ts`)

Para habilitar el enlace automático de parámetros de ruta a inputs de componentes (`withComponentInputBinding`) y registrar el interceptor de autenticación:

```typescript
// src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
```

---

## 2. Modelos TypeScript (`src/app/core/models/`)

### `auth.models.ts`
```typescript
export enum UserRole {
  CUSTOMER = 'customer',
  SELLER = 'seller',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  DEVELOPER = 'developer',
  SUPPORT = 'support'
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isTwoFactorEnabled: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  requires2FA?: boolean;
  twoFactorToken?: string; // Token temporal para completar 2FA
}
```

### `product.models.ts`
```typescript
export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  children?: Category[];
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  categoryId: string;
  categoryName?: string;
  createdAt: string;
}

export interface ProductFilterDto {
  page?: number;
  limit?: number;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}
```

### `cart.models.ts`
```typescript
export interface CartItem {
  id: string; // ID del CartItem en DB
  productId: string;
  productName: string;
  productPrice: number;
  productImage?: string;
  quantity: number;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
}
```

### `order.models.ts`
```typescript
export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  status: 'pending' | 'processing' | 'shipped' | 'completed' | 'cancelled';
  shippingAddress: string;
  billingAddress: string;
  total: number;
  items: OrderItem[];
  createdAt: string;
}
```

---

## 3. Servicios e Interceptores Funcionales

### `AuthService` (`src/app/core/services/auth.service.ts`)
```typescript
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, EMPTY } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, UserRole, User } from '../models/auth.models';

const ACCESS_KEY = 'ec_access_token';
const REFRESH_KEY = 'ec_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  // --- Signals del Estado de Sesión ---
  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === UserRole.ADMIN || this._user()?.role === UserRole.SUPER_ADMIN);
  readonly isSeller = computed(() => this._user()?.role === UserRole.SELLER);

  constructor() {
    this.loadSession();
  }

  register(dto: any) {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, dto).pipe(
      tap(res => this.saveSession(res))
    );
  }

  login(dto: any) {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, dto).pipe(
      tap(res => {
        if (!res.requires2FA) {
          this.saveSession(res);
        }
      })
    );
  }

  login2FA(code: string, tempToken: string) {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login/2fa`, { code, tempToken }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  logout() {
    const rt = localStorage.getItem(REFRESH_KEY);
    return this.http.post(`${this.baseUrl}/logout`, { refreshToken: rt }).pipe(
      tap(() => this.clearSession()),
      catchError(() => {
        this.clearSession();
        return EMPTY;
      })
    );
  }

  refreshToken() {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return EMPTY;

    return this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, { refreshToken: rt }).pipe(
      tap(res => {
        localStorage.setItem(ACCESS_KEY, res.accessToken);
        localStorage.setItem(REFRESH_KEY, res.refreshToken);
      })
    );
  }

  private saveSession(res: AuthResponse) {
    localStorage.setItem(ACCESS_KEY, res.accessToken);
    localStorage.setItem(REFRESH_KEY, res.refreshToken);
    this._user.set(res.user);
  }

  private clearSession() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  private loadSession() {
    const token = localStorage.getItem(ACCESS_KEY);
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      if (Date.now() > exp) {
        this.clearSession();
        return;
      }
      this._user.set({
        id: payload.id,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role as UserRole,
        isTwoFactorEnabled: payload.isTwoFactorEnabled ?? false
      });
    } catch {
      this.clearSession();
    }
  }
}
```

---

### `authInterceptor` (`src/app/core/interceptors/auth.interceptor.ts`)
```typescript
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = localStorage.getItem('ec_access_token');

  const authReq = token && !req.url.includes('/auth/refresh')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/login') && !req.url.includes('/auth/refresh')) {
        return auth.refreshToken().pipe(
          switchMap((res) => {
            const retriedReq = req.clone({
              setHeaders: { Authorization: `Bearer ${res.accessToken}` }
            });
            return next(retriedReq);
          }),
          catchError((refreshErr) => {
            auth.logout().subscribe();
            return throwError(() => refreshErr);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
```

---

### `CartService` (`src/app/core/services/cart.service.ts`)
Mantiene un carrito reactivo sincronizado con el backend usando un **Signal** global, de forma que el contador de items del encabezado se actualice automáticamente en todo el sistema.

```typescript
import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Cart, CartItem } from '../models/cart.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/cart`;

  // --- Signal Reactivo del Carrito ---
  readonly cart = signal<Cart | null>(null);

  // --- Signals Derivados ---
  readonly totalItems = computed(() => 
    this.cart()?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  );
  readonly totalPrice = computed(() => this.cart()?.totalAmount ?? 0);

  constructor() {
    // Si el usuario cambia o se autentica, carga su carrito de base de datos
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.fetchCart().subscribe();
      } else {
        this.cart.set(null);
      }
    });
  }

  fetchCart() {
    return this.http.get<Cart>(this.baseUrl).pipe(
      effect => this.http.get<Cart>(this.baseUrl),
      effect => {},
      // Guarda en signal
      tap(res => this.cart.set(res))
    );
  }

  addToCart(productId: string, quantity = 1) {
    return this.http.post<Cart>(`${this.baseUrl}/items`, { productId, quantity }).pipe(
      tap(res => this.cart.set(res))
    );
  }

  updateQuantity(itemId: string, quantity: number) {
    return this.http.patch<Cart>(`${this.baseUrl}/items/${itemId}`, { quantity }).pipe(
      tap(res => this.cart.set(res))
    );
  }

  removeFromCart(itemId: string) {
    return this.http.delete<Cart>(`${this.baseUrl}/items/${itemId}`).pipe(
      tap(res => this.cart.set(res))
    );
  }

  clear() {
    return this.http.delete<Cart>(this.baseUrl).pipe(
      tap(() => this.cart.set(null))
    );
  }
}
// Helper tap import
import { tap } from 'rxjs';
```

---

### `ProductsService` (`src/app/core/services/products.service.ts`)
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Product, Category, ProductFilterDto } from '../models/product.models';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/products`;

  findAll(filters: ProductFilterDto) {
    let params = new HttpParams();
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters.minPrice) params = params.set('minPrice', filters.minPrice.toString());
    if (filters.maxPrice) params = params.set('maxPrice', filters.maxPrice.toString());
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params = params.set('sortOrder', filters.sortOrder);

    return this.http.get<{ items: Product[], total: number }>(this.baseUrl, { params });
  }

  search(query: string) {
    const params = new HttpParams().set('q', query);
    return this.http.get<Product[]>(`${this.baseUrl}/search`, { params });
  }

  findBySlug(slug: string) {
    return this.http.get<Product>(`${this.baseUrl}/${slug}`);
  }

  getCategoryTree() {
    return this.http.get<Category[]>(`${this.baseUrl}/categories/tree`);
  }

  create(dto: Partial<Product>) {
    return this.http.post<Product>(this.baseUrl, dto);
  }

  update(id: string, dto: Partial<Product>) {
    return this.http.patch<Product>(`${this.baseUrl}/${id}`, dto);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  updateStock(id: string, quantity: number) {
    return this.http.post<Product>(`${this.baseUrl}/${id}/stock`, { quantity });
  }
}
```

### `OrdersService` & `PaymentsService`
```typescript
// src/app/core/services/orders.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Order } from '../models/order.models';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/orders`;

  create(dto: { shippingAddress: string; billingAddress: string }) {
    return this.http.post<Order>(this.baseUrl, dto);
  }

  getMyOrders() {
    return this.http.get<Order[]>(this.baseUrl);
  }

  getById(id: string) {
    return this.http.get<Order>(`${this.baseUrl}/${id}`);
  }

  cancel(id: string) {
    return this.http.patch<Order>(`${this.baseUrl}/${id}/cancel`, {});
  }
}

// src/app/core/services/payments.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payments`;

  createIntent(orderId: string) {
    return this.http.post<{ clientSecret: string; paymentIntentId: string }>(`${this.baseUrl}/intent`, { orderId });
  }

  getIntent(orderId: string) {
    return this.http.get<any>(`${this.baseUrl}/order/${orderId}`);
  }
}
```

---

## 4. Componentes Standalone Modernos

### 4.1 `MainLayoutComponent` (Navegación e Indicador de Carrito Reactivo)
Utiliza la señal computada del `CartService` para actualizar el contador del carrito en tiempo real sin recargar ni usar eventos manuales.

```typescript
// src/app/features/layout/main-layout.component.ts
import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      <header class="header">
        <a routerLink="/products" class="brand">E-Commerce</a>
        
        <nav class="nav">
          <a routerLink="/products" routerLinkActive="active">Productos</a>
          @if (auth.isAdmin()) {
            <a routerLink="/admin/products" routerLinkActive="active">Panel Admin</a>
          }
        </nav>

        <div class="actions">
          <a routerLink="/cart" class="cart-btn">
            🛒 Carrito
            @if (cart.totalItems() > 0) {
              <span class="badge">{{ cart.totalItems() }}</span>
            }
          </a>
          
          @if (auth.isAuthenticated()) {
            <span class="user-email">{{ auth.user()?.email }}</span>
            <button (click)="logout()" class="btn-logout">Salir</button>
          } @else {
            <a routerLink="/login" class="btn-login">Ingresar</a>
          }
        </div>
      </header>

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: #1e293b; color: white; }
    .brand { font-size: 1.5rem; font-weight: bold; color: #38bdf8; text-decoration: none; }
    .nav { display: flex; gap: 1rem; }
    .nav a { color: #cbd5e1; text-decoration: none; font-weight: 500; }
    .nav a.active { color: white; border-bottom: 2px solid #38bdf8; }
    .actions { display: flex; align-items: center; gap: 1.5rem; }
    .cart-btn { position: relative; color: white; text-decoration: none; font-weight: 600; background: #334155; padding: 0.5rem 1rem; border-radius: 0.375rem; }
    .badge { position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; font-size: 0.75rem; border-radius: 9999px; padding: 0.2rem 0.5rem; font-weight: bold; }
    .btn-logout { background: #ef4444; border: none; color: white; padding: 0.4rem 0.8rem; border-radius: 0.25rem; cursor: pointer; }
    .main-content { padding: 2rem; max-width: 1200px; margin: 0 auto; }
  `]
})
export class MainLayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);

  logout() {
    this.auth.logout().subscribe();
  }
}
```

---

### 4.2 `ProductsListComponent` (Catálogo con `rxResource` y Filtros Reactivos)
Carga reactivamente los productos en base a la señal de filtros del usuario utilizando `rxResource`.

```typescript
// src/app/features/products/products-list/products-list.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { ProductsService } from '../../../core/services/products.service';
import { CartService } from '../../../core/services/cart.service';
import { ProductFilterDto } from '../../../core/models/product.models';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="catalog-layout">
      <!-- Filtros Laterales -->
      <aside class="filters">
        <h3>Filtros</h3>
        <div class="filter-group">
          <label>Categoría</label>
          <select [(ngModel)]="selectedCategory" (change)="applyCategory()">
            <option value="">Todas</option>
            @for (cat of categoriesResource.value(); track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
        </div>
        
        <div class="filter-group">
          <label>Precio Máximo</label>
          <input type="number" [(ngModel)]="maxPrice" (change)="applyPrice()" placeholder="Ej: 500" />
        </div>
      </aside>

      <!-- Grid de Productos -->
      <section class="products-section">
        <div class="search-bar">
          <input type="text" [(ngModel)]="searchQuery" (input)="onSearch()" placeholder="Buscar producto..." />
        </div>

        @if (productsResource.isLoading()) {
          <div class="loading">Buscando productos...</div>
        } @else {
          <div class="grid">
            @for (prod of productsResource.value()?.items; track prod.id) {
              <div class="product-card">
                <img [src]="prod.images[0] || 'assets/placeholder.png'" [alt]="prod.name" />
                <div class="details">
                  <h4 [routerLink]="['/products', prod.slug]">{{ prod.name }}</h4>
                  <p class="price">{{ prod.price | currency }}</p>
                  <p class="stock">Disponibles: {{ prod.stock }}</p>
                  <button (click)="addToCart(prod.id)" [disabled]="prod.stock === 0" class="btn-add">
                    {{ prod.stock === 0 ? 'Agotado' : 'Añadir al carrito' }}
                  </button>
                </div>
              </div>
            } @empty {
              <div class="empty">No se encontraron productos coincidentes.</div>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .catalog-layout { display: grid; grid-template-columns: 250px 1fr; gap: 2rem; }
    .filters { background: white; padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; }
    .filter-group { margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .filter-group select, .filter-group input { padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.25rem; }
    .search-bar { margin-bottom: 1.5rem; }
    .search-bar input { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; }
    .product-card { background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden; display: flex; flex-direction: column; }
    .product-card img { width: 100%; height: 200px; object-fit: cover; }
    .details { padding: 1rem; flex: 1; display: flex; flex-direction: column; }
    .details h4 { margin: 0 0 0.5rem; cursor: pointer; color: #1e293b; }
    .details h4:hover { color: #38bdf8; }
    .price { font-weight: bold; color: #0f172a; margin: 0 0 0.25rem; }
    .stock { font-size: 0.8rem; color: #64748b; margin-bottom: 1rem; }
    .btn-add { margin-top: auto; background: #3b82f6; color: white; border: none; padding: 0.5rem; border-radius: 0.25rem; cursor: pointer; font-weight: bold; }
    .btn-add:disabled { background: #cbd5e1; cursor: not-allowed; }
  `]
})
export class ProductsListComponent {
  private readonly productsService = inject(ProductsService);
  private readonly cartService = inject(CartService);

  readonly filters = signal<ProductFilterDto>({ page: 1, limit: 30 });
  readonly searchQuery = signal('');
  
  // Variables auxiliares de filtro en plantilla
  selectedCategory = '';
  maxPrice?: number;

  // --- Carga Reactiva de Árbol de Categorías ---
  readonly categoriesResource = rxResource({
    loader: () => this.productsService.getCategoryTree()
  });

  // --- Carga Reactiva de Productos en base a Filtros y Búsqueda ---
  readonly productsResource = rxResource({
    request: () => ({ filters: this.filters(), query: this.searchQuery() }),
    loader: ({ request }) => {
      if (request.query.trim()) {
        return this.productsService.search(request.query).pipe(
          map(items => ({ items, total: items.length }))
        );
      }
      return this.productsService.findAll(request.filters);
    }
  });

  applyCategory() {
    this.filters.update(f => ({ ...f, categoryId: this.selectedCategory || undefined, page: 1 }));
  }

  applyPrice() {
    this.filters.update(f => ({ ...f, maxPrice: this.maxPrice || undefined, page: 1 }));
  }

  onSearch() {
    // Si cambia searchQuery, el loader reactivo lo detecta automáticamente
  }

  addToCart(productId: string) {
    this.cartService.addToCart(productId, 1).subscribe();
  }
}
import { map } from 'rxjs';
```

---

### 4.3 `ProductDetailComponent` (Enlace Automático de Slug de URL)
Vincula automáticamente el parámetro de la ruta `slug` a un Signal Input para disparar la carga reactiva con `rxResource`.

```typescript
// src/app/features/products/product-detail/product-detail.component.ts
import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ProductsService } from '../../../core/services/products.service';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (productResource.isLoading()) {
      <div class="loading">Cargando producto...</div>
    } @else if (productResource.value(); as prod) {
      <div class="product-detail">
        <div class="image-gallery">
          <img [src]="prod.images[0] || 'assets/placeholder.png'" [alt]="prod.name" />
        </div>
        <div class="content">
          <h1>{{ prod.name }}</h1>
          <p class="category">Categoría: {{ prod.categoryName || 'General' }}</p>
          <p class="price">{{ prod.price | currency }}</p>
          <div class="description">
            <h3>Descripción</h3>
            <p>{{ prod.description }}</p>
          </div>
          <div class="actions">
            <button (click)="addToCart(prod.id)" [disabled]="prod.stock === 0" class="btn-primary">
              {{ prod.stock === 0 ? 'Agotado' : 'Comprar ahora' }}
            </button>
          </div>
        </div>
      </div>
    } @else {
      <div class="not-found">El producto solicitado no existe.</div>
    }
  `,
  styles: [`
    .product-detail { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-top: 2rem; }
    .image-gallery img { width: 100%; border-radius: 0.75rem; border: 1px solid #e2e8f0; }
    .content h1 { margin-top: 0; color: #0f172a; }
    .category { color: #64748b; font-size: 0.9rem; }
    .price { font-size: 2rem; font-weight: bold; color: #10b981; margin: 1rem 0; }
    .description { margin-top: 2rem; line-height: 1.6; color: #334155; }
    .btn-primary { background: #3b82f6; color: white; border: none; padding: 0.8rem 2rem; border-radius: 0.5rem; font-size: 1.1rem; font-weight: bold; cursor: pointer; }
    .btn-primary:hover { background: #2563eb; }
  `]
})
export class ProductDetailComponent {
  private readonly productsService = inject(ProductsService);
  private readonly cartService = inject(CartService);

  // --- Parameter binding vía Signal Input ---
  readonly slug = input.required<string>(); // Vinculado a 'products/:slug' por el router automáticamente

  readonly productResource = rxResource({
    request: () => ({ slug: this.slug() }),
    loader: ({ request }) => this.productsService.findBySlug(request.slug)
  });

  addToCart(productId: string) {
    this.cartService.addToCart(productId, 1).subscribe();
  }
}
```

---

### 4.4 `CheckoutComponent` (Pago con Stripe Payment Element)
Este componente realiza la integración real de **Stripe Payment Element**. Crea la orden en el backend, solicita el *Client Secret* de pago, monta el elemento de interfaz de Stripe y confirma la transacción.

```typescript
// src/app/features/checkout/checkout.component.ts
import { Component, inject, signal, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { OrdersService } from '../../core/services/orders.service';
import { PaymentsService } from '../../core/services/payments.service';
import { CartService } from '../../core/services/cart.service';
import { Router } from '@angular/router';

declare var Stripe: any; // Instanciado mediante script en index.html o SDK

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="checkout-layout">
      <div class="form-section">
        <h2>Detalles de Envío</h2>
        <form [formGroup]="addressForm" (ngSubmit)="initializePayment()">
          <div class="form-group">
            <label>Dirección de Envío *</label>
            <input formControlName="shippingAddress" placeholder="Calle, Número, Ciudad" />
          </div>
          <div class="form-group">
            <label>Dirección de Facturación *</label>
            <input formControlName="billingAddress" placeholder="Igual que envío o dirección fiscal" />
          </div>
          
          @if (!stripeInitialized()) {
            <button type="submit" [disabled]="addressForm.invalid" class="btn-primary">
              Proceder al Pago ({{ cart.totalPrice() | currency }})
            </button>
          }
        </form>

        <!-- Contenedor del Elemento de Stripe -->
        <div [hidden]="!stripeInitialized()" class="payment-box">
          <h3>Introduzca su Tarjeta</h3>
          <div #paymentElementContainer id="payment-element"></div>
          @if (paymentError()) {
            <div class="error-banner">{{ paymentError() }}</div>
          }
          <button (click)="confirmPayment()" [disabled]="processingPayment()" class="btn-stripe">
            {{ processingPayment() ? 'Procesando pago...' : 'Confirmar Pago' }}
          </button>
        </div>
      </div>

      <!-- Resumen del Carrito -->
      <div class="summary-section">
        <h2>Resumen del Pedido</h2>
        <div class="summary-card">
          @for (item of cart.cart()?.items; track item.id) {
            <div class="summary-item">
              <span>{{ item.productName }} (x{{ item.quantity }})</span>
              <span>{{ item.productPrice * item.quantity | currency }}</span>
            </div>
          }
          <div class="total-row">
            <strong>Total:</strong>
            <strong>{{ cart.totalPrice() | currency }}</strong>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .checkout-layout { display: grid; grid-template-columns: 1fr 400px; gap: 3rem; margin-top: 2rem; }
    .form-section, .summary-section { background: white; padding: 2rem; border-radius: 0.75rem; border: 1px solid #e2e8f0; }
    .form-group { margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .form-group input { padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; }
    .payment-box { margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: 2rem; }
    .btn-stripe { width: 100%; margin-top: 1.5rem; background: #635bff; color: white; border: none; padding: 0.8rem; border-radius: 0.375rem; font-weight: bold; cursor: pointer; }
    .btn-stripe:disabled { opacity: 0.7; cursor: not-allowed; }
    .summary-card { display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; }
    .summary-item { display: flex; justify-content: space-between; font-size: 0.95rem; }
    .total-row { display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 1rem; font-size: 1.2rem; }
  `]
})
export class CheckoutComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ordersService = inject(OrdersService);
  private readonly paymentsService = inject(PaymentsService);
  protected readonly cart = inject(CartService);
  private readonly router = inject(Router);

  @ViewChild('paymentElementContainer') paymentElementContainer!: ElementRef;

  readonly addressForm = this.fb.group({
    shippingAddress: ['', Validators.required],
    billingAddress: ['', Validators.required]
  });

  readonly stripeInitialized = signal(false);
  readonly processingPayment = signal(false);
  readonly paymentError = signal<string | null>(null);

  private stripe: any;
  private elements: any;
  private clientSecret = '';
  private orderId = '';

  ngOnInit() {
    // Inicializar Stripe con la clave pública del entorno
    this.stripe = Stripe('pk_test_tu_clave_publica_aqui');
  }

  // 1. Crea la Orden y genera el Payment Intent en el servidor
  initializePayment() {
    if (this.addressForm.invalid) return;

    const address = this.addressForm.value;

    this.ordersService.create({
      shippingAddress: address.shippingAddress!,
      billingAddress: address.billingAddress!
    }).subscribe({
      next: (order) => {
        this.orderId = order.id;

        // Genera el intent de pago para esta orden en Stripe
        this.paymentsService.createIntent(order.id).subscribe((intent) => {
          this.clientSecret = intent.clientSecret;

          // Monta el elemento del formulario de Stripe
          this.elements = this.stripe.elements({ clientSecret: this.clientSecret });
          const paymentElement = this.elements.create('payment');
          paymentElement.mount('#payment-element');

          this.stripeInitialized.set(true);
        });
      }
    });
  }

  // 2. Confirma el pago en Stripe
  async confirmPayment() {
    this.processingPayment.set(true);
    this.paymentError.set(null);

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-success?orderId=${this.orderId}`,
      },
      // Evita redirección automática para controlar el flujo
      redirect: 'if_required'
    });

    if (error) {
      this.paymentError.set(error.message);
      this.processingPayment.set(false);
    } else {
      // Éxito: Limpia el carrito local y redirige
      this.cart.clear().subscribe(() => {
        this.router.navigate(['/order-success'], { queryParams: { orderId: this.orderId } });
      });
    }
  }
}
```

---

## 5. Manejo de CORS en el Servidor (NestJS)

Por defecto, las aplicaciones de desarrollo en Angular corren en `http://localhost:4200`. Asegúrate de que el backend de NestJS acepte peticiones desde este puerto.

En tu archivo principal de NestJS (`src/main.ts`), valida que la configuración de CORS contenga el origen del cliente:

```typescript
// src/main.ts - Ejemplo de configuración de CORS en NestJS
app.enableCors({
  origin: ['http://localhost:4200', 'http://localhost:3000'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
});
```
