import { NextRequest, NextResponse } from 'next/server'
import { getServerClient, getServiceRoleClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { trackApprovalAction } from '@/lib/approval-tracking'

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

    // Usar service role client para não requerer autenticação
    // Links de aprovação devem funcionar sem login
    const supabase = getServiceRoleClient()

    // Buscar post pelo token (sem autenticação necessária)
    // Primeiro tentar buscar sem filtrar por status para ver se o post existe
    const { data: pendingPost, error } = await supabase
      .from('pending_posts')
      .select('*, wordpress_sites(name, url)')
      .eq('approval_token', token)
      .single()

    if (error || !pendingPost) {
      logger.warn('Post pendente não encontrado', { 
        token, 
        error: error?.message,
        errorCode: error?.code,
        errorDetails: error?.details,
      })
      return NextResponse.json({ error: 'Post não encontrado ou link inválido' }, { status: 404 })
    }

    // Verificar se o post foi rejeitado ou publicado (não pode mais ser acessado)
    if (pendingPost.status === 'rejected' || pendingPost.status === 'published') {
      logger.warn('Tentativa de acessar post já processado', { 
        token, 
        status: pendingPost.status 
      })
      return NextResponse.json({ 
        error: 'Post já foi processado e não pode mais ser acessado',
        status: pendingPost.status,
      }, { status: 410 })
    }

    // Verificar se o link expirou (5 dias)
    if (pendingPost.expires_at) {
      const expiresAt = new Date(pendingPost.expires_at)
      const now = new Date()
      
      if (now > expiresAt) {
        logger.warn('Link de aprovação expirado', { token, expiresAt, now })
        return NextResponse.json(
          { error: 'Link de aprovação expirado. O link é válido por 5 dias.' },
          { status: 410 }
        )
      }
    }

    // Registrar visualização do post
    try {
      const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      const userAgent = request.headers.get('user-agent') || 'unknown'
      
      await supabase.from('approval_actions').insert({
        pending_post_id: pendingPost.id,
        action: 'view',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
    } catch (trackError) {
      // Não falhar se o tracking falhar
      logger.warn('Erro ao registrar visualização', { error: trackError })
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

    // Usar service role client para não requerer autenticação
    // Links de aprovação devem funcionar sem login
    const supabase = getServiceRoleClient()

    // Buscar post pelo token
    const { data: pendingPost, error: fetchError } = await supabase
      .from('pending_posts')
      .select('*')
      .eq('approval_token', token)
      .single()

    if (fetchError || !pendingPost) {
      logger.warn('Post não encontrado para atualização', { 
        token,
        error: fetchError?.message,
        errorCode: fetchError?.code,
      })
      return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
    }

    // Verificar se o post ainda pode ser editado/aprovado
    // Permitir edição mesmo se já foi editado antes, mas não se foi rejeitado ou publicado
    if (pendingPost.status === 'rejected' || pendingPost.status === 'published') {
      return NextResponse.json(
        { error: 'Post já foi processado e não pode mais ser editado' },
        { status: 400 }
      )
    }

    // Verificar se o link expirou
    if (pendingPost.expires_at) {
      const expiresAt = new Date(pendingPost.expires_at)
      const now = new Date()
      
      if (now > expiresAt) {
        return NextResponse.json(
          { error: 'Link de aprovação expirado. O link é válido por 5 dias.' },
          { status: 410 }
        )
      }
    }

    // Obter informações do cliente para tracking
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    let updatePayload: any = {}

    if (action === 'approve') {
      // Aprovar post
      updatePayload = {
        status: 'approved',
        approved_at: new Date().toISOString(),
      }
      
      // Registrar ação de aprovação
      await trackApprovalAction(supabase, {
        action: 'approve',
        pendingPostId: pendingPost.id,
        ipAddress,
        userAgent,
        actionData: {
          approved_at: new Date().toISOString(),
        },
      })
    } else if (action === 'reject') {
      // Rejeitar post
      updatePayload = {
        status: 'rejected',
      }
      
      // Registrar ação de rejeição
      await trackApprovalAction(supabase, {
        action: 'reject',
        pendingPostId: pendingPost.id,
        ipAddress,
        userAgent,
      })
    } else if (action === 'edit') {
      // Editar post
      // Se image_url for base64, manter como está (será salvo diretamente)
      updatePayload = {
        ...updateData,
        status: 'edited',
        updated_at: new Date().toISOString(),
      }
      
      // Se image_url for base64 data URL, validar e manter
      if (updateData.image_url && updateData.image_url.startsWith('data:image/')) {
        // Validar tamanho (máximo ~5MB em base64)
        const base64Data = updateData.image_url.split(',')[1]
        if (base64Data && base64Data.length > 7 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'Imagem muito grande. Tamanho máximo: 5MB' },
            { status: 400 }
          )
        }
      }
      
      // Registrar ação de edição
      await trackApprovalAction(supabase, {
        action: 'edit',
        pendingPostId: pendingPost.id,
        ipAddress,
        userAgent,
        actionData: {
          fields_edited: Object.keys(updateData),
        },
      })
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
