import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * URL do webhook n8n para envio de emails de aprovação
 */
const APPROVAL_WEBHOOK_URL = 'https://n8n.avidati.com.br/webhook/e4ce9e41-9f69-4a6a-848d-23e9620760a9'

/**
 * Envia notificação via webhook para aprovação de posts
 */
async function sendApprovalEmailWebhook(data: {
  siteName: string
  siteUrl: string
  approvalEmail: string
  publicationDate: string
  posts: Array<{
    id: string
    title: string
    approvalToken: string
    approvalUrl: string
  }>
}) {
  try {
    const response = await fetch(APPROVAL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'pending_posts_ready_for_approval',
        site_name: data.siteName,
        site_url: data.siteUrl,
        approval_email: data.approvalEmail,
        publication_date: data.publicationDate,
        posts: data.posts.map(post => ({
          id: post.id,
          title: post.title,
          approval_url: post.approvalUrl,
        })),
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      logger.warn(`Webhook de aprovação retornou status ${response.status}`, {
        endpoint: '/api/generate-pending-posts-weekly',
      })
    } else {
      logger.info('Webhook de aprovação enviado com sucesso', {
        endpoint: '/api/generate-pending-posts-weekly',
        siteName: data.siteName,
        postsCount: data.posts.length,
      })
    }
  } catch (error: any) {
    // Não falhar a geração se o webhook falhar
    logger.error('Erro ao enviar webhook de aprovação', error, {
      endpoint: '/api/generate-pending-posts-weekly',
    })
  }
}

/**
 * API para gerar posts pendentes uma semana antes da publicação
 * Esta rota deve ser chamada por um cron job semanal (domingos)
 * Gera posts para sites que têm automação configurada
 * Posts são gerados no domingo para publicação no domingo seguinte
 */
export async function GET(request: NextRequest) {
  return handleGeneratePendingPosts(request)
}

export async function POST(request: NextRequest) {
  return handleGeneratePendingPosts(request)
}

/**
 * Calcula o próximo domingo a partir de hoje
 * Se hoje já é domingo, retorna o próximo domingo (7 dias)
 */
function getNextSunday(): Date {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Domingo, 1 = Segunda, etc.
  
  let daysUntilSunday: number
  if (dayOfWeek === 0) {
    // Se já é domingo, pega o próximo domingo (7 dias)
    daysUntilSunday = 7
  } else {
    // Calcula quantos dias até o próximo domingo
    daysUntilSunday = 7 - dayOfWeek
  }
  
  const nextSunday = new Date(today)
  nextSunday.setDate(today.getDate() + daysUntilSunday)
  nextSunday.setHours(9, 0, 0, 0) // 9h da manhã
  
  return nextSunday
}

/**
 * Calcula a data de publicação (próximo domingo + 7 dias = domingo seguinte)
 * Esta função retorna a data de publicação, que é sempre 7 dias após o próximo domingo
 */
function getPublicationDate(): Date {
  const nextSunday = getNextSunday()
  const publicationDate = new Date(nextSunday)
  publicationDate.setDate(nextSunday.getDate() + 7) // Uma semana depois do próximo domingo
  
  return publicationDate
}

