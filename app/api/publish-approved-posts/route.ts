import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-server'
import {
  createWordPressPost,
  uploadImageToWordPress,
  getOrCreateCategory,
  type WordPressPost,
} from '@/lib/wordpress'
import { downloadImage } from '@/lib/images'
import { decrypt } from '@/lib/encryption'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * API para publicar posts aprovados
 * Esta rota deve ser chamada por um cron job que verifica posts aprovados
 * Suporta tanto GET (para cron) quanto POST (para chamadas manuais)
 */
export async function GET(request: NextRequest) {
  return handlePublishApproved(request)
}

export async function POST(request: NextRequest) {
  return handlePublishApproved(request)
}

async function handlePublishApproved(request: NextRequest) {
  try {
    // Verificar se há uma chave secreta para proteger a rota
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabase = getServiceRoleClient()

    // Buscar posts aprovados que devem ser publicados agora
    const now = new Date().toISOString()
    const { data: approvedPosts, error: fetchError } = await supabase
      .from('pending_posts')
      .select('*, wordpress_sites(*)')
      .eq('status', 'approved')
      .lte('scheduled_date', now)
      .limit(50) // Processar no máximo 50 por vez

    if (fetchError) {
      logger.error('Erro ao buscar posts aprovados', fetchError, {
        endpoint: '/api/publish-approved-posts',
      })
      return NextResponse.json(
        { error: 'Erro ao buscar posts aprovados' },
        { status: 500 }
      )
    }

    if (!approvedPosts || approvedPosts.length === 0) {
      return NextResponse.json({
        message: 'Nenhum post aprovado para publicar',
        processed: 0,
      })
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const approvedPost of approvedPosts) {
      try {
        results.processed++

        const siteData = approvedPost.wordpress_sites

        // Descriptografar senha
        const password = decrypt(siteData.password_encrypted)

        const site = {
          id: siteData.id,
          user_id: siteData.user_id,
          name: siteData.name,
          url: siteData.url,
          username: siteData.username,
          password,
        }

        // Upload de imagem se houver
        let featuredMediaId: number | undefined
        if (approvedPost.image_url) {
          try {
            const imageBlob = await downloadImage(approvedPost.image_url)
            const filename = `post-${approvedPost.id}-${Date.now()}.jpg`
            featuredMediaId = await uploadImageToWordPress(site, imageBlob, filename)
          } catch (imageError) {
            logger.warn('Erro ao fazer upload da imagem, continuando sem imagem', {
              endpoint: '/api/publish-approved-posts',
              error: imageError instanceof Error ? imageError.message : String(imageError),
            })
          }
        }

        // Criar/buscar categoria
        let categoryId: number | undefined
        try {
          const categoryName = approvedPost.keywords?.[0] || 'Blog'
          categoryId = await getOrCreateCategory(site, categoryName)
        } catch (error) {
          logger.warn('Erro ao criar/buscar categoria, continuando sem categoria', {
            endpoint: '/api/publish-approved-posts',
            error: error instanceof Error ? error.message : String(error),
          })
        }

        // Preparar post
        const post: WordPressPost = {
          title: approvedPost.title,
          content: approvedPost.content,
          excerpt: approvedPost.excerpt || '',
          featured_media: featuredMediaId,
          status: 'publish',
          categories: categoryId ? [categoryId] : undefined,
          meta: {
            _yoast_wpseo_title: approvedPost.seo_title || approvedPost.title,
            _yoast_wpseo_metadesc: approvedPost.seo_description || approvedPost.excerpt || '',
            _yoast_wpseo_focuskw: approvedPost.focus_keyword || '',
          },
        }

        // Publicar no WordPress
        const result = await createWordPressPost(site, post)

        // Salvar no Supabase como post publicado
        await supabase.from('published_posts').insert({
          user_id: approvedPost.user_id,
          site_id: approvedPost.site_id,
          topic: approvedPost.topic || approvedPost.title,
          title: approvedPost.title,
          content: approvedPost.content,
          excerpt: approvedPost.excerpt || '',
          keywords: Array.isArray(approvedPost.keywords) ? approvedPost.keywords : [],
          wordpress_post_id: result.id,
          wordpress_post_url: result.link,
          image_url: approvedPost.image_url || null,
          cta_text: approvedPost.cta_text,
          cta_link: approvedPost.cta_link,
          seo_title: approvedPost.seo_title || approvedPost.title,
          seo_description: approvedPost.seo_description || approvedPost.excerpt || '',
          focus_keyword: approvedPost.focus_keyword || '',
          status: 'published',
        })

        // Atualizar status do post pendente para publicado
        await supabase
          .from('pending_posts')
          .update({ status: 'published', updated_at: new Date().toISOString() })
          .eq('id', approvedPost.id)

        results.succeeded++
      } catch (error: any) {
        logger.error(`Erro ao publicar post aprovado ${approvedPost.id}`, error, {
          endpoint: '/api/publish-approved-posts',
        })
        results.failed++
        results.errors.push(`Post ${approvedPost.id}: ${error.message || 'Erro desconhecido'}`)
      }
    }

    return NextResponse.json({
      message: 'Processamento concluído',
      ...results,
    })
  } catch (error: any) {
    logger.error('Erro ao processar posts aprovados', error, {
      endpoint: '/api/publish-approved-posts',
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao processar posts aprovados',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}
