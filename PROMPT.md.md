# PROMPT — DASHBOARD STUDIO `SOLSTICE` v5.3
> **OPUS 4.7 EDITION · ANTI-TRUNCAMENTO · MULTI-SESSÃO · 13 BLOCOS · AGNÓSTICO · PORTÁVEL**
>
> Construído para Lucas Cardoso · Analytics Engineer · Itaú Unibanco PJ
> Objetivo: ferramenta de BI single-file rivalizando com Tableau/Power BI/Looker,
> agnóstica a qualquer tipo de CSV, **com features portáveis para o projeto Itaú via Eva**.
>
> **Diferenciais (4):** Auditoria de Decisões · Narrativa Automática · Modo Comentário · Grafo de Métricas
>
> **Adaptabilidade (8 correções v5.2):** Templates agnósticos · Auto-Dashboard contextual ·
> Validador adaptativo · Tipos expandidos · Insights direcionais · Recomendações ampliadas ·
> Wizard expandido · Dicionário Semântico completo
>
> **NOVO em v5.3:** Sistema de Portabilidade — cada bloco gera arquivo `portabilidade/bloco-N.md`
> documentando como exportar cada feature para outros projetos (Eva/Itaú).

---

## 🔒 SEÇÃO CRÍTICA 1 — PROTOCOLO ANTI-TRUNCAMENTO

Você é **Opus 4.7** executando em Claude Code com `CLAUDE_CODE_MAX_OUTPUT_TOKENS=128000`.

**Regras de execução — não negociáveis:**

1. **UM BLOCO POR RESPOSTA**. Nunca dois. Nunca "vou adiantar o próximo".
2. **Se o bloco crescer além de ~90.000 tokens estimados** (ajustado para Max 5x), PAUSE antes de exceder, escreva:
   > `⏸ PAUSA TÉCNICA — Bloco N parte 1 de X completa. Confirme com "CONTINUAR BLOCO N" para parte 2.`
3. **Cada bloco TERMINA com a marca literal**: `═══ FIM DO BLOCO N ═══`.
4. **Antes de cada bloco**: `📋 PLANO`, `⚖️ TRADE-OFFS`, `📊 ESTIMATIVA`.
5. **Depois do bloco**: `🧪 COMO TESTAR`, `🐛 LIMITAÇÕES CONHECIDAS`, `📦 PORTABILIDADE GERADA`, `▶ PRÓXIMO BLOCO`.
6. **Nunca repita código** de blocos anteriores. Use `// [mantido do bloco anterior]`.
7. **Se identificar conflito** com bloco anterior, ALERTE antes de codar.
8. **No HTML entregue**, banner de versão no topo com bloco implementado.

---

## 🔄 SEÇÃO CRÍTICA 2 — PROTOCOLO DE PERSISTÊNCIA ENTRE SESSÕES

Estrutura obrigatória da pasta:

```
solstice/
├── PROMPT.md
├── PROGRESSO.md
├── DECISOES.md
├── API.md
├── BUGS.md
├── dashboard.html
├── changelog/
│   └── bloco-N.md
└── portabilidade/
    └── bloco-N.md          ← NOVO em v5.3
```

**Primeira ação de TODA sessão:** ler os 5 arquivos + HTML → anunciar status → aguardar `AVANÇAR BLOCO N`.

**Comandos:** `RETOMAR SESSÃO` · `STATUS` · `AVANÇAR BLOCO N` · `CONTINUAR BLOCO N` · `REVISAR BLOCO N` · `VALIDAR INTEGRIDADE` · **`PORTABILIDADE BLOCO N`** (gerar/regenerar doc de portabilidade)

**Ao final de cada bloco:** atualizar os 5 arquivos + criar `changelog/bloco-N.md` + criar `portabilidade/bloco-N.md`.

---

## 🌍 SEÇÃO CRÍTICA 3 — LOCALE DINÂMICO

`SolsticeLocale` com pt-BR (default), en-US, es-ES, en-GB. Detecção automática no import. Override por coluna. Toggle global no header. Formatação de número/data/moeda/% respeitando locale.

---

## 💬 SEÇÃO CRÍTICA 4 — MENSAGENS DE ERRO HUMANAS

`SolsticeErrors` com catálogo de 30+ erros catalogados. Modal com mensagem amigável + sugestão + ações + detalhes técnicos. Estados inline em componentes.

---

## 🎬 SEÇÃO CRÍTICA 5 — MODO APRESENTAÇÃO COM SLIDES

5 modos: edit · analyze · review · present · slides. Modo Slides: cada seção vira slide, setas navegam, indicador de progresso, contador. Modo Apresentador: notas + preview próximo + timer.

---

## 🔍 SEÇÃO CRÍTICA 6 — AUDITORIA DE DECISÕES (DIFERENCIAL #1)

