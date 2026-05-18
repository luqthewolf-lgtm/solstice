# PORTABILIDADE — Bloco 3: Canvas + Seções + Linhas + Layouts + Templates Agnósticos

> Documento gerado automaticamente. Como portar cada feature para outros projetos, especialmente o projeto Itaú via Eva.

---

## 📋 ÍNDICE DE FEATURES PORTÁVEIS

| # | Feature | Complexidade | Tempo estimado | Dependências |
|---|---------|--------------|----------------|--------------|
| 1 | Hierarquia Section→Row→Slot persistida em estado | 🟡 Média | 3-4h | Store reativo |
| 2 | 10 layouts via CSS Grid + atributo `data-layout` | 🟢 Simples | 1-2h | CSS Grid |
| 3 | Toolbar contextual com hover (oculta até mouseover) | 🟢 Simples | 30min-1h | CSS hover |
| 4 | Padrão de empty state condicional ("se A → X, senão Y") | 🟢 Simples | 1h | render reativo |
| 5 | Templates como "receitas serializáveis" filtradas por contexto | 🟡 Média | 3-4h | Dicionário semântico |
| 6 | Picker modal com busca para escolher template/layout | 🟢 Simples | 30min | SolsticeModal |
| 7 | Renomear inline com `contenteditable` (padrão coerente) | 🟢 Simples | 30min | nenhuma |

---

## 🟡 FEATURE 1: Hierarquia Section → Row → Slot persistida em estado

### 📖 O que faz no Solstice

Toda a estrutura visual do dashboard é uma árvore `[Section → [Row → [Slot]]]` persistida em `Store.canvas.sections`. Cada nó tem `id` uuid. Mutações passam por API tipada (`addSection`, `removeRow`, etc.) — nunca direto no Store. Render é função pura `state → DOM`.

### 🎯 Por que vale portar

Permite Undo/Redo (ring buffer de estados), snapshots (JSON.stringify), import/export, comparação de versões — tudo "de graça". Para Itaú: dashboards salváveis, comparáveis, versionáveis, com auditoria de quem mudou o quê.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeCanvas` módulo | 2820-3150 |
| Estado | `Store.canvas.sections` | runtime |

### 🔗 Dependências

Store reativo (`subscribe('path')`). UUID generator.

### 📝 Código fonte autônomo (esqueleto)

```javascript
const Canvas = (function(){
  const PATH = 'canvas.sections';

  function _get(){ return Store.get(PATH) || []; }
  function _set(arr){ Store.set(PATH, arr); }

  function _newSection(title){
    return {
      id: uuid(),
      title: title || 'Nova seção',
      rows: [_newRow('1col')]
    };
  }
  function _newRow(layout){
    return {
      id: uuid(), layout,
      slots: Array.from({length: slotCountOf(layout)}, () => ({ id: uuid(), type:'empty' }))
    };
  }

  function addSection(title){
    const all = _get().slice();
    all.push(_newSection(title));
    _set(all);
  }

  function removeSection(secId){
    _set(_get().filter(s => s.id !== secId));
  }

  function duplicateSection(secId){
    const all = _get();
    const idx = all.findIndex(s => s.id === secId);
    if (idx < 0) return;
    const clone = deepClone(all[idx]);
    clone.id = uuid();
    clone.title += ' (cópia)';
    clone.rows.forEach(r => { r.id = uuid(); r.slots.forEach(s => s.id = uuid()); });
    const next = all.slice();
    next.splice(idx + 1, 0, clone);
    _set(next);
  }

  function moveSection(secId, delta){
    const all = _get().slice();
    const idx = all.findIndex(s => s.id === secId);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= all.length) return;
    [all[idx], all[next]] = [all[next], all[idx]];
    _set(all);
  }

  function init(){
    render();
    Store.subscribe(PATH, render);
  }

  function render(){
    const root = document.querySelector('.canvas');
    root.innerHTML = '';
    _get().forEach(sec => root.appendChild(_renderSection(sec)));
  }

  // ... _renderSection, _renderRow, _renderSlot
  return { addSection, removeSection, duplicateSection, moveSection, init };
})();
```

### 🤖 Prompt para Eva

```
Eva, dashboard com hierarquia visual modificável: Seção → Linha → Slot.

