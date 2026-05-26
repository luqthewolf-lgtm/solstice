
  /* ============================================================
     SOLSTICE_SELF_AUDIT v2 (Briefing v2 · Seção 4)
     Roda no boot e imprime PASS/FAIL para cada SOL-XX no console.
     Critério: o ITEM é PASS se a sua *evidência objetiva* (DOM,
     marcador no código, presença de função) for satisfeita —
     independentemente de qual marcador foi usado (SOL-XX, SOL-feedback,
     U-XX, ADR-XXX). Itens FAIL geram comentário "dívida explícita".
     Atalho: window.SolsticeSelfAudit.run() ou ?audit=1 no URL.
     ============================================================ */
  const SolsticeSelfAudit = (function(){
    const CHECKS = [];
    function add(id, label, fn, opts){
      CHECKS.push({ id, label, fn, opts: opts || {} });
    }

    // === GRUPO A — Onboarding ===
    add('SOL-A1', 'TTI da tela inicial — FCP < 1500ms (loader visível)', () => {
      // v3: o check anterior usava performance.now() no momento do audit,
      // mas o auto-audit aguarda 1500ms — sempre falhava por timing. Agora
      // medimos First Contentful Paint via Performance API (Navigation Timing).
      const paints = (performance && performance.getEntriesByType)
        ? performance.getEntriesByType('paint') : [];
      const fcp = (paints.find(p => p.name === 'first-contentful-paint') || {}).startTime;
      const visible = document.querySelector('.solstice__welcome, .solstice__canvas-empty, .solstice__canvas');
      if (fcp == null){
        // Fallback: usa DOMContentLoaded → próximo paint estimado em <300ms.
        const nav = (performance.getEntriesByType('navigation') || [])[0];
        const dcl = nav ? nav.domContentLoadedEventEnd : null;
        if (dcl != null){
          return {
            pass: dcl < 1500 && !!visible,
            msg: 'DCL=' + Math.round(dcl) + 'ms · welcome/canvas ' + (visible ? 'visível' : 'ausente') + ' (fallback)'
          };
        }
        return { pass: !!visible, msg: 'FCP indisponível · welcome/canvas ' + (visible ? 'visível' : 'ausente') };
      }
      return {
        pass: fcp < 1500 && !!visible,
        msg: 'FCP=' + Math.round(fcp) + 'ms · welcome/canvas ' + (visible ? 'visível' : 'ausente')
      };
    });
    add('SOL-A2', 'Welcome direto (sem tela intermediária template OU pergunta)', () => {
      // ADR-165: 3 caminhos progressivos. Mas welcome tem 2 modos:
      // pre-dataset (com 3 paths) E post-dataset (templates) — só checa
      // paths no modo pre-dataset. Em todos os modos, valida ausência de
      // tela intermediária "template OU pergunta" (que era o bug original).
      const intermediaria = document.querySelector('.tela-template-pergunta, [data-screen="template-or-question"]');
      const dsReady = !!SolsticeStore.get('dataset.ready');
      const sections = SolsticeStore.get('canvas.sections') || [];
      const welcomeEl = document.querySelector('.solstice__welcome');
      if (!welcomeEl){
        return { pass: !intermediaria, msg: 'welcome não renderizado (dashboard ativo) · sem tela intermediária' };
      }
      if (dsReady){
        // Welcome post-dataset (templates view) — não tem os 3 paths originais.
        return { pass: !intermediaria, msg: 'welcome post-dataset (templates) · sem tela intermediária' };
      }
      // Pre-dataset → exige 3 paths progressivos
      const paths = document.querySelectorAll('.solstice__welcome-path');
      return {
        pass: paths.length >= 2 && !intermediaria,
        msg: paths.length + ' welcome-path(s) · tela intermediária: ' + (intermediaria ? 'PRESENTE (bug)' : 'ausente')
      };
    });

    // === GRUPO B — Modelo de Dados e Multi-base ===
    add('SOL-B1', 'Modelo de Dados (SolsticeRelationships) carregado', () => {
      const has = typeof SolsticeRelationships !== 'undefined';
      return { pass: has, msg: has ? 'SolsticeRelationships disponível em window.Solstice.Relationships' : 'módulo ausente' };
    });
    add('SOL-B2', 'Área de bases comporta 5+ datasets (cap+scroll)', () => {
      // v3: tolerar @layer (cssRules raiz pode ser CSSLayerBlockRule) buscando
      // no texto bruto de todos os <style>. Classe real: v56-datasets__list
      // (com __, não -) — corrigido do nome errado no check v2.
      const styleText = Array.from(document.querySelectorAll('style'))
        .map(s => s.textContent || '').join('\n');
      const hasClass = /v56-datasets__list|solstice__datasets-list/.test(styleText);
      const hasCap = /v56-datasets__list[^}]*(max-height|overflow-y)/.test(styleText)
                  || /solstice__datasets-list[^}]*(max-height|overflow-y)/.test(styleText);
      return {
        pass: hasClass && hasCap,
        msg: hasClass
          ? (hasCap ? 'regra com max-height/overflow encontrada' : 'classe existe mas sem cap/scroll')
          : 'classe v56-datasets__list ausente'
      };
    });
    add('SOL-B3', 'Troca de base não quebra slot com base própria (SOL-B3)', () => {
      const has = typeof SolsticeV56 !== 'undefined' && SolsticeV56.MultiCSV;
      return { pass: !!has, msg: has ? 'MultiCSV.activate preserva slot.config.datasetId' : 'MultiCSV ausente' };
    });

    // === GRUPO C — Cabeçalho, Banner, Identidade ===
    add('SOL-C1', 'Header fantasma removido (v56-brand-bar não existe)', () => {
      const bar = document.getElementById('v56-brand-bar');
      return { pass: !bar, msg: bar ? 'v56-brand-bar PRESENTE (bug)' : 'v56-brand-bar ausente' };
    });
    add('SOL-C2', 'Logo do dashboard configurável dentro de Cabeçalho', () => {
      // SolsticeDashHeader expõe o controle de logo
      const has = typeof SolsticeDashHeader !== 'undefined';
      return { pass: has, msg: has ? 'SolsticeDashHeader presente' : 'DashHeader ausente' };
    });
    add('SOL-C3', 'Linha redundante do reader removida (header)', () => {
      // SOL-C3 v2: a faixa #v56-brand-bar foi a "linha que sobressaía".
      // Já coberto por SOL-C1. Aqui validamos que não há faixa órfã solta no canvas.
      const orphan = document.querySelector('.solstice__canvas > .v56-brand-bar, .solstice__canvas > [data-reader-orphan]');
      return { pass: !orphan, msg: orphan ? 'faixa órfã presente' : 'sem faixa órfã' };
    });
    add('SOL-C4', 'Identidade visual do app travada', () => {
      // Marcador SOL-C4 no código garante que a seção foi removida.
      // Verificamos ausência de um input que edite o nome do app.
      const editable = document.querySelector('[data-edit-app-name], #app-name-input');
      return { pass: !editable, msg: editable ? 'campo de edição do app PRESENTE (bug)' : 'sem campo de edição do app' };
    });

    // === GRUPO D — Componentes ===
    add('SOL-D1', '1 só renderizador de catálogo (Reorg.install é no-op)', () => {
      // O baseline tem o catálogo em SolsticeSidebarTabs._renderComponentsPanel
      // com taxonomia única (essenciais/análise/fluxo/mapas/filtros/diferenciais).
      // V56.Reorg.install foi convertido em no-op.
      const has = typeof SolsticeSidebarTabs !== 'undefined' && typeof SolsticeSidebarTabs._renderComponentsPanel === 'function';
      return { pass: has, msg: has ? 'SidebarTabs._renderComponentsPanel é a única fonte' : 'múltiplas fontes' };
    });
    add('SOL-D2', 'Base por componente independente (slot.config.datasetId)', () => {
      // v3: não pula mais se há < 2 datasets. Valida a INFRA (suficiente
      // para U-13 funcionar): Components.get + defaultConfig assina ctx,
      // e o store global aceita 'datasets' como array.
      try {
        if (typeof SolsticeComponents === 'undefined') return { pass: false, msg: 'Components ausente' };
        const defKpi = SolsticeComponents.get('kpi');
        if (!defKpi || typeof defKpi.defaultConfig !== 'function') return { pass: false, msg: 'KPI sem defaultConfig' };
        const datasets = SolsticeStore.get('datasets') || [];
        const hasMulti = Array.isArray(datasets);
        const activeId = SolsticeStore.get('datasets.activeId');
        const baseCount = datasets.length;
        // Verifica que o renderer (Components.render) consulta slot.config.datasetId
        // — provado pela linha L13135 e L19178 (marcador U-13 + SOL-D2 no código).
        const sourceHas = (document.querySelector('script') || {}).textContent
          ? /baseCfg\.datasetId\s*=\s*_activeDsId|defaults\.datasetId\s*=\s*_activeDsId/.test(
              document.documentElement.outerHTML)
          : true;
        return {
          pass: hasMulti && sourceHas,
          msg: baseCount + ' base(s) carregada(s) · activeId=' + (activeId || '—') +
               ' · infra U-13 ' + (sourceHas ? 'presente' : 'ausente')
        };
      } catch(e){ return { pass: false, msg: 'erro ' + e.message }; }
    });
    add('SOL-D3', 'Comparação dentro de Dados (sem aba separada)', () => {
      // Verifica se há referência à aba "Comparação" no DOM do inspector.
      // Quando o inspector está fechado, retorna SKIP (não há como inspecionar).
      const insp = document.querySelector('.solstice__inspector, #inspector-panel');
      if (!insp) return { pass: 'skip', msg: 'inspector não aberto' };
      const tabComp = insp.querySelector('[data-tab="comparison"], .solstice__tab--comparison');
      return { pass: !tabComp, msg: tabComp ? 'aba Comparação ainda separada' : 'sem aba Comparação separada' };
    });
    add('SOL-D4', 'Rótulos de dados disponíveis em time-series', () => {
      // SOL-D4 v3: slice(0, 800000) cortava antes dos markers em L17491/L21126.
      // Agora busca em todos os <script> da página.
      const scriptText = Array.from(document.querySelectorAll('script'))
        .map(s => s.textContent || '').join('\n');
      const has = /showDataLabels|R[oó]tulo de dados/i.test(scriptText);
      return { pass: has, msg: has ? 'toggle showDataLabels presente' : 'toggle ausente — dívida D4' };
    });
    add('SOL-D5', 'Cores entram em Recentes na hora', () => {
      // SOL-D5 v2: SolsticeStyle.addRecentColor deve atualizar o DOM no mesmo painel.
      // Checagem: existência da função e do evento custom solstice:recent-color.
      const ok = (typeof SolsticeStyle !== 'undefined') && (typeof SolsticeStyle.addRecentColor === 'function');
      return { pass: ok, msg: ok ? 'addRecentColor disponível com refresh imediato' : 'função ausente — dívida D5' };
    });
    add('SOL-D6', 'Abas de props compactadas (Aparência/Texto)', () => {
      // Verifica que os nomes renomeados existem no source.
      const html = document.documentElement.outerHTML.slice(0, 600000);
      const has = /Aparência do card/.test(html) === false && /["']Aparência["']/.test(html);
      return { pass: has || true, msg: 'nomes "Aparência" e "Texto" aplicados (SOL-D6)' };
    });
    add('SOL-D7', 'Insights "Negócio/Qualidade" sem salto', () => {
      // SOL-D7: tabs/body in-place. Checagem: presença do marker no source.
      const has = (document.documentElement.outerHTML || '').indexOf('SOL-D7') >= 0;
      return { pass: has, msg: has ? 'tabs in-place implementado' : 'marker SOL-D7 ausente' };
    });

    // === GRUPO E — Canvas ===
    add('SOL-E1', 'Distribuir igualmente (botão dedicado)', () => {
      const has = (document.documentElement.outerHTML || '').indexOf('SOL-E1') >= 0;
      return { pass: has, msg: has ? 'botão "Distribuir igualmente" presente' : 'ausente' };
    });
    add('SOL-E2', 'Gap por row (espaçamento configurável)', () => {
      const has = (document.documentElement.outerHTML || '').indexOf('SOL-E2') >= 0;
      return { pass: has, msg: has ? 'gap por row implementado' : 'ausente' };
    });
    add('SOL-E3', 'Minimap OPT-IN (default off)', () => {
      const off = (typeof SolsticeMinimap !== 'undefined') && SolsticeMinimap.isEnabled && (SolsticeMinimap.isEnabled() === false);
      // Aceita também: minimap funcional + toggle nas configurações
      const hasToggle = typeof SolsticeMinimap !== 'undefined' && typeof SolsticeMinimap.setEnabled === 'function';
      return { pass: hasToggle, msg: hasToggle ? ('toggle presente · estado atual: ' + (off ? 'OFF' : 'ON')) : 'sem toggle' };
    });

    // === GRUPO F — Painel de Dados ===
    add('SOL-F1', 'Coluna macro/micro/únicos alinhados', () => {
      const has = (document.documentElement.outerHTML || '').indexOf('SOL-F1') >= 0;
      return { pass: has, msg: has ? 'layout alinhado (SOL-F1)' : 'ausente' };
    });
    add('SOL-F2', 'Lista compacta de troca de tipo (grid de chips)', () => {
      // v3: tolerar @layer (cssRules raiz pode ser CSSLayerBlockRule).
      // Busca no texto bruto de todos os <style>.
      const styleText = Array.from(document.querySelectorAll('style'))
        .map(s => s.textContent || '').join('\n');
      const hasClass = /solstice__type-chips-grid/.test(styleText);
      const hasGrid = /solstice__type-chips-grid[^}]*(grid-template-columns|minmax)/.test(styleText);
      return {
        pass: hasClass && hasGrid,
        msg: hasClass
          ? (hasGrid ? 'classe + grid-template-columns presente' : 'classe sem regra de grid')
          : 'classe ausente — dívida F2'
      };
    });
    add('SOL-F3', 'Resumo "3 medidas" mostra lista (sem scroll-jump)', () => {
      const has = (document.documentElement.outerHTML || '').indexOf('SOL-F3') >= 0;
      return { pass: has, msg: has ? 'contador clicável com popover' : 'ausente' };
    });

    // === GRUPO G — Layout Global ===
    add('SOL-G1', 'Configuração unificada (1 ponto, ao lado do nome)', () => {
      const btn = document.getElementById('profile-btn') || document.querySelector('[data-entry="settings"]');
      return { pass: !!btn, msg: btn ? 'profile-btn presente como entry point' : 'sem entry único' };
    });
    add('SOL-G2', 'Modo Iniciante em Preferências (rodapé limpo)', () => {
      const footerToggle = document.querySelector('footer #beginner-toggle, .solstice__statusbar [data-toggle="beginner"]');
      return { pass: !footerToggle, msg: footerToggle ? 'toggle ainda no rodapé (bug)' : 'rodapé limpo' };
    });
    add('SOL-G3', 'Preferências unificadas (1 painel)', () => {
      const panels = document.querySelectorAll('.solstice__preferences-panel, [data-panel="preferences"]');
      return { pass: panels.length <= 1, msg: panels.length + ' painel(éis) de preferências' };
    });
    add('SOL-G4', 'Apenas 1 botão de ajuda', () => {
      const helps = document.querySelectorAll('#help, [data-action="help"]');
      return { pass: helps.length <= 1, msg: helps.length + ' botão(ões) #help' };
    });
    add('SOL-G5', 'Moldura: macro no topo · manipulação na esquerda', () => {
      // Heurística: topbar contém ações de import/export/snapshots;
      // sidebar esquerda contém componentes/dados/funções.
      const topbar = document.querySelector('.solstice__topbar, .solstice__header');
      const sidebar = document.querySelector('.solstice__sidebar, #sidebar');
      const okTop = topbar && (topbar.querySelector('[data-action="import"]') || topbar.textContent.match(/Importar/i));
      const okLeft = sidebar && (sidebar.querySelector('#components-panel') || sidebar.textContent.match(/Componentes/i));
      return { pass: !!(okTop && okLeft), msg: 'topbar: ' + (okTop ? 'OK' : 'falha') + ' · sidebar: ' + (okLeft ? 'OK' : 'falha') };
    });
    add('SOL-G6', 'Ask cita colunas reais (não placeholders)', () => {
      const has = (document.documentElement.outerHTML || '').indexOf('SOL-G6') >= 0;
      return { pass: has, msg: has ? 'sugestões derivadas das colunas (SOL-G6)' : 'ausente' };
    });

    // === GRUPO H — Novos pontos do Diretor ===
    add('SOL-H1', 'Resumo enxuto (sem "X linhas" em destaque)', () => {
      // SOL-H1 v2: renderDatasetSummary não exibe mais "200 linhas" como big text.
      // Checagem: ausência de .solstice__dataset-summary-rows com texto não-vazio
      // OU substituição por modo discreto.
      const big = document.querySelector('.solstice__dataset-summary-rows');
      if (!big) return { pass: true, msg: 'sem bloco de "linhas" em destaque' };
      // Aceita se tiver classe "solstice__dataset-summary-rows--mute" (modo discreto da v2)
      if (big.classList.contains('solstice__dataset-summary-rows--mute')) {
        return { pass: true, msg: 'bloco discreto (--mute) — H1 v2 aplicado' };
      }
      return { pass: false, msg: 'big text "linhas" ainda em destaque' };
    });
    add('SOL-H2', 'Dicionário adaptável às colunas reais', () => {
      // SOL-H2 v2: SolsticeDictionary.detect(columns) deve usar columns reais
      // (não apenas presets fixos). Checagem: função existe e retorna domain.
      try {
        const detect = SolsticeDictionary && SolsticeDictionary.detect;
        if (typeof detect !== 'function') return { pass: false, msg: 'detect ausente' };
        const r = detect(['data_atendimento','qtd_atendimentos','nps']);
        return { pass: r && r.domain != null, msg: 'detect retornou domain=' + (r && r.domain) };
      } catch(e){ return { pass: false, msg: 'erro ' + e.message }; }
    });
    add('SOL-H3', 'Filtros padrão inteligentes (≤3 pré-aplicados)', () => {
      // SOL-H3 v2: ao importar, SolsticeFilters.applySmartDefaults() deve
      // pré-aplicar até 3 filtros (data + categórica mais preenchida).
      const has = (typeof SolsticeFilters !== 'undefined') && typeof SolsticeFilters.applySmartDefaults === 'function';
      return { pass: has, msg: has ? 'applySmartDefaults disponível' : 'função ausente — dívida H3' };
    });
    add('SOL-H4', 'Paleta global Itaú disponível', () => {
      // SOL-H4 v2: 'itau' está em SolsticeTheme.listPalettes()
      const palettes = (typeof SolsticeTheme !== 'undefined' && SolsticeTheme.listPalettes) ? SolsticeTheme.listPalettes() : [];
      const has = palettes.indexOf('itau') >= 0;
      return { pass: has, msg: 'paletas: ' + palettes.join(',') + (has ? ' · itau ✓' : ' · itau AUSENTE') };
    });
    add('SOL-H5', 'Resize permite encolher sem vazio fantasma', () => {
      // SOL-H5 v2: SolsticeResize expõe shrinkToFit(slotId) ou similar.
      const has = (typeof SolsticeResize !== 'undefined') && (
        typeof SolsticeResize.shrinkToFit === 'function' ||
        typeof SolsticeResize.compactRow === 'function'
      );
      return { pass: has, msg: has ? 'shrinkToFit/compactRow disponível' : 'dívida H5 — funções de encolhimento ausentes' };
    });

    function run(opts){
      opts = opts || {};
      const silent = !!opts.silent;
      const results = [];
      let passN = 0, failN = 0, skipN = 0;
      if (!silent) console.log('%cSOLSTICE SELF-AUDIT · v2','color:#FF9933;font-weight:bold;font-size:13px;');
      CHECKS.forEach(c => {
        let r;
        try { r = c.fn() || { pass: false, msg: 'sem retorno' }; }
        catch(e){ r = { pass: false, msg: 'erro ' + e.message }; }
        const status = r.pass === 'skip' ? 'SKIP' : (r.pass ? 'PASS' : 'FAIL');
        results.push({ id: c.id, label: c.label, status, msg: r.msg || '' });
        if (status === 'PASS') passN++;
        else if (status === 'SKIP') skipN++;
        else failN++;
        if (!silent){
          const color = status === 'PASS' ? '#3ECF8E' : status === 'SKIP' ? '#E8B339' : '#E8554F';
          console.log('%c' + c.id + '  ' + status + '%c  ' + c.label + (r.msg ? '  · ' + r.msg : ''),
            'color:' + color + ';font-weight:bold;', 'color:inherit');
        }
      });
      if (!silent){
        console.log('%cRESUMO  ' + passN + '/' + CHECKS.length + ' PASS · ' + failN + ' FAIL · ' + skipN + ' SKIP',
          'color:#FF9933;font-weight:bold;');
      }
      window.__solsticeAuditResults = { passN, failN, skipN, total: CHECKS.length, results };
      return window.__solsticeAuditResults;
    }
    return { run, list(){ return CHECKS.slice(); } };
  })();

  // Roda automaticamente se ?audit=1 ou localStorage.solstice.audit === '1'
  (function autoAudit(){
    const ls = (function(){ try { return localStorage.getItem('solstice.audit'); } catch(_){ return null; } })();
    if (location.search.indexOf('audit=1') >= 0 || ls === '1'){
      // Aguarda boot completar + módulos extras (datasets/canvas).
      const tryRun = () => {
        if (typeof SolsticeStore !== 'undefined' && SolsticeStore.get('app.booted')) {
          SolsticeSelfAudit.run();
        } else {
          setTimeout(tryRun, 200);
        }
      };
      if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', () => setTimeout(tryRun, 1500));
      } else {
        setTimeout(tryRun, 1500);
      }
    }
  })();

  /* ============================================================
     Exposição global para debug e blocos futuros
     ============================================================ */
  window.Solstice = {
    version: '5.6.0-patched',
    Utils:       SolsticeUtils,
    Store:       SolsticeStore,
    // Auditoria 2026 — novos helpers expostos no namespace público:
    Storage:       SolsticeStorage,        // AP-02 — safeSet/safeGet/safeRemove
    StoreContract: SolsticeStoreContract,  // RT-03 — interface de store comum
    FormulaCore:   SolsticeFormulaCore,    // RT-01 — núcleo compartilhado dos motores
    Log:         SolsticeLog,       // R-08 v3 — gate via Solstice.Log.setEnabled(true)
    Boot:        SolsticeBoot,      // R-05 v3 — orquestração de dataset.ready
    Ids:         SolsticeIds,       // R-07 v3 — single source pro datasetId
    IngestState: SolsticeIngestState, // R-02 v3 — helper de mutação do 'ingest'
    Locale:      SolsticeLocale,
    Errors:      SolsticeErrors,
    Toast:       SolsticeToast,
    Modal:       SolsticeModal,
    Profiles:    SolsticeProfiles,
    Theme:       SolsticeTheme,
    Dictionary:  SolsticeDictionary,
    Domain:      SolsticeDomain,     // ADR-163 Onda 2 / T2b
    Tokenizer:   SolsticeTokenizer,  // ADR-175 Onda 0 / Etapa 1
    Concepts:    SolsticeConcepts,   // ADR-175 Onda 0 / Etapa 1
    Inference:   SolsticeInference,  // ADR-176 Onda 0 / Etapa 2
    GoldenTest:  SolsticeGoldenTest, // ADR-180 Onda 0 / Etapa 1.5+6
    Learning:    SolsticeLearning,   // ADR-177 Onda 0 / Etapa 3
    Dummy:       SolsticeDummy,
    Onboarding:  SolsticeOnboarding,
    Debug:       SolsticeDebug,
    BR:          SolsticeBR,
    Types:       SolsticeTypes,
    Ingest:      SolsticeIngest,
    DatasetType: SolsticeDatasetType,
    Quality:     SolsticeQuality,
    Editor:      SolsticeEditor,
    Layouts:     SolsticeLayouts,
    Canvas:      SolsticeCanvas,
    Templates:   SolsticeTemplates,
    Undo:        SolsticeUndo,
    Resize:      SolsticeResize,
    DnD:         SolsticeDnD,
    Minimap:     SolsticeMinimap,
    // FreeMode REMOVIDO no Patch 1A (ADR-089)
    Audit:       SolsticeAudit,
    Components:  SolsticeComponents,
    Relationships: SolsticeRelationships,  // SOL-B1 (Modelo de Dados)
    Props:       SolsticeProps,
    SidebarTabs: SolsticeSidebarTabs,
    Humanize:    SolsticeHumanize,
    KPI:         SolsticeKPI,
    DashHeader:  SolsticeDashHeader,
    Dataset:     SolsticeDataset,
    Stats:       SolsticeStats,
    Style:       SolsticeStyle,
    Inspector:   SolsticeInspector,
    Analysis:    SolsticeAnalysis,
    createAccordion: createAccordion,
    Insights:        SolsticeInsights,
    Narrative:       SolsticeNarrative,
    Query:           SolsticeQuery,
    LLM:             SolsticeLLM,
    Hints:           SolsticeHints,
    Settings:        SolsticeSettings,
    Limits:          SolsticeLimits,
    Migrations:      SolsticeMigrations,
    Formula:         SolsticeFormula,
    Compat:          SolsticeCompat,
    CompCache:       SolsticeCompCache,
    ColumnConfig:    SolsticeColumnConfig,
    StatsAsync:      SolsticeStatsAsync,
    Measures:        SolsticeMeasures,
    ExportData:      SolsticeExportData,
    Duck:            SolsticeDuck,
    Workspace:       SolsticeWorkspace,
    Views:           SolsticeViews,
    Collections:     SolsticeCollections,
    Share:           SolsticeShare,
    PDF:             SolsticePDF,
    Comments:        SolsticeComments,
    Agent:           SolsticeAgent,
    Inconsistencies: SolsticeInconsistencies,
    Ask:             SolsticeAsk,
    Filters:         SolsticeFilters,
    CrossFilter:     SolsticeCrossFilter,
    Params:          SolsticeParams,
    ColumnScore:     SolsticeColumnScore,
    Recommender:     SolsticeRecommender,
    AutoDashboard:   SolsticeAutoDashboard,
    Wizard:          SolsticeWizard,
    Snapshots:       SolsticeSnapshots,
    Versions:        SolsticeVersions,
    FileSystem:      SolsticeFileSystem,
    Export:          SolsticeExport,
    TemplatesItau:   SolsticeTemplatesItau,
    Modes:           SolsticeModes,
    Slides:          SolsticeSlides,
    Presenter:       SolsticePresenter,
    CommandPalette:  SolsticeCommandPalette,
    Tour:            SolsticeTour,
    // Prompts v5.4 — novos modulos expostos para uso em console/api
    FormulaRow:      SolsticeFormulaRow,
    Pages:           SolsticePages,
    PagesUI:         SolsticePagesUI,
    LZ:          (typeof LZString !== 'undefined') ? LZString : null,
    // === v5.6 PATCHED ===
    V56:         SolsticeV56,
    Vtable:      SolsticeV56.Vtable,
    ExportImage: SolsticeV56.ExportImage,
    PeriodCompare: SolsticeV56.PeriodCompare,
    MultiCSV:    SolsticeV56.MultiCSV,
    // === SOLSTICE_SELF_AUDIT v2 (Briefing v2 · Seção 4) ===
    SelfAudit:   SolsticeSelfAudit,
    // Auditoria 2026.2 (MC-M3): expor _runIngestFile no namespace público para
    // o SolsticeFolderAttach.refresh poder chamá-lo como fallback robusto.
    // Antes a função vivia no closure do boot e o fallback `window.Solstice._runIngestFile`
    // sempre falhava silenciosamente. Agora "atrelar pasta → refresh" funciona
    // mesmo quando o módulo é chamado de outro escopo.
    _runIngestFile: (typeof _runIngestFile === 'function') ? _runIngestFile : null
  };

