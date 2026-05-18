# PORTABILIDADE — Bloco 8: Insights + Narrativa + Agente + Inconsistências (Diferencial #2)

> Documento gerado automaticamente. Lista cada feature do bloco e como portá-la para outros projetos, especialmente o projeto Itaú via Eva.

---

## 📋 ÍNDICE DE FEATURES PORTÁVEIS

| # | Feature | Complexidade | Tempo estimado | Dependências |
|---|---------|--------------|----------------|--------------|
| 1 | Painel de Insights Executivos automáticos | 🔴 Complexa | 6-10h | SolsticeStats + dicionário |
| 2 | Detector de Tendência inteligente | 🟢 Simples | 30min | linearRegression |
| 3 | Detector de Pareto 80/20 | 🟢 Simples | 1h | sum + sort |
| 4 | Detector de Sazonalidade (autocorrelação) | 🟡 Média | 2h | autocorrelation + aggregate por bin temporal |
| 5 | Gerador de Narrativa template-based pt-BR | 🟡 Média | 4-6h | dicionário + templates |
| 6 | Sistema de Toast Notifications proativas | 🟢 Simples | 1h | toast existente do projeto |
| 7 | Agente proativo com cap de session | 🟡 Média | 2h | Store + subscribe |
| 8 | Catálogo de Inconsistências declarativas (15 regras) | 🟡 Média | 4-5h | tipos + dicionário |
| 9 | Command Palette estilo Spotlight | 🟡 Média | 3-4h | listener global + modal |
| 10 | Parser de Linguagem Natural simples (regex) | 🟡 Média | 2-3h | resolver de coluna + Stats |

**Total para portar tudo:** ~30-40h. Feature 1 (Insights) e Feature 5 (Narrativa) são as joias da coroa para qualquer dashboard executivo.

---

## 🔴 FEATURE 1: Painel de Insights Executivos automáticos

### 📖 O que faz no Solstice

Analisa o dataset inteiro e gera 0-8 cards de insight ordenados por importância. Cada insight detecta padrão específico (tendência forte, outliers, Pareto, sazonalidade, mudança recente, categoria dominante). Cores semânticas conforme `higherIsBetter`. Colapsável.

### 🎯 Por que vale portar

**É o diferencial executivo nº1 de qualquer dashboard sério.** No Itaú, em vez do gestor ter que olhar 20 gráficos e adivinhar o que importa, o sistema diz "atenção: DPD30 subiu 14% nos últimos meses" sem ele clicar em nada. Reduz tempo até insight de minutos para segundos.

### 🔗 Dependências obrigatórias

- Funções estatísticas (Stats.trend, Stats.outliersIQR, Stats.autocorrelation, Stats.distinctCount)
- Dicionário semântico para `higherIsBetter` (sem ele, severity = info sempre)

### 📝 Código fonte autônomo (esqueleto)

```javascript
function computeInsights(rows, columns, types, dictionary) {
  const insights = [];
  const numericCols = columns.filter(c => types[c] && types[c].group === 'numeric');
  const catCols = columns.filter(c => types[c] && types[c].group === 'categorical');

  function hib(col) {
    const d = dictionary?.columns?.[col];
    return d?.higherIsBetter;
  }

  // INSIGHT 1: Tendência forte
  numericCols.slice(0, 6).forEach(col => {
    const values = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    if (values.length < 10) return;
    const t = Stats.trend(values);
    if (!t || t.direction === 'flat') return;
    if (t.magnitude < 0.10) return;
    const isGood = hib(col) === true ? t.direction === 'up' : hib(col) === false ? t.direction === 'down' : null;
    insights.push({
      kind: 'trend',
      title: `Tendência de ${t.direction === 'up' ? 'alta' : 'queda'}: ${col}`,
      text: `Variação ${(t.magnitude*100).toFixed(1)}% · R²=${t.r2.toFixed(2)}`,
      severity: isGood === true ? 'success' : isGood === false ? 'error' : 'info',
      score: t.magnitude * 100 * (t.r2 || 0.5) * 2
    });
  });

  // INSIGHT 2: Outliers significativos
  numericCols.slice(0, 6).forEach(col => {
    const values = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    const ou = Stats.outliersIQR(values, 1.5);
    const pct = ou.values.length / values.length;
    if (pct < 0.02) return;
    insights.push({
      kind: 'outliers',
      title: `Outliers em ${col}`,
      text: `${ou.values.length} (${(pct*100).toFixed(1)}%) fora de [${ou.fences.lo}, ${ou.fences.hi}]`,
      severity: pct > 0.10 ? 'error' : pct > 0.05 ? 'warn' : 'info',
      score: pct * 100 * 3
    });
  });

  // INSIGHT 3-6: ver dashboard.html linhas 11270-11420
  // ...

  insights.sort((a, b) => b.score - a.score);
  return insights.slice(0, 8);
}
```

