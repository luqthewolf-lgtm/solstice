# API — Interfaces públicas dos módulos `Solstice.*`

> Tudo abaixo está exposto em `window.Solstice` para debug e blocos futuros.
> Versão coberta: **v5.3.0-bloco6-r1** (B6 + consolidação visual r1).

---

## `Solstice.Utils`

Helpers gerais sem estado.

```js
uuid()                        // → string RFC4122 v4
debounce(fn, ms)              // → função debouncada
throttle(fn, ms)              // → função throttled
clamp(v, lo, hi)              // → v clampado em [lo, hi]
deepClone(o)                  // → cópia profunda (objetos, arrays, dates)
hash(str)                     // → string hex FNV-1a 32-bit
seededRandom(seed)            // → função PRNG Mulberry32 determinística

qs(selector, root?)           // → Element ou null
qsa(selector, root?)          // → Array<Element>
el(tag, attrs, ...kids)       // → Element criado com atributos e filhos
on(target, ev, fn, opts?)     // → função de unbind
fire(name, detail)            // dispara 'solstice:<name>' em window
escapeHtml(s)                 // → string sanitizada
```

---

## `Solstice.Store`

Estado reativo único. Path = `'a.b.c'` (ponto-separado).

```js
get(path?)                    // → valor ou objeto state inteiro se path omitido
set(path, value)              // seta e notifica subscribers do path + ancestrais
subscribe(path, cb)           // cb(newVal, prevVal, fullPath) — retorna unsubscribe()
unsubscribe(path, cb)
batch(fn)                     // executa fn sem notificar; útil para hidratar
dump()                        // → snapshot profundo do state
reset()                       // limpa estado + subscribers (usar com cuidado)
```

**Paths convencionados no Bloco 1:**

| Path | Tipo | Setado por |
|---|---|---|
| `locale` | string ('pt-BR' etc.) | `SolsticeLocale.set` |
| `profile` | object | `SolsticeProfiles.create/switchTo` |
| `theme.mode` | 'dark' \| 'light' | `SolsticeTheme.set` |
| `theme.palette` | string | `SolsticeTheme.set` |
| `theme.density` | string | `SolsticeTheme.set` |
| `dataset.rows` | array | `SolsticeDummy.load` (Bloco 2 adiciona import) |
| `dataset.columns` | array<string> | idem |
| `dataset.name` | string | idem |
| `dataset.source` | 'dummy' \| 'import' | idem |
| `dataset.ready` | boolean | dispara cascata de subscribers |
| `dictionary` | object | `SolsticeDictionary.openConfigModal` |

---

## `Solstice.Locale`

```js
set(code)                     // 'pt-BR' | 'en-US' | 'es-ES' | 'en-GB'
get()                         // → string locale atual
listSupported()               // → array dos 4 locales

t(key, vars?)                 // → string traduzida (substitui {nome})
n(num, opts?)                 // → Intl.NumberFormat
integer(num)                  // → "1.234.567" em pt-BR
decimal(num, digits?)         // → "1.234,57"
currency(num, code?)          // → "R$ 1.234,56" (code default por locale)
percent(num, digits?)         // → "12%" (recebe fração: 0.12)
date(d, opts?)                // → "17 de mai. de 2026"
datetime(d)                   // → date + hora curta
```

Chaves de tradução cadastradas: `canvas.*`, `onb.*`, `dict.*`, `err.*`, `toast.*` (30+ chaves).

---

## `Solstice.Errors`

Catálogo humanizado de erros.

```js
show(code, vars?, extra?)     // abre modal com mensagem + sugestão + details
inline(targetEl, code, vars?) // renderiza erro inline em elemento existente
register(code, def)           // adiciona novo erro ao catálogo
list()                        // → array de codes
```

**Códigos do catálogo (15 total — 10 Bloco 1 + 5 Bloco 2):**

| Code | Severidade | Bloco | Quando |
|---|---|---|---|
| `CSV_PARSE_FAIL` | error | 1 | Falha de parsing do CSV |
| `CSV_EMPTY` | warn | 1 | CSV sem linhas de dados |
| `CSV_NO_HEADER` | warn | 1 | Sem cabeçalho detectável |
| `CSV_INCONSISTENT_COLUMNS` | warn | 1 | Linhas com colunas a mais/menos |
| `PROFILE_NAME_EMPTY` | warn | 1 | Nome de perfil vazio |
| `PROFILE_NAME_DUPLICATE` | warn | 1 | Já existe perfil com esse nome |
| `LOCALSTORAGE_UNAVAILABLE` | error | 1 | localStorage bloqueado |
| `STORAGE_QUOTA_EXCEEDED` | error | 1 | Sem espaço para salvar |
| `DICTIONARY_NO_MATCH` | info | 1 | Nenhum dicionário pré-feito casou |
| `UNKNOWN_ERROR` | error | 1 | Fallback genérico |
| `CSV_DELIMITER_AMBIGUOUS` | warn | 2 | Detector de dialeto com confidence < 0.5 |
| `COLUMN_HIGH_NULL_RATIO` | warn | 2 | Coluna > 50% nulos |
| `COLUMN_TYPE_AMBIGUOUS` | info | 2 | Tipo inferido com confiança baixa |
| `INVALID_CPF` | error | 2 | CPF reprovado no DV |
| `INVALID_CNPJ` | error | 2 | CNPJ reprovado no DV |

**Definição de erro:**
```js
{ sev: 'error'|'warn'|'info', icon: '...', message: '...', suggestion: '...' }
```

---

## `Solstice.Toast`

```js
show({ title, msg?, kind?, duration? })
success(title, msg?)          // borda verde
warn(title, msg?)             // borda amarela
error(title, msg?)            // borda vermelha
info(title, msg?)             // borda accent
```

---

## `Solstice.Modal` (Bloco 2 — correção pós-entrega)

**Substituto Promise-based de `alert/confirm/prompt` nativos. Proibido usar os nativos no projeto (ADR-012).**

```js
show(opts)                     // → Promise<any>   modal genérico
confirm(opts)                  // → Promise<boolean>
prompt(opts)                   // → Promise<string|null>
select(opts)                   // → Promise<string|null>   radio buttons visuais
```

**`show(opts)`** — opts:
```js
{
  title:        string,
  body:         Element | (close) => Element,
  footer:       Element | Element[] | (close) => Element[],
  size:         'lg'?,
  danger:       boolean,
  defaultClose: any,    // valor passado a resolve() se Esc ou click no backdrop
  onOpen:       ({ modal, backdrop, close }) => void
}
```

**`confirm(opts)`** — opts:
```js
{
  title:        'Confirmar',
  message:      string,
  confirmLabel: 'Confirmar',
  cancelLabel:  'Cancelar',
  danger:       boolean   // true → botão de confirmar vermelho
}
```

**`prompt(opts)`** — opts:
```js
{
  title, message, placeholder, defaultValue,
  type:         'text' | 'number' | 'email' | ...,
  confirmLabel, cancelLabel
}
```

**`select(opts)`** — opts:
```js
{
  title, message,
  options: ['a','b'] | [{ value, label, icon?, desc?, synonyms?: string[] }],
  defaultValue, size, confirmLabel, cancelLabel,
  searchable: 'auto' | true | false   // default 'auto' — mostra busca se options.length > 8
}
```

**Busca textual (`searchable`)** — ADR-017:
- `'auto'`: ativa quando há mais de 8 opções
- Haystack normalizado (NFD/lowercase/sem acento): `label + value + desc + synonyms`
- Match parcial + case-insensitive
- Highlight via `<mark>` no trecho match
- Empty state ("Nenhum item encontrado.")
- Setas ↑↓ navegam · Enter confirma · Esc fecha
- Debounce 100ms · auto-focus no input · botão ✕ aparece com texto

**Exemplo com synonyms:**
```js
const t = await Solstice.Modal.select({
  title: 'Mudar tipo',
  options: [
    { value: 'currency', label: 'Moeda', icon: '💰', desc: 'currency', synonyms: ['moeda','dinheiro','reais','money'] },
    { value: 'integer',  label: 'Inteiro', icon: '🔢', desc: 'integer', synonyms: ['inteiro','int','número'] }
  ],
  searchable: 'auto'  // 2 opções < 8 → não mostra busca; mude para true se quiser forçar
});
```

**Comportamentos garantidos:**
- `Esc` fecha → resolve `defaultClose` (em confirm: `false`; prompt/select: `null`)
- Click no backdrop fecha (idem)
- Focus trap entre Tab/Shift+Tab
- Foco automático: prefere input, senão primeiro botão
- Restaura foco anterior ao fechar
- z-index `--z-modal-prompt: 350` (acima de toast)
- `role="dialog"` + `aria-modal="true"`

**Exemplo:**
```js
const ok = await Solstice.Modal.confirm({ title:'Apagar?', message:'Não há undo.', danger:true });
if (ok) doIt();

const name = await Solstice.Modal.prompt({ title:'Nome do perfil', placeholder:'ex: Lucas Itaú' });

const type = await Solstice.Modal.select({
  title: 'Tipo da coluna',
  options: Solstice.Types.listTypes().map(t => ({
    value: t, label: Solstice.Types.label(t), icon: Solstice.Types.icon(t), desc: t
  })),
  defaultValue: 'currency'
});
```

---

## `Solstice.Profiles`

Perfis sem senha em localStorage.

```js
list()                        // → array<Profile>
create(name, color?)          // cria, ativa, salva
switchTo(id)                  // → boolean
remove(id)
current()                     // → Profile | null
ensureDefault()               // garante que existe um perfil ativo
COLORS                        // → array de 6 cores default
```

**Estrutura `Profile`:**
```js
{ id: uuid, name: string, color: hex, createdAt: ISO, dashboards: [] }
```

---

## `Solstice.Theme`

```js
get(name)                     // 'mode' | 'palette' | 'density'
set(name, value)              // → boolean (false se valor inválido)
cycle(name)                   // → próximo valor da lista
listPalettes()                // → ['ocean','sunset','forest','vineyard','coffee','slate']
listModes()                   // → ['dark','light']
listDensities()               // → ['compact','comfortable','spacious']
```

---

## `Solstice.Dictionary`

