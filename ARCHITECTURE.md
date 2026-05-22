# Arquitetura do Solstice

> Documento vivo. Atualizar quando decisões arquiteturais relevantes mudarem.

---

## Visão de 30 segundos

Solstice é um **dashboard studio single-file** — todo o produto cabe em `solstice_baseline.html` (~2 MB). Importa CSVs, monta dashboards interativos, faz análises estatísticas e roda **inteiramente no browser**, sem servidor, sem build, sem login.

O arquivo abre direto do `file://` ou via qualquer HTTP estático. Estado persiste em `localStorage`. As únicas dependências externas são 3 libs via CDN (Chart.js, PapaParse, XLSX) com SRI travado.

---

## Princípios deliberados

1. **Single-file.** Tudo no `solstice_baseline.html`. Trade: bundle ~2 MB vs. portabilidade absoluta.
2. **Sem framework.** Vanilla JS. Trade: mais código em rendering vs. boot rápido sem React/Vue.
3. **Sem build.** Edite o HTML, recarregue, viu. Trade: sem tree-shaking vs. dev-loop trivial.
4. **Vanilla CSS via `@layer`.** Tokens semânticos + BEM. Trade: sem CSS-in-JS vs. cascade controlado.
5. **Estado em `localStorage`.** Persistência implícita. Trade: limite 5-10 MB vs. offline-first.
6. **Desktop-only (≥1100px).** Notebook/desktop é o caso de uso. Mobile descartado — fora de escopo.

---

## Diagrama de camadas

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser (Chrome/Firefox/Safari/Edge)                              │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  solstice_baseline.html                                       │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  UI LAYER                                               │  │ │
│  │  │  Header · Sidebar · Canvas · Inspector · Toasts · Modal │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  COMPONENT LAYER  (registry: SolsticeComponents)        │  │ │
│  │  │  KPI · BigNum · Tabela · Pivot · Time-Series · ...      │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  DOMAIN LAYER                                            │  │ │
│  │  │  Inference · Dictionary · Formula · FormulaRow · Filters │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  CORE LAYER                                              │  │ │
│  │  │  Store · Utils · Storage · Stats · FormulaCore · Log     │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  CSS TOKENS                                              │  │ │
│  │  │  Cores · Tipografia · Spacing · Radius · Sombras · Motion│  │ │
│  │  │  7 paletas × 2 modos × 3 densidades                     │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  PERSISTENCE                                                  │ │
│  │  localStorage  (theme, profile, snapshots, settings, ingest)  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  CDN (com SRI travado)                                        │ │
│  │  Chart.js 4.4 · PapaParse 5.4 · XLSX 0.18.5                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  OPCIONAIS (opt-in pelo usuário)                              │ │
│  │  DuckDB-WASM  ·  LLM (OpenAI/Anthropic/Groq/Ollama)           │ │
│  └───────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## Módulos centrais (top 10 por uso)

| Módulo | Chamadas | Papel |
|---|---|---|
| `SolsticeUtils` | 1.929 | Construtor universal de DOM (`el()`), helpers (`debounce`, `escapeHtml`, `trackListener`, `cleanupListeners`, `primaryBtn/ghostBtn`, `sp/col/rad`) |
| `SolsticeStore` | 616 | Estado central com subscribe por path (`a.b.c`). Single source of truth |
| `SolsticeToast` | 212 | Feedback UX (success/warn/error/info) |
| `SolsticeStats` | 157 | Lib estatística (min/max/minMax/mean/median/quartiles/correlação/etc) |
| `SolsticeTypes` | 117 | Classificação semântica de colunas |
| `SolsticeLocale` | 107 | Formatação pt-BR (números, datas, moedas) |
| `SolsticeModal` | 99 | Sistema de modais (`show`/`confirm`/`prompt`/`select`) |
| `SolsticeAudit` | 84 | Trilha de auditoria de ações (provenance) |
| `SolsticeHumanize` | 79 | Friendly names para colunas técnicas (`user_id` → "ID do usuário") |
| `SolsticeComponents` | 70 | Registry de tipos de componente |