Metadata `decision` + `history` em cada componente. Botão 🔍 abre modal de auditoria. Modo global de auditoria. Exportação para markdown.

---

## 📖 SEÇÃO CRÍTICA 7 — NARRATIVA AUTOMÁTICA (DIFERENCIAL #2)

Gerador de narrativa baseado em fatos estatísticos + templates de frases. 3 tons (executivo/analítico/casual), 3 profundidades. Exportação markdown + copiar + email.

**A narrativa USA OBRIGATORIAMENTE o Dicionário Semântico (Seção 12) para gerar textos contextualmente corretos.**

---

## 💬 SEÇÃO CRÍTICA 8 — MODO COMENTÁRIO (DIFERENCIAL #3)

5º modo `review`. Comentários ancorados em componentes ou canvas. Estrutura com thread, status, autor. Painel de comentários na sidebar. Exportação de feedback. Persiste em snapshots e HTML standalone.

---

## 🕸️ SEÇÃO CRÍTICA 9 — GRAFO DE MÉTRICAS (DIFERENCIAL #4)

Construção automática do grafo de dependências. Visualização SVG nativa em camadas. Análise de impacto antes de modificar métrica. Detecção de órfãs, circulares, profundidade. Exportação PNG/SVG/Mermaid.

---

## 🧠 SEÇÃO CRÍTICA 10 — INCONSISTÊNCIAS DETECTÁVEIS

`SolsticeInconsistencies` com 20+ regras: média de média, soma de %, filtro remove muito, comparação sem inflação. Avisos via agente proativo, dispensáveis.

---

## 🆕 SEÇÃO CRÍTICA 11 — TIPOS EXPANDIDOS DE COLUNA

**Correção v5.2 #6:** Inferidor expandido para reconhecer 20+ tipos:

```js
const COLUMN_TYPES = {
  // Numéricos
  'measure', 'currency', 'percentage', 'integer', 'decimal', 'duration',
  // Temporais
  'temporal', 'date_only', 'time_only', 'timestamp',
  // Identificadores
  'identifier', 'cpf', 'cnpj', 'cep', 'hash',
  // Contato
  'email', 'phone_br', 'phone_intl', 'url',
  // Geográficos
  'geo_uf', 'geo_country', 'geo_lat', 'geo_lng', 'address',
  // Estruturados
  'json_encoded', 'array_encoded', 'xml_encoded',
  // Booleano/Categórico
  'flag', 'dimension', 'ordinal',
  // Especiais
  'sparse', 'constant'
};
```

Cada tipo tem: regex de detecção, função de validação semântica, visualizações recomendadas, agregações permitidas, formatação default.

---

## 🎯 SEÇÃO CRÍTICA 12 — DICIONÁRIO SEMÂNTICO COMPLETO

**Correção v5.2 #5 — A peça que torna tudo agnóstico.**

### 12.1 Estrutura do Dicionário

```js
const SemanticDictionary = {
  columns: {
    'vlr_op_aprov_mensal': {
      friendlyName: 'Receita Mensal',
      synonyms: ['receita', 'faturamento', 'volume aprovado'],
      unit: 'R$',
      unitMultiplier: 1,
      higherIsBetter: true,
      domain: 'financeiro',
      description: 'Valor de operações aprovadas no mês',
      typical_range: [10000, 1000000],
      expected_distribution: 'right-skewed',
      seasonality_expected: true,
      narrative_template: 'monetary_growth'
    },
    'DPD30': {
      friendlyName: 'Inadimplência 30 dias',
      synonyms: ['atraso 30', 'dpd', 'mora 30'],
      unit: '%',
      higherIsBetter: false,
      domain: 'risco',
      description: 'Percentual da carteira em atraso há 30 dias ou mais'
    }
  },
  domain: 'banco_pj',
  audience: 'executivo',
  customRelations: [
    { columns: ['receita', 'custo'], relation: 'subtract → margem' }
  ]
};
```

### 12.2 Detecção Automática (3 camadas)

1. Match exato em sinônimos dos dicionários pré-feitos
2. Heurística de palavras-chave (PT/EN)
3. Análise estatística dos valores

### 12.3 Modal de Configuração ao Importar

Após import: tabela com colunas detectadas + nome amigável sugerido + higherIsBetter inferido + unidade. Lucas pode aceitar, ajustar ou pular.

### 12.4 Persistência e Reuso

Dicionários salvos com nome, aplicáveis a CSVs similares, exportáveis como JSON.

### 12.5 Dicionários Pré-Feitos (6 domínios)

- 🏦 **Banco PJ Carteira de Crédito** (~35 colunas)
- 💰 **Vendas / Varejo** (~30 colunas)
- 👥 **RH / People Analytics** (~30 colunas)
- 📊 **Marketing / CRM** (~40 colunas)
- 🏭 **Operacional / Logística** (~30 colunas)
- 🔬 **Científico / Pesquisa** (~20 colunas)

