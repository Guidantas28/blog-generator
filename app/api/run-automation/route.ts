import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { researchMarketTrends, selectBestImageTopic } from '@/lib/openai-trends'
import { generateKeywords, generateBlogContent } from '@/lib/openai'
import { searchImages } from '@/lib/images'
import {
  createWordPressPost,
  uploadImageToWordPress,
  getOrCreateCategory,
  type WordPressPost,
} from '@/lib/wordpress'
import { filterDuplicateTrends, checkDuplicateTopic } from '@/lib/duplicate-check'
import { downloadImage } from '@/lib/images'

export const dynamic = 'force-dynamic'

/**
 * API para executar automações pendentes
 * Esta rota deve ser chamada por um cron job (Vercel Cron, GitHub Actions, etc.)
 * 
 * Veja AUTOMATION_SETUP.md para detalhes de configuração
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerClient()
    
    // Verificar se há uma chave secreta para proteger a rota
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar todas as automações ativas
    const { data: automations, error: automationsError } = await supabase
      .from('automation_settings')
      .select('*')

    if (automationsError) {
      throw automationsError
    }

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
    }

    // Processar cada automação
    for (const automation of automations) {
      try {
        // Verificar se deve executar
        // Buscar última execução bem-sucedida
        const { data: lastExecution } = await supabase
          .from('automation_executions')
          .select('started_at')
          .eq('automation_id', automation.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        let shouldRun = false
        if (!lastExecution) {
          // Se não há execução anterior, pode executar
          shouldRun = true
        } else {
          // Calcular dias desde última execução
          const lastDate = new Date(lastExecution.started_at)
          const now = new Date()
          const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

          // Verificar frequência
          switch (automation.frequency) {
            case 'weekly':
              shouldRun = daysDiff >= 7
              break
            case 'biweekly':
              shouldRun = daysDiff >= 14
              break
            case 'monthly':
              shouldRun = daysDiff >= 30
              break
            default:
              shouldRun = false
          }
        }

        if (!shouldRun) {
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
          })
          .select()
          .single()

        if (execError) {
          throw execError
        }

        try {
          // 1. Buscar dados do site
          const { data: siteData, error: siteError } = await supabase
            .from('wordpress_sites')
            .select('*')
            .eq('id', automation.site_id)
            .single()

          if (siteError || !siteData) {
            throw new Error('Site não encontrado')
          }

          const password = atob(siteData.password_encrypted)
          const site = {
            id: siteData.id,
            user_id: siteData.user_id,
            name: siteData.name,
            url: siteData.url,
            username: siteData.username,
            password,
          }

          // 2. Pesquisar tendências
          const trends = await researchMarketTrends(automation.business_category)
          if (trends.length === 0) {
            throw new Error('Não foi possível encontrar tendências')
          }

          // 3. Filtrar tendências que já foram usadas (verificar duplicatas)
          const filteredTrends = await filterDuplicateTrends(supabase, automation.site_id, trends)
          const trendsToUse = filteredTrends.length > 0 ? filteredTrends : trends
          if (filteredTrends.length === 0 && trends.length > 0) {
            console.warn('Todas as tendências são similares a posts anteriores. Usando tendências originais.')
          }

          // 4. Selecionar uma tendência aleatória e verificar duplicatas
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
          const keywords = await generateKeywords(selectedTrend)
          const keywordsArray = Array.isArray(keywords) ? keywords : []

          // 6. Gerar conteúdo
          const content = await generateBlogContent(
            selectedTrend,
            keywordsArray,
            undefined,
            undefined
          )

          // 7. Verificar duplicata no título gerado também
          const { isDuplicate: isTitleDuplicate } = await checkDuplicateTopic(
            supabase,
            automation.site_id,
            selectedTrend,
            content.title
          )
          if (isTitleDuplicate) {
            console.warn(`Aviso: Título gerado "${content.title}" é similar a posts anteriores.`)
          }

          // 8. Selecionar imagem
          const imageQuery = await selectBestImageTopic(selectedTrend)
          const images = await searchImages(imageQuery, 5)
          const selectedImage = images.length > 0 ? images[0] : null

          // 9. Fazer upload da imagem se houver
          let featuredMediaId: number | undefined
          if (selectedImage) {
            try {
              const imageBlob = await downloadImage(selectedImage)
              const filename = `blog-image-${Date.now()}.jpg`
              featuredMediaId = await uploadImageToWordPress(site, imageBlob, filename)
            } catch (error) {
              console.warn('Erro ao fazer upload da imagem:', error)
            }
          }

          // 10. Buscar ou criar categoria padrão
          let categoryId: number | undefined
          try {
            // Usar a categoria do negócio ou primeira keyword como categoria
            const categoryName = automation.business_category || keywordsArray[0] || 'Blog'
            categoryId = await getOrCreateCategory(site, categoryName)
          } catch (error) {
            console.warn('Erro ao criar/buscar categoria, continuando sem categoria:', error)
            // Continuar sem categoria se houver erro
          }

          // 11. Criar post como rascunho no WordPress
          const post: WordPressPost = {
            title: content.title,
            content: content.content,
            excerpt: content.excerpt,
            featured_media: featuredMediaId,
            status: 'draft', // Sempre salvar como rascunho para revisão
            categories: categoryId ? [categoryId] : undefined,
            meta: {
              _yoast_wpseo_title: content.title,
              _yoast_wpseo_metadesc: content.excerpt || '',
              _yoast_wpseo_focuskw: keywordsArray[0] || '',
            },
          }

          const result = await createWordPressPost(site, post)

          // 10. Salvar no Supabase
          const { data: postData, error: postError } = await supabase
            .from('automated_posts')
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
              status: 'draft',
              trend_source: selectedTrend,
            })
            .select()
            .single()

          // 10. Atualizar execução como concluída
          await supabase
            .from('automation_executions')
            .update({
              status: 'completed',
              post_id: postData?.id,
              completed_at: new Date().toISOString(),
            })
            .eq('id', execution.id)

          results.succeeded++
          results.details.push({
            automationId: automation.id,
            siteId: automation.site_id,
            status: 'success',
            message: `Post criado: ${content.title}`,
          })
        } catch (error: any) {
          // Atualizar execução como falha
          await supabase
            .from('automation_executions')
            .update({
              status: 'failed',
              error_message: error.message || 'Erro desconhecido',
              completed_at: new Date().toISOString(),
            })
            .eq('id', execution.id)

          results.failed++
          results.details.push({
            automationId: automation.id,
            siteId: automation.site_id,
            status: 'error',
            message: error.message || 'Erro ao executar automação',
          })
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
      }
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

