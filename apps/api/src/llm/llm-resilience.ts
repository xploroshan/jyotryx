import {
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  timeout,
  wrap,
  TimeoutStrategy,
  circuitBreaker,
} from 'cockatiel';

export interface ResiliencePolicy {
  execute<T>(fn: (context: any) => Promise<T>): Promise<T>;
}

export function createLlmPolicy(providerName: string): ResiliencePolicy {
  // Circuit breaker: opens after 5 consecutive failures, half-open after 30s
  const breaker = circuitBreaker(handleAll, {
    breaker: new ConsecutiveBreaker(5),
    halfOpenAfter: 30_000,
  });
  breaker.onBreak(() => {
    console.warn(`[LLM] Circuit breaker OPEN for ${providerName}`);
  });
  breaker.onHalfOpen(() => {
    console.log(`[LLM] Circuit breaker HALF-OPEN for ${providerName}, probing...`);
  });
  breaker.onReset(() => {
    console.log(`[LLM] Circuit breaker CLOSED for ${providerName}`);
  });

  // Retry: 2 attempts with exponential backoff (1s, 2s)
  const retryPolicy = retry(handleAll, {
    maxAttempts: 2,
    backoff: new ExponentialBackoff({ initialDelay: 1000 }),
  });

  // Timeout: 45s per attempt
  const timeoutPolicy = timeout(45_000, TimeoutStrategy.Aggressive);

  // Compose: timeout -> retry -> circuit breaker
  return wrap(timeoutPolicy, retryPolicy, breaker);
}
