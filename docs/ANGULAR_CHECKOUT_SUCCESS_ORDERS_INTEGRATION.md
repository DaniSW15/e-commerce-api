# 💳 Guía: Integración de Checkout, Diálogo de Dirección y Páginas de Órdenes

Esta guía detalla la implementación del diálogo para capturar la dirección de envío y facturación, la confirmación de la orden, y la creación de las pantallas para el historial de pedidos y confirmación de pago exitoso.

---

## 1. Habilitar Diálogos en Material (`material.ts`)

Para poder abrir el formulario de direcciones en un modal modal moderno y elegante, añade `MatDialogModule` al archivo de exportaciones de Angular Material.

### Modificación en [material.ts](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/shared/material/material.ts):

Añade la importación y agrégalo al arreglo `Material`:

```typescript
import { MatDialogModule } from '@angular/material/dialog';

export const Material = [
    // ... otros componentes
    MatDialogModule,
    MatBadgeModule,
] as const;
```

---

## 2. Diálogo de Dirección de Envío y Facturación (`address-dialog`)

Crearemos un diálogo modal standalone que solicite la dirección de envío del usuario. Para optimizar la experiencia, incluiremos un checkbox que copie de forma automática los datos de envío en la de facturación (ya que el backend requiere ambas).

### Componente TS (`address-dialog.ts`):
Crea el archivo en `src/app/features/dashboard/pages/components/address-dialog/address-dialog.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { CreateOrderDto, Address } from '@/core/models/order.model';
import { Material } from '@/shared/material/material';
import { CommonModule } from '@angular/common';

interface AddressFormModel {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  sameAsBilling: boolean;
  
  // Opcional: Si desmarcan el checkbox, muestran la de facturación por separado
  billStreet: string;
  billCity: string;
  billState: string;
  billPostalCode: string;
  billCountry: string;
  notes: string;
}

@Component({
  selector: 'app-address-dialog',
  standalone: true,
  imports: [Material, CommonModule, FormRoot, FormField],
  templateUrl: './address-dialog.html',
  styleUrl: './address-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AddressDialogComponent>);

  public readonly addressModel = signal<AddressFormModel>({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'México', // Prefilado por defecto
    sameAsBilling: true,
    billStreet: '',
    billCity: '',
    billState: '',
    billPostalCode: '',
    billCountry: 'México',
    notes: '',
  });

  // Formulario con la librería de Signals del proyecto
  addressForm = form<AddressFormModel>(
    this.addressModel,
    (validators) => {
      // Dirección de Envío
      required(validators.street, { message: 'La calle y número son requeridos' });
      required(validators.city, { message: 'La ciudad es requerida' });
      required(validators.state, { message: 'El estado es requerido' });
      required(validators.postalCode, { message: 'El código postal es requerido' });
      required(validators.country, { message: 'El país es requerido' });

      // Dirección de Facturación condicional
      if (!this.addressModel().sameAsBilling) {
        required(validators.billStreet, { message: 'La calle de facturación es requerida' });
        required(validators.billCity, { message: 'La ciudad de facturación es requerida' });
        required(validators.billState, { message: 'El estado de facturación es requerido' });
        required(validators.billPostalCode, { message: 'El código postal de facturación es requerido' });
        required(validators.billCountry, { message: 'El país de facturación es requerido' });
      }
    },
    {
      submission: {
        action: async () => this.onSubmit(),
      },
    }
  );

  onSubmit(): void {
    if (this.addressForm().invalid()) return;

    const val = this.addressForm().value()!;
    
    const shippingAddress: Address = {
      street: val.street,
      city: val.city,
      state: val.state,
      postalCode: val.postalCode,
      country: val.country,
    };

    // Si coincide facturación, copiamos. Si no, mapeamos los campos billXXX
    const billingAddress: Address = val.sameAsBilling
      ? { ...shippingAddress }
      : {
          street: val.billStreet,
          city: val.billCity,
          state: val.billState,
          postalCode: val.billPostalCode,
          country: val.billCountry,
        };

    const result: CreateOrderDto = {
      shippingAddress,
      billingAddress,
      notes: val.notes || undefined,
    };

    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
```

### Plantilla HTML (`address-dialog.html`):
Crea el archivo en `src/app/features/dashboard/pages/components/address-dialog/address-dialog.html`:

