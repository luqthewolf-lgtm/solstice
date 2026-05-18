# BUGS — Solstice / Dashboard Studio

> Lista de bugs conhecidos, ordenados por severidade. Adicione novos abaixo.
> Formato sugerido: status · severidade · módulo · descrição · passos pra reproduzir.

---

## 🔴 Críticos

_Nenhum bug crítico conhecido no momento._

---

### #007 — Painel de propriedades comprimido na sidebar esquerda · RESOLVIDO

**Status:** RESOLVIDO em Patch B7-r2
**Severidade:** importante (UX)
**Módulo:** `SolsticeProps`, `SolsticeSidebarTabs`, HTML/CSS app shell
**Bloco em que apareceu:** Acumulado desde B5

**Descrição:**
O painel de propriedades vivia dentro da sidebar esquerda (280px). Sintomas reportados pelo Lucas após uso prolongado:
- Tabs "Dados / Comparação / Visual / Decisões / Origem" (5-6) ficavam comprimidas e ilegíveis
- Painel competia espaço com Editor de colunas e Quality card
- Aba "📈 Análise" do B7 ficava no mesmo espaço apertado, atrapalhando a leitura estatística
- Catálogo de 10 componentes sem agrupamento ficava visualmente pesado

**Correção (B7-r2 / ADRs 063, 064, 065):**
1. **Inspector lateral direito** novo: grid 3-col com 340px à direita, abre via classe `.has-inspector`
2. **Accordion** substitui tabs: 5 seções expansíveis individualmente, persistência por seção
3. **Drawer inferior** novo para Análise estatística: separado do Inspector, ancorado ao canvas, grid de cards 220px min
4. **Catálogo accordion** por grupo (Básicos / Avançados / Texto)
5. **Botão 📈** na casca do componente abre o drawer

**Prevenção:**
ADR-063 + ADR-064 + ADR-065 estabelecem padrão: construção/visual no inspector lateral direito; análise/leitura em drawer inferior; tabs comprimidas viram accordion quando mais de 3 sessões disputam espaço.

**Reportado por:** Lucas Cardoso, sessão 3 (2026-05-18), via prompt "REESTRUTURAÇÃO ARQUITETURAL" com especificação detalhada.

---

### #006 — Componentes SVG estouram a seção verticalmente em containers largos · RESOLVIDO

**Status:** RESOLVIDO em Patch B7-r1
**Severidade:** importante (UX/layout)
**Módulo:** CSS — `.solstice__chart-svg`, `.solstice__chart-wrap`, `.solstice__comp`, `.solstice__md`, `.solstice__hist`
**Bloco em que apareceu:** B6 (precursor) · ficou MAIS visível no B7 porque smart defaults fazem usuários adicionar Scatter/Gauge/BoxPlot/Sankey com frequência

**Descrição:**
Ao adicionar Scatter/Gauge/Box Plot/Sankey via catálogo, o componente criava uma seção 1col que ocupa a largura inteira do canvas (~1180px em 1080p). O SVG tinha `aspect-ratio: 16/10` com `width: 100%` mas SEM `max-height`. Em containers de 1180px, isso fazia o SVG renderizar com altura ~738px. A seção esticava verticalmente e quebrava o layout — usuário precisava resize manual para cada componente.

Mesmo problema com Chart.js wrap (`flex: 1` + `min-height: 200px` sem cap) e Markdown (sem cap em textos longos).

**Correção (B7-r1 / ADR-062):**
1. `.solstice__chart-svg` + variantes — trocou `aspect-ratio + min-height` por `max-width + max-height` per tier (compact: 360×230 · standard: 480×320 · large: 600×380). SVG fica letterbox centralizado em containers largos.
2. `.solstice__chart-wrap` (Chart.js) — adicionado `max-height: 380px` no wrap e no canvas filho.
3. `.solstice__comp` — `max-height: 460px` (≈ SVG cap 380 + header 40 + padding 20 + folga) como teto absoluto + `overflow: hidden` como salvaguarda.
4. `.solstice__md` (markdown) — `max-height: 380px` + `overflow-y: auto` para textos longos.
5. `.solstice__hist` (Distribuição) — `max-width: 600px` + `margin: 0 auto` para mesma proteção.

**Prevenção:**
ADR-062 documenta a regra geral: todo componente visual com elemento de aspect-ratio livre (SVG, canvas, embed) DEVE declarar `max-width` e `max-height`. Adicionar a esse checklist ao registrar novo componente nos blocos futuros.

**Reportado por:** Lucas Cardoso, sessão 2 (2026-05-18), via uso real após validação do B7.

---

### #002 — UI desatualizada acumulada (sidebar status, footer, tab Componentes, botão remover) · RESOLVIDO

**Status:** RESOLVIDO em Patch B5-r1
**Severidade:** importante
**Módulo:** HTML estático + `SolsticeComponents.render` + boot
**Bloco em que apareceu:** B5 (acumulado desde B2)

**Descrição:**
Após entrega rápida dos Blocos 1-5, 5 sintomas visíveis:
- Card "Status do bloco" na sidebar mostrava só features B1+B2 com "→ Próximo: Bloco 3"
- Footer mostrava "v5.3 · Bloco 1" mesmo na versão 5.3.0-bloco5
- Tab "🧩 Componentes" na sidebar continuava `disabled` apesar do registry estar implementado
- Componentes não tinham botão de remover (só 🔬 🔍 ⚙️ no header)
- KPI Card visualmente confuso (delta+meta soltos)

**Causa raiz:**
Violação da Regra 1 Seção 1 (UM bloco por resposta). Entreguei blocos consecutivos sem pausar para validar coerência. Cada bloco atualizou o banner topo, mas os outros 3 pontos de versão e a habilitação progressiva de UI ficaram para trás.

**Correção:**
- Botão 🗑️ adicionado no header de componente (com `--danger` CSS)
- Tab "Componentes" ativada + `SolsticeSidebarTabs` novo módulo alterna painéis
- Card de status reescrito refletindo B1-B5 + "Próximo: Bloco 6"
- Footer `#app-version` lê `Solstice.version` no boot (regex, à prova de erro)
- KPI reorganizado em 4 linhas claras (label / valor com tooltip / "▲ +X% vs período anterior" / sparkline + meta)
- ADRs 034-037 registrados (último é meta-ADR sobre protocolo)
- Memória `feedback-one-block-per-response.md` criada

**Prevenção:**
ADR-037 documenta o ritual obrigatório de fechamento de bloco (6 arquivos meta + 4 pontos de versão no HTML). Memória registra a lição para sessões futuras.

**Reportado por:** Lucas Cardoso, sessão 1 (2026-05-17), via "PARADA TÉCNICA OBRIGATÓRIA" após observação de bugs visíveis no preview.

---

### #005 — Aba "Comparação" quebrava layout + KPI título à direita errado + comparações estatisticamente inválidas misturadas · RESOLVIDO

**Status:** RESOLVIDO em Patch B5-r4
**Severidade:** importante (UX + correção estatística)
**Módulo:** `SolsticeProps` + `SolsticeKPI` + `SolsticeComponents`
**Bloco em que apareceu:** B5-r3

**Descrição:**
- Aba "⚖️ Comparação" do KPI: 8 radios + sub-campos vazavam para fora do painel lateral, cortando o header "KPI Card" e a aba "Origem"
- KPI mostrava título no canto superior-direito (decisão revertida — leitura ocidental natural pede esquerda)
- 8 opções de comparação eram mostradas independente da agregação — Soma vs Média histórica fica estatisticamente sem sentido

**Correção:**
- ADR-044 secundária: `.solstice__props-panel` ganhou `overflow-x: hidden` + `max-height: calc(100vh - 280px)` + scroll vertical. Tabs `flex-wrap: nowrap` + overflow-x auto. Radios da Comparação compactos (font-xs, padding 4/8, gap 2). Labels do `COMPARISON_TYPES` ganharam variante `short` ("Mesmo período (1a)", "Primeiro valor", "Último valor")
- ADR-044 principal: `AGG_COMPARISON_COMPAT` + `isCompatible()` + `incompatReason()`. Aba Comparação filtra compatíveis; botão "+ Mais opções" expande incompatíveis com aviso ⚠️ e tooltip por opção. Auto-switch quando agregação muda
- ADR-045: hook genérico `def.getTitle(slot, ctx)` no `Components.render`. KPI usa para mostrar nome amigável da coluna em UPPERCASE no header da casca à esquerda

