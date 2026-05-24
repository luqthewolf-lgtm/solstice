# Auditoria 2026.6 — Relatório Antes / Depois

> Metodologia: o app foi **dirigido de verdade** (Chrome via Playwright/Python)
> sobre um CSV de vendas pt-BR realista — `vendas_br.csv`, 120 linhas, números no
> formato `1.234,56`, datas `dd/mm/aaaa`, valores nulos e 1 outlier proposital.
> Os valores "ANTES" foram capturados fazendo `git stash` das correções (código
> no estado da Sprint 45); o "DEPOIS" com as correções aplicadas. Mesmo dataset,
> mesma jornada, mesmos cliques.

---

## Quadro-resumo (medido, não estimado)

| O que o cliente vê | ANTES (Sprint 45) | DEPOIS (2026.6) |
|---|---|---|
| Tipo de `qtd_vendas` (contagem 1–80) | **moeda** 💰 | **inteiro** ✓ |
| Tipo de `preco_unitario` (`"714,80"`) | **dimensão** (texto) | **decimal** ✓ |
| Tipo de `receita_total` (`"20.729,20"`) | **dimensão** (texto) | **decimal** ✓ |
| Dicionário detectado | **"Banco PJ — Atendimento, Carteira e Risco" · 44%** | **Genérico neutro** (nomes corretos) |
| KPI-título do dashboard automático | **R$ 4.603** (quantidade, ainda rotulada como moeda) | **R$ 15.887.876** (receita) |
| Ask: *"outliers em receita_total"* | *"Não entendi totalmente…"* | **"Detectados 2 outliers (1,7% do total)"** |
| Histograma de receita | 2 barras num eixo vazio (1 outlier estoura a escala) | distribuição legível, outlier agrupado na borda |

---

## Por que cada coisa estava errada

### 1. Números brasileiros viravam texto (BR-NUM) — 🔴 crítico
As regexes de detecção numérica (`DECIMAL`/`INTEGER`/`CURRENCY`) não toleravam o
agrupador de milhar com ponto, então `"20.729,20"` falhava em todas e a coluna
caía em `dimension`. Consequência em cascata: as colunas de **dinheiro ficavam
não-agregáveis** — não entravam em KPI, gráfico, insight nem no Ask. A `CURRENCY`
ainda casava com inteiro puro (`"29"`) e vinha antes de `integer`, então a
**contagem** virava "moeda".

### 2. Domínio errado empurrado (DICT-CONF) — 🟠
Um CSV claramente de vendas era rotulado como "Banco PJ" com **44% de confiança**
(cobria só 3 de 9 colunas) e o modal sugeria nomes bancários: `data` → "Data do
Atendimento", `categoria_produto` → "Segmento". A constante `DICT_DETECT_MIN_CONF`
existia mas **nunca era usada**.

### 3. Ask/insights diziam "undefined outliers (NaN%)" (OUTLIER-SHAPE) — 🔴
`SolsticeStats.outliersIQR()` retorna `{ indices, values, fences }`, mas **6 lugares**
liam `.length` direto no objeto. (Esse bug só ficava *visível* depois do fix #1,
porque antes `receita_total` nem era reconhecida como métrica e o Ask respondia
"não entendi".)

### 4. Histograma morto por um único outlier (HIST-OUTLIER) — 🟠
O binning usava o range min–max cru: 1 outlier amontoava ~99% dos registros em
1–2 barras.

### 5. KPI-título preferia contagem a receita (METRIC-RANK) — 🟢
O ranking de colunas escolhia a **primeira** coluna numérica (vencia por posição),
então o headline de um dashboard de vendas era a soma de `qtd_vendas`.

---

## O que foi feito

| Fix | Arquivo / local | Natureza |
|---|---|---|
| BR-NUM | `SolsticeTypes` (~12278) | Detecção numérica ciente de formato BR/US agrupado; currency exige símbolo; geo_lat/lng rejeitam vírgula |
| OUTLIER-SHAPE | 6 call sites de `outliersIQR` | Passaram a ler `.indices.length` |
| DICT-CONF | `SolsticeConfig` + `SolsticeDictionary.detect` | `DICT_DETECT_MIN_CONF` ligado e elevado 0.40 → 0.55 |
| HIST-OUTLIER | `SolsticeComponents` (distribution) | Janela de binning robusta (cerca de Tukey) + overflow nas bordas |
| METRIC-RANK | `SolsticeColumnScore` | Bônus pra métricas de valor (receita/faturamento/…); contagens excluídas |

**Regressão:** `tests/types.test.mjs` (8 casos) + extração de `SolsticeTypes` no
harness. App valida: 106 módulos, boot OK, dashboard com 5 seções, **zero erros
de console**.

---

## Verificado e OK (sem regressão)
Filtros (`regiao=Sudeste` → 27 linhas corretas; `uf=SP` → 7), Settings, Sankey
(labels íntegros), componentes renderizam.

## Anotado, não corrigido (severidade menor / fora do escopo)
- Ask: *"receita total por região"* responde com tendência em vez de ranking — falha de detecção de intenção NL.
- Export PDF usa `window.print()` (limitação, não bug).
- 404 do favicon no boot (cosmético, pré-existente).
