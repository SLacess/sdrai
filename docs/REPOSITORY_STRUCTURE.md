# Estrutura de repositório alvo
```text
/apps
  /web                 # Next.js App Router, dashboard, APIs/BFF
  /worker              # BullMQ workers
/packages
  /db                  # Prisma client/repositories/migrations
  /domain              # state machines, scoring, qualification
  /policies            # autonomy/policy/frequency/evidence
  /ai                  # gateway, prompts, schemas, eval harness
  /integrations        # hubspot/email/calendar/apify/n8n adapters
  /observability       # logging, metrics, traces, cost
  /ui                  # design system opcional
/n8n
  /workflows           # exports reais versionados
  /specs               # contracts deste pack
/tests
  /unit
  /integration
  /contract
  /e2e
  /evals
/docs
  /adr
  /runbooks
  /api
/knowledge             # seed metadata; conteúdo sensível aprovado fora do Git quando necessário
/config
```

## Dependency direction
`apps -> domain/policies/ai/integrations/db`, enquanto `domain` não depende de framework web, n8n ou provider. `policies` pode depender de tipos de domínio, não de UI. Adapters implementam interfaces declaradas no core.
