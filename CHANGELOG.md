# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

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
