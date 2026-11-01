import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectionSDK } from '@thaiandev/injection-req-res-sdk';
import { AiConfigService } from '../constants';

let sharedSdk: InjectionSDK | null = null;

export function getInjectionSdk(): InjectionSDK {
  if (!sharedSdk) {
    sharedSdk = new InjectionSDK({
      inputRegex: [
        'ignore previous instructions',
        'jailbreak',
        'system prompt',
        'override instructions',
        'developer mode',
      ],
      outputBlockedWords: ['AKIA', 'sk-'],
      outputBlockedCodeFormats: ['SQL'],
    });
  }
  return sharedSdk;
}

function getQueryText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const q = (body as Record<string, unknown>).query;
  return typeof q === 'string' ? q : null;
}

/**
 * Step 2 in sequence diagram: Validation Injection prompt.
 * Offline regex only (no Azure/external key per spec).
 * Blocks with 400 AI_INJECTION_DETECTED (SDK uses 446 internally, mapped here).
 */
@Injectable()
export class InjectionGuard implements CanActivate {
  private readonly logger = new Logger(InjectionGuard.name);

  constructor(private readonly aiConfig: AiConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const body = req.body ?? {};
    const cfg = this.aiConfig.resolve();

    const query =
      getQueryText(body) ??
      (typeof req.query?.query === 'string' ? req.query.query : null);
    if (typeof query === 'string') {
      if (query.length > cfg.maxQueryChars) {
        throw new HttpException(
          {
            verdict: false,
            errorCode: 'AI_QUERY_TOO_LONG',
            message: `Query exceeds ${cfg.maxQueryChars} chars`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      // eslint-disable-next-line no-control-regex
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(query)) {
        throw new HttpException(
          {
            verdict: false,
            errorCode: 'AI_QUERY_INVALID',
            message: 'Query contains control characters',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    let scan: { shouldDeny: boolean; verdict: boolean; results: unknown };
    try {
      const sdk = getInjectionSdk();
      const payload = query !== null ? { ...body, query } : body;
      const r = await sdk.scanInput(payload, 'chatComplete', req.headers ?? {});
      scan = r as unknown as typeof scan;
    } catch (e) {
      this.logger.warn(`scanInput failed open? deny: ${String(e)}`);
      throw new HttpException(
        { verdict: false, errorCode: 'AI_INJECTION_SCAN_FAILED' },
        HttpStatus.BAD_REQUEST,
      );
    }
    (req as Record<string, unknown>).injectionScan = scan;
    if (scan.shouldDeny) {
      this.logger.warn('Injection blocked (input)');
      throw new HttpException(
        {
          verdict: false,
          errorCode: 'AI_INJECTION_DETECTED',
          message: 'Prompt rejected by injection guard',
          hook_results: (scan as { results?: unknown }).results,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return true;
  }
}
