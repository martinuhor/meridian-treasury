type Bucket = { count: number; resetAt: number };

const globalBuckets = globalThis as unknown as {
  __meridianRateBuckets?: Map<string, Bucket>;
};

const MAX_KEYS = 2_000;

function buckets() {
  if (!globalBuckets.__meridianRateBuckets) {
    globalBuckets.__meridianRateBuckets = new Map();
  }
  return globalBuckets.__meridianRateBuckets;
}

function prune(now: number) {
  const map = buckets();
  for (const [key, bucket] of map) {
    if (bucket.resetAt <= now) map.delete(key);
  }
  // Hard cap: drop oldest insertions if still over budget.
  while (map.size > MAX_KEYS) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

/**
 * Fixed-window rate limiter with eviction so keys cannot grow without bound.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const map = buckets();
  if (map.size > MAX_KEYS / 2) prune(now);

  const current = map.get(key);

  if (!current || current.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { ok: true };
}