### 🤖 Prompt sugerido para Eva

```
Eva, preciso de painel de insights executivos no nosso dashboard de carteira PJ.
A ideia: o sistema analisa o dataset e mostra cards com o que importa SEM o
usuário pedir.

Tenho referência vanilla:
[colar código acima]

Adapta para:
- React/TypeScript
- Stats functions: usamos jStat, mapear corretamente
- Dicionário: shape <descrever>
- Cores semânticas via design system <descrever>

Detecta MÍNIMO 4 tipos:
1. Tendência (alta/queda) com R² > 0.3
2. Outliers via IQR 1.5×
3. Pareto 80/20 em cat × num
4. Categoria dominante (>40% do total)

Severity: success/warn/error/info conforme higherIsBetter do dicionário.
Score 0-100 para ordenar; mostrar top 8.
```

### ⚠️ Pegadinhas

1. **Performance:** se dataset > 100k linhas, compute insights em WebWorker (não bloqueia UI).
2. **Recomputa em cada render** — memoize por hash do dataset.
3. **higherIsBetter == null** (sem dicionário): severity sempre `info` — comportamento correto, não tente adivinhar.
4. **Sazonalidade exige ≥ 24 meses** — para dataset menor, pula esse detector.

---

## 🟡 FEATURE 5: Gerador de Narrativa template-based pt-BR

### 📖 O que faz no Solstice

Recebe um componente selecionado e produz um texto descritivo de 2-5 parágrafos em pt-BR. 3 tons × 3 profundidades. Substitui slots `{friendly}`, `{value}`, `{pct}` com dados reais.

### 🎯 Por que vale portar

**Substitui horas de copywriting analítico** por uma narrativa automática. No Itaú, gestor pode COLAR a narrativa direto no e-mail/Slack sem reescrever.

### 📝 Código fonte autônomo

```javascript
const TEMPLATES = {
  intro: {
    executivo: 'Indicador {friendly} ({agg_label}) atingiu {value} sobre {n_records}.',
    analitico: 'A coluna {friendly} ({agg_label}) atingiu {value} considerando {n_records} válidos.',
    casual:    'O valor de {friendly} é {value}, calculado a partir de {n_records}.'
  },
  trend_up: {
    executivo: 'Tendência clara de alta nos últimos períodos ({pct}%, R²={r2}).',
    analitico: 'Regressão linear: inclinação positiva, variação total {totalChange}, R²={r2}.',
    casual:    'Está subindo de forma consistente ({pct}%).'
  },
  // ... outros padrões
};

function phrase(key, tone, vars) {
  const tpl = TEMPLATES[key]?.[tone] || TEMPLATES[key]?.executivo;
  if (!tpl) return '';
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

function buildNarrative(slot, ingest, dictionary, tone='executivo', depth='medium') {
  const col = resolvePrimaryCol(slot);
  const values = ingest.rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
  const stats = Stats.describe(values);
  const trend = Stats.trend(values);

  const paragraphs = [
    phrase('intro', tone, {
      friendly: dictionary.columns[col]?.friendlyName || col,
      agg_label: 'Soma',
      value: formatValue(stats.sum),
      n_records: `${values.length} registros`
    })
  ];

  if (depth !== 'short' && trend) {
    const key = trend.direction === 'up' ? 'trend_up' : trend.direction === 'down' ? 'trend_down' : 'trend_flat';
    paragraphs.push(phrase(key, tone, {
      pct: (trend.magnitude * 100).toFixed(1),
      r2: trend.r2.toFixed(2),
      totalChange: trend.totalChange.toFixed(1)
    }));
  }

  // ... outros parágrafos conforme depth
  return paragraphs.filter(Boolean).join('\n\n');
}
```

