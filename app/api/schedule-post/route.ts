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
      siteId,
      topic,
      title,
      content,
      excerpt,
      imageUrl,
      keywords,
      seoTitle,
      seoDescription,
      focusKeyword,
      ctaText,
      ctaLink,
      scheduledDate,
    } = await request.json()

    if (!siteId || !title || !content || !scheduledDate) {
      return NextResponse.json(
        { error: 'Site, título, conteúdo e data de agendamento são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar que a data é futura
    const scheduledDateTime = new Date(scheduledDate)
    if (scheduledDateTime <= new Date()) {
      return NextResponse.json(
        { error: 'A data de agendamento deve ser no futuro' },
        { status: 400 }
      )
    }

    // Verificar se o site pertence ao usuário
    const { data: siteData, error: siteError } = await supabase
      .from('wordpress_sites')
      .select('id, name')
      .eq('id', siteId)
      .eq('user_id', session.user.id)
      .single()

    if (siteError || !siteData) {
      return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })
    }

    // Salvar post agendado
    const { data: scheduledPost, error: insertError } = await supabase
      .from('scheduled_posts')
      .insert({
        user_id: session.user.id,
        site_id: siteId,
        topic: topic || title,
        title,
        content,
        excerpt: excerpt || '',
        keywords: Array.isArray(keywords) ? keywords : (focusKeyword ? [focusKeyword] : []),
        image_url: imageUrl || null,
        seo_title: seoTitle || title,
        seo_description: seoDescription || excerpt || '',
        focus_keyword: focusKeyword || '',
        cta_text: ctaText || null,
        cta_link: ctaLink || null,
        scheduled_date: scheduledDateTime.toISOString(),
        status: 'scheduled',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Erro ao salvar post agendado:', insertError)
      return NextResponse.json(
        { error: 'Erro ao agendar post: ' + insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: scheduledPost.id,
      message: 'Post agendado com sucesso!',
      scheduledDate: scheduledDateTime.toISOString(),
    })
  } catch (error: any) {
    console.error('Erro ao agendar post:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao agendar post' },
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
    const siteId = searchParams.get('siteId')
    const status = searchParams.get('status') || 'scheduled'

    let query = supabase
      .from('scheduled_posts')
      .select('*, wordpress_sites(name, url)')
      .eq('user_id', session.user.id)
      .order('scheduled_date', { ascending: true })

    if (siteId) {
      query = query.eq('site_id', siteId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar posts agendados:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar posts agendados' },
        { status: 500 }
      )
    }

    return NextResponse.json({ posts: data || [] })
  } catch (error: any) {
    console.error('Erro ao buscar posts agendados:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar posts agendados' },
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
      return NextResponse.json({ error: 'ID do post é obrigatório' }, { status: 400 })
    }

    const { error } = await supabase
      .from('scheduled_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Erro ao cancelar post agendado:', error)
      return NextResponse.json(
        { error: 'Erro ao cancelar post agendado' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Post agendado cancelado com sucesso' })
  } catch (error: any) {
    console.error('Erro ao cancelar post agendado:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao cancelar post agendado' },
      { status: 500 }
    )
  }
}
