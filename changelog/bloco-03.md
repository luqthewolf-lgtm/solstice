# Changelog — Bloco 3 (Canvas + Seções + Linhas + Layouts + Templates Agnósticos)

**Data:** 2026-05-17
**Sessão:** 1 (Blocos 1, 2 e 3 entregues juntos)
**Versão entregue:** v5.3.0-bloco3
**Tamanho dashboard.html:** ~95 KB (~3.500 linhas)

---

## ✅ Implementado

### 1. Banner + Toolbar do canvas

- Banner topo: "BLOCO 3 · CANVAS + SEÇÕES + LINHAS + LAYOUTS + TEMPLATES AGNÓSTICOS"
- Botão "📁 Importar CSV" reposicionado para o **header** (permanente, não atrelado ao empty state)
- Canvas (`<main>`) inteiramente controlado pelo `SolsticeCanvas.render()` — HTML estático removido
- File input movido para fora do canvas (era limpo a cada render)

### 2. CSS Bloco 3 (~250 linhas)

- `.solstice__canvas-toolbar` (top bar fixa)
- `.solstice__section` + `-head` + `-title` + `-actions` + `-btn` + `-body`
- `.solstice__row` com 10 variantes `[data-layout]` via CSS Grid
- `.solstice__row-toolbar` contextual (visível no hover)
- `.solstice__slot` placeholder com hover state
- `.solstice__empty-templates` (grid responsivo de cards de template)
- `.solstice__empty-template-card` + `-icon` + `-title` + `-desc` + `-badge` (variante `--domain`)

### 3. `SolsticeLayouts` (~80 LOC)

10 layouts: `1col`, `2col-equal`, `2col-2-1`, `2col-1-2`, `3col-equal`, `3col-1-2-1`, `4col-equal`, `hero-bottom`, `sidebar-main`, `custom`.

API: `LAYOUTS`, `get`, `list`, `slotCount`, `reslot`.

`reslot(row, newLayout)` ajusta a quantidade de slots preservando os existentes — adiciona slots `{type:'empty'}` se aumentar, remove os últimos se diminuir.

### 4. `SolsticeCanvas` (~350 LOC)

Estado em `Store.canvas.sections` (estrutura aninhada Section → Row → Slot, cada nível com `id` uuid).

**Operações:**
- `addSection(title?)`, `removeSection(id)`, `duplicateSection(id)`, `moveSection(id, delta)`, `setSectionTitle(id, t)`
- `addRow(secId, layout?, afterRowId?)`, `removeRow(secId, rowId)`, `duplicateRow(secId, rowId)`, `changeRowLayout(secId, rowId, newLayout)`
- `applyTemplate(sections)` — recebe estrutura sem id, gera ids
- `clear()` — reseta para `[]`
- `render()` — re-render manual (assina automaticamente via `init()`)

**Render reativo:** `subscribe('canvas.sections')` + `subscribe('dataset.ready')` + `subscribe('dictionary')`.

**Confirmações destrutivas** (remover seção/row) via `SolsticeModal.confirm({ danger: true })`.

### 5. `SolsticeTemplates` (~250 LOC)

**6 templates agnósticos:**
1. KPIs + Tendência — 4 KPIs + 1 série temporal
2. Comparação de Categorias — 2col-2-1
3. Composição — 2col-1-2
4. Análise de Distribuição — 3col-equal
5. Visão Executiva — 4 KPIs + bloco narrativa
6. Tabela com Filtros — 1col

**6 templates de domínio** (filtrados por `ingest.dictDetection.dictKey`):
- 🏦 banco_pj → Carteira PJ (3 KPIs + série + análise por segmento)
- 💰 vendas → Performance Comercial
- 👥 rh → People Snapshot
- 📊 marketing → Funil + ROAS
- 🏭 operacional → Operação em Tempo Real
- 🔬 cientifico → Análise Experimental

**API:** `list()` (agnósticos + domínio aplicável), `getAll()`, `apply(id)`, `openPicker()` (modal de seleção com busca).

### 6. UI nova

- **Toolbar fixa:** `+ Seção` (botão primário) · `📋 Templates` · `👁️ Preview dos dados` (visível só com dataset)
- **Section header:** título editável inline (contenteditable) + 5 botões (↑ ↓ + ⎘ ✕) com opacity 0.5 → 1 no hover
- **Row mini-toolbar:** flutua acima da row no canto direito (📐 ⎘ + ✕)
- **Slot placeholder:** ícone + label "+ Componente" + hint "disponível no Bloco 5"
- **Empty state condicional:**
  - Sem dataset: CTAs dummy + import
  - Com dataset: grid de cards de templates (com badges agnóstico/domínio)

