import { FailureRecord } from './types';

export interface ResilienceOptions {
  phase: string;
  provider: string;
  maxAttempts?: number;
  initialDelayMs?: number;
  fallbackValue?: any;
}

/**
 * Executes an asynchronous intelligence operation with automatic retries,
 * backoff, and non-fatal fallback recovery.
 */
export async function executeWithResilience<T>(
  fn: () => Promise<T>,
  options: ResilienceOptions,
  failuresAccumulator?: FailureRecord[]
): Promise<T> {
  const {
    phase,
    provider,
    maxAttempts = 3,
    initialDelayMs = 1000,
    fallbackValue,
  } = options;

  let attempts = 0;
  let lastError: any = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const statusCode = err.statusCode || err.status || 500;
      const isRetryable = statusCode === 429 || statusCode >= 500 || err.name === 'AbortError';

      if (isRetryable && attempts < maxAttempts) {
        const delay = initialDelayMs * Math.pow(2, attempts - 1) + Math.random() * 400;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }

  // Record failure telemetries
  const failureRecord: FailureRecord = {
    errorCode: lastError?.statusCode ? `HTTP_${lastError.statusCode}` : 'INTERNAL_PIPELINE_ERROR',
    errorMessage: lastError?.message || 'Operation failed',
    provider,
    phase,
    retryable: lastError?.isRetryable || false,
    attemptCount: attempts,
    timestamp: new Date().toISOString(),
  };

  if (failuresAccumulator) {
    failuresAccumulator.push(failureRecord);
  }

  if (fallbackValue !== undefined) {
    return fallbackValue;
  }

  throw lastError;
}
