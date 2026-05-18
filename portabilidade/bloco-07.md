# PORTABILIDADE — Bloco 7: SolsticeStats + Aba Análise + Smart Defaults

> Documento gerado automaticamente. Lista cada feature do bloco e como portá-la para outros projetos, especialmente o projeto Itaú via Eva.

---

## 📋 ÍNDICE DE FEATURES PORTÁVEIS

| # | Feature | Complexidade | Tempo estimado | Dependências |
|---|---------|--------------|----------------|--------------|
| 1 | Núcleo (clean/sorted/sum/count/countNulls) | 🟢 Simples | 30min | nenhuma |
| 2 | Descritivas básicas (mean/median/mode/min/max/range/distinctCount) | 🟢 Simples | 30min | núcleo |
| 3 | Dispersão (variance/stdDev/mad/cv) | 🟢 Simples | 30min | descritivas |
| 4 | Percentis + Quartis + IQR | 🟢 Simples | 30min | núcleo |
| 5 | Forma (skewness + kurtosis) | 🟢 Simples | 45min | descritivas |
| 6 | Detecção de outliers (3 métodos) | 🟢 Simples | 1h | quartis + descritivas |
| 7 | Regressão linear OLS | 🟢 Simples | 1h | núcleo |
| 8 | Regressão polinomial (Vandermonde + Gauss-Jordan) | 🟡 Média | 2h | linearRegression |
| 9 | Correlação Pearson | 🟢 Simples | 30min | núcleo |
| 10 | Correlação Spearman (ranks com empates) | 🟡 Média | 2h | correlation |
| 11 | Matriz de correlação | 🟢 Simples | 45min | correlation |
| 12 | Média móvel + exponential smoothing | 🟢 Simples | 30min | núcleo |
| 13 | Linear forecast | 🟢 Simples | 30min | linearRegression |
| 14 | Holt-Winters aditivo | 🟡 Média | 3h | linearRegression |
| 15 | K-means (Lloyd's) | 🟡 Média | 2h | nenhuma |
| 16 | Transformações (normalize/zScore/bucketize/lag) | 🟢 Simples | 45min | descritivas |
| 17 | Trend detection (direção + magnitude) | 🟢 Simples | 1h | linearRegression |
| 18 | Smart defaults (4 helpers: scatter/gauge/boxplot/sankey) | 🟡 Média | 4h | Stats inteiro + tipos do projeto |
| 19 | Aba "📈 Análise" no Props | 🔴 Complexa | 6-8h | Stats + Humanize + sistema de tabs + dicionário |
| 20 | Empty states humanos por componente | 🟢 Simples | 1h | nenhuma |
| 21 | Toast com smart hint após adicionar | 🟢 Simples | 30min | Toast + Stats.suggest* |
| 22 | Shim pattern (delegar lógica para módulo central) | 🟢 Simples | 30min | módulo de destino |

**Total para portar tudo:** ~35-40h (com testes). Feature 19 é a mais valiosa; as demais são building blocks.

---

## 🟢 FEATURE 1: Núcleo de limpeza estatística

### 📖 O que faz no Solstice

Recebe arrays heterogêneos (strings, NaN, null, undefined) e devolve apenas números válidos. Fundação para todas as outras funções estatísticas.

### 🎯 Por que vale portar

Qualquer cálculo em dados de produção tropeça em NaN/null. Isolar essa limpeza em uma função pura economiza dezenas de `.filter(v => !isNaN(v))` espalhados.

### 📍 Localização no código

| Tipo | Localização | Linhas |
|------|-------------|--------|
| JS  | `SolsticeStats.clean / sorted / sum / count / countNulls` | ~5440-5500 |

### 📝 Código fonte autônomo

```javascript
const Stats = {
  clean(values) {
    if (!values) return [];
    const out = [];
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v == null) continue;
      const n = typeof v === 'number' ? v : parseFloat(v);
      if (!isNaN(n) && isFinite(n)) out.push(n);
    }
    return out;
  },
  sorted(values) { return Stats.clean(values).sort((a, b) => a - b); },
  sum(values) { let s = 0; const c = Stats.clean(values); for (let i = 0; i < c.length; i++) s += c[i]; return s; },
  count(values) { return Stats.clean(values).length; },
  countNulls(values) {
    if (!values) return 0;
    let n = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v == null) { n++; continue; }
      const x = typeof v === 'number' ? v : parseFloat(v);
      if (isNaN(x) || !isFinite(x)) n++;
    }
    return n;
  }
};
```

### 🤖 Prompt sugerido para Eva

```
Eva, preciso adicionar funções utilitárias de limpeza estatística no projeto.
Tenho como referência este código vanilla:

[colar código acima]

Adapte para nosso projeto considerando:
- Stack atual: <descrever>
- Naming convention: <descrever>
- Se já temos Lodash/Ramda, pode usar `_.isFinite` etc.

Mantenha as funções puras (sem mutar input). Adicione testes:
- Stats.mean([1, '2', null, NaN, '3']) === 2
- Stats.countNulls([1, null, NaN, undefined, 'abc']) === 3
```

### ⚠️ Pegadinhas conhecidas

1. **'1e10' parseInt vs parseFloat**: usar parseFloat. parseInt corta exponencial.
2. **Strings vazias**: parseFloat('') === NaN — filtra corretamente.
3. **Boolean coerção**: `parseFloat(true) === NaN`. Não coerça true→1 silenciosamente, é proposital.

---

## 🟢 FEATURE 4: Percentis com interpolação linear

### 📖 O que faz no Solstice

Calcula percentis (P0, P25, P50=mediana, P75, P99 etc.) usando interpolação linear, equivalente ao tipo 7 do NumPy. Base para quartis e box plot.

### 🎯 Por que vale portar

Mediana e quartis são fundamentais em qualquer dashboard de risco. Ter uma função única que respeita um padrão estatístico conhecido (mesma do NumPy default) evita discrepâncias com modelos Python.

### 📝 Código fonte autônomo

```javascript
function percentile(values, p) {
  const c = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v))
                  .sort((a, b) => a - b);
  const n = c.length;
  if (!n) return null;
  if (p <= 0) return c[0];
  if (p >= 1) return c[n - 1];
  const i = (n - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? c[lo] : c[lo] + (c[hi] - c[lo]) * (i - lo);
}

function quartiles(values) {
  const q1 = percentile(values, 0.25);
  const median = percentile(values, 0.5);
  const q3 = percentile(values, 0.75);
  return q1 == null ? null : { q1, median, q3, iqr: q3 - q1 };
}
```

### 🤖 Prompt sugerido para Eva

```
Eva, preciso adicionar cálculo de percentis (compatível NumPy type-7).
Referência:

[colar código acima]

Validar com:
- percentile([1,2,3,4,5], 0.5) === 3
- percentile([1,2,3,4,5,6,7,8,9,10], 0.25) === 3.25  (interpolação)
- percentile([], 0.5) === null
```

### ⚠️ Pegadinhas

1. **Off-by-one nos percentis**: muitas libs usam (i = n * p) em vez de ((n-1) * p). Resultados diferentes. NumPy default usa (n-1)*p — este código também.
2. **Datasets pequenos**: percentil 1 em array de 3 elementos vira interpolação extrema.

---

## 🟢 FEATURE 7: Regressão linear OLS

### 📝 Código fonte autônomo

```javascript
function linearRegression(points) {
  if (!points || points.length < 2) return null;
  let n = 0, sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
  for (const p of points) {
    const x = parseFloat(p[0]), y = parseFloat(p[1]);
    if (isNaN(x) || isNaN(y)) continue;
    n++; sx += x; sy += y; sxy += x*y; sxx += x*x; syy += y*y;
  }
  if (n < 2) return null;
  const mx = sx / n, my = sy / n;
  const denom = sxx - n * mx * mx;
  if (denom === 0) return { slope: 0, intercept: my, r2: 0, n };
  const slope = (sxy - n * mx * my) / denom;
  const intercept = my - slope * mx;
  const ssTot = syy - n * my * my;
  let ssRes = 0;
  for (const p of points) {
    const pred = slope * p[0] + intercept;
    ssRes += (p[1] - pred) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
  return { slope, intercept, r2, n };
}
```

### ⚠️ Pegadinhas

1. **SS_tot = 0** (todos os y iguais): retorna r²=1 (perfeitamente "explicado" por uma constante).
2. **denom = 0** (todos os x iguais): regressão degenerada — slope = 0, intercept = média de y.
3. **Outliers** distorcem fortemente (OLS minimiza quadrados). Para robustez, considerar regressão por mediana.

---

## 🟢 FEATURE 9: Correlação Pearson

### 📝 Código fonte autônomo

```javascript
function correlation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  let nn = 0, sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const x = parseFloat(xs[i]), y = parseFloat(ys[i]);
    if (isNaN(x) || isNaN(y)) continue;
    nn++; sx += x; sy += y; sxy += x*y; sxx += x*x; syy += y*y;
  }
  if (nn < 2) return null;
  const num = nn * sxy - sx * sy;
  const den = Math.sqrt((nn * sxx - sx * sx) * (nn * syy - sy * sy));
  return den === 0 ? 0 : num / den;
}
```

### 🤖 Prompt sugerido para Eva

```
Eva, preciso de correlação Pearson para detectar relações lineares entre métricas.
Vou colocar isso no painel de "Análise de Carteira" do nosso dashboard.
Referência abaixo. Valida com:
- correlation([1,2,3], [1,2,3]) === 1
- correlation([1,2,3], [3,2,1]) === -1
- correlation([1,1,1], [1,2,3]) === 0  (denominador zero)

[colar código]

Se tivermos lib estatística no projeto (jStat), prefira ela mas mantenha esta como fallback.
```

---

## 🟡 FEATURE 14: Holt-Winters aditivo (forecast com sazonalidade)

### 📖 O que faz no Solstice

Forecast univariado com componentes de nível, tendência e sazonalidade. Versão "simplificada" usa hiperparâmetros fixos (α=0.5, β=0.3, γ=0.3) — suficiente para horizonte curto.

### 🎯 Por que vale portar

Itaú trabalha com séries sazonais (vendas diárias, captação mensal). Forecast simples sem ARIMA-fitting é o que stakeholders pedem em 80% dos casos.

### 📝 Código fonte autônomo

```javascript
function holtWinters(values, n, season) {
  const c = values.filter(v => typeof v === 'number' && !isNaN(v));
  const S = Math.max(1, season || 12);
  const steps = n || S;
  if (c.length < 2 * S) {
    // fallback: linear forecast
    const reg = linearRegression(c.map((y, i) => [i, y]));
    if (!reg) return [];
    const out = [];
    for (let i = 0; i < steps; i++) out.push(reg.slope * (c.length + i) + reg.intercept);
    return out;
  }
  const alpha = 0.5, beta = 0.3, gamma = 0.3;
  let L = c.slice(0, S).reduce((a, b) => a + b, 0) / S;
  const init = linearRegression(c.slice(0, S).map((y, i) => [i, y]));
  let T = init ? init.slope : 0;
  const seas = new Array(S);
  for (let i = 0; i < S; i++) seas[i] = c[i] - L;
  for (let t = S; t < c.length; t++) {
    const Lprev = L, Tprev = T;
    L = alpha * (c[t] - seas[t % S]) + (1 - alpha) * (Lprev + Tprev);
    T = beta * (L - Lprev) + (1 - beta) * Tprev;
    seas[t % S] = gamma * (c[t] - L) + (1 - gamma) * seas[t % S];
  }
  const out = [];
  for (let h = 1; h <= steps; h++) {
    out.push(L + h * T + seas[(c.length + h - 1) % S]);
  }
  return out;
}
```

### ⚠️ Pegadinhas

1. **Precisa de ≥ 2 ciclos sazonais** para inicializar. Senão cai em linear.
2. **Sazonalidade default = 12** (mensal). Para diário com semana, usar `season = 7`.
3. **Hiperparâmetros fixos**: para uso crítico, fitar via grid search ou Brent.

---

## 🟡 FEATURE 18: Smart defaults para componentes

### 📖 O que faz no Solstice

Quando o usuário clica "adicionar componente" (scatter/gauge/boxplot/sankey), em vez de chumbar configs aleatórias, calcula sugestões inteligentes baseadas no dataset.

### 🎯 Por que vale portar

A barreira de uso de um BI é "adicionei o gráfico e ele veio vazio/confuso". Smart defaults eliminam essa fricção — o gráfico já aparece com história.

### 📝 Código fonte autônomo (suggestGauge)

```javascript
function suggestGauge(rows, columns, types, dictionary) {
  function colGroup(c) { return types[c] && types[c].group; }
  function isPercentage(c) { return types[c] && types[c].type === 'percentage'; }

  const pctCol = columns.find(isPercentage);
  const col = pctCol || columns.find(c => colGroup(c) === 'numeric');
  if (!col) return { column: null, agg: 'avg', min: 0, max: 100, target: null };

  const vals = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
  if (!vals.length) return { column: col, agg: 'avg', min: 0, max: 100, target: null };

  if (pctCol) return { column: col, agg: 'avg', min: 0, max: 100, target: 80 };

  function pct(p) {
    const s = vals.slice().sort((a, b) => a - b);
    const i = (s.length - 1) * p;
    const lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
  }
  function roundNice(v, dir) {
    if (v === 0) return 0;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))));
    const step = mag / 2;
    return dir === 'floor' ? Math.floor(v / step) * step : Math.ceil(v / step) * step;
  }

  const lo = roundNice(pct(0.05), 'floor');
  const hi = roundNice(pct(0.95), 'ceil');
  const dictCol = dictionary && dictionary.columns && dictionary.columns[col];
  const hib = dictCol && dictCol.higherIsBetter;
  const target = hib === true ? pct(0.75) : hib === false ? pct(0.25) : pct(0.5);
  return { column: col, agg: 'avg', min: lo, max: hi, target };
}
```

### 🤖 Prompt sugerido para Eva

```
Eva, no nosso dashboard de carteira PJ temos um Gauge para "% inadimplência".
Hoje o range vem 0-100 fixo, mas para "valor de provisão" (em R$ milhões)
ficar agulha colada no início é ruim.

Quero replicar a estratégia smart default: P5-P95 do dataset com arredondamento amigável,
e meta baseada em higherIsBetter do dicionário semântico.

[colar código acima]

Adapta para nosso projeto:
- types/dictionary têm shape <descrever>
- Para "% inadimplência": higherIsBetter=false → target=P25
- Para "ROE": higherIsBetter=true → target=P75
```

### ⚠️ Pegadinhas

1. **roundNice** usa potência de 10 / 2. Para valores absurdos (R$ 1e9) pode arredondar muito grosseiro.
2. **higherIsBetter null**: cai em mediana — neutro, mas usuário pode estranhar.

---

## 🔴 FEATURE 19: Aba "📈 Análise" no Props

### 📖 O que faz no Solstice

Quinta aba do painel de Propriedades. Mostra automaticamente estatísticas relevantes ao componente selecionado: descritiva universal + extras contextuais (correlação para scatter, tendência+forecast para time-series, distância da meta para gauge, por-grupo para boxplot agrupado).

### 🎯 Por que vale portar

É o **diferencial educacional** do Solstice. Stakeholder pergunta "por que esse número?" → painel já responde sem dev escrever query. No Itaú, isso reduz tickets a analytics em N%.

### 📍 Localização no código

| Tipo | Localização | Linhas |
|------|-------------|--------|
| CSS | `.solstice__stats-*` (8 classes) | ~1120-1170 |
| JS  | `SolsticeProps._renderStatsTab` | ~8000-8200 |
| Integração | tab adicionada em `allTabs` array do `render()` | ~6928 |

### 🔗 Dependências

**Obrigatórias:**
- `Stats.describe()` (FEATURE 22 do índice)
- Sistema de tabs no Props (custom ou shadcn `<Tabs>`)
- Função `Humanize.column()` (mapear nome técnico → friendly)
- Dicionário semântico (opcional mas recomendado)

### 📝 Estrutura essencial

```javascript
function renderStatsTab(host, slot, def) {
  function primaryNumericColumn() {
    if (def.id === 'kpi' || def.id === 'distribution' || def.id === 'gauge') return slot.config.column;
    if (def.id === 'time-series' || def.id === 'scatter') return slot.config.yColumn;
    if (def.id === 'boxplot') return slot.config.valueColumn;
    return null;
  }
  const col = primaryNumericColumn();
  if (!col) {
    host.appendChild(el('div', { class: 'stats-empty' }, 'Configure ao menos uma coluna numérica.'));
    return;
  }
  const values = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
  const desc = Stats.describe(values);

  // 1. Cabeçalho explicativo
  host.appendChild(el('div', { class: 'stats-explain' },
    el('strong', null, '🔬 Por que esse número?'),
    el('div', null, 'Análise calculada sobre ' + desc.n + ' valores de "' + friendlyName(col) + '"' +
      (desc.nulls ? ' (' + desc.nulls + ' nulos ignorados)' : '') + '.')));

  // 2. Seções universais (4)
  appendSection('📊 Distribuição central', [
    ['Média', fmt(desc.mean)],
    ['Mediana', fmt(desc.median)],
    ['Desvio padrão', fmt(desc.stdDev)],
  ]);
  appendSection('📏 Faixa e quartis', [
    ['Mínimo', fmt(desc.min)],
    ['Q1 (25%)', fmt(desc.q1)],
    ['Q3 (75%)', fmt(desc.q3)],
    ['Máximo', fmt(desc.max)],
    ['IQR', fmt(desc.iqr)],
  ]);
  // Forma + Outliers similar...

  // 3. Seções contextuais por tipo de componente
  if (def.id === 'time-series') {
    const t = Stats.trend(values);
    // ...
  }
  if (def.id === 'scatter') {
    const r = Stats.correlation(...);
    // ... nota se |ρ| - |r| > 0.15
  }
  // etc.

  // 4. Footer com snippet de console
  host.appendChild(el('div', { class: 'stats-footer' },
    '🔬 Console: Stats.describe(rows.map(r => parseFloat(r[\'' + col + '\']))) — reproduz estas métricas.'));
}
```

### 🤖 Prompt sugerido para Eva

```
Eva, preciso adicionar uma aba "📈 Análise" no nosso painel lateral de propriedades
de componente. A ideia: quando o usuário seleciona um KPI/gráfico, a aba mostra
estatísticas descritivas + contextuais explicando o número.

Tenho como referência este código vanilla, com seções universais + contextuais por
tipo de componente:

[colar estrutura essencial + Stats acima]

Adapte para nosso projeto:
- Sistema de tabs: <usamos shadcn Tabs>
- Componentes registrados: <lista IDs>
- Stack: React + TypeScript
- Estado: <descrever>
- Já temos jStat? Se sim, mapear funções

Implemente passo a passo:
1. Adicionar 'stats' ao array de tabs do props panel
2. Componente <StatsTab slot={slot} /> renderiza condicionalmente
3. Reutilize seções universais via helper <StatSection title={...} rows={...} />
4. Para cada tipo de componente, adicione um sub-componente <StatsContext-{type} />
```

### ⚠️ Pegadinhas

1. **Performance:** describe recalcula a cada render. Para datasets 100k+, memoize por (col, rowsHash).
2. **Trend.direction = 'flat'** se magnitude < 2%. Em séries muito estáveis, isso é correto mas pode confundir.
3. **Forecast linear assume índice = tempo**. Se as datas têm intervalos irregulares, distorce. Para Itaú onde batidas são diárias, ok.

### ✅ Como testar

1. Carregar dataset → adicionar KPI → selecionar → aba Análise → verificar todas as seções
2. Mudar coluna no aba Dados → aba Análise recalcula
3. Adicionar Time Series → aba mostra seção Tendência com R² próximo de 1 para dados lineares
4. Adicionar Scatter de duas colunas correlacionadas → r próximo de ρ, sem nota
5. Adicionar Scatter de duas colunas com relação exponencial → r baixo, ρ alto, nota aparece

---

## 🟢 FEATURE 20: Empty states humanos

### 📖 O que faz no Solstice

Em vez de "Selecione coluna X em ⚙️", as mensagens vazias explicam o ESTADO REAL: "Scatter precisa de 2 numéricas, seu dataset tem 1" / "Origem e destino devem ser DIFERENTES".

### 🎯 Por que vale portar

Reduz tickets de suporte. Stakeholder lê e entende sem perguntar.

### 📝 Exemplo (Sankey, 4 variantes)

```javascript
if (!cfg.sourceColumn || !cfg.targetColumn) {
  const cats = columns.filter(c => isCategorical(c));
  let msg;
  if (cats.length === 0) {
    msg = 'Sankey precisa de pelo menos 2 colunas categóricas. Seu dataset não tem nenhuma.';
  } else if (cats.length === 1) {
    msg = 'Sankey precisa de 2 categóricas distintas. Seu dataset tem só uma: "' + friendly(cats[0]) +
          '". Importe outro CSV ou use Distribuição.';
  } else if (cfg.sourceColumn === cfg.targetColumn) {
    msg = 'Origem e destino devem ser colunas DIFERENTES. Ajuste em ⚙️ Configurar.';
  } else {
    msg = 'Selecione duas colunas categóricas distintas em ⚙️ Configurar.';
  }
  host.appendChild(el('div', { class: 'comp-empty' }, msg));
  return;
}
```

### 🤖 Prompt sugerido para Eva

```
Eva, refatora empty states dos nossos componentes de gráfico para serem context-aware
em vez de genéricos. Exemplo do que quero (Sankey com 4 variantes):

[colar código acima]

Aplica a mesma lógica em:
- Bar chart: precisa de 1 categórica + 1 numérica → mensagens conforme dataset
- Line chart: precisa de 1 temporal + 1 numérica
- Scatter: precisa de 2 numéricas
- Pie: precisa de 1 categórica
```

---

## 🟢 FEATURE 22: Shim pattern (refactor sem breaking)

### 📖 O que faz no Solstice

Helpers privados do B6 (`_linearRegression`, `_kMeans`, `_quartiles`) continuam existindo, mas viraram thin shims que delegam a `SolsticeStats`. Resultado: componentes consumidores não mudam, mas a lógica vive em 1 lugar.

### 🎯 Por que vale portar

Padrão essencial em refactors grandes sem virar PR de 5k linhas.

### 📝 Código fonte autônomo

```javascript
// ANTES: helper inline com 40 linhas de cálculo
function _quartiles(values) { /* 40 linhas */ }

// DEPOIS: shim de 8 linhas que delega
function _quartiles(values) {
  const q = Stats.quartiles(values);
  if (!q) return null;
  const ou = Stats.outliersIQR(values, 1.5);
  const inliers = Stats.sorted(values).filter(v => v >= ou.fences.lo && v <= ou.fences.hi);
  return {
    q1: q.q1, median: q.median, q3: q.q3,
    min: inliers.length ? inliers[0] : q.min,
    max: inliers.length ? inliers[inliers.length - 1] : q.max,
    outliers: ou.values
  };
}
```

### ⚠️ Pegadinha

Shim precisa adaptar shape quando o output do legado não bate com o do novo módulo. No exemplo acima, o componente Box Plot esperava `min/max` excluindo outliers (whisker tradicional) — o shim faz essa adaptação.

---

## 🟥 RESUMO DO BLOCO

### Features mais valiosas para portar primeiro

1. **🔴 Aba "📈 Análise"** (Feature 19) — alta utilidade educacional, redução de tickets, diferencial competitivo
2. **🟡 Smart defaults** (Feature 18) — reduz fricção de uso direto e mensurável (% de gráficos vazios)
3. **🟢 Correlação Pearson + Spearman** (Features 9, 10) — base para qualquer análise exploratória de carteira
4. **🟡 Holt-Winters** (Feature 14) — forecast simples cobre 80% dos pedidos de stakeholders
5. **🟢 Empty states humanos** (Feature 20) — quick win, 1 dia para refazer todos os componentes

### Features que NÃO vale portar isoladamente

- **Trend detection** (Feature 17) — só faz sentido se já tiver linearRegression
- **Smart defaults** (Feature 18) — depende de TYPES e dicionário do projeto destino; portar antes de ter esses é prematuro
- **Aba Análise** — depende de sistema de tabs E de Stats; só portar quando ambos existirem

### Recomendação específica para projeto Itaú

**Sequência sugerida (8-10 sprints de 1 semana):**

1. **Sprint 1:** Núcleo + Descritivas (Features 1-3) — fundação portátil, zero acoplamento
2. **Sprint 2:** Percentis + Quartis + Outliers (Features 4, 6) — adiciona valor imediato no painel de risco
3. **Sprint 3:** Regressão linear + Correlação (Features 7, 9) — habilita scatter educativo
4. **Sprint 4-5:** Holt-Winters + Linear Forecast (Features 13, 14) — entrega forecast para captação/inadimplência
5. **Sprint 6-7:** Aba "📈 Análise" (Feature 19) — diferencial completo
6. **Sprint 8:** Smart defaults (Feature 18) — quando tipos do projeto estiverem estáveis

**Stack do Itaú via Eva:**
- React/Next provavelmente — `Stats` vira `utils/stats.ts` autossuficiente
- Estado: se Redux, criar selector `selectStatsByColumn(col)` memoizado por dataset hash
- Performance: para carteiras 500k+, mover Stats para WebWorker via Comlink
- Dicionário: o projeto Itaú provavelmente já tem mapping interno coluna→friendly — adaptar `column(name, dict)` aceitando o shape interno

**ROI estimado:** 35-40h de port direto + 15h de adaptação = ~55h. Equivale a uma sprint inteira de 1 dev sênior. Em troca: capacidade analítica que hoje custa horas/semana em queries ad-hoc.
