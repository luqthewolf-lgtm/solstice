# Sprint 23 — Persona Walkthrough (UX / Organização / Componentes)

> Pedido explícito do usuário: _"pegar todas as personas que a gente já utilizou
> aqui, e fazer um teste de por exemplo, qual que foi o objetivo dela aqui?
> Quais componentes mais usados por eles? Quais são as abas mais usadas por
> eles? Quais são as dificuldades que estão tendo de ficar mexendo no painel?"_
>
> Esta auditoria reproduz a jornada de cada persona com o dataset exemplar
> (`vendas_br_dummy.csv`) e mapeia objetivo, fluxo, abas, componentes e
> fricção observada — para guiar as próximas correções de Sprint 23.

---

## 1. Personas e objetivos

| # | Persona | Função | Objetivo no Solstice |
|---|---------|--------|----------------------|
| P1 | **Marina** | SRE / Confiabilidade | Importar 200k linhas e validar que o app não trava; medir tempo de boot e memory footprint. |
| P2 | **Rafael** | Arquiteto de software | Avaliar limites de escala, modularidade e qualidade interna do código (testar antipadrões e custos de manutenção). |
| P3 | **Júlia** | Qualidade / QA | Importar CSVs sujos, achar bugs visíveis em quality card, validar parse-errors flow. |
| P4 | **André** | Segurança / Compliance | Verificar XSS, persistência leak, telemetria silenciosa, headers exportados. |
| P5 | **Beatriz** | UX Lead | Avaliar fluxo do usuário leigo — onboarding, descobrir features, mental model. |
| P6 | **Carlos** | Comercial / Mercado | Comparar com Power BI / Tableau / Looker em features visíveis; gauge / KPI metas / temas. |
| P7 | **Helena** | CTO / Patrono | Avaliação executiva — "vale produtizar?" — risco, defensibilidade, roadmap. |

---

## 2. Mapa de uso por persona

### Abas mais usadas

| Aba | P1 SRE | P2 Arq | P3 QA | P4 Sec | P5 UX | P6 Com | P7 CTO |
|-----|:------:|:------:|:-----:|:------:|:-----:|:------:|:------:|
| Dados (`#tab-data`) | ✅✅✅ | ✅ | ✅✅✅ | ✅✅ | ✅✅ | ✅ | ✅ |
| Modelo (`#tab-model`) | ✅ | ✅✅✅ | ✅✅ | ✅ | ✅ | ✅✅ | ✅ |
| Canvas (`#tab-canvas`) | ✅ | ✅✅ | ✅ | ✅✅ | ✅✅✅ | ✅✅✅ | ✅✅✅ |
| Insights painel direito | ⚪ | ✅ | ✅✅ | ✅ | ✅✅ | ✅ | ✅✅ |
| Diferenciais e Operacional | ⚪ | ✅ | ⚪ | ✅✅ | ⚪ | ✅ | ✅✅ |

### Componentes mais usados

| Componente | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|------------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| KPI / BigNum | ⚪ | ✅ | ⚪ | ✅ | ✅✅ | ✅✅✅ | ✅✅✅ |
| Série temporal | ⚪ | ✅ | ⚪ | ⚪ | ✅✅ | ✅✅ | ✅✅ |
| Distribuição / Histograma | ⚪ | ✅ | ✅ | ⚪ | ✅ | ✅ | ⚪ |
| Boxplot | ⚪ | ✅✅ | ✅✅ | ⚪ | ✅ | ⚪ | ⚪ |
| Heatmap calendário | ⚪ | ✅ | ⚪ | ⚪ | ✅✅ | ✅ | ✅ |
| Gauge | ⚪ | ⚪ | ⚪ | ⚪ | ✅✅ | ✅✅✅ | ✅ |
| Tabela (Vtable) | ✅✅✅ | ✅ | ✅✅ | ✅✅ | ✅ | ⚪ | ⚪ |
| Markdown / Annotations | ⚪ | ⚪ | ⚪ | ⚪ | ✅✅ | ✅ | ✅✅ |
| Forecast | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ✅ | ✅ |

