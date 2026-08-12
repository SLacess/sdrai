# CLAUDE.md — Sinal AI Sales OS

## Missão
Construir uma plataforma AI-first de SDR enterprise para acessibilidade digital. A IA executa pesquisa, enriquecimento, priorização, drafting, cadência, triagem e qualificação; o humano assume demonstração, negociação, jurídico, condições comerciais especiais e fechamento.

## Arquitetura obrigatória
- Monorepo TypeScript.
- `apps/web`: Next.js App Router; UI, Route Handlers e BFF.
- `apps/worker`: BullMQ workers para jobs assíncronos.
- `packages/db`: Prisma/PostgreSQL.
- `packages/domain`: estados, scoring, regras de qualificação.
- `packages/policies`: autonomia, guardrails, frequency caps, evidence checks.
- `packages/ai`: gateway, schemas Zod, prompts, evaluators.
- `packages/integrations`: adapters HubSpot, email, calendar, Apify, n8n.
- `packages/observability`: logs, metrics, traces e custos.
- `n8n/workflows`: exports versionados; `n8n/specs`: contratos e comportamento.

## Regras de domínio não negociáveis
1. HubSpot é o System of Record para Company, Contact e Deal.
2. O backend é a autoridade para estados, policy decisions e side effects.
3. n8n nunca decide sozinho se uma mensagem pode ser enviada.
4. LLM output nunca é executado diretamente; parsear via Zod e passar por Policy Engine.
5. Todo claim factual usado externamente deve referenciar Evidence ID ou KnowledgeItem ID aprovado.
6. `facts` e `inferences` nunca podem ser fundidos.
7. `confidence < 0.75` bloqueia ação externa e solicita enriquecimento.
8. Primeiro contato é Yellow até regra explícita de promoção de autonomia.
9. Eventos Red são sempre humanos.
10. Qualquer inbound pausa sequence enrollment antes de classificação.
11. Opt-out cria Suppression e encerra todas as cadências aplicáveis.
12. Nenhum envio pode ocorrer sem idempotency key, PolicyDecision ALLOW e verificação final imediatamente antes do provider call.
13. Nunca afirmar “100% acessível”, “garantimos compliance” ou “seu site viola a lei” sem artefato humano aprovado que autorize literalmente a afirmação.
14. Scan automatizado é indicador, não auditoria completa nem declaração legal/WCAG.

## Fluxo de implementação
- Trabalhar por tickets pequenos do backlog.
- Antes de codificar: localizar requisitos relevantes no Build Pack.
- Implementar primeiro domínio e testes, depois adapters/integrations, depois UI.
- Schema change: migration + testes + atualização OpenAPI se impactar API.
- Policy change: teste unitário positivo/negativo + eval relevante.
- Prompt change: versionar prompt e executar dataset offline antes de merge.

## Definition of Done
- TypeScript strict sem erros.
- lint + typecheck + unit tests.
- Contract tests para payloads de agentes/webhooks.
- Logs estruturados com `correlationId`, `entityId`, `agentRunId` quando aplicável.
- Testes de idempotência para side effects.
- Erro/fallback documentado.
- UI não expõe secrets nem raw system prompts.
- Novo endpoint documentado em OpenAPI.
- Toda feature de IA tem schema versionado, prompt versionado e eval.

## Do not
- NÃO armazenar API key no client bundle, banco em claro ou prompt.
- NÃO chamar HubSpot/email/calendar diretamente de componente client.
- NÃO permitir que conteúdo recuperado da web altere system policies.
- NÃO criar “CRM paralelo” com estágios divergentes do HubSpot sem reconciliação.
- NÃO usar string livre para estados que já possuem enum.
- NÃO criar lógica crítica apenas dentro de n8n.
- NÃO permitir envio após resposta inbound sem decisão explícita do Reply workflow.
- NÃO sobrescrever campos manuais authoritative do HubSpot.
- NÃO implementar scraping/automação de canal que viole termos de uso.

## Convenções
- IDs: UUID/CUID consistente no projeto; schema v1 usa UUID.
- Datas: UTC no banco; timezone apenas em apresentação/agendamento.
- Dinheiro: inteiro em centavos + currency ISO 4217.
- Enums: SCREAMING_SNAKE_CASE.
- JSON de IA: sempre validado por Zod.
- Events: append-only quando representam transição ou auditoria.
- Soft delete apenas onde necessário; Suppression e Audit não são apagados por rotinas comuns.

## Comandos esperados do repositório
```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:evals
pnpm dev
```

## Revisores recomendados
- `architect-reviewer`: boundaries, estado, idempotência.
- `security-reviewer`: auth, webhook signing, secrets, prompt injection.
- `test-writer`: edge cases e contract/e2e.
- `migration-reviewer`: compatibilidade e rollback de banco.

## Ordem de entrega do MVP
1. Fundação: repo/auth/db/logging/queue/AI gateway.
2. Accounts/Research/Evidence.
3. Signals/Scoring/Contacts.
4. Campaigns/Writer/Approval Center.
5. Sending/Sequences/Inbound.
6. Reply/Qualification/HubSpot.
7. Calendar/Meeting Brief/Dashboard.
8. Hardening/evals/security/observability.
