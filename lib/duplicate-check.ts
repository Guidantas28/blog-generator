import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Calcula similaridade entre duas strings usando Jaccard similarity
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/))
  const words2 = new Set(str2.toLowerCase().split(/\s+/))
  
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  return intersection.size / union.size
}

/**
 * Verifica se um tópico/título é similar a posts anteriores
 */
export async function checkDuplicateTopic(
  supabase: SupabaseClient,
  siteId: string,
  topic: string,
  title?: string,
  similarityThreshold: number = 0.5
): Promise<{ isDuplicate: boolean; similarPosts: Array<{ title: string; topic: string; created_at: string }> }> {
  try {
    // Buscar posts publicados do mesmo site
    const { data: publishedPosts, error: publishedError } = await supabase
      .from('published_posts')
      .select('title, topic, created_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(50) // Verificar últimos 50 posts

    // Buscar rascunhos automáticos do mesmo site
    const { data: draftPosts, error: draftError } = await supabase
      .from('automated_posts')
      .select('title, topic, created_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (publishedError || draftError) {
      console.warn('Erro ao buscar posts anteriores:', publishedError || draftError)
      // Em caso de erro, retornar como não duplicado para não bloquear
      return { isDuplicate: false, similarPosts: [] }
    }

    const allPosts = [
      ...(publishedPosts || []),
      ...(draftPosts || []),
    ]

    const similarPosts: Array<{ title: string; topic: string; created_at: string }> = []
    const topicLower = topic.toLowerCase()
    const titleLower = title?.toLowerCase() || ''

    for (const post of allPosts) {
      const postTopicLower = (post.topic || '').toLowerCase()
      const postTitleLower = (post.title || '').toLowerCase()

      // Verificar similaridade com o tópico
      const topicSimilarity = calculateSimilarity(topicLower, postTopicLower)
      
      // Verificar similaridade com o título (se fornecido)
      let titleSimilarity = 0
      if (titleLower && postTitleLower) {
        titleSimilarity = calculateSimilarity(titleLower, postTitleLower)
      }

      // Se qualquer similaridade for alta, considerar duplicado
      if (topicSimilarity >= similarityThreshold || titleSimilarity >= similarityThreshold) {
        similarPosts.push({
          title: post.title || '',
          topic: post.topic || '',
          created_at: post.created_at || '',
        })
      }
    }

    return {
      isDuplicate: similarPosts.length > 0,
      similarPosts,
    }
  } catch (error) {
    console.error('Erro ao verificar duplicatas:', error)
    // Em caso de erro, retornar como não duplicado para não bloquear
    return { isDuplicate: false, similarPosts: [] }
  }
}

/**
 * Filtra tendências removendo aquelas que são similares a posts anteriores
 */
export async function filterDuplicateTrends(
  supabase: SupabaseClient,
  siteId: string,
  trends: string[],
  similarityThreshold: number = 0.5
): Promise<string[]> {
  const filteredTrends: string[] = []

  for (const trend of trends) {
    const { isDuplicate } = await checkDuplicateTopic(supabase, siteId, trend, undefined, similarityThreshold)
    if (!isDuplicate) {
      filteredTrends.push(trend)
    }
  }

  return filteredTrends
}

