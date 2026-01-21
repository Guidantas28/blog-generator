import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-server'
import { researchMarketTrends } from '@/lib/openai-trends'
import { generateKeywords, generateBlogContent } from '@/lib/openai'
import { searchImages } from '@/lib/images'
import {
  createWordPressPost,
  uploadImageToWordPress,
  getOrCreateCategory,
  type WordPressPost,
} from '@/lib/wordpress'
import { filterDuplicateTrends, checkDuplicateTopic } from '@/lib/duplicate-check'
import { downloadImage, searchDiverseImages } from '@/lib/images'

export const dynamic = 'force-dynamic'

/**
 * URL do webhook para notificações de automação
 */
const WEBHOOK_URL = 'https://n8n.avidati.com.br/webhook/be9041ec-e6c7-487a-a90e-62a5a82ab220'

/**
 * Envia notificação via webhook sobre os resultados da automação
 */
async function sendWebhookNotification(results: {
  processed: number
  succeeded: number
  failed: number
  publishedPosts: Array<{
    automationId: string
    siteId: string
    siteName: string
    title: string
    link: string
    topic: string
  }>
  failedPosts: Array<{
    automationId: string
    siteId: string
    siteName: string
    reason: string
    error: string
  }>
  timestamp: string
}) {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'automation_completed',
        timestamp: results.timestamp,
        summary: {
          processed: results.processed,
          succeeded: results.succeeded,
          failed: results.failed,
        },
        published_posts: results.publishedPosts,
        failed_posts: results.failedPosts,
      }),
    })

    if (!response.ok) {
      console.warn(`Webhook retornou status ${response.status}`)
    } else {
      console.log('Webhook enviado com sucesso')
    }
  } catch (error) {
    // Não falhar a automação se o webhook falhar
    console.error('Erro ao enviar webhook:', error)
  }
}

