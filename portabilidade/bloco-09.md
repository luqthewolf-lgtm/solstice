# PORTABILIDADE — Bloco 9: Filtros Globais + Cross-Filter + Parâmetros

> Cada feature aqui é portável independente. Mais críticas: Multi-select com busca, Range slider duplo, Date picker com presets, e o pattern de Cross-filter.

---

## 📋 ÍNDICE DE FEATURES PORTÁVEIS

| # | Feature | Complexidade | Tempo estimado | Dependências |
|---|---------|--------------|----------------|--------------|
| 1 | Multi-select com busca + chips | 🟡 Média | 2-3h | nenhuma |
| 2 | Range slider duplo (HTML5 + inputs) | 🟡 Média | 2-3h | nenhuma |
| 3 | Date picker com presets | 🟢 Simples | 1-2h | nenhuma |
| 4 | Engine de filtros transparente (apply via context) | 🟡 Média | 3-4h | tipos do projeto |
| 5 | Cross-filter como destaque temporário | 🟡 Média | 2h | Store + Esc handler |
| 6 | Parâmetros globais K/V tipados | 🟢 Simples | 2h | Store + Modal |
| 7 | Barra de filtros colapsável com badge ativos | 🟢 Simples | 1h | reusa accordion B7-r2 |
| 8 | Fix de empty state com flex-column | 🟢 Simples | 30min | nenhuma |

---

## 🟡 FEATURE 1: Multi-select com busca + chips

### 📖 O que faz

Trigger mostra chips dos selecionados (até 3 + "+N"). Click abre panel com input de busca + checkboxes ordenados por contagem. Persiste seleção como array de strings.

### 📝 Código autônomo (resumo)

```javascript
function createMultiSelect(column, allOptions, getCurrentSelected, onChange) {
  const wrap = el('div', { class: 'ms' });
  const trigger = el('button', { class: 'ms-trigger' });

  function refreshTrigger() {
    trigger.innerHTML = '';
    const sel = getCurrentSelected();
    if (!sel.length) {
      trigger.append(el('span', { class: 'ms-placeholder' }, 'Selecione…'));
    } else {
      sel.slice(0, 3).forEach(v => trigger.append(el('span', { class: 'ms-chip' }, v)));
      if (sel.length > 3) trigger.append(el('span', { class: 'ms-chip-more' }, '+' + (sel.length - 3)));
    }
  }
  refreshTrigger();

  let panel = null;
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (panel) { panel.remove(); panel = null; return; }
    panel = el('div', { class: 'ms-panel' });
    const search = el('input', { class: 'ms-search', placeholder: 'Buscar…' });
    panel.append(search);
    const list = el('div');
    panel.append(list);
    function renderList(q) {
      list.innerHTML = '';
      const term = (q || '').toLowerCase();
      const filtered = allOptions.filter(([v]) => v.toLowerCase().includes(term));
      filtered.forEach(([value, count]) => {
        const opt = el('label', { class: 'ms-option' });
        const cb = el('input', { type: 'checkbox' });
        cb.checked = getCurrentSelected().includes(value);
        cb.addEventListener('change', () => {
          const sel = getCurrentSelected().slice();
          if (cb.checked) sel.push(value);
          else { const i = sel.indexOf(value); if (i >= 0) sel.splice(i, 1); }
          onChange(sel);
          refreshTrigger();
        });
        opt.append(cb, el('span', null, value), el('span', { class: 'ms-count' }, count));
        list.append(opt);
      });
    }
    search.addEventListener('input', e => renderList(e.target.value));
    renderList('');
    wrap.append(panel);
    setTimeout(() => search.focus(), 0);
  });
  wrap.append(trigger);
  return wrap;
}
```

### 🤖 Prompt para Eva

```
Eva, preciso de multi-select com busca e chips no dashboard. Padrão usado em
Filtros de Carteira PJ.

Comportamento:
- Trigger fechado mostra até 3 chips + "+N" se mais
- Click abre panel com input de busca
- Opções ordenadas por contagem (mais comum no topo)
- Checkbox toggles persiste no Store

[colar código]

Adapta para React + shadcn/ui ou nosso DS atual.
```

### ⚠️ Pegadinhas

1. **Fechar panel ao click fora** — use `document.addEventListener('click', outsideHandler, true)` em capture phase
2. **Search performance** — para 1000+ opções, debounce 100ms
3. **Acessibilidade** — adicionar `role="listbox"` e teclas ↑↓ Enter; o código acima é mínimo

---

## 🟡 FEATURE 2: Range slider duplo (HTML5 puro)

### 📝 Código autônomo

