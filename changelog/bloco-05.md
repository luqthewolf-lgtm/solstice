# Changelog — Bloco 5 (4 Componentes Base + Auditoria de Decisões + Provenance Trail)

**Data:** 2026-05-17
**Sessão:** 1 (Blocos 1-5 entregues juntos)
**Versão entregue:** v5.3.0-bloco5
**Tamanho dashboard.html:** ~135 KB (~5.100 linhas)

---

## 🎯 Diferenciais entregues

### Diferencial #1: Auditoria de Decisões ✅

`SolsticeAudit` registra automaticamente cada decisão importante:
- `add_component` quando slot vazio recebe componente
- `select_component` quando usuário clica componente
- `update_config` quando muda coluna/agregação/etc.

Modal global `🔍` mostra timeline cronológica (mais recente primeiro), filtros por componente, **botão de export para Markdown**. Markdown inclui: timestamp, ação, alvo, detalhes em JSON formatado.

### Inovação Própria #2: Provenance Trail ✅

Botão `🔬` em cada componente abre modal com cadeia de 5 passos:
1. 📄 Dataset (nome + total de linhas)
2. 🎯 Coluna escolhida (técnica + friendlyName do dicionário)
3. 🔍 Filtros aplicados (placeholder até B9)
4. 🧮 Agregação (operação + nº de valores válidos)
5. 📊 Resultado (valor formatado pelo locale)

---

## ✅ Implementado

### 1. Banner + console

- Banner: "BLOCO 5 · 4 COMPONENTES BASE + AUDITORIA + INTEGRAÇÃO DICIONÁRIO (DIFERENCIAL #1)"
- Console: `Solstice.Components.list().length` + `Solstice.Audit.log.length`

### 2. CSS Bloco 5 (~270 linhas)

- `.solstice__comp` (casca padrão, header com actions on hover, estado `is-selected` com glow accent)
- `.solstice__kpi-value`, `-label`, `-delta` (`--up`/`--down`/`--neutral`), `-spark`
- `.solstice__chart-wrap` (container Chart.js responsivo)
- `.solstice__hist` (SVG histograma)
- Heatmap em tabela via `--heat-intensity` CSS var + `td.is-heat::before`
- `.solstice__audit-*` (modal de auditoria com timeline)
- `.solstice__prov-*` (Provenance Trail com setas)
- `.solstice__props-*` (Painel de Propriedades com tabs e fields)

### 3. `SolsticeAudit` (~180 LOC)

Ring buffer de 500 entradas. API: `record/list/subscribe/clear/toMarkdown/exportMd/openModal/openProvenance`. Modal usa `Modal.show` com timeline + filtros. Export gera Blob `text/markdown` e dispara download.

### 4. `SolsticeComponents` (~500 LOC)

- Registry `register/get/list/render`
- Casca padrão `.solstice__comp` com header (título + 🔬 🔍 ⚙️)
- 4 implementações:
  - **KPI Card**: 5 agregações, sparkline 80 valores, delta % entre 1ª/2ª metade, cor por `higherIsBetter`
  - **Série Temporal**: Chart.js, agregação por dia/semana/mês, 3 kinds (line/area/bar)
  - **Distribuição**: histograma SVG nativo com tooltips por barra
  - **Tabela**: reuso preview B2 + heatmap por coluna numérica

### 5. `SolsticeProps` (~200 LOC)

Painel lateral com 4 abas. Renderiza controles específicos por tipo de componente. Cada mudança chama `Audit.record('update_config', ...)`. Subscribe a `canvas.sections` deseleciona se slot removido.

### 6. Integração no `_renderSlot`

- Slot vazio: placeholder ➕ com click → `_openComponentPicker`
- Slot ocupado: `Components.render(slot, el)` (delega para impl)
- Estilo do `.solstice__slot` neutralizado em slot ocupado (display block, sem padding/border)

### 7. Picker de componente

- `Modal.select` com 4 opções (com ícones, descrições, busca pelos sinônimos)
- Após escolher: aplica `defaultConfig(ctx)` baseado no dataset/dicionário, registra `add_component`, abre Props automaticamente

### 8. window.Solstice

