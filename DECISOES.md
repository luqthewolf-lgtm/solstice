# DECISOES — Architectural Decision Records do Solstice

> Cada ADR registra uma decisão arquitetural e a razão. Não delete ADRs ao mudar
> de ideia — adicione um novo que substitui o anterior, mantendo histórico.

---

## ADR-001 — `SolsticeStore` com path-subscription (vs. event bus)

**Status:** Aceito · Bloco 1
**Contexto:** O Solstice precisa de reatividade granular sem framework. Mudar um filtro não pode re-renderizar todo o dashboard. Mudar uma cor não pode disparar recompute de dados.
**Decisão:** Implementar `SolsticeStore.subscribe(path, cb)` onde `path` é uma string ponto-separada (`'dataset.filters'`, `'theme.palette'`). Subscribers em ancestrais (`'dataset'`) também são notificados quando descendentes mudam, mas o oposto não.
**Alternativas consideradas:**
- Event bus genérico (`emit('change', { path, value })`): exige `if` em todos os subscribers para filtrar. Não escala.
- Proxy reativo (Vue-style): complexidade alta, depuração ruim em vanilla.
- Redux com selectors memoizados: overhead conceitual desnecessário para vanilla single-file.
**Consequências:**
- ✅ Componentes só acordam quando o pedaço que ouvem muda
- ✅ Habilita Bloco 5 (auditoria automática via interceptor `set`)
- ✅ Habilita Bloco 9 (cross-filter sem complexidade)
- ⚠️ Renomear um path é breaking change (sem refatoração automática)
- ⚠️ Cuidado com loops: subscriber A que `set('b', ...)` que dispara subscriber B que `set('a', ...)`

---

## ADR-002 — CSS com `@layer` + tokens em 3 camadas

**Status:** Aceito · Bloco 1
**Contexto:** 6 paletas × 2 modos × 3 densidades = 36 combinações de tema. Sem disciplina, vira guerra de especificidade.
**Decisão:** Usar `@layer reset, tokens, theme, components, utilities;` e organizar tokens em 3 camadas:
1. **Primitivos** (`--font-sans`, `--sp-4`, `--rad-md`): nunca mudam por tema
2. **Semânticos** (`--c-bg`, `--c-accent`, `--c-text`): definidos por `[data-palette][data-mode]`
3. **Componentes** (`.solstice__btn`): consomem só os semânticos
**Alternativas consideradas:**
- CSS-in-JS via JS: quebraria single-file (precisaria build) ou inflaria
- Variáveis aninhadas com `:is()`: especificidade imprevisível
- Múltiplos `<style>` por tema, JS troca: re-render flicker
**Consequências:**
- ✅ Trocar tema = re-bind de variáveis no `:root`, **zero JS de re-render**
- ✅ Especificidade controlada por ordem de `@layer`
- ✅ Adicionar 7ª paleta = só adicionar bloco `[data-palette="X"]`
- ⚠️ Browsers muito antigos sem suporte a `@layer` (pré-2022) degradam silenciosamente

---

## ADR-003 — Pipeline de dados imutável com lazy evaluation (planejado, Bloco 2+)

**Status:** Planejado · Bloco 1 deixou stubs
**Contexto:** CSVs do mundo real podem ter 50K-100K linhas. Aplicar `filter().map().reduce()` ingênuo trava UI.
**Decisão:** Implementar `Solstice.Query` (Bloco 2) que compõe operações sem executá-las até `.materialize()`. Memoizar por hash do encadeamento. Operações puras retornam novos handles, não mutam.
**Alternativas:**
- WebWorker: complica state-sharing com UI
- Arquetipo `for` cru otimizado: difícil compor declarativamente
**Consequências futuras:**
- ✅ Suporte a 100K+ linhas com fluidez
- ✅ Cross-filter (Bloco 9) cascateia sem N² recálculos
- ⚠️ Curva de aprendizado para Lucas debugar (logs de Query plan ajudarão)

---

## ADR-004 — Dicionário Semântico como única fonte de "significado"

**Status:** Aceito · Bloco 1
**Contexto:** Para a ferramenta ser agnóstica, ela não pode hardcodar "receita" em lugar nenhum. Mas precisa saber que `vlr_op_aprov_mensal` é dinheiro e maior-é-melhor para gerar insights direcionais.
**Decisão:** Toda informação semântica (friendly name, unit, higherIsBetter, sinônimos, domain) vive em `SolsticeDictionary`. Componentes consomem `Store.get('dictionary.columns.<col>')`. Sem dicionário → fallback genérico (Title Case + heurística).
**Detecção em 3 camadas:**
1. Match exato/parcial em sinônimos dos 6 dicionários pré-feitos
2. Heurística regex de palavras-chave (prefixos `vlr_`, `qt_`, `dt_`, sufixos `_pct`, etc.)
3. Análise estatística (faixa, distribuição) — implementação completa no Bloco 2
**Consequências:**
- ✅ Mesmo CSV em PT ou EN é entendido (sinônimos cobrem ambos)
- ✅ Lucas pode salvar dicionário customizado e aplicar em CSVs similares
- ✅ Insights direcionais (Bloco 8) ficam triviais
- ⚠️ Vocabulário inicial v1 cobre ~70% dos termos comuns; expansão por demanda

---

## ADR-005 — Single-file rigoroso (vanilla + CDN dispensável)

**Status:** Aceito · Bloco 1
**Contexto:** Lucas quer portar features pro Itaú via Eva. Single-file é não-negociável.
**Decisão:**
- LZ-String **inline** (snapshot/export depende dele e não pode quebrar offline)
- Chart.js + PapaParse via CDN, com checagem `if (typeof Chart !== 'undefined')` antes de usar
- Fonts via Google Fonts com fallback `system-ui`
- Zero build, zero npm, zero framework
**Consequências:**
- ✅ Dashboard.html aberto em qualquer browser, qualquer ambiente
- ✅ Portabilidade trivial: copia HTML, cola, funciona
- ⚠️ Sem tree-shaking → arquivo cresce linearmente

---

## ADR-006 — FOUC prevention via script inline no `<head>`

**Status:** Aceito · Bloco 1
**Contexto:** Aplicar tema só depois do CSS carregar = flash visual (Flash of Unstyled Content).
**Decisão:** Script inline minúsculo no `<head>` lê `localStorage` e seta `data-mode`, `data-palette`, `data-density` no `<html>` ANTES de qualquer pintura. Wrapped em try/catch para sobreviver a modo anônimo.
**Consequências:**
- ✅ Zero flash entre temas em recargas
- ✅ Respeita `prefers-color-scheme` na primeira visita
- ⚠️ 15 linhas duplicadas (uma vez no `<head>`, outra em `SolsticeTheme`)

---

## ADR-007 — Naming convention BEM com prefixo `solstice__`

**Status:** Aceito · Bloco 1
**Contexto:** Single-file pode ser embarcado em outras páginas. Estilos não podem vazar.
**Decisão:** Toda classe CSS começa com `solstice__`. Modifiers usam `--` (`solstice__btn--primary`). Estados usam `is-` (`is-active`).
**Consequências:**
- ✅ Zero conflito se embarcado
- ✅ Grep simples (`solstice__`) revela todo escopo
- ⚠️ Classes longas; aceitável vs. risco de colisão

---

## ADR-008 — Locale com Intl.* nativo (não i18n lib)

**Status:** Aceito · Bloco 1
**Contexto:** Strings de UI precisam tradução, mas formatação número/data/moeda é nativa do browser.
**Decisão:** `SolsticeLocale` mantém dict de strings em JS. Para formatação, usa `Intl.NumberFormat`, `Intl.DateTimeFormat` direto. Currency mapeado por locale (`pt-BR → BRL`).
**Consequências:**
- ✅ Zero dependência
- ✅ Formato regional correto (BRL com `R$`, decimal com `,`)
- ⚠️ Adicionar novo locale = adicionar dict + entrada em `CURRENCY`

---

## ADR-009 — Pipeline de ingestão em 5 etapas distintas

**Status:** Aceito · Bloco 2
**Contexto:** Importar CSV envolve: detectar dialeto, parsear, inferir tipos, validar, enriquecer. Misturar tudo num blob (estilo PapaParse cru) torna debug difícil e impossibilita observabilidade por etapa.
**Decisão:** `SolsticeIngest.run(file, { onStep })` chama callbacks `(step, status, info)` a cada transição. Etapas: `detect → parse → infer → validate → enrich`. Cada uma pode ser usada isoladamente.
**Alternativas:**
- Tudo em PapaParse com config: perde validação semântica e detecção de tipos próprios.
- Pipeline funcional puro estilo Rx.js: overkill para 5 passos sequenciais.
**Consequências:**
- ✅ Debug por etapa: se falhar em `infer`, sei que `parse` foi OK
- ✅ Permite reaproveitar etapas no futuro (validar dados já parseados de outra fonte)
- ✅ Editor (Bloco 2) usa `infer`+`validate` quando usuário muda tipo manualmente
- ⚠️ Overhead pequeno de 4-5 closures encadeadas

---

## ADR-010 — Validação BR com algoritmo de DV completo (não só regex)

**Status:** Aceito · Bloco 2
**Contexto:** Detectar formato de CPF/CNPJ via regex é trivial mas falso-positivo enorme: "111.111.111-11" passa regex mas é inválido. Para o Itaú (KYC, compliance), precisamos rigor real.
**Decisão:** `SolsticeBR.isCPF`/`isCNPJ` rodam algoritmo oficial de dígito verificador. Rejeitam sequências iguais. `isCEP` aceita formato + rejeita "00000000".
**Alternativas:**
- Só regex: ~10 LOC, falso-positivo alto
- API externa (ViaCEP, Receita): rompe single-file e adiciona latência
**Consequências:**
- ✅ Tipos `cpf`/`cnpj`/`cep` no `SolsticeTypes` têm `validate` real
- ✅ Erros `INVALID_CPF`/`INVALID_CNPJ` no catálogo Bloco 2
- ✅ Habilita features futuras (mascaramento PII em modo apresentação)
- ⚠️ Algoritmo completo ~80 LOC. Aceitável.

---

## ADR-011 — Score de Qualidade adaptativo por perfil de dataset

