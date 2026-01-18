import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

export interface ApprovalActionData {
  action: 'approve' | 'reject' | 'regenerate' | 'edit' | 'view'
  pendingPostId: string
  ipAddress?: string
  userAgent?: string
  actionData?: Record<string, any>
}

/**
 * Registra uma ação de aprovação no sistema de tracking
 */
export async function trackApprovalAction(
  supabase: SupabaseClient,
  data: ApprovalActionData
): Promise<void> {
  try {
    const { action, pendingPostId, ipAddress, userAgent, actionData } = data

    await supabase.from('approval_actions').insert({
      pending_post_id: pendingPostId,
      action,
      action_data: actionData || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    })

    logger.info('Ação de aprovação registrada', {
      action,
      pendingPostId,
    })
  } catch (error: any) {
    // Não falhar a operação principal se o tracking falhar
    logger.warn('Erro ao registrar ação de aprovação', {
      error: error.message,
      action: data.action,
      pendingPostId: data.pendingPostId,
    })
  }
}

/**
 * Busca histórico de ações de um post pendente
 */
export async function getApprovalHistory(
  supabase: SupabaseClient,
  pendingPostId: string
) {
  try {
    const { data, error } = await supabase
      .from('approval_actions')
      .select('*')
      .eq('pending_post_id', pendingPostId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Erro ao buscar histórico de aprovação', error)
      return []
    }

    return data || []
  } catch (error: any) {
    logger.error('Erro ao buscar histórico de aprovação', error)
    return []
  }
}
