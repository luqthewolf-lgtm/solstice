# Changelog — Bloco 6 (6 Componentes Avançados + Box Plot + Sankey)

**Data:** 2026-05-18
**Sessão:** 2
**Versão entregue:** v5.3.0-bloco6
**Tamanho dashboard.html:** ~165 KB (~6.300 linhas)

---

## ✅ Implementado

### 1. Banner + console + status sidebar

- Banner topo: "BLOCO 6 · 6 COMPONENTES AVANÇADOS + BOX PLOT + SANKEY"
- Console: `Solstice.Components.list().length` → 10 · `Solstice.KPI.listTypes()` 8 tipos
- Sidebar "Status do bloco" acumula B1-B6, próximo: B7 (SolsticeStats)

### 2. CSS Bloco 6 (~250 linhas)

- `.solstice__chart-svg` (wrapper SVG genérico)
- `.solstice__scatter-*` (point, regression line, R², 8 cores de cluster)
- `.solstice__heat-cal-*` (calendário GitHub-style com 5 níveis)
- `.solstice__gauge-*` (arc, agulha, target tick, labels)
- `.solstice__md` (Markdown rendering: H1-H3, listas, code, bold, italic, links, placeholders)
- `.solstice__boxplot-*` (box, median, whiskers, outliers)
- `.solstice__sankey-*` (nodes, Bezier links, labels)

### 3. Helpers estatísticos inline (~3K LOC)

Precursores do `SolsticeStats` (B7), dentro do closure de `SolsticeComponents`:

- `_linearRegression(points)` — OLS clássico. Retorna `{slope, intercept, r2}`. Lida com SS_tot = 0.
- `_kMeans(points, k, maxIter=20)` — Lloyd's algorithm. Inicialização com k pontos espaçados. Convergência ou maxIter.
- `_quartiles(values)` — Q1/median/Q3 + outliers via IQR 1.5×. min/max do whisker excluem outliers.

### 4. Componente `scatter` (Scatter / Bubble)

- SVG nativo 480×280
- Grid de 5 linhas horizontais tracejadas
- Pontos com `data-cluster="N"` para K-means (até 8 cores fixas)
- `showRegression: true` → linha tracejada laranja + `r² = 0.XXX` no canto
- `sizeColumn` opcional → raio escalonado entre 2-10px
- Tooltips por ponto via `<title>` nativo
- `getTitle` dinâmico: "{Y} × {X}" uppercase

### 5. Componente `heatmap-cal` (Heatmap Calendário)

- SVG estilo GitHub
- Agrega por dia (count, sum ou avg)
- 5 níveis de intensidade (0 cinza → 4 accent forte)
- Meses do range em colunas, 1 célula 11×11 por dia
- Tooltips com `ctx.L.date(d) + ' · ' + ctx.L.decimal(v, 2)`
- Legend "menos → mais" no rodapé

### 6. Componente `gauge` (Gauge)

- SVG arc 180° (semicírculo) com agulha
- Configs: `column`, `agg`, `min`, `max`, `target`
- Zonas: verde até target, amarelo target→atual (se > target)
- Target tick: linha vermelha na posição da meta
- Labels min/max nas pontas do arc
- Valor central grande (var(--fs-2xl))

### 7. Componente `markdown` (Texto / Markdown)

- Parser inline próprio (~80 LOC, regex)
- Suporta: H1/H2/H3, **bold**, *italic*, `code`, listas com `- `, links `[txt](url)`
- Placeholders `{{path.no.store}}` → substituídos por `SolsticeStore.get(path)`
  - Path inexistente → renderiza placeholder visual destacado
- XSS-safe: escape HTML automático no conteúdo do usuário, com whitelist de tags geradas

### 8. Componente `boxplot` (Box Plot)

- SVG 480×280 com Y axis ticks
- Agrupa por `groupColumn` (até 8 grupos por contagem), ou grupo único
- Box: Q1 (base) → Q3 (topo), median como linha grossa
- Whiskers: min/max inliers + caps
- Outliers como círculos vermelhos individuais com tooltip
- Labels truncados em 12 caracteres com tooltip completo

