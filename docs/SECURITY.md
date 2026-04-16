# Seguranca

## Controles Implementados

## 1) Autenticacao

- Better Auth para sessao, signup/signin/signout.
- Login social Google (quando configurado).
- Recuperacao de senha via endpoints dedicados.

## 2) Autorizacao (RBAC)

Roles suportadas:

- `LOCADOR`
- `LOCATARIO`
- `ADMIN`

Controle aplicado por guardas de role nas rotas.

## 3) Validacao de Entrada

- Zod em body, params e query de todas as rotas publicadas.
- Falhas retornam `ValidationError` (400).

## 4) Rate Limit e Protecao de Abuso

- `@fastify/rate-limit` global.
- Janela atual: 100 requests por minuto por chave de IP.
- Suporte a Redis fora de teste.
- Handler de 404 tambem passa por rate-limit.

## 5) Headers de Seguranca

- `@fastify/helmet` global.

## 6) Protecao contra Enumeracao

- `signin` responde erro generico para credenciais invalidas.
- `password/forgot` responde sempre mensagem neutra.

## 7) Upload Seguro

No endpoint `/reports/attachments`:

- limite de tamanho configuravel (`UPLOAD_MAX_SIZE_MB`)
- allowlist de extensoes e mime types
- bloqueio de extensoes executaveis
- validacao por assinatura binaria (magic bytes)
- hash `sha256` do conteudo

## 8) Auditoria

Eventos relevantes sao logados (auth, criacao, moderacao, bloqueios).

## 9) Regras de Risco

- Analise automatica de risco em anuncios.
- Status automatico para `PENDING_VALIDATION` em risco alto/critico.
- Denuncias repetidas podem levar anuncio para validacao.
- Admin atua em cenarios criticos.

## Pontos de Atencao (estado atual)

- O fluxo de reset de senha usa callback de envio em memoria no backend atual.
  - Para producao, integrar provider real de email.
- O endpoint de anexo valida arquivo, mas nao persiste em storage ainda.
- O impulsionamento valida pagamento por flag (`paymentConfirmed`), sem gateway integrado ainda.
