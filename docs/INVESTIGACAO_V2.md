# Investigação Profunda V2 — Solstice 2026

> Documento de continuação. Premissa: depois de 3 sprints (1, 2, 3) o usuário
> testou o produto em uso real e encontrou **bugs visuais críticos** + **fricções
> de UX que comprometem o uso**. Esta investigação foca em **simplicidade + acertar
> o básico** antes de qualquer feature nova.
>
> Metodologia: re-aplicar `engineering:code-review` + `design:design-critique` com
> 8 personas adicionais de empresas que historicamente acertaram no "produto
> simples que escala" (Twitter, Instagram, Figma, Notion, Linear, Stripe, Airbnb,
> Vercel). Foco em **visual / funcionalidade / facilidade / organização / acessos**.

---

## 1. Personas adicionais — perfil "produto consumer/prosumer"

### 26. 🐦 Daniel Park · Ex-Tech Lead Twitter

> "Em 2010 a gente decidiu que cada feature nova tinha que ser
> entendível em 1 segundo. Se você precisa de tooltip, você falhou."

**Veredito Solstice:** "Welcome screen tem 4 áreas competindo: barra de pergunta, chips, botões de descobrir, cards de importar. **Eye doesn't know where to land.** Hierarquia visual precisa ser brutal: 1 ação primária, resto secundário."

**Bugs/atrito apontados:**
- `DK-01` Welcome com 4 áreas competindo — falta hierarquia visual única
- `DK-02` Botões `Tour interativo` e `Ver dashboard exemplar` competindo com chips → confunde
- `DK-03` Quando importa CSV, welcome "fica lá" — não some, parece travado

---

### 27. 🎨 Sofia Mendes · Ex-Designer Figma

> "Figma resolveu uma coisa que ninguém resolveu: as opções aparecem
> **quando você precisa**, não antes. Painel direito do Figma muda
> totalmente conforme você seleciona algo diferente. Solstice tem isso
> mas mistura responsabilidades."

**Bugs/atrito apontados:**
- `SM-01` Inspector mistura "Dados" + "Estilo" + "Comparação" — accordions empilhados sem clareza
- `SM-02` Não há diferença visual entre "estilo do card" (sombra, borda, padding) e "estilo do componente" (cor das séries, fonte do número, agressividade) — usuário tenta uma coisa, mexe na outra
- `SM-03` Falta seleção visual clara quando você clica num componente — qual está "selecionado"?
- `SM-04` Labels do Inspector são longos e técnicos (`kpiDeltaPosition`) — falta ícone + microcopy

---

### 28. 📐 Carla Reis · Ex-PM Linear

> "Linear é obcecado com 'cada pixel tem que valer'. Vocês colocam
> a logo na DIREITA do cabeçalho? Onde o usuário esperaria? Esquerda.
> Sempre esquerda. Pra TUDO ocidental."

**Bugs/atrito apontados:**
- `CR-01` Logo Solstice está à esquerda; mas falta o **título do dashboard** ao lado direito da logo (esperado: "Solstice · Meu Dashboard")
- `CR-02` Cabeçalho tem 4 áreas (brand · privacy badge · ask bar · ações) — privacy badge poderia ir pro footer ou um menu
- `CR-03` Ask bar central no topo é confuso quando não tem dado — joga atenção pra algo inútil

---

### 29. ✍️ Yuki Tanaka · Ex-Notion Engineer

> "A gente passou anos tornando blocos do Notion **arrastáveis e
> redimensionáveis**. É a coisa #1 que diferencia um app burro de um app
> que respeita o usuário. Filtros não-móveis em 2026 é coisa de 2005."

**Bugs/atrito apontados:**
- `YT-01` Filtros globais ocupam linha inteira fixa, sem opção de colapsar ou mover
- `YT-02` Cross-filter bar (azul) aparece e some sem feedback de transição
- `YT-03` "Insights" aparece sempre fixo no topo — usuário não pode reposicionar nem esconder
- `YT-04` "O que dá pra construir" é um insight de score 20 (baixíssimo) que aparece misturado com os de score alto

---

### 30. 💳 Henry Cole · Ex-Stripe Frontend

> "Stripe ficou famoso por reduzir cada formulário ao mínimo absoluto.
> Em Solstice, a tela de import já vem cheia: chips, ask, banners,
> 'tour', 'showcase', 'exemplar'… **Show 1 thing well.**"

**Bugs/atrito apontados:**
- `HC-05` (re: HC do doc V1) Welcome screen tem ~8 elementos visíveis simultaneamente
- `HC-06` "100% local" badge é importante mas compete por atenção no header
- `HC-07` Tour interativo dispara automaticamente, mas se o usuário fecha, ele não volta facilmente

---

### 30b. 🏠 Vanessa Cruz · Ex-Airbnb Designer

> "Vocês têm um produto bonito mas mal-iluminado. Como você abre,
> a coisa primária deveria ser MUITO óbvia. Hoje é uma vitrine com
> muita coisa boa que confunde."

**Bugs/atrito apontados:**
- `VC-01` Welcome screen precisa de uma **única call-to-action gigante** (Importar CSV) e o resto secundário
- `VC-02` Falta loading skeleton — quando importa CSV pequeno, parece que nada aconteceu (cards aparecem instantaneamente sem transição)
- `VC-03` "Dashboard sem título" deveria virar clicável-pra-renomear visível desde início

---

### 31. 🚀 Otto Friedman · Ex-Vercel DX

> "DX ruim em produto vira churn. Vocês mostram '200 inválidos' no
> score de qualidade quando os dados estão **corretos**. Isso queima
> confiança em segundos. Falso positivo é pior que falso negativo
> em quality check — porque o usuário VÊ."