**Status:** Aceito · Bloco 2 (executa correção v5.2 #3)
**Contexto:** Para CSV transacional, completude por data é crítica. Para CSV de pesquisa científica, precisão decimal e outliers importam mais. Um único `% nulos = score` é raso.
**Decisão:** `SolsticeDatasetType.classify()` decide o perfil (`transactional`/`categorical`/`timeseries`/`snapshot`/`survey`/`scientific`). `SolsticeQuality.compute()` aplica pesos diferentes para 5 dimensões (completeness/validity/uniqueness/consistency/distribution) conforme o perfil.
**Alternativas:**
- Pesos uniformes: viola contrato Seção 12, dá scores irreais.
- ML para classificar: complexidade desproporcional vs. heurística rule-based.
**Consequências:**
- ✅ Mesmo CSV pode ter scores diferentes dependendo de contexto — narrativa do Bloco 8 será mais precisa
- ✅ Lucas pode "forçar" um perfil se a classificação errar
- ⚠️ 5 dimensões × 6 perfis = 30 pesos hardcoded. Tunável com observação real (deixar como TODO de Bloco 8).

---

## ADR-012 — Proibido `alert/confirm/prompt` nativos · sempre `SolsticeModal.*` (Promise)

**Status:** Aceito · Bloco 2 (correção pós-entrega, demanda Lucas)
**Contexto:** A primeira entrega do Editor (Bloco 2 inicial) usou `confirm()`/`prompt()` nativos como atalho. Isso viola a Seção Crítica 4 (Mensagens de Erro Humanas): aparecem com prefixo "Esta página diz:", quebram tema, sem i18n, sem focus trap, sem aria-modal.
**Decisão:** Diálogos bloqueantes 100% via `SolsticeModal.show/confirm/prompt/select` — todas retornam `Promise`. Funções que disparam diálogo são `async`. Variante `select` usa radio buttons visuais (não `<select>` nativo). Variante `danger` para destrutivos (botão vermelho).
**Implementação:**
- z-index dedicado `--z-modal-prompt: 350` (acima de toast)
- backdrop com `backdrop-filter: blur(8px)` + fade-in 200ms
- modal com scale 0.96→1 em 200ms
- Esc fecha (resolve `defaultClose`); click no backdrop idem
- focus trap (Tab/Shift+Tab ciclam dentro)
- `role="dialog"` `aria-modal="true"`
- foco automático: prefere input, senão primeiro botão
- restaura foco anterior ao fechar
**Consequências:**
- ✅ Modais respeitam tema, locale, design system
- ✅ Testáveis (`await Solstice.Modal.confirm(...)` em testes E2E)
- ✅ Custo único (~150 LOC) reutilizado em todos blocos futuros
- ⚠️ Funções consumidoras precisam ser `async` — propaga viralmente. Aceito.

---

## ADR-013 — Tipos técnicos nunca aparecem crus na UI · sempre `SolsticeTypes.label()` (pt-BR)

**Status:** Aceito · Bloco 2 (correção pós-entrega)
**Contexto:** Editor mostrava badge "measure", "currency", "percentage" — termos técnicos em inglês. Para Lucas (pt-BR nativo) e para o público do dashboard, descontextualizado.
**Decisão:** `SolsticeTypes` agora expõe `label(type)`/`icon(type)`/`group(type)`:
- `label`: pt-BR fixo (32 entradas mapeando `'currency'` → `'Moeda'` etc.)
- `icon`: emoji semântico por tipo
- `group`: simplificação para 4 buckets (`numeric/temporal/categorical/special`) — usado para alinhamento de tabela
Tipo cru (`'measure'`) continua em código interno (`types[col].type`); só vira pt-BR via `label()` quando entra na UI.
**Consequências:**
- ✅ Editor + Preview + Modal de seleção mostram português
- ✅ Slug técnico aparece como `desc` no modal de seleção (para devs que precisarem)
- ✅ Adicionar locale en-US/es-ES: só adicionar `TYPE_LABELS_EN` similar
- ⚠️ Esquecer de usar `label()` em UI nova vira bug recorrente — vale lint custom no futuro

---

## ADR-014 — Sparkline só no Painel de Qualidade (Bloco 7) · Editor usa barra de preenchimento gradiente

**Status:** Aceito · Bloco 2 (correção pós-entrega)
**Contexto:** Sparkline no editor visualizava distribuição de valores numéricos. Mas no contexto do editor — onde Lucas decide *renomear/remover/transformar* coluna — confundia mais que ajudava (parecia gráfico decorativo). Melhor sinal para o editor: "quão preenchida está esta coluna".
**Decisão:**
- Editor: barra de preenchimento SVG horizontal (240×6) com gradiente verde→vermelho conforme % preenchido (≥95% verde, ≥80% accent, ≥60%/40% warn, <40% error). Tooltip nativo `"X de Y preenchidos (Z%)"`. `role="progressbar"` com aria.
- Sparkline: movido para Bloco 7 (módulo `SolsticeStats` + painel de qualidade dedicado). CSS `.solstice__sparkline` permanece, sem caller atualmente.
**Consequências:**
- ✅ Sinal visual do editor casa com decisões que ele suporta
- ✅ Bloco 7 reaproveita sparkline com contexto certo (análise estatística)
- ⚠️ Editor não mostra distribuição — está OK; é função do painel de qualidade

---

## ADR-015 — Header de coluna no Editor em 3 linhas (padrão visual)

**Status:** Aceito · Bloco 2 (correção pós-entrega)
**Contexto:** Estrutura inicial era 2 linhas (nome+actions / meta inline). Pouca hierarquia visual.
**Decisão:** Padrão fixo de 3 linhas verticais para cada card de coluna:
1. **[Ícone do tipo] [Nome editável] [🏷️ ⚡ 🗑️ no hover]**
2. **Tipo (pt-BR) · Unidade (se houver no dicionário) · N únicos**
3. **[Barra de preenchimento gradiente] [%]**
**Consequências:**
- ✅ Densidade controlada, scaneável
- ✅ Unidade vinda do dicionário cria ponte explícita Bloco 1 (dict) × Bloco 2 (tipos)
- ⚠️ Hover é a única forma de descobrir actions — Bloco 12 pode adicionar tour interativo

---

## ADR-016 — Tabelas de preview com bordas verticais + sticky header + hover + tabular-nums

**Status:** Aceito · Bloco 2 (correção pós-entrega)
**Contexto:** Tabela de preview do dataset estava funcional mas visualmente "lisa". Difícil seguir linha em datasets largos.
**Decisão:**
- Borda vertical sutil (`var(--c-border)`) entre colunas, exceto a última
- Header sticky com `position: sticky; top: 0` (já estava)
- Hover destaca linha inteira com `var(--c-surface-2)`
- Células numéricas: `font-variant-numeric: tabular-nums` + `font-family: var(--font-mono)` para alinhar dígitos
- Classes aplicadas via `SolsticeTypes.group()`: `is-num` para numeric, `is-text` para o resto
**Consequências:**
- ✅ Tabela legível com 10+ colunas
- ✅ Alinhamento numérico pixel-perfect
- ⚠️ Monospace pode parecer "técnico demais" — aceitar por enquanto, polish Bloco 12

---

## ADR-017 — `SolsticeModal.select` com busca textual quando há > 8 opções

**Status:** Aceito · Bloco 2 (r2)
**Contexto:** Modal de troca de tipo (32 opções) inutilizável sem busca: precisa scroll. Lucas pediu busca textual integrada.
**Decisão:** Parâmetro `searchable` no `select`:
- `'auto'` (default) → mostra busca se `options.length > 8`
- `true` → sempre mostra
- `false` → nunca mostra
Busca em haystack normalizado: `label + value + desc + synonyms` (NFD, lowercase, sem acentos). Match parcial e case-insensitive. Debounce 100ms. Highlight via `<mark>`. Empty state. Navegação por ↑↓; Enter confirma; Esc fecha. Auto-focus no input ao abrir.
**Sinônimos** opcionais por opção — o caller pode enriquecer (`o.synonyms: [...]`). No menu de tipos, dicionário `TYPE_SYNONYMS` em pt-BR cobre cada tipo com 4-6 termos comuns.
**Consequências:**
- ✅ "moeda" acha currency, "data" acha temporal/date_only, "número" acha measure/integer/decimal
- ✅ Modal não polui com search bar quando há poucas opções (<8)
- ✅ Mesma API serve menu de transformações (8 → fica abaixo do threshold = sem busca)
- ⚠️ Sinônimos hardcoded em pt-BR — para localização, mover para `Locale.t('synonyms.<type>')`

---

## ADR-018 — Densidade global controla cards do editor (`--ed-*` tokens)

**Status:** Aceito · Bloco 2 (r2)
**Contexto:** Cards do editor padrão estavam altos demais. Para CSV com 11 colunas, scroll excessivo. Solução genérica: respeitar o toggle global de densidade já existente (`data-density="compact|comfortable|spacious"`).
**Decisão:** Tokens dedicados `--ed-pad-y` / `--ed-pad-x` / `--ed-gap` / `--ed-row2-mt` / `--ed-fill-mt` / `--ed-info-size` / `--ed-action-size`, definidos por densidade no `:root[data-density="X"]`. Comfortable (default) caber 8+ cards em 1080p. Compact ainda mais. Spacious ~1.5x.
**Consequências:**
- ✅ Switch global afeta editor imediatamente, sem JS
- ✅ Adicionar novo bloco/feature que precise de densidade variável é só consumir as vars
- ✅ Botões de ação proporcionais (14px / 16px / 20px)
- ⚠️ Renderização re-flow quando troca densidade, mas sem custo notável

---

## ADR-019 — Indicador de preenchimento: ocultar % quando = 100 + slot fixo de 32px

**Status:** Aceito · Bloco 2 (r2)
**Contexto:** Número estava cortando (aparecia "10" no lugar de "100%") por falta de largura reservada. Lucas pediu: 100% não mostra número (barra cheia verde comunica), < 100% mostra completo, slot reservado.
**Decisão:**
- `.solstice__editor-col-fillpct` com `width: 32px; flex-shrink: 0; text-align: right;`
- Quando 100% → adicionar classe `--hidden` (`visibility: hidden`) — slot reservado para alinhamento
- Cor por faixa: ≥80% muted, 60-79% warn, <60% error
- `font-weight: 600` para destacar variação cromática
**Consequências:**
- ✅ Texto nunca corta
- ✅ Cards alinham horizontalmente (todos têm a mesma "largura de gauge")
- ✅ Cores comunicam severidade antes do número ser lido
- ⚠️ Visibilidade no daltonismo: as cores warn/error têm contraste alto, mas verificar com testes WCAG no Bloco 12

---

## ADR-020 — Hierarquia `Section → Row → Slot` persistida em `Store.canvas.sections`

**Status:** Aceito · Bloco 3
**Contexto:** Dashboard precisa de estrutura visual hierárquica (agrupamentos, divisões horizontais, componentes individuais). Persistir em estrutura tipada permite Undo/Redo (B4), Snapshots (B11), import/export (B11) sem código adicional.
**Decisão:** Estado serializável em `Store.canvas.sections = [{ id, title, rows: [{ id, layout, slots: [{ id, type, ... }] }] }]`. IDs via `Utils.uuid()`. Render é função pura `state → DOM`. Toda mutação passa por API do módulo (`addSection`, `removeRow`, `applyTemplate`, etc.) — nunca mutação direta no Store.
**Consequências:**
- ✅ Tudo trivialmente serializável (JSON.stringify)
- ✅ Render reativo via `Store.subscribe('canvas.sections')`
- ✅ Snapshots futuros (B11) = clone do estado
- ✅ Undo/Redo (B4) = ring buffer de estados anteriores
- ⚠️ Re-render completo a cada mudança — para datasets de 100+ sections, considerar diffing por id no Bloco 12

---

## ADR-021 — Layouts via CSS Grid templates por atributo `data-layout`

**Status:** Aceito · Bloco 3
**Contexto:** 10 layouts (1col, 2col-equal, hero-bottom, etc.). Trocar layout devia ser instantâneo, sem re-render de slots.
**Decisão:** Cada layout é uma classe CSS no `.solstice__row[data-layout="X"]`. Trocar o atributo `data-layout` → CSS aplica `grid-template-columns` diferente. JS só ajusta a quantidade de slots (`SolsticeLayouts.reslot`) — preserva slots existentes, adiciona/remove só o excedente.
**Alternativas:** inline `style.gridTemplateColumns` (verboso, sem cache CSS); JS calcular grid dinamicamente (rejeitado — perde simplicidade do CSS grid).
**Consequências:**
- ✅ Trocar layout = 1 setAttribute, zero JS de re-render
- ✅ Adicionar 11º layout = adicionar bloco CSS + entrada no objeto LAYOUTS
- ✅ `hero-bottom` usa `grid-template-areas` para o primeiro slot ocupar a primeira linha inteira
- ⚠️ Slots descartados ao reduzir layout perdem conteúdo. Confirmação modal vai no Bloco 4 quando Undo existir.

---

## ADR-022 — Templates como receitas serializáveis + filtragem por dicionário detectado

**Status:** Aceito · Bloco 3
**Contexto:** 6 templates agnósticos (KPIs+Tendência, Composição, etc.) + 6 de domínio (Banco PJ, RH, etc.). Templates de domínio só fazem sentido se o CSV bate com aquele perfil.
**Decisão:** Template = `{ id, name, icon, description, domain, domainLabel, build: () => [sections] }`. `build()` retorna estrutura sem IDs (gerados ao aplicar). `SolsticeTemplates.list()` filtra: agnósticos sempre presentes + domínio só se `Store.ingest.dictDetection.dictKey === template.domain`. `openPicker()` abre modal de seleção com busca textual (reusa `Modal.select` searchable).
**Consequências:**
- ✅ Carregando CSV de banco PJ → "Carteira PJ" aparece no picker e no empty state
- ✅ Carregando CSV de vendas → "Performance Comercial" aparece, "Carteira PJ" não
- ✅ Adicionar novo template = adicionar entrada no array AGNOSTIC ou DOMAIN
- ✅ Templates são puro JSON após `build()` — serializáveis para snapshot
- ⚠️ Dicionário "genérico" (fallback) não casa com nenhum domain → só agnósticos disponíveis. Aceitável.

---

## ADR-023 — Canvas é root visual único · preview de tabela virou modal

**Status:** Aceito · Bloco 3
**Contexto:** No Bloco 2, `Editor.renderPreview` escrevia tabela direto em `.solstice__canvas`. No Bloco 3, o Canvas pertence ao `SolsticeCanvas` (sections/rows). Conflito: ambos limpariam o canvas.
**Decisão:** Canvas pertence 100% ao `SolsticeCanvas`. Tabela de preview do dataset agora abre em `SolsticeModal.show({ size:'lg' })` via botão `👁️ Preview dos dados` na toolbar (visível só com dataset carregado). `Editor.renderPreview()` mantida como API mas internamente popula apenas se modal aberto.
**Consequências:**
- ✅ Sem conflito entre módulos pelo `<main class="solstice__canvas">`
- ✅ Preview do dataset segue acessível, em contexto modal mais focado
- ✅ HTML estático do empty state removido — Canvas renderiza tudo (empty state condicional inclui CTAs dummy/import quando sem dataset)
- ⚠️ Modal preview não atualiza em tempo real ao editar coluna (precisa reabrir). Trade-off aceitável; live-preview pode vir no B12.

---

## ADR-024 — Sentinel `[Solstice] boot OK` no fim de `boot()` para detectar boots silenciosamente interrompidos

**Status:** Aceito · patch pós-Bloco 3
**Contexto:** No Bloco 3, refactor da ingestão deixou código órfão dentro de `boot()` que disparava `ReferenceError` em runtime — abortando o boot e quebrando paleta, tema, densidade, dummy, help, debug, canvas. JS não levantou erro de sintaxe (chaves casavam por acidente); o erro só aparecia quando o código órfão executava no carregamento. Ver BUGS.md #001.
**Decisão:** Última linha de `boot()` é:
```js
console.log('%c[Solstice] boot OK','color:#4ADE80;font-weight:bold;');
```
**Procedimento obrigatório após qualquer refactor que toque `boot()` ou módulos chamados nele:**
1. Recarregar `dashboard.html`
2. Abrir DevTools (F12) → Console
3. Confirmar a presença da linha verde `[Solstice] boot OK`
4. Se faltar: há erro silencioso interrompendo o boot. Investigar imediatamente, NÃO seguir para próximos blocos.

**Consequências:**
- ✅ Custo zero, detecção imediata
- ✅ Falsos negativos impossíveis (se aparece, o boot rodou inteiro)
- ⚠️ Falsos positivos: se um listener bind silenciosamente falha mas não joga erro, sentinel passa mesmo assim. Cobertura parcial, mas pega 99% dos casos relevantes.

**Boas práticas relacionadas (gerais para refactor grande):**
- Após extrair função de um escopo para outro, **buscar pelo nome antigo** (`Grep`) para confirmar zero referências dangling.
- Após remover blocos de código, **ler 10 linhas antes e depois** para confirmar que chaves balanceiam.
- Tratamos `console.error` como sinal de fluxo — checar antes de afirmar "tudo funciona".

---

## ADR-025 — Undo/Redo via `Store.subscribe` + ring buffer JSON.stringify

**Status:** Aceito · Bloco 4
**Contexto:** Undo/Redo precisa ser robusto, desacoplado e capturar TODA mudança em `canvas.sections` — incluindo mudanças vindas de Resize, DnD, FreeMode, templates aplicados, edição de título inline, etc.
**Decisão:**
- Ring buffer de **50 snapshots** (JSON.stringify completo de `canvas.sections`).
- Captura via `Store.subscribe('canvas.sections', _capture)` — não por hook explícito em cada operação. Qualquer caminho que mute o estado é gravado.
- Flag `suppress` evita loop durante o próprio undo/redo.
- Ao fazer mudança nova após `undo`, descarta o "redo pendente" (comportamento padrão de editores).
- Atalhos: Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo). Ignora quando foco está em `input/textarea/contenteditable`.
**Alternativas:**
- Diff incremental (Operational Transform): poderoso mas complexo. JSON.stringify para 50 estados × ~10KB = ~500KB. Aceitável.
- Hook explícito em cada Canvas operation: viola DRY, esquece-se de um.
**Consequências:**
- ✅ Cobertura 100% de qualquer mudança que passe pelo Store
- ✅ Implementação trivial (~80 LOC)
- ⚠️ Memória O(N × tamanho_do_estado). Para dashboards monumentais (1000+ slots), reconsiderar diff.
- ⚠️ Snapshots não capturam estado fora de `canvas.sections` (ex: dataset não entra no Undo). Aceitável por enquanto — undo aqui é "do layout", não "dos dados".

