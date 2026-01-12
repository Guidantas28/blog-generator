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

    const {
      publishedPostId,
      title,
      content,
      excerpt,
      keywords,
      imageUrl,
      seoTitle,
      seoDescription,
      focusKeyword,
      ctaText,
      ctaLink,
      notes,
    } = await request.json()

    if (!publishedPostId || !title || !content) {
      return NextResponse.json(
        { error: 'ID do post, título e conteúdo são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se o post pertence ao usuário
    const { data: postData, error: postError } = await supabase
      .from('published_posts')
      .select('id, version')
      .eq('id', publishedPostId)
      .eq('user_id', session.user.id)
      .single()

    if (postError || !postData) {
      return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
    }

    // Obter próxima versão
    const nextVersion = (postData.version || 1) + 1

    // Criar nova versão
    const { data: version, error: versionError } = await supabase
      .from('post_versions')
      .insert({
        published_post_id: publishedPostId,
        user_id: session.user.id,
        version_number: nextVersion,
        title,
        content,
        excerpt: excerpt || null,
        keywords: Array.isArray(keywords) ? keywords : [],
        image_url: imageUrl || null,
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        focus_keyword: focusKeyword || null,
        cta_text: ctaText || null,
        cta_link: ctaLink || null,
        created_by: session.user.id,
        notes: notes || null,
      })
      .select()
      .single()

    if (versionError) {
      console.error('Erro ao criar versão:', versionError)
      return NextResponse.json(
        { error: 'Erro ao criar versão: ' + versionError.message },
        { status: 500 }
      )
    }

    // Atualizar versão do post
    await supabase
      .from('published_posts')
      .update({ version: nextVersion })
      .eq('id', publishedPostId)

    return NextResponse.json({
      version: version,
      message: 'Versão salva com sucesso!',
    })
  } catch (error: any) {
    console.error('Erro ao salvar versão:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar versão' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')

    if (!postId) {
      return NextResponse.json({ error: 'ID do post é obrigatório' }, { status: 400 })
    }

    // Verificar se o post pertence ao usuário
    const { data: postData, error: postError } = await supabase
      .from('published_posts')
      .select('id')
      .eq('id', postId)
      .eq('user_id', session.user.id)
      .single()

    if (postError || !postData) {
      return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
    }

    // Buscar versões
    const { data: versions, error: versionsError } = await supabase
      .from('post_versions')
      .select('*')
      .eq('published_post_id', postId)
      .order('version_number', { ascending: false })

    if (versionsError) {
      console.error('Erro ao buscar versões:', versionsError)
      return NextResponse.json(
        { error: 'Erro ao buscar versões' },
        { status: 500 }
      )
    }

    return NextResponse.json({ versions: versions || [] })
  } catch (error: any) {
    console.error('Erro ao buscar versões:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar versões' },
      { status: 500 }
    )
  }
}