```js
presets                       // → objeto com 6 dicts pré-feitos + 'generico'
detect(columns)               // → { dictKey, dict, confidence, matches, unmatched, coverage, alternatives }
matchSynonym(colName, dict)   // → { techKey, def, score, matchType } | null
applyHeuristic(colName)       // → { type: 'currency'|... } | null
build(detection, overrides?)  // → dicionário final aplicável (objeto serializável)
save(name, dict)              // persiste em localStorage
load(name)                    // → dict ou null
listSaved()                   // → array de nomes
openConfigModal(detection, columns, onApply)
                              // abre modal interativo; onApply(finalDict) chamado se aplicado
```

**Estrutura `presets[key]`:**
```js
{
  name: 'Banco PJ — Carteira de Crédito',
  emoji: '🏦',
  domain: 'financeiro',
  columns: {
    'vlr_op_aprov_mensal': {
      friendlyName: 'Receita Mensal',
      synonyms: ['receita','faturamento',...],
      unit: 'R$',
      higherIsBetter: true,
      description: '...'
    },
    ...
  }
}
```

**Estrutura `detect()` retorna:**
```js
{
  dictKey: 'vendas',
  dict: {...preset...},
  confidence: 0.85,          // 0–1
  coverage: 0.9,             // % colunas que casaram
  matches: [
    { col: 'faturamento', techKey: 'receita', def: {...}, score: 0.92, matchType: 'partial' },
    ...
  ],
  unmatched: ['col_x', 'col_y'],
  alternatives: [...]        // outros dicts com confidence menor
}
```

---

## `Solstice.Dummy`

```js
gerar(seed?, n?)              // → array<Row> determinístico (default seed=42, n=200)
toCSV(rows)                   // → string CSV (RFC 4180, escape de aspas)
load(opts?)                   // gera + popula Store + dispara toast
```

**Schema do dummy (vendas BR):**

| Coluna | Tipo | Exemplo |
|---|---|---|
| `data` | date | "2024-03-15" |
| `regiao` | string | "Sudeste" |
| `uf` | string | "SP" |
| `categoria` | string | "Alimentos" |
| `canal` | string | "E-commerce" |
| `qt_vendas` | integer | 23 |
| `ticket_medio` | currency | 287.45 |
| `receita` | currency | 6612.34 |
| `margem_bruta` | percentage | 34.7 |
| `conversao` | percentage | 4.2 |
| `devolucoes` | percentage | 1.8 |

---

## `Solstice.Onboarding`

```js
show()                        // exibe modal 3 slides
isFirstTime()                 // → boolean (consulta localStorage)
markDone()                    // marca como visto
```

---

## `Solstice.Debug`

```js
toggle()                      // abre/fecha overlay
open()                        // força abrir
close()                       // força fechar
bindShortcut()                // amarra Ctrl+Shift+D (chamado no boot)
```

Atalho: **`Ctrl + Shift + D`**

Abas: `STATE` · `LOCALE` · `PERF`

---

## `Solstice.LZ`

