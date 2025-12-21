export async function searchImages(query: string, count: number = 5): Promise<string[]> {
  try {
    // Usando Unsplash API
    const accessKey = process.env.UNSPLASH_ACCESS_KEY || process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY
    
    if (!accessKey) {
      // Fallback para Pexels se Unsplash não estiver configurado
      return searchPexelsImages(query, count)
    }

    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          'Authorization': `Client-ID ${accessKey}`,
        },
      }
    )

    if (!response.ok) {
      return searchPexelsImages(query, count)
    }

    const data = await response.json()
    return data.results?.map((photo: any) => photo.urls.regular) || []
  } catch (error) {
    console.error('Erro ao buscar imagens do Unsplash:', error)
    return searchPexelsImages(query, count)
  }
}

async function searchPexelsImages(query: string, count: number = 5): Promise<string[]> {
  try {
    const apiKey = process.env.PEXELS_API_KEY || process.env.NEXT_PUBLIC_PEXELS_API_KEY
    
    if (!apiKey) {
      // Fallback para placeholder se nenhuma API estiver configurada
      return []
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          'Authorization': apiKey,
        },
      }
    )

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.photos?.map((photo: any) => photo.src.large) || []
  } catch (error) {
    console.error('Erro ao buscar imagens do Pexels:', error)
    return []
  }
}

export async function downloadImage(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Erro ao baixar imagem')
  }
  return await response.blob()
}

/**
 * Gera múltiplas queries variadas para busca de imagens
 */
export async function generateImageQueries(topic: string, keywords: string[] = []): Promise<string[]> {
  const queries: string[] = []
  
  // Query principal baseada no tópico
  queries.push(topic)
  
  // Adicionar variações do tópico
  const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (topicWords.length > 1) {
    queries.push(topicWords.slice(0, 2).join(' ')) // Primeiras 2 palavras
    queries.push(topicWords.slice(0, 3).join(' ')) // Primeiras 3 palavras
  }
  
  // Adicionar keywords relevantes
  if (keywords.length > 0) {
    // Pegar até 4 keywords mais relevantes
    const relevantKeywords = keywords.slice(0, 4).filter(k => k && k.length > 3)
    for (const keyword of relevantKeywords) {
      queries.push(keyword)
      // Combinar keyword com tópico
      if (topicWords.length > 0) {
        queries.push(`${keyword} ${topicWords[0]}`)
        if (topicWords.length > 1) {
          queries.push(`${keyword} ${topicWords[0]} ${topicWords[1]}`)
        }
      }
    }
  }
  
  // Adicionar variações com termos relacionados (mais diversidade)
  const variations = [
    `${topic} conceito`,
    `${topic} profissional`,
    `${topic} moderno`,
    `${topic} tecnologia`,
    `${topic} negócio`,
    `${topic} estratégia`,
  ]
  queries.push(...variations)
  
  // Adicionar variações sem o tópico completo (apenas palavras-chave principais)
  if (topicWords.length > 0) {
    queries.push(topicWords[0]) // Primeira palavra do tópico
    if (topicWords.length > 1) {
      queries.push(`${topicWords[0]} ${topicWords[1]}`)
    }
  }
  
  // Remover duplicatas, normalizar e limitar
  const normalizedQueries = [...new Set(queries)]
    .map(q => q.trim().toLowerCase())
    .filter(q => q.length > 2)
  
  return [...new Set(normalizedQueries)].slice(0, 12)
}

/**
 * Busca imagens com diversidade, evitando repetições
 * @param topic - Tópico do post
 * @param keywords - Palavras-chave do post
 * @param usedImageUrls - URLs de imagens já usadas (opcional)
 * @param minCount - Número mínimo de imagens para buscar
 */
export async function searchDiverseImages(
  topic: string,
  keywords: string[] = [],
  usedImageUrls: string[] = [],
  minCount: number = 1
): Promise<string | null> {
  try {
    // Gerar múltiplas queries variadas
    const queries = await generateImageQueries(topic, keywords)
    
    // Buscar imagens de múltiplas queries
    const allImages: string[] = []
    const searchedQueries = new Set<string>()
    
    for (const query of queries) {
      if (searchedQueries.has(query.toLowerCase())) continue
      searchedQueries.add(query.toLowerCase())
      
      try {
        // Buscar mais imagens por query para ter mais opções
        const images = await searchImages(query, 10)
        allImages.push(...images)
        
        // Se já temos imagens suficientes, podemos parar
        if (allImages.length >= 20) break
      } catch (error) {
        console.warn(`Erro ao buscar imagens com query "${query}":`, error)
        // Continuar com próxima query
      }
    }
    
    if (allImages.length === 0) {
      return null
    }
    
    // Remover duplicatas
    const uniqueImages = [...new Set(allImages)]
    
    // Filtrar imagens já usadas
    const unusedImages = uniqueImages.filter(img => !usedImageUrls.includes(img))
    
    // Selecionar aleatoriamente
    const imagesToChooseFrom = unusedImages.length > 0 ? unusedImages : uniqueImages
    
    if (imagesToChooseFrom.length === 0) {
      return null
    }
    
    // Selecionar aleatoriamente entre as imagens disponíveis
    const randomIndex = Math.floor(Math.random() * imagesToChooseFrom.length)
    return imagesToChooseFrom[randomIndex]
  } catch (error) {
    console.error('Erro ao buscar imagens diversas:', error)
    // Fallback: buscar com query simples
    try {
      const images = await searchImages(topic, 10)
      if (images.length > 0) {
        const randomIndex = Math.floor(Math.random() * images.length)
        return images[randomIndex]
      }
    } catch (fallbackError) {
      console.error('Erro no fallback de busca de imagens:', fallbackError)
    }
    return null
  }
}

