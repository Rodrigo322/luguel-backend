# Luguel Backend

Backend da plataforma universal de aluguel com DDD, Fastify, Prisma, Better Auth e Swagger.

## Documentacao Completa

- [Indice Geral](./docs/INDEX.md)
- [Visao Geral e Status](./docs/PROJECT_STATUS.md)
- [Arquitetura DDD](./docs/ARCHITECTURE.md)
- [Setup e Execucao](./docs/SETUP_AND_RUN.md)
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

## Qualidade Atual

- 44 arquivos de teste
- 80 testes passando (`npm run test`)

## Licenca

MIT
