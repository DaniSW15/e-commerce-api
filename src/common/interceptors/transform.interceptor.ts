import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interfaz para respuestas transformadas
 */
export interface Response<T> {
    statusCode: number;
    message?: string;
    data: T;
    timestamp: string;
    path: string;
}

/**
 * Interceptor para transformar respuestas exitosas a un formato consistente
 * Útil para estandarizar todas las respuestas de la API
 */
@Injectable()
export class TransformInterceptor<T>
    implements NestInterceptor<T, Response<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<Response<T>> {
        const request = context.switchToHttp().getRequest();
        const statusCode = context.switchToHttp().getResponse().statusCode;

        return next.handle().pipe(
            map(data => {
                // Si la respuesta ya tiene el formato deseado, no transformar
                if (data && typeof data === 'object' && 'statusCode' in data) {
                    return data;
                }

                // Transformar a formato estándar
                return {
                    statusCode,
                    data,
                    timestamp: new Date().toISOString(),
                    path: request.url,
                };
            }),
        );
    }
}
