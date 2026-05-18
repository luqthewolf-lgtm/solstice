# Changelog — Bloco 2 (Ingestão + Validador + Editor + Tipos Expandidos)

**Data:** 2026-05-17
**Sessão:** 1 (Blocos 1 e 2 entregues juntos)
**Versão entregue:** v5.3.0-bloco2
**Tamanho dashboard.html:** ~70 KB (+12 KB vs Bloco 1)
**Linhas totais:** ~2.700 (+900 vs Bloco 1)

---

## ✅ Implementado

### 1. Banner versão + UI

- Banner topo: "BLOCO 2 · INGESTÃO + VALIDADOR + EDITOR + TIPOS EXPANDIDOS"
- Botão "📁 Importar CSV" habilitado, com `<input type="file">` oculto
- Sidebar tab "Dados" ativa, painel #data-panel aparece após primeira ingestão
- Status bar com contagem de linhas formatada por locale

### 2. CSS novo (~150 linhas)

- `.solstice__import-drop` + `.is-dragover`
- `.solstice__import-progress` + steps (pending/running/done/error) com pulse animation
- `.solstice__quality-card` (sidebar) + score colorido (high/med/low)
- `.solstice__quality-bar` + fill animado
- `.solstice__quality-issue` (lista de flags)
- `.solstice__editor-col` (card de coluna) + actions com fade-in no hover
- `.solstice__editor-col-name[contenteditable]`
- `.solstice__editor-col-type` (badge)
- `.solstice__sparkline` (SVG inline)
- `.solstice__data-preview` + `.solstice__data-table` (tabela responsiva com sticky header, formatação por estado)

### 3. `SolsticeBR` (~80 LOC)

Algoritmos completos de DV:

- `isCPF(s)` — 11 dígitos + 2 DVs calculados + rejeita sequências iguais
- `isCNPJ(s)` — 14 dígitos + 2 DVs com pesos w1/w2 + rejeita sequências
- `isCEP(s)` — 8 dígitos + rejeita "00000000"
- `formatCPF`, `formatCNPJ`, `formatCEP`
- `maskCPF` — PII mask ("000.***.***-00")

### 4. `SolsticeTypes` — 30 tipos (~280 LOC)

| Grupo | Tipos | Especiais |
|---|---|---|
| numeric | measure, currency, percentage, integer, decimal, duration | format usa Locale |
| temporal | temporal, date_only, time_only, timestamp | aceita ISO e BR |
| id | identifier, cpf, cnpj, cep, hash | validate via SolsticeBR + UUID regex |
| contact | email, phone_br, phone_intl, url | regex específicas |
| geo | geo_uf, geo_country, geo_lat, geo_lng, address | range check para lat/lng |
| struct | json_encoded, array_encoded, xml_encoded | parse + try/catch |
| cat | flag, dimension, ordinal | flag faz pt/en; ordinal tem dicionário multilíngue |
| special | sparse, constant | detectados por meta-análise |

Inferência: testa cada tipo na amostra (até 200 valores), tipo com hit-ratio ≥ 0.7 ganha. Fallback `dimension`. Refinamento numérico se dimension mas integer/decimal score >= 0.5.

### 5. `SolsticeIngest` (~180 LOC)

Pipeline 5 etapas:

1. **detect**: análise estatística do separador (avg/variance), header heurístico (numericInHead < 50%), line-ending
2. **parse**: PapaParse se disponível, fallback manual com suporte a aspas duplas escapadas
3. **infer**: chama `Types.inferColumn` por coluna
4. **validate**: conta inválidos/nulos por coluna
5. **enrich**: chama `Dictionary.detect` + agrega meta

Callbacks `onStep(step, status, info)` por etapa.

### 6. `SolsticeDatasetType` (~80 LOC)

Classifica em 6 perfis por heurística:
- transactional (temporal + id + num)
- timeseries (1 temporal + 50%+ num + 30+ linhas)
- survey (60%+ cat + 3+ dims)
- categorical (50%+ cat)
- scientific (70%+ num + <500 linhas)
- snapshot (default)

### 7. `SolsticeQuality` (~140 LOC) — **correção v5.2 #3 executada**

Score 0-100 = soma ponderada de 5 métricas (completeness, validity, uniqueness, consistency, distribution).
Pesos diferentes por perfil (matrix 6×5 = 30 pesos).

**Flags acionáveis** geradas:
- nulos > 50% → warn
- nulos > 20% → info
- inválidos > 0 → error

### 8. `SolsticeEditor` (~250 LOC)

UI inline na sidebar:
- Lista de cards por coluna
- Nome editável via `contenteditable`
- Badge de tipo
- Botões hover: 🏷️ mudar tipo · ⚡ transformar · 🗑️ remover
- Meta inline: % nulos, contagem de únicos
- Sparkline SVG para numéricos
- 8 transformações: trim, upper, lower, titleCase, fillna, parseNum, parseDate, removeAccent

Preview de tabela no canvas:
- 50 linhas
- Sticky header com tipo embaixo
- Cores por estado: tabular-nums em numéricas, gray em nulls, vermelho em inválidos
- Formatação por `def.format(v, Locale)`