Quero estado em memória, serializável, reativo. Mutações passam por API, não direto no store.

Referência:

[colar JS]

Adapte:
- Substituir Store por nosso gerenciador (Zustand/Redux/Pinia/etc.)
- Path do estado pode ser diferente
- Adicionar suporte a "comentários por seção" (preparar pro Bloco 13 do Solstice — mas já útil em qualquer projeto)
- Adicionar campo `metadata` em Section/Row para extensibilidade futura sem breaking change

Não usar libs de drag-and-drop ainda. Adicionar isso vem como camada separada.
```

### ⚠️ Pegadinhas

1. **`Array.slice()` antes de mutar** — não mute o array do Store direto. `_get().slice()` cria cópia rasa; depois `_set(arr)` dispara notify.
2. **Re-render completo** a cada mudança. Para 100+ seções, virar O(N²) — adicionar diffing por id.
3. **IDs precisam ser únicos** mas estáveis. Ao duplicar seção, gerar novos IDs em TUDO (section + rows + slots).
4. **Garantir mínimo de 1 row por section** (em `removeRow`) ou seção fica visualmente vazia.
5. **Mantenha API tipada e única** — qualquer caminho que mute estado fora dela quebra Undo/Redo futuro.

### ✅ Como testar

1. `Canvas.addSection('Teste')` → seção aparece no DOM.
2. `Store.get('canvas.sections')` → array com 1 entrada com id, title, rows.
3. `Canvas.duplicateSection(id)` → 2 seções, IDs distintos.
4. `Canvas.moveSection(id, -1)` na primeira → nada acontece (já está no topo).
5. JSON.stringify(Store.get('canvas.sections')) → serializa sem erro.

### 🔄 Variações

- **Section colapsável**: adicionar `section.collapsed` boolean, esconder rows quando true.
- **Section com cor própria**: `section.color` para personalização visual.
- **Aninhamento maior**: Section → Group → Row → Slot (quatro níveis).

---

## 🟢 FEATURE 2: 10 layouts via CSS Grid + atributo `data-layout`

### 📖 O que faz no Solstice

Cada `Row` tem um atributo `data-layout="X"`. CSS define `grid-template-columns` por valor do atributo. Trocar layout = `setAttribute('data-layout', 'novo')`. JS só ajusta quantidade de slots; CSS faz o resto.

### 🎯 Por que vale portar

Trocar layout = zero JS de re-render. Adicionar 11º layout = adicionar bloco CSS + entrada no objeto JS. Itaú: relatórios podem ter "modo apresentação" (1 grande), "modo análise" (4 lado a lado), "modo executivo" (KPIs + tendência).

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| CSS | `.solstice__row[data-layout="..."]` blocos | 488-510 |
| JS | `SolsticeLayouts` (definições + `reslot`) | 2755-2790 |

### 🔗 Dependências

CSS Grid (universal há anos).

### 📝 Código fonte autônomo

```css
.row { display: grid; gap: 12px; min-height: 80px; margin-bottom: 12px; }

.row[data-layout="1col"]        { grid-template-columns: 1fr; }
.row[data-layout="2col-equal"]  { grid-template-columns: 1fr 1fr; }
.row[data-layout="2col-2-1"]    { grid-template-columns: 2fr 1fr; }
.row[data-layout="2col-1-2"]    { grid-template-columns: 1fr 2fr; }
.row[data-layout="3col-equal"]  { grid-template-columns: 1fr 1fr 1fr; }
.row[data-layout="3col-1-2-1"]  { grid-template-columns: 1fr 2fr 1fr; }
.row[data-layout="4col-equal"]  { grid-template-columns: repeat(4, 1fr); }