### 9. Componente `sankey` (Sankey)

- SVG 520×320 simplificado, 2 níveis (source → target)
- Top 8 categorias top de cada lado por contagem
- Nodes: rectangles proporcionais ao total da categoria
- Links: paths Bezier C-curve com altura proporcional ao valor
- Tooltips em links (source/target/valor) e nodes (categoria/total)
- Labels truncados em 14 caracteres

### 10. Catálogo atualizado automaticamente

`SidebarTabs._renderComponentsPanel()` lê de `Components.list()` — 10 cards aparecem sem código adicional.

### 11. Painel de Propriedades estendido

`_renderDataTab` ganhou 6 cases novos. Cada componente expõe sua config completa:
- Scatter: 2 selects + 1 select opcional + checkbox + input numérico (clusters)
- Heatmap Cal: 2 selects + select de agregação
- Gauge: select + select de agg + 3 inputs numéricos
- Markdown: textarea grande com hint de placeholders disponíveis
- Box Plot: 2 selects
- Sankey: 3 selects

### 12. Bump versão `5.3.0-bloco6`

### 13. Meta-arquivos

- `PROGRESSO.md` — versão + seção "Bloco 6"
- `DECISOES.md` — ADRs 048-051 (Compound diferido, helpers inline, Sankey 2-níveis, MD regex)
- `API.md` — atualização Components com 10 componentes + helpers estatísticos
- `BUGS.md` — checklist Bloco 6 (22 itens)
- `changelog/bloco-06.md` (este arquivo)
- `portabilidade/bloco-06.md` — 7 features portáveis

---

## ✅ Checklist do Bloco 6

- [x] HTML sem erros no console (sentinel `[Solstice] boot OK`)
- [x] Funcionalidades dos Blocos 1-5 + patches intactas
- [x] Dark/Light em todos os 6 temas (testar cada componente)
- [x] Comentários em PT-BR
- [x] Sem novas dependências externas
- [x] Locale aplicado (formatação numérica em eixos, tooltips, labels)
- [x] Dicionário consultado em `getTitle` (Humanize.column)
- [x] friendlyName usado nos títulos automáticos
- [x] PROGRESSO/DECISOES/API/BUGS atualizados
- [x] changelog/bloco-06.md criado
- [x] portabilidade/bloco-06.md criado
- [x] 7 features documentadas em portabilidade/
- [x] Prompts pra Eva incluídos
- [x] Marca `═══ FIM DO BLOCO 6 ═══` presente

---

## 🐛 Limitações conhecidas

1. **Compound (combinador)** adiado para B12 polish (ADR-048)
2. **Sankey 2 níveis apenas** — sem otimização de cruzamento, sem suporte a fluxos multi-nível (ADR-050)
3. **Markdown sem CommonMark completo** — não suporta tabelas, code blocks multi-linha, footnotes, syntax highlight (ADR-051)
4. **K-means inicialização simples** — não usa k-means++, pode convergir para mínimo local em datasets adversariais
5. **Box Plot máximo 8 grupos** — top por contagem; outros são ignorados
6. **Heatmap Calendário** mostra range do dataset, não força ano inteiro vazio se range é menor
7. **Gauge** com `target` fora do range [min, max] usa boundary; sem aviso explícito
8. **Helpers estatísticos** privados ao módulo Components — serão expostos via `Solstice.Stats` no B7 com mesmas assinaturas

---

---

## 🔧 Refinamentos r1 — Consolidação Visual (patch antes do B7)

Lucas pediu polish completo antes de avançar para o B7. Aplicado:

### 1. Componentes SVG responsivos (ADR-052)

- Helper `_observeResponsive(host, def, slot, ctx)` cria `ResizeObserver` com debounce 150ms
- `_tierFor(host)` classifica em 3 tiers por `clientWidth`:
  - `compact` (<240) → W=240, H=150
  - `standard` (<420) → W=360, H=240
  - `large` (≥420) → W=540, H=340