`Audit`, `Components`, `Props` expostos. Versão `5.3.0-bloco5`.

### 9. Meta-arquivos

- PROGRESSO.md — Bloco 5 ✓ · seção detalhada
- DECISOES.md — +4 ADRs (030-033)
- API.md — 3 seções novas + paths novos
- BUGS.md — checklist Bloco 5 (29 itens)
- changelog/bloco-05.md (este)
- portabilidade/bloco-05.md — 7 features portáveis

---

## ✅ Checklist do Bloco 5

- [x] HTML sem erros, sentinel `[Solstice] boot OK` presente
- [x] Funcionalidades dos Blocos 1-4 intactas
- [x] Dark/Light em 6 paletas (testar componentes em todos)
- [x] Mobile (375px): canvas funciona; props-panel some junto com sidebar
- [x] Comentários em PT-BR
- [x] Sem novas deps (Chart.js já estava no B1)
- [x] Locale aplicado (formatação numérica em KPI, datas no eixo X)
- [x] Sem novos erros (Components usa Modal.confirm/select)
- [x] **Auditoria de Decisões registrada — Diferencial #1 entregue**
- [x] Dicionário consultado em KPI (`friendlyName`, `higherIsBetter`, `unit`)
- [x] PROGRESSO/DECISOES/API/BUGS atualizados
- [x] changelog/bloco-05.md criado
- [x] portabilidade/bloco-05.md criado
- [x] 7 features documentadas em portabilidade/
- [x] Prompts pra Eva incluídos
- [x] Marca `═══ FIM DO BLOCO 5 ═══` presente

---

## 🐛 Limitações conhecidas

1. **Delta direcional usa "1ª metade vs 2ª metade"** como proxy de período. Período de comparação configurável (último mês vs anterior) virá com filtros B9.
2. **Aba Visual** é stub — cor/escala/anotações no B12.
3. **Aba Filtros e Aba Avançado** (faltam 2 das 6 abas do contrato) — Filtros vira B9, Avançado polish B12.
4. **Distribuição sem box plot** — box plot é parte do B6 (Componentes Avançados).
5. **Chart.js carrega via CDN** com `defer` — se internet falha durante carga, Série Temporal mostra "⏳ Aguardando Chart.js".
6. **Audit não persiste** entre reloads — B11 incluirá no snapshot.
7. **Cap de 500 entries no Audit** — sessão muito longa perde decisões mais antigas (FIFO).
8. **Heatmap em tabela só por coluna isoladamente** — sem normalização cross-column nem opção de palette. B12 polish.
9. **Provenance Trail estático em 5 passos** — para joins, transformações em série, B12 versão configurável.
10. **`slot.config` shape acoplado ao componente** — mudar shape quebra snapshots antigos (B11 vai precisar migration).

---

---

## 🔧 Refinamentos r2 — Catálogo + KPI redesenhado + Humanize

Lucas pediu 3 grupos de ajustes baseados em uso real do B5-r1. Aplicados:

### 1. Aba "Componentes" virou catálogo dinâmico (ADR-038)

Antes (r1): listava componentes JÁ criados no canvas.
Agora (r2): lista TIPOS DISPONÍVEIS para adicionar, lendo de `Components.list()`.

- Grid 2×N de cards com ícone grande centralizado, nome, descrição curta, botão "+ Adicionar"
- Click → `Components.addByType(typeId)`:
  - Procura primeiro slot vazio em `canvas.sections` → ocupa
  - Senão, cria nova seção com 1 row 1col com o componente
  - Auto-scroll + `Props.select` automático
- Estado `dataset.ready === false`: cards `is-disabled` (opacity 0.4 + tooltip "Importe um CSV primeiro"); re-render quando `dataset.ready` muda
- Dinâmico: B6 vai adicionar 4 componentes (Scatter/Heatmap/Gauge/Texto) → catálogo cresce automaticamente para 8 cards

### 2. KPI Card redesenhado completamente

Layout em 3 zonas claras (`.solstice__kpi-card`):

