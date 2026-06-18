# 📝 Guía: Componente Formulario de Producto (Crear y Editar en uno solo)

Esta guía te guiará para implementar el componente `ProductForm` de forma senior. Aprenderás a utilizar un único formulario para **Creación** y **Edición**, cargando dinámicamente los datos si se recibe un ID en la ruta.

---

## 1. Actualizar el Servicio de Productos (`products-service.ts`)

Añade los métodos de administración al final de tu servicio en `src/app/features/products/services/products-service.ts`:

```typescript
// Agregar al inicio si no están importados:
// import { CreateProductDto, UpdateProductDto } from '@/core/models/product.model';

createProduct(dto: any): Observable<Product> {
    return this.http.post<Product>(`${this.API}`, dto);
}

updateProduct(id: string, dto: any): Observable<Product> {
    return this.http.patch<Product>(`${this.API}/${id}`, dto);
}

deleteProduct(id: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/${id}`);
}
```

---

## 2. Registrar las Rutas del Formulario

En tu archivo [dashboard.routes.ts](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/features/dashboard/dashboard.routes.ts), registra las rutas para crear y editar, apuntando al mismo componente `ProductForm`:

```typescript
{
    path: 'products/create',
    loadComponent: () => import('../products/pages/product-form/product-form').then((m) => m.ProductForm),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'seller'] }
},
{
    path: 'products/edit/:id',
    loadComponent: () => import('../products/pages/product-form/product-form').then((m) => m.ProductForm),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'seller'] }
}
```

---

## 3. Implementar el Controlador Reactivo (`product-form.ts`)

Utiliza `FormBuilder` para agrupar los controles del formulario y `ActivatedRoute` para detectar el modo de operación (si existe el parámetro `:id` en la ruta, estamos en modo **Edición**).

Implementa la estructura en `src/app/features/products/pages/product-form/product-form.ts`:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductsService } from '../../services/products-service';
import { Category, Product } from '@/core/models/product.model';
import { SnackarService } from '@/core/services/snackar/snackar.service';
import { Material } from '@/shared/material/material'; // Si usas inputs de Angular Material

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Material],
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
})
export class ProductForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductsService);
  private readonly snackbar = inject(SnackarService);

  productForm!: FormGroup;
  
  // Signals para estados
  isEditMode = signal<boolean>(false);
  productId = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  categories = signal<Category[]>([]);

  ngOnInit(): void {
    // 1. Inicializar formulario con validaciones
    this.initForm();

    // 2. Cargar árbol de categorías para el selector dropdown
    this.loadCategories();

    // 3. Detectar si la ruta tiene un ID de producto (Modo Edición)
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.productId.set(id);
      this.loadProductDetails(id);
    }
  }

  private initForm(): void {
    this.productForm = this.fb.group({
      sku: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-_]+$/)]],
      name: ['', [Validators.required, Validators.minLength(3)]],
      slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-_]+$/)]],
      price: [0, [Validators.required, Validators.min(0)]],
      comparePrice: [null, [Validators.min(0)]],
      cost: [null, [Validators.min(0)]],
      stockQuantity: [0, [Validators.required, Validators.min(0)]],
      categoryId: ['', [Validators.required]],
      description: [''],
      status: ['active', [Validators.required]]
    });
  }

  private loadCategories(): void {
    this.productService.getCategoriesTree().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => this.snackbar.error('Error al cargar categorías')
    });
  }

  private loadProductDetails(id: string): void {
    this.isLoading.set(true);
    // Nota: Si no tienes getProductById, puedes adaptar getProductBySlug
    // o implementar getProductById(id) en tu ProductsService
    this.productService.getProducts({}).subscribe({
      next: (res) => {
        const product = res.items.find(p => p.id === id);
        if (product) {
          this.productForm.patchValue({
            sku: product.sku,
            name: product.name,
            slug: product.slug,
            price: product.price,
            comparePrice: product.comparePrice,
            stockQuantity: product.stockQuantity,
            categoryId: product.categoryId,
            description: product.description,
            status: product.status
          });
        } else {
          this.snackbar.error('No se encontró el producto');
          this.router.navigate(['/dashboard/products']);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackbar.error('Error al cargar datos del producto');
      }
    });
  }

  onSubmit(): void {
    if (this.productForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    const formValues = this.productForm.value;

    const request$ = this.isEditMode()
      ? this.productService.updateProduct(this.productId()!, formValues)
      : this.productService.createProduct(formValues);

    request$.subscribe({
      next: () => {
        this.snackbar.success(this.isEditMode() ? 'Producto actualizado' : 'Producto creado');
        this.router.navigate(['/dashboard/products']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.snackbar.error(err.error?.message || 'Error al guardar producto');
      }
    });
  }
}
```