/* Hero + 2 abaixo: usa grid-template-areas */
.row[data-layout="hero-bottom"] {
  grid-template-columns: 1fr 1fr;
  grid-template-areas: "hero hero" "a b";
}
.row[data-layout="hero-bottom"] > .slot:nth-child(1) { grid-area: hero; }

.row[data-layout="sidebar-main"] { grid-template-columns: 1fr 3fr; }
```

```javascript
const Layouts = {
  LAYOUTS: {
    '1col':        { name:'1 coluna',         slotCount:1 },
    '2col-equal':  { name:'2 colunas iguais', slotCount:2 },
    '2col-2-1':    { name:'2/3 + 1/3',        slotCount:2 },
    /* ... */
    'hero-bottom': { name:'Hero + 2 abaixo',  slotCount:3 },
    'sidebar-main':{ name:'Sidebar + Principal', slotCount:2 }
  },
  slotCount(id){ return this.LAYOUTS[id]?.slotCount || 1; },
  reslot(row, newLayout){
    const target = this.slotCount(newLayout);
    row.layout = newLayout;
    while (row.slots.length < target) row.slots.push({ id: uuid(), type:'empty' });
    while (row.slots.length > target) row.slots.pop();
    return row;
  }
};
```

### 🤖 Prompt para Eva

```
Eva, layouts de grid para painéis de dashboard, controlados por CSS via atributo data-layout.

Referência:

[colar CSS + JS]

Adapte para nossos layouts mais comuns:
- KPI row (4 igual ou 5 igual)
- Análise comparativa (sidebar de filtros + área principal grande)
- Drill-down (master à esquerda 1/4 + detalhe à direita 3/4)

Trocar layout não deve re-renderizar componentes — só re-arranjar grid. Slots existentes devem ser preservados; faltantes preenchidos com placeholder.

Sem libs de grid (NÃO usar react-grid-layout, gridstack).
```

### ⚠️ Pegadinhas

1. **`grid-template-areas`** com `hero` exige que o slot HTML correspondente tenha `grid-area: hero;` — preserve esse seletor `:nth-child(1)`.
2. **`reslot` descarta slots** ao reduzir layout. Para safety, sempre confirmar com modal antes de aplicar layout menor que slot count atual.
3. **`min-height: 80px`** evita rows colapsadas quando vazias.
4. **Responsivo**: em mobile (<768px), forçar todos os layouts a virar 1col com `@media (max-width: 768px) { .row { grid-template-columns: 1fr !important; } }`.

### ✅ Como testar

1. Setar `data-layout="3col-equal"` em uma row → 3 colunas iguais aparecem.
2. Trocar para `2col-2-1` → vira 2 colunas, 2/3 + 1/3.
3. `reslot(row, '4col-equal')` partindo de 1col → 4 slots presentes (1 preservado + 3 novos).

### 🔄 Variações

- **Custom**: aceitar `data-layout="custom"` + atributo `style="grid-template-columns: ..."`.
- **Auto-fit**: `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` para grid responsivo automático.

---

## 🟢 FEATURE 3: Toolbar contextual visível no hover

### 📖 O que faz no Solstice

Cada `Section` tem 5 ações (mover ↑/↓, +linha, duplicar, remover) com `opacity: 0.5` por default. No `:hover`, viram `opacity: 1`. Cada `Row` tem 4 ações (layout, duplicar, +abaixo, remover) com `opacity: 0` → `1` no hover.

### 🎯 Por que vale portar

Densidade visual + UX: ações sempre disponíveis, mas não poluem visualmente até serem necessárias. Para Itaú: listagens densas (clientes, contratos, posições) podem ter "editar/remover/expandir" assim.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| CSS | `.solstice__section-actions`, `.solstice__row-toolbar` | 462-481 |
| JS | render de actions em `_renderSection` / `_renderRow` | 3020-3110 |

### 🔗 Dependências

CSS hover. Nada de JS para o show/hide.

### 📝 Código fonte autônomo

```html
<div class="card">
  <header class="card-head">
    <span class="card-title">Título</span>
    <span class="card-actions">
      <button title="Editar">✏️</button>
      <button title="Duplicar">⎘</button>
      <button title="Remover">✕</button>
    </span>
  </header>
  <div class="card-body">...</div>