**Bugs/atrito apontados:**
- `OF-01` Validate de `geo_uf` chama 200 valores de inválidos quando todos batem regex (bug: `.trim()` faltando em validate, presente em detect)
- `OF-02` Score de qualidade é binário "válido/inválido" — não distingue "tipo errado mas semanticamente OK" de "lixo de verdade"
- `OF-03` Mensagens de qualidade ("regiao: 200 inválidos (tipo geo_uf)") são técnicas demais — usuário não sabe se é erro dele ou do produto

---

### 32. 🗂️ Marcos Aguiar · Ex-Microsoft Power BI PM

> "Modelo de relacionamentos no Power BI evoluiu em 5 versões.
> Solstice mostra cards em grid + lista de relacionamentos separada
> embaixo. Não dá pra entender de relance qual coluna conecta com qual."

**Bugs/atrito apontados:**
- `MA-01` Aba Modelo separa visualmente os datasets (cards) das relações (lista) — falta linhas SVG conectando
- `MA-02` Não há indicação visual de cardinalidade (1:1, 1:N, N:N)
- `MA-03` Filtros propagam entre datasets sem indicação visual de "qual filtro está aplicado a qual base"

---

### 33. 📊 Patricia Silva · Ex-Tableau Solutions Architect

> "Tableau acertou em uma coisa: quando você abre uma base, o
> **resumo de qualidade** é a primeira coisa que você vê. Em Solstice,
> ele tá lá embaixo, depois das ações. Inverte: qualidade primeiro,
> ações segunda."

**Bugs/atrito apontados:**
- `PS-01` Ordem da aba Dados é: resumo → ações → qualidade. Esperado: resumo → qualidade → ações
- `PS-02` "O que dá pra construir" tomou espaço de qualidade (parece que substituiu)
- `PS-03` Quality card não destaca a coluna problemática — usuário precisa scroll pra achar

---

## 2. Cruzamento das críticas do usuário com personas

| Crítica do Lucas | Personas que confirmam | Severidade |
|---|---|---|
| Welcome travada após importar | DK-03, HC-06, VC-01 | 🔴 Crítica (bug) |
| "Importe CSV ou pergunte" não faz sentido sem dado | DK-01, CR-03, HC-05, VC-01 | 🟠 Alta |
| Logo deveria ter título do dashboard ao lado | CR-01, VC-03 | 🟡 Média |
| Aba Modelo desorganizada | MA-01, MA-02 | 🟠 Alta |
| Aba Dados desorganizada | PS-01, PS-02 | 🟡 Média |
| Estilização "card vs componente" confusa | SM-01, SM-02 | 🟠 Alta |
| "O que dá pra construir" inútil | YT-04, PS-02 | 🟡 Média (rápido) |
| Insights ruim, quer toggle + Executivo | YT-03 | 🟠 Alta |
| Filtros ocupando espaço inteiro feio | YT-01 | 🟠 Alta |
| Atrelar pasta + refresh real | (nova feature) | 🟡 Média |
| Qualidade falso positivo (geo_uf) | OF-01, OF-02 | 🔴 Crítica (bug) |
| Score não entender "macro" (dimensão) | OF-02, OF-03 | 🟠 Alta |
| Painel direito difícil de ver opções | SM-04 | 🟡 Média |

---

## 3. Plano dos sprints

### Sprint 4 — "Acertar o básico" (correções críticas)
Foco: bugs que **quebram confiança em segundos**.

1. **S4-01** Welcome travada — garantir limpeza quando dataset.ready vira true
2. **S4-02** Logo header — adicionar título do dashboard ao lado da brand
3. **S4-03** Qualidade — corrigir `.trim()` faltando em todos os `validate` (auditoria sistemática)
4. **S4-04** Qualidade — entender semântica (não chamar dimensão de "inválido" só porque tipo inferido foi específico)
5. **S4-05** Welcome adaptativo — sem dado: 1 CTA gigante "Importar". Com dado: que tem hoje
6. **S4-06** Filtros — colapsáveis (botão "esconder filtros")

### Sprint 5 — "Customização & organização"
Foco: reduzir confusão em **fluxos de uso diário**.

1. **S5-01** Inspector — separar visualmente "Card" (sombra/borda/padding) de "Componente" (cores/série/fonte)
2. **S5-02** Insights — toggle global mostrar/esconder; "O que dá pra construir" removível
3. **S5-03** Aba Modelo — visual de vínculos com linhas SVG entre cards
4. **S5-04** Painel direito — labels claros + spacing + ícones

### Sprint 6 — "Funcionalidades novas"
Foco: features que mudam o que dá pra fazer.

1. **S6-01** Insights Executivo (nova seção colapsável com narrativa de negócio)
2. **S6-02** Atrelar pasta — `showDirectoryPicker` + refresh real do arquivo atrelado

---

## 4. Princípios herdados

- **Hierarquia visual brutal** (Daniel/Twitter): 1 ação primária por tela, resto cinza
- **Mostrar opções quando precisam** (Sofia/Figma): contexto > estado
- **Pixel-perfect convenções** (Carla/Linear): logo esquerda, ações direita, sempre
- **Movável > fixo** (Yuki/Notion): se ocupa espaço, o usuário deveria poder reorganizar
- **1 coisa por tela** (Henry/Stripe): cortar antes de adicionar
- **Acolhedor** (Vanessa/Airbnb): CTA gigante e amigável > sutil-e-prolixo
- **DX zero-friction** (Otto/Vercel): falso positivo é fatal, melhor errar pra menos

---

_Esse documento será expandido se novas críticas aparecerem nos próximos sprints._
