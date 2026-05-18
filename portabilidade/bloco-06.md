# PORTABILIDADE — Bloco 6: 6 Componentes Avançados + Box Plot + Sankey

> Documento gerado automaticamente. Como portar cada feature para outros projetos, especialmente o projeto Itaú via Eva.

---

## 📋 ÍNDICE DE FEATURES PORTÁVEIS

| # | Feature | Complexidade | Tempo estimado | Dependências |
|---|---------|--------------|----------------|--------------|
| 1 | Scatter SVG com regressão linear + clusters K-means | 🟡 Média | 4-6h | helpers stats |
| 2 | Heatmap Calendário (GitHub-style) SVG | 🟢 Simples | 2-3h | data agregada |
| 3 | Gauge / Velocímetro SVG nativo | 🟢 Simples | 2-3h | nenhuma |
| 4 | Markdown parser inline com placeholders dinâmicos | 🟡 Média | 3-4h | Store reativo |
| 5 | Box Plot SVG com quartis e outliers IQR | 🟡 Média | 3-4h | quartis helper |
| 6 | Sankey diagram SVG simplificado (2 níveis) | 🟡 Média | 4-6h | nenhuma |
| 7 | Helpers estatísticos puros (regressão / k-means / quartis) | 🟢 Simples | 2-3h | nenhuma |

---

## 🟡 FEATURE 1: Scatter SVG com regressão linear + clusters K-means

### 📖 O que faz no Solstice

SVG 480×280 com pontos representando pares (x, y) de duas colunas numéricas. Opcionalmente: tamanho do ponto proporcional a uma 3ª coluna ("bubble"), linha de regressão linear (OLS) com R² visível, K-means clustering pintando pontos em até 8 cores. Tooltip por ponto com valores formatados.

### 🎯 Por que vale portar

Análise de correlação é o pão-com-manteiga de qualquer time analítico. Para Itaú: relação entre renda e inadimplência, ticket médio vs frequência de compra, exposição × prazo médio. Sem libs (Chart.js, D3) — SVG cru, integrável em qualquer página.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `register({ id:'scatter' })` | ~5800-5920 |
| Helpers | `_linearRegression`, `_kMeans` | ~5750-5798 |
| CSS | `.solstice__scatter-*` | ~795-825 |

### 🔗 Dependências

- `_linearRegression(points)` (Feature 7)
- `_kMeans(points, k)` (Feature 7)
- Locale para formatação numérica (opcional)

### 📝 Código fonte autônomo (esqueleto)

```javascript
function renderScatter(host, { points, sizeVals, showRegression, clusters }){
  const W = 480, H = 280, pad = 36;
  const xs = points.map(p => p[0]); const ys = points.map(p => p[1]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xR = xMax - xMin || 1; const yR = yMax - yMin || 1;
  function px(x){ return pad + ((x - xMin) / xR) * (W - 2*pad); }
  function py(y){ return H - pad - ((y - yMin) / yR) * (H - 2*pad); }

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Pontos
  const clusterIds = clusters >= 2 ? kMeans(points, Math.min(clusters, 8)) : null;
  points.forEach((p, i) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', px(p[0])); c.setAttribute('cy', py(p[1]));
    c.setAttribute('r', sizeVals ? (2 + ((sizeVals[i] - Math.min(...sizeVals)) / (Math.max(...sizeVals) - Math.min(...sizeVals))) * 8) : 3);
    c.setAttribute('fill', clusterIds ? CLUSTER_COLORS[clusterIds[i] % 8] : '#2563EB');
    c.setAttribute('opacity', 0.6);
    svg.appendChild(c);
  });

  // Regressão
  if (showRegression){
    const reg = linearRegression(points);
    if (reg){
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', px(xMin)); line.setAttribute('y1', py(reg.slope * xMin + reg.intercept));
      line.setAttribute('x2', px(xMax)); line.setAttribute('y2', py(reg.slope * xMax + reg.intercept));
      line.setAttribute('stroke', '#F59E0B'); line.setAttribute('stroke-width', 2);
      line.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(line);
      // r² text...
    }
  }
  host.appendChild(svg);
}
```

### 🤖 Prompt para Eva

```
Eva, scatter plot SVG vanilla com regressão linear opcional.
Sem D3, sem Chart.js — SVG cru.

Referência:

[colar JS + CSS]

Adaptar:
- Cores Itaú nas variantes de cluster
- Eixos com labels da coluna selecionada
- Hover state que destaca todos os pontos do mesmo cluster
- Export SVG → PNG para apresentações

Aplicar em:
- Risco × Retorno (carteira de investimentos)
- Receita × Inadimplência (carteira PJ)
- Idade × Limite (perfil de crédito)
```

### ⚠️ Pegadinhas

1. **Pontos sobrepostos**: dataset com 5000 pontos vira blob. Considerar amostragem ou binning hexagonal.
2. **`linearRegression` com x constante** → `slope = NaN`. Wrap em try/catch.
3. **K-means inicialização**: pontos espaçados igualmente. Para resultados consistentes, considerar k-means++.
4. **Eixos x e y com escalas muito diferentes** (ex: 0-1 vs 0-1M): considerar normalização visual ou log-scale.

### ✅ Como testar

1. Scatter com 200 pontos correlacionados → linha de regressão visível, r² > 0.7
2. Aleatórios → r² próximo de 0
3. Clusters = 3 → cores distintas
4. Hover ponto → tooltip com valores corretos

### 🔄 Variações

- **Hexbin** para densidade alta
- **Density contour** sobreposto
- **Brushable**: arrastar área seleciona pontos (cross-filter no B9)

---

## 🟢 FEATURE 2: Heatmap Calendário (GitHub-style) SVG

