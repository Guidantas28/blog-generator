# Blog Post Platform

Plataforma completa para criar e publicar posts em blogs WordPress com integração de IA, SEO e gerenciamento de múltiplos sites.

## Funcionalidades

- ✅ Autenticação com Supabase
- ✅ Gerenciamento de sites WordPress (até 3 por usuário)
- ✅ Geração de conteúdo com ChatGPT
- ✅ Busca automática de palavras-chave para SEO
- ✅ Busca de imagens de APIs públicas (Unsplash/Pexels)
- ✅ Configuração de CTA personalizado com link do WhatsApp
- ✅ Publicação automática no WordPress com SEO

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env.local` baseado no `.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
OPENAI_API_KEY=sua_chave_da_openai
UNSPLASH_ACCESS_KEY=sua_chave_do_unsplash
# OU
PEXELS_API_KEY=sua_chave_do_pexels
```

## Tecnologias Utilizadas

- **Next.js 14** - Framework React
- **TypeScript** - Tipagem estática
- **Supabase** - Backend e autenticação
- **OpenAI** - Geração de conteúdo
- **Unsplash/Pexels** - API de imagens
- **Tailwind CSS** - Estilização
- **WordPress REST API** - Publicação de posts

## Segurança

⚠️ **Importante**: As senhas do WordPress são armazenadas em Base64 apenas como exemplo. Em produção, use uma biblioteca de criptografia adequada como `crypto-js` ou armazene as credenciais de forma mais segura.

## Licença

MIT
