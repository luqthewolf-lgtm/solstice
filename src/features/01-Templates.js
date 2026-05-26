
  /* ============================================================
     SolsticeTemplates — 6 agnósticos + 6 domínio (condicionados ao dicionário)
     ============================================================ */
  const SolsticeTemplates = (function(){

    /** Helpers: criam estruturas serializáveis (sem id; addSection/applyTemplate cuidam disso). */
    function _row(layout){ return { layout: layout || '1col', slots: Array.from({ length: SolsticeLayouts.slotCount(layout || '1col') }, () => ({ type:'empty' })) }; }
    function _sec(title, ...rows){ return { title, rows }; }

    // === 6 AGNÓSTICOS — sempre disponíveis ===
    // Sprint 28: AGNOSTIC enriquecidos com 'kind' (tipo de análise pro Wizard
     // agrupar) e 'slotSpec' (tipo de componente pra cada slot). slotSpec[i]
     // corresponde ao i-ésimo slot na ordem em que aparecem nos rows. Quando
     // null, mantém empty pro user escolher manualmente.
    const AGNOSTIC = [
      {
        id:'kpi-trend', icon:'📊',
        name:'KPIs + Tendência',
        description:'4 indicadores chave em linha + gráfico de série temporal embaixo.',
        domain: null, kind: 'visao-geral',
        build: () => [_sec('Visão geral',
          _row('4col-equal'),
          _row('1col')
        )],
        slotSpec: ['kpi','kpi','kpi','kpi','time-series']
      },
      {
        id:'categories', icon:'📊',
        name:'Comparação de Categorias',
        description:'Barra horizontal ranqueando categorias + tabela com detalhes.',
        domain: null, kind: 'comparacao',
        build: () => [_sec('Comparação',
          _row('2col-2-1')
        )],
        slotSpec: ['distribution','table']
      },
      {
        id:'composition', icon:'🍰',
        name:'Composição',
        description:'Gráfico donut mostrando partes do todo + tabela detalhada.',
        domain: null, kind: 'composicao',
        build: () => [_sec('Composição',
          _row('2col-1-2')
        )],
        slotSpec: ['distribution','table']
      },
      {
        id:'distribution', icon:'📉',
        name:'Análise de Distribuição',
        description:'Histograma + box plot + estatísticas descritivas lado a lado.',
        domain: null, kind: 'distribuicao',
        build: () => [_sec('Distribuição',
          _row('3col-equal')
        )],
        slotSpec: ['distribution','distribution','kpi']
      },
      {
        id:'table-only', icon:'📋',
        name:'Tabela com Filtros',
        description:'Apenas tabela rica com filtros, sort e paginação. Mínimo viável.',
        domain: null, kind: 'tabela',
        build: () => [_sec('Dados',
          _row('1col')
        )],
        slotSpec: ['table']
      },
      {
        id:'correlation', icon:'🔍',
        name:'Correlação & Outliers',
        description:'Scatter com regressão linear + boxplot lado a lado. Identifique padrões e anomalias.',
        domain: null, kind: 'correlacao',
        build: () => [_sec('Análise bivariada',
          _row('2col-equal'),
          _row('1col')
        )],
        slotSpec: ['scatter','distribution','table']
      },
      {
        id:'time-evolution', icon:'📈',
        name:'Evolução Temporal',
        description:'Time-series + heatmap calendário + tendência sazonal. Visão completa de séries temporais.',
        domain: null, kind: 'evolucao',
        build: () => [_sec('Linha do tempo',
          _row('1col'),
          _row('2col-equal')
        )],
        slotSpec: ['time-series','heatmap-cal','kpi']
      }
    ];

    // Sprint 29: DOMAIN array zerado — user pediu pra enxugar; templates de
    // negócio (banco_pj/vendas/rh/marketing/operacional/cientifico) eram
    // redundantes com os AGNÓSTICOS quando as colunas são auto-mapeadas.
    // SolsticeTemplatesItau.init e MultiCSV podem ainda escrever aqui em
    // runtime — mantemos array vazio (não const-frozen) pra retrocompatibilidade.
    const DOMAIN = [];

    /**
     * UX2 v4 (Auditoria 2026.4): list() agora retorna SEMPRE todos os templates
     * (agnósticos + domínio). O openPicker separa "Sugeridos pra sua base"
     * (de domain que bate) vs "Gerais" (resto). Antes o usuário ficava preso
     * só nos templates do domínio detectado — não conseguia ver os agnósticos.
     */
    function list(){
      return [...AGNOSTIC, ...DOMAIN];
    }

    function getAll(){ return [...AGNOSTIC, ...DOMAIN]; }

    // ADR-164 (Onda 2 / T2d): remap automático de coluna_template → coluna_csv
    // via synonyms. Templates usam nomes TÉCNICOS (qtd_atendimentos); CSVs
    // reais podem ter "atendimentos", "tickets", "qtd_tickets" etc. Esta fn
    // varre todos os campos de coluna em slot.config e substitui pelo nome
    // real do CSV via SolsticeDomain.resolveColumn. Se não acha, marca o
    // slot com _unboundColumn para a UI poder pedir rebind manual.
    const _COL_KEYS = [
      'column', 'xColumn', 'yColumn', 'valueColumn',
      'sourceColumn', 'targetColumn', 'groupColumn', 'sizeColumn',
      'dateColumn', 'groupBy'
    ];
    /**
     * HOTFIX v5.5: remap melhorado em 2 etapas.
     * Lucas viu "Coluna inexistente" em todos os componentes do template Itaú
     * — synonyms do dicionário antigo não cobriam vocabulário do CSV real
     * (ex: "Qtd_Interacoes" não tinha synonym pra "qtd_atendimentos").
     *
     * Etapa 1: tenta SolsticeDomain.resolveColumn (synonyms tradicional).
     * Etapa 2 (FALLBACK NOVO): se synonyms falhar, classifica TARGET via
     *   SolsticeConcepts.get(template_anchor_or_match) → procura uma coluna
     *   do CSV que SolsticeInference classifique no MESMO conceito.
     *   Ex: template quer "qtd_atendimentos" (conceito 'quantidade').
     *   CSV tem "Qtd_Interacoes" (também classificado como 'quantidade'
     *   pelo Inference) → match por conceito.
     */
    function _resolveByConcept(target, ctx){
      if (typeof SolsticeConcepts === 'undefined' || typeof SolsticeInference === 'undefined') return null;
      // Identifica o conceito do TARGET (nome técnico do template).
      const targetTokens = SolsticeTokenizer ? SolsticeTokenizer.tokenize(target).tokens : [];
      let targetConcept = null;
      // Tenta achar conceito cujos anchors batem com tokens do target
      for (const c of SolsticeConcepts.list()){
        for (const a of c.anchors){
          if (targetTokens.indexOf(a) !== -1){
            targetConcept = c.id;
            break;
          }
        }
        if (targetConcept) break;
      }
      if (!targetConcept) return null;
      // Procura coluna do CSV cujo Inference resolva pro mesmo conceito.
      const ingest = SolsticeStore.get('ingest');
      const sampleRows = (ingest && ingest.rows) || [];
      for (const col of ctx.columns){
        const sample = sampleRows.slice(0, 50).map(r => r[col]).filter(v => v != null && v !== '');
        const inf = SolsticeInference.inferColumn(col, sample, { domain: ctx.domain });
        if (inf.winner === targetConcept) return col;
      }
      return null;
    }

    function _remapSlot(slot, ctx){
      if (!slot || !slot.config) return slot;
      const cfg = slot.config;
      const unbound = [];
      for (const key of _COL_KEYS){
        const v = cfg[key];
        if (typeof v !== 'string' || !v) continue;
        if (ctx.columns.indexOf(v) !== -1) continue;
        // Etapa 1: synonyms do dicionário (rápido).
        let resolved = SolsticeDomain && SolsticeDomain.resolveColumn
          ? SolsticeDomain.resolveColumn(v, ctx) : null;
        // Etapa 2: fallback por CONCEITO via Inference (entende vocabulário
        // que não está nos synonyms estáticos, ex: Qtd_Interacoes → quantidade).
        if (!resolved){
          resolved = _resolveByConcept(v, ctx);
        }
        if (resolved){
          cfg[key] = resolved;
        } else {
          unbound.push({ key, target: v });
        }
      }
      if (Array.isArray(cfg.localFilters)){
        cfg.localFilters.forEach(f => {
          if (f && typeof f.column === 'string' && ctx.columns.indexOf(f.column) === -1){
            let r = SolsticeDomain && SolsticeDomain.resolveColumn
              ? SolsticeDomain.resolveColumn(f.column, ctx) : null;
            if (!r) r = _resolveByConcept(f.column, ctx);
            if (r) f.column = r;
            else unbound.push({ key: 'localFilters.column', target: f.column });
          }
        });
      }
      if (unbound.length){ slot._unboundColumns = unbound; }
      return slot;
    }

    function apply(id){
      const t = getAll().find(x => x.id === id);
      if (!t) return;
      const sections = t.build();
      // ADR-164: remap todos os slots via synonyms ANTES de aplicar.
      const ingest = SolsticeStore.get('ingest') || {};
      const ctx = {
        columns: ingest.columns || [],
        types: ingest.types || {},
        dictionary: SolsticeStore.get('dictionary'),
        domain: t.domain || null  // HOTFIX v5.5: domain do template pra _resolveByConcept
      };
      let unboundTotal = 0;
      // UX1 v4 (Auditoria 2026.4): ao aplicar template, completa automaticamente
      // colunas faltantes via defaultConfig do componente. Antes o slot caía em
      // "Selecione coluna..." e usuário precisava editar 1 a 1. Agora renderiza
      // já com dados; usuário só ajusta se quiser.
      sections.forEach(sec => {
        (sec.rows || []).forEach(row => {
          (row.slots || []).forEach(slot => {
            _remapSlot(slot, ctx);
            if (slot._unboundColumns) unboundTotal += slot._unboundColumns.length;
            // UX1: auto-popula campos vazios via defaultConfig do tipo
            if (slot.type && slot.type !== 'empty'){
              try {
                const def = typeof SolsticeComponents !== 'undefined' && SolsticeComponents.get && SolsticeComponents.get(slot.type);
                if (def && def.defaultConfig){
                  const fullCtx = typeof SolsticeComponents.ctx === 'function'
                    ? SolsticeComponents.ctx(slot.config && slot.config.datasetId)
                    : ctx;
                  const dcfg = def.defaultConfig(fullCtx) || {};
                  // Merge: defaultConfig preenche apenas o que está vazio em slot.config
                  const merged = Object.assign({}, dcfg);
                  if (slot.config){
                    Object.keys(slot.config).forEach(k => {
                      if (slot.config[k] != null && slot.config[k] !== '') merged[k] = slot.config[k];
                    });
                  }
                  // Garante datasetId
                  if (!merged.datasetId){
                    const activeId = SolsticeIds && SolsticeIds.activeDataset && SolsticeIds.activeDataset();
                    if (activeId) merged.datasetId = activeId;
                  }
                  slot.config = merged;
                }
              } catch(e){ SolsticeLog.warn('[Templates.apply] defaultConfig falhou em', slot.type, e); }
            }
          });
        });
      });
      SolsticeCanvas.applyTemplate(sections);
      try {
        SolsticeAudit.record({
          action: 'apply_template', target: id,
          details: { name: t.name, unboundColumns: unboundTotal }
        });
      } catch(_){}
      if (unboundTotal > 0){
        SolsticeToast.warn('Template aplicado · ' + unboundTotal + ' coluna(s) sem match',
          'Configure manualmente em ⚙️ Configurar — algumas colunas do template não foram encontradas no CSV.');
      } else {
        SolsticeToast.success('Template aplicado', t.name);
      }
    }

    /**
     * openPicker v4 (Auditoria 2026.4) — modal com 2 sub-abas: "Sugeridos pra
     * sua base" + "Gerais". A primeira filtra por t.domain quando dicionário
     * detectado bate — não exclui os agnósticos (que estão na segunda aba).
     * Gerais: todos os agnósticos.
     */
    async function openPicker(){
      const all = list();
      const dict = SolsticeStore.get('dictionary') || {};
      const detectedDomain = dict.domain || dict._presetKey || null;
      const suggested = (detectedDomain
        ? all.filter(t => t.domain && (t.domain === detectedDomain || (Array.isArray(t.domains) && t.domains.includes(detectedDomain))))
        : []);
      const general = all.filter(t => !suggested.includes(t));

      return new Promise(resolve => {
        let activeTab = suggested.length ? 'sugeridos' : 'gerais';
        let closeFn = null;
        function _renderBody(){
          const body = SolsticeUtils.el('div', { style:'min-width:560px;' });

          // Auditoria 2026.6 — opção "Auto" em 1 clique no TOPO do picker.
          // Pedido do usuário: escolher o Auto direto, sem ter que aplicar um
          // template e ficar apagando depois pra trocar por Auto. A IA monta o
          // dashboard inteiro (KPIs + gráficos + seções) a partir da base.
          const autoCta = SolsticeUtils.el('button', {
            type:'button',
            class:'solstice__auto-cta',
            title:'A IA analisa a base e monta o dashboard inteiro automaticamente',
            onclick: () => {
              if (closeFn) closeFn();
              resolve('__auto__');
              setTimeout(() => {
                try { if (typeof SolsticeAutoDashboard !== 'undefined') SolsticeAutoDashboard.run({ force: true }); }
                catch(e){ SolsticeLog.warn('[Templates] auto falhou', e); }
              }, 80);
            }
          });
          autoCta.appendChild(SolsticeUtils.el('span', { class:'solstice__auto-cta-icon', 'aria-hidden':'true' }, '🪄'));
          const autoTxt = SolsticeUtils.el('div', { style:'flex:1;min-width:0;' });
          autoTxt.appendChild(SolsticeUtils.el('div', { class:'solstice__auto-cta-title' }, 'Montar pra mim (Auto)'));
          autoTxt.appendChild(SolsticeUtils.el('div', { class:'solstice__auto-cta-desc' },
            'A IA escolhe as melhores colunas e cria o dashboard inteiro. Você ajusta depois.'));
          autoCta.appendChild(autoTxt);
          autoCta.appendChild(SolsticeUtils.el('span', { class:'solstice__auto-cta-arrow', 'aria-hidden':'true' }, '→'));
          body.appendChild(autoCta);
          body.appendChild(SolsticeUtils.el('div', {
            style:'text-align:center;font-size:11px;color:var(--c-muted);margin:-6px 0 14px;'
          }, 'ou escolha um template abaixo'));

          // Tabs
          const tabs = SolsticeUtils.el('div', {
            role:'tablist',
            style:'display:flex;gap:4px;border-bottom:2px solid var(--c-border);margin-bottom:16px;'
          });
          function _tab(id, label, count){
            const isActive = activeTab === id;
            const btn = SolsticeUtils.el('button', {
              type:'button', role:'tab',
              'aria-selected': isActive ? 'true' : 'false',
              style:'padding:10px 16px;border:none;background:transparent;cursor:pointer;font-size:13px;font-weight:' + (isActive?'600':'500') + ';' +
                    'color:' + (isActive?'var(--c-text)':'var(--c-muted)') + ';' +
                    'border-bottom:3px solid ' + (isActive?'var(--c-accent)':'transparent') + ';' +
                    'margin-bottom:-2px;transition:all 120ms;',
              onclick: () => { activeTab = id; _refresh(); }
            }, label + ' (' + count + ')');
            return btn;
          }
          tabs.appendChild(_tab('sugeridos', '⭐ Sugeridos pra sua base', suggested.length));
          tabs.appendChild(_tab('gerais', '📚 Gerais', general.length));
          body.appendChild(tabs);

          // ENXUGAR3 v4 (Auditoria 2026.4): cards mais compactos.
          // Removidas tags "Agnóstico"/"Banco PJ" (eram ruído visual sem valor).
          // Cards menores (min-height 70px em vez de 100). Description LIMITADA a 1 linha.
          const grid = SolsticeUtils.el('div', {
            style:'display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:8px;max-height:440px;overflow-y:auto;padding:2px;'
          });
          const items = activeTab === 'sugeridos' ? suggested : general;
          if (!items.length){
            grid.style.gridTemplateColumns = '1fr';
            grid.appendChild(SolsticeUtils.el('div', {
              style:'padding:24px;text-align:center;color:var(--c-muted);font-size:13px;line-height:1.5;'
            }, activeTab === 'sugeridos'
              ? 'Nenhum template casa com o domínio detectado. Veja os Gerais →'
              : 'Sem templates gerais.'));
          } else {
            items.forEach(t => {
              const card = SolsticeUtils.el('button', {
                type:'button',
                title: t.description || t.name,
                style:'display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--c-border);border-radius:6px;background:var(--c-surface);cursor:pointer;text-align:left;transition:all 120ms;min-height:56px;font-family:inherit;color:var(--c-text);',
                onmouseenter: e => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.background = 'var(--c-surface-2)'; },
                onmouseleave: e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.background = 'var(--c-surface)'; },
                // Sprint 28: openPicker agora encaminha pro Wizard em vez de
                // apply direto — assim qualquer caminho (toolbar, command-
                // palette, welcome) passa pela revisão de colunas.
                // Sprint 29 / fix: setTimeout 120ms entre close()+openWizard()
                // — sem isso, o modal anterior ainda estava no DOM e o
                // SolsticeModal.show abria por baixo (ou nem abria, dependendo
                // do navegador). User reportou "templates não consegue abrir".
                onclick: () => {
                  const targetId = t.id;
                  if (closeFn) closeFn();
                  resolve(targetId);
                  setTimeout(() => { try { openWizard(targetId); } catch(e){ SolsticeLog.warn('[Templates] wizard open falhou', e); } }, 120);
                }
              });
              card.appendChild(SolsticeUtils.el('span', { style:'font-size:20px;flex-shrink:0;' }, t.icon || '🧩'));
              const txt = SolsticeUtils.el('div', { style:'flex:1;min-width:0;' });
              txt.appendChild(SolsticeUtils.el('div', { style:'font-size:12px;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, t.name));
              if (t.description){
                txt.appendChild(SolsticeUtils.el('div', {
                  style:'font-size:10px;color:var(--c-muted);line-height:1.3;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
                }, t.description));
              }
              card.appendChild(txt);
              grid.appendChild(card);
            });
          }
          body.appendChild(grid);
          return body;
        }
        let _container;
        function _refresh(){
          if (!_container) return;
          _container.innerHTML = '';
          _container.appendChild(_renderBody());
        }
        SolsticeModal.show({
          title: '🗂️ Aplicar template de dashboard',
          size: 'lg',
          body: (function(){ _container = SolsticeUtils.el('div'); _container.appendChild(_renderBody()); return _container; })(),
          onOpen: ({ close }) => { closeFn = close; },
          footer: (close) => [
            SolsticeUtils.el('button', {
              class:'solstice__btn solstice__btn--ghost',
              onclick: () => { close(null); resolve(null); }
            }, 'Cancelar')
          ]
        });
      });
    }

    /* ============================================================
       Sprint 28 — TEMPLATE WIZARD
       --------------------------------------------------------------
       User pediu: ao clicar num template, NÃO aplicar direto. Abrir
       wizard que mostra cada componente do template, qual coluna a
       IA sugeriu, e permitir trocar manualmente antes de aplicar.
       Tipos de componente vêm de t.slotSpec; colunas auto via
       defaultConfig de cada componente.
       ============================================================ */
    const KIND_META = {
      'visao-geral':  { icon: '🧰', label: 'Visão geral' },
      'comparacao':   { icon: '📊', label: 'Comparação' },
      'distribuicao': { icon: '📉', label: 'Distribuição' },
      'evolucao':     { icon: '📈', label: 'Evolução temporal' },
      'composicao':   { icon: '🍰', label: 'Composição' },
      'correlacao':   { icon: '🔍', label: 'Correlação' },
      'tabela':       { icon: '📋', label: 'Tabela' }
    };

    /** Sprint 28 — flatten dos slots do template (com slotSpec aplicado). */
    function _materializeSlots(t){
      if (!t || !t.build) return [];
      const sections = t.build();
      const slots = [];
      const spec = Array.isArray(t.slotSpec) ? t.slotSpec : [];
      let i = 0;
      sections.forEach((sec, secIdx) => {
        (sec.rows || []).forEach((row, rowIdx) => {
          (row.slots || []).forEach((slot, slotIdx) => {
            const type = spec[i] || slot.type || 'empty';
            slots.push({
              _path: { secIdx, rowIdx, slotIdx },
              type,
              hint: null,
              config: {}
            });
            i++;
          });
        });
      });
      return { sections, slots };
    }

    /** Sprint 28 — pega defaultConfig do componente como sugestão pro Wizard. */
    function _suggestForSlot(slotType){
      if (!slotType || slotType === 'empty') return null;
      try {
        if (typeof SolsticeComponents === 'undefined' || !SolsticeComponents.get) return null;
        const def = SolsticeComponents.get(slotType);
        if (!def || !def.defaultConfig) return null;
        const fullCtx = typeof SolsticeComponents.ctx === 'function'
          ? SolsticeComponents.ctx(null) : null;
        if (!fullCtx) return null;
        const cfg = def.defaultConfig(fullCtx) || {};
        return cfg;
      } catch(_){ return null; }
    }

    /**
     * Sprint 28 — Wizard: pra cada slot do template, mostra dropdowns das
     * colunas relevantes pré-preenchidas com a sugestão automática. User
     * pode trocar qualquer uma antes de aplicar.
     */
    function openWizard(id){
      const t = getAll().find(x => x.id === id);
      if (!t){ SolsticeToast.warn('Template não encontrado', id); return; }
      const ingest = SolsticeStore.get('ingest');
      if (!ingest || !ingest.columns || !ingest.columns.length){
        SolsticeToast.warn('Sem dataset', 'Importe um CSV antes de aplicar um template.');
        return;
      }
      const allCols = ingest.columns;
      const types = ingest.types || {};
      const { sections, slots } = _materializeSlots(t);

      // Pra cada slot, computa defaults via defaultConfig
      slots.forEach(s => { s.config = _suggestForSlot(s.type) || {}; });

      // Sprint 33 / BUG-EV-01: rotação de colunas entre slots do mesmo tipo.
      // Quando o template tem 4 KPIs, defaultConfig retorna a MESMA primeira
      // coluna numérica pra cada — usuário vê 4 cards idênticos. Aqui detectamos
      // grupos de slots de mesmo type+key e rotacionamos por colunas distintas
      // do mesmo grupo (numéricas, temporais, categóricas).
      try {
        const numericCols = allCols.filter(c => SolsticeTypes.group((types[c] || {}).type) === 'numeric');
        const temporalCols = allCols.filter(c => SolsticeTypes.group((types[c] || {}).type) === 'temporal');
        const catCols = allCols.filter(c => SolsticeTypes.group((types[c] || {}).type) === 'categorical');
        const poolOf = (group) => group === 'numeric' ? numericCols
                              : group === 'temporal' ? temporalCols
                              : group === 'categorical' ? catCols : [];
        // Conta uso por (tipo, key) pra rotacionar a partir do índice 0
        const usageCounter = {};
        slots.forEach(s => {
          if (!s.config) return;
          const COL_KEYS = ['column','xColumn','yColumn','valueColumn','sizeColumn'];
          COL_KEYS.forEach(key => {
            const currentVal = s.config[key];
            if (!currentVal) return;
            const group = SolsticeTypes.group((types[currentVal] || {}).type);
            const pool = poolOf(group);
            if (pool.length < 2) return; // só 1 coluna do tipo — não tem como rotacionar
            const counterKey = s.type + '::' + key;
            const idx = usageCounter[counterKey] = (usageCounter[counterKey] || 0);
            // Atribui a idx-ésima coluna do pool (módulo pra wrap se idx > pool.length)
            s.config[key] = pool[idx % pool.length];
            usageCounter[counterKey] = idx + 1;
          });
        });
      } catch(e){ SolsticeLog.warn && SolsticeLog.warn('[Wizard] rotação de colunas falhou', e); }

      // Render
      const wrap = SolsticeUtils.el('div', { style:'min-width:560px;max-width:760px;' });
      // Cabeçalho com descrição + categoria
      const kind = t.kind || (t.domain ? 'dominio' : 'visao-geral');
      const km = KIND_META[kind] || { icon: t.icon || '🧩', label: 'Template' };
      const head = SolsticeUtils.el('div', {
        style: 'display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:var(--c-surface-2);border-radius:6px;margin-bottom:14px;'
      });
      head.appendChild(SolsticeUtils.el('span', { style:'font-size:24px;' }, t.icon || km.icon));
      const headTxt = SolsticeUtils.el('div', { style:'flex:1;' });
      headTxt.appendChild(SolsticeUtils.el('div', { style:'font-size:14px;font-weight:600;' }, t.name));
      if (t.description){
        headTxt.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);line-height:1.45;margin-top:2px;' }, t.description));
      }
      headTxt.appendChild(SolsticeUtils.el('div', {
        style: 'display:inline-block;margin-top:6px;padding:2px 8px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:10px;font-size:10px;color:var(--c-muted);'
      }, km.icon + ' ' + km.label));
      head.appendChild(headTxt);
      wrap.appendChild(head);

      wrap.appendChild(SolsticeUtils.el('div', {
        style: 'font-size:12px;color:var(--c-text-2);margin-bottom:10px;line-height:1.5;'
      },
        'Confirme as colunas que cada componente vai usar. ',
        SolsticeUtils.el('strong', null, 'A IA já sugeriu uma'),
        ' baseada nos seus dados — troque se quiser.'
      ));

      // Lista de slots
      const list = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:10px;max-height:50vh;overflow-y:auto;padding:2px;' });
      slots.forEach((s, idx) => {
        const def = (typeof SolsticeComponents !== 'undefined' && SolsticeComponents.get) ? SolsticeComponents.get(s.type) : null;
        const row = SolsticeUtils.el('div', {
          style: 'display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--c-border);border-radius:6px;background:var(--c-surface);'
        });
        // Icone do componente
        row.appendChild(SolsticeUtils.el('span', { style:'font-size:20px;flex-shrink:0;' }, (def && def.icon) || '📦'));
        // Bloco do meio: nome + dropdown
        const mid = SolsticeUtils.el('div', { style:'flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;' });
        mid.appendChild(SolsticeUtils.el('div', { style:'font-size:12px;font-weight:600;' }, (def && def.name) || s.type));

        // Pra cada chave de coluna no config, mostrar dropdown
        const COL_KEYS = ['column','xColumn','yColumn','dateColumn','valueColumn','sourceColumn','targetColumn','groupColumn','sizeColumn'];
        const usedKeys = COL_KEYS.filter(k => s.config[k] !== undefined);
        if (!usedKeys.length){
          // Componente sem coluna (ex: markdown) — não há nada pra escolher
          mid.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);' },
            'Componente não usa coluna — usa todas / texto livre'));
        } else {
          usedKeys.forEach(key => {
            const fieldRow = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:8px;font-size:11px;' });
            const labelTxt = key === 'xColumn' ? 'Eixo X'
                          : key === 'yColumn' ? 'Eixo Y'
                          : key === 'dateColumn' ? 'Data'
                          : key === 'valueColumn' ? 'Valor'
                          : key === 'sourceColumn' ? 'Origem'
                          : key === 'targetColumn' ? 'Destino'
                          : key === 'groupColumn' ? 'Agrupar por'
                          : key === 'sizeColumn' ? 'Tamanho (bubble)'
                          : 'Coluna';
            fieldRow.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-muted);min-width:80px;' }, labelTxt + ':'));
            const select = SolsticeUtils.el('select', {
              style:'flex:1;padding:4px 8px;background:var(--c-surface-2);border:1px solid var(--c-border);color:var(--c-text);font-size:11px;border-radius:4px;',
              onchange: (e) => { s.config[key] = e.target.value || null; }
            });
            // Opção vazia
            const optNone = SolsticeUtils.el('option', { value:'' }, '— sem coluna —');
            select.appendChild(optNone);
            // Lista colunas, marcando tipo
            allCols.forEach(c => {
              const t = (types[c] && types[c].type) || '?';
              const icon = (typeof SolsticeTypes !== 'undefined' && SolsticeTypes.icon) ? (SolsticeTypes.icon(t) || '·') : '·';
              const opt = SolsticeUtils.el('option', { value: c }, icon + ' ' + c);
              if (c === s.config[key]) opt.setAttribute('selected', 'selected');
              select.appendChild(opt);
            });
            // Garante que o defaultConfig fica como valor inicial
            if (s.config[key]) select.value = s.config[key];
            // Indicador "auto"
            const autoTag = SolsticeUtils.el('span', {
              style: 'font-size:9px;padding:1px 5px;background:color-mix(in srgb,var(--c-accent) 20%, transparent);color:var(--c-accent);border-radius:6px;font-weight:600;text-transform:uppercase;'
            }, 'auto');
            fieldRow.appendChild(select);
            fieldRow.appendChild(autoTag);
            mid.appendChild(fieldRow);
          });
        }
        row.appendChild(mid);
        list.appendChild(row);
      });
      wrap.appendChild(list);

      // Sprint 30 / BH-03: checkbox "limpar antes de aplicar". User reportou
      // que aplicar 2 templates seguidos anexa em vez de substituir.
      // Default: false (anexa — preserva trabalho existente).
      // Marcar = true: chama Canvas.clear() antes de applyTemplate.
      const hasExisting = ((SolsticeStore.get('canvas.sections') || []).length > 0);
      const replaceWrap = SolsticeUtils.el('label', {
        style: 'display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 12px;background:var(--c-surface-2);border-radius:6px;font-size:12px;color:var(--c-text);cursor:pointer;user-select:none;' +
               (hasExisting ? '' : 'opacity:0.6;'),
        title: hasExisting
          ? 'Marque pra apagar todas as seções atuais antes de aplicar este template'
          : 'Não há nada pra limpar — canvas está vazio'
      });
      const replaceCb = SolsticeUtils.el('input', {
        type: 'checkbox',
        style: 'margin:0;cursor:pointer;'
      });
      if (!hasExisting) replaceCb.setAttribute('disabled', 'disabled');
      replaceWrap.appendChild(replaceCb);
      replaceWrap.appendChild(SolsticeUtils.el('span', null,
        hasExisting
          ? '🗑️ Limpar dashboard atual antes de aplicar (substitui em vez de anexar)'
          : '🗑️ Limpar dashboard atual antes de aplicar — nada pra limpar'));
      wrap.appendChild(replaceWrap);

      SolsticeModal.show({
        title: '🪄 Configurar template — ' + t.name,
        size: 'lg',
        body: wrap,
        footer: (close) => [
          SolsticeUtils.el('button', {
            class: 'solstice__btn solstice__btn--ghost',
            onclick: () => close(null)
          }, 'Cancelar'),
          SolsticeUtils.el('button', {
            class: 'solstice__btn solstice__btn--primary',
            onclick: () => {
              // Aplica os tipos + configs escolhidas nos sections
              slots.forEach(s => {
                const { secIdx, rowIdx, slotIdx } = s._path;
                const sec = sections[secIdx];
                if (!sec) return;
                const row = sec.rows[rowIdx];
                if (!row) return;
                const sl = row.slots[slotIdx];
                if (!sl) return;
                sl.type = s.type;
                sl.config = Object.assign({}, sl.config || {}, s.config || {});
              });
              // Sprint 30 / BH-03: limpa dashboard atual se checkbox marcado.
              const shouldReplace = replaceCb.checked;
              if (shouldReplace && typeof SolsticeCanvas.clear === 'function'){
                try { SolsticeCanvas.clear(); } catch(_){}
              }
              SolsticeCanvas.applyTemplate(sections);
              try {
                SolsticeAudit.record({
                  action: 'apply_template_wizard', target: id,
                  details: { name: t.name, customSlots: slots.length, replaced: shouldReplace }
                });
              } catch(_){}
              SolsticeToast.success('Template aplicado',
                t.name + ' · ' + slots.length + ' componente(s)' +
                (shouldReplace ? ' · dashboard anterior limpo' : ''));
              close(null);
            }
          }, '✓ Aplicar template')
        ]
      });
    }

    /**
     * Sprint 28 — renderiza o painel Templates na sidebar.
     * Agrupa por KIND (categoria de análise), cards compactos com clique
     * → openWizard. Quando não há dataset, mostra estado vazio com CTA.
     */
    function renderSidebarPanel(host){
      if (!host) return;
      host.innerHTML = '';
      const ingest = SolsticeStore.get('ingest');
      const hasDataset = !!(ingest && ingest.columns && ingest.columns.length);

      // Header do painel
      const head = SolsticeUtils.el('div', {
        style: 'display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:0 2px;'
      });
      head.appendChild(SolsticeUtils.el('span', { style:'font-size:13px;font-weight:600;color:var(--c-text);' },
        '🗂️ Templates de dashboard'));
      host.appendChild(head);

      host.appendChild(SolsticeUtils.el('div', {
        style: 'font-size:11px;color:var(--c-muted);line-height:1.5;margin-bottom:12px;padding:8px 10px;background:var(--c-surface-2);border-left:2px solid var(--c-accent);border-radius:4px;'
      },
        'Clique num template pra ',
        SolsticeUtils.el('strong', null, 'configurar as colunas'),
        ' antes de aplicar — você revisa cada componente.'));

      if (!hasDataset){
        host.appendChild(SolsticeUtils.el('div', {
          style: 'padding:14px;text-align:center;color:var(--c-muted);font-size:12px;line-height:1.5;background:var(--c-surface-2);border-radius:6px;border:1px dashed var(--c-border);'
        },
          SolsticeUtils.el('div', { style:'font-size:28px;margin-bottom:8px;opacity:0.5;' }, '📭'),
          'Carregue um CSV pelo header pra ver e aplicar templates.'));
        return;
      }

      // Agrupa por kind
      const byKind = {};
      const orderedKinds = ['visao-geral','comparacao','distribuicao','evolucao','composicao','correlacao','tabela'];
      AGNOSTIC.forEach(t => {
        const k = t.kind || 'outros';
        (byKind[k] = byKind[k] || []).push(t);
      });

      orderedKinds.forEach(k => {
        const items = byKind[k];
        if (!items || !items.length) return;
        const meta = KIND_META[k] || { icon: '🧩', label: k };
        // Mini-cabeçalho
        host.appendChild(SolsticeUtils.el('div', {
          style: 'font-size:10px;font-weight:700;color:var(--c-muted);letter-spacing:0.06em;text-transform:uppercase;margin:14px 2px 6px;display:flex;align-items:center;gap:6px;'
        },
          SolsticeUtils.el('span', null, meta.icon),
          SolsticeUtils.el('span', null, meta.label),
          SolsticeUtils.el('span', { style:'opacity:0.6;' }, '· ' + items.length)));
        // Cards
        items.forEach(t => {
          const card = SolsticeUtils.el('button', {
            type: 'button',
            class: 'solstice__template-sidebar-card',
            title: t.description || t.name,
            style: 'display:flex;align-items:center;gap:8px;padding:8px 10px;width:100%;border:1px solid var(--c-border);border-radius:6px;background:var(--c-surface);cursor:pointer;text-align:left;transition:all 120ms;color:var(--c-text);font-family:inherit;margin-bottom:6px;',
            onmouseenter: e => { e.currentTarget.style.borderColor = 'var(--c-accent)'; e.currentTarget.style.background = 'var(--c-surface-2)'; },
            onmouseleave: e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.background = 'var(--c-surface)'; },
            onclick: () => openWizard(t.id)
          });
          card.appendChild(SolsticeUtils.el('span', { style:'font-size:18px;flex-shrink:0;' }, t.icon || '🧩'));
          const txt = SolsticeUtils.el('div', { style:'flex:1;min-width:0;' });
          txt.appendChild(SolsticeUtils.el('div', { style:'font-size:12px;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, t.name));
          if (t.description){
            txt.appendChild(SolsticeUtils.el('div', {
              style: 'font-size:10px;color:var(--c-muted);line-height:1.3;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
            }, t.description));
          }
          card.appendChild(txt);
          card.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-muted);font-size:14px;flex-shrink:0;' }, '→'));
          host.appendChild(card);
        });
      });
    }

    return { list, getAll, apply, openPicker, openWizard, renderSidebarPanel, AGNOSTIC, DOMAIN };
  })();