```html
<div class="dialog-wrapper">
  <div class="dialog-header">
    <h2>Dirección de Entrega 📍</h2>
    <p>Introduce los datos para el envío y facturación de tu pedido.</p>
  </div>

  <form [formRoot]="addressForm" class="dialog-body">
    <!-- Grupo Dirección de Envío -->
    <div class="section-title">Dirección de Envío</div>
    <div class="form-grid">
      <mat-form-field appearance="outline" class="col-span-2">
        <mat-label>Calle y Número</mat-label>
        <input matInput formField="street" placeholder="Ej. Av. Reforma 123" />
        <mat-error>{{ addressForm().errors().street?.[0] }}</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Ciudad</mat-label>
        <input matInput formField="city" placeholder="Ej. CDMX" />
        <mat-error>{{ addressForm().errors().city?.[0] }}</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Estado</mat-label>
        <input matInput formField="state" placeholder="Ej. CDMX" />
        <mat-error>{{ addressForm().errors().state?.[0] }}</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Código Postal</mat-label>
        <input matInput formField="postalCode" placeholder="Ej. 06700" />
        <mat-error>{{ addressForm().errors().postalCode?.[0] }}</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>País</mat-label>
        <input matInput formField="country" placeholder="Ej. México" />
        <mat-error>{{ addressForm().errors().country?.[0] }}</mat-error>
      </mat-form-field>
    </div>

    <!-- Notas de Entrega -->
    <mat-form-field appearance="outline" class="w-full mt-2">
      <mat-label>Instrucciones de entrega / Notas (Opcional)</mat-label>
      <textarea matInput formField="notes" rows="2" placeholder="Ej. Tocar timbre portón negro..."></textarea>
    </mat-form-field>

    <!-- Opción Facturación -->
    <div class="checkbox-row mt-4">
      <mat-slide-toggle formField="sameAsBilling">
        Usar esta dirección como datos de facturación
      </mat-slide-toggle>
    </div>

    <!-- Sección Facturación Condicional -->
    @if (!addressModel().sameAsBilling) {
      <div class="section-title mt-6">Dirección de Facturación</div>
      <div class="form-grid">
        <mat-form-field appearance="outline" class="col-span-2">
          <mat-label>Calle y Número (Facturación)</mat-label>
          <input matInput formField="billStreet" placeholder="Ej. Juárez 456" />
          <mat-error>{{ addressForm().errors().billStreet?.[0] }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Ciudad (Facturación)</mat-label>
          <input matInput formField="billCity" placeholder="Ej. Monterrey" />
          <mat-error>{{ addressForm().errors().billCity?.[0] }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado (Facturación)</mat-label>
          <input matInput formField="billState" placeholder="Ej. Nuevo León" />
          <mat-error>{{ addressForm().errors().billState?.[0] }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Código Postal (Facturación)</mat-label>
          <input matInput formField="billPostalCode" placeholder="Ej. 64000" />
          <mat-error>{{ addressForm().errors().billPostalCode?.[0] }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>País (Facturación)</mat-label>
          <input matInput formField="billCountry" placeholder="Ej. México" />
          <mat-error>{{ addressForm().errors().billCountry?.[0] }}</mat-error>
        </mat-form-field>
      </div>
    }

    <!-- Botones de Acción -->
    <div class="dialog-actions">
      <button type="button" mat-button (click)="onCancel()" class="btn-cancel">
        Cancelar
      </button>
      <button type="submit" mat-raised-button color="primary" [disabled]="addressForm().invalid()" class="btn-submit">
        Proceder al Pago 💳
      </button>
    </div>
  </form>
</div>
```

### Estilos SCSS (`address-dialog.scss`):
Crea el archivo en `src/app/features/dashboard/pages/components/address-dialog/address-dialog.scss`:

