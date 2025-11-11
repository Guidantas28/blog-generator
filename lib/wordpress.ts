export interface WordPressSite {
  id?: string
  user_id: string
  name: string
  url: string
  username: string
  password: string // Será criptografado
  created_at?: string
}

export interface WordPressPost {
  title: string
  content: string
  excerpt?: string
  featured_media?: number
  status?: 'publish' | 'draft'
  meta?: {
    _yoast_wpseo_title?: string
    _yoast_wpseo_metadesc?: string
    _yoast_wpseo_focuskw?: string
  }
}

export async function createWordPressPost(
  site: WordPressSite,
  post: WordPressPost
): Promise<{ id: number; link: string }> {
  // Criar credenciais básicas para autenticação WordPress REST API
  const credentials = btoa(`${site.username}:${site.password}`)
  
  const response = await fetch(`${site.url}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
    },
    body: JSON.stringify({
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      status: post.status || 'publish',
      featured_media: post.featured_media,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Erro ao criar post no WordPress: ${error}`)
  }

  const data = await response.json()

  // Se o site usar Yoast SEO, atualizar os meta campos
  if (post.meta && Object.keys(post.meta).length > 0) {
    await updateWordPressPostMeta(site, data.id, post.meta)
  }

  return {
    id: data.id,
    link: data.link,
  }
}

export async function uploadImageToWordPress(
  site: WordPressSite,
  imageBlob: Blob,
  filename: string
): Promise<number> {
  const credentials = btoa(`${site.username}:${site.password}`)
  
  const formData = new FormData()
  formData.append('file', imageBlob, filename)

  const response = await fetch(`${site.url}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Erro ao fazer upload da imagem: ${error}`)
  }

  const data = await response.json()
  return data.id
}

async function updateWordPressPostMeta(
  site: WordPressSite,
  postId: number,
  meta: Record<string, string>
): Promise<void> {
  const credentials = btoa(`${site.username}:${site.password}`)
  
  // Para Yoast SEO, usar a API do Yoast ou atualizar via meta fields
  // Primeiro, tentar atualizar via meta fields do WordPress
  try {
    const response = await fetch(`${site.url}/wp-json/wp/v2/posts/${postId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        meta,
      }),
    })

    if (!response.ok) {
      // Se falhar, tentar via Yoast SEO REST API (se disponível)
      const yoastResponse = await fetch(
        `${site.url}/wp-json/yoast/v1/posts/${postId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`,
          },
          body: JSON.stringify({
            yoast_meta: {
              yoast_wpseo_title: meta._yoast_wpseo_title,
              yoast_wpseo_metadesc: meta._yoast_wpseo_metadesc,
              yoast_wpseo_focuskw: meta._yoast_wpseo_focuskw,
            },
          }),
        }
      )

      if (!yoastResponse.ok) {
        console.warn('Aviso: Não foi possível atualizar meta campos SEO. O plugin Yoast SEO pode não estar instalado.')
      }
    }
  } catch (error) {
    console.warn('Aviso: Erro ao atualizar meta campos SEO:', error)
  }
}

export function validateWordPressSite(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

