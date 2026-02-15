import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Decorator to extract the current authenticated user from request
 * 
 * Usage:
 * @Get('profile')
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 * 
 * Instead of:
 * @Get('profile')
 * getProfile(@Request() req) {
 *   return req.user;
 * }
 */

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
)