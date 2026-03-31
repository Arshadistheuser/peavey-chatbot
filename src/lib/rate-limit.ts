/**
 * Rate limiting using Upstash Redis.
 * Falls back to in-memory rate limiting if Upstash is not configured.
 * Free tier: 10K commands/day.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null = null;

// In-memory fallback when Upstash is not configured
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getUpstashRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, "60 s"), // 20 requests per minute
      analytics: true,
    });
    return ratelimit;
  }

  return null;
}

export async function checkRateLimit(
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const upstash = getUpstashRatelimit();

  if (upstash) {
    const result = await upstash.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  // In-memory fallback
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const maxRequests = 20;

  // Cleanup expired entries every 50 requests to prevent memory leak
  if (memoryStore.size > 50) {
    for (const [key, val] of memoryStore) {
      if (now > val.resetAt) memoryStore.delete(key);
    }
  }

  const entry = memoryStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1, reset: now + windowMs };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }

  return {
    success: true,
    remaining: maxRequests - entry.count,
    reset: entry.resetAt,
  };
}
