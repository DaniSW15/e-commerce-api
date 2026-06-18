# ⭐️ Guía: Integración del Sistema de Reseñas y Calificaciones (Reviews)

Esta guía detalla cómo implementar la interfaz de reseñas y valoraciones de productos utilizando **Angular Signals**, **Signal-based Forms** y estilos responsivos oscuros compatibles con la estética premium de la tienda.

---

## 1. Arquitectura del Flujo

El backend de NestJS restringe la creación de valoraciones mediante las siguientes reglas:
1. El usuario debe estar autenticado (`JwtAuthGuard`).
2. El usuario debe haber **comprado y pagado** el producto previamente.
3. Solo se permite **una reseña por usuario** para cada producto (evita spam).
4. El cálculo de `averageRating` y `reviewCount` se recalcula en la base de datos de manera automatizada tras añadir o borrar una reseña.

En el frontend estructuraremos la vista de la siguiente manera:
* **Cabecera del Detalle:** Mostrar estrellas promedio (`★ ★ ★ ★ ☆`) y conteo.
* **Sección de Reseñas:** Lista de valoraciones paginadas con iniciales del autor, estrellas y comentarios.
* **Formulario de Calificación:** Controles interactivos para seleccionar de 1 a 5 estrellas y escribir un comentario, enlazado con la validación de Signal Forms.
* **Control de Borrado:** Botón visible solo para el autor del comentario o administradores.

---

## 2. Lógica del Componente Detalle (`product-detail.ts`)

Añadiremos el consumo del `ReviewService` para cargar los comentarios del producto actual y la funcionalidad de envío.

### Modificaciones en [product-detail.ts](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/features/products/pages/product-detail/product-detail.ts):

Actualiza tu archivo de detalle inyectando el nuevo servicio y configurando los formularios:

