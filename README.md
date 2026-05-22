# 🌗 Solstice · Dashboard Studio

> **BI single-file** que você abre direto no navegador, importa um CSV e em segundos tem um dashboard interativo. Sem servidor, sem instalação, sem login. Um único arquivo HTML de ~2 MB.

[![Solstice v5.6](https://img.shields.io/badge/version-5.6.0--patched-4D9FFF?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-success?style=flat-square)](#)
[![Audit Score](https://img.shields.io/badge/audit_score-85%2F100-success?style=flat-square)](#)
[![Single file](https://img.shields.io/badge/single--file-yes-blueviolet?style=flat-square)](#)

---

## ⚡ Por que existe

Ferramentas de BI tradicionais (Power BI, Tableau, Metabase, Hex…) são poderosas, mas todas exigem **instalar algo, criar conta, ou depender de servidor**. Em muitas situações reais — análise rápida de um CSV, dashboard interno sem orçamento, mostrar dados pra um cliente sem expor um produto SaaS — você só precisa de uma página estática que renderize charts e seja **portável como um PDF**.

**Solstice resolve isso em 1 arquivo.** Abra, arraste seu CSV, monte o dashboard, exporte como PNG/PDF ou compartilhe a URL. Tudo no browser do usuário, sem nada saindo da máquina.

---

## ✨ O que tem dentro

### Dados
- **Import**: CSV / TSV / TXT / JSON (drag-and-drop ou file picker)
- **Multi-base**: importe múltiplos CSVs e relacione (modelo PowerBI-like)
- **Inferência semântica**: detecta colunas (datas, métricas, dimensões) automaticamente; aprende com correções manuais
- **Dicionários**: 6 dicionários pré-feitos (Vendas, RH, Financeiro, etc.) com sinônimos e heurísticas
- **DuckDB-WASM (opt-in)**: queries SQL diretas sobre o dataset

### Visualizações
- KPI, BigNum, Tabela, Pivot, Time-Series, Distribution, Scatter, Boxplot, Sankey, Funnel, Gauge, Heatmap-cal, Event Timeline
- **5 paletas + 7 temas** (Ocean, Sunset, Forest, Vineyard, Coffee, Slate, Itau) × dark/light
- **3 densidades** (compact / comfortable / spacious)

### Análise
- Estatística descritiva completa (média, mediana, quartis, IQR, skewness, kurtosis, correlação Pearson/Spearman)
- Detecção de outliers (Tukey, MAD, z-score)
- Forecast / regressão linear
- Comparação de períodos (mês anterior, ano anterior, meta fixa)
- **Insights automáticos** (variações relevantes, anomalias)
- **Ask** (linguagem natural via SolsticeQuery — sem servidor)
- **LLM opcional** (OpenAI / Anthropic / Groq / Ollama local)

### Colaboração
- Comentários em thread por componente
- Snapshots versionados (LZ-compressed, em localStorage)
- Export PNG / PDF / Excel
- Share por URL (estado embedded)
- Apresentador dual-window (slides + speaker notes)

---

## 🚀 Como usar

### Opção 1 — Local (mais simples)
1. Baixe `solstice_baseline.html`
2. Abra direto no Chrome / Edge / Firefox / Safari
3. Drag-and-drop um CSV no canvas
4. Pronto.

### Opção 2 — Servir via HTTP (recomendado em produção)
```bash
# Python (já instalado em 99% das máquinas)
python -m http.server 8765

# Node
npx serve

# qualquer servidor estático
```

Abra `http://localhost:8765/solstice_baseline.html`.

### Opção 3 — PWA (instalável)
Sirva via HTTPS, instale como app (Chrome ▾ Instalar). Funciona offline depois do primeiro load. Veja [PWA setup](#-pwa-setup).

---

## 📐 Arquitetura

**Single-file deliberado.** 90 módulos IIFE (`SolsticeUtils`, `SolsticeStore`, `SolsticeCanvas`, etc.) num único HTML. Trade-offs:

| Vantagem | Desvantagem |
|---|---|
| Portabilidade absoluta (1 arquivo = 1 produto) | Bundle de ~2 MB |
| Zero build pra desenvolver | Edições viram diff grandes |
| Offline-first por design | Custo de evolução cresce com tamanho |

### Camadas
```
┌─────────────────────────────────────────────────────┐
│  UI Layer        Canvas · Sidebar · Inspector       │
├─────────────────────────────────────────────────────┤
│  Components      KPI · Chart · Table · Pivot · …   │
├─────────────────────────────────────────────────────┤
│  Domain          Inference · Dictionary · Formula   │
├─────────────────────────────────────────────────────┤
│  Core            Store · Utils · Storage · Stats    │
├─────────────────────────────────────────────────────┤
│  Tokens          CSS vars · 7 paletas × dark/light  │
└─────────────────────────────────────────────────────┘
```

### Stack
- **Vanilla JS** (sem framework — nem React, nem Vue, nem Svelte)
- **Chart.js 4.4** (charts)
- **PapaParse 5.4** (CSV parsing)
- **SheetJS** (XLSX export)
- **DuckDB-WASM** (opt-in para SQL)
- **LZString** (compressão de snapshots)

---

## 🎨 Design System

- **Tokens semânticos** (cores, tipografia, spacing 4px, raios, sombras, motion)
- **7 paletas** × **2 modos** × **3 densidades** = 168 combinações suportadas
- **557 componentes** únicos com naming BEM (`solstice__comp--variant`)
- **`prefers-reduced-motion`** honrado
- **Acessibilidade**: `:focus-visible`, aria-*, role, focus-trap em modais

Score atual do design system: **~82/100** (post audit).

---

## 🔐 Segurança

- **CSP** (Content Security Policy) via `<meta http-equiv>`
- **SRI** (Subresource Integrity) nos CDN scripts
- **Política de DOM seguro** documentada no topo do fonte: dado dinâmico SEMPRE via `textContent` / `el()` / `escapeHtml`
- **Storage helper** (`SolsticeStorage.safeSet`) que avisa quando localStorage falha
- Auditoria de XSS aplicada (Product Audit Board · 16 achados fechados)

Veja [SECURITY.md](#-security-policy) para detalhes.

---

## 🧪 Testes

```bash
# Smoke test manual (recomendado)
python -m http.server 8765
# Abra solstice_baseline.html, verifique que [Solstice] boot OK aparece no console

# Suite de testes automatizada (em desenvolvimento)
npm test
```

Suite cobre:
- `SolsticeStats` (min/max/minMax/mean/median/quartiles/…)
- `SolsticeFormula` (DAX-like: SUM/AVG/MIN/MAX/COUNT/MEDIAN/IF/AND/OR/NOT)
- `SolsticeFormulaRow` (row-level: ABS/ROUND/FLOOR/CEIL/MIN/MAX/IF/COALESCE/LEN/UPPER/LOWER…)
- `SolsticeFormulaCore.lex` (lexer unificado, ambas as gramáticas)

---

## 📋 Roadmap

### v5.7 (próximo ciclo)
- [ ] Virtualização real de tabelas grandes (>50k rows)
- [ ] Streaming de CSVs (parse incremental, não bloqueia UI)
- [ ] PWA com cache offline completo
- [ ] Code splitting (Chart.js lazy-loaded)
- [ ] Testes E2E (Playwright)

### v6.0 (longo prazo)
- [ ] Quebra do single-file em módulos ESM (com build opcional)
- [ ] Internacionalização real (en, es, pt-BR — hoje é só pt-BR)
- [ ] Modelo de dados via DuckDB integrado (queries SQL no inspector)
- [ ] RAG sobre dataset (insights via LLM com contexto do CSV)

---

## 📊 Métricas

- **Tamanho**: ~2 MB single-file
- **Linhas**: ~42.800 (HTML + CSS + JS)
- **Componentes únicos**: 557
- **Tokens CSS**: 21 primitivos + 15 semânticos × 14 paletas
- **Breakpoints responsivos**: 10
- **Auditoria 2026**: 16/16 achados fechados (Product Audit Board)

---

## 🤝 Contribuindo

Esse é um projeto pessoal de Lucas. Issues e PRs são bem-vindos, mas a direção arquitetural é deliberada (single-file, vanilla JS, zero dependências de build).

Antes de abrir PR:
1. Rode smoke test manual no Chrome / Firefox / Safari
2. Se mexer em estado, valide a suite de regressão das fórmulas
3. Use os helpers existentes (`SolsticeUtils.sp/col/rad`, `SolsticeStorage.safeSet`, `SolsticeCanvas.withSlot`) em vez de hardcodar

---

## 📝 Licença

MIT

---

## 🙏 Créditos

Construído com paciência e [Claude Code](https://claude.com/claude-code) (Anthropic).
Auditado pelo **Product Audit Board** (Marina · Rafael · Júlia · André · Beatriz · Carlos · Helena).
