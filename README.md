# Sinal AI Sales OS — Build Pack v1

Pacote executável derivado do PRD v1.0 do Sinal AI Sales OS. Objetivo: permitir que Claude Code ou uma equipe de engenharia iniciem o MVP sem reinterpretar regras essenciais de negócio.

## Ordem de leitura
1. `CLAUDE.md`
2. `docs/IMPLEMENTATION_GUIDE.md`
3. `prisma/schema.prisma`
4. `openapi/openapi.yaml`
5. `packages/domain/src/state-machines.ts`
6. `packages/policies/src/policy-engine.ts`
7. `packages/ai/src/schemas/agents.ts`
8. `packages/ai/prompts/`
9. `n8n/specs/`
10. `backlog/backlog.md`
11. `tests/evals/dataset.jsonl`

## Princípios não negociáveis
- HubSpot é o System of Record comercial.
- PostgreSQL é o operational intelligence store.
- n8n orquestra integrações; não contém a lógica central de autorização/estado.
- Todo claim externo específico precisa de `Evidence` ou `KnowledgeItem` aprovado.
- Fato, inferência e recomendação são entidades distintas.
- Primeiro contato é Yellow no MVP.
- Eventos Red nunca podem ser liberados automaticamente por agente.
- Qualquer inbound pausa a sequência antes de novo outbound.
- Opt-out gera suppression imediata.
- Todo side effect externo exige `PolicyDecision` + idempotency key.

## Artefatos
- Prisma schema completo do MVP
- OpenAPI 3.1 inicial
- State machines em TypeScript
- Policy engine inicial em TypeScript
- Schemas Zod/JSON contracts para 16 agentes
- Prompts de produção v1 para os 16 agentes
- Especificação detalhada dos 16 workflows n8n
- CLAUDE.md operacional
- Estrutura de repositório
- Backlog em tickets priorizados
- Dataset inicial de 60 avaliações de IA
- Config defaults e `.env.example`

## Observação
Este pack é uma especificação de engenharia inicial. Integrações reais (HubSpot, e-mail, calendário, Apify e provedores de IA) devem ser configuradas com credenciais de sandbox e validadas contra documentação oficial antes de produção.

## Desenvolvimento local
```bash
cp .env.example .env   # preencher DATABASE_URL/REDIS_URL/SEED_ADMIN_* locais
pnpm install
pnpm db:generate
pnpm db:migrate         # requer Postgres ativo (DATABASE_URL)
pnpm db:seed            # cria o usuário ADMIN inicial a partir de SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD
pnpm lint
pnpm typecheck
pnpm test
pnpm dev                # abrir http://localhost:3000/login e entrar com o admin criado pelo seed
```

A migration inicial (`prisma/migrations/20260811000000_init`) foi gerada offline com
`prisma migrate diff --from-empty --to-schema-datamodel`, pois o ambiente de build não tinha
Postgres disponível. Rode `pnpm db:migrate` contra um banco de dev real para aplicar e validar
rollback antes de considerar BP-002 concluído em produção.

## Teste E2E da jornada canônica (BP-044)
`apps/worker/src/e2e/canonical-journey.test.ts` encadeia as funções reais de `packages/db`
(discover → research → approval → send → reply → SQL → meeting) contra um Postgres real, usando
apenas adapters stub para o mundo externo (lead provider, email, calendário). Ele é pulado
automaticamente quando `DATABASE_URL` não está configurado (como neste ambiente de build) — para
rodá-lo de fato:
```bash
DATABASE_URL=postgres://... pnpm --filter @sinal/worker test
```

A migration `20260811010000_enrollment_one_active_per_contact` adiciona um índice único parcial
(`WHERE state = 'ACTIVE'`) que a DSL do Prisma não expressa diretamente — ela também precisa ser
aplicada manualmente via `pnpm db:migrate` e validada contra Postgres real antes de produção.

A migration `20260811020000_add_user` adiciona o model `User` (login/sessão da UI). Foi escrita
manualmente (sem shadow database disponível para `prisma migrate diff --from-migrations`) e
conferida contra a saída completa de `prisma migrate diff --from-empty` antes de ser commitada.
