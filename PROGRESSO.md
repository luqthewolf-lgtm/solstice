# PROGRESSO — Solstice / Dashboard Studio

> Status persistente do projeto. Atualizado ao final de cada bloco.
> Leia este arquivo **primeiro** ao retomar uma sessão.

---

## 📊 Status Geral

| Campo | Valor |
|---|---|
| Versão atual | **v5.3.0-bloco12** (B12 — 5 Modos + Slides + Apresentador + Command Palette + Tour + Polish) |
| Bloco corrente | **Bloco 12 — 5 Modos + Slides + Apresentador + Command Palette + Tour + Polish** ✅ COMPLETO |
| Próximo bloco | Bloco 13 — Diferenciais Avançados (Comentários + Grafo de Métricas + 10+ features) |
| Sessões realizadas | 2 (B1-B5 + B6 + B7) |
| Data última atualização | 2026-05-18 |
| Tempo total estimado restante | ~5-7 sessões |

---

## ✅ Blocos Concluídos

### 🟦 Bloco 1 — Fundação + Design System + Locale + Erros + Dicionário

**Entregue em:** 2026-05-17 · Sessão 1

Detalhes em [changelog/bloco-01.md](changelog/bloco-01.md) e [portabilidade/bloco-01.md](portabilidade/bloco-01.md).

Módulos: `Utils`, `Store`, `Locale`, `Errors`, `Toast`, `Profiles`, `Theme`, `Dictionary`, `Dummy`, `Onboarding`, `Debug` (11).

### 🟩 Bloco 2 — Ingestão + Validador + Editor + Tipos Expandidos

**Entregue em:** 2026-05-17 · Sessão 1

**Módulos novos (6):**

