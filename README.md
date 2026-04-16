# Luguel Backend

Backend da plataforma universal de aluguel, seguindo arquitetura DDD e stack oficial.

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

## Estrutura DDD

```text
src/
  domain/
  application/
  infra/
  interfaces/
  shared/
```

## Requisitos

- Node.js 20+
- Docker + Docker Compose

## Configuracao

1. Copie variaveis de ambiente:

```bash
cp .env.example .env
```

2. Suba banco e redis:

```bash
docker compose up -d postgres redis
```

3. Gere o client Prisma:

```bash
npm run prisma:generate
```

4. Aplique as migrations:

```bash
npm run prisma:migrate
```

5. Inicie a API:

```bash
npm run dev
```

## Endpoints base

- `GET /api/v1/health`
- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs/json`

## Endpoints de dominio

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/signin`
- `POST /api/v1/auth/signout`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/session/refresh`
- `POST /api/v1/auth/password/forgot`
- `POST /api/v1/auth/password/reset`
- `GET /api/v1/auth/social/google`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `PATCH /api/v1/users/me/role`
- `DELETE /api/v1/users/me`
- `GET /api/v1/users` (admin)
- `GET /api/v1/users/:userId` (admin)
- `POST /api/v1/listings`
- `GET /api/v1/listings`
- `GET /api/v1/listings/:listingId`
- `PATCH /api/v1/listings/:listingId`
- `DELETE /api/v1/listings/:listingId`
- `POST /api/v1/rentals`
- `GET /api/v1/rentals`
- `GET /api/v1/rentals/:rentalId`
- `PATCH /api/v1/rentals/:rentalId/status`
- `POST /api/v1/reviews`
- `POST /api/v1/reports`
- `POST /api/v1/reports/attachments` (upload seguro)
- `GET /api/v1/admin/reports/critical`
- `PATCH /api/v1/admin/reports/:reportId/status`
- `POST /api/v1/admin/listings/:listingId/suspend`
- `POST /api/v1/admin/listings/:listingId/archive`
- `POST /api/v1/admin/users/:userId/ban`
- `POST /api/v1/boosts`

## Seguranca implementada

- Better Auth com sessao e login social Google
- Rate limit global com Redis (fallback seguro em erro de rede)
- Validacao de entrada com Zod
- RBAC por role (`LOCADOR`, `LOCATARIO`, `ADMIN`)
- Headers de seguranca com Helmet
- Protecao anti upload malicioso:
  - limite de tamanho
  - allowlist de tipos/extensoes
  - bloqueio de extensoes executaveis
  - validacao de assinatura de arquivo
- Auditoria de eventos criticos em logs estruturados

## Persistencia

- `PERSISTENCE_DRIVER=prisma` (padrao fora de testes): PostgreSQL via Prisma
- `NODE_ENV=test`: store em memoria forcado para isolamento de testes

## Migrations

- Migration inicial versionada em `prisma/migrations/20260416100000_init`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:deploy`

## Testes

- Suite completa com `80` testes automatizados (unitarios, integracao e E2E).