```scss
.dialog-wrapper {
  background-color: #0f172a; /* Slate 900 */
  color: #f8fafc;
  padding: 2rem;
  border-radius: 20px;
  max-width: 600px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);

  .dialog-header {
    margin-bottom: 1.5rem;

    h2 {
      font-size: 1.5rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.5rem 0;
      font-family: 'Outfit', sans-serif;
    }

    p {
      color: #94a3b8;
      font-size: 0.9rem;
      margin: 0;
    }
  }

  .section-title {
    font-size: 0.95rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6366f1; /* Indigo 500 */
    margin-bottom: 1rem;
    border-left: 3px solid #6366f1;
    padding-left: 0.5rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;

    @media (max-width: 576px) {
      grid-template-columns: 1fr;
      
      .col-span-2 {
        grid-column: span 1 / span 1 !important;
      }
    }

    .col-span-2 {
      grid-column: span 2 / span 2;
    }
  }

  /* Personalización de inputs de Material a tono Oscuro */
  ::ng-deep {
    .mat-mdc-form-field {
      width: 100%;
    }
    .mat-mdc-text-field-wrapper {
      background-color: rgba(30, 41, 59, 0.5) !important;
      border-radius: 10px !important;
    }
    .mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__leading,
    .mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__notch,
    .mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__trailing {
      border-color: rgba(255, 255, 255, 0.1) !important;
    }
    .mdc-text-field--focused:not(.mdc-text-field--disabled) .mdc-notched-outline__leading,
    .mdc-text-field--focused:not(.mdc-text-field--disabled) .mdc-notched-outline__notch,
    .mdc-text-field--focused:not(.mdc-text-field--disabled) .mdc-notched-outline__trailing {
      border-color: #6366f1 !important;
      border-width: 2px !important;
    }
    .mat-mdc-form-field-label {
      color: #94a3b8 !important;
    }
    .mat-mdc-input-element {
      color: #ffffff !important;
    }
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    margin: 1rem 0;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding-top: 1.5rem;

    .btn-cancel {
      color: #94a3b8;
      &:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }
    }

    .btn-submit {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff;
      font-weight: 600;
      padding: 0.5rem 1.5rem;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);

      &:hover {
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
      }
    }
  }
}
```

---

## 3. Conexión del Checkout en el Dashboard Layout (`dashboard-layout.ts`)

Modifica la lógica del layout principal del dashboard para inyectar `MatDialog` y el `OrderService`. Al presionar el botón de **Comprar Ahora** del carrito:
1. Abre el diálogo de dirección.
2. Si el usuario confirma los datos, llama al servicio `createOrder(dto)`.
3. El backend crea la orden en estado `pending`, disminuye el inventario y vacía automáticamente el carrito.
4. El frontend sincroniza el estado local del carrito y redirecciona a `/dashboard/checkout/:id`.

### Modificaciones en [dashboard-layout.ts](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/features/dashboard/pages/dashboard-layout/dashboard-layout.ts):

Actualiza la parte superior de imports, el constructor y el método `checkout`:

```typescript
import { MatDialog } from '@angular/material/dialog';
import { OrderService } from '@/core/services/order/order.service';
import { AddressDialogComponent } from '../components/address-dialog/address-dialog';
import { SnackarService } from '@/core/services/snackar/snackar.service';

export class DashboardLayout {
  // Inyecciones adicionales
  private readonly dialog = inject(MatDialog);
  private readonly orderService = inject(OrderService);
  private readonly snackbar = inject(SnackarService);
  
  // ... resto de variables y constructor

  checkout(cartDrawer: any): void {
    cartDrawer.close();

    // 1. Abrir diálogo modal
    const dialogRef = this.dialog.open(AddressDialogComponent, {
      width: '600px',
      disableClose: true,
      panelClass: 'custom-dialog-panel' // Puedes usar esta clase para overrides de layout
    });

    dialogRef.afterClosed().subscribe((addressResult) => {
      if (!addressResult) return; // Canceló el modal

      this.snackbar.show('Creando tu orden...');

      // 2. Enviar datos al Backend
      this.orderService.createOrder(addressResult).subscribe({
        next: (order) => {
          this.snackbar.show('Orden creada con éxito. Redirigiendo al pago...');
          
          // 3. Forzar actualización del carrito local para que se vacíe visualmente
          this.cartService.loadCartFromServer().subscribe();

          // 4. Redirigir al formulario seguro de Stripe
          this.router.navigate(['/dashboard/checkout', order.id]);
        },
        error: (err) => {
          console.error('Error al crear orden:', err);
          this.snackbar.show(err.error?.message || 'Error al procesar la orden de compra');
        }
      });
    });
  }
  
  // ... resto de métodos
}
```

---

## 4. Pantalla de Pedido Exitoso (`order-success`)

Tras pagar con éxito en Stripe, el usuario es redirigido a `/dashboard/orders/success?orderId=XXX`. Esta vista debe ser muy premium y mostrar:
* Icono de éxito con micro-animaciones.
* Número de orden generado por el backend (`ORD-YYYYMMDD-XXXX`).
* Resumen de artículos comprados, costos (Subtotal, Envío, Impuestos, Total).
* Dirección a la que será despachado el pedido.