</div>
```

```css
.card-actions { opacity: 0.5; transition: opacity 150ms; }
.card:hover .card-actions { opacity: 1; }

/* Toolbar flutuante acima do elemento (variante "row") */
.card-toolbar {
  position: absolute; right: 0; top: -28px;
  opacity: 0; transition: opacity 150ms;
  background: #fff; border: 1px solid #ddd;
  border-radius: 4px; padding: 2px;
  display: flex; gap: 2px;
}
.card:hover .card-toolbar { opacity: 1; }
.card { position: relative; }   /* para o absolute funcionar */
```

### 🤖 Prompt para Eva

```
Eva, padrão de UI: ações sempre disponíveis mas só visualmente ativas no hover.

[colar CSS + HTML]

Aplicar em:
- Cards de cliente PJ (ver, editar, comentar, remover)
- Linhas da tabela de operações (aprovar, recusar, detalhar)

Atenção mobile: hover não funciona em touch. Para mobile, sempre visível OU long-press para revelar.
```

### ⚠️ Pegadinhas

1. **`opacity` não desabilita interação** — botões "invisíveis" ainda são focáveis por Tab. Considere `pointer-events: none` + `opacity: 0` se quiser bloquear interação.
2. **Mobile**: hover não dispara. Alternativa: `@media (hover: none) { .card-actions { opacity: 1; } }`.
3. **Transição de opacity** é suave; transição de `display: none → block` não anima. Use opacity.

### ✅ Como testar

1. Mouse sobre card → actions aparecem em 150ms.
2. Mouse sai → fade out.
3. Tab via teclado: actions têm focus visible mesmo quando opacity=0 (acessibilidade preservada via outline).

### 🔄 Variações

- **Toolbar always-on em modo edit** + hidden em modo present (Bloco 12 do Solstice fará isso por modo).

---

## 🟢 FEATURE 4: Empty state condicional ("se A → X, senão Y")

### 📖 O que faz no Solstice

`SolsticeCanvas._renderEmptyState()` renderiza UMA de duas variantes:
- **Sem dataset:** CTAs "Carregar dummy" + "Importar CSV"
- **Com dataset:** grid de cards de templates

Condição em `Store.get('dataset.ready')`. Re-render automático ao mudar.

### 🎯 Por que vale portar

Empty state é uma das telas mais negligenciadas em UX. Solução simples: deixa contexto guiar o próximo passo. Itaú: dashboard sem dado mostra "carregue ou importe"; dashboard com dado mas vazio mostra "comece com template".

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeCanvas._renderEmptyState` | 2980-3010 |
| CSS | `.solstice__canvas-empty*` + `.solstice__empty-templates` | 350-380 |

### 🔗 Dependências

Store reativo para condição. SolsticeUtils.el para construir DOM.

### 📝 Código fonte autônomo

```javascript
function renderEmptyState(){
  const wrap = document.createElement('div');
  wrap.className = 'empty';

  const hasData = Store.get('data.ready');

  if (!hasData){
    wrap.innerHTML = `
      <h1>Bem-vindo</h1>
      <p>Carregue dados para começar.</p>
      <div class="empty-actions">
        <button class="btn-primary" onclick="loadDummy()">📊 Dummy</button>
        <button class="btn" onclick="openImport()">📁 Importar</button>
      </div>`;
  } else {
    wrap.innerHTML = `
      <h1>Comece com um template</h1>
      <p>Escolha uma estrutura pronta.</p>
      <div class="template-grid">
        ${listTemplates().map(t => `
          <button class="template-card" onclick="applyTemplate('${t.id}')">
            <div class="template-icon">${t.icon}</div>
            <div class="template-title">${t.name}</div>
            <div class="template-desc">${t.description}</div>
            <span class="template-badge">${t.domain ? '🎯 ' + t.domainLabel : 'Agnóstico'}</span>
          </button>
        `).join('')}
      </div>`;
  }
  return wrap;
}

// Re-render reativo:
Store.subscribe('data.ready', () => render());
```

