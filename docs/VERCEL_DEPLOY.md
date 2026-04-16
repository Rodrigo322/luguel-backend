# Deploy na Vercel

Este projeto ja esta preparado para deploy serverless na Vercel.

## Arquivos de Deploy

- `api/index.ts`: handler serverless que inicializa o Fastify uma vez por instancia.
- `vercel.json`: roteia todas as rotas para o handler.
- `.vercelignore`: reduz arquivos enviados no deploy.

## Pre-requisitos

- Conta Vercel
- Banco PostgreSQL acessivel publicamente (ou via rede suportada)
- Redis (opcional, recomendado em producao para rate-limit distribuido)

## Variaveis de Ambiente na Vercel

Defina no projeto Vercel:

- `NODE_ENV=production`
- `PERSISTENCE_DRIVER=prisma`
- `DATABASE_URL=<sua-url-postgres>`
- `REDIS_URL=<sua-url-redis>`
- `BETTER_AUTH_SECRET=<segredo-com-32+-chars>`
- `BETTER_AUTH_URL=https://<seu-dominio-vercel>`
- `PASSWORD_RESET_REDIRECT_URL=https://<url-frontend>/reset-password`
- `GOOGLE_CLIENT_ID` (opcional, para login social)
- `GOOGLE_CLIENT_SECRET` (opcional, para login social)
- `ADMIN_EMAILS=<emails-admin-separados-por-virgula>`
- `UPLOAD_MAX_SIZE_MB=5` (ou outro valor <= 20)

## Fluxo Recomendado

1. Link do projeto:

```bash
vercel link
```

2. Subir env vars:

```bash
vercel env add DATABASE_URL
vercel env add REDIS_URL
vercel env add BETTER_AUTH_SECRET
vercel env add BETTER_AUTH_URL
vercel env add PASSWORD_RESET_REDIRECT_URL
vercel env add ADMIN_EMAILS
```

3. Deploy preview:

```bash
vercel
```

4. Deploy producao:

```bash
vercel --prod
```

## Migracoes Prisma

A Vercel nao deve rodar migracao automaticamente em toda requisicao.

Use um passo de release/deploy para executar:

```bash
npm run prisma:deploy
```

## Validacao Pos Deploy

Teste os endpoints principais:

- `GET /api/v1/health`
- `GET /docs`
- `GET /docs/json`

Valide autenticacao:

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/signin`
- `GET /api/v1/auth/session`

## Observacoes

- O modulo de recuperacao de senha no codigo atual usa callback em memoria para testes.
  - Para producao, conecte envio real de email no `sendResetPassword`.
- Upload de anexos esta validando seguranca, mas sem persistencia final em storage dedicado.
