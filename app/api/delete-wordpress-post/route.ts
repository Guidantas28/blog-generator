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

    // Excluir post do WordPress
    await deleteWordPressPost(site, postId)

    const { logger } = await import('@/lib/logger')
    logger.info('Post excluído com sucesso', {
      endpoint: '/api/delete-wordpress-post',
      userId: session.user.id,
      siteId,
      postId,
    })

    return NextResponse.json({
      message: 'Post excluído com sucesso!',
    })
  } catch (error: any) {
    const { logger } = await import('@/lib/logger')
    logger.error('Erro ao excluir post', error, {
      endpoint: '/api/delete-wordpress-post',
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao excluir post',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}

