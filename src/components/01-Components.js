
  /* ============================================================
     SolsticeComponents — registry plugável + 4 implementações
     Cada componente: { id, name, icon, defaultConfig, render(slot, host, ctx) }
     ============================================================ */
  const SolsticeComponents = (function(){

    const registry = {};
    const _registerListeners = [];

    /**
     * register(def) — adiciona componente ao registry.
     *
     * RT-05 (Sprint 3): valida shape mínimo + emite evento pra terceiros que
     * queiram saber quando novos tipos são registrados.
     *
     * def precisa ter: { id: string, name: string, render: function }
     * Opcionais: icon, description, defaultConfig (fn ou objeto)
     *
     * Plugin externo de exemplo (em outro <script> injetado pós-load):
     *   Solstice.Components.register({
     *     id: 'my-chart', name: 'Meu Chart', icon: '📊',
     *     defaultConfig: (ctx) => ({ column: ctx.columns[0] }),
     *     render(slot, host, ctx){
     *       host.appendChild(document.createElement('div')).textContent = 'Hello';
     *     }
     *   });
     */
    function register(def){
      if (!def || typeof def !== 'object'){
        console.warn('[SolsticeComponents.register] def inválido (não é objeto)');
        return false;
      }
      if (!def.id || typeof def.id !== 'string'){
        console.warn('[SolsticeComponents.register] def.id obrigatório (string)');
        return false;
      }
      if (typeof def.render !== 'function'){
        console.warn('[SolsticeComponents.register] def.render obrigatório (function)');
        return false;
      }
      const isReplace = !!registry[def.id];
      registry[def.id] = def;
      // Notifica listeners (catálogo de componentes, command palette, etc.)
      // Auditoria 2026.4 (MC-09 ext): erro em subscriber loga via SolsticeLog.
      _registerListeners.forEach(cb => {
        try { cb(def, isReplace); }
        catch(e){ SolsticeLog.warn('[SolsticeComponents.register] subscriber error · def.id=' + def.id, e); }
      });
      return true;
    }
    /** RT-05: hook pra terceiros saberem quando novos componentes são registrados. */
    function onRegister(cb){
      if (typeof cb !== 'function') return () => {};
      _registerListeners.push(cb);
      return () => {
        const idx = _registerListeners.indexOf(cb);
        if (idx >= 0) _registerListeners.splice(idx, 1);
      };
    }
    function get(id){ return registry[id]; }
    function list(){ return Object.values(registry); }
    /** RT-05: remove componente (plugin desabilitado). */
    function unregister(id){
      const had = !!registry[id];
      delete registry[id];
      return had;
    }

    /** Constrói contexto para o componente: dataset, dicionário, types, locale. */
    // Auditoria 2026 (U-13): _ctx aceita datasetId opcional.
    // Quando slot.config.datasetId aponta para uma base do MultiCSV,
    // o componente puxa daquela base — não do ingest ativo. Isso permite
    // que múltiplas bases COEXISTAM no mesmo dashboard: KPI da base A,
    // gráfico da base B, tabela da base C — todos juntos.
    function _ctx(datasetId){
      let ingest;
      if (datasetId){
        const datasets = SolsticeStore.get('datasets') || [];
        const d = datasets.find(x => x.id === datasetId);
        if (d){
          ingest = {
            rows: d.rows || [],
            columns: d.columns || [],
            types: d.types || {},
            calculatedMeasures: d.calculatedMeasures || {}
          };
        }
      }
      if (!ingest) ingest = SolsticeStore.get('ingest') || {};
      let allRows = ingest.rows || [];
      let columns = (ingest.columns || []).slice();
      let types = Object.assign({}, ingest.types || {});

      // Patch 2 (ADR-130): aplica medidas calculadas — adiciona colunas virtuais
      const measures = ingest.calculatedMeasures || {};
      const measureNames = Object.keys(measures);
      if (measureNames.length){
        // Resolve em ordem topológica (cada medida pode depender de outras)
        const order = _topoSortMeasures(measures);
        // Cria cópia das rows com colunas extras
        allRows = allRows.map(r => Object.assign({}, r));
        for (const name of order){
          const def = measures[name];
          try {
            const vals = SolsticeFormula.evaluateColumn(def.formula, { rows: allRows, columns });
            allRows.forEach((r, i) => { r[name] = vals[i]; });
            columns.push(name);
            types[name] = { type: def.resultType || 'decimal', _calculated: true };
          } catch(err){
            console.warn('[Calc] falha em medida', name, err);
          }
        }
      }

      // B9: rows ativos respeitam filtros globais + cross-filter
      const rows = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.apply(allRows) : allRows;
      let ctx = {
        rows,
        rowsAll: allRows,
        columns,
        types,
        dictionary: SolsticeStore.get('dictionary'),
        calculatedMeasures: measures,
        L: SolsticeLocale
      };
      // SOL-B1: enriquece com colunas das bases relacionadas (Modelo de Dados).
      // Componentes que usam colSelect veem "<baseDestino>.<coluna>" automaticamente.
      if (typeof SolsticeRelationships !== 'undefined' && SolsticeRelationships.enrich){
        const baseId = datasetId || SolsticeStore.get('datasets.activeId') || null;
        if (baseId) ctx = SolsticeRelationships.enrich(ctx, baseId);
      }
      return ctx;
    }

    function _topoSortMeasures(measures){
      // Kahn's algorithm. Detecta ciclos.
      const order = [];
      const inDegree = {};
      const adj = {};
      const names = Object.keys(measures);
      names.forEach(n => { inDegree[n] = 0; adj[n] = []; });
      for (const name of names){
        const deps = SolsticeFormula.dependencies(measures[name].formula);
        for (const d of deps){
          if (measures[d]){ adj[d].push(name); inDegree[name]++; }
        }
      }
      const queue = names.filter(n => inDegree[n] === 0);
      while (queue.length){
        const n = queue.shift();
        order.push(n);
        for (const next of adj[n]){
          inDegree[next]--;
          if (inDegree[next] === 0) queue.push(next);
        }
      }
      if (order.length !== names.length){
        console.warn('[Calc] dependência circular detectada nas medidas');
      }
      return order;
    }

    function _firstColOfGroup(ctx, group){
      for (const c of ctx.columns){
        const t = ctx.types[c];
        if (t && SolsticeTypes.group(t.type) === group) return c;
      }
      return null;
    }
    function _firstCol(ctx){
      return (ctx.columns && ctx.columns[0]) || null;
    }

    /** Render fachada: aplica casca .solstice__comp + delega para a impl. */
    function render(slot, host){
      const def = registry[slot.type];
      if (!def) return;
      // BUG-01 v4 + R-07 v3 · Auto-recuperação de slot órfão via SolsticeIds.
      // Se o slot tem datasetId stale (sessão anterior ou snapshot legado),
      // corrige in-place para datasets.activeId. Lógica centralizada no
      // SolsticeIds — single source of truth.
      let _slotDsId = slot && slot.config && slot.config.datasetId;
      if (_slotDsId && SolsticeIds.isStale(_slotDsId)){
        const _recovered = SolsticeIds.activeDataset();
        slot.config = Object.assign({}, slot.config, { datasetId: _recovered });
        _slotDsId = _recovered;
      }
      const ctx = _ctx(_slotDsId);
      // Sprint 44 / feedback do usuário (screenshot bug ainda aparece com 1 filtro
      // ativo): distinguir 2 estados que antes eram a MESMA mensagem confusa:
      //   1) "Sem dataset"       → ingest vazio (columns/rowsAll vazios)
      //   2) "Sem resultados nos filtros" → tem ingest mas filtros zeraram tudo
      // Antes os 2 mostravam "Sem dataset carregado · Importe CSV". Agora o caso 2
      // mostra "0 linhas após filtros" + botão "Limpar filtros" — UX correto.
      const _hasIngest = Array.isArray(ctx.columns) && ctx.columns.length > 0 &&
                         Array.isArray(ctx.rowsAll) && ctx.rowsAll.length > 0;
      const _emptyRows = !Array.isArray(ctx.rows) || ctx.rows.length === 0;
      const _noData = !Array.isArray(ctx.columns) || ctx.columns.length === 0 ||
                      (!_hasIngest && _emptyRows);
      const _filteredOut = _hasIngest && _emptyRows; // tem dataset mas filtros zeraram
      if (_noData || _filteredOut){
        // markdown / narrative-auto não precisam de dataset; deixa passar.
        const _selfSufficient = (slot.type === 'markdown' || slot.type === 'narrative-auto');
        if (!_selfSufficient){
          // Cria casca padrão para manter aspecto do slot, mas com mensagem clara.
          const wrap = SolsticeUtils.el('div', {
            class:'solstice__comp solstice__comp--no-data',
            'data-comp-id': slot.id,
            'data-comp-type': slot.type,
            role: 'region',
            'aria-label': (def.name || 'Componente') + (_filteredOut ? ' filtrado' : ' aguardando dataset')
          });
          const head = SolsticeUtils.el('div', { class:'solstice__comp-head' });
          head.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-title' },
            (def.icon || '🧩') + '  ' + def.name));
          wrap.appendChild(head);
          const body = SolsticeUtils.el('div', { class:'solstice__comp-body solstice__comp-empty' });
          body.style.padding = '16px';
          body.style.textAlign = 'center';
          if (_filteredOut){
            // Sprint 44: contagem de filtros ativos pra orientar.
            const activeFilters = SolsticeStore.get('filters') || {};
            const activeCount = Object.keys(activeFilters).filter(k => activeFilters[k] != null).length;
            const cross = SolsticeStore.get('crossfilter');
            const totalActive = activeCount + (cross ? 1 : 0);
            body.appendChild(SolsticeUtils.el('div', { style:'font-size:32px;margin-bottom:8px;opacity:.6;' }, '🔍'));
            body.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;color:var(--c-text);margin-bottom:4px;' },
              '0 linhas após os filtros'));
            body.appendChild(SolsticeUtils.el('div', { style:'font-size:12px;color:var(--c-muted);margin-bottom:12px;line-height:1.4;' },
              'Base tem ' + (ctx.rowsAll.length).toLocaleString('pt-BR') + ' linhas, mas ' +
              totalActive + ' filtro(s) ativo(s) excluíram tudo. Tente alargar o filtro ou limpar.'));
            const btnRow = SolsticeUtils.el('div', { style:'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;' });
            const clearBtn = SolsticeUtils.el('button', {
              class:'solstice__btn solstice__btn--primary',
              onclick: () => {
                if (typeof SolsticeFilters !== 'undefined' && SolsticeFilters.clear){
                  SolsticeFilters.clear();
                  SolsticeToast.success('Filtros limpos', 'Todos os filtros foram removidos.');
                }
              }
            }, '🧹 Limpar todos os filtros');
            btnRow.appendChild(clearBtn);
            body.appendChild(btnRow);
          } else {
            body.appendChild(SolsticeUtils.el('div', { style:'font-size:32px;margin-bottom:8px;opacity:.5;' }, '📭'));
            body.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;color:var(--c-muted);margin-bottom:4px;' },
              'Sem dataset carregado'));
            body.appendChild(SolsticeUtils.el('div', { style:'font-size:12px;color:var(--c-muted);margin-bottom:12px;line-height:1.4;' },
              'Este componente precisa de dados para renderizar. Importe um CSV para vê-lo em ação.'));
            const btn = SolsticeUtils.el('button', {
              class:'solstice__btn solstice__btn--primary',
              onclick: () => {
                const fi = document.getElementById('file-input');
                if (fi) fi.click();
              }
            }, '📁 Importar CSV');
            body.appendChild(btn);
          }
          wrap.appendChild(body);
          host.appendChild(wrap);
          return;
        }
      }
      // Patch 1A (ADR-115): aplica filtros locais do slot ao ctx.rows
      if (slot.config && Array.isArray(slot.config.localFilters) && slot.config.localFilters.length){
        ctx.rows = SolsticeFilters.applyList(ctx.rows, slot.config.localFilters);
        ctx._hasLocalFilters = slot.config.localFilters.length;
      }
      // Patch 1A (ADR-118): detecção de colunas deletadas no slot.config
      const cfg = slot.config || {};
      const refs = ['column','xColumn','yColumn','valueColumn','groupColumn','sourceColumn','targetColumn','dateColumn','sizeColumn'];
      const cols = new Set(ctx.columns || []);
      const broken = refs.filter(k => cfg[k] && !cols.has(cfg[k]));
      slot._brokenRefs = broken;  // sinaliza para badge no header

      // Auditoria 2026 (G-02 / A-609): alternativa textual para leitor de
      // tela. role + aria-label sumarizando o componente em 1 linha — é o
      // mínimo viável para Marcos (P5) entender o conteúdo de cada slot.
      // Componentes com dados ricos (table/pivot) já oferecem o conteúdo
      // como texto no DOM; gráficos (line/bar/scatter/gauge/sankey/funnel/
      // box) ganham aria-label dinâmico via _ariaSummary.
      const _ariaLabel = (function(){
        try {
          const def = registry[slot.type];
          const name = def ? def.name : slot.type;
          const colHint = (cfg.column || cfg.yColumn || cfg.valueColumn);
          const friendly = colHint && ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[colHint]
            ? ctx.dictionary.columns[colHint].friendlyName : colHint;
          return (name || 'Componente') + (friendly ? ': ' + friendly : '') +
                 ' (use o botão "Ver dados" para abrir a tabela equivalente)';
        } catch(_){ return 'Componente do dashboard'; }
      })();
      const wrap = SolsticeUtils.el('div', {
        class:'solstice__comp',
        'data-comp-id': slot.id,
        'data-comp-type': slot.type,
        role: 'region',
        'aria-label': _ariaLabel,
        tabindex: '0',
        onclick: (e) => {
          if (e.target.closest('.solstice__comp-btn')) return;
          if (e.target.closest('.solstice__resize-corner')) return;
          SolsticeProps.select(slot.id);
        }
      });
      // Patch UX (ADR-105): aplica altura customizada se definida
      if (slot.config && slot.config.size && slot.config.size.height){
        const h = Math.max(200, Math.min(800, Number(slot.config.size.height) || 0));
        if (h) wrap.style.height = h + 'px';
      }
      // Camada Style: aplica style universal no host (CSS custom properties + classes)
      // O usuário customiza via aba 🎨 Estilo no Inspector.
      if (typeof SolsticeStyle !== 'undefined' && SolsticeStyle.apply){
        SolsticeStyle.apply(wrap, (slot.config && slot.config.style) || {});
      }

      const head = SolsticeUtils.el('div', { class:'solstice__comp-head' });
      // Polish v8c: título customizável.
      //   Prioridade: slot.config.customTitle > def.getTitle(slot, ctx) > def.name
      //   Double-click no título → edit inline; Enter salva, Esc cancela.
      const dynamicTitle = (typeof def.getTitle === 'function')
        ? (function(){ try { return def.getTitle(slot, ctx); } catch(e){ return def.name; } })()
        : def.name;
      const customTitle = (slot.config && slot.config.customTitle && slot.config.customTitle.trim()) || null;
      const titleText = customTitle || dynamicTitle;
      // Audit Fix 14: editar título com 1 CLIQUE (era duplo-clique).
      // Auditoria 2026.4: usuário esperava renomear inline com 1 clique no título
      // do componente — padrão consistente com edição de título de seção/página.
      const titleEl = SolsticeUtils.el('div', {
        class:'solstice__comp-title' + (customTitle ? ' is-custom' : ''),
        title: 'Clique para renomear (Esc cancela, Enter salva)',
        onclick: (e) => {
          // Não interfere com drag (verifica que não é dragstart)
          if (e.detail >= 1){ // contagem de cliques — 1 é single click válido
            e.stopPropagation();
            _editComponentTitle(titleEl, slot, def, ctx);
          }
        }
      }, def.icon + '  ' + titleText);
      head.appendChild(titleEl);
      // Audit Fix 2: 3 botões essenciais visíveis + ⋯ overflow com 5 secundários.
      // Lucas/Marcos/Júlia/Rodrigo: 8 ícones era excesso (sintoma de "tudo virou ícone").
      const acts = SolsticeUtils.el('div', { class:'solstice__comp-actions' });

      // Helper para fabricar botão de action (reusado em visível + overflow)
      function _actBtn(opts){
        const btn = SolsticeUtils.el('button', {
          class:'solstice__comp-btn' + (opts.activeClass ? ' ' + opts.activeClass : ''),
          title: opts.title,
          'aria-label': opts.title,
          onclick: opts.onclick
        });
        // Em overflow, mostra ícone + label; visível, só ícone
        if (opts.inOverflow){
          btn.appendChild(SolsticeUtils.el('span', { style:'font-size:13px;' }, opts.icon));
          btn.appendChild(SolsticeUtils.el('span', null, opts.label || opts.title));
        } else {
          btn.textContent = opts.icon;
        }
        if (opts.badge){
          btn.style.position = 'relative';
          btn.appendChild(SolsticeUtils.el('span', {
            style:'position:absolute;top:-4px;right:-4px;background:var(--c-accent);color:#fff;font-size:9px;line-height:1;padding:2px 4px;border-radius:8px;font-weight:bold;'
          }, String(opts.badge)));
        }
        return btn;
      }

      // Contadores para badges
      const localCount = (slot.config && Array.isArray(slot.config.localFilters)) ? slot.config.localFilters.length : 0;
      const commentCount = (slot.comments || []).filter(c => !c.resolved).length;

      // Audit Fix 2: handlers das ações (reusados em visível + overflow)
      const _onChangeType = async (e) => {
        e.stopPropagation();
        const opts = SolsticeComponents.list().map(c => ({
          value: c.id, label: c.name, icon: c.icon, desc: c.description || c.id
        }));
        const choice = await SolsticeModal.select({
          title: 'Trocar componente',
          message: 'Audit Fix 4: encodings compatíveis (column, xColumn, yColumn, valueColumn, agg) serão PRESERVADOS quando o novo tipo aceitar.',
          options: opts,
          defaultValue: slot.type,
          confirmLabel: 'Trocar',
          searchable: 'auto'
        });
        if (!choice || choice === slot.type) return;
        const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
        for (const s of sections) for (const r of s.rows){
          const sl = r.slots.find(x => x.id === slot.id);
          if (!sl) continue;
          const fromType = sl.type;
          const oldCfg = sl.config || {};
          sl.type = choice;
          const newDef = SolsticeComponents.get(choice);
          const ingest = SolsticeStore.get('ingest');
          const allRows = (ingest && ingest.rows) || [];
          const filteredRows = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.apply(allRows) : allRows;
          const ctxNow = {
            rows: filteredRows, rowsAll: allRows,
            columns: (ingest && ingest.columns) || [],
            types: (ingest && ingest.types) || {},
            dictionary: SolsticeStore.get('dictionary'),
            L: SolsticeLocale
          };
          const newCfg = newDef && newDef.defaultConfig ? newDef.defaultConfig(ctxNow) : {};
          // Audit Fix 4: PRESERVA encodings compatíveis entre tipos.
          // Mantém: column/xColumn/yColumn/valueColumn/sourceColumn/targetColumn/agg/groupBy
          // + style (sempre) + customTitle (se houver).
          const COMPATIBLE_KEYS = [
            'column','xColumn','yColumn','valueColumn',
            'sourceColumn','targetColumn','groupBy','dateColumn',
            'agg','customTitle','style','localFilters','comparison'
          ];
          for (const k of COMPATIBLE_KEYS){
            if (oldCfg[k] !== undefined) newCfg[k] = oldCfg[k];
          }
          sl.config = newCfg;
          SolsticeStore.set('canvas.sections', sections);
          SolsticeAudit.record({
            action: 'change_component_type', target: slot.id,
            details: { from: fromType, to: choice, preservedKeys: COMPATIBLE_KEYS.filter(k => oldCfg[k] !== undefined) }
          });
          SolsticeToast.info('Componente trocado',
            (def ? def.name : fromType) + ' → ' + newDef.name + ' · configuração preservada');
          setTimeout(() => SolsticeProps.select(slot.id), 80);
          return;
        }
      };
      const _onConfig = (e) => { e.stopPropagation(); SolsticeProps.select(slot.id); };
      const _onComment = (e) => {
        e.stopPropagation();
        if (commentCount) SolsticeComments.openPanel(slot.id); else SolsticeComments.add(slot.id);
      };
      const _onAnalysis = (e) => { e.stopPropagation(); SolsticeAnalysis.toggle(slot.id); };
      const _onProvenance = (e) => { e.stopPropagation(); SolsticeAudit.openProvenance(slot.id); };
      const _onDecisions = (e) => { e.stopPropagation(); SolsticeAudit.openModal({ componentId: slot.id }); };
      // Fix 20: atalho "🔬 Métodos" abre Inspector com a aba já expandida.
      // Auditoria 2026.4: aba Métodos estava enterrada (clique no componente
      // → Inspector → scroll → expandir accordion). Agora 1 clique no overflow
      // do componente abre tudo pronto. Reduz fricção de descoberta.
      const _onMethods = (e) => {
        e.stopPropagation();
        // Pré-abre a aba Métodos no Store (persistência de estado do accordion)
        // — createAccordion lê do Store quando renderiza, então isso garante
        // que vem aberto na primeira render do Inspector.
        try { SolsticeStore.set('ui.accordion.inspector.metodos', true); } catch(_){}
        // Seleciona o slot → abre Inspector
        SolsticeProps.select(slot.id);
        // Garante que está aberto + scrolla até ele
        setTimeout(() => {
          const accord = document.querySelector('.solstice__accord[data-accord-key="inspector.metodos"]');
          if (accord){
            accord.classList.add('is-open');
            accord.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 250);
      };
      const _onRemove = async (e) => {
        e.stopPropagation();
        const ok = await SolsticeModal.confirm({
          title: 'Remover componente?',
          message: 'O componente "' + def.name + '" será removido do slot. O slot ficará vazio.',
          confirmLabel: 'Remover',
          cancelLabel: 'Cancelar',
          danger: true,
          skipKey: 'remove-component'
        });
        if (!ok) return;
        const sections = SolsticeStore.get('canvas.sections') || [];
        const newSections = sections.map(sec => ({
          ...sec,
          rows: sec.rows.map(row => ({
            ...row,
            slots: row.slots.map(s => s.id === slot.id ? { id: s.id, type: 'empty' } : s)
          }))
        }));
        SolsticeStore.set('canvas.sections', newSections);
        SolsticeAudit.record({ action: 'remove_component', target: slot.id, componentId: slot.id, details: { type: slot.type } });
        if (SolsticeProps && SolsticeProps.deselect) SolsticeProps.deselect();
        SolsticeToast.action({
          title: 'Componente removido', msg: def.name, kind: 'warn',
          actionLabel: 'Desfazer', actionFn: () => SolsticeUndo.undo()
        });
      };

      // Lucas Fix 16: VISÍVEIS reorganizadas (ordem por frequência de uso):
      //   ⚙️ Configurar (ação primária — abre inspector)
      //   💬 Comentar  (sinalização social com badge — relevante mesmo sem hover)
      //   🗑️ Remover  (destrutivo, mas frequente — mantém visível)
      //   ⋯ Mais     (overflow agrupado: Componente / Análise)
      acts.appendChild(_actBtn({
        icon: '⚙️', title: 'Configurar (abre inspector)', onclick: _onConfig
      }));
      // FIX2 v4 (Auditoria 2026.4): atalho 🎨 direto pra aba Estilo do
      // componente no overflow menu — antes usuário precisava abrir Inspector,
      // scrollar, achar accordion "Card" ou "Visual". Agora 1 clique.
      acts.appendChild(_actBtn({
        icon: '🎨',
        title: 'Estilo & Cor do componente',
        onclick: () => {
          try {
            SolsticeProps.select(slot.id);
            // Foca aba "Estilo" no inspector se houver
            setTimeout(() => {
              const styleTab = document.querySelector('[data-inspector-tab="style"], .solstice__props-tab--style');
              if (styleTab && styleTab.click) styleTab.click();
            }, 80);
          } catch(_){}
        }
      }));
      acts.appendChild(_actBtn({
        icon: '💬',
        title: commentCount ? 'Comentários (' + commentCount + ')' : 'Adicionar comentário',
        onclick: _onComment,
        badge: commentCount || null
      }));
      acts.appendChild(_actBtn({
        icon: '🗑️', title: 'Remover componente', onclick: _onRemove,
        activeClass: 'solstice__comp-btn--danger'
      }));

      // OVERFLOW (⋯) — abre dropdown com botões secundários
      // HOTFIX v5.5 #116: menu agora eh position:fixed (escapa overflow:hidden do
      // .solstice__comp) com coords computadas via getBoundingClientRect.
      // Flips pra cima/esquerda se nao couber. Fecha em scroll/resize/click fora/Esc.
      const overflowWrap = SolsticeUtils.el('div', { class:'solstice__comp-actions-overflow-trigger' });
      function _positionOverflowMenu(menu, trigger){
        const r = trigger.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Renderiza primeiro pra medir
        menu.style.visibility = 'hidden';
        menu.style.left = '0px'; menu.style.top = '0px';
        const mw = menu.offsetWidth || 240;
        const mh = menu.offsetHeight || 200;
        // Posição: alinha direita do menu com direita do botão
        let left = r.right - mw;
        let top = r.bottom + 6;
        // Flip vertical se nao couber pra baixo
        if (top + mh > vh - 8) top = Math.max(8, r.top - mh - 6);
        // Clamp horizontal
        if (left < 8) left = 8;
        if (left + mw > vw - 8) left = vw - mw - 8;
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        menu.style.visibility = '';
      }
      const moreBtn = _actBtn({
        icon: '⋯', title: 'Mais opções',
        onclick: (e) => {
          e.stopPropagation();
          const menu = overflowWrap.querySelector('.solstice__comp-actions--overflow');
          if (!menu) return;
          const isOpen = menu.classList.contains('is-open');
          // Fecha primeiro qualquer outro menu aberto na pagina (so um por vez)
          document.querySelectorAll('.solstice__comp-actions--overflow.is-open').forEach(m => {
            if (m !== menu) m.classList.remove('is-open');
          });
          if (isOpen){
            menu.classList.remove('is-open');
            return;
          }
          menu.classList.add('is-open');
          _positionOverflowMenu(menu, moreBtn);
          // Listeners enquanto aberto.
          // Auditoria 2026 (MC-01 / HV-02): migrado para SolsticeUtils.trackListener
          // com o próprio menu como host. cleanupListeners(menu) substitui as 4
          // chamadas explícitas de removeEventListener no close().
          const close = () => {
            menu.classList.remove('is-open');
            SolsticeUtils.cleanupListeners(menu);
          };
          const onOutside = (ev) => {
            if (overflowWrap.contains(ev.target) || menu.contains(ev.target)) return;
            close();
          };
          const onEsc = (ev) => { if (ev.key === 'Escape') close(); };
          const onScroll = () => {
            // Re-posiciona durante scroll/resize pra acompanhar o botao
            if (menu.classList.contains('is-open')) _positionOverflowMenu(menu, moreBtn);
          };
          setTimeout(() => {
            SolsticeUtils.trackListener(menu, document, 'mousedown', onOutside, true);
            SolsticeUtils.trackListener(menu, document, 'keydown', onEsc, true);
            SolsticeUtils.trackListener(menu, window, 'scroll', onScroll, true);
            SolsticeUtils.trackListener(menu, window, 'resize', onScroll, true);
          }, 0);
        }
      });
      overflowWrap.appendChild(moreBtn);
      const overflowMenu = SolsticeUtils.el('div', { class:'solstice__comp-actions--overflow' });

      // Lucas Fix 16: agrupar com headers + dividers (estava "totalmente desorganizado")
      // Grupo 1 — Componente
      overflowMenu.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-menu-group' }, 'Componente'));
      overflowMenu.appendChild(_actBtn({ icon: '🔄', title: 'Trocar tipo de componente', onclick: _onChangeType, inOverflow: true, label: 'Trocar tipo' }));
      overflowMenu.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-menu-divider' }));

      // Grupo 2 — Análise
      overflowMenu.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-menu-group' }, 'Análise'));
      overflowMenu.appendChild(_actBtn({ icon: '📈', title: 'Ver análise estatística', onclick: _onAnalysis, inOverflow: true, label: 'Análise estatística' }));
      // Fix 20 (Auditoria 2026.4): atalho destacado pra aba Métodos — antes enterrada
      overflowMenu.appendChild(_actBtn({ icon: '🔬', title: 'Ver fórmulas, premissas e métodos usados', onclick: _onMethods, inOverflow: true, label: 'Métodos & fórmulas' }));
      overflowMenu.appendChild(_actBtn({ icon: '🧪', title: 'Origem dos dados (Provenance)', onclick: _onProvenance, inOverflow: true, label: 'Origem dos dados' }));
      overflowMenu.appendChild(_actBtn({ icon: '🔍', title: 'Histórico de decisões', onclick: _onDecisions, inOverflow: true, label: 'Histórico de decisões' }));

      overflowWrap.appendChild(overflowMenu);
      acts.appendChild(overflowWrap);

      head.appendChild(acts);
      wrap.appendChild(head);

      const body = SolsticeUtils.el('div', { class:'solstice__comp-body' });
      wrap.appendChild(body);

      // Patch 1A (ADR-118): badge ⚠ no header se há colunas deletadas
      if (broken.length){
        wrap.classList.add('has-broken-refs');
        const warnBadge = SolsticeUtils.el('div', {
          style:'position:absolute;top:6px;left:8px;background:var(--c-error);color:#fff;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:4px;z-index:5;',
          title: 'Colunas inválidas: ' + broken.map(k => k + '=' + cfg[k]).join(', ')
        }, '⚠ ' + broken.length);
        wrap.appendChild(warnBadge);
      }
      // ADR-166 (Onda 3 / T5): badge 🟡 rebind quando snapshot.load não
      // achou colunas via synonyms — usuário precisa reconfigurar.
      const unbound = slot._unboundColumns || [];
      if (unbound.length && !broken.length){
        wrap.classList.add('has-unbound-cols');
        const rebindBadge = SolsticeUtils.el('div', {
          style:'position:absolute;top:6px;left:8px;background:var(--c-warn);color:#000;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:4px;z-index:5;cursor:pointer;',
          title: 'Snapshot resgatou estes campos sem match no CSV atual: ' +
                 unbound.map(u => u.key + '="' + u.target + '"').join(', ') +
                 '\nClique para reconfigurar.',
          onclick: (e) => { e.stopPropagation(); SolsticeProps.select(slot.id); }
        }, '🟡 ' + unbound.length + ' rebind');
        wrap.appendChild(rebindBadge);
      }

      // Patch UX (ADR-105): handle ↘ no canto inferior direito para resize livre
      // Sprint 37: tooltip menciona duplo-clique pra reset. User reportou
      // que arrastava o card e não conseguia voltar pro tamanho padrão.
      const corner = SolsticeUtils.el('div', {
        class:'solstice__resize-corner',
        title:'Arraste para redimensionar · Duplo-clique para resetar ao padrão'
      }, '↘');
      corner.addEventListener('mousedown', (e) => _onCornerResizeStart(e, slot, wrap));
      // Sprint 37: duplo-clique no canto reseta tamanho do slot + widths da row
      corner.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
          let reset = false;
          for (const sec of sections) for (const r of sec.rows){
            const sl = r.slots.find(x => x.id === slot.id);
            if (sl){
              // Apaga override de tamanho do slot
              if (sl.config && sl.config.size){
                delete sl.config.size;
                reset = true;
              }
              // Apaga widths customizado da row (volta pro layout default)
              if (r.widths){
                delete r.widths;
                if (r.layout === 'custom'){
                  // Restaura layout em colunas iguais se não há layout prévio
                  r.layout = r.slots.length === 1 ? '1col' :
                             r.slots.length === 2 ? '2col-equal' :
                             r.slots.length === 3 ? '3col-equal' :
                             '4col-equal';
                }
                reset = true;
              }
              if (r.minHeight && r.minHeight > 80){
                delete r.minHeight;
                reset = true;
              }
              break;
            }
          }
          if (reset){
            SolsticeStore.set('canvas.sections', sections);
            SolsticeToast.success('Tamanho resetado', 'Card voltou ao padrão da linha');
            try {
              SolsticeAudit.record({ action:'reset_slot_size', target: slot.id });
            } catch(_){}
          } else {
            SolsticeToast.info('Já no tamanho padrão', 'Este card não tem override de tamanho');
          }
        } catch(err){ SolsticeLog.warn('[resize-reset]', err); }
      });
      wrap.appendChild(corner);

      host.appendChild(wrap);

      // Patch 1A (ADR-118): se há colunas deletadas, render alternativo com botão "Reconfigurar"
      if (broken.length){
        body.innerHTML = '';
        const card = SolsticeUtils.el('div', {
          class:'solstice__comp-empty',
          style:'padding:16px;text-align:center;'
        });
        card.appendChild(SolsticeUtils.el('div', { style:'font-size:24px;margin-bottom:8px;' }, '⚠️'));
        card.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;color:var(--c-error);margin-bottom:4px;' },
          broken.length === 1 ? 'Coluna inexistente' : broken.length + ' colunas inexistentes'));
        card.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-bottom:12px;' },
          broken.map(k => k + ' = "' + cfg[k] + '"').join(' · ')));
        card.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--primary',
          onclick: () => SolsticeProps.select(slot.id)
        }, 'Reconfigurar →'));
        body.appendChild(card);
        return;
      }

      // Delega para a implementação
      try { def.render(slot, body, ctx); }
      catch(err){
        body.innerHTML = '';
        body.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
          '⚠️ Erro ao renderizar: ' + (err.message || err)));
        console.error('[Components]', def.id, err);
      }
    }

    /**
     * Patch UX (ADR-105): resize livre via handle ↘ no canto.
     * - Horizontal: ajusta row.widths[i] / widths[i±1] (preserva total = 100)
     * - Vertical:   ajusta slot.config.size.height (200-800px)
     * Slot único na row: largura é no-op com toast informativo.
     */
    let _cornerDrag = null;

    function _onCornerResizeStart(e, slot, wrap){
      e.preventDefault();
      e.stopPropagation();
      const slotEl = wrap.closest('.solstice__slot');
      const rowEl = wrap.closest('.solstice__row');
      if (!slotEl || !rowEl) return;
      const slots = SolsticeUtils.qsa('.solstice__slot', rowEl);
      const idx = slots.indexOf(slotEl);
      if (idx < 0) return;
      const sec = SolsticeStore.get('canvas.sections').find(
        s => s.id === rowEl.closest('.solstice__section').dataset.id);
      const row = sec && sec.rows.find(r => r.id === rowEl.dataset.id);
      if (!row) return;
      const rowRect = rowEl.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const startWidths = (row.widths && row.widths.slice())
        || Array(row.slots.length).fill(100 / row.slots.length);
      _cornerDrag = {
        slot, wrap, slotEl, rowEl, sec, row, idx,
        startX: e.clientX, startY: e.clientY,
        startWidths,
        rowTotalPx: rowRect.width,
        startHeight: (slot.config && slot.config.size && slot.config.size.height) || wrapRect.height,
        isSingleSlot: row.slots.length === 1,
        currentWidths: null,
        currentHeight: null
      };
      const corner = wrap.querySelector('.solstice__resize-corner');
      if (corner) corner.classList.add('is-active');
      wrap.classList.add('is-resizing');
      document.body.style.cursor = 'nwse-resize';
      document.addEventListener('mousemove', _onCornerResizeMove);
      document.addEventListener('mouseup',   _onCornerResizeEnd);
    }

    function _onCornerResizeMove(e){
      if (!_cornerDrag) return;
      const d = _cornerDrag;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      // Vertical → altura
      // Sprint 41 / feedback do usuário: "tem teto que impede ir até o final…
      // independente se quiser colocar um inteiro na página ela pode". Antes
      // o resize era limitado em 800px. Agora: floor 200 (mantém clicável)
      // e teto = altura disponível da viewport menos margem mínima de 80px
      // (header + breathing room). Em monitores 4K (~2160px) chega a ~2080px
      // de altura útil — efetivamente "inteira a página" como pedido.
      let newHeight = d.startHeight + dy;
      const _maxH = Math.max(800, window.innerHeight - 80);
      newHeight = Math.max(200, Math.min(_maxH, newHeight));
      d.wrap.style.height = newHeight + 'px';
      d.currentHeight = newHeight;

      // Horizontal → widths (só se não-único)
      if (!d.isSingleSlot){
        const deltaPct = (dx / d.rowTotalPx) * 100;
        const w = d.startWidths.slice();
        // Aumenta este slot; reduz o vizinho à direita se houver, senão o anterior
        const partner = (d.idx < d.row.slots.length - 1) ? d.idx + 1 : d.idx - 1;
        const sign = partner > d.idx ? 1 : -1;
        let myNew = w[d.idx] + deltaPct * sign;
        let pNew  = w[partner] - deltaPct * sign;
        if (myNew >= 5 && pNew >= 5){
          w[d.idx] = myNew;
          w[partner] = pNew;
          d.rowEl.style.gridTemplateColumns = w.map(p => p.toFixed(2) + 'fr').join(' ');
          d.currentWidths = w;
        }
      }
    }

    function _onCornerResizeEnd(){
      document.removeEventListener('mousemove', _onCornerResizeMove);
      document.removeEventListener('mouseup',   _onCornerResizeEnd);
      document.body.style.cursor = '';
      if (!_cornerDrag) return;
      const d = _cornerDrag;
      const corner = d.wrap.querySelector('.solstice__resize-corner');
      if (corner) corner.classList.remove('is-active');
      d.wrap.classList.remove('is-resizing');

      const changedHeight = d.currentHeight && d.currentHeight !== d.startHeight;
      const changedWidth  = d.currentWidths != null;

      if (changedHeight || changedWidth){
        const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
        const sec = sections.find(s => s.id === d.sec.id);
        const row = sec && sec.rows.find(r => r.id === d.row.id);
        if (row){
          if (changedWidth){
            row.widths = d.currentWidths;
            row.layout = 'custom';
            // G3-24 v3 · Hook automático compactRow: garante que widths somem 100%
            // sem vazio fantasma à direita quando o usuário encolhe um slot.
            // Auditoria 2026.4: encolher um bloco de 4 colunas para 1 não pode deixar espaço vazio
            // residual". Antes ficava só com widths salvos sem normalizar.
            const sum = row.widths.reduce((a,b) => a+b, 0);
            if (Math.abs(sum - 100) > 0.1 && sum > 0){
              const scale = 100 / sum;
              row.widths = row.widths.map(w => Math.max(5, w * scale));
              // Re-normaliza após o piso de 5%
              const s2 = row.widths.reduce((a,b) => a+b, 0);
              if (Math.abs(s2 - 100) > 0.1) row.widths = row.widths.map(w => w * (100 / s2));
            }
          }
          if (changedHeight){
            const sl = row.slots.find(x => x.id === d.slot.id);
            if (sl){
              sl.config = sl.config || {};
              sl.config.size = Object.assign({}, sl.config.size || {}, { height: Math.round(d.currentHeight) });
            }
          }
          SolsticeStore.set('canvas.sections', sections);
          SolsticeAudit.record({
            action: 'resize_slot', target: d.slot.id, componentId: d.slot.id,
            details: {
              width: changedWidth ? d.currentWidths.map(v => +v.toFixed(2)) : null,
              height: changedHeight ? Math.round(d.currentHeight) : null
            }
          });
        }
      } else if (d.isSingleSlot && Math.abs(d.startX - d.startX) === 0){
        // (no-op visual mas usuário tentou — nada a fazer)
      }
      _cornerDrag = null;
    }

    /** Polish v8c — edit inline do título do componente.
     *  Double-click no .solstice__comp-title chama esta função.
     *  Persiste em slot.config.customTitle. Enter salva, Esc cancela,
     *  campo vazio restaura título dinâmico (def.getTitle ou def.name). */
    function _editComponentTitle(titleEl, slot, def, ctx){
      const dynamicTitle = (typeof def.getTitle === 'function')
        ? (function(){ try { return def.getTitle(slot, ctx); } catch(e){ return def.name; } })()
        : def.name;
      const cur = (slot.config && slot.config.customTitle) || dynamicTitle;
      // Substitui DOM por input
      const input = SolsticeUtils.el('input', {
        type: 'text',
        value: cur,
        class: 'solstice__comp-title-edit',
        maxlength: '80',
        placeholder: 'Ex: Distribuição por Canal'
      });
      // Preserva ícone visualmente
      const wrap = SolsticeUtils.el('div', { class:'solstice__comp-title is-editing' });
      wrap.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true', style:'opacity:0.6;' }, def.icon + '  '));
      wrap.appendChild(input);
      titleEl.replaceWith(wrap);
      input.focus();
      input.select();

      function _commit(newTitle){
        const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
        for (const s of sections) for (const r of s.rows){
          const sl = r.slots.find(x => x.id === slot.id);
          if (sl){
            sl.config = sl.config || {};
            // String vazia → remove customTitle (volta pro dinâmico)
            if (newTitle && newTitle.trim() && newTitle.trim() !== dynamicTitle){
              sl.config.customTitle = newTitle.trim();
            } else {
              delete sl.config.customTitle;
            }
            SolsticeStore.set('canvas.sections', sections);
            try {
              SolsticeAudit.record({
                action: 'comp_rename', target: slot.id,
                details: { type: slot.type, oldTitle: cur, newTitle: newTitle.trim() || '(default)' }
              });
            } catch(_){}
            return;
          }
        }
      }
      function _cancel(){ render(); }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter'){ e.preventDefault(); _commit(input.value); }
        if (e.key === 'Escape'){ e.preventDefault(); _cancel(); }
      });
      input.addEventListener('blur', () => _commit(input.value));
    }

    // Auditoria 2026 (cleanliness): _openLocalFiltersModal removida — Patch 1A
    // (ADR-115) substituído pelo CrossFilter atual + filtros globais. Nunca era
    // invocada no fluxo ativo. Para reintroduzir filtros por-slot, ver SolsticeFilters.

    /** Sparkline SVG simples (reuso do conceito do B2 que foi tirado do editor). */
    function _sparkline(values, color){
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 240 28');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.cssText = 'display:block;width:100%;height:28px;';
      if (!values.length) return svg;
      const [min, max] = SolsticeStats.minMax(values); /* code review 2026: minMax safe */
      const range = max - min || 1;
      const step = 240 / Math.max(1, values.length - 1);
      let d = '';
      values.forEach((v, i) => {
        const x = i * step;
        const y = 28 - ((v - min) / range) * 24 - 2;
        d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
      });
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color || 'var(--c-accent)');
      path.setAttribute('stroke-width', '1.5');
      svg.appendChild(path);
      return svg;
    }

    /* ===== KPI CARD (refeito no Patch B5-r2) =====
       Layout: título no canto sup-direito · valor grande à esquerda
       · linha de comparação humanizada · SEM sparkline default
       (toggle via slot.config.showSparkline; substitui "últimos N pontos")
    */
    register({
      id:'kpi', name:'KPI Card', icon:'📊',
      description: 'Número importante com comparação e tendência',
      // Sprint 24 / F-20: Antes target = null forçava o usuário a abrir
      // ⚙️ Configurar pra preencher Meta/Média manualmente. Agora auto-infere
      // baseado em estatísticas do dataset: meta = p75 (se higherIsBetter) ou
      // p25 (se lowerIsBetter, ex. tempo de atendimento) ou média histórica.
      defaultConfig: (ctx) => {
        // Auditoria 2026.6 (KPI-DEFAULT): ao adicionar um KPI pela mão, escolhe a
        // MELHOR métrica via SolsticeColumnScore (receita > quantidade), igual ao
        // AutoDashboard — antes pegava a 1ª numérica (qtd) por posição.
        let col = _firstColOfGroup(ctx, 'numeric');
        try {
          if (typeof SolsticeColumnScore !== 'undefined' && SolsticeColumnScore.rank){
            const numCols = (ctx.columns || []).filter(c => SolsticeTypes.group((ctx.types[c] || {}).type) === 'numeric');
            const ranked = SolsticeColumnScore.rank(ctx).filter(r => numCols.includes(r.col));
            if (ranked.length) col = ranked[0].col;
          }
        } catch(_){}
        let autoTarget = null;
        if (col){
          try {
            const values = ctx.rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
            if (values.length >= 10){
              const dictCol = ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[col];
              const higherIsBetter = !dictCol || dictCol.higherIsBetter !== false;
              // p75 se higherIsBetter (meta ambiciosa) · p25 se lowerIsBetter
              const sorted = values.slice().sort((a, b) => a - b);
              const targetPct = higherIsBetter ? 0.75 : 0.25;
              const idx = (sorted.length - 1) * targetPct;
              const lo = Math.floor(idx), hi = Math.ceil(idx);
              const targetValue = sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
              autoTarget = {
                value: Math.round(targetValue * 100) / 100,
                label: higherIsBetter ? 'Meta (p75 histórico)' : 'Meta (p25 histórico)',
                mode: 'progress',
                _auto: true  // marca que foi auto-inferido (pra UI poder mostrar isso)
              };
            }
          } catch(_){}
        }
        return {
          column: col,
          agg:'sum',
          showSparkline: false,
          comparison: { type: 'previous-period', targetValue: null, targetLabel: '', periodSize: 'auto' },
          target: autoTarget  // ADR-132 + Sprint 24 / F-20: auto-inferido
        };
      },
      // Patch B5-r4 / ADR-045: título dinâmico — usa nome amigável da coluna em uppercase
      getTitle(slot, ctx){
        const col = slot.config && slot.config.column;
        if (!col) return 'KPI Card';
        return SolsticeHumanize.column(col, ctx.dictionary).toUpperCase();
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        const col = cfg.column;
        const agg = cfg.agg || 'sum';

        // Container raiz com layout próprio (substitui o padding/flex padrão da casca)
        // B2-04 (v6-autonomous / AC-01 — Marina/NVDA): KPI card ganha role + aria-label
        // descritivo. Antes NVDA lia só o número solto "R$ 1.2M" sem contexto.
        // Agora lê "Região, KPI: Soma de Receita Mensal = R$ 1.2M"
        const friendlyForLabel = SolsticeHumanize.column(col || '?', ctx.dictionary);
        const card = SolsticeUtils.el('div', {
          class:'solstice__kpi-card',
          role: 'region',
          'aria-label': 'KPI · ' + (cfg.title || friendlyForLabel)
        });
        host.appendChild(card);

        if (!col){
          card.appendChild(SolsticeUtils.el('div', { class:'solstice__kpi-card-empty' },
            'Selecione uma coluna numérica em ⚙️ Configurar.'));
          return;
        }

        const dictCol = ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[col];
        const friendlyName = SolsticeHumanize.column(col, ctx.dictionary);
        // Sprint 39: quando dict não tem higherIsBetter explícito, INFERE por
        // nome da coluna. Antes: undefined → muted (cinza) ou pior, calculado
        // errado em outro lugar como vermelho. Heurística pt-BR + en-US:
        //   - palavras "tempo/duracao/custo/erro/atraso/inadimplencia/dpd/
        //     defeito/falha/reclama/cancelad/perda/refugo" → menor é melhor
        //   - resto (receita/venda/conversão/qtd/nps/share) → maior é melhor
        // User: "+99% acima do período anterior" pra Receita estava vermelho
        // sem fundamento.
        function _inferHIB(colName){
          const lower = String(colName || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
          // Termos onde DIMINUIR é bom
          const LOWER_IS_BETTER = /tempo|duracao|custo|erro|atraso|inadimplenc|dpd|defeito|falha|reclama|cancelad|perda|refugo|churn|abandon|rejei|incident|bug|crash|latenc|delay|wait|fila|ttr|tta|aht|attrition|turnover/;
          if (LOWER_IS_BETTER.test(lower)) return false;
          // Termos onde AUMENTAR é bom (heurística positiva pra maioria das métricas de negócio)
          const HIGHER_IS_BETTER = /receita|venda|faturament|lucro|margem|conversao|nps|csat|sla|aprovad|engaja|click|visualiza|impressao|leads|sessao|usuari|inscri|adesao|reten|cobertura|disponibilidade|uptime|score|rating|qualidade|nota|share|growth|crescimento|ticket|volume|qtd|quantidade|interacoes|atendiment|valor|saldo|patrim|receit|montante|ganho|economia/;
          if (HIGHER_IS_BETTER.test(lower)) return true;
          return null; // genuinamente neutro
        }
        let higherIsBetter = dictCol && dictCol.higherIsBetter;
        if (higherIsBetter == null){
          higherIsBetter = _inferHIB(col);
        }
        const unit = (dictCol && dictCol.unit) || '';

        // Sprint 34 / J-1: SolsticeStats.parseNum entende pt-BR "1.234,56"
        const values = ctx.rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
        if (!values.length){
          card.appendChild(SolsticeUtils.el('div', { class:'solstice__kpi-card-empty' },
            'Sem valores válidos em "' + friendlyName + '"'));
          return;
        }

        // Computa valor agregado
        let value;
        if (agg === 'sum')        value = values.reduce((a,b)=>a+b, 0);
        else if (agg === 'avg' || agg === 'mean')  value = values.reduce((a,b)=>a+b, 0) / values.length;
        else if (agg === 'min')   value = SolsticeStats.min(values);
        else if (agg === 'max')   value = SolsticeStats.max(values);
        else if (agg === 'count') value = values.length;
        else if (agg === 'median'){
          const s = values.slice().sort((a,b)=>a-b);
          const m = Math.floor(s.length / 2);
          value = s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
        } else {
          value = values.reduce((a,b)=>a+b, 0);
        }
        const aggLabel = SolsticeHumanize.aggregation(agg);

        const def = SolsticeTypes.getType(ctx.types[col] && ctx.types[col].type);
        // Auditoria 2026.6 (KPI-FORMATO): formato de número configuravel pelo
        // inspector (cfg.format + cfg.formatDecimals). 'auto' = formato do tipo
        // da coluna (comportamento anterior).
        const formatted = (function(){
          const fmt = cfg.format || 'auto';
          const dec = (cfg.formatDecimals != null) ? cfg.formatDecimals : 2;
          try {
            if (fmt === 'integer') return ctx.L.integer(Math.round(value));
            if (fmt === 'decimal') return ctx.L.decimal(value, dec);
            if (fmt === 'currency') return ctx.L.currency(value);
            if (fmt === 'percent')  return ctx.L.decimal(value, dec) + '%';
            if (fmt === 'compact'){ const a = Math.abs(value);
              if (a >= 1e9) return ctx.L.decimal(value/1e9, 1) + 'B';
              if (a >= 1e6) return ctx.L.decimal(value/1e6, 1) + 'M';
              if (a >= 1e3) return ctx.L.decimal(value/1e3, 1) + 'k';
              return ctx.L.integer(Math.round(value)); }
            return def && def.format ? def.format(value, ctx.L) : ctx.L.decimal(value, 2);
          } catch(e){ return ctx.L.decimal(value, 2); }
        })();

        // Patch B5-r4: título migrou para o header da casca (esquerda) via def.getTitle.
        // Unidade ainda fica visível na meta abaixo do valor quando relevante.

        // Camada Style v2: lê opções específicas do KPI do slot.config.style
        const style = cfg.style || {};
        const deltaPos = style.kpiDeltaPosition || 'below';
        const showSpark = (style.showSparkline === true) || (cfg.showSparkline === true);

        // === Linha 1: valor grande à esquerda ===
        // Tooltip humanizado: "Soma de 200 valores válidos da coluna Receita Mensal"
        const tooltip = aggLabel + ' de ' + SolsticeHumanize.recordCount(values.length).replace(' registros', ' valores válidos').replace(' registro', ' valor válido') + ' da coluna ' + friendlyName;
        const valueEl = SolsticeUtils.el('div', {
          class: 'solstice__kpi-value',
          title: tooltip,
          'aria-label': tooltip,
          style: 'color: var(--comp-value-color, var(--c-text));'
        }, formatted);

        // === Linha 3: comparação humanizada (ADR-042: 8 tipos configuráveis) ===
        const compInfo = SolsticeKPI.calculateDelta(values, cfg);
        let deltaInfo;
        if (compInfo == null){
          deltaInfo = { text: 'Calculado de ' + SolsticeHumanize.recordCount(values.length), color: 'muted', direction: 'none', ariaLabel: 'Calculado de ' + SolsticeHumanize.recordCount(values.length) };
        } else {
          deltaInfo = SolsticeHumanize.delta(compInfo.pct, higherIsBetter, compInfo.baselineLabel);
        }
        // AS-03: data-direction + aria-label garantem distinção sem depender só de cor
        const deltaEl = SolsticeUtils.el('div',
          {
            class: 'solstice__kpi-delta solstice__kpi-delta--' + deltaInfo.color,
            'data-direction': deltaInfo.direction || 'none',
            role: 'status',
            'aria-label': deltaInfo.ariaLabel || deltaInfo.text
          },
          deltaInfo.text);

        // Posicionamento do delta (style.kpiDeltaPosition)
        if (deltaPos === 'inline'){
          // Delta na mesma linha do valor (flex row)
          const row = SolsticeUtils.el('div', { style:'display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;' });
          row.appendChild(valueEl);
          row.appendChild(deltaEl);
          card.appendChild(row);
        } else if (deltaPos === 'hidden'){
          card.appendChild(valueEl);
          // delta omitido
        } else {
          // 'below' (default)
          card.appendChild(valueEl);
          card.appendChild(deltaEl);
        }

        // === Sparkline opcional ===
        if (showSpark){
          const hasTemporal = ctx.columns.some(c => SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'temporal');
          const sparkBox = SolsticeUtils.el('div', { class:'solstice__kpi-spark' });
          sparkBox.appendChild(_sparkline(values.slice(0, 80)));
          card.appendChild(sparkBox);
          card.appendChild(SolsticeUtils.el('div', { class:'solstice__kpi-spark-caption' },
            hasTemporal ? 'Tendência ao longo do tempo' : 'Variação ao longo dos dados'));
        }

        // === Patch 2 (ADR-132): barra de progresso/tolerância de meta ===
        // Auditoria 2026.6 (KPI-TARGET-STALE): a Meta auto-inferida (_auto) era
        // calculada só na criação; ao TROCAR a coluna pelo inspector ela exibia o
        // p75 da coluna antiga (ex: "56" de qtd_vendas mostrado pra receita).
        // Recomputa pro display quando a coluna mudou — sem mutar o config salvo.
        let _tgtVal = cfg.target && cfg.target.value, _tgtLabel = cfg.target && cfg.target.label;
        if (cfg.target && cfg.target._auto && cfg.target._col !== cfg.column && values.length >= 10){
          const dc = ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[cfg.column];
          const hib = !dc || dc.higherIsBetter !== false;
          const srt = values.slice().sort((a,b)=>a-b);
          const p = hib ? 0.75 : 0.25, ix = (srt.length-1)*p, lo = Math.floor(ix), hi = Math.ceil(ix);
          _tgtVal = Math.round((srt[lo] + (ix-lo)*(srt[hi]-srt[lo]))*100)/100;
          _tgtLabel = hib ? 'Meta (p75 histórico)' : 'Meta (p25 histórico)';
        }
        if (cfg.target && _tgtVal != null && !isNaN(parseFloat(_tgtVal))){
          const tgt = parseFloat(_tgtVal);
          const mode = cfg.target.mode || 'progress';
          const label = _tgtLabel || 'Meta';
          const currentValue = (function(){
            // Reusa o cálculo do mesmo agg
            if (agg === 'sum')   return values.reduce((a,b)=>a+b, 0);
            if (agg === 'avg' || agg === 'mean') return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
            if (agg === 'min')   return SolsticeStats.min(values);
            if (agg === 'max')   return SolsticeStats.max(values);
            if (agg === 'count') return values.length;
            return 0;
          })();
          const pct = tgt === 0 ? 0 : Math.max(0, Math.min(1.5, currentValue / tgt));
          const pctDisplay = Math.round(pct * 100);
          const targetBox = SolsticeUtils.el('div', { style:'margin-top:12px;' });
          // Barra
          if (mode === 'progress' || mode === 'tolerance'){
            const barWrap = SolsticeUtils.el('div', {
              style:'width:100%;height:8px;background:var(--c-surface-3);border-radius:4px;overflow:hidden;position:relative;'
            });
            // ADR-170 (Fix-2 v5.5 · Auditoria 2026.4): tabela de decisão clara
            // com 3 zonas pra ambas direções. Antes: higherIsBetter:false só tinha
            // 2 cores (sem amarelo) e 100% exato caía na zona errada. Agora
            // 100% exato é unambiguously success em ambos os casos.
            let fillColor = 'var(--c-accent)';  // default neutro (higherIsBetter null)
            if (higherIsBetter === true){
              // maior é melhor: success ≥100% · warn 70-99% · error <70%
              if (pct >= 1.0) fillColor = 'var(--c-success)';
              else if (pct >= 0.7) fillColor = 'var(--c-warn)';
              else fillColor = 'var(--c-error)';
            } else if (higherIsBetter === false){
              // menor é melhor: success ≤100% · warn 100-130% · error >130%
              if (pct <= 1.0) fillColor = 'var(--c-success)';
              else if (pct <= 1.3) fillColor = 'var(--c-warn)';
              else fillColor = 'var(--c-error)';
            } else {
              // neutro (sem direcionalidade): accent quando atinge, muted abaixo
              fillColor = pct >= 1.0 ? 'var(--c-accent)' : 'var(--c-muted)';
            }
            const fill = SolsticeUtils.el('div', {
              role:'progressbar',
              'aria-valuenow': String(currentValue),
              'aria-valuemax': String(tgt),
              'aria-label': label + ': ' + pctDisplay + '%',
              style:'height:100%;background:' + fillColor + ';border-radius:4px;width:0%;transition:width 800ms cubic-bezier(0.16,1,0.3,1);'
            });
            barWrap.appendChild(fill);
            targetBox.appendChild(barWrap);
            // Anima após DOM montar
            requestAnimationFrame(() => {
              fill.style.width = Math.min(100, pctDisplay) + '%';
            });
          }
          // Label
          targetBox.appendChild(SolsticeUtils.el('div', {
            style:'margin-top:6px;font-size:11px;color:var(--c-text-2);display:flex;justify-content:space-between;'
          },
            SolsticeUtils.el('span', null, pctDisplay + '% da meta'),
            SolsticeUtils.el('span', null, label + ': ' + tgt.toLocaleString('pt-BR'))
          ));
          card.appendChild(targetBox);
        }
      }
    });

    /* ===== SÉRIE TEMPORAL ===== */
    register({
      id:'time-series', name:'Série Temporal', icon:'📈',
      description: 'Evolução de uma métrica ao longo do tempo',
      defaultConfig: (ctx) => ({
        xColumn: _firstColOfGroup(ctx, 'temporal'),
        yColumn: _firstColOfGroup(ctx, 'numeric'),
        bin:'day', kind:'line',
        showLabels: false,           // Patch 1A (ADR-119)
        // Patch 2 (ADR-133):
        showForecast: false,         // Mostrar previsão tracejada
        forecastPeriods: 3,
        forecastMethod: 'linear',    // 'linear' | 'holtWinters'
        showTarget: false,           // Linha horizontal de meta
        targetValue: null,
        showCompare: false,          // Período anterior sobreposto
        compareMode: 'same-duration',// 'same-duration' | '1-year-back'
        // Patch 2 (ADR-138): eixo X compound — segunda dimensão como subgrupo colorido
        xCompoundColumn: null        // Dimensão secundária (ex: 'canal')
      }),
      render(slot, host, ctx){
        const cfg = slot.config || {};
        // Auditoria 2026.6 (MULTI-EIXO): várias colunas Y (multi-série) — usuário:
        // "deixe customizavel para colocar quantos eixo y quiser". Caminho ISOLADO
        // (early-return) — não toca o fluxo single-Y (forecast/compound/LTTB) abaixo,
        // então zero risco de regressão no comportamento atual.
        const _yCols = Array.isArray(cfg.yColumns) ? cfg.yColumns.filter(c => c && ctx.columns.indexOf(c) >= 0) : [];
        if (cfg.xColumn && _yCols.length >= 2 && typeof Chart !== 'undefined'){
          const _bk = (d) => {
            if (cfg.bin === 'month') return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
            if (cfg.bin === 'week'){ const oj = new Date(d.getFullYear(),0,1); const wk = Math.ceil(((( d - oj)/86400000) + oj.getDay()+1)/7); return d.getFullYear()+'-W'+String(wk).padStart(2,'0'); }
            if (cfg.bin === 'year') return String(d.getFullYear());
            return d.toISOString().slice(0,10);
          };
          const maps = _yCols.map(() => new Map());
          const keySet = new Set();
          for (const r of ctx.rows){
            const d = SolsticeTypes.toDate(r[cfg.xColumn]); if (!d || isNaN(d)) continue;
            const k = _bk(d); keySet.add(k);
            _yCols.forEach((yc, j) => { const v = SolsticeStats.parseNum(r[yc]); if (isNaN(v)) return; maps[j].set(k, (maps[j].get(k)||0) + v); });
          }
          const labels = Array.from(keySet).sort();
          const PAL = (typeof SolsticeStyle !== 'undefined' && SolsticeStyle.paletteColors) ? (SolsticeStyle.paletteColors('auto') || ['#4D9FFF','#F59E0B','#10B981','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316']) : ['#4D9FFF','#F59E0B','#10B981','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316'];
          const isDark = document.documentElement.getAttribute('data-mode') === 'dark';
          const datasets = _yCols.map((yc, j) => {
            const color = PAL[j % PAL.length];
            const nm = (ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[yc] && ctx.dictionary.columns[yc].friendlyName) || yc;
            return { label: nm, data: labels.map(k => maps[j].get(k) || 0), borderColor: color, backgroundColor: cfg.kind === 'area' ? color + '33' : 'transparent', fill: cfg.kind === 'area', tension: 0.25, pointRadius: 2, borderWidth: 1.8 };
          });
          const wrap = SolsticeUtils.el('div', { class:'solstice__chart-wrap' });
          const canvas = document.createElement('canvas'); wrap.appendChild(canvas); host.appendChild(wrap);
          requestAnimationFrame(() => {
            if (canvas._chart){ try { canvas._chart.destroy(); } catch(_){} }
            canvas._chart = new Chart(canvas, {
              type: cfg.kind === 'area' ? 'line' : (cfg.kind || 'line'),
              data: { labels, datasets },
              options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true, position:'bottom', labels:{ font:{size:10}, boxWidth:14, padding:8 } } },
                scales: {
                  x: { grid:{ color: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' }, ticks:{ color: isDark ? '#B8C4E0' : '#334155', font:{size:10} } },
                  y: { grid:{ color: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' }, ticks:{ color: isDark ? '#B8C4E0' : '#334155', font:{size:10} } }
                },
                onClick: (e, els, chart) => { if (!els || !els.length) return; const lab = chart.data.labels[els[0].index]; if (cfg.xColumn && lab != null && typeof SolsticeCrossFilter !== 'undefined') SolsticeCrossFilter.activate(cfg.xColumn, lab, { bin: cfg.bin }); }
              }
            });
          });
          _observeResponsive(host, registry['time-series'], slot, ctx);
          return;
        }
        if (!cfg.xColumn || !cfg.yColumn){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
            'Selecione coluna temporal e numérica em ⚙️ Configurar.'));
          return;
        }
        if (typeof Chart === 'undefined'){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
            '⏳ Aguardando Chart.js carregar (CDN).'));
          return;
        }

        // Patch 2 (ADR-138): compound X — múltiplos datasets por subcategoria
        const compoundCol = cfg.xCompoundColumn || null;

        function _binKey(d){
          if (cfg.bin === 'year') return String(d.getFullYear()); // Auditoria 2026.6: faltava 'year'
          if (cfg.bin === 'month') return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
          if (cfg.bin === 'week'){
            const onejan = new Date(d.getFullYear(), 0, 1);
            const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
            return d.getFullYear() + '-W' + String(week).padStart(2,'0');
          }
          return d.toISOString().slice(0,10);
        }

        // Agrega por bin temporal — Patch 1A (ADR-113) cacheado por slot
        const buckets = SolsticeCompCache.get(slot.id, cfg, ctx.rows, () => {
          if (compoundCol){
            // Map<binKey, Map<subKey, sum>>
            const b = new Map();
            const subSet = new Set();
            for (const r of ctx.rows){
              const d = new Date(r[cfg.xColumn]);
              if (isNaN(d)) continue;
              const v = SolsticeStats.parseNum(r[cfg.yColumn]);
              if (isNaN(v)) continue;
              const key = _binKey(d);
              const sub = String(r[compoundCol] != null ? r[compoundCol] : '—');
              subSet.add(sub);
              if (!b.has(key)) b.set(key, new Map());
              const inner = b.get(key);
              inner.set(sub, (inner.get(sub) || 0) + v);
            }
            return { compound: true, byBin: b, subs: Array.from(subSet) };
          } else {
            const b = new Map();
            for (const r of ctx.rows){
              const d = new Date(r[cfg.xColumn]);
              if (isNaN(d)) continue;
              const v = SolsticeStats.parseNum(r[cfg.yColumn]);
              if (isNaN(v)) continue;
              b.set(_binKey(d), (b.get(_binKey(d)) || 0) + v);
            }
            return b;
          }
        });

        let labels = [], data = [], compoundData = null;
        if (compoundCol && buckets.compound){
          labels = Array.from(buckets.byBin.keys()).sort();
          compoundData = buckets.subs.map(sub => ({
            sub,
            values: labels.map(k => (buckets.byBin.get(k).get(sub)) || 0)
          }));
          // Para compatibilidade com LTTB / downstream, usa a soma total como data principal
          data = labels.map(k => Array.from(buckets.byBin.get(k).values()).reduce((a,b) => a+b, 0));
        } else {
          labels = Array.from(buckets.keys()).sort();
          data = labels.map(k => buckets.get(k));
        }

        // Patch 1A (ADR-114): LTTB automático quando série > 800 pontos
        let downsampleNote = null;
        if (labels.length > 800 && SolsticeStats && SolsticeStats.lttb){
          const points = labels.map((x, i) => [i, data[i]]);
          const ds = SolsticeStats.lttb(points, 600);
          const keepIdx = new Set(ds.map(p => p[0]));
          const newLabels = [], newData = [];
          labels.forEach((lab, i) => { if (keepIdx.has(i)){ newLabels.push(lab); newData.push(data[i]); } });
          downsampleNote = `Visualização otimizada: ${newLabels.length} de ${labels.length} pontos exibidos`;
          labels = newLabels;
          data = newData;
        }

        const wrap = SolsticeUtils.el('div', { class:'solstice__chart-wrap' });
        if (downsampleNote){
          wrap.appendChild(SolsticeUtils.el('div', {
            style:'font-size:10px;color:var(--c-muted);padding:2px 6px;font-family:var(--font-mono);'
          }, '📉 ' + downsampleNote));
        }
        const canvas = document.createElement('canvas');
        wrap.appendChild(canvas);
        host.appendChild(wrap);

        // Aguarda layout para Chart.js pegar tamanho correto
        requestAnimationFrame(() => {
          const yDict = ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[cfg.yColumn];
          const yName = (yDict && yDict.friendlyName) || cfg.yColumn;
          const isDark = document.documentElement.getAttribute('data-mode') === 'dark';
          const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim();
          // Patch 2 (ADR-133): datasets extras (forecast/target/compare)
          const allLabels = labels.slice();
          const datasets = [];
          // Patch 2 (ADR-138): compound — múltiplos datasets coloridos por subcategoria
          if (compoundData){
            // FIX1 v4 (Auditoria 2026.4): gráficos atualizam cor ao trocar paleta — antes ficavam com cor antiga
            // continua com a mesma cor". Causa: PALETTE hardcoded aqui. Agora lê
            // do SolsticeStyle.paletteColors('auto') que propaga do tema global (R G3-23).
            const PALETTE = (typeof SolsticeStyle !== 'undefined' && SolsticeStyle.paletteColors)
              ? (SolsticeStyle.paletteColors('auto') || ['#4D9FFF', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'])
              : ['#4D9FFF', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
            compoundData.forEach((sd, i) => {
              const color = PALETTE[i % PALETTE.length];
              datasets.push({
                label: yName + ' · ' + sd.sub,
                data: sd.values,
                borderColor: color,
                backgroundColor: color + '30',
                fill: false, tension: 0.25, pointRadius: 2,
                borderWidth: 1.8
              });
            });
          } else {
            datasets.push({
              label: yName, data: data.slice(),
              borderColor: accent,
              backgroundColor: cfg.kind === 'area' ? accent + '40' : 'transparent',
              fill: cfg.kind === 'area',
              tension: 0.25, pointRadius: 2
            });
          }

          // (A) Forecast — linha tracejada estendendo allLabels
          if (cfg.showForecast && data.length >= 3){
            const n = Math.max(1, Math.min(12, parseInt(cfg.forecastPeriods) || 3));
            let fc = [];
            if (cfg.forecastMethod === 'holtWinters' && SolsticeStats.holtWinters){
              try { fc = SolsticeStats.holtWinters(data, n) || []; } catch(e){ fc = []; }
            }
            if (!fc.length){
              // Linear regression fallback
              const reg = SolsticeStats.linearRegression(data.map((v,i) => [i,v]));
              if (reg){
                const start = data.length;
                for (let i = 0; i < n; i++) fc.push(reg.slope * (start + i) + reg.intercept);
              }
            }
            // Estende labels com placeholders "+1", "+2"…
            const fcLabels = fc.map((_, i) => '+' + (i+1));
            allLabels.push(...fcLabels);
            // Dataset principal ganha null nos pontos novos
            datasets[0].data = datasets[0].data.concat(fc.map(() => null));
            // Dataset forecast: nulls antes, valores depois
            const fcData = data.map(() => null).concat(fc);
            // Conecta o último ponto real ao primeiro forecast para continuidade visual
            if (fcData.length > 0 && data.length > 0) fcData[data.length - 1] = data[data.length - 1];
            datasets.push({
              label: yName + ' · Previsão',
              data: fcData,
              borderColor: accent,
              borderDash: [6, 4],
              backgroundColor: 'transparent',
              fill: false, tension: 0.25, pointRadius: 2,
              borderWidth: 2
            });
          }

          // (B) Target — linha horizontal de meta
          if (cfg.showTarget && cfg.targetValue != null && !isNaN(parseFloat(cfg.targetValue))){
            const tgt = parseFloat(cfg.targetValue);
            datasets.push({
              label: 'Meta: ' + tgt,
              data: allLabels.map(() => tgt),
              borderColor: getComputedStyle(document.documentElement).getPropertyValue('--c-warn').trim() || '#F59E0B',
              borderDash: [4, 4],
              backgroundColor: 'transparent',
              fill: false, pointRadius: 0, borderWidth: 1.5
            });
          }

          // (C) Comparação de períodos
          if (cfg.showCompare && data.length >= 4){
            // Compara primeira metade vs segunda metade (mesma-duração simples)
            const half = Math.floor(data.length / 2);
            const compareData = allLabels.map(() => null);
            // Segunda metade aparece "alinhada" sobre a primeira (offset visual)
            for (let i = 0; i < half; i++){
              compareData[i] = data[half + i];
            }
            datasets.push({
              label: yName + ' · Período anterior',
              data: compareData,
              borderColor: getComputedStyle(document.documentElement).getPropertyValue('--c-text-2').trim() || '#94A3B8',
              borderDash: [2, 2],
              backgroundColor: 'transparent',
              fill: false, tension: 0.25, pointRadius: 1, borderWidth: 1.5
            });
          }

          // Camada Style v2: aplica configurações visuais do style aos charts
          const tsStyle = cfg.style || {};
          const lineStyle = tsStyle.chartLineStyle || 'smooth';
          const showGrid = tsStyle.chartGrid !== false;
          const showLegend = tsStyle.chartLegend !== false;
          const animate = tsStyle.chartAnimation !== false;
          // Aplica tipo de linha
          datasets.forEach(ds => {
            if (ds.borderDash) return; // forecast/target/compare têm dash próprio, mantém
            if (lineStyle === 'smooth') ds.tension = 0.4;
            else if (lineStyle === 'sharp') ds.tension = 0;
            else if (lineStyle === 'stepped') { ds.stepped = true; ds.tension = 0; }
          });
          // Aplica paleta se escolhida
          const paletteColors = SolsticeStyle.paletteColors(tsStyle.palette);
          if (paletteColors && paletteColors.length){
            datasets.forEach((ds, i) => {
              if (ds.label && /Previsão|Meta|Período anterior/.test(ds.label)) return; // mantém cores especiais
              ds.borderColor = paletteColors[i % paletteColors.length];
              if (ds.backgroundColor && ds.backgroundColor !== 'transparent'){
                const c = paletteColors[i % paletteColors.length];
                ds.backgroundColor = c + '33'; // 20% alpha
              }
            });
          }

          // Auditoria 2026 (R-03 / A-401): destrói instância anterior antes
          // de criar nova. Sem isso, Chart.js vazava ~2-4 MB por re-render.
          if (canvas._chart) { try { canvas._chart.destroy(); } catch(_){} canvas._chart = null; }
          // SOL-D4 v2: rótulo de dados. Quando style.showDataLabels === true,
          // desenhamos o valor numérico ao lado de cada ponto via plugin
          // inline (não depende de chartjs-plugin-datalabels). Funciona
          // mesmo sem CDN extra.
          // Sprint 42 / feedback do usuário ("rótulo de dados não editável"):
          // agora respeita style.dataLabelFormat (integer/decimal/percent/compact)
          // e style.dataLabelPosition (top/right/bottom). Default mantém
          // comportamento anterior (integer, top).
          const showLabels = !!(cfg.style && cfg.style.showDataLabels);
          const dlFormat = (cfg.style && cfg.style.dataLabelFormat) || 'integer';
          const dlPosition = (cfg.style && cfg.style.dataLabelPosition) || 'top';
          const dlDecimals = (cfg.style && cfg.style.dataLabelDecimals != null) ? cfg.style.dataLabelDecimals : 1;
          function _fmtLabel(v){
            if (v == null || isNaN(v)) return '';
            if (dlFormat === 'decimal'){
              return (typeof SolsticeLocale !== 'undefined' && SolsticeLocale.decimal)
                ? SolsticeLocale.decimal(v, dlDecimals)
                : v.toFixed(dlDecimals);
            }
            if (dlFormat === 'percent'){
              return (v * 100).toFixed(dlDecimals).replace('.', ',') + '%';
            }
            if (dlFormat === 'compact'){
              const abs = Math.abs(v);
              if (abs >= 1_000_000) return (v/1_000_000).toFixed(1).replace('.',',') + 'M';
              if (abs >= 1000)      return (v/1000).toFixed(1).replace('.',',') + 'k';
              return String(Math.round(v));
            }
            // integer (default)
            return (typeof SolsticeLocale !== 'undefined' && SolsticeLocale.integer)
              ? SolsticeLocale.integer(Math.round(v)) : String(Math.round(v));
          }
          const dataLabelsPlugin = showLabels ? {
            id: 'solDataLabels',
            afterDatasetsDraw(chart){
              const { ctx: cc } = chart;
              cc.save();
              cc.font = '10px var(--font-mono, monospace)';
              cc.fillStyle = isDark ? '#E7E9EE' : '#13161C';
              if (dlPosition === 'right'){
                cc.textAlign = 'left';
                cc.textBaseline = 'middle';
              } else if (dlPosition === 'bottom'){
                cc.textAlign = 'center';
                cc.textBaseline = 'top';
              } else {
                cc.textAlign = 'center';
                cc.textBaseline = 'bottom';
              }
              chart.data.datasets.forEach((ds, di) => {
                const meta = chart.getDatasetMeta(di);
                if (!meta || meta.hidden) return;
                meta.data.forEach((pt, i) => {
                  const v = ds.data[i];
                  if (v == null || isNaN(v)) return;
                  const s = _fmtLabel(v);
                  let ox = pt.x, oy = pt.y;
                  if (dlPosition === 'right') ox = pt.x + 6;
                  else if (dlPosition === 'bottom') oy = pt.y + 6;
                  else oy = pt.y - 5;
                  cc.fillText(s, ox, oy);
                });
              });
              cc.restore();
            }
          } : null;

          canvas._chart = new Chart(canvas, {
            type: cfg.kind === 'area' ? 'line' : (cfg.kind || 'line'),
            data: { labels: allLabels, datasets },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: animate ? undefined : false,
              plugins: { legend: { display: showLegend && datasets.length > 1, position:'bottom', labels:{ font:{size:10}, boxWidth:14, padding:8 } } },
              scales: {
                x: {
                  grid: { display: showGrid, color: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' },
                  ticks: { color: isDark ? '#B8C4E0' : '#334155', font: { size: 10 } }
                },
                y: {
                  grid: { display: showGrid, color: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' },
                  ticks: { color: isDark ? '#B8C4E0' : '#334155', font: { size: 10 } }
                }
              },
              // LE-04 (Sprint 3): cross-filter automático ao clicar num ponto.
              // Filtra os outros componentes pela categoria/data clicada.
              onClick: (event, elements, chart) => {
                if (!elements || !elements.length) return;
                const el = elements[0];
                const label = chart.data.labels[el.index];
                const xCol = cfg.xColumn || cfg.x || cfg.column;
                if (xCol && label != null && typeof SolsticeCrossFilter !== 'undefined'){
                  SolsticeCrossFilter.activate(xCol, label, { bin: cfg.bin });
                }
              },
              onHover: (event, elements, chart) => {
                event.native && event.native.target && (event.native.target.style.cursor = elements.length ? 'pointer' : 'default');
              }
            },
            plugins: dataLabelsPlugin ? [dataLabelsPlugin] : []
          });
        });
      }
    });

    /* ===== FORECAST (Sprint 31 / BH-02) =====
       Projeção temporal com banda de confiança ±1.96σ (95% IC).
       Histórico em linha cheia, projeção tracejada, banda sombreada.
       Persona Carlos (Comercial) pediu explicitamente no walkthrough.
       Usa SolsticeStats.linearForecast ou holtWinters dependendo do
       tamanho da série (>= 14 pts + sazonalidade ≈ ativa holt-winters). */
    register({
      id:'forecast', name:'Forecast', icon:'🔮',
      description: 'Projeta os próximos períodos com intervalo de confiança',
      defaultConfig: (ctx) => ({
        xColumn: _firstColOfGroup(ctx, 'temporal'),
        yColumn: _firstColOfGroup(ctx, 'numeric'),
        bin: 'month',
        periods: 6,           // quantos períodos projetar
        method: 'auto',       // 'auto' | 'linear' | 'holtWinters'
        showBand: true        // banda de confiança ±1.96σ
      }),
      getTitle(slot, ctx){
        const col = slot.config && slot.config.yColumn;
        if (!col) return 'Forecast';
        return 'PREVISÃO · ' + SolsticeHumanize.column(col, ctx.dictionary).toUpperCase();
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        if (!cfg.xColumn || !cfg.yColumn){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
            'Forecast precisa de uma coluna temporal e uma numérica. Configure em ⚙️.'));
          return;
        }
        // 1) Agrega rows por bin temporal
        function binKey(d){
          if (cfg.bin === 'day') return d.toISOString().slice(0,10);
          if (cfg.bin === 'week'){
            const onejan = new Date(d.getFullYear(), 0, 1);
            const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
            return d.getFullYear() + '-W' + String(week).padStart(2,'0');
          }
          if (cfg.bin === 'year') return String(d.getFullYear());
          return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
        }
        const buckets = {};
        for (const r of ctx.rows){
          // Sprint 34 / J-1: SolsticeStats.parseNum entende pt-BR "1.234,56"
          const v = SolsticeStats.parseNum(r[cfg.yColumn]);
          if (isNaN(v)) continue;
          const d = new Date(r[cfg.xColumn]);
          if (isNaN(d)) continue;
          const k = binKey(d);
          (buckets[k] = buckets[k] || []).push(v);
        }
        const keys = Object.keys(buckets).sort();
        if (keys.length < 3){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
            'Forecast precisa de pelo menos 3 períodos de dados — encontrei ' + keys.length + '.'));
          return;
        }
        const histY = keys.map(k => buckets[k].reduce((a,b)=>a+b, 0) / buckets[k].length);
        const N = histY.length;
        const periods = Math.max(1, Math.min(24, parseInt(cfg.periods, 10) || 6));
        // 2) Escolhe método: auto → holtWinters se N >= 14, senão linear
        let projY = [];
        let methodUsed = cfg.method || 'auto';
        if (methodUsed === 'auto') methodUsed = (N >= 14) ? 'holtWinters' : 'linear';
        try {
          if (methodUsed === 'holtWinters' && typeof SolsticeStats.holtWinters === 'function'){
            // Sazonalidade: usa 12 pra month, 7 pra day, 4 pra week, 1 pra year
            const season = cfg.bin === 'day' ? 7 : cfg.bin === 'week' ? 4 : cfg.bin === 'year' ? 1 : 12;
            projY = SolsticeStats.holtWinters(histY, periods, season);
          } else {
            projY = SolsticeStats.linearForecast(histY, periods);
          }
        } catch(e){
          projY = SolsticeStats.linearForecast(histY, periods);
          methodUsed = 'linear';
        }
        if (!projY || !projY.length){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Falha ao projetar — dados insuficientes.'));
          return;
        }
        // 3) σ dos resíduos do histórico (predicted vs actual via linear fit)
        const pts = histY.map((y,i) => [i, y]);
        const reg = SolsticeStats.linearRegression ? SolsticeStats.linearRegression(pts) : null;
        let sigma = 0;
        if (reg){
          const residuals = histY.map((y,i) => y - (reg.slope * i + reg.intercept));
          const mean = residuals.reduce((a,b)=>a+b, 0) / residuals.length;
          const variance = residuals.reduce((a,b)=>a+(b-mean)*(b-mean), 0) / Math.max(1, residuals.length - 1);
          sigma = Math.sqrt(variance);
        }
        // 4) SVG
        const tier = _tierFor(host);
        const W = tier.isCompact ? 360 : tier.isStandard ? 560 : 800;
        const H = tier.isCompact ? 220 : tier.isStandard ? 280 : 340;
        const padL = 50, padR = 16, padT = 14, padB = 28;
        const innerW = W - padL - padR;
        const innerH = H - padT - padB;
        const totalN = N + periods;
        const allY = histY.concat(projY);
        const yMin = Math.min.apply(null, allY.concat(projY.map(v => v - 1.96 * sigma)));
        const yMax = Math.max.apply(null, allY.concat(projY.map(v => v + 1.96 * sigma)));
        const yRange = (yMax - yMin) || 1;
        const xAt = (i) => padL + (innerW * i / Math.max(1, totalN - 1));
        const yAt = (v) => padT + innerH * (1 - (v - yMin) / yRange);
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class','solstice__chart-svg solstice__chart-svg--' + tier.tier);
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        // Banda de confiança (sombreada) — sobre projeção
        if (cfg.showBand !== false && sigma > 0){
          let pathD = '';
          // Boundary superior (left → right)
          for (let i = 0; i < periods; i++){
            const x = xAt(N - 1 + i);
            const y = yAt(projY[i] + 1.96 * sigma);
            pathD += (i === 0 ? 'M' : 'L') + ' ' + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
          }
          // Boundary inferior (right → left)
          for (let i = periods - 1; i >= 0; i--){
            const x = xAt(N - 1 + i);
            const y = yAt(projY[i] - 1.96 * sigma);
            pathD += 'L ' + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
          }
          pathD += 'Z';
          const band = document.createElementNS(NS, 'path');
          band.setAttribute('d', pathD);
          band.setAttribute('fill', 'var(--c-accent)');
          band.setAttribute('opacity', '0.15');
          svg.appendChild(band);
        }
        // Linha histórico
        let histPath = '';
        for (let i = 0; i < N; i++){
          histPath += (i === 0 ? 'M' : 'L') + ' ' + xAt(i).toFixed(1) + ',' + yAt(histY[i]).toFixed(1) + ' ';
        }
        const histLine = document.createElementNS(NS, 'path');
        histLine.setAttribute('d', histPath);
        histLine.setAttribute('fill', 'none');
        histLine.setAttribute('stroke', 'var(--c-accent)');
        histLine.setAttribute('stroke-width', '2');
        svg.appendChild(histLine);
        // Linha projeção (tracejada)
        let projPath = 'M ' + xAt(N - 1).toFixed(1) + ',' + yAt(histY[N - 1]).toFixed(1) + ' ';
        for (let i = 0; i < periods; i++){
          projPath += 'L ' + xAt(N - 1 + i).toFixed(1) + ',' + yAt(projY[i]).toFixed(1) + ' ';
        }
        // Pequena correção: linha começa no último ponto histórico, então segundo ponto é offset 1
        projPath = 'M ' + xAt(N - 1).toFixed(1) + ',' + yAt(histY[N - 1]).toFixed(1) + ' ';
        for (let i = 0; i < periods; i++){
          projPath += 'L ' + xAt(N + i).toFixed(1) + ',' + yAt(projY[i]).toFixed(1) + ' ';
        }
        const projLine = document.createElementNS(NS, 'path');
        projLine.setAttribute('d', projPath);
        projLine.setAttribute('fill', 'none');
        projLine.setAttribute('stroke', 'var(--c-warn)');
        projLine.setAttribute('stroke-width', '2');
        projLine.setAttribute('stroke-dasharray', '6,4');
        svg.appendChild(projLine);
        // Eixos Y (mín, máx, mediana)
        [yMin, (yMin+yMax)/2, yMax].forEach((v, i) => {
          const txt = document.createElementNS(NS, 'text');
          txt.setAttribute('x', '6');
          txt.setAttribute('y', (yAt(v) + 4).toFixed(1));
          txt.setAttribute('font-family', 'var(--font-mono)');
          txt.setAttribute('font-size', '10');
          txt.setAttribute('fill', 'var(--c-muted)');
          txt.textContent = ctx.L.decimal(v, 0);
          svg.appendChild(txt);
        });
        // Eixo X — labels primeiro e último período (histórico) + último projetado
        const xLabels = [keys[0], keys[keys.length - 1], '+' + periods + ' projetado'];
        const xPositions = [0, N - 1, N + periods - 1];
        xLabels.forEach((label, i) => {
          const txt = document.createElementNS(NS, 'text');
          txt.setAttribute('x', xAt(xPositions[i]).toFixed(1));
          txt.setAttribute('y', (H - 6).toFixed(1));
          txt.setAttribute('font-family', 'var(--font-mono)');
          txt.setAttribute('font-size', '10');
          txt.setAttribute('fill', 'var(--c-muted)');
          txt.setAttribute('text-anchor', i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle');
          txt.textContent = label;
          svg.appendChild(txt);
        });
        // Legenda inline (top-right)
        const legend = document.createElementNS(NS, 'text');
        legend.setAttribute('x', (W - padR).toFixed(1));
        legend.setAttribute('y', (padT + 4).toFixed(1));
        legend.setAttribute('font-family', 'var(--font-mono)');
        legend.setAttribute('font-size', '10');
        legend.setAttribute('fill', 'var(--c-muted)');
        legend.setAttribute('text-anchor', 'end');
        legend.textContent = methodUsed + ' · ' + periods + 'p · IC 95%';
        svg.appendChild(legend);
        host.appendChild(svg);

        // Resumo textual abaixo do SVG
        const lastHist = histY[N - 1];
        const lastProj = projY[periods - 1];
        const deltaPct = lastHist === 0 ? 0 : ((lastProj - lastHist) / Math.abs(lastHist)) * 100;
        const direction = deltaPct >= 0 ? '▲' : '▼';
        const color = deltaPct >= 0 ? 'var(--c-success)' : 'var(--c-error)';
        const summary = SolsticeUtils.el('div', {
          style: 'font-size:11px;color:var(--c-text-2);margin-top:8px;display:flex;justify-content:space-between;align-items:center;'
        });
        // Sprint 34 / BUG-VIS-01: concordância pt-BR adequada por bin.
        // Antes: "6 monthes" (bin "month" + "es" no plural — quebrado).
        const _binLabel = (() => {
          const map = {
            day:   { sing: 'dia',     plural: 'dias' },
            week:  { sing: 'semana',  plural: 'semanas' },
            month: { sing: 'mês',     plural: 'meses' },
            year:  { sing: 'ano',     plural: 'anos' }
          };
          const m = map[cfg.bin] || map.month;
          return periods === 1 ? m.sing : m.plural;
        })();
        summary.appendChild(SolsticeUtils.el('span', null,
          'Projeta ' + ctx.L.decimal(lastProj, 1) + ' em ' + periods + ' ' + _binLabel));
        summary.appendChild(SolsticeUtils.el('span', { style: 'color:' + color + ';font-weight:600;' },
          direction + ' ' + Math.abs(deltaPct).toFixed(1) + '% vs último período histórico'));
        host.appendChild(summary);
      }
    });

    /* ===== DISTRIBUIÇÃO (histograma SVG) ===== */
    register({
      id:'distribution', name:'Distribuição', icon:'📉',
      description: 'Como valores se distribuem (numérica = histograma · categórica = frequência)',
      // Camada Polish v4: aceita TANTO numéricas (histograma) QUANTO categóricas (top freq).
      // Antes só numéricas — se dataset não tinha, ficava inútil.
      defaultConfig: (ctx) => ({
        column: _firstColOfGroup(ctx, 'numeric') || _firstColOfGroup(ctx, 'categorical') || _firstCol(ctx),
        bins: 20,
        showLabels: true,
        topN: 12  // pra modo categórica
      }),
      render(slot, host, ctx){
        const cfg = slot.config || {};
        const col = cfg.column;
        if (!col){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Selecione uma coluna em ⚙️ Dados.'));
          return;
        }
        const colType = (ctx.types && ctx.types[col]) || {};
        const isNumeric = SolsticeTypes.group(colType.type) === 'numeric';
        const isCategorical = SolsticeTypes.group(colType.type) === 'categorical';

        const tier = _tierFor(host);
        const W = tier.W, H = Math.max(160, tier.H - 40);
        const pad = tier.isCompact ? 16 : 24;
        const NS = 'http://www.w3.org/2000/svg';

        // Paleta do style (se houver)
        const style = cfg.style || {};
        const palette = (typeof SolsticeStyle !== 'undefined') ? SolsticeStyle.paletteColors(style.palette) : null;
        const accentColor = palette ? palette[0] : 'currentColor';

        if (isNumeric){
          // === MODO HISTOGRAMA (numérica) ===
          const nBins = cfg.bins || 20;
          const binned = SolsticeCompCache.get(slot.id, cfg, ctx.rows, () => {
            const vs = ctx.rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
            if (!vs.length) return null;
            const [mn, mx] = SolsticeStats.minMax(vs); /* code review 2026: minMax safe */
            // Auditoria 2026.6 (HIST-OUTLIER): binning robusto a outliers. ANTES o
            // range era min-max cru, então UM único outlier (ex: 1 receita 60×
            // maior) esticava o eixo e amontoava ~99% dos dados em 1-2 faixas,
            // deixando o histograma ilegível. AGORA a janela de binning usa a
            // cerca de Tukey (Q1−1.5·IQR, Q3+1.5·IQR); valores fora caem nas
            // faixas de borda (overflow) — o outlier ainda aparece, mas o miolo
            // da distribuição fica legível.
            let lo = mn, hi = mx, clamped = false;
            if (vs.length >= 8){
              const q = SolsticeStats.quartiles(vs);
              if (q && q.iqr > 0){
                const fLo = q.q1 - 1.5 * q.iqr, fHi = q.q3 + 1.5 * q.iqr;
                const nLo = Math.max(mn, fLo), nHi = Math.min(mx, fHi);
                if (nHi > nLo && (nLo > mn || nHi < mx)){ lo = nLo; hi = nHi; clamped = true; }
              }
            }
            const st = (hi - lo) / nBins || 1;
            const bs = Array(nBins).fill(0);
            vs.forEach(v => {
              let i = Math.floor((v - lo) / st);
              if (i < 0) i = 0;                    // outlier abaixo → 1ª faixa
              if (i > nBins - 1) i = nBins - 1;    // outlier acima → última faixa
              bs[i]++;
            });
            return { values: vs, min: lo, max: hi, step: st, bins: bs, clamped };
          });
          if (!binned){
            host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Sem valores numéricos válidos em "' + SolsticeHumanize.column(col, ctx.dictionary) + '".'));
            return;
          }
          const { values, min, max, step, bins } = binned;
          const maxC = SolsticeStats.max(bins);

          // HOTFIX v5.5 #110: Lucas "Distribution com eixo Y completo cadê o valor?"
          // Causa: preserveAspectRatio='none' distorce texto (fica ilegível em proporções
          // não-quadradas) E Y axis era pulado em compact tier. Agora:
          // - preserveAspectRatio default ('xMidYMid meet') NÃO distorce mais o texto
          // - Padding esquerdo expandido (padL) reserva espaço pros Y ticks
          // - Y axis aparece em TODOS os tiers (compact incluso)
          // - 4 ticks (0/25/50/75/100% do maxC) + gridlines suaves
          // - Formatação curta (1.2k em vez de 1200)
          const padL = tier.isCompact ? 34 : 46;  // espaço pros Y ticks (4-digit max)
          const padR = pad;                        // direita igual ao pad geral
          const padT = pad;                        // topo
          const padB = pad + 4;                    // base com folga pro X label
          const innerW = W - padL - padR;
          const innerH = H - padT - padB;

          const svg = document.createElementNS(NS, 'svg');
          svg.setAttribute('class', 'solstice__hist solstice__chart-svg--' + tier.tier);
          svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
          // SEM preserveAspectRatio='none' — texto fica legível agora
          const bw = innerW / nBins;
          // Formatação curta inline: 1234 → "1,2k", 1_234_567 → "1,2M"
          const fmtCount = (n) => {
            if (n == null || isNaN(n)) return '0';
            const abs = Math.abs(n);
            if (abs >= 1_000_000) return SolsticeLocale.decimal(n/1_000_000, 1).replace('.', ',') + 'M';
            if (abs >= 1000)      return SolsticeLocale.decimal(n/1000, 1).replace('.', ',') + 'k';
            return String(Math.round(n));
          };
          // Y-axis ticks (4 níveis: 0, 25%, 50%, 75%, 100% do maxC) + gridlines
          const yTickCount = 4;
          for (let i = 0; i <= yTickCount; i++){
            const ratio = i / yTickCount;
            const v = Math.round(maxC * ratio);
            const y = padT + innerH - ratio * innerH;
            // Gridline horizontal
            const gl = document.createElementNS(NS, 'line');
            gl.setAttribute('x1', padL); gl.setAttribute('x2', W - padR);
            gl.setAttribute('y1', y); gl.setAttribute('y2', y);
            gl.setAttribute('stroke', 'currentColor');
            gl.setAttribute('stroke-width', '0.5');
            gl.style.opacity = i === 0 ? '0.4' : '0.12';
            svg.appendChild(gl);
            // Label do tick
            const t = document.createElementNS(NS, 'text');
            t.setAttribute('x', padL - 6); t.setAttribute('y', y + 3.5);
            t.setAttribute('text-anchor', 'end');
            t.setAttribute('font-size', tier.isCompact ? '10' : '11');
            t.setAttribute('fill', 'currentColor');
            t.style.fontFamily = 'var(--font-mono)';
            t.style.opacity = '0.75';
            t.textContent = fmtCount(v);
            svg.appendChild(t);
          }
          // Barras
          // Sprint 41 / feedback do usuário ("paleta de gráfico só 1 cor"):
          // histograma agora pinta cada barra com cor da paleta — antes era
          // accentColor único em TODAS as barras (palette[0]). Agora os bins
          // ciclam pelas cores da paleta selecionada, dando visual de paleta
          // multi-cor escolhida. Quando palette === 'auto', mantém comportamento
          // anterior (1 cor) pra não quebrar quem já estava usando.
          const histMulti = palette && (style.palette && style.palette !== 'auto');
          bins.forEach((c, i) => {
            const h = (c / maxC) * innerH;
            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('x', (padL + i * bw + 1).toFixed(1));
            rect.setAttribute('y', (padT + innerH - h).toFixed(1));
            rect.setAttribute('width', Math.max(1, bw - 2).toFixed(1));
            rect.setAttribute('height', h.toFixed(1));
            rect.setAttribute('fill', histMulti ? palette[i % palette.length] : accentColor);
            rect.style.opacity = '0.85';
            const title = document.createElementNS(NS, 'title');
            title.textContent = ctx.L.decimal(min + i*step, 1) + '–' + ctx.L.decimal(min + (i+1)*step, 1) + ' · ' + c + ' obs.';
            rect.appendChild(title);
            svg.appendChild(rect);
            if (cfg.showLabels !== false && c > 0 && bw > 14){
              const t = document.createElementNS(NS, 'text');
              t.setAttribute('x', (padL + i * bw + bw/2).toFixed(1));
              t.setAttribute('y', (padT + innerH - h - 3).toFixed(1));
              t.setAttribute('text-anchor', 'middle');
              t.setAttribute('font-size', '10');
              t.setAttribute('fill', 'currentColor');
              t.style.fontFamily = 'var(--font-mono)';
              t.style.opacity = '0.85';
              t.textContent = fmtCount(c);
              svg.appendChild(t);
            }
          });
          // Auditoria 2026.6 (DISTRIB-RICO): linhas de MÉDIA e MEDIANA sobre o
          // histograma — marcam a tendência central (deixa a leitura mais rica).
          // Clampadas à janela de binning; mediana só até 50k (evita sort pesado).
          (function(){
            let _sum = 0; for (let k = 0; k < values.length; k++) _sum += values[k];
            const _mean = values.length ? _sum / values.length : null;
            const _clampX = (v) => padL + Math.max(0, Math.min(1, (v - min) / ((max - min) || 1))) * innerW;
            const _vline = (v, color, label) => {
              if (v == null || isNaN(v)) return;
              const x = _clampX(v);
              const ln = document.createElementNS(NS, 'line');
              ln.setAttribute('x1', x.toFixed(1)); ln.setAttribute('x2', x.toFixed(1));
              ln.setAttribute('y1', padT); ln.setAttribute('y2', (padT + innerH).toFixed(1));
              ln.setAttribute('stroke', color); ln.setAttribute('stroke-width', '1.4');
              ln.setAttribute('stroke-dasharray', '4 3'); ln.style.opacity = '0.9';
              const tt = document.createElementNS(NS, 'title'); tt.textContent = label + ': ' + ctx.L.decimal(v, 2); ln.appendChild(tt);
              svg.appendChild(ln);
              if (!tier.isCompact){
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', (x + 2).toFixed(1)); t.setAttribute('y', (padT + 9).toFixed(1));
                t.setAttribute('font-size', '8.5'); t.setAttribute('fill', color); t.style.fontFamily = 'var(--font-mono)';
                t.textContent = label;
                svg.appendChild(t);
              }
            };
            _vline(_mean, 'var(--c-accent)', 'média');
            if (values.length <= 50000){
              const _s = values.slice().sort((a, b) => a - b);
              const _med = _s.length % 2 ? _s[(_s.length - 1) / 2] : (_s[_s.length/2 - 1] + _s[_s.length/2]) / 2;
              _vline(_med, 'var(--c-warn, #E8B339)', 'mediana');
            }
          })();
          // X-axis tick labels (min, intermediário, max)
          [[padL, min, 'start'], [padL + innerW/2, (min+max)/2, 'middle'], [W - padR, max, 'end']].forEach(([x, v, anchor]) => {
            const t = document.createElementNS(NS, 'text');
            t.setAttribute('x', x); t.setAttribute('y', H - 6);
            t.setAttribute('text-anchor', anchor);
            t.setAttribute('font-size', tier.isCompact ? '10' : '11');
            t.setAttribute('fill', 'currentColor');
            t.style.opacity = '0.75';
            t.textContent = ctx.L.decimal(v, 1);
            svg.appendChild(t);
          });
          // Y-axis label rotacionado "Frequência" (só não-compact)
          if (!tier.isCompact){
            const yLbl = document.createElementNS(NS, 'text');
            yLbl.setAttribute('x', -(padT + innerH/2));
            yLbl.setAttribute('y', 11);
            yLbl.setAttribute('transform', 'rotate(-90)');
            yLbl.setAttribute('text-anchor', 'middle');
            yLbl.setAttribute('font-size', '10');
            yLbl.setAttribute('fill', 'currentColor');
            yLbl.style.opacity = '0.55';
            yLbl.style.fontStyle = 'italic';
            yLbl.textContent = 'Frequência';
            svg.appendChild(yLbl);
          }
          host.appendChild(svg);
          // Auditoria 2026.6 (HIST-OUTLIER): avisa quando a janela foi limitada
          // por outliers, pra leitura honesta do eixo.
          host.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);text-align:center;margin-top:4px;font-family:var(--font-mono);' },
            SolsticeHumanize.column(col, ctx.dictionary) + ' · ' + nBins + ' faixas · ' + SolsticeHumanize.recordCount(values.length) +
            (binned.clamped ? ' · outliers agrupados nas bordas' : '')));
        } else {
          // === MODO FREQUÊNCIA (categórica · ou qualquer tipo não-numérico) ===
          const topN = cfg.topN || 12;
          const counts = new Map();
          for (const r of ctx.rows){
            const v = r[col];
            if (v == null || v === '') continue;
            const k = String(v);
            counts.set(k, (counts.get(k) || 0) + 1);
          }
          if (!counts.size){
            host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Sem valores em "' + SolsticeHumanize.column(col, ctx.dictionary) + '".'));
            return;
          }
          const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN);
          const total = sorted.reduce((s, [, v]) => s + v, 0);
          const maxC = sorted[0][1];

          const svg = document.createElementNS(NS, 'svg');
          svg.setAttribute('class', 'solstice__hist solstice__chart-svg--' + tier.tier);
          svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
          // HOTFIX v5.5 #110: SEM preserveAspectRatio='none' — texto não distorce mais
          const rowH = (H - pad*2) / sorted.length;
          const labelW = Math.min(120, W * 0.3);
          sorted.forEach(([key, c], i) => {
            const y = pad + i * rowH;
            const barW = ((c / maxC) * (W - pad*2 - labelW - 40));
            // Label da categoria (truncado)
            const lab = document.createElementNS(NS, 'text');
            lab.setAttribute('x', pad); lab.setAttribute('y', (y + rowH/2 + 3).toFixed(1));
            lab.setAttribute('font-size', '11');
            lab.setAttribute('fill', 'currentColor');
            const labStr = key.length > 18 ? key.slice(0, 16) + '…' : key;
            lab.textContent = labStr;
            const labTitle = document.createElementNS(NS, 'title');
            labTitle.textContent = key + ' · ' + c + ' (' + ((c/total)*100).toFixed(1) + '%)';
            lab.appendChild(labTitle);
            svg.appendChild(lab);
            // Barra
            const color = palette ? palette[i % palette.length] : accentColor;
            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('x', (pad + labelW).toFixed(1));
            rect.setAttribute('y', (y + 2).toFixed(1));
            rect.setAttribute('width', Math.max(1, barW).toFixed(1));
            rect.setAttribute('height', Math.max(4, rowH - 4).toFixed(1));
            rect.setAttribute('rx', '2');
            rect.setAttribute('fill', color);
            rect.style.opacity = '0.85';
            const tt = document.createElementNS(NS, 'title');
            tt.textContent = key + ' · ' + c + ' (' + ((c/total)*100).toFixed(1) + '%)';
            rect.appendChild(tt);
            svg.appendChild(rect);
            // Valor à direita da barra
            const val = document.createElementNS(NS, 'text');
            val.setAttribute('x', (pad + labelW + barW + 4).toFixed(1));
            val.setAttribute('y', (y + rowH/2 + 3).toFixed(1));
            val.setAttribute('font-size', '10');
            val.setAttribute('fill', 'currentColor');
            val.style.fontFamily = 'var(--font-mono)';
            val.textContent = c + (cfg.showLabels !== false ? ' · ' + ((c/total)*100).toFixed(1) + '%' : '');
            svg.appendChild(val);
          });
          host.appendChild(svg);
          const totalCategories = counts.size;
          const showing = sorted.length;
          host.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);text-align:center;margin-top:4px;font-family:var(--font-mono);' },
            SolsticeHumanize.column(col, ctx.dictionary) + ' · top ' + showing + ' de ' + totalCategories + ' · ' + total + ' registros'));
        }
        _observeResponsive(host, registry['distribution'], slot, ctx);
      }
    });

    /* ===== TABELA RICA ===== */
    register({
      id:'table', name:'Tabela', icon:'📋',
      description: 'Dados em linhas e colunas com heatmap (modo flat ou drill-down hierárquico)',
      defaultConfig: (ctx) => ({ rowLimit: 50, mode: 'flat' }),
      render(slot, host, ctx){
        const cfg = slot.config || {};
        const mode = cfg.mode || 'flat';

        if (!ctx.rows.length){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Sem dados.'));
          return;
        }

        // === Prompt 8 v5.4: modo DRILL-DOWN hierárquico ===
        if (mode === 'drill' && cfg.drillColumns && cfg.drillColumns.length && cfg.metricColumn){
          _renderDrillTable(slot, host, ctx, cfg);
          return;
        }

        // === MODO FLAT (default — comportamento original) ===
        const limit = cfg.rowLimit || 50;
        // Auditoria 2026.6 (TABELA): colunas selecionáveis (cfg.columns) — senão todas.
        const cols = (Array.isArray(cfg.columns) && cfg.columns.length) ? ctx.columns.filter(c => cfg.columns.indexOf(c) >= 0) : ctx.columns;
        // Pre-calc heat range por coluna numérica
        const heats = {};
        for (const c of cols){
          if (SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'numeric'){
            const vs = ctx.rows.map(r => SolsticeStats.parseNum(r[c])).filter(v => !isNaN(v));
            if (vs.length) heats[c] = { min: SolsticeStats.min(vs), max: SolsticeStats.max(vs) };
          }
        }

        const wrap = SolsticeUtils.el('div', { class:'solstice__data-preview', style:'border:0;' });
        const tw = SolsticeUtils.el('div', { class:'solstice__data-table-wrap', style:'max-height:none;' });
        const tbl = SolsticeUtils.el('table', { class:'solstice__data-table', style:'font-size:var(--fs-sm);' });
        const thead = SolsticeUtils.el('thead');
        const trh = SolsticeUtils.el('tr');
        cols.forEach(c => {
          const t = ctx.types[c];
          trh.appendChild(SolsticeUtils.el('th', null,
            SolsticeUtils.el('span', null, SolsticeTypes.icon(t.type) + ' ' + c),
            SolsticeUtils.el('small', null, SolsticeTypes.label(t.type))
          ));
        });
        thead.appendChild(trh);
        tbl.appendChild(thead);

        const tbody = SolsticeUtils.el('tbody');
        ctx.rows.slice(0, limit).forEach(r => {
          const tr = SolsticeUtils.el('tr');
          cols.forEach(c => {
            const v = r[c];
            const def = SolsticeTypes.getType(ctx.types[c] && ctx.types[c].type);
            const isNum = SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'numeric';
            const isNull = v == null || v === '';
            const cls = (isNum ? 'is-num is-heat ' : 'is-text ') + (isNull ? 'is-null' : '');
            const display = isNull ? '—' : (def && def.format ? (function(){ try { return def.format(v, ctx.L); } catch(e){ return v; }})() : v);
            const td = SolsticeUtils.el('td', { class: cls.trim() }, String(display));
            if (isNum && !isNull && heats[c]){
              const n = parseFloat(v);
              if (!isNaN(n)){
                const range = heats[c].max - heats[c].min || 1;
                const intensity = ((n - heats[c].min) / range) * 0.4;
                td.style.setProperty('--heat-intensity', intensity.toFixed(2));
              }
            }
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        tbl.appendChild(tbody);
        tw.appendChild(tbl);
        wrap.appendChild(tw);
        host.appendChild(wrap);
      }
    });

    /** Prompt 8 v5.4 — Renderiza tabela em modo DRILL-DOWN hierárquico.
     *  Config esperada:
     *    cfg.mode = 'drill'
     *    cfg.drillColumns = ['regiao','segmento','produto']   // ordem do drill
     *    cfg.metricColumn = 'receita'                          // numérica
     *    cfg.metricAgg = 'sum' | 'avg' | 'count' | 'min' | 'max'
     *    cfg.expanded = { 'regiao=SP': true, ... }            // estado salvo no slot.config
     */
    function _renderDrillTable(slot, host, ctx, cfg){
      const drillCols = cfg.drillColumns || [];
      const metricCol = cfg.metricColumn;
      const agg = cfg.metricAgg || 'sum';
      const expanded = cfg.expanded || {};
      const fmt = (n) => n == null || isNaN(n) ? '—' : ctx.L.decimal(n, 2);

      function _agg(values){
        const c = values.filter(v => v != null && !isNaN(parseFloat(v))).map(parseFloat);
        if (!c.length) return null;
        if (agg === 'sum') return c.reduce((a,b)=>a+b,0);
        if (agg === 'avg') return c.reduce((a,b)=>a+b,0) / c.length;
        if (agg === 'count') return values.length;
        if (agg === 'min') return SolsticeStats.min(c);
        if (agg === 'max') return SolsticeStats.max(c);
        return null;
      }

      // Constrói árvore: agrupa rows por drillCols sucessivamente
      function _buildNode(rows, level, path){
        if (level >= drillCols.length){
          return { isLeaf: true, count: rows.length, value: _agg(rows.map(r => r[metricCol])), rows };
        }
        const col = drillCols[level];
        const buckets = new Map();
        for (const r of rows){
          const key = r[col] == null ? '(vazio)' : String(r[col]);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(r);
        }
        const children = [];
        for (const [key, items] of buckets){
          const childPath = path + '/' + col + '=' + key;
          children.push({
            key, col, level, path: childPath,
            value: _agg(items.map(r => r[metricCol])),
            count: items.length,
            child: null, // lazy: só constrói se expandido
            _rows: items // mantém rows para construir filho on-demand
          });
        }
        // Ordena desc por value
        children.sort((a, b) => (b.value || 0) - (a.value || 0));
        return { isLeaf: false, level, children, total: _agg(rows.map(r => r[metricCol])) };
      }

      const root = _buildNode(ctx.rows, 0, '');

      // Header bar: ações
      const headerBar = SolsticeUtils.el('div', {
        style:'display:flex;gap:6px;justify-content:flex-end;margin-bottom:6px;font-size:11px;'
      });
      headerBar.appendChild(SolsticeUtils.el('button', {
        type:'button',
        class:'solstice__btn solstice__btn--ghost',
        style:'padding:3px 8px;font-size:10px;',
        title:'Expandir todos os níveis',
        onclick: () => { _setAllExpanded(slot, true); }
      }, '⊕ Expandir tudo'));
      headerBar.appendChild(SolsticeUtils.el('button', {
        type:'button',
        class:'solstice__btn solstice__btn--ghost',
        style:'padding:3px 8px;font-size:10px;',
        title:'Recolher todos os níveis',
        onclick: () => { _setAllExpanded(slot, false); }
      }, '⊖ Recolher tudo'));
      host.appendChild(headerBar);

      const wrap = SolsticeUtils.el('div', { class:'solstice__data-preview', style:'border:0;' });
      const tw = SolsticeUtils.el('div', { class:'solstice__data-table-wrap', style:'max-height:none;' });
      const tbl = SolsticeUtils.el('table', { class:'solstice__data-table solstice__drill-table', style:'font-size:var(--fs-sm);' });
      const thead = SolsticeUtils.el('thead');
      const trh = SolsticeUtils.el('tr');
      // 1ª coluna: caminho hierárquico
      trh.appendChild(SolsticeUtils.el('th', null,
        SolsticeUtils.el('span', null, '🔽 ' + drillCols.join(' → ')),
        SolsticeUtils.el('small', null, 'hierarquia')
      ));
      // 2ª coluna: contagem
      trh.appendChild(SolsticeUtils.el('th', { style:'text-align:right;' },
        SolsticeUtils.el('span', null, '#'),
        SolsticeUtils.el('small', null, 'count')
      ));
      // 3ª coluna: métrica agregada
      trh.appendChild(SolsticeUtils.el('th', { style:'text-align:right;' },
        SolsticeUtils.el('span', null, agg.toUpperCase() + ' ' + metricCol),
        SolsticeUtils.el('small', null, agg)
      ));
      thead.appendChild(trh);
      tbl.appendChild(thead);

      const tbody = SolsticeUtils.el('tbody');

      function _renderNode(node, depth){
        if (node.isLeaf) return;
        for (const child of node.children){
          const isExp = !!expanded[child.path];
          const hasChildren = child.level + 1 < drillCols.length;
          const tr = SolsticeUtils.el('tr', { class: 'is-drill-row' });
          const pathTd = SolsticeUtils.el('td', { style: 'padding-left:' + (8 + depth * 18) + 'px;' });
          if (hasChildren){
            const chevron = SolsticeUtils.el('span', {
              style:'display:inline-block;margin-right:6px;cursor:pointer;color:var(--c-accent);font-weight:bold;width:12px;',
              onclick: (e) => {
                e.stopPropagation();
                const newExp = { ...expanded };
                if (isExp) delete newExp[child.path]; else newExp[child.path] = true;
                _updateSlotExpanded(slot, newExp);
              }
            }, isExp ? '▼' : '▶');
            pathTd.appendChild(chevron);
          } else {
            pathTd.appendChild(SolsticeUtils.el('span', { style:'display:inline-block;width:18px;' }));
          }
          pathTd.appendChild(SolsticeUtils.el('span', null, child.key));
          tr.appendChild(pathTd);
          tr.appendChild(SolsticeUtils.el('td', { style:'text-align:right;font-family:var(--font-mono);color:var(--c-muted);font-size:10px;' }, String(child.count)));
          tr.appendChild(SolsticeUtils.el('td', { style:'text-align:right;font-weight:var(--fw-semibold);font-family:var(--font-mono);' }, fmt(child.value)));
          tbody.appendChild(tr);
          // Se expandido, constrói filho lazy + recursão
          if (isExp && hasChildren){
            if (!child.child){
              child.child = _buildNode(child._rows, child.level + 1, child.path);
            }
            _renderNode(child.child, depth + 1);
          }
        }
      }
      _renderNode(root, 0);

      // Total geral no rodapé
      const tfoot = SolsticeUtils.el('tfoot');
      const trf = SolsticeUtils.el('tr', { style:'background:var(--c-surface-2);font-weight:var(--fw-bold);border-top:2px solid var(--c-border);' });
      trf.appendChild(SolsticeUtils.el('td', null, 'TOTAL GERAL'));
      trf.appendChild(SolsticeUtils.el('td', { style:'text-align:right;font-family:var(--font-mono);' }, String(ctx.rows.length)));
      trf.appendChild(SolsticeUtils.el('td', { style:'text-align:right;font-family:var(--font-mono);' }, fmt(root.total)));
      tfoot.appendChild(trf);
      tbl.appendChild(tbody);
      tbl.appendChild(tfoot);
      tw.appendChild(tbl);
      wrap.appendChild(tw);
      host.appendChild(wrap);
    }

    /** Atualiza slot.config.expanded e re-renderiza canvas. */
    function _updateSlotExpanded(slot, newExp){
      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      for (const s of sections) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slot.id);
        if (sl){
          sl.config = sl.config || {};
          sl.config.expanded = newExp;
          SolsticeStore.set('canvas.sections', sections);
          return;
        }
      }
    }

    /** Expande/recolhe todos os nós até nivel max. */
    function _setAllExpanded(slot, expandAll){
      if (!expandAll){
        _updateSlotExpanded(slot, {});
        return;
      }
      // Constrói caminhos completos da árvore para expandir
      const cfg = slot.config || {};
      const ingest = SolsticeStore.get('ingest') || {};
      const rows = ingest.rows || [];
      const drillCols = cfg.drillColumns || [];
      const exp = {};
      function _walk(rowsSubset, level, path){
        if (level >= drillCols.length) return;
        const col = drillCols[level];
        const buckets = new Map();
        for (const r of rowsSubset){
          const key = r[col] == null ? '(vazio)' : String(r[col]);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(r);
        }
        for (const [key, items] of buckets){
          const newPath = path + '/' + col + '=' + key;
          exp[newPath] = true;
          _walk(items, level + 1, newPath);
        }
      }
      _walk(rows, 0, '');
      _updateSlotExpanded(slot, exp);
    }

    /* ============================================================
       BLOCO 6 — HELPERS RESPONSIVOS (Patch B6-r1)
       ============================================================ */

    /**
     * Decide tier baseado em clientWidth do host.
     * Retorna { tier, W, H, isCompact, isStandard, isLarge }.
     */
    function _tierFor(host){
      const w = host && host.clientWidth ? host.clientWidth : 480;
      if (w < 240) return { tier:'compact',  W: 240, H: 150, isCompact: true };
      if (w < 420) return { tier:'standard', W: 360, H: 240, isStandard: true };
      return { tier:'large', W: 540, H: 340, isLarge: true };
    }

    /**
     * Anexa ResizeObserver no host que re-chama def.render(slot, host, ctx)
     * com debounce 150ms quando o tier mudar. Cleanup do observer anterior.
     */
    function _observeResponsive(host, def, slot, ctx){
      if (host._solsticeResizeObserver){
        try { host._solsticeResizeObserver.disconnect(); } catch(e){}
        host._solsticeResizeObserver = null;
      }
      if (typeof ResizeObserver === 'undefined') return;
      let timer = null;
      let lastTier = _tierFor(host).tier;
      const obs = new ResizeObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const nextTier = _tierFor(host).tier;
          if (nextTier === lastTier) return;
          lastTier = nextTier;
          // Auditoria 2026 (M-X-2 / A-404): destrói Charts antes do
          // innerHTML='' para que o cleanup do R-03 funcione mesmo
          // quando o ResizeObserver é quem dispara o re-render.
          host.querySelectorAll('canvas').forEach(c => {
            if (c._chart) { try { c._chart.destroy(); } catch(_){} c._chart = null; }
          });
          host.innerHTML = '';
          try { def.render(slot, host, ctx); } catch(e){ console.error('[Resize re-render]', e); }
        }, 150);
      });
      try { obs.observe(host); host._solsticeResizeObserver = obs; } catch(e){}
    }

    /* ============================================================
       BLOCO 7 — Aliases internos que delegam a SolsticeStats
       Mantidos para retrocompatibilidade com a render() dos componentes B6.
       Toda a lógica vive em SolsticeStats agora; estes shims só adaptam
       o shape de retorno do _quartiles (que precisa de min/max excluindo
       outliers, conveniente para box plot).
       ============================================================ */

    function _linearRegression(points){
      return SolsticeStats.linearRegression(points);
    }

    function _kMeans(points, k, maxIter){
      return SolsticeStats.kMeans(points, k, maxIter);
    }

    /** Prompt 5 v5.4 — Downsampling 2D para Scatter com >10k pontos.
     *  Estratégia híbrida:
     *    1. Detecta outliers IQR 3× em X e Y → SEMPRE incluídos (até 10% do target)
     *    2. Grid binning sobre os inliers: NxN bins onde N = sqrt(target_inliers)
     *       — escolhe o ponto mais central (mais próximo do centróide do bin)
     *    3. Se sobra orçamento (target não atingido por bins ocupados), preenche
     *       com random sample seeded dos pontos restantes
     *  Determinístico: mesma seed (derivada de xCol|yCol) → mesma amostra.
     *  Performance: O(n) para outliers + O(n) para binning. <100ms em 100k pts.
     *
     *  Por que NÃO LTTB literal: LTTB é 1D (ordena por X, escolhe Y por triângulo).
     *  Em scatter 2D, ordenar por X destrói a distribuição em Y. Grid binning
     *  preserva densidade visual + variedade. LTTB 2D real seria
     *  computacionalmente caro (O(n²) na pior).
     *
     *  @return { pts, sizeVals, outliersKept } */
    function _downsample2D(ptsAll, sizeValsAll, target, seedStr){
      const n = ptsAll.length;
      if (n <= target) return { pts: ptsAll, sizeVals: sizeValsAll, outliersKept: 0 };

      const seed = String(seedStr || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) || 42;

      // 1. Outliers IQR 3× em X e Y
      const xs = ptsAll.map(p => p[0]);
      const ys = ptsAll.map(p => p[1]);
      const ox = SolsticeStats.outliersIQR(xs, 3);
      const oy = SolsticeStats.outliersIQR(ys, 3);
      const xLo = ox.fences.lo, xHi = ox.fences.hi;
      const yLo = oy.fences.lo, yHi = oy.fences.hi;
      const outlierIdx = new Set();
      for (let i = 0; i < n; i++){
        const x = ptsAll[i][0], y = ptsAll[i][1];
        if (x < xLo || x > xHi || y < yLo || y > yHi) outlierIdx.add(i);
      }
      // Cap outliers em 10% do target (extremos demais distorcem o gráfico)
      const outlierCap = Math.floor(target * 0.10);
      let outliers = Array.from(outlierIdx);
      if (outliers.length > outlierCap){
        // Mantém os mais extremos por distância do centróide
        const meanX = SolsticeStats.mean(xs);
        const meanY = SolsticeStats.mean(ys);
        outliers.sort((a, b) => {
          const da = Math.hypot(ptsAll[a][0] - meanX, ptsAll[a][1] - meanY);
          const db = Math.hypot(ptsAll[b][0] - meanX, ptsAll[b][1] - meanY);
          return db - da;
        });
        outliers = outliers.slice(0, outlierCap);
      }
      const outliersSet = new Set(outliers);

      // 2. Grid binning sobre inliers
      const inlierIdx = [];
      for (let i = 0; i < n; i++) if (!outliersSet.has(i)) inlierIdx.push(i);
      const budgetForBinning = target - outliers.length;
      const gridN = Math.max(2, Math.ceil(Math.sqrt(budgetForBinning)));
      // Range para grid: usa fences (não min/max — outliers já fora)
      const xMin = xLo, xMax = xHi, xR = xMax - xMin || 1;
      const yMin = yLo, yMax = yHi, yR = yMax - yMin || 1;
      const bins = new Map(); // bin_key -> { idx: [], cx: 0, cy: 0 }
      for (const i of inlierIdx){
        const x = ptsAll[i][0], y = ptsAll[i][1];
        const bx = Math.min(gridN - 1, Math.floor(((x - xMin) / xR) * gridN));
        const by = Math.min(gridN - 1, Math.floor(((y - yMin) / yR) * gridN));
        const key = bx + '|' + by;
        if (!bins.has(key)) bins.set(key, { idx: [], cx: 0, cy: 0, count: 0 });
        const b = bins.get(key);
        b.idx.push(i);
        b.cx += x; b.cy += y; b.count++;
      }
      // Pega o ponto mais próximo do centróide de cada bin
      const binSelected = [];
      for (const b of bins.values()){
        const cx = b.cx / b.count, cy = b.cy / b.count;
        let bestIdx = b.idx[0], bestD = Infinity;
        for (const idx of b.idx){
          const dx = ptsAll[idx][0] - cx, dy = ptsAll[idx][1] - cy;
          const d = dx * dx + dy * dy;
          if (d < bestD){ bestD = d; bestIdx = idx; }
        }
        binSelected.push(bestIdx);
      }

      // 3. Se sobra orçamento, preenche com random dos não selecionados
      const selectedSet = new Set([...outliers, ...binSelected]);
      const remainingBudget = target - selectedSet.size;
      let extras = [];
      if (remainingBudget > 0){
        const remaining = inlierIdx.filter(i => !selectedSet.has(i));
        if (remaining.length){
          const r = SolsticeStats.randomSample(remaining, Math.min(remainingBudget, remaining.length), { seed });
          extras = r.sample;
        }
      }

      const finalIdx = [...outliers, ...binSelected, ...extras];
      const pts = finalIdx.map(i => ptsAll[i]);
      const sizeVals = sizeValsAll.length ? finalIdx.map(i => sizeValsAll[i]) : [];
      return { pts, sizeVals, outliersKept: outliers.length };
    }

    /** Shim para Box Plot: quartis + min/max excluindo outliers IQR 1.5×. */
    function _quartiles(values){
      const q = SolsticeStats.quartiles(values);
      if (!q) return null;
      const ou = SolsticeStats.outliersIQR(values, 1.5);
      const s = SolsticeStats.sorted(values);
      const inliers = s.filter(v => v >= ou.fences.lo && v <= ou.fences.hi);
      return {
        q1: q.q1, median: q.median, q3: q.q3,
        min: inliers.length ? inliers[0] : q.min,
        max: inliers.length ? inliers[inliers.length - 1] : q.max,
        outliers: ou.values
      };
    }

    /* ============================================================
       BLOCO 6 — 6 COMPONENTES AVANÇADOS
       ============================================================ */

    /* ===== SCATTER / BUBBLE ===== */
    register({
      id:'scatter', name:'Scatter / Bubble', icon:'⚡',
      description: 'Relação entre duas variáveis numéricas',
      // ADR-056 (B7): defaultConfig usa Stats.bestNumericPair para escolher
      // o par com maior |Pearson| — gráfico inicial já mostra um padrão real.
      defaultConfig: (ctx) => {
        const best = SolsticeStats.bestNumericPair(ctx);
        const nums = ctx.columns.filter(c => SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'numeric');
        return {
          xColumn: best.x || nums[0] || null,
          yColumn: best.y || nums[1] || nums[0] || null,
          sizeColumn: null,
          showRegression: true,
          clusters: 0,
          _smartHint: best.r != null ? { r: best.r, candidates: best.candidates } : null
        };
      },
      getTitle(slot, ctx){
        const cfg = slot.config || {};
        if (!cfg.xColumn || !cfg.yColumn) return 'Scatter / Bubble';
        const x = SolsticeHumanize.column(cfg.xColumn, ctx.dictionary);
        const y = SolsticeHumanize.column(cfg.yColumn, ctx.dictionary);
        return (y + ' × ' + x).toUpperCase();
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        const nNumeric = ctx.columns.filter(c => SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'numeric').length;
        if (!cfg.xColumn || !cfg.yColumn){
          const msg = nNumeric < 2
            ? 'Scatter precisa de 2 colunas numéricas. Seu dataset tem apenas ' + nNumeric + '.'
            : 'Selecione as colunas X e Y (numéricas) em ⚙️ Configurar.';
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, msg));
          return;
        }
        const ptsAll = [];
        const sizeValsAll = [];
        for (const r of ctx.rows){
          // Sprint 34 / J-1: parseNum BR-aware
          const x = SolsticeStats.parseNum(r[cfg.xColumn]);
          const y = SolsticeStats.parseNum(r[cfg.yColumn]);
          if (isNaN(x) || isNaN(y)) continue;
          ptsAll.push([x, y]);
          if (cfg.sizeColumn){
            const s = SolsticeStats.parseNum(r[cfg.sizeColumn]);
            sizeValsAll.push(isNaN(s) ? 0 : s);
          }
        }
        // Prompt 5 v5.4: downsampling 2D com grid binning + preservação de outliers.
        // Antes (ADR-114): random sample puro quando >2000 — perdia outliers, padrões.
        // Agora: threshold 10k, target 5k, mas SEMPRE inclui outliers IQR 3×
        // dos eixos X e Y (importante para caça-outliers / detecção de fraude).
        let pts = ptsAll, sizeVals = sizeValsAll, sampleNote = null;
        const DOWNSAMPLE_THRESHOLD = 10000;
        const DOWNSAMPLE_TARGET = 5000;
        if (ptsAll.length > DOWNSAMPLE_THRESHOLD){
          const result = _downsample2D(ptsAll, sizeValsAll, DOWNSAMPLE_TARGET, cfg.xColumn + '|' + cfg.yColumn);
          pts = result.pts;
          sizeVals = result.sizeVals;
          sampleNote = '↓ ' + ptsAll.length.toLocaleString('pt-BR') + ' → ' +
                       pts.length.toLocaleString('pt-BR') + ' pts (grid 2D + outliers IQR 3×, ' +
                       result.outliersKept + ' outliers preservados)';
          // Audit
          try {
            if (typeof SolsticeAudit !== 'undefined' && SolsticeAudit.record){
              SolsticeAudit.record({
                action: 'scatter_downsample',
                target: 'auto',
                details: {
                  method: 'grid2d+outliers',
                  original_n: ptsAll.length,
                  sampled_n: pts.length,
                  outliers_kept: result.outliersKept,
                  xColumn: cfg.xColumn, yColumn: cfg.yColumn
                }
              });
            }
          } catch(_) {}
        }
        if (!pts.length){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
            'Sem pares numéricos válidos em "' +
            SolsticeHumanize.column(cfg.xColumn, ctx.dictionary) + '" × "' +
            SolsticeHumanize.column(cfg.yColumn, ctx.dictionary) +
            '". Talvez ambas tenham muitos nulos?'));
          return;
        }
        const tier = _tierFor(host);
        const W = tier.W, H = tier.H, pad = tier.isCompact ? 20 : 36;
        const xs = pts.map(p => p[0]); const ys = pts.map(p => p[1]);
        // Auditoria 2026.6 (SCATTER-OUTLIER): domínio robusto (cerca de Tukey) pra
        // que 1 outlier não comprima todos os pontos num canto (mesmo problema do
        // histograma). Pontos fora caem na borda (coordenada clampeada). Regressão
        // e r² seguem calculados sobre os dados reais.
        const _robust = (arr) => {
          const [mn, mx] = SolsticeStats.minMax(arr);
          if (arr.length < 8) return [mn, mx];
          const q = SolsticeStats.quartiles(arr);
          if (!q || !(q.iqr > 0)) return [mn, mx];
          const lo = Math.max(mn, q.q1 - 1.5 * q.iqr), hi = Math.min(mx, q.q3 + 1.5 * q.iqr);
          return (hi > lo && (lo > mn || hi < mx)) ? [lo, hi] : [mn, mx];
        };
        const [xMin, xMax] = _robust(xs);
        const [yMin, yMax] = _robust(ys);
        const xR = xMax - xMin || 1; const yR = yMax - yMin || 1;
        const _clampPx = (v, a, b) => v < a ? a : (v > b ? b : v);
        function px(x){ return _clampPx(pad + ((x - xMin) / xR) * (W - 2*pad), pad, W - pad); }
        function py(y){ return _clampPx(H - pad - ((y - yMin) / yR) * (H - 2*pad), pad, H - pad); }
        const sMin = sizeVals.length ? SolsticeStats.min(sizeVals) : 0;
        const sMax = sizeVals.length ? SolsticeStats.max(sizeVals) : 0;
        function pr(i){
          if (!cfg.sizeColumn || !sizeVals.length) return 3.2;
          const v = sizeVals[i]; const r = sMax === sMin ? 0.5 : (v - sMin) / (sMax - sMin);
          return 2 + r * 8;
        }
        const clusters = cfg.clusters && cfg.clusters >= 2
          ? _kMeans(pts, Math.min(cfg.clusters, 8))
          : null;

        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class','solstice__chart-svg solstice__chart-svg--' + tier.tier);
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        // Grid
        const g = document.createElementNS(NS, 'g'); g.setAttribute('class','solstice__scatter-grid');
        for (let i = 0; i <= 4; i++){
          const yy = pad + (i / 4) * (H - 2*pad);
          const ln = document.createElementNS(NS, 'line');
          ln.setAttribute('x1', pad); ln.setAttribute('x2', W - pad);
          ln.setAttribute('y1', yy);  ln.setAttribute('y2', yy);
          g.appendChild(ln);
        }
        svg.appendChild(g);

        // Eixos labels
        // Auditoria 2026.6 (SCATTER-AXIS): valores grandes (ex: receita 4.310.124)
        // viravam um rótulo longo "4.310.124,0" que estourava a margem do eixo e
        // era cortado (aparecia ".0.124"). Formato compacto (4,3M / 5,0k) resolve.
        const _fmtAx = (v) => {
          const a = Math.abs(v);
          if (a >= 1e6) return ctx.L.decimal(v/1e6, 1) + 'M';
          if (a >= 1e3) return ctx.L.decimal(v/1e3, 1) + 'k';
          return ctx.L.decimal(v, a > 0 && a < 10 ? 1 : 0);
        };
        const axisG = document.createElementNS(NS, 'g'); axisG.setAttribute('class', 'solstice__scatter-axis');
        [[xMin, pad, H - 6, 'start'], [xMax, W - pad, H - 6, 'end']].forEach(([v, x, y, anchor]) => {
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor', anchor);
          t.textContent = _fmtAx(v);
          axisG.appendChild(t);
        });
        [[yMin, pad - 4, H - pad, 'end'], [yMax, pad - 4, pad + 6, 'end']].forEach(([v, x, y, anchor]) => {
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor', anchor);
          t.textContent = _fmtAx(v);
          axisG.appendChild(t);
        });
        svg.appendChild(axisG);

        // Pontos
        pts.forEach((p, i) => {
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('class', 'solstice__scatter-point');
          c.setAttribute('cx', px(p[0]).toFixed(1));
          c.setAttribute('cy', py(p[1]).toFixed(1));
          c.setAttribute('r', pr(i).toFixed(2));
          if (clusters) c.setAttribute('data-cluster', clusters[i]);
          const title = document.createElementNS(NS, 'title');
          title.textContent = SolsticeHumanize.column(cfg.xColumn, ctx.dictionary) + ': ' + ctx.L.decimal(p[0], 2) +
                              ' · ' + SolsticeHumanize.column(cfg.yColumn, ctx.dictionary) + ': ' + ctx.L.decimal(p[1], 2);
          c.appendChild(title);
          svg.appendChild(c);
        });

        // Regressão linear
        if (cfg.showRegression && pts.length >= 2){
          const reg = _linearRegression(pts);
          if (reg){
            const x1 = xMin, y1 = reg.slope * x1 + reg.intercept;
            const x2 = xMax, y2 = reg.slope * x2 + reg.intercept;
            const ln = document.createElementNS(NS, 'line');
            ln.setAttribute('class','solstice__scatter-regression');
            ln.setAttribute('x1', px(x1).toFixed(1)); ln.setAttribute('y1', py(y1).toFixed(1));
            ln.setAttribute('x2', px(x2).toFixed(1)); ln.setAttribute('y2', py(y2).toFixed(1));
            svg.appendChild(ln);
            const lbl = document.createElementNS(NS, 'text');
            lbl.setAttribute('class','solstice__scatter-r2');
            lbl.setAttribute('x', W - pad - 4); lbl.setAttribute('y', pad + 12);
            lbl.setAttribute('text-anchor', 'end');
            lbl.textContent = 'r² = ' + (reg.r2 >= 0 ? reg.r2.toFixed(3) : '—');
            svg.appendChild(lbl);
          }
        }
        host.appendChild(svg);

        // Prompt 5: badge de downsampling no canto, clicável (mostra explicação)
        if (sampleNote){
          const badge = SolsticeUtils.el('button', {
            type:'button',
            class:'solstice__scatter-downsample-badge',
            title: 'Downsampling 2D ativo. Clique para detalhes.',
            'aria-label': 'Downsampling ativo: ' + sampleNote,
            onclick: () => {
              SolsticeModal.show({
                title: '📉 Downsampling no Scatter',
                size: 'md',
                body: () => {
                  const wrap = SolsticeUtils.el('div', { style:'font-size:13px;line-height:1.7;color:var(--c-text);' });
                  wrap.appendChild(SolsticeUtils.el('p', { style:'margin:0 0 12px 0;' }, sampleNote));
                  wrap.appendChild(SolsticeUtils.el('p', { style:'margin:0 0 12px 0;color:var(--c-text-2);' },
                    'Como funciona: divisão da área em grade NxN, escolha do ponto central de cada célula, PLUS outliers IQR 3× sempre preservados (importante para detecção de anomalias).'));
                  wrap.appendChild(SolsticeUtils.el('p', { style:'margin:0;color:var(--c-text-2);' },
                    'Determinístico: mesma seed (derivada das colunas) → mesma amostra entre reloads.'));
                  return wrap;
                },
                footer: (close) => [
                  SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Entendi')
                ]
              });
            }
          }, '📉 ' + (sampleNote.split(' (')[0])); // primeira parte: contagem
          host.appendChild(badge);
        }

        if (!tier.isCompact){
          const caption = SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);text-align:center;font-family:var(--font-mono);margin-top:4px;' },
            SolsticeHumanize.recordCount(pts.length) + (clusters ? ' · ' + cfg.clusters + ' clusters' : '') + (cfg.showRegression ? ' · regressão linear' : '') +
              (ptsAll.length > pts.length ? ' · de ' + SolsticeHumanize.recordCount(ptsAll.length) + ' totais' : ''));
          host.appendChild(caption);
        }

        _observeResponsive(host, registry['scatter'], slot, ctx);
      }
    });

    /* ===== HEATMAP CALENDÁRIO (GitHub-style) ===== */
    register({
      id:'heatmap-cal', name:'Heatmap Calendário', icon:'🗓️',
      description: 'Atividade diária ao longo de um ano',
      defaultConfig: (ctx) => {
        const tempCol = ctx.columns.find(c => SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'temporal');
        const numCol  = ctx.columns.find(c => SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'numeric');
        return { dateColumn: tempCol, valueColumn: numCol, agg: numCol ? 'sum' : 'count' };
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        if (!cfg.dateColumn){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
            'Selecione coluna temporal em ⚙️ Configurar.'));
          return;
        }
        // Agrega por dia
        const byDay = new Map();
        let dMin = null, dMax = null;
        for (const r of ctx.rows){
          const d = new Date(r[cfg.dateColumn]);
          if (isNaN(d)) continue;
          const key = d.toISOString().slice(0,10);
          let v = cfg.agg === 'count' || !cfg.valueColumn ? 1 : SolsticeStats.parseNum(r[cfg.valueColumn]);
          if (isNaN(v)) v = 0;
          byDay.set(key, (byDay.get(key) || 0) + v);
          if (!dMin || d < dMin) dMin = d;
          if (!dMax || d > dMax) dMax = d;
        }
        if (!byDay.size){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Sem dados temporais válidos.'));
          return;
        }
        const values = Array.from(byDay.values());
        const vMax = SolsticeStats.max(values);
        function level(v){
          if (!v) return 0;
          const r = v / vMax;
          if (r > 0.75) return 4;
          if (r > 0.5)  return 3;
          if (r > 0.25) return 2;
          return 1;
        }
        // Renderiza por mês (12 meses do range)
        const startMonth = new Date(dMin.getFullYear(), dMin.getMonth(), 1);
        const endMonth = new Date(dMax.getFullYear(), dMax.getMonth() + 1, 0);
        const wrap = SolsticeUtils.el('div', { class:'solstice__heat-cal-wrap' });
        const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const cursor = new Date(startMonth);
        while (cursor <= endMonth){
          const monthBox = SolsticeUtils.el('div', { class:'solstice__heat-cal-month' });
          monthBox.appendChild(SolsticeUtils.el('div', { class:'solstice__heat-cal-month-label' },
            MESES[cursor.getMonth()] + (cursor.getMonth() === 0 ? ' ' + cursor.getFullYear() : '')));
          const week = SolsticeUtils.el('div', { class:'solstice__heat-cal-week' });
          // Primeira semana — alinhar pelo dia da semana
          const firstDay = new Date(cursor); firstDay.setDate(1);
          // Sempre 6 semanas no max — vamos renderizar em colunas
          const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
          const lastDate = monthEnd.getDate();
          for (let day = 1; day <= lastDate; day++){
            const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
            const key = d.toISOString().slice(0,10);
            const v = byDay.get(key) || 0;
            const cell = SolsticeUtils.el('div', {
              class:'solstice__heat-cal-cell',
              'data-level': level(v),
              title: ctx.L.date(d) + ' · ' + ctx.L.decimal(v, 2)
            });
            week.appendChild(cell);
          }
          monthBox.appendChild(week);
          wrap.appendChild(monthBox);
          cursor.setMonth(cursor.getMonth() + 1);
        }
        host.appendChild(wrap);
        // Legend
        const legend = SolsticeUtils.el('div', { class:'solstice__heat-cal-legend' });
        legend.appendChild(SolsticeUtils.el('span', null, 'menos'));
        for (let i = 0; i <= 4; i++){
          legend.appendChild(SolsticeUtils.el('div', { class:'solstice__heat-cal-cell', 'data-level': i }));
        }
        legend.appendChild(SolsticeUtils.el('span', null, 'mais'));
        host.appendChild(legend);
      }
    });

    /* ===== GAUGE ===== */
    register({
      id:'gauge', name:'Gauge', icon:'⏲️',
      description: 'Velocímetro com zonas de meta',
      // ADR-057 (B7): defaultConfig usa Stats.suggestGauge para escolher
      // colunas percentuais quando disponíveis, ou P5/P95 do dataset para
      // min/max — assim o gauge aparece preenchido em vez de "zerado".
      // Meta inferida via higherIsBetter do dicionário (P75 / P50 / P25).
      defaultConfig: (ctx) => {
        const s = SolsticeStats.suggestGauge(ctx);
        return {
          column: s.column,
          agg: s.agg,
          min: s.min,
          max: s.max,
          target: s.target
        };
      },
      getTitle(slot, ctx){
        const col = slot.config && slot.config.column;
        return col ? SolsticeHumanize.column(col, ctx.dictionary).toUpperCase() : 'Gauge';
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        if (!cfg.column){
          const hasNumeric = ctx.columns.some(c => SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'numeric');
          const msg = hasNumeric
            ? 'Selecione coluna numérica em ⚙️ Configurar. O range min/max será sugerido a partir dos percentis 5 e 95.'
            : 'Gauge precisa de uma coluna numérica. Seu dataset não tem nenhuma.';
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, msg));
          return;
        }
        const values = ctx.rows.map(r => SolsticeStats.parseNum(r[cfg.column])).filter(v => !isNaN(v));
        if (!values.length){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
            'Sem valores numéricos válidos em "' + SolsticeHumanize.column(cfg.column, ctx.dictionary) + '".'));
          return;
        }
        let v;
        if (cfg.agg === 'sum') v = values.reduce((a,b)=>a+b,0);
        else if (cfg.agg === 'min') v = SolsticeStats.min(values);
        else if (cfg.agg === 'max') v = SolsticeStats.max(values);
        else v = values.reduce((a,b)=>a+b,0) / values.length;

        const lo = parseFloat(cfg.min) || 0;
        const hi = parseFloat(cfg.max) || 100;
        const target = cfg.target == null ? null : parseFloat(cfg.target);
        const clamped = Math.max(lo, Math.min(hi, v));
        const ratio = (hi - lo) === 0 ? 0 : (clamped - lo) / (hi - lo);
        // Arc 180° (PI a 2*PI) — responsivo
        const tier = _tierFor(host);
        const W = tier.isCompact ? 240 : tier.isStandard ? 280 : 340;
        const H = tier.isCompact ? 150 : tier.isStandard ? 180 : 220;
        const cx = W/2, cy = H - 20, R = tier.isCompact ? 80 : tier.isStandard ? 100 : 130;
        function angleFor(r){ return Math.PI + r * Math.PI; }
        function pt(r){ const a = angleFor(r); return [cx + R*Math.cos(a), cy + R*Math.sin(a)]; }
        function arc(start, end, color){
          const [x1,y1] = pt(start); const [x2,y2] = pt(end);
          const large = (end - start) > 0.5 ? 1 : 0;
          return ['M', x1, y1, 'A', R, R, 0, large, 1, x2, y2].join(' ');
        }
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        // Sprint 24 / F-19: marca como gauge — CSS aplica max-height menor
        // e o pai (.solstice__comp-body--gauge) centraliza verticalmente.
        svg.setAttribute('class','solstice__chart-svg solstice__chart-svg--gauge solstice__chart-svg--' + tier.tier);
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        // Marca o host pra CSS centralizar verticalmente
        try { if (host && host.classList) host.classList.add('solstice__comp-body--gauge'); } catch(_){}

        // Background arc
        const bg = document.createElementNS(NS, 'path');
        bg.setAttribute('class','solstice__gauge-arc-bg');
        bg.setAttribute('d', arc(0, 1));
        bg.setAttribute('stroke-width', 18);
        svg.appendChild(bg);

        // Zones (até target = verde; até 90% = warn; até hi = error) ou neutro
        const targetRatio = (target != null && hi !== lo) ? Math.max(0, Math.min(1, (target - lo) / (hi - lo))) : null;
        function zoneArc(s, e, color){
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('class','solstice__gauge-arc-fill');
          p.setAttribute('d', arc(s, e));
          p.setAttribute('stroke', color);
          p.setAttribute('stroke-width', 18);
          svg.appendChild(p);
        }
        if (targetRatio != null){
          zoneArc(0, Math.min(ratio, targetRatio), 'var(--c-success)');
          if (ratio > targetRatio){
            zoneArc(targetRatio, ratio, 'var(--c-warn)');
          }
        } else {
          zoneArc(0, ratio, 'var(--c-accent)');
        }

        // Target tick
        if (targetRatio != null){
          const [tx, ty] = pt(targetRatio);
          const [tx2, ty2] = (() => { const a = angleFor(targetRatio); return [cx + (R+10)*Math.cos(a), cy + (R+10)*Math.sin(a)]; })();
          const tk = document.createElementNS(NS, 'line');
          tk.setAttribute('class','solstice__gauge-target-tick');
          tk.setAttribute('x1', tx.toFixed(1)); tk.setAttribute('y1', ty.toFixed(1));
          tk.setAttribute('x2', tx2.toFixed(1)); tk.setAttribute('y2', ty2.toFixed(1));
          svg.appendChild(tk);
        }

        // Min/Max labels
        const lblMin = document.createElementNS(NS, 'text');
        lblMin.setAttribute('class','solstice__gauge-range-label');
        lblMin.setAttribute('x', cx - R); lblMin.setAttribute('y', cy + 16);
        lblMin.textContent = ctx.L.decimal(lo, 0);
        svg.appendChild(lblMin);
        const lblMax = document.createElementNS(NS, 'text');
        lblMax.setAttribute('class','solstice__gauge-range-label');
        lblMax.setAttribute('x', cx + R); lblMax.setAttribute('y', cy + 16);
        lblMax.textContent = ctx.L.decimal(hi, 0);
        svg.appendChild(lblMax);

        // Needle
        const [nx, ny] = pt(ratio);
        const needle = document.createElementNS(NS, 'line');
        needle.setAttribute('class','solstice__gauge-needle');
        needle.setAttribute('x1', cx); needle.setAttribute('y1', cy);
        needle.setAttribute('x2', nx.toFixed(1)); needle.setAttribute('y2', ny.toFixed(1));
        svg.appendChild(needle);

        // Value text
        const valLbl = document.createElementNS(NS, 'text');
        valLbl.setAttribute('class','solstice__gauge-value-label');
        valLbl.setAttribute('x', cx); valLbl.setAttribute('y', cy - 24);
        valLbl.textContent = ctx.L.decimal(v, 1);
        svg.appendChild(valLbl);

        host.appendChild(svg);
        _observeResponsive(host, registry['gauge'], slot, ctx);
      }
    });

    /* ===== MARKDOWN / TEXTO ===== */
    register({
      id:'markdown', name:'Texto / Markdown', icon:'📝',
      description: 'Texto rico com placeholders dinâmicos',
      defaultConfig: () => ({
        text: '# Título\n\nEdite este texto em ⚙️ Configurar.\n\nUse `{{path.no.store}}` para inserir valores ao vivo.\n\n- Item de lista\n- Outro item\n\n**Negrito** e *itálico* suportados.'
      }),
      render(slot, host, ctx){
        const cfg = slot.config || {};
        const text = cfg.text || '';
        const md = _renderMarkdown(text);
        host.appendChild(md);
      }
    });

    /* ===== NARRATIVE-AUTO (Camada 1 polish v5) ====
       Narrativa que se ADAPTA automaticamente ao estado do dashboard:
       lê filtros + componentes do canvas + dataset e gera parágrafo executivo.
       Re-renderiza sempre que filtros/sections mudam (via _ctx no Components.render). */
    register({
      id:'narrative-auto', name:'Narrativa Automática', icon:'📜',
      description: 'Texto executivo que se adapta aos filtros e componentes',
      defaultConfig: () => ({
        tone: 'executive',  // executive | analytical | casual
        depth: 'medium',    // short | medium | long
        showFilters: true   // mostra os filtros aplicados na narrativa
      }),
      render(slot, host, ctx){
        const cfg = slot.config || {};
        const wrap = SolsticeUtils.el('div', { class:'solstice__narrative-auto' });

        // Resumo executivo gerado em tempo real (usa rows JÁ filtrados via ctx)
        let text = '';
        try {
          if (typeof SolsticeNarrative !== 'undefined' && SolsticeNarrative.buildDashboardSummary){
            text = SolsticeNarrative.buildDashboardSummary();
          }
        } catch(e){
          text = '_Erro ao gerar narrativa: ' + (e.message || String(e)) + '_';
        }

        // Limita por profundidade
        if (cfg.depth === 'short'){
          // Pega só primeiras 3 seções
          const parts = text.split(/^## /m);
          text = parts.slice(0, 4).join('\n## ');
        } else if (cfg.depth === 'long'){
          // Mantém tudo
        } else {
          // medium: pega até 5 seções
          const parts = text.split(/^## /m);
          text = parts.slice(0, 6).join('\n## ');
        }

        // Render como markdown (reusa _renderMarkdown)
        const md = _renderMarkdown(text);
        wrap.appendChild(md);

        // Rodapé com info de quando foi gerado
        const activeFilters = SolsticeStore.get('filters') || {};
        const filterCount = Object.values(activeFilters).filter(v => {
          if (Array.isArray(v)) return v.length > 0;
          if (v && typeof v === 'object') return v.min != null || v.max != null || v.from || v.to;
          return false;
        }).length;
        const footer = SolsticeUtils.el('div', { class:'solstice__narrative-auto-footer' });
        footer.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true' }, '🔄 '));
        footer.appendChild(SolsticeUtils.el('span', null,
          'Atualizado ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
          (filterCount ? ' · ' + filterCount + ' filtro' + (filterCount === 1 ? '' : 's') + ' ativo' + (filterCount === 1 ? '' : 's') : ' · sem filtros')));
        wrap.appendChild(footer);

        host.appendChild(wrap);
      }
    });

    function _renderMarkdown(text){
      const wrap = SolsticeUtils.el('div', { class:'solstice__md' });
      // Pré-processa placeholders. B9: {{param.X}} resolvido pelo SolsticeParams primeiro;
      // depois mantém o caminho legado {{path.no.store}}.
      let pre = text;
      if (typeof SolsticeParams !== 'undefined' && SolsticeParams.resolveText){
        pre = SolsticeParams.resolveText(pre);
      }
      // Sprint 34 / S-01 (André/Sec CVSS 7.5): escape do valor cru do Store
      // antes da concatenação. Antes: `String(v)` ia direto pro innerHTML, e
      // atacante que controlasse qualquer chave do Store (ex: nome de
      // dataset/coluna importada) podia injetar HTML/JS. Com CSP fraca
      // (unsafe-inline), virava RCE-no-cliente. Agora escapamos.
      const _esc = (s) => SolsticeUtils.escapeHtml(String(s));
      const withVars = pre.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, p) => {
        const v = SolsticeStore.get(p);
        if (v == null) return '<span class="solstice__md-placeholder">{{' + _esc(p) + '}}</span>';
        if (typeof v === 'object') return '<span class="solstice__md-placeholder">' + _esc(p) + '</span>';
        return _esc(v);
      });
      // Auditoria 2026 (JM-01 / HV-01): renderer de markdown — exceção
      // controlada à política. innerHTML é usado APÓS cada token dinâmico
      // ter passado por escapeHtml(). Centralizamos o escape no helper
      // global em vez de ter um esc() local ad-hoc.
      const esc = SolsticeUtils.escapeHtml;
      let html = '';
      const lines = withVars.split(/\n/);
      let inList = false;
      for (const raw of lines){
        const ln = raw;
        // Headings
        let m;
        if ((m = ln.match(/^###\s+(.+)$/))){
          if (inList){ html += '</ul>'; inList = false; }
          html += '<h3>' + _inline(m[1]) + '</h3>'; continue;
        }
        if ((m = ln.match(/^##\s+(.+)$/))){
          if (inList){ html += '</ul>'; inList = false; }
          html += '<h2>' + _inline(m[1]) + '</h2>'; continue;
        }
        if ((m = ln.match(/^#\s+(.+)$/))){
          if (inList){ html += '</ul>'; inList = false; }
          html += '<h1>' + _inline(m[1]) + '</h1>'; continue;
        }
        if ((m = ln.match(/^[-*]\s+(.+)$/))){
          if (!inList){ html += '<ul>'; inList = true; }
          html += '<li>' + _inline(m[1]) + '</li>'; continue;
        }
        if (inList){ html += '</ul>'; inList = false; }
        if (ln.trim() === ''){ html += ''; continue; }
        html += '<p>' + _inline(ln) + '</p>';
      }
      if (inList) html += '</ul>';
      wrap.innerHTML = html;
      return wrap;

      function _inline(s){
        // Não escapa o que já é placeholder span. Estratégia: split por placeholder, escapa o resto, aplica inline.
        const parts = s.split(/(<span class="solstice__md-placeholder">.*?<\/span>)/g);
        return parts.map(p => {
          if (p.startsWith('<span class="solstice__md-placeholder">')) return p;
          let out = esc(p);
          // code inline
          out = out.replace(/`([^`]+)`/g, (_, c) => '<code>' + c + '</code>');
          // bold
          out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          // italic
          out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
          // links [text](url) — apenas https/http
          out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
          return out;
        }).join('');
      }
    }

    /* ===== BOX PLOT ===== */
    register({
      id:'boxplot', name:'Box Plot', icon:'📦',
      description: 'Distribuição estatística com quartis e outliers',
      // ADR-058 (B7): defaultConfig usa Stats.suggestBoxPlot — auto-seleciona
      // valueColumn (1ª numérica) E groupColumn (categórica com 2-8 distintos).
      // Resultado: box plot já aparece agrupado quando faz sentido.
      defaultConfig: (ctx) => SolsticeStats.suggestBoxPlot(ctx),
      getTitle(slot, ctx){
        const v = slot.config && slot.config.valueColumn;
        return v ? ('Distribuição de ' + SolsticeHumanize.column(v, ctx.dictionary)).toUpperCase() : 'Box Plot';
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        const valCol = cfg.valueColumn;
        if (!valCol){
          const hasNumeric = ctx.columns.some(c => SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'numeric');
          const msg = hasNumeric
            ? 'Selecione a coluna numérica de valor em ⚙️ Configurar. Opcional: agrupar por categórica (até 8 grupos).'
            : 'Box Plot precisa de uma coluna numérica.';
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, msg));
          return;
        }
        // Agrupa por groupColumn (ou um único grupo)
        const groups = new Map();
        for (const r of ctx.rows){
          const v = SolsticeStats.parseNum(r[valCol]);
          if (isNaN(v)) continue;
          const g = cfg.groupColumn ? String(r[cfg.groupColumn]) : '—';
          if (!groups.has(g)) groups.set(g, []);
          groups.get(g).push(v);
        }
        if (!groups.size){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Sem valores válidos.'));
          return;
        }
        // Limita a 8 grupos top por contagem
        let entries = Array.from(groups.entries()).sort((a,b) => b[1].length - a[1].length).slice(0, 8);
        // Compute quartis por grupo (+ n e média — Auditoria 2026.6, box mais rico)
        const computed = entries.map(([g, vs]) => {
          const q = _quartiles(vs);
          if (!q) return null;
          let sum = 0; for (let k = 0; k < vs.length; k++) sum += vs[k];
          return { group: g, q, n: vs.length, mean: vs.length ? sum / vs.length : null };
        }).filter(Boolean);

        const allVals = computed.flatMap(c => [c.q.min, c.q.max, ...c.q.outliers]);
        const [yMin, yMax] = SolsticeStats.minMax(allVals); /* code review 2026: minMax safe */
        const yR = yMax - yMin || 1;
        const tier = _tierFor(host);
        const W = tier.W, H = tier.H;
        const padL = tier.isCompact ? 32 : 50, padR = tier.isCompact ? 10 : 20;
        const padT = tier.isCompact ? 12 : 20, padB = tier.isCompact ? 28 : 40;
        const innerW = W - padL - padR, innerH = H - padT - padB;
        const slot_w = innerW / computed.length;
        function py(v){ return padT + innerH - ((v - yMin) / yR) * innerH; }

        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class','solstice__chart-svg solstice__chart-svg--' + tier.tier);
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        // Y-axis ticks
        for (let i = 0; i <= 4; i++){
          const v = yMin + (i/4) * yR;
          const y = py(v);
          const ln = document.createElementNS(NS, 'line');
          ln.setAttribute('x1', padL); ln.setAttribute('x2', W - padR);
          ln.setAttribute('y1', y); ln.setAttribute('y2', y);
          ln.setAttribute('stroke', 'var(--c-border)'); ln.setAttribute('stroke-width', '0.5');
          ln.setAttribute('stroke-dasharray', '2 2');
          svg.appendChild(ln);
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('class','solstice__boxplot-y-label');
          t.setAttribute('x', padL - 6); t.setAttribute('y', y + 3);
          t.textContent = ctx.L.decimal(v, 1);
          svg.appendChild(t);
        }

        computed.forEach((c, i) => {
          const cx = padL + i * slot_w + slot_w/2;
          const boxW = Math.min(40, slot_w * 0.5);
          const q1y = py(c.q.q1), q3y = py(c.q.q3), medy = py(c.q.median);
          const miny = py(c.q.min), maxy = py(c.q.max);
          // Box
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('class','solstice__boxplot-box');
          rect.setAttribute('x', (cx - boxW/2).toFixed(1));
          rect.setAttribute('y', q3y.toFixed(1));
          rect.setAttribute('width', boxW.toFixed(1));
          rect.setAttribute('height', (q1y - q3y).toFixed(1));
          rect.setAttribute('rx', 2);
          svg.appendChild(rect);
          // Median line
          const med = document.createElementNS(NS, 'line');
          med.setAttribute('class','solstice__boxplot-median');
          med.setAttribute('x1', (cx - boxW/2).toFixed(1)); med.setAttribute('x2', (cx + boxW/2).toFixed(1));
          med.setAttribute('y1', medy.toFixed(1)); med.setAttribute('y2', medy.toFixed(1));
          svg.appendChild(med);
          // Whiskers
          [[c.q.min, q1y], [c.q.max, q3y]].forEach(([wv, edge]) => {
            const wy = py(wv);
            const wln = document.createElementNS(NS, 'line');
            wln.setAttribute('class','solstice__boxplot-whisker');
            wln.setAttribute('x1', cx.toFixed(1)); wln.setAttribute('x2', cx.toFixed(1));
            wln.setAttribute('y1', edge.toFixed(1)); wln.setAttribute('y2', wy.toFixed(1));
            svg.appendChild(wln);
            const cap = document.createElementNS(NS, 'line');
            cap.setAttribute('class','solstice__boxplot-whisker');
            cap.setAttribute('x1', (cx - boxW/4).toFixed(1)); cap.setAttribute('x2', (cx + boxW/4).toFixed(1));
            cap.setAttribute('y1', wy.toFixed(1)); cap.setAttribute('y2', wy.toFixed(1));
            svg.appendChild(cap);
          });
          // Outliers — Auditoria 2026.6: maiores e VAZADOS (hollow) com borda de
          // alerta, bem mais visíveis (o usuário pediu pra melhorar o "box outlier").
          c.q.outliers.forEach(o => {
            const oc = document.createElementNS(NS, 'circle');
            oc.setAttribute('class','solstice__boxplot-outlier');
            oc.setAttribute('cx', cx.toFixed(1)); oc.setAttribute('cy', py(o).toFixed(1));
            oc.setAttribute('r', tier.isCompact ? 2.5 : 3.2);
            oc.setAttribute('fill', 'none');
            oc.setAttribute('stroke', 'var(--c-warn, #E8B339)');
            oc.setAttribute('stroke-width', '1.3');
            const t = document.createElementNS(NS, 'title');
            t.textContent = 'Outlier: ' + ctx.L.decimal(o, 2);
            oc.appendChild(t);
            svg.appendChild(oc);
          });
          // Marcador de MÉDIA (losango) — complementa a mediana (linha). Auditoria 2026.6.
          if (c.mean != null && !tier.isCompact){
            const my = py(c.mean), ms = 3.5;
            const dia = document.createElementNS(NS, 'path');
            dia.setAttribute('class','solstice__boxplot-mean');
            dia.setAttribute('d', 'M' + cx + ' ' + (my-ms) + ' L' + (cx+ms) + ' ' + my + ' L' + cx + ' ' + (my+ms) + ' L' + (cx-ms) + ' ' + my + ' Z');
            dia.setAttribute('fill', 'var(--c-accent)');
            dia.setAttribute('opacity', '0.9');
            const mt = document.createElementNS(NS, 'title');
            mt.textContent = 'Média: ' + ctx.L.decimal(c.mean, 2);
            dia.appendChild(mt);
            svg.appendChild(dia);
          }
          // n + nº de outliers (rótulo discreto acima do box) — Auditoria 2026.6.
          if (!tier.isCompact){
            const stat = document.createElementNS(NS, 'text');
            stat.setAttribute('class','solstice__boxplot-stat');
            stat.setAttribute('x', cx.toFixed(1)); stat.setAttribute('y', (padT - 4).toFixed(1));
            stat.setAttribute('text-anchor', 'middle');
            stat.setAttribute('font-size', '8.5');
            stat.setAttribute('fill', 'var(--c-muted)');
            stat.textContent = 'n=' + c.n + (c.q.outliers.length ? ' · ' + c.q.outliers.length + '⚠' : '');
            svg.appendChild(stat);
          }
          // Group label
          const lbl = document.createElementNS(NS, 'text');
          lbl.setAttribute('class','solstice__boxplot-group-label');
          lbl.setAttribute('x', cx.toFixed(1)); lbl.setAttribute('y', H - 18);
          const groupTxt = String(c.group).length > 12 ? String(c.group).slice(0, 11) + '…' : c.group;
          lbl.textContent = groupTxt;
          const ttl = document.createElementNS(NS, 'title');
          ttl.textContent = c.group + ' · Q1=' + ctx.L.decimal(c.q.q1,2) + ' · Med=' + ctx.L.decimal(c.q.median,2) + ' · Q3=' + ctx.L.decimal(c.q.q3,2) + ' · outliers=' + c.q.outliers.length;
          lbl.appendChild(ttl);
          svg.appendChild(lbl);
        });

        host.appendChild(svg);
        _observeResponsive(host, registry['boxplot'], slot, ctx);
      }
    });

    /* ===== SANKEY (simplificado, 2 níveis) ===== */
    register({
      id:'sankey', name:'Sankey', icon:'🌊',
      description: 'Fluxo entre duas categorias',
      // ADR-059 (B7): defaultConfig usa Stats.suggestSankey — garante
      // sourceColumn ≠ targetColumn e ambas com 2-8 distintos (sankey útil).
      // Se há apenas 1 categórica, targetColumn=null e empty state explica.
      defaultConfig: (ctx) => SolsticeStats.suggestSankey(ctx),
      render(slot, host, ctx){
        const cfg = slot.config || {};
        if (!cfg.sourceColumn || !cfg.targetColumn){
          const cats = ctx.columns.filter(c => SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'categorical');
          let msg;
          if (cats.length === 0){
            msg = 'Sankey precisa de pelo menos 2 colunas categóricas (origem e destino). Seu dataset não tem nenhuma.';
          } else if (cats.length === 1){
            msg = 'Sankey precisa de 2 categóricas distintas. Seu dataset tem só uma: "' +
              SolsticeHumanize.column(cats[0], ctx.dictionary) + '". Importe outro CSV ou use Distribuição.';
          } else if (cfg.sourceColumn && cfg.sourceColumn === cfg.targetColumn){
            msg = 'Origem e destino devem ser colunas DIFERENTES. Ajuste em ⚙️ Configurar.';
          } else {
            msg = 'Selecione duas colunas categóricas distintas (origem e destino) em ⚙️ Configurar.';
          }
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, msg));
          return;
        }
        // Patch B6-r1: empty state quando slot é muito pequeno para Sankey
        if (host.clientWidth && host.clientWidth < 320){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__chart-tier-empty' },
            '📏 Sankey precisa de mais espaço. Aumente o slot ou use layout 1col.'));
          _observeResponsive(host, registry['sankey'], slot, ctx);
          return;
        }
        // Agrega fluxos
        const flows = new Map();   // 'source|target' → value
        const sourceTotals = new Map(), targetTotals = new Map();
        for (const r of ctx.rows){
          const s = String(r[cfg.sourceColumn] || '');
          const t = String(r[cfg.targetColumn] || '');
          if (!s || !t) continue;
          let v = cfg.valueColumn ? SolsticeStats.parseNum(r[cfg.valueColumn]) : 1;
          if (isNaN(v)) v = 0;
          const k = s + '|' + t;
          flows.set(k, (flows.get(k) || 0) + v);
          sourceTotals.set(s, (sourceTotals.get(s) || 0) + v);
          targetTotals.set(t, (targetTotals.get(t) || 0) + v);
        }
        if (!flows.size){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__sankey-empty' },
            'Sem fluxos válidos para os campos selecionados.'));
          return;
        }
        // Top 8 sources e targets
        function topN(map, n){
          return Array.from(map.entries()).sort((a,b) => b[1] - a[1]).slice(0, n);
        }
        const sources = topN(sourceTotals, 8);
        const targets = topN(targetTotals, 8);
        const sourceSet = new Set(sources.map(([k]) => k));
        const targetSet = new Set(targets.map(([k]) => k));
        const filteredFlows = Array.from(flows.entries())
          .map(([k, v]) => { const [s, t] = k.split('|'); return { s, t, v }; })
          .filter(f => sourceSet.has(f.s) && targetSet.has(f.t));
        const totalV = filteredFlows.reduce((sum, f) => sum + f.v, 0) || 1;

        const tier = _tierFor(host);
        // Sprint 36 / EV-COMP-03: padX aumentado pra evitar labels do destino
        // cortados (UFs como "MT", "RS" cabiam OK, mas "Centro-Oeste" e
        // "Sudeste" ultrapassavam viewBox). Aumentado proporcionalmente +
        // viewBox um pouco maior pra dar respiração.
        const W = tier.isLarge ? 600 : 480;
        const H = tier.isLarge ? 340 : 280;
        const padX = tier.isLarge ? 110 : 90, nodeW = 14, gap = 8;
        const innerH = H - 40;

        // Calcula posições verticais cumulativas (alinhadas por proporção do total)
        function buildPositions(items, side){
          const sumSide = items.reduce((s, [, v]) => s + v, 0) || 1;
          const totalGap = gap * (items.length - 1);
          const availH = innerH - totalGap;
          let cursor = 20;
          const positions = {};
          items.forEach(([k, v]) => {
            const h = Math.max(2, (v / sumSide) * availH);
            positions[k] = { y: cursor, h, v };
            cursor += h + gap;
          });
          return positions;
        }
        const sPos = buildPositions(sources, 'l');
        const tPos = buildPositions(targets, 'r');

        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class','solstice__chart-svg solstice__chart-svg--' + tier.tier);
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        // Links primeiro (atrás dos nodes)
        // Cada flow vira um path Bezier; offset y interno de cada lado por flow ordenado por valor
        const sourceOffsets = {}; const targetOffsets = {};
        sources.forEach(([k]) => sourceOffsets[k] = 0);
        targets.forEach(([k]) => targetOffsets[k] = 0);
        // Ordena flows por valor descendente para empilhar consistente
        filteredFlows.sort((a, b) => b.v - a.v);
        filteredFlows.forEach(f => {
          const sP = sPos[f.s]; const tP = tPos[f.t];
          if (!sP || !tP) return;
          const fracS = f.v / sP.v;
          const fracT = f.v / tP.v;
          const sHeight = sP.h * fracS;
          const tHeight = tP.h * fracT;
          const sY = sP.y + sourceOffsets[f.s];
          const tY = tP.y + targetOffsets[f.t];
          sourceOffsets[f.s] += sHeight;
          targetOffsets[f.t] += tHeight;

          const x1 = padX + nodeW;
          const x2 = W - padX - nodeW;
          const cx1 = x1 + (x2 - x1) * 0.5;
          const cx2 = x1 + (x2 - x1) * 0.5;
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('class','solstice__sankey-link');
          const d = [
            'M', x1, sY,
            'C', cx1, sY, cx2, tY, x2, tY,
            'L', x2, tY + tHeight,
            'C', cx2, tY + tHeight, cx1, sY + sHeight, x1, sY + sHeight,
            'Z'
          ].join(' ');
          path.setAttribute('d', d);
          const title = document.createElementNS(NS, 'title');
          title.textContent = f.s + ' → ' + f.t + ' · ' + ctx.L.decimal(f.v, 2);
          path.appendChild(title);
          svg.appendChild(path);
        });

        // Nodes (origem) — B9: clicáveis para cross-filter
        sources.forEach(([k, v]) => {
          const p = sPos[k];
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('class','solstice__sankey-node');
          rect.setAttribute('x', padX); rect.setAttribute('y', p.y.toFixed(1));
          rect.setAttribute('width', nodeW); rect.setAttribute('height', p.h.toFixed(1));
          rect.setAttribute('rx', 1);
          rect.style.cursor = 'pointer';
          rect.addEventListener('click', () => SolsticeCrossFilter.activate(cfg.sourceColumn, k));
          const title = document.createElementNS(NS, 'title');
          title.textContent = k + ' · ' + ctx.L.decimal(v, 2) + ' · clique para cross-filter';
          rect.appendChild(title);
          svg.appendChild(rect);
          const lbl = document.createElementNS(NS, 'text');
          lbl.setAttribute('class','solstice__sankey-label');
          lbl.setAttribute('x', padX - 6);
          lbl.setAttribute('y', (p.y + p.h/2 + 4).toFixed(1));
          lbl.setAttribute('text-anchor', 'end');
          lbl.textContent = String(k).length > 14 ? String(k).slice(0, 13) + '…' : k;
          svg.appendChild(lbl);
        });
        // Nodes (destino) — B9: também clicáveis
        targets.forEach(([k, v]) => {
          const p = tPos[k];
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('class','solstice__sankey-node');
          rect.setAttribute('x', W - padX - nodeW); rect.setAttribute('y', p.y.toFixed(1));
          rect.setAttribute('width', nodeW); rect.setAttribute('height', p.h.toFixed(1));
          rect.setAttribute('rx', 1);
          rect.style.cursor = 'pointer';
          rect.addEventListener('click', () => SolsticeCrossFilter.activate(cfg.targetColumn, k));
          const title = document.createElementNS(NS, 'title');
          title.textContent = k + ' · ' + ctx.L.decimal(v, 2) + ' · clique para cross-filter';
          rect.appendChild(title);
          svg.appendChild(rect);
          const lbl = document.createElementNS(NS, 'text');
          lbl.setAttribute('class','solstice__sankey-label solstice__sankey-label--right');
          lbl.setAttribute('x', W - padX + 6);
          lbl.setAttribute('y', (p.y + p.h/2 + 4).toFixed(1));
          lbl.setAttribute('text-anchor', 'start');
          lbl.textContent = String(k).length > 14 ? String(k).slice(0, 13) + '…' : k;
          svg.appendChild(lbl);
        });

        host.appendChild(svg);
        _observeResponsive(host, registry['sankey'], slot, ctx);
      }
    });

    /**
     * Adiciona um componente do tipo `typeId` ao canvas (Patch B5-r2).
     * Estratégia: procura primeiro slot vazio. Se não acha, cria nova seção
     * com 1 row 1col com o componente.
     * Retorna o slotId resultante.
     */
    /**
     * Smart hint do B7: gera um texto curto que explica a sugestão automática
     * de defaultConfig para os 4 componentes refinados. Aparece como subtítulo
     * do toast de adição. Retorna null se não há hint relevante.
     */
    function _smartHintFor(typeId, config, ctx){
      if (typeId === 'scatter' && config._smartHint){
        const r = config._smartHint.r;
        const strength = Math.abs(r) >= 0.7 ? 'forte' : Math.abs(r) >= 0.4 ? 'moderada' : 'fraca';
        const sign = r > 0 ? 'positiva' : 'negativa';
        return 'Par com correlação ' + strength + ' ' + sign + ' (r=' + r.toFixed(2) + '): ' +
          SolsticeHumanize.column(config.xColumn, ctx.dictionary) + ' × ' + SolsticeHumanize.column(config.yColumn, ctx.dictionary);
      }
      if (typeId === 'gauge' && config.column && config.target != null){
        const dictCol = ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[config.column];
        const hib = dictCol && dictCol.higherIsBetter;
        const tgtSrc = hib === true ? 'percentil 75 (área de excelência)'
                   : hib === false ? 'percentil 25 (zona segura)'
                   : 'mediana (referência)';
        return 'Range automático via percentis. Meta sugerida: ' + tgtSrc + '.';
      }
      if (typeId === 'boxplot' && config.groupColumn){
        return 'Agrupado por "' + SolsticeHumanize.column(config.groupColumn, ctx.dictionary) + '" (categórica detectada com 2-8 grupos).';
      }
      if (typeId === 'sankey'){
        if (!config.targetColumn) return 'Apenas 1 categórica detectada. Configure destino em ⚙️ quando importar outro CSV.';
        return 'Fluxo: ' + SolsticeHumanize.column(config.sourceColumn, ctx.dictionary) + ' → ' + SolsticeHumanize.column(config.targetColumn, ctx.dictionary);
      }
      return null;
    }

    function addByType(typeId, configOverride){
      const def = registry[typeId];
      if (!def){ SolsticeToast.error('Tipo desconhecido', typeId); return null; }
      const ctx = _ctx();
      const defaults = def.defaultConfig ? def.defaultConfig(ctx) : {};
      // Auditoria 2026 (U-13): grava qual base estava ativa no momento da
      // criação do slot. Componentes futuros usarão essa base mesmo se o
      // usuário trocar a base ativa — bases coexistem no canvas.
      const _activeDsId = SolsticeStore.get('datasets.activeId');
      if (_activeDsId) defaults.datasetId = _activeDsId;
      // Camada 1 polish v4: configOverride permite que SolsticeAsk e Auto-Dashboard
      // criem componentes pré-configurados (ex: KPI com column já escolhida pela pergunta).
      const config = configOverride ? { ...defaults, ...configOverride } : defaults;
      const smartHint = _smartHintFor(typeId, config, ctx);

      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      // Primeiro slot vazio
      for (const s of sections) for (const r of s.rows){
        const idx = r.slots.findIndex(sl => !sl.type || sl.type === 'empty');
        if (idx >= 0){
          r.slots[idx] = { ...r.slots[idx], type: typeId, config };
          SolsticeStore.set('canvas.sections', sections);
          const newSlotId = r.slots[idx].id;
          SolsticeAudit.record({
            action: 'add_component', target: newSlotId, componentId: newSlotId,
            details: { type: typeId, config, source: 'catalog', smartHint }
          });
          SolsticeToast.success(def.name + ' adicionado',
            smartHint || 'Inserido em slot existente');
          // scroll + select após render
          setTimeout(() => {
            const el = document.querySelector('.solstice__comp[data-comp-id="'+newSlotId+'"]');
            if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
            SolsticeProps.select(newSlotId);
          }, 80);
          return newSlotId;
        }
      }
      // Sem slot vazio — cria nova seção
      const newSlotId = SolsticeUtils.uuid();
      const newSec = {
        id: SolsticeUtils.uuid(),
        title: def.name,
        rows: [{
          id: SolsticeUtils.uuid(),
          layout: '1col',
          slots: [{ id: newSlotId, type: typeId, config }]
        }]
      };
      sections.push(newSec);
      SolsticeStore.set('canvas.sections', sections);
      SolsticeAudit.record({
        action: 'add_component', target: newSlotId, componentId: newSlotId,
        details: { type: typeId, config, source: 'catalog', createdSection: true, smartHint }
      });
      SolsticeToast.success(def.name + ' adicionado',
        smartHint || 'Nova seção criada');
      setTimeout(() => {
        const el = document.querySelector('.solstice__comp[data-comp-id="'+newSlotId+'"]');
        if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
        SolsticeProps.select(newSlotId);
      }, 80);
      return newSlotId;
    }

    /* ===== Patch 2 (ADR-134) — DISTRIB-TIME (Distribuição Temporal) =====
       Combina histograma de fundo (barras por bin temporal) com linha de
       série temporal sobreposta. Eixo Y esquerdo: contagem; direito: valor.
       Único visual que mostra ambos simultaneamente. */
    register({
      id:'distrib-time', name:'Distribuição Temporal', icon:'📊',
      description: 'Histograma temporal + linha de valor sobreposta',
      defaultConfig: (ctx) => ({
        xColumn: _firstColOfGroup(ctx, 'temporal'),
        yColumn: _firstColOfGroup(ctx, 'numeric'),
        // Sprint 42 / feedback do usuário ("não consegue 2 eixos"): defaults
        // adicionados pra true dual-axis. yAgg = como agregar yColumn (sum/avg/
        // count). y2Column = SEGUNDA medida na linha (substitui o "count" puro
        // quando setada). Antes era hardcoded sum(yColumn) na linha + count na
        // barra — usuário queria escolher.
        yAgg: 'sum',
        y2Column: null,
        y2Agg: 'sum',
        // Sprint 43 / feedback do usuário ("não consegue agrupamento extra"):
        // groupBy = 3ª dimensão (categórica). Quando setada, splita as barras
        // em séries empilhadas (groupStacked=true) ou agrupadas (false).
        groupBy: null,
        groupStacked: true,
        groupTopN: 6, // limita pra não explodir séries
        bin:'month',
        showLine: true, showDistribution: true
      }),
      render(slot, host, ctx){
        const cfg = slot.config || {};
        if (!cfg.xColumn || !cfg.yColumn){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
            'Selecione coluna temporal (X) e numérica (Y) em ⚙️ Configurar.'));
          return;
        }
        if (typeof Chart === 'undefined'){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, '⏳ Aguardando Chart.js…'));
          return;
        }
        // Sprint 43: helper pra calcular o bin temporal de uma row.
        function _binKey(d){
          if (cfg.bin === 'year') return String(d.getFullYear()); // Auditoria 2026.6: faltava 'year'
          if (cfg.bin === 'month') return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
          if (cfg.bin === 'week'){
            const onejan = new Date(d.getFullYear(), 0, 1);
            const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
            return d.getFullYear() + '-W' + String(week).padStart(2,'0');
          }
          return d.toISOString().slice(0,10);
        }
        // Agrega por bin: contagem + soma + média + (opcional) y2 sum/avg
        const buckets = new Map();
        // Sprint 43: quando groupBy setado, agregamos por bin × categoria
        // pra produzir séries empilhadas. groupSets armazena set de categorias.
        const groupAgg = cfg.groupBy ? new Map() : null; // bin → Map<cat, {sum,count,vals}>
        const groupCatCounts = cfg.groupBy ? new Map() : null; // cat → totalCount (pra Top-N)
        for (const r of ctx.rows){
          const d = new Date(r[cfg.xColumn]);
          if (isNaN(d)) continue;
          const key = _binKey(d);
          const v = SolsticeStats.parseNum(r[cfg.yColumn]);
          const v2 = cfg.y2Column ? SolsticeStats.parseNum(r[cfg.y2Column]) : NaN;
          if (!buckets.has(key)) buckets.set(key, { count:0, sum:0, vals:[], sum2:0, vals2:[] });
          const b = buckets.get(key);
          b.count++;
          if (!isNaN(v)){ b.sum += v; b.vals.push(v); }
          if (!isNaN(v2)){ b.sum2 += v2; b.vals2.push(v2); }
          if (cfg.groupBy){
            const cat = r[cfg.groupBy];
            if (cat == null || cat === '') continue;
            const catKey = String(cat);
            if (!groupAgg.has(key)) groupAgg.set(key, new Map());
            const gmap = groupAgg.get(key);
            if (!gmap.has(catKey)) gmap.set(catKey, { sum:0, count:0, vals:[] });
            const gb = gmap.get(catKey);
            gb.count++;
            if (!isNaN(v)){ gb.sum += v; gb.vals.push(v); }
            groupCatCounts.set(catKey, (groupCatCounts.get(catKey) || 0) + 1);
          }
        }
        const labels = Array.from(buckets.keys()).sort();
        const counts = labels.map(k => buckets.get(k).count);
        // Sprint 42: respeita yAgg (sum/avg/count). Default 'sum' (compatível).
        const yAgg = cfg.yAgg || 'sum';
        const _aggOf = (b, useAgg) => {
          if (useAgg === 'avg') return b.vals.length ? b.sum / b.vals.length : 0;
          if (useAgg === 'count') return b.count;
          if (useAgg === 'max') return b.vals.length ? Math.max.apply(null, b.vals) : 0;
          if (useAgg === 'min') return b.vals.length ? Math.min.apply(null, b.vals) : 0;
          return b.sum;
        };
        const ySeries = labels.map(k => _aggOf(buckets.get(k), yAgg));
        // Y2 (segunda métrica opcional) — dual-axis verdadeiro
        const y2Agg = cfg.y2Agg || 'sum';
        const y2Series = cfg.y2Column ? labels.map(k => {
          const b = buckets.get(k);
          if (y2Agg === 'avg') return b.vals2.length ? b.sum2 / b.vals2.length : 0;
          if (y2Agg === 'count') return b.count;
          if (y2Agg === 'max') return b.vals2.length ? Math.max.apply(null, b.vals2) : 0;
          if (y2Agg === 'min') return b.vals2.length ? Math.min.apply(null, b.vals2) : 0;
          return b.sum2;
        }) : null;
        // Sprint 43: prepara categorias do groupBy (Top-N por contagem).
        const groupTopCats = cfg.groupBy && groupCatCounts ? (() => {
          const sorted = Array.from(groupCatCounts.entries()).sort((a,b) => b[1]-a[1]);
          return sorted.slice(0, cfg.groupTopN || 6).map(([cat]) => cat);
        })() : null;
        // Pega paleta global pra colorir as séries por categoria.
        const gbPalette = (typeof SolsticeStyle !== 'undefined' && SolsticeStyle.paletteColors)
          ? (SolsticeStyle.paletteColors((cfg.style && cfg.style.palette) || 'auto') ||
             ['#4D9FFF','#4ADE80','#FBBF24','#A78BFA','#F87171','#22D3EE','#FB923C','#F472B6'])
          : ['#4D9FFF','#4ADE80','#FBBF24','#A78BFA','#F87171','#22D3EE','#FB923C','#F472B6'];

        const wrap = SolsticeUtils.el('div', { class:'solstice__chart-wrap' });
        const canvas = document.createElement('canvas');
        wrap.appendChild(canvas);
        host.appendChild(wrap);
        requestAnimationFrame(() => {
          const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() || '#4D9FFF';
          const warn   = getComputedStyle(document.documentElement).getPropertyValue('--c-warn').trim() || '#F59E0B';
          const isDark = document.documentElement.getAttribute('data-mode') === 'dark';
          // Auditoria 2026.6 (HUMANIZE): legendas/eixos mostravam o nome cru
          // "qtd_vendas". SolsticeHumanize resolve dicionário + humaniza técnicos.
          const yName = SolsticeHumanize.column(cfg.yColumn, ctx.dictionary);
          const y2Name = cfg.y2Column ? SolsticeHumanize.column(cfg.y2Column, ctx.dictionary) : null;
          const _aggLabel = (a) => ({sum:'soma',avg:'média',count:'contagem',max:'máx',min:'mín'}[a] || a);
          const datasets = [];
          if (cfg.showDistribution !== false){
            // Sprint 43 / feedback do usuário ("não consegue agrupamento extra"):
            // se groupBy setado, splita em múltiplas séries empilhadas/agrupadas.
            // Cada categoria do groupBy vira um dataset com sua cor da paleta.
            if (cfg.groupBy && groupTopCats && groupTopCats.length > 1){
              const gbName = (ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[cfg.groupBy] && ctx.dictionary.columns[cfg.groupBy].friendlyName) || cfg.groupBy;
              groupTopCats.forEach((cat, ci) => {
                const data = labels.map(k => {
                  const gmap = groupAgg.get(k);
                  if (!gmap || !gmap.has(cat)) return 0;
                  return _aggOf(gmap.get(cat), yAgg);
                });
                const color = gbPalette[ci % gbPalette.length];
                datasets.push({
                  type: 'bar',
                  label: String(cat) + ' (' + _aggLabel(yAgg) + ' ' + yName + ')',
                  data,
                  backgroundColor: color + 'CC',
                  borderColor: color,
                  borderWidth: 1,
                  yAxisID: 'yCount',
                  order: 2,
                  stack: cfg.groupStacked !== false ? 'gb' : undefined
                });
              });
              // Tooltip header lista o grupo total
              host.dataset.gbHint = 'agrupado por ' + gbName + ' · top ' + groupTopCats.length;
            } else {
              // Sprint 42: as barras passam a representar a 1ª métrica (yColumn / yAgg).
              // Antes era "frequência (contagem)" fixo — confundia quem queria comparar
              // metrics. yAgg='count' preserva comportamento antigo.
              datasets.push({
                type: 'bar', label: yName + ' (' + _aggLabel(yAgg) + ')', data: ySeries,
                backgroundColor: accent + '40', borderColor: accent + '60', borderWidth: 1,
                yAxisID: 'yCount', order: 2
              });
            }
          }
          if (cfg.showLine !== false){
            // Se há y2Column, a linha mostra y2; senão volta pra exibir a 1ª métrica
            // (compatibilidade — antes era sempre sum(yColumn)).
            const lineLabel = cfg.y2Column ? (y2Name + ' (' + _aggLabel(y2Agg) + ')') : (yName + ' (' + _aggLabel(yAgg) + ')');
            const lineData = cfg.y2Column ? y2Series : ySeries;
            datasets.push({
              type: 'line', label: lineLabel, data: lineData,
              borderColor: warn, backgroundColor: 'transparent',
              tension: 0.25, pointRadius: 3, yAxisID: 'ySum', order: 1
            });
          }
          // Auditoria 2026 (R-03 / A-401): destrói instância anterior.
          if (canvas._chart) { try { canvas._chart.destroy(); } catch(_){} canvas._chart = null; }
          // Sprint 43: stacked X+Y quando groupBy + groupStacked
          const isStacked = cfg.groupBy && groupTopCats && cfg.groupStacked !== false;
          // Auditoria 2026.6 (RÓTULO-DADOS): rótulo de dados também no distrib-time
          // (antes só time-series). Respeita style.dataLabelFormat/Decimals.
          const _dlShow = !!(cfg.style && cfg.style.showDataLabels);
          const _dlFmt = (cfg.style && cfg.style.dataLabelFormat) || 'integer';
          const _dlDec = (cfg.style && cfg.style.dataLabelDecimals != null) ? cfg.style.dataLabelDecimals : 1;
          const _dlLabel = (v) => {
            if (v == null || isNaN(v)) return '';
            if (_dlFmt === 'decimal') return SolsticeLocale.decimal(v, _dlDec);
            if (_dlFmt === 'percent') return (v * 100).toFixed(_dlDec).replace('.', ',') + '%';
            if (_dlFmt === 'compact'){ const a = Math.abs(v); if (a >= 1e6) return (v/1e6).toFixed(1).replace('.', ',') + 'M'; if (a >= 1e3) return (v/1e3).toFixed(1).replace('.', ',') + 'k'; return String(Math.round(v)); }
            return SolsticeLocale.integer(Math.round(v));
          };
          const _dlPlugin = _dlShow ? {
            id: 'solDataLabelsDT',
            afterDatasetsDraw(chart){
              const cc = chart.ctx; cc.save();
              cc.font = '10px var(--font-mono, monospace)';
              cc.fillStyle = isDark ? '#E7E9EE' : '#13161C';
              cc.textAlign = 'center'; cc.textBaseline = 'bottom';
              chart.data.datasets.forEach((ds, di) => {
                const meta = chart.getDatasetMeta(di); if (!meta || meta.hidden) return;
                meta.data.forEach((pt, i) => { const v = ds.data[i]; if (v == null || isNaN(v)) return; cc.fillText(_dlLabel(v), pt.x, pt.y - 4); });
              });
              cc.restore();
            }
          } : null;
          canvas._chart = new Chart(canvas, {
            plugins: _dlPlugin ? [_dlPlugin] : [],
            data: { labels, datasets },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: true, position:'bottom', labels:{ font:{size:10}, boxWidth:14, padding:8 } } },
              scales: {
                x: {
                  stacked: isStacked,
                  grid: { color: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' },
                  ticks:{ color: isDark ? '#B8C4E0' : '#334155', font:{size:10}}
                },
                yCount: {
                  position:'left', beginAtZero:true,
                  stacked: isStacked,
                  grid:{ color: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' },
                  ticks:{ color: isDark ? '#B8C4E0' : '#334155', font:{size:10}},
                  title:{ display:true, text: yName + ' (' + _aggLabel(yAgg) + ')', font:{size:10}, color: isDark ? '#B8C4E0' : '#334155'}
                },
                ySum:   { position:'right', beginAtZero:true, grid: { drawOnChartArea:false }, ticks:{ color: isDark ? '#B8C4E0' : '#334155', font:{size:10}}, title:{ display:true, text: (cfg.y2Column ? y2Name + ' (' + _aggLabel(y2Agg) + ')' : 'Valor'), font:{size:10}, color: isDark ? '#B8C4E0' : '#334155'}}
              },
              // LE-04 (Sprint 3): cross-filter automático
              onClick: (event, elements, chart) => {
                if (!elements || !elements.length) return;
                const label = chart.data.labels[elements[0].index];
                const xCol = cfg.xColumn || cfg.category || cfg.column;
                if (xCol && label != null && typeof SolsticeCrossFilter !== 'undefined'){
                  SolsticeCrossFilter.activate(xCol, label, { bin: cfg.bin });
                }
              },
              onHover: (event, elements) => {
                event.native && event.native.target && (event.native.target.style.cursor = elements.length ? 'pointer' : 'default');
              }
            }
          });
        });
      }
    });

    /* ===== Patch 2 (ADR-137) — DEMAND-LIST (Lista de Demandas) =====
       Consolida insights/outliers/metas em cards acionáveis tipo Kanban.
       Cada item: ⚠️ título · valor atual/meta · variação · botões [Investigar] [Resolver]
       Resolved IDs em slot.config.resolvedIds. */
    register({
      id:'demand-list', name:'Lista de Demandas', icon:'🚨',
      description: 'Insights + outliers + metas em formato acionável',
      defaultConfig: (ctx) => ({
        sortBy: 'severity',       // 'severity' | 'date' | 'category'
        filter: 'all',            // 'all' | 'critical' | 'positive' | 'informational'
        maxItems: 10,
        resolvedIds: []
      }),
      render(slot, host, ctx){
        const cfg = slot.config || {};
        const resolved = new Set(cfg.resolvedIds || []);
        const items = [];

        // 1) Insights (B8)
        if (typeof SolsticeInsights !== 'undefined'){
          const ins = SolsticeInsights.list() || SolsticeInsights.compute() || [];
          ins.forEach(i => {
            items.push({
              id: i.id || ('ins-' + Math.random().toString(36).slice(2,8)),
              icon: i.icon || '💡',
              title: i.title || 'Insight',
              text: i.text || '',
              severity: i.severity || 'info',  // success/warn/error/info
              score: i.score || 50,
              category: 'insight',
              date: new Date().toISOString()
            });
          });
        }

        // 2) Outliers significativos em cada KPI do canvas
        const sections = SolsticeStore.get('canvas.sections') || [];
        for (const sec of sections) for (const r of sec.rows) for (const sl of r.slots){
          if (sl.type === 'kpi' && sl.config && sl.config.column){
            const col = sl.config.column;
            const vals = ctx.rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
            const outs = SolsticeStats.outliersIQR(vals).indices || [];  // OUTLIER-SHAPE 2026.6
            if (outs.length && outs.length / vals.length > 0.05){
              items.push({
                id: 'outl-' + sl.id,
                icon: '⚠️',
                title: 'Outliers em ' + ((ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[col] && ctx.dictionary.columns[col].friendlyName) || col),
                text: outs.length + ' valores fora do esperado (' + (outs.length/vals.length*100).toFixed(0) + '% do total).',
                severity: 'warn',
                score: Math.min(90, 60 + outs.length / vals.length * 100),
                category: 'outlier',
                date: new Date().toISOString()
              });
            }
            // 3) Metas não atingidas
            if (sl.config.target && sl.config.target.value != null){
              const tgt = parseFloat(sl.config.target.value);
              const agg = sl.config.agg || 'sum';
              const curr = agg === 'sum' ? vals.reduce((a,b)=>a+b,0) : agg === 'avg' || agg === 'mean' ? (vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0) : agg === 'max' ? SolsticeStats.max(vals) : agg === 'min' ? SolsticeStats.min(vals) : vals.length;
              const meta = ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[col];
              const hib = meta && meta.higherIsBetter;
              const hit = (hib === false) ? curr <= tgt : curr >= tgt;
              if (!hit){
                items.push({
                  id: 'target-' + sl.id,
                  icon: '🎯',
                  title: 'Meta não atingida em ' + ((meta && meta.friendlyName) || col),
                  text: 'Atual: ' + curr.toLocaleString('pt-BR') + ' · Meta: ' + tgt.toLocaleString('pt-BR'),
                  severity: 'error',
                  score: 95,
                  category: 'target',
                  date: new Date().toISOString()
                });
              }
            }
          }
        }

        // Filtra resolvidos
        let visible = items.filter(it => !resolved.has(it.id));
        // Filtro do config
        if (cfg.filter === 'critical')      visible = visible.filter(it => it.severity === 'error');
        else if (cfg.filter === 'positive') visible = visible.filter(it => it.severity === 'success');
        else if (cfg.filter === 'informational') visible = visible.filter(it => it.severity === 'info');
        // Ordenação
        if (cfg.sortBy === 'severity'){
          const sevW = { error: 0, warn: 1, info: 2, success: 3 };
          visible.sort((a,b) => (sevW[a.severity] - sevW[b.severity]) || (b.score - a.score));
        } else if (cfg.sortBy === 'date'){
          visible.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
        }
        visible = visible.slice(0, cfg.maxItems || 10);

        const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:8px;padding:8px;max-height:480px;overflow-y:auto;' });
        if (!visible.length){
          wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, '✅ Nenhuma demanda no momento.'));
          host.appendChild(wrap);
          return;
        }
        const sevColor = { error:'var(--c-error)', warn:'var(--c-warn)', info:'var(--c-accent)', success:'var(--c-success)' };
        visible.forEach(it => {
          const card = SolsticeUtils.el('div', {
            style:'border-left:3px solid ' + (sevColor[it.severity] || 'var(--c-border)') +
                  ';background:var(--c-surface-2);border-radius:6px;padding:8px 10px;'
          });
          const head = SolsticeUtils.el('div', { style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;' });
          head.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;font-size:12px;color:var(--c-text);' },
            it.icon + ' ' + it.title));
          head.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);' },
            new Date(it.date).toLocaleDateString('pt-BR')));
          card.appendChild(head);
          if (it.text) card.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-text-2);line-height:1.5;margin-bottom:6px;' }, it.text));
          const actions = SolsticeUtils.el('div', { style:'display:flex;gap:4px;' });
          // Sprint 36b / EV-COMP-07: "Investigar" agora tem ação real.
          //   - category 'outlier'/'target': scroll até o KPI fonte + select
          //   - category 'insight': scroll até o painel Insights
          //   - fallback: abre dataset preview pra inspecionar
          actions.appendChild(SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--ghost',
            style:'font-size:11px;padding:2px 8px;',
            title: 'Pular para o componente/painel relacionado a esta demanda',
            onclick: () => {
              // Tenta achar slot fonte pelo ID (formato 'outl-<slotId>' / 'target-<slotId>')
              const m = it.id.match(/^(outl|target)-(.+)$/);
              if (m){
                const slotId = m[2];
                const compEl = document.querySelector('.solstice__comp[data-comp-id="' + slotId + '"]');
                if (compEl){
                  compEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Highlight breve
                  compEl.style.transition = 'outline 0.3s';
                  compEl.style.outline = '3px solid var(--c-accent)';
                  setTimeout(() => { compEl.style.outline = ''; }, 1800);
                  try { SolsticeProps.select(slotId); } catch(_){}
                  SolsticeToast.info('Componente em foco', it.title);
                  return;
                }
              }
              // Insight: scroll até #insights
              if (it.category === 'insight'){
                const insightsEl = document.querySelector('.solstice__insights');
                if (insightsEl){
                  insightsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  insightsEl.style.transition = 'outline 0.3s';
                  insightsEl.style.outline = '3px solid var(--c-accent)';
                  setTimeout(() => { insightsEl.style.outline = ''; }, 1800);
                  SolsticeToast.info('Painel Insights em foco', it.title);
                  return;
                }
              }
              // Fallback: abre preview do dataset
              try {
                if (SolsticeEditor && SolsticeEditor.openPreview) {
                  SolsticeEditor.openPreview();
                  return;
                }
              } catch(_){}
              SolsticeToast.info('Investigar', it.text || 'Explore o componente relacionado para ver mais detalhes.');
            }
          }, '🔎 Investigar'));
          actions.appendChild(SolsticeUtils.el('button', {
            class:'solstice__btn',
            style:'font-size:11px;padding:2px 8px;',
            onclick: () => {
              const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
              for (const s of sections) for (const r of s.rows){
                const sl = r.slots.find(x => x.id === slot.id);
                if (sl){
                  sl.config = sl.config || {};
                  sl.config.resolvedIds = (sl.config.resolvedIds || []).concat(it.id);
                  SolsticeStore.set('canvas.sections', sections);
                  SolsticeToast.success('Marcado como resolvido', it.title);
                  return;
                }
              }
            }
          }, '✓ Resolver'));
          card.appendChild(actions);
          wrap.appendChild(card);
        });
        host.appendChild(wrap);
      }
    });

    /* ===== Patch Corretivo (ADR-149) — PIVOT (Matriz / Tabela Cruzada) ===== */
    register({
      id:'pivot', name:'Matriz', icon:'🔢',
      description: 'Tabela cruzada (linhas × colunas × medida agregada)',
      // Sprint 36 / EV-COMP-05: defaultConfig agora prioriza dimensões com
      // BAIXA CARDINALIDADE pra não cair em "matriz com 90% zeros" (era o caso
      // com regiao(5) × uf(27) = 135 células ~ todas zero). Estratégia: ordena
      // categóricas por cardinalidade crescente e pega as 2 menores com >= 2
      // valores distintos. Considera no máximo 12 valores por dimensão pra
      // matriz caber visualmente.
      defaultConfig: (ctx) => {
        const cats = (ctx.columns || []).filter(c => {
          const tg = SolsticeTypes.group((ctx.types[c] || {}).type);
          return tg === 'categorical';
        });
        const nums = (ctx.columns || []).filter(c => {
          const tg = SolsticeTypes.group((ctx.types[c] || {}).type);
          return tg === 'numeric';
        });
        // Conta cardinalidade de cada categórica (no sample de 500 linhas pra perf)
        const sample = (ctx.rows || []).slice(0, 500);
        const cardOf = c => new Set(sample.map(r => String(r[c]))).size;
        const sortedByCard = cats
          .map(c => ({ col: c, card: cardOf(c) }))
          .filter(o => o.card >= 2 && o.card <= 12)
          .sort((a, b) => a.card - b.card);
        const row = sortedByCard[0] && sortedByCard[0].col;
        const col = sortedByCard[1] && sortedByCard[1].col;
        return {
          rowDimension: row || cats[0] || null,
          colDimension: col || cats[1] || cats[0] || null,
          valueColumn: nums[0] || null,
          aggregation: 'sum',
          showTotals: true,
          showHeatmap: false
        };
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        if (!cfg.rowDimension || !cfg.colDimension || !cfg.valueColumn){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
            'Selecione 3 colunas em ⚙️: dimensão (linhas) · dimensão (colunas) · medida.'));
          return;
        }
        const agg = cfg.aggregation || 'sum';
        const rowVals = Array.from(new Set(ctx.rows.map(r => String(r[cfg.rowDimension])).filter(v => v !== 'undefined'))).sort();
        const colVals = Array.from(new Set(ctx.rows.map(r => String(r[cfg.colDimension])).filter(v => v !== 'undefined'))).sort();
        // Cálculo das células
        const cells = {};
        rowVals.forEach(rv => {
          cells[rv] = {};
          colVals.forEach(cv => {
            const vs = ctx.rows
              .filter(r => String(r[cfg.rowDimension]) === rv && String(r[cfg.colDimension]) === cv)
              .map(r => SolsticeStats.parseNum(r[cfg.valueColumn]))
              .filter(v => !isNaN(v));
            const fn = SolsticeStats[agg] || SolsticeStats.sum;
            cells[rv][cv] = vs.length ? fn(vs) : 0;
          });
        });
        // Min/max para heatmap
        let allVals = [];
        rowVals.forEach(rv => colVals.forEach(cv => allVals.push(cells[rv][cv])));
        const mn = Math.min(...allVals, 0), mx = Math.max(...allVals, 1);
        function _heatColor(v){
          if (!cfg.showHeatmap || mx === mn) return '';
          const t = (v - mn) / (mx - mn);
          const alpha = (0.1 + t * 0.5).toFixed(2);
          return 'background:color-mix(in srgb, var(--c-accent) ' + Math.round(t * 50 + 10) + '%, transparent);';
        }
        function _fmt(v){
          if (v == null || isNaN(v)) return '—';
          return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        }
        // Auditoria 2026.6 (PIVOT-EMPTY): valores nulos/vazios viravam rótulo de
        // linha/coluna em branco. Mostra "(vazio)" pra ficar explícito.
        function _label(v){ return (v == null || v === '' || v === 'null' || v === 'undefined') ? '(vazio)' : v; }
        // Render tabela
        const wrap = SolsticeUtils.el('div', { style:'overflow:auto;max-height:480px;padding:8px;' });
        const table = SolsticeUtils.el('table', {
          class:'solstice__pivot',
          style:'border-collapse:collapse;font-size:11px;font-family:var(--font-mono);width:100%;'
        });
        // Header
        const thead = SolsticeUtils.el('thead');
        const trh = SolsticeUtils.el('tr');
        trh.appendChild(SolsticeUtils.el('th', { style:'padding:6px 10px;text-align:left;border-bottom:2px solid var(--c-border);background:var(--c-surface-2);position:sticky;top:0;z-index:2;' }, ''));
        colVals.forEach(cv => trh.appendChild(SolsticeUtils.el('th', { style:'padding:6px 10px;text-align:right;border-bottom:2px solid var(--c-border);background:var(--c-surface-2);position:sticky;top:0;z-index:2;font-weight:600;' }, _label(cv))));
        if (cfg.showTotals) trh.appendChild(SolsticeUtils.el('th', { style:'padding:6px 10px;text-align:right;border-bottom:2px solid var(--c-border);background:var(--c-surface-3);position:sticky;top:0;z-index:2;font-weight:700;color:var(--c-accent);' }, 'TOTAL'));
        thead.appendChild(trh);
        table.appendChild(thead);
        // Body
        const tbody = SolsticeUtils.el('tbody');
        rowVals.forEach(rv => {
          const tr = SolsticeUtils.el('tr');
          tr.appendChild(SolsticeUtils.el('td', { style:'padding:4px 10px;font-weight:600;border-bottom:1px solid var(--c-border);background:var(--c-surface-2);' }, _label(rv)));
          let rowTotal = 0;
          colVals.forEach(cv => {
            const v = cells[rv][cv] || 0;
            rowTotal += v;
            tr.appendChild(SolsticeUtils.el('td', { style:'padding:4px 10px;text-align:right;border-bottom:1px solid var(--c-border);' + _heatColor(v) }, _fmt(v)));
          });
          if (cfg.showTotals) tr.appendChild(SolsticeUtils.el('td', { style:'padding:4px 10px;text-align:right;border-bottom:1px solid var(--c-border);font-weight:700;background:var(--c-surface-3);color:var(--c-accent);' }, _fmt(rowTotal)));
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        // Footer (totais por coluna)
        if (cfg.showTotals){
          const tfoot = SolsticeUtils.el('tfoot');
          const trf = SolsticeUtils.el('tr');
          trf.appendChild(SolsticeUtils.el('td', { style:'padding:6px 10px;font-weight:700;border-top:2px solid var(--c-border);background:var(--c-surface-3);color:var(--c-accent);' }, 'TOTAL'));
          let grandTotal = 0;
          colVals.forEach(cv => {
            const colTotal = rowVals.reduce((a, rv) => a + (cells[rv][cv] || 0), 0);
            grandTotal += colTotal;
            trf.appendChild(SolsticeUtils.el('td', { style:'padding:6px 10px;text-align:right;font-weight:700;border-top:2px solid var(--c-border);background:var(--c-surface-3);color:var(--c-accent);' }, _fmt(colTotal)));
          });
          trf.appendChild(SolsticeUtils.el('td', { style:'padding:6px 10px;text-align:right;font-weight:800;border-top:2px solid var(--c-accent);background:var(--c-accent);color:#fff;' }, _fmt(grandTotal)));
          tfoot.appendChild(trf);
          table.appendChild(tfoot);
        }
        wrap.appendChild(table);
        host.appendChild(wrap);
      }
    });

    /* ===== Patch Corretivo (ADR-150) — SLIDER (Filtro Range) ===== */
    register({
      id:'slider', name:'Filtro Range', icon:'🎚️',
      description: 'Slider de min/max para filtrar dados localmente',
      defaultConfig: (ctx) => {
        const nums = (ctx.columns || []).filter(c => SolsticeTypes.group((ctx.types[c] || {}).type) === 'numeric');
        return { column: nums[0] || null, minVal: null, maxVal: null };
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        if (!cfg.column){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Selecione uma coluna numérica em ⚙️.'));
          return;
        }
        const vals = ctx.rows.map(r => SolsticeStats.parseNum(r[cfg.column])).filter(v => !isNaN(v));
        if (!vals.length){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Sem valores numéricos.'));
          return;
        }
        const [dmin, dmax] = SolsticeStats.minMax(vals); /* code review 2026: minMax safe */
        const curMin = cfg.minVal != null ? cfg.minVal : dmin;
        const curMax = cfg.maxVal != null ? cfg.maxVal : dmax;
        const step = (dmax - dmin) / 100 || 1;
        const friendly = SolsticeHumanize.column(cfg.column, ctx.dictionary);  // Auditoria 2026.6 (HUMANIZE): era cfg.column cru ("QTD_VENDAS"); agora "Qtd Vendas"

        const wrap = SolsticeUtils.el('div', { style:'padding:16px;display:flex;flex-direction:column;gap:12px;' });
        wrap.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;' }, friendly));

        const display = SolsticeUtils.el('div', { style:'display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:14px;color:var(--c-text);' });
        const dminEl = SolsticeUtils.el('span', null, Number(curMin).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
        const dmaxEl = SolsticeUtils.el('span', null, Number(curMax).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
        display.appendChild(dminEl);
        display.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-muted);' }, ' → '));
        display.appendChild(dmaxEl);
        wrap.appendChild(display);

        const minInput = SolsticeUtils.el('input', { type:'range', min:String(dmin), max:String(dmax), step:String(step), value:String(curMin), style:'width:100%;accent-color:var(--c-accent);' });
        const maxInput = SolsticeUtils.el('input', { type:'range', min:String(dmin), max:String(dmax), step:String(step), value:String(curMax), style:'width:100%;accent-color:var(--c-accent);' });
        wrap.appendChild(minInput);
        wrap.appendChild(maxInput);

        function _commit(){
          const a = parseFloat(minInput.value);
          const b = parseFloat(maxInput.value);
          const lo = Math.min(a, b), hi = Math.max(a, b);
          dminEl.textContent = Number(lo).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
          dmaxEl.textContent = Number(hi).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
          // Aplica filtro global
          if (typeof SolsticeFilters !== 'undefined') SolsticeFilters.set(cfg.column, { min: lo, max: hi });
          // Atualiza config
          const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
          for (const s of sections) for (const r of s.rows){
            const sl = r.slots.find(x => x.id === slot.id);
            if (sl){ sl.config = Object.assign({}, sl.config, { minVal: lo, maxVal: hi }); SolsticeStore.set('canvas.sections', sections); return; }
          }
        }
        minInput.addEventListener('input', _commit);
        maxInput.addEventListener('input', _commit);

        const meta = SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);font-family:var(--font-mono);' },
          'Dataset: ' + Number(dmin).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' — ' + Number(dmax).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
        wrap.appendChild(meta);
        host.appendChild(wrap);
      }
    });

    /* ===== Patch Corretivo (ADR-151) — BIG NUMBER ===== */
    register({
      id:'bignum', name:'Big Number', icon:'🔢',
      description: 'Valor grande centralizado com sparkline mini',
      defaultConfig: (ctx) => {
        const nums = (ctx.columns || []).filter(c => SolsticeTypes.group((ctx.types[c] || {}).type) === 'numeric');
        return { column: nums[0] || null, agg: 'sum' };
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        if (!cfg.column){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Selecione coluna numérica.'));
          return;
        }
        const vs = ctx.rows.map(r => SolsticeStats.parseNum(r[cfg.column])).filter(v => !isNaN(v));
        if (!vs.length){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Sem valores válidos.'));
          return;
        }
        const fn = SolsticeStats[cfg.agg || 'sum'] || SolsticeStats.sum;
        const val = fn(vs);
        const meta = (ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[cfg.column]) || {};
        const unit = meta.unit;
        let txt = Number(val).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        if (unit === 'BRL' || unit === 'currency') txt = 'R$ ' + txt;
        else if (unit === 'pct' || unit === '%') txt = txt + '%';
        // Camada Style v2: BigNum lê style.bignumGiant e style.showSparkline
        const bigStyle = cfg.style || {};
        const isGiant = bigStyle.bignumGiant === true;
        const showSpark = (bigStyle.showSparkline === true) || (cfg.showSparkline === true);
        const fontSize = isGiant ? '88px' : '48px';
        const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;height:100%;gap:8px;' });
        wrap.appendChild(SolsticeUtils.el('div', { style:'font-size:' + fontSize + ';font-weight:700;color:var(--comp-value-color, var(--c-text));font-family:var(--comp-font-family, var(--font-display));letter-spacing:-0.02em;line-height:1;' }, txt));
        wrap.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;' }, (meta.friendlyName || cfg.column)));
        if (showSpark){
          const sparkBox = SolsticeUtils.el('div', { style:'width:60%;max-width:200px;opacity:0.6;' });
          sparkBox.appendChild(_sparkline(vs.slice(0, 80)));
          wrap.appendChild(sparkBox);
        }
        host.appendChild(wrap);
      }
    });

    /* ===== Patch Corretivo (ADR-152) — FUNNEL (Funil de Conversão) ===== */
    register({
      id:'funnel', name:'Funil de Conversão', icon:'🔻',
      description: 'Trapézios decrescentes representando etapas de conversão',
      // Sprint 36 / EV-COMP-04: defaultConfig agora prioriza coluna que pareça
      // ETAPA (nome contém "etapa/stage/funil/status/estagio") sobre primeira
      // categórica genérica. Evita Funnel ser auto-configurado com REGIÃO
      // (categoria paralela, semanticamente errado).
      defaultConfig: (ctx) => {
        const dims = (ctx.columns || []).filter(c => SolsticeTypes.group((ctx.types[c] || {}).type) === 'categorical');
        const nums = (ctx.columns || []).filter(c => SolsticeTypes.group((ctx.types[c] || {}).type) === 'numeric');
        // Prefere coluna com nome funil-like
        const funnelLike = dims.find(c => /etapa|stage|funil|status|estagio|fase|step/i.test(c));
        return { stageColumn: funnelLike || dims[0] || null, valueColumn: nums[0] || null, mode: 'absolute' };
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        if (!cfg.stageColumn || !cfg.valueColumn){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Selecione etapas + medida em ⚙️.'));
          return;
        }
        // Sprint 36 / EV-COMP-04: warning quando stageColumn parece categoria
        // paralela (regiao/canal/categoria/uf), não etapa de funil real.
        const stageColLower = String(cfg.stageColumn).toLowerCase();
        const isFunnelLike = /etapa|stage|funil|status|estagio|fase|step/i.test(stageColLower);
        const isParallelLike = /regiao|região|uf|estado|canal|categoria|tipo|segmento/i.test(stageColLower);
        if (isParallelLike && !isFunnelLike){
          const warn = SolsticeUtils.el('div', {
            style: 'padding:8px 12px;margin-bottom:10px;background:color-mix(in srgb,var(--c-warn) 12%, transparent);border-left:3px solid var(--c-warn);border-radius:var(--rad-sm);font-size:11px;color:var(--c-text-2);line-height:1.4;'
          });
          warn.appendChild(SolsticeUtils.el('strong', { style:'color:var(--c-warn);' }, '⚠️ '));
          warn.appendChild(document.createTextNode(
            'Funil clássico mostra ESTÁGIOS SEQUENCIAIS (ex: lead → qualificação → proposta → fechamento), não categorias paralelas como "' + cfg.stageColumn + '". ' +
            'Considere usar uma coluna de etapas ou trocar pra Comparação de Categorias.'
          ));
          host.appendChild(warn);
        }
        // Agrega por etapa (mantém ordem de aparição)
        const stageOrder = [];
        const totals = new Map();
        for (const r of ctx.rows){
          const stage = String(r[cfg.stageColumn]);
          const v = SolsticeStats.parseNum(r[cfg.valueColumn]);
          if (isNaN(v)) continue;
          if (!totals.has(stage)){ totals.set(stage, 0); stageOrder.push(stage); }
          totals.set(stage, totals.get(stage) + v);
        }
        if (!stageOrder.length){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Sem etapas válidas.'));
          return;
        }
        // Ordena descendente por valor para visual de funil
        stageOrder.sort((a, b) => totals.get(b) - totals.get(a));
        const max = totals.get(stageOrder[0]);
        const NS = 'http://www.w3.org/2000/svg';
        const W = 400, H = stageOrder.length * 50 + 20;
        const wrap = SolsticeUtils.el('div', { style:'padding:12px;display:flex;flex-direction:column;gap:0;' });
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('width', '100%');
        svg.style.cssText = 'max-height:' + H + 'px;';
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() || '#4D9FFF';
        stageOrder.forEach((stage, i) => {
          const v = totals.get(stage);
          const ratio = max > 0 ? v / max : 0;
          const w = ratio * (W - 40);
          const x = (W - w) / 2;
          const y = i * 50 + 8;
          // Trapézio: largura decresce
          const nextRatio = i < stageOrder.length - 1 ? totals.get(stageOrder[i+1]) / max : ratio * 0.85;
          const wNext = nextRatio * (W - 40);
          const xNext = (W - wNext) / 2;
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('d', 'M' + x + ',' + y + ' L' + (x + w) + ',' + y + ' L' + (xNext + wNext) + ',' + (y + 40) + ' L' + xNext + ',' + (y + 40) + ' Z');
          path.setAttribute('fill', accent);
          path.style.opacity = (1 - i * 0.12).toFixed(2);
          svg.appendChild(path);
          // Texto
          const text = document.createElementNS(NS, 'text');
          text.setAttribute('x', '20');
          text.setAttribute('y', String(y + 25));
          text.setAttribute('fill', 'var(--c-text)');
          text.setAttribute('font-size', '12');
          text.setAttribute('font-weight', '600');
          text.textContent = stage + ': ' + Number(v).toLocaleString('pt-BR');
          svg.appendChild(text);
          // % conversão
          if (i > 0){
            const prev = totals.get(stageOrder[i-1]);
            const pct = prev > 0 ? (v / prev) * 100 : 0;
            const ptext = document.createElementNS(NS, 'text');
            ptext.setAttribute('x', String(W - 20));
            ptext.setAttribute('y', String(y + 25));
            ptext.setAttribute('text-anchor', 'end');
            ptext.setAttribute('fill', 'var(--c-muted)');
            ptext.setAttribute('font-size', '10');
            ptext.textContent = pct.toFixed(1) + '%';
            svg.appendChild(ptext);
          }
        });
        wrap.appendChild(svg);
        host.appendChild(wrap);
      }
    });

    /* ===== Patch Corretivo (ADR-153) — EVENT TIMELINE ===== */
    register({
      id:'event-timeline', name:'Linha do Tempo', icon:'📅',
      description: 'Eventos posicionados no eixo temporal, coloridos por categoria',
      defaultConfig: (ctx) => {
        const temps = (ctx.columns || []).filter(c => SolsticeTypes.group((ctx.types[c] || {}).type) === 'temporal');
        const cats  = (ctx.columns || []).filter(c => SolsticeTypes.group((ctx.types[c] || {}).type) === 'categorical');
        return { dateColumn: temps[0] || null, labelColumn: cats[0] || null, valueColumn: null };
      },
      render(slot, host, ctx){
        const cfg = slot.config || {};
        if (!cfg.dateColumn || !cfg.labelColumn){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Selecione coluna temporal + categoria.'));
          return;
        }
        const events = [];
        for (const r of ctx.rows){
          const d = new Date(r[cfg.dateColumn]);
          if (isNaN(d)) continue;
          events.push({ date: d, label: String(r[cfg.labelColumn]), value: cfg.valueColumn ? SolsticeStats.parseNum(r[cfg.valueColumn]) : null });
        }
        if (!events.length){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' }, 'Sem eventos válidos.'));
          return;
        }
        events.sort((a, b) => a.date - b.date);
        const tMin = events[0].date.getTime();
        const tMax = events[events.length - 1].date.getTime();
        const span = (tMax - tMin) || 1;
        const cats = Array.from(new Set(events.map(e => e.label))).sort();
        // FIX1 v4: paleta global (não hardcoded)
        const PALETTE = (typeof SolsticeStyle !== 'undefined' && SolsticeStyle.paletteColors)
          ? (SolsticeStyle.paletteColors('auto') || ['#4D9FFF', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'])
          : ['#4D9FFF', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
        const colorOf = (lbl) => PALETTE[cats.indexOf(lbl) % PALETTE.length];

        // Sprint 36b / EV-COMP-08: SWIMLANES por categoria — eventos amontoados
        // no eixo X agora se separam verticalmente por categoria. Antes 200
        // pontos viraram blob ilegível. Agora cada categoria tem sua "raia".
        const NS = 'http://www.w3.org/2000/svg';
        const PAD = 30;
        // Auditoria 2026.6 (TIMELINE-LABEL): margem esquerda maior só pros rótulos
        // de categoria (eram cortados — "Centro-Oeste" virava "n-Oe…").
        const PAD_L = 64;
        const laneCount = Math.min(cats.length, 8);   // cap em 8 raias visualmente
        const laneH = 24;
        const W = 600;
        const H = Math.max(120, 60 + laneCount * laneH + 40);  // dinâmico
        const wrap = SolsticeUtils.el('div', { style:'padding:12px;' });
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('width', '100%');
        // Linhas de cada raia (uma por categoria, até 8)
        cats.slice(0, laneCount).forEach((cat, idx) => {
          const y = 30 + idx * laneH + laneH/2;
          const line = document.createElementNS(NS, 'line');
          line.setAttribute('x1', String(PAD_L)); line.setAttribute('y1', String(y));
          line.setAttribute('x2', String(W - PAD)); line.setAttribute('y2', String(y));
          line.setAttribute('stroke', 'var(--c-border)'); line.setAttribute('stroke-width', '1');
          line.style.opacity = '0.3';
          svg.appendChild(line);
          // Label da raia à esquerda
          const lbl = document.createElementNS(NS, 'text');
          lbl.setAttribute('x', String(PAD_L - 6));
          lbl.setAttribute('y', String(y + 3));
          lbl.setAttribute('text-anchor', 'end');
          lbl.setAttribute('fill', colorOf(cat));
          lbl.setAttribute('font-size', '9');
          lbl.setAttribute('font-weight', '600');
          lbl.textContent = String(cat).length > 11 ? String(cat).slice(0, 10) + '…' : cat;
          svg.appendChild(lbl);
        });
        // Eventos posicionados pela raia da sua categoria
        events.forEach(e => {
          const x = PAD_L + ((e.date.getTime() - tMin) / span) * (W - PAD_L - PAD);
          const laneIdx = cats.indexOf(e.label);
          const y = laneIdx < laneCount ? 30 + laneIdx * laneH + laneH/2 : H/2;
          const r = e.value != null ? Math.min(8, Math.max(3, e.value / 10)) : 4;
          const circle = document.createElementNS(NS, 'circle');
          circle.setAttribute('cx', String(x)); circle.setAttribute('cy', String(y));
          circle.setAttribute('r', String(r));
          circle.setAttribute('fill', colorOf(e.label));
          circle.style.opacity = '0.8';
          const title = document.createElementNS(NS, 'title');
          title.textContent = e.label + ' · ' + e.date.toLocaleDateString('pt-BR') + (e.value != null ? ' · ' + e.value : '');
          circle.appendChild(title);
          svg.appendChild(circle);
        });
        // Datas extremas
        [['x', PAD_L, tMin], ['x', W - PAD, tMax]].forEach(([_, x, t], i) => {
          const txt = document.createElementNS(NS, 'text');
          txt.setAttribute('x', String(x));
          txt.setAttribute('y', String(H - 8));
          txt.setAttribute('text-anchor', i === 0 ? 'start' : 'end');
          txt.setAttribute('fill', 'var(--c-muted)');
          txt.setAttribute('font-size', '10');
          txt.textContent = new Date(t).toLocaleDateString('pt-BR');
          svg.appendChild(txt);
        });
        wrap.appendChild(svg);
        // Legenda
        const legend = SolsticeUtils.el('div', { style:'display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:10px;' });
        cats.forEach(c => {
          const item = SolsticeUtils.el('span', { style:'display:inline-flex;align-items:center;gap:4px;color:var(--c-text-2);' });
          const dot = SolsticeUtils.el('span', { style:'width:8px;height:8px;border-radius:50%;background:' + colorOf(c) + ';' });
          item.appendChild(dot);
          item.appendChild(SolsticeUtils.el('span', null, c));
          legend.appendChild(item);
        });
        wrap.appendChild(legend);
        host.appendChild(wrap);
      }
    });

    /* ===== Bloco 13 — Diferencial #4 (ADR-147): METRIC-GRAPH (Grafo de Métricas) =====
       Visualiza o DAG das medidas calculadas + dependências entre componentes
       do canvas. Cada nó = coluna / medida / componente. Setas = dependências.
       SVG renderizado com layout em camadas (sem libs externas). */
    register({
      id:'metric-graph', name:'Grafo de Métricas', icon:'🕸️',
      description: 'DAG das medidas calculadas + dependências entre componentes',
      defaultConfig: (ctx) => ({
        showRawColumns: false,    // se true, mostra também colunas-base
        showComponents: true      // se true, mostra componentes do canvas como nós-folha
      }),
      render(slot, host, ctx){
        const cfg = slot.config || {};
        const measures = (ctx.calculatedMeasures) || ((SolsticeStore.get('ingest') || {}).calculatedMeasures || {});
        const measureNames = Object.keys(measures);
        const sections = SolsticeStore.get('canvas.sections') || [];

        // Constrói nós e arestas
        const nodes = new Map();  // id → { id, kind, label }
        const edges = [];          // { from, to }

        function addNode(id, kind, label){
          if (!nodes.has(id)) nodes.set(id, { id, kind, label });
        }

        // 1) Medidas calculadas
        measureNames.forEach(m => {
          addNode('m:' + m, 'measure', m);
          const deps = SolsticeFormula.dependencies(measures[m].formula);
          deps.forEach(d => {
            if (measures[d]){
              addNode('m:' + d, 'measure', d);
              edges.push({ from: 'm:' + d, to: 'm:' + m });
            } else {
              addNode('c:' + d, 'column', d);
              edges.push({ from: 'c:' + d, to: 'm:' + m });
            }
          });
        });

        // 2) Componentes do canvas
        if (cfg.showComponents){
          for (const sec of sections) for (const r of sec.rows) for (const sl of r.slots){
            if (!sl.type || sl.type === 'empty' || sl.type === 'markdown') continue;
            const def = SolsticeComponents.get(sl.type);
            if (!def) continue;
            const nid = 'comp:' + sl.id;
            const label = (def.icon || '') + ' ' + (def.name || sl.type);
            addNode(nid, 'component', label);
            // Dependências: cada field do config aponta para coluna/medida
            const fields = ['column','xColumn','yColumn','valueColumn','groupColumn','sourceColumn','targetColumn','dateColumn','sizeColumn'];
            const c = sl.config || {};
            fields.forEach(f => {
              const val = c[f];
              if (!val) return;
              if (measures[val]){ addNode('m:' + val, 'measure', val); edges.push({ from: 'm:' + val, to: nid }); }
              else { addNode('c:' + val, 'column', val); edges.push({ from: 'c:' + val, to: nid }); }
            });
          }
        }

        // 3) Filtra colunas brutas se config diz
        if (!cfg.showRawColumns){
          // Mantém apenas colunas que aparecem como source ou target de algo
          const referenced = new Set();
          edges.forEach(e => { referenced.add(e.from); referenced.add(e.to); });
          for (const [id, n] of nodes){
            if (n.kind === 'column' && !referenced.has(id)) nodes.delete(id);
          }
        }

        if (!nodes.size){
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty', style:'text-align:center;padding:24px;' },
            '🕸️ Nenhuma medida calculada ou componente ainda. Crie medidas em Dados → 🧮 Nova ou adicione componentes ao canvas.'));
          return;
        }

        // Layout topológico em camadas (Sugiyama simplificado)
        function _layout(){
          // BFS de nós-raiz (sem incoming) para atribuir camadas
          const inDeg = new Map();
          for (const id of nodes.keys()) inDeg.set(id, 0);
          edges.forEach(e => inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1));
          const layers = new Map();  // id → layer
          const queue = [];
          for (const [id, deg] of inDeg){ if (deg === 0){ layers.set(id, 0); queue.push(id); } }
          while (queue.length){
            const n = queue.shift();
            const L = layers.get(n);
            edges.filter(e => e.from === n).forEach(e => {
              const cur = layers.get(e.to);
              if (cur === undefined || cur <= L){ layers.set(e.to, L + 1); queue.push(e.to); }
            });
          }
          // Agrupa por camada
          const byLayer = new Map();
          for (const [id, L] of layers){
            if (!byLayer.has(L)) byLayer.set(L, []);
            byLayer.get(L).push(id);
          }
          // Posições
          // Sprint 36b / EV-COMP-09: aumentado espaçamento horizontal pra
          // acomodar nós mais largos (era 180, agora 220) — evita
          // sobreposição e dá espaço pras labels mais longas.
          const positions = new Map();
          const maxLayer = Math.max(0, ...byLayer.keys());
          byLayer.forEach((ids, L) => {
            ids.forEach((id, idx) => {
              positions.set(id, {
                x: 60 + L * 220,
                y: 40 + idx * 60
              });
            });
          });
          // Width / height adequados
          const layerCounts = Array.from(byLayer.values()).map(arr => arr.length);
          const maxCol = Math.max(1, ...layerCounts);
          return {
            positions,
            width: 60 + (maxLayer + 1) * 220,
            height: 40 + maxCol * 60 + 20
          };
        }

        const { positions, width, height } = _layout();

        const NS = 'http://www.w3.org/2000/svg';
        const wrap = SolsticeUtils.el('div', { style:'padding:8px;overflow:auto;max-height:520px;' });
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.style.cssText = 'background:var(--c-surface-2);border-radius:6px;font-family:var(--font-mono);';

        // Defs com marker de seta
        const defs = document.createElementNS(NS, 'defs');
        defs.innerHTML = '<marker id="solstice-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/></marker>';
        svg.appendChild(defs);

        // Arestas
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() || '#4D9FFF';
        edges.forEach(e => {
          const a = positions.get(e.from); const b = positions.get(e.to);
          if (!a || !b) return;
          // Sprint 36b / EV-COMP-09: nó tem width 180 agora (era 140)
          const path = document.createElementNS(NS, 'line');
          path.setAttribute('x1', (a.x + 90).toFixed(1));  // centro horizontal do nó-source
          path.setAttribute('y1', (a.y + 16).toFixed(1));
          path.setAttribute('x2', (b.x - 4).toFixed(1));
          path.setAttribute('y2', (b.y + 16).toFixed(1));
          path.setAttribute('stroke', 'var(--c-text-2)');
          path.setAttribute('stroke-width', '1.2');
          path.setAttribute('marker-end', 'url(#solstice-arrow)');
          path.style.opacity = '0.5';
          svg.appendChild(path);
        });

        // Nós
        const kindStyle = {
          column:    { fill: 'var(--c-surface-3)', stroke: 'var(--c-border)',  icon: '🏷️' },
          measure:   { fill: accent + '30',         stroke: accent,             icon: '🧮' },
          component: { fill: 'var(--c-surface)',   stroke: 'var(--c-warn)',     icon: '📊' }
        };
        for (const [id, n] of nodes){
          const p = positions.get(id); if (!p) continue;
          const sty = kindStyle[n.kind] || kindStyle.column;
          const g = document.createElementNS(NS, 'g');
          g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
          const rect = document.createElementNS(NS, 'rect');
          // Sprint 36b / EV-COMP-09: nós 140→180 px wide, label 14→22 chars
          // antes da reticência. "Lista de De..." vira "Lista de Demandas".
          rect.setAttribute('width', '180'); rect.setAttribute('height', '32');
          rect.setAttribute('rx', '6');
          rect.setAttribute('fill', sty.fill);
          rect.setAttribute('stroke', sty.stroke);
          rect.setAttribute('stroke-width', '1.2');
          g.appendChild(rect);
          const text = document.createElementNS(NS, 'text');
          text.setAttribute('x', '8'); text.setAttribute('y', '20');
          text.setAttribute('fill', 'var(--c-text)');
          text.setAttribute('font-size', '11');
          const label = n.label.length > 22 ? n.label.slice(0, 20) + '…' : n.label;
          text.textContent = sty.icon + ' ' + label;
          g.appendChild(text);
          const tt = document.createElementNS(NS, 'title');
          tt.textContent = n.kind + ': ' + n.label;
          g.appendChild(tt);
          svg.appendChild(g);
        }
        wrap.appendChild(svg);

        // Legenda
        const legend = SolsticeUtils.el('div', { style:'display:flex;gap:12px;margin-top:8px;font-size:11px;color:var(--c-muted);' });
        legend.appendChild(SolsticeUtils.el('span', null, '🏷️ Coluna · 🧮 Medida calculada · 📊 Componente · → dependência'));
        wrap.appendChild(legend);
        host.appendChild(wrap);
      }
    });

    // R-01 v3: expõe _ctx como API pública (Components.ctx). Antes havia 2
    // implementações divergentes (Components._ctx + Props._ctx). Props agora
    // delega para esta — ganha Relationships.enrich e medidas calculadas
    // automaticamente. Single source of truth para contexto de componente.
    return { register, unregister, onRegister, get, list, render, addByType, ctx: _ctx };
  })();