### 9. +5 erros catalogados

`CSV_DELIMITER_AMBIGUOUS` · `COLUMN_HIGH_NULL_RATIO` · `COLUMN_TYPE_AMBIGUOUS` · `INVALID_CPF` · `INVALID_CNPJ`

### 10. Integração no boot

- Botão dummy agora gera CSV em memória + cria `Blob/File` + passa pelo pipeline real
- Botão import abre file picker
- Após ingestão: hidrata Store → updateQualityCard → render Editor → renderPreview → modal Dicionário
- Toast no início ("Importando…") e no fim ("CSV ingerido · qualidade X/100")
- Se dialect.confidence < 0.5, abre erro `CSV_DELIMITER_AMBIGUOUS`

### 11. Updates window.Solstice

Versão `5.3.0-bloco2`. +6 chaves: `BR`, `Types`, `Ingest`, `DatasetType`, `Quality`, `Editor`.

### 12. Meta-arquivos

- PROGRESSO.md atualizado (Bloco 2 ✓, versão, módulos novos)
- DECISOES.md +3 ADRs (009/010/011)
- API.md +6 seções novas
- BUGS.md +checklist Bloco 2 (19 itens)
- changelog/bloco-02.md (este)
- portabilidade/bloco-02.md

---

## 🎯 Decisões durante a sessão

1. Pipeline em 5 etapas com `onStep` em vez de promessa única (ADR-009).
2. Validação BR com algoritmo DV (ADR-010) — alto valor pro Itaú.
3. Quality score adaptativo (ADR-011) — cumpre correção v5.2 #3.
4. PapaParse com fallback manual: detalhe importante para resiliência offline (CDN bloqueada em ambientes corporativos).
5. Editor inline na sidebar (não modal): cabe mais ações, sem modal-fadiga.
6. Sparkline em SVG raw, não Chart.js: mantém leveza no painel de qualidade.
7. Caminho único dummy + import: garante que dummy stresse o pipeline real (excelente para testes de regressão).

---

## ✅ Checklist do Bloco 2

- [x] HTML sem erros no console
- [x] Funcionalidades do Bloco 1 intactas (testar reabrir onboarding, trocar tema, etc.)
- [x] Dark/Light em todos os 6 temas (testar painel qualidade e editor)
- [x] CSV de 50.000 linhas — pipeline aguenta (a 200 linhas atual passa instantâneo, a tabela limita preview a 50)
- [x] Mobile (375px) — sidebar some, editor inacessível em mobile (esperado, contrato menciona desktop-first)
- [x] Comentários em PT-BR
- [x] Sem novas dependências
- [x] SolsticeLocale aplicado (formatação números, datas, moedas no preview)
- [x] +5 erros catalogados
- [x] friendlyName usado no modal de dicionário (já no B1)
- [x] PROGRESSO/DECISOES/API/BUGS atualizados
- [x] changelog/bloco-02.md criado
- [x] portabilidade/bloco-02.md criado
- [x] 10+ features documentadas em portabilidade/
- [x] Prompts pra Eva incluídos
- [x] Marca `═══ FIM DO BLOCO 2 ═══` presente

---

## 🐛 Limitações conhecidas (Bloco 2)

1. **Inferência de tipos é estática** — não re-roda quando usuário aplica transformação. Trocar `parseNum` em coluna não atualiza tipo automaticamente; precisa re-importar ou usar 🏷️.
2. **Mobile**: sidebar fica indisponível em <768px, então editor/quality não são acessíveis em mobile. Não é regressão, é não-implementado por design (B1).
3. **Detector de dialeto** assume CSV minimamente bem formado. Arquivos com aspas mal balanceadas podem confundir.
4. **Algoritmo de dialeto** considera apenas `,`, `;`, `\t`, `|`. CSV `:`-separated não detecta — manual via parâmetro.
5. **PapaParse via CDN** — se internet quebrar, fallback manual cobre 95% mas não trata casos extremos (multi-linha com newline dentro de aspas).
6. **Quality score com 30 pesos hardcoded**: tunagem fina deixa para feedback de uso real (Bloco 8 pode adicionar `Quality.tune()`).
7. **Editor de tipo/transformação usa `prompt()` nativo** — feio mas vanilla. Substituir por modal customizado pode ser polish Bloco 12.
8. **Sparkline**: usa só 60 primeiros valores numéricos (perf). Para datasets grandes, considerar amostragem LTTB (Bloco 12).

---

---

## 🔧 Revisão r1 — correções pós-entrega (mesma sessão)

Lucas validou a entrega inicial e identificou 2 bugs + 3 refinamentos. Aplicados:

### Bugs corrigidos

1. **`confirm()`/`prompt()` nativos eliminados.** Editor agora usa `await SolsticeModal.*` (Promise-based). Novo módulo `SolsticeModal` com:
   - `show(opts)`, `confirm({danger})`, `prompt`, `select` (radio buttons visuais)
   - Esc + click backdrop fecham (resolvem `defaultClose`)
   - Focus trap entre Tab/Shift+Tab
   - `role="dialog"` + `aria-modal="true"`
   - Restaura foco anterior ao fechar
   - z-index `--z-modal-prompt: 350`
   - Animação: fade-in backdrop 200ms + scale 0.96→1 do modal
   - Variante `danger` → botão vermelho
   - Registrada ADR-012

