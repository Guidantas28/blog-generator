import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { researchMarketTrends, selectBestImageTopic } from '@/lib/openai-trends'
import { generateKeywords, generateBlogContent } from '@/lib/openai'
import { searchImages } from '@/lib/images'

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

    // 1. Pesquisar tendências do mercado
    const trends = await researchMarketTrends(businessCategory)
    if (trends.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível encontrar tendências para esta categoria' },
        { status: 500 }
      )
    }

    // 2. Selecionar uma tendência aleatória
    const selectedTrend = trends[Math.floor(Math.random() * trends.length)]

    // 3. Gerar palavras-chave baseadas na tendência
    const keywords = await generateKeywords(selectedTrend)
    const keywordsArray = Array.isArray(keywords) ? keywords : []

    // 4. Gerar conteúdo do blog
    const content = await generateBlogContent(
      selectedTrend,
      keywordsArray,
      undefined,
      undefined
    )

    // 5. Selecionar melhor query para busca de imagem
    const imageQuery = await selectBestImageTopic(selectedTrend)

    // 6. Buscar imagens
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

