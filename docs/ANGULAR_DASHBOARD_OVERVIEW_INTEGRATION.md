# 📊 Guía: Implementación del Dashboard Overview (Resumen de Métricas)

Esta guía explica cómo integrar y programar la pantalla de inicio del panel (`Overview`) utilizando los servicios que ya has desarrollado (`OrderService` y `ProductsService`) combinados con **Angular Signals** y **Angular Material Table** para pintar un resumen con estadísticas de compra y pedidos recientes.

---

## 1. Planificación de la Interfaz del Panel (`Overview`)

Para crear un panel premium, el componente debe mostrar:
1.  **Tarjetas de Indicadores clave (KPIs):**
    *   **Total de Pedidos:** Cuántas órdenes ha realizado el usuario.
    *   **Total Invertido ($):** Sumatoria del total de sus órdenes pagadas (`paid`).
    *   **Catálogo Aura:** Número total de productos disponibles en la tienda.
2.  **Tabla de Pedidos Recientes:**
    *   Lista de las últimas 3 a 5 órdenes del usuario usando `mat-table` con columnas de Fecha, ID del Pedido, Estado de Pago (`OrderStatus`) y el Total.

---

## 2. Implementar el Controlador del Panel (`overview.ts`)

Edita el archivo `src/app/features/dashboard/pages/overview/overview.ts` para inyectar los servicios y construir las métricas con Signals computadas:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '@/core/services/order/order.service';
import { ProductsService } from '@/app/features/products/services/products-service';
import { Order } from '@/core/models/order.model';
import { Material } from '@/shared/material/material';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, Material, RouterLink],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Overview implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly productService = inject(ProductsService);

  // Signals de datos crudos
  myOrders = signal<Order[]>([]);
  totalCatalogProducts = signal<number>(0);
  isLoading = signal<boolean>(true);

  // 📈 Signals computadas para métricas rápidas
  totalOrdersCount = computed(() => this.myOrders().length);
  
  totalSpent = computed(() => {
    return this.myOrders()
      .filter(order => order.orderStatus === 'paid')
      .reduce((acc, order) => acc + Number(order.total), 0);
  });

  recentOrders = computed(() => {
    // Retorna las últimas 5 órdenes
    return this.myOrders().slice(0, 5);
  });

  // Columnas para la tabla de Material
  displayedColumns: string[] = ['id', 'createdAt', 'status', 'total', 'actions'];

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.isLoading.set(true);

    // Cargar historial de órdenes y contador de catálogo en paralelo
    this.orderService.getMyOrders().subscribe({
      next: (orders) => {
        this.myOrders.set(orders);
        this.checkLoadingState();
      },
      error: () => this.checkLoadingState()
    });

    this.productService.getProducts({ page: 1, limit: 1 }).subscribe({
      next: (res) => {
        this.totalCatalogProducts.set(res.meta.total);
        this.checkLoadingState();
      },
      error: () => this.checkLoadingState()
    });
  }

  private checkLoadingState(): void {
    // Simplemente apaga el loader tras completarse
    this.isLoading.set(false);
  }
}
```

---

## 3. Crear la Plantilla con Indicadores y Tabla (`overview.html`)

Edita el archivo `src/app/features/dashboard/pages/overview/overview.html` para estructurar la visualización:

```html
<div class="overview-wrapper">
  <h2>Resumen del Panel</h2>

  @if (isLoading()) {
    <div class="loader-container">
      <div class="spinner"></div>
      <p>Cargando datos del panel...</p>
    </div>
  } @else {
    <!-- Rejilla de Métricas (KPIs) -->
    <div class="metrics-grid">
      <!-- Tarjeta 1 -->
      <div class="metric-card">
        <div class="metric-icon indigo">receipt</div>
        <div class="metric-content">
          <span class="label">Mis Pedidos</span>
          <span class="value">{{ totalOrdersCount() }}</span>
        </div>
      </div>

      <!-- Tarjeta 2 -->
      <div class="metric-card">
        <div class="metric-icon green">payments</div>
        <div class="metric-content">
          <span class="label">Total Invertido</span>
          <span class="value">\${{ totalSpent() | number:'1.2-2' }}</span>
        </div>
      </div>

      <!-- Tarjeta 3 -->
      <div class="metric-card">
        <div class="metric-icon purple">local_mall</div>
        <div class="metric-content">
          <span class="label">Productos en Tienda</span>
          <span class="value">{{ totalCatalogProducts() }}</span>
        </div>
      </div>
    </div>

    <!-- Sección de Pedidos Recientes -->
    <div class="recent-orders-section">
      <div class="section-header">
        <h3>Últimos Pedidos</h3>
        <a routerLink="/dashboard/orders" class="link-all">Ver todos</a>
      </div>

      <div class="table-container">
        <table mat-table [dataSource]="recentOrders()">
          <!-- ID Column -->
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef>ID Pedido</th>
            <td mat-cell *matCellDef="let element">#{{ element.id.substring(0, 8) }}...</td>
          </ng-container>

          <!-- Fecha Column -->
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Fecha</th>
            <td mat-cell *matCellDef="let element">{{ element.createdAt | date:'dd/MM/yyyy' }}</td>
          </ng-container>

          <!-- Estado Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let element">
              <span class="status-badge" [ngClass]="element.orderStatus">
                {{ element.orderStatus | uppercase }}
              </span>
            </td>
          </ng-container>

          <!-- Total Column -->
          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef>Total</th>
            <td mat-cell *matCellDef="let element">\${{ element.total | number:'1.2-2' }}</td>
          </ng-container>

          <!-- Acciones Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let element">
              @if (element.orderStatus === 'pending') {
                <button mat-button color="accent" [routerLink]="['/dashboard/checkout', element.id]">
                  Pagar 💳
                </button>
              } @else {
                <button mat-button [routerLink]="['/dashboard/orders', element.id]">
                  Ver Detalle
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>

          <!-- Fila vacía si no hay registros -->
          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell" colspan="5">Aún no has realizado ninguna compra.</td>
          </tr >
        </table>
      </div>
    </div>
  }
</div>
```
