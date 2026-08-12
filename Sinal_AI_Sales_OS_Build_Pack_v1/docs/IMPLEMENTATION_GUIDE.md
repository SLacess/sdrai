# Guia de implementação — Build Pack v1

## 1. Objetivo operacional
O sistema deve multiplicar a capacidade comercial pessoal do closer: manter alto volume no topo e meio inicial do funil, mas entregar ao humano apenas SQLs contextualizados, demos, reuniões estratégicas, negociação e fechamento.

## 2. Boundaries
**Backend/domain:** estados, policy engine, scoring, qualificação, idempotência, audit.  
**n8n:** schedules, chamadas a fontes/adapters, polling/webhooks, fan-out/fan-in, retries.  
**LLM:** extração/classificação/geração assistida; sem autoridade para side effects.  
**HubSpot:** Company/Contact/Deal oficiais.  
**PostgreSQL:** inteligência, evidência, agent runs, mensagens, aprovações, suppressions e execução.

## 3. Fluxo canônico
`Discover -> Research -> Signal Scan -> Buying Committee -> Score -> Draft -> Approval -> Send -> Sequence -> Inbound -> Qualify -> Meeting -> Brief -> Human`

## 4. Política de autonomia
- Green: pesquisa, normalização, scoring, draft, sync seguro, classificação, follow-up previamente autorizado.
- Yellow: primeiro contato, claim técnico/legal, pricing/material, reunião especial, reply delicada.
- Red: preço customizado, desconto, contrato, DPA/SLA, jurídico, garantia de compliance, demo, negociação, VIP sensível, reclamação.

## 5. Critério SQL v1
Todos: score da conta >=70 (ou override), contato relevante, need/opportunity identificado, escopo mínimo, engagement positivo, sem blocker. Timing pode ser desconhecido quando intent é alto.

## 6. Critério de handoff
Handoff imediato em pedido de demo/reunião/proposta; preço não padrão; procurement/jurídico/segurança; objeção estratégica; C-level em Priority A; `ready_to_buy`; qualquer Red.

## 7. Modelo de implementação de side effect
1. Workflow solicita ação ao backend.
2. Backend carrega estado fresco.
3. Policy Engine produz `PolicyDecision` persistida.
4. Se Yellow, cria Approval e retorna `PENDING_APPROVAL`.
5. Se Green/ALLOW, cria idempotency record.
6. Adapter executa provider call.
7. Persiste provider ID/touchpoint/audit.
8. Em retry, idempotency impede duplicidade.

## 8. Evidence binding
Mensagem deve armazenar `evidenceIds[]` e/ou `knowledgeItemIds[]`. Claims específicos devem ser deriváveis desses itens. O supervisor retorna `unsupportedClaims[]`; qualquer item nessa lista bloqueia envio.

## 9. Inbound race condition
O handler inbound deve primeiro pausar sequence enrollment em transação antes de chamar o classificador. O scheduler deve reler `pausedAt/state/version` imediatamente antes do envio. Isso evita follow-up disparado enquanto uma resposta está sendo processada.

## 10. Evals antes de autonomia
Usar `tests/evals/dataset.jsonl`. A promoção de Yellow -> Green exige baseline documentado por tipo de ação, taxa de aprovação, factualidade e zero violações críticas.
