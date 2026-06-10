import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator para obtener el usuario actual del request
 * Uso: getCurrentUser(@CurrentUser() user: User)
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Si se especifica un campo, retornar solo ese campo
    return data ? user?.[data] : user;
  },
);