---

## ADR-026 — Resize aplica `gridTemplateColumns` inline · layout vira "custom"

**Status:** Aceito · Bloco 4
**Contexto:** Resize muda larguras relativas entre slots. Mas o layout original (ex: `2col-equal`, `3col-1-2-1`) é CSS-bound — não tem como sobrescrever sem inline.
**Decisão:**
- Cada `row` pode ter `widths: [60, 40]` (array de %).
- Quando `widths` existe e tem o mesmo tamanho que `slots`, `_renderRow` aplica `style.gridTemplateColumns = "60fr 40fr"`.
- No commit do resize, marca também `row.layout = 'custom'` — sinaliza que CSS-bound não vale mais.
- Magic snap em 25 / 33.33 / 50 / 66.67 / 75% com tolerância de 2.5%.
- Mínimo 5% por slot (evita slot colapsar).
**Consequências:**
- ✅ Resize natural sem inventar nova arquitetura
- ✅ Troca de layout pelo picker → reseta `widths = undefined` (volta ao CSS)
- ✅ Snapshot do Undo captura `widths` no JSON
- ⚠️ Magic snap pode "lutar" com usuário querendo 47% específico. Aceitar; B12 pode adicionar `Alt` para desabilitar snap.

---

## ADR-027 — DnD = swap entre slots (não inserção/reordenação no B4)

**Status:** Aceito · Bloco 4
**Contexto:** Drag-and-drop completo (mover slot pra antes/depois de outro, reordenar dentro da mesma row, mover entre rows) é caro de implementar bem. O ganho marginal vs swap simples não justifica no B4.
**Decisão:** No B4, drop em outro slot **troca posições** (swap). Funciona entre rows, entre sections, dentro da mesma row. Não suporta "soltar entre A e B".
**Consequências:**
- ✅ ~100 LOC vs ~400 para drag completo
- ✅ Suficiente para reorganizar dashboard
- ⚠️ Para inserção entre slots, B12 (polish) adicionará drop zones intermediárias

---

## ADR-028 — Minimap como DIV puro · interação só por click

**Status:** Aceito · Bloco 4
**Contexto:** Minimap pode virar componente pesado (zoom, pan, drag-to-pan, miniatura real do conteúdo). No B4, prioridade é navegação rápida em canvas com muitas sections.
**Decisão:** DIV `position: fixed` bottom-right. Cada section vira card com mini-rows de slots (proporcionais). Click rola canvas até a section via `scrollIntoView`. Botão de colapsar (📦 32×32). Esconde quando `sections.length === 0`.
**Consequências:**
- ✅ ~120 LOC, zero deps
- ✅ Re-render reativo via `subscribe('canvas.sections')`
- ⚠️ Mobile: minimap ocuparia tela inteira. CSS futuro vai escondê-lo em <768px (TODO B12 polish)
- ⚠️ Não mostra conteúdo real dos slots — só layout proporcional. B5 pode adicionar mini-preview por componente.

---

## ADR-029 — Modo Livre por row · smart guides adiadas para Bloco 12

**Status:** Aceito · Bloco 4
**Contexto:** Contrato pede "Modo Livre (position absolute)" + "Smart guides + distribuição automática". Implementar smart guides bem (snap em centro / bordas / igual distância entre 3+ elementos) é caro e adiciona valor incremental ao drag livre. O foco do B4 é entregar 5 capacidades de boa qualidade.
**Decisão:**
- Modo Livre **por row** (granularidade certa — algumas rows em grid, uma em livre).
- Toggle `🔀` na row-toolbar inverte `row.mode = 'grid' ⇄ 'free'`.
- Em modo livre: slots ganham `{x, y, w, h}` (x e w em %, y e h em px), drag via Pointer Events no handle `⋮⋮`.
- Posições iniciais distribuídas em até 3 colunas; usuário ajusta.
- **Smart guides**: stub. Drag funcional, mas linhas vermelhas de alinhamento e snap em centro/bordas vão para o Bloco 12.
**Consequências:**
- ✅ Contrato cumprido (Modo Livre existe e funciona)
- ✅ Token budget respeitado
- ⚠️ UX de modo livre menos refinada que modo grid — explicitamente comunicado via toast "Smart guides chegam no Bloco 12"
- ⚠️ Resize handles ainda não funcionam em modo livre (B12)

---

## ADR-030 — Auditoria como ring buffer de 500 entradas com export para Markdown

