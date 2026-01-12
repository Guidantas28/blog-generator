import { NextRequest, NextResponse } from 'next/server'
import { generateKeywords, generateBlogContent } from '@/lib/openai'
import { getServerClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { z } from 'zod'
import { validateAndSanitize } from '@/lib/validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const generateKeywordsSchema = z.object({
  topic: z.string().min(1, 'Tópico é obrigatório').max(500).trim(),
  ctaText: z.string().max(200).optional().nullable(),
  ctaLink: z.string().url().optional().nullable(),
  phoneNumber: z.string().regex(/^[\d\s\(\)\-\+]+$/).max(20).optional().nullable(),
  colors: z.object({
    cta_primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    cta_secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    whatsapp_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    keywords_bg_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    keywords_text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  }).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Rate limiting
    const rateLimitCheck = await checkRateLimit(request, RATE_LIMITS.GENERATE_CONTENT)
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit excedido', { endpoint: '/api/generate-keywords-and-content' })
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
      logger.warn('Tentativa de acesso não autorizado', { endpoint: '/api/generate-keywords-and-content' })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validação
    const body = await request.json()
    const validation = validateAndSanitize(generateKeywordsSchema, body)

    if (!validation.success) {
      logger.warn('Validação falhou', {
        endpoint: '/api/generate-keywords-and-content',
        userId: session.user.id,
        errors: validation.error.errors,
      })
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { topic, ctaText, ctaLink, phoneNumber, colors } = validation.data

    logger.info('Gerando palavras-chave e conteúdo', {
      endpoint: '/api/generate-keywords-and-content',
      userId: session.user.id,
      topic: topic.substring(0, 50),
    })

    // Gerar palavras-chave primeiro
    const keywords = await generateKeywords(topic)
    const keywordsArray = Array.isArray(keywords) ? keywords : []

    // Converter null para undefined no objeto colors
    const normalizedColors = colors ? {
      cta_primary_color: colors.cta_primary_color ?? undefined,
      cta_secondary_color: colors.cta_secondary_color ?? undefined,
      whatsapp_color: colors.whatsapp_color ?? undefined,
      keywords_bg_color: colors.keywords_bg_color ?? undefined,
      keywords_text_color: colors.keywords_text_color ?? undefined,
    } : undefined

    // Gerar conteúdo apenas uma vez com as palavras-chave
    const finalContent = await generateBlogContent(
      topic,
      keywordsArray,
      ctaText ?? undefined,
      ctaLink ?? undefined,
      phoneNumber ?? undefined,
      normalizedColors
    )

    const duration = Date.now() - startTime
    logger.info('Palavras-chave e conteúdo gerados com sucesso', {
      endpoint: '/api/generate-keywords-and-content',
      userId: session.user.id,
      duration: `${duration}ms`,
    })

    return NextResponse.json({
      keywords: keywordsArray,
      title: finalContent.title,
      content: finalContent.content,
      excerpt: finalContent.excerpt,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Erro ao gerar palavras-chave e conteúdo', error, {
      endpoint: '/api/generate-keywords-and-content',
      duration: `${duration}ms`,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao gerar palavras-chave e conteúdo',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}

