# Changelog — Bloco 11

**Entregue em:** 2026-05-18 · Sessão 3
**Versão:** `5.3.0-bloco11`
**Tamanho:** ~15.407 linhas (~667 KB)

---

## 🎯 Objetivo

Persistência completa do Solstice: salvar/carregar estado, exportar para compartilhamento, e prover templates específicos do contexto Itaú.

## ✨ 5 Módulos Novos

### `SolsticeSnapshots` — Persistência em localStorage
- CRUD nominado por perfil (`solstice.snapshots.<profileId>`)
- LZ-String comprime ~5-10× (dataset 50k linhas → ~500 KB Base64)
- Cap 30 por perfil (descarta antigo)
- State shape: `{ canvas, filters, params, dictionary, ingest }`
- Modal CRUD: salvar atual, carregar, renomear, remover

### `SolsticeVersions` — Ring buffer automático
- 10 versões em memória (sessão-only)
- Subscribe em `canvas.sections` auto-captura
- Descarta duplicatas seguidas
- Modal lista versões clicáveis com timestamp

### `SolsticeFileSystem` — API moderna + fallback
- Detecta `showSaveFilePicker` / `showOpenFilePicker`
- Chrome/Edge: API nativa (escolher pasta, sobrescrever)
- Firefox/Safari: fallback `<a download>` / `<input file>`
- Atalhos novos: **Ctrl+S** (salvar snapshot rápido) · **Ctrl+O** (abrir modal)

### `SolsticeExport` — HTML standalone
- 3 modos: HTML+dados · HTML sem dados (template) · JSON puro
- Injeta `<meta name="solstice-embedded">` + script com state LZ-comprimido
- Snippet de hidratação no fim do body restaura tudo via `Store.batch()`
- Sentinela `[Solstice] Estado embedded rehidratado` no console

### `SolsticeTemplatesItau` — 3 templates pré-instalados
1. **Carteira PJ — Visão Mensal** (🏦) — KPIs volume/DPD + gauge + série temporal + sankey
2. **Acompanhamento de Inadimplência** (⚠️) — DPD30/60/90 + box plot + histograma + série
3. **Pipeline Comercial PJ** (📈) — sankey canal→produto + box plot ticket + tabela

Anexados a `SolsticeTemplates.DOMAIN` no init — aparecem no picker quando dicionário Banco PJ está ativo.

## 🎨 UI nova

**Sidebar:**
- Aba "🧠 Dicionários" ativada — mostra ativo + salvos + 6 pré-feitos com 1-clique aplicar
- Aba "📸 Snapshots" ativada — botão "💾 Salvar atual" + lista com ações inline

**Toolbar:**
- 📂 Abrir · 💾 Salvar · ⬇️ Exportar · 🕐 Histórico

## 📐 ADRs

- **ADR-079:** Snapshots localStorage com LZ-String, cap 30/perfil
- **ADR-080:** Versions ring buffer 10 em memória (sessão-only)
- **ADR-081:** FileSystem detecção + fallback gracioso
- **ADR-082:** Export HTML standalone com hidratação no boot
- **ADR-083:** Templates Itaú anexados a `SolsticeTemplates.DOMAIN`

## ⚠️ Limitações conhecidas

- **localStorage 5-10 MB** — depende do browser. Cap 30 é heurística; datasets > 1M linhas começam a estourar
- **Versions some no reload** — intencional, distinto de Snapshots
- **Export sem encryption** — texto plano (ADR-005, single-file)
- **Templates Itaú assumem colunas específicas** — só funcionam se dataset tem `vlr_op_aprov_mensal`, `DPD30`, etc.
- **File System Access API só Chrome/Edge** — fallback funciona mas perde "salvar no mesmo lugar"
- **Snapshots não migram entre browsers** — localStorage é por origin

## 🔮 Bloco 12 — próximo

5 modos (edit/analyze/review/present/slides) + Modo Apresentador + Command Palette (Ctrl+K) + polish geral + tour interativo. Vai precisar de snapshot/restore para o tour usar dataset dummy.
