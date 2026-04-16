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

## Estado atual do fluxo obrigatório

Etapas concluídas nesta entrega:

1. Setup do projeto
2. Configuração base (Fastify, Prisma, Docker)

Próxima etapa recomendada: sistema de autenticação com Better Auth + login social Google + autorização por role.
