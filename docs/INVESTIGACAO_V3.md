# Investigação V3 — Robustez · Polish · Power User

> Continuação após V1 (25 personas · 108 findings) + V2 (8 personas focus em
> "acertar o básico") + 6 sprints + BLOCO 1 (feedback direto + multi-page).
>
> Esta investigação cobre ângulos AINDA NÃO atacados: acessibilidade real
> (NVDA), perf em hardware antigo, microcopy/voice & tone, onboarding
> zero-knowledge, security pentest, manutenibilidade, power user diário
> (5h/dia), resiliência/erros.

---

## 1. 10 personas novas

### 26. ♿ Marina Velasco · Acessibilidade real (ex-Globo Acessibilidade)
> "Se eu não consigo navegar com NVDA, seu produto não existe pra 30 milhões de brasileiros."

Achados: `AC-01..05` — cards de KPI sem `aria-label`, modais sem focus trap, tabelas sem `caption`/`scope`, ícones-botão sem label, `outline:none` global mata foco.

### 27. 💻 Roberto Tanaka · Perf hardware antigo (ex-Mercado Livre)
> "Seu cliente real abre isso num Positivo de 2018 com 4GB. Otimize ou perca."

Achados: `RT-01..05` — parse de 2.12MB bloqueia main thread, charts redesenham todos no resize, scroll/resize sem throttle, DOM 5000+ nodes sem virtualização, imagens sem lazy.

### 28. 🌍 Yuki Tanaka · Internacionalização (ex-Mercado Pago LatAm)
> "Hardcoded 'R$' e 'dd/mm/yyyy' é dívida garantida quando expandirem."

Achados: `I18N-01..04` — strings hardcoded sem dicionário central, formatação inconsistente, datas fixas BR, pluralização hardcoded.

### 29. 🎨 Helena Crick · Design system + dark mode (ex-Linear, Vercel)
> "Você tem 47 tons de cinza diferentes hardcoded. Não é estética, é desleixo."

Achados: `DS-01..05` — cores semânticas inconsistentes, dark mode parcial, sombras com 6 valores diferentes, 8 tamanhos de fonte aleatórios, warning sem contraste WCAG AA.

### 30. ✍️ Pedro Vasconcellos · UX writing (ex-Nubank Content Design)
> "Microcopy é UX. 'Erro 500' não ajuda ninguém — fale como humano."

Achados: `UX-01..05` — erros genéricos sem next-step, empty state vazio sem convite, jargão técnico vazando, tooltips redundantes, ações destrutivas sem confirmação clara.

### 31. 🆕 Cláudia Marrone · Onboarding zero-knowledge (ex-Stone PME)
> "Lojista de bairro fecha em 8 segundos se não entender. Não é burro — é apressado."

Achados: `OB-01..05` — sem tour guiado obrigatório no welcome, sem demo data óbvio, sem glossário inline, sem vídeo/GIF tutorial, botão ajuda escondido.

### 32. 🔒 Lucas Mendonça · Pentester (ex-Tempest Security)
> "Você tem `eval()` no código? Então temos um problema."

Achados: `SEC-01..05` — innerHTML com input de usuário, sem CSP (✅ já tem), localStorage texto puro, upload valida só extensão, CDN sem SRI (✅ já tem).

### 33. 🧹 Renata Holzschuh · Manutenibilidade (ex-Spotify Eng)
> "Arquivo único de 2MB é estilo, *mas* precisa de disciplina obsessiva."

Achados: `MNT-01..06` — funções 200+ linhas, globais espalhadas, magic numbers sem nome, sem JSDoc, sem `"use strict"`, estado mutável sem padrão.

### 34. 🔁 Augusto Whitaker · Power user diário (controller que vive em BI)
> "Eu uso isso 5h por dia. Cada clique a mais é um cigarro de stress."

Achados: `PW-01..06` — sem atalhos teclado (✅ Ctrl+K já), filtros não persistem entre sessões, sem favoritos/views salvas, export Excel quebra, sem undo (✅ tem), multi-tab dessincroniza.

### 35. 💥 Sofia Brandão · Resiliência (ex-Auth0 SRE)
> "O que acontece quando o usuário fecha o laptop no meio? Não sabe? Não está pronto."

Achados: `RES-01..05` — sem `window.onerror`, uploads sem progress/cancel, sem auto-save de estado, validação só no submit, sem telemetria local.

---

## 2. Top 47 achados (já consolidados na resposta do agent)

### Cherry-pick para próximos blocos (gaps reais, não-duplicados)

Filtrado contra o que JÁ EXISTE em sprints anteriores:

| Bloco | ID | Severidade | Esforço | Por que importa |
|---|---|---|---|---|
| **2** | RES-01 | 🔴 | 1h | Sem error handler global, erros somem |
| **2** | UX-02 | 🟠 | 1h | Empty states convidantes ↑ ativação |
| **2** | PW-02 | 🟠 | 1h | Filtros persistirem entre sessões |
| **2** | AC-01 | 🟠 | 4h | KPI cards aria-label (NVDA) |
| **2** | MNT-03 | 🟡 | 1h | Magic numbers → constantes |
| **2** | AC-04 | 🟠 | 4h | Ícone-botão sem aria-label (audit) |
| **3** | DS-04 | 🟡 | 4h | Escala tipográfica consolidada |
| **3** | DS-03 | 🟡 | 4h | Sombras padronizadas |
| **3** | UX-01 | 🟡 | 4h | Mensagens erro com next-step |
| **3** | UX-05 | 🟡 | 4h | Ações destrutivas com confirmação |
| **3** | RT-03 | 🟠 | 1h | Throttle scroll/resize |
| **3** | OB-05 | 🟡 | 1h | FAB "?" sempre visível |
| **4** | RT-04 | 🔴 | 1d | Virtualização tabela ≥50k |
| **4** | PW-03 | 🟡 | 1d | Views salvas (favoritos) |
| **4** | RES-03 | 🟠 | 4h | Auto-save de estado |
| **4** | I18N-01/02 | 🟡 | 1d | Dicionário central de strings |

---

## 3. Princípios herdados V3

- **A11y é binário** (Marina/Globo): ou funciona com NVDA, ou não funciona.
- **Hardware fraco é a maioria** (Roberto/ML): 4GB Positivo é o cliente real.
- **Dia 1 vs Dia 30** (Augusto): vitórias de power user multiplicam ROI.
- **Microcopy é UX** (Pedro/Nubank): cada string é uma micro-decisão.
- **Erros silenciosos = bugs invisíveis** (Sofia/Auth0): sempre logar.
- **Manutenibilidade compunde** (Renata/Spotify): disciplina hoje, velocidade amanhã.

---

_Documento gerado em paralelo durante BLOCO 2. Atualizado a cada bloco subsequente conforme novos achados aparecem ou são fechados._