**Status:** Aceito · Bloco 5 (executa Diferencial #1)
**Contexto:** Auditoria de Decisões é o Diferencial #1 do contrato. Para o Itaú (compliance), cada escolha visual e analítica precisa ser rastreável: quem mudou o quê, quando, e baseado em qual estado.
**Decisão:**
- Estrutura: `{ ts, action, target, componentId, details }`.
- Ring buffer de 500 entradas em memória.
- `Audit.record(entry)` chamado por: `Props.update_config`, `Components.add_component`, `Components.select_component`. Cada componente pode chamar diretamente para registrar suas próprias decisões.
- Modal global com timeline + filtros por `componentId` + export Markdown.
- Provenance Trail (Inovação #2) acessível via `Audit.openProvenance(componentId)` — mostra cadeia `Dataset → Coluna → Filtros → Agregação → Resultado` visualmente.
**Alternativas:**
- Persistência em localStorage / IndexedDB: futuro (B11 snapshots já levará junto).
- OpenTelemetry-like distributed trace: overkill para single-file.
**Consequências:**
- ✅ Compliance natural: export do Audit serve como evidência
- ✅ Modal filtrado por componente facilita debug ("por que esse KPI mostra esse valor?")
- ✅ Markdown standalone facilita compartilhamento (anexar a ticket, e-mail)
- ⚠️ Audit não persiste entre reloads no B5 (B11 incluirá no snapshot)
- ⚠️ Cap de 500 entries pode ser pequeno para sessão longa — configurar threshold no B12

---

## ADR-031 — Componentes como registry plugável (`register(def)`)

**Status:** Aceito · Bloco 5
**Contexto:** 4 componentes no B5, mais 4 avançados no B6, mais customizados que Lucas (ou Eva) podem querer adicionar. Hardcode = não escala.
**Decisão:**
- `SolsticeComponents.register({ id, name, icon, defaultConfig(ctx), render(slot, host, ctx) })`.
- `Components.render(slot, host)` é a fachada: cria casca `.solstice__comp` com header (título + 🔬 🔍 ⚙️) e delega corpo para `def.render(slot, body, ctx)`.
- `defaultConfig(ctx)` recebe contexto (rows/columns/types/dictionary) e devolve config inicial inteligente (ex: KPI escolhe a primeira coluna numérica).
- 4 componentes B5 já registrados na carga; B6+ chamará `register()` no fim de cada módulo.
**Consequências:**
- ✅ Bloco 6 adiciona Scatter/Heatmap/Gauge/Markdown sem tocar no core
- ✅ Plugins customizados do Itaú podem ser carregados via `register()` em snippet HTML adicional
- ✅ Erros isolados: `try/catch` no `render` mostra mensagem inline e não derruba canvas
- ⚠️ Sem versionamento de componente — se mudar shape de `slot.config`, snapshots antigos quebram. B11 vai precisar migration.

---

## ADR-032 — Painel de Propriedades substitui editor de colunas na sidebar quando slot é selecionado

**Status:** Aceito · Bloco 5
**Contexto:** Sidebar tem espaço limitado. Quando usuário tem um componente selecionado, ele quer configurar aquele componente — não ver as colunas do dataset.
**Decisão:**
- Sidebar tem dois painéis: `#editor-panel` (B2) e `#props-panel` (B5).
- `Props.select(slotId)` mostra `#props-panel` (hide via classe `solstice__hidden`); `deselect()` esconde.
- Slot selecionado tem `.is-selected` (border accent + glow); subscribe a `canvas.sections` re-renderiza painel automaticamente.
- 4 abas no B5 (Dados/Visual/Decisões/Provenance); 2 extras (Filtros/Avançado) ficam para B9/B12 quando filtros e configurações finas existirem.
**Consequências:**
- ✅ Contexto sempre claro: editor de colunas para preparar dado, Props para configurar visualização
- ✅ Layout da sidebar continua estável; toggle invisível para o usuário
- ⚠️ Em telas pequenas (~1280px), sidebar pode ficar densa. B12 polish vai considerar reordenação ou abas globais.

---

## ADR-033 — Provenance Trail (Inovação Própria #2) como modal acessível por 🔬

**Status:** Aceito · Bloco 5
**Contexto:** Inovação Própria #2 prometida no handshake. Lucas pede "🔬 De onde vem esse número?" em cada KPI.
**Decisão:**
- Cada componente renderiza um botão `🔬` no header (`.solstice__comp-actions`).
- `Audit.openProvenance(slotId)` abre modal lg com cadeia de 5 passos:
  1. 📄 Dataset (nome + total de linhas)
  2. 🎯 Coluna escolhida (técnica + friendlyName)
  3. 🔍 Filtros aplicados (no B5: "nenhum (filtros chegam no Bloco 9)")
  4. 🧮 Agregação (operação + nº de valores válidos)
  5. 📊 Resultado (valor formatado)
- Cada passo tem ícone + label + valor; setas conectam visualmente.
- Botão "Ver decisões deste componente" no footer atalha para `Audit.openModal({componentId})`.
**Consequências:**
- ✅ Resposta direta à pergunta clássica do analista: "como esse número foi calculado?"
- ✅ Reusável: B9 vai popular o passo "Filtros aplicados"; B7 vai detalhar a agregação estatística
- ✅ Cumpre uma das 5 inovações próprias prometidas
- ⚠️ Cadeia é estática (hardcoded 5 passos). Para 6+ passos (joins, transformações em série), B12 fará versão configurável.

---

## ADR-034 — Componentes têm botão próprio de remoção (volta slot ao vazio)

**Status:** Aceito · Patch B5-r1
**Contexto:** Bloco 5 inicial entregou 3 botões no header de cada componente (🔬 🔍 ⚙️) mas omitiu o **botão de remover**. Único caminho para remover era via DnD/Resize indireto. Lucas reportou no patch crítico pós-B5.
**Decisão:** 4º botão 🗑️ no `.solstice__comp-actions` (classe extra `--danger` que pinta vermelho no hover). Onclick abre `SolsticeModal.confirm({danger: true})`. Confirmado: percorre `Store.canvas.sections` e substitui o slot por `{ id: s.id, type: 'empty' }` (preserva o id; slot continua existindo, apenas perde tipo/config). Audit registra `remove_component` com `details.type`. Toast informa. Props.deselect se estava selecionado.
**Consequências:**
- ✅ Operação destrutiva acessível e confirmada via modal customizado (não nativo)
- ✅ Slot preservado: layout não muda; vazio fica disponível para outro componente
- ✅ Audit/Undo capturam: Ctrl+Z restaura componente removido
- ⚠️ Não "remove o slot" — para isso, usar resize/troca de layout do Bloco 4

---

## ADR-035 — Sidebar com aba dedicada "🧩 Componentes" + listagem do canvas

**Status:** Aceito · Patch B5-r1
**Contexto:** Tab "Componentes" estava `disabled` mesmo após Bloco 5 entregar registry. Usuário não tinha visão geral de "quais componentes existem no meu canvas e onde".
**Decisão:** Novo módulo `SolsticeSidebarTabs` alterna entre dois painéis na sidebar:
- **Dados** (default): painel do Editor de colunas + card de qualidade (B2)
- **Componentes**: lista todos os componentes do canvas com ícone, nome, localização ("S1 · L2 · slot 3"), e botão remover inline
Click no item da lista → `Props.select(slotId)` + `scrollIntoView` no componente real no canvas. Re-render reativo via `subscribe('canvas.sections')` + `subscribe('ui.selectedSlot')`.
**Consequências:**
- ✅ Navegação rápida em canvas com 10+ componentes
- ✅ Remoção em massa fácil (lista + botão remover)
- ✅ Estado consistente com `Props` (item highlighta quando selecionado)
- ⚠️ Mobile: tab fica embaixo da tab Dados; aceitar (sidebar some em <768px de qualquer forma)

---

## ADR-036 — Footer e status leem versão dinamicamente de `Solstice.version`

**Status:** Aceito · Patch B5-r1
**Contexto:** Footer ficou congelado em "Bloco 1" por 4 blocos sem que eu percebesse. Card "Status do bloco" idem. Edição manual em cada bloco esquece-se de um deles.
**Decisão:** No final do `boot()`, IIFE lê `window.Solstice.version`, faz regex `bloco(\d+)(?:-(r\d+))?` e popula `#app-version` (footer) com `"v5.3 · Bloco N r1"` etc. Card de status fica explícito por bloco (atualizar manualmente é parte do ritual do bloco, mas o footer é à prova de erro).
**Procedimento associado:** ao fechar qualquer bloco, conferir os 4 pontos de versão no HTML:
1. Banner topo (manual)
2. Card Status do bloco (manual)
3. Footer (`#app-version`) — automático via Solstice.version
4. Console sentinel `[Solstice] boot OK — Bloco N` (manual no console.log final)
**Consequências:**
- ✅ Footer impossível de dessincronizar
- ✅ Tarefas restantes (banner + status + console) são explícitas no checklist
- ⚠️ Se Lucas tiver versão "patch z" (5.3.0-bloco5-r2), regex precisa estar atualizado

---

## ADR-037 — META: Protocolo "UM bloco por resposta" restabelecido após violação

**Status:** Aceito · Patch B5-r1 (correção meta)
**Contexto:** Entreguei Blocos 1-5 numa sequência rápida (uma resposta por bloco, mas dentro de uma única "sessão de trabalho" do Lucas) sem pausar para validar coerência entre eles. Resultado: bugs de UI desatualizada (status sidebar, footer, tab disabled) e funcionalidades faltantes (botão remover componente) acumularam até o B5. Lucas precisou diagnosticar manualmente.
**Decisão (RITUAL OBRIGATÓRIO PARA CADA BLOCO):**

1. 📋 **PLANO + TRADE-OFFS + ESTIMATIVA** antes de codar
2. Implementação cirúrgica (Edits, não rewrites)
3. **6 arquivos meta atualizados antes da marca FIM:**
   - PROGRESSO.md (versão + status acumulado + roadmap)
   - DECISOES.md (ADRs novos com Why/How)
   - API.md (funções e paths novos)
   - BUGS.md (checklist do bloco)
   - changelog/bloco-N.md (detalhamento)
   - portabilidade/bloco-N.md (features Eva)
4. **4 pontos de versão no HTML:**
   - Banner topo `BLOCO N · ...`
   - Card "Status do bloco" na sidebar
   - Footer `#app-version` (lido de `Solstice.version`)
   - Console banner `BLOCO N` + sentinel `boot OK`
5. 🧪 **COMO TESTAR + 🐛 LIMITAÇÕES + ▶ PRÓXIMO BLOCO**
6. Marca literal `═══ FIM DO BLOCO N ═══`
7. **AGUARDAR** `AVANÇAR BLOCO N+1` antes de seguir

**Funcionalidades destrutivas** (remover, deletar) devem estar **completas no mesmo bloco** que introduz a feature criável.

**Tabs/botões disabled** introduzidos como "B5" placeholder devem ser **ativados ou removidos** no bloco correspondente.

**Consequências:**
- ✅ Cada bloco é uma entrega completa, testável, validada
- ✅ Lucas pode interromper sequência sem deixar estado inconsistente
- ✅ Estados inconsistentes são visíveis e corrigíveis cedo
- ⚠️ Resposta de fechamento de bloco fica mais longa (3-5K tokens extras de meta) — aceitar

---

## ADR-038 — Aba "Componentes" é catálogo dinâmico (lê de `Components.list()`)

**Status:** Aceito · Patch B5-r2
**Contexto:** Patch r1 entregou a aba listando os componentes JÁ CRIADOS no canvas. Lucas testou e pediu o oposto: a aba deveria ser um **catálogo** dos componentes DISPONÍVEIS para adicionar. A lista do canvas faz mais sentido como busca dentro do canvas/minimap.
**Decisão:**
- `SolsticeSidebarTabs._renderComponentsPanel` renderiza grid 2×N de cards de catálogo, um por tipo retornado por `Components.list()`.
- Cada card: ícone grande centralizado, nome, descrição curta (1 linha), botão "+ Adicionar".
- Click no card chama `Components.addByType(typeId)` que (1) procura primeiro slot vazio em `canvas.sections` e ocupa, OU (2) cria nova seção com 1 row 1col se não houver vazio.
- Após inserção: `scrollIntoView` no componente recém-criado + `Props.select` automático + toast.
- Estado `dataset.ready === false`: cards com `is-disabled` (opacity 0.4, pointer-events none, tooltip "Importe um CSV primeiro"). Re-render reativo via `subscribe('dataset.ready')`.
- 4 descrições pt-BR adicionadas como campo `description` em cada `Components.register()`. Bloco 6 estende automaticamente (4 → 8 cards no catálogo).
**Consequências:**
- ✅ Catálogo cresce sozinho conforme novos componentes são registrados (B6+)
- ✅ Fluxo de "criar componente" agora tem 2 caminhos: click em slot vazio (picker modal) OU click no catálogo (auto-insert)
- ✅ A informação "onde estão meus componentes" agora é o minimap (B4) — papel certo
- ⚠️ Em sidebar com largura < 320px, grid colapsa para 1 coluna (CSS media query)

---

## ADR-039 — Toda saída textual destinada ao usuário passa por `SolsticeHumanize`

**Status:** Aceito · Patch B5-r2
**Contexto:** Antes do patch, componentes mostravam strings técnicas como `n=200`, `últimos 88 pontos`, `sum`, `count` cruamente na UI. Lucas pediu humanização sistemática.
**Decisão:** Módulo `SolsticeHumanize` centraliza conversão de termos técnicos em texto humano pt-BR. **Regra:** strings técnicas em JS (lógica, chaves, identificadores); strings humanas na UI (sempre via `Humanize.*`).

API:
- `aggregation(op)` — `'sum'` → `'Soma'`, `'count'` → `'Quantidade'`, etc. (8 ops cobertas)
- `delta(pct, higherIsBetter)` — retorna `{ text, color }` com texto narrativo + chave semântica de cor (`success` / `error` / `muted`)
- `recordCount(n)` — pluralização inteligente: `'1 registro'`, `'200 registros'`, `'1.500 registros'`, `'1 milhão de registros'`
- `timeRange(ms)` — `'30 dias'`, `'3 meses'`, `'1,5 anos'`
- `column(name, dict)` — friendlyName do dicionário, senão Title Case do snake_case

**Aplicação imediata:**
- KPI Card refatorado: usa `aggregation`, `delta`, `recordCount`, `column`
- Distribuição: trocou `"bins · n=N"` por `"faixas · N registros"`
- Próximos blocos (B6+) consomem Humanize ao registrar novos componentes

**Consequências:**
- ✅ Saída textual consistente em todo produto
- ✅ Localização futura (en-US, es-ES) ficará num lugar só
- ✅ Eva pode portar Humanize isolado e ter narrativa coerente em outros projetos Itaú
- ⚠️ Esquecer-se de usar Humanize em UI nova vira regressão silenciosa — vale lint regex em revisão (`n=` ou números crus em template strings)

---

## ADR-040 — Abas "Dados" e "Componentes" são totalmente isoladas (sem mistura visual)

**Status:** Aceito · Patch B5-r3
**Contexto:** Patch r1 entregou as duas abas, mas o `#props-panel` aparecia em ambas porque a lógica de visibilidade era independente. Lucas reportou confusão visual ao usar.
**Decisão:** `SolsticeSidebarTabs.activate(which)` controla os 3 painéis (`#data-panel`, `#components-panel`, `#props-panel`) explicitamente. Regras:
- `'dados'`: `#data-panel` visível (se `dataset.ready`), os outros 2 ocultos
- `'componentes'`: `#data-panel` oculto, `#components-panel` sempre visível, `#props-panel` visível só se `ui.selectedSlot` definido
Aba ativa persiste em `Store.ui.activeTab` (recuperável após reload no B11).
**Consequências:**
- ✅ Mental model claro: cada aba é um contexto distinto
- ✅ `Props.select` força aba certa (ADR-041) — sem efeito colateral confuso
- ⚠️ Se aba é trocada manualmente com props selecionado, propriedades somem visualmente mas seleção persiste no Store

---

## ADR-041 — Seleção de componente força aba "Componentes" automaticamente

**Status:** Aceito · Patch B5-r3
**Contexto:** Sem auto-switch, clicar componente no canvas não dava feedback se usuário estivesse na aba Dados — props aparecia "no escuro".
**Decisão:** `SolsticeProps.select(slotId)` chama `SolsticeSidebarTabs.activate('componentes')` antes de renderizar o painel. Deseleção (`deselect`) não força troca de volta — usuário mantém aba escolhida.
**Consequências:**
- ✅ Feedback visual imediato ao clicar componente
- ✅ Fluxo "editor de colunas" (aba Dados) e "configurar KPI" (aba Componentes) ficam claros e separados
- ⚠️ Se usuário queria continuar editando coluna e clicou componente sem querer, troca contexto. Trade-off aceitável.

---

## ADR-042 — Comparação no KPI é configurável (8 tipos via `SolsticeKPI.calculateDelta`)

**Status:** Aceito · Patch B5-r3
**Contexto:** Patch r1 fez comparação automática "1ª metade vs 2ª metade da série". Funciona para tendência genérica, mas Lucas precisa de:
- Comparação contra META (ex: meta de receita do trimestre)
- Comparação contra histórico (média ou mediana)
- Comparação contra primeiro/último valor
- Comparação ano-sobre-ano
**Decisão:** Novo módulo `SolsticeKPI.calculateDelta(values, config)` retorna `{ pct, baseline, baselineLabel, direction, current }` ou `null`. 8 tipos suportados em `config.comparison.type`:
- `previous-period` (default · proxy 1ª/2ª metade até filtros B9)
- `same-period-last-year` (precisa 12+ valores)
- `fixed-target` (lê `targetValue` + `targetLabel`)
- `historical-mean` / `historical-median`
- `first-value` / `last-value`
- `none` → retorna null, KPI mostra "Calculado de N registros"

`Humanize.delta(pct, higherIsBetter, baselineLabel)` aceita label livre. Heurística pt-BR de artigo: "da meta", "do período anterior", "da média histórica".

UI: aba "Comparação" no Props do KPI com radio buttons + sub-campos condicionais (Meta fixa exige valor numérico + texto da meta; Período anterior tem dropdown auto/diário/semanal/mensal/trimestral).

`slot.config.comparison = { type, targetValue, targetLabel, periodSize }`. Default `previous-period` por compatibilidade.

**Consequências:**
- ✅ KPI expressa diferentes objetivos analíticos (vs meta, vs histórico, vs período)
- ✅ Baseline humano: texto fica natural ("▲ +12% acima da meta" em vez de jargão)
- ✅ Periodicidade real (auto/diário/semanal/mensal) ficará completa com filtros do B9
- ⚠️ `same-period-last-year` é aproximação até B9 — usa primeiro 1/12 da série como proxy

---

## ADR-043 — Confirmações destrutivas silenciáveis por perfil + toast com Desfazer

**Status:** Aceito · Patch B5-r3
**Contexto:** Lucas reportou que confirmar remoção de cada componente/seção/row vira fricção após uso frequente. Mas remover sem confirmação é perigoso.
**Decisão:** Dois mecanismos complementares:

1. **`Modal.confirm({ skipKey })`** — chave identifica a ação (`remove-component`, `remove-section`, `remove-row`). Antes de mostrar modal:
   - Se `localStorage[solstice.<profileId>.skipConfirm.<skipKey>] === 'true'` → resolve `true` imediatamente sem UI.
   - Senão, modal aparece com **checkbox "Não perguntar mais sobre isso"** abaixo da mensagem. Marcar + confirmar persiste a preferência.
   - `Modal.listSkipped()` e `Modal.unskip(key)` para gerenciar.

2. **`Toast.action({ actionLabel, actionFn })`** — após ação destrutiva, mostra toast com botão clicável (default 5s). No Solstice, `actionFn: () => SolsticeUndo.undo()` em todas as remoções. Compensa a redução de fricção das confirmações silenciadas.

3. **Menu de Preferências** — botão 👤 do header abre modal com lista das 3 chaves de confirmação destrutiva. Checkboxes marcadas = pergunta antes; desmarcadas = silenciado. Persistência por perfil garante que diferentes usuários no mesmo dispositivo tenham preferências próprias.

**Consequências:**
- ✅ Usuário avançado: silencia uma vez, opera fluido com toast + Ctrl+Z global
- ✅ Usuário novo / iniciante: padrão pergunta sempre
- ✅ Auditoria intacta: `Audit.record('remove_component')` continua acontecendo mesmo com modal silenciado
- ✅ Por perfil = compartilhamento de dispositivo seguro
- ⚠️ `localStorage` pode ser limpo (modo anônimo, troca de browser) — preferência é "best-effort"

---

## ADR-044 — Comparações no KPI são filtradas por compatibilidade estatística com a agregação

**Status:** Aceito · Patch B5-r4
**Contexto:** No r3, a aba "Comparação" mostrava as 8 baselines independente da agregação escolhida. Combinações estatisticamente sem sentido apareciam misturadas (ex: Soma vs Média histórica — soma cresce com mais dados, gerando crescimento artificial; Contagem vs Mediana histórica idem).
**Decisão:** Mapa `AGG_COMPARISON_COMPAT` define baselines válidas por agregação. Aba Comparação mostra apenas compatíveis na lista principal. Botão "+ Mais opções (N incompatíveis)" expande as restantes com:
- Nota de aviso ⚠️ no topo da seção expandida
- Ícone ⚠️ na frente de cada label incompatível (via classe `--warning`)
- Tooltip por opção via `incompatReason(agg, baselineType)` explicando o motivo específico (ex: "Soma cresce com mais dados; média histórica como baseline gera crescimento artificial.")

Trocar agregação que invalide baseline atual dispara auto-switch para `previous-period` + toast informativo + entrada `auto_switch_comparison` no Audit.
**Consequências:**
- ✅ Usuários iniciantes ficam protegidos da combinação ruim por default
- ✅ Usuários avançados ainda podem optar por incompatíveis se souberem o porquê
- ✅ Auditoria registra trocas automáticas — explica para auditor por que a baseline mudou
- ⚠️ Mapa é opinião estatística — pode ser questionado em casos de borda. Tooltip oferece motivo, usuário decide.

---

## ADR-045 — Componentes podem fornecer título dinâmico via `def.getTitle(slot, ctx)`

**Status:** Aceito · Patch B5-r4
**Contexto:** No r2, o KPI mostrava título da métrica em posição absolute no canto sup-direito (acima dos botões). Layout pediu pra mover para o canto sup-esquerdo (leitura ocidental natural) + actions à direita.
**Decisão:** Hook genérico `def.getTitle(slot, ctx)` no registry de componentes. Se existe, `Components.render` usa o retorno; senão usa `def.name` estático. KPI implementa `getTitle` retornando `Humanize.column(slot.config.column, ctx.dictionary).toUpperCase()`. Removido o título absolute do `.solstice__kpi-card-title`. Casca já tinha `.solstice__comp-head` com `flex` e `.solstice__comp-title { flex: 1 }` empurrando `.solstice__comp-actions` para a direita — só faltava popular dinamicamente.
**Consequências:**
- ✅ Outros componentes podem reusar (Série Temporal poderia mostrar `Y por X`, Distribuição `Distribuição de Y`)
- ✅ Sem nova estrutura visual — reaproveita header da casca
- ✅ try/catch wrap no chamada protege componentes mal-comportados
- ⚠️ `getTitle` é re-chamado a cada render — manter barato (sem cálculo pesado)

---

## ADR-046 — Dashboard pode ter cabeçalho visual customizável (`SolsticeDashHeader`)

**Status:** Aceito · Patch B5-r4
**Contexto:** Dashboards profissionais geralmente abrem com banner contextual (título + período + branding). Lucas pediu feature para construir esse banner sem CSS custom.
**Decisão:** Novo módulo `SolsticeDashHeader` com banner gradient acima da toolbar do canvas. Configurável via modal (botão "📋 Cabeçalho" na toolbar):
- **Título** + **Subtítulo** (texto livre)
- **Data dinâmica**: 3 modos
  - `today` → `SolsticeLocale.date(new Date())`
  - `fixed` → data setada manualmente
  - `column` → escolhe coluna temporal do dataset + função (`max` / `min` / `recent`)
- **Gradiente**: cor inicial + cor final + 8 direções (4 cardinais, 4 diagonais, radial)
- **Cor do texto**: `auto-white`/`auto-black` (calculado por luminância WCAG da média das duas cores — ADR-047) ou hex custom
- **Altura**: 3 presets (`compact` 80px / `standard` 120px / `tall` 180px)
- **Preview ao vivo** dentro do modal

Persistência em `Store.canvas.header` (vai com snapshots no B11). Auto-sugestão ao importar CSV: nome do arquivo vira título sugerido via Toast.action.
**Consequências:**
- ✅ Dashboards podem ter identidade visual sem CSS custom
- ✅ Data dinâmica baseada em coluna do dataset garante "atualizado em Xz" correto sem manutenção manual
- ✅ Snapshots preservam o header — entrega completa profissional
- ⚠️ Direção `radial` ignora o input `direction` e usa `radial-gradient(circle, from, to)` — limitação aceitável
- ⚠️ Modal de configuração é longo — para mobile, considerar acordeão (B12 polish)

---

## ADR-047 — Cor do texto do cabeçalho é calculada por luminância WCAG (auto-white / auto-black)

**Status:** Aceito · Patch B5-r4
**Contexto:** Gradiente do banner pode variar drasticamente — fundo branco precisa texto escuro; fundo escuro precisa texto claro. Forçar usuário a decidir manualmente é fricção.
**Decisão:** `SolsticeDashHeader.autoTextColor(fromHex, toHex)` calcula luminância sRGB linearizada (algoritmo WCAG 2) de ambas as cores, faz média, retorna `'#FFFFFF'` se média < 0.5, senão `'#000000'`. Opções no modal:
- `auto-white` (default): chama `autoTextColor`
- `auto-black`: chama `autoTextColor`
- hex custom: usuário decide (color picker)
**Consequências:**
- ✅ Default funciona para 95% dos gradientes
- ✅ Daltonismo: contraste preto/branco é universalmente legível
- ✅ Lucas pode forçar cor corporativa específica (ex: branco Itaú mesmo sobre gradiente claro)
- ⚠️ Gradientes muito coloridos (vermelho + amarelo) podem ter média ~0.5 e oscilar entre preto e branco com mudança pequena. Aceitável; usuário pode forçar custom.

---

## ADR-048 — Componente "Compound" adiado para Bloco 12 polish

**Status:** Aceito · Bloco 6
**Contexto:** Contrato pede Compound (combinador de 2+ componentes num único slot, ex: KPI + sparkline lado a lado). Análise revelou que o valor incremental é menor que cada um dos 6 outros componentes individualmente, e implementação correta exige sub-registry recursivo (componente dentro de componente).
**Decisão:** Adiar Compound para B12 (polish/microinterações). Justificativa:
- Usuário já pode combinar visualmente via rows com layouts grid (B3) + DnD (B4)
- Sub-registry recursivo requer hooks no SolsticeProps (aba "Visual" precisaria de sub-Props)
- 6 componentes alternativos (scatter, heatmap-cal, gauge, markdown, boxplot, sankey) entregam valor analítico imediato
**Consequências:**
- ✅ B6 cabe no token budget
- ✅ Combinações via row layout cobrem 80% dos casos
- ⚠️ Componentes "compostos" tipicamente vistos em dashboards executivos (KPI grande com mini-tendência ao lado) ficam para B12

---

## ADR-049 — Helpers estatísticos `_linearRegression`, `_kMeans`, `_quartiles` inline no `SolsticeComponents` (antes do B7)

**Status:** Aceito · Bloco 6
**Contexto:** Scatter precisa de regressão linear + k-means. Box Plot precisa de quartis com detecção de outliers via IQR. `SolsticeStats` (B7) trará 30+ funções, mas seria errado bloquear B6 esperando.
**Decisão:** Implementar 3 helpers diretamente no `SolsticeComponents` como funções privadas. Quando B7 entregar `SolsticeStats`, refatorar para chamar via API pública (`Solstice.Stats.linearRegression`, etc.) — código de B6 já chamará versões idênticas.
**Consequências:**
- ✅ B6 entrega imediatamente sem dependência circular com B7
- ✅ Algoritmos validados (OLS textbook, Lloyd's k-means clássico, IQR 1.5× WCAG)
- ⚠️ Pequena duplicação quando B7 chegar — migração trivial via search/replace dos 3 nomes
- ⚠️ Outros componentes B6 que precisem das mesmas funções (ex: Box Plot reusando quartiles) já compartilham através do closure de `SolsticeComponents`

---

## ADR-050 — Sankey simplificado: 2 níveis (source → target), sem otimização de cruzamento

**Status:** Aceito · Bloco 6
**Contexto:** Sankey diagram canônico (D3-Sankey) suporta N níveis com algoritmos de minimização de cruzamento (Hungarian, Sugiyama). Implementação completa ~400 LOC.
**Decisão:** Sankey do Solstice mostra apenas 2 níveis (`sourceColumn → targetColumn`) com até 8 categorias top em cada lado. Sem otimização de cruzamento — fluxos são ordenados por valor descendente e empilhados verticalmente. Bezier C-curves entre rectangle nodes.
**Consequências:**
- ✅ ~150 LOC vs ~400 LOC para versão completa
- ✅ Cobre o caso de uso "de onde / para onde" — origem-destino é o uso principal em BI
- ✅ Itaú: análise origem cliente → destino produto, agência → segmento, canal entrada → conversão
- ⚠️ Não cobre fluxos multi-nível (5 etapas de um processo). Para isso, B12 ou versão custom.
- ⚠️ Cruzamentos podem ficar visualmente densos com 8×8 = 64 fluxos. Aceitável; B12 pode adicionar ordenação manual.

---

## ADR-051 — Parser Markdown regex puro, sem CommonMark completo

**Status:** Aceito · Bloco 6
**Contexto:** Componente Markdown precisa renderizar texto rico. Bibliotecas completas (marked, markdown-it) custam ~30KB minificado + dependência externa.
**Decisão:** Parser inline com regex cobrindo: H1/H2/H3, **bold**, *italic*, \`code\`, `- listas`, links `[text](url)`. Placeholders `{{store.path}}` substituídos por valores via `SolsticeStore.get(path)` (renderiza placeholder visual se path não existe). Escape HTML automático em todo conteúdo do usuário (XSS-safe).
**Alternativas:**
- marked.js via CDN: rompe single-file, +30KB de rede
- DOMPurify + marked: mesmo problema + complexidade
**Consequências:**
- ✅ ~80 LOC, zero dependência
- ✅ Cobre 90% das necessidades de texto em dashboard (títulos, listas, ênfase, código inline, links externos)
- ✅ Placeholders dinâmicos são feature exclusiva — não suportada por libs Markdown padrão
- ⚠️ Sem suporte a tabelas, code blocks multi-linha, footnotes, syntax highlight. Aceitável para texto explicativo de dashboard.
- ⚠️ Edge cases de Markdown malformado (ex: `**text*` sem fechamento) ficam visualmente quebrados — sem fallback inteligente

---

## ADR-052 — SVG components usam `ResizeObserver` para 3 tiers responsivos

**Status:** Aceito · Patch B6-r1
**Contexto:** Componentes B6 (Scatter, Gauge, Box Plot, Sankey) e Distribution (B5) tinham dimensões SVG hardcoded (W=320..520) com `min-height: 220px`. Em slot pequeno (<240px) deformavam; em slot grande não aproveitavam espaço.
**Decisão:**
- Helper `_observeResponsive(host, def, slot, ctx)` cria `ResizeObserver` debounce 150ms no host.
- `_tierFor(host)` classifica por `clientWidth`:
  - `compact`: < 240 → W=240, H=150
  - `standard`: < 420 → W=360, H=240
  - `large`: ≥ 420 → W=540, H=340
- Cada componente lê tier no início do render, ajusta W/H/padding e aplica classe `.solstice__chart-svg--{tier}` no SVG.
- `aspect-ratio` no CSS preserva proporção via `viewBox`.
- Empty states amigáveis em tier compact onde aplicável (Sankey precisa ≥320px).
- Cleanup do observer anterior antes de criar novo evita leaks.
**Consequências:**
- ✅ Componentes adaptam dinamicamente sem reflow trigger ao usuário (debounce + tier-change check)
- ✅ Slots pequenos não deformam mais; slots grandes aproveitam o espaço
- ⚠️ Browsers muito antigos sem `ResizeObserver` (pré-2020) degradam silenciosamente para tier inicial

---

## ADR-053 — Painel de Propriedades adota tamanhos de toque mínimo 32-36px

**Status:** Aceito · Patch B6-r1
**Contexto:** Tabs (10px font, 4px padding) e radios (fs-xs, 4/8 padding) na sidebar de 280-320px ficavam minúsculos demais — abaixo de WCAG 2.5.5 (target size 44×44 recomendado, 24×24 mínimo).
**Decisão:**
- `.solstice__props-tab`: `min-height: 36px`, padding `10px 14px`, font-size `var(--fs-sm)`
- `.solstice__props-select`, `.solstice__props-input`: `height: 36px`, padding `8px 10px`
- `.solstice__props-label`: `font-size: var(--fs-xs)` (subiu de 10px), color `--c-text-2` (mais visível que `--c-muted`)
- `.solstice__props-field`: `margin-bottom: var(--sp-4)` (mais respiro)
- `.solstice__compare-radio`: `min-height: 32px`, font-size `var(--fs-sm)`, gap 8
**Consequências:**
- ✅ Todos os controles acessíveis por toque/click
- ✅ Densidade ainda mantida (sidebar de 280px continua acomodando)
- ⚠️ Em sidebar muito estreita (<240px), elementos podem precisar de scroll. Aceitar.

---

## ADR-054 — Aba Dados tem Resumo do Dataset com classificação por grupo de tipo

**Status:** Aceito · Patch B6-r1
**Contexto:** Lucas pediu visibilidade rápida de "o que tem nesse CSV" sem precisar olhar coluna por coluna.
**Decisão:** Novo módulo `SolsticeDataset.summary()` retorna `{ totalRows, totalColumns, groups: { numeric: [...], categorical: [...], ... } }`. UI `.solstice__dataset-summary` no topo da aba Dados (acima do quality-card):
- Total de linhas em destaque + total de colunas em badge
- Lista vertical por grupo (Medidas / Dimensões / Temporais / Identificadores / Contato / Geográficas / Estruturadas / Especiais)
- Cada linha: ícone + contagem + label pluralizado + 3 primeiras colunas + "...+N"
- Click em um grupo: scroll até editor de colunas + toast com lista completa
- Tooltip com lista completa por hover
- Grupos vazios ficam ocultos
- Reativo a `subscribe('ingest')` e `subscribe('dictionary')` — recalcula ao mudar tipo de coluna ou friendlyName
**Consequências:**
- ✅ "O que tem no meu CSV?" em 2 segundos
- ✅ Onboarding para CSVs estranhos: usuário vê estrutura imediatamente
- ⚠️ Não inclui contagem de nulos/inválidos (já mora no Quality Card abaixo)
- ⚠️ Pode ficar denso em datasets com 8+ grupos — aceitar, raro acontecer

---

## ADR-055 — `SolsticeModal.show` aceita `dismissOnBackdrop` + proteção global contra arraste

**Status:** Aceito · Patch B6-r1
**Contexto:** Usuário Lucas reportou que modal de cabeçalho fechava acidentalmente: selecionar texto no input arrastando o cursor pra fora do modal disparava o handler de click no backdrop. Padrão UX problemático em qualquer modal com inputs de texto.
**Decisão:**
- API nova: `SolsticeModal.show({ dismissOnBackdrop: false })`. Default `true` mantém comportamento atual.
- Proteção GLOBAL (em todos os modais, independente da opção): no `mousedown` do backdrop, marca `dragStartedInside = e.target.closest('.solstice__cmodal') !== null`. No `click`, só fecha se `dragStartedInside === false`. Reset da flag após.
- Aplicado `dismissOnBackdrop: false` em:
  - `SolsticeDashHeader.openConfig` (inputs longos: título, subtítulo, color pickers)
  - Modal legacy de Dicionário (cria via `el()` direto, ganhou proteção drag manual)
- Esc continua fechando todos os modais — usuário sempre tem saída.
**Consequências:**
- ✅ Confirmações simples (`Modal.confirm`) ainda fecham por backdrop click rápido (padrão preservado)
- ✅ Arraste de seleção nunca dispara fechamento, mesmo em modais com `dismissOnBackdrop: true`
- ✅ Modais com formulários longos não perdem dados por acidente
- ⚠️ Drag programático (extensões, automation) pode ser interpretado errado — aceitar trade-off

---

## ADR-056 — Scatter smart default escolhe par com maior |Pearson|

**Status:** Aceito · Bloco 7
**Contexto:** O default antigo (`nums[0] / nums[1]`) deixava o gráfico aleatório — para um CSV de vendas, "qt_vendas vs ticket_medio" pode ser uma combinação fraca enquanto "receita vs margem_bruta" é onde a história está.
**Decisão:** `SolsticeStats.bestNumericPair(ctx)` calcula Pearson entre todos os pares das até-6 primeiras colunas numéricas (limite evita correlações espúrias e O(n²) excessivo). Retorna o par com maior `|r|` (mín. 5 observações pareadas). Toast informativo categoriza: "forte/moderada/fraca" + sinal.
**Alternativas:**
- Spearman em vez de Pearson: mais robusto mas computa rank n·log(n) por par — overkill no default
- Heurística por dicionário (nome amigável): cobertura inconsistente; estatística é universal
**Consequências:**
- ✅ Primeira impressão do scatter mostra um padrão real, não pontos aleatórios
- ✅ Educa o usuário sobre quais colunas se relacionam
- ⚠️ Cap em 6 colunas significa que datasets com 20+ numéricas podem ter par ótimo fora — usuário ajusta em ⚙️
- ⚠️ Não detecta relações não-lineares (mas a aba 📈 Análise mostra Spearman para diagnóstico)

---

## ADR-057 — Gauge smart default usa percentis + higherIsBetter do dicionário

**Status:** Aceito · Bloco 7
**Contexto:** Default antigo (min=0, max=100, target=70) só fazia sentido para colunas de %. Para "receita" (R$ 10K-1M) o gauge ficava com agulha colada no início e meta absurda.
**Decisão:** `SolsticeStats.suggestGauge(ctx)`:
1. Preferência: coluna do tipo `percentage` → min=0, max=100, target=80
2. Senão: P5 (rounded floor) e P95 (rounded ceil) do dataset
3. Meta:
   - `higherIsBetter === true` → P75 (zona de excelência)
   - `higherIsBetter === false` → P25 (zona segura, ex: inadimplência)
   - `higherIsBetter == null` → P50 (mediana como referência)
**Arredondamento amigável:** `roundNice` ajusta para a metade da magnitude (potência de 10) — evita "R$ 10.347,23" como min, prefere "R$ 10.000".
**Consequências:**
- ✅ Agulha já aparece em posição útil na primeira renderização
- ✅ Meta tem semântica conectada ao dicionário (não chute fixo)
- ⚠️ P5/P95 ignora outliers extremos — desejável para escala visual, mas usuário pode preferir min/max absolutos (configurável)

---

## ADR-058 — Box Plot auto-seleciona groupColumn quando há cat com 2-8 distintos

**Status:** Aceito · Bloco 7
**Contexto:** Box plot sem grupos é uma caixa solitária — visualização monótona. Mas com 30+ grupos vira ilegível.
**Decisão:** `SolsticeStats.suggestBoxPlot(ctx)` itera categóricas em ordem do dataset; pega a primeira com `distinctCount` ∈ [2, 8]. Se nenhuma cabe, `groupColumn = null` (caixa única).
**Por que 2-8:** abaixo de 2 não é categoria útil; acima de 8 o eixo X fica apertado mesmo em tier `large` (W=540).
**Consequências:**
- ✅ Box plot já aparece agrupado quando faz sentido — visual instrutivo de cara
- ✅ Toast confirma o agrupamento escolhido, facilitando ajuste
- ⚠️ Se a 1ª cat com 2-8 distintos não é a mais informativa, usuário troca em ⚙️ (1 click)

---

## ADR-059 — Sankey exige source ≠ target; trata graciosamente 0 ou 1 categórica

**Status:** Aceito · Bloco 7
**Contexto:** Default antigo permitia `sourceColumn === targetColumn` (caia em `cats[1] || cats[0]`), gerando sankey "regiao→regiao" — sem sentido visual. Datasets com 0 ou 1 categórica geravam erro confuso ao renderizar.
**Decisão:** `SolsticeStats.suggestSankey(ctx)`:
- 0 cats → todos os 3 campos null + empty state explica
- 1 cat → `sourceColumn` setado, `targetColumn = null` + empty state explica que sankey precisa de 2
- ≥2 cats → escolhe entre as que têm 2-8 distintos. Ordena por `distinct` ascendente: a com menos categorias vira ORIGEM (padrão de funil), a próxima vira DESTINO
**Empty states 4 variantes** (no `render`):
- 0 cats: "Sankey precisa de pelo menos 2 colunas categóricas (origem e destino)..."
- 1 cat: "Sankey precisa de 2 categóricas distintas. Seu dataset tem só uma: 'X'..."
- source==target: "Origem e destino devem ser colunas DIFERENTES..."
- ambas null: "Selecione duas colunas categóricas distintas..."
**Consequências:**
- ✅ Erro nunca aparece como `cannot read sourceColumn of null`
- ✅ Mensagens contextuais ensinam o que o componente precisa
- ⚠️ Auto-seleção pode pegar ordem source/target "invertida" para o domínio — usuário troca em ⚙️

---

## ADR-060 — SolsticeStats como módulo puro autossuficiente, posicionado pre-Components

**Status:** Aceito · Bloco 7
**Contexto:** Bloco 7 introduz 41 funções estatísticas. Opções: (1) embutir nos componentes que precisam, (2) criar `SolsticeStats` reutilizável.
**Decisão:** Módulo separado `SolsticeStats` definido ANTES de `SolsticeComponents` no IIFE. Cada função:
- Pura: input → output, sem side effects, sem dependência de Store/dicionário
- Tolera entradas sujas: clean() internamente filtra NaN/null/undefined
- Documentada com comentário didático (o quê, quando usar, fórmula em texto)
- Exposta em `Solstice.Stats` para console / blocos futuros (B8 narrativa, B10 auto-dashboard)
**Estrutura:** organizado em 10 seções semânticas; API pública lista todas no return final para facilitar portabilidade item-a-item para outros projetos (Eva).
**Alternativas:**
- Lib externa (simple-statistics, math.js): violaria ADR-005 (single-file, sem npm)
- Funções soltas: dificulta documentação e exposição
**Consequências:**
- ✅ Componentes B6 (Scatter/Gauge/BoxPlot) podem usar via shims sem refactor
- ✅ Aba "📈 Análise" tem fonte única de verdade estatística
- ✅ Cada função é portável isoladamente (portabilidade/bloco-07.md detalha)
- ✅ B8 (insights), B10 (auto-dashboard recommender) já têm tudo que precisam
- ⚠️ +~400 linhas no HTML; aceitável vs valor entregue

---

## ADR-061 — Aba "📈 Análise" context-aware com nota didática

**Status:** Aceito · Bloco 7
**Contexto:** Painel de Propriedades já tinha 4 abas (Dados/Visual/Decisões/Origem) e 5 com KPI (Comparação). Quinta aba precisa entregar valor sem virar bagunça.
**Decisão:** Aba "📈 Análise" disponível em todos os componentes exceto `markdown` (que não tem coluna numérica). Layout fixo:
1. **Cabeçalho** "🔬 Por que esse número?" + frase com `n` e `nulls`
2. **Seção fixa** "📊 Distribuição central" (média/mediana/std)
3. **Seção fixa** "📏 Faixa e quartis" (min/Q1/Q3/max/IQR)
4. **Seção fixa** "🔍 Forma" (skewness + texto humano, kurtosis + texto humano)
5. **Seção fixa** "⚠️ Outliers" (count IQR 1.5× + %)
6. **Seções contextuais** por tipo (Time Series → tendência+forecast, Scatter → Pearson+Spearman+nota, Gauge → distância da meta, Box Plot → por grupo)
7. **Footer:** snippet de console que reproduz as métricas
**Cada label tem tooltip** explicando a métrica brevemente (`title=` na DOM).
**Consequências:**
- ✅ Aba serve tanto Lucas (analista experiente) quanto stakeholders que estiverem aprendendo
- ✅ Footer com snippet de console encoraja exploração da API `Solstice.Stats`
- ✅ "Por que esse número?" cumpre prometido em SEÇÃO CRÍTICA 7 do PROMPT (precursor à narrativa B8)
- ⚠️ Markdown sem aba — coerente; mas precisa lembrar de habilitar para componentes futuros

---

## ADR-062 — Cap explícito de tamanho em componentes visuais com aspect-ratio livre (B7-r1)

**Status:** Aceito · Patch B7-r1
**Contexto:** SVGs dos componentes B6 (Scatter/Gauge/BoxPlot/Sankey) usavam `aspect-ratio: 16/10` + `width: 100%` sem `max-height`. Em containers largos (1col full-width, canvas ~1180px), o SVG renderizava com ~738px de altura, estourando a seção. Bug #006 em BUGS.md. Smart defaults do B7 amplificaram o problema (usuários adicionam mais).

**Decisão:**
1. Substituir `aspect-ratio + min-height` por **`max-width + max-height` per tier** em `.solstice__chart-svg`:
   - compact: 360×230 · standard: 480×320 · large: 600×380
   - SVG fica letterbox centralizado (margin: 0 auto) em containers maiores
2. Aplicar `max-height: 380px` no wrap Chart.js (`.solstice__chart-wrap`) e seu canvas filho
3. Aplicar `max-height: 460px` + `overflow: hidden` em `.solstice__comp` como teto absoluto (380 SVG + 40 header + 20 padding + folga)
4. Aplicar `max-height: 380px` + `overflow-y: auto` em `.solstice__md` para textos longos
5. Aplicar `max-width: 600px` + `margin: 0 auto` em `.solstice__hist`

**Alternativas consideradas:**
- **JS resize** (calcular dimensões pixel-perfect via JS): viola Pure CSS rule, custa runtime, conflita com ResizeObserver do B6-r1
- **aspect-ratio + max-height puro**: aspect-ratio é "preferida" mas pode colidir com max-height de forma inconsistente entre browsers (Firefox vs Chrome). max-width+max-height é mais robusto
- **CSS container queries**: o KPI Card já usa, mas SVGs com viewBox precisam de width/height explícitos para letterboxing

**Consequências:**
- ✅ Nenhum componente estoura seção em containers largos
- ✅ Em containers pequenos (4col layout): SVG ainda renderiza responsivo via tier compact
- ✅ Box-shadow de `is-selected` não é clipado (overflow:hidden não afeta box-shadow externo)
- ✅ Tooltips de hover, modais, sidebar não são afetados (vivem fora do `.solstice__comp`)
- ⚠️ Componentes com conteúdo dinâmico longo (markdown grande, tabela com 500 linhas) precisam scroll INTERNO — markdown ganhou overflow-y: auto; tabela já tinha .solstice__data-table-wrap com max-height: 70vh; mas comp ainda cap em 460px (table scroll fica em ~400px visíveis)
- 📋 **Regra a partir de B8:** todo componente visual com elemento de aspect-ratio livre (SVG, canvas, embed) DEVE declarar `max-width` e `max-height`. Adicionar ao checklist do bloco.

---

## ADR-063 — Inspector lateral direito (grid 3-col com .has-inspector)

**Status:** Aceito · Patch B7-r2
**Contexto:** O painel de propriedades vivia dentro da sidebar esquerda (280px). Isso comprimia tabs ilegíveis, misturava Dados + Properties na mesma coluna, e gerava scroll pesado. Padrão de mercado (Figma/VS Code/Power BI) é inspector lateral direito que abre ao selecionar.

**Decisão:**
- Grid raiz expandido: `grid-template-columns: 280px 1fr 0px` (fechado) → `280px 1fr 340px` (com `.has-inspector` no `.solstice__app`)
- Transição CSS `grid-template-columns 300ms var(--ease)`
- Novo `<aside id="inspector">` como grid item; header sticky com título + ✕, body scrollável, footer sticky com botão Remover
- Módulo `SolsticeInspector` controla apenas open/close/setTitle/setFooter — conteúdo é responsabilidade do consumidor (SolsticeProps)
- Responsividade: `< 1200px` vira overlay fixed; `< 768px` ajustes adicionais
- Esc fecha (com cascata: drawer Análise → Inspector → modal)
- Click em área vazia do canvas fecha

**Alternativas consideradas:**
- Modal centralizado: bloqueia interação com o gráfico (precisa ver gráfico + ajustar config lado-a-lado)
- Painel flutuante (position: fixed): não respeita grid, sobreposições confusas, sem transição suave
- Manter sidebar única expandida: não resolve compressão das tabs

**Consequências:**
- ✅ Mais espaço para controles (340px > 280px da sidebar)
- ✅ Padrão UX familiar (Figma, VS Code, Tableau, Power BI)
- ✅ Sidebar esquerda fica limpa (só Dataset + Editor + Catálogo)
- ⚠️ `< 1200px` precisa de overlay — perde elegância em laptops 13"
- ⚠️ Total horizontal exige ~1280px+ para experiência completa

---

## ADR-064 — Accordion expansível em vez de tabs

**Status:** Aceito · Patch B7-r2
**Contexto:** Inspector com tabs comprimidas (5-6 abas em 340px) ficava ilegível. Lucas reportou que precisava de "ver tudo de uma vez quando precisava". Tabs força "uma de cada vez".

**Decisão:**
- Substituir tabs por accordion: cada seção (Dados, Comparação, Visual, Decisões, Origem) abre/fecha individualmente; várias podem estar abertas simultaneamente
- Helper top-level `createAccordion({ icon, title, key, openByDefault, count, build })` retorna `<div class="solstice__accord">` com head + body
- Persistência por `Store.ui.accordion.<key>` — re-selecionar componente preserva quais seções estavam abertas
- Defaults: Dados ✅ aberta · Comparação (só KPI) ✅ aberta · Visual ❌ · Decisões ❌ · Origem ❌
- Helper reusado também no catálogo de componentes (Básicos/Avançados/Texto)

**Alternativas:**
- Tabs com scroll horizontal: feio, confunde estado ativa
- Accordion only-one-open: força fricção desnecessária

**Consequências:**
- ✅ Múltiplas seções visíveis ao mesmo tempo
- ✅ Estado persistido entre seleções
- ✅ Mesmo helper serve catálogo
- ⚠️ Scroll vertical pode ficar longo se todas abertas
- ⚠️ Renomear seção quebra persistência (aceitável — usa `key` para insulamento)

---

## ADR-065 — Drawer Análise separado do Inspector

**Status:** Aceito · Patch B7-r2
**Contexto:** A aba "📈 Análise" criada no B7 vivia dentro do painel de propriedades. Lucas observou que análise estatística é "ponto estático bom para visualizar" — não pertence ao mesmo espaço de construção/visual. E ficaria "ruim de olhar" se colocada na esquerda.

**Decisão:**
- Análise vira drawer INFERIOR ancorado ao canvas, não ao inspector
- `position: fixed; bottom: 32px; left: 280px; right: 0|340px` — ajusta com o estado do inspector via classes `.has-inspector` + `.has-analysis`
- Transform translateY 300ms (slide-up)
- Acionado por novo botão `📈` no header da casca do componente
- Conteúdo em grid de cards (`auto-fit minmax(220px, 1fr)`) em vez de lista vertical — aproveita a largura do canvas
- Esc fecha (cascata antes do Inspector)
- Botões na casca: 📈 (novo) + 🔬 🔍 ⚙️ 🗑️ (existentes) — 5 ações
- Markdown não tem análise (explica no empty state)

**Por que separar:**
- Análise é leitura, props é construção — domínios diferentes
- Drawer inferior permite ver gráfico + estatística simultaneamente
- Inspector lateral foca em config, sem competição por espaço

**Alternativas:**
- Modal grande centralizado: bloqueia gráfico — perde valor de comparação
- Aba dentro do inspector: comprime, mistura domínios
- Painel direito secundário: complica grid demais

**Consequências:**
- ✅ Análise visualmente espaçosa em cards de 220px min (vs lista vertical)
- ✅ Pode ser comparada com o gráfico ao lado
- ✅ Inspector limpo e focado em construção
- ⚠️ Drawer ocupa altura no canvas — `padding-bottom` extra (340px) é adicionado ao canvas quando aberto
- ⚠️ Inspector + Drawer abertos juntos consomem espaço; precisa de tela ≥ 1280×800 para conforto pleno

---

## ADR-066 — Insights priorizados por score (top 8)

**Status:** Aceito · Bloco 8
**Contexto:** Painel automático de insights pode gerar 30+ achados num dataset rico. Mostrar tudo confunde; mostrar pouco perde sinal.
**Decisão:** Cada insight tem `score` 0-100 calculado por heurística específica (magnitude × R² para tendência, % outliers × 3 para outliers, concentração × 100 para Pareto etc.). Ordena por score desc, mostra top 8. Severity (success/warn/error/info) respeita `higherIsBetter` do dicionário.
**Alternativas:** mostrar todos com filtro · severity-only ordering · ML para ranking.
**Consequências:**
- ✅ Usuário vê o mais relevante primeiro
- ✅ Card pode ser clicado para "Ver insights" (drilldown futuro)
- ⚠️ Score heurístico — calibração pode precisar ajuste com uso real
- ⚠️ Cap 8 pode esconder padrão #9-10 interessante

---

## ADR-067 — Narrativa template-based pt-BR (sem LLM)

**Status:** Aceito · Bloco 8
**Contexto:** SEÇÃO 7 do PROMPT pede "Narrativa Automática" como Diferencial #2. Opções: (1) integrar LLM externo, (2) templates locais.
**Decisão:** Templates pt-BR hardcoded com slots `{friendly}`, `{value}`, `{pct}`, `{r2}` etc. 3 tons × 3 profundidades. Substituição via regex `\{(\w+)\}`. Texto resultante é determinístico, offline, zero custo.
**Por que não LLM:**
- ADR-005 (single-file, sem deps externas)
- Custo por request, latência, dependência de chave API
- Determinismo > criatividade no contexto de relatório executivo
**Quando vale evoluir para LLM:** B13+ ou via integração opcional usuário-provê-key.
**Consequências:**
- ✅ Funciona offline, instantâneo, zero custo
- ✅ Texto reproduzível (mesmo input = mesmo output)
- ✅ Auditável (templates visíveis no código)
- ⚠️ Só pt-BR; EN/ES fica para B12
- ⚠️ Templates são "engessados" — narrativa pode soar repetitiva em uso intenso

---

## ADR-068 — Agente proativo com cap 3 toasts/sessão

**Status:** Aceito · Bloco 8
**Contexto:** Agent que dispara toast a cada padrão detectado vira spam (5-10 toasts ao importar CSV → usuário fecha tudo na irritação).
**Decisão:** Cap absoluto de 3 toasts por sessão de uso. Cada toast tem `key` único; mesma key não dispara 2x. Reseta ao importar novo CSV (sessão analítica nova). Cada toast com botão de ação ("Ver insights" / "Criar Box Plot").
**Alternativas:** cap configurável · agrupar em painel "central de notificações" · throttle por minuto.
**Consequências:**
- ✅ Notificação parecida com app moderno (alertas pontuais, não barulho)
- ✅ Usuário aprende a confiar (toast = algo importante)
- ⚠️ Pode segurar insights úteis em sessão longa — usar painel de insights para ver todos

---

## ADR-069 — Inconsistências como catálogo declarativo

**Status:** Aceito · Bloco 8
**Contexto:** Validações analíticas (sum de %, gauge fora do range) precisam ser facilmente expansíveis SEM tocar em fluxo crítico.
**Decisão:** Array `RULES` de objetos `{ id, label, severity, description, hint, when(ctx) → bool }`. Função pura `checkSlot(slotId)` itera regras, devolve hits. Inspector renderiza accordion "⚠️ Avisos" se `hits.length > 0`. `try/catch` ao redor de cada `when` — regra que dá erro falha silenciosa.
**Padrão:** dados → regras → resultado. Sem state, sem subscribe.
**Consequências:**
- ✅ Adicionar nova regra = adicionar objeto ao array (1 PR)
- ✅ Regras testáveis isoladamente
- ✅ Não bloqueia ação — só avisa
- ⚠️ 15 regras pode escalar para 50+ — em algum ponto vira módulo próprio
- ⚠️ Regras complexas (Simpson's paradox, viés de seleção) não cabem nesse pattern

---

## ADR-070 — Ask via regex parser (não LLM)

**Status:** Aceito · Bloco 8
**Contexto:** "Pergunte ao Solstice" do PROMPT poderia ser implementado com LLM, mas mesmas razões da ADR-067 se aplicam.
**Decisão:** Parser regex pt-BR reconhece **7 padrões** mapeando para `SolsticeStats.*`. Resolver de coluna aceita nome técnico OU friendlyName (case-insensitive, partial). Resposta inclui `formula` explicativa.
**Padrões reconhecidos:**
1. Agregação (`média/mediana/soma/máx/min/std de X`)
2. Outliers (`quantos outliers em X`)
3. Correlação (`correlação entre X e Y`)
4. Ranking (`top N em X [por Y]`)
5. Tendência (`tendência de X`)
6. Total (`quantos registros`)
7. Distinctos (`quantas categorias em X`)
**Falha gentilmente:** queries fora dos padrões recebem mensagem + sugestões.
**Consequências:**
- ✅ Offline, instantâneo, zero custo
- ✅ Determinístico, fácil de testar
- ⚠️ Cobre ~70% das perguntas executivas, não 100%
- ⚠️ Não entende variações criativas (ex: "tem outlier?" em vez de "quantos outliers em X")

---

## Decisões reversíveis (anotadas para futuro)

- **6 paletas hardcoded**: poderia ser editor visual de paleta (Bloco 12?)
- **3 slides de onboarding**: poderia ser tour interativo (Bloco 12 prevê)
- **Heurística com regex pt-BR/en**: outras línguas (es, fr) podem precisar — adicionar em ADR futuro se necessário
- **B7 Stats inline no main thread**: se Lucas testar com 500K+ linhas, mover para WebWorker
- **B7 Holt-Winters com hiperparâmetros fixos** (α=0.5, β=γ=0.3): aceitar PR para grid search se forecast ficar consistentemente ruim
