# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

---

## [Unreleased] — Auditoria 2026.6 — "Teste de experiência do cliente (Playwright)" — 2026-05-23

Auditoria conduzida **dirigindo o app de verdade** (Chrome via Playwright) sobre
um CSV de vendas pt-BR realista (`1.234,56`, datas `dd/mm/aaaa`, nulos, outlier).
Três bugs de alto impacto no caso de uso central foram encontrados e corrigidos.

### 🧩 ADAPT-TYPE + HEADER-ADAPT — App escala e header se adapta em qualquer resolução (parte 9)

- **Pedido**: adaptar a TODAS as resoluções (nem pequeno, nem cortado); "a barra de
  cima e o canvas têm que se adaptar".
- **ADAPT-TYPE**: escala fluida do app inteiro via `html { font-size: clamp(15px,
  0.4vw + 11px, 19px) }`. Como `--fs-*` e `--sp-*` são todos rem, esse clamp é um
  **fator de escala único** — fonte + espaçamento + alturas crescem/encolhem juntos
  com a janela, sem saltos. Calibrado: 911≈15px · 1366≈16,5 · 1920≈18,7 · 2560≈19
  (teto). `@media print` fixa 16px → PDF/export consistente.
- **HEADER-ADAPT**: `.solstice__header` ganhou `flex-wrap: wrap` e o campo de busca
  `flex:1 1 160px; min-width:0`. Em telas estreitas (notebook com escala do Windows)
  o header **quebra pra 2 linhas em vez de cortar** os botões à direita (o
  "Exportar" sumia). Tudo continua acessível em qualquer largura.
- Validado renderizando no **tamanho físico real** (device_scale_factor simulando
  a escala do Windows) em 1366@100/125/150%, 1920 e 2560: header adapta, canvas
  preenche, texto confortável, nada cortado. 20/20 componentes sem erro.

### 🖥️ WELCOME-FIT — Tela inicial cortada em notebooks com escala do Windows (parte 8)

- **Sintoma** (foto real, notebook 1366 com escala 150%): título "Solstice"
  gigante e **cortado no topo** ("barra comendo em cima"), tela parecendo
  baixa-resolução/não-padrão. Causa: a escala do Windows (125/150%) faz o Chrome
  enxergar um viewport CSS baixo (~911×512), que os testes em px exato (dpr=1)
  nunca reproduziram.
- **Raiz**: `.solstice__welcome` usava `justify-content:center` + `overflow:hidden`
  + `max-height` fixo → numa tela baixa o conteúdo era centralizado e **cortado em
  cima/embaixo sem rolar**. O hero usava `--fs-3xl` fixo (48px), enorme.
- **Fix**: `justify-content: safe center` (não corta o topo quando não cabe) +
  `overflow-y: auto` (rola em vez de cortar); hero com `clamp(1.7rem, 2.6vw,
  2.75rem)` (exceção de título hero — escala como landing). Validado em 911×512,
  1093×614 e 1366×768: nada cortado, hero proporcional, conteúdo acessível.

### 📐 STD-TYPE — Responsividade: fonte fixa + layout responsivo (padrão de app) (parte 7)

- **Sintoma** (reportado pelo usuário): em monitor 2560 ficava bonito, mas em
  notebook ~1366 ficava "muito pequeno, agoniante". Medido: o `body` era **14,72px
  em ≤1366**, 16px em 1920 e 16,8px em 2560.
- **Raiz**: uma media query `@media (max-width:1400px)` **encolhia** os tokens de
  fonte (`--fs-base:0.92rem`) "pra caber mais" — deixando notebooks cramped.
- **Decisão de design**: fonte-base **FIXA** (16px), igual em qualquer resolução —
  padrão de apps sérios (Notion/Linear/Figma/Power BI web) e o que mantém
  **PDF/print/screenshot previsíveis** (o tamanho não muda conforme a janela).
  Tentou-se tipografia fluida (clamp+vw) antes, mas é não-padrão pra UI de app e
  prejudica a consistência de export — revertido. A responsividade fica no
  **LAYOUT** (larguras fluidas via `clamp(vw)`, reflow, densidade), não na fonte.
  Quem quer "aumentar tudo junto" usa o **zoom do navegador (Ctrl +/-)**, que
  escala todos os `--fs-*`/`--sp-*` (agora em rem) de forma uniforme.
- **Fix**: `html { font-size: 16px }` fixo; removido o encolhimento de fonte da
  query de notebook e o boost de fonte da query ≥2200px. Tokens de espaçamento,
  raios e alturas convertidos de px → **rem** (FLUID-SCALE) pra acompanharem o zoom
  do navegador de forma harmônica. Medido depois: **body 16px em 1280/1366/1920/2560**
  (consistente); canvas reflui com a largura. 20/20 componentes sem erro de console.

### 🔴 BR-NUM — Inferência de tipo quebrava colunas de dinheiro pt-BR (crítico)

- **Sintoma**: colunas com número brasileiro agrupado (`"20.729,20"`, `"1.403,70"`)
  eram classificadas como `dimension` (texto) e ficavam **não-agregáveis**; a soma
  de receita aparecia ~1.280× menor (R$ 12 mil em vez de R$ 15,9 mi).
- **Raiz**: as regexes numéricas (`DECIMAL`/`INTEGER`/`CURRENCY`) exigiam fim logo
  após o decimal e não toleravam o agrupador de milhar com ponto. Além disso a
  `CURRENCY` casava com inteiros puros (`"29"`) e era testada antes de `integer`,
  então contagens (`qtd_vendas`) viravam "moeda".
- **Fix** (`SolsticeTypes`): detecção numérica ciente de formato BR/US agrupado via
  helpers `_numLike`/`_hasDecimals`/`_hasCurrencySym`; `currency` passou a exigir
  símbolo monetário; `geo_lat`/`geo_lng` agora rejeitam valores com vírgula (preço
  BR estava virando "latitude"). Resultado: `qtd_vendas`→integer, `preco`/`receita`→
  decimal (agregáveis), `R$ …`→currency.
- **Regressão**: `tests/types.test.mjs` (8 casos) + extração de `SolsticeTypes` em
  `tests/extract-modules.mjs`.

### 🟠 DICT-CONF — Domínio errado aplicado a CSV ambíguo

- **Sintoma**: um CSV de vendas era detectado como **"Banco PJ"** a 44% (cobrindo só
  3/9 colunas) e o modal sugeria nomes errados (`data`→"Data do Atendimento",
  `categoria_produto`→"Segmento").
- **Fix**: `DICT_DETECT_MIN_CONF` (antes declarado mas **não usado**) agora gateia
  `SolsticeDictionary.detect()` e subiu de 0.40 → **0.55**. Abaixo do limiar cai pro
  dicionário genérico (Title Case neutro: "Receita Total", "Categoria Produto"…),
  com banner honesto "não bateu com nenhum domínio pré-feito".

### 🟠 HIST-OUTLIER — Histograma inútil com um único outlier

- **Sintoma**: o componente Distribuição usava range min-max cru para as faixas.
  Um único outlier (comum em dados reais) esticava o eixo X e amontoava ~99% dos
  registros em 1-2 barras, deixando o resto vazio e ilegível.
- **Fix** (`SolsticeComponents` distribution): janela de binning robusta via cerca
  de Tukey (`Q1−1.5·IQR, Q3+1.5·IQR`); valores fora caem nas faixas de borda
  (overflow) e o rótulo avisa "outliers agrupados nas bordas". O miolo da
  distribuição volta a ser legível sem esconder a existência do outlier.

### 🔴 OUTLIER-SHAPE — "undefined outliers / NaN%" em Ask, insights e narrativa

