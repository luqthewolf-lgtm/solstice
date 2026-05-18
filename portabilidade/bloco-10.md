# PORTABILIDADE — Bloco 10: Auto-Dashboard + Wizard + Recomendações

> Cada feature aqui é portável. Mais valiosas: ColumnScore (puro), Recommender declarativo (extensível), Wizard de 3-step (UX guiado).

---

## 📋 ÍNDICE

| # | Feature | Complexidade | Tempo | Dependências |
|---|---------|--------------|-------|--------------|
| 1 | ColumnScore 8 critérios | 🟡 Média | 3-4h | tipos + dicionário |
| 2 | Recommender declarativo (regras + confidence) | 🟡 Média | 4-6h | Stats + ColumnScore |
| 3 | Auto-Dashboard pipeline | 🔴 Complexa | 6-8h | Recommender + Canvas |
| 4 | Wizard 3-step com intenções | 🔴 Complexa | 6-8h | Recommender + Modal |
| 5 | Modal de confirmação com checkboxes | 🟢 Simples | 2h | Modal |
| 6 | Badge de confidence (high/med/low) | 🟢 Simples | 30min | CSS |

---

## 🟡 FEATURE 1: ColumnScore 8 critérios

### 📖 O que faz

Recebe uma coluna + contexto (rows, types, dictionary), devolve score 0-100 de "relevância para visualização".

### 🎯 Por que vale portar

**Sem isso, "Auto-Dashboard" escolhe colunas alfabeticamente.** Score multi-critério faz a diferença entre dashboard útil e ruidoso.

### 📝 Código autônomo (resumo)

```javascript
const WEIGHTS = {
  coverage: 0.18, variation: 0.16, cardinality: 0.12,
  higherIsBetter: 0.14, dictMatch: 0.12, typeImportance: 0.10,
  position: 0.08, synonymBonus: 0.10
};

function scoreImportance(col, ctx) {
  const { rows, columns, types, dictionary } = ctx;
  if (!rows?.length) return 0;
  const t = types[col]?.type;
  const group = typeGroup(t);  // sua função

  let s = 0;

  // Coverage
  const nulls = rows.filter(r => r[col] == null || r[col] === '').length;
  s += WEIGHTS.coverage * (1 - nulls / rows.length);

  // Variation (numeric: IQR > 0; cat: 2-30 distintos)
  if (group === 'numeric') {
    const vals = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    const iqr = computeIQR(vals);
    s += WEIGHTS.variation * (iqr > 0 ? 1 : 0);
  } else if (group === 'categorical') {
    const d = new Set(rows.map(r => r[col])).size;
    s += WEIGHTS.variation * ((d >= 2 && d <= 30) ? 1 : 0.3);
  }

  // higherIsBetter no dicionário
  const dc = dictionary?.columns?.[col];
  s += WEIGHTS.higherIsBetter * (dc?.higherIsBetter != null ? 1 : 0);

  // dictMatch
  s += WEIGHTS.dictMatch * (dc ? 1 : 0);

  // typeImportance
  const typeMap = { numeric: 1, temporal: 0.9, categorical: 0.7, id: 0.3 };
  s += WEIGHTS.typeImportance * (typeMap[group] ?? 0.5);

  // Position (primeiras colunas pesam mais)
  const idx = columns.indexOf(col);
  const pos = Math.max(0, 1 - (idx / (columns.length - 1)) * 0.5);
  s += WEIGHTS.position * pos;

  // Synonym bonus (friendlyName técnico = 0)
  const friendly = dc?.friendlyName || col;
  const isTechnical = friendly === col || /^[a-z_]+$/.test(friendly);
  s += WEIGHTS.synonymBonus * (isTechnical ? 0 : 1);

  return Math.round(s * 100);
}
```

### 🤖 Prompt para Eva

```
Eva, preciso de ColumnScore: dado dataset + coluna, devolve 0-100 indicando
"quão importante essa coluna é para visualização".

8 critérios ponderados:
1. Coverage (não-nulos)
2. Variation (IQR > 0 ou cardinalidade balanceada)
3. Cardinality
4. higherIsBetter no dicionário
5. dictMatch
6. typeImportance (numeric > temporal > cat > id)
7. Position
8. synonymBonus (friendlyName ≠ técnico)

[colar código + WEIGHTS]

Adapta para nosso projeto:
- Shape do dicionário: <descrever>
- typeGroup: <usamos como?>
- React/TypeScript: funções puras em utils/columnScore.ts
```

### ⚠️ Pegadinhas

1. **Pesos somam 1.0** — ajustar 1 sem ajustar outros faz scores ultrapassarem 100
2. **Datasets vazios** retornam 0 (não NaN)
3. **Pesos calibrados na intuição** — datasets de domínios específicos podem precisar tuning

---

## 🟡 FEATURE 2: Recommender declarativo

### 📖 O que faz

Array de regras `{ id, label, build(ctx) → recomendação | null }`. Cada regra independente — adicionar nova = appendar ao array.

### 🎯 Por que vale portar

**Auditável, testável, extensível.** Sem if/else gigante, sem black box ML. Cada regra é 10-20 linhas.

### 📝 Pattern

