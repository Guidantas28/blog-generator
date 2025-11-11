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

