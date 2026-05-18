# PORTABILIDADE — Bloco 4: Resize Livre + Modo Livre + Micro-interações

> Documento gerado automaticamente. Como portar cada feature para outros projetos, especialmente o projeto Itaú via Eva.

---

## 📋 ÍNDICE DE FEATURES PORTÁVEIS

| # | Feature | Complexidade | Tempo estimado | Dependências |
|---|---------|--------------|----------------|--------------|
| 1 | Undo/Redo via ring buffer JSON sobre estado reativo | 🟡 Média | 2-3h | Store reativo |
| 2 | Resize handle com magic snap + badge flutuante | 🟡 Média | 3-4h | CSS Grid |
| 3 | Drag-and-drop entre containers (HTML5 vanilla) | 🟢 Simples | 1-2h | HTML5 Drag API |
| 4 | Minimap/outline com navegação por click | 🟢 Simples | 1-2h | scrollIntoView |
| 5 | Modo Livre por container (position absolute + Pointer Events) | 🟡 Média | 3-5h | Pointer Events |
| 6 | Atalhos de teclado com ignore em campos editáveis | 🟢 Simples | 30min | nenhuma |

---

## 🟡 FEATURE 1: Undo/Redo via ring buffer JSON sobre estado reativo

### 📖 O que faz no Solstice

Ring buffer de 50 snapshots de `canvas.sections` (estado completo, JSON.stringify). Capturado via `Store.subscribe`. `Ctrl+Z` desfaz, `Ctrl+Shift+Z`/`Ctrl+Y` refaz. Flag `suppress` evita loop durante o próprio undo/redo. Mudança nova após undo descarta redos pendentes.

### 🎯 Por que vale portar

Qualquer editor que altera estado complexo precisa de Undo/Redo robusto. Para o Itaú: editor de relatórios, configurador de produto, modelagem de carteira — todos se beneficiam.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeUndo` módulo | 2725-2810 |
| Atalhos | `window.addEventListener('keydown')` dentro de `init()` | 2792-2805 |

### 🔗 Dependências

Store reativo (precisa de `subscribe(path, cb)` e `set/get`).

### 📝 Código fonte autônomo

```javascript
const Undo = (function(){
  const MAX = 50;
  const history = [];
  let pointer = -1;
  let suppress = false;

  function _capture(){
    if (suppress) return;
    const state = JSON.stringify(Store.get('myState') || {});
    if (pointer < history.length - 1) history.splice(pointer + 1);
    if (history.length && history[history.length - 1] === state) return;
    history.push(state);
    if (history.length > MAX) history.shift();
    else pointer++;
  }

  function undo(){
    if (pointer <= 0) return false;
    pointer--;
    suppress = true;
    try { Store.set('myState', JSON.parse(history[pointer])); }
    finally { suppress = false; }
    return true;
  }

  function redo(){
    if (pointer >= history.length - 1) return false;
    pointer++;
    suppress = true;
    try { Store.set('myState', JSON.parse(history[pointer])); }
    finally { suppress = false; }
    return true;
  }

  function canUndo(){ return pointer > 0; }
  function canRedo(){ return pointer < history.length - 1; }
  function size(){ return history.length; }

  function init(){
    _capture();
    Store.subscribe('myState', _capture);
    window.addEventListener('keydown', e => {
      const t = document.activeElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); undo(); }
      else if (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); redo(); }
      else if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')){ e.preventDefault(); redo(); }
    });
  }

  return { undo, redo, canUndo, canRedo, size, init };
})();
```

### 🤖 Prompt para Eva

```
Eva, implementar Undo/Redo no projeto.

Requisitos:
1. Ring buffer de 50 estados (configurável)
2. Captura automática via store reativo (não hook explícito em cada operação)
3. Flag suppress para evitar loop durante o próprio undo/redo
4. Mudança nova após undo descarta redos pendentes
5. Atalhos Ctrl+Z e Ctrl+Shift+Z (ignorar quando foco está em input/textarea/contenteditable)
6. API: undo() / redo() / canUndo() / canRedo() / size()

Referência:

[colar JS]