### 📖 O que faz no Solstice

Renderiza atividade diária ao longo de um período em estilo "GitHub contributions". Cada dia vira uma célula 11×11 colorida em 5 níveis de intensidade (0 = cinza, 4 = accent forte). Meses em colunas. Tooltips por célula com `data + valor`.

### 🎯 Por que vale portar

Padrão visual reconhecível para "atividade ao longo do tempo". Itaú: heatmap de operações por dia, transações por canal, eventos de risco. Identifica padrões sazonais e dias atípicos instantaneamente.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `register({ id:'heatmap-cal' })` | ~5925-5985 |
| CSS | `.solstice__heat-cal-*` | ~828-860 |

### 🔗 Dependências

Locale para formatação de datas (opcional).

### 📝 Código fonte autônomo

```javascript
function renderCalendarHeatmap(host, { rows, dateColumn, valueColumn, agg }){
  // Agrega por dia
  const byDay = new Map();
  let dMin = null, dMax = null;
  for (const r of rows){
    const d = new Date(r[dateColumn]);
    if (isNaN(d)) continue;
    const key = d.toISOString().slice(0,10);
    let v = (agg === 'count' || !valueColumn) ? 1 : parseFloat(r[valueColumn]);
    if (isNaN(v)) v = 0;
    byDay.set(key, (byDay.get(key) || 0) + v);
    if (!dMin || d < dMin) dMin = d;
    if (!dMax || d > dMax) dMax = d;
  }
  const vMax = Math.max(...byDay.values());
  function level(v){
    if (!v) return 0;
    const r = v / vMax;
    if (r > 0.75) return 4;
    if (r > 0.5)  return 3;
    if (r > 0.25) return 2;
    return 1;
  }

  // Renderiza coluna por mês
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const wrap = document.createElement('div'); wrap.className = 'heat-cal-wrap';
  const cursor = new Date(dMin.getFullYear(), dMin.getMonth(), 1);
  const endMonth = new Date(dMax.getFullYear(), dMax.getMonth() + 1, 0);
  while (cursor <= endMonth){
    const monthBox = document.createElement('div'); monthBox.className = 'heat-cal-month';
    const label = document.createElement('div'); label.className = 'heat-cal-month-label';
    label.textContent = MESES[cursor.getMonth()];
    monthBox.appendChild(label);
    const week = document.createElement('div'); week.className = 'heat-cal-week';
    const lastDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= lastDate; day++){
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      const key = d.toISOString().slice(0,10);
      const v = byDay.get(key) || 0;
      const cell = document.createElement('div');
      cell.className = 'heat-cal-cell';
      cell.setAttribute('data-level', level(v));
      cell.title = `${d.toLocaleDateString('pt-BR')} · ${v.toLocaleString('pt-BR')}`;
      week.appendChild(cell);
    }
    monthBox.appendChild(week);
    wrap.appendChild(monthBox);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  host.appendChild(wrap);
}
```

```css
.heat-cal-wrap { display: flex; gap: 2px; }
.heat-cal-month { display: flex; flex-direction: column; gap: 2px; }
.heat-cal-week { display: flex; flex-direction: column; gap: 2px; }
.heat-cal-cell { width: 11px; height: 11px; border-radius: 2px; transition: transform 150ms; }
.heat-cal-cell:hover { transform: scale(1.3); outline: 1px solid currentColor; }
.heat-cal-cell[data-level="0"] { background: #ebedf0; }
.heat-cal-cell[data-level="1"] { background: #9be9a8; }
.heat-cal-cell[data-level="2"] { background: #40c463; }
.heat-cal-cell[data-level="3"] { background: #30a14e; }
.heat-cal-cell[data-level="4"] { background: #216e39; }
```

### 🤖 Prompt para Eva

```
Eva, heatmap calendário estilo GitHub para visualizar atividade diária.

Referência:

[colar JS + CSS]

Adapte:
- Paleta Itaú (azul ou laranja no lugar do verde)
- Range padrão: últimos 12 meses (não range do dataset)
- Click numa célula → drill-down para detalhe daquele dia
- Toggle quarter/month/year view
```

### ⚠️ Pegadinhas

1. **Range muito longo** (5+ anos) vira denso. Considerar `auto` que reduz para últimos 12 meses se range > 365 dias.
2. **Timezone**: `new Date(string)` vs `new Date(year, month, day)` podem dar dias diferentes. Padronize.
3. **Fim de semana visualmente igual** a dia útil. Considerar tom diferente para sáb/dom.

### ✅ Como testar

1. Range 90 dias → 3 colunas (meses) com células coloridas
2. Range 365 dias → 12 colunas
3. Dia com valor máximo → cor mais intensa
4. Dia sem dado → cinza

### 🔄 Variações

- **Week view**: linhas horizontais por dia da semana, colunas por semana
- **Quarter view**: 4 trimestres em vez de 12 meses
- **Multi-métrica**: 2 datasets sobrepostos (canvas com 2 layers)

---

## 🟢 FEATURE 3: Gauge / Velocímetro SVG nativo

### 📖 O que faz no Solstice

Arc 180° (semicírculo) com agulha apontando para valor atual. Configs `min`/`max`/`target`. Zonas coloridas (verde até target, amarelo target→atual se ultrapassou). Tick vermelho destaca a meta. Valor central grande.

### 🎯 Por que vale portar

Visualização canônica para "atingiu / não atingiu meta". Itaú: SLA, % de aprovação, taxa de conversão, capital regulatório.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `register({ id:'gauge' })` | ~5990-6090 |
| CSS | `.solstice__gauge-*` | ~863-885 |

### 🔗 Dependências

Nenhuma.

### 📝 Código fonte autônomo

