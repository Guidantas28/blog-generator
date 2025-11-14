import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import {
  createWordPressPost,
  uploadImageToWordPress,
  getOrCreateCategory,
  type WordPressPost,
} from '@/lib/wordpress'
import { downloadImage } from '@/lib/images'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
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
    } = await request.json()

    if (!siteId || !title || !content) {
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

    // Decriptografar senha (em produção, use uma biblioteca adequada)
    const password = atob(siteData.password_encrypted)

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

    // Fazer upload da imagem se fornecida
    if (imageUrl) {
      try {
        const imageBlob = await downloadImage(imageUrl)
        const filename = `blog-image-${Date.now()}.jpg`
        featuredMediaId = await uploadImageToWordPress(site, imageBlob, filename)
      } catch (error) {
        console.warn('Erro ao fazer upload da imagem, continuando sem imagem:', error)
      }
    }

    // Buscar ou criar categoria padrão
    let categoryId: number | undefined
    try {
      // Usar a primeira keyword como categoria, ou "Blog" como padrão
      const categoryName = focusKeyword || keywords?.[0] || 'Blog'
      categoryId = await getOrCreateCategory(site, categoryName)
    } catch (error) {
      console.warn('Erro ao criar/buscar categoria, continuando sem categoria:', error)
      // Continuar sem categoria se houver erro
    }

    // Preparar post com SEO
    const post: WordPressPost = {
      title,
      content,
      excerpt,
      featured_media: featuredMediaId,
      status: 'publish',
      categories: categoryId ? [categoryId] : undefined,
      meta: {
        _yoast_wpseo_title: seoTitle || title,
        _yoast_wpseo_metadesc: seoDescription || excerpt || '',
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
        image_url: imageUrl || null,
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
      console.error('Erro ao salvar post no Supabase:', postError)
      // Não falhar a requisição se salvar no Supabase falhar
    }

    return NextResponse.json({
      id: result.id,
      link: result.link,
      postId: postData?.id,
      message: 'Post publicado com sucesso!',
    })
  } catch (error: any) {
    console.error('Erro ao publicar post:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao publicar post' },
      { status: 500 }
    )
  }
}

