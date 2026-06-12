# Guía de Integración de Autenticación en Angular (v17+)

Esta guía explica la arquitectura y el consumo de la API de autenticación de tu backend NestJS en un frontend moderno de Angular utilizando las mejores prácticas actuales: **Standalone Components, Signals, Functional Guards e Interceptors**.

---

## 1. Endpoints de la API (Backend)

Todos los endpoints tienen la URL base `http://localhost:3000/api/auth/` (o la URL de tu entorno de desarrollo).

### A. Registro de Usuario (`POST /auth/register`)
Crea una nueva cuenta de usuario. Por defecto, las cuentas se crean inactivas hasta verificar el correo.
*   **Cuerpo (Request Body):**
    ```json
    {
      "email": "usuario@ejemplo.com",
      "password": "PasswordSegura123",
      "role": "customer", // Opcional (customer, seller, admin, super_admin)
      "firstName": "Juan", // Opcional
      "lastName": "Pérez" // Opcional
    }
    ```
*   **Respuesta (Response 201):**
    ```json
    {
      "access_token": "JWT_ACCESS_TOKEN",
      "refresh_token": "REFRESH_TOKEN_STRING",
      "expires_in": 900,
      "token_type": "Bearer",
      "user": {
        "id": "uuid",
        "email": "usuario@ejemplo.com",
        "role": "customer"
      }
    }
    ```
    *Nota: Se envía automáticamente un correo con un código de verificación de 6 dígitos.*

### B. Inicio de Sesión (`POST /auth/login`)
*   **Cuerpo (Request Body):**
    ```json
    {
      "email": "usuario@ejemplo.com",
      "password": "PasswordSegura123",
      "deviceInfo": "Angular Client App" // Opcional
    }
    ```
*   **Respuesta (200 - Si el 2FA está DESACTIVADO):**
    ```json
    {
      "access_token": "JWT_ACCESS_TOKEN",
      "refresh_token": "REFRESH_TOKEN_STRING",
      "expires_in": 900,
      "token_type": "Bearer",
      "user": {
        "id": "uuid",
        "email": "usuario@ejemplo.com",
        "role": "customer",
        "twoFactorEnabled": false
      }
    }
    ```
*   **Respuesta (200 - Si el 2FA está ACTIVADO):**
    Si la cuenta tiene doble factor de autenticación activo, no retorna los tokens de sesión finales, sino un token temporal:
    ```json
    {
      "requiresTwoFactor": true,
      "tempToken": "JWT_TEMP_TOKEN",
      "userId": "uuid"
    }
    ```

### C. Completar Login con 2FA (`POST /auth/login/2fa`)
Si el login anterior requirió doble factor, se debe enviar el código generado por la app autenticadora.
*   **Cuerpo (Request Body):**
    ```json
    {
      "tempToken": "JWT_TEMP_TOKEN",
      "twoFactorCode": "123456",
      "deviceInfo": "Angular Client App" // Opcional
    }
    ```
*   **Respuesta (200):** Mismo objeto con los tokens finales de sesión (`access_token`, `refresh_token`, etc.).

### D. Verificación de Email (`POST /auth/verify-email`)
Verifica la cuenta del usuario utilizando el código de 6 dígitos enviado a su correo electrónico al registrarse.
*   **Cuerpo (Request Body):**
    ```json
    {
      "email": "usuario@ejemplo.com",
      "token": "123456"
    }
    ```
*   **Respuesta (200):**
    ```json
    {
      "message": "Email verified successfully"
    }
    ```

### E. Rotación de Token (`POST /auth/refresh`)
Obtiene un nuevo juego de tokens cuando el Access Token (que dura 15 minutos) expira.
*   **Cuerpo (Request Body):**
    ```json
    {
      "refreshToken": "REFRESH_TOKEN_STRING",
      "deviceInfo": "Angular Client App" // Opcional
    }
    ```
*   **Respuesta (200):**
    ```json
    {
      "access_token": "NUEVO_JWT_ACCESS_TOKEN",
      "refresh_token": "NUEVO_REFRESH_TOKEN_STRING",
      "expires_in": 900,
      "token_type": "Bearer"
    }
    ```
    *Importante: Este endpoint implementa rotación estricta, lo que significa que el refresh token enviado queda invalidado inmediatamente y se debe reemplazar en el almacenamiento del frontend por el nuevo retornado.*

### F. Cerrar Sesión (`POST /auth/logout`)
Invalida el refresh token activo en el backend.
*   **Cabeceras:** `Authorization: Bearer <access_token>`
*   **Cuerpo (Request Body):**
    ```json
    {
      "refreshToken": "REFRESH_TOKEN_STRING"
    }
    ```
*   **Respuesta (200):**
    ```json
    {
      "success": true
    }
    ```

---

## 2. Estructura Sugerida para el Frontend (Angular)

