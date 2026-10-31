import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { getInjectionSdk } from '../guards/injection.guard';

/**
 * Scans response payload for leaks (outputBlockedWords / SQL code).
 * SSE streams bypass this interceptor (controller streams raw chunks);
 * final assembled answer is scanned in service before persist.
 */
@Injectable()
export class InjectionOutputInterceptor implements NestInterceptor {
  private readonly logger = new Logger(InjectionOutputInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const body = req.body ?? {};
    return next.handle().pipe(
      mergeMap(async (data: unknown) => {
        // Skip SSE (event-stream) — scanned at assembly time.
        const res = context.switchToHttp().getResponse();
        const ct = res?.getHeader?.('content-type');
        if (typeof ct === 'string' && ct.includes('text/event-stream')) {
          return data;
        }
        try {
          const sdk = getInjectionSdk();
          const wrapped = {
            choices: [{ message: { content: JSON.stringify(data) } }],
          };
          const r = (await sdk.scanOutput(
            body,
            wrapped,
            'chatComplete',
          )) as unknown as {
            shouldDeny: boolean;
            results?: unknown;
          };
          if (r.shouldDeny) {
            this.logger.warn('Injection blocked (output)');
            throw new HttpException(
              {
                verdict: false,
                errorCode: 'AI_OUTPUT_BLOCKED',
                message: 'Response blocked by output guard',
              },
              HttpStatus.BAD_REQUEST,
            );
          }
        } catch (e) {
          if (e instanceof HttpException) throw e;
          this.logger.warn(`scanOutput failed: ${String(e)}`);
        }
        return data;
      }),
      catchError((err: unknown) => throwError(() => err)),
    );
  }
}