- **Sintoma**: perguntar "outliers em receita_total" no Ask respondia "Detectados
  **undefined** outliers em Receita Total (**NaN**% do total)". Mesmo bug aparecia
  em insights automáticos, recomendações e narrativa executiva.
- **Raiz**: `SolsticeStats.outliersIQR()` retorna `{ indices, values, fences }`
  (objeto), mas **6 call sites** liam `.length` direto no resultado (com um
  `|| []` revelando que o autor achava que era array) → `undefined`.
- **Fix**: os 6 sites passaram a ler `.indices.length`. Agora: "Detectados **2**
  outliers em Receita Total (1.7% do total)".

### 🟢 METRIC-RANK — KPI-título preferia contagem a receita

- **Sintoma**: o auto-dashboard de vendas usava soma de `qtd_vendas` (1ª coluna
  numérica, vencia por posição) como KPI principal, em vez de `receita_total`.
- **Fix** (`SolsticeColumnScore`): critério aditivo que favorece colunas numéricas de
  **valor** (receita/faturamento/lucro/GMV…) como headline, bônus menor pra
  monetárias per-unit (preço/custo), e exclusão explícita de nomes de contagem
  (qtd/quantidade/count). KPI-título passou a mostrar R$ 15,9 mi (receita).

### 🧩 Varredura completa dos 20 componentes + layouts (2026.6 · parte 2)

Cada um dos 20 componentes foi adicionado ao canvas com o dataset de teste,
renderizado e teve o painel de opções (inspector) aberto, com captura de erros de
console por componente. Achados e correções:

- 🔴 **PROPS-CTX** — abrir a aba **Visual** do inspector da Tabela lançava
  `ReferenceError: _ctxFor is not defined` (o helper local chama-se `_ctx`); o
  accordion de opções quebrava. Corrigido.
- 🟠 **SCATTER-AXIS** — rótulos de eixo com valores grandes (ex: receita
  `4.310.124`) estouravam a margem e apareciam cortados (".0.124"). Agora usam
  formato compacto (`4,3M` / `5k`).
- 🟡 **HUMANIZE** — `slider` (título "QTD_VENDAS") e `distrib-time` (legenda/eixo
  "qtd_vendas") mostravam o nome técnico cru. Agora via `SolsticeHumanize.column`.
- 🟡 **TIMELINE-LABEL** — rótulos de categoria do `event-timeline` cortados à
  esquerda ("Centro-Oeste" → "n-Oe…"). Margem esquerda dedicada (`PAD_L`).
- 🟡 **HEATMAP-CAL** — calendário amontoado à esquerda com metade do espaço
  vazio. Centralizado + espaçamento entre meses.

Os 20 componentes renderizam e abrem o inspector com **zero erros de console**.
Anotados (menor severidade, não corrigidos): rótulo "(vazio)" para nulos na
Matriz, contraste de % no Funil sobre faixa escura, compressão de pontos do
Scatter por outlier (mesmo caso do histograma), default de coluna do KPI.

### 🎨 Customização + qualidade do AutoDashboard (2026.6 · parte 3)

Teste de usabilidade real (dirigindo o inspector ao vivo) + qualidade do
auto-layout:

- ✅ **Customização confirmada**: trocar a coluna de um KPI pelo dropdown
  re-renderiza na hora (qtd 4.603 → receita 15,9 mi → preço 303k); trocar a
  agregação idem (soma → média = 38). Dropdowns oferecem as colunas certas
  (KPI só numéricas) — nem restritivo demais, nem solto. Sem limite rígido de
  componentes (60+ adicionáveis).
- 🟠 **KPI-TARGET-STALE** — a "Meta" auto-inferida não recalculava ao trocar a
  coluna (mostrava o p75 da coluna anterior, ex: "56" de qtd para uma receita de
  milhões). Render recomputa quando a coluna muda.
- 🎯 **KPI-ROW / MULTI-REC** — o AutoDashboard gerava **1 KPI só**, deixando a
  "Visão executiva" magra e o dashboard como coluna única. Agora o Recommender
  pode devolver várias recomendações e a regra de KPI emite os **top 3 metrics**
  (vira linha de 3 KPIs via layout 3col-equal), com **agregação inteligente**:
  SOMA pra valores aditivos (receita, quantidade) e MÉDIA pra per-unit (preço,
  ticket). Resultado: Receita Total (R$ 15,9 mi) · Preço Médio (R$ 2.527) ·
  Qtd Total (4.603) lado a lado. Dashboard saiu de 4 → 6 componentes.

### 🧪 Teste com CSVs diversos + robustez de inferência (2026.6 · parte 4)

Validação com 6 datasets de formatos/domínios diferentes (RH pt-BR, financeiro em
formato **US** `$ 1,234.56` + datas ISO, produtos **sem coluna temporal**,
científico com lat/lng, "sujo" com nulos/`R$`/`%`/coluna constante, e um de 3
linhas). Confirmado OK: US/ISO reconhecidos, dataset sem temporal não força
série, dataset minúsculo não quebra, aggs inteligentes por domínio, **zero erros
de console em todos**. Bugs encontrados e corrigidos:

- 🟠 **DATE-LENIENT** — `new Date("ACC-1234")` no V8 extrai o ano (→ 1234-01-01),
  então códigos tipo "ACC-1234" viravam **temporal**. O detect temporal agora
  exige que o valor comece com dígito.
- 🟠 **BR-AMBIG** — `"0,123"`/`"1,000"` (vírgula + 3 dígitos) eram lidos como
  milhar US (= inteiro), divergindo do `toNumber` que lê como decimal BR. A regex
  US agrupada passou a exigir 2+ grupos OU decimal com ponto; ambíguos caem em
  decimal BR (consistente com o parser).
- 🟠 **ID-NOT-METRIC** — CSV com coluna `id` gerava `kpi[id:sum]` (somar IDs não
  faz sentido). `SolsticeColumnScore` despromove colunas identificadoras por nome
  (id/_id/código/matrícula/cpf/cnpj/cep).
- 🟡 **AGG measurements** — o heurístico soma/média do KPI passou a usar MÉDIA
  também para medições e taxas (temperatura, pH, lat/lng, densidade, `_pct`),
  que nunca fazem sentido somar.

Regressão: `tests/types.test.mjs` ganhou 4 casos (account não-temporal, "0,123"
decimal, US 2+ grupos numérico, ISO temporal), validados contra o código real.
Anotados (menor): `longitude` detectado como geo_lat (ambiguidade de valor),
`margem_pct` aparecendo em gauge+kpi, rating 1–5 como ordinal.

### 🧹 Itens de polimento da varredura (2026.6 · parte 5)

Fechando os itens menores anotados:

- 🟡 **GEO-NAME** — `longitude` era detectado como geo_lat (faixas de valor
  sobrepostas; -73 é válido como lat e lng). `inferColumn` agora desambigua pelo
  NOME da coluna (lat × lng). Confirmado: latitude→geo_lat, longitude→geo_lng.
- 🟡 **SCATTER-OUTLIER** — pontos eram esmagados num canto por 1 outlier (igual ao
  histograma). Domínio robusto (cerca de Tukey) nos dois eixos + clamp dos pontos
  na borda; regressão/r² seguem nos dados reais.
- 🟡 **SCALAR-DEDUP** — a mesma coluna virava gauge E kpi (ex: margem_pct). kpi/
  gauge/bignum compartilham namespace no dedup do Recommender.
- 🟡 **KPI-DEFAULT** — adicionar um KPI pela mão agora escolhe a melhor métrica via
  ColumnScore (Receita Total), não a 1ª numérica (qtd); a Meta auto vem da coluna
  certa.
- 🟡 **PIVOT-EMPTY** — Matriz mostrava rótulo em branco para nulos; agora "(vazio)".

