import { NextRequest, NextResponse } from 'next/server'
import { generateKeywords } from '@/lib/openai'
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

    const { topic } = await request.json()

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Tópico é obrigatório' }, { status: 400 })
    }

    const keywords = await generateKeywords(topic)

    // Garantir que sempre retorne um array
    const keywordsArray = Array.isArray(keywords) ? keywords : []
    return NextResponse.json({ keywords: keywordsArray })
  } catch (error: any) {
    console.error('Erro ao gerar palavras-chave:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar palavras-chave' },
      { status: 500 }
    )
  }
}

