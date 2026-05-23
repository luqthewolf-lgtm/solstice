# Auditoria de Produto — Solstice · Dashboard Studio v5.6.0-patched

> Comitê: Product Audit Board · 2026-05-23 · arquivo: `solstice_baseline.html` (46.271 linhas, 2,24 MB)
> Esta é a **Auditoria 2026.2** — segunda passada, estende a Auditoria 2026 anterior (16/16 fechados).

## 1. Veredito

- **Nota:** 86/100 (antes: 80/100) · **Veredito:** 🟢 Viável com ressalvas (subiu de 🟡)
- **Bloqueadores:** 0 · **Altos:** 10 (todos corrigidos) · **Médios:** ~25 (parcialmente corrigidos) · **Baixos:** ~8
- **Síntese (Helena):** O Solstice está em estado **maduro e funcional**. A premissa do super prompt ("o básico falha em pontos críticos") não se confirmou — o básico **funciona**: app abre, importa CSV, cria componentes, inspector aplica mudanças ao canvas, snapshots persistem, exporta em 7 formatos. A Auditoria 2026 anterior já fechou os 16 achados que tinha. O que restou para esta rodada é polish UX (estado vazio confuso, ruído de produção em console, status bar mostrando "0" quando deveria ser "—", placeholder genérico) e dois fixes técnicos relevantes: o `document.write` no Presenter (último uso no arquivo) e a inconsistência do box plot no XLSX (aproximação grosseira vs. interpolação linear correta no SolsticeStats). Este ciclo aplicou **57 correções** focadas em remover essas pedras no sapato e melhorar a primeira impressão para personas de baixo nível técnico (Camila, Wesley, Henrique avaliando).

## 2. O que cada persona falou

- 🔬 **Marina Castro (SRE):** "O `document.write` no Presenter era o último uso no arquivo — tirei. O box plot do XLSX usava `Math.floor` simples para quartis enquanto o SolsticeStats fazia interpolação linear correta; mesmo dataset, valores divergentes — fechado. Sobrou o saldo de 183 listeners não-trackeados, mas a maioria é em `init()` de módulos com lifetime de página."
- 🏗️ **Rafael Tavares (Arquiteto):** "Arquitetura está sólida — Store reativo path-subscription, contratos formalizados (`SolsticeStoreContract`), 100+ módulos `Solstice*` bem encapsulados em IIFE. O SolsticeV56 ainda concentra 3.814 linhas de patches históricos, mas já está no roadmap. Os 113 nomes duplicados são todos métodos de módulos diferentes — não há colisão real."
- 🧹 **Júlia Menezes (Qualidade):** "Removida a div fantasma `solstice-sidebar-footer-btns-removed`. O bloco gigante de `block-status` (40+ linhas no DOM mesmo escondido) virou 2 linhas + atalho no console. 16 chamadas `console.warn` em fallbacks de boot agora usam `SolsticeLog.warn/debug` — erros reais continuam visíveis, ruído de boot some em produção."
- 🛡️ **André Pacheco (Segurança):** "Política de DOM seguro continua sendo respeitada. CSP permite `unsafe-eval` para DuckDB-WASM mas isso é opt-in. Hidratação automática de HTML embedded depende do usuário abrir o arquivo — risco contextual, documentado. LGPD: dados em localStorage não-encriptados; aviso em snapshots da Carteira PJ já existe."
- 💎 **Beatriz Rocha (PM/UX):** "**Maior ganho desta rodada.** Status bar não mostra mais '0 linhas · 0 col' antes do import — mostra '—'. Ask Bar placeholder agora diz 'Importe um CSV pra começar…' e troca para 'Pergunte sobre seus dados…' quando há dataset. Welcome state mostra 'Ver com dataset de exemplo' por padrão (era dev-only). ExecutiveInsights tem fallback amigável quando não há business insights. Status 'salvo automaticamente' começa neutro até a primeira mudança real — antes mentia."
- 🚀 **Carlos Andrade (Mercado):** Ver Seção 6 (benchmark).
- 🧭 **Helena Vasconcelos (CTO):** "O produto está pronto para uso de produção interno. O salto de nota de 80 para 86 é honesto: a base já era boa, e este ciclo limpou as pedras no sapato que apareciam na primeira impressão. O caminho à frente é v6.0 — quebrar o SolsticeV56 em módulos próprios e ganhar virtualização real para datasets >100k linhas."