### Componente TS (`order-success.ts`):
Crea el archivo en `src/app/features/dashboard/pages/order-success/order-success.ts`:

```typescript
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '@/core/services/order/order.service';
import { Order } from '@/core/models/order.model';
import { SnackarService } from '@/core/services/snackar/snackar.service';
import { Material } from '@/shared/material/material';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [Material, CommonModule, RouterLink],
  templateUrl: './order-success.html',
  styleUrl: './order-success.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSuccess {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly snackbar = inject(SnackarService);

  orderId = signal<string | null>(null);
  order = signal<Order | null>(null);
  isLoading = signal<boolean>(true);

  constructor() {
    effect(() => {
      const id = this.route.snapshot.queryParamMap.get('orderId');
      if (!id) {
        this.snackbar.show('Orden no encontrada');
        this.router.navigate(['/dashboard']);
        return;
      }
      this.orderId.set(id);
      this.loadOrderDetails(id);
    });
  }

  private loadOrderDetails(id: string): void {
    this.orderService.getOrderById(id).subscribe({
      next: (order) => {
        this.order.set(order);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching order details:', err);
        this.snackbar.show('No se pudieron obtener los detalles del pedido');
        this.isLoading.set(false);
      }
    });
  }
}
```

### Plantilla HTML (`order-success.html`):
Crea el archivo en `src/app/features/dashboard/pages/order-success/order-success.html`:

```html
<div class="success-wrapper">
  @if (isLoading()) {
    <div class="loader-container">
      <div class="spinner"></div>
      <p>Cargando detalles de tu compra...</p>
    </div>
  } @else if (order(); as orderData) {
    <div class="success-card">
      <div class="icon-section animate-bounce">
        <span class="material-icons check-icon">check_circle</span>
      </div>

      <h1>¡Pago Confirmado! 🎉</h1>
      <p class="subtitle">Gracias por tu compra. Tu pedido está en camino.</p>

      <!-- Resumen Principal -->
      <div class="summary-section">
        <div class="summary-row">
          <span>Número de Pedido:</span>
          <strong>{{ orderData.orderNumber }}</strong>
        </div>
        <div class="summary-row">
          <span>Estado del Pago:</span>
          <span class="badge paid">Pagado</span>
        </div>
        <div class="summary-row">
          <span>Fecha de Compra:</span>
          <span>{{ orderData.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
        </div>
      </div>

      <!-- Dirección de Envío -->
      <div class="address-section">
        <h3>Dirección de Entrega 🚚</h3>
        <p class="address-text">
          {{ orderData.shippingAddress.street }}<br />
          {{ orderData.shippingAddress.city }}, {{ orderData.shippingAddress.state }} {{ orderData.shippingAddress.postalCode }}<br />
          {{ orderData.shippingAddress.country }}
        </p>
      </div>

      <!-- Resumen Financiero -->
      <div class="financials-section">
        <h3>Detalle de Cobro 💳</h3>
        <div class="financial-row">
          <span>Subtotal:</span>
          <span>${{ orderData.subtotal | number: '1.2-2' }}</span>
        </div>
        <div class="financial-row">
          <span>Impuestos (10%):</span>
          <span>${{ orderData.taxAmount | number: '1.2-2' }}</span>
        </div>
        <div class="financial-row">
          <span>Envío:</span>
          <span>{{ orderData.shippingCost === 0 ? 'Gratis' : '$' + (orderData.shippingCost | number: '1.2-2') }}</span>
        </div>
        <div class="financial-row total-row">
          <span>Total Cobrado:</span>
          <strong>${{ orderData.total | number: '1.2-2' }} {{ orderData.currency }}</strong>
        </div>
      </div>

      <div class="actions-section">
        <button mat-raised-button color="primary" routerLink="/dashboard" class="btn-primary">
          Ir al Inicio
        </button>
        <button mat-button routerLink="/dashboard/orders" class="btn-secondary">
          Ver Mis Pedidos
        </button>
      </div>
    </div>
  }
</div>
```

### Estilos SCSS (`order-success.scss`):
Crea el archivo en `src/app/features/dashboard/pages/order-success/order-success.scss`:

