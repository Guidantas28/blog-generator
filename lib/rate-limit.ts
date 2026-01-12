/**
 * Sistema de Rate Limiting
 * Usa Upstash Redis para rate limiting distribuído
 */

interface RateLimitConfig {
  limit: number
  window: string // Ex: '1 h', '10 m', '1 d'
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

class RateLimiter {
  private redis: any = null
  private initialized = false

  private async init(): Promise<void> {
    if (this.initialized) return

    try {
      // Tentar usar Upstash Redis se disponível
      const { Redis } = await import('@upstash/redis')
      const { Ratelimit } = await import('@upstash/ratelimit')

      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        this.redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        })
        this.initialized = true
      }
    } catch (error) {
      // Se Upstash não estiver configurado, usar fallback em memória
      console.warn('Upstash Redis não configurado, usando rate limiting em memória (não recomendado para produção)')
    }
  }

  /**
   * Verifica se uma requisição deve ser limitada
   */
  async checkLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    await this.init()

    // Se Upstash não estiver disponível, usar fallback em memória
    if (!this.redis) {
      return this.checkLimitInMemory(identifier, config)
    }

    try {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const ratelimit = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(config.limit, config.window as any),
      })

      const result = await ratelimit.limit(identifier)

      return {
        success: result.success,
        limit: config.limit,
        remaining: result.remaining,
        reset: result.reset,
      }
    } catch (error) {
      console.error('Erro no rate limiting:', error)
      // Em caso de erro, permitir a requisição (fail open)
      return {
        success: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset: Date.now() + 3600000, // 1 hora
      }
    }
  }

  /**
   * Fallback: Rate limiting em memória (apenas para desenvolvimento)
   */
  private memoryStore: Map<string, { count: number; reset: number }> = new Map()

  private checkLimitInMemory(
    identifier: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const now = Date.now()
    const windowMs = this.parseWindow(config.window)
    const key = `${identifier}:${config.window}`

    const stored = this.memoryStore.get(key)

    if (!stored || now > stored.reset) {
      // Nova janela
      this.memoryStore.set(key, {
        count: 1,
        reset: now + windowMs,
      })
      return {
        success: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset: now + windowMs,
      }
    }

    if (stored.count >= config.limit) {
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset: stored.reset,
      }
    }

    stored.count++
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - stored.count,
      reset: stored.reset,
    }
  }

  private parseWindow(window: string): number {
    const match = window.match(/^(\d+)\s*(s|m|h|d)$/)
    if (!match) return 3600000 // Default: 1 hora

    const value = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
      case 's':
        return value * 1000
      case 'm':
        return value * 60 * 1000
      case 'h':
        return value * 60 * 60 * 1000
      case 'd':
        return value * 24 * 60 * 60 * 1000
      default:
        return 3600000
    }
  }
}

export const rateLimiter = new RateLimiter()

/**
 * Middleware helper para rate limiting em rotas Next.js
 */
export async function checkRateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<{ allowed: boolean; result?: RateLimitResult }> {
  // Identificar usuário por IP ou user ID
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  const identifier = `ratelimit:${ip}`

  const result = await rateLimiter.checkLimit(identifier, config)

  if (!result.success) {
    return {
      allowed: false,
      result,
    }
  }

  return {
    allowed: true,
    result,
  }
}

/**
 * Configurações de rate limit por tipo de endpoint
 */
export const RATE_LIMITS = {
  GENERATE_CONTENT: { limit: 10, window: '1 h' },
  PUBLISH_POST: { limit: 5, window: '1 h' },
  SEARCH_IMAGES: { limit: 20, window: '1 h' },
  RESEARCH_TRENDS: { limit: 10, window: '1 h' },
  DEFAULT: { limit: 100, window: '1 h' },
} as const