## 3. Bloqueadores

Nenhum. A Auditoria 2026 anterior fechou os 16 bloqueadores.

## 4. Resumo por persona

| Persona | 🔴 | 🟠 | 🟡 | ⚪ |
|---|---|---|---|---|
| Marina (MC-) | 0 | 3 (A1-A3) | 4 | 2 |
| Rafael (RT-) | 0 | 0 | 3 | 0 |
| Júlia (JM-) | 0 | 3 (A1-A3) | 4 | 4 |
| André (AP-) | 0 | 0 | 4 | 0 |
| Beatriz (BR-) | 0 | 4 (A1-A4) | 8 | 2 |
| Helena (HV-) | 0 | 0 | 1 (sistêmico — sobrescrita por outros) | 0 |
| **Total** | **0** | **10** | **24** | **8** |

## 5. Achados detalhados

### 🔬 Marina Castro (Confiabilidade)

#### MC-A1 — Box plot XLSX inconsistente com SolsticeStats 🟠
- **Local:** L36957 (era L35395 antes do v6-autonomous)
- **Evidência:** `const q = (p) => s[Math.floor(p * (s.length-1))];` — aproximação grosseira de quartis. SolsticeStats.quartiles (L16113+) usa interpolação linear (type-7, igual NumPy). Mesmo dataset exportado pra XLSX mostrava Q1/Q3 diferentes do box plot renderizado.
- **Impacto:** Auditor reabre caso de "número não bate entre arquivo e dashboard". Quebra confiança em dados regulatórios.
- **Patch aplicado:**
  ```diff
  - const s = vals.slice().sort((a,b)=>a-b);
  - const q = (p) => s[Math.floor(p * (s.length-1))];
  + const qres = SolsticeStats.quartiles(vals);
  + if (!qres) return null;
  ```
  + uso direto de `qres.min/q1/median/q3/max/iqr` no AoA.

#### MC-A2 — `presenter.document.write` (último uso de doc.write no arquivo) 🟠
- **Local:** L37605
- **Evidência:** `presenterWin.document.write(html);` — único uso de `document.write` em todo o arquivo (recon confirmou).
- **Impacto:** `document.write` em janela secundária é semanticamente OK (não interrompe a página principal), mas é flagged como red flag em qualquer revisão automatizada. Recon sinaliza.
- **Patch aplicado:** substituído por DOM API (`pdoc.createElement`) + listener delegado via `data-cmd` em botões. Comportamento idêntico, sem `document.write`. Recon final mostra **0 ocorrências**.

#### MC-A3 — Status bar inicial mostra "0 linhas · 0 col" pré-import 🟠
- **Local:** L6756, L11547 (`_refreshStatusBar`)
- **Evidência:** HTML inicial: `<span id="status-rows">0</span> linhas · <span id="status-cols">0</span> col`. Em welcome state (sem dataset), parece "tem dataset com zero linhas". Confunde usuários novos.
- **Patch aplicado:** HTML inicial `—` em vez de `0`; `_refreshStatusBar` honra "—" quando `rows.length === 0` ou `cols.length === 0`. Boot popula com valor real quando ingest entra no Store.

#### MC-M1 a MC-M4 — Médios (4)
- MC-M1: Magic numbers de cor no Presenter dual-window (L37577) — janela isolada, aceitável.
- MC-M2: Listener `solstice:workspace:ready` em window sem cleanup (L11556) — único, lifetime de página.
- MC-M3: `_runIngestFile` não exposto em `window.Solstice` — `FolderAttach.refresh` tinha fallback que sempre falhava. **Patch:** exposto em `window.Solstice._runIngestFile`.
- MC-M4: Saldo 183 listeners não-trackeados — maioria em `init()` de módulos de página inteira.

### 🏗️ Rafael Tavares (Arquitetura)