### 🤖 Prompt para Eva

```
Eva, telas vazias do projeto. Cada uma deveria ter ações claras dependendo do contexto.

Padrão: SE condição → CTA1, SENÃO CTA2.

[colar JS]

Adapte:
- Mapeie todas as telas vazias do projeto
- Para cada uma, defina 2 variantes: pré-carga vs pós-carga (ou similar)
- Cards de "próxima ação" no estilo "comece com template" são poderosos
- Não use empty state genérico ("Nada por aqui") — sempre ofereça caminho à frente
```

### ⚠️ Pegadinhas

1. **Condição mutável**: re-render reativo é crítico. Sem subscribe, empty state fica preso na primeira variante.
2. **CTAs em mobile** devem ser empilhados (flex-direction column) em <768px.
3. **Grid de cards** com `auto-fill` + `minmax(220px, 1fr)` adapta para qualquer largura.

### ✅ Como testar

1. App carrega sem dataset → variante "Bem-vindo" com 2 CTAs.
2. Clica dummy → estado muda → variante "Comece com template" aparece.
3. Limpa dataset no Store → volta para a primeira variante.

### 🔄 Variações

- **3+ variantes**: novo usuário vs usuário recorrente vs admin.
- **Animação de transição** entre variantes (fade-out → swap → fade-in).

---

## 🟡 FEATURE 5: Templates como "receitas serializáveis" filtradas por contexto

### 📖 O que faz no Solstice

Cada template é um objeto `{ id, name, icon, description, domain, build: () => sections }`. `build()` retorna estrutura JSON sem ids. `Templates.list()` filtra: agnósticos sempre + templates de domínio só quando dicionário detectado bate.

### 🎯 Por que vale portar

Adicionar template = adicionar entrada no array. Sem template-engine, sem Mustache, sem migrations. Itaú: cada produto/squad pode ter "template de relatório padrão" que o analista aplica em 1 click.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeTemplates` (AGNOSTIC + DOMAIN arrays) | 3170-3370 |

### 🔗 Dependências

Canvas (para `applyTemplate`). Modal.select (para picker). Store (para ler dictionary).

### 📝 Código fonte autônomo

```javascript
const Templates = (function(){
  function _row(layout){
    return { layout, slots: Array.from({length: slotCountOf(layout)}, () => ({type:'empty'})) };
  }
  function _sec(title, ...rows){ return { title, rows }; }

  const AGNOSTIC = [
    {
      id:'kpi-trend',  icon:'📊',
      name:'KPIs + Tendência',
      description:'4 KPIs em linha + 1 série temporal abaixo.',
      domain: null,
      build: () => [_sec('Visão geral', _row('4col-equal'), _row('1col'))]
    },
    // ...
  ];

  const DOMAIN = [
    {
      id:'banco-pj', icon:'🏦',
      name:'Carteira PJ',
      domain:'banco_pj', domainLabel:'Banco PJ',
      description:'3 KPIs + série temporal + segmento.',
      build: () => [
        _sec('Carteira', _row('3col-equal'), _row('1col')),
        _sec('Inadimplência', _row('2col-equal'))
      ]
    },
    // ...
  ];

  function list(){
    const out = AGNOSTIC.slice();
    const detectedKey = Store.get('ingest.dictDetection.dictKey');
    DOMAIN.forEach(t => { if (t.domain === detectedKey) out.push(t); });
    return out;
  }

  function apply(id){
    const t = [...AGNOSTIC, ...DOMAIN].find(x => x.id === id);
    if (!t) return;
    Canvas.applyTemplate(t.build());
  }

  return { AGNOSTIC, DOMAIN, list, apply };
})();
```

### 🤖 Prompt para Eva

```
Eva, templates de dashboard como receitas em JS.

[colar JS]

