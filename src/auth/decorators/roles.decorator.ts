import { SetMetadata } from "@nestjs/common"

export const ROLES_KEY = 'roles'

/**
 * Decorators to specify which roles can access a route
 * 
 * Usage:
 * @Roles('creator')
 * @Roles('creator', 'eventee)
 */

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);