- **Título no canto superior direito**: `📊 RECEITA TOTAL` (uppercase + letter-spacing, `friendlyName` do dicionário, muted)
- **Número grande à esquerda**: `var(--fs-3xl)` + tabular-nums + tooltip humanizado "Soma de 200 valores válidos da coluna Receita Mensal"
- **Linha de comparação humanizada**: via `Humanize.delta()`:
  - `▲ +12,3% acima do período anterior` (verde se higherIsBetter true)
  - `▼ -5,4% abaixo do período anterior` (vermelho idem)
  - `≈ Estável vs período anterior` (variação < 1%, cinza)
  - `Calculado de 200 registros` (fallback quando dataset não tem coluna temporal)
- **Sparkline removido por default**; opt-in via `slot.config.showSparkline`. Caption quando ativo: "Tendência ao longo do tempo" / "Variação ao longo dos dados" (nunca "últimos N pontos")
- `min-height: 140px` para uniformidade entre cards

### 3. SolsticeHumanize — toda string visível ao usuário (ADR-039)

Novo módulo ~80 LOC. API:
- `aggregation(op)` → pt-BR ('sum' → 'Soma', 'count' → 'Quantidade', etc., 8 ops)
- `delta(pct, higherIsBetter)` → `{ text, color }` com chave semântica de cor
- `recordCount(n)` → '1 registro' / '200 registros' / '1.500 registros' / '1 milhão de registros' (pluralização + Intl)
- `timeRange(rangeMs)` → '30 dias' / '3 meses' / '1,5 anos'
- `column(name, dict)` → friendlyName ou Title Case

**Strings técnicas substituídas:**
- Distribuição: `'bins · n=N'` → `'faixas · N registros'`
- KPI: removido `'últimos N pontos'`, `'n=N'`, `'agg cru'` da UI

### 4. Componentes agora têm `description` no registro

Campo novo `description` em cada `register()`:
- KPI: "Número importante com comparação e tendência"
- Série Temporal: "Evolução de uma métrica ao longo do tempo"
- Distribuição: "Como valores se distribuem em faixas"
- Tabela: "Dados em linhas e colunas com heatmap"

### Arquivos atualizados (r2)

- `dashboard.html` — versão `5.3.0-bloco5-r2`
- `DECISOES.md` (+ ADRs 038, 039)
- `API.md` (+ seção `Solstice.Humanize`)
- `BUGS.md` (+ entrada `#003 — KPI Card com layout confuso · RESOLVIDO`)
- `PROGRESSO.md` (versão bumpada + seção r2)
- `portabilidade/bloco-05.md` (+ Feature 8 `SolsticeHumanize`, + Feature 9 Catálogo de componentes)
- `changelog/bloco-05.md` (esta seção)

### window.Solstice

`Solstice.Humanize` exposto. `Solstice.Components.addByType(typeId)` é a API pública do catálogo.

---

---

## 🔧 Refinamentos r3 — UX baseado em uso real (abas + comparação + confirmações)

Lucas pediu 4 grupos de melhorias após uso prático do r2:

### 1. Abas isoladas Dados/Componentes (ADR-040)

`SolsticeSidebarTabs.activate()` agora controla os 3 painéis explicitamente:
- **Aba "Dados"**: `#data-panel` visível (quality + editor de colunas) · `#components-panel` e `#props-panel` ocultos
- **Aba "Componentes"**: `#data-panel` oculto · `#components-panel` visível (catálogo) · `#props-panel` visível só se `ui.selectedSlot` definido

`Store.ui.activeTab` persiste aba ativa.

### 2. Seleção força aba Componentes (ADR-041)

`Props.select(slotId)` chama `SidebarTabs.activate('componentes')` automaticamente quando aba atual é outra. Garante feedback visual ao clicar componente no canvas.

### 3. Comparação configurável no KPI (ADR-042)

**Novo módulo `SolsticeKPI.calculateDelta(values, config)`** com 8 tipos:

| Tipo | Baseline |
|---|---|
| `previous-period` (default) | 1ª metade da série |
| `same-period-last-year` | Primeiro 1/12 da série |
| `fixed-target` | `config.comparison.targetValue` (input numérico) |
| `historical-mean` | Média de todos os valores |
| `historical-median` | Mediana de todos |
| `first-value` / `last-value` | `values[0]` / `values[last]` |
| `none` | retorna `null` → KPI mostra "Calculado de N registros" |

