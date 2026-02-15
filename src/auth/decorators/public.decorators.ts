import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorators to mark a route as public (skip authentication)
 * 
 * Usage:
 * @Public()
 * @Get('evemt)
 * @getAllEvents() { ... }
 */

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);