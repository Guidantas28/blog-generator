import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { researchMarketTrends } from '@/lib/openai-trends'
import { generateKeywords, generateBlogContent } from '@/lib/openai'
import { searchDiverseImages, searchImages } from '@/lib/images'
import { filterDuplicateTrends, checkDuplicateTopic } from '@/lib/duplicate-check'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { z } from 'zod'
import { validateAndSanitize } from '@/lib/validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const generateAutomatedContentSchema = z.object({
  siteId: z.string().uuid('ID do site inválido'),
  businessCategory: z.string().min(1, 'Categoria do negócio é obrigatória').max(200).trim(),
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Rate limiting
    const rateLimitCheck = await checkRateLimit(request, RATE_LIMITS.GENERATE_CONTENT)
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit excedido', { endpoint: '/api/generate-automated-content' })
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
      logger.warn('Tentativa de acesso não autorizado', { endpoint: '/api/generate-automated-content' })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validação
    const body = await request.json()
    const validation = validateAndSanitize(generateAutomatedContentSchema, body)

    if (!validation.success) {
      logger.warn('Validação falhou', {
        endpoint: '/api/generate-automated-content',
        userId: session.user.id,
        errors: validation.error.errors,
      })
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { siteId, businessCategory } = validation.data

    logger.info('Gerando conteúdo automático', {
      endpoint: '/api/generate-automated-content',
      userId: session.user.id,
      siteId,
      category: businessCategory,
    })

    // Buscar dados do site para obter CTA, telefone, cores e configurações do agente
    const { data: siteData, error: siteError } = await supabase
      .from('wordpress_sites')
      .select('cta_text, cta_link, phone_number, cta_primary_color, cta_secondary_color, whatsapp_color, keywords_bg_color, keywords_text_color, system_prompt, content_prompt_template, tone, writing_style, target_audience, additional_instructions')
      .eq('id', siteId)
      .eq('user_id', session.user.id)
      .single()

    const ctaText = siteData?.cta_text || undefined
    const ctaLink = siteData?.cta_link || undefined
    const phoneNumber = siteData?.phone_number || undefined
    const colors = siteData ? {
      cta_primary_color: siteData.cta_primary_color || undefined,
      cta_secondary_color: siteData.cta_secondary_color || undefined,
      whatsapp_color: siteData.whatsapp_color || undefined,
      keywords_bg_color: siteData.keywords_bg_color || undefined,
      keywords_text_color: siteData.keywords_text_color || undefined,
    } : undefined
    
    // Configurações do agente
    const agentConfig = siteData ? {
      system_prompt: siteData.system_prompt || undefined,
      content_prompt_template: siteData.content_prompt_template || undefined,
      tone: siteData.tone || undefined,
      writing_style: siteData.writing_style || undefined,
      target_audience: siteData.target_audience || undefined,
      additional_instructions: siteData.additional_instructions || undefined,
    } : undefined

    // 1. Pesquisar tendências do mercado
    const trends = await researchMarketTrends(businessCategory)
    if (trends.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível encontrar tendências para esta categoria' },
        { status: 500 }
      )
    }

    // 2. Filtrar tendências que já foram usadas (verificar duplicatas)
    const filteredTrends = await filterDuplicateTrends(supabase, siteId, trends)
    
    // Se todas as tendências foram filtradas, usar as originais mas avisar
    const trendsToUse = filteredTrends.length > 0 ? filteredTrends : trends
    if (filteredTrends.length === 0 && trends.length > 0) {
      logger.warn('Todas as tendências são similares a posts anteriores. Usando tendências originais.', {
        endpoint: '/api/generate-automated-content',
        siteId,
      })
    }

    // 3. Selecionar uma tendência aleatória e verificar duplicatas
    let selectedTrend = trendsToUse[Math.floor(Math.random() * trendsToUse.length)]
    let attempts = 0
    const maxAttempts = 5
    
    // Tentar encontrar uma tendência que não seja duplicada
    while (attempts < maxAttempts && trendsToUse.length > 1) {
      const { isDuplicate, similarPosts } = await checkDuplicateTopic(supabase, siteId, selectedTrend)
      
      if (!isDuplicate) {
        // Encontrou uma tendência única, usar ela
        break
      }
      
      // Se for duplicado, tentar outra tendência
      if (similarPosts.length > 0) {
        logger.warn(`Tendência "${selectedTrend}" é similar a posts anteriores. Tentando outra...`, {
          endpoint: '/api/generate-automated-content',
          siteId,
        })
        const alternativeTrends = trendsToUse.filter(t => t !== selectedTrend)
        if (alternativeTrends.length > 0) {
          selectedTrend = alternativeTrends[Math.floor(Math.random() * alternativeTrends.length)]
        } else {
          // Não há mais alternativas, usar a atual mesmo sendo duplicada
          logger.warn(`Aviso: Todas as tendências são similares. Usando "${selectedTrend}" mesmo assim.`, {
            endpoint: '/api/generate-automated-content',
            siteId,
          })
          break
        }
      }
      attempts++
    }

    // 4. Gerar palavras-chave baseadas na tendência selecionada
    const keywords = await generateKeywords(selectedTrend)
    const keywordsArray = Array.isArray(keywords) ? keywords : []

    // 5. Gerar conteúdo do blog com CTA, telefone, cores e configurações do agente do site
    const content = await generateBlogContent(
      selectedTrend,
      keywordsArray,
      ctaText,
      ctaLink,
      phoneNumber,
      colors,
      agentConfig
    )
    
    // 6. Verificar duplicata no título gerado também
    const { isDuplicate: isTitleDuplicate } = await checkDuplicateTopic(
      supabase,
      siteId,
      selectedTrend,
      content.title
    )
    if (isTitleDuplicate) {
      logger.warn(`Aviso: Título gerado "${content.title}" é similar a posts anteriores.`, {
        endpoint: '/api/generate-automated-content',
        siteId,
      })
    }

    // 7. Buscar imagens já usadas neste site para evitar repetições
    // Buscar mais posts para ter uma lista mais completa de imagens usadas
    const { data: usedPosts } = await supabase
      .from('published_posts')
      .select('image_url')
      .eq('site_id', siteId)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500) // Aumentar limite para considerar mais imagens usadas
    
    const usedImageUrls = (usedPosts || [])
      .map(post => post.image_url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)

    // 8. Selecionar imagem com diversidade (com retry automático)
    let selectedImage = await searchDiverseImages(
      selectedTrend,
      keywordsArray,
      usedImageUrls,
      1,
      3 // 3 tentativas para garantir que encontre uma imagem
    )

    // Se ainda não encontrou imagem, tentar com queries mais genéricas
    if (!selectedImage) {
      logger.warn('Não encontrou imagem na primeira tentativa. Tentando com queries mais genéricas...', {
        endpoint: '/api/generate-automated-content',
        siteId,
      })
      // Tentar com apenas o tópico e keywords principais
      const mainKeywords = keywordsArray.slice(0, 3)
      selectedImage = await searchDiverseImages(
        selectedTrend,
        mainKeywords,
        usedImageUrls,
        1,
        2
      )
    }

    // Se ainda não encontrou, usar qualquer imagem disponível (melhor que nenhuma)
    if (!selectedImage) {
      logger.warn('Tentando buscar qualquer imagem disponível como último recurso...', {
        endpoint: '/api/generate-automated-content',
        siteId,
      })
      try {
        const fallbackImages = await searchImages(selectedTrend, 30)
        if (fallbackImages && fallbackImages.length > 0) {
          // Filtrar apenas as que não foram usadas
          const unused = fallbackImages.filter(img => {
            const normalized = img.split('?')[0].split('#')[0]
            return !usedImageUrls.some(used => {
              const normalizedUsed = used.split('?')[0].split('#')[0]
              return normalized === normalizedUsed
            })
          })
          if (unused.length > 0) {
            selectedImage = unused[Math.floor(Math.random() * unused.length)]
          } else if (fallbackImages.length > 0) {
            // Se todas foram usadas, usar qualquer uma mesmo assim
            selectedImage = fallbackImages[Math.floor(Math.random() * fallbackImages.length)]
          }
        }
      } catch (error) {
        logger.error('Erro no fallback final de busca de imagem', error, {
          endpoint: '/api/generate-automated-content',
          siteId,
        })
      }
    }

    const duration = Date.now() - startTime
    logger.info('Conteúdo automático gerado com sucesso', {
      endpoint: '/api/generate-automated-content',
      userId: session.user.id,
      siteId,
      topic: selectedTrend.substring(0, 50),
      duration: `${duration}ms`,
    })

    return NextResponse.json(
      {
        topic: selectedTrend,
        title: content.title,
        content: content.content,
        excerpt: content.excerpt,
        keywords: keywordsArray,
        imageUrl: selectedImage,
        trendSource: selectedTrend,
      },
      {
        headers: {
          'X-RateLimit-Limit': String(rateLimitCheck.result?.limit || RATE_LIMITS.GENERATE_CONTENT.limit),
          'X-RateLimit-Remaining': String(rateLimitCheck.result?.remaining || 0),
        },
      }
    )
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Erro ao gerar conteúdo automático', error, {
      endpoint: '/api/generate-automated-content',
      duration: `${duration}ms`,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao gerar conteúdo automático',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}