```javascript
const RULES = [
  {
    id: 'kpi-from-hib',
    label: 'KPI a partir de coluna higherIsBetter',
    build(ctx) {
      const numCols = ctx.columns.filter(c => isNumeric(c, ctx));
      const target = numCols.find(c => {
        const d = ctx.dictionary?.columns?.[c];
        return d && (d.higherIsBetter === true || d.higherIsBetter === false);
      });
      if (!target) return null;
      return {
        componentType: 'kpi',
        config: { column: target, agg: 'sum' },
        confidence: 90,
        reasoning: `Coluna "${friendlyName(target)}" tem direcionalidade no dicionário.`
      };
    }
  },
  // ... outras regras
];

function recommend(ctx, opts = {}) {
  const out = [];
  RULES.forEach(rule => {
    if (opts.intent && !intentMatches(rule, opts.intent)) return;
    try {
      const r = rule.build(ctx);
      if (r) out.push({ ...r, ruleId: rule.id, label: rule.label });
    } catch (e) { /* silenciosa */ }
  });
  return out.sort((a, b) => b.confidence - a.confidence);
}
```

### 🎯 Mapa intent → ruleIds

```javascript
const INTENT_RULES = {
  comparar:   ['boxplot-grouped', 'top-categorical', 'kpi-from-hib'],
  tendencia:  ['time-series', 'forecast-series', 'heatmap-cal'],
  correlacao: ['scatter-correlated', 'boxplot-grouped'],
  // ...
};
```

### ⚠️ Pegadinhas

1. **try/catch silencioso** em cada `build` — regra que dá erro falha quieta (não bloqueia outras)
2. **Ordenar regras por especificidade** menos importante — confidence faz o ranking final
3. **Confidence > 90** reservar para casos onde tem evidência forte (higherIsBetter + tipo perfeito)

---

## 🔴 FEATURE 3: Auto-Dashboard pipeline

### 📖 O que faz

1. ColumnScore.rank
2. Recommender.recommend
3. Filtra confidence ≥ 60
4. Confirma com usuário se média < 70%
5. Constrói sections e aplica

### 📝 Pattern essencial

```javascript
async function runAutoDashboard(opts = {}) {
  const ctx = buildContext();
  const recs = Recommender.recommend(ctx, { intent: opts.intent });
  const filtered = recs.filter(r => r.confidence >= 60).slice(0, 8);
  if (!filtered.length) return;

  const avgConf = filtered.reduce((s, r) => s + r.confidence, 0) / filtered.length;
  const needsConfirm = opts.force || avgConf < 70;

  if (!needsConfirm) {
    applySections(filtered);
    return;
  }

  // Modal com lista checkmarcável
  const selected = filtered.map(() => true);
  showModal({
    title: '🪄 Auto-Dashboard sugerido',
    body: renderRecsList(filtered, selected),
    onApply: () => applySections(filtered.filter((_, i) => selected[i]))
  });
}

function buildSections(recs) {
  const sections = [];
  // KPIs/Gauges primeiros em layout 3-col
  const kpiLike = recs.filter(r => ['kpi', 'gauge'].includes(r.componentType)).slice(0, 3);
  if (kpiLike.length) {
    sections.push({
      title: 'Visão executiva',
      rows: [{ layout: kpiLike.length === 3 ? '3col-equal' : '2col-equal',
               slots: kpiLike.map(r => ({ type: r.componentType, config: r.config })) }]
    });
  }
  // Resto em sections de 2 componentes em 2-col-equal
  const rest = recs.filter(r => !kpiLike.includes(r));
  while (rest.length && sections.length < 4) {
    const batch = rest.splice(0, 2);
    sections.push({ rows: [{ layout: '2col-equal', slots: batch.map(r => ({ type: r.componentType, config: r.config })) }] });
  }
  return sections;
}
```

---

## 🔴 FEATURE 4: Wizard 3-step com intenções

### 📖 O que faz

Modal multi-step que guia o usuário por intenção semântica ("quero ver tendência") em vez de "qual componente?".

### 📝 Pattern

```javascript
const INTENTS = [
  { id: 'comparar',   icon: '📊', title: 'Comparar',  desc: '...' },
  { id: 'tendencia',  icon: '📈', title: 'Tendência', desc: '...' },
  { id: 'correlacao', icon: '🔗', title: 'Correlação', desc: '...' },
  // ... 11 total + custom
];

async function openWizard() {
  let step = 1;
  let intent = null;
  let recs = [];
  let selected = [];

  function render() {
    if (step === 1) renderIntents();
    else if (step === 2) {
      recs = Recommender.recommend(ctx, { intent });
      selected = recs.map(() => true);
      renderRecsList(recs, selected);
    } else {
      renderFinalPreview(recs.filter((_, i) => selected[i]));
    }
  }

  showModal({
    title: '🧙 Wizard',
    body: render,
    footer: [
      backBtn(() => { step--; render(); }),
      nextBtn(() => {
        if (step === 3) applySections(recs.filter((_, i) => selected[i]));
        else { step++; render(); }
      })
    ]
  });
}
```

### ⚠️ Pegadinhas

1. **State entre steps** — usar closure ou estado externo, não DOM
2. **Step indicator visual** ajuda muito — não corte
3. **"Custom" intent = sem filtro de regra** — útil quando usuário sabe o que quer

---

## 🟥 RESUMO DO BLOCO

### Mais valiosas para portar primeiro

1. **🟡 ColumnScore** (Feature 1) — fundação para qualquer "automação inteligente"
2. **🟡 Recommender declarativo** (Feature 2) — engine extensível
3. **🔴 Auto-Dashboard** (Feature 3) — wow factor imediato

### Recomendação para Itaú via Eva

**Sequência 4 sprints:**
1. ColumnScore + 5 regras-piloto do Recommender
2. Recommender completo (15 regras)
3. Auto-Dashboard com modal de confirmação
4. Wizard 3-step (UX guiado)

**ROI estimado:** 20-25h. Em troca: "tempo até primeiro dashboard útil" cai de minutos para 10 segundos para gestores PJ que não querem aprender Tableau.
