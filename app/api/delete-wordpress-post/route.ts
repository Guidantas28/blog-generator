import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { deleteWordPressPost } from '@/lib/wordpress'

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

    const { siteId, postId } = await request.json()

    if (!siteId || !postId) {
      return NextResponse.json(
        { error: 'Site ID e Post ID são obrigatórios' },
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

    // Decriptografar senha
    const password = atob(siteData.password_encrypted)

    const site = {
      id: siteData.id,
      user_id: siteData.user_id,
      name: siteData.name,
      url: siteData.url,
      username: siteData.username,
      password,
    }

    // Excluir post do WordPress
    await deleteWordPressPost(site, postId)

    return NextResponse.json({
      message: 'Post excluído com sucesso!',
    })
  } catch (error: any) {
    console.error('Erro ao excluir post:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir post' },
      { status: 500 }
    )
  }
}

