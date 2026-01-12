import { NextRequest, NextResponse } from 'next/server'
import { searchImages } from '@/lib/images'
import { getServerClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { z } from 'zod'
import { validateAndSanitize } from '@/lib/validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const searchImagesSchema = z.object({
  query: z.string().min(1, 'Query é obrigatória').max(200).trim(),
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Rate limiting
    const rateLimitCheck = await checkRateLimit(request, RATE_LIMITS.SEARCH_IMAGES)
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit excedido', { endpoint: '/api/search-images' })
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
      logger.warn('Tentativa de acesso não autorizado', { endpoint: '/api/search-images' })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validação
    const body = await request.json()
    const validation = validateAndSanitize(searchImagesSchema, body)

    if (!validation.success) {
      logger.warn('Validação falhou', {
        endpoint: '/api/search-images',
        userId: session.user.id,
        errors: validation.error.errors,
      })
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { query } = validation.data

    logger.info('Buscando imagens', {
      endpoint: '/api/search-images',
      userId: session.user.id,
      query: query.substring(0, 50),
    })

    const images = await searchImages(query, 15)

    const duration = Date.now() - startTime
    logger.info('Imagens buscadas com sucesso', {
      endpoint: '/api/search-images',
      userId: session.user.id,
      imagesCount: images.length,
      duration: `${duration}ms`,
    })

    return NextResponse.json(
      { images },
      {
        headers: {
          'X-RateLimit-Limit': String(rateLimitCheck.result?.limit || RATE_LIMITS.SEARCH_IMAGES.limit),
          'X-RateLimit-Remaining': String(rateLimitCheck.result?.remaining || 0),
        },
      }
    )
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Erro ao buscar imagens', error, {
      endpoint: '/api/search-images',
      duration: `${duration}ms`,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao buscar imagens',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}