`Humanize.delta(pct, higherIsBetter, baselineLabel)` aceita label livre. Heurística pt-BR de artigo:
- `"acima da meta"` (label começa com substantivo feminino → "da")
- `"acima do período anterior"` (label começa com "período" → "do")
- `"acima da média histórica"` / `"abaixo do último registro"` / etc.

UI: aba **"⚖️ Comparação"** no Props do KPI (entre Dados e Visual) com:
- Radio buttons para os 8 tipos
- Sub-campos condicionais:
  - **Meta fixa** → input numérico (valor) + input texto (rótulo customizado)
  - **Período anterior** → dropdown (Auto/Diário/Semanal/Mensal/Trimestral)

`slot.config.comparison = { type, targetValue, targetLabel, periodSize }`. Default `previous-period` por compatibilidade.

### 4. Confirmações silenciáveis + Toast com Desfazer (ADR-043)

**`Modal.confirm({ skipKey })`** — chave identifica ação:
- Se silenciada (em `localStorage` por perfil): resolve `true` imediatamente
- Senão: modal aparece com **checkbox "Não perguntar mais sobre isso"**; marcar + confirmar persiste

Aplicado nas 3 ações destrutivas:
- `remove-component` (header de cada componente)
- `remove-section` (toolbar da seção)
- `remove-row` (mini-toolbar da row)

**`Toast.action({ actionLabel, actionFn })`** — toast com botão clicável (default 5s). Pós-remoção dispara `Undo.undo()` se clicado.

**Menu de Preferências** — botão 👤 no header abre modal com lista das 3 chaves silenciáveis. Checkbox marcada = pergunta antes; desmarcada = silenciado. Persistência por perfil.

`Modal.isSkipped()`, `Modal.listSkipped()`, `Modal.unskip()` para gerenciar programaticamente.

### Arquivos atualizados (r3)

- `dashboard.html` — versão `5.3.0-bloco5-r3`
- `DECISOES.md` (+ ADRs 040-043)
- `API.md` (+ seções `Solstice.KPI`, `Modal.confirm.skipKey`, `Toast.action`)
- `BUGS.md` (+ entrada `#004 — Abas misturadas / comparação fixa / confirmações irritantes · RESOLVIDO`)
- `PROGRESSO.md` (versão bumpada + seção r3)
- `portabilidade/bloco-05.md` (+ 4 features novas)
- `changelog/bloco-05.md` (esta seção)

### window.Solstice

`Solstice.KPI` exposto. Toast agora tem método `.action()`. Modal tem `isSkipped/listSkipped/unskip`.

---

---

## 🔧 Refinamentos r4 — Containment + Compatibilidade estatística + Dashboard Header

Lucas reportou 3 ajustes na UX do r3 + 1 feature nova:

### 1. Aba "⚖️ Comparação" quebrando layout (containment CSS)

- `.solstice__props-panel`: `overflow-x: hidden` + `max-height: calc(100vh - 280px)` + scroll vertical próprio
- `.solstice__props-tabs`: `flex-wrap: nowrap` + `overflow-x: auto` — tabs não quebram linha
- `.solstice__props-tab`: `flex: 0 0 auto` + `white-space: nowrap`
- `.solstice__compare-radio`: `font-size: var(--fs-xs)`, padding `4px 8px`, gap `6px`, ellipsis no texto
- `COMPARISON_TYPES` ganhou variante `short`: "Mesmo período (1a)", "Primeiro valor", "Último valor"
- Variantes CSS: `.solstice__compare-radio--warning` (com ⚠️ via ::before), `.solstice__compare-more` (botão expandir), `.solstice__compare-warning-note` (nota de aviso amarela)

### 2. AGG_COMPARISON_COMPAT + filtragem por compatibilidade estatística (ADR-044)

`SolsticeKPI` agora exporta:
- `AGG_COMPARISON_COMPAT` — mapa de baselines compatíveis por agregação
- `isCompatible(agg, baselineType)` → boolean
- `incompatReason(agg, baselineType)` → string explicando por que combinação é desencorajada

