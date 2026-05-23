# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

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