Modelar 5-10 templates relevantes pro Itaú:
1. "Carteira PJ" - KPIs receita/inadimplência/ticket + série
2. "Operações de Mesa" - posição + risco + P&L
3. "Compliance Snapshot" - alertas + tendência + lista
4. ...

Cada template:
- ID único
- domain (banco_pj/operacoes/compliance/...) ou null se agnóstico
- build() retorna estrutura sem IDs
- Templates de domínio só aparecem se o CSV/dataset bate com aquele perfil

Não usar template engine. JS puro.
```

### ⚠️ Pegadinhas

1. **`build()` deve ser função**, não objeto cru — para garantir IDs novos a cada aplicação.
2. **Filtragem por domínio** depende de `dictionary.detect()` ter rodado. Para datasets sem dict, só agnósticos aparecem.
3. **IDs no template = únicos no global** — não use prefixo de empresa, isole por namespace se múltiplas equipes contribuem.

### ✅ Como testar

1. `Templates.list().length` antes de carregar CSV = 6 (agnósticos).
2. Após carregar CSV de vendas → 7 (6 + Performance Comercial).
3. `Templates.apply('kpi-trend')` → seção "Visão geral" com 2 rows aparece no canvas.

### 🔄 Variações

- **Template com parâmetros**: `build(opts)` recebe `{ period: 'monthly', includeForecast: true }` para customizar.
- **Templates aninhados**: um template referencia outro (template "Executivo completo" inclui "KPIs+Tendência" + "Tabela com Filtros").

---

## 🟢 FEATURE 6: Picker modal com busca para escolher template/layout

### 📖 O que faz no Solstice

`SolsticeTemplates.openPicker()` reusa `SolsticeModal.select` (do Bloco 2 r2) com `searchable: 'auto'`. Templates de domínio têm descrição + badge. Busca encontra por nome, descrição ou sinônimos.

### 🎯 Por que vale portar

Reuso de componente. Padrão consistente: qualquer "escolha uma de várias opções" no app usa o mesmo modal. Custo zero adicional.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeTemplates.openPicker` | 3380-3395 |
| Reuso | `SolsticeModal.select` | 2630-2790 (Bloco 2 r2) |

### 🔗 Dependências

SolsticeModal (Feature 11 do `portabilidade/bloco-02.md`).

### 📝 Código fonte autônomo

```javascript
async function openTemplatePicker(){
  const opts = Templates.list().map(t => ({
    value: t.id,
    label: t.name,
    icon: t.icon,
    desc: t.description,
    synonyms: [t.domainLabel || 'agnóstico', t.id].filter(Boolean)
  }));
  const choice = await Modal.select({
    title: 'Aplicar template',
    message: 'Templates de domínio aparecem quando o dicionário detectado bate.',
    options: opts,
    confirmLabel: 'Aplicar',
    size: 'lg'
  });
  if (choice) Templates.apply(choice);
}
```

### 🤖 Prompt para Eva

```
Eva, padronizar todos os "pickers de opção" no projeto para usar nosso Modal.select com searchable.

Listar todos os pickers atuais (templates, tipos, segmentos, períodos) e converter para chamadas de Modal.select.

Reuso de componente > customização específica. Cada picker tem o mesmo comportamento: busca, ↑↓, Enter, Esc, highlight.
```

### ⚠️ Pegadinhas

1. **Sinônimos por opção** enriquecem busca. Sem eles, só `label + value + desc` participam.
2. **Tamanho `lg`** importante quando opções têm descrição longa.

### ✅ Como testar

1. Modal abre com input em foco. Digitar "carteira" → só "Carteira PJ" aparece.
2. ↑↓ navega. Enter confirma.

### 🔄 Variações

- **Multi-select**: já no roadmap de variações da Feature 11 (Modal) do Bloco 2.

---

## 🟢 FEATURE 7: Renomear inline com `contenteditable` (padrão coerente)

### 📖 O que faz no Solstice

Section title vira editável ao click. Blur ou Enter salva. Esse padrão também é usado em colunas do Editor (Bloco 2) — coerência total.

### 🎯 Por que vale portar