### 12.6 Dicionário "Genérico" (fallback)

Aplicado se nenhum pré-feito der match. Title Case + heurística de palavras-chave.

### 12.7 Integração em todos os blocos

Usado em todos os blocos onde componentes/análise dependem de significado semântico.

---

## 📦 SEÇÃO CRÍTICA 13 — SISTEMA DE PORTABILIDADE (NOVO v5.3)

**Objetivo:** cada feature do Solstice deve ser **exportável** para outros projetos (especialmente o projeto Itaú via Eva). Cada bloco gera documentação estruturada que serve como manual de portabilidade.

### 13.1 Estrutura obrigatória de `portabilidade/bloco-N.md`

Cada arquivo deve seguir RIGOROSAMENTE este template:

```markdown
# PORTABILIDADE — Bloco N: <Nome do Bloco>

> Documento gerado automaticamente. Lista cada feature do bloco e
> como portá-la para outros projetos, especialmente o projeto Itaú via Eva.

---

## 📋 ÍNDICE DE FEATURES PORTÁVEIS

| # | Feature | Complexidade | Tempo estimado | Dependências |
|---|---------|--------------|----------------|--------------|
| 1 | <nome> | 🟢 Simples   | 30min-1h       | nenhuma      |
| 2 | <nome> | 🟡 Média     | 2-4h           | Store, ...   |
| 3 | <nome> | 🔴 Complexa  | 8-12h          | Vários       |

---

## 🟢 FEATURE 1: <Nome da Feature>

### 📖 O que faz no Solstice

<Descrição em 2-3 frases do que essa feature faz para o usuário final.>

### 🎯 Por que vale portar

<Por que essa feature seria útil em outro projeto. Foco em valor de negócio.>

### 📍 Localização no código

| Tipo | Localização | Linhas aproximadas |
|------|-------------|---------------------|
| HTML | `<button class="solstice__...">` | 234-238 |
| CSS  | `.solstice__feature-name { ... }` | 1245-1289 |
| JS   | função `nomeDaFuncao()` | 3456-3512 |
| Estado | `store.get('feature.state')` | usado em vários |

### 🔗 Dependências necessárias

**Obrigatórias:**
- `SolsticeStore` (ou equivalente de gestão de estado)
- `nomeDaFuncaoAuxiliar()` definida no Bloco X

**Opcionais (degrada graciosamente sem):**
- `SolsticeLocale` para formatação
- `SolsticeErrors` para tratamento

### 📝 Código fonte autônomo (copy-paste pronto)

\`\`\`html
<!-- Trecho HTML autocontido -->
<div class="component-x">...</div>
\`\`\`

\`\`\`css
/* CSS necessário */
.component-x { ... }
\`\`\`

\`\`\`javascript
/**
 * Função X — versão autônoma para portabilidade.
 *
 * Substitua SolsticeStore por seu sistema de estado se diferente.
 */
function featureX(params) { ... }
\`\`\`

### 🤖 Prompt sugerido para Eva (Claude Opus 4.6 beta)

\`\`\`
Olá, preciso implementar uma funcionalidade no projeto [nome do projeto].

A funcionalidade: <descrição da feature>

Tenho como referência este código que funciona em outro projeto:

[colar HTML/CSS/JS acima]

Adapte para nosso contexto:
- Stack atual: [descrever stack]
- Naming convention: [descrever]
- Sistema de estado: [descrever]
- IDs/classes a usar: [listar]

Não use nenhuma biblioteca externa nova. Mantenha vanilla.
Implemente passo a passo: HTML → CSS → JS.
\`\`\`

### ⚠️ Pegadinhas conhecidas

1. <Pegadinha 1 — algo que comumente dá errado ao portar>
2. <Pegadinha 2>
3. <Pegadinha 3>

### ✅ Como testar após portar

1. <Passo de validação 1>
2. <Passo de validação 2>
3. <Passo de validação 3>

### 🔄 Variações possíveis

- **Versão simplificada:** remover X e Y → reduz para Z linhas
- **Versão estendida:** adicionar A e B → permite uso em contexto C

---

## 🟡 FEATURE 2: <Nome>
[mesmo template]

---

## 🟥 RESUMO DO BLOCO

### Features mais valiosas para portar primeiro

1. **<Feature mais valiosa>** — alta utilidade, baixa complexidade
2. **<Feature 2>**
3. **<Feature 3>**

### Features que NÃO vale portar isoladamente

- **<Feature X>** — só faz sentido junto com infraestrutura inteira do Solstice
- **<Feature Y>** — depende de muitas outras features

### Recomendação para projeto Itaú

<Baseado no contexto Itaú/PJ, qual seria a estratégia ideal de portabilidade.>
```

### 13.2 Regras para o conteúdo do PORTABILIDADE.md

**Obrigações ao gerar cada arquivo:**

