import { NextRequest, NextResponse } from 'next/server'
import { generateBlogContent } from '@/lib/openai'
import { getServerClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { generateContentSchema, validateAndSanitize } from '@/lib/validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Rate limiting
    const rateLimitCheck = await checkRateLimit(request, RATE_LIMITS.GENERATE_CONTENT)
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit excedido', {
        endpoint: '/api/generate-content',
        remaining: rateLimitCheck.result?.remaining,
      })
      return NextResponse.json(
        {
          error: 'Muitas requisições. Tente novamente mais tarde.',
          retryAfter: Math.ceil((rateLimitCheck.result?.reset || Date.now() - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitCheck.result?.reset || Date.now() - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(rateLimitCheck.result?.limit || RATE_LIMITS.GENERATE_CONTENT.limit),
            'X-RateLimit-Remaining': String(rateLimitCheck.result?.remaining || 0),
            'X-RateLimit-Reset': String(rateLimitCheck.result?.reset || Date.now()),
          },
        }
      )
    }

    // Autenticação
    const supabase = await getServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      logger.warn('Tentativa de acesso não autorizado', { endpoint: '/api/generate-content' })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validação de entrada
    const body = await request.json()
    const validation = validateAndSanitize(generateContentSchema, body)

    if (!validation.success) {
      logger.warn('Validação falhou', {
        endpoint: '/api/generate-content',
        userId: session.user.id,
        errors: validation.error.errors,
      })
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { topic, keywords, siteId, ctaText, ctaLink, phoneNumber, colors } = validation.data

    logger.info('Gerando conteúdo', {
      endpoint: '/api/generate-content',
      userId: session.user.id,
      topic: topic.substring(0, 50), // Log apenas início do tópico
      siteId: siteId || 'none',
    })

    // Buscar configurações do agente se siteId for fornecido
    let agentConfig = undefined
    if (siteId) {
      const { data: siteData } = await supabase
        .from('wordpress_sites')
        .select('system_prompt, content_prompt_template, tone, writing_style, target_audience, additional_instructions')
        .eq('id', siteId)
        .eq('user_id', session.user.id)
        .single()

      if (siteData) {
        agentConfig = {
          system_prompt: siteData.system_prompt || undefined,
          content_prompt_template: siteData.content_prompt_template || undefined,
          tone: siteData.tone || undefined,
          writing_style: siteData.writing_style || undefined,
          target_audience: siteData.target_audience || undefined,
          additional_instructions: siteData.additional_instructions || undefined,
        }
      }
    }

    // Converter null para undefined no objeto colors
    const normalizedColors = colors ? {
      cta_primary_color: colors.cta_primary_color ?? undefined,
      cta_secondary_color: colors.cta_secondary_color ?? undefined,
      whatsapp_color: colors.whatsapp_color ?? undefined,
      keywords_bg_color: colors.keywords_bg_color ?? undefined,
      keywords_text_color: colors.keywords_text_color ?? undefined,
    } : undefined

    // Gerar conteúdo (converter null para undefined)
    const content = await generateBlogContent(
      topic,
      keywords,
      ctaText ?? undefined,
      ctaLink ?? undefined,
      phoneNumber ?? undefined,
      normalizedColors,
      agentConfig
    )

    const duration = Date.now() - startTime
    logger.info('Conteúdo gerado com sucesso', {
      endpoint: '/api/generate-content',
      userId: session.user.id,
      duration: `${duration}ms`,
    })

    return NextResponse.json(content, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitCheck.result?.limit || RATE_LIMITS.GENERATE_CONTENT.limit),
        'X-RateLimit-Remaining': String(rateLimitCheck.result?.remaining || 0),
        'X-RateLimit-Reset': String(rateLimitCheck.result?.reset || Date.now()),
      },
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Erro ao gerar conteúdo', error, {
      endpoint: '/api/generate-content',
      duration: `${duration}ms`,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao gerar conteúdo',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}

