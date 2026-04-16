# Referencia de API

Base path: `/api/v1`

## Convencoes

- Auth baseada em sessao (cookie Better Auth).
- Resposta de erro padrao:

```json
{
  "error": "ErrorCode",
  "message": "Human readable message"
}
```

## System

- `GET /health`

## Auth

- `POST /auth/signup`
- `POST /auth/signin`
- `POST /auth/signout`
- `GET /auth/session`
- `POST /auth/session/refresh`
- `POST /auth/password/forgot`
- `POST /auth/password/reset`
- `GET /auth/social/google`

### Regras importantes de Auth

- `signin` nao revela se usuario existe.
- `password/forgot` sempre responde com sucesso generico para evitar enumeracao.

## Users

- `GET /users/me` (autenticado)
- `PATCH /users/me` (autenticado)
- `PATCH /users/me/role` (autenticado)
- `DELETE /users/me` (autenticado)
- `GET /users` (admin)
- `GET /users/:userId` (admin)

## Listings

- `POST /listings` (autenticado)
- `GET /listings`
  - query opcional: `ownerId`, `status`
- `GET /listings/:listingId`
- `PATCH /listings/:listingId` (owner/admin)
- `DELETE /listings/:listingId` (owner/admin, soft delete -> `ARCHIVED`)

## Rentals

- `POST /rentals` (roles: `LOCATARIO` ou `ADMIN`)
- `GET /rentals` (autenticado; admin ve todas)
- `GET /rentals/:rentalId` (tenant, owner ou admin)
- `PATCH /rentals/:rentalId/status` (owner/admin)

Transicoes permitidas:

- `REQUESTED -> APPROVED | CANCELED`
- `APPROVED -> ACTIVE | CANCELED`
- `ACTIVE -> COMPLETED | CANCELED`

## Reviews

- `POST /reviews` (autenticado)

## Reports

- `POST /reports` (autenticado)
- `POST /reports/attachments` (autenticado, multipart)

## Admin

- `GET /admin/reports/critical`
- `PATCH /admin/reports/:reportId/status`
- `POST /admin/users/:userId/ban`
- `POST /admin/listings/:listingId/suspend`
- `POST /admin/listings/:listingId/archive`

Todos os endpoints admin exigem role `ADMIN`.

## Boost

- `POST /boosts` (roles: `LOCADOR` ou `ADMIN`)

## Swagger

- UI: `/docs`
- OpenAPI JSON: `/docs/json`

A referencia detalhada de request/response schema esta no OpenAPI gerado automaticamente.