### 🤖 Prompt sugerido para Eva

```
Eva, preciso de narrativa automática para os KPIs do nosso dashboard.
Quero textos pt-BR de 2-5 parágrafos descrevendo cada métrica.

3 tons: executivo (objetivo, decisor) · analítico (preciso, números) · casual (acessível).
3 profundidades: curta (1 parágrafo), média (2-3), longa (4-5 + outliers).

Templates pt-BR com slots {friendly}, {value}, {pct} — substituídos por dados reais.
[colar código + TEMPLATES acima]

Integra com:
- Nosso shape de slot/componente: <descrever>
- Dicionário semântico: <descrever>
- Botões: Copiar · Markdown · Email (mailto:)
- Mantém vanilla (sem LLM nessa primeira versão — templates suficientes).
```

### ⚠️ Pegadinhas

1. **Templates pt-BR só** — para EN/ES adicione `T.intro.en = '...'`.
2. **higherIsBetter sem dicionário** = não adiciona parágrafo "directional" — comportamento intencional.
3. **`{slot}` desconhecido** = literal mantido. Use console para debugar.

---

## 🟡 FEATURE 8: Catálogo de Inconsistências declarativas

### 📖 O que faz no Solstice

15 regras estatísticas/analíticas declarativas. Cada regra retorna `true` se detectar problema. Exibido como accordion "⚠️ Avisos" no inspector.

### 🎯 Por que vale portar

Captura erros analíticos comuns ANTES do gestor olhar (ex: alguém configurou "Soma" em uma coluna de CPF). No Itaú, evita 50% dos tickets "esse número tá errado".

### 📝 Código fonte autônomo

```javascript
const RULES = [
  {
    id: 'sum-of-pct',
    label: 'Soma de percentual',
    severity: 'warn',
    description: 'Somar valores que já são % gera número sem significado.',
    hint: 'Use Média ou Mediana de % em vez de Soma.',
    when: ({ slot, types }) => {
      const cfg = slot.config || {};
      if (cfg.agg !== 'sum') return false;
      return types[cfg.column]?.type === 'percentage';
    }
  },
  {
    id: 'sum-of-id',
    label: 'Soma de identificador',
    severity: 'error',
    description: 'Somar IDs/CPF/CNPJ não tem significado de negócio.',
    hint: 'Use Contagem ou Distinct count.',
    when: ({ slot, types }) => {
      const cfg = slot.config || {};
      if (cfg.agg !== 'sum') return false;
      const group = types[cfg.column]?.group;
      return group === 'id';
    }
  },
  // ... 13 outras regras (ver dashboard.html linhas 11700-11900)
];

function checkSlot(slot, ctx) {
  return RULES.filter(r => {
    try { return r.when({ slot, ...ctx }); }
    catch(e) { return false; }
  }).map(r => ({ id: r.id, label: r.label, severity: r.severity, description: r.description, hint: r.hint }));
}
```

### 🤖 Prompt sugerido para Eva