---

## Estado central — `SolsticeStore`

Estado é uma árvore JS plana acessada por path:

```javascript
SolsticeStore.set('canvas.sections', [...])    // dispara subs em 'canvas.sections' E 'canvas'
SolsticeStore.subscribe('dataset.ready', cb)   // dispara quando muda
SolsticeStore.batch(fn, { except: ['ingest'] }) // mute notify exceto paths especificados
```

### Paths principais (50 únicos · top 10)

```
canvas.sections      ← seções/rows/slots do dashboard (147 ops)
ingest               ← dataset bruto + tipos + issues (118 ops)
dictionary           ← dicionário aplicado (67 ops)
dataset.ready        ← flag de "tem dados pra trabalhar" (33 ops)
datasets             ← lista de datasets carregados (multi-CSV) (21 ops)
datasets.activeId    ← qual dataset está ativo (17 ops)
filters              ← filtros globais (17 ops)
dataset.name         ← nome do CSV ativo (14 ops)
params               ← parâmetros (variáveis substituídas em fórmulas) (14 ops)
canvas               ← raiz (sections + header + pages)
```

### Contrato `SolsticeStoreContract`

Sete módulos com `set()` próprio (Theme, Locale, IngestState, DashHeader, Filters, Params, Modes) cumprem a interface mínima `{ get, set, subscribe }`. Validável em runtime via `SolsticeStoreContract.isStoreLike(obj)`.

---

## Persistência — chaves do `localStorage`

| Chave | Conteúdo | Tamanho típico |
|---|---|---|
| `solstice.theme` | `{ mode, palette, density }` | < 100 B |
| `solstice.theme.customAccent` | Hex da cor custom | < 20 B |
| `solstice.profiles` | Lista de perfis (visitante + custom) | < 1 KB |
| `solstice.profiles.current` | ID do perfil ativo | < 50 B |
| `solstice.snapshots.<profile>` | Snapshots versionados, **LZ-compressed** | 100 KB a 5 MB |
| `solstice.workspace.<id>` | Workspace state LZ-compressed | 50-500 KB |
| `solstice.dicts` | Dicionários salvos pelo usuário | 1-50 KB |
| `solstice.locale` | `pt-BR` (string única) | < 20 B |
| `solstice.debug` | `'1'` ou `'0'` | 1 B |
| `solstice.beginnerMode` / `friendlyMode` | `'1'` ou `'0'` | 1 B |
| `solstice.duck.enabled` | DuckDB opt-in | 5 B |
| `solstice.branding` | `{ title, logo, color }` | < 500 B + logo data URL |
| `solstice.settings.minimap.enabled` | UX toggle | 5 B |

**Limite total:** ~5-10 MB por origin (browser-dependent). Snapshots de dashboards grandes podem ocupar boa parte.

**Estratégia em falha:** `SolsticeStorage.safeSet(key, value)` retorna `boolean`. Em falha (cota cheia, modo anônimo), dispara `SolsticeToast.warn` uma vez por sessão e retorna `false` — o caller decide se aborta a ação.

---

## Fluxo de dados — ciclo de uma ação

Exemplo: usuário edita o título de uma seção do dashboard.

```
1. UI: usuário clica em "Editar título" → input edita inline
2. blur do input → handler dispara
3. SolsticeCanvas.editSections(sections => {
     sections.find(s => s.id === secId).title = newTitle;
   })
4. SolsticeStore.set('canvas.sections', sections) é chamado por dentro
5. Subscribers de 'canvas.sections' (e 'canvas') são notificados:
   - SolsticeCanvas.render()         → repinta canvas
   - SolsticeMinimap.render()         → atualiza minimap
   - SolsticeSelfAudit (se debug)     → registra mudança
6. UI: usuário vê o novo título refletido em todos os lugares (canvas, minimap)
```

