# Changelog — Bloco 8

**Entregue em:** 2026-05-18 · Sessão 3
**Versão:** `5.3.0-bloco8`
**Tamanho:** ~12.485 linhas (~542 KB)

---

## 🎯 Objetivo

Diferencial #2 do projeto: tornar o Solstice **proativo**. Em vez de só renderizar gráficos, o sistema agora:
1. Detecta automaticamente padrões interessantes no dataset (insights)
2. Conta a história em linguagem natural pt-BR (narrativa)
3. Alerta o usuário sobre coisas relevantes via toast (agente)
4. Detecta erros analíticos comuns (inconsistências)
5. Responde perguntas em linguagem natural (Ctrl+P)

Tudo consumindo o `SolsticeStats` do B7.

## ✨ 5 Módulos Novos

### `SolsticeInsights` — Painel de Insights Executivos

Renderizado no topo do canvas (acima das sections), colapsável. Detecta automaticamente **6 tipos de insight**:

| # | Tipo | Quando dispara |
|---|---|---|
| 1 | **Tendência** | Magnitude > 10% + R² > 0.30 numa numérica |
| 2 | **Outliers** | >2% do total fora de IQR 1.5× |
| 3 | **Pareto 80/20** | Categórica com 3-30 distintos × numérica; concentração detectada |
| 4 | **Sazonalidade** | Autocorrelação no lag 12 > 0.4 (necessita ≥24 meses) |
| 5 | **Mudança recente** | 1ª metade vs 2ª metade dos registros, |Δ| > 20% |
| 6 | **Categoria dominante** | Cat com top valor > 40% do total |

Cada card tem **severity** (success/warn/error/info) e **score** 0-100. Top 8 ordenados por score. Severity respeita `higherIsBetter` do dicionário (alta de KPI bom = success, alta de inadimplência = error).

**API:** `Solstice.Insights.compute()` · `Solstice.Insights.list()` · `Solstice.Insights.renderInto(canvasEl)`

### `SolsticeNarrative` — Narrativa Automática (Diferencial #2)

Gera texto natural pt-BR descrevendo o componente selecionado. **Botão "📖 Gerar narrativa"** no rodapé do inspector lateral (B7-r2).

**3 tons:** 👔 Executivo · 🔬 Analítico · 💬 Casual.
**3 profundidades:** 📄 Curta · 📑 Média · 📚 Longa.

Templates incluem:
- Introdução (agg + valor + n_records)
- Tendência (up/down/flat + R² + total change)
- Direcional respeitando higherIsBetter
- Outliers (long only)
- Comparação vs baseline (KPI com config.comparison)

Modal com **export markdown · copiar · email** (mailto:).

**API:** `Solstice.Narrative.build(slotId)` · `Solstice.Narrative.openModal(slotId)` · `setTone/setDepth`.

### `SolsticeAgent` — Agente Proativo

Observa mudanças e dispara **toast contextual** quando detecta padrão importante. **Cap 3 toasts/sessão** (sem spam). Gatilhos:
- CSV importado → primeiro insight do tipo `trend`, `outliers` ou `pareto`
- Cada toast tem botão de ação ("Ver insights" / "Criar Box Plot")

Reseta o cap a cada novo import.

**API:** `Solstice.Agent.status()` · `Solstice.Agent._reset()`.

### `SolsticeInconsistencies` — Catálogo de 15 Regras Analíticas

Detecta padrões problemáticos:

| ID | Severidade | O que detecta |
|---|---|---|
| `avg-of-avg` | warn | KPI com média sobre coluna já agregada |
| `sum-of-pct` | warn | Soma de percentual |
| `sum-of-id` | error | Soma de IDs/CPF/CNPJ |
| `count-vs-sum-confusion` | info | Confirma intenção sum vs count |
| `high-null-col` | warn | Coluna com >50% nulos |
| `gauge-meta-fora-range` | warn | Meta fora do min/max do gauge |
| `sankey-same-cols` | error | source = target no Sankey |
| `distrib-bins-extremos` | info | Bins <6 ou >60 |
| `boxplot-grupos-demais` | warn | Categórica com >8 distintos |
| `scatter-poucos-pontos` | info | Scatter <10 pares |
| `monovalor` | warn | Coluna com 1 valor único |
| `comparison-no-temporal` | warn | "Período anterior" sem coluna temporal |
| `time-series-poucos-pontos` | info | <5 pontos no eixo X |
| `agg-incompat-comparison` | warn | Baseline estatisticamente inválida |
| `tabela-sem-filtro-grande` | info | >500 linhas, sem filtro |

Avisos aparecem como **accordion "⚠️ Avisos"** no topo do inspector lateral (só se houver hits).

**API:** `Solstice.Inconsistencies.catalog()` · `Solstice.Inconsistencies.checkSlot(slotId)`.

### `SolsticeAsk` — "Pergunte ao Solstice" (Ctrl+P)

Command palette estilo Spotlight. **Atalho Ctrl+P** (Cmd+P no Mac).

Parser regex pt-BR reconhece **7 padrões:**
1. `"qual a média/mediana/soma/máximo/mínimo/desvio de X"` — agregação
2. `"quantos outliers em X"` — outliers IQR
3. `"correlação entre X e Y"` — Pearson
4. `"top N em X [por Y]"` — ranking
5. `"tendência de X"` — direção + magnitude
6. `"quantos registros"` — total
7. `"quantas categorias em X"` — distinctCount

Resolve nomes por friendlyName OU técnico (case-insensitive, partial match). Resultado em card destacado com fórmula explicativa.

**API:** `Solstice.Ask.open()` · `Solstice.Ask.close()` · `Solstice.Ask.parse(query)`.

## 🎨 CSS novo

```
.solstice__insights / -head / -title / -count / -actions / -toggle / -body / -empty
.solstice__insight-card (+ variantes success/warn/error/info)
.solstice__insight-icon / -title / -text / -meta
.solstice__narrative-body / -controls / -pill (is-active) / -label
.solstice__inconsist
.solstice__ask-overlay / -panel / -input-wrap / -input / -kbd / -body
.solstice__ask-suggestion / -result / -result-value / -result-formula / -error
```

## 📐 ADRs novas

- **ADR-066:** Insights priorizados por score (0-100), top 8 exibidos
- **ADR-067:** Narrativa template-based pt-BR (sem LLM), 3 tons × 3 profundidades
- **ADR-068:** Agent cap 3 toasts/sessão (evita poluição)
- **ADR-069:** Inconsistencies como catálogo declarativo (regras puras, sem state)
- **ADR-070:** Ask parser regex (não LLM, single-file vanilla)

## ⚠️ Limitações conhecidas

- **Insights computa sob demanda** a cada render do Canvas. Para datasets 100K+, custo perceptível (~50-100ms). B12 polish moverá para WebWorker se virar problema.
- **Narrativa só pt-BR** — i18n para EN/ES fica para B12.
- **Agent cap 3/sessão** pode segurar insights úteis em sessões longas. Aceitável vs spam.
- **Ask cobre ~7 padrões** — queries fora do template recebem mensagem amigável + sugestões.
- **Inconsistências NÃO bloqueiam ação** — só avisam. Usuário sempre tem autonomia.
- **Sazonalidade só detecta mensal anual** (lag 12). Detecção semanal/diária fica para B10 polish.

## 🔮 Bloco 9 — próximo

Filtros Globais + Cross-Filter por clique + Parâmetros. Os filtros vão invalidar insights/narrativa/inconsistências cacheados, então os módulos do B8 precisarão de subscriber em `ui.filters`.
