# 🛒 Guía: Integración de Carrito, Órdenes y Stripe en Angular (v17+)

Esta guía detalla la arquitectura, los modelos y la lógica necesarios para implementar un flujo completo de compras en el frontend utilizando **Angular Signals**, **RxJS**, y el SDK oficial de **Stripe**.

---

## 1. Definición de Modelos e Interfaces (`cart.model.ts` y `order.model.ts`)

Crea estos archivos en tu carpeta de modelos (ej. `src/app/core/models/`) para modelar correctamente el carrito y las órdenes que vienen del backend de NestJS.

### `cart.model.ts`

```typescript
import { Product } from './product.model';

export interface CartItem {
  id: string; // ID de la relación en el carrito (UUID del backend)
  productId: string;
  quantity: number;
  price: number; // Precio en el momento de agregarlo
  product: Product; // Detalles del producto
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  total: number; // Calculado en backend o calculado dinámicamente
  createdAt: string;
  updatedAt: string;
}

export interface AddToCartDto {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemDto {
  quantity: number;
}
```

### `order.model.ts`

```typescript
import { Product } from './product.model';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product: Product;
}

export interface Order {
  id: string;
  userId: string;
  orderStatus: OrderStatus;
  total: number;
  currency: string;
  shippingAddress: string;
  billingAddress?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderDto {
  shippingAddress: string;
  billingAddress?: string;
}
```

## <>

## 2. Servicio del Carrito con Sincronización en Tiempo Real (`cart.service.ts`)

El carrito debe tener dos estados:

1. **Estado Local/Persistente:** Guardar el estado del carrito usando una `signal` reactiva.
2. **Sincronización:** Si el usuario está autenticado (`AuthService.isAuthenticated()`), se sincroniza con el backend (NestJS).

Implementa el servicio `src/app/core/services/cart/cart.service.ts`:

