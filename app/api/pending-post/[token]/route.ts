import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Busca um post pendente pelo token de aprovação
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    if (!token) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 400 })
    }

    const supabase = await getServerClient()

    // Buscar post pelo token (sem autenticação necessária)
    const { data: pendingPost, error } = await supabase
      .from('pending_posts')
      .select('*, wordpress_sites(name, url)')
      .eq('approval_token', token)
      .eq('status', 'pending')
      .single()

    if (error || !pendingPost) {
      logger.warn('Post pendente não encontrado', { token })
      return NextResponse.json({ error: 'Post não encontrado ou já processado' }, { status: 404 })
    }

    return NextResponse.json(pendingPost)
  } catch (error: any) {
    logger.error('Erro ao buscar post pendente', error, {
      endpoint: '/api/pending-post/[token]',
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao buscar post',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}

/**
 * Atualiza um post pendente (edição, regeneração ou aprovação)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const body = await request.json()
    const { action, ...updateData } = body

    if (!token) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 400 })
    }

    const supabase = await getServerClient()

    // Buscar post pelo token
    const { data: pendingPost, error: fetchError } = await supabase
      .from('pending_posts')
      .select('*')
      .eq('approval_token', token)
      .single()

    if (fetchError || !pendingPost) {
      return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
    }

    // Verificar se o post ainda está pendente
    if (pendingPost.status !== 'pending') {
      return NextResponse.json(
        { error: 'Post já foi processado' },
        { status: 400 }
      )
    }

    let updatePayload: any = {}

    if (action === 'approve') {
      // Aprovar post
      updatePayload = {
        status: 'approved',
        approved_at: new Date().toISOString(),
      }
    } else if (action === 'reject') {
      // Rejeitar post
      updatePayload = {
        status: 'rejected',
      }
    } else if (action === 'edit') {
      // Editar post
      updatePayload = {
        ...updateData,
        status: 'edited',
        updated_at: new Date().toISOString(),
      }
    } else {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    // Atualizar post
    const { data: updatedPost, error: updateError } = await supabase
      .from('pending_posts')
      .update(updatePayload)
      .eq('id', pendingPost.id)
      .select()
      .single()

    if (updateError) {
      logger.error('Erro ao atualizar post pendente', updateError, {
        endpoint: '/api/pending-post/[token]',
        action,
      })
      return NextResponse.json(
        { error: 'Erro ao atualizar post' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      post: updatedPost,
      message: action === 'approve' 
        ? 'Post aprovado com sucesso' 
        : action === 'reject'
        ? 'Post rejeitado'
        : 'Post editado com sucesso',
    })
  } catch (error: any) {
    logger.error('Erro ao atualizar post pendente', error, {
      endpoint: '/api/pending-post/[token]',
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao atualizar post',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    )
  }
}