### Cruzamento — top 3 atividades por persona

- **Marina (SRE):** importar grande → ver progresso → checar quality card.
- **Rafael (Arq):** abrir Modelo → arrastar relações entre bases → ver canvas.
- **Júlia (QA):** importar CSV sujo → abrir parse-errors → reparar/exportar.
- **André (Sec):** exportar SVG → ver atributos → checar persistence keys.
- **Beatriz (UX):** welcome → exemplo → editar título → trocar tema.
- **Carlos (Com):** showcase → KPI/Gauge/Heatmap → tema custom → screenshot.
- **Helena (CTO):** showcase → insights painel → resumo executivo → forecast.

---

## 3. Fricções por persona (verbalizado em 1ª pessoa)

### P1 — Marina (SRE)

> _"O AutoDashboard rodando silent no Express é uma surpresa hostile. Eu  
> queria validar o pipeline de import — toda vez que importo o exemplo, o  
> app monta 6 componentes sem perguntar. Se eu tiver 200k linhas, isso  
> processa tudo de uma vez e pode travar a tab."_

- 🔴 **F-01** AutoDashboard autorun no Express = pico de CPU sem aviso.
- 🟠 **F-02** Status "Salvo há Xs" no header poluindo enquanto importo.
- 🟡 **F-03** Não consigo desabilitar AutoDashboard via setting visível.

### P2 — Rafael (Arquiteto)

> _"Quero arrastar a base secundária pra criar uma relação no Modelo, mas  
> a aba de Modelo não tem drag funcional. Power BI permite ligar tabelas  
> com arrasto direto. Aqui é só uma lista — parece protótipo."_

- 🔴 **F-04** Aba Modelo sem drag (nem visual) entre bases ↔ relação.
- 🟠 **F-05** Quando carrego 2 bases, a 2ª não mostra colunas no editor.
- 🟠 **F-06** "Bases carregadas" vaza pra aba Dados (era pra ficar só em Modelo).
- 🟡 **F-07** Não consigo desligar uma base pra ver só a outra.

### P3 — Júlia (QA)

> _"Importo um CSV de teste com 200 linhas só. O quality card diz que estão  
> 'bons' (200 válidos), mas mostra '76/100' — score baixo. Por quê?"_

- 🔴 **F-08** Quality score baixo mesmo com 100% válidos = falso positivo.
- 🟠 **F-09** Tabela inferior em Dados aparece em lugar que parece preview, mas é a tabela completa — desorienta.
- 🟡 **F-10** Pra ver todas as colunas da tabela, preciso scroll horizontal e vertical (não usa o espaço todo).

### P4 — André (Sec)

> _"O ExportSVG está com escapeHtml corretamente, mas as autosaves no IDB  
> rodam silenciosas sem o usuário saber. Quero um indicador claro de que  
> dados estão sendo gravados local — privacidade matters."_

- 🟠 **F-11** AutoSave silent no IDB sem indicador visual claro.
- 🟡 **F-12** Sem indicador "modo offline / 100% local" no header.

### P5 — Beatriz (UX)

> _"O welcome page está bonito mas:_
> - _O tour interativo está literalmente grudado com o box, sem ar visual._
> - _'Dashboard sem título' aparece flutuando no canvas vazio — confuso._
> - _A barra lateral 'o que dá pra construir' não some mesmo eu tentando fechar._
> - _Auto-Dashboard rodando sem pedir é agoniante."_

- 🔴 **F-13** "Dashboard sem título" no welcome ❌ visual quebrado. *[FIXED — UX-02]*
- 🔴 **F-14** "O que dá pra construir" mesmo após "remover". *[FIXED — UX-01]*
- 🔴 **F-15** AutoDashboard automático sem confirmação. *[FIXED — UX-03]*
- 🟠 **F-16** Tour grudado no box (positioning).
- 🟠 **F-17** Inline edit do título do dashboard "quebra" ao selecionar texto. *[FIXED — UX-04]*
- 🟡 **F-18** Sidebar visual feio — preview + colunas calculadas no fim.