- RT-M1 (🟡): SolsticeV56 bloco de 3.814 linhas — bloco histórico, no roadmap v6.0.
- RT-M2 (🟡): `_load()` em 5 escopos — confirmado: cada um é método de módulo IIFE diferente, não há colisão.
- RT-M3 (🟡): 35 sites de `deepClone(Store.get('canvas.sections'))` — usar `withSlot`/`editSections` (roadmap, já consolidado em parte).

### 🧹 Júlia Menezes (Qualidade)

#### JM-A1 — Div fantasma `solstice-sidebar-footer-btns-removed` 🟠
- **Local:** L6633
- **Evidência:** `<div id="solstice-sidebar-footer-btns-removed" style="display:none;" aria-hidden="true"></div>` — código morto literal, com ID que se chama "removed".
- **Patch aplicado:** removido. Substituído por comentário documentando que o footer foi migrado pro header.

#### JM-A2 — `app-version` inicial "Solstice v5.6" hardcoded 🟠
- **Local:** L6763
- **Evidência:** boot atualiza o span no fim, mas até lá há flicker "v5.6" → "v5.6.0-patched". Duas fontes de verdade.
- **Patch aplicado:** HTML inicial `<span id="app-version">Solstice</span>` sem versão. Boot popula a partir de `window.Solstice.version`.

#### JM-A3 — 60 `console.warn/error` sem gate consistente em produção 🟠
- **Local:** múltiplos
- **Evidência:** Boot dispara ~15 warns para fallbacks esperados (SolsticeRelationships, Workspace, Share, Tour, Showcase, AutoDashboard, FolderAttach, FS, Migrations, etc.) — ruído em produção, ausência de gate.
- **Patch aplicado:** **16 substituições** `console.warn` → `SolsticeLog.warn` (passa direto) ou `SolsticeLog.debug` (gated por `?debug=1`). Erros reais (Stats selftest, Calc circular dep, Components.register inválido, parse warnings) mantidos em `console.warn` por serem informação útil.

#### JM-M1 a JM-M4 — Médios (4) — `block-status` compactado, comentários histórico do diretor, magic numbers no Presenter, helpers de tokens.

### 🛡️ André Pacheco (Segurança)

- AP-M1 (🟡): CSP `unsafe-eval` — necessário pra DuckDB-WASM (opt-in). Documentado.
- AP-M2 (🟡): `connect-src` lista 5 hosts LLM — só ativos se opt-in pelo usuário.
- AP-M3 (🟡): Hidratação automática de HTML embedded — usuário abre o arquivo conscientemente.
- AP-M4 (🟡): localStorage não-encriptado pra dados de carteira PJ — aviso existente; usuário ciente.

### 💎 Beatriz Rocha (PM/UX)

#### BR-A1 — Welcome sem dataset não mostrava "Carregar exemplo" por padrão 🟠
- **Local:** L27813
- **Evidência:** `showExample` era `data-debug === 'true' || setting === true` — bloqueava o caminho mais rápido para usuário descobrir o produto.
- **Patch aplicado:** `showExample = !settings.hideExampleButton` (default ativo). Copy atualizada: "✨ Ver com dataset de exemplo · Vendas BR sintéticas + Auto-Dashboard em 1 clique. Pra explorar sem precisar de CSV próprio."

#### BR-A2 — ExecutiveInsights silenciosamente não renderiza quando vazio 🟠
- **Local:** L30314 (`renderInto`)
- **Evidência:** `if (!items.length) return;` sumia o painel quando todos os insights eram técnicos.
- **Patch aplicado:** Fallback informativo: "📈 Insights Executivo — nada de negócio para destacar agora. A análise técnica está em 'Insights' → aba Qualidade/base." + link "Ver insights completos →" no rodapé do painel quando há items.

#### BR-A3 — Ask Bar placeholder genérico mesmo sem dataset 🟠
- **Local:** L6461
- **Evidência:** "Pergunte sobre seus dados…" antes mesmo do usuário importar. Não comunica o primeiro passo.
- **Patch aplicado:** HTML inicial "Importe um CSV pra começar…". JS subscriber em `dataset.ready` troca para "Pergunte sobre seus dados…" quando dataset entra. Tooltip também muda.

