# PROGRESSO — Solstice / Dashboard Studio

> Status persistente do projeto. Atualizado ao final de cada bloco.
> Leia este arquivo **primeiro** ao retomar uma sessão.

---

## 📊 Status Geral

| Campo | Valor |
|---|---|
| Versão atual | **v5.3.0-bloco7** (B7 + UX smart dos 4 componentes avançados) |
| Bloco corrente | **Bloco 7 — SolsticeStats + Aba Análise + Smart Defaults** ✅ COMPLETO |
| Próximo bloco | Bloco 8 — Insights + Narrativa + Agente + Inconsistências (Diferencial #2) |
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

---

## 📅 Roadmap

- [x] **Bloco 1** — Fundação + Design System + Locale + Erros + Dicionário
- [x] **Bloco 2** — Ingestão + Validador + Editor + Tipos Expandidos
- [x] **Bloco 3** — Canvas, Seções, Linhas, Layouts + Templates Agnósticos
- [x] **Bloco 4** — Resize Livre + Modo Livre + Micro-interações
- [x] **Bloco 5** — 4 Componentes Base + Auditoria + Integração Dicionário (Diferencial #1)
- [x] **Bloco 6** — 6 Componentes Avançados + Box Plot + Sankey
- [x] **Bloco 7** — Módulo Estatístico `SolsticeStats` + Aba Análise + Smart Defaults
- [ ] **Bloco 8** — Insights + Narrativa + Agente + Inconsistências (Diferencial #2)
- [ ] **Bloco 9** — Filtros Globais + Cross-Filter + Parâmetros
- [ ] **Bloco 10** — Auto-Dashboard + Wizard Expandido + Recomendações
- [ ] **Bloco 11** — Snapshots + Templates + Export + File System
- [ ] **Bloco 12** — 5 Modos + Atalhos + Polish (Modo Slides + Apresentador)
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