```typescript
import { Component, effect, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductsService } from '../../services/products-service';
import { Product } from '@/core/models/product.model';
import { SnackarService } from '@/core/services/snackar/snackar.service';
import { CartService } from '@/core/services/cart/cart.service';
import { AuthService } from '@/core/services/auth/auth-service';
import { ReviewService } from '@/core/services/review/review.service'; // 1. Importar el servicio
import { Review } from '@/core/models/review.model';
import { form, FormField, FormRoot, required } from '@angular/forms/signals'; // Librería de forms
import { Material } from '@/shared/material/material';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, Material, CommonModule, FormRoot, FormField],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductsService);
  private readonly snackbar = inject(SnackarService);
  private readonly cartService = inject(CartService);
  private readonly reviewService = inject(ReviewService);
  public readonly authService = inject(AuthService); // Necesario para comprobar autoría y rol admin

  product = signal<Product | null>(null);
  reviews = signal<Review[]>([]);
  
  isLoading = signal<boolean>(true);
  isAdding = signal<boolean>(false);
  isLoadingReviews = signal<boolean>(true);
  isSubmittingReview = signal<boolean>(false);

  // Sistema de Estrellas Interactivas para el Formulario
  hoverRating = signal<number>(0);
  selectedRating = signal<number>(0);

  // Modelo del Formulario de Reseñas
  reviewModel = signal<{ rating: number; comment: string }>({
    rating: 0,
    comment: ''
  });

  // Validador con Signals
  reviewForm = form<{ rating: number; comment: string }>(
    this.reviewModel,
    (validators) => {
      required(validators.rating, { message: 'Por favor, selecciona una calificación' });
    },
    {
      submission: {
        action: async () => this.onSubmitReview(),
      }
    }
  );

  constructor() {
    effect(() => {
      const slug = this.route.snapshot.paramMap.get('slug');
      if (slug) {
        this.loadProductAndReviews(slug);
      }
    });
  }

  private loadProductAndReviews(slug: string): void {
    this.isLoading.set(true);
    this.productService.getProductBySlug(slug).subscribe({
      next: (prod) => {
        this.product.set(prod);
        this.isLoading.set(false);
        this.loadReviews(prod.id);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.snackbar.error('No se pudo cargar el producto');
      }
    });
  }

  private loadReviews(productId: string): void {
    this.isLoadingReviews.set(true);
    this.reviewService.getProductReviews(productId, 1, 20).subscribe({
      next: (res) => {
        this.reviews.set(res.data);
        this.isLoadingReviews.set(false);
      },
      error: (err) => {
        console.error('Error cargando reseñas:', err);
        this.isLoadingReviews.set(false);
      }
    });
  }

  // Manejar Hover y Click en estrellas
  setRatingHover(val: number): void {
    this.hoverRating.set(val);
  }

  selectRating(val: number): void {
    this.selectedRating.set(val);
    // Actualizar el modelo del formulario reactivo
    this.reviewModel.update(m => ({ ...m, rating: val }));
  }

  onSubmitReview(): void {
    const prod = this.product();
    const rating = this.selectedRating();
    if (!prod || rating === 0 || this.isSubmittingReview()) return;

    this.isSubmittingReview.set(true);
    const comment = this.reviewModel().comment;

    this.reviewService.createReview(prod.id, { rating, comment }).subscribe({
      next: (newReview) => {
        this.snackbar.show('¡Gracias por tu valoración! ⭐️');
        this.isSubmittingReview.set(false);
        
        // Limpiar formulario y estrellas
        this.selectedRating.set(0);
        this.reviewModel.set({ rating: 0, comment: '' });

        // Recargar el producto (para obtener el nuevo averageRating del backend) y reseñas
        const slug = this.route.snapshot.paramMap.get('slug');
        if (slug) this.loadProductAndReviews(slug);
      },
      error: (err) => {
        this.isSubmittingReview.set(false);
        console.error('Error al enviar reseña:', err);
        const errMsg = err.error?.message || 'No se pudo enviar la reseña.';
        
        if (err.status === 403) {
          this.snackbar.show('Debes comprar este producto antes de valorarlo 🛒');
        } else if (err.status === 409) {
          this.snackbar.show('Ya has valorado este producto anteriormente');
        } else {
          this.snackbar.show(errMsg);
        }
      }
    });
  }

  deleteReview(reviewId: string): void {
    if (!confirm('¿Estás seguro de que deseas eliminar este comentario?')) return;

    this.reviewService.deleteReview(reviewId).subscribe({
      next: () => {
        this.snackbar.show('Reseña eliminada');
        // Quitar de la lista local
        this.reviews.update(list => list.filter(r => r.id !== reviewId));
        
        // Recargar información del producto
        const slug = this.route.snapshot.paramMap.get('slug');
        if (slug) this.productService.getProductBySlug(slug).subscribe(p => this.product.set(p));
      },
      error: (err) => {
        console.error('Error al eliminar reseña:', err);
        this.snackbar.show('No se pudo borrar la reseña');
      }
    });
  }

  // Verifica si el usuario actual es autor de la reseña
  isAuthor(reviewUserId: string): boolean {
    const current = this.authService.currentUser();
    return current ? current.id === reviewUserId : false;
  }

  // Agregar al carrito
  addToCart(): void {
    const prod = this.product();
    if (!prod) return;

    this.isAdding.set(true);
    this.cartService.addToCart({ productId: prod.id, quantity: 1 }).subscribe({
      next: () => {
        this.isAdding.set(false);
        this.snackbar.show('Producto agregado al carrito 🛒');
      },
      error: (err) => {
        console.error('Error al agregar al carrito:', err);
        this.snackbar.show('Inicia sesión para agregar productos.');
        this.isAdding.set(false);
      }
    });
  }
}
```

---

## 3. Estructura de la Interfaz (`product-detail.html`)

Añadiremos el promedio de calificación debajo del título del producto, la visualización de la lista de comentarios en un bloque inferior, y el formulario interactivo de estrellas.

### Modificaciones en [product-detail.html](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/features/products/pages/product-detail/product-detail.html):

