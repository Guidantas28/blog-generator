import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import {
  createWordPressPost,
  uploadImageToWordPress,
  getOrCreateCategory,
  type WordPressPost,
} from '@/lib/wordpress'
import { downloadImage, searchDiverseImages } from '@/lib/images'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { publishPostSchema, validateAndSanitize, sanitizeHtml } from '@/lib/validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Rate limiting
    const rateLimitCheck = await checkRateLimit(request, RATE_LIMITS.PUBLISH_POST)
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit excedido', { endpoint: '/api/publish-post' })
      return NextResponse.json(
        {
          error: 'Muitas requisições. Tente novamente mais tarde.',
          retryAfter: Math.ceil((rateLimitCheck.result?.reset || Date.now() - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitCheck.result?.reset || Date.now() - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(rateLimitCheck.result?.limit || RATE_LIMITS.PUBLISH_POST.limit),
            'X-RateLimit-Remaining': String(rateLimitCheck.result?.remaining || 0),
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
      logger.warn('Tentativa de acesso não autorizado', { endpoint: '/api/publish-post' })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validação de entrada
    const body = await request.json()
    const validation = validateAndSanitize(publishPostSchema, body)

    if (!validation.success) {
      logger.warn('Validação falhou', {
        endpoint: '/api/publish-post',
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

    const {
      siteId,
      topic,
      title,
      content,
      excerpt,
      imageUrl,
      keywords,
      seoTitle,
      seoDescription,
      focusKeyword,
      ctaText,
      ctaLink,
    } = validation.data

    // Buscar dados do site
    const { data: siteData, error: siteError } = await supabase
      .from('wordpress_sites')
      .select('*')
      .eq('id', siteId)
      .eq('user_id', session.user.id)
      .single()

    if (siteError || !siteData) {
      return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })
    }

    // Descriptografar senha
    const { decrypt } = await import('@/lib/encryption')
    const password = decrypt(siteData.password_encrypted)

    // Usar CTA do site como fallback se não for passado
    const finalCtaText = ctaText || siteData.cta_text || null
    const finalCtaLink = ctaLink || siteData.cta_link || null

    const site = {
      id: siteData.id,
      user_id: siteData.user_id,
      name: siteData.name,
      url: siteData.url,
      username: siteData.username,
      password,
    }

    let featuredMediaId: number | undefined
    let finalImageUrl = imageUrl

    // Se não houver imagem fornecida, tentar buscar uma automaticamente
    if (!finalImageUrl && topic) {
      try {
        // Buscar imagens já usadas neste site para evitar repetições
        const { data: usedPosts } = await supabase
          .from('published_posts')
          .select('image_url')
          .eq('site_id', siteId)
          .not('image_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(500)
        
        const usedImageUrls = (usedPosts || [])
          .map(post => post.image_url)
          .filter((url): url is string => typeof url === 'string' && url.length > 0)

        const keywordsArray = Array.isArray(keywords) ? keywords : (focusKeyword ? [focusKeyword] : [])
        
        // Buscar imagem automaticamente
        finalImageUrl = await searchDiverseImages(
          topic,
          keywordsArray,
          usedImageUrls,
          1,
          2
        )

        if (!finalImageUrl) {
          logger.warn('Não foi possível encontrar imagem automaticamente', {
            endpoint: '/api/publish-post',
            topic: topic?.substring(0, 50),
          })
        }
      } catch (error) {
        logger.warn('Erro ao buscar imagem automaticamente', {
          endpoint: '/api/publish-post',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Fazer upload da imagem se houver
    if (finalImageUrl) {
      try {
        const imageBlob = await downloadImage(finalImageUrl)
        const filename = `blog-image-${Date.now()}.jpg`
        featuredMediaId = await uploadImageToWordPress(site, imageBlob, filename)
      } catch (error) {
        logger.warn('Erro ao fazer upload da imagem, continuando sem imagem', {
          endpoint: '/api/publish-post',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Buscar ou criar categoria padrão
    let categoryId: number | undefined
    try {
      // Usar a primeira keyword como categoria, ou "Blog" como padrão
      const categoryName = focusKeyword || keywords?.[0] || 'Blog'
      categoryId = await getOrCreateCategory(site, categoryName)
    } catch (error) {
      logger.warn('Erro ao criar/buscar categoria, continuando sem categoria', {
        endpoint: '/api/publish-post',
        error: error instanceof Error ? error.message : String(error),
      })
      // Continuar sem categoria se houver erro
    }

    // Sanitizar conteúdo antes de publicar
    const sanitizedContent = sanitizeHtml(content)
    const sanitizedExcerpt = excerpt ? sanitizeHtml(excerpt) : undefined

    logger.info('Publicando post', {
      endpoint: '/api/publish-post',
      userId: session.user.id,
      siteId,
      title: title.substring(0, 50),
    })

    // Preparar post com SEO
    const post: WordPressPost = {
      title,
      content: sanitizedContent,
      excerpt: sanitizedExcerpt,
      featured_media: featuredMediaId,
      status: 'publish',
      categories: categoryId ? [categoryId] : undefined,
      meta: {
        _yoast_wpseo_title: seoTitle || title,
        _yoast_wpseo_metadesc: seoDescription || sanitizedExcerpt || '',
        _yoast_wpseo_focuskw: focusKeyword || '',
      },
    }

    // Publicar no WordPress
    const result = await createWordPressPost(site, post)

    // Salvar no Supabase
    const { data: postData, error: postError } = await supabase
      .from('published_posts')
      .insert({
        user_id: session.user.id,
        site_id: siteId,
        topic: topic || title,
        title,
        content,
        excerpt: excerpt || '',
        keywords: Array.isArray(keywords) ? keywords : (focusKeyword ? [focusKeyword] : []),
        wordpress_post_id: result.id,
        wordpress_post_url: result.link,
        image_url: finalImageUrl || null,
        cta_text: finalCtaText,
        cta_link: finalCtaLink,
        seo_title: seoTitle || title,
        seo_description: seoDescription || excerpt || '',
        focus_keyword: focusKeyword || '',
        status: 'published',
      })
      .select()
      .single()

    if (postError) {
      logger.error('Erro ao salvar post no Supabase', postError, {
        endpoint: '/api/publish-post',
        userId: session.user.id,
      })
      // Não falhar a requisição se salvar no Supabase falhar
    }

    const duration = Date.now() - startTime
    logger.info('Post publicado com sucesso', {
      endpoint: '/api/publish-post',
      userId: session.user.id,
      siteId,
      postId: result.id,
      duration: `${duration}ms`,
    })

    return NextResponse.json(
      {
        id: result.id,
        link: result.link,
        postId: postData?.id,
        message: 'Post publicado com sucesso!',
      },
      {
        headers: {
          'X-RateLimit-Limit': String(rateLimitCheck.result?.limit || RATE_LIMITS.PUBLISH_POST.limit),
          'X-RateLimit-Remaining': String(rateLimitCheck.result?.remaining || 0),
        },
      }
    )
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Erro ao publicar post', error, {
      endpoint: '/api/publish-post',
      duration: `${duration}ms`,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao publicar post',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}

