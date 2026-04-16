# Luguel Backend

Backend da plataforma universal de aluguel, seguindo arquitetura DDD e stack oficial:

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

## Configuração

1. Copie variáveis de ambiente:

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

4. Rode migrações (quando existirem):

```bash
npm run prisma:migrate
```

5. Inicie a API:

```bash
npm run dev
```

## Endpoints base

- `GET /api/v1/health`
- Swagger: `GET /docs`

## Endpoints de domínio (inicial)

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/signin`
- `POST /api/v1/auth/signout`
- `GET /api/v1/auth/session`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me/role`
- `POST /api/v1/listings`
- `GET /api/v1/listings`
- `GET /api/v1/listings/:listingId`
- `POST /api/v1/rentals`
- `PATCH /api/v1/rentals/:rentalId/status`
- `POST /api/v1/reviews`
- `POST /api/v1/reports`
- `GET /api/v1/admin/reports/critical`
- `POST /api/v1/admin/listings/:listingId/suspend`
- `POST /api/v1/boosts`

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

## Persistência

- `PERSISTENCE_DRIVER=prisma` (padrão fora de teste): usa PostgreSQL via Prisma.
- `PERSISTENCE_DRIVER=memory` (padrão em testes): usa store em memória para execução isolada.

## Estado atual do fluxo obrigatório

Etapas concluídas nesta entrega:

1. Setup do projeto
2. Configuração base (Fastify, Prisma, Docker)
3. Sistema de autenticação (Better Auth + sessão + role)
4. Usuários
5. Anúncios
6. Sistema de risco/validação
7. Locações
8. Avaliações
9. Denúncias
10. Admin
11. Impulsionamento

Observação: os módulos já suportam persistência com Prisma/PostgreSQL e também modo em memória para testes isolados.
