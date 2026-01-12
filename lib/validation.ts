/**
 * Schemas de validação com Zod
 * Validação e sanitização de entrada para todas as APIs
 */

import { z } from 'zod'

/**
 * Schema para validação de URL WordPress
 */
export const wordPressUrlSchema = z
  .string()
  .url('URL inválida')
  .refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    'URL deve começar com http:// ou https://'
  )
  .transform((url) => url.replace(/\/$/, '')) // Remove trailing slash

/**
 * Schema para validação de site WordPress
 */
export const wordPressSiteSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome muito longo')
    .trim(),
  url: wordPressUrlSchema,
  username: z
    .string()
    .min(1, 'Username é obrigatório')
    .max(100, 'Username muito longo')
    .trim(),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .max(500, 'Senha muito longa'),
  cta_text: z.string().max(200, 'Texto do CTA muito longo').optional().nullable(),
  cta_link: z.string().url('Link do CTA inválido').optional().nullable(),
  phone_number: z
    .string()
    .regex(/^[\d\s\(\)\-\+]+$/, 'Número de telefone inválido')
    .max(20, 'Número de telefone muito longo')
    .optional()
    .nullable(),
})

/**
 * Schema para validação de geração de conteúdo
 */
export const generateContentSchema = z.object({
  topic: z
    .string()
    .min(1, 'Tópico é obrigatório')
    .max(500, 'Tópico muito longo')
    .trim(),
  keywords: z
    .array(z.string().min(1).max(100))
    .min(1, 'Pelo menos uma palavra-chave é necessária')
    .max(20, 'Muitas palavras-chave'),
  ctaText: z.string().max(200).optional().nullable(),
  ctaLink: z.string().url().optional().nullable(),
  phoneNumber: z
    .string()
    .regex(/^[\d\s\(\)\-\+]+$/)
    .max(20)
    .optional()
    .nullable(),
  colors: z.object({
    cta_primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    cta_secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    whatsapp_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    keywords_bg_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    keywords_text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  }).optional().nullable(),
})

/**
 * Schema para validação de publicação de post
 */
export const publishPostSchema = z.object({
  siteId: z.string().uuid('ID do site inválido'),
  topic: z.string().min(1).max(500).optional(),
  title: z
    .string()
    .min(1, 'Título é obrigatório')
    .max(200, 'Título muito longo')
    .trim(),
  content: z
    .string()
    .min(100, 'Conteúdo muito curto (mínimo 100 caracteres)')
    .max(50000, 'Conteúdo muito longo'),
  excerpt: z.string().max(500).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  keywords: z.array(z.string()).optional(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
  focusKeyword: z.string().max(100).optional().nullable(),
  ctaText: z.string().max(200).optional().nullable(),
  ctaLink: z.string().url().optional().nullable(),
})

/**
 * Sanitiza HTML removendo scripts e tags perigosas
 */
export function sanitizeHtml(html: string): string {
  try {
    // Sanitização básica (em produção, considere usar DOMPurify)
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, '')
  } catch (error) {
    console.error('Erro ao sanitizar HTML:', error)
    return html
  }
}

/**
 * Valida e sanitiza dados de entrada
 */
export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error }
    }
    throw error
  }
}