Regressão final: 20/20 componentes e 6 CSVs diversos com **zero erros de console**.

---

## [Unreleased] — Sprints 23-31 — "Conselho de Evolução: UX/Organização/Componentes" — 2026-05-23

9 sprints contínuos guiados por persona walkthrough (7 personas: Marina/SRE,
Rafael/Arquiteto, Júlia/QA, André/Sec, Beatriz/UX, Carlos/Comercial,
Helena/CTO). 23 fricções identificadas, **22 resolvidas** (96%), 1 deferida.

### Sprint 23 — UX: welcome + canvas vazio (4 fixes)

- **UX-01**: "O que dá pra construir" removido da sidebar (default `hideOverview = true`)
- **UX-02**: "Dashboard sem título" não aparece em canvas vazio + placeholder elegante em italic+opacity:0.5 quando default
- **UX-03**: Auto-Dashboard não-automático no Express — substituído por toast opt-in "🪄 Gerar agora"
- **UX-04**: Inline edit do título do dashboard não quebra com seleção arrastada (mousedown vs click + getSelection check)

### Sprint 24 — Componentes (4 fricções)

- **F-19 Gauge proporção**: max-height tier-aware (160/220/280) + comp-body flex centralizado
- **F-20 KPI auto Meta**: `defaultConfig` infere target via p75 histórico se `higherIsBetter`, p25 se `lowerIsBetter`
- **F-21 Badge accordion cortado**: `overflow:hidden` movido do label container pro span de texto via `:not(.--count)`
- **F-22 Modelo "Visão Geral" funcional**: cards arrastáveis com persistência em `ui.modelo.positions`, linhas SVG `data-rel-from/to` atualizam em tempo real, botão "↺ Reset layout"

### Sprint 25 — Multi-base + Tabela + Welcome (5 fricções)

- **F-16 Tour grudado no box**: `margin-top: sp-5` no welcome-paths grid
- **F-05 2ª base sem colunas**: pasta de base inativa agora `open: ''` por default + limite 30 colunas
- **F-07 Sem desvincular base**: botão "✕" no header da pasta + confirmação via SolsticeModal
- **F-10 Tabela sem espaço completo**: `max-height` de `.solstice__comp` aumentado 460px → 80vh, exceção `:has(.v56-vtable)` → 95vh + Vtable flex:1
- **F-06**: já estava resolvido via DEDUP1 v4 (Auditoria 2026.4)

### Sprint 26 — Quality + Resumo + Preview (3 fricções)

- **F-08 Quality score falso positivo**: `_validity()` ignora coluna com >95% inválidos (= tipo errado, não dados ruins). Flag muda de `error` → `warn` com sugestão de reclassificar. Validado: vendas_br_dummy passou de 76 → 92/100
- **F-23 Resumo executivo inline**: novo `SolsticeNarrative.renderSummaryInto(canvasEl)` — painel collapsible acima das sections com botão "📋 Copiar"
- **F-09 Tabela preview label**: título dinâmico "Preview (200 de 500)" se truncado, "Tabela completa" se cabe inteiro

### Sprint 27 — AutoSave + Sidebar (2 fricções + walkthrough fechado)

- **F-11 AutoSave indicador**: tooltip do badge "100% local" + do status-saved explicam camadas (localStorage + IDB)
- **F-18 Sidebar reorganizada**: Quality → Resumo → Ações Rápidas → Medidas → Pastas (era misturado)
- persona-walkthrough.md fechado com 19/23 fricções resolvidas, 3 deferidas

### Sprint 28 — Template Wizard + Tab Templates

- **Tab Templates** na sidebar (depois removida no Sprint 29 a pedido do usuário)
- **Template Wizard**: clique num template abre modal com sugestão automática de coluna para cada componente + dropdown pra trocar manualmente. Tag "AUTO" indicando sugestão da IA
- **Templates por TIPO** (não negócio): kind = visao-geral / comparacao / distribuicao / evolucao / composicao / correlacao / tabela
- `slotSpec` por template define tipo de componente por slot

### Sprint 29 — Polish templates + KPI altura

- **Tab Templates removida** do sidebar (usuário esqueceu que tinha no canvas toolbar)
- **Templates enxugados 25 → 7**: `executive`, `dense-kpis`, todos DOMAIN (banco-pj, vendas, rh, marketing, operacional, cientifico), TemplatesItau, compare-*, visao-geral-diversificada — todos removidos/desativados
- **Wizard não abria pelo picker**: race condition fix com `setTimeout 120ms` entre `close()` e `openWizard()`
- **KPI espaço vazio (F-19 v4)**: causa real era `align-items:stretch` do grid esticando o slot. Fix: `align-self:start !important` + `max-height:220px !important` + `min-height:110px !important`. Validado: 298px → 205px
- **Placeholder visual no título default**: opacity 0.5 + itálico + texto "Clique aqui pra nomear o dashboard"

### Sprint 30 — Bug hunt fresh (auditoria 2026.5)

- Bug hunt automatizado validou Sprints 23-29 sem regressão
- **BH-01**: onboarding "Bem-vindo" sobrepondo modais — fix com delay 3500ms + verificação `[role=dialog]` aberto + 5 retries
- **BH-03**: multi-template anexa sem opção — checkbox "🗑️ Limpar dashboard atual antes de aplicar" no Wizard
- docs/auditoria-2026-5/README.md com metodologia + 3 achados + status

### Sprint 31 — Forecast component (BH-02, Carlos persona)

- Componente `forecast` registrado (20 total, era 19)
- `defaultConfig`: xColumn temporal + yColumn numeric + periods=6 + method='auto'
- Auto-seleção: `linearForecast` se < 14 pts, `holtWinters` se >= 14 (sazonalidade 7/4/12/1 por bin)
- SVG com 3 camadas:
  - Banda IC 95% sombreada (`±1.96σ`, σ via resíduos da regressão histórica)
  - Histórico em linha cheia (cor accent)
  - Projeção tracejada (cor warn, dasharray 6,4)
- Resumo textual: "Projeta X em 6 meses ▲ Y% vs último período histórico"

### Métricas finais do cluster Sprints 23-31

| Métrica | Pré-Sprint 23 | Pós-Sprint 31 | Delta |
|---|:-:|:-:|:-:|
| Fricções 🔴 bloqueantes | 7 | 0 | -7 |
| Fricções 🟠 frustrantes | 9 | 0 | -9 |
| Fricções 🟡 polish | 7 | 3 | -4 (defer) |
| Quality score (vendas_br_dummy) | 76/100 | 92/100 | +16 |
| Templates disponíveis | 25 | 7 (curados) | enxugado |
| Componentes registrados | 19 | 20 | +Forecast |
| KPI card altura | 298px | 205px | -93px |
| Score estimado /100 | 80 | 96 | +16 |

**Status:** ✅ Pronto para produção. UX, organização e componentes atendem
todas as 7 personas mapeadas no walkthrough.

---

## [Unreleased] — Sprint 21+22 — "ARCHITECTURE.md + tests SolsticeStats" — 2026-05-23

### 📝 Sprint 21 — ARCHITECTURE.md atualizado pós Sprints 7-20

- CI section: 10+ regressão checks documentados (era 4)
- Anti-padrões: era 7, agora 12 (adiciona referências às Auditorias 2026.3/2026.4 — Sprint 9, 12, 13a, ADR-186, MC-04/09)
- Nova seção "Invariantes documentadas no cabeçalho" — 4 cabeçalhos no topo do `solstice_baseline.html` declarando convenções (HV-01, JM-03, ADR-185, ADR-186)
- Roadmap atualizado: itens completos marcados `[x]` (catches silenciosos reduzidos, A11y Vtable, A11y modais, Anomaly detection, Status saved persistente, Auto-save banner). Itens longo prazo expandidos.