---

## 4. Estructurar la Plantilla Vista (`product-form.html`)

En `src/app/features/products/pages/product-form/product-form.html`, diseña una interfaz premium. Si utilizas Angular Material (como en tu login), puedes estructurarlo así:

```html
<div class="form-wrapper">
  <div class="form-card">
    <h2>{{ isEditMode() ? 'Editar Producto' : 'Crear Producto' }}</h2>
    
    @if (isLoading()) {
      <div class="spinner-container">
        <p>Cargando información...</p>
      </div>
    } @else {
      <form [formGroup]="productForm" (ngSubmit)="onSubmit()">
        <!-- SKU y Slug en fila -->
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>SKU del Producto</mat-label>
            <input matInput formControlName="sku" placeholder="Ej: SKU-LAP-001">
            @if (productForm.get('sku')?.hasError('required')) {
              <mat-error>El SKU es obligatorio</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Slug (URL amigable)</mat-label>
            <input matInput formControlName="slug" placeholder="ej-laptop-pro-15">
            @if (productForm.get('slug')?.hasError('required')) {
              <mat-error>El slug es obligatorio</mat-error>
            }
          </mat-form-field>
        </div>

        <!-- Nombre -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Nombre del Producto</mat-label>
          <input matInput formControlName="name" placeholder="Ej: Laptop Pro 15 pulgadas">
          @if (productForm.get('name')?.hasError('required')) {
            <mat-error>El nombre es obligatorio</mat-error>
          }
        </mat-form-field>

        <!-- Precios y Costo en fila -->
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Precio Venta ($)</mat-label>
            <input type="number" matInput formControlName="price">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Precio Comparación ($)</mat-label>
            <input type="number" matInput formControlName="comparePrice" placeholder="Precio tachado">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Costo Unitario ($)</mat-label>
            <input type="number" matInput formControlName="cost" placeholder="Costo interno">
          </mat-form-field>
        </div>

        <!-- Stock y Categoría -->
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Cantidad en Stock</mat-label>
            <input type="number" matInput formControlName="stockQuantity">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Categoría</mat-label>
            <mat-select formControlName="categoryId">
              @for (cat of categories(); track cat.id) {
                <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Estado y Descripción -->
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Estado de Publicación</mat-label>
            <mat-select formControlName="status">
              <mat-option value="draft">Borrador (Draft)</mat-option>
              <mat-option value="active">Activo (Publicado)</mat-option>
              <mat-option value="archived">Archivado</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="description" rows="4"></textarea>
        </mat-form-field>

        <!-- Botones de acción -->
        <div class="form-actions">
          <button type="button" mat-stroked-button routerLink="/dashboard/products">Cancelar</button>
          <button type="submit" mat-raised-button color="primary" [disabled]="productForm.invalid || isSubmitting()">
            {{ isSubmitting() ? 'Guardando...' : (isEditMode() ? 'Actualizar Producto' : 'Guardar Producto') }}
          </button>
        </div>
      </form>
    }
  </div>
</div>
```