- `SolsticeBR` — CPF/CNPJ/CEP com algoritmos de DV reais (não só regex)
- `SolsticeTypes` — **30 tipos** com `detect/validate/aggs/format/viz` (Seção 11 do PROMPT integral)
- `SolsticeIngest` — pipeline de 5 etapas: `detect → parse → infer → validate → enrich`
- `SolsticeDatasetType` — classifica em 6 perfis (`transactional/categorical/timeseries/snapshot/survey/scientific`)
- `SolsticeQuality` — score 0-100 adaptativo por perfil (correção v5.2 #3)
- `SolsticeEditor` — UI inline na sidebar: rename / drop / change type / 8 transformações

**Funcionalidades visíveis novas:**

- Botão "📁 Importar CSV" habilitado (aceita .csv/.tsv/.txt)
- Drop file abre file picker
- Pipeline de import: detecta delimitador, parsea (PapaParse ou fallback), infere tipos, valida, enriquece
- Sidebar mostra **painel de qualidade** (score colorido + 3 flags top) ao ingerir
- Sidebar mostra **editor de colunas** com rename inline (contenteditable), badges de tipo, sparkline para numéricos
- Canvas mostra **preview de tabela** (50 linhas, cores por estado: numérico/null/inválido, formatação por tipo)
- Dummy agora roda pelo mesmo pipeline (caminho único)

**+5 erros:** `CSV_DELIMITER_AMBIGUOUS`, `COLUMN_HIGH_NULL_RATIO`, `COLUMN_TYPE_AMBIGUOUS`, `INVALID_CPF`, `INVALID_CNPJ` → catálogo total: **15 erros**.

**Decisões arquiteturais novas:** ADR-009 (pipeline 5 etapas) · ADR-010 (validação BR com DV completo) · ADR-011 (Quality adaptativo por perfil).

### 🔧 Correções pós-entrega (r1) — mesma sessão

Lucas reportou 2 bugs + 3 refinamentos visuais após validar o Bloco 2 inicial. Endereçados:

1. **`alert/confirm/prompt` nativos eliminados** → criado módulo `SolsticeModal` (show/confirm/prompt/select) Promise-based com focus trap, Esc, click backdrop, role=dialog, variante `danger`. Editor refatorado para `await SolsticeModal.*`. (ADR-012)
2. **Tipos técnicos em pt-BR na UI** → `SolsticeTypes.label/icon/group` adicionados; 32 tipos mapeados. Toda UI (editor + preview header + modal de seleção) usa `label()`. (ADR-013)
3. **Sparkline removido do Editor** → substituído por barra de preenchimento gradiente SVG (verde/accent/warn/error por faixa) com tooltip + aria progressbar. Sparkline volta no Bloco 7 (painel de qualidade). (ADR-014)
4. **Header de coluna em 3 linhas:** ícone+nome+actions / tipo·unidade·únicos / fillbar+%. (ADR-015)
5. **Tabela de preview rica:** bordas verticais + hover destacado + tabular-nums + monospace em numéricos + header com ícone + label pt-BR. (ADR-016)

`Solstice.Modal` adicionado ao `window.Solstice`. Versão bumpada para `5.3.0-bloco2-r1`.

**Tamanho do arquivo:** dashboard.html agora ~3.000 linhas (~78 KB).

### 🔧 Refinamentos r2 — UX/densidade/busca (mesma sessão)

Lucas reportou 3 ajustes adicionais após r1:

1. **Indicador de preenchimento ajustado** (ADR-019) — número 100% oculto (barra cheia comunica), slot fixo de 32px, cores por faixa (`muted` ≥80% / `warn` 60-79% / `error` <60%), font-weight 600.
2. **Cards do editor controlados por densidade global** (ADR-018) — tokens `--ed-pad-y/x`, `--ed-gap`, `--ed-row2-mt`, `--ed-fill-mt`, `--ed-info-size`, `--ed-action-size` por `data-density`. Comfortable default cabe 8+ cards em 1080p; compact ainda mais; spacious ~1.5x.
3. **Busca textual em `Modal.select`** (ADR-017) — parâmetro `searchable: 'auto'|true|false`. Auto = ativa se options > 8. Match em label + value + desc + synonyms (NFD/lowercase). Setas ↑↓, Enter, Esc, highlight `<mark>`, empty state, debounce 100ms, auto-focus. Menu de tipos enriquecido com `TYPE_SYNONYMS` pt-BR para cada um dos 32 tipos.

Versão bumpada para `5.3.0-bloco2-r2`.

### 🟨 Bloco 3 — Canvas + Seções + Linhas + Layouts + Templates Agnósticos

**Entregue em:** 2026-05-17 · Sessão 1

**Módulos novos (3):**

- `SolsticeLayouts` — 10 layouts pré-definidos (1col, 2col-equal/2-1/1-2, 3col-equal/1-2-1, 4col-equal, hero-bottom, sidebar-main, custom) + `reslot()` para troca preservando slots.
- `SolsticeCanvas` — CRUD completo de `Section→Row→Slot` persistido em `Store.canvas.sections`. Render reativo via `subscribe('canvas.sections')` + `dataset.ready` + `dictionary`. Operações: add/remove/duplicate/move section, add/remove/duplicate/changeLayout row, applyTemplate, clear.
- `SolsticeTemplates` — 6 agnósticos + 6 templates de domínio condicionados ao `ingest.dictDetection.dictKey`. `openPicker()` abre modal com busca (via Modal.select searchable).

**6 templates agnósticos:** KPIs + Tendência · Comparação de Categorias · Composição · Análise de Distribuição · Visão Executiva · Tabela com Filtros.

**6 templates de domínio:** 🏦 Carteira PJ · 💰 Performance Comercial · 👥 People Snapshot · 📊 Funil + ROAS · 🏭 Operação em Tempo Real · 🔬 Análise Experimental.

**UI novo:**
- Canvas inteiramente controlado pelo `SolsticeCanvas.render()` (HTML estático removido)
- Toolbar fixa: `+ Seção` · `📋 Templates` · `👁️ Preview dos dados` (último visível só com dataset)
- Section: header com título editável (contenteditable) + 5 ações (mover ↑↓, + linha, duplicar, remover)
- Row: mini-toolbar contextual no hover (📐 trocar layout, ⎘ duplicar, ➕ inserir abaixo, ✕ remover)
- Slot: placeholder com `+ Componente · disponível no Bloco 5`
- Empty state condicional: sem dataset → CTAs de dummy/import; com dataset → grid de cards de templates

**Refatorações:**
- `renderPreview` do Editor (Bloco 2) movido para modal acessível pelo botão `👁️` na toolbar (canvas agora pertence ao Canvas)
- `_runIngestFile` e `_loadDummyDataset` extraídos do `boot()` para módulo-level, acessíveis pelo empty state
- Botão `📁 Importar CSV` movido para o header (permanente, não atrelado ao empty state)

**Decisões arquiteturais novas:** ADR-020 (Section→Row→Slot persistido em Store) · ADR-021 (Layouts via CSS grid templates por atributo `data-layout`) · ADR-022 (Templates como receitas serializáveis com filtro por domínio) · ADR-023 (Canvas como root visual único — preview de tabela vira modal).

**Tamanho:** dashboard.html ~3.500 linhas (~95 KB).

### 🟧 Bloco 4 — Resize Livre + Modo Livre + Micro-interações

**Entregue em:** 2026-05-17 · Sessão 1

**Módulos novos (5):**

- `SolsticeUndo` — ring buffer de 50 snapshots de `canvas.sections`. Atalhos `Ctrl+Z` (undo) e `Ctrl+Shift+Z` / `Ctrl+Y` (redo). Hook via `Store.subscribe('canvas.sections')`. Flag `suppress` evita loop durante undo/redo. Ignora quando foco está em input/textarea/contenteditable.
- `SolsticeResize` — handle vertical entre slots adjacentes (modo grid). Drag muda `row.widths` (array de % normalizado para `fr`). **Magic snap** em 25 / 33.33 / 50 / 66.67 / 75% com tolerância de 2.5%. Badge flutuante segue cursor mostrando `60% | 40%`. Commit no `mouseup` (1 snapshot Undo por resize completo).
- `SolsticeDnD` — drag-and-drop entre slots via HTML5 Drag API. `dragstart`/`dragover`/`drop`/`dragend` em delegação no canvas. **Swap** entre slots origem e destino (não inserção entre — B12). Toast "🔀 Slots trocados" + dica de Ctrl+Z.
- `SolsticeMinimap` — outline `fixed` bottom-right. Cada section vira card com mini-rows de slots. Click rola canvas até a seção (`scrollIntoView smooth`). Botão de colapsar/expandir. Esconde quando `canvas.sections` está vazio. Re-render reativo via `subscribe('canvas.sections')`.
- `SolsticeFreeMode` — toggle 🔀 por row na mini-toolbar. `row.mode = 'grid' | 'free'`. Em modo livre, row vira `position: relative` com fundo hachurado e slots viram `position: absolute` com `{x, y, w, h}`. Drag por handle `⋮⋮` no topo do slot via Pointer Events. Inicializa posições proporcionais. **Smart guides:** stub (TODO B12).

**Integração no Canvas:**
- `_renderToolbar` ganha 2 botões: ↺ Undo · ↻ Redo (com `disabled` reativo)
- `_renderRow` aplica `style.gridTemplateColumns` se `row.widths` existe; aplica `data-mode="free"` se `row.mode === 'free'`; insere handles de resize entre slots adjacentes em modo grid; adiciona toggle 🔀 na row-toolbar
- `_renderSlot` é context-aware (recebe `row, idx`): em modo livre, aplica `style.left/top/width/height` + insere `.solstice__free-handle`; sempre adiciona `draggable="true"`

**Micro-interações:**
- Slots ganham hover state (`is-dragover` durante drop · `is-dragging` durante origem do drag · `is-dragging-free` durante drag livre)
- `@keyframes solstice-section-in` fade-in + slide-up de 4px ao adicionar section/row novos
- Resize handle expande visualmente no hover/active (2px → 3px, 32px → 48px de altura, accent color)
- Botões disabled têm `opacity: 0.4` + `cursor: not-allowed`

**Decisões arquiteturais novas:** ADR-025 (Undo via subscribe + ring buffer JSON.stringify) · ADR-026 (Resize via inline `gridTemplateColumns`, layout vira "custom") · ADR-027 (DnD = swap, não inserção, no B4) · ADR-028 (Minimap puro DOM sem interação além de click) · ADR-029 (Modo Livre por row, smart guides diferidas para B12).

**Tamanho:** dashboard.html ~4.300 linhas (~115 KB).

### 🟪 Bloco 5 — 4 Componentes Base + Auditoria + Integração Dicionário (Diferencial #1)

**Entregue em:** 2026-05-17 · Sessão 1

**Diferenciais entregues:**
- 🎯 **Diferencial #1: Auditoria de Decisões** — log automático, modal global com timeline + filtros + export Markdown
- 🚀 **Inovação própria #2: Provenance Trail** — botão 🔬 em cada componente abre cadeia `Dataset → Coluna → Filtros → Agregação → Resultado`

**Módulos novos (3):**

- `SolsticeAudit` — ring buffer de 500 entradas (`{ts, action, target, componentId, details}`). API: `record()`, `list(filter)`, `subscribe()`, `toMarkdown()`, `exportMd()`, `openModal({componentId?})`, `openProvenance(componentId)`. Modal global mostra timeline cronológica (mais recente primeiro), filtros por componentId, botão de export.
- `SolsticeComponents` — registry plugável `{ id, name, icon, defaultConfig(ctx), render(slot, host, ctx) }`. 4 implementações inclusas: **KPI Card**, **Série Temporal**, **Distribuição**, **Tabela**.
- `SolsticeProps` — Painel de Propriedades com 4 abas (`Dados`/`Visual`/`Decisões`/`Provenance`). Aparece na sidebar quando um componente é selecionado. Atualizações disparam `Audit.record('update_config', ...)`.

**4 Componentes implementados:**

1. **KPI Card** — agrega 1 coluna numérica (`sum`/`avg`/`min`/`max`/`count`), sparkline reusa lógica B4, **variação direcional respeitando `higherIsBetter`** do dicionário (verde se "maior é melhor" e está subindo; vermelho se piorando). Formatação via `Types.format(v, Locale)` (currency = R$ no pt-BR).

2. **Série Temporal** — Chart.js (CDN do B1). Eixo X temporal + Y numérico. Agregação por dia/semana/mês. Tipos line/area/bar. Cores integradas ao tema (lê `--c-accent`).

3. **Distribuição** — histograma SVG nativo. Bins configurável (5-100, default 20). Tooltips por barra mostram intervalo + contagem.

4. **Tabela** — reuso do preview B2 + **heatmap** por coluna numérica (intensidade ∝ valor). Linhas configurável (10-500, default 50).

**Picker de componente:**
- Slot vazio + click → `Modal.select` com 4 opções (com busca pelos sinônimos)
- Após escolher: aplica `defaultConfig()` baseado nos dados disponíveis, registra `add_component` no Audit, abre Painel de Propriedades automaticamente

**Painel de Propriedades:**
- Aparece na sidebar abaixo do painel de dados quando slot é selecionado
- Aba `📊 Dados`: select de coluna por grupo (numeric/temporal/cat), agregação, bin temporal, número de bins, etc.
- Aba `🎨 Visual`: stub (cor/escala/anotações ficam para B12 polish)
- Aba `🔍 Decisões`: timeline das últimas 10 decisões deste componente + botão "Ver no modal"
- Aba `🔬 Origem`: chamada ao Provenance Trail

**Integração com Canvas (`_renderSlot`):**
- Se `slot.type === 'empty'`: placeholder ➕ "Adicionar componente · KPI · Série · Distribuição · Tabela"
- Senão: delega para `Components.render(slot, el)` que envolve em `.solstice__comp` com header (título + botões 🔬 🔍 ⚙️)

**Decisões arquiteturais novas:** ADR-030 (Audit como ring buffer com export MD) · ADR-031 (Components como registry plugável) · ADR-032 (Painel de Propriedades substitui editor quando slot selecionado) · ADR-033 (Provenance Trail como modal independente acessível por 🔬).

**Tamanho:** dashboard.html ~5.100 linhas (~135 KB).

### 🔧 Patch B5-r1 — coerência de UI + protocolo restabelecido

Lucas detectou violação da Regra 1 da Seção Crítica 1 (UM bloco por resposta) que resultou em bugs visíveis acumulados. Patch aplicado:

1. **Botão de remover componente** (ADR-034) — header de cada componente ganha 4º botão 🗑️ ao lado de 🔬 🔍 ⚙️. Modal `confirm({danger:true})` confirma; slot volta a `{ id, type: 'empty' }`. Audit registra `remove_component`.
2. **Tab "Componentes" da sidebar habilitada** (ADR-035) — disabled removido, novo `SolsticeSidebarTabs` alterna entre painel "Dados" (Editor + Quality) e "Componentes" (lista de todos os componentes do canvas com ícone + localização + remover inline). Click no item da lista chama `Props.select` + `scrollIntoView`.
3. **Status do bloco na sidebar atualizado** — agora mostra acumulado real de B1-B5 + "Próximo: Bloco 6".
4. **Footer dinâmico** (ADR-036) — `#app-version` lê `window.Solstice.version` no boot via regex `bloco(\d+)(?:-(r\d+))?` — nunca mais dessincroniza.
5. **KPI Card reorganizado** — agora em 4 linhas claras: (1) label compacta, (2) valor com tooltip explicativo, (3) "▲ +X,X% vs período anterior" colorido por `higherIsBetter`, (4) sparkline + meta "últimos N pontos · soma sobre n=…".
6. **ADR-037 META** — restabelecido o protocolo estrito UM bloco/resposta + ritual completo de 6 arquivos meta + 4 pontos de versão no HTML.

`SolsticeSidebarTabs` exposto em `Solstice.SidebarTabs`. Versão `5.3.0-bloco5-r1`. Memória `feedback-one-block-per-response.md` criada para sessões futuras.

### 🔧 Patch B5-r2 — Catálogo + KPI redesenhado + Humanize

Lucas pediu 3 grupos de ajustes baseados em uso real:

1. **Aba "Componentes" virou CATÁLOGO** (ADR-038) — antes listava componentes já criados; agora lista TIPOS DISPONÍVEIS para adicionar. Cards em grid 2×N com ícone grande, nome, descrição curta. Click chama `Components.addByType(typeId)` que (1) insere no primeiro slot vazio OU (2) cria nova seção. Auto-scroll + select. Quando `dataset.ready === false`, cards ficam disabled com tooltip "Importe um CSV primeiro". Dinâmico — lê de `Components.list()`, então B6 adiciona automaticamente Scatter/Heatmap/Gauge/Texto.

2. **KPI Card redesenhado completamente** — layout em 3 zonas claras:
   - **Título no canto superior direito** (`📊 RECEITA TOTAL` em uppercase + letter-spacing, `friendlyName` do dicionário)
   - **Número grande à esquerda** (`var(--fs-3xl)` + tabular-nums + tooltip humanizado `"Soma de 200 valores válidos da coluna Receita Mensal"`)
   - **Linha de comparação humanizada** (`▲ +12,3% acima do período anterior` / `▼ -5,4% abaixo do período anterior` / `≈ Estável vs período anterior` / fallback `Calculado de 200 registros` quando sem temporal)
   - **Sparkline removido por default** (`slot.config.showSparkline` opt-in; quando ativado, caption diz "Tendência ao longo do tempo" ou "Variação ao longo dos dados", nunca "últimos N pontos")
   - **Cor verde/vermelha/cinza** segue `higherIsBetter` do dicionário, agora via `Humanize.delta()`
   - `min-height: 140px` para uniformidade entre cards.

3. **`SolsticeHumanize` — módulo de strings humanas** (ADR-039) — toda saída textual destinada ao usuário passa por aqui:
   - `aggregation('sum')` → `'Soma'`
   - `delta(12.3, true)` → `{ text: '▲ +12,3% acima do período anterior', color: 'success' }`
   - `recordCount(200)` → `'200 registros'`, `recordCount(1_000_000)` → `'1 milhão de registros'`
   - `timeRange(rangeMs)` → `'30 dias'` / `'3 meses'` / `'1 ano'`
   - `column(name, dict)` → friendlyName se dicionário tiver, senão Title Case
   - Aplicado em KPI Card e Distribuição. Strings residuais (`n=N`, `últimos N pontos`) removidas via grep.

`Solstice.Humanize` exposto. Versão `5.3.0-bloco5-r2`. Componentes ganharam campo `description` (4 descritivos pt-BR de 1 linha).

### 🔧 Patch B5-r3 — UX baseado em uso real (abas isoladas + comparação configurável + confirmações silenciáveis)

Lucas pediu 4 grupos de melhorias após uso prático:

1. **Abas isoladas Dados/Componentes** (ADR-040) — antes o `#props-panel` aparecia em ambas abas. Agora `SidebarTabs.activate()` controla os 3 painéis (`#data-panel`, `#components-panel`, `#props-panel`) com isolamento total. Aba ativa persiste em `Store.ui.activeTab`.

2. **Seleção força aba Componentes** (ADR-041) — `Props.select(slotId)` agora chama `SidebarTabs.activate('componentes')` automaticamente quando o usuário está em outra aba. Garante visibilidade do contexto de edição.

3. **Comparação configurável no KPI** (ADR-042) — novo módulo `SolsticeKPI.calculateDelta` com 8 tipos: `previous-period`, `same-period-last-year`, `fixed-target`, `historical-mean`, `historical-median`, `first-value`, `last-value`, `none`. Cada tipo retorna `{ pct, baseline, baselineLabel, direction }`. KPI Card ganhou aba "Comparação" no painel de propriedades (radio buttons + sub-campos condicionais para Meta fixa e Período anterior). `Humanize.delta()` aceita `baselineLabel` com heurística pt-BR de artigo definido ("acima da meta", "abaixo do período anterior", "acima da média histórica"). `slot.config.comparison = { type, targetValue, targetLabel, periodSize }`.

4. **Confirmações destrutivas silenciáveis** (ADR-043) — `Modal.confirm` ganhou `skipKey`. Atalho: se chave silenciada (em `localStorage` por perfil), retorna `Promise.resolve(true)` direto sem mostrar modal. Quando modal aparece, mostra checkbox "Não perguntar mais sobre isso" e salva preferência. Aplicado nos 3 destrutivos: `remove-component`, `remove-section`, `remove-row`. Toast `SolsticeToast.action({actionLabel, actionFn})` adicionado para feedback pós-remoção com botão "Desfazer" inline (chama `Undo.undo()`). Modal de Preferências do perfil acessível pelo botão 👤 no header — lista chaves silenciadas e permite reativar.

`Solstice.KPI` exposto. Versão `5.3.0-bloco5-r3`. ADRs 040, 041, 042, 043.

### 🔧 Patch B5-r4 — Containment + Compatibilidade estatística + Dashboard Header

Lucas reportou 3 ajustes + 1 feature nova após o r3:

1. **Aba "Comparação" quebrando layout** (ADR-044 secundária) — `.solstice__props-panel` ganhou `overflow-x: hidden` + `max-height` com scroll vertical próprio. Tabs com `flex-wrap: nowrap` + overflow horizontal. Radios da Comparação ficaram compactos (font-xs, padding 4/8, gap 2). Labels encurtadas no `COMPARISON_TYPES.short`: "Mesmo período (1a)", "Primeiro valor", "Último valor".

2. **Compatibilidade estatística agregação ↔ baseline** (ADR-044) — novo `AGG_COMPARISON_COMPAT` no `SolsticeKPI` define quais baselines fazem sentido para cada agregação (ex: Soma com Média histórica é estatisticamente confuso). Aba Comparação agora mostra só compatíveis; botão "+ Mais opções (N incompatíveis)" expande as restantes com nota de aviso ⚠️ e tooltip por opção via `incompatReason(agg, baseline)`. Trocar agregação na aba Dados que torne a baseline atual incompatível auto-troca para `previous-period` + toast informativo + entrada `auto_switch_comparison` no Audit.

3. **KPI título à esquerda** (ADR-045) — hook genérico `def.getTitle(slot, ctx)` no `Components.render`. KPI implementa `getTitle` retornando `Humanize.column(col).toUpperCase()`. Casca usa o header existente (flex com `flex:1` no título e actions à direita). Removido o título absolute do canto sup-direito do card.

4. **Dashboard Header customizável** (ADR-046 + ADR-047) — novo módulo `SolsticeDashHeader` com banner gradient acima da toolbar do canvas. Configurável via modal (botão "📋 Cabeçalho" na toolbar): título, subtítulo, data dinâmica (`today` / `fixed` / `column` com função `max`/`min`/`recent`), gradiente (cor inicial, cor final, 8 direções incluindo radial), cor do texto (`auto-white`/`auto-black` por luminância WCAG ou hex custom), altura (compacto 80px / padrão 120px / alto 180px). Modal tem **preview ao vivo**. Persistência em `Store.canvas.header` (vai junto com snapshots no B11). Auto-sugestão de título ao importar CSV: `vendas_q1.csv` → toast "Cabeçalho de dashboard? Sugestão: Vendas Q1 [Configurar]".

`Solstice.DashHeader` exposto. Versão `5.3.0-bloco5-r4`. ADRs 044, 045, 046, 047.

### 🟫 Bloco 6 — 6 Componentes Avançados + Box Plot + Sankey

**Entregue em:** 2026-05-18 · Sessão 2

**6 componentes novos registrados** (catálogo total: **10**):

| ID | Nome | Tipo | Configs principais |
|---|---|---|---|
| `scatter` | Scatter / Bubble | SVG nativo + regressão linear + k-means | xColumn, yColumn, sizeColumn, showRegression, clusters (0-8) |
| `heatmap-cal` | Heatmap Calendário | SVG estilo GitHub (5 níveis de intensidade por dia) | dateColumn, valueColumn, agg (count/sum/avg) |
| `gauge` | Gauge | SVG arc 180° + agulha + target | column, agg, min, max, target |
| `markdown` | Texto / Markdown | Parser inline com `{{store.path}}` substituições | text |
| `boxplot` | Box Plot | SVG com Q1/median/Q3 + whiskers + outliers IQR 1.5× | valueColumn, groupColumn (opcional, até 8 grupos) |
| `sankey` | Sankey | SVG 2 níveis (source → target) com paths Bezier proporcionais | sourceColumn, targetColumn, valueColumn |

**Helpers estatísticos inline** (precursores do B7 `SolsticeStats`):
- `_linearRegression(points)` — OLS retorna `{slope, intercept, r2}`
- `_kMeans(points, k, maxIter=20)` — Lloyd's algorithm
- `_quartiles(values)` — Q1/median/Q3 + outliers via IQR 1.5×

**Decisão consciente:** componente Compound (combinador) adiado para Bloco 12 polish (ADR-048). Token budget e priorização — os 6 outros entregam mais valor isolados.

**Painel de Propriedades** estendido com cases para os 6 componentes novos: Scatter tem checkbox para regressão + slider de clusters; Gauge tem inputs min/max/target; Markdown tem textarea com placeholder hints (`{{dataset.name}}`, `{{ingest.meta.rowsCount}}`, `{{profile.name}}`).

**Catálogo dinâmico** atualiza automaticamente — lê de `SolsticeComponents.list()` (Bloco 5 r2). Agora mostra 10 cards.

**Tamanho:** dashboard.html ~6.300 linhas (~165 KB).

**Decisões arquiteturais novas:** ADR-048 (Compound diferido) · ADR-049 (helpers estatísticos inline antes do B7) · ADR-050 (Sankey 2-níveis simplificado sem otimização de cruzamento) · ADR-051 (Markdown parser regex puro, sem CommonMark completo).

### 🔧 Patch B6-r1 — Consolidação Visual

Lucas pediu polish completo antes do B7. Aplicado:

1. **SVGs responsivos (ADR-052)** — helper `_observeResponsive(host, def, slot, ctx)` com `ResizeObserver` debounce 150ms. 3 tiers por `host.clientWidth`: `compact` (<240, W=240×H=150) / `standard` (<420, W=360×H=240) / `large` (≥420, W=540×H=340). Aplicado em Scatter, Gauge, Box Plot, Sankey, Distribution. Sankey mostra empty state amigável quando largura <320px. Scatter omite caption em tier compact.
2. **Painel de Propriedades legível (ADR-053)** — tabs com `min-height: 36px`, padding 10/14, font-size sm. Radios da Comparação com `min-height: 32px`, gap 8, font-size sm. Inputs/selects com `height: 36px` e padding 8/10. Labels em `fs-xs` + `c-text-2`.
3. **Resumo do Dataset (ADR-054)** — novo módulo `SolsticeDataset.summary()` + UI no topo da aba Dados. Classifica colunas por `SolsticeTypes.group()` em 8 grupos (numeric/categorical/temporal/id/contact/geo/struct/special) com ícones e labels pt-BR. Mostra contagem + lista comprimida das 3 primeiras colunas + "...+N". Pluralização correta. Reativo a mudanças de `ingest` e `dictionary`.
4. **Modal drag-safe (ADR-055)** — `SolsticeModal.show` aceita `dismissOnBackdrop` (default `true`). Proteção global: `mousedown` marca `dragStartedInside`; click só fecha backdrop se drag começou FORA do modal. Aplicado `dismissOnBackdrop: false` no DashHeader (textos longos). Modal de Dicionário (legacy) ganhou proteção drag manual.
5. **Polish** — toolbar do canvas com `flex-wrap: wrap` (cabe em sidebar estreita). KPI value com `font-size: clamp(20px, 5cqw, 36px)` + `container-type: inline-size` no `.solstice__kpi-card`. Sankey/BoxPlot mostram empty state explicativo em tier compact.

`Solstice.Dataset` exposto. Versão `5.3.0-bloco6-r1`. Sentinel `[Solstice] Patch B6-r1 aplicado · pronto para sessão nova`.

### 🟦 Bloco 7 — Módulo Estatístico `SolsticeStats` + Aba Análise + Smart Defaults

**Entregue em:** 2026-05-18 · Sessão 2

**Módulo novo (1, autosuficiente):**

- `SolsticeStats` — **41 funções puras** organizadas em 10 categorias semânticas:
  - **Núcleo (5):** `clean`, `sorted`, `sum`, `count`, `countNulls`
  - **Descritivas (7):** `mean`, `median`, `mode`, `min`, `max`, `range`, `distinctCount`
  - **Dispersão (5):** `variance`, `variancePop`, `stdDev`, `mad`, `cv`
  - **Percentis (3):** `percentile`, `quartiles`, `iqr`
  - **Forma (2):** `skewness`, `kurtosis`
  - **Outliers (3):** `outliersIQR`, `outliersZ`, `outliersMAD`
  - **Regressão (2):** `linearRegression`, `polynomialRegression` (Vandermonde + Gauss-Jordan, k ≤ 6)
  - **Correlação (3):** `correlation` (Pearson), `correlationSpearman` (com empates por média), `correlationMatrix`
  - **Séries temporais (6):** `movingAverage`, `exponentialSmoothing`, `linearForecast`, `holtWinters` (aditivo), `diff`, `autocorrelation`
  - **Clustering (1):** `kMeans` (Lloyd's determinístico)
  - **Transformações (4):** `normalize`, `zScore`, `bucketize`, `lag`
  - **Direcional (1):** `trend` (slope + magnitude relativa à média)
  - **Smart suggest (4):** `bestNumericPair`, `suggestGauge`, `suggestBoxPlot`, `suggestSankey`
  - **Sumário (1):** `describe` (rollup completo de 12 métricas)

**Migração transparente:**
- Helpers privados de B6 (`_linearRegression`, `_kMeans`, `_quartiles`) viraram thin shims que delegam a `SolsticeStats` (ADR-055 B7-prefix-internal). Componentes B6 continuam funcionando sem mudanças.

**4 melhorias UX ao adicionar componente** (`SolsticeComponents.addByType`):

| Componente | Smart Default (B7) |
|---|---|
| **Scatter** | `bestNumericPair(ctx)` — par com maior \|Pearson\| entre top-6 numéricas. Toast: "Par com correlação forte positiva (r=0.85): ..." |
| **Gauge** | `suggestGauge(ctx)` — prefere coluna `percentage`; senão usa P5/P95 do dataset com arredondamentos amigáveis (potências de 10); meta = P75 se `higherIsBetter`, P25 se inverso, mediana se neutro |
| **Box Plot** | `suggestBoxPlot(ctx)` — auto-seleciona `groupColumn` quando há categórica com 2-8 distintos. Toast informa o agrupamento |
| **Sankey** | `suggestSankey(ctx)` — escolhe 2 categóricas DISTINTAS, prioriza pares com 2-8 distintos cada. Se só há 1 categórica, `targetColumn=null` + empty state explicativo |

**Empty states humanos:**
- Scatter: "Scatter precisa de 2 colunas numéricas. Seu dataset tem apenas N."
- Gauge: "Gauge precisa de uma coluna numérica. Seu dataset não tem nenhuma."
- Box Plot: "Box Plot precisa de uma coluna numérica."
- Sankey: 4 mensagens distintas conforme o caso (0 cats / 1 cat / source==target / cats=null)

**Aba novíssima 📈 Análise no Props** — quinta aba (4ª para componentes não-KPI). Disponível em todos os componentes exceto `markdown`. Conteúdo context-aware:
- **Sempre:** distribuição central (média/mediana/std), faixa e quartis, forma (skewness + texto humano, kurtosis + texto humano), outliers (IQR 1.5× count + %)
- **Time Series:** tendência (direção + variação total + R² + forecast 5 períodos)
- **Scatter:** Pearson + Spearman + nota se \|ρ\|−\|r\| > 0.15 (sugere transformação)
- **Gauge:** distância da meta (atual, diferença, % do alvo)
- **Box Plot agrupado:** mediana + n por grupo (top 6)
- **Footer:** snippet de console reproduzindo as métricas via `Solstice.Stats.describe(...)`

**Cabeçalho da aba:** "🔬 Por que esse número?" + frase explicativa contando n e nulls ignorados.

**ADRs novas:** ADR-056 (Scatter smart default por correlação) · ADR-057 (Gauge smart default por percentis + higherIsBetter) · ADR-058 (Box Plot auto-grupo) · ADR-059 (Sankey requer cats distintas) · ADR-060 (SolsticeStats como módulo puro autossuficiente, pre-Components) · ADR-061 (Aba Análise context-aware com nota didática).

**`Solstice.Stats` exposto.** Versão `5.3.0-bloco7`. Sentinel `[Solstice] Bloco 7 aplicado · módulo estatístico + UX smart dos 4 componentes avançados`.

**Tamanho:** dashboard.html ~10.250 linhas (~265 KB).

### 🔧 Patch B7-r1 — Cap de tamanho dos componentes

Lucas reportou que ao adicionar Scatter/Gauge/Box Plot/Sankey via catálogo (com smart defaults criando seção 1col full-width), os SVGs estouravam verticalmente (~700-800px) em containers largos. Bug listado como #006 em `BUGS.md`.

**Correções (ADR-062):**

1. **`.solstice__chart-svg`** — substituído `aspect-ratio + min-height` por `max-width + max-height` per tier:
   - compact: 360×230 · standard: 480×320 · large: 600×380
   - SVG fica letterbox centralizado (margin: 0 auto) em containers largos; em containers pequenos respeita 100% width
2. **`.solstice__chart-wrap`** (Chart.js) — `max-height: 380px` no wrap E no canvas filho
3. **`.solstice__comp`** — `max-height: 460px` + `overflow: hidden` como teto absoluto/salvaguarda (≈ 380 SVG + 40 header + 20 padding + folga)
4. **`.solstice__md`** (markdown) — `max-height: 380px` + `overflow-y: auto` para textos longos
5. **`.solstice__hist`** (Distribuição) — `max-width: 600px` + `margin: 0 auto`

**Resultado:** qualquer componente, em qualquer layout (1col/2col/4col/free), respeita uma altura máxima razoável. Nada estoura mais.

Versão `5.3.0-bloco7-r1`. Sentinel `[Solstice] Patch B7-r1 aplicado · cap de tamanho dos componentes SVG (max-height por tier + .solstice__comp 460px)`.

### 🔧 Patch B7-r2 — Reestruturação arquitetural UX (Inspector + Drawer + Catálogo accordion)

Lucas pediu reestruturação grande para resolver fricções de uso real do painel de propriedades. 3 mudanças combinadas:

**1. Inspector lateral direito (ADR-063):**
- Grid raiz expandido de 2 para 3 colunas (`280px 1fr 0|340px`), com transição CSS 300ms
- Novo `<aside id="inspector">` com header sticky + body scrollável + footer sticky
- Classe `.has-inspector` no `.solstice__app` abre/fecha
- Módulo novo `SolsticeInspector` (open/close/setTitle/setFooter/getBody/isOpen/init)
- Responsivo: `< 1200px` vira overlay `position: fixed`; `< 768px` ajustes adicionais

**2. Painel de Propriedades em accordion (ADR-064):**
- Tabs antigas (📊 Dados · ⚖️ Comparação · 🎨 Visual · 🔍 Decisões · 🔬 Origem) viram seções accordion expansíveis individualmente
- Helper `createAccordion({ icon, title, key, openByDefault, count, build })` reutilizável
- Persistência por `Store.ui.accordion.<key>` — re-selecionar componente preserva seções abertas/fechadas
- Controles maiores no inspector (height 40px em vez de 36) — espaço sobra
- Botão "🗑️ Remover componente" no rodapé do inspector (com skipKey + Toast.action Desfazer)
- `#props-panel` REMOVIDO da sidebar esquerda

**3. Drawer Análise inferior (ADR-065):**
- A aba "📈 Análise" do B7 saiu do inspector — não pertence à construção/visual do componente
- Vira drawer inferior `position: fixed` 340px de altura, ocupa largura entre sidebar e inspector (ajusta com `right: 0` ou `right: 340px`)
- Acionado pelo novo botão `📈` no header da casca do componente (junto com 🔬 🔍 ⚙️ 🗑️)
- Conteúdo em grid de cards (220px min, auto-fit) em vez de lista vertical — aproveita largura
- Módulo novo `SolsticeAnalysis` (open/close/toggle/render/isOpen/init)
- Esc fecha (drawer primeiro, depois inspector)
- Cards: Distribuição central · Faixa e quartis · Forma · Outliers + contextuais (Tendência+Forecast para time-series · Correlação para scatter · Distância da meta para gauge · Por grupo para boxplot)

**4. Catálogo de componentes em accordion por grupo (slidedown):**
- `_renderComponentsPanel` agora agrupa em: 📊 **Básicos** (KPI/Série/Distribuição/Tabela · aberto por padrão) · ⚡ **Avançados** (Scatter/Heatmap/Gauge/BoxPlot/Sankey · fechado) · 📝 **Texto** (Markdown · fechado)
- Reusa o mesmo `createAccordion` do inspector
- Persistência por `Store.ui.accordion.catalog.<group>`
- Footer com helper: "💡 Selecione um componente no canvas para editar suas propriedades no painel da direita →"

**5. Comportamentos novos:**
- Tecla `Esc`: fecha drawer Análise primeiro, depois Inspector (cascata)
- Click em área vazia do canvas: fecha Inspector
- Click no botão 📈 da casca: abre/toggle drawer Análise

**`Solstice.Inspector`, `Solstice.Analysis`, `Solstice.createAccordion` expostos.** Versão `5.3.0-bloco7-r2`. Sentinela `[Solstice] Patch B7-r2 aplicado · inspector lateral direito + drawer Análise inferior + catálogo accordion`.

**Tamanho:** dashboard.html ~11.068 linhas (~479 KB).

**ADRs novas:** ADR-063 (Inspector lateral 3-col) · ADR-064 (Accordion expansível em vez de tabs, com persistência) · ADR-065 (Drawer Análise separado do Inspector).

### 🟩 Bloco 8 — Insights + Narrativa + Agente + Inconsistências + Ask (Diferencial #2)

**Entregue em:** 2026-05-18 · Sessão 3

**5 módulos novos** consumindo `SolsticeStats` do B7:

| Módulo | API pública | O que faz |
|---|---|---|
| `SolsticeInsights` | compute/list/renderInto/init | Painel topo do canvas com 0-8 cards de insight priorizados (tendência/outliers/Pareto/sazonalidade/mudança recente/categoria dominante) |
| `SolsticeNarrative` | build/openModal/setTone/setDepth | Narrativa pt-BR · 3 tons × 3 profundidades · export markdown/email |
| `SolsticeAgent` | init/status/_reset | Toasts contextuais com cap 3/sessão; reseta no import novo |
| `SolsticeInconsistencies` | catalog/checkSlot/RULES | 15 regras declarativas (sum-of-pct, sum-of-id, gauge-meta-fora-range, etc.) |
| `SolsticeAsk` | open/close/parse/init | Ctrl+P command palette · parser regex pt-BR com 7 padrões |

**6 tipos de insight detectados** ordenados por score:
1. **Tendência** (magnitude > 10% + R² > 0.30) → cor segue `higherIsBetter`
2. **Outliers** (>2% via IQR 1.5×)
3. **Pareto 80/20** em cat × num
4. **Sazonalidade** (autocorrelação lag 12 > 0.4 · ≥24 meses necessários)
5. **Mudança recente** (1ª metade vs 2ª metade, |Δ| > 20%)
6. **Categoria dominante** (>40% do total)

**Narrativa Automática (Diferencial #2)** — botão "📖 Gerar narrativa" no rodapé do inspector. Modal com 3 tons (👔 Executivo / 🔬 Analítico / 💬 Casual) × 3 profundidades. Botões Copiar · Markdown · Email.

**Agente** — após import, analisa insights, dispara até 3 toasts contextuais por sessão. Toast tem botão de ação ("Ver insights" / "Criar Box Plot").

**Inconsistências** — accordion "⚠️ Avisos" no topo do inspector (só se houver hits). 15 regras: avg-of-avg, sum-of-pct, sum-of-id, count-vs-sum-confusion, high-null-col, gauge-meta-fora-range, sankey-same-cols, distrib-bins-extremos, boxplot-grupos-demais, scatter-poucos-pontos, monovalor, comparison-no-temporal, time-series-poucos-pontos, agg-incompat-comparison, tabela-sem-filtro-grande.

**Ask (Ctrl+P)** — palette overlay Spotlight. Parser regex pt-BR com 7 padrões: média/mediana/soma/máx/min/std de X · outliers em X · correlação X e Y · top N em X por Y · tendência de X · quantos registros · quantas categorias em X. Resolve coluna por friendlyName OU técnico (case-insensitive, partial).

**Solstice.Insights / Narrative / Agent / Inconsistencies / Ask exposed.** Versão `5.3.0-bloco8`. Sentinela `[Solstice] Bloco 8 aplicado · Insights + Narrativa + Agente + Inconsistências (Diferencial #2)`.

**Tamanho:** dashboard.html ~12.485 linhas (~542 KB).

**ADRs novas:** ADR-066 (Insights priorizados por score) · ADR-067 (Narrativa template-based pt-BR) · ADR-068 (Agent cap 3/sessão) · ADR-069 (Inconsistencies declarativas) · ADR-070 (Ask parser regex, não LLM).

### 🔧 Patch B8-r1 — Empty state centralizado (canvas flex column)

Lucas reportou: "Comece com um template + lista de componentes" vai afundando a cada alteração. Bug: `.solstice__canvas-empty` tinha `height: 100%` que ignorava toolbar/Insights crescendo acima.

**Correção (ADR-071):** `.solstice__canvas` vira `display: flex; flex-direction: column; gap: var(--sp-4)`. `.solstice__canvas-empty` troca `height: 100%` por `flex: 1; min-height: 320px`. Empty state agora ocupa só o espaço RESTANTE e centraliza corretamente.

### 🟧 Bloco 9 — Filtros Globais + Cross-Filter + Parâmetros

**Entregue em:** 2026-05-18 · Sessão 3 (mesmo turno do B8 + B8-r1)

**3 módulos novos:**

| Módulo | API pública | Função |
|---|---|---|
| `SolsticeFilters` | apply/getActiveRows/set/get/clear/activeCount/suggested/renderInto/init | Engine + UI da barra de filtros globais no topo do canvas |
| `SolsticeCrossFilter` | activate/clear/get/isActive/renderInto/init | Filtro temporário disparado por clique em ponto/categoria/barra |
| `SolsticeParams` | get/getAll/set/remove/resolveText/openModal/init | Parâmetros globais como K/V tipados, substituíveis via `{{param.X}}` |

**Barra de Filtros (UI):**
- Renderiza acima do painel Insights, abaixo da toolbar
- Sugestões automáticas via `Filters.suggested()`: categóricas (2-30 distintos), temporais (≥30 valores), numéricas (IQR > 0)
- Limita a 8 controles para não saturar
- 3 tipos:
  - **Multi-select** com busca (categóricas) — chips no trigger, panel com checkboxes ordenados por contagem
  - **Range slider duplo** (numéricas) — sliders + inputs numéricos
  - **Date picker** (temporais) — presets 7d/30d/3m/12m/Tudo relativos ao max da série, + inputs date custom
- Header colapsável com badge "N ativos" + botão "✕ Limpar tudo"
- Estado persistido em `Store.ui.filters.collapsed`

**Cross-Filter:**
- `SolsticeCrossFilter.activate(column, value)` filtra TODOS os componentes para `column === value`
- Barra azul no topo do canvas indica filtro ativo: "🎯 Cross-filter: Região = Sudeste · ✕ Limpar"
- **Esc** limpa (cascata depois de drawer/inspector)
- **Demonstração:** Sankey ganhou clique nos nodes (origem e destino) — clica num node, todos os outros componentes filtram

**Parâmetros Globais:**
- Modal "🎛️ Parâmetros" acionado por botão na toolbar do canvas
- CRUD: nome + tipo (string/number/date) + valor
- Persistido em `Store.params`
- Substituição `{{param.X}}` aplicada antes dos placeholders `{{path.no.store}}` no Markdown
- Narrativa Automática (B8) pode usar (futuro: B11)

**Integração nos componentes:**
- `SolsticeComponents._ctx()` refatorado: `ctx.rows` agora é resultado de `SolsticeFilters.apply(ingest.rows)`
- Novo `ctx.rowsAll` exposto para defaultConfig/suggested que precisam do dataset completo
- Todos os 10 componentes herdam filtragem automaticamente

**Comportamento reativo:**
- Mudança em `Store.filters` ou `Store.crossfilter` → `SolsticeCanvas.render()` cascateia em tudo
- Insights/Narrative/Inconsistencies do B8 recomputam naturalmente

**`Solstice.Filters / CrossFilter / Params` expostos.** Versão `5.3.0-bloco9`. Sentinela `[Solstice] Bloco 9 aplicado · Filtros Globais + Cross-Filter + Parâmetros · (+ patch B8-r1 empty-state)`.

**Tamanho:** dashboard.html ~13.389 linhas (~579 KB).

**ADRs novas:** ADR-071 (Canvas flex-column · empty state flex:1) · ADR-072 (Filtros aplicam via _ctx() — transparente para componentes) · ADR-073 (Cross-filter como destaque temporário, distinto de filtros globais) · ADR-074 (Parâmetros como K/V tipados substituídos antes de Store paths).

### 🟪 Bloco 10 — Auto-Dashboard + Wizard expandido + Recomendações (15+ tipos)

**Entregue em:** 2026-05-18 · Sessão 3 (cont.)

**4 módulos novos:**

| Módulo | API pública | Função |
|---|---|---|
| `SolsticeColumnScore` | scoreImportance/rank/top/WEIGHTS | Score 0-100 de relevância de coluna via 8 critérios compostos |
| `SolsticeRecommender` | recommend/listRules/listIntents/INTENT_RULES/RULES | 15 regras declarativas com confidence |
| `SolsticeAutoDashboard` | run/_buildSections | Pipeline 4-etapas com confirmação interativa |
| `SolsticeWizard` | open/listIntents/INTENTS | Modal 3-step com 11 intenções |

**ColumnScore — 8 critérios:** coverage (18%) · variation (16%) · cardinalidade (12%) · higherIsBetter (14%) · dictMatch (12%) · typeImportance (10%) · position (8%) · synonymBonus (10%).

**Recommender — 15 regras declarativas** com confidence calibrada:

| Regra | componentType | Confidence |
|---|---|---|
| `kpi-from-hib` | kpi | 90 |
| `kpi-from-top-numeric` | kpi | 75 |
| `time-series` | time-series | 85 |
| `scatter-correlated` | scatter | 50 + abs(r)*50 |
| `boxplot-grouped` | boxplot | 80 |
| `distribution-single-num` | distribution | 65 |
| `sankey-two-cats` | sankey | 75 |
| `gauge-pct` | gauge | 85 |
| `gauge-from-hib` | gauge | 70 |
| `heatmap-cal` | heatmap-cal | 70 |
| `top-categorical` | table | 60 |
| `table-fallback` | table | 50 |
| `forecast-series` | time-series | 78 |
| `outlier-hunt` | boxplot | 60-85 |
| `markdown-narrative` | markdown | 55 |

**Auto-Dashboard pipeline:**
1. `ColumnScore.rank(ctx)` ordena colunas
2. `Recommender.recommend(ctx)` gera array
3. Filtra `confidence ≥ 60`; top 8
4. Se média < 70% → modal com checkboxes; senão aplica direto
5. `_buildSections` distribui em até 4 sections (KPIs primeiro em 3-col, resto em 2-col)
6. `Audit.record('auto_dashboard')` com `recIds`

**Wizard 11 intenções (3 grupos):**
- **7 agnósticas:** Comparar · Distribuir · Tendência · Ranking · Composição · Correlação · Tabular
- **4 analíticas:** Forecast · Caça outliers · Pareto · Comparar períodos
- **+ Customizada** (todas as regras sem filtro)

Cada intenção mapeia para subset de regras via `INTENT_RULES`. Wizard tem 3 steps: 1) Intenção · 2) Revisar (checkboxes) · 3) Aplicar.

