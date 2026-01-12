import { NextRequest, NextResponse } from 'next/server'
import { generateKeywords } from '@/lib/openai'
import { getServerClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { z } from 'zod'
import { validateAndSanitize } from '@/lib/validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const generateKeywordsSchema = z.object({
  topic: z.string().min(1, 'Tópico é obrigatório').max(500).trim(),
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Rate limiting
    const rateLimitCheck = await checkRateLimit(request, RATE_LIMITS.GENERATE_CONTENT)
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit excedido', { endpoint: '/api/generate-keywords' })
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
      logger.warn('Tentativa de acesso não autorizado', { endpoint: '/api/generate-keywords' })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validação
    const body = await request.json()
    const validation = validateAndSanitize(generateKeywordsSchema, body)

    if (!validation.success) {
      logger.warn('Validação falhou', {
        endpoint: '/api/generate-keywords',
        userId: session.user.id,
        errors: validation.error.errors,
      })
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { topic } = validation.data

    logger.info('Gerando palavras-chave', {
      endpoint: '/api/generate-keywords',
      userId: session.user.id,
      topic: topic.substring(0, 50),
    })

    const keywords = await generateKeywords(topic)

    // Garantir que sempre retorne um array
    const keywordsArray = Array.isArray(keywords) ? keywords : []

    const duration = Date.now() - startTime
    logger.info('Palavras-chave geradas com sucesso', {
      endpoint: '/api/generate-keywords',
      userId: session.user.id,
      keywordsCount: keywordsArray.length,
      duration: `${duration}ms`,
    })

    return NextResponse.json(
      { keywords: keywordsArray },
      {
        headers: {
          'X-RateLimit-Limit': String(rateLimitCheck.result?.limit || RATE_LIMITS.GENERATE_CONTENT.limit),
          'X-RateLimit-Remaining': String(rateLimitCheck.result?.remaining || 0),
        },
      }
    )
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Erro ao gerar palavras-chave', error, {
      endpoint: '/api/generate-keywords',
      duration: `${duration}ms`,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao gerar palavras-chave',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}

