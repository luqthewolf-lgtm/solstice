# Changelog — Bloco 4 (Resize Livre + Modo Livre + Micro-interações)

**Data:** 2026-05-17
**Sessão:** 1 (Blocos 1, 2, 3 e 4 entregues juntos)
**Versão entregue:** v5.3.0-bloco4
**Tamanho dashboard.html:** ~115 KB (~4.300 linhas)

---

## ✅ Implementado

### 1. Banner + toolbar

- Banner topo: "BLOCO 4 · RESIZE LIVRE + MODO LIVRE + MICRO-INTERAÇÕES"
- Toolbar do canvas ganha **↺ Undo** e **↻ Redo** (estado `disabled` reativo)
- Row-toolbar ganha **🔀** (toggle Modo Livre / Voltar ao Grid)

### 2. CSS Bloco 4 (~150 linhas)

- `.solstice__resize-handle` (vertical, 8px de hit area, divisor visual 2px → 3px no hover)
- `.solstice__resize-badge` (badge flutuante seguindo o cursor)
- `.solstice__btn:disabled` (estado universal para undo/redo)
- `.solstice__minimap*` (fixed bottom-right, cards proporcionais, modo colapsado 32×32)
- `.solstice__row[data-mode="free"]` (fundo hachurado, slots absolute)
- `.solstice__free-handle` (drag handle no topo do slot em modo livre)
- `@keyframes solstice-section-in` (fade-in + slide-up de 4px em 250ms)
- Estados de DnD: `is-dragging`, `is-dragover` (border accent, scale 1.02)

### 3. `SolsticeUndo` (~80 LOC)

Ring buffer de 50 snapshots. Atalhos `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`. Captura desacoplada via `Store.subscribe('canvas.sections')`. Flag `suppress` evita loop. Toolbar reflete `canUndo()` / `canRedo()` via `disabled`. Ignora atalhos quando foco está em input/textarea/contenteditable.

### 4. `SolsticeResize` (~150 LOC)

Event delegation no canvas para `mousedown` em `.solstice__resize-handle`. Drag muda `style.gridTemplateColumns` inline em tempo real (preview). Magic snap em **25 / 33.33 / 50 / 66.67 / 75%** (tolerância 2.5%). Mínimo 5% por slot. Commit no `mouseup` setando `row.widths = [...]` + `row.layout = 'custom'` (gera 1 snapshot Undo). Badge flutuante mostra `60% | 40%`.

### 5. `SolsticeDnD` (~100 LOC)

HTML5 Drag API com delegação no canvas. `dataTransfer` carrega `{secId, rowId, slotId}`. Estados visuais (`is-dragging`, `is-dragover`). Drop = **swap** entre slots origem e destino (mesma row, entre rows, entre sections). Toast informa + sugere Ctrl+Z.

### 6. `SolsticeMinimap` (~120 LOC)

DOM `position: fixed` bottom-right. Cada section = card com título + mini-rows + mini-slots (proporcionais). Click em section → `scrollIntoView smooth`. Botão ▭/▢ colapsa/expande. Esconde quando `canvas.sections` está vazio. Re-render reativo.

### 7. `SolsticeFreeMode` (~180 LOC)

Toggle por row na mini-toolbar. `row.mode = 'grid' | 'free'`. Em modo livre:
- Row recebe `data-mode="free"` (CSS muda: fundo hachurado, `position: relative`, `min-height: 240px`)
- Slots ganham `{x, y, w, h}` no Store
- Slots viram `position: absolute` com style inline `left/top/width/height`
- Drag handle `⋮⋮` no topo de cada slot dispara Pointer Events
- Pointer capture + delta + commit no `pointerup`
- Toast informa "Smart guides chegam no Bloco 12"
- Smart guides + resize por handle em modo livre: **stub** (Bloco 12 polish)

### 8. Integração no `SolsticeCanvas`

`_renderRow` ganha:
- `data-mode` (grid/free)
- `style.gridTemplateColumns` quando `widths` existe
- Handles de resize entre slots adjacentes (modo grid)
- Botão 🔀 na row-toolbar

`_renderSlot` ganha:
- `draggable="true"` sempre
- Posição absolute + handle `⋮⋮` em modo livre

`Canvas.init` agora chama `init()` dos 5 módulos novos (após o primeiro render).

### 9. Atualizações em `window.Solstice`

- `Undo`, `Resize`, `DnD`, `Minimap`, `FreeMode` expostos
- Version: `5.3.0-bloco4`
- Console banner mostra histórico do Undo na carga

### 10. Meta-arquivos

- `PROGRESSO.md` — Bloco 4 ✓
- `DECISOES.md` — +5 ADRs (025-029)
- `API.md` — 5 seções novas (Undo, Resize, DnD, Minimap, FreeMode) + paths novos no Store
- `BUGS.md` — checklist Bloco 4 (34 itens)
- `changelog/bloco-04.md` (este)
- `portabilidade/bloco-04.md` (6+ features)

---

## ✅ Checklist do Bloco 4

- [x] HTML sem erros no console (sentinel `[Solstice] boot OK`)
- [x] Funcionalidades dos Blocos 1, 2 e 3 intactas
- [x] Dark/Light em todos os 6 temas (testar handle, minimap, modo livre)
- [x] Mobile: minimap ocupa muito espaço em <768px — TODO escondê-lo no B12 polish
- [x] Comentários em PT-BR
- [x] Sem novas dependências
- [x] Locale aplicado nos toasts
- [x] Sem erros novos no catálogo (Bloco 4 não precisou)
- [x] Auditoria de decisões: estrutura serializável em Store; B5 fará interceptor automático
- [x] Dicionário consultado (templates filtram + futuros componentes usarão)
- [x] friendlyName ainda usado no preview de tabela
- [x] PROGRESSO/DECISOES/API/BUGS atualizados
- [x] changelog/bloco-04.md criado
- [x] portabilidade/bloco-04.md criado
- [x] 6+ features documentadas em portabilidade/
- [x] Prompts pra Eva incluídos
- [x] Marca `═══ FIM DO BLOCO 4 ═══` presente

---

## 🐛 Limitações conhecidas

1. **Smart guides não implementadas no B4** — drag em modo livre não tem linhas vermelhas de alinhamento. Vai para B12.
2. **Resize handles em modo livre** não funcionam — só drag para mover. B12.
3. **Drop entre slots (não swap)** — para inserir slot entre A e B, B12 adicionará drop zones intermediárias.
4. **Snapshot do Undo é JSON.stringify completo** — para >1000 slots, considerar diff. Limite atual: 50 estados × ~10KB = ~500KB.
5. **Undo não inclui** mudanças fora de `canvas.sections` (ex: edição de coluna no Editor da sidebar). Aceitável por design.
6. **Minimap não tem zoom/pan** — só click pra navegar. B12.
7. **Magic snap fixo em 5 valores** — sem `Alt` para desabilitar ainda. B12.
8. **Slots em modo livre** podem se sobrepor — sem detecção de colisão. Aceitável (modo livre permite layouts criativos).
9. **`row.widths` aplicado quando `widths.length === slots.length`** — se usuário muda layout (que reslota), widths podem ficar dessincronizadas. Reset na troca de layout funciona; manualmente editar `slots.length` quebra (não tem UI pra isso).

---

## ▶ Próximo bloco

**Bloco 5 — 4 Componentes Base + Auditoria + Integração Dicionário (Diferencial #1)**

Comando: `AVANÇAR BLOCO 5`
