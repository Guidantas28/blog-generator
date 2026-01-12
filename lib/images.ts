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
 * Normaliza uma URL de imagem removendo parâmetros de query para comparação
 * Exemplo: "https://example.com/image.jpg?w=800&h=600" -> "https://example.com/image.jpg"
 */
function normalizeImageUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // Remover todos os parâmetros de query
    urlObj.search = ''
    return urlObj.toString()
  } catch {
    // Se não for uma URL válida, tentar remover parâmetros manualmente
    return url.split('?')[0].split('#')[0]
  }
}

/**
 * Verifica se uma URL de imagem já foi usada, comparando URLs normalizadas
 */
function isImageUsed(imageUrl: string, usedImageUrls: string[]): boolean {
  const normalized = normalizeImageUrl(imageUrl)
  return usedImageUrls.some(used => normalizeImageUrl(used) === normalized)
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
 * @param maxRetries - Número máximo de tentativas para encontrar uma imagem única
 */
export async function searchDiverseImages(
  topic: string,
  keywords: string[] = [],
  usedImageUrls: string[] = [],
  minCount: number = 1,
  maxRetries: number = 3
): Promise<string | null> {
  // Normalizar URLs já usadas para comparação
  const normalizedUsedUrls = usedImageUrls.map(url => normalizeImageUrl(url))
  
  // Tentar múltiplas vezes para garantir que encontramos uma imagem
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Gerar múltiplas queries variadas
      const queries = await generateImageQueries(topic, keywords)
      
      // Buscar imagens de múltiplas queries
      const allImages: string[] = []
      const searchedQueries = new Set<string>()
      
      // Aumentar número de imagens por query em tentativas subsequentes
      const imagesPerQuery = 10 + (attempt * 5)
      
      for (const query of queries) {
        if (searchedQueries.has(query.toLowerCase())) continue
        searchedQueries.add(query.toLowerCase())
        
        try {
          // Buscar mais imagens por query para ter mais opções
          const images = await searchImages(query, imagesPerQuery)
          if (images && images.length > 0) {
            allImages.push(...images)
          }
          
          // Se já temos imagens suficientes, podemos parar
          if (allImages.length >= 50) break
        } catch (error) {
          console.warn(`Erro ao buscar imagens com query "${query}":`, error)
          // Continuar com próxima query
        }
      }
      
      if (allImages.length === 0) {
        // Se não encontrou imagens, tentar fallback simples
        if (attempt < maxRetries - 1) {
          console.warn(`Tentativa ${attempt + 1} não encontrou imagens. Tentando novamente...`)
          continue
        }
        // Última tentativa: buscar com query simples
        try {
          const fallbackImages = await searchImages(topic, 20)
          if (fallbackImages && fallbackImages.length > 0) {
            allImages.push(...fallbackImages)
          }
        } catch (fallbackError) {
          console.error('Erro no fallback de busca de imagens:', fallbackError)
        }
        
        if (allImages.length === 0) {
          console.error('Não foi possível encontrar imagens após todas as tentativas')
          return null
        }
      }
      
      // Remover duplicatas baseado em URLs normalizadas
      const seenNormalized = new Set<string>()
      const uniqueImages: string[] = []
      
      for (const img of allImages) {
        const normalized = normalizeImageUrl(img)
        if (!seenNormalized.has(normalized)) {
          seenNormalized.add(normalized)
          uniqueImages.push(img)
        }
      }
      
      // Filtrar imagens já usadas usando comparação normalizada
      const unusedImages = uniqueImages.filter(img => !isImageUsed(img, normalizedUsedUrls))
      
      // Selecionar aleatoriamente
      const imagesToChooseFrom = unusedImages.length > 0 ? unusedImages : uniqueImages
      
      if (imagesToChooseFrom.length === 0) {
        // Se todas as imagens foram usadas, tentar novamente com mais queries
        if (attempt < maxRetries - 1) {
          console.warn(`Todas as imagens encontradas já foram usadas. Tentando novamente...`)
          continue
        }
        // Na última tentativa, usar qualquer imagem disponível mesmo que já tenha sido usada
        // (melhor ter uma imagem repetida do que nenhuma)
        if (uniqueImages.length > 0) {
          console.warn('Usando imagem que pode ter sido usada anteriormente (melhor que nenhuma)')
          const randomIndex = Math.floor(Math.random() * uniqueImages.length)
          return uniqueImages[randomIndex]
        }
        return null
      }
      
      // Selecionar aleatoriamente entre as imagens disponíveis
      const randomIndex = Math.floor(Math.random() * imagesToChooseFrom.length)
      const selectedImage = imagesToChooseFrom[randomIndex]
      
      console.log(`Imagem selecionada com sucesso (tentativa ${attempt + 1}/${maxRetries})`)
      return selectedImage
    } catch (error) {
      console.error(`Erro ao buscar imagens diversas (tentativa ${attempt + 1}):`, error)
      if (attempt === maxRetries - 1) {
        // Última tentativa: fallback simples
        try {
          const images = await searchImages(topic, 20)
          if (images && images.length > 0) {
            const randomIndex = Math.floor(Math.random() * images.length)
            console.warn('Usando fallback simples para buscar imagem')
            return images[randomIndex]
          }
        } catch (fallbackError) {
          console.error('Erro no fallback final de busca de imagens:', fallbackError)
        }
        return null
      }
    }
  }
  
  return null
}
