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

### 3. Configurar Supabase

Execute o seguinte SQL no Supabase SQL Editor:

```sql
-- Tabela de sites WordPress
CREATE TABLE wordpress_sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de configurações do usuário
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  default_cta_text TEXT,
  default_cta_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE wordpress_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para wordpress_sites
CREATE POLICY "Users can view their own sites"
  ON wordpress_sites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sites"
  ON wordpress_sites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sites"
  ON wordpress_sites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sites"
  ON wordpress_sites FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para user_settings
CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Constraint para limitar 3 sites por usuário
CREATE OR REPLACE FUNCTION check_site_limit()
RETURNS TRIGGER AS $$
DECLARE
  site_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO site_count
  FROM wordpress_sites
  WHERE user_id = NEW.user_id;
  
  IF site_count >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 sites por usuário atingido';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_site_limit
  BEFORE INSERT ON wordpress_sites
  FOR EACH ROW
  EXECUTE FUNCTION check_site_limit();
```

### 4. Configurar WordPress

Para cada site WordPress, você precisa criar uma **Application Password**:

1. Acesse: `Usuários → Seu Perfil → Application Passwords`
2. Crie uma nova senha de aplicativo
3. Use essa senha ao cadastrar o site na plataforma

### 5. Executar o projeto

```bash
npm run dev
```

Acesse `http://localhost:3000`

## Estrutura do Projeto

```
blog-post/
├── app/
│   ├── api/              # API Routes
│   ├── auth/             # Página de autenticação
│   ├── dashboard/        # Dashboard principal
│   └── layout.tsx        # Layout raiz
├── components/           # Componentes React
├── lib/                  # Utilitários e integrações
│   ├── openai.ts        # Integração ChatGPT
│   ├── wordpress.ts     # Integração WordPress
│   ├── images.ts        # Busca de imagens
│   └── supabase.ts      # Cliente Supabase
└── README.md
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