**Botões na toolbar do canvas:**
- 🪄 **Auto-Dashboard** (`solstice__btn--primary`) — accionado por click; só aparece com dataset carregado
- 🧙 **Wizard** — modal multi-step

**`Solstice.ColumnScore / Recommender / AutoDashboard / Wizard` expostos.** Versão `5.3.0-bloco10`. Sentinela `[Solstice] Bloco 10 aplicado · Auto-Dashboard + Wizard expandido + Recomendações (15+ tipos)`.

**Tamanho:** dashboard.html ~14.423 linhas (~623 KB).

**ADRs novas:** ADR-075 (ColumnScore 8 critérios compostos · pesos calibrados na intuição) · ADR-076 (Recommender declarativo com 15 regras · confidence 0-100) · ADR-077 (AutoDashboard com confirmação se conf média < 70%) · ADR-078 (Wizard 3-step com 11 intenções mapeadas a subsets de regras).

### 🟫 Bloco 11 — Snapshots + Versions + FileSystem + Export + Templates Itaú

**Entregue em:** 2026-05-18 · Sessão 3

**5 módulos novos** + aba Dicionários/Snapshots ativadas + 4 botões na toolbar:

| Módulo | API pública | Função |
|---|---|---|
| `SolsticeSnapshots` | save/load/list/remove/rename/openModal | CRUD de snapshots em localStorage com LZ-String, cap 30/perfil |
| `SolsticeVersions` | restore/list/openModal | Ring buffer de 10 versões automáticas (sessão-only) acionado por mudança em `canvas.sections` |
| `SolsticeFileSystem` | saveJSON/openJSON/saveBlob/isSupported | File System Access API + fallback download/upload · Ctrl+S salva snap rápido · Ctrl+O abre |
| `SolsticeExport` | buildStandaloneHTML/openExportModal | 3 opções: HTML+dados embutidos · HTML sem dados (template) · JSON puro |
| `SolsticeTemplatesItau` | list/init/TEMPLATES | 3 templates pré-instalados (Carteira PJ Mensal · Inadimplência · Pipeline Comercial PJ) anexados ao `SolsticeTemplates.DOMAIN` |