```html
<div class="detail-container">
  @if (isLoading()) {
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Cargando detalles del producto...</p>
    </div>
  } @else if (product(); as prod) {
    <div class="product-grid">
      <!-- Galería de imágenes -->
      <div class="image-gallery">
        <img
          [src]="prod.images?.[0]?.url || 'assets/images/placeholder.png'"
          [alt]="prod.name"
        />
      </div>

      <!-- Información -->
      <div class="info-panel">
        <h2>{{ prod.name }}</h2>
        
        <!-- ESTRELLAS PROMEDIO DEL PRODUCTO -->
        <div class="rating-summary">
          <div class="stars">
            @for (star of [1, 2, 3, 4, 5]; track star) {
              <span class="material-icons star-icon" [class.filled]="star <= (prod.averageRating || 0)">
                star
              </span>
            }
          </div>
          <span class="rating-text">
            {{ prod.averageRating | number: '1.1-1' }} ({{ prod.reviewCount }} valoraciones)
          </span>
        </div>

        <p class="sku">SKU: {{ prod.sku }}</p>
        <p class="price">${{ prod.price | number: '1.2-2' }}</p>
        <p class="description">{{ prod.description }}</p>

        <!-- Stock -->
        @if (prod.stockQuantity > 0) {
          <span class="stock in-stock">En Stock ({{ prod.stockQuantity }})</span>
          <button class="btn-add" [disabled]="isAdding()" (click)="addToCart()">
            @if (isAdding()) { Agregando... } @else { Agregar al Carrito }
          </button>
        } @else {
          <span class="stock out-of-stock">Agotado</span>
        }

        <br />
        <a routerLink="/dashboard/products" class="back-link">Volver al catálogo</a>
      </div>
    </div>

    <!-- SECCIÓN DE RESEÑAS -->
    <div class="reviews-section">
      <div class="reviews-header">
        <h3>Opiniones de Clientes</h3>
      </div>

      <div class="reviews-grid">
        <!-- Columna Izquierda: Lista de Reseñas -->
        <div class="reviews-list">
          @if (isLoadingReviews()) {
            <p class="loading-text">Cargando comentarios...</p>
          } @else {
            @for (rev of reviews(); track rev.id) {
              <div class="review-card">
                <div class="review-author-info">
                  <!-- Círculo Avatar con Iniciales -->
                  <div class="author-avatar">
                    {{ rev.user?.firstName?.[0] || 'U' }}{{ rev.user?.lastName?.[0] || 'Anonymous' }}
                  </div>
                  <div class="author-details">
                    <h4>{{ rev.user?.firstName }} {{ rev.user?.lastName }}</h4>
                    <span class="date">{{ rev.createdAt | date: 'dd/MM/yyyy' }}</span>
                  </div>
                  
                  <!-- Mostrar Estrellas de esta Reseña -->
                  <div class="review-rating-stars">
                    @for (s of [1,2,3,4,5]; track s) {
                      <span class="material-icons star-mini" [class.filled]="s <= rev.rating">star</span>
                    }
                  </div>

                  <!-- Eliminar Reseña si es Autor o es Admin -->
                  @if (isAuthor(rev.userId) || authService.isAdmin()) {
                    <button class="btn-delete-review" (click)="deleteReview(rev.id)" title="Eliminar Comentario">
                      🗑️
                    </button>
                  }
                </div>
                
                @if (rev.comment) {
                  <p class="review-comment-text">"{{ rev.comment }}"</p>
                }
              </div>
            } @empty {
              <div class="empty-reviews">
                <span class="material-icons">rate_review</span>
                <p>Nadie ha calificado este producto todavía. ¡Sé el primero!</p>
              </div>
            }
          }
        </div>

        <!-- Columna Derecha: Formulario para Escribir Reseña -->
        @if (authService.isAuthenticated()) {
          <div class="write-review-card">
            <h4>Escribe tu valoración ✍️</h4>
            <p class="form-desc">Califica tu experiencia con el producto y deja tu comentario.</p>

            <form [formRoot]="reviewForm" class="review-form-element">
              <!-- Calificación con Estrellas Interactivas -->
              <div class="interactive-stars-row">
                <label>Tu calificación:</label>
                <div class="interactive-stars">
                  @for (star of [1, 2, 3, 4, 5]; track star) {
                    <span 
                      class="material-icons star-interactive" 
                      [class.hovered]="star <= hoverRating()" 
                      [class.selected]="star <= selectedRating()"
                      (mouseenter)="setRatingHover(star)"
                      (mouseleave)="setRatingHover(0)"
                      (click)="selectRating(star)"
                    >
                      star
                    </span>
                  }
                </div>
                @if (reviewForm.rating().invalid() && reviewForm.rating().touched()) {
                  <p class="error-msg-rating">Debes elegir una estrella</p>
                }
              </div>

              <!-- Caja de texto -->
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Comentario (Opcional)</mat-label>
                <textarea 
                  matInput 
                  [formField]="reviewForm.comment" 
                  rows="4" 
                  placeholder="Ej. Excelente calidad de materiales, muy recomendado..."
                ></textarea>
              </mat-form-field>

              <button 
                type="submit" 
                mat-raised-button 
                color="primary" 
                [disabled]="reviewForm().invalid() || selectedRating() === 0 || isSubmittingReview()"
                class="btn-submit-review"
              >
                @if (isSubmittingReview()) { Enviando... } @else { Enviar Reseña }
              </button>
            </form>
          </div>
        } @else {
          <div class="login-prompt-reviews">
            <p>Debes <a routerLink="/auth/login">Iniciar Sesión</a> para escribir una valoración.</p>
          </div>
        }
      </div>
    </div>
  }
</div>
```

