# Auditoria 2026.6 — Revisão de correção + rumo a paridade PowerBI/QuickSight

> **Contexto:** revisão fim-a-fim do `solstice_baseline.html` (~48,8k linhas,
> ~2 MB, single-file) com foco em três frentes: (1) **fundação de qualidade**
> (a suíte de testes estava quebrada), (2) **correção numérica** em caminhos
> que mostram números errados ao cliente, e (3) **avaliação honesta de gaps**
> versus produtos grandes (Power BI, AWS QuickSight) com roadmap priorizado.

## Metodologia

1. Baseline de testes (`npm test`) — **estava vermelho: 48/149 falhando**.
2. Bug hunt dirigido na camada de estatística/dados (caça a `clean()` mal
   usado, `parseFloat` em dados pt-BR, divisões sem guarda, ordenação de
   datas, off-by-one em quantis). Cada achado **verificado caso a caso** no
   código antes de virar correção — descartados os falsos positivos.
3. Mapeamento do surface: 111 IIFEs `Solstice*`, 20 componentes de
   visualização registrados, engine de Insights (13 tipos), NLQ ("Ask").
4. Gap analysis contra Power BI / QuickSight.

> **Restrição do ambiente desta auditoria:** execução headless (sem browser /
> sem jsdom). A suíte só faz *parse-check* — não há verificação de runtime/UI.
> Por isso, esta sprint corrige **apenas lógica verificável por teste** e
> deixa o trabalho de UI/repaginação como roadmap explícito (abaixo), em vez
> de reescrever às cegas componentes que não consigo validar visualmente.

---

## Achados corrigidos (Sprint 46)

### 🔴 A6-01 — Suíte de testes quebrada (48/149 falhando)
**Causa-raiz:** o extractor de módulos (`tests/extract-modules.mjs`) casava a
regex `const SolsticeStats = (function(){` na **primeira** ocorrência — que é
o texto **citado dentro de um comentário JSDoc** (linha ~16417), não a
declaração real (linha ~16439). Resultado: corpo extraído vazio → `SolsticeStats`
indefinido → cascata de 48 falhas (stats + formula, que depende de stats).
**Correção:** ancorar a regex no início de linha (`\n` + indentação) para casar
a declaração de código real, ignorando citações em comentários.
**Impacto:** o CI no `main`/PR estava efetivamente sem cobertura de stats/formula.

### 🔴 A6-02 — `distinctCount` zerava cardinalidade de colunas categóricas
`distinctCount` rodava `clean()` (que mantém só números) antes de contar, então
**qualquer coluna de texto retornava 0**. Usado em ~14 lugares: cardinalidade,
detecção de coluna constante (`=== 1`), gating de insights (`> 8`) e o KPI
"Distintos em X" — todos quebrados para dimensões de texto (estados, categorias,
produtos…). **Correção:** contar valores brutos não-nulos, sem `clean()`.

### 🟠 A6-03 — `parseFloat` truncando números pt-BR em stats usadas
`correlation`, `correlationSpearman` e `linearRegression` usavam `parseFloat`,
que trunca `"1.234,56"` → `1.234`. Os chamadores internos hoje pré-parseiam com
`parseNum`, mas a API pública `Solstice.Stats.*` ficava exposta ao bug.
**Correção:** `parseFloat` → `parseNum` (BR-aware), consistente com o mandato
do CI que já proíbe `parseFloat(r[col])`.

### 🟠 A6-04 — Matriz drill-down: `_agg` com dois bugs reais
`_agg` recebe células cruas (`r[metricCol]`). (1) `parseFloat` truncava decimais
pt-BR em sum/avg/min/max; (2) `count` caía no guard `!c.length` e retornava
`null` em colunas de texto, além de contar nulos via `values.length`.
**Correção:** `count` passa a operar sobre não-vazios de qualquer tipo (antes do
filtro numérico); demais aggs usam `parseNum`.

### 🟡 A6-05 — Fidelidade de teste: `SolsticeBR` não injetado em `stats.mjs`
`SolsticeStats.parseNum` delega a `SolsticeBR.toNumber`. Como o stub não era
injetado no módulo extraído, `parseNum` caía em `parseFloat` e **todos os testes
de stats rodavam num caminho diferente do app real**. **Correção:** injetar o
stub `SolsticeBR` em `stats.mjs` (espelhando `formula.mjs`). Agora os testes
exercitam o parsing BR-aware de verdade.

**Resultado:** **153/153 testes verdes** (4 novos: cardinalidade categórica +
parsing pt-BR em correlation/regression).

---

## Achados verificados que **NÃO** são bugs (descartados)

- `minMax` com `else if`: seguro — um novo mínimo nunca pode exceder o máximo
  corrente (mx ≥ mn). Falso positivo.
- `demand-list` ordenando datas por `localeCompare`: as 3 fontes de `date` usam
  `new Date().toISOString()` (ISO-8601, que ordena cronologicamente por string).
  Sem caminho que injete data não-ISO. Não é bug hoje.