**Snapshot state shape (state completo):**
```js
{
  canvas: { sections, header },
  filters, params,
  dictionary,
  ingest: { sourceName, columns, types, rows }
}
```
Tudo serializável, comprimido com LZ-String (5-10x).

**HTML standalone export** — gera cópia do `dashboard.html` atual com:
- `<meta name="solstice-embedded" content="1">` no `<head>`
- `<script id="solstice-embedded-state" type="application/octet-stream">` com state LZ-comprimido em base64
- Snippet de auto-hidratação no fim do `<body>` que descomprime, popula Store via `batch()`, força `Canvas.render()`, e loga sentinela verde de rehidratação
- 3 opções no modal: **com dados** (full standalone) · **sem dados** (template) · **JSON puro** (.solstice.json)

**Versions** captura snapshot mínimo (`JSON.stringify(canvas.sections)`) a cada subscribe em `canvas.sections`, descarta duplicatas seguidas, mantém ring buffer 10. Não persiste — apenas sessão. Distinto de Snapshots manuais.

**FileSystem** — `showSaveFilePicker`/`showOpenFilePicker` quando disponível (Chrome/Edge), fallback gracioso para download/input file (Firefox/Safari). `Ctrl+S` cria snapshot rápido + toast; `Ctrl+O` abre modal de Snapshots.

