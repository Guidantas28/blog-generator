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
      logger.warn('Rate limit excedido', { endpoint: '/api/save-draft' })
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
      logger.warn('Tentativa de acesso não autorizado', { endpoint: '/api/save-draft' })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validação básica (usar schema similar ao publish-post)
    const body = await request.json()
    const { siteId, topic, title, content, excerpt, imageUrl, keywords, trendSource } = body

    if (!siteId || !title || !content) {
      logger.warn('Validação falhou', {
        endpoint: '/api/save-draft',
        userId: session.user.id,
      })
      return NextResponse.json(
        { error: 'Site, título e conteúdo são obrigatórios' },
        { status: 400 }
      )
    }

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

        const keywordsArray = Array.isArray(keywords) ? keywords : []
        
        // Buscar imagem automaticamente
        finalImageUrl = await searchDiverseImages(
          topic,
          keywordsArray,
          usedImageUrls,
          1,
          2
        )

        if (!finalImageUrl) {
          logger.warn('Não foi possível encontrar imagem automaticamente para o rascunho', {
            endpoint: '/api/save-draft',
            topic: topic?.substring(0, 50),
          })
        }
      } catch (error) {
        logger.warn('Erro ao buscar imagem automaticamente', {
          error: error instanceof Error ? error.message : String(error),
          endpoint: '/api/save-draft',
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
          error: error instanceof Error ? error.message : String(error),
          endpoint: '/api/save-draft',
        })
      }
    }

    // Buscar ou criar categoria padrão
    let categoryId: number | undefined
    try {
      // Usar a primeira keyword como categoria, ou "Blog" como padrão
      const categoryName = keywords?.[0] || 'Blog'
      categoryId = await getOrCreateCategory(site, categoryName)
    } catch (error) {
      logger.warn('Erro ao criar/buscar categoria, continuando sem categoria', {
        error: error instanceof Error ? error.message : String(error),
        endpoint: '/api/save-draft',
      })
      // Continuar sem categoria se houver erro
    }

    // Preparar post como rascunho
    const post: WordPressPost = {
      title,
      content,
      excerpt,
      featured_media: featuredMediaId,
      status: 'draft', // Salvar como rascunho
      categories: categoryId ? [categoryId] : undefined,
      meta: {
        _yoast_wpseo_title: title,
        _yoast_wpseo_metadesc: excerpt || '',
        _yoast_wpseo_focuskw: keywords?.[0] || '',
      },
    }

    // Criar rascunho no WordPress
    const result = await createWordPressPost(site, post)

    // Salvar no Supabase
    const { data: postData, error: postError } = await supabase
      .from('automated_posts')
      .insert({
        user_id: session.user.id,
        site_id: siteId,
        topic: topic || title,
        title,
        content,
        excerpt: excerpt || '',
        keywords: Array.isArray(keywords) ? keywords : [],
        image_url: finalImageUrl || null,
        wordpress_post_id: result.id,
        wordpress_post_url: result.link,
        status: 'draft',
        trend_source: trendSource || null,
      })
      .select()
      .single()

    if (postError) {
      logger.error('Erro ao salvar rascunho no Supabase', postError, {
        endpoint: '/api/save-draft',
        userId: session.user.id,
      })
      // Não falhar a requisição se salvar no Supabase falhar
    }

    const duration = Date.now() - startTime
    logger.info('Rascunho salvo com sucesso', {
      endpoint: '/api/save-draft',
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
        message: 'Rascunho salvo com sucesso!',
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
    logger.error('Erro ao salvar rascunho', error, {
      endpoint: '/api/save-draft',
      duration: `${duration}ms`,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao salvar rascunho',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}