---

## 4. Diseño Estético (`product-detail.scss`)

Aplica estos estilos CSS para dar una apariencia moderna, con efectos de estrellas brillantes doradas en el tema oscuro de la aplicación.

### Estilos en [product-detail.scss](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/features/products/pages/product-detail/product-detail.scss):

```scss
.detail-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.product-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 3rem;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding: 2.5rem;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
  margin-bottom: 3rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    padding: 1.5rem;
  }
}

.image-gallery {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 1rem;
  overflow: hidden;

  img {
    max-width: 100%;
    max-height: 400px;
    object-fit: contain;
    border-radius: 12px;
    transition: transform 0.3s ease;

    &:hover {
      transform: scale(1.03);
    }
  }
}

.info-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  h2 {
    font-size: 2.2rem;
    font-weight: 850;
    margin: 0;
    color: #ffffff;
    font-family: 'Outfit', sans-serif;
  }

  .rating-summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .stars {
      display: flex;
      gap: 2px;
    }

    .star-icon {
      font-size: 1.35rem;
      color: rgba(255, 255, 255, 0.15);

      &.filled {
        color: #fbbf24; // Amber 400
        filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.4));
      }
    }

    .rating-text {
      color: #94a3b8;
      font-size: 0.9rem;
      font-weight: 500;
    }
  }

  .sku {
    color: #64748b;
    font-size: 0.9rem;
    margin: 0;
    font-family: monospace;
  }

  .price {
    font-size: 1.8rem;
    font-weight: 800;
    color: #818cf8;
    margin: 0;
  }

  .description {
    color: #cbd5e1;
    line-height: 1.6;
    margin: 0;
  }

  .stock {
    display: inline-block;
    padding: 0.35rem 0.85rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 700;
    align-self: flex-start;

    &.in-stock {
      background-color: rgba(34, 197, 94, 0.12);
      color: #4ade80;
    }

    &.out-of-stock {
      background-color: rgba(239, 68, 68, 0.12);
      color: #f87171;
    }
  }

  .btn-add {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: #ffffff;
    border: none;
    padding: 0.9rem 2rem;
    font-size: 1.05rem;
    font-weight: 700;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
    transition: all 0.2s ease;
    align-self: flex-start;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
    }

    &:disabled {
      background: #334155;
      color: #64748b;
      cursor: not-allowed;
      box-shadow: none;
    }
  }

  .back-link {
    color: #94a3b8;
    text-decoration: none;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 1rem;

    &:hover {
      color: #ffffff;
    }
  }
}

/* ==================== RESEÑAS SECCIÓN ==================== */
.reviews-section {
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding: 2.5rem;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);

  .reviews-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 1rem;
    margin-bottom: 2rem;

    h3 {
      font-size: 1.5rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0;
      font-family: 'Outfit', sans-serif;
    }
  }

  .reviews-grid {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 3rem;

    @media (max-width: 992px) {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
  }
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  .review-card {
    background-color: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 18px;
    padding: 1.25rem;
    transition: all 0.2s;

    &:hover {
      border-color: rgba(255, 255, 255, 0.08);
      background-color: rgba(15, 23, 42, 0.6);
    }

    .review-author-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      position: relative;
    }

    .author-avatar {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff;
      font-weight: 700;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
    }

    .author-details {
      display: flex;
      flex-direction: column;

      h4 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #ffffff;
      }

      .date {
        font-size: 0.8rem;
        color: #64748b;
      }
    }

    .review-rating-stars {
      margin-left: auto;
      display: flex;
      gap: 1px;

      .star-mini {
        font-size: 1.05rem;
        color: rgba(255, 255, 255, 0.1);

        &.filled {
          color: #fbbf24;
        }
      }
    }

    .btn-delete-review {
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      margin-left: 0.5rem;
      padding: 0.25rem;
      border-radius: 6px;
      font-size: 1rem;
      transition: background-color 0.2s;

      &:hover {
        background-color: rgba(239, 68, 68, 0.15);
      }
    }

    .review-comment-text {
      color: #e2e8f0;
      margin: 1rem 0 0 0;
      font-style: italic;
      line-height: 1.5;
      font-size: 0.95rem;
    }
  }

  .empty-reviews {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #64748b;
    padding: 3rem 1rem;
    text-align: center;
    gap: 0.5rem;

    span {
      font-size: 3rem;
      color: #334155;
    }
  }
}

.write-review-card {
  background-color: rgba(30, 41, 59, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 1.5rem;
  align-self: flex-start;
  width: 100%;
  box-sizing: border-box;

  h4 {
    font-size: 1.25rem;
    font-weight: 750;
    color: #ffffff;
    margin: 0 0 0.25rem 0;
    font-family: 'Outfit', sans-serif;
  }

  .form-desc {
    color: #94a3b8;
    font-size: 0.85rem;
    margin: 0 0 1.5rem 0;
  }
}

.review-form-element {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  .interactive-stars-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    label {
      color: #e2e8f0;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .interactive-stars {
      display: flex;
      gap: 4px;
    }

    .star-interactive {
      font-size: 2rem;
      color: rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        transform: scale(1.1);
      }

      &.hovered {
        color: #fde047 !important; // Yellow 300
      }

      &.selected {
        color: #eab308; // Yellow 500
        filter: drop-shadow(0 0 6px rgba(234, 179, 8, 0.4));
      }
    }

    .error-msg-rating {
      color: #f87171;
      font-size: 0.8rem;
      margin: 0;
    }
  }

  /* Personalización de inputs Material */
  ::ng-deep {
    .mat-mdc-text-field-wrapper {
      background-color: rgba(15, 23, 42, 0.4) !important;
      border-radius: 10px !important;
    }
    .mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__leading,
    .mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__notch,
    .mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__trailing {
      border-color: rgba(255, 255, 255, 0.1) !important;
    }
  }

  .btn-submit-review {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: #ffffff;
    font-weight: 700;
    font-family: 'Outfit', sans-serif;
    padding: 0.75rem;
    border-radius: 10px;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);

    &:hover:not(:disabled) {
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }
  }
}

.login-prompt-reviews {
  background-color: rgba(15, 23, 42, 0.3);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
  height: fit-content;

  a {
    color: #818cf8;
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
```