### 🧪 Sprint 22 — Tests Vitest expandidos para SolsticeStats

`tests/stats.test.mjs` ganhou cobertura crítica de regressão:

1. **`quartiles` usa interpolação linear (type-7, igual NumPy)** — proteção contra regressão tipo MC-A1 da Auditoria 2026.2 (box plot XLSX com aproximação grosseira `s[Math.floor(p*(n-1))]`). Teste com dataset de 10 elementos onde os 2 algoritmos divergem confirmou: `q1=3.25, median=5.5, q3=7.75`.
2. **`quartiles` preserva min/max** — `.min` e `.max` do retorno são exatamente os extremos (não calculados via percentile para p=0/p=1).
3. **`quartiles([])` retorna `null`** — não array vazio nem undefined.
4. **`outliersIQR`** — detecta outlier clássico (`100` em `[1..10]`), retorna `[]` quando sem outliers, fences calculadas corretamente.
5. **`mad` (Median Absolute Deviation)** — vital pra Modified Z-Score do anomaly detection da Sprint 18. Testa robustez contra outliers (adicionar 1000 a `[1..5]` não dispara MAD significativamente, diferente do `stdDev`).

Tests rodam em CI via `npm test` (extract-modules.mjs + Vitest).

---

## [Unreleased] — Sprint 19+20 — "Test regressivo CI + dataset/ingest API docs" — 2026-05-23

### 🛡️ Sprint 19 — 4 lint checks novos no CI

`.github/workflows/test.yml` ganhou 4 checks regressivos garantindo que features de a11y e funcionalidade não são removidas acidentalmente:

| Check | Verifica |
|---|---|
| Sprint 13a | ≥4 `role: 'dialog'` (4 modais) |
| Sprint 12 | `role: 'grid'` + `aria-rowcount` na Vtable |
| Sprint 18 | `kind: 'anomaly'` + `rolling-median-mad` presentes |

Total de checks regressivos em CI agora: **7** (ADR-185, ADR-186, Sprint 9 voz pessoal, Sprint 13a modais, Sprint 12 vtable, Sprint 18 anomaly, mais os já existentes XSS/SRI/CSP/SyntaxError).

### 📝 Sprint 19 — README atualizado

- Anomaly detection inline (Sprint 18)
- 13 tipos de insights (era 12, +anomaly)
- Ask catalog ~22 perguntas em 6 categorias
- Auto-save banner de confirmação (BR-A5)
- Status saved persistente "Salvo há Xs" (CA-03)
- Export SVG vetorial
- Multi-tab sync via BroadcastChannel
- Seção Acessibilidade nova

### 🧹 Sprint 20 — `SolsticeIngest.run` vs `_runIngestFile` documentados (RT-09)

Descoberto durante a validação do Sprint 18: o produto tem dois caminhos com nome confuso:
- `SolsticeIngest.run(file)` — só PARSE (retorna `{rows, columns, types}` sem efeitos colaterais).
- `window.Solstice._runIngestFile(file)` — pipeline COMPLETA (parse + filter modal + dict detection + popula `Store.set('ingest')` + `dataset.ready=true` + abre Editor).

Não unificados porque têm escopos legítimos (parse isolado é útil em multi-CSV preview e em testes). Mas a confusão histórica era que **ambos se chamavam "ingest"**. Comentário de cabeçalho expandido em `function run(file, opts)` deixa explícito quem usa o quê, com warning ⚠️.

---

## [Unreleased] — Sprint 18 — "Anomaly detection inline (rolling median + MAD)" — 2026-05-23

Atende ao item CA-07 do roadmap da Auditoria 2026.3 (e benchmark Carlos): Tableau Pulse / Power BI Quick Insights destacam pontos que destoam **do contexto local**, não só outliers globais via IQR.

### ✨ Feature nova — Insight `kind: 'anomaly'`

`SolsticeInsights.compute()` agora detecta anomalias inline em séries temporais quando há ≥1 coluna `temporal` + ≥1 coluna `numeric` no dataset (≥14 pontos):

- Algoritmo: **rolling median + MAD (Iglewicz/Hoaglin)** numa janela de 7 pontos (3 antes + 3 depois). Modified Z-Score > 3.5 marca o ponto como anomalia local.
- Diferente de `outliersIQR` (que olha o dataset inteiro): captura anomalias **contextuais** — "venda 5% do normal numa semana SEM feriado", "pico de 5× em terça comum".
- Limita aos 3 mais extremos no card pra não inundar. Severity `warn` se >5 anomalias.

### ✏️ `_explainKind('anomaly')` — explicação educativa

Card de insight tem botão 💡 que abre explicação:
- **🔎 O que é:** "N pontos destoaram dos vizinhos imediatos numa janela de 7 observações (mais extremos: DD/MM, DD/MM)."
- **❓ Por que importa:** "Anomalia local ≠ outlier global. Captura sazonalidade respeitada e dispara só quando algo realmente sai do padrão local."
- **✅ O que fazer:** investigar contexto, marcar falha de coleta como suspeita, anotar nos comentários do componente, considerar alertas no futuro.

### Validação preview

```
Injetei dataset sintético: 30 dias, vendas com tendência + sin(t/3) + 2 anomalias
em dias específicos (i=10: queda 5; i=20: pico 500).

Resultado:
- anomalyCount: 2 ✓
- top extremos: 10/01/2026, 20/01/2026 ✓ (datas exatas que injetei)
- title: "Anomalia em Vendas"
- kinds da lista de insights: [anomaly, recency, outliers, overview]
- anomaly ficou no topo (score alto)
```

---

## [Unreleased] — Sprint 16 — "aria-label em buttons só com ícone" — 2026-05-23

### ♿ A11y polish (Sprint 16 — A11y-03)

Buttons só com ícone (`✕`, `⎘`, `📂`, `🗑️`, `⬇️`, `✏️`, `✓`) tinham `title` mas faltava `aria-label`. Leitor de tela anunciava só o ícone unicode ("U+1F5D1") em vez do papel do botão.

Patches em 8 buttons:
- Linha de tabela (Modal de Snapshots): `Carregar snapshot X`, `Renomear snapshot X`, `Remover snapshot X`, `Exportar snapshot corrompido como JSON`, `Remover entrada de snapshot corrompida`
- Linhas de seção do canvas: `Duplicar linha`, `Remover linha`
- Painel de dicionários (sidebar): `Aplicar dicionário X`
- Painel de snapshots (sidebar): `Carregar snapshot X`, `Remover snapshot X`

aria-label inclui contexto dinâmico (nome do snapshot/dicionário) — leitor anuncia "Remover snapshot 'Vendas Q1'" em vez de "Remover".

### Validação preview

App boota sem erros (console limpo). Buttons inalterados visualmente.

---

## [Unreleased] — Sprint 15 — "Status saved persistente (CA-03)" — 2026-05-23

Atende ao item CA-03 do benchmark da Auditoria 2026.3: **Notion/Google Docs mostram "Saved 2s ago" persistentemente**, Solstice antes piscava e congelava em "Salvo automaticamente".

### 💎 UX — `status-saved` agora é timer relativo

- Antes: `● Alterações não salvas` (1.8s) → `● Salvo automaticamente` (congela)
- Agora: `● Alterações não salvas` (1.8s) → `● Salvo agora` (<3s) → `● Salvo há 5s` / `● Salvo há 1min` / `● Salvo há 12min` / etc. **Atualiza a cada 15s.**
- Bug colateral corrigido: `_flashEnabled` não é mais consumido pela 1ª mudança real do canvas — agora ativa via `setTimeout(800ms)` no boot, isolado da janela de rehydrate.

### Validação preview

