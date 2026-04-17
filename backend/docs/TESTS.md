# Testes

## Stack de Testes

- Vitest
- Supertest

## Estrutura

- `tests/unit`
- `tests/integration`
- `tests/e2e`

## Estado Atual

- 44 arquivos de teste
- 80 testes passando
- Cobertura distribuida por regras de dominio, casos de uso, rotas HTTP e fluxos completos

## Como Rodar

Executar todos:

```bash
npm run test
```

Somente unitarios:

```bash
npm run test:unit
```

Somente integracao:

```bash
npm run test:integration
```

Somente E2E:

```bash
npm run test:e2e
```

## Configuracao de Ambiente de Teste

- Arquivo: `tests/setup-env.ts`
- Configura:
  - `NODE_ENV=test`
  - `PERSISTENCE_DRIVER=memory`
  - valores default de auth para isolamento

## Escopo Coberto

- Regras de negocio por modulo (domain services)
- Fluxos criticos:
  - criacao/atualizacao de anuncio com risco
  - fluxo completo de locacao e avaliacao
  - moderacao admin
  - auth e recuperacao de senha
- Seguranca:
  - headers
  - rate limit
  - upload seguro
- Documentacao:
  - exposicao do OpenAPI em `/docs/json`

## Boas praticas para novos testes

- Para regra de negocio: preferir teste unitario no dominio/caso de uso.
- Para contrato HTTP: usar integracao com Supertest.
- Para jornadas completas: usar E2E combinando multiplas rotas.
