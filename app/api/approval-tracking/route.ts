import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Busca histórico de ações de aprovação
 */
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
    const pendingPostId = searchParams.get('pendingPostId')
    const siteId = searchParams.get('siteId')

    let query = supabase
      .from('approval_actions')
      .select(`
        *,
        pending_posts (
          id,
          title,
          site_id,
          wordpress_sites (
            id,
            name,
            url
          )
        )
      `)
      .order('created_at', { ascending: false })

    // Filtrar por post pendente específico
    if (pendingPostId) {
      query = query.eq('pending_post_id', pendingPostId)
    }

    // Filtrar por site (verificando através do pending_post)
    if (siteId) {
      // Primeiro buscar todos os pending_posts do site
      const { data: pendingPosts } = await supabase
        .from('pending_posts')
        .select('id')
        .eq('site_id', siteId)
        .eq('user_id', session.user.id)

      if (pendingPosts && pendingPosts.length > 0) {
        const pendingPostIds = pendingPosts.map(p => p.id)
        query = query.in('pending_post_id', pendingPostIds)
      } else {
        // Se não há posts, retornar vazio
        return NextResponse.json({ actions: [] })
      }
    } else {
      // Se não especificou site, filtrar apenas pelos posts do usuário
      const { data: userPendingPosts } = await supabase
        .from('pending_posts')
        .select('id')
        .eq('user_id', session.user.id)

      if (userPendingPosts && userPendingPosts.length > 0) {
        const pendingPostIds = userPendingPosts.map(p => p.id)
        query = query.in('pending_post_id', pendingPostIds)
      } else {
        return NextResponse.json({ actions: [] })
      }
    }

    const { data: actions, error } = await query

    if (error) {
      logger.error('Erro ao buscar histórico de aprovação', error, {
        endpoint: '/api/approval-tracking',
      })
      return NextResponse.json(
        { error: 'Erro ao buscar histórico' },
        { status: 500 }
      )
    }

    return NextResponse.json({ actions: actions || [] })
  } catch (error: any) {
    logger.error('Erro ao buscar histórico de aprovação', error, {
      endpoint: '/api/approval-tracking',
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao buscar histórico',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}
