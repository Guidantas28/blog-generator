import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { researchMarketTrends } from '@/lib/openai-trends'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { z } from 'zod'
import { validateAndSanitize } from '@/lib/validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const researchTrendsSchema = z.object({
  businessCategory: z.string().min(1, 'Categoria do negócio é obrigatória').max(200).trim(),
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Rate limiting
    const rateLimitCheck = await checkRateLimit(request, RATE_LIMITS.RESEARCH_TRENDS)
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit excedido', { endpoint: '/api/research-trends' })
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente mais tarde.' },
        { status: 429 }
      )
    }

    // Autenticação
    const supabase = await getServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      logger.warn('Tentativa de acesso não autorizado', { endpoint: '/api/research-trends' })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validação
    const body = await request.json()
    const validation = validateAndSanitize(researchTrendsSchema, body)

    if (!validation.success) {
      logger.warn('Validação falhou', {
        endpoint: '/api/research-trends',
        userId: session.user.id,
        errors: validation.error.errors,
      })
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { businessCategory } = validation.data

    logger.info('Pesquisando tendências', {
      endpoint: '/api/research-trends',
      userId: session.user.id,
      category: businessCategory,
    })

    const trends = await researchMarketTrends(businessCategory)

    const duration = Date.now() - startTime
    logger.info('Tendências pesquisadas com sucesso', {
      endpoint: '/api/research-trends',
      userId: session.user.id,
      trendsCount: trends.length,
      duration: `${duration}ms`,
    })

    return NextResponse.json({ trends })
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Erro ao pesquisar tendências', error, {
      endpoint: '/api/research-trends',
      duration: `${duration}ms`,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao pesquisar tendências',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}

