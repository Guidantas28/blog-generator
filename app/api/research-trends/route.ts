import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { researchMarketTrends } from '@/lib/openai-trends'

export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { businessCategory } = await request.json()

    if (!businessCategory || typeof businessCategory !== 'string') {
      return NextResponse.json(
        { error: 'Categoria do negócio é obrigatória' },
        { status: 400 }
      )
    }

    const trends = await researchMarketTrends(businessCategory)

    return NextResponse.json({ trends })
  } catch (error: any) {
    console.error('Erro ao pesquisar tendências:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao pesquisar tendências' },
      { status: 500 }
    )
  }
}