**Templates Itaú** (3):
1. **Carteira PJ — Visão Mensal** (🏦) — 2 sections: KPIs (volume aprovado · DPD30 · gauge) + Evolução temporal + Sankey por região/segmento
2. **Acompanhamento de Inadimplência** (⚠️) — 3 sections: DPD30/60/90 KPIs + Box plot por segmento + histograma + série temporal
3. **Pipeline Comercial PJ** (📈) — 2 sections: Sankey canal→produto + Box plot ticket médio por canal + Tabela

Templates aparecem no picker do `SolsticeTemplates` (B3) quando `dictKey === 'banco_pj'`.

**Aba "🧠 Dicionários" na sidebar:**
- Mostra dicionário ativo no topo (card accent)
- Lista dicionários SALVOS (localStorage) com botão "✓ Aplicar"
- Lista os 6 pré-feitos (banco_pj, vendas, rh, marketing, operacional, cientifico) — todos aplicáveis com 1 clique

**Aba "📸 Snapshots" na sidebar:**
- Botão "💾 Salvar atual" (primary)
- Lista dos snapshots do perfil com data + tamanho + ações (📂 carregar · 🗑️ remover)

**Atalhos novos:** `Ctrl+S` salva snapshot rápido · `Ctrl+O` abre modal de Snapshots.

