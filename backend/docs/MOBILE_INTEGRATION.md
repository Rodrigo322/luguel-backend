# Guia para Frontend Mobile

Este guia resume como integrar o app mobile com o backend atual.

## Base URL

- Local: `http://localhost:3333/api/v1`
- Swagger: `http://localhost:3333/docs`

## Autenticacao

O backend usa sessao com cookie HTTP.

Fluxo recomendado:

1. `POST /auth/signup` ou `POST /auth/signin`
2. manter cookie de sessao no cliente
3. validar usuario com `GET /auth/session`
4. renovar com `POST /auth/session/refresh` quando necessario
5. logout com `POST /auth/signout`

## Boot da Aplicacao Mobile

1. tentar restaurar sessao (`/auth/session`)
2. se 401, direcionar para tela de login
3. apos login, carregar dados do perfil (`/users/me`) e feed de anuncios (`/listings`)

## Fluxos Principais para o App

### Perfil

- `GET /users/me`
- `PATCH /users/me`
- `PATCH /users/me/role`

### Anuncios

- listar: `GET /listings`
- detalhe: `GET /listings/:listingId`
- criar: `POST /listings`
- editar: `PATCH /listings/:listingId`
- remover (soft): `DELETE /listings/:listingId`

### Locacoes

- solicitar: `POST /rentals`
- listar: `GET /rentals`
- detalhe: `GET /rentals/:rentalId`
- atualizar status: `PATCH /rentals/:rentalId/status`

### Reputacao e Denuncias

- review: `POST /reviews`
- report: `POST /reports`
- anexo report: `POST /reports/attachments`

### Impulsionamento

- `POST /boosts`

## Contrato de Erro

Em geral os erros seguem:

```json
{
  "error": "ErrorCode",
  "message": "Mensagem"
}
```

## Dicas de UI/UX para o Mobile

- Tratar `401` como sessao expirada.
- Tratar `403` como falta de permissao (role ou ownership).
- Tratar `429` como excesso de requisicoes e mostrar retry.
- Mostrar estados de anuncio:
  - `ACTIVE`
  - `PENDING_VALIDATION`
  - `FLAGGED`
  - `SUSPENDED`
  - `ARCHIVED`

## Observacoes Importantes

- Upload de denuncias atualmente valida arquivos, mas nao grava em storage final.
- Login Google depende de `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` configurados.