Adaptar:
- Substituir Store por nosso gerenciador (Zustand, Redux, etc.)
- Em Redux, redux-undo-redo pode ser mais idiomático — discutir
- Para estados muito grandes (>1MB), trocar JSON.stringify por diff incremental
```

### ⚠️ Pegadinhas

1. **`suppress` é crítico** — sem ele, undo dispara subscribe → captura → infinito.
2. **JSON.stringify falha em circular references**. Para estados com refs, usar `safe-json-stringify` ou estruturação tipo Immer.
3. **Foco em input**: Ctrl+Z dentro de input deve fazer undo do input, não do estado global. Por isso o early return.
4. **Mudança em outras paths**: se subscribe é por path, undo só cobre aquela árvore. Para Undo global, capturar `''` (root).
5. **Memória**: 50 × estado de 100KB = 5MB. Aceitar; se muito grande, considerar diff.

### ✅ Como testar

1. Estado inicial → `canUndo()` false.
2. 1 mudança → `canUndo()` true.
3. Ctrl+Z → estado anterior. `canRedo()` true.
4. Ctrl+Shift+Z → estado refeito.
5. Após undo, fazer nova mudança → `canRedo()` false (redos descartados).
6. 51 mudanças → primeira é descartada.

### 🔄 Variações

- **Histórico nomeado**: cada snapshot tem `description` ("Adicionou seção", "Renomeou KPI") para mostrar lista.
- **Branching**: árvore de história ao invés de buffer linear.
- **Persistência**: salvar histórico em localStorage para sobreviver a reload.

---

## 🟡 FEATURE 2: Resize handle com magic snap + badge flutuante

### 📖 O que faz no Solstice

Handle vertical entre slots adjacentes. Mousedown captura, mousemove aplica preview via `style.gridTemplateColumns`, mouseup commita no estado. Magic snap em frações canônicas (25/33/50/67/75%). Badge flutuante segue o cursor mostrando `60% | 40%`.

### 🎯 Por que vale portar

Substitui sliders/inputs verbosos por interação direta. Para o Itaú: configurador de alocação de carteira (snap em 25/50/75), divisor de colunas em relatórios, partition de tela em apps internos.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeResize` módulo | 2815-2935 |
| CSS | `.solstice__resize-handle`, `.solstice__resize-badge` | ~635-665 |

### 🔗 Dependências

CSS Grid (para layout que aceita `fr`).

### 📝 Código fonte autônomo

```javascript
function setupResize(){
  const SNAPS = [25, 33.33, 50, 66.67, 75];
  const TOL = 2.5;
  let active = null;

  function snap(pct){
    for (const s of SNAPS) if (Math.abs(pct - s) < TOL) return s;
    return pct;
  }

  document.addEventListener('mousedown', e => {
    const handle = e.target.closest('.resize-handle');
    if (!handle) return;
    e.preventDefault();
    const row = handle.closest('.row');
    const slots = row.querySelectorAll('.slot');
    const idx = +handle.dataset.idx;
    if (!slots[idx] || !slots[idx + 1]) return;
    const rect = row.getBoundingClientRect();
    const equal = 100 / slots.length;
    const widths = Array(slots.length).fill(equal);

    const badge = document.createElement('div');
    badge.className = 'resize-badge';
    badge.style.cssText = 'position:fixed;z-index:9999;background:#2563EB;color:#fff;padding:4px 10px;border-radius:6px;font-family:monospace;pointer-events:none;transform:translate(-50%,-150%);';
    document.body.appendChild(badge);

    active = { row, slots, idx, startX: e.clientX, widths, totalPx: rect.width, badge };
  });

  document.addEventListener('mousemove', e => {
    if (!active) return;
    const deltaPct = ((e.clientX - active.startX) / active.totalPx) * 100;
    const w = active.widths.slice();
    let l = w[active.idx] + deltaPct;
    l = snap(l);
    let r = (w[active.idx] + w[active.idx + 1]) - l;
    if (l < 5 || r < 5) return;
    w[active.idx] = l; w[active.idx + 1] = r;
    active.row.style.gridTemplateColumns = w.map(p => p.toFixed(2) + 'fr').join(' ');
    active.preview = w;
    active.badge.textContent = Math.round(l) + '% | ' + Math.round(r) + '%';
    active.badge.style.left = e.clientX + 'px';
    active.badge.style.top = e.clientY + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!active) return;
    if (active.preview){
      // commit no estado:
      Store.update(state => { /* state.row.widths = active.preview */ });
    }
    active.badge.remove();
    active = null;
  });
}
```