**Botões na toolbar do canvas (4 novos):**
- 📂 Abrir (snapshots)
- 💾 Salvar (snapshot rápido — só com dataset)
- ⬇️ Exportar (modal com 3 opções — só com dataset)
- 🕐 Histórico (versions — só com dataset)

**`Solstice.Snapshots / Versions / FileSystem / Export / TemplatesItau` expostos.** Versão `5.3.0-bloco11`. Sentinela `[Solstice] Bloco 11 aplicado · Snapshots + Versions + FileSystem + Export + Templates Itaú`.

**Tamanho:** dashboard.html ~15.407 linhas (~667 KB).

**ADRs novas:** ADR-079 (Snapshots em localStorage com LZ-String · cap 30 por perfil) · ADR-080 (Versions = ring buffer 10 em memória, sessão-only) · ADR-081 (FileSystem com detecção + fallback gracioso) · ADR-082 (Export HTML standalone com hidratação no boot via meta + script) · ADR-083 (Templates Itaú anexados a `SolsticeTemplates.DOMAIN` no init).

### 🟨 Bloco 12 — 5 Modos + Slides + Apresentador + Command Palette + Tour + Polish

**Entregue em:** 2026-05-18 · Sessão 3 (final)

**5 módulos novos:**

| Módulo | API pública | Função |
|---|---|---|
| `SolsticeModes` | set/current/cycle/list/MODES | 5 modos via `data-mode` no app shell |
| `SolsticeSlides` | enter/exit/next/prev/goTo | Modo Slides full-viewport (cada section = 1 slide) |
| `SolsticePresenter` | open/close/next/prev | Dual-pane: slide + notas + preview + timer |
| `SolsticeCommandPalette` | open/close · Ctrl+K | Fuzzy search com 30+ ações |
| `SolsticeTour` | start/close/next/prev/STEPS | Spotlight + tooltip · 9 passos |

