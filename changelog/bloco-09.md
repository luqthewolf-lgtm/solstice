# Changelog — Bloco 9

**Entregue em:** 2026-05-18 · Sessão 3
**Versão:** `5.3.0-bloco9`
**Tamanho:** ~13.389 linhas (~579 KB)

---

## 🎯 Objetivo

Tornar o Solstice **interativo**: o usuário restringe o dataset por filtros globais, faz drilldown via cross-filter ao clicar em qualquer ponto/categoria, e injeta valores variáveis (metas, períodos, target) via parâmetros globais que ficam disponíveis em narrativas e markdown.

## 🔧 Inclui Patch B8-r1

Antes do B9, corrigido bug do empty state "afundando" reportado pelo Lucas. Canvas vira flex column; empty state usa `flex: 1; min-height: 320px`. ADR-071.

## ✨ 3 Módulos Novos

### `SolsticeFilters` — Engine + UI dos filtros globais

- **Apply** filtros a array de rows via `Filters.apply(rows)`. Lê de `Store.filters` + `Store.crossfilter`.
- **Sugestões automáticas** de filtros via `suggested()`: categóricas (2-30 distintos), temporais (≥30 valores válidos), numéricas (IQR > 0).
- **3 controles UI:**
  - 🔘 **Multi-select** com busca, chips no trigger, panel ordenado por contagem
  - 📊 **Range slider duplo** com inputs numéricos sincronizados
  - 📅 **Date picker** com 5 presets (7d/30d/3m/12m/Tudo) relativos ao max da série + custom
- **Header colapsável** com badge "N ativos" + "✕ Limpar tudo"
- **Persistência:** `Store.ui.filters.collapsed`

### `SolsticeCrossFilter` — Destaque temporário por clique

- `activate(column, value)` cria filtro temporário (não persiste como global)
- Barra azul accent no topo do canvas: "🎯 Cross-filter: X = Y · ✕ Limpar"
- **Esc** limpa (cascata: modal → drawer → inspector → cross-filter)
- **Sankey** demonstrado — clique em node (origem ou destino) ativa cross-filter na coluna correspondente
- Auditoria registra `action: 'crossfilter'`

### `SolsticeParams` — Parâmetros globais K/V tipados

- CRUD via modal "🎛️ Parâmetros" (botão na toolbar do canvas)
- Tipos: `string`, `number`, `date`
- Persistido em `Store.params`
- `resolveText(text)` substitui `{{param.NOME}}` antes do pipeline de Markdown (legado `{{path.no.store}}` continua funcionando)

## 🔗 Integração transparente nos componentes

Ponto cirúrgico: `SolsticeComponents._ctx()` ganhou 2 linhas:

```js
const allRows = (ingest && ingest.rows) || [];
const rows = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.apply(allRows) : allRows;
return { rows, rowsAll: allRows, columns, types, dictionary, L };
```

Todos os 10 componentes (KPI, Série Temporal, Distribuição, Tabela, Scatter, Heatmap Cal, Gauge, Markdown, Box Plot, Sankey) consomem rows filtradas automaticamente. **Zero linhas de código de componente foram alteradas.**

**ctx.rowsAll** novo para futuras smart features (Auto-Dashboard B10 vai precisar do dataset completo).

## 🎨 CSS novo

```
.solstice__filterbar / -head / -title / -count / -actions / -toggle / -body / -empty
.solstice__filter / -label / -clear
.solstice__ms (multi-select) / -trigger / -chip / -panel / -search / -option / -empty
.solstice__range (slider duplo) / -track / -fill / -input / -values
.solstice__datefilter / -presets / -preset.is-active / -range
.solstice__crossfilter-bar / -bar-text / -bar-clear
.solstice__params-list / -row / -empty
```

## 📐 ADRs

- **ADR-071:** Canvas flex-column + empty state flex:1 (B8-r1 / fix do bug reportado)
- **ADR-072:** Filtros aplicam via `_ctx()` — transparente para `render()` dos componentes
- **ADR-073:** Cross-filter como destaque temporário distinto dos filtros globais
- **ADR-074:** Parâmetros K/V tipados substituídos antes de Store paths

## ⚠️ Limitações conhecidas

- **Cross-filter só no Sankey** — Scatter/Distribution/BoxPlot/Heatmap precisam adicionar handlers similares (futuro, low effort)
- **Filtros não persistem em snapshots** — comportamento "sessão"; B11 pode mudar
- **Date presets pt-BR hardcoded** — i18n vai no B12
- **Parâmetros sem fórmula** (`{{param.A * 1.1}}` não funciona) — B11
- **Tipos de parâmetro não validados** — `number` aceita string "abc"
- **Filtros recomputados a cada render** — para datasets 500k+ memoize por hash; B12
- **Multi-select sem virtualização** — categorias com 1000+ valores podem ficar lentas; B12

## 🔮 Bloco 10 — próximo

Auto-Dashboard contextual + Wizard expandido + Recomendações de visualização ampliadas. Vai usar `Filters.suggested()` para sugerir filtros automaticamente E `ctx.rowsAll` para análise sobre dataset completo (sem viés do filtro do usuário).
