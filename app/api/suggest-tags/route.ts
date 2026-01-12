import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { generateBlogContent } from '@/lib/openai'

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

    const { title, content, keywords } = await request.json()

    if (!title && !content) {
      return NextResponse.json(
        { error: 'Título ou conteúdo são necessários' },
        { status: 400 }
      )
    }

    // Buscar tags existentes do usuário para sugestões baseadas em histórico
    const { data: existingPosts } = await supabase
      .from('published_posts')
      .select('tags, keywords')
      .eq('user_id', session.user.id)
      .not('tags', 'is', null)
      .limit(100)

    const existingTags = new Set<string>()
    existingPosts?.forEach((post) => {
      if (Array.isArray(post.tags)) {
        post.tags.forEach((tag) => existingTags.add(tag))
      }
      if (Array.isArray(post.keywords)) {
        post.keywords.forEach((kw) => existingTags.add(kw))
      }
    })

    // Usar IA para sugerir tags baseadas no conteúdo
    const prompt = `Analise o seguinte conteúdo e sugira 5-10 tags relevantes para SEO e organização. 
    Retorne apenas uma lista de tags separadas por vírgula, sem numeração ou formatação adicional.
    
    Título: ${title || 'N/A'}
    Conteúdo: ${content ? content.substring(0, 1000) : 'N/A'}
    Palavras-chave existentes: ${Array.isArray(keywords) ? keywords.join(', ') : 'N/A'}
    
    Tags sugeridas:`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente especializado em SEO e organização de conteúdo. Sugira tags relevantes e concisas.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 100,
        }),
      })

      const data = await response.json()
      const suggestedTagsText = data.choices[0]?.message?.content || ''

      // Processar tags sugeridas
      const suggestedTags = suggestedTagsText
        .split(',')
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0 && tag.length < 50)
        .slice(0, 10)

      // Combinar com tags existentes do usuário (priorizar tags já usadas)
      const allSuggestions = [
        ...Array.from(existingTags).slice(0, 5), // Tags já usadas pelo usuário
        ...suggestedTags, // Novas tags sugeridas pela IA
      ]

      // Remover duplicatas e limitar
      const uniqueSuggestions = Array.from(new Set(allSuggestions)).slice(0, 15)

      return NextResponse.json({
        tags: uniqueSuggestions,
        existingTags: Array.from(existingTags).slice(0, 20),
      })
    } catch (error: any) {
      console.error('Erro ao gerar tags com IA:', error)
      
      // Fallback: usar palavras-chave e palavras do conteúdo
      const fallbackTags: string[] = []
      
      if (Array.isArray(keywords)) {
        fallbackTags.push(...keywords)
      }
      
      if (title) {
        const titleWords = title
          .toLowerCase()
          .split(/\s+/)
          .filter((word: string) => word.length > 3)
          .slice(0, 3)
        fallbackTags.push(...titleWords)
      }

      return NextResponse.json({
        tags: Array.from(new Set(fallbackTags)).slice(0, 10),
        existingTags: Array.from(existingTags).slice(0, 20),
      })
    }
  } catch (error: any) {
    console.error('Erro ao sugerir tags:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao sugerir tags' },
      { status: 500 }
    )
  }
}