/**
 * API para executar automações pendentes
 * Esta rota deve ser chamada por um cron job (Vercel Cron, GitHub Actions, etc.)
 * 
 * Veja AUTOMATION_SETUP.md para detalhes de configuração
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se há uma chave secreta para proteger a rota
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se as variáveis necessárias estão configuradas
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY não está configurada')
      return NextResponse.json(
        { 
          error: 'Configuração faltando',
          message: 'A variável SUPABASE_SERVICE_ROLE_KEY deve estar configurada no Vercel. Veja AUTOMATION_SETUP.md para instruções.'
        },
        { status: 500 }
      )
    }

    // Usar service role client para bypassar RLS (necessário para cron jobs)
    let supabase
    try {
      supabase = getServiceRoleClient()
    } catch (error: any) {
      console.error('Erro ao criar service role client:', error)
      return NextResponse.json(
        { 
          error: 'Erro de configuração',
          message: error.message || 'Erro ao inicializar cliente do Supabase'
        },
        { status: 500 }
      )
    }

    // Buscar todas as automações que NÃO requerem aprovação
    // Automações com requires_approval = true são gerenciadas pelo sistema semanal de aprovação
    // Nota: Não filtrar por is_active aqui pois a coluna pode não existir ainda (ver migração SQL)
    const { data: allAutomations, error: automationsError } = await supabase
      .from('automation_settings')
      .select('*')

    if (automationsError) {
      console.error('Erro ao buscar automações:', automationsError)
      return NextResponse.json(
        { 
          error: 'Erro ao buscar automações',
          details: automationsError.message 
        },
        { status: 500 }
      )
    }

    // Filtrar automações que NÃO requerem aprovação e estão ativas (client-side filter)
    // Automações com requires_approval = true são gerenciadas pelo sistema semanal de aprovação
    const automations = (allAutomations || []).filter(
      (auto) => {
        // Se is_active existir e for false, pular
        if (auto.is_active === false) return false
        // Se requires_approval for true, pular (gerenciado pelo sistema semanal)
        if (auto.requires_approval === true) return false
        return true
      }
    )

    console.log(`Encontradas ${automations?.length || 0} automação(ões) sem aprovação no banco de dados`)

    if (!automations || automations.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma automação configurada',
        processed: 0,
      })
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      details: [] as Array<{
        automationId: string
        siteId: string
        status: 'success' | 'error'
        message: string
      }>,
      publishedPosts: [] as Array<{
        automationId: string
        siteId: string
        siteName: string
        title: string
        link: string
        topic: string
      }>,
      failedPosts: [] as Array<{
        automationId: string
        siteId: string
        siteName: string
        reason: string
        error: string
      }>,
    }

    // Mapa para armazenar nomes dos sites
    const sitesMap = new Map<string, string>()

    // Processar cada automação
    for (const automation of automations) {
      try {
        const today = new Date()
        const dayOfWeek = today.getDay() // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
        
        // Verificar se hoje é um dos dias selecionados
        if (automation.selected_days && Array.isArray(automation.selected_days) && automation.selected_days.length > 0) {
          // Converter selected_days para formato correto (0-6)
          // Se selected_days está em formato diferente, ajustar
          const selectedDays = automation.selected_days.map((day: number) => {
            // Se estiver em formato 1-7 (domingo=1), converter para 0-6
            return day > 6 ? day - 1 : day
          })
          
          if (!selectedDays.includes(dayOfWeek)) {
            console.log(`Automação ${automation.id}: hoje (${dayOfWeek}) não está nos dias selecionados (${selectedDays.join(', ')}). Pulando...`)
            continue
          }
        }

        // Verificar quantos posts já foram gerados nesta semana
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - dayOfWeek) // Domingo da semana atual
        startOfWeek.setHours(0, 0, 0, 0)
        
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 7)
        
        // Buscar posts publicados nesta semana para esta automação
        const { data: postsThisWeek } = await supabase
          .from('published_posts')
          .select('id')
          .eq('site_id', automation.site_id)
          .gte('created_at', startOfWeek.toISOString())
          .lt('created_at', endOfWeek.toISOString())

        const postsCountThisWeek = postsThisWeek?.length || 0
        const daysPerWeek = automation.days_per_week || 1
        
        // Verificar se já atingiu o limite de posts da semana
        if (postsCountThisWeek >= daysPerWeek) {
          console.log(`Automação ${automation.id}: já gerou ${postsCountThisWeek} post(s) esta semana (limite: ${daysPerWeek}). Pulando...`)
          continue
        }

        // Se frequency for diferente de 'daily', verificar intervalo desde última execução
        if (automation.frequency && automation.frequency !== 'daily') {
          const { data: lastExecution } = await supabase
            .from('automation_executions')
            .select('started_at')
            .eq('automation_id', automation.id)
            .eq('status', 'completed')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (lastExecution) {
            const lastDate = new Date(lastExecution.started_at)
            const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

            // Verificar frequência
            switch (automation.frequency) {
              case 'weekly':
                if (daysDiff < 7) {
                  console.log(`Automação ${automation.id}: frequência semanal, última execução há ${daysDiff} dias. Pulando...`)
                  continue
                }
                break
              case 'biweekly':
                if (daysDiff < 14) {
                  console.log(`Automação ${automation.id}: frequência quinzenal, última execução há ${daysDiff} dias. Pulando...`)
                  continue
                }
                break
              case 'monthly':
                if (daysDiff < 30) {
                  console.log(`Automação ${automation.id}: frequência mensal, última execução há ${daysDiff} dias. Pulando...`)
                  continue
                }
                break
            }
          }
        }
        
        console.log(`✅ Automação ${automation.id}: condições atendidas - dia ${dayOfWeek} selecionado, ${postsCountThisWeek}/${daysPerWeek} posts esta semana`)

        // Verificar se já existe uma execução em andamento (proteção contra duplicatas)
        const { data: runningExecution } = await supabase
          .from('automation_executions')
          .select('id')
          .eq('automation_id', automation.id)
          .eq('status', 'running')
          .maybeSingle()

        if (runningExecution) {
          console.log(`Automação ${automation.id} já está em execução. Pulando...`)
          continue
        }

        results.processed++

        // Criar registro de execução
        const { data: execution, error: execError } = await supabase
          .from('automation_executions')
          .insert({
            automation_id: automation.id,
            user_id: automation.user_id,
            site_id: automation.site_id,
            status: 'running',
            current_step: 'Iniciando automação',
          })
          .select()
          .single()

        if (execError) {
          throw execError
        }

        // Função helper para atualizar o step atual
        const updateStep = async (step: string) => {
          try {
            await supabase
              .from('automation_executions')
              .update({ current_step: step })
              .eq('id', execution.id)
          } catch (error) {
            console.error('Erro ao atualizar step:', error)
            // Não falhar a automação se a atualização do step falhar
          }
        }

        try {
          // 1. Buscar dados do site
          await updateStep('Buscando dados do site')
          const { data: siteData, error: siteError } = await supabase
            .from('wordpress_sites')
            .select('*')
            .eq('id', automation.site_id)
            .single()

          if (siteError || !siteData) {
            throw new Error('Site não encontrado')
          }

          // Armazenar nome do site no mapa
          sitesMap.set(automation.site_id, siteData.name)

          // Descriptografar senha
          const { decrypt } = await import('@/lib/encryption')
          let password: string
          try {
            password = decrypt(siteData.password_encrypted)
          } catch (error: any) {
            const { logger } = await import('@/lib/logger')
            logger.error('Erro ao descriptografar senha do site', error, {
              endpoint: '/api/run-automation',
              siteId: automation.site_id,
              automationId: automation.id,
            })
            throw new Error(`Erro ao descriptografar senha: ${error?.message || 'Erro desconhecido'}`)
          }
          const site = {
            id: siteData.id,
            user_id: siteData.user_id,
            name: siteData.name,
            url: siteData.url,
            username: siteData.username,
            password,
          }

          // 2. Pesquisar tendências
          await updateStep('Pesquisando tendências de mercado')
          const trends = await researchMarketTrends(automation.business_category)
          if (trends.length === 0) {
            throw new Error('Não foi possível encontrar tendências')
          }

          // 3. Filtrar tendências que já foram usadas (verificar duplicatas)
          await updateStep('Verificando duplicatas de tendências')
          const filteredTrends = await filterDuplicateTrends(supabase, automation.site_id, trends)
          const trendsToUse = filteredTrends.length > 0 ? filteredTrends : trends
          if (filteredTrends.length === 0 && trends.length > 0) {
            console.warn('Todas as tendências são similares a posts anteriores. Usando tendências originais.')
          }

          // 4. Selecionar uma tendência aleatória e verificar duplicatas
          await updateStep('Selecionando tendência')
          let selectedTrend = trendsToUse[Math.floor(Math.random() * trendsToUse.length)]
          let attempts = 0
          const maxAttempts = 5
          
          // Tentar encontrar uma tendência que não seja duplicada
          while (attempts < maxAttempts && trendsToUse.length > 1) {
            const { isDuplicate, similarPosts } = await checkDuplicateTopic(supabase, automation.site_id, selectedTrend)
            
            if (!isDuplicate) {
              // Encontrou uma tendência única, usar ela
              break
            }
            
            // Se for duplicado, tentar outra tendência
            if (similarPosts.length > 0) {
              console.warn(`Tendência "${selectedTrend}" é similar a posts anteriores. Tentando outra...`)
              const alternativeTrends = trendsToUse.filter(t => t !== selectedTrend)
              if (alternativeTrends.length > 0) {
                selectedTrend = alternativeTrends[Math.floor(Math.random() * alternativeTrends.length)]
              } else {
                // Não há mais alternativas, usar a atual mesmo sendo duplicada
                console.warn(`Aviso: Todas as tendências são similares. Usando "${selectedTrend}" mesmo assim.`)
                break
              }
            }
            attempts++
          }

          // 5. Gerar palavras-chave
          await updateStep('Gerando palavras-chave')
          const keywords = await generateKeywords(selectedTrend)
          const keywordsArray = Array.isArray(keywords) ? keywords : []

          // 6. Obter CTA, telefone, cores e configurações do agente do site
          const ctaText = siteData.cta_text || undefined
          const ctaLink = siteData.cta_link || undefined
          const phoneNumber = siteData.phone_number || undefined
          const colors = {
            cta_primary_color: siteData.cta_primary_color || undefined,
            cta_secondary_color: siteData.cta_secondary_color || undefined,
            whatsapp_color: siteData.whatsapp_color || undefined,
            keywords_bg_color: siteData.keywords_bg_color || undefined,
            keywords_text_color: siteData.keywords_text_color || undefined,
          }
          
          // Configurações do agente
          const agentConfig = {
            system_prompt: siteData.system_prompt || undefined,
            content_prompt_template: siteData.content_prompt_template || undefined,
            tone: siteData.tone || undefined,
            writing_style: siteData.writing_style || undefined,
            target_audience: siteData.target_audience || undefined,
            additional_instructions: siteData.additional_instructions || undefined,
          }

          // 7. Gerar conteúdo com CTA, telefone, cores e configurações do agente do site
          await updateStep('Gerando conteúdo do blog')
          const content = await generateBlogContent(
            selectedTrend,
            keywordsArray,
            ctaText,
            ctaLink,
            phoneNumber,
            colors,
            agentConfig
          )

          // 8. Verificar duplicata no título gerado também
          await updateStep('Verificando duplicatas no título')
          const { isDuplicate: isTitleDuplicate } = await checkDuplicateTopic(
            supabase,
            automation.site_id,
            selectedTrend,
            content.title
          )
          if (isTitleDuplicate) {
            console.warn(`Aviso: Título gerado "${content.title}" é similar a posts anteriores.`)
          }

          // 9. Buscar imagens já usadas neste site para evitar repetições
          await updateStep('Buscando imagens')
          // Buscar mais posts para ter uma lista mais completa de imagens usadas
          const { data: usedPosts } = await supabase
            .from('published_posts')
            .select('image_url')
            .eq('site_id', automation.site_id)
            .not('image_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(500) // Aumentar limite para considerar mais imagens usadas
          
          const usedImageUrls = (usedPosts || [])
            .map(post => post.image_url)
            .filter((url): url is string => typeof url === 'string' && url.length > 0)

          // 10. Selecionar imagem com diversidade (com retry automático)
          let selectedImage = await searchDiverseImages(
            selectedTrend,
            keywordsArray,
            usedImageUrls,
            1,
            3 // 3 tentativas para garantir que encontre uma imagem
          )

          // Se ainda não encontrou imagem, tentar com queries mais genéricas
          if (!selectedImage) {
            console.warn('Não encontrou imagem na primeira tentativa. Tentando com queries mais genéricas...')
            // Tentar com apenas o tópico e keywords principais
            const mainKeywords = keywordsArray.slice(0, 3)
            selectedImage = await searchDiverseImages(
              selectedTrend,
              mainKeywords,
              usedImageUrls,
              1,
              2
            )
          }

          // Se ainda não encontrou, usar qualquer imagem disponível (melhor que nenhuma)
          if (!selectedImage) {
            console.warn('Tentando buscar qualquer imagem disponível como último recurso...')
            try {
              const fallbackImages = await searchImages(selectedTrend, 30)
              if (fallbackImages && fallbackImages.length > 0) {
                // Filtrar apenas as que não foram usadas
                const unused = fallbackImages.filter(img => {
                  const normalized = img.split('?')[0].split('#')[0]
                  return !usedImageUrls.some(used => {
                    const normalizedUsed = used.split('?')[0].split('#')[0]
                    return normalized === normalizedUsed
                  })
                })
                if (unused.length > 0) {
                  selectedImage = unused[Math.floor(Math.random() * unused.length)]
                } else if (fallbackImages.length > 0) {
                  // Se todas foram usadas, usar qualquer uma mesmo assim
                  selectedImage = fallbackImages[Math.floor(Math.random() * fallbackImages.length)]
                }
              }
            } catch (error) {
              console.error('Erro no fallback final de busca de imagem:', error)
            }
          }

          // 11. Fazer upload da imagem se houver
          let featuredMediaId: number | undefined
          if (selectedImage) {
            try {
              await updateStep('Fazendo upload da imagem')
              const imageBlob = await downloadImage(selectedImage)
              const filename = `blog-image-${Date.now()}.jpg`
              featuredMediaId = await uploadImageToWordPress(site, imageBlob, filename)
            } catch (error) {
              console.warn('Erro ao fazer upload da imagem:', error)
            }
          }

          // 12. Buscar ou criar categoria padrão
          await updateStep('Preparando categoria')
          let categoryId: number | undefined
          try {
            // Usar a categoria do negócio ou primeira keyword como categoria
            const categoryName = automation.business_category || keywordsArray[0] || 'Blog'
            categoryId = await getOrCreateCategory(site, categoryName)
          } catch (error) {
            console.warn('Erro ao criar/buscar categoria, continuando sem categoria:', error)
            // Continuar sem categoria se houver erro
          }

          // 13. Criar e publicar post no WordPress
          await updateStep('Publicando post no WordPress')
          const post: WordPressPost = {
            title: content.title,
            content: content.content,
            excerpt: content.excerpt,
            featured_media: featuredMediaId,
            status: 'publish', // Publicar diretamente
            categories: categoryId ? [categoryId] : undefined,
            meta: {
              _yoast_wpseo_title: content.title,
              _yoast_wpseo_metadesc: content.excerpt || '',
              _yoast_wpseo_focuskw: keywordsArray[0] || '',
            },
          }

          const result = await createWordPressPost(site, post)

          // 14. Salvar no Supabase na tabela published_posts (já que está sendo publicado)
          await updateStep('Salvando post no banco de dados')
          const { data: postData, error: postError } = await supabase
            .from('published_posts')
            .insert({
              user_id: automation.user_id,
              site_id: automation.site_id,
              topic: selectedTrend,
              title: content.title,
              content: content.content,
              excerpt: content.excerpt || '',
              keywords: keywordsArray,
              image_url: selectedImage || null,
              wordpress_post_id: result.id,
              wordpress_post_url: result.link,
              status: 'published',
              seo_title: content.title,
              seo_description: content.excerpt || '',
              focus_keyword: keywordsArray[0] || '',
              cta_text: ctaText || null,
              cta_link: ctaLink || null,
            })
            .select()
            .single()

          // 15. Atualizar execução como concluída
          await updateStep('Concluído')
          await supabase
            .from('automation_executions')
            .update({
              status: 'completed',
              post_id: postData?.id,
              completed_at: new Date().toISOString(),
              current_step: 'Post publicado com sucesso',
            })
            .eq('id', execution.id)

          results.succeeded++
          results.details.push({
            automationId: automation.id,
            siteId: automation.site_id,
            status: 'success',
            message: `Post criado: ${content.title}`,
          })
          
          // Adicionar aos posts publicados para webhook
          results.publishedPosts.push({
            automationId: automation.id,
            siteId: automation.site_id,
            siteName: siteData.name,
            title: content.title,
            link: result.link,
            topic: selectedTrend,
          })
        } catch (error: any) {
          // Atualizar execução como falha
          const errorMessage = error.message || 'Erro desconhecido'
          await supabase
            .from('automation_executions')
            .update({
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString(),
              current_step: `Erro: ${errorMessage}`,
            })
            .eq('id', execution.id)

          results.failed++
          results.details.push({
            automationId: automation.id,
            siteId: automation.site_id,
            status: 'error',
            message: error.message || 'Erro ao executar automação',
          })
          
          // Adicionar aos posts falhados para webhook
          const siteName = sitesMap.get(automation.site_id) || 'Site desconhecido'
          results.failedPosts.push({
            automationId: automation.id,
            siteId: automation.site_id,
            siteName,
            reason: 'Erro ao executar automação',
            error: error.message || 'Erro desconhecido',
          })
        } finally {
          // Garantir que o status seja sempre atualizado, mesmo se houver erro não capturado
          // Verificar se a execução ainda está como 'running' e atualizar se necessário
          const { data: currentExecution } = await supabase
            .from('automation_executions')
            .select('status')
            .eq('id', execution.id)
            .single()
          
          if (currentExecution && currentExecution.status === 'running') {
            // Se ainda está como running, significa que houve um erro não capturado
            await supabase
              .from('automation_executions')
              .update({
                status: 'failed',
                error_message: 'Erro inesperado durante a execução',
                completed_at: new Date().toISOString(),
                current_step: 'Erro inesperado - execução interrompida',
              })
              .eq('id', execution.id)
          }
        }
      } catch (error: any) {
        console.error(`Erro ao processar automação ${automation.id}:`, error)
        results.failed++
        results.details.push({
          automationId: automation.id,
          siteId: automation.site_id,
          status: 'error',
          message: error.message || 'Erro ao processar automação',
        })
        
        // Adicionar aos posts falhados para webhook
        const siteName = sitesMap.get(automation.site_id) || 'Site desconhecido'
        results.failedPosts.push({
          automationId: automation.id,
          siteId: automation.site_id,
          siteName,
          reason: 'Erro ao processar automação',
          error: error.message || 'Erro desconhecido',
        })
      }
    }

    // Enviar webhook com os resultados
    if (results.processed > 0) {
      await sendWebhookNotification({
        processed: results.processed,
        succeeded: results.succeeded,
        failed: results.failed,
        publishedPosts: results.publishedPosts,
        failedPosts: results.failedPosts,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      message: 'Processamento concluído',
      ...results,
    })
  } catch (error: any) {
    console.error('Erro ao executar automações:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao executar automações' },
      { status: 500 }
    )
  }
}

