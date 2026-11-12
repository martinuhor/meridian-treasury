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

type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

function retryAfter(bucket: Bucket, now: number) {
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
}

/** Peek without consuming — use to reject early before expensive work. */
export function rateLimitPeek(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const map = buckets();
  if (map.size > MAX_KEYS / 2) prune(now);
  const current = map.get(key);
  if (!current || current.resetAt <= now) return { ok: true };
  if (current.count >= limit) {
    return { ok: false, retryAfterSec: retryAfter(current, now) };
  }
  return { ok: true };
}

/**
 * Fixed-window rate limiter with eviction so keys cannot grow without bound.
 * Consumes one unit on success.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const map = buckets();
  if (map.size > MAX_KEYS / 2) prune(now);

  const current = map.get(key);

  if (!current || current.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (current.count >= limit) {
    return { ok: false, retryAfterSec: retryAfter(current, now) };
  }

  current.count += 1;
  return { ok: true };
}