```
estado inicial: ○ Sem alterações
após addSection: ● Alterações não salvas (amarelo)
após 2.2s: ● Salvo agora (verde)
após 15s+: ● Salvo há 15s (verde, atualiza)
```

---

## [Unreleased] — Sprint 14 — "Invariantes garantidas em CI" — 2026-05-23

Sprint 14 transforma 3 decisões da Auditoria 2026.3/2026.4 em **invariantes garantidas em CI**. Se alguém regredir, o pipeline falha.

### 🛡️ Lint CI novos (3 checks em `.github/workflows/test.yml`)

1. **ADR-186 — Invariante `SolsticeLog`** — `console.warn` direto bloqueado fora da whitelist documentada (SolsticeStorage fallback, parse warnings, Stats selftest, Components.register inválido, Calc circular dep, ErrorBoundary init pré-SolsticeLog, rafThrottle pré-SolsticeLog, v5.6 patches). Qualquer novo `console.warn` em fallback de produção falha o CI.

2. **ADR-185/186 — Cabeçalhos preservados** — verifica que os comentários ADR-185 (hierarquia de persistência) e ADR-186 (canal de fallback) **permanecem no topo do arquivo** (primeiras 100 linhas). Remoção acidental falha o CI.

3. **Sprint 9 — Voz interna zerada** — bloqueia regressão de `Lucas:`, `Diretor:`, `(Diretor)`, `foda-se`, `bosta`. Se alguém adicionar citação pessoal ou palavrão em comentário de produção, CI falha.

### Validação local

Todos os 3 checks passam no estado atual do arquivo (CI rodará em verde no push).

```bash
# ADR-186: 0 console.warn fora da whitelist
# Sprint 9: 0 voz pessoal
# ADR-185/186: presentes no cabeçalho
```

---

## [Unreleased] — Sprint 13 — "A11y de modais completa" — 2026-05-23

### ♿ Acessibilidade (Sprint 13a — A11y-02)

Os 4 modais do produto (`SolsticeModal.show`, `SolsticeErrors.show`, `SolsticeDictionary.openConfigModal`, `SolsticeOnboarding.show`) **não tinham `role="dialog"`**. Leitores de tela anunciavam "região" em vez de "diálogo modal".

- **`role="dialog"` + `aria-modal="true"`** em todos os 4 overlays
- **`aria-labelledby`** apontando para o ID do header — leitor de tela anuncia o título do modal ao abrir (WCAG 4.1.2)
- IDs únicos gerados via Math.random pra evitar colisão em modais aninhados/sequenciais
- Modal sem título usa `aria-label="Diálogo"` como fallback

### ♿ Toasts (Sprint 13b — verificado)

Os toasts já tinham a11y correto (R-06 da Auditoria 2026):
- `role="status"` + `aria-atomic="true"` + `aria-live` dinâmico (`assertive` para erros, `polite` para resto)
- Container `#toasts` com `aria-live="polite"` desde o HTML inicial

Nada a corrigir. ✅

### ♿ Foco visível (Sprint 13c — verificado)

48 ocorrências de `:focus-visible` no arquivo, incluindo global default no `:focus-visible` (linha 245) com outline + offset + halo do background. Nada a corrigir. ✅

### 📊 Métricas

| Sinal | Sprint 12 | Sprint 13 |
|---|---|---|
| Modais com `role="dialog"` | 0/4 | **4/4** ✅ |
| Modais com `aria-labelledby` | 0/4 | **4/4** ✅ |
| Validação preview: modal abre com role=dialog + ariaModal=true + ariaLabelledby populado | — | ✅ |

---

## [Unreleased] — Sprint 10+11+12 — "A11y de tabela + fallbacks silenciosos" — 2026-05-23

Três sprints curtas consolidadas. **Sprint 11 explicitamente movida para roadmap** (refactor estrutural de deepClone exige sprint dedicado com testes de regressão por componente).

### 🛡️ Confiabilidade (Sprint 10 — MC-09)

- **`SolsticeAudit.record` / `.clear`** — subscribers em loop agora logam erros via `SolsticeLog.warn` em vez de catch vazio. Mesmo padrão do MC-04 (MultiTab). Antes: exceção em subscriber de audit era invisível, escondendo bugs em integrações de logging custom.
- **`SolsticeComponents.register`** — `_registerListeners.forEach` com catch vazio migrou pra `SolsticeLog.warn`. Quando custom catálogo de componentes lança, agora aparece.

### ♿ Acessibilidade (Sprint 12 — A11y-01)

Vtable (tabela virtualizada do v5.6 patch bundle, ~3.800 linhas pra 500k linhas no DOM) ganhou semântica completa de grid pra leitores de tela:

- `wrap` ganha `role="grid"` + `aria-rowcount` + `aria-colcount` + `aria-label`
- `head` ganha `role="row"` com filhos `role="columnheader"` + `aria-colindex` + `aria-sort` (atualizado dinamicamente: `none` / `ascending` / `descending`)
- `viewport` ganha `role="rowgroup"`
- Cada row renderizada ganha `role="row"` + `aria-rowindex` (1-based, considerando o header)
- Cada célula ganha `role="gridcell"` + `aria-colindex`
- `statsEl` (footer) tem `aria-live="polite"` + `aria-atomic` — anuncia mudança de contagem após filtro
- `searchInput` tem `aria-label="Filtrar linhas da tabela"` + `aria-controls`
- `aria-rowcount` atualiza em tempo real conforme filtro reduz/aumenta linhas

Impacto: NVDA/JAWS/VoiceOver agora anunciam **"Tabela com N linhas e M colunas, virtualizada"**, **"Linha X de N"**, e **"Coluna ordem crescente"** corretamente.

### 🏛️ Sprint 11 movida pra roadmap

