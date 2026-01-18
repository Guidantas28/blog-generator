import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { generateKeywords, generateBlogContent, AgentConfig } from '@/lib/openai'
import { searchImages } from '@/lib/images'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { trackApprovalAction } from '@/lib/approval-tracking'
import { z } from 'zod'
import { validateAndSanitize } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const regeneratePendingPostSchema = z.object({
  pendingPostId: z.string().uuid('ID do post inválido'),
  token: z.string().min(1, 'Token é obrigatório'),
})

/**
 * Regenera o conteúdo de um post pendente
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Rate limiting
    const rateLimitCheck = await checkRateLimit(request, RATE_LIMITS.GENERATE_CONTENT)
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit excedido', { endpoint: '/api/regenerate-pending-post' })
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente mais tarde.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validation = validateAndSanitize(regeneratePendingPostSchema, body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { pendingPostId, token } = validation.data

    const supabase = await getServerClient()

    // Buscar post pendente
    const { data: pendingPost, error: fetchError } = await supabase
      .from('pending_posts')
      .select('*, wordpress_sites(*)')
      .eq('id', pendingPostId)
      .eq('approval_token', token)
      .single()

    if (fetchError || !pendingPost) {
      return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
    }

    if (pendingPost.status !== 'pending' && pendingPost.status !== 'edited') {
      return NextResponse.json(
        { error: 'Post já foi processado' },
        { status: 400 }
      )
    }

    const siteData = pendingPost.wordpress_sites

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

    // Regenerar palavras-chave
    const keywords = await generateKeywords(pendingPost.topic || pendingPost.title)
    const keywordsArray = Array.isArray(keywords) ? keywords : []

    // Regenerar conteúdo
    const content = await generateBlogContent(
      pendingPost.topic || pendingPost.title,
      keywordsArray,
      siteData.cta_text || undefined,
      siteData.cta_link || undefined,
      siteData.phone_number || undefined,
      colors,
      agentConfig
    )

    // Buscar nova imagem
    let imageUrl = pendingPost.image_url
    try {
      const images = await searchImages(pendingPost.topic || pendingPost.title, 1)
      if (images && images.length > 0) {
        imageUrl = images[0] // searchImages retorna string[], não objetos
      }
    } catch (imageError) {
      logger.warn('Erro ao buscar nova imagem', { error: imageError })
    }

    // Atualizar post pendente
    const { data: updatedPost, error: updateError } = await supabase
      .from('pending_posts')
      .update({
        title: content.title,
        content: content.content,
        excerpt: content.excerpt || '',
        keywords: keywordsArray,
        image_url: imageUrl,
        seo_title: content.title,
        seo_description: content.excerpt || '',
        status: 'edited',
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingPostId)
      .select('*, wordpress_sites(name, url)')
      .single()

    if (updateError) {
      logger.error('Erro ao atualizar post regenerado', updateError, {
        endpoint: '/api/regenerate-pending-post',
      })
      return NextResponse.json(
        { error: 'Erro ao atualizar post' },
        { status: 500 }
      )
    }

    // Registrar ação de regeneração
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    await trackApprovalAction(supabase, {
      action: 'regenerate',
      pendingPostId,
      ipAddress,
      userAgent,
      actionData: {
        new_title: content.title,
        regenerated_at: new Date().toISOString(),
      },
    })

    const duration = Date.now() - startTime
    logger.info('Post regenerado com sucesso', {
      endpoint: '/api/regenerate-pending-post',
      pendingPostId,
      duration: `${duration}ms`,
    })

    return NextResponse.json({
      success: true,
      post: updatedPost,
      message: 'Conteúdo regenerado com sucesso',
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Erro ao regenerar post pendente', error, {
      endpoint: '/api/regenerate-pending-post',
      duration: `${duration}ms`,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao regenerar post',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}
