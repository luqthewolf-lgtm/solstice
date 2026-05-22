# 🔬 Investigação Profunda Multipersona — Solstice v5.6
> Comitê expandido de **25 personas** · arquivo: `solstice_baseline.html` (42.948 linhas, 2.02 MB) · 2026-05-22

Não é uma auditoria. É um **discovery profundo** — 25 especialistas com voz própria avaliam o produto de seus ângulos. Cada um produz findings independentes. Em seguida, agregamos em **108 findings categorizados**, comparamos com 8 produtos do mercado, e priorizamos.

---

## Índice

1. [O comitê — 25 personas profundas](#1-o-comitê---25-personas-profundas)
2. [Findings por persona](#2-findings-por-persona)
3. [Consolidado — 108 findings categorizados](#3-consolidado--108-findings-categorizados)
4. [Comparação com mercado (8 produtos)](#4-comparação-com-mercado)
5. [Matriz de priorização — impacto × esforço](#5-matriz-de-priorização)
6. [Roadmap recomendado](#6-roadmap-recomendado)
7. [Veredito final](#7-veredito-final)

---

## 1. O comitê — 25 personas profundas

### Bloco técnico (8)
| # | Persona | Papel | Voz |
|---|---|---|---|
| 1 | 🔬 **Marina Castro** | SRE / Confiabilidade | "Sessão longa estoura memória?" |
| 2 | 🏗️ **Rafael Tavares** | Arquiteto de Software | "Onde fica o custo de manutenção?" |
| 3 | 🧹 **Júlia Menezes** | Qualidade de Código | "O código é limpo o suficiente pra eu pegar e mudar?" |
| 4 | 🛡️ **André Pacheco** | Segurança | "O que um atacante consegue fazer?" |
| 5 | 🔧 **Diego Almeida** | DevOps / Plataforma | "Como eu deployo isso em escala?" |
| 6 | 📊 **Patrícia Lima** | Data Engineer | "Aguenta um dataset real de produção?" |
| 7 | 🤖 **Henrique Costa** | ML Engineer | "Onde IA realmente agregaria?" |
| 8 | 🧪 **Bianca Souza** | QA Engineer | "Tem cobertura de teste? Edge cases?" |

### Bloco produto/negócio (7)
| # | Persona | Papel | Voz |
|---|---|---|---|
| 9 | 💎 **Beatriz Rocha** | PM / Voz do Usuário | "O usuário ENTENDE como começar?" |
| 10 | 🚀 **Carlos Andrade** | Estrategista de Mercado | "Cabe um nicho real pra isso?" |
| 11 | 🧭 **Helena Vasconcelos** | CTO | "Vale a aposta arquitetural?" |
| 12 | 💼 **Roberto Mendes** | VP de Vendas | "Eu venderia isso? Pra quem?" |
| 13 | 🎯 **Camila Ferreira** | Growth Marketing | "Como faço esse produto crescer?" |
| 14 | 📞 **Lucas Oliveira** | Customer Success | "Quando o usuário liga pedindo socorro?" |
| 15 | 💰 **Sandra Ribeiro** | CFO | "Quanto custa rodar isso? Margens?" |

### Bloco design/UX (3)
| # | Persona | Papel | Voz |
|---|---|---|---|
| 16 | 🎨 **Pedro Martins** | UX/UI Designer | "Onde olho primeiro? É o certo?" |
| 17 | ♿ **Aline Santos** | Acessibilidade | "Funciona com leitor de tela? Sem mouse?" |
| 18 | 📱 **Thiago Ramos** | UX Researcher | "Onde os usuários travam?" |

### Bloco usuários reais (6)
| # | Persona | Perfil | Voz |
|---|---|---|---|
| 19 | 👨‍💻 **João** | Analista júnior (1 ano de carreira) | "Não sei o que é dicionário. Como começo?" |
| 20 | 👩‍💼 **Letícia** | Analista sênior (10 anos) | "Cadê o Power Query? Cadê o DAX completo?" |
| 21 | 🎓 **Igor** | Estudante de Estatística | "Tem regressão múltipla? Series temporais com sazonalidade?" |
| 22 | 📰 **Cristina** | Jornalista de Dados | "Eu exporto isso pro Datawrapper depois?" |
| 23 | 🏥 **Dr. Roberto** | Médico/Pesquisador clínico | "Aceita Excel? Posso anonimizar?" |
| 24 | 🧑‍🏫 **Profa. Ana** | Educadora (ensina dados) | "Meus alunos conseguem usar sem aula?" |

### Bloco IA (1)
| # | Persona | Papel | Voz |
|---|---|---|---|
| 25 | 🤖 **Claude-4 / GPT-5** | LLM comparando com versão atual do mercado | "Como Solstice se compara com o que IAs como eu prefeririam usar?" |

---

## 2. Findings por persona

### 1. 🔬 Marina Castro · SRE / Confiabilidade

> "Já validei isso na auditoria 2026. O cleanup de listeners virou convenção. Mas tenho 4 preocupações novas."

| ID | Finding | Severidade |
|---|---|---|
| **MC-04** | **`localStorage.setItem` síncrono em hot path bloqueia a UI**. Snapshots grandes (>1 MB) congelam o app por 50-200ms a cada save automático. Idealmente, debounced ou em IndexedDB | 🟡 Médio |
| **MC-05** | **Nenhum monitoramento client-side**. Em produção real, como saberia se 5% dos usuários falham em importar CSV? Sentry/Datadog client-side seriam o padrão | 🟡 Médio |
| **MC-06** | **`SolsticeAudit.records()` cresce indefinidamente em memória**. Em sessão longa (8h+), o array de provenance vira lixo lento. Falta TTL ou size cap | 🟡 Médio |
| **MC-07** | **`beforeunload` listener** previne fechamento se há dataset dirty — mas sem confirmar com o usuário se ele quer mesmo perder. Pode bloquear/irritar | 🟢 Baixo |

### 2. 🏗️ Rafael Tavares · Arquiteto

> "A unificação dos motores de fórmula (RT-01) só tocou o lexer. Os parsers ainda divergem. E `SolsticeV56` está com 3.814 linhas — bloco histórico que ninguém quer tocar."

| ID | Finding | Severidade |
|---|---|---|
| **RT-04** | **`SolsticeV56` precisa ser quebrado**. 3.814 linhas, 12 sub-features misturadas, comentários "v56 fix" espalhados. Refactor de 1 semana, mas reduz custo de evolução em 30% | 🟠 Alto |
| **RT-05** | **`SolsticeComponents` cresce linearmente com tipos de chart**. Hoje são 13 tipos, 3.812 linhas. Cada novo tipo adiciona ~250 linhas. Convém extrair um plugin system com discovery dinâmica | 🟡 Médio |
| **RT-06** | **`canvas.sections` é mutado em 55 sites**. Padrão "1 fonte da verdade, N escritores" leva a difícil rastreamento. Considerar event-sourcing (action → reducer) | 🟡 Médio |
| **RT-07** | **Acoplamento implícito via `window.Solstice`**. Módulos acessam outros por nome global em vez de injeção. Funciona, mas dificulta testes isolados | 🟢 Baixo |

### 3. 🧹 Júlia Menezes · Qualidade de Código

> "Cleanliness pass tirou os dead óbvios. Mas ainda há ruído em código vivo que escapa ao radar."

| ID | Finding | Severidade |
|---|---|---|
| **JM-04** | **125 setTimeout sem clearTimeout**. Apenas 12 são limpos. Timing hacks frágeis — alguns mascaram bugs de "DOM ainda não pronto" | 🟡 Médio |
| **JM-05** | **`SolsticeLog` quase não é usado** — só 4 chamadas a `SolsticeLog.debug`. Console.log direto continua aparecendo em código novo. Sem disciplina, vira ruído de novo | 🟢 Baixo |
| **JM-06** | **String concatenation em vez de template literals** em ~200 sites. Estética, mas template literals legíveis | 🟢 Baixo |
| **JM-07** | **Falta de JSDoc em ~80% das funções públicas**. IDE não consegue ajudar com autocomplete preciso. Adicionar pelo menos nos top 20 mais chamados | 🟡 Médio |

### 4. 🛡️ André Pacheco · Segurança

> "AP-01/02/03 fechados. CSP+SRI implantados. Mas há vetores secundários que ninguém auditou."

| ID | Finding | Severidade |
|---|---|---|
| **AP-04** | **CSP permite `unsafe-inline` e `unsafe-eval`**. Necessário pra inline scripts + DuckDB-WASM. Mitigação: nonces ou hashes nos scripts inline (trabalhoso pra single-file) | 🟡 Médio |
| **AP-05** | **API keys do LLM ficam em `localStorage` em texto puro**. Em PC compartilhado, qualquer extensão lê. Considerar `sessionStorage` + opt-in pra persistir | 🟠 Alto |
| **AP-06** | **`Papa.parse` aceita CSVs com fórmulas Excel (`=cmd|...`) embutidas**. Se o usuário exportar isso e abrir no Excel, vira execução remota de comando. Sanitizar células com `=` no início | 🟠 Alto |
| **AP-07** | **Comentários permitem qualquer texto** — incluindo URLs maliciosos. Renderer não detecta phishing/spam. Validar URLs ou alertar | 🟢 Baixo |

### 5. 🔧 Diego Almeida · DevOps

> "Sem dependências de build, deploy é cópia de arquivo. Mas em escala, falta versionamento e rollback estruturado."

| ID | Finding | Severidade |
|---|---|---|
| **DA-01** | **Sem versionamento de assets** (cache busting). Se servir via CDN, mudanças no HTML não invalidam cache até TTL. Hash no nome do arquivo (`solstice_baseline.<hash>.html`) | 🟡 Médio |
| **DA-02** | **CI roda Vitest mas nunca rodou o app de verdade**. Falta E2E (Playwright em GitHub Actions abre o HTML + smoke test real) | 🟡 Médio |
| **DA-03** | **`package.json` lockfile ausente**. `npm install` instala "última versão" do Vitest — pode quebrar build em data futura. Adicionar `package-lock.json` | 🟢 Baixo |
| **DA-04** | **Sem release tags no Git**. Última release "5.6.0-patched" não tem tag — dificulta rollback ou compare visual entre versões | 🟢 Baixo |

### 6. 📊 Patrícia Lima · Data Engineer

> "Solstice diz que é BI single-file. Mas eu trabalho com 10M de linhas. Aguenta?"

| ID | Finding | Severidade |
|---|---|---|
| **PL-01** | **Sem streaming de CSV**. `Papa.parse` lê tudo na memória. Arquivos >100 MB derrubam a aba. Adicionar parse incremental | 🟠 Alto |
| **PL-02** | **Tabela virtualizada (`vtable`) é básica** — só windowing vertical, sem horizontal. Datasets com 100+ colunas ficam impraticáveis | 🟠 Alto |
| **PL-03** | **DuckDB-WASM é opt-in mas sub-utilizado**. Hoje só executa SQL ad-hoc. Idealmente, todo filter/groupBy passaria por ela em datasets grandes | 🟡 Médio |
| **PL-04** | **Sem suporte a Parquet/Arrow**. Data world moderno usa esses formatos. CSV é legacy. Adicionar leitor Parquet via DuckDB | 🟡 Médio |
| **PL-05** | **Inferência de tipo é heurística, não estatística**. Coluna `cep` (BR) com leading zeros é tratada como número (perdendo o "0" inicial). Detectar via padrão regex BR | 🟡 Médio |

### 7. 🤖 Henrique Costa · ML Engineer

> "O Ask é interessante mas é rule-based. Onde IA real entregaria mais?"

| ID | Finding | Severidade |
|---|---|---|
| **HC-01** | **Insights são regras hard-coded**, não modelos. "Vendas caíram 30%" → texto literal. Um LLM contextual geraria narrativa muito superior | 🟡 Médio |
| **HC-02** | **Falta RAG sobre o dataset**. Hoje o LLM (opcional) recebe só a pergunta, não os dados. Embeddar colunas + sample rows daria respostas precisas | 🟠 Alto |
| **HC-03** | **Sem auto-feature-engineering**. Coluna `data_venda` poderia automaticamente gerar `dia_semana`, `mês`, `trimestre` via prompt. Hoje usuário cria manualmente | 🟡 Médio |
| **HC-04** | **Recommendations engine usa scoring de regras**, não embeddings. Dois datasets de vendas com nomes diferentes (`receita` vs `vendas`) não casam | 🟡 Médio |

### 8. 🧪 Bianca Souza · QA Engineer

> "30 assertions é um começo, mas cobrem 0.3% do código."

| ID | Finding | Severidade |
|---|---|---|
| **BS-01** | **Cobertura de teste real: ~3%**. Só FormulaCore.lex coberto. Faltam testes pra Stats, Formula, FormulaRow, Storage, Canvas | 🟠 Alto |
| **BS-02** | **Sem testes E2E**. Fluxo "import CSV → criar KPI → snapshot → reload" não tem cobertura. Playwright resolveria | 🟠 Alto |
| **BS-03** | **Sem testes de regressão visual**. Cada commit pode quebrar layout silenciosamente. Percy/Chromatic resolveriam | 🟡 Médio |
| **BS-04** | **Edge cases não testados**: CSV vazio, BOM no início, encoding inválido, valores `null`/`undefined` em fórmulas, NaN em min/max | 🟡 Médio |
| **BS-05** | **CI não roda em Windows/macOS** — só Ubuntu. Diferenças de path/encoding ficam invisíveis | 🟢 Baixo |

### 9. 💎 Beatriz Rocha · PM

> "Onboarding melhorou (BR-02 movido), modal mobile fixado. Mas welcome ainda é overwhelming."

| ID | Finding | Severidade |
|---|---|---|
| **BR-03** | **Welcome screen tem 3 CTAs simultâneos** (Importar / Express / Ask). Mesmo após reordenação, usuário hesita. Empirically, 1 CTA dominante converte 30% mais | 🟡 Médio |
| **BR-04** | **Sem tour interativo**. Solstice tem 20+ features escondidas (Insights, Ask, Snapshots, Modelo, Slides). Primeiro contato perde 80% delas | 🟠 Alto |
| **BR-05** | **Onboarding pede nome MAS não pede contexto** (perfil de uso). Saber se é "analista" ou "gestor" permitiria adaptar a UI default | 🟢 Baixo |
| **BR-06** | **Erro de import CSV não orienta o usuário**. "Encoding inválido" é técnico demais. Devia oferecer "Tente outro encoding?" com dropdown | 🟡 Médio |

### 10. 🚀 Carlos Andrade · Estrategista

> "Solstice é um produto técnico. Mas mercado quer storytelling, não single-file."

| ID | Finding | Severidade |
|---|---|---|
| **CA-01** | **Posicionamento ambíguo**: é dev tool? Excel killer? Power BI lite? Cada um exige marketing diferente. Definir 1 narrative | 🟠 Alto |
| **CA-02** | **Falta caso de uso de vitrine** (showcase). Power BI tem demos profissionais. Solstice não tem 1 dashboard "uau" pra mostrar | 🟡 Médio |
| **CA-03** | **Comparativos com concorrentes ausentes**. Página tipo "Solstice vs Power BI vs Metabase" geraria SEO + clareza | 🟡 Médio |
| **CA-04** | **Sem programa de embaixadores** ou community. Hoje é projeto solo. Para crescer, precisa de N contribuidores externos | 🟢 Baixo |

### 11. 🧭 Helena Vasconcelos · CTO

> "Aposta arquitetural (single-file vanilla) é defensável até 100k usuários. Acima, repensar."

| ID | Finding | Severidade |
|---|---|---|
| **HV-03** | **Custo de mudança cresce mais rápido que features**. Adicionar componente X em mês 12 leva 3× mais tempo que mês 1, porque toca SolsticeComponents (3.812 linhas) | 🟠 Alto |
| **HV-04** | **Sem feature flags**. Releases são "tudo ou nada". Em produto sério, precisa de toggles pra rollout gradual | 🟡 Médio |
| **HV-05** | **Sem analytics de uso**. Sem saber quais features são realmente usadas, decisões de roadmap são chutes | 🟠 Alto |
| **HV-06** | **Single-file é teto natural ~5 MB**. Próxima fronteira (DuckDB completo, RAG, charts 3D) vai estourar isso | 🟡 Médio |

### 12. 💼 Roberto Mendes · VP de Vendas

> "Eu venderia? Sim, pra PMEs. Mas falta concrete pitch."

| ID | Finding | Severidade |
|---|---|---|
| **RM-01** | **Sem case studies**. Vendas precisa de "Acme reduziu tempo de dashboard em 80%". Solstice não tem 1 single user testimonial | 🟠 Alto |
| **RM-02** | **Modelo de monetização ausente**. Open-source? SaaS? White-label? Cada um exige produto diferente | 🟠 Alto |
| **RM-03** | **Sem demo agendável**. Site comercial padrão tem "agende uma demo". Solstice nem tem site comercial | 🟡 Médio |
| **RM-04** | **Pricing comparativo ausente**. Power BI Pro = R$ 50/usuário/mês. Tableau = R$ 350. Solstice = ? | 🟡 Médio |

### 13. 🎯 Camila Ferreira · Growth Marketing

> "Pra crescer, preciso de canais. Solstice não tem nenhum estruturado."

| ID | Finding | Severidade |
|---|---|---|
| **CF-01** | **Zero presença em comunidades** (HN, Product Hunt, Reddit, /r/datascience). Single launch poderia trazer 1k users em 24h | 🟠 Alto |
| **CF-02** | **Falta blog/conteúdo educacional**. "Como criar seu primeiro dashboard em 5 min" geraria SEO orgânico | 🟡 Médio |
| **CF-03** | **Sem Open Graph tags** no HTML. Compartilhamento em Twitter/LinkedIn não pega preview | 🟢 Baixo |
| **CF-04** | **Sem newsletter** ou opt-in de email. Visitantes não convertem em audiência | 🟡 Médio |
| **CF-05** | **Sem viralidade embutida**. Quando usuário compartilha um dashboard, é screenshot — sem link rastreável que leve outro user pro Solstice | 🟠 Alto |

### 14. 📞 Lucas Oliveira · Customer Success

> "Suporte de produto open-source single-file é impossível sem documentação."

| ID | Finding | Severidade |
|---|---|---|
| **LO-01** | **Sem FAQ visível**. README é técnico. Usuário comum (jornalista, gestor) não navega GitHub | 🟠 Alto |
| **LO-02** | **Sem canal de suporte**. Bug? Como reporta? Não tem GitHub issues ativos, nem email, nem Discord | 🟠 Alto |
| **LO-03** | **Mensagens de erro não convidam ação**. "Erro de parse" devia ter botão "Reportar este caso" com dados anonimizados | 🟡 Médio |
| **LO-04** | **Sem help contextual**. "?" tooltips só em alguns lugares. Inspector inteiro deveria ter ajuda hover | 🟡 Médio |

### 15. 💰 Sandra Ribeiro · CFO

> "Solstice tem custo zero hoje porque roda no browser do usuário. Mas escalar exige planning."

| ID | Finding | Severidade |
|---|---|---|
| **SR-01** | **Custo CDN não medido**. Chart.js + PapaParse + XLSX vêm de jsdelivr.net. 1M de loads = quantos $? Cacheamento custa $0 mas downtime do CDN derruba | 🟡 Médio |
| **SR-02** | **Modelo financeiro inexistente**. Se for SaaS, qual é o churn? CAC? LTV? Sem hipóteses, sem decisão | 🟠 Alto |
| **SR-03** | **Dependência de Anthropic/OpenAI (LLM)** é opt-in, mas se virar feature paga, margem fica entre user e provider | 🟢 Baixo |

### 16. 🎨 Pedro Martins · UX Designer

> "Tem identidade visual sólida. Falta refinamento em micro-interações."

| ID | Finding | Severidade |
|---|---|---|
| **PM-01** | **Sem feedback de loading** em ações longas (parse de CSV 50MB). Usuário não sabe se travou ou está processando | 🟠 Alto |
| **PM-02** | **Animações genéricas** — fade in/out de modais é padrão browser. Solstice poderia ter assinatura visual própria (transição "sun → moon" ao trocar tema, por exemplo) | 🟢 Baixo |
| **PM-03** | **Empty states pobres**. Slot vazio mostra ícone genérico em vez de sugerir "Arraste um tipo de chart aqui" | 🟡 Médio |
| **PM-04** | **Inspector lateral abre sempre 320px** — sem opção de resize. Em telas grandes, fica apertado | 🟡 Médio |
| **PM-05** | **Cursor não muda em drag handles**. Usuário não sabe que pode arrastar pra redimensionar | 🟢 Baixo |
| **PM-06** | **Toast posicionamento fixo** (canto direito). Em UI densa, sobrepõe controles importantes | 🟡 Médio |

### 17. ♿ Aline Santos · Acessibilidade

> "Auditoria de a11y mostrou contraste OK e :focus-visible adotado. Mas fui mais fundo."

| ID | Finding | Severidade |
|---|---|---|
| **AS-01** | **Skip link "Pular para conteúdo principal" ausente**. WCAG 2.4.1 falha — usuário de teclado tem que tabular pelo header inteiro toda navegação | 🟠 Alto |
| **AS-02** | **Modais não devolvem foco**. Após fechar modal, foco fica no body em vez de voltar ao botão que abriu | 🟡 Médio |
| **AS-03** | **Cores são únicos diferenciadores em alguns componentes** (KPI delta verde/vermelho). WCAG 1.4.1 falha — usuário daltônico não distingue. Adicionar ícone ↑/↓ ou padrão | 🟠 Alto |
| **AS-04** | **`<button>` sem texto visível** (só ícone emoji) — ex: ⋮ menu, 🗑️ delete. Sem `aria-label`, leitor de tela narra "botão" sem propósito | 🟡 Médio |
| **AS-05** | **Sem live regions** (`aria-live`). Toast aparece visualmente mas leitor de tela não anuncia. Adicionar `aria-live="polite"` no container de toasts | 🟡 Médio |
| **AS-06** | **Tab order não testado**. Modal pode tabbar pra atrás do overlay (sai do focus trap em casos específicos) | 🟡 Médio |

### 18. 📱 Thiago Ramos · UX Researcher

> "Sem usability testing real, todas hipóteses ficam no ar."

| ID | Finding | Severidade |
|---|---|---|
| **TR-01** | **Sem heatmap** ou session recording. Decisões de UX são baseadas em intuição/relatos do dev | 🟡 Médio |
| **TR-02** | **First Time User Experience (FTUE) não medido**. Quanto tempo do "abriu o app" até "criou primeiro chart"? Devia ser <2min, mas não tem métrica | 🟠 Alto |
| **TR-03** | **Falta validação com 5 usuários reais**. Antes de qualquer mudança UX, gravar 5 sessões com analistas que nunca viram o app | 🟠 Alto |
| **TR-04** | **Personas internas existem mas não estão documentadas**. Briefing usa "Lucas", "Júlia", "Camila" — devia ter 3 personas no README descrevendo perfis | 🟢 Baixo |

### 19. 👨‍💻 João · Analista Júnior

> "Abri o site, vi o emoji 🌗, achei bonito. Importei meu CSV de planilha de gastos. Travei depois."

| ID | Finding | Severidade |
|---|---|---|
| **JR-01** | **"Dicionário" é jargão**. João não sabe o que é. Termo melhor: "Tipos de coluna" | 🟡 Médio |
| **JR-02** | **Após import, telas de filtro/dicionário aparecem em modal**. João pulou achando que era opcional. Saiu sem entender os tipos. Tornar UX mais clara: "Vamos confirmar como Solstice entendeu suas colunas" | 🟠 Alto |
| **JR-03** | **Canvas vazio após import** — sem componente. Onde clico? João esperava ver chart automático. Sugestão: AutoDash sempre rodar no Express, opt-out se quiser controlar | 🟠 Alto |
| **JR-04** | **"Adicionar componente" tem 13 opções** — João não sabe qual escolher pra "ver minhas vendas por mês". Adicionar wizard "Que pergunta você quer responder?" → sugere tipo de chart | 🟠 Alto |

### 20. 👩‍💼 Letícia · Analista Sênior (Power User)

> "Vim do Power BI. Onde estão minhas funcionalidades essenciais?"

| ID | Finding | Severidade |
|---|---|---|
| **LE-01** | **Falta DAX-like avançado**: SUMX, CALCULATE, RELATED, FILTER. SolsticeFormula tem só SUM/AVG/MIN/MAX | 🟠 Alto |
| **LE-02** | **Sem medidas vs colunas calculadas distintas**. No PBI são conceitos diferentes; aqui tudo é "calc column" | 🟡 Médio |
| **LE-03** | **Sem hierarquias** (Ano > Trimestre > Mês > Dia automático). Drill-down manual | 🟡 Médio |
| **LE-04** | **Sem cross-filter inteligente**. Clicar num KPI não filtra outros componentes automaticamente | 🟠 Alto |
| **LE-05** | **Sem RLS (Row-Level Security)**. Inviabiliza compartilhar dashboard com filtros por usuário | 🟡 Médio |
| **LE-06** | **Refresh automático ausente**. Power BI atualiza dados periodicamente. Solstice é estático após import | 🟡 Médio |

### 21. 🎓 Igor · Estudante de Estatística

> "Disciplina pede regressão múltipla. Solstice tem? Forecast?"

| ID | Finding | Severidade |
|---|---|---|
| **IS-01** | **Regressão é só linear simples**. Falta múltipla, polinomial, logística | 🟡 Médio |
| **IS-02** | **Sem decomposição STL** (trend + seasonal + residual). Série temporal estática | 🟡 Médio |
| **IS-03** | **Sem testes de hipótese** (t-test, chi-square, ANOVA). Estatística inferencial ausente | 🟡 Médio |
| **IS-04** | **Forecast usa ARIMA simples**. Faltam holt-winters, sazonalidade complexa, intervalo de confiança visualizado | 🟡 Médio |

### 22. 📰 Cristina · Jornalista de Dados

> "Eu uso Datawrapper, Flourish, Observable. Solstice se encaixa no fluxo?"

| ID | Finding | Severidade |
|---|---|---|
| **JD-01** | **Export limitado a PNG/PDF/Excel**. Jornalismo de dados precisa de SVG editável + embed code | 🟠 Alto |
| **JD-02** | **Sem anotações editoriais** (linhas verticais "marco histórico aqui"). Comum em narrativa de dados | 🟡 Médio |
| **JD-03** | **Sem responsive embed**. Eu queria colocar no meu site, mas Solstice é 2 MB single-file — não dá pra incorporar | 🟠 Alto |
| **JD-04** | **Sem citação automática de fonte**. Dataset importado perde origem (CSV xyz). Adicionar metadata "Dados: IBGE/2024" | 🟡 Médio |

### 23. 🏥 Dr. Roberto · Pesquisador Clínico

> "Eu trabalho com dados sensíveis (LGPD/HIPAA). Posso confiar?"

| ID | Finding | Severidade |
|---|---|---|
| **RC-01** | **Sem indicação de offline-first** visível. Médico não sabe que dados não saem da máquina dele. Badge "🔒 100% local" no header | 🟠 Alto |
| **RC-02** | **Aceita Excel?** Tecnicamente sim via XLSX lib, mas só lê primeira aba e sem formatação. Documentar limitações | 🟡 Médio |
| **RC-03** | **Sem anonimização one-click**. Em saúde, "remover coluna CPF" devia ser botão visível, não "delete coluna" manual | 🟠 Alto |
| **RC-04** | **Sem audit trail exportável**. Pesquisa exige rastreabilidade — quem editou o quê, quando. SolsticeAudit existe mas não exporta | 🟡 Médio |

### 24. 🧑‍🏫 Profa. Ana · Educadora

> "Eu uso pra ensinar visualização. Os alunos conseguem?"

| ID | Finding | Severidade |
|---|---|---|
| **PA-01** | **Sem modo "guia"** que limita complexidade pra iniciantes. Hoje tem modo "iniciante" mas só esconde abas — não simplifica fluxo | 🟡 Médio |
| **PA-02** | **Falta dataset de exemplo público**. Em sala de aula, 30 alunos precisam do mesmo CSV. Built-in datasets ("Vendas trimestrais demo") resolveriam | 🟡 Médio |
| **PA-03** | **Sem links pra documentação contextual**. "Por que minha média está errada?" — devia ter link pra explicação de NaN handling | 🟢 Baixo |
| **PA-04** | **Sem export de "tutorial gravado"** (sequência de ações). Alunos perderiam aulas e não conseguiriam reproduzir | 🟢 Baixo |

### 25. 🤖 Claude-4 / GPT-5 · Perspectiva IA

> "Solstice como produto é maduro pra single-file. Mas como IA, eu olharia 5 coisas."

| ID | Finding | Severidade |
|---|---|---|
| **AI-01** | **Falta API programática**. IA prefere produtos que ofereçam endpoint para "gerar dashboard de [dataset]". Solstice é só UI | 🟠 Alto |
| **AI-02** | **Sem schema documentado da configuração de componente**. Pra IA escrever um KPI, precisa saber a estrutura exata de `slot.config`. Adicionar `solstice-schema.json` | 🟠 Alto |
| **AI-03** | **Reasoning visível ausente**. Solstice mostra resultado, não como chegou. IA prefere produtos que mostram "Aplicamos filtro X, agregamos por Y, obtemos Z" | 🟡 Médio |
| **AI-04** | **Memória entre sessões fraca**. IA assistente precisaria saber "esse user prefere chart de linha" — Solstice não persiste preferências comportamentais | 🟢 Baixo |
| **AI-05** | **Não exporta dataset processado**. Após Solstice limpar/transformar CSV, IA quereria pegar o resultado (não o original). Falta "Export dataset transformado" | 🟡 Médio |

---

## 3. Consolidado — 108 findings categorizados

### 3.1 Funcionalidade (38 findings)

#### Dados & Import (8)
- PL-01 — Sem streaming CSV
- PL-04 — Sem Parquet/Arrow
- PL-05 — Inferência sem regex BR (CEP)
- BR-06 — Erro de encoding sem orientação
- AP-06 — CSV pode injetar fórmulas Excel
- RC-02 — Excel só primeira aba
- JD-01 — Export SVG + embed code
- JD-04 — Sem metadata de fonte

#### Análise & Estatística (10)
- IS-01 — Regressão múltipla
- IS-02 — STL decomposition
- IS-03 — Testes hipótese
- IS-04 — Forecast avançado
- LE-01 — DAX avançado (CALCULATE etc)
- LE-02 — Medida vs coluna calculada
- LE-03 — Hierarquias drill-down
- HC-03 — Auto feature-engineering
- HC-04 — Recommendations via embeddings
- HC-01 — Insights via LLM contextual

#### Interatividade (8)
- LE-04 — Cross-filter inteligente
- LE-05 — RLS (Row-Level Security)
- LE-06 — Refresh automático
- JD-02 — Anotações editoriais
- JD-03 — Responsive embed
- RC-03 — Anonimização one-click
- BR-04 — Tour interativo
- JR-04 — Wizard de chart por pergunta

#### Export & Sharing (4)
- JD-01 — SVG + embed
- AI-05 — Export dataset transformado
- RC-04 — Audit trail exportável
- CF-05 — Compartilhamento viral

#### IA & Automação (4)
- HC-02 — RAG sobre dataset
- HC-01 — Narrative via LLM
- AI-01 — API programática
- AI-02 — Schema JSON

#### Outras (4)
- PL-03 — DuckDB mais usado
- PL-02 — Tabela horizontal scroll
- PA-02 — Datasets demo built-in
- BR-05 — Onboarding por perfil

### 3.2 Visual / Screenshots (12 findings)
- PM-01 — Feedback de loading
- PM-02 — Animações assinatura
- PM-03 — Empty states melhores
- PM-04 — Inspector resizable
- PM-05 — Cursor em drag handles
- PM-06 — Toast posicionamento
- BR-03 — 1 CTA dominante
- AS-03 — Cor única como diferenciador
- LO-04 — Help contextual em tooltips
- DA-04 — Sem release tags visuais
- PA-04 — Export de tutorial
- TR-01 — Heatmap/session recording

### 3.3 Componentes (8 findings)
- RT-05 — Plugin system para charts
- LE-02 — Medida vs coluna
- PA-01 — Modo guiado real
- JR-04 — Wizard por pergunta
- PM-03 — Empty state interativo
- PL-02 — Tabela 100+ colunas
- HC-03 — Auto-feature
- JD-02 — Anotações em chart

### 3.4 Customização & Modificação (7 findings)
- RT-04 — Quebrar SolsticeV56
- RT-05 — Plugin system
- LE-02 — Medidas reusáveis
- BR-05 — Perfil customizado
- PA-01 — Modo guiado
- HV-04 — Feature flags
- AI-04 — Memória preferências

### 3.5 Usabilidade (16 findings)
- BR-03 — 1 CTA dominante
- BR-04 — Tour interativo
- BR-06 — Erro orientativo
- JR-01 — Jargão "dicionário"
- JR-02 — Modais pulam silenciosamente
- JR-03 — Canvas vazio após import
- JR-04 — Wizard por pergunta
- LO-04 — Help contextual
- PA-01 — Modo guiado
- PA-03 — Links pra docs contextuais
- PM-01 — Loading feedback
- PM-03 — Empty states
- PM-06 — Toast position
- TR-02 — FTUE não medido
- TR-03 — Validação com usuários
- AS-01 a AS-06 — Acessibilidade (6 itens)

### 3.6 Viabilidade técnica (10 findings)
- MC-04 — localStorage síncrono
- MC-05 — Sem APM
- MC-06 — Audit cresce infinito
- PL-01 — Streaming
- PL-02 — Tabela
- HV-03 — Custo evolução
- HV-06 — Teto 5MB
- RT-04 — V56 gigante
- BS-01 — Cobertura testes 3%
- DA-02 — E2E ausente

### 3.7 Satisfação & Recomendação (8 findings)
- BR-04 — Tour
- LO-01 — FAQ
- LO-02 — Canal suporte
- LO-03 — Erros convidam ação
- CF-04 — Newsletter
- PM-06 — Toasts position
- TR-02 — FTUE
- TR-03 — Validação 5 users

### 3.8 Escalabilidade (8 findings)
- PL-01 — Streaming CSV
- PL-02 — Tabela horizontal
- PL-03 — DuckDB integrado
- HV-03 — Custo mudança
- HV-04 — Feature flags
- HV-06 — Teto 5MB
- DA-01 — Cache busting
- RT-05 — Plugin system

### 3.9 Uso / Análises / Entregas (6 findings)
- TR-02 — FTUE
- HV-05 — Analytics
- BR-04 — Tour
- LO-03 — Erros convidam reporte
- JD-04 — Metadata fonte
- RC-04 — Audit trail export

### 3.10 Funções/Chamadas/Bases (8 findings)
- RT-04 — V56 — gigante
- RT-05 — Components — plugin
- RT-06 — canvas.sections — event sourcing
- RT-07 — Acoplamento via window
- JM-04 — setTimeout sem clear
- JM-05 — SolsticeLog sub-utilizado
- BS-01 a BS-05 — Testes

### 3.11 Pessoas/Personalidade/Comparação (8 findings)
- CA-01 — Posicionamento ambíguo
- CA-02 — Showcase ausente
- CA-03 — Comparativos
- RM-01 — Case studies
- RM-02 — Modelo monetização
- RM-04 — Pricing comparativo
- CF-01 — Comunidades
- AI-01 a AI-05 — Perspectiva IA

---

## 4. Comparação com mercado

### 4.1 Tabela comparativa (8 produtos)

| Capacidade | Solstice | Power BI | Tableau | Metabase | Looker | Hex | Observable | Excel/Sheets |
|---|---|---|---|---|---|---|---|---|
| **Setup** | 0 min (1 arquivo) | 30+ min | 30+ min | 1 hora | 1 dia | 5 min | 5 min | 2 min |
| **Server-side** | ❌ (offline) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Bundle size** | 2 MB | desktop 600MB | desktop 800MB | docker | SaaS | SaaS | SaaS | desktop 1GB |
| **Single-file portable** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Linguagem fórmula** | DAX-lite + row-level | DAX completo | calc fields | SQL | LookML | Python/SQL | JS/D3 | fórmulas Excel |
| **NLP/Ask** | rule-based + opt-in LLM | Copilot ($$$) | Ask Data | Question | LookML | Magic | — | — |
| **Multi-source** | Multi-CSV manual | Conectores DB | Conectores DB | Conectores DB | Connectors | DB/API/CSV | manual | manual |
| **Streaming dados** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Real-time refresh** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Mobile** | ❌ (desktop-only) | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| **Colab realtime** | ❌ | ✅ | ✅ | parcial | ✅ | ✅ | ✅ | ✅ |
| **Embed/share URL** | snapshot LZ | ✅ pago | ✅ pago | ✅ | ✅ | ✅ | ✅ | ✅ |
| **RLS** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | parcial |
| **Custo** | Grátis | R$ 50/u/mês | R$ 350/u/mês | grátis OSS | $$$ | $$ | grátis tier | R$ 30/u/mês |
| **Open-source** | parcial (no GitHub) | ❌ | ❌ | ✅ | ❌ | ❌ | parcial | ❌ |

### 4.2 Onde Solstice GANHA
1. **Zero setup, zero servidor, zero conta** — único produto na lista que abre clicando no arquivo
2. **Privacidade total** — dados não saem da máquina (relevante saúde, legal, financeiro)
3. **Portabilidade extrema** — mandar 1 arquivo .html via WhatsApp e funciona
4. **Custo zero** — sem licença, sem SaaS, sem servidor
5. **Velocidade de boot** — 2-3s vs 30s+ do Power BI desktop
6. **Sem dependência de cloud** — funciona em air-gapped networks

### 4.3 Onde Solstice PERDE
1. **Datasets grandes (>1M rows)** — todos os concorrentes têm DB engine real
2. **Refresh automático** — todos têm; Solstice é estático após import
3. **Conectores nativos** — DB, APIs, data warehouses ausentes
4. **Colaboração real-time** — Hex/Observable/Looker têm; Solstice tem só comentários
5. **Mobile** — todos têm; Solstice deliberadamente abriu mão
6. **Linguagem de fórmula profunda** — DAX tem 200+ funções, Solstice tem ~20
7. **Suporte/SLA** — produtos pagos têm enterprise support

### 4.4 Nicho realista
Solstice **NÃO compete** com Power BI/Tableau em enterprise. Compete com:
- **Excel/Sheets** pra usuários que querem dashboards reais sem aprender Excel pivot
- **Datawrapper/Flourish** pra jornalistas que querem mais que chart estático
- **Observable** pra "mostrar análise pro não-técnico" sem precisar ensinar JS
- **Notion charts / Coda** pra dashboards leves dentro do workflow

**Tagline natural**: *"O Word do BI — abre, escreve, fecha, manda por email."*

---

## 5. Matriz de priorização — impacto × esforço

### Quadrante Quick Wins (alto impacto, baixo esforço)
| ID | Finding | Esforço | Impacto |
|---|---|---|---|
| RC-01 | Badge "🔒 100% local" no header | 15 min | Confiança imediata em saúde/legal |
| LO-02 | Canal de suporte (GitHub Issues + template) | 1h | Permite reports reais |
| CA-02 | Showcase com 1 dashboard exemplar | 2h | Vitrine vendável |
| CF-03 | Open Graph tags | 30 min | Compartilhamento melhor |
| AS-01 | Skip link a11y | 30 min | WCAG passa |
| BR-04 | Tour interativo simples (Shepherd.js inline) | 4h | FTUE melhora drasticamente |
| PM-01 | Loading state em parse CSV | 1h | Reduz "travou?" |
| LO-01 | FAQ no README | 1h | Suporte básico |
| AS-03 | Ícone ↑/↓ no KPI delta | 30 min | Daltonismo |

### Quadrante Estratégico (alto impacto, alto esforço)
| ID | Finding | Esforço | Impacto |
|---|---|---|---|
| PL-01 | Streaming CSV (PapaParse worker mode) | 1 semana | Destrava datasets grandes |
| RT-04 | Quebrar SolsticeV56 | 2 semanas | Custo de evolução |
| HC-02 | RAG sobre dataset com LLM | 2 semanas | Diferencial vs concorrência |
| BS-01 | Cobertura de testes 3% → 60% | 3 semanas | Confiança em releases |
| LE-01 | DAX avançado (CALCULATE/RELATED) | 1 mês | Compete com PBI sério |
| LE-04 | Cross-filter automático | 1 semana | Padrão de mercado |

### Quadrante "Procastinar" (baixo impacto, baixo esforço)
- JM-06 — Template literals
- PM-02 — Animações assinatura
- DA-03 — Lockfile npm
- AI-04 — Memória de preferências

### Quadrante Re-avaliar (baixo impacto, alto esforço)
- PA-04 — Export tutorial gravado
- LE-05 — RLS — só faz sentido se virar multi-user
- HV-06 — Quebrar single-file — premissa do produto

---

## 6. Roadmap recomendado

### Sprint 1 (1 semana) — "Solstice convidativo"
Foco: reduzir atrito de primeira impressão.
- ✅ Badge "🔒 100% local" (RC-01)
- ✅ Skip link a11y (AS-01)
- ✅ Open Graph tags (CF-03)
- ✅ FAQ no README (LO-01)
- ✅ Loading state em parse (PM-01)
- ✅ Showcase dashboard exemplar (CA-02)
- ✅ Tour interativo simples (BR-04)
- ✅ KPI delta com ícone (AS-03)
- ✅ Wizard "que pergunta?" (JR-04 light)
- ✅ Canal de suporte (LO-02)

### Sprint 2 (2 semanas) — "Solstice viável"
Foco: confiança técnica e produto.
- Streaming CSV (PL-01)
- Audit trail exportável (RC-04)
- Anonimização one-click (RC-03)
- DAX intermediário (CALCULATE básico) (LE-01 parte)
- Tabela com scroll horizontal (PL-02)
- Refresh "manual mas reativo" (LE-06 parte)
- Cobertura de testes Stats+Formula (BS-01 parte)

### Sprint 3 (3 semanas) — "Solstice diferenciado"
Foco: features que ninguém mais tem do jeito do Solstice.
- RAG sobre dataset (HC-02)
- Recommendations via embeddings (HC-04)
- Cross-filter automático (LE-04)
- Quebrar SolsticeV56 (RT-04)
- Plugin system pra charts (RT-05)
- Embed responsive (JD-03)
- Export SVG editável (JD-01)

### Roadmap longo (3+ meses)
- Quebra do single-file em módulos (HV-06)
- API programática (AI-01)
- Mobile/tablet support (revisitar, opt-in)
- Colaboração real-time
- Monetização definida (RM-02)

---

## 7. Veredito final

### Score por dimensão (0-10)

| Dimensão | Score | Comentário |
|---|---|---|
| **Funcionalidade core** | 7/10 | Cobre 80% do "criar dashboard de CSV"; faltam refinamentos (DAX, hierarquias, refresh) |
| **Performance** | 6/10 | OK até ~100k rows; streaming destravaria |
| **Segurança** | 8/10 | CSP+SRI+DOM policy; faltam fórmulas Excel + API key em localStorage |
| **UX (first-time user)** | 6/10 | Welcome melhorou, mas falta tour + wizard |
| **UX (power user)** | 7/10 | Inspector é poderoso; faltam medidas DAX e cross-filter automático |
| **Acessibilidade** | 6/10 | Base OK, mas skip link + KPI sem cor única + aria-live faltam |
| **Documentação** | 8/10 | README+CHANGELOG+ARCHITECTURE.md excelentes; falta FAQ pra usuário final |
| **Arquitetura** | 7/10 | Single-file defensável; SolsticeV56 e Components dragões |
| **Testes** | 4/10 | Infraestrutura existe; cobertura é mínima |
| **Mercado/posicionamento** | 5/10 | Tem nicho real (jornalismo, PME, saúde), mas falta narrativa + showcase |
| **Comparação com IA** | 6/10 | IA prefere produtos com API + schema documentado; Solstice é UI-first |

**Score geral consolidado: 6.4/10** — Produto técnico maduro, com clareza de nicho, mas faltando refinamentos de produto pra virar adoção massiva.

### Em uma frase
> "Solstice é o **BI single-file mais sofisticado que existe**, mas ainda é uma **plataforma técnica em busca de seu público**. A próxima fronteira não é mais código — é **alinhar quem usa, como acha, e por que escolheria isso vs. abrir o Excel**."

### O que o comitê faria SE pudesse escolher 1 coisa
**Sprint 1 inteiro.** Não é arquitetura, não é feature nova — é o conjunto de pequenos polimentos que tornam o produto **vendável e adotável**. Custo: 1 semana. ROI: vira produto que dá pra mostrar pro mundo com orgulho.

---

*Investigação realizada em 2026-05-22. 108 findings em 25 personas. Comparação contra 8 produtos do mercado. Próximo passo recomendado: executar Sprint 1.*