```javascript
function renderGauge(host, { value, min, max, target }){
  const W = 280, H = 180, cx = W/2, cy = H - 20, R = 100;
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (max - min) === 0 ? 0 : (clamped - min) / (max - min);
  function angle(r){ return Math.PI + r * Math.PI; }
  function pt(r){ const a = angle(r); return [cx + R*Math.cos(a), cy + R*Math.sin(a)]; }
  function arcPath(s, e){
    const [x1,y1] = pt(s); const [x2,y2] = pt(e);
    const large = (e - s) > 0.5 ? 1 : 0;
    return `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Background arc
  const bg = document.createElementNS(NS, 'path');
  bg.setAttribute('d', arcPath(0, 1));
  bg.setAttribute('stroke', '#e5e7eb'); bg.setAttribute('stroke-width', 18); bg.setAttribute('fill', 'none');
  svg.appendChild(bg);

  // Fill arc (até target = verde, depois amarelo)
  const targetRatio = target != null ? (target - min) / (max - min) : null;
  if (targetRatio != null){
    const greenEnd = Math.min(ratio, targetRatio);
    if (greenEnd > 0){
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', arcPath(0, greenEnd));
      p.setAttribute('stroke', '#16A34A'); p.setAttribute('stroke-width', 18); p.setAttribute('fill', 'none');
      svg.appendChild(p);
    }
    if (ratio > targetRatio){
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', arcPath(targetRatio, ratio));
      p.setAttribute('stroke', '#FBBF24'); p.setAttribute('stroke-width', 18); p.setAttribute('fill', 'none');
      svg.appendChild(p);
    }
  }

  // Agulha
  const [nx, ny] = pt(ratio);
  const needle = document.createElementNS(NS, 'line');
  needle.setAttribute('x1', cx); needle.setAttribute('y1', cy);
  needle.setAttribute('x2', nx); needle.setAttribute('y2', ny);
  needle.setAttribute('stroke', '#111827'); needle.setAttribute('stroke-width', 2);
  svg.appendChild(needle);

  // Valor central
  const txt = document.createElementNS(NS, 'text');
  txt.setAttribute('x', cx); txt.setAttribute('y', cy - 24); txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('font-size', '28'); txt.setAttribute('font-weight', 'bold');
  txt.textContent = value.toFixed(1);
  svg.appendChild(txt);
  host.appendChild(svg);
}
```

### 🤖 Prompt para Eva

```
Eva, gauge SVG para indicadores de meta.

Referência:

[colar JS]

