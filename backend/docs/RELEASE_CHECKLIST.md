# Release Checklist (Operacional)

Este checklist define o gate de release do backend antes e depois do deploy.

## 1. Pre-release (local ou CI)

1. Instalar dependencias:

```bash
npm ci
```

2. Build obrigatorio:

```bash
npm run build
```

3. Testes obrigatorios:

```bash
npm run test
```

4. (Opcional) suites separadas:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

## 2. Deploy

Deploy na Vercel usando `npm run vercel-build` (bootstrap de banco + migrate + seed de admins em producao).

## 3. Post-deploy (homologacao em producao)

### Modo recomendado (somente leitura)

```bash
SMOKE_BASE_URL=https://luguel-backend.vercel.app \
SMOKE_ADMIN_EMAIL=admin@luguel.dev \
SMOKE_ADMIN_PASSWORD='***' \
npm run smoke:production
```

### Modo destrutivo controlado (com cleanup automatico)

Use apenas em janela controlada, pois cria e remove dados de teste:

```bash
SMOKE_BASE_URL=https://luguel-backend.vercel.app \
SMOKE_ADMIN_EMAIL=admin@luguel.dev \
SMOKE_ADMIN_PASSWORD='***' \
SMOKE_ALLOW_DESTRUCTIVE=true \
npm run smoke:production:destructive
```

## 4. GitHub Actions release gate

Workflow: `.github/workflows/backend-release-gate.yml`

- `backend-quality`:
  - `npm ci`
  - `npm run build`
  - `npm run test`
- `backend-production-smoke`:
  - roda em `push` para `master/main` e `workflow_dispatch`
  - executa homologacao em producao no modo `readonly` por padrao
  - aceita `destructive` somente via `workflow_dispatch`

Secrets obrigatorios do repositório:

- `SMOKE_BASE_URL`
- `SMOKE_ADMIN_EMAIL`
- `SMOKE_ADMIN_PASSWORD`

Opcional:

- `SMOKE_TEST_PASSWORD` (usado no modo destrutivo)

## 5. Critério de aceite para release

- Build e testes 100% passando.
- Homologacao `readonly` em producao passando.
- Em releases críticas: homologacao `destructive` passando com cleanup confirmado.