**5 modos catalogados:**
- ✏️ **Edit** (default) — tudo visível
- 🔬 **Analyze** — toolbar e ações de edição em opacity 0.4
- 💬 **Review** — placeholder para B13 (Modo Comentário)
- 🖥️ **Present** — esconde sidebar/inspector/filtros/toolbar (grid colapsa para canvas full-width)
- 🎬 **Slides** — cada section vira slide com setas e contador (tecla **F** entra)

**Modo Slides:**
- Overlay full-viewport com transição `slide-in` 300ms
- Setas ← → navegam · `F` toggle entrada · `Esc` sai · `A` abre Apresentador
- Contador `3/8` + barra de progresso accent
- Re-renderiza componentes usando ctx filtrado (respeita filtros B9)

**Modo Apresentador:**
- Grid 2-pane: slide atual (1.6fr) + notas (1fr) + footer
- Notas vêm de `section.notes` (vazio se não definido — placeholder para B13)
- Preview da próxima seção
- Timer mm:ss desde abertura
- Setas ← → navegam · Esc fecha

**Command Palette (Ctrl+K):**
- Catálogo com **35 comandos** em 9 categorias: Componente, Ação, Persistência, Template, Config, Modo, Tema, Análise, Ajuda, Dev, Edição, Dados
- Cada comando: `{ id, label, category, icon, run, kbd?, syn? }`
- Fuzzy match: full-substring match prioritário, fallback char-order match
- Setas ↑↓ navegam · Enter executa · Esc fecha · click executa
- Mostra kbd shortcuts (Ctrl+S, Ctrl+P, etc.) ao lado

