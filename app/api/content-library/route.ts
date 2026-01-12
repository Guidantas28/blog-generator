import { NextRequest, NextResponse } from 'next/server'
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

    const {
      title,
      content,
      contentType,
      tags,
      category,
      isFavorite,
    } = await request.json()

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Título e conteúdo são obrigatórios' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('content_library')
      .insert({
        user_id: session.user.id,
        title,
        content,
        content_type: contentType || 'snippet',
        tags: Array.isArray(tags) ? tags : [],
        category: category || null,
        is_favorite: isFavorite || false,
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao salvar na biblioteca:', error)
      return NextResponse.json(
        { error: 'Erro ao salvar: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      item: data,
      message: 'Conteúdo salvo na biblioteca com sucesso!',
    })
  } catch (error: any) {
    console.error('Erro ao salvar na biblioteca:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar na biblioteca' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('contentType')
    const category = searchParams.get('category')
    const tag = searchParams.get('tag')
    const favorite = searchParams.get('favorite')

    let query = supabase
      .from('content_library')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (contentType) {
      query = query.eq('content_type', contentType)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (tag) {
      query = query.contains('tags', [tag])
    }

    if (favorite === 'true') {
      query = query.eq('is_favorite', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar biblioteca:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar biblioteca' },
        { status: 500 }
      )
    }

    return NextResponse.json({ items: data || [] })
  } catch (error: any) {
    console.error('Erro ao buscar biblioteca:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar biblioteca' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const {
      id,
      title,
      content,
      tags,
      category,
      isFavorite,
    } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : []
    if (category !== undefined) updateData.category = category
    if (isFavorite !== undefined) updateData.is_favorite = isFavorite

    const { data, error } = await supabase
      .from('content_library')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar biblioteca:', error)
      return NextResponse.json(
        { error: 'Erro ao atualizar: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      item: data,
      message: 'Conteúdo atualizado com sucesso!',
    })
  } catch (error: any) {
    console.error('Erro ao atualizar biblioteca:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar biblioteca' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const { error } = await supabase
      .from('content_library')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Erro ao deletar da biblioteca:', error)
      return NextResponse.json(
        { error: 'Erro ao deletar: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Conteúdo removido da biblioteca com sucesso!' })
  } catch (error: any) {
    console.error('Erro ao deletar da biblioteca:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar da biblioteca' },
      { status: 500 }
    )
  }
}