**Prevenção:**
Novas abas no Props devem testar `overflow` em sidebar estreita. Componentes que precisam de título dinâmico declaram `getTitle`. Combinações estatísticas devem ser revistas conforme novos componentes adicionam suas próprias agregações/baselines.

---

### #004 — Abas "Dados" e "Componentes" misturadas + comparação fixa + confirmações irritantes · RESOLVIDO

**Status:** RESOLVIDO em Patch B5-r3
**Severidade:** importante (UX)
**Módulo:** `SolsticeSidebarTabs` + `SolsticeProps` + `SolsticeModal`
**Bloco em que apareceu:** B5

**Descrição:**
Após uso real do B5-r2, Lucas reportou 4 fricções:
- Painel de propriedades aparecia em ambas abas (Dados e Componentes), confundindo o contexto
- Clicar componente no canvas não levava o usuário para a aba certa
- Comparação do KPI era fixa em "1ª metade vs 2ª metade" — sem opção de meta, histórico, etc.
- Confirmar cada remoção de componente/seção/row vira fricção em uso frequente

**Correção:**
- ADR-040: `SidebarTabs.activate` agora controla os 3 painéis (`#data-panel`, `#components-panel`, `#props-panel`) explicitamente. `Store.ui.activeTab` persiste aba ativa.
- ADR-041: `Props.select` força aba `componentes` automaticamente quando seleção acontece em outra aba.
- ADR-042: Novo módulo `SolsticeKPI.calculateDelta` com 8 tipos. Aba "Comparação" no Props com radio buttons + sub-campos condicionais (Meta fixa, Período anterior).
- ADR-043: `Modal.confirm({skipKey})` com checkbox "Não perguntar mais" + `Toast.action(Desfazer)` como compensação. Menu de Preferências no botão 👤 reativa.

**Prevenção:**
Toda nova confirmação destrutiva já deve declarar `skipKey` para ser silenciável. Toast pós-ação destrutiva deve oferecer Desfazer.

---

### #003 — KPI Card com layout confuso e strings técnicas na UI · RESOLVIDO

**Status:** RESOLVIDO em Patch B5-r2
**Severidade:** importante
**Módulo:** `SolsticeComponents.kpi.render`
**Bloco em que apareceu:** B5

**Descrição:**
KPI Card mostrava:
- Linhas "soltas" sem hierarquia visual clara
- Sparkline embaixo sem propósito óbvio
- Texto "últimos 88 pontos" — jargão sem contexto
- "n=200" cru
- Label e número alinhados à esquerda em ordem invertida

**Correção:**
- Layout redesenhado: título canto sup-direito (uppercase, muted), valor grande à esquerda (var(--fs-3xl) + tabular-nums), linha de comparação humanizada ("▲ +12,3% acima do período anterior")
- Sparkline removido por default; opt-in via `slot.config.showSparkline`
- Caption do sparkline (quando ativado): "Tendência ao longo do tempo" ou "Variação ao longo dos dados", nunca "últimos N pontos"
- Tooltip humanizado no número: "Soma de 200 valores válidos da coluna Receita Mensal"
- Cores via `Humanize.delta()`.color → `success`/`error`/`muted`

**Prevenção:**
ADR-039 (toda saída textual via Humanize). Grep periódico por `n=` ou números crus em templates.

---

### #002 — UI desatualizada acumulada (sidebar status, footer, tab Componentes, botão remover) · RESOLVIDO

