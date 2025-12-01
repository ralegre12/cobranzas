import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['x-api-key'] as string | undefined;
    const expected = process.env.API_KEY?.trim();
    if (!expected) return true;
    if (!header || header !== expected) throw new UnauthorizedException('Invalid API key');
    return true;
  }
}
