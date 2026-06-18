# 🔐 Guía: Configuración de Cuenta y Doble Factor de Autenticación (2FA) en Angular (v17+)

Esta guía te guiará paso a paso para implementar la sección de **Configuración de Cuenta** (`Settings`), donde el usuario podrá ver su perfil y gestionar su **Seguridad con Doble Factor de Autenticación (2FA)**: generará su código QR, lo escaneará en su móvil (Google Authenticator) y activará o desactivará la protección de forma segura.

---

## 1. Métodos de 2FA en el Servicio (`auth-service.ts`)

Asegúrate de tener estos métodos listos al final de tu `AuthService` en `src/app/core/services/auth/auth-service.ts`:

```typescript
/**
 * Genera el secreto 2FA y la URL del código QR en base64
 */
generate2FaQr(): Observable<{ qrCodeUrl: string }> {
    return this.http.post<{ qrCodeUrl: string }>(`${this.baseUrl}/2fa/generate`, {});
}

/**
 * Valida el código de 6 dígitos del autenticador y activa el 2FA permanentemente
 */
enable2Fa(code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/2fa/enable`, { code });
}

/**
 * Desactiva el 2FA validando el código actual de 6 dígitos
 */
disable2Fa(code: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/2fa/disable`, { code });
}
```

---

## 2. Registrar la Ruta de Configuración

En tu archivo [dashboard.routes.ts](file:///Users/danisw.dev/Desktop/Frontend/ecommerce-frontend/src/app/features/dashboard/dashboard.routes.ts), registra la ruta `settings`:

```typescript
{
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
    canActivate: [authGuard]
}
```

---

## 3. Implementar el Controlador Reactivo (`settings.ts`)

Crea la lógica en `src/app/features/dashboard/pages/settings/settings.ts` utilizando Angular Signals para controlar los pasos de configuración:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@/core/services/auth/auth-service';
import { SnackarService } from '@/core/services/snackar/snackar.service';
import { Material } from '@/shared/material/material';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Material],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Settings implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(SnackarService);

  // Signal con el estado del usuario obtenido del AuthService
  currentUser = this.authService.currentUser;
  
  // Signals de control de flujo
  twoFactorEnabled = signal<boolean>(false);
  qrCodeUrl = signal<string | null>(null);
  showActivationForm = signal<boolean>(false);
  isProcessing = signal<boolean>(false);

  // Formularios
  faForm!: FormGroup;

  ngOnInit(): void {
    // Inicializar formulario de código de 6 dígitos
    this.faForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });

    // Leer estado inicial de 2FA del usuario
    const user = this.currentUser();
    if (user) {
      // Nota: Asume que la interfaz User incluye la propiedad twoFactorEnabled
      this.twoFactorEnabled.set((user as any).twoFactorEnabled || false);
    }
  }

  /**
   * Paso 1: Generar QR e iniciar el flujo de activación
   */
  startEnable2FA(): void {
    this.isProcessing.set(true);
    this.authService.generate2FaQr().subscribe({
      next: (res) => {
        this.qrCodeUrl.set(res.qrCodeUrl);
        this.showActivationForm.set(true);
        this.isProcessing.set(false);
      },
      error: (err) => {
        this.snackbar.error('Error al generar el código QR.');
        this.isProcessing.set(false);
      }
    });
  }

  /**
   * Paso 2: Activar 2FA enviando el código de confirmación
   */
  confirmEnable2FA(): void {
    if (this.faForm.invalid || this.isProcessing()) return;

    this.isProcessing.set(true);
    const code = this.faForm.value.code;

    this.authService.enable2Fa(code).subscribe({
      next: () => {
        this.snackbar.success('Doble factor de autenticación (2FA) activado.');
        this.twoFactorEnabled.set(true);
        this.showActivationForm.set(false);
        this.qrCodeUrl.set(null);
        this.faForm.reset();
        
        // Actualizar el estado del usuario localmente
        const user = this.currentUser();
        if (user) {
          const updatedUser = { ...user, twoFactorEnabled: true };
          this.authService.currentUser.set(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        
        this.isProcessing.set(false);
      },
      error: (err) => {
        this.snackbar.error(err.error?.message || 'Código incorrecto. Intenta de nuevo.');
        this.isProcessing.set(false);
      }
    });
  }

  /**
   * Paso 3: Desactivar 2FA enviando el código de confirmación
   */
  disable2FA(): void {
    // Pedir código para desactivarlo de manera segura
    const code = prompt('Para desactivar 2FA, introduce un código de 6 dígitos de tu app de autenticación:');
    if (!code) return;

    if (!/^\d{6}$/.test(code)) {
      this.snackbar.error('El código debe ser de 6 dígitos.');
      return;
    }

    this.isProcessing.set(true);
    this.authService.disable2Fa(code).subscribe({
      next: () => {
        this.snackbar.success('Doble factor de autenticación (2FA) desactivado.');
        this.twoFactorEnabled.set(false);
        
        const user = this.currentUser();
        if (user) {
          const updatedUser = { ...user, twoFactorEnabled: false };
          this.authService.currentUser.set(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        
        this.isProcessing.set(false);
      },
      error: (err) => {
        this.snackbar.error(err.error?.message || 'Error al desactivar. Código inválido.');
        this.isProcessing.set(false);
      }
    });
  }

  cancelActivation(): void {
    this.showActivationForm.set(false);
    this.qrCodeUrl.set(null);
    this.faForm.reset();
  }
}
```

---

## 4. Estructurar la Plantilla Vista (`settings.html`)

Crea la maquetación en `src/app/features/dashboard/pages/settings/settings.html`. Combina Material Cards con secciones de seguridad:

```html
<div class="settings-wrapper">
  <h2>Configuración de Cuenta</h2>

  <div class="settings-grid">
    <!-- Panel de Perfil -->
    <div class="settings-card">
      <h3>Mi Perfil</h3>
      <div class="profile-info">
        <p><strong>Email:</strong> {{ currentUser()?.email }}</p>
        <p><strong>Rol asignado:</strong> {{ currentUser()?.role | uppercase }}</p>
      </div>
    </div>

    <!-- Panel de Seguridad 2FA -->
    <div class="settings-card">
      <h3>Doble Factor de Autenticación (2FA)</h3>
      <p class="subtitle">
        Protege tu cuenta agregando una capa adicional de seguridad. Al iniciar sesión, se te solicitará un código de 6 dígitos generado por tu móvil.
      </p>

      <!-- Estado: 2FA Activado -->
      @if (twoFactorEnabled()) {
        <div class="security-status enabled">
          <span class="badge">Activo ✔️</span>
          <p>Tu cuenta está protegida con verificación en dos pasos.</p>
          <button mat-raised-button color="warn" (click)="disable2FA()" [disabled]="isProcessing()">
            Desactivar 2FA
          </button>
        </div>
      }

      <!-- Estado: 2FA Desactivado y sin iniciar configuración -->
      @else if (!showActivationForm()) {
        <div class="security-status disabled">
          <span class="badge">Desactivado ❌</span>
          <p>Te recomendamos activar el 2FA para proteger tu cuenta de accesos no autorizados.</p>
          <button mat-raised-button color="primary" (click)="startEnable2FA()" [disabled]="isProcessing()">
            Configurar Autenticador
          </button>
        </div>
      }

      <!-- Estado: Configurando y escaneando código QR -->
      @else {
        <div class="activation-flow">
          <h4>Paso 1: Escanea este código QR</h4>
          <p>Abre tu aplicación de autenticación (Google Authenticator, Authy, etc.) y escanea el código:</p>
          
          @if (qrCodeUrl()) {
            <div class="qr-container">
              <img [src]="qrCodeUrl()" alt="Código QR 2FA" />
            </div>
          }

          <h4>Paso 2: Introduce el código de verificación</h4>
          <p>Escribe el código temporal de 6 dígitos que muestra tu app móvil:</p>

          <form [formGroup]="faForm" (ngSubmit)="confirmEnable2FA()">
            <mat-form-field appearance="outline">
              <mat-label>Código de 6 dígitos</mat-label>
              <input matInput formControlName="code" placeholder="000000" maxlength="6" />
              @if (faForm.get('code')?.invalid && faForm.get('code')?.touched) {
                <mat-error>Introduce un código numérico válido de 6 dígitos</mat-error>
              }
            </mat-form-field>

            <div class="actions">
              <button type="button" mat-button (click)="cancelActivation()" [disabled]="isProcessing()">
                Cancelar
              </button>
              <button type="submit" mat-raised-button color="primary" [disabled]="faForm.invalid || isProcessing()">
                {{ isProcessing() ? 'Verificando...' : 'Activar Seguridad' }}
              </button>
            </div>
          </form>
        </div>
      }
    </div>
  </div>
</div>
```
