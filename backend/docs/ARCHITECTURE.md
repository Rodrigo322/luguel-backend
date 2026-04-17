# Arquitetura DDD

## Camadas

A estrutura segue DDD com separacao clara de responsabilidades:

```text
src/
  domain/
  application/
  infra/
  interfaces/
  shared/
```

- `domain`: entidades, tipos de risco e regras de negocio puras.
- `application`: casos de uso que orquestram dominio + persistencia.
- `infra`: implementacoes tecnicas (Prisma, memoria, Redis, logs).
- `interfaces`: HTTP/Fastify, schemas Zod, Swagger e guardas de auth.
- `shared`: configuracao de ambiente e tipos compartilhados.

## Mapa de Modulos

### Users

- Casos de uso:
  - `updateCurrentUserProfile`
  - `listUsersFlow`
  - `deleteCurrentUser`
- Regras de dominio:
  - validacao de nome
  - bloqueio de auto-remocao de admin

### Auth

- Better Auth para signup/signin/signout/sessao.
- Recuperacao de senha (request + reset).
- Login social Google (quando variaveis de ambiente estao configuradas).

### Listings

- Casos de uso:
  - `createListing`
  - `updateListing`
  - `archiveListing`
- Regras de dominio:
  - controle de escrita por dono/admin
  - validacao de preco diario
  - status automatico por risco (`PENDING_VALIDATION` para risco alto/critico)

### Rentals

- Casos de uso:
  - `requestRental`
  - `listRentals`
  - `getRentalDetails`
  - `updateRentalStatusFlow`
- Regras de dominio:
  - periodo valido
  - sem auto-locacao
  - transicoes validas de status
  - controle de leitura (tenant, owner ou admin)

### Reviews

- Caso de uso:
  - `createReview`
- Regras de dominio:
  - rating entre 1 e 5
  - somente locacao concluida
  - reviewer deve participar da locacao

### Reports

- Caso de uso:
  - `createReport`
- Regras de dominio:
  - alvo obrigatorio (listing ou rental)
  - classificacao de risco por texto
- Regra automatica:
  - com 3+ denuncias abertas no anuncio, status vai para `PENDING_VALIDATION`.

### Admin

- Casos de uso:
  - `listCriticalReports`
  - `reviewReport`
  - `banUserFlow`
  - `suspendCriticalListing`
  - `archiveListingByAdmin`
- Regras de dominio:
  - intervencao critica
  - moderacao de anuncios
  - validacao de status de revisao

### Boost

- Caso de uso:
  - `createBoost`
- Regras de dominio:
  - acesso por owner/admin
  - pagamento confirmado
  - valor e duracao validos

## Persistencia

A fachada `src/infra/persistence/in-memory-store.ts` escolhe o driver:

- `memory` (forcado em teste)
- `prisma` (padrao fora de teste)

Tabela principal:

- Users
- Listings
- Rentals
- Reviews
- Reports
- AdminAuditLog
- Boost
- RiskAssessment
- tabelas Better Auth (`Session`, `Account`, `Verification`)

## Ciclo de Request HTTP

1. Fastify recebe request em `interfaces/http/routes/*`.
2. Zod valida body/params/query.
3. Guarda de auth/roles valida acesso (quando necessario).
4. Caso de uso em `application/*` executa regras de dominio e persistencia.
5. Rota serializa resposta e registra evento de auditoria.

## Erros

- Erros de dominio usam `DomainError` com `code` e `statusCode`.
- Erros de validacao de schema retornam `ValidationError` (400).
- Erros inesperados retornam `InternalServerError` (500).
