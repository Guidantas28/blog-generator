import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { researchMarketTrends } from '@/lib/openai-trends'
import { generateKeywords, generateBlogContent } from '@/lib/openai'
import { searchDiverseImages } from '@/lib/images'
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

    // Buscar dados do site para obter CTA e telefone
    const { data: siteData, error: siteError } = await supabase
      .from('wordpress_sites')
      .select('cta_text, cta_link, phone_number')
      .eq('id', siteId)
      .eq('user_id', session.user.id)
      .single()

    const ctaText = siteData?.cta_text || undefined
    const ctaLink = siteData?.cta_link || undefined
    const phoneNumber = siteData?.phone_number || undefined

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

    // 5. Gerar conteúdo do blog com CTA e telefone do site
    const content = await generateBlogContent(
      selectedTrend,
      keywordsArray,
      ctaText,
      ctaLink,
      phoneNumber
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

    // 7. Buscar imagens já usadas neste site para evitar repetições
    const { data: usedPosts } = await supabase
      .from('published_posts')
      .select('image_url')
      .eq('site_id', siteId)
      .not('image_url', 'is', null)
      .limit(100) // Limitar para performance
    
    const usedImageUrls = (usedPosts || [])
      .map(post => post.image_url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)

    // 8. Selecionar imagem com diversidade
    const selectedImage = await searchDiverseImages(
      selectedTrend,
      keywordsArray,
      usedImageUrls,
      1
    )

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

