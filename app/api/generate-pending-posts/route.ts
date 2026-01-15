import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { generateKeywords, generateBlogContent, AgentConfig } from '@/lib/openai'
import { searchImages } from '@/lib/images'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateAndSanitize } from '@/lib/validation'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const generatePendingPostsSchema = z.object({
  siteId: z.string().uuid('ID do site inválido'),
  scheduledDate: z.string().datetime('Data inválida'),
  count: z.number().int().min(1).max(10).default(3), // Número de posts a gerar
})

/**
 * Gera posts pendentes de aprovação 3 dias antes da data de publicação
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Rate limiting
    const rateLimitCheck = await checkRateLimit(request, RATE_LIMITS.GENERATE_CONTENT)
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit excedido', { endpoint: '/api/generate-pending-posts' })
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente mais tarde.' },
        { status: 429 }
      )
    }

    // Autenticação - permitir chamadas internas via header especial
    const isInternalRequest = request.headers.get('x-internal-request') === 'true'
    const userId = request.headers.get('x-user-id')
    
    const supabase = isInternalRequest && userId 
      ? getServiceRoleClient() 
      : await getServerClient()
    
    let sessionUserId: string
    
    if (isInternalRequest && userId) {
      // Chamada interna - usar userId do header
      sessionUserId = userId
    } else {
      // Chamada normal - verificar sessão
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        logger.warn('Tentativa de acesso não autorizado', { endpoint: '/api/generate-pending-posts' })
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
      sessionUserId = session.user.id
    }

    // Validação
    const body = await request.json()
    const validation = validateAndSanitize(generatePendingPostsSchema, body)

    if (!validation.success) {
      logger.warn('Validação falhou', {
        endpoint: '/api/generate-pending-posts',
        userId: session.user.id,
        errors: validation.error.errors,
      })
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { siteId, scheduledDate, count } = validation.data

    // Validar que a data é futura
    const scheduledDateTime = new Date(scheduledDate)
    if (scheduledDateTime <= new Date()) {
      return NextResponse.json(
        { error: 'A data de agendamento deve ser no futuro' },
        { status: 400 }
      )
    }

    logger.info('Gerando posts pendentes', {
      endpoint: '/api/generate-pending-posts',
      userId: sessionUserId,
      siteId,
      scheduledDate,
      count,
    })

    // Buscar dados do site
    const { data: siteData, error: siteError } = await supabase
      .from('wordpress_sites')
      .select('*')
      .eq('id', siteId)
      .eq('user_id', sessionUserId)
      .single()

    if (siteError || !siteData) {
      return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })
    }

    // Configurações do agente
    const agentConfig: AgentConfig = {
      system_prompt: siteData.system_prompt || undefined,
      content_prompt_template: siteData.content_prompt_template || undefined,
      tone: siteData.tone || undefined,
      writing_style: siteData.writing_style || undefined,
      target_audience: siteData.target_audience || undefined,
      additional_instructions: siteData.additional_instructions || undefined,
    }

    const colors = {
      cta_primary_color: siteData.cta_primary_color || undefined,
      cta_secondary_color: siteData.cta_secondary_color || undefined,
      whatsapp_color: siteData.whatsapp_color || undefined,
      keywords_bg_color: siteData.keywords_bg_color || undefined,
      keywords_text_color: siteData.keywords_text_color || undefined,
    }

    // Gerar múltiplos posts
    const generatedPosts = []
    
    for (let i = 0; i < count; i++) {
      try {
        // Gerar tópico baseado na categoria do negócio ou usar um genérico
        // Por enquanto, vamos usar um tópico genérico que pode ser personalizado
        const topic = `Conteúdo ${i + 1} para ${siteData.name}`
        
        // Gerar palavras-chave
        const keywords = await generateKeywords(topic)
        const keywordsArray = Array.isArray(keywords) ? keywords : []

        // Gerar conteúdo
        const content = await generateBlogContent(
          topic,
          keywordsArray,
          siteData.cta_text || undefined,
          siteData.cta_link || undefined,
          siteData.phone_number || undefined,
          colors,
          agentConfig
        )

        // Buscar imagem
        let imageUrl = null
        try {
          const images = await searchImages(topic, 1)
          if (images && images.length > 0) {
            imageUrl = images[0].url
          }
        } catch (imageError) {
          logger.warn('Erro ao buscar imagem', { error: imageError, topic })
        }

        // Gerar token único de aprovação
        const approvalToken = crypto.randomBytes(32).toString('hex')

        // Salvar post pendente
        const { data: pendingPost, error: insertError } = await supabase
          .from('pending_posts')
          .insert({
            user_id: sessionUserId,
            site_id: siteId,
            topic: content.title,
            title: content.title,
            content: content.content,
            excerpt: content.excerpt || '',
            keywords: keywordsArray,
            image_url: imageUrl,
            seo_title: content.title,
            seo_description: content.excerpt || '',
            scheduled_date: scheduledDateTime.toISOString(),
            status: 'pending',
            approval_token: approvalToken,
          })
          .select()
          .single()

        if (insertError) {
          logger.error('Erro ao salvar post pendente', insertError, {
            endpoint: '/api/generate-pending-posts',
            userId: session.user.id,
          })
          continue
        }

        generatedPosts.push({
          id: pendingPost.id,
          title: content.title,
          approvalToken,
        })
      } catch (error: any) {
        logger.error(`Erro ao gerar post ${i + 1}`, error, {
          endpoint: '/api/generate-pending-posts',
          userId: session.user.id,
        })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Posts pendentes gerados', {
      endpoint: '/api/generate-pending-posts',
      userId: sessionUserId,
      count: generatedPosts.length,
      duration: `${duration}ms`,
    })

    return NextResponse.json({
      success: true,
      posts: generatedPosts,
      message: `${generatedPosts.length} post(s) gerado(s) com sucesso`,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Erro ao gerar posts pendentes', error, {
      endpoint: '/api/generate-pending-posts',
      duration: `${duration}ms`,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao gerar posts pendentes',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}
