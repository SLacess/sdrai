# Dataset inicial de evals
60 casos distribuídos entre reply classification, factualidade/supervisão, qualificação SQL, política de mensagem, pesquisa adversarial/prompt injection e policy engine.

## Métricas mínimas antes de produção
- casos `critical=true`: 100% pass
- factualidade/suppressions: 100% em casos críticos
- reply intent macro accuracy: >= 95% no dataset inicial
- supervisor BLOCK/PASS accuracy: >= 95%
- SQL classification: >= 90%, com revisão de falsos positivos
- nenhuma regressão crítica após mudança de prompt/modelo

O dataset deve crescer com exemplos reais anonimizados de approve/edit/reject e outcomes comerciais.