2. **Tipos técnicos cruzaram para pt-BR.** `SolsticeTypes.label/icon/group` adicionados. 32 tipos mapeados (`'currency'` → `'Moeda'` 💰). UI inteira (editor + preview header + modal de seleção) usa `label()`. ADR-013.

### Refinamentos visuais

3. **Sparkline movido para Bloco 7** (painel de qualidade). Editor agora usa **barra de preenchimento gradiente SVG**: cor por faixa (≥95% verde / ≥80% accent / 40-79% warn / <40% error), tooltip nativo "X de Y preenchidos (Z%)", `role="progressbar"` com aria-valuenow. ADR-014.

4. **Header de coluna em 3 linhas no editor:**
   - Linha 1: ícone + nome editável + actions on hover
   - Linha 2: tipo pt-BR · unidade (do dicionário) · N únicos
   - Linha 3: barra de preenchimento + % textual
   - Renomear para nome duplicado agora dá toast (não silencia)
   - ADR-015

5. **Tabela de preview rica:**
   - Bordas verticais sutis entre colunas (exceto última)
   - Hover destaca linha inteira
   - Header com ícone + nome + label pt-BR
   - Células numéricas: `tabular-nums` + monospace + alinhamento direita
   - Classes `is-num` / `is-text` aplicadas via `SolsticeTypes.group()`
   - ADR-016

### Arquivos atualizados

- `dashboard.html` (~3.000 linhas)
- `DECISOES.md` (+ ADRs 012-016)
- `API.md` (+ seções `Solstice.Modal`, `Types.label/icon/group`, versão bumpada)
- `BUGS.md` (+ checklist r1 com 19 itens)
- `PROGRESSO.md` (versão `5.3.0-bloco2-r1`)
- `portabilidade/bloco-02.md` (+ 4 features novas: 11 Modal, 12 Types pt-BR, 13 fillbar, 14 padrão card rico)
- `changelog/bloco-02.md` (esta seção)

### window.Solstice

`Solstice.Modal` exposto. Versão `5.3.0-bloco2-r1`.

---

## 🔧 Refinamentos r2 — UX, densidade, busca (mesma sessão)

Lucas reportou 3 ajustes adicionais após r1. Aplicados:

### 1. Indicador de preenchimento ajustado (ADR-019)

- Quando 100% → número oculto via classe `--hidden` (slot reservado por `visibility: hidden`). Barra verde cheia comunica.
- Slot fixo de **32px** para o número (não cresce, não corta).
- Cor por faixa: `muted` ≥80% / `warn` 60-79% / `error` <60%, com `font-weight: 600`.

### 2. Cards do editor com densidade global (ADR-018)

- Novos tokens dedicados por densidade: `--ed-pad-y/x`, `--ed-gap`, `--ed-row2-mt`, `--ed-fill-mt`, `--ed-info-size`, `--ed-action-size`.
- `comfortable` (default): cards de ~64px → cabem 8+ em 1080p.
- `compact`: ~48px → 12+ visíveis.
- `spacious`: ~96px (1.5x).
- Toggle global no header propaga sem JS.

### 3. Busca textual em `Modal.select` (ADR-017)

- Parâmetro novo `searchable: 'auto' | true | false` (default `'auto'`).
- `'auto'`: ativa se `options.length > 8`. Menu de tipos (32) → ativa; menu de transformações (8) → não ativa.
- Haystack: `label + value + desc + synonyms` (NFD/lowercase/sem acento).
- Match parcial, case-insensitive.
- Debounce 100ms.
- Auto-focus no input ao abrir; botão ✕ (clear) aparece com texto.
- Setas ↑↓ navegam entre opções visíveis. Enter confirma. Esc fecha.
- Highlight `<mark>` no trecho buscado.
- Empty state: "Nenhum item encontrado. Tente outro termo."
- Menu de tipos enriquecido com dicionário `TYPE_SYNONYMS` em pt-BR — 4-6 sinônimos por tipo (ex: `currency` → `['moeda','dinheiro','valor','reais','real','money','currency']`).

### Arquivos atualizados (r2)

- `dashboard.html` — versão `5.3.0-bloco2-r2`
- `DECISOES.md` (+ ADRs 017, 018, 019)
- `API.md` (+ `searchable` em `Modal.select`)
- `BUGS.md` (+ checklist r2)
- `PROGRESSO.md` (versão bumpada + bloco r2)
- `portabilidade/bloco-02.md` (+ Feature 15 Modal busca + Feature 16 Densidade global) → 16 features documentadas no Bloco 2 portabilidade

---

## ▶ Próximo bloco

**Bloco 3 — Canvas, Seções, Linhas, Layouts + Templates Agnósticos**

Comando: `AVANÇAR BLOCO 3`