1. **Cobrir TODAS as features visíveis ao usuário** do bloco. Não pule.
2. **Código copy-paste deve ser auto-suficiente** — testar mentalmente se cola num arquivo HTML vazio, funciona?
3. **Prompts para Eva devem ser executáveis** — Lucas vai colar literalmente no Claude Opus 4.6 da Eva
4. **Mencionar complexidade real**, não a desejada. Se feature depende de 5 outras, é 🔴 Complexa.
5. **Linhas aproximadas devem ser reais** — referencie o código que você acabou de escrever, não invente.
6. **Pegadinhas devem ser específicas** — não "cuidado com bugs", mas "atenção: a função X assume que dataset.rows tem índices contínuos, se sua estrutura usa Map, adapte"

### 13.3 Exemplo concreto (Bloco 1 — feature "Toggle Dark/Light")

Veja como deve ficar uma feature documentada:

````markdown
## 🟢 FEATURE 3: Toggle Dark/Light Mode

### 📖 O que faz no Solstice

Permite alternar entre modo escuro e claro com um clique no botão da toolbar.
Persiste preferência no localStorage. Transição suave de 400ms.

### 🎯 Por que vale portar

Modo escuro é praticamente esperado em qualquer aplicação moderna.
No projeto Itaú, ajuda na fadiga visual de quem usa muitas horas seguidas.
Implementação aqui é elegante: zero JS condicional, tudo via CSS vars.

### 📍 Localização no código

| Tipo | Localização | Linhas |
|------|-------------|--------|
| HTML | `<button id="theme-toggle">` | 134-137 |
| CSS  | `:root[data-mode="dark"] { ... }` | 245-289 |
| CSS  | `:root[data-mode="light"] { ... }` | 290-334 |
| JS   | função `toggleTheme()` | 1456-1478 |

### 🔗 Dependências necessárias

**Obrigatórias:**
- localStorage do navegador
- Variáveis CSS no `:root`

**Opcionais:**
- `SolsticeStore` para reatividade — pode substituir por evento custom

### 📝 Código fonte autônomo