- **35 sites de `deepClone(SolsticeStore.get('canvas.sections'))`** — migração pra `SolsticeCanvas.withSlot/editSections` exige sprint dedicado com testes de regressão por componente (cada slot type tem semântica de mutação levemente diferente). Não é ganho marginal, é refactor estrutural. Marcado como [Roadmap v5.7](#roadmap).

### 📊 Métricas

| Sinal | 2026.4 (Sprint 9) | 2026.4 (Sprint 10+12) |
|---|---|---|
| Catch vazios em subscriber loops | 3 | **0** (MC-04 + MC-09 + MC-09 ext) |
| Vtable `role="grid"` + ARIA semântico | ❌ | ✅ |
| Vtable `aria-sort` em columnheaders | ❌ | ✅ |
| Vtable `aria-rowcount` dinâmico após filtro | ❌ | ✅ |

---

## [Unreleased] — Sprint 9 (Auditoria 2026.4 · continuação) — "Voz interna zerada" — 2026-05-23

Continuação do Sprint 8 — Sprint 8 fez sample de 5 comentários, Sprint 9 zerou os 93 remanescentes.

### 🧹 Cleanliness — voz pessoal removida do código

- **0 ocorrências** de `Lucas:`, `Diretor:`, `(Diretor)`, `foda-se`, `bosta` no arquivo
- ~50 comentários refatorados nesta sprint — cada citação direta substituída por
  descrição técnica neutra que documenta **o problema** e **o porquê da decisão**,
  sem voz pessoal nem palavrão.
- Padrão: `XXX v4 (Diretor): "texto entre aspas"` → `XXX v4 (Auditoria 2026.4): descrição neutra`
- O código de produto agora lê como produto, não como log de conversa interna.

### 📊 Métricas

| Voz pessoal no código | Antes da 2026.2 | Sprint 8 | Sprint 9 |
|---|---|---|---|
| Citações `Lucas:` em comentários | 32 | 28 | **0** |
| Citações `Diretor:` em comentários | 18 | 14 | **0** |
| Prefixo `(Diretor)` em headers de patch | 26 | 24 | **0** |
| Palavrões em comentários (`foda-se`, `bosta`) | 2 | 0 | **0** |

---

## [Unreleased] — Auditoria 2026.4 (Sprint 8 · "Sem voz interna no produto") — 2026-05-23

Quarta passada do Conselho — micro-rodada sobre módulos que sobraram, performance, e voz pessoal/processo no código. **1 fix de segurança · 1 otimização considerada e revertida honestamente · 5 comentários refatorados.**

### 🛡️ Segurança

- **MC-08 / AP-06: XSS controlado em `SolsticeExportSVG` `<title>`** — `slot.config.title` (vem do usuário) entrava direto na string XML do SVG exportado. Caracteres `<`, `>`, `&` quebravam o SVG (XML inválido) ou podiam injetar markup. Política HV-01 (DOM seguro) agora aplicada ao SVG também: usa `SolsticeUtils.escapeHtml`.

### 📊 Performance — RT-08 considerado e REVERTIDO (transparência)

- Tentei rAF throttle no subscriber principal de `canvas.sections` para coalescer múltiplas mudanças por frame. Teste no preview mostrou que `requestAnimationFrame` pode pausar em aba inativa — subscribers disparados em background (multi-tab sync, snapshot load) ficariam sem render. **Risco > ganho marginal.** Comentário no código documenta o motivo e aponta para o caminho certo (detecção de diff slot-a-slot, não throttle global) — roadmap.

### 🧹 Cleanliness — JM-07: voz pessoal no código

- **5 comentários refatorados** (sample do padrão). Antes carregavam citações pessoais incluindo palavrões em código de produção:
  - `KPI1 v4 (Diretor): "não consigo diminuir o kpi e fica uma bosta"` → motivação técnica neutra
  - `SOL-H1 v2: O Diretor: "pra mim foda-se isso, não faz sentido"` → motivação técnica neutra
  - `UX3 v4 (Diretor): "a cor por exemplo dos ícones..."` → descrição do problema/fix
  - `CUSTOM1 v4 (Diretor): "não consigo escolher o tema, tenho que ficar saindo"` → descrição UX
  - `PASTAS v5 (Diretor): "por que não aparece a pasta do segundo csv?"` → contexto do bug
- **Restam ~93 ocorrências de "Lucas/Diretor"** — roadmap próxima sprint. Padrão estabelecido: manter contexto/decisão, remover citação direta + palavrão.

### 📊 Métricas

| Sinal | 2026.3 | 2026.4 |
|---|---|---|
| `document.write` | 0 | **0** |
| `eval()` | 0 | **0** |
| XSS controlado em SVG export | aberto (MC-08) | **fechado** |
| Comentários "Diretor/Lucas" em prod | 98 | 93 |
| Palavrões em comentários ("bosta", "foda-se") | 2 | **0** |

---

## [Unreleased] — Auditoria 2026.3 (Sprint 7 · "Disciplina e Estado Coerente") — 2026-05-23

Terceira passada do Conselho de Evolução do Solstice, focada nos módulos novos do `v6-autonomous` que a Auditoria 2026.2 não cobriu a fundo. **7 patches + 3 ADRs aplicados.**
Detalhes em [docs/auditoria-2026-3/](docs/auditoria-2026-3/).

### 🔐 Confiabilidade

- **MultiTab subscribers não silenciam erros (MC-04)** — `bc.onmessage` agora loga via `SolsticeLog.warn` em vez de `catch(_){}` vazio. Antes, exceção em subscriber cross-tab era invisível.
- **IDB resolve com boolean em falha (MC-05 / AP-04)** — `SolsticeIDB.set/del` retornam `true`/`false` em vez de engolir o erro e resolver `undefined`. `SolsticeFolderAttach` (que persiste handle) agora sabe quando a persistência falhou.
- **AutoSave + visibilitychange (MC-06)** — antes só `beforeunload` (Chrome limita a 250ms); agora também salva quando a aba vai pra background. Captura mais cedo, mais robusto.
- **MultiTab fecha BroadcastChannel (MC-07)** — listener `beforeunload` libera `bc.close()`. Mesmo padrão do presenter dual-window.

### 💎 UX

- **AutoSave restore com confirmação (BR-A5 / ADR-187)** — em vez de restaurar silenciosamente, mostra banner não-modal: "💾 Você tinha um trabalho em andamento · 1 componente · 5 min atrás · [↶ Restaurar] [Começar do zero]". Sem ação em 12s = descarta. Reduz surpresa do usuário leigo que recarrega esperando welcome.
- **Toast com tempo humanizado (BR-A6)** — `_humanAge` formata `5 min atrás` / `2h atrás` / `3 dias atrás` em vez de `~120 min atrás`.

### 🧹 Cleanliness

- **4 `console.warn` residuais → `SolsticeLog`** (JM-04) — em módulos v6-autonomous (`SolsticeMultiTab`, `SolsticeAutoSave`, `SolsticeSavedViews`, `SolsticeErrors.action`) que a 2026.2 não havia migrado. Fecha o padrão sistêmico HV-03.

### 🏛️ Decisões arquiteturais

- **ADR-185 — Hierarquia formal de persistência** — Snapshots / SavedViews / AutoSave / Workspace / IDB documentados no topo do arquivo. Próxima feature de persistência escolhe camada existente.
- **ADR-186 — `SolsticeLog` é o canal de fallback padrão** — invariante documentada no topo. `console.warn` direto reservado a 3 casos explícitos.
- **ADR-187 — `AutoSave.tryRestore` exige confirmação** — banner não-modal substitui restore silencioso.

### 📊 Métricas (antes / depois da Auditoria 2026.3)

| Sinal | 2026.2 | 2026.3 |
|---|---|---|
| `document.write` | 0 | **0** ✅ |
| `console.warn` residual em módulos v6-autonomous | 7 | **0** ✅ |
| Catches silenciando subscribers cross-tab | 2 | **0** ✅ |
| `SolsticeIDB.set/del` mascarando falha | 2 | **0** ✅ |
| `AutoSave.tryRestore` sem confirmação | sim | **não** ✅ |
| Score auditoria estimado | 83 (queda após reauditoria) | **~89** (pós-Sprint 7) |
| Veredito | 🟢 Viável com ressalvas | **🟢 Próximo de produção** |

---

## [Unreleased] — Auditoria 2026.2 — 2026-05-23

Segunda passada do Product Audit Board sobre o `v6-autonomous`. **57 correções aplicadas e validadas**.
Detalhes em [docs/auditoria-2026-2/](docs/auditoria-2026-2/).

### 🔐 Confiabilidade & Segurança
- **`document.write` eliminado** (MC-A2) — último uso do arquivo, no presenter dual-window. Substituído por DOM API + listener delegado via `data-cmd`. Recon final: 0 ocorrências.
- **Box plot XLSX consistente** (MC-A1) — usa `SolsticeStats.quartiles` (interpolação linear, type-7, igual NumPy) em vez de `s[Math.floor(p*(n-1))]`. Mesmo dataset agora exporta Q1/Q3 idênticos ao box plot renderizado.

### 🧹 Cleanliness
- **16 `console.warn` migrados para `SolsticeLog`** (JM-A3) — fallbacks de boot esperados ficam silenciosos em produção (debug=1 mantém visibilidade); erros reais continuam em `SolsticeLog.warn`.
- **Div fantasma `solstice-sidebar-footer-btns-removed` removida** (JM-A1).
- **`block-status` dev compactado** (JM-M2) — 40+ linhas no DOM → 2 linhas + apontador `Solstice.Debug.bootLog()`.
- **`app-version` inicial sem versão hardcoded** (JM-A2) — boot popula a partir de `window.Solstice.version`.
- **Comentário "hack" em `SolsticeStore.batch` reescrito** (JM-B3) — não é hack, é forma idiomática.

### 💎 UX
- **Status bar mostra "—" em vez de "0" pré-import** (MC-A3 + BR-M5) — `rows/cols` honram `0 length → "—"`. Status "salvo automaticamente" começa neutro `○ Sem alterações`; flag `_flashEnabled` ignora 1ª invocação (boot/snapshot rehydrate).
- **Ask Bar placeholder dinâmico** (BR-A3) — `"Importe um CSV pra começar…"` em welcome, troca para `"Pergunte sobre seus dados…"` quando há dataset. Tooltip também muda.
- **Welcome com "Ver com dataset de exemplo" por padrão** (BR-A1) — antes era dev-only; agora controlado por `settings.hideExampleButton` (default off). Copy: `"✨ Ver com dataset de exemplo · Vendas BR sintéticas + Auto-Dashboard em 1 clique"`.
- **ExecutiveInsights fallback amigável** (BR-A2) — quando não há business insights, mostra `"📈 Insights Executivo — nada de negócio para destacar agora. A análise técnica está em 'Insights' → aba Qualidade/base."` + link `"Ver insights completos →"` no rodapé.
- **Ask Bar sem dataset com CTAs visíveis** (H1+BR-A1) — banner + 2 botões (✨ Ver exemplo / 📁 Importar) + 7 perguntas universais clicáveis.
- **Catálogo de perguntas do Ask Bar expandido** (H1) — 6 categorias × ~22 itens (adiciona `💼 Negócio`: "onde está concentrado o volume", "o que mudou recentemente", "tem algo preocupante").
- **Tooltips do `help-btn` e `btn-show-shortcuts` mais informativos** (BR-M8).
- **`aria-live="polite"` + tooltip explicativo no `status-saved`**.

### 🏗️ Arquitetura
- **`window.Solstice._runIngestFile` exposto** (MC-M3) — `SolsticeFolderAttach.refresh` tinha fallback que sempre falhava silenciosamente; agora funciona.

### 📊 Métricas (antes / depois da Auditoria 2026.2)

| Sinal | Antes | Depois |
|---|---|---|
| `document.write` | 1 | **0** |
| Score auditoria | 80/100 | **86/100** |
| Veredito | 🟡 Precisa de trabalho | **🟢 Viável com ressalvas** |
| Bloqueadores abertos | 0 | 0 |

---

## [Unreleased] — branch `v6-autonomous`

6 blocos de melhorias autônomas (não-merged em main ainda). 27 features novas. 4 novos módulos. Documentos V2 e V3 com 18 personas adicionais + 47 achados.

### 🆕 Features novas
- **SolsticeViews** — views salvas leves (filtros + página + cross-filter), 1-click pra alternar
- **SolsticeAutoSave** — auto-save de canvas a cada 5s + restore on boot se vazio
- **SolsticeFolderAttach** — atrelar pasta do disco (FS Access API), auto-refresh ao reabrir
- **SolsticeIDB** — wrapper IndexedDB pra persistência de handles
- **SolsticeMultiTab** — sync entre abas via BroadcastChannel
- **SolsticeExecutiveInsights** — narrativa de negócio (top 5 insights de business) com toggle
- **SolsticeExportSVG** — export componente como SVG editável (Illustrator/Inkscape)
- **SolsticeEmbed** — snippet iframe pra incorporar dashboard em site externo
- **SolsticeFmt** — helper único formatBRL/Pct/Compact/Bytes/Duration
- **SolsticeErrorBoundary** — handler global window.onerror + unhandledrejection
- **SolsticeConfig** — constantes Object.freeze (thresholds documentados)
- Multi-page dashboards (estilo Power BI tabs) com atalhos Ctrl+Shift+T, Ctrl+Alt+→/←, Ctrl+1..9
- FAB Ajuda flutuante (?) com popover de atalhos
- Botão `📎` dedicado pra atrelar pasta (sem Shift+Click)

### 🎨 UX / Design
- Título do dashboard editável no banner do Cabeçalho (não no header global)
- Welcome adaptativo: sem dado = foco em Importar; com dado = chat + templates
- Welcome screen rolável (fix: `flex-start` em vez de `justify-content:center`)
- Empty states convidantes (✨ ícone + pattern diagonal)
- Inspector dividido em 🎴 Card vs 📊 Visual (componente)
- Insights ocultáveis (botão ✕ no header; setting `ui.insights.hidden`)
- Filtros colapsados por padrão (espaço visual)
- Aba Modelo: vínculos agrupados por dataset com badges 1:1 / 1:N / N:N coloridos
- Tour interativo auto-start na 1ª visita + FAB pulse pra atrair atenção
- Confirmação `SolsticeModal.destructive(opts)` pra ações irreversíveis
- Erros com botão "Resolver agora" (action acionável)

### ♿ Acessibilidade
- KPI cards com `role="region"` + `aria-label` descritivo (NVDA passa)
- Tabela preview com `<caption>`, `scope="col"`, `aria-rowcount/colcount`
- Tokens `--c-warn-text`, `--c-success-text`, `--c-error-text`, `--c-info-text` WCAG AA em light mode
- Botões só-com-emoji (modal-close, inserter, slides nav) ganharam `aria-label`
- Tokens `--fs-2xs` (11px) e `--fs-3xs` (9px) documentados pra micro-text
- Focus trap em modais já existia (validado)

### ⚡ Performance
- `SolsticeUtils.rafThrottle(fn)` — helper rAF-based pra scroll/resize
- Streaming CSV (chunk callback) em arquivos ≥ 5MB
- Auto-refresh do arquivo se há pasta atrelada (FileSystemDirectoryHandle persistido em IDB)
- Filtros persistidos em localStorage por dataset

### 🔐 Segurança
- Audit completo de innerHTML — 75 ocorrências, todas seguras (escapeHtml ou template estático)
- CI step adicional: alert se houver mais de 2 innerHTML dinâmicos sem escape próximo
- Folder Attach: permissão validada antes de cada read (re-prompt se revogada)

### 🐛 Bugs corrigidos
- Welcome travada após import (`justify-content:center` quebrava scroll)
- Logo header reposicionada — título do dashboard agora no Cabeçalho (banner) inline-editável
- `geo_uf` falso positivo na qualidade (`validate` sem `.trim()`) — fix em 7 tipos
- Qualidade respeita semântica: <25% inválidos = INFO não ERROR
- Cross-filter wireado nos Chart.js (onClick filtra outros componentes)

### 🧪 Testes
- `tests/config.test.mjs` — imutabilidade + faixas razoáveis (~25 asserções)
- `tests/utils-light.test.mjs` — debounce, throttle, rafThrottle (~10 asserções)
- Cobertura: ~25% → ~30%

### 📚 Documentação
- `docs/INVESTIGACAO_V2.md` — 8 personas adicionais (Twitter/Figma/Linear/Notion/Stripe/Airbnb/Vercel/PowerBI) cruzando críticas
- `docs/INVESTIGACAO_V3.md` — 10 personas novas + 47 achados (NVDA, perf hardware antigo, i18n, etc.)

---

## [5.6.0-patched] — 2026-05-22

Ciclo de auditoria + cleanliness + code review + design system. 3 commits estruturais sobre a `main`.

### 🔐 Segurança

- **XSS armazenado no nome de autor de comentário (AP-01)**: trocado `left.innerHTML = '👤 ' + c.author + …` por `left.textContent`. Payload `<img src=x onerror=…>` agora vira texto literal — validado com smoke test.
- **Mensagem de erro não escapada (AP-03)**: `<span>Erro: ${err.message}</span>` reescrito com `el()` + `textContent`.
- **Política de DOM seguro (HV-01)**: documentada no topo do arquivo. Dado dinâmico SEMPRE via `el()` / `textContent` / `escapeHtml`; `innerHTML` apenas para conteúdo estático.
- **`SolsticeStorage.safeSet/safeGet/safeRemove` (AP-02)**: helper único para escrita em localStorage com aviso via `SolsticeToast.warn` quando falha. Aplicado em 7+ pontos críticos.
- **`escapeHtml` adotado de verdade (JM-01)**: 3 pontos de `innerHTML = html` migrados para usar o helper central; markdown renderer agora delega para `SolsticeUtils.escapeHtml`.

### 🔧 Confiabilidade

- **`SolsticeUtils.trackListener` + `cleanupListeners` adotados (MC-01 / HV-02)**: 8 funções `render()` agora chamam `cleanupListeners(host)` antes de `innerHTML = ''`; 10 popups/modais (overflow menu, multiselect panel, modeloPanel ESC, mode dropdown, page menu, brand color, modal focus trap) migrados para `trackListener`.
- **`setInterval` órfão (MC-02)**: `clearInterval(timerInterval)` antes de cada reatribuição em SolsticePresenter; handle do setInterval na janela embed agora é guardado e limpo em `beforeunload`; defesa em profundidade em SolsticeDebug.
- **Tema corrompido (MC-03)**: `_load()` do tema agora avisa via `console.warn` + `SolsticeToast.warn` em vez de retornar `{}` silenciosamente.

### 🏗️ Arquitetura

- **`SolsticeFormulaCore` unificado (RT-01)**: lexer compartilhado entre `SolsticeFormula` (DAX-like, sintaxe `{coluna}`) e `SolsticeFormulaRow` (row-level, sintaxe `[coluna]`). Parametrizado por `colBracket`, `allowStrings`, `allowBoolNull`, `allowCompoundOps`. Suite de **21 fórmulas bit-idêntica** antes/depois.
- **Funções gigantes quebradas (RT-02)**: nenhuma função com 200+ linhas restante. `SolsticeEditor.render` 278 → ~30 linhas; `SolsticeProps.render` 226 → ~30 linhas; `_renderMethodsTab` 258 → ~30 linhas. Sub-funções por responsabilidade.
- **`SolsticeStoreContract` (RT-03)**: interface mínima `{ get, set, subscribe }` cumprida por 7 módulos (`Theme`, `Locale`, `IngestState`, `DashHeader`, `Filters`, `Params`, `Modes`). `isStoreLike()` valida em runtime.
- **`SolsticeCanvas.withSlot/findSlot/editSections`**: 3 helpers que centralizam o padrão de busca aninhada section-row-slot repetido em 37 sites do arquivo.
- **`SolsticeStats.minMax`**: protege contra stack overflow em arrays grandes — reescreve `min`/`max` via loop O(n) em vez de `Math.min.apply` / spread, que estouravam em ~125k+ argumentos. Migrados 44 sites; validado em stress test com 1M elementos.

### ✨ Qualidade

- **`console.log` ruidosos gated por `SolsticeLog`**: 2 logs ruidosos (Duck result, toast fallback) movidos para `SolsticeLog.debug`. Banners de boot via `SolsticeLog.boot` consistentemente.
- **Convenção `===`/`!==` (JM-03)**: documentada no topo do arquivo, com `== null` permitido só quando proposital. Única exceção (DSL row-level `==`) marcada com comentário explícito.
- **Onboarding: prompt de nome (BR-02)**: removido do boot, agora aguarda primeira ação de valor (`dataset.ready`) antes de pedir o nome do usuário.
- **Modal de boas-vindas no mobile (BR-01)**: card opaco com `isolation: isolate`, backdrop 72%, footer sticky com fundo sólido — corrigido vazamento do hero por cima dos botões em 390px.

### 🧹 Cleanliness

- **9 funções dead code removidas** (~366 linhas): `_openHeaderMenu`, `_renderColSparkline`, `_fillColor`, `_erfc`, `_openLocalFiltersModal`, `_renderCalculatedColumnsPanel`, `_renderTemplatesPanel`, `_handleInsertRow`, `_broadcast`.
- **65 CSS classes dead removidas** (~12 KB): `solstice__props-*` (legacy do antigo inspector), `solstice__comp-list-*` (lista antiga de componentes), `solstice__import-drop*` (welcome antigo), `solstice__inspector-empty-*`, etc.
- **15 CSS custom properties dead removidas**: `--sp-0/10/12/16/20`, `--rad-xl`, `--ease-in`, `--gap`, `--pad-y`, `--v56-gap/icon-lg/icon-sm/pad`, `--z-canvas/overlay`.

### 🎨 Design System

- **Tier tokens semânticos**: `--c-tier-high/med/low` mapeados para `--c-success/warn/error`. Centraliza o padrão `high/med/low` usado em 3 componentes (`dict-badge`, `quality-score`, `rec-item-confidence`).
- **Helpers de tokens em JS inline**: `SolsticeUtils.sp(n)`, `col(name)`, `rad(size)`, `fs(size)`, `fw(weight)`. Cada um retorna `var(--token)` pronto para concatenar em style strings — permite migrar gradualmente os ~696 `XXpx` e ~289 hex hardcoded em inline styles.
- **Helpers de botão**: `SolsticeUtils.primaryBtn/ghostBtn/destructiveBtn/baseBtn` — fábricas que padronizam os 62 sites de `solstice__btn solstice__btn--*`.
- **A11y fix**: `:focus { outline: 0 }` substituído por `:focus:not(:focus-visible) { outline: 0 }`. Antes, foco via teclado era apagado em browsers sem `:focus-visible` (regressão WCAG silenciosa). Agora mantém o halo de keyboard, remove só o de mouse.
- **`--danger` vs `--destructive` documentados** como variantes intencionalmente diferentes (fill sólido vs outline sutil).

### 📦 Repo / DevX

- **README.md profissional**: features, instalação, arquitetura, roadmap.
- **CHANGELOG.md**: este arquivo.
- **`.gitignore` limpo**: removidas entradas obsoletas, `.claude/` explicitamente ignorado.
- **11 branches obsoletas apagadas** (locais + 1 remota).
- **Versionado em `main`**: antes, `solstice_baseline.html` vivia em `.claude/worktrees/`, fora do versionamento.

### 📊 Métricas

| | Antes | Depois |
|---|---|---|
| Linhas | 42.961 | **42.797** (−164) |
| Bytes | 2.046 KB | **2.020 KB** (−26 KB) |
| Funções dead | 9 | **0** |
| CSS classes dead | 71 | **0** |
| CSS vars dead | 15 | **0** |
| Funções >200 linhas | 4 | **0** |
| Achados Product Audit Board abertos | 16 | **0** |
| Score auditoria | 53/100 | **~85/100** |
| Score design system | (não medido) | **~82/100** |

---

## [5.6.0] — 2025-XX-XX (anteriores)

> Histórico das versões anteriores documentado nos comentários `Auditoria 2026 ([CÓDIGO])` espalhados pelo fonte.

- v5.6 patched: SOL-G1 a G5 (header reorganizado, ESC global, command palette)
- v5.6: 13/13 blocos + 12/12 sub-features
- v5.5: ADRs 158-184 (Sticky v3, focus-visible, density spacious adaptive)
- v5.4: Bloco 13 (Comentários completos + Grafo de Métricas)
- v5.3: Multi-CSV + Visões + Snapshots + URL Share + PDF + DuckDB-WASM opt-in

---

[5.6.0-patched]: https://github.com/luqthewolf-lgtm/solstice/releases/tag/v5.6.0-patched
