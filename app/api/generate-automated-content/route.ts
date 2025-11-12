import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { researchMarketTrends, selectBestImageTopic } from '@/lib/openai-trends'
import { generateKeywords, generateBlogContent } from '@/lib/openai'
import { searchImages } from '@/lib/images'
import { filterDuplicateTrends, checkDuplicateTopic } from '@/lib/duplicate-check'

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

    const { siteId, businessCategory } = await request.json()

    if (!siteId || !businessCategory) {
      return NextResponse.json(
        { error: 'Site e categoria do negócio são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar dados do site para obter CTA
    const { data: siteData, error: siteError } = await supabase
      .from('wordpress_sites')
      .select('cta_text, cta_link')
      .eq('id', siteId)
      .eq('user_id', session.user.id)
      .single()

    const ctaText = siteData?.cta_text || undefined
    const ctaLink = siteData?.cta_link || undefined

    // 1. Pesquisar tendências do mercado
    const trends = await researchMarketTrends(businessCategory)
    if (trends.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível encontrar tendências para esta categoria' },
        { status: 500 }
      )
    }

    // 2. Filtrar tendências que já foram usadas (verificar duplicatas)
    const filteredTrends = await filterDuplicateTrends(supabase, siteId, trends)
    
    // Se todas as tendências foram filtradas, usar as originais mas avisar
    const trendsToUse = filteredTrends.length > 0 ? filteredTrends : trends
    if (filteredTrends.length === 0 && trends.length > 0) {
      console.warn('Todas as tendências são similares a posts anteriores. Usando tendências originais.')
    }

    // 3. Selecionar uma tendência aleatória e verificar duplicatas
    let selectedTrend = trendsToUse[Math.floor(Math.random() * trendsToUse.length)]
    let attempts = 0
    const maxAttempts = 5
    
    // Tentar encontrar uma tendência que não seja duplicada
    while (attempts < maxAttempts && trendsToUse.length > 1) {
      const { isDuplicate, similarPosts } = await checkDuplicateTopic(supabase, siteId, selectedTrend)
      
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

    // 4. Gerar palavras-chave baseadas na tendência selecionada
    const keywords = await generateKeywords(selectedTrend)
    const keywordsArray = Array.isArray(keywords) ? keywords : []

    // 5. Gerar conteúdo do blog com CTA do site
    const content = await generateBlogContent(
      selectedTrend,
      keywordsArray,
      ctaText,
      ctaLink
    )
    
    // 6. Verificar duplicata no título gerado também
    const { isDuplicate: isTitleDuplicate } = await checkDuplicateTopic(
      supabase,
      siteId,
      selectedTrend,
      content.title
    )
    if (isTitleDuplicate) {
      console.warn(`Aviso: Título gerado "${content.title}" é similar a posts anteriores.`)
    }

    // 7. Selecionar melhor query para busca de imagem
    const imageQuery = await selectBestImageTopic(selectedTrend)

    // 8. Buscar imagens
    const images = await searchImages(imageQuery, 5)
    const selectedImage = images.length > 0 ? images[0] : null

    return NextResponse.json({
      topic: selectedTrend,
      title: content.title,
      content: content.content,
      excerpt: content.excerpt,
      keywords: keywordsArray,
      imageUrl: selectedImage,
      trendSource: selectedTrend,
    })
  } catch (error: any) {
    console.error('Erro ao gerar conteúdo automático:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar conteúdo automático' },
      { status: 500 }
    )
  }
}

