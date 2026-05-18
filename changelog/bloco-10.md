# Changelog — Bloco 10

**Entregue em:** 2026-05-18 · Sessão 3
**Versão:** `5.3.0-bloco10`
**Tamanho:** ~14.423 linhas (~623 KB)

---

## 🎯 Objetivo

Reduzir o "tempo até primeiro dashboard útil" de minutos para segundos. Em vez do usuário construir manualmente componente por componente, o Solstice agora:
1. **Analisa o dataset** e ranqueia colunas por importância
2. **Recomenda visualizações** com confidence calibrada
3. **Aplica automaticamente** (Auto-Dashboard) ou **guia por intenção** (Wizard)

## ✨ 4 Módulos Novos

### `SolsticeColumnScore` — Score 0-100 de importância

8 critérios compostos com pesos:

| Critério | Peso | O que mede |
|---|---|---|
| coverage | 18% | % de valores não-nulos |
| variation | 16% | IQR > 0 (num) ou cardinalidade balanceada (cat) |
| cardinality | 12% | distintos no range bom |
| higherIsBetter | 14% | tem direcionalidade no dicionário |
| dictMatch | 12% | matched no dicionário pré-feito |
| typeImportance | 10% | numeric > temporal > cat > id |
| position | 8% | primeiras colunas pesam mais |
| synonymBonus | 10% | friendlyName ≠ nome técnico |

API: `scoreImportance(col, ctx)`, `rank(ctx)`, `top(ctx, n)`.

### `SolsticeRecommender` — 15 regras declarativas

Cada regra: `{ id, label, build(ctx) → recomendação | null }`. Retorna `{ componentType, config, confidence, reasoning, ruleId, label }`.

15 regras cobrem todos os 10 tipos de componente em cenários típicos. Confidence calibrada: hard-coded para a maioria (75-90); calculada para Scatter (50 + |r|·50) e outliers (60 + pct·200).

Mapa `INTENT_RULES` liga 11 intenções (do Wizard) a subsets de regras.

### `SolsticeAutoDashboard` — Pipeline 4-etapas

1. ColumnScore.rank → top colunas
2. Recommender.recommend → array
3. Filtra `confidence ≥ 60`, top 8
4. Se média < 70% (ou `force=true`) → modal de confirmação; senão aplica direto

`_buildSections` distribui em até 4 sections:
- 1ª section: até 3 KPIs/Gauges em layout 3-col equal
- 2ª-4ª sections: 2 componentes cada em layout 2-col equal

Audit registra `action: 'auto_dashboard'` com `recIds`.

### `SolsticeWizard` — Modal 3-step com 11 intenções

**Step 1:** grid de 12 cards (7 agnósticos + 4 analíticos + 1 customizado) com ícone/título/desc/badge.

**Step 2:** lista checkmarcável das recomendações filtradas por intenção.

**Step 3:** preview final + botão "✓ Aplicar".

Reusa `AutoDashboard._buildSections` — zero duplicação.

## 🎨 CSS novo

```
.solstice__wizard / -steps / -step (.is-current/.is-done) / -step-num / -content
.solstice__intents-grid
.solstice__intent-card (.is-selected) / -icon / -title / -desc / -badge / -badge--analytic
.solstice__recs-list / .solstice__rec-item / -body / -title / -icon / -reason
.solstice__rec-item-confidence (variantes --high/--med/--low)
.solstice__recs-summary
```

## 🎯 Botões na toolbar

- 🪄 **Auto-Dashboard** (primary) — `AutoDashboard.run({ force: true })`
- 🧙 **Wizard** — `Wizard.open()`

Ambos só aparecem com dataset carregado.

## 📐 ADRs

- **ADR-075:** ColumnScore com 8 critérios compostos
- **ADR-076:** Recommender declarativo (15 regras, confidence 0-100)
- **ADR-077:** AutoDashboard com confirmação se conf média < 70% ou force=true
- **ADR-078:** Wizard 3-step com 11 intenções mapeadas a subsets de regras

## ⚠️ Limitações conhecidas

- **Pesos do ColumnScore calibrados na intuição** — datasets de domínios específicos podem precisar pesos diferentes. Futuro: pesos por domínio do dicionário.
- **15 regras pode escalar** — em algum ponto vira módulo `SolsticeRules` próprio.
- **ColumnScore não considera correlação entre colunas** — só atributos isolados. Limitação aceitável.
- **AutoDashboard máx 4 sections** — se confidence alta em 12+ recomendações, sobra é descartada.
- **Wizard usa intent estrita** — se nenhuma regra mapeia para intent, lista fica vazia (uma vez aconteceu com "tabular" + dataset numérico-only).
- **Heurística 70%** para confirmação é palpite — calibragem com uso real (B12).

## 🔮 Bloco 11 — próximo

Snapshots + Templates + Export HTML standalone + File System Access API. Vai precisar serializar `canvas.sections` + `filters` + `params` + estado completo. Auto-Dashboard recomendações devem virar candidatas a "templates" salváveis.