```
Eva, preciso adicionar validação de inconsistências analíticas comuns ao dashboard.
A ideia: ANTES do gestor ver, o sistema avisa "ei, você está somando %, isso não faz sentido".

15 regras declarativas:
1. Soma de %
2. Soma de IDs
3. Média de média
4. Gauge meta fora do range
5. Sankey source==target
6. Coluna > 50% nulos
7. Box Plot com >8 grupos
8. Scatter <10 pontos
9. ... (lista completa: dashboard.html linhas 11700-11900)

[colar código RULES acima]

Cada regra:
- id (kebab-case)
- severity: warn | info | error
- description (o problema)
- hint (a correção sugerida)
- when(ctx) → boolean

Avisos aparecem como cards em accordion no inspector lateral. Não bloqueiam — só avisam.
```

### ⚠️ Pegadinhas

1. **Não bloquear ação** — usuários odeiam. Apenas avisar.
2. **try/catch em `when`** — regra que dá erro deve falhar silenciosa.
3. **Severity:** reservar `error` para problemas semanticamente graves (sum-of-id, sankey-same-cols). Resto é warn ou info.

---

## 🟡 FEATURE 9: Command Palette estilo Spotlight (Ctrl+P)

### 📖 O que faz no Solstice

Overlay tipo Spotlight ao apertar Ctrl+P. Input texto + lista de sugestões + área de resultado. Padrão Slack/Notion/Linear.

### 🎯 Por que vale portar

Atalho para usuários power. No Itaú, gestores experientes podem pular cliques digitando "tendência de inadimplência" e ver resposta em 2 segundos.

### 📝 Código fonte autônomo

```javascript
const Palette = {
  isOpen: false,

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    const overlay = document.createElement('div');
    overlay.className = 'palette-overlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });

    const panel = document.createElement('div');
    panel.className = 'palette-panel';
    panel.innerHTML = `
      <div class="palette-input-wrap">
        <span>🔍</span>
        <input class="palette-input" placeholder="O que você quer fazer?">
        <span class="palette-kbd">Esc</span>
      </div>
      <div class="palette-body"></div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const input = panel.querySelector('input');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.execute(input.value);
      if (e.key === 'Escape') this.close();
    });
    setTimeout(() => input.focus(), 50);
    this._overlay = overlay;
  },

  close() {
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    this.isOpen = false;
  },

  execute(query) {
    const result = parseQuery(query); // FEATURE 10
    const body = this._overlay.querySelector('.palette-body');
    body.innerHTML = '';
    if (result.ok) {
      body.innerHTML = `<div class="palette-result"><strong>${result.value}</strong><br><small>${result.formula}</small></div>`;
    } else {
      body.innerHTML = `<div class="palette-error">⚠️ ${result.error}</div>`;
    }
  }
};

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    if (Palette.isOpen) Palette.close(); else Palette.open();
  }
});
```

### ⚠️ Pegadinhas

1. **e.preventDefault()** em Ctrl+P para evitar abrir impressão do browser.
2. **Não interceptar em inputs** — senão usuário não consegue digitar 'p' em campos.
3. **Esc fecha** mas só se palette tem foco — implementar via stopPropagation.

---

## 🟡 FEATURE 10: Parser de Linguagem Natural simples (regex)

### 📖 O que faz no Solstice

Sem LLM, sem ML — só regex. Reconhece **7 padrões pt-BR** mapeando para funções de `Stats`. Cobre 70% das perguntas executivas comuns ("qual a média de X?", "top 5", "correlação entre X e Y").

### 🎯 Por que vale portar

LLM custa $/req. Para perguntas básicas, regex é instantâneo, deterministicamente correto, sem custo, sem rede.

### 📝 Código (núcleo)

```javascript
function parseQuery(q) {
  q = q.toLowerCase().trim();

  // "qual a média de X" e variantes
  let m = q.match(/(?:m[éz]dia|mediana|soma|total|m[áa]ximo|m[íi]nimo) (?:de|do|da|na coluna)\s+(.+)/);
  if (m) {
    const opMap = { 'média':'mean','media':'mean','mediana':'median','soma':'sum','total':'sum','máximo':'max','maximo':'max','mínimo':'min','minimo':'min' };
    const op = opMap[m[0].split(' ')[0]];
    const col = resolveColumn(m[1]);
    if (!col) return { ok: false, error: `Coluna "${m[1]}" não encontrada.` };
    const values = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    return { ok: true, value: Stats[op](values), formula: `Stats.${op}(${col})` };
  }

  // "correlação entre X e Y"
  m = q.match(/correla[çc][ãa]o (?:entre|de)\s+(.+?)\s+(?:e|com|vs)\s+(.+)/);
  if (m) {
    const colA = resolveColumn(m[1]);
    const colB = resolveColumn(m[2]);
    if (!colA || !colB) return { ok: false, error: 'Coluna não encontrada.' };
    const r = Stats.correlation(rows.map(r => parseFloat(r[colA])), rows.map(r => parseFloat(r[colB])));
    return { ok: true, value: r.toFixed(3), formula: 'Pearson r' };
  }

  // ... outros padrões (7 total)

  return { ok: false, error: 'Não entendi. Tente: "qual a média de X" ou "correlação entre X e Y".' };
}