Adapte:
- Zonas customizáveis (não só verde até target): zona verde [0..warn], amarela [warn..target], vermelha [target..max]
- Animação ao mudar valor (transition CSS no needle)
- Inverter polaridade: para inadimplência, "abaixo da meta" deve ser verde (não acima)
```

### ⚠️ Pegadinhas

1. **`min === max`** → divisão por zero. Wrap em condicional retornando ratio = 0.
2. **Value fora do range** → clamped corretamente, mas agulha fica na borda. Considerar exibir aviso.
3. **Target = null** → renderiza arc accent sem zonas. Trade-off OK.
4. **WCAG**: verde/amarelo/vermelho podem confundir daltonismo. Adicionar ícone ✓/⚠️/✕ junto.

### ✅ Como testar

1. value=50, min=0, max=100, target=70 → agulha na metade, arc verde até 50, sem amarelo
2. value=85, target=70 → agulha além de target, arc verde até 70 + amarelo de 70-85
3. value abaixo de min → agulha no min, valor exibido o original

### 🔄 Variações

- **Bullet chart** (Stephen Few): variante mais densa que cabe em linha
- **Linear progress bar**: para casos sem necessidade de semicírculo
- **Multi-target**: bandas com 3 metas (mínima, esperada, excelente)

---

## 🟡 FEATURE 4: Markdown parser inline com placeholders dinâmicos

### 📖 O que faz no Solstice

Parser regex puro renderizando: H1/H2/H3, **bold**, *italic*, \`code\`, listas com `- `, links `[txt](url)`. Diferencial: placeholders `{{path.no.store}}` substituídos por valores via `Store.get(path)` — texto vira dinâmico, atualiza quando estado muda. XSS-safe via escape HTML automático.

### 🎯 Por que vale portar

Textos explicativos em dashboards quase sempre precisam de algum dado dinâmico ("Receita total: R$ X"). Markdown puro custa libs externas; Markdown com placeholders dinâmicos custa libs + framework reativo. Solução aqui é zero-dep e funciona com qualquer store.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `register({ id:'markdown' })` + `_renderMarkdown` | ~6095-6175 |
| CSS | `.solstice__md*` | ~888-918 |

### 🔗 Dependências

Store reativo (para `get(path)`).

### 📝 Código fonte autônomo

```javascript
function renderMarkdown(text){
  const wrap = document.createElement('div'); wrap.className = 'md';

  // 1. Substitui placeholders {{path}} por <span> com valor do store
  const withVars = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, p) => {
    const v = Store.get(p);
    if (v == null) return `<span class="md-placeholder">{{${p}}}</span>`;
    if (typeof v === 'object') return `<span class="md-placeholder">${p}</span>`;
    return String(v);
  });

  // 2. Escape HTML (preservando placeholders já gerados)
  function esc(s){ return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

  // 3. Linha-a-linha, gera HTML
  let html = '';
  let inList = false;
  for (const line of withVars.split(/\n/)){
    let m;
    if ((m = line.match(/^###\s+(.+)$/))){ if (inList){ html+='</ul>'; inList=false; } html += `<h3>${inline(m[1])}</h3>`; continue; }
    if ((m = line.match(/^##\s+(.+)$/))) { if (inList){ html+='</ul>'; inList=false; } html += `<h2>${inline(m[1])}</h2>`; continue; }
    if ((m = line.match(/^#\s+(.+)$/)))  { if (inList){ html+='</ul>'; inList=false; } html += `<h1>${inline(m[1])}</h1>`; continue; }
    if ((m = line.match(/^[-*]\s+(.+)$/))) { if (!inList){ html += '<ul>'; inList = true; } html += `<li>${inline(m[1])}</li>`; continue; }
    if (inList){ html += '</ul>'; inList = false; }
    if (line.trim() === '') continue;
    html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += '</ul>';
  wrap.innerHTML = html;
  return wrap;

  // Inline preserving placeholders, escaping everything else
  function inline(s){
    const parts = s.split(/(<span class="md-placeholder">.*?<\/span>)/g);
    return parts.map(p => {
      if (p.startsWith('<span class="md-placeholder">')) return p;
      let out = esc(p);
      out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
      out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return out;
    }).join('');
  }
}
```

### 🤖 Prompt para Eva

```
Eva, parser Markdown inline + placeholders dinâmicos para textos
explicativos em dashboards.

Sem libs (marked, markdown-it). Zero deps.

Referência:

[colar JS]

Adapte:
- Adicionar suporte a tabelas (regex de pipes |)
- Code blocks multi-linha com ```
- Footnotes [^1]
- Sintaxe customizada Itaú: {{format:currency:campo}} → formatado como moeda
```

### ⚠️ Pegadinhas

1. **XSS**: SEMPRE escape conteúdo do usuário. Whitelist de tags geradas pelo parser.
2. **Markdown malformado** (`**unclosed`) renderiza como texto + estrelas — aceitável.
3. **Placeholders aninhados** `{{a.{{b}}}}` não suportados. Adicionar se necessário com loop.
4. **`Store.get()` retornando objeto/array** vira placeholder visual — evita renderizar `[object Object]`.
5. **Performance**: re-render a cada mudança de Store. Para dashboards densos, debounce.

### ✅ Como testar

1. `# Header` → `<h1>`
2. `**bold** *italic* \`code\`` → tags renderizadas
3. `- a\n- b` → `<ul><li>a</li><li>b</li></ul>`
4. `{{dataset.name}}` com dataset carregado → nome real
5. `{{path.inexistente}}` → placeholder visual
6. `<script>alert(1)</script>` → escape, não executa

### 🔄 Variações

- **Live preview** num editor markdown (split-pane)
- **Citação `>`**: blockquote
- **Imagens `![alt](url)`**: cuidado com origem

---

## 🟡 FEATURE 5: Box Plot SVG com quartis e outliers IQR

### 📖 O que faz no Solstice

SVG com box (Q1 → Q3), median line, whiskers (até 1.5×IQR), outliers como pontos vermelhos. Agrupamento por coluna categórica opcional (até 8 grupos top por contagem, lado a lado). Y axis com ticks.

### 🎯 Por que vale portar

Padrão estatístico canônico para distribuição. Itaú: distribuição de exposição por segmento, prazo médio por produto, ticket por canal. Identifica skew e outliers de imediato.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `register({ id:'boxplot' })` | ~6180-6300 |
| Helper | `_quartiles(values)` | ~5783 |
| CSS | `.solstice__boxplot-*` | ~920-948 |

### 🔗 Dependências

`_quartiles(values)` (Feature 7).

### 📝 Código fonte autônomo (esqueleto, ver dashboard.html para versão completa)

```javascript
function renderBoxplot(host, { groups, allVals }){
  const W = 480, H = 280, padL = 50, padR = 20, padT = 20, padB = 40;
  const yMin = Math.min(...allVals), yMax = Math.max(...allVals);
  const yR = yMax - yMin || 1;
  const innerH = H - padT - padB;
  const slot_w = (W - padL - padR) / groups.length;

  function py(v){ return padT + innerH - ((v - yMin) / yR) * innerH; }

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');

  groups.forEach((g, i) => {
    const cx = padL + i * slot_w + slot_w / 2;
    const boxW = Math.min(40, slot_w * 0.5);

    // Box Q1-Q3
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', cx - boxW/2);
    rect.setAttribute('y', py(g.q.q3));
    rect.setAttribute('width', boxW);
    rect.setAttribute('height', py(g.q.q1) - py(g.q.q3));
    rect.setAttribute('fill', '#2563EB'); rect.setAttribute('fill-opacity', 0.4);
    rect.setAttribute('stroke', '#2563EB');
    svg.appendChild(rect);

    // Median line
    const med = document.createElementNS(NS, 'line');
    med.setAttribute('x1', cx - boxW/2); med.setAttribute('x2', cx + boxW/2);
    med.setAttribute('y1', py(g.q.median)); med.setAttribute('y2', py(g.q.median));
    med.setAttribute('stroke', '#111827'); med.setAttribute('stroke-width', 2);
    svg.appendChild(med);

    // Whiskers + outliers
    // ...
  });
  host.appendChild(svg);
}
```

### 🤖 Prompt para Eva

```
Eva, box plot SVG para análise de distribuição estatística.

Quartis + whiskers + outliers via IQR 1.5×.

Referência:

[colar JS + helper _quartiles]

Adapte:
- Mostrar valor mediano dentro do box (texto)
- Conectar medianas com linha (tendência)
- Tooltip por outlier com identificador da linha original
```

### ⚠️ Pegadinhas

1. **`_quartiles` com 1 valor** → retorna todos os 5 quartis iguais. Box vira linha. Aceitável.
2. **Grupos com 0 outliers** → não renderiza círculos. OK.
3. **8 grupos é um corte arbitrário** — ajustar pelo design system do projeto.
4. **Outliers extremos** (1000× a mediana) → axis fica esticado, outros boxes ficam minúsculos. Considerar log scale ou cap visual.

### ✅ Como testar

```javascript
const q = _quartiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
// q.outliers contém 100
// q.max = 9, q.min = 1
```

### 🔄 Variações

- **Violin plot**: combina densidade kernel com box
- **Beeswarm**: pontos individuais ao lado do box
- **Notched box**: entalhe na mediana para significância

---

## 🟡 FEATURE 6: Sankey diagram SVG simplificado (2 níveis)

### 📖 O que faz no Solstice

SVG 520×320 com 2 colunas de nodes (source / target), até 8 categorias top em cada. Links Bezier C-curve com altura proporcional ao valor. Sem otimização de cruzamento — fluxos ordenados por valor descendente. Tooltips em nodes e links.

### 🎯 Por que vale portar

Análise origem-destino é universal. Itaú: canal entrada → produto adquirido, agência → segmento, fluxo de aprovação por etapa.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `register({ id:'sankey' })` | ~6305-6430 |
| CSS | `.solstice__sankey-*` | ~950-978 |

### 🔗 Dependências

Nenhuma.

### 📝 Código fonte autônomo

```javascript
function renderSankey(host, { rows, sourceColumn, targetColumn, valueColumn }){
  const flows = new Map(); const sourceTotals = new Map(); const targetTotals = new Map();
  for (const r of rows){
    const s = String(r[sourceColumn] || ''); const t = String(r[targetColumn] || '');
    if (!s || !t) continue;
    let v = valueColumn ? parseFloat(r[valueColumn]) : 1;
    if (isNaN(v)) v = 0;
    flows.set(`${s}|${t}`, (flows.get(`${s}|${t}`) || 0) + v);
    sourceTotals.set(s, (sourceTotals.get(s) || 0) + v);
    targetTotals.set(t, (targetTotals.get(t) || 0) + v);
  }

  function topN(map, n){ return Array.from(map.entries()).sort((a,b) => b[1] - a[1]).slice(0, n); }
  const sources = topN(sourceTotals, 8);
  const targets = topN(targetTotals, 8);
  const filteredFlows = Array.from(flows.entries())
    .map(([k, v]) => { const [s, t] = k.split('|'); return { s, t, v }; })
    .filter(f => sources.find(([k]) => k === f.s) && targets.find(([k]) => k === f.t));

  const W = 520, H = 320, padX = 90, nodeW = 14, gap = 8;
  const innerH = H - 40;

  function buildPositions(items){
    const sumSide = items.reduce((s, [, v]) => s + v, 0) || 1;
    const totalGap = gap * (items.length - 1);
    const availH = innerH - totalGap;
    let cursor = 20;
    const positions = {};
    items.forEach(([k, v]) => {
      const h = Math.max(2, (v / sumSide) * availH);
      positions[k] = { y: cursor, h, v };
      cursor += h + gap;
    });
    return positions;
  }
  const sPos = buildPositions(sources);
  const tPos = buildPositions(targets);

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Links primeiro (atrás)
  const sourceOffsets = {}, targetOffsets = {};
  sources.forEach(([k]) => sourceOffsets[k] = 0);
  targets.forEach(([k]) => targetOffsets[k] = 0);
  filteredFlows.sort((a, b) => b.v - a.v);
  filteredFlows.forEach(f => {
    const sP = sPos[f.s], tP = tPos[f.t];
    if (!sP || !tP) return;
    const sH = sP.h * (f.v / sP.v);
    const tH = tP.h * (f.v / tP.v);
    const sY = sP.y + sourceOffsets[f.s];
    const tY = tP.y + targetOffsets[f.t];
    sourceOffsets[f.s] += sH;
    targetOffsets[f.t] += tH;

    const x1 = padX + nodeW;
    const x2 = W - padX - nodeW;
    const cx1 = x1 + (x2 - x1) * 0.5;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', [
      'M', x1, sY,
      'C', cx1, sY, cx1, tY, x2, tY,
      'L', x2, tY + tH,
      'C', cx1, tY + tH, cx1, sY + sH, x1, sY + sH,
      'Z'
    ].join(' '));
    path.setAttribute('fill', '#2563EB'); path.setAttribute('fill-opacity', 0.18);
    svg.appendChild(path);
  });

  // Nodes (origem + destino)
  sources.forEach(([k]) => {
    const p = sPos[k];
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', padX); rect.setAttribute('y', p.y);
    rect.setAttribute('width', nodeW); rect.setAttribute('height', p.h);
    rect.setAttribute('fill', '#2563EB');
    svg.appendChild(rect);
  });
  // ... targets idem com x = W - padX - nodeW

  host.appendChild(svg);
}
```

### 🤖 Prompt para Eva

```
Eva, Sankey diagram 2 níveis (source → target) sem libs.

Referência:

[colar JS]

Adapte:
- Hover no node → highlight todos os links conectados
- Click no node → drill-down para detalhe daquele nó
- Suporte a 3 níveis (origem → meio → destino) — implementação opcional
- Otimização de cruzamento via Hungarian algorithm — pode adiar
```

### ⚠️ Pegadinhas

1. **8 categorias por lado é cap arbitrário** — datasets com 50+ categorias precisam de "Outros" agrupado.
2. **Sem otimização de cruzamento** — fluxos podem se sobrepor visualmente. Aceitar como simplificação.
3. **Source = Target** (auto-loop) cria path degenerado. Filtrar.
4. **`Math.max(2, ...)`** garante altura mínima visível para fluxos pequenos.

### ✅ Como testar

1. Source: 5 canais, Target: 4 segmentos → 5 nodes esquerda, 4 direita, fluxos coloridos
2. Hover em link → tooltip com source/target/valor
3. Categorias além do top 8 → não aparecem (silenciosamente filtradas)

### 🔄 Variações

- **3 níveis**: source → middle → target (requer reflow do algoritmo)
- **Animação**: links aparecem em ordem ao carregar
- **Filtro por valor mínimo**: esconde fluxos < threshold

---

## 🟢 FEATURE 7: Helpers estatísticos puros (regressão / k-means / quartis)

### 📖 O que faz no Solstice

3 funções puras matemáticas:
- `linearRegression(points)` → OLS retornando `{slope, intercept, r2}`
- `kMeans(points, k, maxIter=20)` → Lloyd's algorithm retornando `[clusterId per point]`
- `quartiles(values)` → `{q1, median, q3, min, max, outliers}` (IQR 1.5×)

### 🎯 Por que vale portar

Base estatística reutilizável em qualquer projeto JS. Para Itaú: análises ad-hoc sem precisar de Pandas/R/SAS no backend.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeComponents` helpers privados | ~5750-5800 |

### 🔗 Dependências

Nenhuma.

### 📝 Código fonte autônomo

```javascript
function linearRegression(points){
  if (!points || points.length < 2) return null;
  const n = points.length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of points){ sx += x; sy += y; sxy += x*y; sxx += x*x; syy += y*y; }
  const mx = sx / n, my = sy / n;
  const denom = sxx - n * mx * mx;
  if (denom === 0) return { slope: 0, intercept: my, r2: 0 };
  const slope = (sxy - n * mx * my) / denom;
  const intercept = my - slope * mx;
  const ssTot = syy - n * my * my;
  const ssRes = points.reduce((s, [x, y]) => { const pred = slope*x + intercept; return s + (y - pred)*(y - pred); }, 0);
  const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
  return { slope, intercept, r2 };
}

function kMeans(points, k, maxIter = 20){
  if (!points || points.length < k || k < 1) return points.map(() => 0);
  const stride = Math.max(1, Math.floor(points.length / k));
  let centers = []; for (let i = 0; i < k; i++) centers.push(points[i * stride].slice());
  let assignments = new Array(points.length).fill(0);
  for (let it = 0; it < maxIter; it++){
    let changed = false;
    for (let i = 0; i < points.length; i++){
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++){
        const dx = points[i][0] - centers[c][0]; const dy = points[i][1] - centers[c][1];
        const d = dx*dx + dy*dy;
        if (d < bestD){ bestD = d; best = c; }
      }
      if (assignments[i] !== best){ assignments[i] = best; changed = true; }
    }
    if (!changed) break;
    const sums = Array.from({length:k}, () => [0,0,0]);
    for (let i = 0; i < points.length; i++){ const c = assignments[i];
      sums[c][0] += points[i][0]; sums[c][1] += points[i][1]; sums[c][2] += 1; }
    for (let c = 0; c < k; c++){ if (sums[c][2] > 0){
      centers[c][0] = sums[c][0] / sums[c][2]; centers[c][1] = sums[c][1] / sums[c][2]; } }
  }
  return assignments;
}

function quartiles(values){
  if (!values || !values.length) return null;
  const s = values.slice().sort((a,b)=>a-b);
  const n = s.length;
  function pct(p){ const i = (n-1)*p, lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); }
  const q1 = pct(0.25), median = pct(0.5), q3 = pct(0.75);
  const iqr = q3 - q1;
  const loFence = q1 - 1.5 * iqr, hiFence = q3 + 1.5 * iqr;
  const inliers = s.filter(v => v >= loFence && v <= hiFence);
  const outliers = s.filter(v => v < loFence || v > hiFence);
  return { q1, median, q3,
    min: inliers.length ? inliers[0] : s[0],
    max: inliers.length ? inliers[inliers.length - 1] : s[s.length - 1],
    outliers };
}
```

### 🤖 Prompt para Eva

```
Eva, helpers estatísticos puros para análise ad-hoc em JS.

3 funções: regressão linear OLS, K-means clustering, quartis com outliers IQR.

Referência:

[colar JS]

Adapte:
- Adicionar mais: polynomialRegression, holtWinters, correlationMatrix
- Testes unitários cobrindo casos de borda (n=1, valores iguais, NaN)
- Export para uso em workers se análises forem pesadas
```

### ⚠️ Pegadinhas

1. **`linearRegression` com x constante** → `denom = 0`, retorna `slope:0`. Documentar.
2. **`kMeans` com k > pontos.length** → retorna tudo cluster 0. Validar.
3. **`quartiles` com 1 ou 2 valores** → comportamento estatisticamente questionável; aceita mas usuário deve saber.
4. **Não usar em datasets > 100K pontos** sem mover para Worker. JS single-thread.

### ✅ Como testar

```javascript
linearRegression([[0,0],[1,1],[2,2]]);  // slope: 1, intercept: 0, r2: 1
linearRegression([[0,0],[1,2],[2,1]]);  // slope ~0, r2 baixo
kMeans([[0,0],[0,1],[10,10],[10,11]], 2);  // [0,0,1,1] ou [1,1,0,0]
quartiles([1,2,3,4,5,6,7,8,9,100]);  // outliers: [100]
```

### 🔄 Variações

- **Memoization**: cache por hash do array
- **Streaming**: kMeans incremental para datasets que não cabem em memória
- **Outlier detection alternativo**: Z-score, modified Z-score, isolation forest

---

## 🟥 RESUMO DO BLOCO

### Features mais valiosas para portar primeiro

1. **🥇 Heatmap Calendário (F2)** — UX vencedor, baixíssimo custo, padrão visual universalmente reconhecido
2. **🥈 Gauge (F3)** — metas e SLA estão em todo dashboard executivo
3. **🥉 Helpers estatísticos (F7)** — base para qualquer análise ad-hoc futura
4. **Markdown com placeholders (F4)** — dashboards explicativos viram dinâmicos sem código
5. **Box Plot (F5)** — análise de distribuição é fundamental em risco/qualidade

### Features que NÃO vale portar isoladamente

- **Scatter (F1)** — só vale se houver demanda de análise de correlação visual; senão, métricas tabulares já cobrem
- **Sankey (F6)** — só faz sentido com fluxo origem-destino claro; para a maioria dos dashboards executivos, não cabe

### Recomendação específica para projeto Itaú

**Para Eva/Itaú:**

1. **Adotar Heatmap Calendário** em painéis operacionais (atividade diária por canal, transações por agência, alertas de risco)
2. **Gauge customizado Itaú** com paleta corporativa + zonas baseadas em metas regulatórias (BACEN)
3. **Markdown com placeholders** em narrativas executivas — "Carteira atingiu R$ {{carteira.total}} com {{carteira.dpd30}}% inadimplência"
4. **Box Plot** em painéis de qualidade de dado e análise de outliers

**Considerações específicas:**
- **Performance**: Sankey com 1000+ fluxos vira problema. Cap em 8 categorias é OK para dashboards executivos; para análise detalhada, paginação ou drill-down
- **Acessibilidade**: gauges em verde/amarelo precisam de ícones/símbolos adicionais (✓/⚠️) para daltonismo
- **Export**: PDFs executivos podem precisar dos SVGs em PNG — adicionar utilitário `svgToPng()` no B11 (snapshot)

---

> Atualização r1: +2 features (ResizeObserver para SVG responsivos, Resumo de Dataset classificado por grupo).

---

## 🟡 FEATURE 8: ResizeObserver para SVGs responsivos por tier

### 📖 O que faz no Solstice

Cada componente SVG (`scatter`, `gauge`, `boxplot`, `sankey`, `distribution`) anexa um `ResizeObserver` no host. Quando o `clientWidth` do host muda, classifica em 3 tiers (`compact` < 240px / `standard` < 420px / `large` ≥ 420px) e re-renderiza com dimensões adequadas. Debounce 150ms evita render em loop durante drag de resize. Empty states amigáveis em tier muito pequeno (Sankey precisa ≥320px).

### 🎯 Por que vale portar

Componentes SVG fixos quebram visualmente em sidebars/cards estreitos. ResizeObserver é a única forma robusta de adaptar — `window.resize` não captura mudanças de container interno. Para Itaú: qualquer painel/card visualização que mude de tamanho (responsivo, drag-resize, mobile rotation) ganha qualidade automática.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `_tierFor(host)` + `_observeResponsive(host, def, slot, ctx)` | ~5770-5805 |
| CSS | `.solstice__chart-svg--{compact|standard|large}` | ~780-790 |

### 🔗 Dependências

`ResizeObserver` (universal em browsers modernos desde 2020).

### 📝 Código fonte autônomo

```javascript
function tierFor(host){
  const w = host?.clientWidth || 480;
  if (w < 240) return { tier:'compact',  W: 240, H: 150 };
  if (w < 420) return { tier:'standard', W: 360, H: 240 };
  return { tier:'large', W: 540, H: 340 };
}

function observeResponsive(host, renderFn){
  // Cleanup anterior
  if (host._resizeObserver){
    try { host._resizeObserver.disconnect(); } catch(e){}
    host._resizeObserver = null;
  }
  if (typeof ResizeObserver === 'undefined') return;

  let timer = null;
  let lastTier = tierFor(host).tier;

  const obs = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = tierFor(host).tier;
      if (next === lastTier) return;   // só re-render se tier mudou
      lastTier = next;
      host.innerHTML = '';
      try { renderFn(host); } catch(e){ console.error(e); }
    }, 150);
  });
  obs.observe(host);
  host._resizeObserver = obs;
}

// Uso no componente:
function renderChart(host){
  const t = tierFor(host);
  const svg = createSVG(t.W, t.H);
  svg.classList.add(`chart--${t.tier}`);
  // ... render usando t.W, t.H, t.tier para ajustar paddings/labels
  host.appendChild(svg);
  observeResponsive(host, renderChart);  // re-observa após render
}
```

```css
.chart { display: block; width: 100%; height: auto; min-height: 140px; aspect-ratio: 16/10; }
.chart--compact  { min-height: 100px; aspect-ratio: 8/5; }
.chart--standard { min-height: 200px; aspect-ratio: 3/2; }
.chart--large    { min-height: 280px; aspect-ratio: 16/10; }
```

### 🤖 Prompt para Eva

```
Eva, componentes SVG responsivos via ResizeObserver + tiers.

Padrão: cada SVG component classifica tier do host, ajusta dimensões e re-renderiza no resize.

Referência:

[colar JS]

Adapte:
- Definir tiers conforme breakpoints do nosso design system
- Empty state customizado por componente (ex: "Heatmap precisa de N px")
- Adicionar logging de mudanças de tier (analytics — quanto tempo cada tier é usado)

Não usar window.addEventListener('resize'). Não funciona para containers que mudam sem viewport.
```

### ⚠️ Pegadinhas

1. **`ResizeObserver` dispara no observe()** com tamanho atual — tier check evita re-render desnecessário no primeiro frame
2. **Cleanup é obrigatório** — sem `disconnect()`, observer fica pendurado e refere ao DOM órfão (memory leak)
3. **Debounce 150ms** balanceia responsividade vs CPU. Aumentar se renders muito caros
4. **Empty state em tier compact** deve continuar chamando `observeResponsive` para detectar quando slot cresce e voltar a renderizar normalmente

### ✅ Como testar

1. Slot 200px → tier compact (W=240, H=150)
2. Resize slot para 350px → após 150ms, tier muda para standard
3. Resize para 600px → tier large
4. Múltiplos resizes rápidos → re-render só no último (debounce)

### 🔄 Variações

- **Tier por viewport** (não por host) — para mobile-first
- **Tiers configuráveis** via prop do componente
- **Tier intermediário** "comfortable" entre standard e large

---

## 🟢 FEATURE 9: Resumo de Dataset classificado por grupo de tipo

### 📖 O que faz no Solstice

`SolsticeDataset.summary()` retorna `{ totalRows, totalColumns, groups: { numeric: [...], categorical: [...], ... } }`. UI card mostra contagem por grupo com ícone + label pt-BR pluralizado + 3 primeiras colunas + "...+N". Reativo: recalcula quando tipo de coluna ou dicionário muda.

### 🎯 Por que vale portar

Resposta imediata para "o que tem nesse CSV?" sem ler todas as colunas. Para Itaú: ao receber export de área desconhecida, analista vê em 2s a estrutura ("3 medidas, 2 dimensões, 1 temporal") antes de mergulhar.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeDataset` módulo | ~3175-3225 |
| JS | `Editor.renderDatasetSummary` | ~5235-5290 |
| CSS | `.solstice__dataset-summary*` | ~780-825 |

### 🔗 Dependências

`SolsticeTypes.getType(typeId)` para descobrir `group`. `SolsticeHumanize.column(name, dict)` para friendlyName.

### 📝 Código fonte autônomo

```javascript
const Dataset = (function(){
  const META = {
    numeric:     { label: 'Medidas',         icon: '📊', plural: 'Medidas',         singular: 'Medida' },
    categorical: { label: 'Dimensões',       icon: '🏷️', plural: 'Dimensões',       singular: 'Dimensão' },
    temporal:    { label: 'Temporais',       icon: '📅', plural: 'Temporais',       singular: 'Temporal' },
    id:          { label: 'Identificadores', icon: '🔑', plural: 'Identificadores', singular: 'Identificador' }
  };

  function summary(){
    const ingest = Store.get('ingest');
    if (!ingest?.columns) return { totalRows: 0, totalColumns: 0, groups: {} };
    const dict = Store.get('dictionary');
    const groups = {};
    for (const col of ingest.columns){
      const t = ingest.types?.[col];
      const def = Types.getType(t?.type);
      let g = def?.group || 'special';
      if (g === 'cat') g = 'categorical';
      (groups[g] ||= []).push({
        name: col,
        friendlyName: Humanize.column(col, dict),
        type: t?.type
      });
    }
    return {
      totalRows: ingest.rows?.length || 0,
      totalColumns: ingest.columns.length,
      groups
    };
  }

  return { summary, META };
})();

// UI:
function renderSummary(host){
  const sum = Dataset.summary();
  if (!sum.totalRows){ host.style.display = 'none'; return; }
  host.style.display = '';
  host.innerHTML = '';

  // ... header + totalRows em destaque + lista por grupo
  for (const g of ['numeric','categorical','temporal','id']){
    const cols = sum.groups[g];
    if (!cols?.length) continue;
    const meta = Dataset.META[g];
    const count = cols.length;
    const sample = cols.slice(0, 3).map(c => c.friendlyName).join(', ');
    const more = cols.length > 3 ? ` · +${cols.length - 3}` : '';
    const label = count === 1 ? meta.singular : meta.plural;
    // ... <div>icon count label · sample more</div>
  }
}

// Reativo:
Store.subscribe('ingest', () => renderSummary(host));
Store.subscribe('dictionary', () => renderSummary(host));
```

### 🤖 Prompt para Eva

```
Eva, card "Resumo do Dataset" no topo de qualquer painel de dados.

Conta colunas classificadas por tipo (medidas/dimensões/temporais/IDs).

Referência:

[colar JS]

Adapte:
- Adicionar grupos específicos Itaú: 'monetario', 'risco', 'identificador_cliente'
- Cor por grupo (badge colorida ao lado da contagem)
- Click no grupo → filtra editor de colunas para mostrar só aquele grupo
- Linkar ao Dicionário Semântico Itaú para classificação mais precisa
```

### ⚠️ Pegadinhas

1. **Pluralização específica pt-BR** — "1 Medida" vs "5 Medidas". Não usar simples concat com 's'
2. **Grupos vazios** devem ser ocultados (não mostrar "0 identificadores")
3. **Re-render a cada subscribe** pode ficar caro com 100+ colunas. Debounce se notar lentidão
4. **Tooltip com lista completa** pode ficar enorme — limitar a 20 colunas no tooltip, mostrar "..." no fim

### ✅ Como testar

1. Importar CSV com 11 colunas mistas → ver contagens (ex: 5 medidas, 3 dimensões, 1 temporal)
2. Trocar tipo de uma coluna no editor (medida → dimensão) → contagens recalculam
3. Limpar dataset → card desaparece
4. Click em grupo → scroll para editor de colunas

### 🔄 Variações

- **Tabela em vez de lista** — útil em datasets com 8+ grupos
- **Score de qualidade por grupo** — visual de saúde "Medidas: 4 OK, 1 com nulos"
- **Sugestões de análise** — "Você tem 1 temporal + 5 medidas, que tal uma série temporal?"

---

> Documento atualizado no Patch B6-r1. Linhas aproximadas. Comando: `PORTABILIDADE BLOCO 6` regenera com linhas atuais.
