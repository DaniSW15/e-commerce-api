import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro específico para excepciones HTTP
 * Maneja errores HTTP con formato consistente y logging
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extraer mensaje y detalles
    let message: string | string[];
    let error: string;
    let details: any;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as any;
      message = responseObj.message || exception.message;
      error = responseObj.error || exception.name;
      details = responseObj.details;
    } else {
      message = exceptionResponse as string;
      error = exception.name;
    }

    // Construir respuesta estructurada
    const errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    };

    // Agregar detalles adicionales si existen (útil para errores de validación)
    if (details) {
      errorResponse.details = details;
    }

    // Agregar correlationId si existe (útil para debugging distribuido)
    const correlationId = request.headers['x-correlation-id'];
    if (correlationId) {
      errorResponse.correlationId = correlationId;
    }

    // Log solo errores 5xx (server errors) - 4xx son errores del cliente
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - Status: ${status}`,
        exception.stack,
      );
    } else if (status >= 400 && status !== 404) {
      // Log warning para 4xx (excepto 404 que son muy comunes)
      this.logger.warn(
        `${request.method} ${request.url} - Status: ${status} - Message: ${typeof message === 'string' ? message : JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