- Aplicado em: **Scatter**, **Gauge**, **Box Plot**, **Sankey**, **Distribution** (B5)
- SVG ganha classe `.solstice__chart-svg--{tier}` (CSS define `aspect-ratio` + `min-height`)
- Sankey mostra empty state amigável quando `clientWidth < 320`
- Scatter omite caption em tier compact
- Cleanup do observer anterior antes de criar novo (evita leaks)

### 2. Painel de Propriedades legível (ADR-053)

- Tabs: `min-height: 36px`, padding `10px 14px`, font-size `var(--fs-sm)`
- Radios da Comparação: `min-height: 32px`, gap 8, font-size `var(--fs-sm)`, padding `8px 10px`
- Inputs/Selects: `height: 36px`, padding `8px 10px`, border-radius `var(--rad-sm)`
- Labels: `font-size: var(--fs-xs)` (era 10px), color `var(--c-text-2)` (mais visível)
- Field spacing: `margin-bottom: var(--sp-4)` (mais respiro)

### 3. Resumo do Dataset (ADR-054)

- Novo módulo `SolsticeDataset.summary()` + `groupMeta()` + `GROUP_META`
- Classifica colunas por `SolsticeTypes.group()` em 8 grupos com ícones pt-BR:
  - 📊 Medidas · 🏷️ Dimensões · 📅 Temporais · 🔑 Identificadores
  - 📧 Contato · 🗺️ Geográficas · 🧬 Estruturadas · ⚪ Especiais
- UI `.solstice__dataset-summary` no topo da aba Dados (acima de quality-card):
  - Total de linhas em destaque
  - Badge com total de colunas
  - Lista por grupo com contagem + 3 primeiras colunas + "...+N"
  - Tooltip com lista completa
  - Click → scroll para editor + toast
  - Pluralização correta ("1 Medida" vs "5 Medidas")
- Reativo: assina `ingest` e `dictionary` (recalcula ao mudar tipo/friendlyName)

### 4. Modal drag-safe (ADR-055)

- `SolsticeModal.show({ dismissOnBackdrop: false })` — opção nova, default `true`
- **Proteção GLOBAL contra arraste**: todos os modais ganham
  - `mousedown` marca `dragStartedInside = e.target.closest('.solstice__cmodal') !== null`
  - `click` no backdrop só fecha se drag começou FORA do modal
- Aplicado `dismissOnBackdrop: false` em:
  - `SolsticeDashHeader.openConfig` (modal de cabeçalho — inputs longos)
  - Modal legacy de Dicionário (ganhou proteção drag manual)
- `Modal.confirm` mantém default → click no backdrop ainda fecha

### 5. Polish geral

- Toolbar do canvas: `flex-wrap: wrap` + `flex-wrap` nas actions (cabe em sidebar estreita sem cortar)
- KPI Card: `font-size: clamp(20px, 5cqw, 36px)` + `container-type: inline-size` no `.solstice__kpi-card`
  - Valor encolhe automaticamente em slots estreitos via container query
- KPI Card: `max-width: 100%` + `overflow: hidden` + `text-overflow: ellipsis` no value

### Arquivos atualizados (r1)

- `dashboard.html` — versão `5.3.0-bloco6-r1`
- `DECISOES.md` (+ ADRs 052, 053, 054, 055)
- `API.md` (+ `Solstice.Dataset`, variantes responsivas, `Modal.dismissOnBackdrop`)
- `BUGS.md` (+ checklist refinamentos r1)
- `PROGRESSO.md` (versão bumpada + seção r1)
- `portabilidade/bloco-06.md` (+ 2 features novas)
- `changelog/bloco-06.md` (esta seção)

### window.Solstice

`Solstice.Dataset` exposto. Sentinel `[Solstice] Patch B6-r1 aplicado · pronto para sessão nova`.

---

## ▶ Próximo bloco

**Bloco 7 — Módulo Estatístico `SolsticeStats`** (30+ funções estatísticas puras)

Comando: `AVANÇAR BLOCO 7`