```scss
.success-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 2rem;
  box-sizing: border-box;

  .loader-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #94a3b8;
  }

  .success-card {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 3rem 2.5rem;
    width: 100%;
    max-width: 550px;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);

    .icon-section {
      margin-bottom: 1.5rem;

      .check-icon {
        font-size: 5rem;
        background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
        background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 0 15px rgba(34, 197, 94, 0.4));
      }
    }

    h1 {
      font-size: 2rem;
      font-weight: 900;
      color: #ffffff;
      margin: 0 0 0.5rem 0;
      font-family: 'Outfit', sans-serif;
    }

    .subtitle {
      color: #94a3b8;
      margin-bottom: 2.5rem;
      font-size: 1.05rem;
    }

    .summary-section, .address-section, .financials-section {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 16px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      text-align: left;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      font-size: 0.95rem;

      &:last-child {
        margin-bottom: 0;
      }

      span {
        color: #94a3b8;
      }

      strong {
        color: #ffffff;
      }
    }

    .badge {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;

      &.paid {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.2);
      }
    }

    h3 {
      font-size: 1rem;
      font-weight: 700;
      color: #818cf8;
      margin: 0 0 0.75rem 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .address-text {
      color: #e2e8f0;
      font-size: 0.95rem;
      line-height: 1.5;
      margin: 0;
    }

    .financial-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      color: #cbd5e1;

      &.total-row {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        color: #ffffff;
        font-size: 1.1rem;

        strong {
          color: #818cf8;
          font-size: 1.25rem;
          font-weight: 850;
        }
      }
    }

    .actions-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 2rem;

      button {
        width: 100%;
        padding: 0.75rem;
        border-radius: 12px;
        font-family: 'Outfit', sans-serif;
        font-weight: 600;
      }

      .btn-primary {
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        color: #ffffff;
        box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
        border: none;

        &:hover {
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }
      }

      .btn-secondary {
        color: #94a3b8;
        &:hover {
          background: rgba(255, 255, 255, 0.03);
          color: #ffffff;
        }
      }
    }
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 5. Historial de Pedidos (`my-orders`)

Esta pantalla permitirá a los usuarios listar todas sus compras anteriores, ver el desglose financiero, fecha de registro, estado del flujo de entrega y cancelar la orden si está en estado `pending`.

### Componente TS (`my-orders.ts`):
Crea el archivo en `src/app/features/dashboard/pages/my-orders/my-orders.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { OrderService } from '@/core/services/order/order.service';
import { Order } from '@/core/models/order.model';
import { SnackarService } from '@/core/services/snackar/snackar.service';
import { Material } from '@/shared/material/material';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [Material, CommonModule],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyOrders implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly snackbar = inject(SnackarService);
  private readonly router = inject(Router);

  orders = signal<Order[]>([]);
  isLoading = signal<boolean>(true);

  // Columnas a mostrar en la tabla de Material
  displayedColumns: string[] = ['orderNumber', 'createdAt', 'total', 'status', 'actions'];

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading.set(true);
    this.orderService.getMyOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.snackbar.show('Error al obtener el historial de pedidos');
        this.isLoading.set(false);
      }
    });
  }

  cancelOrder(orderId: string): void {
    if (!confirm('¿Estás seguro de que deseas cancelar este pedido? Se restaurará el stock de los productos.')) {
      return;
    }

    this.orderService.cancelOrder(orderId).subscribe({
      next: () => {
        this.snackbar.show('Pedido cancelado correctamente');
        this.loadOrders(); // Recargar lista
      },
      error: (err) => {
        console.error('Error cancelling order:', err);
        this.snackbar.show(err.error?.message || 'No se pudo cancelar el pedido');
      }
    });
  }

  payPendingOrder(orderId: string): void {
    this.router.navigate(['/dashboard/checkout', orderId]);
  }
}
```

### Plantilla HTML (`my-orders.html`):
Crea el archivo en `src/app/features/dashboard/pages/my-orders/my-orders.html`:

```html
<div class="orders-container">
  <div class="orders-header">
    <h1>Mis Pedidos 📦</h1>
    <p>Visualiza el estado de tus compras e historial de órdenes.</p>
  </div>

  @if (isLoading()) {
    <div class="loader-container">
      <div class="spinner"></div>
      <p>Cargando tus pedidos...</p>
    </div>
  } @else {
    <div class="orders-table-wrapper">
      <table mat-table [dataSource]="orders()" class="custom-table">
        <!-- Número de Orden -->
        <ng-container matColumnDef="orderNumber">
          <th mat-header-cell *matHeaderCellDef>Pedido</th>
          <td mat-cell *matCellDef="let element" class="order-number-cell">
            {{ element.orderNumber }}
          </td>
        </ng-container>

        <!-- Fecha de Registro -->
        <ng-container matColumnDef="createdAt">
          <th mat-header-cell *matHeaderCellDef>Fecha</th>
          <td mat-cell *matCellDef="let element">
            {{ element.createdAt | date: 'dd/MM/yyyy HH:mm' }}
          </td>
        </ng-container>

        <!-- Monto Total -->
        <ng-container matColumnDef="total">
          <th mat-header-cell *matHeaderCellDef>Monto</th>
          <td mat-cell *matCellDef="let element" class="total-cell">
            ${{ element.total | number: '1.2-2' }} {{ element.currency }}
          </td>
        </ng-container>

        <!-- Estado en Insignia -->
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Estado</th>
          <td mat-cell *matCellDef="let element">
            <span class="badge" [ngClass]="element.orderStatus">
              {{ element.orderStatus }}
            </span>
          </td>
        </ng-container>

        <!-- Acciones Rápidas -->
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Acciones</th>
          <td mat-cell *matCellDef="let element" class="actions-cell">
            @if (element.orderStatus === 'pending') {
              <button mat-raised-button color="primary" class="btn-pay-now" (click)="payPendingOrder(element.id)">
                Pagar 💳
              </button>
              <button mat-button class="btn-cancel-order" (click)="cancelOrder(element.id)">
                Cancelar
              </button>
            } @else {
              <span class="no-actions-text">-</span>
            }
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>

      @if (orders().length === 0) {
        <div class="empty-state">
          <span class="material-icons">receipt_long</span>
          <p>No tienes ningún pedido registrado todavía.</p>
        </div>
      }
    </div>
  }