```css
.resize-handle {
  position: absolute; width: 8px; top: 0; bottom: 0;
  cursor: col-resize; background: transparent;
}
.resize-handle::after {
  content: ''; position: absolute;
  left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 2px; height: 32px; background: #ccc;
  transition: all 150ms;
}
.resize-handle:hover::after { background: #2563EB; height: 48px; width: 3px; }
```

### 🤖 Prompt para Eva

```
Eva, implementar resize via drag entre colunas/painéis no projeto.

Requisitos:
1. Handle vertical entre painéis adjacentes
2. Drag muda larguras relativas em tempo real (preview via style inline)
3. Magic snap em frações canônicas (25/50/75% — ajustar valores conforme produto)
4. Badge flutuante seguindo o cursor mostrando valores atuais
5. Mínimo 5% por painel
6. Commit no mouseup (1 entrada no Undo)

Referência:

[colar JS + CSS]

Adapte os valores de SNAPS conforme uso (ex: alocação de carteira em múltiplos de 5%).
```

### ⚠️ Pegadinhas

1. **`mousedown` direto no handle pode iniciar text selection**. `e.preventDefault()` no mousedown resolve.
2. **`mouseup` fora da window**: se o usuário arrasta para fora do browser, mouseup não dispara. Usar `pointercancel` como fallback.
3. **Magic snap pode incomodar** se o usuário precisa de valor exato. Adicionar `e.altKey` para desabilitar snap temporariamente.
4. **Touch**: o código assume mouse. Para mobile, trocar mousedown/move/up por `pointerdown/move/up`.
5. **Conflito com `cursor` global**: durante drag, setar `document.body.style.cursor = 'col-resize'` para que o cursor não mude ao passar sobre outros elementos.

### ✅ Como testar

1. Hover no handle: cursor vira col-resize.
2. Drag → larguras mudam · badge segue cursor.
3. Aproximar de 50%: cursor "gruda".
4. Tentar < 5%: bloqueado.
5. Soltar: estado commitado · undo possível.

### 🔄 Variações

- **Resize de altura**: mesmo padrão com `row-resize` cursor + delta no eixo Y.
- **Snap configurável por usuário**: setar `SNAPS` via preferência.

---

## 🟢 FEATURE 3: Drag-and-drop entre containers (HTML5 vanilla)

### 📖 O que faz no Solstice

Cada slot tem `draggable="true"`. HTML5 Drag API (`dragstart`/`dragover`/`drop`) via delegação no canvas. Soltar em outro slot = **swap**. Funciona entre rows e sections.

### 🎯 Por que vale portar

