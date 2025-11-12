import { NextRequest, NextResponse } from 'next/server'
import { searchImages } from '@/lib/images'
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

    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query é obrigatória' }, { status: 400 })
    }

    const images = await searchImages(query, 6)

    return NextResponse.json({ images })
  } catch (error: any) {
    console.error('Erro ao buscar imagens:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar imagens' },
      { status: 500 }
    )
  }
}

