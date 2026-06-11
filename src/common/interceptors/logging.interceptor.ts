import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Interceptor para logging de requests/responses
 * Útil para debugging, auditoría y monitoreo
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;
    const userInfo = user ? `User: ${user.email} (${user.id})` : 'Anonymous';
    const now = Date.now();

    // Log de request entrante
    this.logger.log(`→ ${method} ${url} - ${userInfo}`);

    // Log de request body en desarrollo (sin datos sensibles)
    if (
      process.env.NODE_ENV === 'development' &&
      body &&
      Object.keys(body).length > 0
    ) {
      const sanitizedBody = this.sanitizeSensitiveData(body);
      this.logger.debug(`Request Body: ${JSON.stringify(sanitizedBody)}`);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const delay = Date.now() - now;

          // Log de respuesta exitosa
          this.logger.log(
            `← ${method} ${url} - ${response.statusCode} - ${delay}ms`,
          );
        },
        error: (error) => {
          const delay = Date.now() - now;

          // Log de error
          this.logger.error(
            `✕ ${method} ${url} - ${error.status || 500} - ${delay}ms - ${error.message}`,
          );
        },
      }),
    );
  }

  /**
   * Sanitiza datos sensibles del body para logging
   */
  private sanitizeSensitiveData(body: any): any {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
    ];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}
