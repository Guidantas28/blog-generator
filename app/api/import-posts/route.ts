import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'

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

    const { posts, siteId } = await request.json()

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { error: 'Lista de posts é obrigatória' },
        { status: 400 }
      )
    }

    if (!siteId) {
      return NextResponse.json(
        { error: 'ID do site é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se o site pertence ao usuário
    const { data: siteData, error: siteError } = await supabase
      .from('wordpress_sites')
      .select('id')
      .eq('id', siteId)
      .eq('user_id', session.user.id)
      .single()

    if (siteError || !siteData) {
      return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })
    }

    // Validar e formatar posts
    const formattedPosts = posts.map((post: any) => ({
      user_id: session.user.id,
      site_id: siteId,
      topic: post.topic || post.title || '',
      title: post.title || '',
      content: post.content || '',
      excerpt: post.excerpt || '',
      keywords: Array.isArray(post.keywords) ? post.keywords : [],
      tags: Array.isArray(post.tags) ? post.tags : [],
      image_url: post.image_url || null,
      seo_title: post.seo_title || post.title || '',
      seo_description: post.seo_description || post.excerpt || '',
      focus_keyword: post.focus_keyword || '',
      status: 'draft', // Posts importados começam como draft
    }))

    // Inserir posts
    const { data: insertedPosts, error: insertError } = await supabase
      .from('published_posts')
      .insert(formattedPosts)
      .select()

    if (insertError) {
      console.error('Erro ao importar posts:', insertError)
      return NextResponse.json(
        { error: 'Erro ao importar posts: ' + insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `${insertedPosts?.length || 0} post(s) importado(s) com sucesso`,
      posts: insertedPosts,
      total: insertedPosts?.length || 0,
    })
  } catch (error: any) {
    console.error('Erro ao importar posts:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao importar posts' },
      { status: 500 }
    )
  }
}