DnD universal sem libs (react-dnd, sortable.js). Para o Itaú: reordenar widgets, mover entre buckets, organizar listas.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeDnD` módulo | 2940-3010 |
| CSS | `.solstice__slot.is-dragging`, `.is-dragover` | ~607-615 |

### 🔗 Dependências

HTML5 Drag API (browsers modernos). Não funciona bem em mobile (usa touch events; B12 pode adicionar).

### 📝 Código fonte autônomo

```javascript
function setupDnD(rootSelector){
  const root = document.querySelector(rootSelector);

  root.addEventListener('dragstart', e => {
    const slot = e.target.closest('.slot');
    if (!slot) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', slot.dataset.id);
    slot.classList.add('is-dragging');
  });

  root.addEventListener('dragend', e => {
    e.target.closest('.slot')?.classList.remove('is-dragging');
    document.querySelectorAll('.slot.is-dragover').forEach(s => s.classList.remove('is-dragover'));
  });

  root.addEventListener('dragover', e => {
    const slot = e.target.closest('.slot');
    if (!slot) return;
    e.preventDefault();   // permite drop
    e.dataTransfer.dropEffect = 'move';
    slot.classList.add('is-dragover');
  });

  root.addEventListener('dragleave', e => {
    e.target.closest('.slot')?.classList.remove('is-dragover');
  });

  root.addEventListener('drop', e => {
    const slot = e.target.closest('.slot');
    if (!slot) return;
    e.preventDefault();
    slot.classList.remove('is-dragover');
    const srcId = e.dataTransfer.getData('text/plain');
    if (srcId === slot.dataset.id) return;
    swapInState(srcId, slot.dataset.id);   // hook no seu estado
  });
}
```

```css
.slot.is-dragging { opacity: 0.4; cursor: grabbing; }
.slot.is-dragover { border-color: #2563EB; background: rgba(37,99,235,.08); transform: scale(1.02); }
```

### 🤖 Prompt para Eva

```
Eva, drag-and-drop entre containers no projeto.

NÃO usar react-dnd, sortable.js ou similar — vanilla HTML5 Drag API.

Referência:

[colar JS + CSS]

Adapte:
- Identificar containers via data-id
- swapInState() é hook pro nosso store
- Mobile: HTML5 Drag não funciona bem; considerar @atlaskit/pragmatic-drag-and-drop ou implementação touch própria
- Acessibilidade: adicionar atalhos de teclado (Tab + Space para "pegar", setas para mover, Space para soltar)
```

### ⚠️ Pegadinhas

1. **`preventDefault` no `dragover`** é obrigatório — senão drop não dispara.
2. **`dataTransfer` é limitado em algumas APIs** — alguns browsers limitam o que pode ser lido em dragover (só drop). Adicionar fallback em variável compartilhada se precisar.
3. **`is-dragover` fica preso** se dragleave não dispara (acontece quando entra em filho). Solução: usar contador (entries++ no dragenter, entries-- no dragleave).
4. **Mobile**: HTML5 Drag não funciona em iOS/Android touch. Usar Pointer Events com long-press + custom feedback.
5. **`draggable="true"` em todos os elementos** pode interferir com seleção de texto. Adicionar `user-select: none` em containers.

### ✅ Como testar

1. Arrastar slot A para slot B → swap.
2. Soltar fora de slot → nada.
3. Arrastar entre sections → swap entre seções funciona.

### 🔄 Variações

- **Insert entre A e B** (não swap): adicionar drop zones intermediárias.
- **Multi-select drag**: capturar Shift/Ctrl + drag para mover múltiplos.

---

## 🟢 FEATURE 4: Minimap/outline com navegação por click

### 📖 O que faz no Solstice

DIV `position: fixed` bottom-right. Cada section vira card mini com mini-rows. Click rola canvas até a section via `scrollIntoView smooth`. Botão de colapsar reduz a 32×32px.

### 🎯 Por que vale portar

Navegação em documentos longos / dashboards densos. Para o Itaú: ToC de relatório de 50 páginas, índice de painéis numa visão consolidada.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeMinimap` módulo | 3015-3080 |
| CSS | `.solstice__minimap*` | ~675-720 |

### 🔗 Dependências

`scrollIntoView` (universal). Store reativo para re-render automático.

### 📝 Código fonte autônomo

```javascript
function setupMinimap(getSections, rootSelector){
  let collapsed = false;
  const el = document.createElement('div');
  el.className = 'minimap';
  document.body.appendChild(el);

  function render(){
    const sections = getSections();
    el.style.display = sections.length ? 'block' : 'none';
    el.classList.toggle('minimap-collapsed', collapsed);
    el.innerHTML = `
      <div class="minimap-head">
        <span>🗺️ ${sections.length} ${sections.length === 1 ? 'seção' : 'seções'}</span>
        <button class="minimap-toggle">${collapsed ? '▢' : '▭'}</button>
      </div>
      ${collapsed ? '' : `<div class="minimap-canvas">${sections.map(sec => `
        <div class="minimap-section" data-id="${sec.id}">
          <div class="minimap-section-title">${escapeHtml(sec.title)}</div>
          ${sec.rows.map(r => `<div class="minimap-row">${r.slots.map(() => '<div class="minimap-slot"></div>').join('')}</div>`).join('')}
        </div>`).join('')}</div>`}`;

    el.querySelector('.minimap-toggle')?.addEventListener('click', () => { collapsed = !collapsed; render(); });
    el.querySelectorAll('.minimap-section').forEach(card => {
      card.addEventListener('click', () => {
        const target = document.querySelector(`${rootSelector} [data-id="${card.dataset.id}"]`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  return { render };
}
```

```css
.minimap {
  position: fixed; bottom: 32px; right: 24px;
  width: 160px; max-height: 240px;
  background: #fff; border: 1px solid #ddd;
  border-radius: 8px; padding: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,.1);
  z-index: 50;
}
.minimap-collapsed { width: 32px; max-height: 32px; padding: 6px; }
.minimap-collapsed .minimap-canvas { display: none; }
.minimap-section { background: #f5f5f5; border-radius: 4px; padding: 4px; cursor: pointer; margin-bottom: 2px; }
.minimap-row { display: flex; gap: 2px; height: 8px; margin-bottom: 2px; }
.minimap-slot { flex: 1; background: #2563EB; opacity: 0.35; border-radius: 1px; }
```

### 🤖 Prompt para Eva

```
Eva, mini-navegador (outline) para painel longo no projeto.

Click numa entrada rola até a section correspondente. Botão de colapsar.

Referência:

[colar JS + CSS]

Adapte:
- O que mostrar: títulos de seções, contagem de items, status (ex: pendente/aprovado em cores)
- Mobile: esconder em <768px ou virar drawer
- Posição configurável (top-right, fixed-bottom-bar)
```

### ⚠️ Pegadinhas

1. **`scrollIntoView({ behavior: 'smooth' })`** pode ficar irritante em listas longas. Usar `instant` se for >50 sections.
2. **Re-render reativo é caro** se chamado a cada keystroke. Throttle/debounce em apps com edição contínua.
3. **`position: fixed` em mobile** pode interferir com teclado virtual. Esconder em mobile ou virar drawer.
4. **Z-index**: minimap deve ficar abaixo de modais (z-index: 50 < z-index modal: 200).

### ✅ Como testar

1. Adicionar 3 sections → minimap aparece com 3 cards.
2. Click no 3º card → canvas rola até a 3ª section.
3. Botão ▭ colapsa para 32×32.
4. Limpar canvas → minimap esconde.

### 🔄 Variações

- **Zoom + pan**: minimap como canvas SVG interativo.
- **Live preview**: cada mini-slot tem ícone do componente real (KPI/série/etc.).

---

## 🟡 FEATURE 5: Modo Livre por container (position absolute + Pointer Events)

### 📖 O que faz no Solstice

Toggle por row entre modo grid (CSS Grid) e modo livre (`position: absolute`). Em modo livre, slots têm `{x, y, w, h}` no estado. Drag via Pointer Events no handle `⋮⋮`. Pointer capture garante captura mesmo se cursor sair do elemento.

### 🎯 Por que vale portar

Layouts criativos sem framework. Para o Itaú: editor de templates de relatório, customização visual avançada (ainda que com cuidado — usuário pode bagunçar).

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeFreeMode` módulo | 3085-3170 |
| CSS | `.solstice__row[data-mode="free"]`, `.solstice__free-handle` | ~744-780 |

### 🔗 Dependências

Pointer Events (universal há anos).

### 📝 Código fonte autônomo

```javascript
function setupFreeMode(rootSelector){
  let drag = null;
  const root = document.querySelector(rootSelector);

  root.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.free-handle');
    if (!handle) return;
    const slot = handle.closest('.slot');
    const row = slot.closest('.row');
    if (row.dataset.mode !== 'free') return;
    e.preventDefault();
    drag = {
      slot, row,
      startX: e.clientX, startY: e.clientY,
      startLeft: parseFloat(slot.style.left) || 0,
      startTop:  parseFloat(slot.style.top) || 0,
      rowRect: row.getBoundingClientRect()
    };
    slot.classList.add('is-dragging-free');
    handle.setPointerCapture(e.pointerId);   // mantém o evento mesmo se cursor sair
  });

  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dxPct = ((e.clientX - drag.startX) / drag.rowRect.width) * 100;
    const dy = e.clientY - drag.startY;
    drag.slot.style.left = Math.max(0, drag.startLeft + dxPct) + '%';
    drag.slot.style.top  = Math.max(0, drag.startTop + dy) + 'px';
    drag.previewLeft = parseFloat(drag.slot.style.left);
    drag.previewTop  = parseFloat(drag.slot.style.top);
  });

  document.addEventListener('pointerup', () => {
    if (!drag) return;
    drag.slot.classList.remove('is-dragging-free');
    if (drag.previewLeft != null){
      // commit no estado:
      updateSlotPosition(drag.slot.dataset.id, drag.previewLeft, drag.previewTop);
    }
    drag = null;
  });
}
```

```css
.row[data-mode="free"] {
  position: relative; display: block; min-height: 240px;
  background: repeating-linear-gradient(45deg, transparent 0, transparent 10px, #f5f5f5 10px, #f5f5f5 11px);
  border: 1px dashed #ddd;
}
.row[data-mode="free"] > .slot { position: absolute; user-select: none; }
.row[data-mode="free"] > .slot.is-dragging-free { opacity: 0.8; z-index: 10; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
.free-handle {
  position: absolute; top: 2px; left: 2px; right: 2px; height: 14px;
  cursor: move; background: #eee; border-radius: 2px 2px 0 0;
  text-align: center; line-height: 14px; font-size: 10px;
}
```

### 🤖 Prompt para Eva

```
Eva, modo "layout livre" para o projeto.

Em modo livre, cada widget tem position absolute com {x, y, w, h}.
Drag via handle no topo do widget.

Pointer Events com setPointerCapture (para drag continuar mesmo fora do elemento).

Referência:

[colar JS + CSS]

Adapte:
- Adicionar handles de resize (SE/E/S corners)
- Smart guides: linhas vermelhas quando alinha com outro widget
- Snap em grade (toggleável: snap em 8px, 16px ou off)
- Detecção de colisão (opcional — Solstice deixa overlap acontecer)
```

### ⚠️ Pegadinhas

1. **`setPointerCapture`** é essencial — sem isso, drag para quando cursor sai do handle.
2. **Mistura de unidades** (% horizontal + px vertical): deliberada porque width é responsiva mas altura é geralmente fixa. Para 100% responsivo, usar % em ambos.
3. **`min-height` na row** evita colapso quando todos slots estão no topo.
4. **Z-index entre slots em modo livre**: último arrastado deve ficar por cima. Adicionar `z-index: ++counter` no pointerdown.
5. **Slots sobrepostos sem detecção**: aceitar como feature (modo livre permite criatividade).

### ✅ Como testar

1. Toggle modo livre → row vira hachurada.
2. Drag handle → slot move.
3. Soltar fora da row → posição clampada para >= 0.
4. Voltar para grid → posições preservadas no estado (uso futuro).

### 🔄 Variações

- **Smart guides** (B12 do Solstice): durante drag, linhas vermelhas quando alinha com borda/centro de outro slot.
- **Snap em grade configurável** (10px/20px/off).
- **Resize por handles** SE/E/S nos corners.

---

## 🟢 FEATURE 6: Atalhos de teclado com ignore em campos editáveis

### 📖 O que faz no Solstice

`window.addEventListener('keydown')` global, mas se o foco está em `<input>`, `<textarea>` ou elemento com `contentEditable`, **não dispara o atalho**. Deixa o campo fazer seu próprio undo/redo nativo.

### 🎯 Por que vale portar

Padrão obrigatório para qualquer app com Ctrl+Z global. Falha disso é UX clássica de "Ctrl+Z apagou tudo que eu escrevia".

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeUndo.init` keydown handler | 2795-2805 |

### 🔗 Dependências

Nenhuma.

### 📝 Código fonte autônomo

```javascript
function bindGlobalShortcut(combo, fn){
  window.addEventListener('keydown', e => {
    // Ignora se foco está em campo editável
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    if (matchCombo(e, combo)){
      e.preventDefault();
      fn(e);
    }
  });
}

function matchCombo(e, combo){
  // combo: "Ctrl+Z" | "Ctrl+Shift+Z" | "Ctrl+K"
  const parts = combo.toLowerCase().split('+');
  const wantCtrl = parts.includes('ctrl');
  const wantShift = parts.includes('shift');
  const wantAlt = parts.includes('alt');
  const key = parts[parts.length - 1];

  return e.ctrlKey === wantCtrl &&
         e.shiftKey === wantShift &&
         e.altKey === wantAlt &&
         e.key.toLowerCase() === key;
}

// Uso:
bindGlobalShortcut('Ctrl+Z', () => Undo.undo());
bindGlobalShortcut('Ctrl+Shift+Z', () => Undo.redo());
bindGlobalShortcut('Ctrl+K', () => openCommandPalette());
```

### 🤖 Prompt para Eva

```
Eva, atalhos globais de teclado no projeto.

Padrão: ignorar atalho quando foco está em input/textarea/contenteditable
(para não conflitar com Ctrl+Z nativo do campo).

Referência:

[colar JS]

Mapear os atalhos do projeto:
- Ctrl+Z / Ctrl+Shift+Z: undo/redo global
- Ctrl+K: command palette
- Ctrl+S: salvar
- Esc: cancelar / fechar modal

Documentar atalhos no help do app (Bloco 12 do Solstice fará tour interativo).
```

### ⚠️ Pegadinhas

1. **Mac vs Windows**: usar `e.ctrlKey || e.metaKey` para suportar Cmd no Mac.
2. **`contentEditable` em IE11**: prop é diferente; mas IE11 não é suportado em browsers modernos.
3. **`document.activeElement` pode ser `body` em alguns casos** — checar `tagName === 'BODY'` retorna false em todos os checks.
4. **Atalho dentro de modal**: pode interferir com foco do modal. Adicionar check de `.modal-overlay` presente.

### ✅ Como testar

1. Sem foco em input: Ctrl+Z dispara undo global.
2. Click em `<input>` + Ctrl+Z: undo nativo do input.
3. Click em elemento `contentEditable` + Ctrl+Z: undo nativo do elemento.

### 🔄 Variações

- **Sequências (chord)**: Ctrl+K seguido de letra (estilo VS Code).
- **Customizáveis pelo usuário**: ler combos de preferência.

---

## 🟥 RESUMO DO BLOCO

### Features mais valiosas para portar primeiro

1. **🥇 Undo/Redo (F1)** — base de qualquer editor. Se o app permite o usuário criar/editar, Undo é não-negociável.
2. **🥈 Atalhos globais com ignore em editables (F6)** — pareia com Undo/Redo. Custo trivial.
3. **🥉 Drag-and-drop (F3)** — reordenar/mover é usabilidade direta.
4. **Resize com magic snap (F2)** — alto valor visual; cuidado com snap em produtos onde precisão é tudo.

### Features que NÃO vale portar isoladamente

- **Minimap (F4)** — só vale com canvas longo (10+ sections). Para app curto, é decoração.
- **Modo Livre (F5)** — adiciona poder mas complica UX. Para a maioria dos casos, grid é suficiente. Se decidir portar, faça smart guides juntos.

### Recomendação específica para projeto Itaú

**Para Eva/Itaú:**

1. **Adotar Undo/Redo + atalhos** em qualquer editor de relatório/configuração. Sem ele, usuários temem mexer. Com ele, exploram livremente.
2. **DnD em listas ordenáveis** (priorização de tarefas, ranking de produtos, etc.).
3. **Resize**: aplicar em editores de carteira (alocação % entre ativos) com snap em múltiplos de 5%.
4. **Minimap**: só em relatórios longos de auditoria/compliance.
5. **Modo Livre**: pular no MVP. Adicionar somente se houver demanda explícita para layouts criativos não-grid.

**Considerações específicas:**
- **Acessibilidade**: DnD por mouse não é WCAG. Adicionar atalhos de teclado (Tab + Space para "pegar", setas para mover) é obrigatório para Itaú.
- **Auditoria de Undo**: para compliance, gravar log de cada operação (snapshot timestamp + userId + descrição). Não no MVP, mas planejado.

---

> Documento gerado no Bloco 4. Linhas aproximadas. Comando: `PORTABILIDADE BLOCO 4` regenera com linhas atuais.
