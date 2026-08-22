/**
 * Minimal in-memory sliding-window rate limiter, keyed per process.
 *
 * This is a first line of defense against rapid-fire login attempts from a
 * single instance; it does NOT share state across multiple server instances.
 * The authoritative, persistent guard against credential stuffing is the
 * DB-backed per-account lockout in `lib/auth/session.ts`
 * (`User.failedLoginCount` / `User.lockedUntil`), which works regardless of
 * how many instances are running. For multi-instance production deployments,
 * swap this for a Redis-backed limiter.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  windowMs: number,
  maxAttempts: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: windowMs - (now - bucket.windowStart) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

// Periodically drop stale buckets so this map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 1000 * 60 * 10) buckets.delete(key);
  }
}, 1000 * 60 * 5).unref?.();