</div>
```

### Estilos SCSS (`my-orders.scss`):
Crea el archivo en `src/app/features/dashboard/pages/my-orders/my-orders.scss`:

```scss
.orders-container {
  padding: 1rem;
  animation: fadeIn 0.4s ease;

  .orders-header {
    margin-bottom: 2rem;

    h1 {
      font-size: 2rem;
      font-weight: 850;
      color: #ffffff;
      margin: 0 0 0.5rem 0;
      font-family: 'Outfit', sans-serif;
    }

    p {
      color: #94a3b8;
      font-size: 1rem;
      margin: 0;
    }
  }

  .loader-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem;
    color: #94a3b8;
  }

  .orders-table-wrapper {
    background: rgba(30, 41, 59, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }

  .custom-table {
    width: 100%;
    background: transparent !important;
    border-collapse: collapse;

    ::ng-deep {
      .mat-mdc-header-cell {
        color: #818cf8 !important;
        font-weight: 700 !important;
        font-size: 0.9rem !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        padding: 1.25rem 1.5rem !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      }

      .mat-mdc-cell {
        color: #e2e8f0 !important;
        font-size: 0.95rem !important;
        padding: 1.25rem 1.5rem !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
      }

      .mat-mdc-row:hover {
        background-color: rgba(255, 255, 255, 0.02);
      }
    }
  }

  .order-number-cell {
    font-weight: 600;
    color: #ffffff !important;
    font-family: monospace;
    font-size: 1rem;
  }

  .total-cell {
    font-weight: 700;
    color: #ffffff !important;
  }

  .badge {
    display: inline-block;
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    border: 1px solid transparent;

    &.pending {
      background: rgba(234, 179, 8, 0.1);
      color: #facc15;
      border-color: rgba(234, 179, 8, 0.2);
    }

    &.paid, &.delivered {
      background: rgba(34, 197, 94, 0.1);
      color: #4ade80;
      border-color: rgba(34, 197, 94, 0.2);
    }

    &.processing, &.shipped {
      background: rgba(99, 102, 241, 0.1);
      color: #818cf8;
      border-color: rgba(99, 102, 241, 0.2);
    }

    &.cancelled, &.refunded {
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
      border-color: rgba(239, 68, 68, 0.2);
    }
  }

  .actions-cell {
    display: flex;
    gap: 0.5rem;
    align-items: center;

    .btn-pay-now {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
    }

    .btn-cancel-order {
      color: #ef4444;
      font-size: 0.85rem;
      
      &:hover {
        background: rgba(239, 68, 68, 0.12);
      }
    }
  }

  .no-actions-text {
    color: #64748b;
    padding-left: 1rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: #64748b;
    gap: 1rem;

    span {
      font-size: 3rem;
      color: #334155;
    }
    
    p {
      margin: 0;
      font-weight: 500;
    }
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

## 6. Registro de Rutas (`dashboard.routes.ts`)

Asegúrate de importar los componentes standalones y configurar las rutas hijas de `/dashboard` en tu archivo de rutas.

### Configuración en [dashboard.routes.ts](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/features/dashboard/dashboard.routes.ts):

Añade las siguientes rutas de carga diferida:

```typescript
            {
                path: 'orders',
                loadComponent: () => import('./pages/my-orders/my-orders').then((m) => m.MyOrders),
                canActivate: [authGuard]
            },
            {
                path: 'orders/success',
                loadComponent: () => import('./pages/order-success/order-success').then((m) => m.OrderSuccess),
                canActivate: [authGuard]
            },
```

---

## 7. Módulo de Administración de Pedidos (`admin` page)

Este módulo (que ahora es accesible para `admin`, `super_admin`, `developer` y `seller`) permite listar todos los pedidos de la plataforma y administrarlos.

### Código TS (`admin.ts`):
Reemplaza [admin.ts](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/features/dashboard/pages/admin/admin.ts):

```typescript
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { OrderService } from '@/core/services/order/order.service';
import { Order } from '@/core/models/order.model';
import { SnackarService } from '@/core/services/snackar/snackar.service';
import { Material } from '@/shared/material/material';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [Material, CommonModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Admin implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly snackbar = inject(SnackarService);

  orders = signal<Order[]>([]);
  isLoading = signal<boolean>(true);

  displayedColumns: string[] = ['orderNumber', 'userEmail', 'createdAt', 'total', 'status', 'actions'];

  ngOnInit(): void {
    this.loadAllOrders();
  }

  loadAllOrders(): void {
    this.isLoading.set(true);
    this.orderService.getAllOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading all orders:', err);
        this.snackbar.show('Error al obtener pedidos globales');
        this.isLoading.set(false);
      }
    });
  }

  updateStatus(orderId: string, status: string): void {
    this.orderService.updateOrderStatus(orderId, status).subscribe({
      next: () => {
        this.snackbar.show(`Pedido actualizado a ${status} 📦`);
        this.loadAllOrders(); // Recargar
      },
      error: (err) => {
        console.error('Error updating status:', err);
        this.snackbar.show(err.error?.message || 'No se pudo actualizar el estado');
      }
    });
  }

  cancelOrder(orderId: string): void {
    if (!confirm('¿Estás seguro de cancelar esta orden desde administración?')) return;

    this.orderService.cancelOrder(orderId).subscribe({
      next: () => {
        this.snackbar.show('Pedido cancelado por administrador');
        this.loadAllOrders(); // Recargar
      },
      error: (err) => {
        console.error('Error cancelling order:', err);
        this.snackbar.show('No se pudo cancelar el pedido');
      }
    });
  }
}
```

### Plantilla HTML (`admin.html`):
Reemplaza [admin.html](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/features/dashboard/pages/admin/admin.html):

```html
<div class="admin-container">
  <div class="admin-header">
    <h1>Administración de Pedidos 🛡️</h1>
    <p>Gestiona todos los pedidos del sistema y controla el estado de las entregas.</p>
  </div>

  @if (isLoading()) {
    <div class="loader-container">
      <div class="spinner"></div>
      <p>Cargando lista de pedidos globales...</p>
    </div>
  } @else {
    <div class="orders-table-wrapper">
      <table mat-table [dataSource]="orders()" class="custom-table">
        <!-- Número de Orden -->
        <ng-container matColumnDef="orderNumber">
          <th mat-header-cell *matHeaderCellDef>Pedido</th>
          <td mat-cell *matCellDef="let element" class="order-number-cell">
            {{ element.orderNumber }}
          </td>
        </ng-container>

        <!-- Email del Cliente -->
        <ng-container matColumnDef="userEmail">
          <th mat-header-cell *matHeaderCellDef>Cliente</th>
          <td mat-cell *matCellDef="let element">
            {{ element.user?.email || 'ID: ' + element.userId }}
          </td>
        </ng-container>

        <!-- Fecha -->
        <ng-container matColumnDef="createdAt">
          <th mat-header-cell *matHeaderCellDef>Fecha</th>
          <td mat-cell *matCellDef="let element">
            {{ element.createdAt | date: 'dd/MM/yyyy HH:mm' }}
          </td>
        </ng-container>

        <!-- Monto -->
        <ng-container matColumnDef="total">
          <th mat-header-cell *matHeaderCellDef>Monto</th>
          <td mat-cell *matCellDef="let element" class="total-cell">
            ${{ element.total | number: '1.2-2' }} {{ element.currency }}
          </td>
        </ng-container>

        <!-- Estado -->
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Estado</th>
          <td mat-cell *matCellDef="let element">
            <span class="badge" [ngClass]="element.orderStatus">
              {{ element.orderStatus }}
            </span>
          </td>
        </ng-container>

        <!-- Acciones de Gestión -->
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Gestión</th>
          <td mat-cell *matCellDef="let element" class="actions-cell">
            @if (element.orderStatus === 'paid') {
              <button mat-raised-button color="accent" class="btn-ship" (click)="updateStatus(element.id, 'shipped')">
                Despachar 📦
              </button>
            } @else if (element.orderStatus === 'shipped') {
              <button mat-raised-button color="primary" class="btn-deliver" (click)="updateStatus(element.id, 'delivered')">
                Entregar ✅
              </button>
            } @else if (element.orderStatus === 'pending') {
              <button mat-button class="btn-cancel" (click)="cancelOrder(element.id)">
                Cancelar
              </button>
            } @else {
              <span class="completed-text">Completado</span>
            }
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>

      @if (orders().length === 0) {
        <div class="empty-state">
          <span class="material-icons">no_accounts</span>
          <p>No se encontraron compras registradas en el sistema.</p>
        </div>
      }
    </div>
  }
</div>
```

### Estilos SCSS (`admin.scss`):
Reemplaza [admin.scss](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/features/dashboard/pages/admin/admin.scss):

```scss
.admin-container {
  padding: 1rem;
  animation: fadeIn 0.4s ease;

  .admin-header {
    margin-bottom: 2rem;

    h1 {
      font-size: 2rem;
      font-weight: 850;
      color: #ffffff;
      margin: 0 0 0.5rem 0;
      font-family: 'Outfit', sans-serif;
    }

    p {
      color: #94a3b8;
      font-size: 1rem;
      margin: 0;
    }
  }

  .loader-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem;
    color: #94a3b8;
  }

  .orders-table-wrapper {
    background: rgba(30, 41, 59, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }

  .custom-table {
    width: 100%;
    background: transparent !important;
    border-collapse: collapse;

    ::ng-deep {
      .mat-mdc-header-cell {
        color: #818cf8 !important;
        font-weight: 700 !important;
        font-size: 0.9rem !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        padding: 1.25rem 1.5rem !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      }

      .mat-mdc-cell {
        color: #e2e8f0 !important;
        font-size: 0.95rem !important;
        padding: 1.25rem 1.5rem !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
      }

      .mat-mdc-row:hover {
        background-color: rgba(255, 255, 255, 0.02);
      }
    }
  }

  .order-number-cell {
    font-weight: 600;
    color: #ffffff !important;
    font-family: monospace;
    font-size: 1rem;
  }

  .total-cell {
    font-weight: 700;
    color: #ffffff !important;
  }

  .badge {
    display: inline-block;
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    border: 1px solid transparent;

    &.pending {
      background: rgba(234, 179, 8, 0.1);
      color: #facc15;
      border-color: rgba(234, 179, 8, 0.2);
    }

    &.paid {
      background: rgba(16, 185, 129, 0.1);
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.2);
    }

    &.processing, &.shipped {
      background: rgba(99, 102, 241, 0.1);
      color: #818cf8;
      border-color: rgba(99, 102, 241, 0.2);
    }

    &.delivered {
      background: rgba(34, 197, 94, 0.1);
      color: #4ade80;
      border-color: rgba(34, 197, 94, 0.2);
    }

    &.cancelled, &.refunded {
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
      border-color: rgba(239, 68, 68, 0.2);
    }
  }

  .actions-cell {
    display: flex;
    gap: 0.5rem;
    align-items: center;

    .btn-ship {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #ffffff;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .btn-deliver {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .btn-cancel {
      color: #ef4444;
      font-size: 0.85rem;
      
      &:hover {
        background: rgba(239, 68, 68, 0.12);
      }
    }
  }

  .completed-text {
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: #64748b;
    gap: 1rem;

    span {
      font-size: 3rem;
      color: #334155;
    }
    
    p {
      margin: 0;
      font-weight: 500;
    }
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

