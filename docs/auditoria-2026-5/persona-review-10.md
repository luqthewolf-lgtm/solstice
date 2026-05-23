# Auditoria 2026.5 — 10 Personas Review (Sprint 34)

> 10 agentes paralelos, cada um com persona + escopo dedicado, revisaram o
> produto Solstice em paralelo. Cada um retornou 5-8 achados concretos com
> linha + evidência + sugestão.

## Sumário executivo

**60+ achados novos** descobertos via inspeção paralela com personas. Os mais
críticos:

- 🔴 **XSS CVSS 7.5** em `_renderMarkdown` (André) — **JÁ FIXADO** Sprint 34
- 🔴 **82 `parseFloat(r[col])`** sem `SolsticeBR.toNumber` (Júlia) → CSV
  brasileiro "1.234,56" vira 1.234 silenciosamente
- 🔴 **91 `subscribe` vs 1 `unsubscribe`** (Marina) → memory leak crônico
- 🔴 **Hambúrguer mobile dead code** (Tiago) → app quebra <1100px
- 🔴 **Drag-only no Modelo** (Patricia) → keyboard-only users bloqueados

## Achados por persona

### P1 Marina (SRE) — Confiabilidade

| # | Sev | Achado | Linha |
|---|:--:|--------|-------|
| M-1 | 🔴 | 91 subscribe vs 1 unsubscribe → leak | múltiplas |
| M-2 | 🔴 | 15 `document.addEventListener('keydown')` sem cleanup | 11528+ |
| M-3 | 🔴 | 200 setTimeout no boot path serial | 11549+ |
| M-4 | 🟠 | `setInterval(render, 800)` debug panel = 75 reflows/min | 10399 |
| M-5 | 🟠 | `_notify` engole erros de subscribers | 7407 |
| M-6 | 🟠 | Autosave `_tick` sem mutex (visibilitychange + interval) | 36980 |
| M-7 | 🟡 | `SolsticeCanvas.render` sem coalescing global | 27 sites |

### P3 Júlia (QA) — Edge cases

| # | Sev | Achado | Linha |
|---|:--:|--------|-------|
| J-1 | 🔴 | 82× `parseFloat(r[col])` vs 11× `SolsticeBR.toNumber` → CSV pt-BR quebra | múltiplas |
| J-2 | 🟠 | Gauge min/max aceita input BR mal | 21493 |
| J-3 | 🔴 | `toISOString().slice(0,10)` em datas → off-by-1 em GMT-3 | 19975+ |
| J-4 | 🟠 | `detectDialect` quebra com CSV 1-coluna | 12572 |
| J-5 | 🟡 | Gauge divide-by-zero só com igualdade exata | 21497 |
| J-6 | 🟠 | `parseInt() \|\| default` aceita negativo silenciosamente | 23427 |
| J-7 | 🟠 | `JSON.parse` sem try/catch quebra boot | 14026+ |

### P4 André (Security)

| # | CVSS | Achado | Linha |
|---|:--:|--------|-------|
| S-1 | **7.5** | XSS em `_renderMarkdown` via Store key | 21677 — **✅ FIXADO** |
| S-2 | 6.8 | CSP com `unsafe-inline` + `unsafe-eval` | 154 |
| S-3 | 6.5 | CSV/Formula Injection no export XLSX | 38173+ |
| S-4 | 6.1 | API key LLM em localStorage plaintext | 32377 |
| S-5 | 5.4 | Placeholder span forjável no markdown | 21717 |
| S-6 | 3.7 | console.log com dados sensíveis | 52 sites |
| S-7 | 3.1 | SVG upload via data URL (CSP fraca) | 46254 |

### P5 Beatriz (UX)

| # | Sev | Achado | Linha |
|---|:--:|--------|-------|
| B-1 | 🟠 | Header com 12+ controles competindo | 6604 |
| B-2 | 🟠 | 597 `font-size:Npx` literais (inconsistência tipográfica) | múltiplas |
| B-3 | 🟠 | Welcome com 3 saudações sequenciais paralisantes | 28556 |
| B-4 | 🟡 | Tooltips multi-linha viraram "modal escondido" no `title=` | 6581 |
| B-5 | 🟡 | `cursor:help` em valor de KPI conflita com drag | 4206 |
| B-6 | 🟠 | Status bar mono 10-11px com info crítica (contraste WCAG limite) | 912 |
| B-7 | 🟡 | Badges "19"/"6" sem contexto | 6734 |

### P6 Carlos (Comercial vs Power BI)

| # | Prio | Gap | Linha |
|---|:--:|------|-------|
| C-1 | P0 | i18n só ~25 chaves traduzidas | 7700-7803 |
| C-2 | P0 | Sem conditional formatting visual no Inspector | 24785 |
| C-3 | P1 | Drill-through cross-page inexistente | 20709 |
| C-4 | P1 | Bookmarks/Visões nomeadas ausentes | 2577 |
| C-5 | P2 | Export PDF é `window.print()` | 40648 |
| C-6 | P2 | Sem custom-color por categoria | 25788 |
| C-7 | P2 | Presenter View pobre (sem timer/blackout/zoom) | 39122 |

### P7 Helena (CTO ROI)