function resolveColumn(name) {
  name = name.toLowerCase().trim();
  for (const c of columns) if (c.toLowerCase() === name) return c;
  for (const c of columns) {
    const fn = dictionary?.columns?.[c]?.friendlyName?.toLowerCase();
    if (fn === name) return c;
  }
  for (const c of columns) if (c.toLowerCase().startsWith(name)) return c;
  return null;
}
```

### 🤖 Prompt sugerido para Eva

```
Eva, preciso de parser de linguagem natural simples (sem LLM) para
o command palette do dashboard. Reconhece 7 padrões pt-BR via regex,
mapeando para nossas funções estatísticas.

Padrões a reconhecer:
1. "qual a média/mediana/soma/máximo/mínimo de [col]"
2. "quantos outliers em [col]"
3. "correlação entre [X] e [Y]"
4. "top N em [cat] por [num]"
5. "tendência de [col]"
6. "quantos registros"
7. "quantas categorias em [col]"

Resolver de coluna: aceita nome técnico OU friendlyName (case-insensitive, prefix match).

[colar código]

Não use LLM nessa primeira versão. Adicione fallback LLM no futuro
(B12) se houver demanda.
```

### ⚠️ Pegadinhas

1. **Ordenar regex por especificidade** — pattern mais geral por último.
2. **resolveColumn caseless + partial** — usuário não digita "vlr_op_aprov_mensal", digita "receita".
3. **Sempre devolver formula** explicitando como o número foi calculado — confiança.

---

## 🟥 RESUMO DO BLOCO

### Features mais valiosas para portar primeiro

1. **🔴 Painel de Insights Executivos** (Feature 1) — diferencial competitivo absoluto
2. **🟡 Narrativa Automática** (Feature 5) — economiza horas de copywriting/sprint
3. **🟡 Catálogo de Inconsistências** (Feature 8) — reduz tickets de "esse número tá errado"

### Features que NÃO vale portar isoladamente

- Detector de Sazonalidade (Feature 4) — só faz sentido se já tem `autocorrelation` (SolsticeStats)
- Agent proativo (Feature 7) — depende de Insights + Toast já no projeto
- Parser NL (Feature 10) — só com Stats + resolver de coluna

### Recomendação para projeto Itaú via Eva

**Estratégia 80/20:**

1. **Sprint 1:** Inconsistências (Feature 8) — quick win, 1 sprint, evita bugs analíticos
2. **Sprint 2-3:** Painel de Insights (Feature 1) + Narrativa (Feature 5) — wow effect imediato com gestores
3. **Sprint 4:** Ctrl+P + Parser (Features 9+10) — power user delight
4. **Backlog:** Agente proativo (Feature 7) — quando UX maduro

**ROI estimado:** 35-40h port + 15h adaptação = ~55h. Em troca: dashboard que pensa pelo gestor. Métrica de sucesso: redução de tickets analytics em 30%.
