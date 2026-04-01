const validErrorToRetry = new Set<number>([500, 502, 503, 504, 429]);
export const RETRY_VALUES = {
  MAX_RETRY_TIMES: 3,
  BASE_DELAY_MS: 300,
  BACKOFF_MUL: 2,
  MAX_DELAY_MS: 3000,
};
export interface RetryCoreOptions {
  maxRetryTimes: number;
  baseDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}

export async function retryCore<T>(
  fn: () => Promise<T>,
  options: RetryCoreOptions,
): Promise<T> {
  let timesRetry = 0;

  while (timesRetry <= options.maxRetryTimes) {
    try {
      return await fn();
    } catch (error: unknown) {
      const errorStatus = getErrorStatus(error);
      const canRetry =
        errorStatus !== null && validErrorToRetry.has(errorStatus);

      if (!canRetry || timesRetry >= options.maxRetryTimes) {
        throw error;
      }

      let delay =
        options.baseDelayMs * Math.pow(options.backoffMultiplier, timesRetry);
      delay = Math.min(delay, options.maxDelayMs);

      timesRetry++;
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw new Error('Retry failed unexpectedly');
}
