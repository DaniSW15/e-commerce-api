import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro global para capturar TODAS las excepciones (HTTP y no-HTTP)
 * Proporciona respuestas consistentes y logging centralizado
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      // Excepción HTTP conocida
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || exception.name;
      } else {
        message = exceptionResponse as string;
        error = exception.name;
      }
    } else if (exception instanceof Error) {
      // Error genérico de JavaScript
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message || 'Internal server error';
      error = exception.name || 'InternalServerError';

      // Log completo del stack trace para errores no controlados
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
    } else {
      // Excepción desconocida
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      error = 'UnknownError';

      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`);
    }

    // Construir respuesta de error consistente
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    };

    // Log de errores 4xx y 5xx (excepto 404 para reducir ruido)
    if (status >= 400 && status !== 404) {
      this.logger.warn(
        `${request.method} ${request.url} - Status: ${status} - Message: ${typeof message === 'string' ? message : JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
