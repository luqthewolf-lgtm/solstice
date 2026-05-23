# Auditoria 2026.5 — Bug Hunt fresh pós-Sprints 23-29

> **Contexto:** após 7 sprints contínuos (Sprints 23 → 29) atacando UX,
> organização, componentes e template wizard, é hora de validar fim-a-fim
> que não houve regressão. Esse documento lista achados do bug hunt
> automatizado via preview real (vendas_br_dummy.csv).

## Metodologia

Bug hunt automatizado via preview server local + Solstice.* APIs.
12 flows cobertos:

1. Boot do app + invariantes ADR
2. Import via Express + verificação de autorun
3. Wizard de Template (openPicker → click → openWizard → apply)
4. Multi-template seguido (apply 2 vezes — cleanup state)
5. Modelo overlay com drag (Sprint 24 / F-22)
6. Snapshot save
7. Ask bar (NLQ)
8. Componentes registrados
9. Módulos de Export (Export/PDF/ExportImage/ExportData)
10. Pages (multi-página)
11. PeriodCompare
12. Theme switching

## Achados

### 🔴 BH-01 — Onboarding "Bem-vindo ao Solstice" sobrepõe outros modais

**Sintoma:** após pular o welcome (botão "Pular"), o modal de onboarding
("Como podemos te chamar?") abre por cima sem focus visível. Durante o
bug hunt, esse modal interceptou o `openPicker` — efeito visualmente:
o picker abre mas o onboarding fica em cima, parecendo "wizard não abriu".

**Reprodução:**
1. Boot fresh (localStorage.clear)
2. Welcome aparece → clica Pular
3. Onboarding aparece — usuário pode achar que é parte do welcome
4. Se o usuário ignora e clica em "🗂️ Templates", o picker fica
   escondido atrás

**Solução proposta:** após `Pular`, salvar flag `ui.onboarding.skipped`
e não abrir o onboarding modal. Ou abrir apenas após primeira interação
real (não no boot).

**Esforço:** S · **Sev:** 🔴 (bloqueia descoberta de features)

### 🟠 BH-02 — Forecast não é componente registrado

**Sintoma:** lista de componentes via `Components.list()` retorna 19 itens
(kpi, time-series, distribution, table, scatter, heatmap-cal, gauge,
markdown, narrative-auto, boxplot, sankey, distrib-time, demand-list,
pivot, slider, bignum, funnel, event-timeline, metric-graph). **Forecast
não aparece**.

**Contexto:** persona Carlos (Comercial) explicitamente pediu forecast
no persona walkthrough do Sprint 23. Time-series mostra apenas histórico.

**Solução proposta:** adicionar componente `forecast` que:
- usa time-series como base
- projeta N períodos via média móvel ou regressão linear
- mostra intervalo de confiança (banda)
- backtesting mini (accuracy nos últimos K períodos)

**Esforço:** M · **Sev:** 🟠 (pedido explícito da persona)

### 🟡 BH-03 — Multi-template anexa sem opção visível de substituir

**Sintoma:** após aplicar 1 template (sections = 1), aplicar 2º template
resulta em sections = 2 (anexou). Comportamento atual é correto se user
quer compor dashboards, mas falta UI explícita para "limpar antes" ou
"trocar template inteiro".

**Solução proposta:** no Wizard, adicionar checkbox "🗑️ Limpar dashboard
atual antes de aplicar" (default false). Quando true, chama
`SolsticeCanvas.clear()` antes de `applyTemplate(sections)`.

**Esforço:** S · **Sev:** 🟡

## Sprints anteriores validados ✅

Todos os fixes dos Sprints 23-29 passaram no bug hunt:

| Sprint | Validação automática |
|--------|---------------------|
| 23 (UX-01) | ✅ Welcome sem "Dashboard sem título" / "O que dá pra construir" |
| 23 (UX-03) | ✅ AutoDash não-automático no Express (sections=0 após import) |
| 24 (F-21) | ✅ Accordion badges preservados |
| 24 (F-22) | ✅ Modelo overlay com cards + Reset layout button |
| 26 (F-08) | ✅ Quality 92/100 (era 76 pré-Sprint 26) |
| 26 (F-23) | ✅ Resumo executivo inline renderizado |
| 28 (Wizard) | ✅ Wizard abre, selects pré-preenchidos, apply funciona |
| 29 (KPI alt) | ✅ KPI card 205px (era 298px) |

## Prioridade

| ID | Sev | Esforço | Sprint |
|----|:--:|:--:|--------|
| BH-01 | 🔴 | S | 30 (este) |
| BH-02 | 🟠 | M | 31 |
| BH-03 | 🟡 | S | 30 (este) |

**Score estimado:** o produto continua em 95-96/100. Sprint 30 fix
BH-01 + BH-03 = mantém base estável. Sprint 31 traz Forecast = abre
caminho pros próximos personas (Carlos/Helena).
