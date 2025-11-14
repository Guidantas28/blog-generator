import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateBlogContent(
  topic: string,
  keywords: string[],
  ctaText?: string,
  ctaLink?: string
): Promise<{ title: string; content: string; excerpt: string }> {
  const keywordsText = keywords.join(', ')
  const ctaSection = ctaText && ctaLink 
    ? `\n\n[CTA]\n${ctaText}\nLink: ${ctaLink}\n[/CTA]` 
    : ''

  const prompt = `Crie um post de blog completo e profissional em português sobre "${topic}".

Palavras-chave para incluir: ${keywordsText}

Requisitos:
- Título atrativo e otimizado para SEO
- Conteúdo bem estruturado com subtítulos (H2, H3)
- Parágrafos claros e informativos
- Inclua as palavras-chave de forma natural
- Seção de conclusão
${ctaSection ? '- Inclua o CTA fornecido no final do post' : ''}

Formato de resposta (JSON):
{
  "title": "Título do post",
  "content": "Conteúdo completo em HTML com tags <h2>, <h3>, <p>, etc.",
  "excerpt": "Resumo curto de 150 caracteres"
}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em criação de conteúdo para blogs, SEO e marketing digital. Sempre retorne JSON válido.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const response = JSON.parse(completion.choices[0].message.content || '{}')
  
  // Processar CTA se fornecido - formato botão destacado
  if (ctaText && ctaLink && response.content) {
    const ctaHtml = `<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; margin: 40px 0; border-radius: 12px; text-align: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);">
      <a href="${ctaLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #ffffff; color: #667eea; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 18px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);">
        ${ctaText}
      </a>
    </div>`
    response.content = response.content.replace('[CTA]', ctaHtml).replace(/\[CTA\].*?\[\/CTA\]/s, ctaHtml)
  }

  return {
    title: response.title || topic,
    content: response.content || '',
    excerpt: response.excerpt || '',
  }
}

export async function generateKeywords(topic: string): Promise<string[]> {
  const prompt = `Gere 10 palavras-chave relevantes e otimizadas para SEO sobre o tema "${topic}".

As palavras-chave devem ser:
- Relevantes ao tema
- Com bom volume de busca
- Mistura de palavras-chave de cauda longa e curta
- Em português brasileiro

Retorne um objeto JSON com uma propriedade "keywords" que seja um array de strings.
Exemplo: {"keywords": ["palavra-chave 1", "palavra-chave 2", "palavra-chave 3"]}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em SEO. Retorne apenas um array JSON válido.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  })

  try {
    const content = completion.choices[0].message.content || '{}'
    const response = JSON.parse(content)
    
    // Garantir que sempre retorne um array
    if (Array.isArray(response)) {
      return response
    } else if (Array.isArray(response.keywords)) {
      return response.keywords
    } else if (typeof response === 'object' && response !== null) {
      // Tentar extrair array de qualquer propriedade
      const arrayValue = Object.values(response).find(v => Array.isArray(v))
      return Array.isArray(arrayValue) ? arrayValue : []
    }
    return []
  } catch (error) {
    console.error('Erro ao parsear resposta do OpenAI:', error)
    return []
  }
}

