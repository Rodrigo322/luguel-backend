# Luguel Backend

Backend da plataforma universal de aluguel com DDD, Fastify, Prisma, Better Auth e Swagger.

## Documentacao Completa

- [Indice Geral](./docs/INDEX.md)
- [Visao Geral e Status](./docs/PROJECT_STATUS.md)
- [Arquitetura DDD](./docs/ARCHITECTURE.md)
- [Setup e Execucao](./docs/SETUP_AND_RUN.md)
- [Deploy na Vercel](./docs/VERCEL_DEPLOY.md)
- [Referencia de API](./docs/API_REFERENCE.md)
- [Seguranca](./docs/SECURITY.md)
- [Testes](./docs/TESTS.md)
- [Guia para Frontend Mobile](./docs/MOBILE_INTEGRATION.md)

## Stack

- Node.js
- TypeScript
- Fastify
- Prisma + PostgreSQL
- Better Auth
- Swagger (OpenAPI)
- Zod
- Vitest + Supertest
- Redis
- Docker

## Endpoints Base

- API Health: `GET /api/v1/health`
- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs/json`

## Inicio Rapido

1. Instale dependencias:

```bash
npm install
```

2. Configure ambiente:

```bash
copy .env.example .env
```

3. Suba banco e redis:

```bash
docker compose up -d postgres redis
```

4. Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Rode API:

```bash
npm run dev
```

## Deploy Vercel com Banco Auto-Bootstrap

No deploy da Vercel, o comando `npm run vercel-build` executa automaticamente:

1. `prisma generate`
2. tentativa de criar o banco de producao (se necessario)
3. `prisma migrate deploy`
4. seed de admins (`prisma:seed:admins`)

Script usado: `prisma/bootstrap-production.cjs`.
Por padrao na Vercel, migrate/seed rodam apenas em `VERCEL_ENV=production` (preview so gera Prisma Client).

Variaveis recomendadas na Vercel:

- `DATABASE_URL` (obrigatoria)
- `DATABASE_ADMIN_URL` (opcional, usada para criar banco automaticamente)
- `DEPLOY_ENSURE_DATABASE=true`
- `DEPLOY_FAIL_ON_DB_CREATE_ERROR=false` (ou `true` para falhar hard se nao conseguir criar DB)
- `DEPLOY_PREPARE_ALWAYS=false` (use `true` para forcar migrate/seed tambem em preview)
- `ADMIN_SEED_EMAILS` e `ADMIN_SEED_PASSWORD` (ou `ADMIN_SEED_USERS`)

## Qualidade Atual

- 44 arquivos de teste
- 80 testes passando (`npm run test`)

## Licenca

MIT