UX direta. Zero modal pra renomear. Itaú: nomes de relatórios, dashboards salvos, perfis.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS Section title | `_renderSection` no SolsticeCanvas | 3020-3045 |
| JS Coluna | `SolsticeEditor.render` (mesmo padrão) | Bloco 2 |

### 🔗 Dependências

Nenhuma.

### 📝 Código fonte autônomo

```javascript
function makeRenamable(el, onRename){
  el.style.cursor = 'text';
  el.title = 'Clique para renomear';

  el.addEventListener('click', () => {
    el.contentEditable = 'true';
    el.focus();
    document.execCommand('selectAll', false, null);
  });

  el.addEventListener('blur', () => {
    el.contentEditable = 'false';
    const v = el.textContent.trim() || 'Sem nome';
    if (v !== el.dataset.originalValue){
      onRename(v);
      el.dataset.originalValue = v;
    }
  });

  el.addEventListener('keydown', e => {
    if (e.key === 'Enter'){ e.preventDefault(); el.blur(); }
    if (e.key === 'Escape'){
      el.textContent = el.dataset.originalValue;
      el.blur();
    }
  });
}
```

### 🤖 Prompt para Eva

```
Eva, padrão de renomear inline com contenteditable.

[colar JS]

Cuidados:
- SEMPRE ler com textContent (NUNCA innerHTML) — XSS.
- Salvar no blur OU Enter; Esc descarta.
- Outline visual quando contenteditable=true.
- Aplicar onde hoje temos prompt() de renomear.
```

### ⚠️ Pegadinhas

1. **`document.execCommand` está deprecated** — funciona ainda mas considere `getSelection().selectAllChildren(el)` como alternativa moderna.
2. **`contenteditable` + paste de outro site** = HTML injetado. `el.textContent` ao ler resolve.
3. **Esc deve descartar** (restaurar valor original) — UX espera isso.

### ✅ Como testar

1. Click no título → vira editável, texto selecionado.
2. Digitar novo nome + Enter → salva.
3. Digitar novo nome + Esc → descarta, valor antigo volta.

### 🔄 Variações

- **Validação**: bloquear blur se nome inválido (vazio, duplicado).

---

## 🟥 RESUMO DO BLOCO

### Features mais valiosas para portar primeiro

1. **🥇 Hierarquia Section→Row→Slot persistida** (F1) — base de qualquer dashboard salvável.
2. **🥈 10 layouts via CSS Grid** (F2) — UX win imediato, custo baixíssimo.
3. **🥉 Templates como receitas filtradas** (F5) — multiplica valor de produção de dashboards. Cada squad mantém sua biblioteca.
4. **Renomear inline com contenteditable** (F7) — pequeno detalhe que melhora muito UX.

### Features que NÃO vale portar isoladamente

- **Empty state condicional** (F4) — patternão, mas só faz sentido se você tem o estado reativo.
- **Picker modal com busca** (F6) — só vale após adotar SolsticeModal (Bloco 2).

### Recomendação específica para projeto Itaú

**Para o projeto Eva/Itaú:**

1. **Adotar a hierarquia Section→Row→Slot** como base de qualquer painel novo. Compatível com salvamento em backend (JSON em coluna jsonb).
2. **Layouts CSS Grid** universais — substituir qualquer container fixo por layouts trocáveis.
3. **Templates Itaú**: criar 5-8 templates fundamentais (Carteira PJ Snapshot, Performance Mensal, Risco vs Retorno, Aprovação vs Submissão, etc.) e disponibilizar como "start here" pros analistas.
4. **Cuidado com volume**: re-render completo em mudança de estado vira problema com 50+ seções. Adicionar diffing por id ANTES de produção.
5. **Versionamento + auditoria** do estado: cada `_set(arr)` deveria logar `(timestamp, userId, action, diff)` para conformidade. Não no MVP, mas planejado.

---

> Documento gerado no Bloco 3. Linhas aproximadas. Comando: `PORTABILIDADE BLOCO 3` regenera com linhas atuais.
