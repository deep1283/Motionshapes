// Upstash rate limiting is disabled
export function getUserIdentifier(userId?: string | null, ip?: string): string {
  return userId || ip || 'anonymous'
}

export async function checkAIGenerationLimit(identifier: string) {
  void identifier
  return {
    success: true,
    limit: 100,
    remaining: 100,
    resetAt: new Date(Date.now() + 86400000), // 1 day from now
  }
}
