import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

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
    const format = searchParams.get('format') || 'json'
    const siteId = searchParams.get('siteId')

    // Buscar posts do usuário
    let query = supabase
      .from('published_posts')
      .select('*, wordpress_sites(name, url)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (siteId) {
      query = query.eq('site_id', siteId)
    }

    const { data: posts, error } = await query

    if (error) {
      console.error('Erro ao buscar posts:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar posts' },
        { status: 500 }
      )
    }

    if (format === 'json') {
      return NextResponse.json({
        posts: posts || [],
        exported_at: new Date().toISOString(),
        total: posts?.length || 0,
      })
    }

    if (format === 'csv') {
      const headers = [
        'ID',
        'Título',
        'Tópico',
        'Conteúdo',
        'Resumo',
        'Palavras-chave',
        'Tags',
        'Site',
        'URL do Post',
        'Data de Criação',
        'Status',
      ]

      const rows = (posts || []).map((post: any) => [
        post.id,
        post.title,
        post.topic || '',
        post.content?.replace(/\n/g, ' ').substring(0, 500) || '',
        post.excerpt || '',
        Array.isArray(post.keywords) ? post.keywords.join('; ') : '',
        Array.isArray(post.tags) ? post.tags.join('; ') : '',
        post.wordpress_sites?.name || '',
        post.wordpress_post_url || '',
        new Date(post.created_at).toLocaleString('pt-BR'),
        post.status || '',
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="posts-export-${Date.now()}.csv"`,
        },
      })
    }

    if (format === 'markdown') {
      const markdown = (posts || [])
        .map((post: any) => {
          return `# ${post.title}

**Tópico:** ${post.topic || 'N/A'}
**Site:** ${post.wordpress_sites?.name || 'N/A'}
**Data:** ${new Date(post.created_at).toLocaleString('pt-BR')}
**Status:** ${post.status || 'N/A'}

${post.excerpt ? `## Resumo\n\n${post.excerpt}\n\n` : ''}

## Conteúdo

${post.content || ''}

${Array.isArray(post.keywords) && post.keywords.length > 0 ? `\n**Palavras-chave:** ${post.keywords.join(', ')}\n` : ''}
${Array.isArray(post.tags) && post.tags.length > 0 ? `\n**Tags:** ${post.tags.join(', ')}\n` : ''}

${post.wordpress_post_url ? `\n[Ver post original](${post.wordpress_post_url})\n` : ''}

---

`
        })
        .join('\n')

      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="posts-export-${Date.now()}.md"`,
        },
      })
    }

    return NextResponse.json({ error: 'Formato não suportado' }, { status: 400 })
  } catch (error: any) {
    console.error('Erro ao exportar posts:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao exportar posts' },
      { status: 500 }
    )
  }
}
