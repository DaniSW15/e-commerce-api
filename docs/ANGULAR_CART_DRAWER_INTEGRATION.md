# 🛒 Guía: Integración del Panel Lateral del Carrito (Cart Drawer) y Badge en el Header

Esta guía explica cómo integrar el **Carrito de compras** directamente en tu diseño principal (`DashboardLayout`) utilizando un panel lateral deslizable a la derecha (`MatSidenav`) y un icono con indicador de cantidad (`Badge`) en el header.

---

## 1. Modificaciones en el Controlador del Dashboard (`dashboard-layout.ts`)

Inyecta tu `CartService` para que el componente principal tenga acceso a la cantidad de elementos en el carrito, y expón métodos para controlar el panel deslizable del carrito.

Edita tu archivo `src/app/features/dashboard/pages/dashboard-layout/dashboard-layout.ts`:

```typescript
// 1. Añade los nuevos imports:
import { CartService } from '@/core/services/cart/cart.service';

// 2. Inyecta el CartService dentro de la clase:
private readonly cartService = inject(CartService);

// 3. Expón las signals reactivas del carrito para el HTML:
public readonly cartCount = this.cartService.cartCount;
public readonly cartItems = this.cartService.cartItems;
public readonly cartTotal = this.cartService.cartTotal;

// 4. Métodos para gestionar cantidad y eliminación desde el layout:
updateQuantity(itemId: string, quantity: number): void {
  if (quantity <= 0) {
    this.removeItem(itemId);
  } else {
    this.cartService.updateQuantity(itemId, quantity).subscribe();
  }
}

removeItem(itemId: string): void {
  this.cartService.removeFromCart(itemId).subscribe();
}

checkout(cartDrawer: any): void {
  // Aquí puedes implementar la lógica para crear la orden y redirigir
  cartDrawer.close();
  // ... redirección al flujo de checkout ...
}
```

---

## 2. Configurar el Panel Lateral y el Header en la Plantilla (`dashboard-layout.html`)

Modifica `src/app/features/dashboard/pages/dashboard-layout/dashboard-layout.html` para incorporar:
1.  Un segundo `<mat-sidenav>` posicionado a la derecha (`position="end"`).
2.  El botón del carrito con el badge dinámico en el header.

```html
<mat-sidenav-container class="sidenav-container">
  
  <!-- SIDENAV IZQUIERDO: Navegación del Panel (ya implementado) -->
  <mat-sidenav #sidenav class="sidebar-sidenav" [mode]="isMobile() ? 'over' : 'side'" [opened]="!isMobile()">
    <!-- ... tu contenido del menú ... -->
  </mat-sidenav>

  <!-- SIDENAV DERECHO: Carrito de Compras -->
  <mat-sidenav #cartDrawer position="end" mode="over" class="cart-sidenav">
    <div class="cart-header">
      <h3>Tu Carrito</h3>
      <button mat-icon-button (click)="cartDrawer.close()">❌</button>
    </div>

    <div class="cart-body">
      @for (item of cartItems(); track item.id) {
        <div class="cart-item">
          <img [src]="item.product.images[0]?.url || 'no-image.webp'" [alt]="item.product.name" class="item-img" />
          <div class="item-details">
            <h4>{{ item.product.name }}</h4>
            <p class="item-price">\${{ item.price | number:'1.2-2' }}</p>
            
            <div class="quantity-controls">
              <button mat-icon-button (click)="updateQuantity(item.id, item.quantity - 1)">-</button>
              <span>{{ item.quantity }}</span>
              <button mat-icon-button (click)="updateQuantity(item.id, item.quantity + 1)">+</button>
            </div>
          </div>
          <button class="btn-remove" (click)="removeItem(item.id)">🗑️</button>
        </div>
      } @empty {
        <div class="empty-cart">
          <p>Tu carrito está vacío.</p>
        </div>
      }
    </div>

    @if (cartItems().length > 0) {
      <div class="cart-footer">
        <div class="total-row">
          <span>Total:</span>
          <strong>\${{ cartTotal() | number:'1.2-2' }}</strong>
        </div>
        <button mat-raised-button color="primary" class="w-full" (click)="checkout(cartDrawer)">
          Comprar Ahora 💳
        </button>
      </div>
    }
  </mat-sidenav>

  <!-- Contenido de la página -->
  <mat-sidenav-content class="main-content">
    <header class="dashboard-header">
      <div class="header-left">
        @if (isMobile()) {
          <button mat-icon-button (click)="sidenav.toggle()" class="btn-menu-toggle">
            <mat-icon>menu</mat-icon>
          </button>
        }
        <div class="search-bar" [class.hidden]="isMobile()">
          <input type="text" placeholder="Buscar..." />
        </div>
      </div>
      
      <div class="user-profile-actions">
        <!-- BOTÓN DEL CARRITO CON BADGE DINÁMICO -->
        <button class="btn-cart" (click)="cartDrawer.toggle()">
          🛒
          @if (cartCount() > 0) {
            <span class="cart-badge">{{ cartCount() }}</span>
          }
        </button>

        <button class="btn-notifications">🔔</button>
        <span class="user-name">{{ currentUser()?.email }}</span>
      </div>
    </header>

    <main class="page-body">
      <router-outlet />
    </main>
  </mat-sidenav-content>
</mat-sidenav-container>
```

---

## 3. Ejercicio de Práctica: Flujo de Creación de Orden Completo 🚀

Cuando el usuario hace clic en **"Comprar Ahora"** dentro del Carrito:

1.  **Inyecta el `OrderService`** en tu `DashboardLayout`.
2.  **Crea la orden en el backend:** Llama a `this.orderService.createOrder({ shippingAddress: 'Dirección por defecto' })`.
3.  **Vacía el carrito local:** Tras crear con éxito la orden, llama a `this.cartService.clearCart().subscribe()`.
4.  **Redirecciona al Checkout:** Navega a `/dashboard/checkout/:id` usando el ID de la orden recién creada para proceder a la pasarela de Stripe.