| # | Risco | Lacuna | Esforço |
|---|:--:|--------|---------|
| H-1 | 🔴 SOC2 | Audit log volátil in-memory (não persiste, não tamper-evident) | 2 sprints |
| H-2 | 🔴 Sec | Zero RBAC (nem stub) | 3 sprints |
| H-3 | 🟠 Vendas | Export PDF = window.print() → mata venda enterprise | 2 sprints |
| H-4 | 🟠 Visibilidade | Sem telemetria opt-in agregada | 1 sprint |
| H-5 | 🟠 TAM | Sem i18n real (só pt-BR) | 2-3 sprints |
| H-6 | 🟡 Imagem | README 85/100 vs interno 96/100 (inconsistência) | 30 min |

### P8 Daniel (Design System)

| # | Sev | Achado | Linha |
|---|:--:|--------|-------|
| D-1 | 🔴 | 597 `font-size: Npx` ignorando `--fs-*` | múltiplas |
| D-2 | 🔴 | 57× `color: #fff` hardcoded (anti-tema) | múltiplas |
| D-3 | 🟠 | z-index: 9999 / 99999 coexistindo com `--z-*` tokens | múltiplas |
| D-4 | 🟠 | Debug overlay com paleta inline (#C8D0E0...) | 3689+ |
| D-5 | 🟡 | border-radius fora do sistema (1, 2, 3, 5, 8px) | múltiplas |
| D-6 | 🟡 | 357 padding/margin literal sem var() | múltiplas |
| D-7 | 🟡 | Inline styles em JS bypassando design system | 38982+ |

### P9 Patricia (Acessibilidade WCAG)

| # | WCAG | Achado | Linha |
|---|:--:|--------|-------|
| A-1 | A 4.1.2 | 10+ botões ícone-only sem `aria-label` (title só) | 29128+ |
| A-2 | A 1.1.1 | Color picker com `title=#5BA8FF` (NVDA lê hex literal) | 46291 |
| A-3 | A 1.3.1 | 2 checkboxes sem label associado (`for=` ausente) | 46189 |
| A-4 | **A 2.1.1** | Drag-only no Modelo View (keyboard-only bloqueado) | 27077 |
| A-5 | A 1.3.1 | Hierarquia de heading quebrada (h2 sem h1) | 25102 |
| A-6 | A 4.1.2 | Title-bar editável sem `role="textbox"` | 25102 |
| A-7 | AA 4.1.3 | `role="status"` tooltip nunca dispensado | 39521 |

### P10 Tiago (Mobile / Responsividade)

| # | Sev | Achado | Linha |
|---|:--:|--------|-------|
| T-1 | 🔴 | Hambúrguer injetado mas CSS nunca o revela (dead code) | 6222 |
| T-2 | 🔴 | Grid `220px 1fr 0px` sem fallback <1100px (overflow horizontal) | 6214 |
| T-3 | 🟠 | Touch targets <44px violam WCAG 2.5.5 | 322 |
| T-4 | 🟠 | Toolbar wrap sem scroll horizontal alternativo | 5145 |
| T-5 | 🟠 | Inspector drawer sem backdrop em mobile | 1200 |
| T-6 | 🟠 | `12col-equal` não auto-collapsa | 5362 |
| T-7 | 🟡 | 597 font-size literal não escala | múltiplas |

## Priorização global (próximos sprints)

### Sprint 35 — Críticos (🔴 imediatos)

1. **J-1** Migrar 82× `parseFloat(r[col])` → `SolsticeBR.toNumber` (1-2 dias)
2. **M-1** Padronizar `subscribe` → `subscribeScoped` com cleanup automático (1 sprint)
3. **S-3** Sanitizar XLSX export contra formula injection (30 min — one-liner)
4. **T-1/T-2** Hambúrguer + grid responsivo OU min-width 1100px com tela "use desktop" (decisão de produto)
5. **A-4** Keyboard support no Modelo drag (setas pra reposicionar cards)

### Sprint 36 — Estruturais (🟠 alto impacto)

6. **D-1/D-2** Migração CSS hardcoded → tokens (lint regra + auto-fix)
7. **H-3** ExecutiveBrief PDF estruturado (substituir window.print)
8. **B-1** Header enxugado (12 → 6 controles)
9. **C-1** i18n EN-US completo (auditar strings hard-coded)
10. **A-1/A-3** ARIA labels em botões ícone + label em checkboxes

### Sprint 37+ — Polish (🟡)

- Bookmarks (C-4), conditional formatting (C-2), telemetria opt-in (H-4), RBAC stub (H-2), audit log persistente (H-1)

## Lições aprendidas

1. **Inspeção paralela > sequencial**: 10 agentes/personas em paralelo expuseram
   bugs que 33 sprints sequenciais não pegaram. Cada persona traz lente única.
2. **Auditorias automatizadas (grep) > review subjetivo**: P1, P3, P4, P8
   confiaram em grep counts (`91 subscribe`, `82 parseFloat`, `597 font-size`,
   `57 #fff`) — métricas defensáveis.
3. **Bug compostos**: XSS S-01 (CVSS 7.5) só era explorável por causa de CSP
   fraca S-02. Stack defense é real.
4. **Sprints anteriores criaram dívida**: Sprint 31 (Forecast) adicionou
   bug "monthes". Cada feature nova precisa de review de 1+ persona.
