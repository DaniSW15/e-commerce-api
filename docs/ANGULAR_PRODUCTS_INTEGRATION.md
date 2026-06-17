# 🛒 Guía: Integración de Endpoints de Productos en Angular (v17+)

Esta guía explica detalladamente cómo estructurar, modelar y consumir los endpoints de **Productos** y **Categorías** del backend NestJS utilizando las mejores prácticas de Angular moderno (Signals, Reactive FormControls y RxJS).

---

## 1. Definición de Modelos e Interfaces (`product.model.ts`)

Crea este archivo en tu directorio de modelos del frontend (por ejemplo, `src/app/core/models/product.model.ts`) para definir el tipado de datos fuerte:

```typescript
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  children?: Category[]; // Estructura jerárquica (árbol)
}

export interface ProductImage {
  id: string;
  url: string;
  altText?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  comparePrice?: number;
  stockQuantity: number;
  status: 'draft' | 'active' | 'archived';
  averageRating: number;
  reviewCount: number;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

// Estructura estándar para respuestas paginadas del backend
export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Filtros de búsqueda y listado general (GET /products)
export interface ProductFilters {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

// Criterios de ordenamiento para la búsqueda avanzada
export type SearchSortBy = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'name';

// Parámetros de búsqueda en texto completo (GET /products/search)
export interface SearchProductParams {
  query: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: SearchSortBy;
  page?: number;
  limit?: number;
}
```

---

## 2. Creación del Servicio de Productos (`product.service.ts`)

Implementa el servicio (ej. `src/app/core/services/product/product.service.ts`) utilizando `HttpClient` e inyección de dependencias funcional:

```typescript
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { Category, PaginatedResponse, Product, ProductFilters, SearchProductParams } from '../../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/products`;

  /**
   * Obtener productos paginados con filtros tradicionales
   */
  getProducts(filters: ProductFilters): Observable<PaginatedResponse<Product>> {
    let params = new HttpParams();
    
    if (filters.search) params = params.set('search', filters.search);
    if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters.minPrice !== undefined) params = params.set('minPrice', filters.minPrice.toString());
    if (filters.maxPrice !== undefined) params = params.set('maxPrice', filters.maxPrice.toString());
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<PaginatedResponse<Product>>(this.baseUrl, { params });
  }

  /**
   * Búsqueda en texto completo (Full-text Search en título, descripción y SKU)
   */
  searchProducts(searchParams: SearchProductParams): Observable<PaginatedResponse<Product>> {
    let params = new HttpParams().set('query', searchParams.query);

    if (searchParams.categoryId) params = params.set('categoryId', searchParams.categoryId);
    if (searchParams.minPrice !== undefined) params = params.set('minPrice', searchParams.minPrice.toString());
    if (searchParams.maxPrice !== undefined) params = params.set('maxPrice', searchParams.maxPrice.toString());
    if (searchParams.sortBy) params = params.set('sortBy', searchParams.sortBy);
    if (searchParams.page) params = params.set('page', searchParams.page.toString());
    if (searchParams.limit) params = params.set('limit', searchParams.limit.toString());

    return this.http.get<PaginatedResponse<Product>>(`${this.baseUrl}/search`, { params });
  }

  /**
   * Obtener detalles de un producto mediante su Slug (amigable para SEO)
   */
  getProductBySlug(slug: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${slug}`);
  }

  /**
   * Obtener árbol estructurado de categorías
   */
  getCategoriesTree(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/categories/tree`);
  }
}
```

---

## 3. Implementación Reactiva del Catálogo (Componente)

Para optimizar las peticiones de red al escribir en el campo de búsqueda, se recomienda usar los operadores `debounceTime` (espera a que el usuario deje de escribir) y `switchMap` (cancela peticiones anteriores si se inicia una nueva):

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-catalog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-catalog.component.html',
  styleUrl: './product-catalog.component.scss'
})
export class ProductCatalogComponent implements OnInit {
  private readonly productService = inject(ProductService);

  // FormControl reactivo para asociar con el input del buscador
  searchControl = new FormControl('');

  // Signals para el control de estados de la vista
  products = signal<Product[]>([]);
  isLoading = signal<boolean>(false);
  totalProducts = signal<number>(0);

  ngOnInit(): void {
    // 1. Cargar catálogo por defecto al iniciar
    this.loadInitialProducts();

    // 2. Control de búsqueda con retardo (Debounce de 400ms)
    this.searchControl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(), // Evita realizar búsquedas si el texto no ha cambiado
      tap(() => this.isLoading.set(true)),
      switchMap((searchTerm) => {
        if (searchTerm && searchTerm.trim() !== '') {
          return this.productService.searchProducts({ query: searchTerm });
        } else {
          return this.productService.getProducts({ page: 1, limit: 12 });
        }
      })
    ).subscribe({
      next: (response) => {
        this.products.set(response.items);
        this.totalProducts.set(response.meta.total);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al buscar productos:', err);
        this.isLoading.set(false);
      }
    });
  }

  private loadInitialProducts(): void {
    this.isLoading.set(true);
    this.productService.getProducts({ page: 1, limit: 12 }).subscribe({
      next: (response) => {
        this.products.set(response.items);
        this.totalProducts.set(response.meta.total);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }
}
```

---

## 4. Renderizado en Plantilla HTML (`product-catalog.component.html`)

Aprovecha el nuevo flujo de control estructural `@for` / `@empty` de Angular moderno para renderizar los productos o mostrar una alerta si no hay coincidencias:

```html
<div class="catalog-container">
  
  <!-- Barra de búsqueda -->
  <div class="search-bar">
    <input 
      type="text" 
      [formControl]="searchControl" 
      placeholder="Buscar productos por nombre, SKU o descripción..." 
    />
    @if (isLoading()) {
      <span class="spinner-loader">Buscando...</span>
    }
  </div>

  <!-- Totalizadores -->
  <div class="catalog-header">
    <p>Se encontraron <strong>{{ totalProducts() }}</strong> productos.</p>
  </div>

  <!-- Rejilla de productos -->
  <div class="product-grid">
    @for (product of products(); track product.id) {
      <div class="product-card">
        <!-- Renderiza la primera imagen disponible o un placeholder -->
        <div class="image-wrapper">
          <img 
            [src]="product.images[0]?.url || 'assets/images/placeholder.png'" 
            [alt]="product.name" 
          />
        </div>
        
        <div class="card-details">
          <h3>{{ product.name }}</h3>
          <p class="sku">SKU: {{ product.sku }}</p>
          <p class="price">${{ product.price }}</p>
          
          <!-- Estado de Inventario -->
          @if (product.stockQuantity > 0) {
            <span class="stock-badge in-stock">En Stock ({{ product.stockQuantity }})</span>
          } @else {
            <span class="stock-badge out-of-stock">Agotado</span>
          }
        </div>
      </div>
    } @empty {
      <div class="no-results">
        <p>No se encontraron productos para tu búsqueda.</p>
      </div>
    }
  </div>
</div>
```