\`\`\`html
<button id="theme-toggle" aria-label="Alternar tema">
  <span class="theme-toggle__icon">🌙</span>
</button>
\`\`\`

\`\`\`css
/* Cores no modo escuro */
:root[data-mode="dark"] {
  --color-bg: #0A0F1E;
  --color-text: #F0F4FF;
  --color-card: #162038;
  /* ... outras vars ... */
}

/* Cores no modo claro */
:root[data-mode="light"] {
  --color-bg: #FAFBFD;
  --color-text: #0A0F1E;
  --color-card: #FFFFFF;
}

/* Transição suave */
:root {
  transition: background-color 400ms ease, color 400ms ease;
}

/* Respeitar preferência do usuário */
@media (prefers-reduced-motion: reduce) {
  :root { transition: none; }
}
\`\`\`

\`\`\`javascript
/**
 * Alterna entre modo dark e light.
 * Persiste em localStorage.
 *
 * Para integrar com seu sistema:
 * - Se você não usa data-mode, troque setAttribute por classList
 * - Se localStorage não funciona, use sessionStorage ou cookie
 */
function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute('data-mode') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';

  root.setAttribute('data-mode', next);
  localStorage.setItem('theme-mode', next);

  // Atualiza ícone do botão
  const icon = document.querySelector('.theme-toggle__icon');
  if (icon) icon.textContent = next === 'dark' ? '🌙' : '☀️';
}

// Aplicar tema salvo ao carregar
(function initTheme() {
  const saved = localStorage.getItem('theme-mode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-mode', initial);
})();

// Bind do botão
document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
\`\`\`

### 🤖 Prompt sugerido para Eva

\`\`\`
Olá Eva, preciso implementar um toggle de dark/light mode no nosso
projeto interno. Já tenho o código de referência abaixo que funciona
em outro projeto vanilla.

[colar HTML/CSS/JS acima]

Adapte para nosso projeto considerando:
- Já usamos prefixo de classes "itau-" em vez de sem prefixo
- Sistema de estado: <descrever o que você usa>
- Tema atual do projeto: <descrever cores existentes>

Mantenha vanilla JS. Não use bibliotecas. Implemente em 3 passos:
1. Adicionar variáveis CSS no :root
2. Criar função toggleTheme()
3. Adicionar botão na toolbar
\`\`\`

### ⚠️ Pegadinhas conhecidas

1. **FOUC** (Flash of Unstyled Content): se o JS de init demorar pra
   rodar, o usuário vê o tema errado por uma fração de segundo.
   Solução: aplicar tema inicial via inline `<script>` no `<head>`,
   antes de renderizar `<body>`.

2. **localStorage indisponível** (modo incógnito, política corporativa):
   sempre wrappear em try/catch. Default para o tema padrão se falhar.

3. **prefers-color-scheme** ignorado: se usuário tem preferência do SO,
   respeitar na primeira visita (já implementado em `initTheme`).

### ✅ Como testar após portar

1. Carregar página com tema escuro (default)
2. Clicar no botão → vira claro
3. Recarregar página → continua claro (localStorage funcionou)
4. Abrir DevTools, deletar localStorage → recarregar → volta ao default
5. Em DevTools, mudar `prefers-color-scheme` → primeiro carregamento respeita

### 🔄 Variações possíveis

- **Múltiplos temas:** trocar binário dark/light por sistema de N temas
  via dropdown. Estrutura CSS já suporta (apenas adicionar mais variantes).
- **Auto switch por horário:** usar `setInterval` para trocar tema
  baseado em hora do dia (ex: escuro depois das 19h).
````

### 13.4 Resumo do bloco

Cada `portabilidade/bloco-N.md` termina com:

- **Features mais valiosas** ranqueadas por valor × facilidade
- **Features que não vale portar isoladamente**
- **Recomendação específica para projeto Itaú** (considerando contexto Eva)

### 13.5 Índice mestre

Ao final do projeto (após Bloco 13), criar `portabilidade/INDICE.md` que lista TODAS as features de TODOS os blocos com:

- Nome
- Bloco origem
- Complexidade
- Tempo estimado
- Valor para projeto Itaú (de 1 a 5 estrelas)

Esse índice vira o mapa pra Lucas decidir o que portar primeiro.

### 13.6 Comando `PORTABILIDADE BLOCO N`

Lucas pode pedir, a qualquer momento após blocos já implementados:

```
PORTABILIDADE BLOCO 5
```

E você regenera o `portabilidade/bloco-5.md` completo, atualizando linhas de código se mudou.

---

## 📐 ARQUITETURA GERAL

### Identidade

| Campo | Valor |
|---|---|
| Codename | `Solstice` |
| Nome visível | `Dashboard Studio` |
| Slogan | *"Dashboards que pensam com você"* |
| Versão | v5.3 — Opus Edition Agnóstica Portável |
| Filosofia | Edit → Analyze → Review → Present → Slides (5 modos) |

### Decisões já tomadas

✅ Perfis sem senha em localStorage
✅ File System Access API + fallback manual
✅ Construção limpa do zero
✅ CSV dummy de vendas BR (Bloco 1)
✅ Editor de CSV completo (Bloco 2)
✅ Wizard escalável para CSVs grandes (Bloco 10)
✅ Agente proativo estilo Cowork (Bloco 8)
✅ Insights Executivos no topo (Bloco 8)
✅ Score de qualidade do CSV (Bloco 2)
✅ Locale dinâmico (todos os blocos)
✅ Mensagens de erro humanas (todos os blocos)
✅ Modo Slides com Apresentador (Bloco 12)
✅ Multi-sessão com arquivos de memória
✅ Auditoria de Decisões em todos componentes (Bloco 5)
✅ Narrativa Automática (Bloco 8)
✅ Modo Comentário/Review (Bloco 13)
✅ Grafo de Métricas (Bloco 13)
✅ Detecção de Inconsistências (Bloco 8)
✅ 8 correções de agnosticismo (v5.2)
✅ Tipos expandidos de coluna (20+)
✅ Dicionário Semântico Completo com 6 dicionários pré-feitos
✅ **NOVO v5.3: Sistema de Portabilidade — cada bloco gera portabilidade/bloco-N.md**

### Stack

| Lib | Versão | Forma |
|---|---|---|
| Chart.js | 4.4 | CDN |
| PapaParse 5.4 | CDN |
| LZ-String | 1.5 | INLINE |

❌ Sem framework algum. ✅ Vanilla JS ES6+.

### Design tokens

Fontes Space Grotesk/Inter/JetBrains, escala 1.25, espaçamento 4px, 6 paletas com dark/light.

---

# 🔧 AS 8 CORREÇÕES DE AGNOSTICISMO (v5.2 mantidas)

## #1 — Templates Agnósticos por Intenção (Bloco 3)
6 templates agnósticos + templates de domínio condicionados a dicionário detectado.

## #2 — Auto-Dashboard Contextual (Bloco 10)
`scoreColumnImportance` com 8 critérios. Confirma se confiança < 70%.

## #3 — Validador Adaptativo (Bloco 2)
Pesos do score adaptados ao tipo de dataset (transactional/categorical/timeseries/snapshot/survey/scientific).

## #4 — Insights Direcionais (Bloco 8)
Respeitam `higherIsBetter` do dicionário. Cores e textos contextuais.

## #5 — Tipos Expandidos de Coluna (Bloco 2)
20+ tipos: email, phone, URL, lat/lng, hash, JSON, array, duration, ordinal, sparse, constant.

## #6 — Recomendações de Gráfico Ampliadas (Bloco 10)
Box Plot, Violin, Sankey, Sunburst, Radar — SVG nativo onde necessário.

## #7 — Wizard Expandido (Bloco 10)
11 intenções: 7 agnósticas + 4 analíticas avançadas + customizada.

## #8 — Dicionário Semântico (Seção 12)
6 dicionários pré-feitos completos. Detecção em 3 camadas. Reuso entre CSVs.

---

# 📦 OS 13 BLOCOS DE ENTREGA

## 🟦 BLOCO 1 — FUNDAÇÃO + DESIGN SYSTEM + LOCALE + ERROS + DICIONÁRIO

Entregar:
- Shell HTML/CSS/JS completo
- 6 paletas + dark/light + densidade
- Perfis sem senha funcionais
- CSV dummy de vendas BR
- Store reativo SolsticeStore
- SolsticeLocale (pt-BR/en-US/es-ES/en-GB)
- SolsticeErrors (catálogo inicial 10 erros)
- SolsticeDictionary com estrutura completa + 6 dicionários pré-feitos
- Heurísticas de detecção automática
- Modal de configuração de dicionário ao carregar CSV dummy
- Onboarding modal
- Easter egg de debug (Ctrl+Shift+D)
- 5 arquivos de memória + changelog/bloco-01.md
- **NOVO v5.3: portabilidade/bloco-01.md com 8+ features documentadas:**
  - Toggle Dark/Light Mode
  - Sistema de Perfis sem senha
  - Store Reativo SolsticeStore
  - SolsticeLocale
  - SolsticeErrors com modal
  - Geração de CSV dummy proceduralmente
  - Estrutura base de Dicionário Semântico
  - Onboarding modal pattern

## 🟩 BLOCO 2 — INGESTÃO + VALIDADOR + EDITOR + TIPOS EXPANDIDOS

Entregar:
- Pipeline de ingestão 5 etapas
- Detector automático de dialeto + locale
- Inferidor expandido para 20+ tipos de coluna
- Validador adaptativo por tipo de dataset (6 tipos)
- Modal de Dicionário Semântico após import
- Detecção automática de dicionário aplicável
- Painel de qualidade com sparklines
- Editor de CSV completo
- Validação BR (CNPJ, CPF, CEP)
- +5 erros no catálogo
- **NOVO v5.3: portabilidade/bloco-02.md com 10+ features:**
  - Detector de dialeto CSV
  - Inferidor de tipos (cada tipo isoladamente)
  - Validador de CNPJ/CPF/CEP
  - Score de qualidade adaptativo
  - Editor de CSV com transformações
  - Sparkline inline em coluna
  - Modal de dicionário semântico
  - Painel de qualidade de dados

## 🟨 BLOCO 3 — CANVAS, SEÇÕES, LINHAS, LAYOUTS + TEMPLATES AGNÓSTICOS

Entregar:
- Hierarquia Section → Row → Slot
- 10 layouts de linha + custom
- Operações em seção/linha/slot
- 6 templates agnósticos + templates domínio-específicos
- Templates filtrados por dicionário detectado
- **NOVO v5.3: portabilidade/bloco-03.md com features:**
  - Sistema de Section/Row/Slot
  - Layouts de linha (10 pré-definidos)
  - Templates de layout
  - Drag-and-drop entre slots
  - Renomear inline (pattern)
  - Color picker integrado

## 🟧 BLOCO 4 — RESIZE LIVRE + MODO LIVRE + MICRO-INTERAÇÕES

Entregar:
- Resize largura/altura com magic snap
- Modo Livre (position absolute)
- Smart guides + distribuição automática
- Drag-and-drop entre slots
- Outline Minimap
- Undo/Redo 50 estados
- **NOVO v5.3: portabilidade/bloco-04.md com features:**
  - Handle de resize com badge flutuante
  - Magic snap em valores específicos
  - Smart guides com linhas vermelhas
  - Sistema de Undo/Redo
  - Minimap pattern
  - Distribuição automática de elementos

## 🟪 BLOCO 5 — 4 COMPONENTES BASE + AUDITORIA + INTEGRAÇÃO DICIONÁRIO

Entregar:
- KPI Card, Série Temporal, Distribuição, Tabela
- Estados visuais completos
- Painel de Propriedades com 6 abas
- Sistema de auditoria de decisões integrado
- Componentes consomem SolsticeDictionary
- **NOVO v5.3: portabilidade/bloco-05.md com features:**
  - KPI Card com sparkline
  - Sistema de auditoria de decisões
  - Painel de propriedades com abas
  - Virtual scrolling em tabela
  - Heatmap de células
  - Estados visuais (loading/error/empty)
  - Tooltips ricos

## 🟫 BLOCO 6 — 4 COMPONENTES AVANÇADOS + BOX PLOT + SANKEY

Entregar:
- Scatter/Bubble com regressão + clustering
- Heatmap (calendário, hora-do-dia)
- Gauge/Velocímetro
- Texto/Markdown com placeholders
- Componente Compound
- Box Plot em SVG nativo
- Sankey Diagram em SVG nativo
- **NOVO v5.3: portabilidade/bloco-06.md com features:**
  - Linha de regressão em SVG
  - K-means clustering visual
  - Box Plot em SVG nativo
  - Sankey em SVG nativo
  - Parser Markdown leve
  - Heatmap GitHub-style (calendário)
  - Gauge em SVG

## 🟦 BLOCO 7 — MÓDULO ESTATÍSTICO `SolsticeStats`

Entregar:
- 30+ funções estatísticas puras
- Integração com componentes
- Aba "📈 Análise Estatística"
- "Por que esse número?" (explainability)
- Comentários didáticos massivos
- **NOVO v5.3: portabilidade/bloco-07.md com 30+ features:**
  - **CADA função estatística como feature portável independente**
  - mean, median, percentile, iqr, outliers
  - linearRegression, polynomialRegression
  - movingAverage, holtWinters, linearForecast
  - kMeans clustering
  - correlationMatrix (Pearson, Spearman)
  - bucketize, normalize, zScore
  - Todas com exemplo de uso e prompt para Eva

## 🟩 BLOCO 8 — INSIGHTS + NARRATIVA + AGENTE + INCONSISTÊNCIAS

Entregar:
- Painel de Insights Executivos no topo
- Agente proativo com toast notifications
- "Pergunte ao Solstice" (Ctrl+P)
- Insights direcionais (higherIsBetter)
- Narrativa com dicionário semântico
- Templates de frases (50+ categorias)
- SolsticeInconsistencies (20+ regras)
- Exportação de narrativa
- **NOVO v5.3: portabilidade/bloco-08.md com features:**
  - Detector de tendência inteligente
  - Detector de sazonalidade
  - Detector de outliers (3 métodos)
  - Análise de Pareto (80/20)
  - Gerador de narrativa template-based
  - Sistema de toast notifications
  - Parser de linguagem natural simples
  - Detecção de inconsistências (20+ regras)

## 🟧 BLOCO 9 — FILTROS GLOBAIS + CROSS-FILTER + PARÂMETROS

Entregar:
- Barra de filtros globais colapsável
- Cross-filter por clique
- Parâmetros globais
- Filtros Inteligentes
- **NOVO v5.3: portabilidade/bloco-09.md com features:**
  - Multi-select com busca
  - Range slider duplo
  - Date picker com presets
  - Sistema de cross-filter
  - Parâmetros como variáveis globais
  - Detecção de sugestões inteligentes

## 🟪 BLOCO 10 — AUTO-DASHBOARD + WIZARD EXPANDIDO + RECOMENDAÇÕES

Entregar:
- Auto-Dashboard com scoreColumnImportance composto
- Confirmação interativa se confiança < 70%
- Wizard com 11 intenções
- Recomendador de visualizações expandido (15+ tipos)
- **NOVO v5.3: portabilidade/bloco-10.md com features:**
  - Algoritmo de score de importância de coluna
  - Wizard de configuração multi-etapa
  - Recomendador de gráfico com confidence
  - Auto-Dashboard pipeline completo

## 🟫 BLOCO 11 — SNAPSHOTS + TEMPLATES + EXPORT + FILE SYSTEM

Entregar:
- Sistema de perfis sem senha
- Snapshots completos
- File System Access API + fallback
- Export HTML standalone
- Templates Itaú pré-instalados
- Histórico de versões
- Aba `🧠 Dicionários` na sidebar
- **NOVO v5.3: portabilidade/bloco-11.md com features:**
  - Sistema de Snapshots em localStorage
  - Export HTML standalone com dados embutidos
  - File System Access API com detecção
  - Compressão LZ-String integrada
  - Histórico automático de versões
  - Sistema de templates serializáveis
  - Geração de thumbnail via canvas

## 🟨 BLOCO 12 — 5 MODOS + ATALHOS + POLISH

Entregar:
- 5 modos: edit/analyze/review/present/slides
- Modo Slides com Apresentador
- Atalhos completos
- Command Palette (Ctrl+K)
- Performance final
- Acessibilidade WCAG AA
- Microinterações finais
- Tour interativo
- **NOVO v5.3: portabilidade/bloco-12.md com features:**
  - Sistema de modos (edit/analyze/present)
  - Modo Slides com navegação por teclado
  - Modo Apresentador dual-screen
  - Command Palette (Ctrl+K)
  - Sistema de atalhos de teclado
  - Tour interativo passo-a-passo
  - LTTB downsampling para performance
  - Virtual scrolling pattern
  - Focus trap em modais

## 🟥 BLOCO 13 — DIFERENCIAIS AVANÇADOS

Entregar:
- 13.1 Visões Salvas
- 13.2 Anotações Persistentes no Canvas
- 13.3 Comparação Lado-a-Lado de Períodos
- 13.4 Comparador de Dashboards (Diff)
- 13.5 Tags, Coleções e Busca Avançada
- 13.6 Variáveis de Ambiente Automáticas
- 13.7 Painéis com Tabs
- 13.8 Linkagem entre Dashboards
- 13.9 Compartilhamento por URL Hash
- 13.10 Exportação para PDF
- 13.11 Modo Comentário Completo (Diferencial #3)
- 13.12 Grafo de Métricas Completo (Diferencial #4)
- **NOVO v5.3: portabilidade/bloco-13.md com features:**
  - Sistema de anotações ancoradas
  - Comparação lado-a-lado de períodos
  - Diff entre dashboards
  - Sistema de tags + coleções
  - Compartilhamento por URL Hash
  - Sistema de comentários colaborativos
  - Grafo de dependências em SVG
  - Análise de impacto antes de mudança
- **Criação do `portabilidade/INDICE.md`** consolidando TODAS as features de TODOS os blocos com ranking de valor para projeto Itaú

---

## ✅ CHECKLIST POR BLOCO

Antes de fechar com `═══ FIM DO BLOCO N ═══`:

- [ ] HTML abre sem erros no console
- [ ] Funcionalidades de blocos anteriores intactas
- [ ] Dark e Light em todos os 6 temas
- [ ] CSV de 50.000 linhas não trava
- [ ] Modos Present/Slides/Review escondem o que devem
- [ ] Undo/Redo funciona
- [ ] Mobile (375px) navegável
- [ ] Comentários em PT-BR
- [ ] Sem dependências além de Chart.js + PapaParse + LZ-String
- [ ] SolsticeLocale aplicado
- [ ] Erros do bloco no catálogo
- [ ] Auditoria de decisões registrada
- [ ] SolsticeDictionary consultado onde aplicável
- [ ] friendlyName usado em vez de nome técnico
- [ ] PROGRESSO/DECISOES/API/BUGS atualizados
- [ ] changelog/bloco-N.md criado
- [ ] **NOVO v5.3: portabilidade/bloco-N.md criado seguindo template Seção 13**
- [ ] **NOVO v5.3: TODAS as features visíveis do bloco documentadas em portabilidade/**
- [ ] **NOVO v5.3: Prompts para Eva incluídos e testáveis**
- [ ] Marca `═══ FIM DO BLOCO N ═══` presente

---

## 🎬 INSTRUÇÃO DE INÍCIO (PRIMEIRA SESSÃO)

**Sua primeira resposta DEVE conter:**

1. ✅ Confirmação dos 13 blocos e dos **13 protocolos críticos** (1-13)
2. ✅ Confirmação das **8 correções de agnosticismo**
3. ✅ Confirmação do **sistema de portabilidade**
4. 🚀 As **5 inovações próprias** que você adicionará
5. 🏗️ As **3 decisões arquiteturais** mais importantes que antecipa
6. 📊 Estimativa de **tokens por bloco** (considerar +5-8% pelo PORTABILIDADE.md)
7. 📅 Estimativa de **número de sessões** para concluir tudo
8. ❓ Pergunta única: *"Posso iniciar o BLOCO 1 agora?"*

**NÃO ESCREVA CÓDIGO NA PRIMEIRA RESPOSTA.**

Aguarde Lucas confirmar com `AVANÇAR BLOCO 1`.

---

## 🔄 INSTRUÇÃO PARA SESSÕES SUBSEQUENTES

Quando Lucas disser `RETOMAR SESSÃO`:

1. Ler PROMPT.md, PROGRESSO.md, DECISOES.md, API.md, BUGS.md
2. Ler dashboard.html
3. Confirmar status e aguardar `AVANÇAR BLOCO N`

---

## 🎯 OBJETIVO FINAL

Ao final dos 13 blocos, Lucas terá:

- **dashboard.html** — Ferramenta single-file completa funcionando
- **5 arquivos de memória** — Documentação técnica do projeto
- **13 arquivos de changelog** — Histórico de cada bloco
- **13 arquivos de portabilidade** — Mapa completo de como exportar cada feature para outros projetos
- **portabilidade/INDICE.md** — Ranking consolidado das features mais valiosas para portar pro projeto Itaú via Eva

A ferramenta:
- Capaz de competir visualmente com Tableau, Power BI, Looker, Metabase
- Agnóstica a qualquer tipo de CSV
- Com 6 dicionários pré-feitos
- Com 4 diferenciais únicos
- Com inteligência estatística embarcada
- Personalizada para contexto Itaú
- Com agente proativo estilo Cowork
- Multi-perfil, exportável
- Em 5 modos de visualização
- **Com cada feature exportável documentada para reuso em outros projetos**

═══ FIM DO PROMPT v5.3 ═══