async function handleGeneratePendingPosts(request: NextRequest) {
  try {
    logger.info('Iniciando geração de posts pendentes semanais', {
      endpoint: '/api/generate-pending-posts-weekly',
      timestamp: new Date().toISOString(),
    })

    // Verificar se há uma chave secreta para proteger a rota
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Tentativa de acesso não autorizado', {
        endpoint: '/api/generate-pending-posts-weekly',
        hasAuthHeader: !!authHeader,
        hasCronSecret: !!cronSecret,
        authHeaderPrefix: authHeader?.substring(0, 10),
      })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar variáveis de ambiente necessárias
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      logger.error('NEXT_PUBLIC_SUPABASE_URL não configurada', {
        endpoint: '/api/generate-pending-posts-weekly',
      })
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta: NEXT_PUBLIC_SUPABASE_URL' },
        { status: 500 }
      )
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('SUPABASE_SERVICE_ROLE_KEY não configurada', {
        endpoint: '/api/generate-pending-posts-weekly',
      })
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      )
    }

    let supabase
    try {
      supabase = getServiceRoleClient()
      logger.info('Cliente Supabase service role criado com sucesso')
    } catch (supabaseError: any) {
      logger.error('Erro ao criar cliente Supabase', supabaseError, {
        endpoint: '/api/generate-pending-posts-weekly',
        errorMessage: supabaseError.message,
      })
      return NextResponse.json(
        { error: `Erro ao conectar ao banco de dados: ${supabaseError.message}` },
        { status: 500 }
      )
    }

    // Verificar se é execução manual (via workflow_dispatch) ou automática (cron)
    // Headers HTTP são case-insensitive, então verificar em lowercase
    const manualHeader = request.headers.get('x-manual-execution') || request.headers.get('X-Manual-Execution')
    const userAgent = request.headers.get('user-agent') || ''
    const isManualExecution = manualHeader === 'true' || userAgent.includes('GitHub Actions')
    
    const today = new Date()
    const dayOfWeek = today.getDay()
    
    logger.info('Verificando tipo de execução', {
      dayOfWeek,
      isManualExecution,
      manualHeader,
      userAgent: userAgent.substring(0, 50),
      endpoint: '/api/generate-pending-posts-weekly',
    })
    
    // Sempre continuar processamento, independente do dia (permite testes e execuções manuais)
    if (isManualExecution) {
      logger.info('✅ Execução manual detectada, processando independente do dia da semana', {
        dayOfWeek,
        endpoint: '/api/generate-pending-posts-weekly',
      })
    } else {
      logger.info('Execução automática detectada', {
        dayOfWeek,
        endpoint: '/api/generate-pending-posts-weekly',
      })
    }

    // Calcular data de publicação (próximo domingo + 7 dias)
    const publicationDate = getPublicationDate()
    const targetDate = publicationDate.toISOString().split('T')[0] // YYYY-MM-DD

    // Buscar automações ativas que precisam gerar posts E que requerem aprovação
    logger.info('Buscando automações ativas com aprovação habilitada')
    
    try {
      // Buscar automações - primeiro sem filtrar is_active para verificar se a coluna existe
      let query = supabase
        .from('automation_settings')
        .select(`
          *,
          wordpress_sites (
            id,
            name,
            url,
            user_id
          )
        `)
        .eq('requires_approval', true) // Apenas automações com aprovação ativada
      
      // Tentar filtrar por is_active, mas se a coluna não existir, continuar sem o filtro
      // (a migração SQL deve ser executada para adicionar a coluna)
      const { data: automations, error: fetchError } = await query

      if (fetchError) {
        logger.error('Erro ao buscar automações', fetchError, {
          endpoint: '/api/generate-pending-posts-weekly',
          errorCode: fetchError.code,
          errorMessage: fetchError.message,
          errorDetails: fetchError.details,
          errorHint: fetchError.hint,
        })
        return NextResponse.json(
          { 
            error: 'Erro ao buscar automações',
            details: fetchError.message,
            code: fetchError.code,
          },
          { status: 500 }
        )
      }

      logger.info(`Encontradas ${automations?.length || 0} automações com aprovação habilitada`)

      if (!automations || automations.length === 0) {
        logger.info('Nenhuma automação encontrada, retornando sucesso vazio')
        return NextResponse.json({
          message: 'Nenhuma automação ativa com aprovação habilitada encontrada',
          processed: 0,
        })
      }

      // Processar automações
      return await processAutomations(automations, supabase, targetDate, publicationDate, request)
    } catch (queryError: any) {
      logger.error('Erro inesperado ao buscar automações', queryError, {
        endpoint: '/api/generate-pending-posts-weekly',
        errorMessage: queryError.message,
        errorStack: queryError.stack,
      })
      return NextResponse.json(
        {
          error: 'Erro inesperado ao processar automações',
          details: queryError.message,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('Erro ao processar geração de posts pendentes', error, {
      endpoint: '/api/generate-pending-posts-weekly',
      errorMessage: error.message,
      errorStack: error.stack,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao processar geração de posts',
        details: process.env.NODE_ENV === 'development' 
          ? { stack: error.stack, message: error.message }
          : undefined,
      },
      { status: 500 }
    )
  }
}

async function processAutomations(
  automations: any[],
  supabase: any,
  targetDate: string,
  publicationDate: Date,
  request: NextRequest
) {
  try {
    const results = {
      total: automations.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      skippedReasons: [] as string[],
      errors: [] as string[],
    }

    for (const automation of automations) {
      try {
        // Verificar se a automação está ativa (se a coluna existir)
        if (automation.is_active === false) {
          results.skipped++
          results.skippedReasons.push(`Automação ${automation.id}: está inativa`)
          logger.info(`Automação ${automation.id} está inativa, pulando...`, {
            siteId: automation.site_id,
          })
          continue
        }

        // Verificar se a automação requer aprovação (deve estar true)
        if (!automation.requires_approval) {
          results.skipped++
          results.skippedReasons.push(`Automação ${automation.id}: não requer aprovação`)
          logger.info(`Automação ${automation.id} não requer aprovação, pulando...`, {
            siteId: automation.site_id,
          })
          continue
        }

        // Verificar se é execução manual
        const manualHeader = request.headers.get('x-manual-execution') || request.headers.get('X-Manual-Execution')
        const userAgent = request.headers.get('user-agent') || ''
        const isManualExecution = manualHeader === 'true' || userAgent.includes('GitHub Actions')
        
        // Verificar se já existem posts para esta data
        // Em execução manual: verificar apenas posts APROVADOS
        // Em execução automática: verificar posts pendentes, aprovados ou editados
        const statusToCheck = isManualExecution 
          ? ['approved'] // Em execução manual, só verifica se já tem aprovados
          : ['pending', 'approved', 'edited'] // Em execução automática, verifica todos
        
        const { data: existingPosts } = await supabase
          .from('pending_posts')
          .select('id, status')
          .eq('site_id', automation.site_id)
          .gte('scheduled_date', `${targetDate}T00:00:00.000Z`)
          .lt('scheduled_date', `${targetDate}T23:59:59.999Z`)
          .in('status', statusToCheck)

        if (existingPosts && existingPosts.length >= 3) {
          const statusCounts = existingPosts.reduce((acc: any, post: any) => {
            acc[post.status] = (acc[post.status] || 0) + 1
            return acc
          }, {})
          
          const reason = isManualExecution
            ? `Automação ${automation.id}: já existem ${existingPosts.length} posts APROVADOS para ${targetDate}`
            : `Automação ${automation.id}: já existem ${existingPosts.length} posts (${JSON.stringify(statusCounts)}) para ${targetDate}`
          
          results.skipped++
          results.skippedReasons.push(reason)
          logger.info(`Posts já existem para ${targetDate} (domingo de publicação)`, {
            siteId: automation.site_id,
            count: existingPosts.length,
            statusCounts,
            isManualExecution,
          })
          continue
        }
        
        // Se é execução manual e não tem posts aprovados, logar que vai gerar
        if (isManualExecution) {
          logger.info(`Execução manual: não há posts aprovados para ${targetDate}, gerando novos posts`, {
            siteId: automation.site_id,
            existingPostsCount: existingPosts?.length || 0,
          })
        }

        // Se chegou aqui, vai processar
        results.processed++

        // Chamar API interna para gerar posts
        // Em produção, isso funcionará via HTTP. Em desenvolvimento, pode precisar ajustar a URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
          ? process.env.NEXT_PUBLIC_APP_URL
          : process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000'
        
        // Verificar se temos dados do site
        // wordpress_sites pode ser um objeto ou array dependendo da query
        const siteData = Array.isArray(automation.wordpress_sites) 
          ? automation.wordpress_sites[0] 
          : automation.wordpress_sites
        
        if (!siteData || !siteData.user_id) {
          logger.error('Dados do site não encontrados', {
            automationId: automation.id,
            siteId: automation.site_id,
            hasSiteData: !!siteData,
            wordpressSitesType: Array.isArray(automation.wordpress_sites) ? 'array' : typeof automation.wordpress_sites,
          })
          throw new Error(`Dados do site não encontrados para site_id: ${automation.site_id}`)
        }
        
        try {
          logger.info('Chamando API de geração de posts', {
            baseUrl,
            siteId: automation.site_id,
            userId: siteData.user_id,
            targetDate,
          })
          
          const response = await fetch(`${baseUrl}/api/generate-pending-posts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Para chamadas internas, podemos usar um header especial
              'X-Internal-Request': 'true',
              'X-User-Id': siteData.user_id,
            },
            body: JSON.stringify({
              siteId: automation.site_id,
              scheduledDate: `${targetDate}T09:00:00.000Z`, // 9h da manhã do domingo de publicação
              count: 3, // Gerar 3 posts
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            let errorData
            try {
              errorData = JSON.parse(errorText)
            } catch {
              errorData = { error: errorText || 'Erro desconhecido' }
            }
            logger.error('Erro ao gerar posts via API', {
              status: response.status,
              statusText: response.statusText,
              error: errorData,
              siteId: automation.site_id,
            })
            throw new Error(errorData.error || `Erro HTTP ${response.status}: ${response.statusText}`)
          }

          const data = await response.json()
          results.succeeded++
          
          logger.info(`Posts gerados com sucesso para ${targetDate} (domingo de publicação)`, {
            siteId: automation.site_id,
            count: data.posts?.length || 0,
            publicationDate: targetDate,
          })

          // Enviar webhook de aprovação se houver email configurado e posts gerados
          if (automation.approval_email && data.posts && data.posts.length > 0) {
            try {
              const postsWithUrls = data.posts.map((post: any) => ({
                id: post.id,
                title: post.title,
                approvalToken: post.approvalToken,
                approvalUrl: `${baseUrl}/approve/${post.approvalToken}`,
              }))

              await sendApprovalEmailWebhook({
                siteName: siteData?.name || 'Site desconhecido',
                siteUrl: siteData?.url || '',
                approvalEmail: automation.approval_email,
                publicationDate: targetDate,
                posts: postsWithUrls,
              })
            } catch (webhookError: any) {
              // Não falhar a geração se o webhook falhar
              logger.warn('Erro ao enviar webhook de aprovação', {
                error: webhookError.message,
                siteId: automation.site_id,
              })
            }
          }
        } catch (fetchError: any) {
          // Se a chamada HTTP falhar (ex: em desenvolvimento), logar mas continuar
          logger.warn(`Erro ao chamar API de geração de posts`, {
            error: fetchError.message,
            siteId: automation.site_id,
          })
          throw fetchError
        }
      } catch (error: any) {
        logger.error(`Erro ao gerar posts para automação ${automation.id}`, error, {
          endpoint: '/api/generate-pending-posts-weekly',
        })
        results.failed++
        results.errors.push(`Automação ${automation.id}: ${error.message || 'Erro desconhecido'}`)
      }
    }

    const nextSunday = getNextSunday()
    
    logger.info('Processamento de automações concluído', {
      total: results.total,
      processed: results.processed,
      succeeded: results.succeeded,
      failed: results.failed,
      skipped: results.skipped,
      targetDate,
    })
    
    return NextResponse.json({
      message: 'Processamento concluído',
      nextSunday: nextSunday.toISOString().split('T')[0],
      publicationDate: publicationDate.toISOString().split('T')[0],
      targetDate,
      ...results,
      // Incluir razões de skip apenas se houver
      ...(results.skippedReasons.length > 0 && { skippedReasons: results.skippedReasons }),
    })
  } catch (error: any) {
    logger.error('Erro ao processar automações', error, {
      endpoint: '/api/generate-pending-posts-weekly',
      errorMessage: error.message,
      errorStack: error.stack,
    })
    
    return NextResponse.json(
      {
        error: error.message || 'Erro ao processar automações',
        details: process.env.NODE_ENV === 'development' 
          ? { stack: error.stack, message: error.message }
          : undefined,
      },
      { status: 500 }
    )
  }
}