Aba "Comparação" filtra: opções compatíveis aparecem na lista principal; "+ Mais opções (N incompatíveis)" expande as restantes com:
- Nota de aviso ⚠️ amarela no topo
- Ícone ⚠️ na frente de cada label incompatível (via classe `--warning`)
- Tooltip específico por opção via `incompatReason`

**Auto-switch**: trocar agregação na aba Dados que invalide a baseline atual:
- Substitui `comparison.type` por `'previous-period'`
- Toast informativo: "Comparação ajustada · A baseline anterior não fazia sentido com {agregação}"
- Registra `auto_switch_comparison` no Audit com `from`/`to`/`because`

### 3. KPI título à esquerda via hook `def.getTitle` (ADR-045)

`Components.render` consulta `def.getTitle(slot, ctx)` se existir, senão usa `def.name` (static). KPI implementa:
```js
getTitle(slot, ctx){
  const col = slot.config?.column;
  return col ? SolsticeHumanize.column(col, ctx.dictionary).toUpperCase() : 'KPI Card';
}
```

Casca já usa `.solstice__comp-head { display: flex }` com `.solstice__comp-title { flex: 1 }` empurrando `.solstice__comp-actions` à direita. Removido o título absolute do canto sup-direito (`.solstice__kpi-card-title`).

Resultado:
```
┌──────────────────────────────────────────┐
│ 📊  QTD. VENDAS          [🔬 🔍 ⚙️ 🗑]  │
│                                          │
│ R$ 5.046,00                              │
│                                          │
│ ▲ +19,9% acima da média histórica       │
└──────────────────────────────────────────┘
```

### 4. Dashboard Header customizável (ADR-046 + ADR-047) — NOVO

Novo módulo `SolsticeDashHeader` com banner gradient acima da toolbar do canvas:

- **Botão "📋 Cabeçalho"** na toolbar do canvas abre modal de configuração
- **Modal completo**:
  - Toggle "Exibir cabeçalho"
  - Inputs: Título / Subtítulo
  - Toggle "Mostrar data" + radio (today/fixed/column)
    - `fixed`: input date
    - `column`: select de coluna temporal + radio função (max/min/recent)
  - Color pickers: cor inicial + cor final do gradiente (hex + picker visual)
  - Select direção: 8 opções (4 cardinais + 4 diagonais + radial)
  - Radio cor texto: `auto-white` / `auto-black` / `custom` (color picker)
  - Radio altura: `compact` 80px / `standard` 120px / `tall` 180px
  - **Preview ao vivo** atualizando a cada mudança
- **Persistência em `Store.canvas.header`** (vai com snapshots no B11)
- **Auto-sugestão**: ao importar CSV, toast com botão "Configurar" propõe `Title Case do nome do arquivo` como título (uma vez por dataset)
- **`autoTextColor(fromHex, toHex)`**: calcula luminância sRGB WCAG da média das duas cores; < 0.5 → branco, ≥ 0.5 → preto
- `Canvas.render` chama `DashHeader.renderInto(canvas)` antes da toolbar (transparente para o `Canvas` — fica null-safe se módulo não existir)

### Arquivos atualizados (r4)

- `dashboard.html` — versão `5.3.0-bloco5-r4`
- `DECISOES.md` (+ ADRs 044, 045, 046, 047)
- `API.md` (+ seções `Solstice.DashHeader`, atualização `Solstice.KPI` com compat + paths novos no Store)
- `BUGS.md` (+ entrada `#005 — Comparação layout / título / compatibilidade · RESOLVIDO`)
- `PROGRESSO.md` (versão bumpada + seção r4)
- `portabilidade/bloco-05.md` (+ 3 features novas)
- `changelog/bloco-05.md` (esta seção)

### window.Solstice

`Solstice.DashHeader` exposto. `Solstice.KPI` ganhou `isCompatible`, `incompatReason`, `AGG_COMPARISON_COMPAT`. `Solstice.Components` agora consulta `def.getTitle` quando existir.

---

## ▶ Próximo bloco

**Bloco 6 — 4 Componentes Avançados + Box Plot + Sankey**

Comando: `AVANÇAR BLOCO 6`