### 7. Refatoração do preview de tabela

- `Editor.renderPreview` agora popula um modal (não mais o canvas)
- Novo método `Editor.openPreview()` abre `Modal.show({ size: 'lg' })` com a tabela
- Botão `👁️ Preview dos dados` na toolbar do canvas dispara

### 8. Refatoração do boot

- `_runIngestFile(file)` e `_loadDummyDataset()` extraídos para escopo do IIFE (acessíveis pelo Canvas)
- `boot()` ficou enxuto: bind do file-input + tema + locale + perfil + onboarding + debug + `Canvas.init()`

### 9. Atualizações em `window.Solstice`

- `Layouts`, `Canvas`, `Templates` expostos
- `version`: `5.3.0-bloco3`

### 10. Erros e regressões

- Nenhum erro novo necessário (Canvas tem confirmações via Modal)
- Catálogo de erros segue em 15

### 11. Meta-arquivos

- `PROGRESSO.md` — atualizado com Bloco 3 ✓
- `DECISOES.md` — +4 ADRs (020-023)
- `API.md` — seções Layouts/Canvas/Templates + paths novos no Store
- `BUGS.md` — checklist Bloco 3 (24 itens)
- `changelog/bloco-03.md` (este arquivo)
- `portabilidade/bloco-03.md` — 6+ features

---

## 🎯 Decisões durante a sessão

1. **Canvas dono único** do `<main>` (ADR-023) — preview de tabela virou modal.
2. **Templates como receitas** com `build()` retornando estrutura sem id (ADR-022) — facilita serialização e clonagem.
3. **Layouts via atributo CSS** (ADR-021) — trocar layout é zero JS de re-render.
4. **Slots como placeholders no Bloco 3** — componentes reais chegam no Bloco 5.
5. **Empty state com CTAs próprios** — em vez de redirecionar pro header, repete os botões pra reduzir fricção.
6. **Layout picker via Modal.select** (reuso do Bloco 2 r2 com search auto) — coerência de UX.

---

## ✅ Checklist do Bloco 3

- [x] HTML sem erros no console
- [x] Funcionalidades dos Blocos 1 e 2 intactas (toggle tema, locale, import, editor)
- [x] Dark/Light em todos os 6 temas
- [x] Mobile (375px): sidebar some, canvas continua usável (toolbar quebra em mobile pequeno; aceitável)
- [x] Comentários em PT-BR
- [x] Sem novas dependências
- [x] Locale aplicado (`data-i18n` preservados onde existem)
- [x] Erros do bloco no catálogo (nenhum erro novo necessário — Canvas usa Modal.confirm)
- [x] Auditoria: estrutura em Store.canvas.sections é serializável → caminho aberto para B5 (auditoria automática via interceptor)
- [x] Dicionário consultado (templates de domínio filtram por `dictDetection.dictKey`)
- [x] friendlyName usado (no preview de tabela, herdado do Bloco 2)
- [x] PROGRESSO/DECISOES/API/BUGS atualizados
- [x] changelog/bloco-03.md criado
- [x] portabilidade/bloco-03.md criado
- [x] 6+ features documentadas em portabilidade/
- [x] Prompts pra Eva incluídos
- [x] Marca `═══ FIM DO BLOCO 3 ═══` presente

---

## 🐛 Limitações conhecidas

1. **Slots vazios** — Bloco 5 plugará componentes reais (KPI, série temporal, tabela, distribuição).
2. **Sem drag-and-drop entre slots** — vem no Bloco 4 junto com resize/livre.
3. **Sem persistência** — reload zera canvas. Snapshots vêm no Bloco 11.
4. **Sem undo/redo** — qualquer ação destrutiva pede confirmação modal. Undo global vem no Bloco 4.
5. **Layout `custom`** existe mas só renderiza 1 slot. Editor de grid custom vem no Bloco 4/12.
6. **`hero-bottom` com >3 slots** simplifica para 3 (primeiro = hero, demais = abaixo) — não suporta 4+.
7. **Re-render completo** a cada mudança no `canvas.sections`. Para 50+ sections, considerar diffing por id no Bloco 12.
8. **Modal de preview** não atualiza em tempo real ao editar coluna (reabrir mostra novo estado).

---

## ▶ Próximo bloco

**Bloco 4 — Resize Livre + Modo Livre + Micro-interações**

Comando: `AVANÇAR BLOCO 4`
