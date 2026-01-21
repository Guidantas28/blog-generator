import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface AgentConfig {
  system_prompt?: string | null
  content_prompt_template?: string | null
  tone?: string | null
  writing_style?: string | null
  target_audience?: string | null
  additional_instructions?: string | null
}

export async function generateBlogContent(
  topic: string,
  keywords: string[],
  ctaText?: string,
  ctaLink?: string,
  phoneNumber?: string,
  colors?: {
    cta_primary_color?: string
    cta_secondary_color?: string
    whatsapp_color?: string
    keywords_bg_color?: string
    keywords_text_color?: string
  },
  agentConfig?: AgentConfig
): Promise<{ title: string; content: string; excerpt: string }> {
  const keywordsText = keywords.join(', ')
  const ctaSection = ctaText && ctaLink 
    ? `\n\n[CTA]\n${ctaText}\nLink: ${ctaLink}\n[/CTA]` 
    : ''

  // Obter data atual formatada
  const now = new Date()
  const currentYear = now.getFullYear()
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const currentMonth = months[now.getMonth()]
  const currentDate = `${currentMonth} de ${currentYear}`

  // Construir prompt do sistema (usar personalizado ou padrão)
  const defaultSystemPrompt = `Você é um especialista em criação de conteúdo para blogs, SEO e marketing digital. 

⚠️ DATA ATUAL: ${currentDate} (${currentYear})

REGRAS OBRIGATÓRIAS:
- NUNCA mencione 2023, 2024 ou 2025 como ano atual
- Use APENAS dados e informações de ${currentYear}
- Todas as estatísticas, tendências e referências devem ser de ${currentYear}
- Se mencionar anos anteriores, deixe claro que são dados históricos

Sempre retorne JSON válido.`

  // Usar system_prompt personalizado se fornecido, senão usar o padrão
  // Verificar se existe e não está vazio
  const customSystemPrompt = agentConfig?.system_prompt
  const hasCustomSystemPrompt = customSystemPrompt && 
                                 typeof customSystemPrompt === 'string' &&
                                 customSystemPrompt.trim() !== '' &&
                                 customSystemPrompt !== 'null' &&
                                 customSystemPrompt !== 'undefined'
  
  let systemPrompt = hasCustomSystemPrompt ? customSystemPrompt.trim() : defaultSystemPrompt
  
  // Log para debug
  console.log('🔍 DEBUG SYSTEM PROMPT:', {
    hasAgentConfig: !!agentConfig,
    customSystemPromptRaw: customSystemPrompt,
    customSystemPromptType: typeof customSystemPrompt,
    customSystemPromptLength: customSystemPrompt?.length || 0,
    hasCustomSystemPrompt,
    willUseCustom: hasCustomSystemPrompt,
    systemPromptPreview: systemPrompt.substring(0, 200),
  })
  
  if (hasCustomSystemPrompt) {
    console.log('✅ USANDO system_prompt PERSONALIZADO')
    console.log('📝 System prompt completo:', customSystemPrompt)
  } else {
    console.log('⚠️ USANDO system_prompt PADRÃO')
    if (agentConfig?.system_prompt) {
      console.log('❌ System prompt fornecido mas rejeitado:', {
        value: agentConfig.system_prompt,
        type: typeof agentConfig.system_prompt,
        isEmpty: agentConfig.system_prompt.trim() === '',
        isNull: agentConfig.system_prompt === null,
        isUndefined: agentConfig.system_prompt === undefined,
      })
    }
  }
  
  // Adicionar informações de tom, estilo e público-alvo ao system prompt se fornecidos
  const toneInfo = agentConfig?.tone ? `\n\nTOM DE VOZ: ${agentConfig.tone}` : ''
  const styleInfo = agentConfig?.writing_style ? `\nESTILO DE ESCRITA: ${agentConfig.writing_style}` : ''
  const audienceInfo = agentConfig?.target_audience ? `\nPÚBLICO-ALVO: ${agentConfig.target_audience}` : ''
  const additionalInfo = agentConfig?.additional_instructions ? `\n\nINSTRUÇÕES ADICIONAIS:\n${agentConfig.additional_instructions}` : ''
  
  if (toneInfo || styleInfo || audienceInfo || additionalInfo) {
    systemPrompt += `${toneInfo}${styleInfo}${audienceInfo}${additionalInfo}`
  }

  // Construir prompt de conteúdo (usar template personalizado ou padrão)
  const defaultContentPrompt = `Crie um post de blog completo e profissional em português sobre "{topic}".

⚠️ ATENÇÃO CRÍTICA - DATA ATUAL: Estamos em ${currentDate} (${currentYear}).
- NUNCA mencione 2023, 2024 ou 2025 como se fossem o ano atual
- Use APENAS dados, estatísticas e informações de ${currentYear}
- Se precisar mencionar anos anteriores, deixe claro que são dados históricos/comparativos
- Todas as referências temporais devem ser para ${currentYear}
- Use expressões como "em ${currentYear}", "atualmente em ${currentYear}", "dados de ${currentYear}"

Palavras-chave para incluir: {keywords}

Requisitos:
- Título atrativo e otimizado para SEO
- Conteúdo bem estruturado com subtítulos (H2, H3)
- Parágrafos claros e informativos
- Inclua as palavras-chave de forma natural
- Seção de conclusão
- Use EXCLUSIVAMENTE informações atualizadas de ${currentYear}
- NUNCA use dados de anos anteriores (2023, 2024, 2025) como se fossem atuais
{ctaSection}

Formato de resposta (JSON):
{
  "title": "Título do post",
  "content": "Conteúdo completo em HTML com tags <h2>, <h3>, <p>, etc.",
  "excerpt": "Resumo curto de 150 caracteres"
}`

  let contentPrompt = agentConfig?.content_prompt_template || defaultContentPrompt
  
  // Substituir variáveis no template
  contentPrompt = contentPrompt
    .replace(/{topic}/g, topic)
    .replace(/{keywords}/g, keywordsText)
    .replace(/{currentYear}/g, String(currentYear))
    .replace(/{currentDate}/g, currentDate)
    .replace(/{ctaSection}/g, ctaSection ? '- Inclua o CTA fornecido no final do post' : '')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: contentPrompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const response = JSON.parse(completion.choices[0].message.content || '{}')
  
  // Validar e corrigir referências a anos antigos no conteúdo gerado
  if (response.content) {
    const oldYears = ['2023', '2024', '2025']
    const currentYearStr = String(currentYear)
    
    // Substituir referências a anos antigos que parecem ser o ano atual
    oldYears.forEach(oldYear => {
      // Padrões que indicam que o ano está sendo usado como "atual" (mais agressivo)
      const patterns = [
        // Padrões temporais comuns
        new RegExp(`\\b(em|no|de|para|até|durante|ao longo de|em todo|ao longo|até o final de|desde|a partir de)\\s+${oldYear}\\b`, 'gi'),
        // Padrões com dados/estatísticas
        new RegExp(`\\b(estatísticas|dados|informações|tendências|previsões|números|resultados|pesquisas|estudos)\\s+(de|do|da|em)\\s+${oldYear}\\b`, 'gi'),
        // Padrões com verbos temporais
        new RegExp(`\\b${oldYear}\\s+(é|será|foi|está|estava|seria|seria|representa|mostra|indica)\\b`, 'gi'),
        // Padrões com "ano"
        new RegExp(`\\b(ano|anos)\\s+(de|do|da)\\s+${oldYear}\\b`, 'gi'),
        // Padrões com "em 202X"
        new RegExp(`\\bem\\s+${oldYear}\\b`, 'gi'),
      ]
      
      patterns.forEach(pattern => {
        response.content = response.content.replace(pattern, (match: string) => {
          return match.replace(new RegExp(oldYear, 'g'), currentYearStr)
        })
      })
      
      // Substituição mais agressiva: qualquer menção isolada de ano antigo (exceto em contexto histórico claro)
      const historicalContext = /(comparação|histórico|passado|anterior|antes|desde|até|entre|período)/i
      const isolatedYearPattern = new RegExp(`\\b${oldYear}\\b(?!\\s*(?:a|e|ou|,|;|:|\\.|\\s))`, 'gi')
      
      response.content = response.content.replace(isolatedYearPattern, (match: string, offset: number) => {
        // Verificar contexto antes e depois para ver se é histórico
        const before = response.content.substring(Math.max(0, offset - 50), offset)
        const after = response.content.substring(offset, Math.min(response.content.length, offset + 50))
        const context = before + after
        
        // Se não há contexto histórico claro, substituir
        if (!historicalContext.test(context)) {
          return currentYearStr
        }
        return match
      })
    })
    
    // Log de aviso se ainda houver anos antigos
    oldYears.forEach(year => {
      const regex = new RegExp(`\\b${year}\\b`, 'i')
      if (regex.test(response.content)) {
        console.warn(`⚠️ Aviso: Conteúdo ainda contém referência a ${year}. Ano atual: ${currentYear}`)
      }
    })
  }
  
  // Validar e corrigir título e excerpt também
  if (response.title) {
    const oldYears = ['2023', '2024', '2025']
    const currentYearStr = String(currentYear)
    oldYears.forEach(oldYear => {
      response.title = response.title.replace(new RegExp(`\\b${oldYear}\\b`, 'gi'), currentYearStr)
    })
  }
  
  if (response.excerpt) {
    const oldYears = ['2023', '2024', '2025']
    const currentYearStr = String(currentYear)
    oldYears.forEach(oldYear => {
      response.excerpt = response.excerpt.replace(new RegExp(`\\b${oldYear}\\b`, 'gi'), currentYearStr)
    })
  }
  
  // Cores padrão ou personalizadas
  const ctaPrimaryColor = colors?.cta_primary_color || '#667eea'
  const ctaSecondaryColor = colors?.cta_secondary_color || '#764ba2'
  const whatsappColor = colors?.whatsapp_color || '#25D366'
  const keywordsBgColor = colors?.keywords_bg_color || '#1e3a8a'
  const keywordsTextColor = colors?.keywords_text_color || '#ffffff'
  
  // Processar CTA se fornecido - formato botão destacado
  // Garantir que o CTA seja sempre inserido no final do conteúdo se fornecido
  if (ctaText && ctaLink && response.content) {
    // Garantir que o link seja válido (adicionar https:// se não tiver protocolo)
    let validCtaLink = ctaLink.trim()
    if (!validCtaLink.startsWith('http://') && !validCtaLink.startsWith('https://')) {
      // Se for um número de telefone (apenas dígitos), criar link do WhatsApp
      if (/^\d+$/.test(validCtaLink.replace(/\D/g, ''))) {
        validCtaLink = `https://wa.me/${validCtaLink.replace(/\D/g, '')}`
      } else {
        // Adicionar https:// por padrão
        validCtaLink = `https://${validCtaLink}`
      }
    }
    
    const ctaHtml = `<div style="background: linear-gradient(135deg, ${ctaPrimaryColor} 0%, ${ctaSecondaryColor} 100%); padding: 30px; margin: 40px 0; border-radius: 12px; text-align: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);">
      <a href="${validCtaLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #ffffff; color: ${ctaPrimaryColor}; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 18px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);">
        ${ctaText}
      </a>
    </div>`
    
    // Primeiro, tentar substituir marcadores [CTA] se existirem
    response.content = response.content.replace('[CTA]', ctaHtml).replace(/\[CTA\].*?\[\/CTA\]/s, ctaHtml)
    
    // Se o CTA não foi inserido (não havia marcador), adicionar no final do conteúdo
    if (!response.content.includes(ctaHtml)) {
      response.content = response.content + ctaHtml
    }
  }

  // Adicionar telefone no rodapé se fornecido
  if (phoneNumber && response.content) {
    // Remover caracteres não numéricos do telefone
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    
    if (cleanPhone.length >= 10) {
      // Formatar telefone para exibição
      let formattedPhone = cleanPhone
      if (cleanPhone.length === 11) {
        // Formato: (XX) XXXXX-XXXX
        formattedPhone = cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
      } else if (cleanPhone.length === 10) {
        // Formato: (XX) XXXX-XXXX
        formattedPhone = cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
      } else if (cleanPhone.length >= 12) {
        // Formato internacional: +XX (XX) XXXXX-XXXX
        formattedPhone = cleanPhone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4')
      }
      
      const whatsappLink = `https://wa.me/${cleanPhone}`
      
      const phoneFooter = `<div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center; border-top: 2px solid ${ctaPrimaryColor};">
        <p style="margin: 0; color: #333; font-size: 16px;">
          <strong>Entre em contato:</strong><br>
          <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" style="color: ${whatsappColor}; text-decoration: none; font-weight: 600;">
            📱 WhatsApp: ${formattedPhone}
          </a>
        </p>
      </div>`
      
      response.content = response.content + phoneFooter
    }
  }

  // Adicionar palavras-chave no final do conteúdo se houver
  if (keywords && keywords.length > 0) {
    const keywordsHtml = `<div style="margin-top: 40px; padding: 20px 0;">
      <h3 style="color: #333; font-size: 20px; font-weight: 600; margin-bottom: 15px;">Palavras-chave:</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 10px;">
        ${keywords.map(keyword => 
          `<span style="background: ${keywordsBgColor}; color: ${keywordsTextColor}; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 500; display: inline-block;">${keyword}</span>`
        ).join('')}
      </div>
    </div>`
    
    response.content = response.content + keywordsHtml
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

