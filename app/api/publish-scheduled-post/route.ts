import { NextRequest, NextResponse } from 'next/server'
import { getServerClient, getServiceRoleClient } from '@/lib/supabase-server'
import {
  createWordPressPost,
  uploadImageToWordPress,
  getOrCreateCategory,
  type WordPressPost,
} from '@/lib/wordpress'
import { downloadImage } from '@/lib/images'

export const dynamic = 'force-dynamic'

/**
 * API para publicar posts agendados
 * Esta rota deve ser chamada por um cron job que verifica posts agendados
 * Suporta tanto GET (para cron) quanto POST (para chamadas manuais)
 */
export async function GET(request: NextRequest) {
  return handlePublishScheduled(request)
}

export async function POST(request: NextRequest) {
  return handlePublishScheduled(request)
}

async function handlePublishScheduled(request: NextRequest) {
  try {
    // Verificar se há uma chave secreta para proteger a rota
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabase = getServiceRoleClient()

    // Buscar posts agendados que devem ser publicados agora
    const now = new Date().toISOString()
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*, wordpress_sites(*)')
      .eq('status', 'scheduled')
      .lte('scheduled_date', now)
      .limit(50) // Processar no máximo 50 por vez

    if (fetchError) {
      const { logger } = await import('@/lib/logger')
      logger.error('Erro ao buscar posts agendados', fetchError, {
        endpoint: '/api/publish-scheduled-post',
      })
      return NextResponse.json(
        { error: 'Erro ao buscar posts agendados' },
        { status: 500 }
      )
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return NextResponse.json({
        message: 'Nenhum post agendado para publicar',
        processed: 0,
      })
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const scheduledPost of scheduledPosts) {
      results.processed++

      try {
        const siteData = scheduledPost.wordpress_sites
        if (!siteData) {
          throw new Error('Dados do site não encontrados')
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

        // Fazer upload da imagem se houver
        if (scheduledPost.image_url) {
          try {
            const imageBlob = await downloadImage(scheduledPost.image_url)
            const filename = `blog-image-${Date.now()}.jpg`
            featuredMediaId = await uploadImageToWordPress(site, imageBlob, filename)
          } catch (error) {
            console.warn('Erro ao fazer upload da imagem:', error)
          }
        }

        // Buscar ou criar categoria
        let categoryId: number | undefined
        try {
          const categoryName =
            scheduledPost.focus_keyword ||
            (Array.isArray(scheduledPost.keywords) && scheduledPost.keywords[0]) ||
            'Blog'
          categoryId = await getOrCreateCategory(site, categoryName)
        } catch (error) {
          console.warn('Erro ao criar/buscar categoria:', error)
        }

        // Preparar post
        const post: WordPressPost = {
          title: scheduledPost.title,
          content: scheduledPost.content,
          excerpt: scheduledPost.excerpt || '',
          featured_media: featuredMediaId,
          status: 'publish',
          categories: categoryId ? [categoryId] : undefined,
          meta: {
            _yoast_wpseo_title: scheduledPost.seo_title || scheduledPost.title,
            _yoast_wpseo_metadesc: scheduledPost.seo_description || scheduledPost.excerpt || '',
            _yoast_wpseo_focuskw: scheduledPost.focus_keyword || '',
          },
        }

        // Publicar no WordPress
        const result = await createWordPressPost(site, post)

        // Salvar no Supabase como post publicado
        await supabase.from('published_posts').insert({
          user_id: scheduledPost.user_id,
          site_id: scheduledPost.site_id,
          topic: scheduledPost.topic || scheduledPost.title,
          title: scheduledPost.title,
          content: scheduledPost.content,
          excerpt: scheduledPost.excerpt || '',
          keywords: Array.isArray(scheduledPost.keywords) ? scheduledPost.keywords : [],
          wordpress_post_id: result.id,
          wordpress_post_url: result.link,
          image_url: scheduledPost.image_url || null,
          cta_text: scheduledPost.cta_text,
          cta_link: scheduledPost.cta_link,
          seo_title: scheduledPost.seo_title || scheduledPost.title,
          seo_description: scheduledPost.seo_description || scheduledPost.excerpt || '',
          focus_keyword: scheduledPost.focus_keyword || '',
          status: 'published',
        })

        // Atualizar status do post agendado
        await supabase
          .from('scheduled_posts')
          .update({ status: 'published', published_at: new Date().toISOString() })
          .eq('id', scheduledPost.id)

        results.succeeded++
      } catch (error: any) {
        const { logger } = await import('@/lib/logger')
        logger.error(`Erro ao publicar post agendado ${scheduledPost.id}`, error, {
          endpoint: '/api/publish-scheduled-post',
          postId: scheduledPost.id,
        })
        results.failed++
        results.errors.push(`Post ${scheduledPost.id}: ${error.message}`)

        // Marcar como erro
        await supabase
          .from('scheduled_posts')
          .update({ status: 'error', error_message: error.message })
          .eq('id', scheduledPost.id)
      }
    }

    const { logger } = await import('@/lib/logger')
    logger.info('Posts agendados processados', {
      endpoint: '/api/publish-scheduled-post',
      ...results,
    })

    return NextResponse.json({
      message: 'Processamento concluído',
      ...results,
    })
  } catch (error: any) {
    const { logger } = await import('@/lib/logger')
    logger.error('Erro ao processar posts agendados', error, {
      endpoint: '/api/publish-scheduled-post',
    })
    return NextResponse.json(
      { error: error.message || 'Erro ao processar posts agendados' },
      { status: 500 }
    )
  }
}