### Side effects controlados

- `SolsticeAudit.record(action)` — append-only log em memória. Provenance trail.
- `SolsticeStorage.safeSet(key, val)` — escrita em localStorage com retry semântico.
- Listeners em document/window — sempre registrados via `SolsticeUtils.trackListener(host, ...)` para cleanup automático em `innerHTML = ''`.

---

## Inputs externos (superfície de ataque)

| Vetor | Validação |
|---|---|
| **CSV via `<input type="file">`** | Encoding detection (UTF-8/Latin-1/UTF-16 BE/LE) + mojibake detection; PapaParse com `dynamicTyping:false`; row limit configurável |
| **Texto do usuário (comentários, nomes, fórmulas)** | XSS bloqueado pela política de DOM seguro: `textContent` por padrão; `SolsticeUtils.escapeHtml` quando precisa de innerHTML |
| **LLM externo (OpenAI / Anthropic / Groq / Ollama)** | Opt-in pelo usuário; API key local; response parsed como JSON estruturado |
| **DuckDB-WASM** | Opt-in; queries SQL escapadas via prepared statements internas |
| **CDN scripts** | SRI sha384 travado em Chart.js 4.4 / PapaParse 5.4 / XLSX 0.18.5 |
| **Nenhum `eval` ou `new Function`** | Zero superfície de code injection |
| **Content Security Policy** | `<meta http-equiv>` no `<head>` restringe script-src a `cdn.jsdelivr.net` + inline |

---

## Performance — características conhecidas

### Hot paths
- `SolsticeCanvas.render()` é chamado a cada mudança em `canvas.sections`. Faz `innerHTML = ''` + reconstrução completa.
- `deepClone(Store.get('canvas.sections'))` aparece em 35 sites — clonagem profunda do canvas inteiro. Para dashboards >50 componentes, isso é O(N) por update.
- Inspector (`SolsticeProps.render`) repinta a cada `select(slotId)`.

### Estratégias de mitigação adotadas
- `SolsticeUtils.cleanupListeners(host)` antes de cada `innerHTML = ''` evita acúmulo de listeners em sessão longa.
- `SolsticeCanvas.withSlot(id, mutator)` e `editSections(mutator)` centralizam o padrão "clone + mutate + commit" (substitui busca aninhada section-row-slot).
- `SolsticeStats.minMax(arr)` usa loop O(n) em vez de `Math.min(...arr)` (evita stack overflow >125k itens).

### Limites de escala práticos
- **Dataset:** testado até ~100k rows. Acima disso, `Papa.parse` engasga (sem streaming) e renders de tabela ficam lentos.
- **Componentes simultâneos:** funciona bem até ~50. Above, cada drag/edit começa a notar latência (cascata de re-renders).
- **Sessões longas:** com listeners trackeados, sem leak observado em testes manuais.

### O que NÃO está otimizado (consciente)
- Boot é sequencial (0 `Promise.all`). Adicionar paralelismo daria ganho de ~30% mas exige análise de dependências.
- Tabelas grandes não têm streaming row-by-row.
- DuckDB-WASM é opt-in; integração é superficial (não há query optimizer integrado).

---

## Convenções de código

### Naming
- **Módulos**: `Solstice<Nome>` (PascalCase, IIFE pattern)
- **Classes CSS**: `solstice__<componente>--<variant>` (BEM, double-underscore + double-dash)
- **Estados**: `.is-active`, `.has-error`, `.is-open`, `.is-selected`
- **Funções internas**: `_underscorePrefix` (privado por convenção)
- **Tokens CSS**: `--<categoria>-<nome>` (ex: `--c-accent`, `--sp-3`, `--fs-md`)

### Igualdade
- **Padrão**: `===` / `!==`
- **Exceção idiomática**: `x == null` (pega null e undefined juntos)

