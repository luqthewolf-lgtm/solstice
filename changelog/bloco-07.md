# Changelog — Bloco 7

**Entregue em:** 2026-05-18 · Sessão 2
**Versão:** `5.3.0-bloco7`
**Tamanho:** ~10.250 linhas (~265 KB)

---

## 🎯 Objetivo

Entregar o módulo estatístico `SolsticeStats` prometido na SEÇÃO 7 do PROMPT (30+ funções, mas a versão entregue tem **41**), criar a aba "📈 Análise" no Props com explicação "Por que esse número?", e refinar UX dos 4 componentes avançados (Scatter, Gauge, Box Plot, Sankey) para que o gráfico já apareça útil na primeira renderização.

## ✨ O que mudou

### `SolsticeStats` — módulo puro com 41 funções (10 categorias)

| Categoria | Funções | Total |
|---|---|---|
| Núcleo | `clean`, `sorted`, `sum`, `count`, `countNulls` | 5 |
| Descritivas | `mean`, `median`, `mode`, `min`, `max`, `range`, `distinctCount` | 7 |
| Dispersão | `variance`, `variancePop`, `stdDev`, `mad`, `cv` | 5 |
| Percentis | `percentile`, `quartiles`, `iqr` | 3 |
| Forma | `skewness`, `kurtosis` | 2 |
| Outliers | `outliersIQR`, `outliersZ`, `outliersMAD` | 3 |
| Regressão | `linearRegression`, `polynomialRegression` (Vandermonde + Gauss-Jordan, k≤6) | 2 |
| Correlação | `correlation` (Pearson), `correlationSpearman` (com empates por média), `correlationMatrix` | 3 |
| Séries temporais | `movingAverage`, `exponentialSmoothing`, `linearForecast`, `holtWinters` (aditivo), `diff`, `autocorrelation` | 6 |
| Clustering | `kMeans` (Lloyd's determinístico) | 1 |
| Transformações | `normalize`, `zScore`, `bucketize`, `lag` | 4 |
| Direcional | `trend` | 1 |
| Smart suggest | `bestNumericPair`, `suggestGauge`, `suggestBoxPlot`, `suggestSankey` | 4 |
| Sumário | `describe` | 1 |

Cada função é pura: input → output sem side effects, sem dependência de Store/Dictionary. Lida internamente com NaN/null via `clean()`. Documentadas com comentário didático (o quê, quando usar, fórmula em texto).

Exposto em `Solstice.Stats`.

### Helpers B6 viraram thin shims

`_linearRegression`, `_kMeans`, `_quartiles` agora chamam `SolsticeStats.*`. Resultado: componentes B6 funcionam idênticos, mas a lógica vive em um lugar só.

### Smart defaults nos 4 componentes ao clicar "adicionar"

| Componente | Antes (B6) | Depois (B7) |
|---|---|---|
| **Scatter** | `nums[0]`, `nums[1]` | `Stats.bestNumericPair(ctx)` — par com maior \|Pearson\| entre top-6 numéricas |
| **Gauge** | `min=0, max=100, target=70` | `Stats.suggestGauge(ctx)` — P5/P95 do dataset, target via `higherIsBetter` |
| **Box Plot** | `valueColumn=1ª num, groupColumn=null` | `Stats.suggestBoxPlot(ctx)` — auto-seleciona `groupColumn` se há cat com 2-8 distintos |
| **Sankey** | `source=cats[0], target=cats[1] OU cats[0]` | `Stats.suggestSankey(ctx)` — garante source ≠ target, prefere menos categorias na origem (padrão funil) |

### Toast informativo ao adicionar (smart hint)

`SolsticeComponents.addByType` agora calcula `_smartHintFor(typeId, config, ctx)`. O hint substitui "Inserido em slot existente"/"Nova seção criada":

- Scatter: "Par com correlação forte positiva (r=0.85): X × Y"
- Gauge: "Range automático via percentis. Meta sugerida: percentil 75 (área de excelência)."
- Box Plot: "Agrupado por 'regiao' (categórica detectada com 2-8 grupos)."
- Sankey: "Fluxo: regiao → canal" OU empty state guia se só há 1 cat

Hint vai também para `Audit.record('add_component')` em `details.smartHint`.

### Empty states humanos nos 4 componentes

Antes (B6) os empty states diziam só "Selecione coluna X em ⚙️". Agora explicam o estado real:

- Scatter sem 2 numéricas: "Scatter precisa de 2 colunas numéricas. Seu dataset tem apenas N."
- Gauge sem numérica: "Gauge precisa de uma coluna numérica. Seu dataset não tem nenhuma."
- Box Plot sem numérica: "Box Plot precisa de uma coluna numérica."
- Sankey 4 variantes contextuais (0 cats / 1 cat / source==target / ambos null)

### Aba "📈 Análise" no Props

Quinta aba no painel de Propriedades (4ª para componentes não-KPI). Disponível em todos menos `markdown`.

**Conteúdo universal:**
- Cabeçalho "🔬 Por que esse número?" + frase com n + nulls ignorados
- 📊 Distribuição central (média, mediana, std)
- 📏 Faixa e quartis (min, Q1, Q3, max, IQR)
- 🔍 Forma (skewness + texto humano, kurtosis + texto humano)
- ⚠️ Outliers (count IQR 1.5× + %)

**Seções contextuais:**
- `time-series`: 📈 Tendência (direção + variação total + R² + forecast 5)
- `scatter`: 🔗 Correlação (Pearson + Spearman + nota se |ρ|-|r| > 0.15)
- `gauge` com target: 🎯 Distância da meta
- `boxplot` com groupColumn: 📦 Por grupo (top 6)

**Footer:** snippet de console reproduzindo as métricas via `Solstice.Stats.describe(...)`.

Cada label tem tooltip explicando a métrica.

### CSS novo

8 classes em `.solstice__stats-*` (explain, section-title, row, label, value, empty, note, footer). Reusa tokens semânticos existentes (`--c-accent`, `--c-warn`, `--c-text-2`, `--font-mono`).

## 📐 Decisões arquiteturais novas

- ADR-056: Scatter smart default por correlação
- ADR-057: Gauge smart default por percentis + higherIsBetter
- ADR-058: Box Plot auto-grupo (2-8 distintos)
- ADR-059: Sankey exige cats distintas; 4 empty states contextuais
- ADR-060: SolsticeStats como módulo puro pre-Components
- ADR-061: Aba Análise context-aware com nota didática

## 🐛 Bugs introduzidos

Nenhum conhecido. Componentes B6 testados via shim — comportamento idêntico.

## ⚠️ Limitações conhecidas

- **Single thread:** Stats calcula no main thread. Datasets ≤100k linhas tudo bem. Para 500k+ considerar mover para WebWorker (B12).
- **Holt-Winters hiperparâmetros fixos** (α=0.5, β=γ=0.3): suficiente para forecast curto e didático. Não otimiza por grid search.
- **bestNumericPair limita a 6 colunas** (15 pares): datasets com 20+ numéricas podem ter par ótimo fora. Usuário ajusta em ⚙️.
- **suggestBoxPlot pega 1ª cat** com 2-8 distintos: pode não ser a mais informativa. 1 click ajusta.
- **polynomialRegression k ≤ 6:** suficiente para uso analítico; acima vira overfit.
- **Spearman com empates por média** (não fração de Tukey): visualmente aceitável; análise rigorosa precisa mais.

## 🚀 Próximo bloco

Bloco 8 — Insights + Narrativa Automática + Agente Proativo + Inconsistências (Diferencial #2). Vai consumir intensamente `SolsticeStats` para detectar tendências, sazonalidade, outliers, Pareto 80/20, geração de templates de frases. Aba "📈 Análise" do B7 vira material-fonte para a narrativa.

## 📦 Portabilidade

Veja `portabilidade/bloco-07.md` — **cada função de SolsticeStats é uma feature portável independente** (a SEÇÃO 13 do PROMPT pede isso explicitamente). Plus aba Análise (média complexidade), smart defaults dos 4 componentes (simples), shim pattern (simples).
