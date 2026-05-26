# 🌗 Solstice · Dashboard Studio

> **BI single-file** que você abre direto no navegador, importa um CSV e em segundos tem um dashboard interativo. Sem servidor, sem instalação, sem login. Um único arquivo HTML de ~2 MB.

[![Solstice v5.6](https://img.shields.io/badge/version-5.6.0--patched-4D9FFF?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-success?style=flat-square)](#)
[![Audit Score](https://img.shields.io/badge/audit_score-85%2F100-success?style=flat-square)](#)
[![Single file](https://img.shields.io/badge/single--file-yes-blueviolet?style=flat-square)](#)
[![Site](https://img.shields.io/badge/type-static_site-orange?style=flat-square)](#)

---

## 🏗️ Arquitetura modular (refactor v1)

Esta branch (`solstice-modular`) é o resultado do refactor que separou o monolito histórico de ~47k linhas em **122 arquivos por área**. O artefato final continua sendo um único `solstice.html`, mas o desenvolvimento agora acontece em arquivos pequenos:

```
src/
├── build/        pipeline (build.py + manifest.json)
├── styles/       CSS por @layer (reset, tokens, themes, components, v56patch)
├── core/         18 utilitários (LZ, Utils, Storage, Store, Log, Locale, BR-fmt, Errors, Toast, Profiles, Theme, …)
├── data/         18 módulos (Dictionary, Domain, Tokenizer, Inference, Types, Ingest, Quality, Editor, …)
├── ui/           18 módulos (Header, Sidebar, Canvas, Inspector, Modal, Stats, DnD, Resize, …)
├── components/   2 monolitos (Components — 20 tipos de viz — e Props)
├── features/     18 módulos (Templates, Insights, Ask, Filters, AutoDashboard, Recommender, LLMAdapter, …)
├── persistence/  8 módulos (Snapshots, AutoSave, IDB, FolderAttach, …)
├── export/       8 módulos (Export, Slides, Presenter, CommandPalette, Tour, …)
└── workspace/   23 módulos (Pages, Formula, Settings, V56, SelfAudit, …)
```

### Build

```bash
python src/build/build.py
# Saída: dist/solstice.html  (artefato distribuível)
```

Stdlib-only — funciona em qualquer máquina com Python 3.8+ (sem npm, sem CDN exigida pelo build, ideal pra ambientes corporativos como Itaú). Detalhes em [`src/build/README.md`](src/build/README.md).

### Deploy

CI automática em `.github/workflows/build.yml` gera o artefato a cada push e o anexa ao release em tags `v*`. Guia operacional pra deploy interno (SharePoint, intranet, plugar Eva) em [`docs/DEPLOY-ITAU.md`](docs/DEPLOY-ITAU.md).

### Sessão de polish noturna (2026-05-26)

40+ polish + features visuais + 1 bug crítico resolvido (`Dummy.load` não populava `ingest.*`) + Drag-and-drop QuickSight MVP + Inspector como aba da sidebar. Detalhes em [`docs/MELHORIAS-SESSAO-NOTURNA.md`](docs/MELHORIAS-SESSAO-NOTURNA.md).

### Integração com LLM corporativo

`Solstice.LLMAdapter` plugga qualquer endpoint compatível (Eva, OpenAI, ChatGPT corporativo). Configuração em uma linha:

```javascript
Solstice.LLMAdapter.configure({
  provider: 'fetch',
  endpoint: 'https://eva.intranet.empresa/v1/chat',
  credentials: 'include',                // usa SSO da intranet
});
```

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
- **Anomaly detection inline** — rolling median + MAD (Iglewicz/Hoaglin) em janela de 7 pontos, captura anomalias **contextuais** que outliers globais perdem (Sprint 18 da Auditoria 2026.4)
- Forecast / regressão linear
- Comparação de períodos (mês anterior, ano anterior, meta fixa)
- **Insights automáticos** (13 tipos: trend, outliers, pareto, sazonalidade, mudança recente, top categoria, correlação, completeness, range, cardinalidade, overview, recency-change, **anomaly**)
- **Ask** (linguagem natural via SolsticeQuery — sem servidor) com catálogo de ~22 perguntas em 6 categorias (estatística, comparação, tendência, qualidade, negócio, sobre o dataset)
- **LLM opcional** (OpenAI / Anthropic / Groq / Ollama local)

### Colaboração
- Comentários em thread por componente
- Snapshots versionados (LZ-compressed, em localStorage)
- **Auto-save** com banner de confirmação no boot (não restaura silenciosamente — usuário decide "↶ Restaurar / Começar do zero")
- **Status saved persistente** estilo Notion/Google Docs (`● Salvo há 5s` / `Salvo há 1min` atualizando a cada 15s)
- Export PNG / PDF / Excel / SVG vetorial editável
- Share por URL (estado embedded)
- Apresentador dual-window (slides + speaker notes)
- **Multi-tab sync** via BroadcastChannel (tema sincroniza entre abas)

### Acessibilidade
- **Modais** com `role="dialog"` + `aria-modal` + `aria-labelledby` (WCAG 4.1.2)
- **Vtable** virtualizada com semântica de grid completa: `role="grid"`, `aria-rowcount` dinâmico, `aria-sort` nos columnheaders, `role="row"`/`gridcell` com `aria-rowindex`/`aria-colindex`
- **Toasts** com `role="status"` + `aria-live` dinâmico (assertive para erros, polite para resto)
- **Foco visível** global com outline + halo do background (47+ regras `:focus-visible`)
- **Skip link** "Pular para conteúdo principal" para usuários de teclado (WCAG 2.4.1)

---

## 🚀 Como usar

### Opção 1 — Local (mais simples)
1. Baixe `dist/solstice.html` (gerado por `python src/build/build.py`, ou pegue do release mais recente)
2. Abra direto no Chrome / Edge / Firefox / Safari
3. Drag-and-drop um CSV no canvas
4. Pronto.

### Opção 2 — Servir via HTTP
```bash
# Python (já instalado em 99% das máquinas)
python -m http.server 8765

# Node
npx serve

# qualquer servidor estático
```

Abra `http://localhost:8765/dist/solstice.html`.

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
# Rode `python src/build/build.py`, abra dist/solstice.html, verifique que [Solstice] boot OK aparece no console

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

## ❓ FAQ

### Meus dados ficam seguros?
**Sim.** Tudo roda 100% no seu navegador. Nada de servidor, nada de upload, nada de telemetria. O badge `🔒 100% local` no header está lá pra te lembrar. Se você fechar o navegador sem exportar/salvar snapshot, perde — mas é porque o produto não tem onde guardar nada fora da sua máquina.

### Funciona offline?
**Sim.** Depois que o `.html` baixou (e as libs do CDN ficaram em cache no Chrome/Firefox), basta abrir o arquivo direto do disco. Pra garantir offline real, abra uma vez online → o navegador cacheia as libs → depois funciona sem rede.

### Preciso instalar algo?
**Não.** É um único arquivo `.html`. Dois cliques (ou `python -m http.server`) e abre.

### Qual o tamanho máximo de CSV?
Testado com confiança até **~100k linhas × 20 colunas**. Acima disso o parse fica lento (uns 5–10s) e a tabela pode travar. Streaming/virtualização está no roadmap v5.7.

### Posso usar em produção / no trabalho?
Sim, mas leia a licença (MIT). Não há suporte comercial — é projeto pessoal. Pra dúvidas use [GitHub Issues](#-canal-de-suporte).

### Funciona no Excel / Power BI ao mesmo tempo?
Solstice **importa** Excel/CSV e **exporta** Excel/PNG/PDF. Não é integrado em tempo real com Power BI — é uma alternativa leve pra quem não quer/pode usar BI pesado.

### Por que single-file (e não uma SPA "normal")?
Porque eu quis. É deliberado: portabilidade total, zero build, zero deploy. Trade-off é bundle de 2 MB e edição menos confortável. Se você precisa de algo escalável pra time grande, use Hex / Metabase / Power BI.

### Funciona em mobile / tablet?
**Não.** Solstice é desktop-only por design (apartir de notebook). Mobile foi removido intencionalmente — gráficos densos e edição de dashboard não fazem sentido em tela pequena.

### Como reporto bug / pedir feature?
Vá em [Issues](https://github.com/lucas/solstice/issues/new/choose) → escolha o template apropriado. Veja seção abaixo.

---

## 💬 Canal de suporte

Para reportar bugs, sugerir features ou tirar dúvidas:

- **🐛 Bug** → [abrir issue de bug](https://github.com/lucas/solstice/issues/new?template=bug.md)
- **✨ Feature** → [abrir issue de feature](https://github.com/lucas/solstice/issues/new?template=feature.md)
- **❓ Dúvida** → [abrir pergunta](https://github.com/lucas/solstice/issues/new?template=question.md)

Templates de issue estão em [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).

> Como projeto pessoal, não há SLA. Respostas no melhor esforço.

---

## 🤝 Contribuindo

Esse é um projeto pessoal de Lucas. Issues e PRs são bem-vindos, mas a direção arquitetural é deliberada (single-file, vanilla JS, zero dependências de build, desktop-only).

Antes de abrir PR:
1. Rode smoke test manual no Chrome / Firefox / Edge (desktop)
2. Se mexer em estado, valide a suite de regressão das fórmulas (`npm test`)
3. Use os helpers existentes (`SolsticeUtils.sp/col/rad`, `SolsticeStorage.safeSet`, `SolsticeCanvas.withSlot`) em vez de hardcodar
4. Mantenha o single-file (nada de extrair pra arquivos separados)

---

## 📝 Licença

MIT

---

## 🙏 Créditos

Construído com paciência e [Claude Code](https://claude.com/claude-code) (Anthropic).
Auditado pelo **Product Audit Board** (Marina · Rafael · Júlia · André · Beatriz · Carlos · Helena).
