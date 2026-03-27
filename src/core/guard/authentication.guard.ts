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

type RequestWithAccessTokenCookie = Request & {
  cookies?: Record<'accessToken', string>;
};

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  // helper function to extract token from request
  private extractTokenFromRequest(
    request: RequestWithAccessTokenCookie,
  ): string | null {
    const authorization = request.headers.authorization;
    if (typeof authorization === 'string') {
      const [scheme, token] = authorization.split(' ');
      if (scheme === 'Bearer' && token) {
        return token;
      }
    }

    const legacyHeaderToken = request.headers['access-token']?.toString();
    if (legacyHeaderToken) {
      return legacyHeaderToken;
    }

    const cookieToken = request.cookies?.accessToken;
    if (typeof cookieToken === 'string' && cookieToken) {
      return cookieToken;
    }

    return null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const executionContext = context.switchToHttp();
    const request = executionContext.getRequest<RequestWithAccessTokenCookie>();
    const token = this.extractTokenFromRequest(request);

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
