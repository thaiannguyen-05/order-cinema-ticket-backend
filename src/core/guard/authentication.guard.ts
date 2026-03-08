import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Payload } from '../type/type';
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  // helper function to extract token from header
  private extractTokenFromHeader(request: Request): string | null {
    const token = request.headers['access-token']?.toString();
    return token || null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // get decorators parameters
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const executionContext = context.switchToHttp();
    const request = executionContext.getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) throw new UnauthorizedException();

    try {
      const payload: Payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow('JWT_SECRET'),
      });

      request.payload = payload;
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }
}