### A. El Servicio de Autenticación (`auth.service.ts`)
Encargado de comunicarse con la API y gestionar el almacenamiento de tokens.
1.  **Estado global con Signals:**
    *   Crea una Signal para rastrear al usuario actual: `currentUser = signal<User | null>(null)`.
    *   Crea una Signal computada para saber si está autenticado: `isAuthenticated = computed(() => !!this.currentUser())`.
2.  **Persistencia:**
    *   Método para obtener el Access Token actual de `localStorage` o memoria.
    *   Método para obtener el Refresh Token de `localStorage`.
    *   Métodos para actualizar y borrar estos tokens.
3.  **Métodos de flujo:**
    *   `login(email, password)`: Realiza la petición. Si recibe `requiresTwoFactor`, redirige a la vista de código 2FA. Si no, almacena tokens, parsea el JWT para extraer el usuario y actualiza la Signal del `currentUser`.
    *   `refreshToken()`: Llama a `/auth/refresh` enviando el refresh token guardado, actualiza ambos tokens y retorna el nuevo access token.
    *   `logout()`: Envía la petición `/auth/logout`, elimina los tokens del almacenamiento local, restablece la Signal a `null` y redirige a `/login`.

### B. El Interceptor HTTP (`auth.interceptor.ts`)
Utiliza la API funcional de Angular (`HttpInterceptorFn`) para inyectar automáticamente el token y manejar la expiración en segundo plano.
1.  **Inyección automática:**
    *   Obtiene el `access_token` desde el `AuthService`.
    *   Si existe y la petición va al backend (y no es a los endpoints públicos como `/login` o `/refresh`), clona la solicitud y añade la cabecera `Authorization: Bearer <token>`.
2.  **Manejo de Errores 401 (Expiración de Token):**
    *   Si el backend devuelve un error `401 Unauthorized`, significa que el Access Token ha expirado.
    *   El interceptor debe usar la función `catchError` para pausar las peticiones.
    *   Llama a `authService.refreshToken()` para obtener un nuevo par de tokens.
    *   Si el refresco es exitoso, clona la petición original fallida con el nuevo `access_token` y vuelve a enviarla (el usuario no nota la interrupción).
    *   Si el refresco falla (el refresh token expiró tras 7 días o fue revocado), el interceptor llama a `authService.logout()` redirigiendo al usuario al login.

### C. El Guard de Rutas Autenticadas (`auth.guard.ts`)
Un guard funcional (`canActivateFn`) que previene el acceso no autorizado.
*   Inyecta el `AuthService` y el `Router`.
*   Comprueba `authService.isAuthenticated()`.
*   Si es verdadero, retorna `true`.
*   Si es falso, redirige a `/login` usando `router.navigate(['/login'])` y retorna `false`.

### D. Guard de Control de Roles (`role.guard.ts`)
Protege rutas basándose en los permisos del usuario (por ejemplo, vistas de administrador).
*   En la configuración de las rutas, define los roles permitidos en la propiedad `data` (ej. `data: { roles: ['admin', 'seller'] }`).
*   El guard inyecta el `AuthService`, extrae el rol de `currentUser()` y verifica si está incluido en la lista de roles permitidos.
*   Si no tiene permisos, lo redirige a una página de `/unauthorized`.

---

## 3. Guía de Práctica paso a paso (Frontend)

Para entrenarte en este flujo en tu aplicación Angular, te sugerimos seguir este orden:

1.  **Implementa el `AuthService` básico:**
    Crea las llamadas HTTP básicas a `/login` y `/register` y guarda los tokens de manera simple en `localStorage`.
2.  **Crea los Componentes de Login y Registro:**
    Desarrolla los formularios reactivos en Angular con validaciones básicas de email y contraseña.
3.  **Configura las Rutas y el `AuthGuard`:**
    Crea un panel privado simple (ej. `/dashboard`) y bloquéalo con tu `authGuard`. Intenta acceder directamente escribiendo la URL sin iniciar sesión para verificar que te redirige a `/login`.
4.  **Añade el `AuthInterceptor`:**
    Configura el interceptor en tu `app.config.ts` (`provideHttpClient(withInterceptors([authInterceptor]))`). Verifica en la consola de red (Network) del navegador que las llamadas a rutas protegidas ahora llevan la cabecera `Authorization`.
5.  **Añade la lógica de refresco silencioso:**
    Simula la expiración del Access Token (por ejemplo, borrando a mano el token del `localStorage` antes de hacer una petición protegida o reduciendo su expiración) y verifica si tu interceptor es capaz de obtener automáticamente uno nuevo llamando al endpoint `/refresh` sin que la pantalla se recargue ni se pierda la sesión del usuario.
6.  **Desafío Extra - Manejo de 2FA:**
    Habilita el 2FA en el backend para un usuario y programa la UI para que, si el login indica `requiresTwoFactor`, se muestre un campo de texto adicional para ingresar el código OTP de 6 dígitos antes de completar la autenticación.