Re-export de [LZ-String 1.4.4](https://github.com/pieroxy/lz-string). Métodos disponíveis:

```js
compress(s)                   compressToBase64(s)
decompress(s)                 decompressFromBase64(s)
compressToUTF16(s)            decompressFromUTF16(s)
compressToEncodedURIComponent(s)
decompressFromEncodedURIComponent(s)
```

Usado em blocos futuros para snapshots e export HTML standalone (Bloco 11).

---

---

## `Solstice.BR` (Bloco 2)

Validadores brasileiros com dígito verificador real.

```js
isCPF(s)                      // → boolean (algoritmo DV completo)
isCNPJ(s)                     // → boolean (algoritmo DV completo)
isCEP(s)                      // → boolean (formato + não-zero)
formatCPF(s)                  // → "000.000.000-00"
formatCNPJ(s)                 // → "00.000.000/0000-00"
formatCEP(s)                  // → "00000-000"
maskCPF(s)                    // → "000.***.***-00" (PII)
```

---

## `Solstice.Types` (Bloco 2)

Catálogo de **30 tipos de coluna** (Seção 11 do PROMPT.md).

```js
TYPES                          // → mapa { typeName: { group, detect, validate, aggs, format, viz } }
inferColumn(values)           // → { type, confidence, ratio, alternatives }
listTypes()                   // → array<string> com os 30 nomes
getType(name)                 // → definição { group, detect, validate, ... } ou undefined
label(type)                   // → string pt-BR ('currency' → 'Moeda')      ← Bloco 2 pós-fix
icon(type)                    // → emoji ('currency' → '💰')                 ← Bloco 2 pós-fix
group(type)                   // → 'numeric'|'temporal'|'categorical'|'special'  ← Bloco 2 pós-fix
```

> **ADR-013:** UI sempre usa `label()`/`icon()`. Slug técnico só em código interno.

**Tipos por grupo (30 total):**

| Grupo | Tipos |
|---|---|
| `numeric` (6) | measure · currency · percentage · integer · decimal · duration |
| `temporal` (4) | temporal · date_only · time_only · timestamp |
| `id` (5) | identifier · cpf · cnpj · cep · hash |
| `contact` (4) | email · phone_br · phone_intl · url |
| `geo` (5) | geo_uf · geo_country · geo_lat · geo_lng · address |
| `struct` (3) | json_encoded · array_encoded · xml_encoded |
| `cat` (3) | flag · dimension · ordinal |
| `special` (2) | sparse · constant |

**Cada tipo expõe:**
```js
{
  group: 'numeric',
  detect: (v) => bool,            // testa se valor parece desse tipo
  validate: (v) => bool,          // valida semanticamente
  aggs: ['sum','avg','count'],    // agregações permitidas
  format: (v, locale) => string,  // formatação default
  viz: ['kpi','line','bar']       // visualizações recomendadas
}
```

---

## `Solstice.Ingest` (Bloco 2)

Pipeline de 5 etapas para CSV.

```js
detectDialect(text)            // → { delimiter, quote, eol, hasHeader, confidence }
parseText(text, dialect)       // → { rows, columns, errors }
inferColumns(rows, columns)    // → { col: { type, confidence, ratio } }
validate(rows, columns, types) // → { byColumn: {col: {invalid, nulls, total}}, total }
enrich(rows, columns, types, issues)  // → adiciona dictDetection + meta
run(file, { onStep })          // → Promise<{rows, columns, types, issues, dialect, dictDetection, meta, sourceName}>
```

**`run()` chama `onStep(step, status, info)`** para cada uma das 5 etapas com status `running|done|error`.

---

## `Solstice.DatasetType` (Bloco 2)

```js
classify(columns, types, rows)  // → 'transactional'|'categorical'|'timeseries'|'snapshot'|'survey'|'scientific'
```

Heurísticas em ordem de prioridade:
1. temporal + id + numeric → `transactional`
2. 1 temporal + 50%+ numeric + 30+ linhas → `timeseries`
3. 60%+ categórico + 3+ dimensões → `survey`
4. 50%+ categórico → `categorical`
5. 70%+ numeric + <500 linhas → `scientific`
6. default → `snapshot`

---

## `Solstice.Quality` (Bloco 2)

Score adaptativo 0-100.

```js
compute(ingest)               // → { score, profile, weights, metrics, flags }
WEIGHTS                       // → { profile: { completeness, validity, uniqueness, consistency, distribution } }
```

**5 métricas:**
- `completeness`: 1 - (nulos / total)
- `validity`: 1 - (inválidos / total)
- `uniqueness`: razão única-em-IDs/identifier
- `consistency`: razão de células que casam com o tipo da coluna
- `distribution`: penaliza monovalor > 95%

**Flags** retornadas como `[{ col, level: 'info'|'warn'|'error', msg }, ...]`.

---

## `Solstice.Editor` (Bloco 2)

UI inline na sidebar (#editor-panel).

```js
render()                      // re-renderiza painel de colunas
renderPreview()               // re-renderiza preview no canvas
updateQualityCard()           // atualiza card de qualidade na sidebar
showPanel()                   // remove .solstice__hidden do #data-panel
TRANSFORMATIONS               // mapa { key: { label, fn } } — 8 transformações
```

**Transformações disponíveis:** `trim`, `upper`, `lower`, `titleCase`, `fillna`, `parseNum`, `parseDate`, `removeAccent`.

---

## Paths novos no Store (Bloco 2)

| Path | Tipo | Setado por |
|---|---|---|
| `ingest` | objeto completo (`rows`, `columns`, `types`, `issues`, `dictDetection`, `dialect`, `sourceName`) | `_runIngest()` no boot |
| `dataset.types` | mapa coluna→tipo inferido | idem |

---

---

## `Solstice.Layouts` (Bloco 3)

10 layouts pré-definidos para `Row`.

```js
LAYOUTS                       // → mapa { id: { name, icon, slotCount } }
get(id)                       // → definição ou layout '1col' como fallback
list()                        // → array com os 10 ids
slotCount(id)                 // → número de slots desse layout
reslot(row, newLayout)        // muta row.layout + row.slots para casar slotCount
```

**IDs:** `1col`, `2col-equal`, `2col-2-1`, `2col-1-2`, `3col-equal`, `3col-1-2-1`, `4col-equal`, `hero-bottom`, `sidebar-main`, `custom`.

---

## `Solstice.Canvas` (Bloco 3)

Hierarquia `Section → Row → Slot` persistida em `Store.canvas.sections`.

```js
addSection(title?)            // empurra nova seção (com 1 row 1col por default)
removeSection(secId)
duplicateSection(secId)       // copia + insere abaixo
moveSection(secId, delta)     // +1 = desce, -1 = sobe
setSectionTitle(secId, t)
addRow(secId, layout?, afterRowId?)
removeRow(secId, rowId)       // garante mínimo 1 row por section
duplicateRow(secId, rowId)
changeRowLayout(secId, rowId, newLayout)
applyTemplate(sections)       // recebe estrutura sem id, gera novos ids
clear()                       // reseta canvas.sections = []
render()                      // re-render manual (boot já assina automático)
init()                        // chamado uma vez por boot
```

**Estrutura no Store (`canvas.sections`):**
```js
[
  {
    id: uuid,
    title: 'Visão geral',
    rows: [
      { id: uuid, layout: '4col-equal',
        slots: [{ id: uuid, type: 'empty' }, /* ... */] }
    ]
  }
]
```

---

## `Solstice.Templates` (Bloco 3)

6 agnósticos + 6 templates de domínio filtrados pelo dicionário detectado.

```js
AGNOSTIC                       // array com os 6 universais
DOMAIN                         // array com os 6 condicionados
list()                         // → templates aplicáveis ao estado atual (agnósticos + os de domínio que batem)
getAll()                       // → todos (sem filtro)
apply(id)                      // aplica template (insere as sections via Canvas)
openPicker()                   // → Promise — abre Modal.select com busca textual
```

**Estrutura de template:**
```js
{
  id: 'kpi-trend',
  name: 'KPIs + Tendência',
  icon: '📊',
  description: '4 indicadores chave em linha + gráfico de série temporal embaixo.',
  domain: null | 'banco_pj' | 'vendas' | 'rh' | 'marketing' | 'operacional' | 'cientifico',
  domainLabel: 'Banco PJ' | ...,
  build: () => [ /* array de sections sem id */ ]
}
```

**Filtragem por domínio:** `list()` consulta `Store.ingest.dictDetection.dictKey`. Se igual ao `template.domain`, template entra.

---

## Helpers de ingestão expostos (módulo-level)

```js
// Definidos no escopo do IIFE principal — acessíveis pelo Canvas empty state e pelo boot.
_runIngestFile(file)          // pipeline completo: detect → parse → infer → validate → enrich → store → UI
_loadDummyDataset()            // gera dummy de vendas BR + chama _runIngestFile
```

---

## Paths novos no Store (Bloco 3)

| Path | Tipo | Setado por |
|---|---|---|
| `canvas.sections` | array<Section> | `SolsticeCanvas.*` operations |

---

## `Solstice.Undo` (Bloco 4)

Ring buffer de 50 snapshots de `canvas.sections`. Captura via `subscribe`. Suprimida durante seu próprio undo/redo.

```js
undo()                          // → boolean (true se aplicou)
redo()                          // → boolean
canUndo()                       // → boolean
canRedo()                       // → boolean
size()                          // → número de snapshots na história
init()                          // chamado por Canvas.init
_capture()                      // captura snapshot manual (geralmente desnecessário)
```

**Atalhos:** `Ctrl+Z` undo · `Ctrl+Shift+Z` / `Ctrl+Y` redo.
Ignora quando foco está em `input/textarea/contenteditable`.

---

## `Solstice.Resize` (Bloco 4)

Handle vertical entre slots adjacentes em modo grid. Magic snap em frações canônicas.

```js
SNAPS                          // → [25, 33.33, 50, 66.67, 75]
_maybeSnap(pct)                // → snapped value ou pct (tolerância 2.5%)
init()                         // chamado por Canvas.init (event delegation no canvas)
```

**Persistência:** quando o usuário arrasta um handle, `row.widths` é setado para `[w1, w2, ...]` (em %) e `row.layout` vira `'custom'`. Canvas aplica `style.gridTemplateColumns = "w1fr w2fr ..."` no render.

**Mínimo:** 5% por slot.

---

## `Solstice.DnD` (Bloco 4)

Drag-and-drop entre slots via HTML5 Drag API. Soltar em outro slot = **swap**.

```js
init()                         // chamado por Canvas.init (event delegation)
```

Funciona entre rows e entre sections. Não suporta inserção entre slots (B12 adicionará drop zones).

---

## `Solstice.Minimap` (Bloco 4)

Outline `position: fixed` bottom-right. Click em section rola canvas até ela.

```js
init()                         // monta DOM, assina canvas.sections
render()                       // re-render manual (assina automático)
toggle()                       // colapsa/expande
```

Esconde quando `canvas.sections` está vazio. CSS class `.solstice__minimap-collapsed` reduz a 32×32px com só o botão de expandir.

---

## `Solstice.FreeMode` (Bloco 4)

Toggle por row entre modo grid e modo livre (`position: absolute`).

```js
toggleRow(secId, rowId)        // alterna row.mode entre 'grid' e 'free'
init()                         // pointer event delegation no canvas
```

**Em modo livre:** cada slot ganha `{x, y, w, h}` (x e w em %, y e h em px). Drag pelo handle `⋮⋮` no topo via Pointer Events. **Smart guides:** stub (B12).

---

## Paths novos no Store (Bloco 4)

| Path | Tipo | Setado por |
|---|---|---|
| `canvas.sections[].rows[].widths` | array<number> em % | `SolsticeResize` |
| `canvas.sections[].rows[].mode` | `'grid' \| 'free'` | `SolsticeFreeMode.toggleRow` |
| `canvas.sections[].rows[].slots[].{x,y,w,h}` | número (% ou px) | `SolsticeFreeMode` drag |

---

## `Solstice.Audit` (Bloco 5 · Diferencial #1)

Ring buffer de 500 decisões. Capturadas automaticamente por `Props.update_config`, `Components.add_component`, `Components.select_component`. Componentes customizados podem chamar `record()` diretamente.

```js
record({ action, target?, componentId?, details? })
                              // ts é gerado automaticamente em ISO 8601
log                            // → array<Entry> (acesso direto, não mutável)
list(filter?)                  // → array filtrada por { componentId?, action? }
subscribe(cb)                  // cb(entry) chamado a cada record
clear()                        // limpa buffer
toMarkdown(filter?)            // → string Markdown
exportMd(filter?)              // baixa arquivo solstice-audit-<timestamp>.md
openModal(filter?)             // → Promise — modal global com timeline
openProvenance(slotId)         // → Promise — abre modal "🔬 De onde vem esse número?"
```

**Entry shape:**
```js
{
  ts: '2026-05-17T18:23:45.123Z',
  action: 'update_config' | 'add_component' | 'select_component' | string,
  target: 'slot-id-...',      // opcional
  componentId: 'slot-id-...', // opcional
  details: { ... }            // payload arbitrário
}
```

---

## `Solstice.Components` (Bloco 5)

Registry plugável de componentes visuais.

```js
register(def)                  // adiciona componente
get(id)                        // → definição ou undefined
list()                         // → array<Def>
render(slot, host)             // renderiza componente dentro de host (DOM)
```

**Def shape:**
```js
{
  id: 'kpi',
  name: 'KPI Card',
  icon: '📊',
  defaultConfig: (ctx) => ({ ... }),
  render: (slot, host, ctx) => void
}
```

`ctx` exposto a `defaultConfig` e `render`:
```js
{ rows, columns, types, dictionary, L /* SolsticeLocale */ }
```

**10 componentes registrados (B5: 4 + B6: 6):**

| `id` | Nome | Config | Bloco |
|---|---|---|---|
| `kpi` | KPI Card | `{ column, agg, comparison, showSparkline }` | B5 |
| `time-series` | Série Temporal | `{ xColumn, yColumn, bin, kind }` | B5 |
| `distribution` | Distribuição | `{ column, bins }` | B5 |
| `table` | Tabela | `{ rowLimit }` | B5 |
| `scatter` | Scatter / Bubble | `{ xColumn, yColumn, sizeColumn, showRegression, clusters }` | B6 |
| `heatmap-cal` | Heatmap Calendário | `{ dateColumn, valueColumn, agg }` | B6 |
| `gauge` | Gauge | `{ column, agg, min, max, target }` | B6 |
| `markdown` | Texto / Markdown | `{ text }` (com `{{store.path}}` placeholders) | B6 |
| `boxplot` | Box Plot | `{ valueColumn, groupColumn }` | B6 |
| `sankey` | Sankey | `{ sourceColumn, targetColumn, valueColumn }` | B6 |

---

## `Solstice.Props` (Bloco 5)

Painel de Propriedades na sidebar.

```js
select(slotId)                 // mostra painel para o slot dado
deselect()                     // esconde
render()                       // re-render manual (assina automático)
init()                         // chamado por Canvas.init
```

**4 abas:** `data` (Dados) · `visual` (stub) · `decisions` (timeline do componente) · `provenance` (atalho ao Trail).

---

## Paths novos no Store (Bloco 5)

| Path | Tipo | Setado por |
|---|---|---|
| `canvas.sections[].rows[].slots[].type` | `'empty' \| 'kpi' \| 'time-series' \| 'distribution' \| 'table'` | `Canvas._openComponentPicker` / `Components` remover |
| `canvas.sections[].rows[].slots[].config` | objeto específico por tipo | `Props._updateConfig` |
| `ui.selectedSlot` | string \| null | `Props.select` / `deselect` |
| `ui.activeTab` | `'dados' \| 'componentes'` | `SidebarTabs.activate` (Patch B5-r3) |
| `canvas.sections[].rows[].slots[].config.comparison` | objeto `{ type, targetValue, targetLabel, periodSize }` | `Props.comparison` tab (Patch B5-r3) |
| `canvas.header` | objeto `{ enabled, title, subtitle, showDate, dateMode, dateFixed, dateColumn, dateFunction, gradient, textColor, height }` | `DashHeader.set` (Patch B5-r4) |

---

## `Solstice.SidebarTabs` (Patch B5-r1)

Alterna entre painéis "Dados" e "Componentes" na sidebar.

```js
activate(which)               // which: 'dados' | 'componentes'
init()                        // chamado por boot — bind dos clicks
_renderComponentsPanel()      // re-render do painel de componentes (interno)
```

**Comportamento:**
- Click em `#tab-dados` → mostra `#data-panel` (editor B2 + qualidade)
- Click em `#tab-componentes` → mostra `#components-panel` (lista todos os componentes do canvas)
- Lista de componentes tem: ícone + nome + localização (`S1 · L2 · slot 3`) + botão 🗑️ inline
- Click no item → `Props.select` + `scrollIntoView(behavior:'smooth')`
- Re-render reativo via `subscribe('canvas.sections')` e `subscribe('ui.selectedSlot')`

---

## `Solstice.Dataset` (Patch B6-r1)

Resumo classificado por grupo de tipo. Usado pelo Resumo do Dataset (sidebar).

```js
summary()                      // → { totalRows, totalColumns, groups: { numeric: [...], categorical: [...], ... } }
groupMeta(groupName)           // → { label, icon, plural, singular }
GROUP_META                     // → mapa completo de metadados por grupo
```

**Cada entrada em `groups[g]`** é `{ name, friendlyName, type }`. Friendly via `Humanize.column(name, dict)`.

**Grupos suportados** (e os tipos `SolsticeTypes` que mapeiam):
- `numeric` (`measure`, `currency`, `percentage`, `integer`, `decimal`, `duration`)
- `temporal` (`temporal`, `date_only`, `time_only`, `timestamp`)
- `categorical` (`flag`, `dimension`, `ordinal`)
- `id` (`identifier`, `cpf`, `cnpj`, `cep`, `hash`)
- `contact` (`email`, `phone_br`, `phone_intl`, `url`)
- `geo` (`geo_uf`, `geo_country`, `geo_lat`, `geo_lng`, `address`)
- `struct` (`json_encoded`, `array_encoded`, `xml_encoded`)
- `special` (`sparse`, `constant`)

---

## Variantes responsivas dos componentes SVG (Patch B6-r1)

Componentes SVG (`scatter`, `gauge`, `boxplot`, `sankey`, `distribution`) usam **`ResizeObserver`** internamente para detectar mudança de tamanho do slot e re-renderizar com novas dimensões.

**Tiers** (via `host.clientWidth`):

| Tier | Faixa | W × H |
|---|---|---|
| `compact` | < 240px | 240 × 150 |
| `standard` | < 420px | 360 × 240 |
| `large` | ≥ 420px | 540 × 340 |

Cada SVG ganha classe `.solstice__chart-svg--{tier}` para customizações CSS adicionais.

**Empty state** quando slot é muito pequeno para o componente: Sankey mostra "📏 Sankey precisa de mais espaço. Aumente o slot ou use layout 1col." quando `clientWidth < 320`.

---

## `SolsticeModal.show` — opção `dismissOnBackdrop` (Patch B6-r1)

```js
SolsticeModal.show({
  title, body, footer,
  dismissOnBackdrop: false,    // default: true
  defaultClose: null
});
```

- `dismissOnBackdrop: true` (default): click no backdrop fecha modal (resolve `defaultClose`)
- `dismissOnBackdrop: false`: click no backdrop é ignorado. Só Esc/botões fecham.

**Proteção global contra arraste de seleção** (sempre ativa, independente de `dismissOnBackdrop`):
- `mousedown` marca se drag começou DENTRO do modal
- `click` no backdrop só fecha se drag NÃO começou dentro
- Resolve cenário "selecionar texto no input e soltar fora não fecha o modal"

---

## Helpers estatísticos inline no `SolsticeComponents` (Bloco 6)

Precursores do `SolsticeStats` que chegará no Bloco 7. **API privada** do módulo `SolsticeComponents` — não exposta no `window.Solstice`. Migração para `SolsticeStats` no B7 será trivial (mesmo nome de função, mesma assinatura).

```js
_linearRegression(points)      // points: array<[x, y]>
                               // → { slope, intercept, r2 } | null
                               // OLS clássico. Lida com SS_tot = 0 (todos os y iguais).

_kMeans(points, k, maxIter=20) // points: array<[x, y]>, k: 1-8
                               // → array<clusterId> (paralelo ao input)
                               // Lloyd's algorithm. Inicialização com k pontos espaçados.

_quartiles(values)             // values: array<number>
                               // → { q1, median, q3, min, max, outliers }
                               // outliers via IQR 1.5×. min/max já excluem outliers (whisker tradicional).
```

---

## `Solstice.DashHeader` (Patch B5-r4)

Banner visual customizável acima da toolbar do canvas. Persiste em `Store.canvas.header`.

```js
DEFAULT                        // → objeto com config inicial
DIRECTIONS                     // → array<{ value, label }> — 8 direções de gradient
get()                          // → config atual (merge com DEFAULT)
set(patch)                     // atualiza Store.canvas.header (parcial)
autoTextColor(fromHex, toHex)  // → '#FFFFFF' | '#000000' (WCAG luminance)
renderInto(canvasEl)           // anexa header como primeiro filho de canvasEl
openConfig(overrides?)         // → Promise — modal de configuração com preview ao vivo
init()                         // chamado por boot — subscribe + auto-suggest
```

**Estrutura de `Store.canvas.header`:**
```js
{
  enabled: false,                      // false esconde o banner
  title: 'Dashboard sem título',
  subtitle: '',                         // opcional
  showDate: true,
  dateMode: 'today',                    // 'today' | 'fixed' | 'column'
  dateFixed: null,                      // ISO string quando dateMode === 'fixed'
  dateColumn: null,                     // nome da coluna quando 'column'
  dateFunction: 'max',                  // 'max' | 'min' | 'recent' (column mode)
  gradient: {
    from: '#003D7A',
    to: '#FF6B00',
    direction: 'to right'               // ou 'to left', 'to bottom right', 'radial', etc.
  },
  textColor: 'auto-white',              // 'auto-white' | 'auto-black' | hex
  height: 'compact'                     // 'compact' | 'standard' | 'tall'
}
```

**`renderInto(canvasEl)`** é chamado pelo `Canvas.render` antes da toolbar. Se `enabled: false`, não anexa nada.

**Auto-sugestão**: ao importar CSV, toast com botão "Configurar" propõe usar `Title Case do nome do arquivo` como título (uma vez por dataset, controlado por `_suggestionShown`).

---

## `Solstice.KPI` (Patch B5-r3 + ajustes r4)

Cálculo de delta configurável com 8 tipos de comparação. Usado por `Components.kpi.render`.

```js
COMPARISON_TYPES               // → array<{ value, label, short }> com os 8 tipos
AGG_COMPARISON_COMPAT          // → mapa de compatibilidade (Patch B5-r4)
listTypes()                    // → cópia de COMPARISON_TYPES
getType(value)                 // → entrada ou undefined
isCompatible(agg, baselineType)// → boolean (Patch B5-r4)
incompatReason(agg, baseType)  // → string explicando por que combinação é desencorajada (Patch B5-r4)
calculateDelta(values, config) // → { pct, baseline, baselineLabel, direction, current } | null
                               // values: array<number>
                               // config: { agg, comparison: { type, targetValue?, targetLabel?, periodSize? } }
                               // direction: 'up' | 'down' | 'flat'
```

**`AGG_COMPARISON_COMPAT`** — quais baselines fazem sentido por agregação:

| Agregação | Baselines compatíveis |
|---|---|
| `sum` | previous-period, same-period-last-year, fixed-target, first-value, last-value, none |
| `avg` / `mean` | previous-period, same-period-last-year, fixed-target, historical-mean, first-value, last-value, none |
| `median` | previous-period, same-period-last-year, fixed-target, historical-median, first-value, last-value, none |
| `count` | previous-period, same-period-last-year, fixed-target, none |
| `min` / `max` | previous-period, same-period-last-year, fixed-target, historical-mean, none |
| `stddev` | previous-period, fixed-target, historical-mean, none |

Aba "Comparação" no Props filtra opções por essa tabela. Trocar agregação que invalide a baseline atual dispara auto-switch para `previous-period` + toast informativo.

**8 tipos de comparação:**

| `type` | Baseline calculada como |
|---|---|
| `previous-period` | Média da 1ª metade (proxy de período até filtros B9) |
| `same-period-last-year` | Média do primeiro 1/12 da série (proxy até filtros B9) |
| `fixed-target` | `config.comparison.targetValue` (número) |
| `historical-mean` | Média de todos os valores |
| `historical-median` | Mediana de todos os valores |
| `first-value` | `values[0]` |
| `last-value` | `values[values.length - 1]` |
| `none` | retorna `null` |

**`baselineLabel`** retornado é o que vai literalmente para `Humanize.delta(..., baselineLabel)`:
- `'período anterior'`, `'mesmo período do ano passado'`, `'meta'` (ou `targetLabel` custom), `'média histórica'`, `'mediana histórica'`, `'primeiro registro'`, `'último registro'`.

---

## `Solstice.Modal.confirm` — `skipKey` (Patch B5-r3, ADR-043)

```js
Modal.confirm({
  title, message, danger,
  confirmLabel, cancelLabel,
  skipKey: 'remove-component'   // opcional
})
```

Quando `skipKey` é fornecido:
- Antes de abrir o modal, lê `localStorage[solstice.<profileId>.skipConfirm.<skipKey>]`. Se `'true'`, resolve `true` imediatamente (sem UI).
- Quando modal aparece, adiciona checkbox **"Não perguntar mais sobre isso"** abaixo da mensagem. Marcar + confirmar persiste a preferência.

```js
Modal.isSkipped(skipKey)       // → boolean — útil para introspecção em UI
Modal.listSkipped()            // → array<string> — chaves silenciadas no perfil atual
Modal.unskip(skipKey)          // remove persistência (volta a perguntar)
```

**Convenção de chaves:** kebab-case, prefixo verbo+substantivo. `remove-component`, `remove-section`, `remove-row` são as 3 chaves nativas do Solstice.

---

## `Solstice.Toast.action` (Patch B5-r3)

Toast com botão clicável inline, geralmente "Desfazer" pareado com `Undo.undo()`.

```js
Toast.action({
  title:       'Componente removido',
  msg:         'KPI Card',           // opcional
  kind:        'warn',               // opcional: 'success' | 'warn' | 'error' | undefined
  actionLabel: 'Desfazer',
  actionFn:    () => Undo.undo(),
  duration:    5000                  // ms, default 5000
})
```

Botão fica visível por `duration` ms ou até o usuário clicar. Clicar dispara `actionFn` e dismissa o toast.

---

## `Solstice.Humanize` (Patch B5-r2)

Toda saída textual destinada ao usuário passa por aqui (ADR-039). Strings técnicas em JS; strings humanas na UI.

```js
aggregation(op)               // → string pt-BR
                              // 'sum' → 'Soma', 'avg' → 'Média', 'count' → 'Quantidade',
                              // 'min' → 'Mínimo', 'max' → 'Máximo', 'median' → 'Mediana',
                              // 'stddev' → 'Desvio padrão', 'p95' → 'Percentil 95', etc.

delta(pct, higherIsBetter)    // → { text, color }
                              // pct = variação % (número, ex: 12.3 ou -5.4)
                              // higherIsBetter: true | false | null/undefined
                              //
                              // (12.3, true)  → { text: '▲ +12,3% acima do período anterior', color: 'success' }
                              // (-5.4, true)  → { text: '▼ -5,4% abaixo do período anterior', color: 'error' }
                              // (0.3, _)      → { text: '≈ Estável vs período anterior', color: 'muted' }
                              //
                              // color: 'success' | 'error' | 'muted' — chave semântica;
                              //        CSS aplica via .solstice__kpi-delta--{color}

recordCount(n)                // → string pt-BR pluralizada
                              // 1     → '1 registro'
                              // 200   → '200 registros'
                              // 1500  → '1.500 registros' (Intl)
                              // 1e6   → '1 milhão de registros'
                              // 2.5e6 → '2,5 milhões de registros'

timeRange(rangeMs)            // → string pt-BR de duração
                              // 'X horas' | 'X dias' | 'X meses' | 'X,Y anos'

column(columnName, dictionary?) // → friendlyName se dicionário tiver, senão Title Case do snake_case
                              // ('vlr_op_aprov', {columns:{vlr_op_aprov:{friendlyName:'Receita Mensal'}}})
                              //   → 'Receita Mensal'
                              // ('vlr_op_aprov') → 'Vlr Op Aprov' (fallback)
```

**Onde foi aplicado (r2):**
- `SolsticeComponents.kpi.render` — `aggregation`, `delta`, `recordCount`, `column`
- `SolsticeComponents.distribution.render` — caption com `column` + `recordCount`

**A regra:** ao adicionar string visível ao usuário em qualquer componente novo, sempre passar por `Humanize.*`. Identificadores técnicos (slugs `'sum'`, nomes técnicos de coluna `'vlr_op_aprov'`) ficam em JS; strings humanas saem por aqui.

---

## Footer dinâmico (Patch B5-r1)

Element `#app-version` no footer é populado automaticamente no fim do `boot()`:

```js
const m = (Solstice.version || '').match(/bloco(\d+)(?:-(r\d+))?/);
// "5.3.0-bloco5-r1" → blocoNum: "5", revision: "r1"
// element.textContent: "v5.3 · Bloco 5 r1"
```

Procedimento "atualizar footer ao mudar bloco" agora é automático. Atualizar `Solstice.version` basta.

---

## Eventos globais (`window.dispatchEvent`)

| Evento | Detail | Disparado por |
|---|---|---|
| `solstice:locale:changed` | `{ locale }` | `SolsticeLocale.set` |

Outros eventos virão em blocos futuros (auditoria, comentários, snapshots).

---

## `Solstice.Stats` (Bloco 7)

Módulo estatístico puro. 41 funções autossuficientes (sem state). Lida com NaN/null/undefined internamente via `clean()`. Documentadas inline no `dashboard.html` com fórmulas em texto.

### Núcleo (5)

```js
clean(values)              // → array<number> sem NaN/null
sorted(values)             // → array<number> ordenado asc + limpo
sum(values)                // → number
count(values)              // → quantidade de válidos
countNulls(values)         // → quantidade de inválidos
```

### Descritivas (7)

```js
mean(values)               // média aritmética
median(values)             // mediana
mode(values)               // → array (sem moda real retorna [])
min(values)                // mínimo
max(values)                // máximo
range(values)              // max - min
distinctCount(values)      // valores únicos
```

### Dispersão (5)

```js
variance(values)           // variância amostral (n-1)
variancePop(values)        // variância populacional (n)
stdDev(values)             // raiz da variância amostral
mad(values)                // Desvio Absoluto Mediano (robusto a outliers)
cv(values)                 // coeficiente de variação σ/μ
```

### Percentis (3)

```js
percentile(values, p)      // p ∈ [0,1]. percentile(.5) === median
quartiles(values)          // → { q1, median, q3, iqr, min, max }
iqr(values)                // → number
```

### Forma (2)

```js
skewness(values)           // Pearson 3 simplificado
kurtosis(values)           // excesso (Fisher), normal = 0
```

### Outliers (3)

```js
outliersIQR(values, k=1.5) // → { indices, values, fences: { lo, hi } }
outliersZ(values, t=3)     // |Z-score| > t
outliersMAD(values, t=3.5) // Modified Z via MAD — robusto
```

### Regressão (2)

```js
linearRegression(points)   // → { slope, intercept, r2, n }
                           //   points: [[x,y],...]

polynomialRegression(points, degree=2)
                           // → { coefs: [c0,c1,...,ck], r2, degree, n }
                           //   y ≈ Σ c_i * x^i
                           //   k ∈ [1, 6]; usa Vandermonde + Gauss-Jordan
```

### Correlação (3)

```js
correlation(xs, ys)        // Pearson r ∈ [-1, 1] — linear
correlationSpearman(xs,ys) // ρ por postos — monotônica não-linear
correlationMatrix(rows, columns, method='pearson')
                           // → array<{ a, b, r, n }>
```

### Séries temporais (6)

```js
movingAverage(values, w=3)         // média móvel simples
exponentialSmoothing(values, α=0.3) // Holt nível-only
linearForecast(values, n=5)        // estende regressão linear
holtWinters(values, n, season=12)  // aditivo, α=0.5 β=γ=0.3
diff(values, lag=1)                // y[t] - y[t-lag]
autocorrelation(values, lag=1)     // r_k
```

### Clustering (1)

```js
kMeans(points, k, maxIter=20)   // Lloyd's, init determinística
                                // → array<clusterId>
```

### Transformações (4)

```js
normalize(values)          // min-max para [0,1]
zScore(values)             // (x - μ) / σ
bucketize(values, n=10)    // → { edges, counts, bins }
lag(values, k=1)           // out[i] = values[i-k]
```

### Direcional (1)

```js
trend(values)              // → { direction: 'up'|'down'|'flat', slope,
                           //     slopePerUnit, magnitude, r2, totalChange }
                           // magnitude = |totalChange| / |mean|
                           // direction = flat se magnitude < 2%
```

### Smart suggest (4) — usados pelos `defaultConfig` dos componentes

```js
bestNumericPair(ctx)           // → { x, y, r, candidates }
                               //   itera até 6 numéricas (15 pares max)
                               //   retorna o de maior |r|, mín. 5 pontos

suggestGauge(ctx)              // → { column, agg, min, max, target }
                               //   prefere percentage; senão P5/P95 rounded;
                               //   target = P75 se higherIsBetter, P25 senão, P50 neutro

suggestBoxPlot(ctx)            // → { valueColumn, groupColumn }
                               //   groupColumn = 1ª cat com 2-8 distintos

suggestSankey(ctx)             // → { sourceColumn, targetColumn, valueColumn }
                               //   garante source ≠ target; ordena por distinct asc
                               //   (menos cats → origem como em funil)
```

### Sumário (1)

```js
describe(values)           // → { n, nulls, mean, median, stdDev, min, max,
                           //     q1, q3, iqr, skewness, kurtosis, outlierCount }
```

**Onde é consumido:**
- `SolsticeComponents._linearRegression / _kMeans / _quartiles` — shims internos (ADR-060)
- `SolsticeComponents.addByType` — calcula `_smartHintFor()` para toast (ADR-056-059)
- `SolsticeProps._renderStatsTab` — aba "📈 Análise" (ADR-061)
- Console: `Solstice.Stats.describe(values)` é o ponto de entrada didático
- **Blocos futuros:** B8 narrativa, B10 auto-dashboard recommender

---

## Aba "📈 Análise" no `SolsticeProps` (Bloco 7)

Quinta aba no painel de Propriedades. Disponível em todos componentes exceto `markdown`. Implementada em `_renderStatsTab(host, slot, def)` (privada).

**Resolve a coluna principal** por tipo:

| Componente | Coluna analisada |
|---|---|
| `kpi`, `distribution`, `gauge` | `cfg.column` |
| `time-series`, `scatter` | `cfg.yColumn` |
| `boxplot` | `cfg.valueColumn` |
| `heatmap-cal`, `sankey` | `cfg.valueColumn` (pode ser null para sankey de contagem) |
| `table` | nenhuma (mostra empty state instrucional) |

**Seções universais:** Distribuição central · Faixa e quartis · Forma · Outliers (todas via `SolsticeStats.describe`).

**Seções condicionais:**
- `time-series`: tendência + variação total + R² + forecast 5 períodos via `Stats.linearForecast`
- `scatter`: Pearson + Spearman, com nota se `|ρ| - |r| > 0.15` (sugere transformação log/raiz)
- `gauge`: distância da meta (atual vs target em valor absoluto e %)
- `boxplot` com `groupColumn`: top 6 grupos com mediana + n

**Footer:** snippet de console reproduzindo as métricas via API pública.

---

## `SolsticeComponents.addByType` — toast com smart hint (Bloco 7)

`addByType(typeId)` agora computa `_smartHintFor(typeId, config, ctx)` ao adicionar componente. O hint vira o `msg` do toast de sucesso (substitui "Inserido em slot existente" / "Nova seção criada").

**Hints por tipo:**

| Tipo | Mensagem |
|---|---|
| `scatter` | "Par com correlação {forte/moderada/fraca} {positiva/negativa} (r=0.85): Coluna X × Coluna Y" |
| `gauge` | "Range automático via percentis. Meta sugerida: {percentil 75/25 ou mediana}." |
| `boxplot` | "Agrupado por 'X' (categórica detectada com 2-8 grupos)." (se groupColumn auto-selecionada) |
| `sankey` | "Fluxo: Origem → Destino" OU "Apenas 1 categórica detectada. Configure destino em ⚙️..." |

Hint vai também para o `Audit.record('add_component')` em `details.smartHint`.

---

## Paths novos no Store (Bloco 7)

Nenhum — `SolsticeStats` é puro, sem state. Aba "📈 Análise" não persiste em Store (recomputada por render).

---

## Estilos CSS novos (Bloco 7)

```css
.solstice__stats-explain    /* caixa accent com "Por que esse número?" */
.solstice__stats-section-title  /* uppercase com underline */
.solstice__stats-row        /* label-value flex */
.solstice__stats-label      /* coluna esquerda, ellipsis, cursor:help */
.solstice__stats-value      /* mono + tabular-nums, alinhado à direita */
.solstice__stats-empty      /* estado vazio centralizado */
.solstice__stats-note       /* destaque warn para insights estatísticos */
.solstice__stats-footer     /* mono pequeno tracejado para snippet de console */
```

---

## Cap de tamanho dos componentes (Patch B7-r1)

ADR-062 estabelece dimensões máximas para componentes visuais. Sem aspect-ratio livre — usa `max-width` + `max-height` per tier:

| Classe | Tier | max-width | max-height |
|---|---|---|---|
| `.solstice__chart-svg` (base) | — | 600px | 380px |
| `.solstice__chart-svg--compact` | <240px container | 360px | 230px |
| `.solstice__chart-svg--standard` | <420px container | 480px | 320px |
| `.solstice__chart-svg--large` | ≥420px container | 600px | 380px |
| `.solstice__chart-wrap` (Chart.js) | — | 100% | 380px |
| `.solstice__chart-wrap canvas` | — | 100% | 380px |
| `.solstice__hist` (Distribution) | — | 600px | 200px (fixo) |
| `.solstice__md` (Markdown) | — | 100% | 380px + scroll |
| `.solstice__comp` (casca) | — | (do slot) | 460px + overflow:hidden |

`margin: 0 auto` adicionado em SVGs e markdown para centralização (letterboxing).

**Regra de checklist para blocos futuros:** todo componente novo com SVG/canvas/embed deve declarar max-width E max-height (ou cumprir via classe `.solstice__chart-svg` herdada).

---

## `Solstice.Inspector` (Patch B7-r2 · ADR-063)

Gerencia o painel lateral direito (`#inspector`) que abre/fecha conforme seleção de componente.

```js
open()                       // adiciona .has-inspector ao .solstice__app
close()                      // remove .has-inspector + limpa body/footer; também chama
                             //   SolsticeProps.deselect({skipInspector:true}) para evitar loop
setTitle(iconText, label)    // popula #inspector-title com ícone + label
setFooter(buttonEl)          // popula #inspector-footer; passar null/undefined esconde
getBody()                    // → HTMLElement do #inspector-body
isOpen()                     // → boolean
init()                       // chamado por boot — bind do ✕
```

**Paths no Store usados:**

| Path | Tipo | Setado por |
|---|---|---|
| `ui.inspector.open` | boolean | open/close |
| `ui.inspector.slotId` | string \| null | Props.select / close |

---

## `Solstice.Analysis` (Patch B7-r2 · ADR-065)

Drawer inferior com análise estatística do componente selecionado.

```js
open(slotId)                 // renderiza e mostra; .has-analysis no app
close()                      // esconde + limpa body/footer
toggle(slotId)               // open se fechado ou outro slot; close se mesmo slot
render(slotId)               // re-render manual (também acionado por mudanças em canvas.sections)
isOpen()                     // → boolean
getCurrentSlotId()           // → string | null
init()                       // chamado por boot — bind do ✕ + subscribe canvas.sections
```

**Conteúdo (mesma lógica do antigo _renderStatsTab do B7, agora em grid):**
- Cabeçalho "🔬 Por que esse número? Análise calculada sobre N..."
- Cards universais: 📊 Distribuição central · 📏 Faixa e quartis · 🔍 Forma · ⚠️ Outliers
- Cards contextuais:
  - `time-series` → 📈 Tendência + 🔮 Forecast linear (5)
  - `scatter` → 🔗 Correlação (Pearson + Spearman + nota se |ρ|−|r| > 0.15)
  - `gauge` com target → 🎯 Distância da meta
  - `boxplot` com groupColumn → 📦 Por grupo (top 6)
- Footer com snippet de console reproduzindo as métricas

**Markdown não tem análise** — empty state explicativo.

**Paths no Store:**

| Path | Tipo | Setado por |
|---|---|---|
| `ui.analysis.open` | boolean | open/close |
| `ui.analysis.slotId` | string \| null | open/close |

---

## `Solstice.createAccordion(opts)` (Patch B7-r2 · ADR-064)

Helper top-level (também exposto em `Solstice.createAccordion`) para criar seção accordion expansível. Usado pelo Inspector e pelo catálogo de componentes.

```js
createAccordion({
  icon:          string,    // emoji (opcional)
  title:         string,    // título da seção
  key:           string,    // chave de persistência: Store.ui.accordion.<key>
                            //   se omitido, deriva do título (lowercased + slugified)
  count:         number,    // opcional — mostrado entre parênteses (ex: "(5)")
  openByDefault: boolean,   // default true
  build:         (body) => void   // popula o body quando renderizado
})
                             // → HTMLElement <div class="solstice__accord">
```

**Comportamento:**
- Lê estado em `Store.ui.accordion.<key>`; se ausente, usa `openByDefault`
- Clique no head toggle a seção + persiste no Store
- CSS class `is-open` controla visibilidade do body + rotação do chevron

---

## Refactor `SolsticeProps` (Patch B7-r2)

**Mudanças nas funções existentes:**

```js
select(slotId)               // antes: renderizava em #props-panel da sidebar
                             // agora: chama Inspector.open + setTitle + setFooter
                             //   + popula Inspector.getBody() com accordions
                             //   também seta Store.ui.inspector.slotId

deselect(opts?)              // NOVO opts:
                             //   { skipInspector: boolean }  — não chama Inspector.close
                             //     quando o próprio Inspector.close já chamou deselect
                             //   evita loop infinito

render()                     // refeita: constrói 5 accordions (Dados / Comparação(KPI) /
                             //   Visual / Decisões / Origem) reaproveitando as funções
                             //   _renderDataTab, _renderComparisonTab, etc. como build callbacks.
                             //   A aba "📈 Análise" do B7 NÃO está mais aqui — foi para o drawer.

_renderStatsTab(...)         // ainda existe no código (dead code) — pode ser removido
                             //   numa limpeza futura. Não é mais chamado por render().
```

**Aba "📈 Análise" removida do inspector** — agora vive em `SolsticeAnalysis` (drawer).

---

## Refactor `SolsticeComponents.render` casca (Patch B7-r2)

Novo botão **📈** no header da casca do componente (junto com 🔬 🔍 ⚙️ 🗑️):

```js
SolsticeUtils.el('button', { class:'solstice__comp-btn', title:'📈 Análise estatística',
  onclick: (e) => { e.stopPropagation(); SolsticeAnalysis.toggle(slot.id); } }, '📈')
```

Total: 5 botões no hover do header da casca. Não impacta KPI/Markdown porque o botão chama `toggle` (drawer só renderiza algo se houver coluna numérica primária).

---

## Refactor `SolsticeSidebarTabs._renderComponentsPanel` (Patch B7-r2)

Catálogo de componentes agora em **accordion por grupo**:

```js
const groups = [
  { key: 'basicos',   title: 'Básicos',   icon: '📊', openByDefault: true,
    ids: ['kpi', 'time-series', 'distribution', 'table'] },
  { key: 'avancados', title: 'Avançados', icon: '⚡', openByDefault: false,
    ids: ['scatter', 'heatmap-cal', 'gauge', 'boxplot', 'sankey'] },
  { key: 'texto',     title: 'Texto',     icon: '📝', openByDefault: false,
    ids: ['markdown'] }
];
```

Cada grupo é uma seção accordion. Estado persistido em `Store.ui.accordion.catalog.<group>`.

**⚠️ Manutenção:** ao adicionar componente novo em `SolsticeComponents.register`, atualize o array `groups` acima para o componente aparecer no catálogo.

Footer fixo: "💡 Selecione um componente no canvas para editar suas propriedades no painel da direita →"

---

## Paths novos no Store (Patch B7-r2)

| Path | Tipo | Setado por |
|---|---|---|
| `ui.inspector.open` | boolean | `Inspector.open/close` |
| `ui.inspector.slotId` | string \| null | `Props.select` / `Inspector.close` |
| `ui.analysis.open` | boolean | `Analysis.open/close` |
| `ui.analysis.slotId` | string \| null | `Analysis.open/close` |
| `ui.accordion.<key>` | boolean | `createAccordion` (toggle de cada seção) |

Convenção de keys de accordion:
- `inspector.dados`, `inspector.comparacao`, `inspector.visual`, `inspector.decisoes`, `inspector.origem`
- `catalog.basicos`, `catalog.avancados`, `catalog.texto`

---

## Estilos CSS novos (Patch B7-r2)

```css
.solstice__inspector              /* aside grid-area inspector */
.solstice__inspector-head         /* sticky top + título + ✕ */
.solstice__inspector-title        /* uppercase + ícone */
.solstice__inspector-title-icon
.solstice__inspector-body         /* scrollable */
.solstice__inspector-footer       /* sticky bottom */
.solstice__btn--destructive       /* rodapé do inspector (Remover) */

.solstice__accord                 /* accordion wrapper */
.solstice__accord-head            /* clicável, hover surface-3 */
.solstice__accord-head-label
.solstice__accord-head-count      /* "(5)" em mono pequeno */
.solstice__accord-chevron         /* gira 90° quando is-open */
.solstice__accord-body            /* display: none, animação solstice-accord-in 150ms */
.solstice__accord.is-open

.solstice__analysis               /* drawer fixed bottom */
.solstice__analysis-head          /* título + meta + ✕ */
.solstice__analysis-title
.solstice__analysis-title-meta
.solstice__analysis-body          /* grid auto-fit 220px */
.solstice__analysis-card          /* surface-2 com title underline tracejado */
.solstice__analysis-card-title
.solstice__analysis-explain       /* card destacado accent */
.solstice__analysis-footer        /* mono pequeno com snippet */

.solstice__catalog-group          /* container do grid dentro do accordion */
.solstice__catalog-helper         /* footer dica "→ direita" */
```

**Regra do app:** `.solstice__app` ganhou classes-toggle `.has-inspector` e `.has-analysis` que disparam as transições. CSS responsivo `< 1200px` muda inspector para `position: fixed`.

---

## `Solstice.Insights` (Bloco 8 · ADR-066)

Painel de Insights Executivos automáticos no topo do canvas. Analisa o dataset e gera 0-8 cards ordenados por score.

```js
compute()                      // → array<Insight> com até 8 itens ordenados por score desc
                               //   Insight = { id, kind, icon, title, text, severity, score, meta }
                               //   kind: 'trend' | 'outliers' | 'pareto' | 'seasonality' | 'recency' | 'top'
                               //   severity: 'success' | 'warn' | 'error' | 'info'
                               //   score: 0-100

renderInto(parentEl)           // anexa painel colapsável ao parentEl (canvas)
                               //   Só renderiza se há insights (≥ 1)
list()                         // → cópia do cache de insights computados
init()                         // chamado por boot — subscribe em ingest + dictionary
```

**6 tipos detectados:**

| Kind | Quando dispara |
|---|---|
| `trend` | magnitude > 10% + R² > 0.30 numa numérica |
| `outliers` | > 2% via IQR 1.5× |
| `pareto` | cat (3-30 distintos) × num · concentração detectada |
| `seasonality` | autocorrelação no lag 12 > 0.4 · ≥ 24 meses |
| `recency` | 1ª metade vs 2ª metade dos registros, \|Δ\| > 20% |
| `top` | categoria dominante > 40% do total |

**Severity** respeita `higherIsBetter` do dicionário (trend up + good = success; trend up + bad = error).

---

## `Solstice.Narrative` (Bloco 8 · ADR-067 · Diferencial #2)

Gerador de narrativa automática pt-BR template-based. Botão "📖 Gerar narrativa" no rodapé do inspector.

```js
build(slotId)                  // → string com narrativa em parágrafos (\n\n separa)
openModal(slotId)              // → Promise — modal interativo com export
setTone(tone)                  // tone: 'executivo' | 'analitico' | 'casual'
setDepth(depth)                // depth: 'short' | 'medium' | 'long'
getTone() / getDepth()         // getters
_T                             // → templates internos (debug)
```

**Templates internos** (`_T`):
- `intro` (sempre)
- `trend_up/trend_down/trend_flat` (medium+)
- `directional_good/directional_bad` (se higherIsBetter conhecido)
- `outliers_present` (long only)
- `comparison` (KPI com config.comparison)

**Modal opcoes:**
- Pills de Tom (3) e Profundidade (3) — atualiza preview em tempo real
- 📋 Copiar (navigator.clipboard)
- ⬇️ Markdown (download .md)
- ✉️ Email (mailto:)

---

## `Solstice.Agent` (Bloco 8 · ADR-068)

Observa mudanças do `ingest` e dispara toast contextual proativo. Cap 3/sessão.

```js
init()                         // chamado por boot — subscribe ingest
status()                       // → { fired, cap, keys }   — debug
_reset()                       // zera contagem + keys
```

**Gatilhos:** após import, computa `Insights.compute()` e analisa top 1:
- `kind === 'trend'` → toast "📈 Tendência detectada" + botão "Ver insights"
- `kind === 'outliers'` (severity warn/error) → toast "⚠️ Outliers detectados" + botão "Criar Box Plot"
- `kind === 'pareto'` → toast "🎯 Concentração de Pareto" + botão "Ver insights"

Cada toast tem `duration: 6000ms`, `actionLabel`, `actionFn`.

---

## `Solstice.Inconsistencies` (Bloco 8 · ADR-069)

Catálogo de 15 regras analíticas declarativas. Cada regra: `{ id, label, severity, description, hint, when(ctx) → bool }`.

```js
catalog()                      // → array com metadados das 15 regras
                               //   { id, label, severity, description, hint }
checkSlot(slotId)              // → array<Hit> com regras que disparam para o slot
                               //   Hit = { id, label, severity, description, hint }
RULES                          // → array bruto das regras (debug/extensão)
```

**15 regras catalogadas:**

| ID | Severity | Detecta |
|---|---|---|
| `avg-of-avg` | warn | KPI com média em coluna já agregada |
| `sum-of-pct` | warn | Soma de percentual |
| `sum-of-id` | error | Soma de IDs/CPF/CNPJ |
| `count-vs-sum-confusion` | info | Soma com poucos registros (<30) — confirme intenção |
| `high-null-col` | warn | Coluna selecionada com >50% nulos |
| `gauge-meta-fora-range` | warn | Meta fora do min/max do gauge |
| `sankey-same-cols` | error | source === target |
| `distrib-bins-extremos` | info | bins < 6 ou > 60 |
| `boxplot-grupos-demais` | warn | groupColumn com > 8 distintos |
| `scatter-poucos-pontos` | info | < 10 pares válidos |
| `monovalor` | warn | Coluna com 1 distinct |
| `comparison-no-temporal` | warn | "previous-period" sem coluna temporal |
| `time-series-poucos-pontos` | info | < 5 pontos no bin |
| `agg-incompat-comparison` | warn | Baseline estatisticamente inválida |
| `tabela-sem-filtro-grande` | info | > 500 linhas |

Avisos aparecem como **accordion "⚠️ Avisos"** no topo do inspector lateral (`createAccordion`).

---

## `Solstice.Ask` (Bloco 8 · ADR-070)

"Pergunte ao Solstice" via **Ctrl+P**. Command palette estilo Spotlight com parser regex pt-BR.

```js
open()                         // mostra overlay com input focused
close()                        // remove overlay
isOpen()                       // → boolean
init()                         // chamado por boot — bind Ctrl+P + intercept print

parse(query)                   // → { ok: bool, title?, value?, formula?, error? }
                               //   Sem state — função pura, testável
```

**7 padrões reconhecidos:**

```
"qual a média de receita"               → Stats.mean
"qual a mediana de margem_bruta"        → Stats.median
"quantos outliers em ticket_medio"      → Stats.outliersIQR
"correlação entre receita e quantidade" → Stats.correlation (Pearson)
"top 5 em regiao por receita"           → group + sort
"tendência de receita"                  → Stats.trend
"quantos registros"                     → rows.length
"quantas categorias em canal"           → Stats.distinctCount
```

**Resolver de coluna** aceita:
- Nome técnico exato (case-insensitive)
- friendlyName do dicionário (case-insensitive)
- Match parcial (startsWith) em qualquer dos dois

Resposta inclui campo `formula` explicando matematicamente o cálculo.

---

## Estilos CSS novos (Bloco 8)

```css
.solstice__insights              /* gradient accent · border · radius */
.solstice__insights-head         /* sticky · cursor pointer · uppercase */
.solstice__insights-title
.solstice__insights-count        /* badge mono pequeno */
.solstice__insights-actions
.solstice__insights-toggle       /* chevron 200ms */
.solstice__insights.is-collapsed
.solstice__insights-body         /* grid auto-fit minmax 260px */
.solstice__insight-card
.solstice__insight-card--{success/warn/error/info}  /* border-left 3px */
.solstice__insight-icon / -title / -text / -meta

.solstice__narrative-body        /* whitespace pre-wrap · max-height 360px scroll */
.solstice__narrative-controls    /* flex pills */
.solstice__narrative-pill        /* + is-active variant */
.solstice__narrative-label       /* uppercase letter-spacing */

.solstice__inconsist             /* badge inline warn */

.solstice__ask-overlay           /* fixed z-400 + backdrop blur */
.solstice__ask-panel             /* max-width 640px */
.solstice__ask-input-wrap / -input / -kbd / -body
.solstice__ask-suggestion        /* mono pequeno surface-2 */
.solstice__ask-result            /* destacado accent · result-value 18px bold mono */
.solstice__ask-result-formula
.solstice__ask-error             /* warn surface */
```

---

## Paths novos no Store (Bloco 8)

| Path | Tipo | Setado por |
|---|---|---|
| `ui.insights.collapsed` | boolean | toggle do header do painel |

(Insights, Narrative, Agent, Inconsistencies, Ask são em sua maioria stateless — computam sob demanda.)

---

## Atalho global novo (Bloco 8)

| Tecla | Ação |
|---|---|
| `Ctrl + P` / `Cmd + P` | Toggle do "Pergunte ao Solstice" (intercepta print do browser quando foco não está em input) |

---

## `Solstice.Filters` (Bloco 9 · ADR-072)

Engine + UI de filtros globais. Aplica nos componentes via `SolsticeComponents._ctx()`.

```js
apply(rows)                    // → array filtrado (aplica Store.filters + Store.crossfilter)
getActiveRows()                // → ingest.rows filtrados (atalho)
set(col, value)                // sobrescreve filtro de coluna; passe null/[] para limpar
get(col)                       // → valor atual do filtro da coluna
clear()                        // limpa todos os filtros + crossfilter
activeCount()                  // → quantos filtros ativos
suggested()                    // → array<{column, kind, ...}> de colunas filtrables
                               //   categorical (2-30 distintos), temporal (≥30), numeric (IQR > 0)
renderInto(parentEl)           // anexa barra de filtros (acima do Insights, abaixo da toolbar)
init()                         // subscribe em filters + crossfilter para re-render do canvas
```

**Shape de Store.filters:**
```js
{
  regiao: ['Sul', 'Sudeste'],                  // categorical
  receita: { min: 1000, max: 50000 },          // numeric
  data: { from: '2025-01-01', to: '2025-12-31' } // temporal (ISO strings)
}
```

**Path no Store:** `ui.filters.collapsed` (boolean — barra colapsada/expandida).

## `Solstice.CrossFilter` (Bloco 9 · ADR-073)

Filtro temporário disparado por clique em componente. Distinto dos filtros globais.

```js
activate(column, value)        // ativa cross-filter; substitui anterior
clear()                        // limpa
get()                          // → { column, value } | null
isActive()                     // → boolean
renderInto(parentEl)           // anexa barra accent "🎯 Cross-filter: X = Y · ✕ Limpar"
init()                         // bind Esc (cascata depois de drawer/inspector)
```

**Componentes que disparam (B9):**
- **Sankey** — clique em node (origem ou destino) → cross-filter na coluna correspondente

**Componentes futuros (B10+):** Scatter (clique em ponto), Distribution (clique em barra), Box Plot (clique em grupo).

**Path no Store:** `crossfilter` (objeto `{ column, value }` ou `null`).

## `Solstice.Params` (Bloco 9 · ADR-074)

Parâmetros globais como K/V tipados.

```js
get(name)                      // → valor (raw) ou undefined
getAll()                       // → { name: { type, value }, ... }
set(name, def)                 // def = { type, value } OU valor cru (mantém type existente)
remove(name)                   // deleta um parâmetro
resolveText(text)              // → string com {{param.X}} substituídos
openModal()                    // modal CRUD com 3 colunas: nome / tipo / valor / remover
init()                         // no-op (Store-based)
```

**Tipos suportados:** `string`, `number`, `date`.

**Onde resolveText é usado:** `SolsticeComponents.markdown.render` chama antes da substituição legada `{{path.no.store}}`.

**Path no Store:** `params` (objeto `{ name: { type, value }, ... }`).

## `_ctx()` refatorado (Bloco 9)

`SolsticeComponents._ctx()` agora retorna:

```js
{
  rows,                        // filtrados (apply de Filters + CrossFilter)
  rowsAll,                     // NOVO: dataset SEM filtros — use para defaultConfig
  columns,
  types,
  dictionary,
  L
}
```

**Migração:** componentes que precisam ver dataset completo (Auto-Dashboard B10, smart defaults) devem trocar `ctx.rows` por `ctx.rowsAll`.

## Estilos CSS novos (Bloco 9)

```css
.solstice__filterbar / -head / -title / -count.has-active / -actions / -toggle / -body / -empty
.solstice__filter / -label / -clear
.solstice__ms / -trigger / -trigger-placeholder / -chip / -chip-more
.solstice__ms-panel / -search / -option / -option-count / -empty
.solstice__range / -track / -fill / -input / -values
.solstice__datefilter / -presets / -preset.is-active / -range
.solstice__crossfilter-bar / -bar-text / -bar-clear
.solstice__params-list / -row / -empty
```

## Paths novos no Store (Bloco 9)

| Path | Tipo | Setado por |
|---|---|---|
| `filters` | `{ col: value }` | `Filters.set / clear` |
| `crossfilter` | `{ column, value } \| null` | `CrossFilter.activate / clear` |
| `params` | `{ name: { type, value } }` | `Params.set / remove / openModal` |
| `ui.filters.collapsed` | boolean | toggle do header da barra |

---

## `Solstice.ColumnScore` (Bloco 10 · ADR-075)

Score de importância de coluna 0-100 via 8 critérios.

```js
scoreImportance(col, ctx)      // → number 0-100
rank(ctx)                      // → array<{col, score}> ordenado desc
top(ctx, n=8)                  // → top N do rank
WEIGHTS                        // → { coverage:.18, variation:.16, ... }
```

**8 critérios:** coverage · variation · cardinalidade · higherIsBetter · dictMatch · typeImportance · position · synonymBonus.

## `Solstice.Recommender` (Bloco 10 · ADR-076)

Recomendações de visualização para o dataset atual.

```js
recommend(ctx, opts)           // → array<{componentType, config, confidence, reasoning, ruleId, label}>
                               //   opts: { intent: 'comparar' | 'tendencia' | ... | null }
                               //   ordenado por confidence desc
listRules()                    // → array<{id, label}> (15 regras)
listIntents()                  // → array de intent ids (11+1 custom)
INTENT_RULES                   // → mapa intent → ruleIds aceitos
RULES                          // → array bruto das regras (debug)
```

**Confidence:** 0-100. Hard-coded na maioria; calculado para scatter (50 + |r|·50) e outliers (60 + pct·200).

**15 regras incluídas:** kpi-from-hib, kpi-from-top-numeric, time-series, scatter-correlated, boxplot-grouped, distribution-single-num, sankey-two-cats, gauge-pct, gauge-from-hib, heatmap-cal, top-categorical, table-fallback, forecast-series, outlier-hunt, markdown-narrative.

## `Solstice.AutoDashboard` (Bloco 10 · ADR-077)

Pipeline automático.

```js
run(opts)                      // opts: { intent?, force? }
                               //   force=true sempre mostra modal de confirmação
                               //   sem force: pula confirmação se avgConf ≥ 70%
_buildSections(recs)           // → array de sections com slots configurados
                               //   KPIs/Gauges primeiros em 3-col, resto em 2-col-equal
                               //   até 4 sections (4ª = "Detalhamento")
```

**Modal de confirmação:** lista checkmarcável com nome do componente + ícone + reasoning + badge de confidence (high ≥75 / med ≥60 / low <60).

**Audit:** `action: 'auto_dashboard'` com `details: { intent, count, avgConfidence, recIds }`.

## `Solstice.Wizard` (Bloco 10 · ADR-078)

Wizard modal multi-step.

```js
open()                         // → Promise — modal 3-step
listIntents()                  // → array<Intent>
INTENTS                        // → array<Intent> (11+1)
```

**Intent shape:** `{ id, icon, title, desc, kind: 'agnostico'|'analitico'|'custom' }`.

**11 intenções:**

| ID | Kind | Title |
|---|---|---|
| comparar | agnóstico | Comparar |
| distribuir | agnóstico | Distribuir |
| tendencia | agnóstico | Tendência |
| ranking | agnóstico | Ranking |
| composicao | agnóstico | Composição |
| correlacao | agnóstico | Correlação |
| tabular | agnóstico | Tabular |
| forecast | analítico | Forecast |
| outlier | analítico | Caça outliers |
| pareto | analítico | Pareto 80/20 |
| periodos | analítico | Comparar períodos |
| custom | custom | Personalizado |

## Estilos CSS novos (Bloco 10)

```css
.solstice__wizard / -steps / -step / -step.is-current / .is-done / -step-num / -content
.solstice__intents-grid
.solstice__intent-card / .is-selected / -icon / -title / -desc / -badge / -badge--analytic
.solstice__recs-list / .solstice__rec-item / -body / -title / -icon / -reason
.solstice__rec-item-confidence (variantes --high / --med / --low)
.solstice__recs-summary
```

## Botões novos na toolbar do canvas (Bloco 10)

| Botão | Aciona |
|---|---|
| 🪄 Auto-Dashboard | `SolsticeAutoDashboard.run({ force: true })` |
| 🧙 Wizard | `SolsticeWizard.open()` |

Ambos só aparecem com dataset carregado (`dataset.ready`).

---

## `Solstice.Snapshots` (Bloco 11 · ADR-079)

CRUD de snapshots em localStorage por perfil.

```js
list()                         // → array<Entry> { id, name, savedAt, size, rowsCount, data }
                               //   data = LZ-Base64 do JSON do state
save(name?)                    // → Entry novo · cap 30 (descarta antigo)
load(id)                       // → boolean (aplica state)
remove(id)
rename(id, newName)
openModal()                    // → Promise — modal CRUD completo
_captureState()                // → state object (sem comprimir, debug)
init()                         // no-op
```

**State shape:** `{ canvas: { sections, header }, filters, params, dictionary, ingest: { sourceName, columns, types, rows } }`.

**Path no localStorage:** `solstice.snapshots.<profileId>`.

---

## `Solstice.Versions` (Bloco 11 · ADR-080)

Histórico automático em memória.

```js
list()                         // → array<{index, ts}>
restore(index)                 // → boolean (substitui canvas.sections)
openModal()                    // modal com lista clicável
_capture()                     // captura manual (geralmente desnecessário)
init()                         // subscribe em canvas.sections
```

**Cap:** 10 versões. **Persistência:** memória (zera no reload).

---

## `Solstice.FileSystem` (Bloco 11 · ADR-081)

File System Access API + fallback download/upload.

```js
saveJSON(state, suggestedName) // → Promise<bool>
openJSON()                     // → Promise<state | null>
saveBlob(blob, suggestedName)  // → Promise<bool>
isSupported()                  // → boolean (mostra UI condicional)
init()                         // bind Ctrl+S/Ctrl+O
```

**Atalhos novos:**
- `Ctrl + S` — snapshot rápido (auto-nomeado com timestamp)
- `Ctrl + O` — abre modal de Snapshots

Não interceptam quando foco está em input/textarea/contenteditable.

---

## `Solstice.Export` (Bloco 11 · ADR-082)

Gera HTML standalone ou JSON.

```js
buildStandaloneHTML({ includeData=true })  // → string HTML completo
openExportModal()                          // → Promise — modal com 3 opções
```

**3 opções no modal:**
1. **HTML standalone com dados** — dashboard inteiro + dataset embutido (~600 KB + dataset)
2. **HTML sem dados** (template) — só estrutura; usuário do destino reimporta CSV
3. **JSON puro** (`.solstice.json`) — estado serializado, sem HTML

**Hidratação automática:** HTML exportado lê `<meta name="solstice-embedded">` + `<script id="solstice-embedded-state">`, descomprime, popula Store via `batch()`, força render. Loga sentinela verde `[Solstice] Estado embedded rehidratado`.

---

## `Solstice.TemplatesItau` (Bloco 11 · ADR-083)

3 templates pré-instalados para dicionário Banco PJ.

```js
list()                         // → array dos 3 templates
TEMPLATES                      // → mesma coisa (debug)
init()                         // anexa a SolsticeTemplates.DOMAIN
```

**Templates (ids):**
- `itau-carteira-pj-mensal` — 🏦 Carteira PJ — Visão Mensal
- `itau-inadimplencia` — ⚠️ Acompanhamento de Inadimplência
- `itau-pipeline-comercial` — 📈 Pipeline Comercial PJ

Aparecem no picker do `SolsticeTemplates` quando `dictKey === 'banco_pj'`.

---

## Botões novos na toolbar do canvas (Bloco 11)

| Botão | Aciona | Visível quando |
|---|---|---|
| 📂 Abrir | `SolsticeSnapshots.openModal()` | sempre |
| 💾 Salvar | `SolsticeSnapshots.save()` + toast | dataset carregado |
| ⬇️ Exportar | `SolsticeExport.openExportModal()` | dataset carregado |
| 🕐 Histórico | `SolsticeVersions.openModal()` | dataset carregado |

---

## Abas novas na sidebar (Bloco 11)

| Aba | Painel | Função |
|---|---|---|
| 🧠 Dicionários | `#dicionarios-panel` | Dicionário ativo + salvos + 6 pré-feitos aplicáveis com 1 clique |
| 📸 Snapshots | `#snapshots-panel` | Lista compacta dos snapshots do perfil com 📂/🗑️ inline |

---

## Estilos CSS novos (Bloco 11)

```css
.solstice__snaps-list / .solstice__snap-item / -thumb / -body / -name / -meta / -actions / -empty
.solstice__dicts-panel / -list / .solstice__dict-item / -icon / -body / -name / -meta / -actions
.solstice__export-options / .solstice__export-option / -title / -desc / -meta
```
