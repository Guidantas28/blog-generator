# GitHub Actions Workflows

Este diretório contém os workflows automatizados do projeto.

## Workflows Configurados

### 1. `generate-pending-posts-weekly.yml`
**Geração Semanal de Posts Pendentes**

- **Quando executa**: Todo domingo às 00:00 (horário de Brasília)
- **Cron**: `0 3 * * 0` (03:00 UTC = 00:00 BRT)
- **O que faz**: 
  - Gera 3 posts pendentes de aprovação
  - Posts são agendados para publicação no domingo seguinte (7 dias depois)
  - Específico para Global Investimentos

### 2. `publish-scheduled-posts.yml`
**Publicação de Posts Agendados**

- **Quando executa**: A cada hora
- **Cron**: `0 * * * *`
- **O que faz**:
  - Publica posts agendados normais (`/api/publish-scheduled-post`)
  - Publica posts aprovados da Global (`/api/publish-approved-posts`)

### 3. `automation.yml`
**Execução de Automações**

- **Quando executa**: Diariamente às 09:00 (horário de Brasília)
- **Cron**: `0 12 * * *` (12:00 UTC = 09:00 BRT)
- **O que faz**: Executa automações configuradas para gerar e publicar conteúdo

## Configuração de Secrets

Para que os workflows funcionem, configure os seguintes secrets no GitHub:

1. Vá em **Settings** → **Secrets and variables** → **Actions**
2. Adicione os seguintes secrets:

### `APP_URL`
URL completa da sua aplicação (sem barra no final)
```
https://seu-dominio.com
```

### `CRON_SECRET`
Chave secreta para autenticação das APIs (mesma do `.env`)
```
sua-chave-secreta-aqui
```

## Execução Manual

Todos os workflows podem ser executados manualmente:

1. Vá em **Actions** no GitHub
2. Selecione o workflow desejado
3. Clique em **Run workflow** no lado direito
4. Selecione a branch (geralmente `main`)
5. Clique em **Run workflow**

## Horários de Execução

### Fuso Horário
Os workflows estão configurados para horário de Brasília (BRT/BRST):
- UTC-3 (horário padrão)
- UTC-2 (horário de verão)

### Ajuste de Horário
Se precisar ajustar os horários, edite o campo `cron` nos arquivos `.yml`:

```yaml
# Formato: minuto hora dia mês dia-da-semana
# 0 = domingo, 1 = segunda, etc.

# Domingo às 00:00 BRT = 03:00 UTC
- cron: '0 3 * * 0'

# A cada hora = 00:00, 01:00, 02:00... (UTC)
- cron: '0 * * * *'
```

**Conversão BRT → UTC**: Adicione 3 horas (ou 2 no horário de verão)

## Troubleshooting

### Workflow não executa
- Verifique se os secrets estão configurados
- Verifique se o cron está no formato correto
- Verifique os logs em **Actions** → **Workflow runs**

### Erro de autenticação
- Verifique se `CRON_SECRET` está correto
- Verifique se `APP_URL` está correto (sem barra no final)
- Verifique se a variável `CRON_SECRET` está configurada no `.env` da aplicação

### Posts não são gerados
- Verifique se há automações ativas no banco de dados
- Verifique os logs da API em **Actions** → **Workflow runs**
- Execute manualmente para testar
