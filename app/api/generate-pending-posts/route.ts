import { NextRequest, NextResponse } from 'next/server'
import { getServerClient, getServiceRoleClient } from '@/lib/supabase-server'
import { generateKeywords, generateBlogContent, generateUniqueTopics, AgentConfig } from '@/lib/openai'
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
        userId: sessionUserId,
        errors: validation.error.errors,
      })
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { siteId, scheduledDate, count } = validation.data
    const postCount = count || 3 // Garantir que count tenha um valor padrão

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
      count: postCount,
    })

    // Buscar dados do site
    // Se for chamada interna, usar service role e não filtrar por user_id (RLS já bypassado)
    // IMPORTANTE: Selecionar explicitamente todos os campos de configuração do agente
    let siteQuery = supabase
      .from('wordpress_sites')
      .select(`
        id,
        name,
        url,
        user_id,
        cta_text,
        cta_link,
        phone_number,
        cta_primary_color,
        cta_secondary_color,
        whatsapp_color,
        keywords_bg_color,
        keywords_text_color,
        system_prompt,
        content_prompt_template,
        tone,
        writing_style,
        target_audience,
        additional_instructions
      `)
      .eq('id', siteId)
    
    // Só filtrar por user_id se não for chamada interna (para segurança)
    if (!isInternalRequest) {
      siteQuery = siteQuery.eq('user_id', sessionUserId)
    }
    
    const { data: siteData, error: siteError } = await siteQuery.single()

    if (siteError || !siteData) {
      logger.error('Erro ao buscar dados do site', {
        siteId,
        userId: sessionUserId,
        isInternalRequest,
        error: siteError?.message,
        errorCode: siteError?.code,
      })
      return NextResponse.json({ 
        error: 'Site não encontrado',
        details: siteError?.message,
      }, { status: 404 })
    }
    
    logger.info('Dados do site carregados', {
      siteId,
      siteName: siteData.name,
      hasSystemPrompt: !!siteData.system_prompt,
      hasContentPromptTemplate: !!siteData.content_prompt_template,
      hasTone: !!siteData.tone,
      hasWritingStyle: !!siteData.writing_style,
      hasTargetAudience: !!siteData.target_audience,
      hasAdditionalInstructions: !!siteData.additional_instructions,
    })

    // Configurações do agente
    // Converter null/empty string para undefined, mas manter strings válidas
    // IMPORTANTE: Não usar || undefined pois pode perder valores válidos como "0" ou false
    const normalizeString = (value: any): string | undefined => {
      if (value === null || value === undefined) return undefined
      const str = String(value).trim()
      return str !== '' ? str : undefined
    }
    
    const agentConfig: AgentConfig = {
      system_prompt: normalizeString(siteData.system_prompt),
      content_prompt_template: normalizeString(siteData.content_prompt_template),
      tone: normalizeString(siteData.tone),
      writing_style: normalizeString(siteData.writing_style),
      target_audience: normalizeString(siteData.target_audience),
      additional_instructions: normalizeString(siteData.additional_instructions),
    }
    
    // Log detalhado das configurações do agente
    logger.info('Configurações do agente carregadas', {
      siteId,
      siteName: siteData.name,
      rawSystemPrompt: siteData.system_prompt,
      rawSystemPromptType: typeof siteData.system_prompt,
      rawSystemPromptLength: siteData.system_prompt?.length || 0,
      hasSystemPrompt: !!siteData.system_prompt,
      systemPromptPreview: siteData.system_prompt?.substring(0, 200) || 'não configurado',
      agentConfigSystemPrompt: agentConfig.system_prompt?.substring(0, 200) || 'undefined',
      hasContentPromptTemplate: !!siteData.content_prompt_template,
      hasTone: !!siteData.tone,
      tone: siteData.tone,
      hasWritingStyle: !!siteData.writing_style,
      writingStyle: siteData.writing_style,
      hasTargetAudience: !!siteData.target_audience,
      targetAudience: siteData.target_audience,
      hasAdditionalInstructions: !!siteData.additional_instructions,
      additionalInstructionsPreview: siteData.additional_instructions?.substring(0, 100) || 'não configurado',
    })

    const colors = {
      cta_primary_color: siteData.cta_primary_color || undefined,
      cta_secondary_color: siteData.cta_secondary_color || undefined,
      whatsapp_color: siteData.whatsapp_color || undefined,
      keywords_bg_color: siteData.keywords_bg_color || undefined,
      keywords_text_color: siteData.keywords_text_color || undefined,
    }

    // Gerar múltiplos posts
    const generatedPosts = []
    
    // Gerar tópicos únicos ANTES do loop para garantir diversidade
    logger.info('Gerando tópicos únicos', {
      siteId,
      siteName: siteData.name,
      count: postCount,
      hasSystemPrompt: !!agentConfig.system_prompt,
    })
    
    let topics: string[] = []
    try {
      topics = await generateUniqueTopics(siteData.name, postCount, agentConfig)
      logger.info('Tópicos únicos gerados', {
        topicsCount: topics.length,
        topics: topics.map(t => t.substring(0, 50)),
      })
    } catch (error: any) {
      logger.error('Erro ao gerar tópicos únicos, usando fallback', {
        error: error.message,
        siteId,
      })
      // Fallback: gerar tópicos variados manualmente
      const themes = [
        'Estratégias Avançadas',
        'Tendências do Mercado',
        'Guia Completo',
        'Análise Detalhada',
        'Comparação de Opções',
        'Dicas Práticas',
        'Oportunidades',
        'Benefícios',
        'Como Escolher',
        'Mistérios Revelados',
      ]
      for (let i = 0; i < postCount; i++) {
        const theme = themes[i % themes.length]
        topics.push(`${theme} para ${siteData.name}`)
      }
    }
    
    for (let i = 0; i < postCount; i++) {
      try {
        // Usar tópico único gerado anteriormente
        const topic = topics[i] || `Conteúdo ${i + 1} para ${siteData.name}`
        
        logger.info(`Gerando post ${i + 1}/${postCount}`, {
          topic,
          hasAgentConfig: !!agentConfig,
          systemPrompt: agentConfig.system_prompt?.substring(0, 100) || 'não configurado',
        })
        
        // Gerar palavras-chave
        const keywords = await generateKeywords(topic)
        const keywordsArray = Array.isArray(keywords) ? keywords : []

        // Log antes de gerar conteúdo
        logger.info('Chamando generateBlogContent', {
          topic,
          hasAgentConfig: !!agentConfig,
          systemPrompt: agentConfig.system_prompt?.substring(0, 200) || 'não configurado',
        })

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
            imageUrl = images[0] // searchImages retorna string[], não objetos
          }
        } catch (imageError) {
          logger.warn('Erro ao buscar imagem', { error: imageError, topic })
        }

        // Gerar token único de aprovação
        const approvalToken = crypto.randomBytes(32).toString('hex')

        // Calcular data de expiração (5 dias a partir de agora)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 5)

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
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single()

        if (insertError) {
          logger.error('Erro ao salvar post pendente', insertError, {
            endpoint: '/api/generate-pending-posts',
            userId: sessionUserId,
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
          userId: sessionUserId,
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
