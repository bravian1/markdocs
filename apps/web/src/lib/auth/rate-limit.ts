import crypto from "node:crypto";

interface Bucket {
  count: number;
  resetAt: number;
}

/** In-memory fixed-window rate limiter (per process). */
const buckets = new Map<string, Bucket>();

/**
 * Consume one attempt for a key.
 * Returns false when the caller is over `limit` within `windowMs`.
 */
export function consumeAttempt(key: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  if (bucket.count > limit) return false;
  return true;
}

/** Stable per-request key (IP hash). One job: key derivation. */
export function attemptKey(request: Request, scope: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  return crypto.createHash("sha256").update(`${scope}:${ip}`).digest("hex");
}