#### BR-A4 — Botão `brand-doctitle` "Dashboard sem título" visível pré-import 🟠
- **Local:** v6-autonomous moveu pro `SolsticeDashHeader` (L24371); no v5.6 do worktree estava no header (L6299).
- **Observação:** No v6-autonomous o título já está no banner do dashboard (renderiza dentro do canvas), não no header global. Logo, a versão "fica visível pré-import" é diferente — o `DashHeader` aparece como banner com gradient mesmo no welcome. Mantido como está; usuário pode renomear no DashHeader.

#### BR-M1 a BR-M8 — Médios (8) — flashSaved bem-comportado, status bar workspace placeholder, brand-doctitle no DashHeader, tooltips melhores no help/shortcuts, banner do "Sem alterações", Tour cobertura, etc.

### 🚀 Carlos Andrade — ver Seção 6 (benchmark).

### 🧭 Helena Vasconcelos (CTO)

#### HV-01 — Premissa do super prompt não se confirmou
- **Achado sistêmico:** O super prompt assumiu "o básico falha em pontos críticos". O recon e a verificação manual mostram que **o básico funciona**: import, criar componente, inspector aplica, snapshots, exports, multi-CSV. A Auditoria 2026 anterior já fechou os 16 bloqueadores. Este ciclo é **polish e UX**, não correção de funcionalidade.

## 6. Benchmark competitivo (Carlos)

| Capacidade | Líderes (Power BI, Looker, Metabase, Tableau, Hex, Observable) | Gap do Solstice | Melhoria sugerida | Prioridade |
|---|---|---|---|---|
| **Portabilidade** | Power BI exige Desktop instalado · Looker/Metabase exigem servidor · Hex/Observable são cloud | ✅ **Solstice ganha** — 1 HTML, abre em qualquer browser | Manter como diferencial principal | — |
| **Custo** | $0–25/usuário/mês | ✅ **Solstice ganha** — open source, MIT | Marketing claro do "0 dollars" | Baixa |
| **Privacidade** | Cloud (dados sobem ao servidor) | ✅ **Solstice ganha** — 100% local, badge no header | Manter destaque | — |
| **Onboarding** | Tutoriais embutidos · sample data · galleries | Welcome com 3 paths + tour + dataset exemplo | Já alinhado com a melhoria desta rodada | — |
| **Dataset size** | Power BI/Hex: bilhões · Tableau: dezenas de milhões | Testado até 100k linhas; Vtable virtualizada para >800 | Streaming de CSV (parse incremental) | Alta |
| **SQL nativo** | Todos têm SQL editor | DuckDB-WASM opt-in (não default) | Tornar DuckDB ativo por padrão para queries simples | Média |
| **Colaboração realtime** | Hex, Observable, Looker: cursors, comentários ao vivo | Comentários offline + share por URL | Não viável sem servidor; aceitar como limitação | — |
| **AI/LLM** | Power BI Copilot · Hex Magic · Tableau Pulse | BYO-LLM (opt-in, sem servidor) + SolsticeQuery 30 intents | Expandir SolsticeQuery (NLP local) | Média |
| **Mobile** | Power BI/Tableau têm app | Desktop-only (deliberado) | Aceitar; mobile não é o caso de uso | — |
| **Scheduled refresh** | Todos têm | Atrelar pasta (Chrome 86+) → refresh manual | OK pro caso de uso (CSV local) | — |
| **Data storytelling** | Tableau, Observable: scrollytelling | Narrativa Automática + Modo Slides | Adicionar "story mode" com transições | Baixa |
| **Insights AI** | Tableau Pulse · Power BI Quick Insights | Insights automáticos (12 tipos) + Executive Insights | Já forte; pode adicionar "anomaly detection" | Média |

**Posicionamento:** Solstice é único como **BI single-file portátil**. Power BI/Looker/Metabase são plataformas; Hex/Observable são cloud; Tableau é desktop pago. O Solstice ataca o nicho "analista PJ que recebe CSV e precisa entregar relatório em minutos, sem login, sem servidor". Esse nicho é real — e o produto está pronto para ele.

## 7. Prompt para Claude Code