### DOM
- **Padrão**: `SolsticeUtils.el(tag, attrs, ...children)` ou `node.textContent = ...`
- **Proibido para dado dinâmico**: `innerHTML = 'literal ' + variable`
- **Quando precisa de innerHTML com dados**: passar por `SolsticeUtils.escapeHtml(s)`

### Storage
- **Sempre**: `SolsticeStorage.safeSet/safeGet/safeRemove` em vez de `localStorage.X` direto
- **Opção `{ silent: true }`** para flags internas que não merecem toast em falha

### Listeners
- **Em elementos descartáveis** (filhos de host que faz `innerHTML = ''`): `onclick:` em props do `el()` — auto-cleanup via GC
- **Em document/window** ou hosts persistentes: `SolsticeUtils.trackListener(host, target, evt, fn)` + `cleanupListeners(host)` na saída

---

## Testes

### Suite atual
- `tests/formula-core.test.mjs` — 30+ assertions sobre `SolsticeFormulaCore.lex` (lexer unificado).
- Estratégia: `tests/extract-modules.mjs` extrai IIFEs do single-file pra módulos ESM testáveis via Vitest.
- Auto-extração: `npm test` roda `extract` primeiro.

### CI (`.github/workflows/test.yml`)
- Vitest matrix Node 20/22 em cada push/PR.
- Audit estático: HTML integrity, SRI presente, CSP presente, regressão XSS (AP-01) verificada.

### Lacunas conhecidas
- Sem testes E2E (Playwright)
- Sem testes de regressão visual (Percy/Chromatic)
- `SolsticeStats`, `SolsticeFormula`, `SolsticeFormulaRow` ainda não cobertos (próximo ciclo)

---

## Roadmap arquitetural

### Curto prazo
- [ ] Migrar mais sites de `deepClone(Store.get('canvas.sections'))` para `SolsticeCanvas.editSections` / `withSlot` (35 sites → 0)
- [ ] Cobertura de testes para `SolsticeStats` e `SolsticeFormula`
- [ ] Reduzir catches silenciosos com `SolsticeLog.warn` em pontos críticos

### Médio prazo
- [ ] Streaming de CSV (parse incremental, não bloqueia UI)
- [ ] Virtualização real de tabelas (>50k rows)
- [ ] `Promise.all` no boot (paralelizar inits independentes)
- [ ] Quebrar `SolsticeV56` (3.814 linhas — bloco histórico de patches)

### Longo prazo
- [ ] Quebra do single-file em módulos ESM (com build opcional)
- [ ] DuckDB-WASM como query engine real (não só opt-in)
- [ ] Testes E2E com Playwright

---

## Anti-padrões a evitar

1. **Hardcodar cor/spacing inline** sem usar `var(--token)` ou helpers `sp()/col()`.
2. **Mutar referência ao vivo de `SolsticeStore.get()`** — sempre clone primeiro (`deepClone` ou spread).
3. **`innerHTML = 'string com ' + variavel`** — política DOM proíbe.
4. **Pollution de `window`** — exporte só via `window.Solstice` no fim do arquivo.
5. **`addEventListener` em document/window sem `trackListener`** — vaza em sessão longa.
6. **Catch silencioso** — pelo menos logue via `SolsticeLog.debug` ou `console.warn`.
7. **Boot dependente de DOM ainda não pronto** — use `DOMContentLoaded` ou `setTimeout(..., 0)`.

---

## Arquivos do repo

```
solstice/
├── solstice_baseline.html      ← O produto. Tudo está aqui.
├── README.md                   ← Headline + features + uso
├── CHANGELOG.md                ← Histórico de mudanças
├── ARCHITECTURE.md             ← Este arquivo
├── package.json                ← Apenas Vitest (devDep)
├── tests/
│   ├── extract-modules.mjs     ← Extrai IIFEs pra módulos ESM testáveis
│   └── formula-core.test.mjs   ← Suite Vitest
└── .github/workflows/
    └── test.yml                ← CI: Vitest + audit estático
```