(detalhes na seção #002 do bloco anterior)

---

### #001 — Código órfão em `boot()` quebrava o app inteiro · RESOLVIDO

**Status:** RESOLVIDO em patch pós-Bloco 3
**Severidade:** crítico
**Módulo:** `SolsticeApp.boot` (dashboard.html)
**Bloco em que apareceu:** Bloco 3 (durante refactor da ingestão)

**Descrição:**
Após extrair `_runIngest` de dentro de `boot()` para `_runIngestFile` em escopo de módulo (Bloco 3, para o empty state do Canvas poder reutilizar), restou o **corpo da função antiga** órfão dentro de `boot()`, incluindo uma `}` de fechamento solta. Esse código referenciava `file`, `steps`, `stepStatus` em escopo onde não existiam, disparando `ReferenceError` no carregamento da página e abortando o boot inteiro.

**Sintomas:**
- Paleta/densidade/tema toggle não funcionam (listeners depois do bloco órfão nunca anexados)
- Botão "Carregar CSV dummy" não responde
- Onboarding, help, debug shortcut, canvas — tudo inerte
- DevTools Console mostra `ReferenceError: file is not defined` e nenhum dos `console.log` finais do boot

**Causa raiz:**
Edit-replace que substituiu `async function _runIngest(file){` por linha em branco — mas não removeu o corpo da função até a `}` final. JavaScript não levantou erro de sintaxe (a `}` órfã casava com um bloco anterior), só de runtime na execução.

**Correção:**
Remoção das linhas 2598-2639 (corpo órfão + chave solta). `_runIngestFile` em escopo de módulo (linha 2504) já tinha a versão correta — era duplicação morta.

**Prevenção:**
ADR-024 documenta: após qualquer refactor que mexa em `boot()`, **confirmar `[Solstice] boot OK` no console**. Ausência = boot interrompido. Sentinel adicionado no final de `boot()`.

**Reportado por:** Lucas Cardoso, sessão 1 (2026-05-17), via diagnóstico próprio (`localizou linhas 2598-2638 com refs órfãs`).

---

## 🟡 Importantes

_Nenhum bug importante conhecido no momento._

---

## 🟢 Menores / Polish

_Nenhum bug menor conhecido no momento._

---

## 📝 Template para novos bugs

Copie o bloco abaixo ao reportar:

```
### #001 — <título curto>

**Status:** ABERTO · em-investigação · corrigido em vX.Y
**Severidade:** crítico · importante · menor
**Módulo:** SolsticeStore | SolsticeLocale | SolsticeDictionary | etc.
**Bloco em que apareceu:** Bloco N

**Descrição:**
<o que está acontecendo>

**Comportamento esperado:**
<o que deveria acontecer>

**Passos para reproduzir:**
1. ...
2. ...
3. Bug observado em ...

**Console / debug overlay:**
```
<paste do console + Ctrl+Shift+D output>
```

**Workaround:**
<se houver>

**Notas:**
<contexto adicional, screenshots, etc.>
```

---

## 🔍 Como reportar bugs encontrados durante o uso

1. Pressione `Ctrl + Shift + D` para abrir o debug inspector
2. Tire screenshot das 3 abas (STATE / LOCALE / PERF)
3. Copie qualquer erro do console do navegador (F12)
4. Adicione um bug seguindo o template acima
5. Mencione na conversa: "Adicionei o bug #N em BUGS.md"

---

## 🧪 Cenários para teste manual de regressão (atualizar a cada bloco)

### Bloco 11 — Snapshots + Versions + FileSystem + Export + Templates Itaú

- [ ] Sentinela `[Solstice] Bloco 11 aplicado · Snapshots + Versions + FileSystem + Export + Templates Itaú` verde
- [ ] `[Solstice] boot OK` aparece
- [ ] `Solstice.version === '5.3.0-bloco11'`
- [ ] Footer mostra `v5.3 · Bloco 11`
- [ ] Console: `Solstice.Snapshots / Versions / FileSystem / Export / TemplatesItau` expostos

**Snapshots:**
- [ ] Carregar CSV → toolbar mostra 💾 Salvar · 📂 Abrir · ⬇️ Exportar · 🕐 Histórico
- [ ] Click "💾 Salvar" → toast "Snapshot rápido salvo"
- [ ] Click "📂 Abrir" → modal com lista de snapshots; item clicado restaura tudo (canvas + filtros + params + dataset)
- [ ] Ctrl+S salva snapshot rápido sem abrir modal (mesma ação do botão)
- [ ] Ctrl+O abre modal de snapshots
- [ ] Renomear snapshot via ✏️ → toast + nome muda na lista
- [ ] Remover snapshot via 🗑️ → modal confirm danger → desaparece da lista
- [ ] Snapshots persistem entre reloads (localStorage)
- [ ] Cap 30: salvar 31º → mais antigo é descartado
- [ ] Console: `Solstice.Snapshots.list().length` é correto

**Versions:**
- [ ] Click "🕐 Histórico" → modal com versão atual (🟢) + até 10 anteriores (🕐)
- [ ] Cada versão tem timestamp + tamanho em KB
- [ ] Click em ↶ restaura versão anterior + toast
- [ ] Reload da página → histórico zera (em memória)
- [ ] Console: `Solstice.Versions.list().length` ≤ 10

**FileSystem:**
- [ ] Em Chrome/Edge: `Solstice.FileSystem.isSupported() === true`
- [ ] Em Firefox: false; fallback download funciona
- [ ] saveJSON → diálogo "Save As" em Chrome; download direto em Firefox
- [ ] openJSON → diálogo "Open" em Chrome; input file em Firefox

**Export:**
- [ ] Click "⬇️ Exportar" → modal com 3 opções
- [ ] Opção "📄 HTML com dados" → baixa arquivo `.html`; abrir num browser limpo → dashboard idêntico aparece + console mostra `[Solstice] Estado embedded rehidratado`
- [ ] Opção "📑 HTML sem dados" → mesmo arquivo mas com canvas vazio aguardando import
- [ ] Opção "🗂️ JSON puro" → baixa `.solstice.json`; pode reabrir via 📂 (fallback openJSON)
- [ ] Console: `Solstice.Audit.list({action:'export_html'})` registra exportação

**Templates Itaú:**
- [ ] `Solstice.TemplatesItau.list().length === 3`
- [ ] `Solstice.Templates.DOMAIN` contém os 3 templates Itaú (anexados no init)
- [ ] Aplicar dicionário "Banco PJ" → picker do "📋 Templates" da toolbar mostra os 3
- [ ] Click no template "Carteira PJ — Visão Mensal" → 2 sections criadas com 5 componentes
- [ ] Sem dicionário "Banco PJ": templates aparecem mas filtrados por `domain` apenas se match

**Aba Dicionários (sidebar):**
- [ ] Click em "🧠 Dicionários" → painel mostra ativo + salvos + 6 pré-feitos
- [ ] Click em ✓ de um pré-feito → aplica + toast + painel atualiza
- [ ] Lista de pré-feitos exclui "generico"

**Aba Snapshots (sidebar):**
- [ ] Click em "📸 Snapshots" → painel com botão "💾 Salvar atual" + lista
- [ ] Salvar pelo painel → modal prompt para nome → adiciona à lista
- [ ] 📂/🗑️ funcionam inline

**Regressão B1-B10:**
- [ ] Auto-Dashboard e Wizard continuam operacionais
- [ ] Filtros/Cross-filter/Params operacionais
- [ ] 10 componentes renderizam
- [ ] Insights/Narrative/Ask operacionais

### Bloco 10 — Auto-Dashboard + Wizard + Recomendações (15+ tipos · 11 intenções)

- [ ] Sentinela verde `[Solstice] Bloco 10 aplicado · Auto-Dashboard + Wizard expandido + Recomendações (15+ tipos)`
- [ ] `[Solstice] boot OK` aparece
- [ ] `Solstice.version === '5.3.0-bloco10'`
- [ ] Footer mostra `v5.3 · Bloco 10`
- [ ] Banner cita `BLOCO 10 · AUTO-DASHBOARD`
- [ ] Console: `Solstice.ColumnScore`, `Solstice.Recommender`, `Solstice.AutoDashboard`, `Solstice.Wizard` expostos

**ColumnScore:**
- [ ] Console: `Solstice.ColumnScore.rank(Solstice.Components.list && Solstice.Store.get('ingest') ? {rows: Solstice.Store.get('ingest').rows, columns: Solstice.Store.get('ingest').columns, types: Solstice.Store.get('ingest').types, dictionary: Solstice.Store.get('dictionary')} : {})` retorna array de {col, score}
- [ ] Scores estão entre 0 e 100
- [ ] Colunas com `higherIsBetter` no dicionário aparecem entre as top 3
- [ ] Coluna 100% nula recebe score baixo (< 30)

**Recommender:**
- [ ] Console: `Solstice.Recommender.recommend(ctx)` retorna array ordenado por confidence desc
- [ ] `Solstice.Recommender.listRules().length === 15`
- [ ] `Solstice.Recommender.listIntents().length >= 12` (11 + custom)
- [ ] Filtrar por intent: `recommend(ctx, {intent: 'tendencia'})` só inclui regras de tendência
- [ ] Confidence calibrada: KPI com higherIsBetter = 90, Tabela fallback = 50

**Auto-Dashboard:**
- [ ] Carregar CSV dummy → toolbar tem botão "🪄 Auto-Dashboard" primary (accent)
- [ ] Click → modal "🪄 Auto-Dashboard sugerido" abre (force: true sempre confirma)
- [ ] Modal mostra summary "Confiança média: X%" + lista checkmarcável
- [ ] Cada item: checkbox · ícone · nome · reasoning · badge confidence (verde/amarelo/cinza)
- [ ] Desmarcar item → "Aplicar" cria só os marcados
- [ ] Click "Aplicar selecionados" → sections criadas no canvas
- [ ] Toast sucesso com N componentes / N sections
- [ ] Console: `Solstice.Audit.list({action:'auto_dashboard'}).length > 0` após uso
- [ ] Sem dataset: botão NÃO aparece
- [ ] Console: `Solstice.AutoDashboard.run({intent:'tendencia'})` filtra por intent

**Wizard:**
- [ ] Toolbar tem botão "🧙 Wizard"
- [ ] Click → modal "🧙 Wizard de criação" abre no step 1
- [ ] Step indicator no topo: ① Intenção (atual) → ② Revisar → ③ Aplicar
- [ ] Step 1: grid 2-3 col com 12 cards (7 agnósticos + 4 analíticos + 1 custom)
- [ ] Cards têm ícone grande, título, descrição, badge (📊/🔬/🛠️)
- [ ] Click num card → seleciona (border accent) + avança auto para step 2
- [ ] Step 2: lista checkmarcável com recomendações filtradas pela intenção
- [ ] Botão "← Voltar" volta para step 1 mantendo seleção
- [ ] Botão "Próximo →" avança para step 3 se há ≥ 1 marcado
- [ ] Step 3: lista final de aplicação (✓ verdes em vez de checkboxes)
- [ ] Botão "✓ Aplicar" → componentes criados + modal fecha + toast sucesso
- [ ] Sem dataset: botão dispara toast "Importe um CSV primeiro" e modal não abre
- [ ] Console: `Solstice.Audit.list({action:'wizard_apply'}).length > 0` após uso
- [ ] Intenção "Personalizado" → step 2 mostra TODAS as recomendações (sem filtro de intent)

**Regressão B1-B9:**
- [ ] Filtros/Cross-filter/Params continuam funcionando
- [ ] Insights/Narrative/Agent/Inconsistências/Ask operacionais
- [ ] 10 componentes renderizam normalmente
- [ ] Inspector lateral, Drawer Análise, Catálogo accordion — operacionais

### Bloco 9 — Filtros Globais + Cross-Filter + Parâmetros (+ patch B8-r1 empty-state)

- [ ] Sentinela verde `[Solstice] Bloco 9 aplicado · Filtros Globais + Cross-Filter + Parâmetros · (+ patch B8-r1 empty-state)`
- [ ] `[Solstice] boot OK` aparece
- [ ] `Solstice.version === '5.3.0-bloco9'`
- [ ] Footer mostra `v5.3 · Bloco 9`
- [ ] Banner cita `BLOCO 9 · FILTROS GLOBAIS`

**Patch B8-r1 (empty state):**
- [ ] Empty state inicial (sem dataset) fica CENTRALIZADO verticalmente no canvas
- [ ] Após import de CSV, empty state com "Comece com um template" continua centralizado
- [ ] Conforme toolbar/Filters/Insights crescem acima, empty NÃO afunda mais para fora da viewport
- [ ] Recarregar a página várias vezes não muda posição

**SolsticeFilters:**
- [ ] Carregar CSV dummy → barra "🔍 Filtros" aparece entre toolbar e Insights
- [ ] Sugere até 8 colunas: categóricas (2-30 distintos) + temporais + numéricas
- [ ] Multi-select em "regiao" → click no trigger abre panel com busca + checkboxes ordenados por contagem
- [ ] Selecionar 2 regiões → chips no trigger + "(+0)" se mais
- [ ] Botão "✕ limpar" do filtro aparece quando há seleção
- [ ] Range slider em "receita" → arrastar bolinhas muda min/max, fill accent acompanha, inputs numéricos sincronizam
- [ ] Date picker em "data" → presets "7d / 30d / 3m / 12m / Tudo" clicáveis; inputs `<input type="date">` editáveis
- [ ] Header da barra mostra "N ativos" badge accent quando há filtros
- [ ] Botão "✕ Limpar tudo" no header aparece com filtros ativos
- [ ] Click no header colapsa/expande (estado persiste em Store.ui.filters.collapsed)
- [ ] **Componentes filtram:** KPI/Tabela/Scatter/etc. recalculam com rows filtradas
- [ ] Console: `Solstice.Filters.activeCount()` retorna número correto
- [ ] Console: `Solstice.Filters.getActiveRows().length` < `Solstice.Store.get('ingest').rows.length` quando filtros ativos
- [ ] Insights/Narrativa/Inconsistências do B8 recalculam quando filtros mudam

**SolsticeCrossFilter:**
- [ ] Adicionar Sankey → clicar em um node (ex: "Sudeste" na origem) → barra azul accent aparece "🎯 Cross-filter: Região = Sudeste · ✕ Limpar"
- [ ] Todos os outros componentes filtram para mostrar só "Sudeste"
- [ ] Click no ✕ da barra → limpa cross-filter
- [ ] Esc também limpa (após fechar drawer/inspector se abertos)
- [ ] Click em outro node substitui o cross-filter
- [ ] Console: `Solstice.CrossFilter.get()` retorna `{column, value}` ou null

**SolsticeParams:**
- [ ] Botão "🎛️ Parâmetros" aparece na toolbar do canvas
- [ ] Click → modal com lista vazia + botão "+ Adicionar parâmetro"
- [ ] Add → linha com inputs nome / tipo (string/number/date) / valor / 🗑️
- [ ] Trocar tipo muda o input correspondente (number → input[type=number], date → input[type=date])
- [ ] Renomear parâmetro com nome em uso → toast warn
- [ ] Salvar → modal fecha + toast sucesso + persistido em Store.params
- [ ] Criar Markdown com texto `{{param.meta}}` → ao selecionar componente, mostra valor real
- [ ] Console: `Solstice.Params.get('meta')` retorna valor
- [ ] Console: `Solstice.Params.resolveText('Meta: {{param.meta}}')` substitui

**Regressão B1-B8:**
- [ ] 10 componentes ainda renderizam normalmente
- [ ] SolsticeStats 47 funções operacionais
- [ ] Insights aparece SE houver insights (continua funcionando)
- [ ] Narrativa modal abre via inspector
- [ ] Ctrl+P abre Ask
- [ ] Avisos (Inconsistências) aparecem no inspector
- [ ] Inspector lateral, Drawer Análise, Catálogo accordion — operacionais

### Bloco 8 — Insights + Narrativa + Agente + Inconsistências + Ask

- [ ] Sentinela verde `[Solstice] Bloco 8 aplicado · Insights + Narrativa + Agente + Inconsistências (Diferencial #2)`
- [ ] `[Solstice] boot OK` também aparece
- [ ] `Solstice.version === '5.3.0-bloco8'`
- [ ] Footer mostra `v5.3 · Bloco 8`
- [ ] Banner cita `BLOCO 8 · INSIGHTS EXECUTIVOS + NARRATIVA AUTOMÁTICA...`
- [ ] Console: 5 módulos novos expostos — `Solstice.Insights / Narrative / Agent / Inconsistencies / Ask`

**SolsticeInsights:**
- [ ] Carregar CSV dummy → painel "💡 Insights executivos" aparece no topo do canvas (entre toolbar e sections)
- [ ] Cards mostram 1-8 insights priorizados por score
- [ ] Cada card tem ícone + título + texto + border-left colorido por severity
- [ ] Click no header → painel colapsa/expande (estado persistido em Store.ui.insights.collapsed)
- [ ] Console: `Solstice.Insights.compute()` retorna array com `kind/title/text/severity/score/meta`
- [ ] Tipos verificáveis: trend, outliers, pareto, top — sazonalidade e recency dependem de dados

**SolsticeNarrative:**
- [ ] Selecionar componente (KPI/Série/etc) → inspector lateral abre
- [ ] Rodapé do inspector tem botão "📖 Gerar narrativa" (acima do Remover)
- [ ] Click → modal com pills de Tom (👔 / 🔬 / 💬) e Profundidade (📄 / 📑 / 📚)
- [ ] Trocar tom → preview atualiza em tempo real
- [ ] Trocar profundidade short → 1 parágrafo · medium → 2-3 · long → 4+ com outliers
- [ ] Botão "📋 Copiar" → texto no clipboard + toast sucesso
- [ ] Botão "⬇️ Markdown" → baixa arquivo .md com timestamp
- [ ] Botão "✉️ Email" → abre mailto: com subject e body
- [ ] Markdown selecionado: botão Gerar narrativa NÃO aparece no rodapé (componente sem narrativa)
- [ ] Console: `Solstice.Narrative.build(slotId)` retorna string

**SolsticeAgent:**
- [ ] Importar CSV → após ~1.2s aparece toast contextual (se houver insight relevante)
- [ ] Toast tem título · msg · botão de ação ("Ver insights" / "Criar Box Plot")
- [ ] Click no botão → ação correspondente executada
- [ ] Importar SEGUNDO CSV → cap reseta, novo toast pode disparar
- [ ] Max 3 toasts por sessão (cap)
- [ ] Console: `Solstice.Agent.status()` retorna `{ fired, cap: 3, keys: [...] }`

**SolsticeInconsistencies:**
- [ ] Console: `Solstice.Inconsistencies.catalog().length === 15`
- [ ] Carregar dummy → criar KPI com agg='sum' em coluna de % (ex: margem_bruta) → inspector mostra accordion "⚠️ Avisos" com regra `sum-of-pct`
- [ ] Criar Sankey, forçar source=target → accordion mostra `sankey-same-cols` (error)
- [ ] Gauge com target fora do range → `gauge-meta-fora-range`
- [ ] Accordion "Avisos" só aparece se há ≥ 1 hit
- [ ] Console: `Solstice.Inconsistencies.checkSlot(slotId)` retorna array de hits

**SolsticeAsk (Ctrl+P):**
- [ ] `Ctrl+P` (ou `Cmd+P` no Mac) abre overlay tipo Spotlight
- [ ] Foco automático no input após 50ms
- [ ] Lista de exemplos sugeridos aparece embaixo
- [ ] Click numa sugestão → preenche input + executa
- [ ] Digitar "qual a média de receita" + Enter → card com valor formatado + fórmula
- [ ] Digitar "correlação entre receita e ticket_medio" → r ∈ [-1, 1] + forte/moderada/fraca
- [ ] Digitar "top 5 em regiao por receita" → top 5 categorias com somas
- [ ] Digitar "tendência de receita" → 🔼/🔽/➡️ + magnitude %
- [ ] Digitar "quantos registros" → total formatado pt-BR
- [ ] Digitar pergunta fora dos padrões → mensagem amigável + sugestões
- [ ] Esc fecha · click no backdrop fecha · Ctrl+P novamente fecha (toggle)
- [ ] Ctrl+P NÃO abre print do browser (intercept)
- [ ] Ctrl+P NÃO intercepta quando foco está em input/textarea (deixa usuário digitar 'p' normalmente)
- [ ] Sidebar tem `Ctrl+P · Pergunte ao Solstice` na lista de atalhos

**Sidebar atalhos:**
- [ ] Lista mostra: Ctrl+P · Pergunte ao Solstice / Ctrl+Z/Shift+Z · Undo/Redo / Ctrl+Shift+D · Debug / Esc · Fechar painéis / ? · Ajuda

**Regressão B1-B7-r2:**
- [ ] Inspector lateral, Drawer Análise, Catálogo accordion continuam funcionando
- [ ] SolsticeStats todas as 47 funções operacionais
- [ ] Smart defaults dos 4 componentes ainda funcionam
- [ ] SVGs respeitam cap de tamanho do B7-r1
- [ ] Undo/Redo, DnD, FreeMode, Audit, Provenance — todos operacionais

### Bloco 7 — refinamentos r2 (Inspector lateral + Drawer Análise + Catálogo accordion)

- [ ] Sentinela verde `[Solstice] Patch B7-r2 aplicado · inspector lateral direito + drawer Análise inferior + catálogo accordion`
- [ ] `[Solstice] boot OK` também aparece
- [ ] `Solstice.version === '5.3.0-bloco7-r2'`
- [ ] Footer mostra `v5.3 · Bloco 7 r2`
- [ ] Banner cita `BLOCO 7 r2 · INSPECTOR LATERAL DIREITO...`

**Inspector lateral:**
- [ ] Sem componente selecionado → app em 2 colunas (sidebar + canvas), inspector com width 0
- [ ] Adicionar componente → automaticamente seleciona e abre inspector (slide-in da direita, 300ms)
- [ ] Inspector ocupa 340px à direita do canvas
- [ ] Header do inspector mostra "📊 KPI CARD" (ou ícone+nome do componente)
- [ ] Body do inspector tem accordions: 📊 Dados (aberta) · ⚖️ Comparação (só KPI, aberta) · 🎨 Visual (fechada) · 🔍 Decisões (fechada) · 🔬 Origem (fechada)
- [ ] Click no chevron de cada accordion abre/fecha individualmente
- [ ] Múltiplas seções podem estar abertas ao mesmo tempo
- [ ] Estado persistido: fechar "Dados", trocar para outro componente, voltar → "Dados" continua fechada
- [ ] Footer do inspector tem botão vermelho "🗑️ Remover componente"
- [ ] Click no ✕ do inspector fecha — canvas volta ao tamanho integral
- [ ] Esc fecha inspector (se não há modal aberto)
- [ ] Click em área vazia do canvas fecha inspector
- [ ] Trocar de componente → inspector atualiza header e body, mantém aberto

**Drawer Análise:**
- [ ] Botão 📈 no header da casca do componente (junto com 🔬 🔍 ⚙️ 🗑️)
- [ ] Click em 📈 → drawer inferior sobe (300ms)
- [ ] Drawer ocupa 340px de altura, largura entre sidebar (280px) e inspector (0 ou 340px)
- [ ] Drawer mostra cards em grid: Distribuição central · Faixa e quartis · Forma · Outliers
- [ ] Time Series: cards extras "📈 Tendência" + "🔮 Forecast linear (5 períodos)"
- [ ] Scatter: card "🔗 Correlação" (Pearson + Spearman + nota se |ρ|−|r|>0.15)
- [ ] Gauge com target: card "🎯 Distância da meta"
- [ ] Box Plot agrupado: card "📦 Por grupo (top 6)"
- [ ] Markdown: empty state explicando que não tem análise
- [ ] Footer do drawer tem snippet de console
- [ ] Click no ✕ fecha drawer
- [ ] Esc fecha drawer (antes do inspector na cascata)
- [ ] Click no 📈 do MESMO componente fecha (toggle)
- [ ] Click no 📈 de OUTRO componente troca o conteúdo sem fechar
- [ ] Drawer ajusta `right: 340px` quando inspector está aberto (não sobrepõe)

**Catálogo accordion (slidedown):**
- [ ] Aba "🧩 Componentes" → 3 accordions: 📊 Básicos (4 cards, aberto) · ⚡ Avançados (5 cards, fechado) · 📝 Texto (1 card, fechado)
- [ ] Contador "(N)" ao lado de cada título
- [ ] Click no header abre/fecha
- [ ] Estado persistido entre re-renders
- [ ] Footer "💡 Selecione um componente no canvas para editar suas propriedades no painel da direita →"
- [ ] Cards desabilitados antes de importar CSV (cinza + tooltip)
- [ ] Após importar CSV: cards habilitados; clicar adiciona e abre inspector

**Aba Dados da sidebar:**
- [ ] Continua mostrando Resumo do Dataset + Quality + Editor de Colunas
- [ ] NÃO tem mais props-panel embaixo

**Responsividade:**
- [ ] `< 1200px`: inspector vira overlay `position: fixed` à direita; drawer ajusta `right: 0`
- [ ] `< 768px`: drawer vira full-width

**Regressão B7-r1 e B1-B6:**
- [ ] SVGs ainda respeitam max-height por tier (cap do r1)
- [ ] Smart defaults dos 4 componentes ainda funcionam
- [ ] SolsticeStats.* funções todas operacionais (47 funções)
- [ ] Undo/Redo (B4) funcionam
- [ ] Resize/DnD/FreeMode (B4) funcionam
- [ ] Audit/Provenance (B5) funcionam
- [ ] Console: `Solstice.Inspector`, `Solstice.Analysis`, `Solstice.createAccordion` expostos

### Bloco 7 — refinamentos r1 (cap de tamanho)

- [ ] Sentinela verde `[Solstice] Patch B7-r1 aplicado · cap de tamanho dos componentes SVG (max-height por tier + .solstice__comp 460px)`
- [ ] `[Solstice] boot OK` também aparece
- [ ] `Solstice.version === '5.3.0-bloco7-r1'`
- [ ] Footer mostra `v5.3 · Bloco 7 r1`
- [ ] Banner cita `BLOCO 7 r1 · ...CAP DE TAMANHO`
- [ ] Status sidebar tem linha "✓ Cap de tamanho dos componentes (B7-r1)"
- [ ] Carregar CSV dummy → adicionar **Scatter** em seção 1col (canvas largo)
- [ ] Scatter renderiza com **altura ≤ ~440px** (incluindo header da casca) — NÃO estoura 700px+
- [ ] SVG do Scatter fica centralizado (letterbox) com max-width ~600px
- [ ] Mesma validação para Gauge, Box Plot, Sankey, Distribuição
- [ ] Série Temporal (Chart.js) também respeita cap (max-height 380px no wrap)
- [ ] Markdown com texto longo → scroll vertical interno aparece, sem estourar
- [ ] Tabela continua scrollando internamente (data-table-wrap)
- [ ] Heatmap Calendário continua scrollando horizontal (overflow-x:auto)
- [ ] Em layout 2col-equal: SVGs ainda renderizam responsivos sem cap visível
- [ ] Em layout 4col-equal: SVGs em tier compact com max-width 360px
- [ ] Resize de slot (Bloco 4) ainda funciona — componente respeita novas dimensões via ResizeObserver
- [ ] Componente com is-selected NÃO tem box-shadow clipado (overflow:hidden não corta box-shadow externo)
- [ ] Tooltips de hover dos botões 🔬🔍⚙️🗑️ ainda aparecem (não cortados)

### Bloco 7 — SolsticeStats + Aba Análise + Smart Defaults

- [ ] Sentinel `[Solstice] Bloco 7 aplicado · módulo estatístico + UX smart dos 4 componentes avançados` em verde no console
- [ ] `[Solstice] boot OK` também aparece
- [ ] `Solstice.version === '5.3.0-bloco7'`
- [ ] Footer mostra `v5.3 · Bloco 7`
- [ ] Banner topo: `BLOCO 7 · MÓDULO ESTATÍSTICO SolsticeStats (35+ funções) + UX SMART...`
- [ ] Card Status: linha "✓ SolsticeStats — 35+ funções..." + "✓ Aba 📈 Análise..." + "✓ Smart defaults..." + "→ Próximo: Bloco 8"
- [ ] Console: `Object.keys(Solstice.Stats).length` ≥ 41
- [ ] Console: `Solstice.Stats.mean([1,2,3,4,5]) === 3`
- [ ] Console: `Solstice.Stats.median([1,2,3,4,5]) === 3`
- [ ] Console: `Solstice.Stats.linearRegression([[1,1],[2,2],[3,3]]).slope === 1`
- [ ] Console: `Solstice.Stats.linearRegression([[1,1],[2,2],[3,3]]).r2 === 1`
- [ ] Console: `Solstice.Stats.correlation([1,2,3], [1,2,3]) === 1`
- [ ] Console: `Solstice.Stats.correlation([1,2,3], [3,2,1]) === -1`
- [ ] Console: `Solstice.Stats.outliersIQR([1,2,3,4,5,100]).values.includes(100)`
- [ ] Console: `Solstice.Stats.describe([1,2,3,4,5]).n === 5`
- [ ] Console: `Solstice.Stats.trend([1,2,3,4,5,6,7,8,9,10]).direction === 'up'`
- [ ] Console: `Solstice.Stats.kMeans([[0,0],[0,1],[10,10],[10,11]], 2).length === 4`

**Scatter smart default:**
- [ ] Carregar CSV dummy → adicionar Scatter pelo catálogo
- [ ] Toast aparece com "Par com correlação {forte/moderada/fraca} {positiva/negativa} (r=X.XX): Coluna Y × Coluna X"
- [ ] Gráfico aparece COM par diferente de "qt_vendas × data" (qualquer par com r maior)
- [ ] Console: slot.config._smartHint tem `{ r, candidates }`
- [ ] Se dataset com 0 numéricas: empty state "Scatter precisa de 2 colunas numéricas..."

**Gauge smart default:**
- [ ] Adicionar Gauge → min/max não são 0/100 (são P5/P95 da coluna escolhida arredondados)
- [ ] Se há coluna percentage: gauge usa 0-100 com target=80
- [ ] Para dummy de vendas (sem %): gauge usa range realista da 1ª numérica
- [ ] Toast: "Range automático via percentis. Meta sugerida: {texto}."
- [ ] Agulha NÃO fica colada no início (caso bug B6 com receita de R$ 10K-1M em range 0-100)

**Box Plot smart default:**
- [ ] Adicionar Box Plot → aparece JÁ AGRUPADO se há cat com 2-8 distintos (no dummy: por regiao, uf, categoria ou canal)
- [ ] Toast: "Agrupado por 'X' (categórica detectada com 2-8 grupos)."
- [ ] 5+ boxes lado a lado aparecem na primeira renderização
- [ ] Se dataset sem categórica adequada: aparece com 1 box único

**Sankey smart default:**
- [ ] Adicionar Sankey → source e target são CATEGÓRICAS DIFERENTES (no dummy: ex regiao→canal)
- [ ] Toast: "Fluxo: Origem → Destino"
- [ ] Console: slot.config.sourceColumn !== slot.config.targetColumn
- [ ] Para dataset com 1 categórica: empty state "Sankey precisa de 2 categóricas distintas. Seu dataset tem só uma: 'X'..."
- [ ] Para dataset sem categórica: empty state "Sankey precisa de pelo menos 2 colunas categóricas..."

**Aba 📈 Análise:**
- [ ] Adicionar KPI → selecionar → aparece aba "📈 Análise" entre Comparação e Visual
- [ ] Cabeçalho "🔬 Por que esse número?" + "Análise calculada sobre N registros de 'X' (M nulos ignorados)."
- [ ] Seções: 📊 Distribuição central · 📏 Faixa e quartis · 🔍 Forma · ⚠️ Outliers
- [ ] Cada label tem tooltip (hover por 1s) explicando a métrica
- [ ] Valores em monospace + tabular-nums, formatados via Locale
- [ ] Adicionar Time Series → aba Análise mostra "📈 Tendência" extra com direção + R² + forecast 5 valores
- [ ] Adicionar Scatter → aba Análise mostra "🔗 Correlação" com Pearson + Spearman; se |ρ|-|r| > 0.15 mostra nota "💡 ...sugere transformação log/raiz"
- [ ] Adicionar Gauge com target → aba Análise mostra "🎯 Distância da meta" (meta, atual, diferença ±X (Y%))
- [ ] Adicionar Box Plot com groupColumn → aba Análise mostra "📦 Por grupo" (top 6 grupos: nome · med=X · n=Y)
- [ ] Adicionar Markdown → aba "📈 Análise" NÃO aparece (sem coluna numérica)
- [ ] Tabela: aba aparece mas mostra empty state "Configure ao menos uma coluna numérica..."
- [ ] Footer da aba: linha em mono com `Solstice.Stats.describe(Solstice.Store.get('ingest').rows.map(...))` — copiar e colar no console reproduz métricas

**Regressão B1-B6 + patches:**
- [ ] B2: importação de CSV ainda funciona
- [ ] B3: templates aplicam corretamente
- [ ] B4: undo/redo, resize, DnD, free mode
- [ ] B5: KPI/Série/Distribuição/Tabela renderizam normais
- [ ] B5 patches: Comparação no KPI funciona, skip confirm funciona
- [ ] B6: heatmap calendário e markdown sem mudança; helpers shim funcionam transparentemente
- [ ] B6-r1: SVGs responsivos ainda re-renderizam em tier mudo

### Bloco 6 — refinamentos r1

- [ ] Sentinel `[Solstice] Patch B6-r1 aplicado · pronto para sessão nova` aparece verde no console
- [ ] `Solstice.version === '5.3.0-bloco6-r1'`
- [ ] Footer mostra `v5.3 · Bloco 6 r1`
- [ ] Status sidebar tem linha "✓ Consolidação visual (B6-r1)"
- [ ] Slot pequeno (~200px): Sankey mostra mensagem "📏 Sankey precisa de mais espaço..."
- [ ] Slot médio (~350px): Scatter/Box Plot/Gauge ficam compactos (W=360 viewBox)
- [ ] Slot grande (~600px): mesmos aproveitam espaço maior (W=540 viewBox)
- [ ] Redimensionar slot via Bloco 4 → SVG re-renderiza com novo tier após ~150ms
- [ ] Painel Propriedades: tabs com 36px+ altura, radios com 32px+, inputs com altura adequada para toque
- [ ] Labels do props ficam visíveis (não em cinza claro)
- [ ] Aba Dados topo: card "Resumo do dataset" com totalRows em destaque, badge de colunas, lista por grupo (Medidas/Dimensões/...)
- [ ] Hover em grupo → tooltip com lista completa
- [ ] Click em grupo → scroll até editor + toast
- [ ] Grupos vazios não aparecem
- [ ] Trocar tipo de coluna no editor → resumo recalcula reativo
- [ ] Modal Cabeçalho: clicar no backdrop NÃO fecha · selecionar texto no input arrastando fora NÃO fecha · Esc fecha · Cancelar fecha
- [ ] Modal Dicionário (após carregar CSV): backdrop também não fecha + arraste protegido
- [ ] `Modal.confirm` (ex: remover componente) AINDA fecha por click no backdrop (default mantido)
- [ ] Toolbar do canvas em sidebar estreita → botões quebram linha sem cortar
- [ ] KPI com slot estreito → valor grande encolhe com `clamp()` em vez de estourar

### Bloco 6 — checklist mínimo

- [ ] Sentinel `[Solstice] boot OK` verde aparece no console
- [ ] Console: `Solstice.version === '5.3.0-bloco6'`
- [ ] Console: `Solstice.Components.list().length === 10`
- [ ] Footer mostra `v5.3 · Bloco 6`
- [ ] Aba "🧩 Componentes" da sidebar mostra **10 cards** (KPI, Série, Distribuição, Tabela + Scatter, Heatmap Calendário, Gauge, Texto/Markdown, Box Plot, Sankey)
- [ ] Carregar CSV dummy → adicionar **Scatter** pelo catálogo
- [ ] Scatter mostra pontos + linha tracejada de regressão linear + `r²` no canto sup-direito
- [ ] Aba "Dados" do Scatter: `Eixo X`, `Eixo Y`, `Tamanho`, checkbox `Mostrar regressão`, input `Clusters (0-8)`
- [ ] Setar clusters=3 → pontos pintam em 3 cores distintas (azul/rosa/turquesa)
- [ ] Adicionar **Heatmap Calendário** → meses do range aparecem em colunas, células coloridas em 5 níveis (estilo GitHub)
- [ ] Hover em célula → tooltip com data + valor
- [ ] Adicionar **Gauge** com `column=margem_bruta`, `min=0`, `max=100`, `target=70` → arc 180° com zonas verde/amarelo + agulha
- [ ] Adicionar **Texto/Markdown** → renderiza H1, lista, `**bold**`, `*italic*`, `` `code` ``
- [ ] Incluir `{{dataset.name}}` → renderiza "vendas_br_dummy.csv"
- [ ] `{{path.inexistente}}` → mostra placeholder visual `{{path.inexistente}}` em destaque
- [ ] Adicionar **Box Plot** com `valueColumn=receita`, `groupColumn=regiao` → 5 boxes lado a lado com whiskers e outliers vermelhos
- [ ] Adicionar **Sankey** com `sourceColumn=canal`, `targetColumn=regiao` → 2 níveis com Bezier proporcional
- [ ] Hover em link do Sankey → tooltip com source/target/valor
- [ ] Para todos: header da casca mostra título dinâmico via `getTitle` (à esquerda)
- [ ] Para todos: botões 🔬 🔍 ⚙️ 🗑️ aparecem no hover do header
- [ ] Audit registra `add_component` para os 6 novos tipos
- [ ] Aba Comparação só aparece em KPI (não nos componentes B6)
- [ ] Console: `Solstice.Audit.exportMd()` baixa Markdown com as decisões dos componentes B6
- [ ] Regressão B1-B5 + patches: tudo continua funcionando

### Bloco 5 — checklist mínimo

- [ ] Sentinel `[Solstice] boot OK` verde aparece no console
- [ ] Console: `Solstice.version === '5.3.0-bloco5'`
- [ ] Console: `Solstice.Components.list().length === 4`
- [ ] Carregar CSV dummy → aplicar template "KPIs + Tendência"
- [ ] Cada slot mostra "+ Adicionar componente · KPI · Série · Distribuição · Tabela"
- [ ] Click num slot vazio → modal de seleção com 4 opções (com ícones, descrições, busca)
- [ ] Escolher "KPI Card" → slot vira card com valor formatado + sparkline + delta colorido (verde/vermelho/cinza)
- [ ] Card mostra `friendlyName` do dicionário (não nome técnico)
- [ ] Se `higherIsBetter: true` e tendência sobe → delta verde com ▲
- [ ] Hover no card → 3 botões aparecem (🔬 🔍 ⚙️)
- [ ] Click ⚙️ → painel de propriedades aparece na sidebar
- [ ] Painel tem 4 abas: 📊 Dados · 🎨 Visual · 🔍 Decisões · 🔬 Origem
- [ ] Aba Dados mostra select de coluna numérica + agregação
- [ ] Mudar coluna → KPI re-renderiza com novo valor
- [ ] Mudar agregação → re-renderiza
- [ ] Aba Decisões mostra timeline com `add_component`, `select_component`, `update_config`
- [ ] Click 🔬 no card → modal "De onde vem esse número?" com 5 passos
- [ ] Provenance mostra: 📄 Dataset → 🎯 Coluna → 🔍 Filtros → 🧮 Agregação → 📊 Resultado
- [ ] Botão "Ver decisões deste componente" no Provenance abre Audit modal filtrado
- [ ] Adicionar componente "Série Temporal" → escolher xColumn/yColumn no Props → Chart.js renderiza
- [ ] Trocar bin entre day/week/month → re-agrega corretamente
- [ ] Adicionar componente "Distribuição" → histograma SVG aparece
- [ ] Mudar `bins` no Props → re-renderiza histograma
- [ ] Adicionar componente "Tabela" → tabela com heatmap em colunas numéricas
- [ ] Console: `Solstice.Audit.log.length > 0` após interações
- [ ] Console: `Solstice.Audit.exportMd()` baixa arquivo `solstice-audit-*.md`
- [ ] Markdown baixado tem `# Auditoria de Decisões — Solstice` + lista de decisões
- [ ] Ctrl+Z (B4) desfaz adição de componente
- [ ] Remover slot (via swap ou row remove) → Props deselecta automaticamente
- [ ] Regressão B1-B4: tema/paleta/densidade/locale/editor/preview/canvas/undo — tudo funciona

### Bloco 4 — checklist mínimo

- [ ] Sentinel `[Solstice] boot OK` verde aparece no console (sem erros vermelhos)
- [ ] Toolbar do canvas tem 2 botões novos: ↺ (Undo) e ↻ (Redo)
- [ ] Inicialmente ambos `disabled` (canvas vazio)
- [ ] Adicionar seção → Undo fica ativo
- [ ] Ctrl+Z → seção some · toast "↺ Desfeito"
- [ ] Ctrl+Shift+Z → seção volta · toast "↻ Refeito"
- [ ] Adicionar 51 ações → primeiro snapshot é descartado (size cap em 50)
- [ ] Foco num input/contenteditable: Ctrl+Z **não** dispara undo (deixa o input fazer seu próprio undo)
- [ ] Em row com 2+ slots em modo grid: hover na row → linha cinza vertical (handle) aparece entre slots
- [ ] Hover no handle → fica accent + mais grossa
- [ ] Drag no handle → larguras mudam · badge flutuante mostra "60% | 40%" perto do cursor
- [ ] Aproximar do 50%: snap (sente atração) em 25/33/50/67/75%
- [ ] Soltar → row tem widths customizadas · gridTemplateColumns inline aplicado
- [ ] Ctrl+Z desfaz o resize
- [ ] Arrastar 1 slot para outro: cursor "grabbing" · slot origem com opacity 0.4 · slot destino com border accent
- [ ] Soltar em outro slot → **swap**: ambos trocam de posição · toast "🔀 Slots trocados"
- [ ] Funciona entre rows e entre sections diferentes
- [ ] Ctrl+Z desfaz o swap
- [ ] Minimap aparece bottom-right após adicionar 1ª seção
- [ ] Minimap mostra cada section como card com mini-rows + mini-slots
- [ ] Click numa section do minimap → canvas rola até ela (smooth scroll)
- [ ] Botão ▭ no minimap colapsa para 32×32; clicar ▢ expande de volta
- [ ] Limpar canvas → minimap esconde
- [ ] Row-toolbar tem botão 🔀 (Modo Livre)
- [ ] Clicar 🔀 → row vira fundo hachurado, slots ficam `position: absolute` · toast informa sobre smart guides B12
- [ ] Hover slot em modo livre → handle `⋮⋮` aparece no topo
- [ ] Arrastar `⋮⋮` → slot move por toda a row
- [ ] Soltar → posição commitada · Ctrl+Z desfaz
- [ ] Clicar 📐 na row em modo livre → volta ao grid
- [ ] Console: `Solstice.Undo.size()` reflete histórico · `Solstice.version === '5.3.0-bloco4'`
- [ ] Console: `Solstice.Resize.SNAPS` === `[25, 33.33, 50, 66.67, 75]`
- [ ] Animação fade-in suave ao adicionar nova seção (~250ms)
- [ ] Regressão Bloco 1-3: tema, paleta, densidade, locale, editor, modais — tudo funciona

### Bloco 3 — checklist mínimo

- [ ] Página carrega: canvas mostra toolbar (+Seção · 📋Templates) + empty state com 2 CTAs
- [ ] Botão "Carregar CSV dummy" no empty state funciona (passa pelo pipeline) e abre modal de dicionário
- [ ] Após carregar dummy: empty state muda para grid de cards de templates
- [ ] Templates agnósticos (6) sempre presentes
- [ ] Template "Carteira PJ" aparece ao carregar dummy de vendas? NÃO (dummy é de vendas, não banco_pj)
- [ ] Aplicar dicionário "Vendas" → template "Performance Comercial" aparece
- [ ] Clicar card de template → seções/linhas são adicionadas ao canvas
- [ ] Toolbar continua presente após aplicar template
- [ ] Clicar "📋 Templates" → modal de seleção abre (com busca se >8 opções)
- [ ] Clicar "+ Seção" → nova seção "Nova seção" é criada com 1 row 1col
- [ ] Hover em uma section: 5 ações visíveis (↑ ↓ + ⎘ ✕)
- [ ] Clicar no título da seção → vira editável; Enter ou blur salva
- [ ] Mover seção ↑/↓ funciona; primeira seção mostra · no ↑, última mostra · no ↓
- [ ] Hover em uma row: mini-toolbar (📐 ⎘ + ✕) aparece à direita acima
- [ ] Clicar 📐 → modal de seleção de 10 layouts (com busca? não, ≤8 não tem... mas tem 10, então sim)
- [ ] Trocar layout: slots se ajustam (1col → 2col-equal adiciona 1 slot; 4col-equal → 1col mantém 1 e descarta 3)
- [ ] Slots mostram placeholder "+ Componente · disponível no Bloco 5"
- [ ] Remover seção: modal confirm danger (botão vermelho); aceitar remove
- [ ] Remover row: confirm danger; aceitar remove
- [ ] Tentar remover a última row de uma seção → toast "Não posso remover"
- [ ] Botão "👁️ Preview dos dados" (visível só com dataset) abre modal grande com tabela
- [ ] Console: `Solstice.Canvas`, `Solstice.Layouts`, `Solstice.Templates` expostos
- [ ] Console: `Solstice.Templates.getAll().length === 12`
- [ ] Console: `Solstice.Layouts.list().length === 10`
- [ ] Console: `Solstice.version === '5.3.0-bloco3'`
- [ ] Recarregar página: canvas vazio (estado não persiste ainda — Bloco 11 trará snapshots)
- [ ] Trocar tema/paleta/densidade: canvas continua coerente
- [ ] Regressão Bloco 2: clicar 🏷️ em coluna do editor da sidebar ainda abre modal de tipos

### Bloco 2 — refinamentos r2

- [ ] Sidebar Dados → Colunas com 11 colunas: cabem 8+ cards visíveis sem scroll em 1080p
- [ ] Cada card tem padding compacto (~8px 10px), gap mínimo entre cards (~4px)
- [ ] Coluna com 100% preenchido: barra verde cheia, **sem número** ao lado
- [ ] Coluna com 95% preenchido: barra verde + "95%" em cor muted
- [ ] Coluna com 70% preenchido: barra accent/warn + "70%" em cor warn (laranja/amarelo)
- [ ] Coluna com 45% preenchido: barra error + "45%" em cor vermelha + font-weight 600
- [ ] Trocar densidade para `compact` no header → cards encolhem ainda mais (~6px 8px, gap 2px)
- [ ] Trocar densidade para `spacious` → cards crescem ~1.5x
- [ ] Clicar 🏷️ em qualquer coluna → modal abre **com input de busca em foco**
- [ ] Digitar "moeda" → filtra para Moeda (via synonyms)
- [ ] Digitar "cur" → filtra para Moeda também (via desc/value técnico)
- [ ] Digitar "data" → filtra para Data, Data/Hora, Timestamp (todos via synonyms)
- [ ] Trecho buscado aparece destacado com `<mark>` no label
- [ ] Botão ✕ aparece quando há texto; clicar limpa input + restaura todas opções
- [ ] Setas ↑↓ navegam entre opções visíveis com outline accent
- [ ] Enter confirma a opção em foco (não confirma se estiver no input/botão)
- [ ] Digitar termo sem match → "Nenhum item encontrado. Tente outro termo."
- [ ] Clicar ⚡ (8 transformações) → modal **sem busca** (≤ 8 opções)
- [ ] `Solstice.version === '5.3.0-bloco2-r2'`

### Bloco 2 — correções pós-entrega (r1)

- [ ] Carregar CSV dummy → cards do editor mostram **ícone + nome editável + actions** na linha 1
- [ ] Linha 2 do card mostra **tipo em PT-BR** (ex: "Moeda" não "currency") + unidade (se vier do dicionário) + únicos
- [ ] Linha 3 do card mostra **barra de preenchimento horizontal** com cor por faixa (verde / accent / warn / error)
- [ ] Hover na barra mostra tooltip "X de Y preenchidos (Z%)"
- [ ] Clicar 🗑️ abre **modal customizado** (não "Esta página diz:") com botão vermelho "Remover"
- [ ] Esc no modal fecha sem efeito (resolve false)
- [ ] Click no backdrop fecha
- [ ] Clicar 🏷️ abre **modal de seleção** com 32 tipos em PT-BR, ícone, descrição (slug), radio button visual
- [ ] Clicar uma opção destaca borda accent + radio preenchido
- [ ] Confirmar troca tipo + toast "Tipo alterado: X → Moeda"
- [ ] Clicar ⚡ abre modal com 8 transformações em PT-BR
- [ ] Tabela de preview tem **bordas verticais** entre colunas (exceto última)
- [ ] Hover em linha destaca toda linha
- [ ] Header da tabela tem ícone do tipo + nome + label em PT-BR
- [ ] Células numéricas em monospace + tabular-nums (alinhamento à direita)
- [ ] No console: `Solstice.Modal` exposto. `Solstice.Types.label('currency')` → `'Moeda'`
- [ ] `Solstice.version === '5.3.0-bloco2-r1'`
- [ ] Tab/Shift+Tab dentro do modal não escapa (focus trap)
- [ ] Renomear coluna para nome duplicado → toast "Já existe coluna"

### Bloco 2 — checklist mínimo

- [ ] Botão "📁 Importar CSV" abre file picker
- [ ] Importar CSV bem formado → sidebar mostra painel de qualidade (score colorido)
- [ ] Canvas mostra preview de tabela com 50 linhas, colunas com badge de tipo
- [ ] Colunas numéricas têm sparkline SVG inline na sidebar
- [ ] Renomear coluna inline (clique no nome → digita → blur ou Enter) atualiza preview
- [ ] Botão 🗑️ remove coluna (confirma antes)
- [ ] Botão 🏷️ pede tipo via prompt → muda badge + re-formatação
- [ ] Botão ⚡ pede transformação via prompt → aplica (ex: trim, upper)
- [ ] CSV com `;` como separador → detector reconhece
- [ ] CSV inválido (texto puro) → erro `CSV_EMPTY` ou `CSV_DELIMITER_AMBIGUOUS`
- [ ] CSV com coluna de CPFs válidos → tipo `cpf` inferido, formatação `000.000.000-00`
- [ ] CSV com CPFs inválidos (ex: 11111111111) → cells marcadas em vermelho (is-invalid)
- [ ] Dummy de vendas BR (botão original) ainda funciona — passa pelo mesmo pipeline
- [ ] Modal de dicionário abre depois do import (não antes)
- [ ] Status bar atualiza linhas com formatação locale (`1.234`)
- [ ] `Solstice.Types.listTypes().length` === 30 no console
- [ ] `Solstice.BR.isCPF('11144477735')` → true
- [ ] `Solstice.BR.isCPF('11111111111')` → false
- [ ] `Solstice.Quality.compute(Solstice.Store.get('ingest'))` retorna `{score, profile, metrics, flags}`

### Bloco 1 — checklist mínimo

- [ ] Página carrega sem erro no console
- [ ] Toggle dark/light funciona e persiste após reload
- [ ] Trocar paleta entre as 6 funciona sem flash
- [ ] Trocar densidade muda alturas de botões/inputs
- [ ] Trocar idioma re-traduz textos com `data-i18n`
- [ ] Botão "Carregar CSV dummy" popula store + abre modal
- [ ] Modal de dicionário mostra 11 colunas com badges de confiança
- [ ] "Aplicar dicionário" salva no Store e fecha modal
- [ ] Onboarding aparece na primeira visita (limpar localStorage para reproduzir)
- [ ] Botão "?" reabre onboarding
- [ ] Ctrl+Shift+D abre debug overlay
- [ ] Debug overlay STATE mostra `dataset.rows`, `dictionary`, `theme.*`, etc.
- [ ] Debug overlay LOCALE muda valores ao trocar idioma
- [ ] Debug overlay PERF mostra heap (se Chrome)
- [ ] Mobile (viewport 375px): sidebar some, header se adapta
- [ ] localStorage indisponível (modo anônimo): app não trava, usa defaults