**Tour interativo (9 passos):**
- Brand → Sidebar → Canvas → Toolbar → Catálogo → Modos → Help → Status → Final
- Spotlight via clip-path no overlay com "buraco" no elemento target
- Tooltip 320px posicionado dinamicamente (abaixo do target, ou acima se sem espaço)
- Botões: ← Anterior · Pular · Próximo →
- Setas teclado ← → navegam · Esc fecha
- Trigger: `Solstice.Tour.start()` ou via Command Palette ("Abrir tour interativo")

**Stats.lttb adicionado** — downsampling Largest Triangle Three Buckets para gráficos com 100K+ pontos (`SolsticeStats.lttb(points, threshold)`). API documentada; uso opcional (componentes podem chamar internamente).

**Polish CSS:**
- `:focus-visible` em `.solstice__btn`, `.solstice__pill`, `.solstice__sidebar-tab` (WCAG AA)
- Transição grid 300ms suaviza mudança de modos
- Dropdown "Modo" no header (ao lado do toggle de tema) com 5 opções clicáveis + kbd hints

**Header recebe:** dropdown "Modo" (▼ Edit/Analyze/Review/Present/Slides) inserido entre densidade e theme-toggle.

**`Solstice.Modes / Slides / Presenter / CommandPalette / Tour` expostos.** Versão `5.3.0-bloco12`. Sentinela `[Solstice] Bloco 12 aplicado · 5 modos + Slides + Apresentador + Command Palette + Tour + Polish`.

**Tamanho:** dashboard.html ~16.437 linhas (~712 KB).

**ADRs novas:** ADR-084 (5 modos via `data-mode` no app shell + dropdown header) · ADR-085 (Modo Slides reusa sections existentes sem editor próprio) · ADR-086 (Apresentador single-window dual-pane em vez de window.open dual-screen) · ADR-087 (Command Palette com catálogo hardcoded + fuzzy match simples · Ctrl+K) · ADR-088 (Tour spotlight via clip-path + posicionamento dinâmico do tooltip).

---

## 📅 Roadmap

- [x] **Bloco 1** — Fundação + Design System + Locale + Erros + Dicionário
- [x] **Bloco 2** — Ingestão + Validador + Editor + Tipos Expandidos
- [x] **Bloco 3** — Canvas, Seções, Linhas, Layouts + Templates Agnósticos
- [x] **Bloco 4** — Resize Livre + Modo Livre + Micro-interações
- [x] **Bloco 5** — 4 Componentes Base + Auditoria + Integração Dicionário (Diferencial #1)
- [x] **Bloco 6** — 6 Componentes Avançados + Box Plot + Sankey
- [x] **Bloco 7** — Módulo Estatístico `SolsticeStats` + Aba Análise + Smart Defaults
- [x] **Bloco 8** — Insights + Narrativa + Agente + Inconsistências + Ask (Diferencial #2)
- [x] **Bloco 9** — Filtros Globais + Cross-Filter + Parâmetros
- [x] **Bloco 10** — Auto-Dashboard + Wizard Expandido + Recomendações (15+ tipos · 11 intenções)
- [x] **Bloco 11** — Snapshots + Versions + FileSystem + Export HTML + Templates Itaú
- [x] **Bloco 12** — 5 Modos + Slides + Apresentador + Command Palette + Tour + Polish
- [ ] **Bloco 13** — Diferenciais Avançados (Modo Comentário + Grafo de Métricas) + `portabilidade/INDICE.md`

---

## 🚀 Inovações próprias planejadas (5)

1. **Modo "What-If" / Simulação** — sliders nos parâmetros (Bloco 9)
2. **Provenance Trail** — botão "🔬 De onde vem esse número?" (Bloco 5)
3. **Sugestão Proativa de Métricas Derivadas** (Bloco 8)
4. **Diff Temporal Inline** (Bloco 11)
5. **Bookmark de Insights** (Bloco 8/13)

---

## 🧠 Comandos disponíveis

| Comando | O que faz |
|---|---|
| `RETOMAR SESSÃO` | Lê os 5 arquivos meta + dashboard.html e anuncia status |
| `STATUS` | Resumo curto do estado atual |
| `AVANÇAR BLOCO N` | Inicia o bloco N |
| `CONTINUAR BLOCO N` | Continua bloco N após pausa técnica |
| `REVISAR BLOCO N` | Refatora/melhora um bloco já entregue |
| `VALIDAR INTEGRIDADE` | Roda checklist de integridade no HTML |
| `PORTABILIDADE BLOCO N` | Regera `portabilidade/bloco-N.md` |

---

## 📂 Estrutura de arquivos

```
solstice/  (working na worktree)
├── PROMPT.md.md
├── PROGRESSO.md              ← este arquivo
├── DECISOES.md
├── API.md
├── BUGS.md
├── dashboard.html
├── changelog/
│   ├── bloco-01.md
│   └── bloco-02.md           ← NOVO
└── portabilidade/
    ├── bloco-01.md
    └── bloco-02.md           ← NOVO
```
