/**
 * In-memory sliding-window rate limiter. Deliberately not backed by
 * Redis/Upstash/anything external -- that's an infra decision (new
 * service, env vars, likely cost) that isn't mine to make. This is a
 * "better than nothing" baseline: it only protects a single warm
 * serverless instance, not the whole deployment (Vercel can run several
 * instances concurrently, each with its own memory, and a cold start wipes
 * it). Good enough to stop a dumb loop hammering one action; not a real
 * defense against a distributed abuser. Upgrade to a shared store if that
 * ever matters.
 */
const buckets = new Map<string, number[]>();

// Bounds memory from accumulating one entry per distinct key forever
// (every guest IP that ever signed in, say). Only runs the sweep once the
// map has grown enough to be worth the O(n) pass.
const SWEEP_THRESHOLD = 5000;

function sweep(now: number, maxWindowMs: number) {
  if (buckets.size < SWEEP_THRESHOLD) return;
  for (const [key, timestamps] of buckets) {
    const recent = timestamps.filter((t) => now - t < maxWindowMs);
    if (recent.length === 0) buckets.delete(key);
    else buckets.set(key, recent);
  }
}

/**
 * Records a hit for `key` and reports whether it exceeds `limit` hits
 * within the trailing `windowMs`. Call this once per attempt, at the top
 * of the action, before doing the real work.
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now, windowMs);

  const timestamps = buckets.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);

  return recent.length > limit;
}
