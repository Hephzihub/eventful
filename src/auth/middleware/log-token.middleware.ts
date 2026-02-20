import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LogTokenMiddleware implements NestMiddleware {
  private readonly logger = new Logger('AuthToken');

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      this.logger.debug(`Token: ${token}`);
    } else {
      this.logger.debug('No Bearer token found on request');
    }

    next();
  }
}