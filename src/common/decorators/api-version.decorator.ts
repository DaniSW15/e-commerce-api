import { SetMetadata } from '@nestjs/common';

/**
 * Decorator para especificar versión de API
 * Uso: @ApiVersion('1', '2')
 */
export const API_VERSION_KEY = 'apiVersion';
export const ApiVersion = (...versions: string[]) =>
    SetMetadata(API_VERSION_KEY, versions);
