import { NextRequest, NextResponse } from 'next/server'
import { generateKeywords, generateBlogContent } from '@/lib/openai'
import { getServerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { topic, ctaText, ctaLink } = await request.json()

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Tópico é obrigatório' }, { status: 400 })
    }

    // Gerar palavras-chave primeiro
    const keywords = await generateKeywords(topic)
    const keywordsArray = Array.isArray(keywords) ? keywords : []

    // Gerar conteúdo apenas uma vez com as palavras-chave
    const finalContent = await generateBlogContent(topic, keywordsArray, ctaText, ctaLink)

    return NextResponse.json({
      keywords: keywordsArray,
      title: finalContent.title,
      content: finalContent.content,
      excerpt: finalContent.excerpt,
    })
  } catch (error: any) {
    console.error('Erro ao gerar palavras-chave e conteúdo:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar palavras-chave e conteúdo' },
      { status: 500 }
    )
  }
}