```typescript
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { AuthService } from '../auth/auth-service';
import { Cart, CartItem, AddToCartDto } from '../../models/cart.model';
import { Observable, tap, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/cart`;

  // Signal principal del carrito
  cart = signal<Cart | null>(null);

  // Signals computadas derivadas
  cartItems = computed(() => this.cart()?.items || []);
  cartCount = computed(() =>
    this.cartItems().reduce((acc, item) => acc + item.quantity, 0),
  );
  cartTotal = computed(() =>
    this.cartItems().reduce((acc, item) => acc + item.price * item.quantity, 0),
  );

  constructor() {
    // Escucha cambios de autenticación para cargar el carrito
    this.authService.currentUser$.subscribe((user) => {
      if (user) {
        this.loadCartFromServer().subscribe();
      } else {
        this.cart.set(null); // Limpiar sesión
      }
    });
  }

  /**
   * Obtiene el carrito del servidor (para usuarios logueados)
   */
  loadCartFromServer(): Observable<Cart> {
    return this.http.get<Cart>(this.baseUrl).pipe(
      tap((cart) => this.cart.set(cart)),
      catchError((err) => {
        console.error('Error cargando carrito:', err);
        return of(null as any);
      }),
    );
  }

  /**
   * Agregar un producto al carrito
   */
  addToCart(dto: AddToCartDto): Observable<Cart> {
    return this.http
      .post<Cart>(`${this.baseUrl}/items`, dto)
      .pipe(tap((cart) => this.cart.set(cart)));
  }

  /**
   * Actualizar la cantidad de un artículo en el carrito
   */
  updateQuantity(itemId: string, quantity: number): Observable<Cart> {
    return this.http
      .patch<Cart>(`${this.baseUrl}/items/${itemId}`, { quantity })
      .pipe(tap((cart) => this.cart.set(cart)));
  }

  /**
   * Eliminar un artículo del carrito
   */
  removeFromCart(itemId: string): Observable<Cart> {
    return this.http
      .delete<Cart>(`${this.baseUrl}/items/${itemId}`)
      .pipe(tap((cart) => this.cart.set(cart)));
  }

  /**
   * Vaciar el carrito
   */
  clearCart(): Observable<any> {
    return this.http.delete(this.baseUrl).pipe(tap(() => this.cart.set(null)));
  }
}
```

---

## 3. Servicio de Órdenes (`order.service.ts`)

Crea este servicio para gestionar la creación y el historial de pedidos del usuario (`src/app/core/services/order/order.service.ts`):

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { Order, CreateOrderDto } from '../../models/order.model';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/orders`;

  /**
   * Crear un nuevo pedido (basado en el carrito actual)
   */
  createOrder(dto: CreateOrderDto): Observable<Order> {
    return this.http.post<Order>(this.baseUrl, dto);
  }

  /**
   * Obtener historial de pedidos del usuario logueado
   */
  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.baseUrl);
  }

  /**
   * Obtener detalle de una orden por ID
   */
  getOrderById(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/${id}`);
  }

  /**
   * Cancelar una orden (si sigue en pendiente)
   */
  cancelOrder(id: string): Observable<Order> {
    return this.http.patch<Order>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
```

---

## 4. Servicio y Pasarela de Pagos Stripe (`payment.service.ts`)

El backend de NestJS utiliza Stripe en modo **PaymentIntents** (`/payments/intent`). El flujo de checkout de nivel senior debe ser el siguiente:

1. El usuario hace click en "Comprar" y se crea la **Orden** en estado `pending`.
2. El cliente solicita un **PaymentIntent** para esa orden. El backend devuelve un `clientSecret`.
3. El cliente renderiza los **Stripe Elements** de forma segura en la página utilizando el `clientSecret`.
4. El cliente confirma el pago directamente con los servidores de Stripe sin exponer datos de tarjetas al backend.
5. El Webhook de Stripe en el backend confirma el pago de forma asíncrona y cambia la orden a `paid`.

Instala primero el SDK de Stripe en tu frontend:

```bash
npm install @stripe/stripe-js
```

Crea el servicio `src/app/core/services/payment/payment.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Observable, from, map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payments`;

  // Clave pública de Stripe (obtener de las variables de entorno)
  private readonly stripePromise = loadStripe(environment.stripePublicKey);

  /**
   * Solicitar la creación del PaymentIntent para una orden en curso
   */
  createPaymentIntent(orderId: string): Observable<{ clientSecret: string }> {
    return this.http.post<{ clientSecret: string }>(`${this.baseUrl}/intent`, {
      orderId,
    });
  }

  /**
   * Obtiene la instancia nativa del SDK de Stripe
   */
  getStripeInstance(): Observable<Stripe | null> {
    return from(this.stripePromise);
  }
}
```

---

## 5. Componente de Checkout con Stripe Elements (`checkout.component.ts`)

Para renderizar el formulario seguro de Stripe, puedes crear un componente `CheckoutComponent` standalone.

### Código TypeScript (`checkout.component.ts`):

```typescript
import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../services/payment.service';
import {
  Stripe,
  StripeElements,
  StripePaymentElement,
} from '@stripe/stripe-js';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly paymentService = inject(PaymentService);
  private readonly snackbar = inject(SnackbarService);

  @ViewChild('paymentElementContainer', { static: false })
  paymentElementRef!: ElementRef;

  orderId = signal<string | null>(null);
  clientSecret = signal<string | null>(null);
  stripe = signal<Stripe | null>(null);
  elements = signal<StripeElements | null>(null);
  paymentElement = signal<StripePaymentElement | null>(null);

  isProcessing = signal<boolean>(false);
  isLoadingStripe = signal<boolean>(true);

  ngOnInit(): void {
    // 1. Obtener ID de la orden desde los parámetros de la ruta
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.snackbar.show('ID de pedido inválido');
      this.router.navigate(['/dashboard/orders']);
      return;
    }
    this.orderId.set(id);

    // 2. Obtener el clientSecret e inicializar Stripe
    this.paymentService.createPaymentIntent(id).subscribe({
      next: (res) => {
        this.clientSecret.set(res.clientSecret);
        this.initializeStripe(res.clientSecret);
      },
      error: (err) => {
        console.error('Error al inicializar intención de pago:', err);
        this.snackbar.show('No se pudo procesar el pago de esta orden');
        this.router.navigate(['/dashboard/orders']);
      },
    });
  }

  private initializeStripe(clientSecret: string): void {
    this.paymentService.getStripeInstance().subscribe((stripeInst) => {
      if (!stripeInst) return;
      this.stripe.set(stripeInst);

      // Configurar Elements
      const elementsInst = stripeInst.elements({
        clientSecret,
        appearance: {
          theme: 'night', // Estilo moderno oscuro (a juego con tu diseño premium)
          variables: {
            colorPrimary: '#6366f1',
            colorBackground: '#1e1b4b',
            colorText: '#f8fafc',
            borderRadius: '8px',
          },
        },
      });
      this.elements.set(elementsInst);

      // Crear y montar el widget del formulario de pago
      const paymentElementInst = elementsInst.create('payment');
      this.paymentElement.set(paymentElementInst);

      // Retrasar montaje hasta la siguiente macro-tarea para asegurar que el DOM existe
      setTimeout(() => {
        paymentElementInst.mount(this.paymentElementRef.nativeElement);
        this.isLoadingStripe.set(false);
      }, 50);
    });
  }

  async handleSubmitPayment(event: Event): Promise<void> {
    event.preventDefault();

    const stripeInst = this.stripe();
    const elementsInst = this.elements();

    if (!stripeInst || !elementsInst || this.isProcessing()) return;

    this.isProcessing.set(true);

    // Confirmar pago en Stripe
    const { error } = await stripeInst.confirmPayment({
      elements: elementsInst,
      confirmParams: {
        // Redireccionar al completarse
        return_url: `${window.location.origin}/dashboard/orders/success?orderId=${this.orderId()}`,
      },
    });

    if (error) {
      this.snackbar.show(error.message || 'Error al procesar el pago');
      this.isProcessing.set(false);
    }
  }
}
```

### Plantilla HTML (`checkout.component.html`):

```html
<div class="checkout-wrapper">
  <div class="checkout-card">
    <h2>Pagar Orden #{{ orderId() }}</h2>
    <p class="subtitle">
      Ingresa de forma segura los datos de tu tarjeta de crédito o débito.
    </p>

    <!-- Contenedor cargando -->
    @if (isLoadingStripe()) {
    <div class="loader-container">
      <div class="spinner"></div>
      <p>Conectando de forma segura con Stripe...</p>
    </div>
    }

    <!-- Formulario Stripe -->
    <form
      (submit)="handleSubmitPayment($event)"
      [class.hidden]="isLoadingStripe()"
    >
      <!-- El iframe seguro de Stripe se montará aquí -->
      <div #paymentElementContainer class="stripe-element-container"></div>

      <button
        type="submit"
        [disabled]="isProcessing() || isLoadingStripe()"
        class="btn-pay"
      >
        @if (isProcessing()) { Procesando Pago... } @else { Confirmar y Pagar }
      </button>
    </form>
  </div>
</div>
```

---

## 6. Próximos Retos sugeridos para ti 🚀

1. **Guard de Checkout:** Crea un guard para evitar que un usuario entre a `/checkout/:id` si la orden ya está pagada o cancelada.
2. **Sincronización Off-line:** Modifica el `CartService` para guardar artículos en `localStorage` si no ha iniciado sesión, y "volcar" esos artículos al backend al loguearse satisfactoriamente.
3. **Página de Éxito:** Diseña la pantalla de `/dashboard/orders/success` donde muestres los detalles del pedido recién procesado gracias a las Signals de `OrderService`.
