import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Pesquisa tendências do mercado baseado na categoria do negócio
 */
export async function researchMarketTrends(
  businessCategory: string
): Promise<string[]> {
  const prompt = `Você é um especialista em marketing digital e análise de tendências.

Com base na categoria de negócio "${businessCategory}", identifique as 5 principais tendências e tópicos relevantes que estão em alta no momento e que seriam interessantes para criar conteúdo de blog.

Considere:
- Tendências atuais do mercado
- Tópicos que geram engajamento
- Assuntos relevantes para o público-alvo dessa categoria
- Oportunidades de conteúdo que podem gerar tráfego

Retorne um objeto JSON com uma propriedade "trends" que seja um array de strings, onde cada string é um tópico/tendência específica.
Exemplo: {"trends": ["Tendência 1", "Tendência 2", "Tendência 3"]}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content:
            'Você é um especialista em marketing digital. Retorne apenas um objeto JSON válido com a propriedade "trends" contendo um array de strings.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const content = completion.choices[0].message.content || '{}'
    const response = JSON.parse(content)

    if (Array.isArray(response.trends)) {
      return response.trends
    } else if (Array.isArray(response)) {
      return response
    }

    return []
  } catch (error) {
    console.error('Erro ao pesquisar tendências:', error)
    return []
  }
}

/**
 * Seleciona a melhor imagem baseado no tópico usando IA
 */
export async function selectBestImageTopic(topic: string): Promise<string> {
  const prompt = `Com base no tópico "${topic}", sugira uma palavra-chave ou frase curta (máximo 3 palavras) que seria ideal para buscar uma imagem relacionada.

A resposta deve ser apenas a palavra-chave/frase, sem explicações adicionais.
Exemplo: "marketing digital" ou "tecnologia inovação"`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content:
            'Você é um especialista em busca de imagens. Retorne apenas a palavra-chave ou frase curta para busca de imagem.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 20,
    })

    const imageQuery =
      completion.choices[0].message.content?.trim() || topic
    return imageQuery
  } catch (error) {
    console.error('Erro ao selecionar tópico de imagem:', error)
    return topic
  }
}