- `median`/`percentile`/`quartiles`/`mode`/`variance`/`holtWinters`: guardas de
  `n<2`/denominador-zero/sazonalidade conferidas — corretas.

---

## Dívida técnica identificada (deferida — roadmap)

### D6-01 — `SolsticeStatsAsync` (Web Worker) é código morto interno
Exposto como `Solstice.StatsAsync` (API pública) mas **nunca chamado
internamente** (`.smart()`/`.call()` têm zero call-sites). Ele reimplementa um
subset de stats num `WORKER_SRC` string com **inconsistências próprias**:
`clean` usa `parseFloat` (mesmo bug A6-03) e `outliersIQR` usa quartil
nearest-rank em vez de interpolação type-7 — então o mesmo dataset pode marcar
outliers diferentes dependendo da thread. **Recomendação:** ou consolidar (worker
chamando exatamente a mesma lógica canônica) ou remover a API morta. Não removido
nesta sprint por ser API pública — decisão de produto.

### D6-02 — Sem verificação de runtime no CI
A suíte só faz parse-check. Um `SolsticeViews` duplicado já derrubou o boot
inteiro sem erro de grep (vide histórico). **Recomendação:** smoke test de boot
com jsdom (1 dependência dev) que monta o app, importa um CSV sintético e checa
o sentinel `[Solstice] boot OK` + renderização de 1 componente.

---

## Gap analysis — Solstice vs Power BI / QuickSight

Solstice já entrega o diferencial de **portabilidade absoluta** (1 arquivo,
offline, sem login) e cobre o básico de BI com competência: 20 componentes,
estatística descritiva séria, anomalias contextuais, forecast, NLQ pt-BR,
insights automáticos. Os gaps que mais separam de um produto "grande":

| Área | Power BI / QuickSight | Solstice hoje | Prioridade |
|---|---|---|---|
| **Modelo de dados** | Relacionamentos N:N, star schema, RLS | Multi-CSV com relação básica | Alta |
| **Cross-filter / drill** | Highlight cruzado entre todos os visuais | Parcial (time-series/scatter/tabela) | **Alta** |
| **Linguagem de fórmula** | DAX completo (time-intelligence) | DAX-like (SUM/AVG/IF/CALCULATE) | Alta |
| **Driver analysis** | "Key Influencers", Decomposition Tree | — | Média |
| **Smart narratives** | Narrativa dinâmica ligada a filtros | Narrativa automática estática | Média |
| **Performance** | Colunar/VertiPaq, milhões de linhas | DOM + Chart.js, virtualização parcial | **Alta** (>50k linhas) |
| **Bookmarks/Tours** | Bookmarks + storytelling | Snapshots + apresentador | Média |
| **Field well / UX de autoria** | Arrastar campos pra "wells" tipados | Wizard + config por slot | Média |
| **Theming corporativo** | JSON de tema importável | 7 paletas fixas | Baixa |

### Roadmap proposto (sprints seguintes, ordenado por valor/risco)

1. **Sprint 47 — Cross-filter universal.** Clicar numa barra/fatia/célula filtra
   todos os visuais da página (modelo de "highlight" do Power BI). Maior salto de
   percepção de "produto grande" por esforço médio.
2. **Sprint 48 — Performance >50k linhas.** Parse incremental de CSV (não trava
   UI) + virtualização real de tabela + amostragem LTTB já existente nos charts.
3. **Sprint 49 — Field wells tipados.** Painel de autoria com "wells" (Eixo /
   Valores / Legenda / Filtros) com validação de tipo — reduz fricção de montar
   visual, aproxima do Power BI/QuickSight.
4. **Sprint 50 — Time-intelligence nas fórmulas.** `SAMEPERIODLASTYEAR`, `YTD`,
   `MTD`, `MOVINGAVG` — a peça que mais falta no DAX-like atual.
5. **Sprint 51 — Key Influencers.** Driver analysis (qual dimensão mais explica a
   variação da métrica) — feature "uau" do Power BI, viável com a stats existente
   (regressão + decomposição de variância).
6. **Transversal — D6-02 (smoke test jsdom)** antes das sprints de UI, pra
   destravar refatoração de interface com rede de segurança.

---

## Prioridade desta entrega

| ID | Sev | Status |
|----|:--:|--------|
| A6-01 | 🔴 | ✅ corrigido |
| A6-02 | 🔴 | ✅ corrigido |
| A6-03 | 🟠 | ✅ corrigido |
| A6-04 | 🟠 | ✅ corrigido |
| A6-05 | 🟡 | ✅ corrigido |
| D6-01 | — | 📋 deferido (decisão de produto) |
| D6-02 | — | 📋 roadmap (transversal) |

**Avaliação:** a base estava com a rede de segurança furada (testes vermelhos
mascarando regressões reais de cardinalidade e parsing). Sprint 46 restaura a
fundação e fecha bugs que mostravam números errados. A repaginação rumo a
paridade Power BI/QuickSight é trabalho de UI plurissprint, mapeado acima — feito
com verificação de runtime (D6-02) para não regredir às cegas.