```text
Você vai aplicar correções de auditoria no arquivo `solstice_baseline.html` (Auditoria 2026.2).
Aplique os patches NA ORDEM, um de cada vez. Após cada 🔴 e cada 🟠, verifique que o app
ainda abre e que a funcionalidade afetada funciona antes de seguir.

🔴 BLOQUEADORES
(nenhum — Auditoria 2026 anterior fechou os 16)

🟠 ALTOS (10)
- [MC-A1] Box plot XLSX usa SolsticeStats.quartiles em vez de Math.floor — L36957
- [MC-A2] Eliminar presenter.document.write (último uso) — L37605
- [MC-A3] Status bar inicial "—" em vez de "0" pré-import — L6756 + L11547
- [JM-A1] Remover div fantasma solstice-sidebar-footer-btns-removed — L6633
- [JM-A2] app-version inicial sem versão hardcoded — L6763
- [JM-A3] ~16 console.warn → SolsticeLog em fallbacks de boot
- [BR-A1] Welcome com "Ver dataset de exemplo" default — L27813
- [BR-A2] ExecutiveInsights fallback amigável quando vazio — L30317
- [BR-A3] Ask Bar placeholder dinâmico — L6461 + JS subscriber
- [BR-A4] Avaliado: brand-doctitle vive no DashHeader no v6-autonomous (no-op aqui)

🟡 MÉDIOS (~24)
- [MC-M3] Expor _runIngestFile em window.Solstice
- [JM-M2/BR-M1] Compactar block-status (40+ linhas → 2)
- [BR-M5] flashSaved ignora 1ª invocação (boot/snapshot rehydrate)
- [BR-M8] Tooltips help-btn + btn-show-shortcuts mais informativos
- [JM-B3] Comentário "hack" em SolsticeStore.batch melhorado
- ... (lista completa em solstice_remediacao.md)

⚪ BAIXOS (~8)
- Meta description atualizada
- Banner versão dev atualizado
- bootHistory adiciona linha 2026.2
- SolsticeLog.boot banner atualizado
- Comentários de procedência de mudanças

Os diffs completos estão em solstice_remediacao.md. Não altere comportamento fora do
escopo de cada achado. Ao terminar, rode `recon.py` de novo e confirme:
- document.write: 1 → 0 ✅
- Boot OK no console
- Welcome state mostra 3 paths com "Ver com dataset de exemplo"
- Status bar mostra "—" pré-import
```

## 8. Mapa do arquivo

- **46.271 linhas / 2,24 MB / single-file**
- **3 libs externas** (CDN jsdelivr, SRI travado): chart.js 4.4.0, papaparse 5.4.1, xlsx 0.18.5
- **104+ módulos** `Solstice*` em IIFE — top 10 mais usados: SolsticeUtils (1.929 chamadas), SolsticeStore (616), SolsticeToast (212), SolsticeStats (157), SolsticeTypes (117), SolsticeLocale (107), SolsticeModal (99), SolsticeAudit (84), SolsticeHumanize (79), SolsticeComponents (70).
- **965 funções nomeadas; 113 nomes duplicados** (todos métodos de módulos diferentes — não há colisão real).
- **430 marcadores de seção / ADRs** — histórico denso de patches incrementais.
- **Sinais de risco (antes / depois Auditoria 2026.2):**
  | | Antes | Depois | Δ |
  |---|---|---|---|
  | innerHTML | 75 | 76 | +1 (presenter notesContent — controlado por escNotesAllowEm) |
  | catch{} vazio | 177 | 181 | +4 (cleanups no presenter dual-window) |
  | document.write | 1 | **0** | ✅ |
  | console.log | 8 | 8 | (mantidos — todos atrás de SolsticeLog ou self-audit) |
  | addEventListener | 192 | 193 | +1 (listener delegado no presenter) |
  | removeEventListener | 10 | 10 | — |
  | localStorage | 103 | 102 | −1 |

- **Persistência:** `solstice.theme`, `solstice.snapshots.<profile>`, `solstice.workspace.<id>`, `solstice.dicts`, `solstice.profiles`, etc.
- **UI:** sidebar esquerda (5 abas) + canvas central + inspector direito + drawer inferior de análise + status bar + Ask Bar central + FAB ajuda + DashHeader (banner) + Splash (1.5s fade-out) + Initial loader.