```javascript
function createRangeSlider(min, max, initialLo, initialHi, onChange) {
  const wrap = el('div', { class: 'range' });
  const track = el('div', { class: 'range-track' });
  const fill = el('div', { class: 'range-fill' });
  track.append(fill);
  wrap.append(track);

  const inLo = el('input', { type: 'range', class: 'range-input',
    min, max, value: initialLo });
  const inHi = el('input', { type: 'range', class: 'range-input',
    min, max, value: initialHi });
  wrap.append(inLo, inHi);

  function updateFill() {
    const lo = parseFloat(inLo.value), hi = parseFloat(inHi.value);
    const a = ((lo - min) / (max - min)) * 100;
    const b = ((hi - min) / (max - min)) * 100;
    fill.style.left = a + '%';
    fill.style.width = Math.max(0, b - a) + '%';
  }
  function commit() {
    const lo = parseFloat(inLo.value), hi = parseFloat(inHi.value);
    onChange(Math.min(lo, hi), Math.max(lo, hi));
  }
  inLo.addEventListener('input', updateFill);
  inHi.addEventListener('input', updateFill);
  inLo.addEventListener('change', commit);
  inHi.addEventListener('change', commit);
  updateFill();
  return wrap;
}
```

### CSS essencial

```css
.range { position: relative; padding: 4px 0; }
.range-track { position: relative; height: 4px; background: #ddd; border-radius: 999px; }
.range-fill { position: absolute; height: 100%; background: #4D9FFF; border-radius: 999px; }
.range-input {
  position: absolute; top: -8px; width: 100%; height: 20px;
  -webkit-appearance: none; appearance: none;
  background: transparent; pointer-events: none;
}
.range-input::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: #4D9FFF; border: 2px solid #fff;
  cursor: pointer; pointer-events: auto;
}
```

### ⚠️ Pegadinhas

1. **Pointer-events** — track recebe eventos via thumbs (`pointer-events: auto` no thumb, `none` no input)
2. **Cross-browser** — Firefox usa `::-moz-range-thumb` em vez de `::-webkit-slider-thumb`
3. **Min === Max** — divisão por zero em `updateFill`; trate com `(max - min) || 1`

---

## 🟢 FEATURE 3: Date picker com presets

### 📝 Código autônomo

```javascript
function createDatePresets(dMin, dMax, currentFrom, currentTo, onChange) {
  const wrap = el('div', { class: 'date-filter' });
  const presets = el('div', { class: 'date-presets' });

  function preset(label, fn) {
    return el('span', {
      class: 'date-preset',
      onclick: () => {
        const [from, to] = fn();
        onChange(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
      }
    }, label);
  }

  // Presets relativos ao MAX da série (dados podem ser históricos — não usar new Date())
  presets.append(
    preset('Últimos 7d', () => [new Date(dMax.getTime() - 6 * 86400000), dMax]),
    preset('30d', () => [new Date(dMax.getTime() - 29 * 86400000), dMax]),
    preset('3m', () => { const d = new Date(dMax); d.setMonth(d.getMonth() - 3); return [d, dMax]; }),
    preset('12m', () => { const d = new Date(dMax); d.setFullYear(d.getFullYear() - 1); return [d, dMax]; }),
    preset('Tudo', () => [dMin, dMax])
  );
  wrap.append(presets);

  const range = el('div', { class: 'date-range' });
  const inFrom = el('input', { type: 'date', value: currentFrom });
  const inTo = el('input', { type: 'date', value: currentTo });
  range.append(inFrom, el('span', null, '→'), inTo);
  inFrom.addEventListener('change', e => onChange(e.target.value, inTo.value));
  inTo.addEventListener('change', e => onChange(inFrom.value, e.target.value));
  wrap.append(range);
  return wrap;
}
```

### ⚠️ Pegadinhas

1. **Presets relativos ao MAX da série, não "hoje"** — pq datasets são históricos. Para dashboards de operação ao vivo, usar `new Date()` como max é OK
2. **ISO string slice(0, 10)** funciona em UTC — pode shiftar 1 dia em fusos extremos. Para precisão, use Intl.DateTimeFormat

---

## 🟡 FEATURE 4: Engine de filtros transparente (apply via context)

### 📖 O que faz no Solstice

Refatora UMA função (`_ctx()`) e todos os componentes consomem filtros sem alterar suas implementações.

### 📝 Padrão

```javascript
// ANTES (cada componente):
function ctx() {
  return { rows: ingest.rows, ... };
}

// DEPOIS (B9):
function ctx() {
  const allRows = ingest.rows || [];
  const rows = Filters ? Filters.apply(allRows) : allRows;
  return { rows, rowsAll: allRows, ... };  // expõe ambos
}

// Componente render() não muda:
function renderKPI(slot, host, ctx) {
  const values = ctx.rows.map(r => parseFloat(r[col]));  // já filtrado!
  // ...
}
```

### 🎯 Por que vale portar

**Refactor mínimo** — em vez de tocar 10+ componentes, toca 1 helper. Isso é o pattern de "transparent middleware" via context.

### 🤖 Prompt para Eva

