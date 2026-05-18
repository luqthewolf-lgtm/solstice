# Changelog — Bloco 12

**Entregue em:** 2026-05-18 · Sessão 3
**Versão:** `5.3.0-bloco12`
**Tamanho:** ~16.437 linhas (~712 KB)

---

## 🎯 Objetivo

Polish final + features power user (Command Palette, Tour) + modos profissionais (Present/Slides/Apresentador).

## ✨ 5 Módulos Novos

### `SolsticeModes` — 5 modos via data-mode
- ✏️ Edit (default) · 🔬 Analyze · 💬 Review (B13 placeholder) · 🖥️ Present · 🎬 Slides
- Dropdown no header
- CSS-only switch via `data-mode` no `.solstice__app`
- Cada modo esconde/mostra elementos sem reflow JS

### `SolsticeSlides` — Modo Slides
- Cada section = 1 slide full-viewport
- Setas ← → · F (toggle) · Esc (sai) · A (Apresentador)
- Contador + barra de progresso
- Reusa Components.render com ctx filtrado (filtros B9 ativos)

### `SolsticePresenter` — Modo Apresentador
- Dual-pane single-window (1.6fr slide + 1fr notas+preview+timer)
- Notas vêm de `section.notes` (editor B13)
- Timer mm:ss desde abertura
- Setas ← → · Esc

### `SolsticeCommandPalette` — Ctrl+K
- 35 comandos em 12 categorias
- Fuzzy match (substring prioritário + char-order fallback)
- Sinônimos via `syn` field
- Setas ↑↓ · Enter · Esc

### `SolsticeTour` — Tour interativo 9 passos
- Brand → Sidebar → Canvas → Toolbar → Catálogo → Modos → Help → Status → Final
- Spotlight via clip-path
- Tooltip 320px com posicionamento dinâmico
- Setas ← → · Pular · Anterior · Próximo

## 🎨 Plus

- `Stats.lttb` adicionado — downsampling LTTB para gráficos grandes
- Polish CSS: `:focus-visible` (WCAG AA), transição grid 300ms

## 📐 ADRs

- ADR-084: 5 modos via data-mode + dropdown header
- ADR-085: Slides reusa sections (sem editor próprio)
- ADR-086: Apresentador single-window dual-pane (não window.open)
- ADR-087: Command Palette catálogo hardcoded + fuzzy match
- ADR-088: Tour spotlight via clip-path + tooltip dinâmico

## ⚠️ Limitações

- Modo Review é placeholder (B13 implementa comentários)
- Apresentador single-window — sem dual-monitor real (B13 pode adicionar window.open opcional)
- Command Palette catálogo hardcoded — escalar para registry plugável se virar pain point
- Tour pode apontar para elemento fora do viewport — usuário scrolla manualmente

## 🔮 Bloco 13 — próximo (último)

Diferenciais Avançados: Visões salvas · Anotações no canvas · Comparação lado-a-lado de períodos · Diff entre dashboards · Tags+Coleções · Variáveis de ambiente · Tabs em painéis · Linkagem entre dashboards · URL Hash share · Export PDF · **Modo Comentário completo (Diferencial #3)** · **Grafo de Métricas (Diferencial #4)** · `portabilidade/INDICE.md` consolidando TODAS as features dos 13 blocos.
