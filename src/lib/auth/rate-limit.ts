export interface RateLimiter {
  check(key: string, now?: number): { allowed: boolean; retryAfterSeconds: number };
  recordFailure(key: string, now?: number): void;
  reset(key: string): void;
}

// In-process fixed window; with several server instances each enforces its own limit.
export function createRateLimiter(options: { maxFailures: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const failures = new Map<string, { count: number; resetAt: number }>();
  const maxKeys = options.maxKeys ?? 10_000;

  const current = (key: string, now: number) => {
    const entry = failures.get(key);
    if (entry && entry.resetAt <= now) {
      failures.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    check(key, now = Date.now()) {
      const entry = current(key, now);
      if (!entry || entry.count < options.maxFailures) return { allowed: true, retryAfterSeconds: 0 };
      return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    },
    recordFailure(key, now = Date.now()) {
      const entry = current(key, now);
      if (entry) {
        entry.count++;
        return;
      }
      if (failures.size >= maxKeys) {
        for (const [k, v] of failures) if (v.resetAt <= now) failures.delete(k);
        if (failures.size >= maxKeys) failures.delete(failures.keys().next().value!);
      }
      failures.set(key, { count: 1, resetAt: now + options.windowMs });
    },
    reset(key) {
      failures.delete(key);
    },
  };
}
