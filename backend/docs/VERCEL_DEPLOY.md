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
- `DATABASE_ADMIN_URL=<url-admin-postgres-opcional-para-criar-db>`
- `REDIS_URL=<sua-url-redis>`
- `BETTER_AUTH_SECRET=<segredo-com-32+-chars>`
- `BETTER_AUTH_URL=https://<seu-dominio-vercel>`
- `PASSWORD_RESET_REDIRECT_URL=https://<url-frontend>/reset-password`
- `GOOGLE_CLIENT_ID` (opcional, para login social)
- `GOOGLE_CLIENT_SECRET` (opcional, para login social)
- `ADMIN_EMAILS=<emails-admin-separados-por-virgula>`
- `UPLOAD_MAX_SIZE_MB=5` (ou outro valor <= 20)
- `DEPLOY_ENSURE_DATABASE=true`
- `DEPLOY_FAIL_ON_DB_CREATE_ERROR=false` (ou `true` para bloquear deploy sem criacao de DB)
- `DEPLOY_PREPARE_ALWAYS=false` (default: migrate/seed apenas em production)
- `ADMIN_SEED_EMAILS=admin@luguel.dev,moderator@luguel.dev` (ou `ADMIN_SEED_USERS`)
- `ADMIN_SEED_PASSWORD=<senha-forte>`

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

## Bootstrap Automatico de Banco no Deploy

O comando de build da Vercel (`npm run vercel-build`) executa o bootstrap:

1. `npm run prisma:generate`
2. tentativa de criar banco de producao (quando `DEPLOY_ENSURE_DATABASE=true`)
3. `npm run prisma:deploy`
4. `npm run prisma:seed:admins`

Arquivo responsavel: `prisma/bootstrap-production.cjs`.

Observacao: por padrao na Vercel, migrate/seed rodam somente em `VERCEL_ENV=production`.

## Validacao Pos Deploy

Teste os endpoints principais:

- `GET /api/v1/health`
- `GET /docs`
- `GET /docs/json`

Valide autenticacao:

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/signin`
- `GET /api/v1/auth/session`

Execute homologacao automatizada:

```bash
SMOKE_BASE_URL=https://luguel-backend.vercel.app \
SMOKE_ADMIN_EMAIL=admin@luguel.dev \
SMOKE_ADMIN_PASSWORD='***' \
npm run smoke:production
```

Para homologacao completa com escrita (cria/remove dados de teste):

```bash
SMOKE_BASE_URL=https://luguel-backend.vercel.app \
SMOKE_ADMIN_EMAIL=admin@luguel.dev \
SMOKE_ADMIN_PASSWORD='***' \
SMOKE_ALLOW_DESTRUCTIVE=true \
npm run smoke:production:destructive
```

Workflow de gate no GitHub Actions:

- `.github/workflows/backend-release-gate.yml`
- jobs: `backend-quality` + `backend-production-smoke`

## Observacoes

- O modulo de recuperacao de senha no codigo atual usa callback em memoria para testes.
  - Para producao, conecte envio real de email no `sendResetPassword`.
- Upload de anexos esta validando seguranca, mas sem persistencia final em storage dedicado.
