import { NextRequest, NextResponse } from 'next/server'
import { generateBlogContent } from '@/lib/openai'
import { getServerClient } from '@/lib/supabase-server'

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

    const { topic, keywords, ctaText, ctaLink } = await request.json()

    if (!topic || !keywords || !Array.isArray(keywords)) {
      return NextResponse.json(
        { error: 'Tópico e palavras-chave são obrigatórios' },
        { status: 400 }
      )
    }

    const content = await generateBlogContent(topic, keywords, ctaText, ctaLink)

    return NextResponse.json(content)
  } catch (error: any) {
    console.error('Erro ao gerar conteúdo:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar conteúdo' },
      { status: 500 }
    )
  }
}