### P6 — Carlos (Comercial)

> _"Quero comparar com Power BI. Gauge é fundamental pra dashboard exec —  
> mas aqui ocupa metade do espaço vazio, e não consigo reduzir. KPIs deveriam  
> auto-detectar meta (média histórica? p95?)."_

- 🔴 **F-19** Gauge ocupa metade do slot vazia — proporção quebrada.
- 🟠 **F-20** KPI exige preencher Meta/Média manualmente — deveria auto-sugerir.
- 🟠 **F-21** Tab "Diferenciais e Operacional" tem badge "3" cortado por seta.

### P7 — Helena (CTO)

> _"Visão geral não faz nada — clico e nada acontece. Falta ROI / executive  
> view real. O Resumo executivo é bom mas separado do canvas — deveria ser  
> a primeira tela."_

- 🔴 **F-22** "Visão geral" sem função — tab vazia / no-op.
- 🟠 **F-23** Resumo executivo escondido em modal — deveria ser tab persistente.

---

## 4. Priorização (impacto × esforço)

> **Severidade:** 🔴 bloqueia uso · 🟠 frustra · 🟡 polish.
> **Esforço:** S=small (<100 linhas), M=medium (200-500 linhas), L=large (>500 linhas).

| ID | Descrição | Sev | Esf | Status |
|----|-----------|:---:|:---:|--------|
| F-13 | "Dashboard sem título" no welcome | 🔴 | S | ✅ Sprint 23 |
| F-14 | "O que dá pra construir" removido | 🔴 | S | ✅ Sprint 23 |
| F-15 | AutoDashboard autorun no Express | 🔴 | S | ✅ Sprint 23 |
| F-17 | Inline edit do título quebra com seleção | 🟠 | S | ✅ Sprint 23 |
| F-08 | Quality score falso positivo | 🔴 | M | Pendente — Sprint 24 |
| F-04 | Aba Modelo sem drag funcional | 🔴 | L | Pendente — Sprint 25 |
| F-19 | Gauge proporção quebrada | 🔴 | S | Pendente — Sprint 24 |
| F-22 | "Visão geral" sem função | 🔴 | M | Pendente — Sprint 24 |
| F-20 | KPI auto-sugerir Meta/Média | 🟠 | S | Pendente — Sprint 24 |
| F-05 | 2ª base sem colunas no editor | 🟠 | M | Pendente — Sprint 25 |
| F-06 | "Bases carregadas" vaza pra Dados | 🟠 | S | Pendente — Sprint 25 |
| F-21 | Badge "3" cortado em tab | 🟠 | S | Pendente — Sprint 24 |
| F-23 | Resumo executivo como tab | 🟠 | M | Pendente — Sprint 24 |
| F-16 | Tour grudado no box | 🟠 | S | Pendente — Sprint 24 |
| F-18 | Sidebar organização visual | 🟡 | M | Pendente — Sprint 25 |
| F-09 | Tabela inferior em Dados confunde | 🟡 | S | Pendente — Sprint 24 |
| F-10 | Tabela full sem scroll completo | 🟡 | S | Pendente — Sprint 24 |
| F-11 | AutoSave silent sem indicador | 🟡 | S | Pendente — Sprint 25 |
| F-01 | AutoDash autorun = pico CPU | 🔴 | – | ✅ resolvido por F-15 |

---

## 5. Conclusões para próximos sprints

**Sprint 23** atacou 4 problemas mais visíveis no welcome / canvas vazio (F-13,
F-14, F-15, F-17) — todos com toques pequenos mas críticos pra primeira
impressão. Validação real no preview no próximo passo.

**Sprint 24** deve focar em **componentes** (Gauge, KPI auto, Visão geral, tabs
badges, tabela layout) — todos isolados, S/M esforço.

**Sprint 25** deve focar em **modelo de dados** (multi-base, drag relations,
sidebar organization) — esforço L, requer reformulação visual.