```
Eva, refatora nosso sistema para aceitar filtros globais transparentemente.

Padrão: refatorar APENAS o helper que cria `ctx` para o render dos componentes.
Componentes existentes não devem mudar.

ANTES: ctx.rows = ingest.rows (sempre completo)
DEPOIS: ctx.rows = applyFilters(ingest.rows) (filtrado)
        ctx.rowsAll = ingest.rows (não filtrado, para smart defaults)

Filtros engine: aceita { col: [valores] | {min,max} | {from,to} } e devolve subset.
[colar código apply do Solstice]

Mantenha retrocompatibilidade: se Filters não existe, fallback para allRows.
```

---

## 🟡 FEATURE 5: Cross-filter como destaque temporário

### 📖 O que faz

Diferente de filtros globais (persistem, multi-coluna): cross-filter é 1 coluna × 1 valor, temporário, dispensável com 1 clique ou Esc.

### 📝 Pattern

```javascript
const CrossFilter = {
  activate(column, value) {
    Store.set('crossfilter', { column, value });
  },
  clear() { Store.set('crossfilter', null); },
  get() { return Store.get('crossfilter'); },
  apply(rows) {
    const c = this.get();
    if (!c) return rows;
    return rows.filter(r => String(r[c.column]) === String(c.value));
  }
};

// No engine de filtros, aplicar JUNTO com globais (interseção)
function applyAllFilters(rows) {
  rows = applyGlobalFilters(rows);
  rows = CrossFilter.apply(rows);
  return rows;
}

// Componente que dispara (ex: clique em barra/ponto)
barEl.addEventListener('click', () => CrossFilter.activate(catColumn, barCategory));

// Esc limpa (com cascata)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && CrossFilter.get()) {
    CrossFilter.clear();
    e.preventDefault();
  }
});
```

### ⚠️ Pegadinhas

1. **Cascata de Esc** — modal > drawer > inspector > crossfilter (em ordem inversa de "frente")
2. **Substituição** — novo `activate` sobrescreve anterior; só 1 cross-filter por vez
3. **UX:** mostrar barra de status sempre que ativo, com ✕ visível

---

## 🟢 FEATURE 6: Parâmetros globais K/V tipados

### 📝 Pattern

```javascript
const Params = {
  resolveText(text) {
    const all = Store.get('params') || {};
    return String(text).replace(/\{\{\s*param\.(\w+)\s*\}\}/g, (_, k) => {
      return all[k] ? String(all[k].value) : '{{param.' + k + '}}';
    });
  }
};

// Modal CRUD: 3 colunas (nome, tipo, valor) + remover
// Tipos: string, number, date
```

### 🎯 Onde aplicar

- Textos Markdown: `{{param.meta}}`
- Títulos de KPI dinâmicos: "Meta {{param.ano}}"
- Narrativas: "Atingimos {{param.percentual_meta}}% da meta"

### ⚠️ Pegadinha principal

**Resolver de parâmetros DEVE rodar antes de resolver de Store paths** — se você tem `{{param.X}}` e `{{path.no.store}}` no mesmo texto, ordem importa. No Solstice resolveText do Params roda primeiro, depois pipeline regex do Markdown.

---

## 🟢 FEATURE 8: Empty state com flex-column

Bug bobo mas comum. Patch B8-r1:

```css
/* ANTES — afunda quando irmãos crescem acima */
.canvas { padding: 24px; overflow-y: auto; }
.canvas-empty { height: 100%; display: flex; justify-content: center; }

/* DEPOIS — empty ocupa o RESTANTE do canvas */
.canvas {
  padding: 24px; overflow-y: auto;
  display: flex; flex-direction: column;
  gap: 16px;
}
.canvas-empty {
  flex: 1; min-height: 320px;
  display: flex; justify-content: center; align-items: center;
}
```

Regra geral: SE você adiciona toolbar/header/banner em containers com `overflow-y: auto`, o container DEVE ser `flex: column` e o empty state DEVE ser `flex: 1`.

---

## 🟥 RESUMO DO BLOCO

### Features mais valiosas para portar primeiro

1. **🟡 Multi-select com busca** (Feature 1) — usado em qualquer filtro de carteira/produto/região
2. **🟡 Range slider duplo** (Feature 2) — filtro numérico essencial
3. **🟡 Engine via context** (Feature 4) — refactor mínimo para adicionar filtros em sistema existente
4. **🟢 Parâmetros globais** (Feature 6) — variáveis em narrativas/relatórios

### Recomendação para projeto Itaú via Eva

**Estratégia 3 sprints:**

1. **Sprint 1:** Multi-select + Range + Date presets (Features 1-3) — UI dos filtros prontos
2. **Sprint 2:** Engine via context + Cross-filter (Features 4-5) — backend reativo
3. **Sprint 3:** Parâmetros + polish (Features 6-7) — power user features

**ROI estimado:** 18-22h. Em troca: filtros profissionais nível Tableau/Power BI, com cross-filter que stakeholder espera de ferramentas pagas.
