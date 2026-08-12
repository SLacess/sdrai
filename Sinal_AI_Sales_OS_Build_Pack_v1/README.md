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
