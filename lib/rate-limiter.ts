import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Create Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Rate limiter for AI image generation
// 5 requests per day per user (resets at midnight UTC)
export const aiGenerationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 d'), // 5 per day
  analytics: true, // Enable analytics in Upstash dashboard
  prefix: 'ratelimit:ai-generation',
})

// Helper to get user identifier (user ID or IP as fallback)
export function getUserIdentifier(userId?: string | null, ip?: string): string {
  return userId || ip || 'anonymous'
}

// Check rate limit and return result
export async function checkAIGenerationLimit(identifier: string) {
  const { success, limit, reset, remaining } = await aiGenerationLimiter.limit(identifier)
  
  return {
    success,
    limit,
    remaining,
    resetAt: new Date(reset),
  }
}
