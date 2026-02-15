import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  // This guard triggers the LocalStrategy
  // Use it on login endpoint: @UseGuards(LocalAuthGuard)
}
