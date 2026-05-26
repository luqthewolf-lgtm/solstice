
  /* ============================================================
     SolsticeProps — Painel de Propriedades com 4 abas
     Sidebar substitui o editor de colunas quando um slot é selecionado.
     Abas: Dados · Visual · Decisões · Provenance
     ============================================================ */
  const SolsticeProps = (function(){
    let selectedId = null;
    let activeTab = 'data';

    function select(slotId){
      selectedId = slotId;
      // Localiza slot
      const slot = _findSlot(slotId);
      if (!slot){ selectedId = null; render(); return; }
      // Garante defaultConfig se ausente
      if (!slot.config && slot.type !== 'empty'){
        const def = SolsticeComponents.get(slot.type);
        const ctx = _ctx();
        if (def && def.defaultConfig) _updateConfig(slotId, def.defaultConfig(ctx));
      }
      SolsticeStore.set('ui.selectedSlot', slotId);
      SolsticeStore.set('ui.inspector.slotId', slotId);
      render();
      _markSelected(slotId);
      // B7-r2: ADR-041 invalidada — não força mais aba 'componentes' porque o
      // painel de propriedades vive no inspector lateral direito agora.
      SolsticeAudit.record({ action:'select_component', target: slotId, componentId: slotId });
    }
    /**
     * deselect(opts) — opts.skipInspector evita chamar SolsticeInspector.close()
     * quando esta função é chamada PELO próprio Inspector.close (evita loop).
     */
    function deselect(opts){
      const skipInspector = opts && opts.skipInspector;
      selectedId = null;
      SolsticeStore.set('ui.selectedSlot', null);
      render();
      _markSelected(null);
      if (!skipInspector && SolsticeInspector && SolsticeInspector.isOpen()){
        SolsticeInspector.close();
      }
    }
    function _markSelected(id){
      SolsticeUtils.qsa('.solstice__comp').forEach(el => {
        el.classList.toggle('is-selected', el.getAttribute('data-comp-id') === id);
      });
    }
    // R-01 v3: Props._ctx agora DELEGA para SolsticeComponents.ctx (single source).
    // Antes era divergente: Components.ctx tinha Relationships.enrich + calculatedMeasures
    // mas Props.ctx não tinha. Agora ambos seguem mesma lógica.
    function _ctx(){
      if (typeof SolsticeComponents !== 'undefined' && SolsticeComponents.ctx){
        return SolsticeComponents.ctx(null);  // passa null = usa ingest global
      }
      // Fallback (não deveria acontecer — Components é carregado antes de Props)
      const ingest = SolsticeStore.get('ingest');
      const allRows = (ingest && ingest.rows) || [];
      const rows = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.apply(allRows) : allRows;
      return {
        rows, rowsAll: allRows,
        columns: (ingest && ingest.columns) || [],
        types: (ingest && ingest.types) || {},
        dictionary: SolsticeStore.get('dictionary'),
        L: SolsticeLocale
      };
    }
    function _findSlot(id){
      const sec = SolsticeStore.get('canvas.sections') || [];
      for (const s of sec) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === id);
        if (sl) return sl;
      }
      return null;
    }
    function _updateConfig(slotId, patch){
      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      for (const s of sections) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slotId);
        if (sl){
          sl.config = { ...(sl.config || {}), ...patch };
          // Patch B5-r4 / ADR-044: ao trocar agregação no KPI, se a baseline
          // atual ficar incompatível, força fallback para 'previous-period'.
          if (sl.type === 'kpi' && Object.prototype.hasOwnProperty.call(patch, 'agg')){
            const comp = sl.config.comparison;
            if (comp && !SolsticeKPI.isCompatible(sl.config.agg, comp.type)){
              const oldType = comp.type;
              sl.config.comparison = { ...comp, type: 'previous-period' };
              setTimeout(() => SolsticeToast.info(
                'Comparação ajustada',
                'A baseline anterior não fazia sentido com ' + SolsticeHumanize.aggregation(sl.config.agg) + '. Trocada para Período anterior.'
              ), 50);
              SolsticeAudit.record({
                action:'auto_switch_comparison', target: slotId, componentId: slotId,
                details: { from: oldType, to: 'previous-period', because: 'agg=' + sl.config.agg }
              });
            }
          }
          // Auditoria 2026.6 (SMOOTH-UPDATE): avisa o canvas que só a config deste
          // slot mudou → re-render cirúrgico (sem flash do canvas inteiro). Os
          // demais subscribers (autosave/dirty) disparam normalmente.
          try { if (typeof SolsticeCanvas !== 'undefined' && SolsticeCanvas.noteConfigOnly) SolsticeCanvas.noteConfigOnly(slotId); } catch(_){}
          // Auditoria 2026.6 (SMOOTH-INSPECTOR): marca se a mudança REVELA/ESCONDE
          // campos no inspector (precisa rebuild) ou é só VALOR (agg/bin/limite —
          // o controle já reflete, então o inspector pula o rebuild e não pisca).
          const _structuralKeys = ['column','xColumn','yColumn','y2Column','yColumns','groupBy','mode',
            'xCompoundColumn','valueColumn','dateColumn','sourceColumn','targetColumn','comparison',
            'showForecast','showDataLabels','showCompare','showTarget','sizeColumn','dataLabelFormat','clusters'];
          const _isStructural = Object.keys(patch).some(k => _structuralKeys.indexOf(k) >= 0) ||
            (sl.type === 'kpi' && Object.prototype.hasOwnProperty.call(patch, 'agg')); // agg no KPI troca a comparação
          window.__solsticeConfigQuickUpdate = { slotId, ts: Date.now(), structural: _isStructural };
          SolsticeStore.set('canvas.sections', sections);
          SolsticeAudit.record({
            action:'update_config', target: slotId, componentId: slotId,
            details: patch
          });
          return;
        }
      }
    }

    /**
     * render() — B7-r2: agora renderiza no INSPECTOR LATERAL DIREITO via
     * SolsticeInspector + createAccordion. Sai do paradigma de tabs e vai
     * para accordion expansível (ADR-064). A aba "📈 Análise" FOI MOVIDA
     * para o drawer inferior (SolsticeAnalysis), portanto NÃO aparece aqui.
     */
    function render(){
      if (!selectedId){
        if (SolsticeInspector && SolsticeInspector.isOpen()) SolsticeInspector.close();
        return;
      }
      const slot = _findSlot(selectedId);
      if (!slot){
        if (SolsticeInspector && SolsticeInspector.isOpen()) SolsticeInspector.close();
        return;
      }
      const def = SolsticeComponents.get(slot.type);
      if (!def){
        if (SolsticeInspector && SolsticeInspector.isOpen()) SolsticeInspector.close();
        return;
      }

      // 1) Abre inspector e configura header.
      // Sprint Solstice S7: passa contexto completo — type chip + breadcrumb
      // da seção pai. Descobre o título da seção walking canvas.sections.
      let sectionLabel = null;
      try {
        const sections = (SolsticeStore.get('canvas.sections')) || [];
        outer: for (let si = 0; si < sections.length; si++){
          const s = sections[si];
          for (const r of (s.rows || [])){
            for (const sl of (r.slots || [])){
              if (sl.id === slot.id){
                const t = s.title || 'Seção';
                // Se o título já começa com número e ponto (ex: "1. Visão
                // executiva") usa direto. Senão prefixa com índice.
                sectionLabel = /^\s*\d+\./.test(t) ? t : ((si + 1) + '. ' + t);
                break outer;
              }
            }
          }
        }
      } catch(_){}
      // typeChip: nome curto do tipo (ex: "KPI", "TABELA"). Label: rótulo customizado
      // ou nome formal do tipo.
      const typeName = (def.name || 'Componente').toUpperCase();
      // Se o slot tem um título custom (ex: "Receita por região"), usa como label
      // e o typeName vai pro chip. Senão, label = typeName e chip = null.
      const customTitle = (slot.config && slot.config.title) || null;
      SolsticeInspector.setTitle({
        icon: def.icon || '⚙️',
        label: customTitle || typeName,
        typeChip: customTitle ? typeName : null,
        sectionLabel: sectionLabel
      });
      SolsticeInspector.open();
      const host = SolsticeInspector.getBody();
      if (!host) return;
      // Auditoria 2026 (MC-01): cleanup defensivo antes de repintar inspector.
      // Inspector é repintado a cada select/change de componente.
      SolsticeUtils.cleanupListeners(host);
      host.innerHTML = '';

      // 2) Constrói seções accordion (ADR-064).
      // Auditoria 2026 (RT-02): extraído em sub-funções por responsabilidade.
      _buildInspectorAvisos(host, slot);
      _buildInspectorAccordions(host, slot, def);

      // Sprint Solstice S8: search incremental no topo do inspector — só
      // aparece quando há muitos controles (>6 fields). Filtra accordions
      // por nome e fields por label. Esc limpa, Enter abre o primeiro
      // accordion com match.
      _maybeAddInspectorSearch(host);

      // 3) Footer — Auditoria 2026 (RT-02): extraído em _buildInspectorFooter.
      SolsticeInspector.setFooter(_buildInspectorFooter(slot, def));
    }

    function _maybeAddInspectorSearch(host){
      try {
        const allFields = host.querySelectorAll('.solstice__props-field');
        if (allFields.length < 7) return; // threshold — só pra tiles "ricos"
        if (host.querySelector(':scope > .solstice__inspector-search')) return;
        const wrap = document.createElement('div');
        wrap.className = 'solstice__inspector-search';
        const input = document.createElement('input');
        input.type = 'search';
        input.placeholder = '🔎 Buscar controle…';
        input.setAttribute('aria-label', 'Filtrar controles do Inspector');
        input.className = 'solstice__inspector-search-input';
        wrap.appendChild(input);
        // Insere ANTES dos accordions (após avisos se existir)
        const firstAccord = host.querySelector('.solstice__accord');
        if (firstAccord) host.insertBefore(wrap, firstAccord);
        else host.insertBefore(wrap, host.firstChild);

        function _filter(query){
          const q = (query || '').trim().toLowerCase();
          const accords = host.querySelectorAll('.solstice__accord');
          accords.forEach(acc => {
            const headText = ((acc.querySelector('.solstice__accord-head-label')?.textContent) || '').toLowerCase();
            const fields = acc.querySelectorAll('.solstice__props-field');
            let visibleFields = 0;
            fields.forEach(f => {
              const labelText = ((f.querySelector('.solstice__props-label')?.textContent) || f.textContent || '').toLowerCase();
              const match = !q || labelText.indexOf(q) >= 0;
              f.style.display = match ? '' : 'none';
              if (match) visibleFields++;
            });
            // Mostra accordion se: sem query OU label do accord match OU algum field visível
            const accMatch = !q || headText.indexOf(q) >= 0 || visibleFields > 0;
            acc.style.display = accMatch ? '' : 'none';
            // Auto-abre accordions com match quando há query
            if (q && accMatch && visibleFields > 0){
              acc.classList.add('is-open');
              const body = acc.querySelector('.solstice__accord-body');
              if (body) body.style.display = 'block';
            }
          });
        }
        input.addEventListener('input', () => _filter(input.value));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape'){
            input.value = '';
            _filter('');
            e.stopPropagation();
          } else if (e.key === 'Enter'){
            const firstVisible = host.querySelector('.solstice__accord:not([style*="display: none"])');
            if (firstVisible){
              const head = firstVisible.querySelector('.solstice__accord-head');
              if (head) head.click();
            }
          }
        });
      } catch(_){}
    }

    /** Auditoria 2026 (RT-02): accordion ⚠️ Avisos — só aparece se há inconsistências. */
    function _buildInspectorAvisos(host, slot){
      if (typeof SolsticeInconsistencies === 'undefined') return;
      const hits = SolsticeInconsistencies.checkSlot(slot.id);
      if (!hits.length) return;
      host.appendChild(createAccordion({
        icon: '⚠️', title: 'Avisos', key: 'inspector.avisos',
        openByDefault: true,
        count: hits.length,
        build: (body) => {
          hits.forEach(h => {
            const sev = h.severity === 'error' ? 'error' : h.severity === 'warn' ? 'warn' : 'accent';
            const card = SolsticeUtils.el('div', {
              style: 'padding:8px 10px;margin-bottom:6px;border-radius:var(--rad-sm);' +
                     'background:color-mix(in srgb, var(--c-' + sev + ') 12%, transparent);' +
                     'border-left:3px solid var(--c-' + sev + ');'
            });
            card.appendChild(SolsticeUtils.el('div', { style:'font-size:var(--fs-xs);font-weight:var(--fw-semibold);color:var(--c-text);' }, h.label));
            card.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-text-2);margin-top:4px;line-height:1.5;' }, h.description));
            if (h.hint){
              card.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-accent);margin-top:6px;line-height:1.5;' }, '💡 ' + h.hint));
            }
            body.appendChild(card);
          });
        }
      }));
    }

    /** Auditoria 2026 (RT-02): 6 accordions do inspector (ADR-064 / ADR-162).
        Ordem: Dados → Estilo → Análise → Métodos → Decisões → Origem. */
    function _buildInspectorAccordions(host, slot, def){
      // 📊 Dados — aberta por padrão. Comparação (KPI) mergeada no fim.
      host.appendChild(createAccordion({
        icon: '📊', title: 'Dados', key: 'inspector.dados',
        openByDefault: true,
        build: (body) => {
          _renderDataTab(body, slot, def);
          if (slot.type === 'kpi'){
            body.appendChild(SolsticeUtils.el('div', {
              style:'margin-top:var(--sp-4);padding-top:var(--sp-3);border-top:1px solid var(--c-border);font-weight:600;font-size:12px;color:var(--c-text-2);margin-bottom:var(--sp-2);display:flex;align-items:center;gap:6px;'
            }, SolsticeUtils.el('span', null, '⚖️'), SolsticeUtils.el('span', null, 'Comparação')));
            const _compHost = SolsticeUtils.el('div');
            body.appendChild(_compHost);
            _renderComparisonTab(_compHost, slot, def);
          }
        }
      }));
      // S5-01 (Sprint 5 / Sofia Figma · SM-02): estilo dividido em 2 accordions
      // distintos pra resolver confusão "card vs componente". Antes era 1 só
      // "Estilo" misturando tudo.
      //   🎴 Card     = casca do componente (fundo, borda, sombra, padding, título do card)
      //   📊 Visual   = conteúdo (paleta de séries, cor do número, agressividade, eixos)
      host.appendChild(createAccordion({
        icon: '🎴', title: 'Card (casca)', key: 'inspector.card',
        openByDefault: false,
        build: (body) => {
          body.appendChild(SolsticeUtils.el('div', {
            style:'font-size:10px;color:var(--c-muted);margin-bottom:10px;line-height:1.5;padding:6px 8px;background:var(--c-surface-2);border-radius:4px;'
          }, '💡 Aparência da CASCA: fundo, borda, sombra, padding. Para cores do gráfico em si, use o painel "Visual" abaixo.'));
          _renderVisualTab(body, slot, def, { scope: 'card' });
        }
      }));
      host.appendChild(createAccordion({
        icon: '📊', title: 'Visual (componente)', key: 'inspector.visual',
        openByDefault: false,
        build: (body) => {
          body.appendChild(SolsticeUtils.el('div', {
            style:'font-size:10px;color:var(--c-muted);margin-bottom:10px;line-height:1.5;padding:6px 8px;background:var(--c-surface-2);border-radius:4px;'
          }, '💡 Aparência do CONTEÚDO: paleta de cores, agressividade, eixos, fonte do número. Para borda/fundo da casca, use "Card" acima.'));
          _renderVisualTab(body, slot, def, { scope: 'component' });
        }
      }));
      // 📈 Análise — aba leve com link pro drawer expandido (ADR-162)
      if (slot.type !== 'markdown'){
        host.appendChild(createAccordion({
          icon: '📈', title: 'Análise', key: 'inspector.analise',
          openByDefault: false,
          build: (body) => _renderAnalysisQuickInto(body, slot, def)
        }));
      }
      // 🔬 Métodos — fórmulas + assumptions (ADR-168)
      if (slot.type !== 'markdown'){
        host.appendChild(createAccordion({
          icon: '🔬', title: 'Métodos', key: 'inspector.metodos',
          openByDefault: false,
          build: (body) => _renderMethodsTab(body, slot, def)
        }));
      }
      // 🔍 Decisões
      host.appendChild(createAccordion({
        icon: '🔍', title: 'Decisões', key: 'inspector.decisoes',
        openByDefault: false,
        build: (body) => _renderDecisionsTab(body, slot, def)
      }));
      // 🧪 Origem (Provenance Trail)
      host.appendChild(createAccordion({
        icon: '🧪', title: 'Origem', key: 'inspector.origem',
        openByDefault: false,
        build: (body) => _renderProvenanceTab(body, slot, def)
      }));
    }

    /** Auditoria 2026 (RT-02): footer com Narrativa + Reset tamanho + Remover. */
    function _buildInspectorFooter(slot, def){
      const footerWrap = SolsticeUtils.el('div', { style:'display:flex;gap:8px;flex-direction:column;' });
      if (slot.type !== 'markdown'){
        footerWrap.appendChild(SolsticeUtils.el('button',
          { class:'solstice__btn',
            style:'width:100%;justify-content:center;',
            onclick: () => SolsticeNarrative.openModal(slot.id)
          }, '📖 Gerar narrativa'));
      }
      const hasCustomSize = slot.config && slot.config.size && (slot.config.size.height || slot.config.size.cols);
      const hasCustomWidth = (function(){
        const secs = SolsticeStore.get('canvas.sections') || [];
        for (const s of secs) for (const r of s.rows){
          const found = r.slots.find(x => x.id === slot.id);
          if (found) return Array.isArray(r.widths) && r.widths.length > 1 && r.layout === 'custom';
        }
        return false;
      })();
      if (hasCustomSize || hasCustomWidth){
        footerWrap.appendChild(SolsticeUtils.el('button',
          { class:'solstice__btn',
            style:'width:100%;justify-content:center;',
            title:'Volta o componente ao tamanho automático da row',
            onclick: () => _resetSlotSize(slot)
          }, '↺ Resetar tamanho'));
      }
      footerWrap.appendChild(SolsticeUtils.el('button',
        { class:'solstice__btn solstice__btn--destructive', title:'Remover componente',
          onclick: () => _confirmRemoveSlot(slot, def)
        }, '🗑️ Remover componente'));
      return footerWrap;
    }

    /** Auditoria 2026 (RT-02): reseta size customizado do slot. */
    function _resetSlotSize(slot){
      // Code Review 2026 (#2): usa SolsticeCanvas.withSlot — antes era busca
      // manual aninhada section/row/slot duplicada em 37 sites.
      const prevSize = slot.config && slot.config.size;
      const found = SolsticeCanvas.withSlot(slot.id, (sl, row) => {
        if (sl.config && sl.config.size) delete sl.config.size;
        if (row.layout === 'custom' && Array.isArray(row.widths)){
          row.widths = Array(row.slots.length).fill(100 / row.slots.length);
        }
      });
      if (!found) return;
      SolsticeAudit.record({
        action:'reset_slot_size', target: slot.id, componentId: slot.id,
        details: { from: { size: prevSize, layout: 'custom' } }
      });
      SolsticeToast.info('Tamanho resetado', 'Componente volta ao layout automático');
      setTimeout(() => SolsticeProps.select(slot.id), 80);
    }

    /** Auditoria 2026 (RT-02): confirm + remoção do componente do slot. */
    async function _confirmRemoveSlot(slot, def){
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
      SolsticeAudit.record({ action:'remove_component', target: slot.id, componentId: slot.id, details: { type: slot.type, source: 'inspector-footer' } });
      if (SolsticeAnalysis.isOpen() && SolsticeAnalysis.getCurrentSlotId() === slot.id) SolsticeAnalysis.close();
      deselect();
      SolsticeToast.action({
        title: 'Componente removido',
        msg: def.name, kind: 'warn',
        actionLabel: 'Desfazer',
        actionFn: () => SolsticeUndo && SolsticeUndo.undo && SolsticeUndo.undo()
      });
    }

    function _renderDataTab(host, slot, def){
      const cfg = slot.config || {};
      // Auditoria 2026 (U-13): ctx do slot puxa do datasetId se houver.
      const ctx = _ctx(cfg.datasetId);
      // Auditoria 2026.6 (INSPECTOR): o field agora RENDERIZA a dica (3º arg) —
      // antes era ignorada (varias chamadas ja passavam hint que nunca aparecia).
      function field(label, ctrl, hint){
        const f = SolsticeUtils.el('div', { class:'solstice__props-field' });
        f.appendChild(SolsticeUtils.el('label', { class:'solstice__props-label' }, label));
        f.appendChild(ctrl);
        if (hint) f.appendChild(SolsticeUtils.el('div', { class:'solstice__props-hint' }, hint));
        host.appendChild(f);
      }
      // Auditoria 2026.6 (INSPECTOR): cabeçalho de grupo — organiza opções soltas
      // em seções claras (Eixos / Período / Exibição...).
      function group(title, desc){
        const g = SolsticeUtils.el('div', { class:'solstice__props-group' });
        g.appendChild(SolsticeUtils.el('span', { class:'solstice__props-group-title' }, title));
        if (desc) g.appendChild(SolsticeUtils.el('span', { class:'solstice__props-group-desc' }, desc));
        host.appendChild(g);
      }
      // toggle helper p/ checkbox + label numa linha (com dica opcional)
      function toggleRow(labelText, checked, onChange, hint){
        const lbl = SolsticeUtils.el('label', { class:'solstice__props-toggle' });
        const cb = SolsticeUtils.el('input', { type:'checkbox', onchange: e => onChange(!!e.target.checked) });
        if (checked) cb.checked = true;
        lbl.appendChild(cb);
        lbl.appendChild(SolsticeUtils.el('span', null, labelText));
        const wrap = SolsticeUtils.el('div', { class:'solstice__props-field' });
        wrap.appendChild(lbl);
        if (hint) wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__props-hint' }, hint));
        host.appendChild(wrap);
      }

      // Auditoria 2026 (U-13): seletor de Base. Primeiro campo da aba
      // Dados — permite trocar a base do slot sem trocar a base ativa.
      const _datasets = SolsticeStore.get('datasets') || [];
      if (_datasets.length){
        const dsSel = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => {
          const newId = e.target.value || null;
          slot.config = Object.assign({}, slot.config, { datasetId: newId });
          // Re-render
          const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
          for (const s of sections) for (const r of s.rows) for (const sl of r.slots){
            if (sl.id === slot.id) sl.config = slot.config;
          }
          SolsticeStore.set('canvas.sections', sections);
          if (typeof SolsticeProps !== 'undefined' && SolsticeProps.select){
            setTimeout(() => SolsticeProps.select(slot.id), 60);
          }
        }});
        dsSel.appendChild(SolsticeUtils.el('option', { value:'' }, '— usar base ativa do app —'));
        _datasets.forEach(d => {
          const opt = SolsticeUtils.el('option', { value: d.id }, d.name);
          if (cfg.datasetId === d.id) opt.setAttribute('selected', 'selected');
          dsSel.appendChild(opt);
        });
        field('🗂️ Base de dados deste componente', dsSel);
      }
      function colSelect(currentVal, groupOrFieldName, onChange){
        // Patch 1A (ADR-111): se SolsticeCompat tem regra para este componente+field,
        // restringe pela userGroup; fallback para o legado por SolsticeTypes.group.
        const sel = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => onChange(e.target.value || null) });
        sel.appendChild(SolsticeUtils.el('option', { value:'' }, '— escolher —'));
        let cols = ctx.columns;
        // Heurística: se for um nome de field do COMPATIBILITY (xColumn/yColumn/etc.), filtra por userGroup
        const compatDef = SolsticeCompat.COMPATIBILITY[def.id];
        if (compatDef && compatDef[groupOrFieldName]){
          cols = SolsticeCompat.allowedColumnsFor(def.id, groupOrFieldName, ctx);
        } else if (groupOrFieldName === 'numeric' || groupOrFieldName === 'temporal' || groupOrFieldName === 'categorical'){
          // Legado por SolsticeTypes.group
          cols = ctx.columns.filter(c => {
            const tg = SolsticeTypes.group(ctx.types[c] && ctx.types[c].type);
            return tg === groupOrFieldName;
          });
        }
        if (!cols.length){
          const empty = SolsticeUtils.el('option', { value:'', disabled:'disabled' },
            'Nenhuma coluna compatível neste dataset');
          empty.style.color = 'var(--c-muted)';
          sel.appendChild(empty);
          sel.disabled = true;
          return sel;
        }
        cols.forEach(c => {
          const fn = ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[c] && ctx.dictionary.columns[c].friendlyName;
          const o = SolsticeUtils.el('option', { value: c }, (fn ? fn + ' · ' : '') + c);
          if (c === currentVal) o.selected = true;
          sel.appendChild(o);
        });
        return sel;
      }

      if (def.id === 'kpi'){
        // Auditoria 2026.6 (INSPECTOR): grupos + dicas + formato de número.
        group('📊 Métrica');
        field('Coluna (numérica)', colSelect(cfg.column, 'numeric', v => _updateConfig(slot.id, { column: v })),
          'O número que o card vai destacar.');
        const agg = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { agg: e.target.value }) });
        [['sum','Soma'],['avg','Média'],['median','Mediana'],['min','Mínimo'],['max','Máximo'],['count','Contagem']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((cfg.agg || 'sum') === v) o.selected = true;
          agg.appendChild(o);
        });
        field('Como agregar', agg, 'Soma p/ totais · Média/Mediana p/ taxas e notas · Contagem p/ nº de registros.');

        group('🔢 Formato do número');
        const fmtSel = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { format: e.target.value }) });
        [['auto','Automático (do tipo da coluna)'],['integer','Inteiro (1.234)'],['decimal','Decimal (1.234,5)'],['currency','Moeda (R$)'],['percent','Percentual (%)'],['compact','Compacto (1,2k · 3,4M)']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((cfg.format || 'auto') === v) o.selected = true;
          fmtSel.appendChild(o);
        });
        field('Formato', fmtSel, '"Automático" segue o tipo da coluna (moeda, %, etc.).');
        if (['decimal','percent'].indexOf(cfg.format) >= 0){
          const dec = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { formatDecimals: parseInt(e.target.value) }) });
          [['0','0'],['1','1'],['2','2'],['3','3']].forEach(([v,l]) => {
            const o = SolsticeUtils.el('option', { value: v }, l);
            if (String(cfg.formatDecimals != null ? cfg.formatDecimals : 2) === v) o.selected = true;
            dec.appendChild(o);
          });
          field('Casas decimais', dec);
        }
        host.appendChild(SolsticeUtils.el('div', { class:'solstice__props-hint', style:'margin-top:-4px;' },
          '💡 Meta e comparação (vs período anterior, meta fixa…) ficam na aba "Comparação".'));
      }
      else if (def.id === 'bignum'){
        // Auditoria 2026.6 (INSPECTOR): bignum nao tinha aba de Dados — nao dava
        // pra escolher coluna/agregacao. Aggs casam com SolsticeStats (mean, nao avg).
        group('🔢 Número');
        field('Coluna (numérica)', colSelect(cfg.column, 'numeric', v => _updateConfig(slot.id, { column: v })), 'O valor exibido em destaque gigante.');
        const ba = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { agg: e.target.value }) });
        [['sum','Soma'],['mean','Média'],['median','Mediana'],['min','Mínimo'],['max','Máximo'],['count','Contagem']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((cfg.agg || 'sum') === v) o.selected = true;
          ba.appendChild(o);
        });
        field('Como agregar', ba, 'Soma p/ totais · Média/Mediana p/ taxas e notas · Contagem p/ nº de registros.');
      }
      else if (def.id === 'time-series'){
        group('📈 Eixos & séries');
        field('Eixo X (temporal)', colSelect(cfg.xColumn, 'temporal', v => _updateConfig(slot.id, { xColumn: v })), 'Coluna de data/tempo do eixo horizontal.');
        field('Eixo Y (numérico)', colSelect(cfg.yColumn, 'numeric', v => _updateConfig(slot.id, { yColumn: v })), 'Medida principal (1 linha). Marque várias abaixo p/ multi-série.');
        // Auditoria 2026.6 (MULTI-EIXO): séries Y adicionais — marque 2+ colunas
        // numéricas pra desenhar uma linha por coluna (multi-série). Usuário:
        // "colocar quantos eixo y quiser".
        (function(){
          const _numCols = ctx.columns.filter(c => SolsticeTypes.group(ctx.types[c] && ctx.types[c].type) === 'numeric');
          if (_numCols.length < 2) return;
          const _cur = new Set(Array.isArray(cfg.yColumns) && cfg.yColumns.length ? cfg.yColumns : (cfg.yColumn ? [cfg.yColumn] : []));
          const box = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:3px;max-height:150px;overflow:auto;border:1px solid var(--c-border);border-radius:6px;padding:6px;' });
          _numCols.forEach(c => {
            const lbl = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;' });
            const cb = SolsticeUtils.el('input', { type:'checkbox' });
            if (_cur.has(c)) cb.checked = true;
            cb.addEventListener('change', () => {
              const sel = SolsticeUtils.qsa('input[type=checkbox]', box).map((x, i) => x.checked ? _numCols[i] : null).filter(Boolean);
              if (sel.length >= 2) _updateConfig(slot.id, { yColumns: sel });
              else _updateConfig(slot.id, { yColumns: null, yColumn: sel[0] || cfg.yColumn });
            });
            lbl.appendChild(cb);
            const _nm = (ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[c] && ctx.dictionary.columns[c].friendlyName) || c;
            lbl.appendChild(SolsticeUtils.el('span', null, _nm));
            box.appendChild(lbl);
          });
          field('Séries Y (marque 2+ p/ multi-linha)', box, 'Cada coluna marcada vira uma linha colorida.');
        })();
        group('⏱️ Período & estilo');
        const bin = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { bin: e.target.value }) });
        [['day','Diário'],['week','Semanal'],['month','Mensal'],['year','Anual']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((cfg.bin || 'day') === v) o.selected = true;
          bin.appendChild(o);
        });
        field('Granularidade do período', bin, 'Agrupa as datas por dia, semana, mês ou ano.');
        const kind = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { kind: e.target.value }) });
        [['line','Linha'],['area','Área'],['bar','Barras']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((cfg.kind || 'line') === v) o.selected = true;
          kind.appendChild(o);
        });
        field('Tipo de gráfico', kind, 'Linha, área preenchida ou barras.');
      }
      else if (def.id === 'distribution'){
        // Auditoria 2026.6 (INSPECTOR): grupo + dicas. Aceita qualquer coluna
        // (numérica = histograma · categórica/texto = ranking de frequência).
        group('📊 Dados');
        field('Coluna', colSelect(cfg.column, null, v => _updateConfig(slot.id, { column: v })),
          'Numérica → histograma (faixas) com média/mediana · Categórica/texto → ranking de frequência (valor + %).');
        const colType = (ctx.types && ctx.types[cfg.column]) || {};
        const isNumeric = cfg.column && SolsticeTypes.group(colType.type) === 'numeric';
        if (isNumeric){
          const bins = SolsticeUtils.el('input', { class:'solstice__props-input', type:'number', min:'5', max:'100', value: String(cfg.bins || 20), onchange: e => _updateConfig(slot.id, { bins: parseInt(e.target.value) || 20 }) });
          field('Número de faixas (bins)', bins, 'Mais faixas = mais detalhe · menos = visão mais suave.');
        } else if (cfg.column) {
          const topN = SolsticeUtils.el('input', { class:'solstice__props-input', type:'number', min:'3', max:'50', value: String(cfg.topN || 12), onchange: e => _updateConfig(slot.id, { topN: parseInt(e.target.value) || 12 }) });
          field('Top N categorias', topN, 'Mostra as N categorias mais frequentes (as demais ficam de fora).');
        } else {
          host.appendChild(SolsticeUtils.el('div', { class:'solstice__props-hint' }, 'Escolha uma coluna acima.'));
        }
      }
      else if (def.id === 'distrib-time'){
        // Auditoria 2026.6 (INSPECTOR): reorganizado em grupos claros (Eixos /
        // Período / Exibição) com dica em cada opção. Handlers preservados.
        group('📊 Eixos & medidas');
        field('Eixo X — período (data)', colSelect(cfg.xColumn, 'temporal', v => _updateConfig(slot.id, { xColumn: v })),
          'Coluna de data/tempo do eixo horizontal (agrupada pela granularidade abaixo).');
        field('Eixo Y — barras (medida)', colSelect(cfg.yColumn, 'numeric', v => _updateConfig(slot.id, { yColumn: v })),
          'Valor numérico que vira a altura das barras.');
        const yAggSel = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { yAgg: e.target.value }) });
        [['sum','Soma'],['avg','Média'],['count','Contagem'],['max','Máximo'],['min','Mínimo']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((cfg.yAgg || 'sum') === v) o.selected = true;
          yAggSel.appendChild(o);
        });
        field('Como agregar o Y', yAggSel, 'Soma p/ volumes · Média p/ taxas/notas · Contagem p/ nº de registros.');
        field('Eixo Y2 — linha (opcional)', colSelect(cfg.y2Column, 'numeric', v => _updateConfig(slot.id, { y2Column: v || null })),
          '2ª medida desenhada como LINHA num eixo à direita (combo barras + linha).');
        if (cfg.y2Column){
          const y2AggSel = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { y2Agg: e.target.value }) });
          [['sum','Soma'],['avg','Média'],['count','Contagem'],['max','Máximo'],['min','Mínimo']].forEach(([v,l]) => {
            const o = SolsticeUtils.el('option', { value: v }, l);
            if ((cfg.y2Agg || 'sum') === v) o.selected = true;
            y2AggSel.appendChild(o);
          });
          field('Como agregar a linha (Y2)', y2AggSel);
        }

        group('⏱️ Período & agrupamento');
        const binDT = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { bin: e.target.value }) });
        [['day','Diário'],['week','Semanal'],['month','Mensal'],['year','Anual']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((cfg.bin || 'month') === v) o.selected = true;
          binDT.appendChild(o);
        });
        field('Granularidade do período', binDT, 'Agrupa as datas por dia, semana, mês ou ano.');
        field('Quebrar por categoria (opcional)', colSelect(cfg.groupBy, 'categorical', v => _updateConfig(slot.id, { groupBy: v || null })),
          'Divide cada período em séries por uma 3ª dimensão (ex: por região/canal).');
        if (cfg.groupBy){
          toggleRow('Empilhar as séries (stacked)', cfg.groupStacked !== false, v => _updateConfig(slot.id, { groupStacked: v }),
            'Desligado = barras lado a lado por categoria.');
          const topN = SolsticeUtils.el('input', { class:'solstice__props-input', type:'number', min:'2', max:'12',
            value: String(cfg.groupTopN || 6),
            onchange: e => _updateConfig(slot.id, { groupTopN: Math.max(2, Math.min(12, parseInt(e.target.value) || 6)) }) });
          field('Máx. de categorias', topN, 'As demais são somadas em "Outros".');
        }

        group('👁️ Exibição');
        toggleRow('Mostrar barras', cfg.showDistribution !== false, v => _updateConfig(slot.id, { showDistribution: v }));
        toggleRow('Mostrar linha de tendência', cfg.showLine !== false, v => _updateConfig(slot.id, { showLine: v }),
          'Usa o 2º eixo (direita) quando o Y2 está definido.');
      }
      else if (def.id === 'table'){
        // Auditoria 2026.6 (INSPECTOR/TABELA): grupo + dicas + SELEÇÃO DE COLUNAS
        // (customização que faltava — antes mostrava sempre todas).
        group('📋 Tabela');
        const lim = SolsticeUtils.el('input', { class:'solstice__props-input', type:'number', min:'10', max:'500', value: String(cfg.rowLimit || 50), onchange: e => _updateConfig(slot.id, { rowLimit: parseInt(e.target.value) || 50 }) });
        field('Linhas exibidas', lim, 'Quantas linhas mostrar (10–500).');
        const allCols = ctx.columns || [];
        if (allCols.length){
          const curSel = (Array.isArray(cfg.columns) && cfg.columns.length) ? new Set(cfg.columns) : new Set(allCols);
          const box = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:3px;max-height:200px;overflow:auto;border:1px solid var(--c-border);border-radius:6px;padding:6px;' });
          allCols.forEach(c => {
            const lbl = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;' });
            const cb = SolsticeUtils.el('input', { type:'checkbox' });
            if (curSel.has(c)) cb.checked = true;
            cb.addEventListener('change', () => {
              const sel = SolsticeUtils.qsa('input[type=checkbox]', box).map((x, i) => x.checked ? allCols[i] : null).filter(Boolean);
              // todas marcadas → null (= todas); subconjunto → array; nenhuma → mantém ao menos 1 (volta a todas)
              _updateConfig(slot.id, { columns: (sel.length === 0 || sel.length === allCols.length) ? null : sel });
            });
            lbl.appendChild(cb);
            lbl.appendChild(SolsticeUtils.el('span', null, c));
            box.appendChild(lbl);
          });
          field('Colunas a exibir', box, 'Marque só as colunas que quer na tabela (todas marcadas = mostra todas).');
        }
      }
      /* ===== Bloco 6 ===== */
      else if (def.id === 'scatter'){
        group('📈 Eixos');
        field('Eixo X (numérico)', colSelect(cfg.xColumn, 'numeric', v => _updateConfig(slot.id, { xColumn: v })), 'Variável do eixo horizontal.');
        field('Eixo Y (numérico)', colSelect(cfg.yColumn, 'numeric', v => _updateConfig(slot.id, { yColumn: v })), 'Variável do eixo vertical.');
        field('Tamanho dos pontos (opcional)', colSelect(cfg.sizeColumn, 'numeric', v => _updateConfig(slot.id, { sizeColumn: v })), 'Ponto maior = valor maior (bubble chart).');
        group('🔬 Análise');
        toggleRow('Linha de regressão (com r²)', cfg.showRegression !== false, v => _updateConfig(slot.id, { showRegression: v }), 'Tendência linear + coeficiente de determinação.');
        const clusters = SolsticeUtils.el('input', { class:'solstice__props-input', type:'number', min:'0', max:'8',
          value: String(cfg.clusters || 0),
          onchange: e => _updateConfig(slot.id, { clusters: Math.max(0, Math.min(8, parseInt(e.target.value) || 0)) }) });
        field('Clusters (k-means)', clusters, '0 = sem agrupamento · 2–8 colore os pontos por proximidade.');
      }
      else if (def.id === 'heatmap-cal'){
        group('📅 Dados');
        field('Coluna de data', colSelect(cfg.dateColumn, 'temporal', v => _updateConfig(slot.id, { dateColumn: v })), 'Cada dia vira uma célula colorida pela intensidade.');
        field('Coluna de valor (opcional)', colSelect(cfg.valueColumn, 'numeric', v => _updateConfig(slot.id, { valueColumn: v, agg: v ? 'sum' : 'count' })), 'Sem valor = conta os registros por dia.');
        const agg = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { agg: e.target.value }) });
        [['count','Contagem de registros'],['sum','Soma'],['avg','Média']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((cfg.agg || 'count') === v) o.selected = true;
          agg.appendChild(o);
        });
        field('Como agregar por dia', agg, 'Como combinar os valores caídos no mesmo dia.');
      }
      else if (def.id === 'gauge'){
        group('🎯 Medida');
        field('Coluna (numérica)', colSelect(cfg.column, 'numeric', v => _updateConfig(slot.id, { column: v })), 'Valor apontado pelo ponteiro.');
        const agg = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { agg: e.target.value }) });
        [['avg','Média'],['sum','Soma'],['min','Mínimo'],['max','Máximo']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((cfg.agg || 'avg') === v) o.selected = true;
          agg.appendChild(o);
        });
        field('Como agregar', agg, 'Média p/ taxas/notas · Soma p/ totais.');
        group('📏 Escala');
        const minIn = SolsticeUtils.el('input', { class:'solstice__props-input', type:'number', step:'any',
          value: String(cfg.min == null ? 0 : cfg.min),
          onchange: e => _updateConfig(slot.id, { min: parseFloat(e.target.value) }) });
        field('Mínimo do range', minIn, 'Início da escala (vazio do arco).');
        const maxIn = SolsticeUtils.el('input', { class:'solstice__props-input', type:'number', step:'any',
          value: String(cfg.max == null ? 100 : cfg.max),
          onchange: e => _updateConfig(slot.id, { max: parseFloat(e.target.value) }) });
        field('Máximo do range', maxIn, 'Fim da escala (cheio do arco).');
        const tgtIn = SolsticeUtils.el('input', { class:'solstice__props-input', type:'number', step:'any',
          value: cfg.target == null ? '' : String(cfg.target),
          placeholder:'opcional',
          onchange: e => _updateConfig(slot.id, { target: e.target.value === '' ? null : parseFloat(e.target.value) }) });
        field('Meta (opcional)', tgtIn, 'Marca a meta como um traço no arco.');
      }
      else if (def.id === 'markdown'){
        group('📝 Texto');
        const txt = SolsticeUtils.el('textarea', {
          class:'solstice__props-input',
          rows: '10',
          style:'min-height:160px;font-family:var(--font-mono);font-size:var(--fs-xs);resize:vertical;',
          placeholder:'# Título\n\nTexto livre.\n\nUse {{path.no.store}} para inserir valores dinâmicos.',
          oninput: e => _updateConfig(slot.id, { text: e.target.value })
        });
        txt.value = cfg.text || '';
        field('Conteúdo (Markdown)', txt, 'Aceita # títulos, **negrito**, listas e placeholders {{...}}.');
        host.appendChild(SolsticeUtils.el('div', { class:'solstice__props-hint', style:'margin-top:-4px;' },
          'Placeholders: ' +
          SolsticeUtils.el('code', null, '{{dataset.name}}').outerHTML + ' · ' +
          SolsticeUtils.el('code', null, '{{ingest.meta.rowsCount}}').outerHTML + ' · ' +
          SolsticeUtils.el('code', null, '{{profile.name}}').outerHTML));
      }
      else if (def.id === 'boxplot'){
        group('📦 Dados');
        field('Coluna de valor (numérica)', colSelect(cfg.valueColumn, 'numeric', v => _updateConfig(slot.id, { valueColumn: v })), 'A distribuição (quartis + média + outliers) dessa medida.');
        field('Agrupar por (opcional)', colSelect(cfg.groupColumn, 'categorical', v => _updateConfig(slot.id, { groupColumn: v })), 'Um box por categoria, lado a lado (até 8 grupos).');
      }
      else if (def.id === 'sankey'){
        group('🌊 Fluxo');
        field('Origem (categórica)', colSelect(cfg.sourceColumn, 'categorical', v => _updateConfig(slot.id, { sourceColumn: v })), 'Lado esquerdo do fluxo.');
        field('Destino (categórica)', colSelect(cfg.targetColumn, 'categorical', v => _updateConfig(slot.id, { targetColumn: v })), 'Lado direito do fluxo.');
        field('Valor (opcional)', colSelect(cfg.valueColumn, 'numeric', v => _updateConfig(slot.id, { valueColumn: v })), 'Espessura das ligações. Vazio = contagem de registros.');
      }
      else if (def.id === 'funnel'){
        // Auditoria 2026.6 (INSPECTOR): funnel nao tinha aba de DADOS — so dava
        // pra configurar pelo defaultConfig. Agora da pra trocar etapa/valor.
        group('🔻 Funil');
        field('Etapas (categórica)', colSelect(cfg.stageColumn, 'categorical', v => _updateConfig(slot.id, { stageColumn: v })), 'Cada valor distinto vira uma etapa do funil.');
        field('Valor (opcional)', colSelect(cfg.valueColumn, 'numeric', v => _updateConfig(slot.id, { valueColumn: v })), 'Tamanho de cada etapa. Vazio = contagem de registros.');
      }
      else if (def.id === 'pivot'){
        // Auditoria 2026.6 (INSPECTOR): pivot nao tinha aba de DADOS.
        group('▦ Tabela dinâmica');
        field('Linhas (categórica)', colSelect(cfg.rowColumn, 'categorical', v => _updateConfig(slot.id, { rowColumn: v })), 'Dimensão nas linhas.');
        field('Colunas (categórica)', colSelect(cfg.colColumn, 'categorical', v => _updateConfig(slot.id, { colColumn: v })), 'Dimensão nas colunas (cruzamento).');
        field('Valor (numérica)', colSelect(cfg.valueColumn, 'numeric', v => _updateConfig(slot.id, { valueColumn: v })), 'Medida agregada em cada célula.');
        const pAgg = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => _updateConfig(slot.id, { agg: e.target.value }) });
        [['sum','Soma'],['avg','Média'],['count','Contagem']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((cfg.agg || 'sum') === v) o.selected = true;
          pAgg.appendChild(o);
        });
        field('Como agregar', pAgg, 'Sem coluna de valor = contagem de registros.');
      }
    }

    function _renderComparisonTab(host, slot, def){
      const cfg = slot.config || {};
      const comp = cfg.comparison || { type: 'previous-period', targetValue: null, targetLabel: '', periodSize: 'auto' };
      const agg = cfg.agg || 'sum';
      const aggLabel = SolsticeHumanize.aggregation(agg);
      host.innerHTML = '';

      host.appendChild(SolsticeUtils.el('div',
        { class:'solstice__compare-help' },
        'Comparações relevantes para a agregação selecionada (' + aggLabel + ').'));

      // Patch Corretivo (BUG I): substitui ~11 radios por SELECT único compacto
      const allTypes = SolsticeKPI.listTypes();
      const compatible = allTypes.filter(t => SolsticeKPI.isCompatible(agg, t.value));
      const incompatible = allTypes.filter(t => !SolsticeKPI.isCompatible(agg, t.value));

      const select = SolsticeUtils.el('select', { class:'solstice__props-select' });
      compatible.forEach(t => {
        const opt = SolsticeUtils.el('option', { value: t.value }, t.short || t.label);
        if (comp.type === t.value) opt.selected = true;
        select.appendChild(opt);
      });
      if (incompatible.length){
        const sep = SolsticeUtils.el('option', { disabled: 'disabled' }, '─── Avançado (incompatível com ' + aggLabel + ') ───');
        select.appendChild(sep);
        incompatible.forEach(t => {
          const opt = SolsticeUtils.el('option', { value: t.value, title: SolsticeKPI.incompatReason(agg, t.value) },
            '⚠️ ' + (t.short || t.label));
          if (comp.type === t.value) opt.selected = true;
          select.appendChild(opt);
        });
      }
      select.addEventListener('change', (e) => {
        _updateConfig(slot.id, { comparison: Object.assign({}, comp, { type: e.target.value }) });
      });
      host.appendChild(select);

      // Sub-campos condicionais — Meta fixa
      if (comp.type === 'fixed-target'){
        host.appendChild(SolsticeUtils.el('div', { class:'solstice__compare-divider' }, 'Meta fixa'));

        const f1 = SolsticeUtils.el('div', { class:'solstice__props-field' });
        f1.appendChild(SolsticeUtils.el('label', { class:'solstice__props-label' }, 'Valor da meta'));
        f1.appendChild(SolsticeUtils.el('input', {
          class:'solstice__props-input', type:'number', step:'any',
          value: comp.targetValue != null ? String(comp.targetValue) : '',
          placeholder:'ex: 1000000',
          onchange: (e) => {
            const v = e.target.value === '' ? null : parseFloat(e.target.value);
            _updateConfig(slot.id, { comparison: { ...comp, targetValue: v } });
          }
        }));
        host.appendChild(f1);

        const f2 = SolsticeUtils.el('div', { class:'solstice__props-field' });
        f2.appendChild(SolsticeUtils.el('label', { class:'solstice__props-label' }, 'Texto da meta'));
        f2.appendChild(SolsticeUtils.el('input', {
          class:'solstice__props-input', type:'text',
          value: comp.targetLabel || '',
          placeholder:'ex: Meta trimestre',
          onchange: (e) => {
            _updateConfig(slot.id, { comparison: { ...comp, targetLabel: e.target.value } });
          }
        }));
        host.appendChild(f2);
      }

      // Sub-campos — Período anterior automático
      if (comp.type === 'previous-period'){
        host.appendChild(SolsticeUtils.el('div', { class:'solstice__compare-divider' }, 'Período anterior'));

        const f = SolsticeUtils.el('div', { class:'solstice__props-field' });
        f.appendChild(SolsticeUtils.el('label', { class:'solstice__props-label' }, 'Tamanho do período'));
        const sel = SolsticeUtils.el('select', {
          class:'solstice__props-select',
          onchange: (e) => {
            _updateConfig(slot.id, { comparison: { ...comp, periodSize: e.target.value } });
          }
        });
        [['auto','Auto-detectar'],['day','Diário'],['week','Semanal'],['month','Mensal'],['quarter','Trimestral']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if ((comp.periodSize || 'auto') === v) o.selected = true;
          sel.appendChild(o);
        });
        f.appendChild(sel);
        host.appendChild(f);
      }
    }

    /**
     * Patch Corretivo (ADR-155): aba "Estilo" — opções de aparência por tipo de componente.
     * Persiste em slot.config.style = { ... }.
     */
    /** Camada Style — aba Estilo reescrita em 6 seções colapsáveis.
        Presets · Aparência · Tipografia · Cores · Específico · Visibilidade. */
    function _renderVisualTab(host, slot, def, opts){
      const cfg = slot.config || {};
      const style = cfg.style || {};
      // S5-01 (Sprint 5): scope='card'|'component'|undefined (tudo)
      //   card: Aparência (fundo/borda/sombra/padding) + Visibilidade
      //   component: Cores · Texto · Específico · Presets
      const _scope = (opts && opts.scope) || 'all';
      // _shouldRenderSection casa por prefixo pra suportar "Específico — KPI" etc.
      function _shouldRenderSection(title){
        if (_scope === 'all') return true;
        const t = String(title || '');
        const cardSections = ['Aparência', 'Visibilidade'];
        const componentSections = ['Cores', 'Texto', 'Tipografia', 'Específico', 'Presets'];
        const isCard = cardSections.some(p => t.indexOf(p) === 0);
        const isComp = componentSections.some(p => t.indexOf(p) === 0);
        if (isCard) return _scope === 'card';
        if (isComp) return _scope === 'component';
        return true; // sem mapeamento → renderiza em ambos
      }

      // Polish v7: flag transient pra evitar re-render total do Inspector
      // quando a mudança é apenas de style. O subscribe em canvas.sections
      // detecta a flag e faz update parcial (só .is-active nos cards) em vez
      // de destruir/recriar todos os DOM nodes. Elimina o "tremor" ao clicar
      // paleta/preset/swatch.
      function _markQuickUpdate(){
        try {
          window.__solsticeStyleQuickUpdate = { slotId: slot.id, ts: Date.now() };
        } catch(_) {}
      }
      // Auditoria 2026.6 (NO-FLASH): mudança de 1 slot (estilo/config) → re-render
      // CIRÚRGICO double-buffered no canvas (sem repintar tudo, sem piscar).
      function _noteSlot(){ try { if (typeof SolsticeCanvas !== 'undefined' && SolsticeCanvas.noteConfigOnly) SolsticeCanvas.noteConfigOnly(slot.id); } catch(_){} }
      function _set(key, value){
        _markQuickUpdate();
        const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
        for (const s of sections) for (const r of s.rows){
          const sl = r.slots.find(x => x.id === slot.id);
          if (sl){
            sl.config = sl.config || {};
            sl.config.style = Object.assign({}, sl.config.style || {}, { [key]: value });
            _noteSlot();
            SolsticeStore.set('canvas.sections', sections);
            return;
          }
        }
      }
      function _setMany(patch){
        _markQuickUpdate();
        const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
        for (const s of sections) for (const r of s.rows){
          const sl = r.slots.find(x => x.id === slot.id);
          if (sl){
            sl.config = sl.config || {};
            sl.config.style = Object.assign({}, sl.config.style || {}, patch);
            _noteSlot();
            SolsticeStore.set('canvas.sections', sections);
            return;
          }
        }
      }
      // Prompt 8: setter pra slot.config (não slot.config.style) — usado pelos
      // toggles de modo/drillColumns/metricColumn do drill-down do table.
      function _setCfg(key, value){
        const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
        for (const s of sections) for (const r of s.rows){
          const sl = r.slots.find(x => x.id === slot.id);
          if (sl){
            sl.config = sl.config || {};
            sl.config[key] = value;
            _noteSlot();
            SolsticeStore.set('canvas.sections', sections);
            return;
          }
        }
      }

      function field(label, ctrl, hint){
        const wrap = SolsticeUtils.el('div', { class:'solstice__props-field' });
        wrap.appendChild(SolsticeUtils.el('label', { class:'solstice__props-label' }, label));
        if (hint) wrap.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);margin-bottom:4px;line-height:1.4;' }, hint));
        wrap.appendChild(ctrl);
        return wrap;
      }
      function makeSelect(options, current, onChange){
        const sel = SolsticeUtils.el('select', { class:'solstice__props-select', onchange: e => onChange(e.target.value) });
        options.forEach(([v, l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if (String(v) === String(current)) o.selected = true;
          sel.appendChild(o);
        });
        return sel;
      }
      function makeToggle(current, onChange){
        const lab = SolsticeUtils.el('label', { style:'display:flex;gap:6px;align-items:center;cursor:pointer;font-size:12px;color:var(--c-text-2);' });
        const inp = SolsticeUtils.el('input', { type:'checkbox' });
        if (current) inp.checked = true;
        inp.addEventListener('change', e => onChange(e.target.checked));
        lab.appendChild(inp);
        lab.appendChild(SolsticeUtils.el('span', null, current ? 'ativado' : 'desativado'));
        return lab;
      }
      // Camada Polish v5: paletas sugeridas inline por propriedade + cores recentes
      // Polish v8b: sugeridas em 5 cores (matchando exatamente os 5 slots de
      // "recentes" — ambos cabem na mesma linha sem confusão visual).
      const SUGGESTED_BY_PROP = {
        background:  ['#FFFFFF','#F8FAFC','#1A2540','#0B0F1A','#FEF3C7'],
        borderColor: ['#E5E7EB','#CBD5E1','#94A3B8','#475569','#4D9FFF'],
        titleColor:  ['#0F1419','#1F2937','#374151','#6B7280','#FFFFFF'],
        valueColor:  ['#0F1419','#4D9FFF','#4ADE80','#F87171','#FBBF24'],
        accentColor: ['#4D9FFF','#4ADE80','#FBBF24','#F87171','#A78BFA'],
        textColor:   ['#0F1419','#374151','#6B7280','#FFFFFF','#94A3B8']
      };

      function _recentColors(){
        const r = SolsticeStore.get('ui.style.recentColors');
        return Array.isArray(r) ? r : [];
      }
      function _pushRecent(color){
        if (!color || color === 'auto' || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
        const cur = _recentColors().filter(c => c.toLowerCase() !== color.toLowerCase());
        cur.unshift(color);
        SolsticeStore.set('ui.style.recentColors', cur.slice(0, 5));
        // SOL-D5 v2: dispara evento pra que pickers abertos atualizem
        // a linha "recentes" em tempo real, sem esperar reabrir o painel.
        try {
          window.dispatchEvent(new CustomEvent('solstice:recent-color', { detail:{ color } }));
        } catch(_){}
      }

      // Polish v8b: makeColor compacto.
      //   ANTES: linha [picker 38px] [hex input flex:1 (~140px)] [reset]  ← input gigante
      //   AGORA: linha [picker 32px] [hex input 88px] [reset]
      //          espaço sobra → Recentes ao lado das Sugeridas (1 linha só)
      function makeColor(propKey, current, onChange){
        const container = SolsticeUtils.el('div', { class:'solstice__color-control' });

        const wrap = SolsticeUtils.el('div', { class:'solstice__color-control-row' });
        const picker = SolsticeUtils.el('input', {
          type:'color',
          value: (current && current !== 'auto') ? current : '#4D9FFF',
          class:'solstice__color-picker',
          title:'Selecionar cor'
        });
        picker.addEventListener('input', e => {
          try {
            const slotId = SolsticeStore.get('ui.inspector.slotId');
            if (!slotId || !propKey) return;
            const compEl = document.querySelector('.solstice__comp[data-comp-id="' + slotId + '"]');
            if (!compEl) return;
            const sl = _findSlot(slotId);
            if (!sl) return;
            const previewStyle = Object.assign({}, sl.config && sl.config.style || {});
            previewStyle[propKey] = e.target.value;
            if (typeof SolsticeStyle !== 'undefined') SolsticeStyle.apply(compEl, previewStyle);
            txt.value = e.target.value;
          } catch(err){ /* silencioso */ }
        });
        picker.addEventListener('change', e => { _pushRecent(e.target.value); onChange(e.target.value); });

        const txt = SolsticeUtils.el('input', {
          type:'text',
          value: (current && current !== 'auto') ? current : '',
          placeholder:'auto',
          class:'solstice__color-hex',
          title:'Digite hex (#RRGGBB) ou "auto"',
          onchange: e => {
            const v = e.target.value.trim();
            if (!v || v === 'auto'){ onChange('auto'); return; }
            if (/^#[0-9a-fA-F]{6}$/.test(v)){ _pushRecent(v); onChange(v); picker.value = v; }
          }
        });
        const reset = SolsticeUtils.el('button', {
          type:'button', class:'solstice__color-reset',
          title:'Voltar pro automático (segue o tema)',
          'aria-label':'Resetar para automático',
          onclick: () => { onChange('auto'); txt.value = ''; picker.value = '#4D9FFF'; }
        }, '↺');
        wrap.appendChild(picker); wrap.appendChild(txt); wrap.appendChild(reset);
        container.appendChild(wrap);

        // HOTFIX v5.5 (Auditoria 2026.4): "sugestões + recentes COEXISTINDO".
        // Quando usuário escolhe uma cor, ela vai pra "recentes" MAS as sugestões
        // contextuais continuam visíveis (não substitui).
        // Layout: 2 linhas — sugeridas fixas em cima, recentes embaixo (se
        // houver). Sugeridas NÃO somem quando user escolhe novas cores.
        function _addSwatch(line, color, group){
          const sw = SolsticeUtils.el('button', {
            type:'button',
            class:'solstice__color-swatch solstice__color-swatch--' + group,
            title: color + ' · ' + group,
            'aria-label':'Aplicar ' + color,
            style: 'background:' + color + ';',
            onclick: () => {
              picker.value = color;
              txt.value = color;
              _pushRecent(color);
              onChange(color);
            }
          });
          line.appendChild(sw);
        }

        const SWATCH_PER_LINE = 5;
        const suggested = (SUGGESTED_BY_PROP[propKey] || []).slice(0, SWATCH_PER_LINE);

        // Linha 1: SUGERIDAS (sempre presentes, label sutil)
        if (suggested.length){
          const sugLine = SolsticeUtils.el('div', { class:'solstice__color-swatches' });
          sugLine.appendChild(SolsticeUtils.el('span', {
            style:'font-size:9px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.04em;margin-right:6px;align-self:center;width:54px;flex-shrink:0;'
          }, 'sugeridas'));
          suggested.forEach(c => _addSwatch(sugLine, c, 'suggested'));
          container.appendChild(sugLine);
        }

        // SOL-D5 v2: linha de RECENTES reativa — atualiza em tempo real
        // ao escolher uma nova cor, sem precisar reabrir o painel.
        const recLine = SolsticeUtils.el('div', {
          class:'solstice__color-swatches solstice__color-swatches--recent',
          style:'margin-top:4px;'
        });
        function _renderRecentLine(){
          // limpa swatches mas mantém o label, pra evitar piscar
          recLine.innerHTML = '';
          const recent = _recentColors().slice(0, SWATCH_PER_LINE);
          if (!recent.length){ recLine.style.display = 'none'; return; }
          recLine.style.display = '';
          recLine.appendChild(SolsticeUtils.el('span', {
            style:'font-size:9px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.04em;margin-right:6px;align-self:center;width:54px;flex-shrink:0;'
          }, 'recentes'));
          recent.forEach(c => _addSwatch(recLine, c, 'recent'));
        }
        _renderRecentLine();
        container.appendChild(recLine);

        // Escuta o evento global e re-renderiza só esta linha.
        // Auditoria 2026 (MC-01 / HV-02): trackListener com container como host.
        // O MutationObserver continua como cleanup ativo (caso quem remove o
        // container esqueça de chamar cleanupListeners explicitamente).
        const _onRecent = () => _renderRecentLine();
        SolsticeUtils.trackListener(container, window, 'solstice:recent-color', _onRecent);
        const _mo = new MutationObserver(() => {
          if (!document.body.contains(container)){
            SolsticeUtils.cleanupListeners(container);
            _mo.disconnect();
          }
        });
        try { _mo.observe(document.body, { childList: true, subtree: true }); } catch(_){}

        return container;
      }

      // Helper: cria <details>/<summary> compacto. Retorna body para appendChild.
      // Fix Camada Style v4: cada _set() re-renderiza o Inspector — sem persistir
      // o estado dos <details>, eles fechavam toda vez que o usuário mexia em algo.
      // Solução: persistir aberto/fechado em Store.ui.style.section.<sectionKey>
      // (global por nome de seção, não por slot — Lucas mantém o mesmo "padrão de uso"
      // entre componentes).
      function _section(icon, title, openByDefault){
        // S5-01: respeita scope (card vs component) — retorna body órfão se
        // a seção não pertence ao escopo (appendChild fora do host vira no-op visual)
        if (!_shouldRenderSection(title)){
          return SolsticeUtils.el('div'); // body órfão, fora do host
        }
        const sectionKey = String(title).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const storedKey = 'ui.style.section.' + sectionKey;
        const stored = SolsticeStore.get(storedKey);
        const shouldOpen = (stored == null) ? !!openByDefault : !!stored;

        const det = SolsticeUtils.el('details', {
          class:'solstice__style-section',
          'data-section-key': sectionKey
        });
        if (shouldOpen) det.setAttribute('open','');

        const sum = SolsticeUtils.el('summary', { class:'solstice__style-section-summary' });
        sum.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true' }, icon));
        sum.appendChild(SolsticeUtils.el('span', null, title));
        sum.appendChild(SolsticeUtils.el('span', { class:'solstice__style-section-chevron', 'aria-hidden':'true' }, '▾'));
        det.appendChild(sum);
        const body = SolsticeUtils.el('div', { class:'solstice__style-section-body' });
        det.appendChild(body);

        // Persiste estado quando usuário abre/fecha
        det.addEventListener('toggle', () => {
          try { SolsticeStore.set(storedKey, det.open); } catch(_){}
        });

        host.appendChild(det);
        return body;
      }

      // Polish v7: helper pra sub-heading dentro de seção (ex: "Cores do conteúdo" vs "Cores de destaque")
      function _subHeading(text, hint){
        const wrap = SolsticeUtils.el('div', { class:'solstice__style-subheading' });
        wrap.appendChild(SolsticeUtils.el('span', null, text));
        if (hint){
          const h = SolsticeUtils.el('span', { class:'solstice__style-subheading-hint' }, hint);
          wrap.appendChild(h);
        }
        return wrap;
      }
      function _divider(){
        return SolsticeUtils.el('div', { class:'solstice__style-section-divider' });
      }
      const curPreset = style.preset || 'default';

      // ===== ORDEM REORGANIZADA (Polish v7) =====
      // Personas pediram: CUSTOMIZAÇÃO primeiro, presets como atalho ao fim.
      // 1. Aparência (open · forma/cor do card)
      // 2. Cores (open · paleta + cores específicas — agora com sub-headings)
      // 3. Tipografia (closed)
      // 4. Específico (open · por tipo de componente — o mais relevante)
      // 5. Visibilidade (closed)
      // 6. Presets (closed · no FIM como atalho "tudo de uma vez")

      // ===== SEÇÃO 1: APARÊNCIA =====
      // SOL-D6: rótulo encurtado ("Aparência do card" → "Aparência").
      const aparenciaBody = _section('🎴', 'Aparência', true);
      aparenciaBody.appendChild(_subHeading('Fundo & contorno'));
      aparenciaBody.appendChild(field('Cor de fundo', makeColor('background', style.background || 'auto', v => _set('background', v)),
        '"auto" segue o tema (claro/escuro).'));
      aparenciaBody.appendChild(field('Estilo da borda', makeSelect([
        ['none','Sem borda'],['subtle','Suave (1px)'],['solid','Sólida (1px)'],['thick','Grossa (3px)'],['dashed','Tracejada (2px)']
      ], style.border || 'subtle', v => _set('border', v))));
      aparenciaBody.appendChild(field('Cor da borda', makeColor('borderColor', style.borderColor || 'auto', v => _set('borderColor', v))));

      aparenciaBody.appendChild(_divider());
      aparenciaBody.appendChild(_subHeading('Forma & profundidade'));
      aparenciaBody.appendChild(field('Cantos arredondados', makeSelect([
        ['none','Reto (0)'],['sm','Sutil (4px)'],['md','Médio (8px)'],['lg','Amplo (12px)'],['xl','Grande (18px)'],['full','Pílula (∞)']
      ], style.radius || 'md', v => _set('radius', v))));
      aparenciaBody.appendChild(field('Sombra', makeSelect([
        ['none','Sem sombra'],['sm','Sutil'],['md','Média'],['lg','Forte'],['glow','Glow (accent)']
      ], style.shadow || 'sm', v => _set('shadow', v)),
        'Light = sombra preta clássica · Dark = brilho branco real.'));
      aparenciaBody.appendChild(field('Espaçamento interno', makeSelect([
        ['compact','Compacto (8px)'],['comfortable','Confortável (16px)'],['spacious','Espaçoso (24px)']
      ], style.padding || 'comfortable', v => _set('padding', v))));

      // ===== SEÇÃO 2: CORES (Polish v7 — promovida pra antes de Tipografia) =====
      // Reorganizada em 3 sub-grupos visuais claros:
      //   1. Conteúdo (título · valor · texto) — cores ESTÁTICAS do card
      //   2. Destaque (accent) — cor de ÊNFASE usada em interações/charts
      //   3. Paleta (chart séries) — sequência de cores aplicada nos gráficos
      const coresBody = _section('🌈', 'Cores', true);

      // Polish v8b: helper especial pra Cores — cada campo mostra
      // ÍCONE + LABEL + EXEMPLO VIVO da cor (em vez de só "Título"/"Valor"
      // genéricos que se confundem). Inovação: o exemplo é re-pintado em
      // tempo real conforme o usuário escolhe cor.
      function colorFieldWithSample(icon, label, sampleText, propKey, currentColor, onChange, hint){
        const wrap = SolsticeUtils.el('div', { class:'solstice__color-field' });
        // Header do field: ícone + nome + exemplo (renderizado com a cor atual)
        const head = SolsticeUtils.el('div', { class:'solstice__color-field-head' });
        head.appendChild(SolsticeUtils.el('span', { class:'solstice__color-field-icon', 'aria-hidden':'true' }, icon));
        head.appendChild(SolsticeUtils.el('span', { class:'solstice__color-field-label' }, label));
        const sampleEl = SolsticeUtils.el('span', {
          class:'solstice__color-field-sample',
          style: (currentColor && currentColor !== 'auto') ? 'color:' + currentColor + ';' : ''
        }, sampleText);
        head.appendChild(sampleEl);
        wrap.appendChild(head);
        if (hint){
          wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__color-field-hint' }, hint));
        }
        // Color picker (re-pintando o exemplo conforme muda)
        wrap.appendChild(makeColor(propKey, currentColor, (v) => {
          sampleEl.style.color = (v && v !== 'auto') ? v : '';
          onChange(v);
        }));
        return wrap;
      }

      coresBody.appendChild(_subHeading('Conteúdo', 'cores estáticas do card'));
      coresBody.appendChild(colorFieldWithSample(
        '🔤', 'Título',           'Vendas Q4 — exemplo',
        'titleColor', style.titleColor || 'auto', v => _set('titleColor', v)
      ));
      coresBody.appendChild(colorFieldWithSample(
        '💰', 'Valor / Número',   'R$ 12.500',
        'valueColor', style.valueColor || 'auto', v => _set('valueColor', v),
        'KPI · Big Number · números destacados.'
      ));
      coresBody.appendChild(colorFieldWithSample(
        '📝', 'Texto comum',      'descrição secundária...',
        'textColor', style.textColor || 'auto', v => _set('textColor', v)
      ));

      coresBody.appendChild(_divider());
      coresBody.appendChild(_subHeading('Destaque', 'cor de ênfase para interações e bordas'));
      coresBody.appendChild(colorFieldWithSample(
        '🎯', 'Accent (destaque)', '★ hover · seleção · glow',
        'accentColor', style.accentColor || 'auto', v => _set('accentColor', v),
        'Usada em borda hover, glow, indicadores de seleção.'
      ));

      // Paleta — pra componentes que usam múltiplas séries/categorias.
      // Sprint 41 / feedback do usuário ("paleta de gráfico só 1 cor"): incluímos
      // mais tipos que se beneficiam de paleta multi-cor (forecast com bandas,
      // distrib-time empilhada, treemap, radar, polar, segments). Também
      // promovemos a paleta para CIMA do Accent — usuário pediu visibilidade.
      const usesPalette = [
        'time-series','distribution','scatter','sankey','funnel','heatmap-cal',
        'pivot','boxplot','distrib-time','metric-graph','forecast','segments',
        'treemap','radar','polar','timeline','bubble','combo','area','bar','pie',
        'donut','stacked-bar'
      ].includes(def.id);
      // Auditoria 2026.6: "Paleta do gráfico" POR-COMPONENTE removida do tab Visual
      // a pedido do usuário ("falta tirar a paleta de gráfico dos componentes em
      // visual"). A cor das séries passa a seguir só a paleta GLOBAL (menu
      // Aparência no header) — fonte única, sem conflito/duplicidade por componente.
      void usesPalette;

      // ===== SEÇÃO 3: TEXTO =====
      // SOL-D6: "Tipografia" renomeada para "Texto" (junior-friendly).
      const tipoBody = _section('🅰️', 'Texto', false);
      tipoBody.appendChild(field('Família', makeSelect([
        ['auto','Automática (do tema)'],['display','Display (Space Grotesk)'],['mono','Mono (Code)'],['sans','Sans (Inter)']
      ], style.fontFamily || 'auto', v => _set('fontFamily', v))));
      tipoBody.appendChild(field('Escala de tamanho', makeSelect([
        ['xs','Mínimo (85%)'],['sm','Pequeno (92%)'],['md','Padrão (100%)'],['lg','Grande (110%)'],['xl','Maior (125%)'],['2xl','Gigante (150%)']
      ], style.fontScale || 'md', v => _set('fontScale', v))));
      tipoBody.appendChild(field('Peso', makeSelect([
        ['light','Leve (300)'],['normal','Normal (400)'],['medium','Médio (500)'],['bold','Negrito (700)']
      ], style.fontWeight || 'normal', v => _set('fontWeight', v))));
      tipoBody.appendChild(field('Alinhamento', makeSelect([
        ['left','Esquerda'],['center','Centro'],['right','Direita']
      ], style.textAlign || 'left', v => _set('textAlign', v))));

      // ===== SEÇÃO 4: ESPECÍFICO (por tipo) — aberta por padrão pois é o mais relevante =====
      const especBody = _section('⚙️', 'Específico — ' + def.name, true);

      if (def.id === 'kpi'){
        especBody.appendChild(field('Posição do delta', makeSelect([
          ['below','Abaixo do número'],['inline','Mesma linha'],['hidden','Ocultar delta']
        ], style.kpiDeltaPosition || 'below', v => _set('kpiDeltaPosition', v))));
        especBody.appendChild(field('Sparkline (mini-gráfico)', makeToggle(style.showSparkline === true, v => _set('showSparkline', v)),
          'Linha pequena com tendência abaixo do valor.'));
      } else if (def.id === 'bignum'){
        especBody.appendChild(field('Modo gigante', makeToggle(style.bignumGiant === true, v => _set('bignumGiant', v)),
          'Aumenta o número para 72px. Bom em destaques únicos.'));
        especBody.appendChild(field('Sparkline', makeToggle(style.showSparkline === true, v => _set('showSparkline', v))));
      } else if (def.id === 'time-series'){
        especBody.appendChild(field('Tipo de linha', makeSelect([
          ['smooth','Suave (Bezier)'],['sharp','Reta (Linear)'],['stepped','Escada (Step)']
        ], style.chartLineStyle || 'smooth', v => _set('chartLineStyle', v))));
        especBody.appendChild(field('Mostrar pontos', makeToggle(style.showPoints !== false, v => _set('showPoints', v))));
        // SOL-D4 v2: rótulo de dados liga/desliga (mostrar valor em cada ponto).
        // O renderer da Série Temporal consulta style.showDataLabels.
        // Sprint 42 / feedback do usuário ("rótulo de dados não editável"):
        // adicionados formato (integer/decimal/percent/compact) e posição
        // (top/right/bottom). Antes era hardcoded em integer/top.
        especBody.appendChild(field('Rótulo de dados', makeToggle(style.showDataLabels === true, v => _set('showDataLabels', v)),
          'Mostra o valor numérico em cada ponto da série.'));
        if (style.showDataLabels === true){
          especBody.appendChild(field('Formato do rótulo', makeSelect([
            ['integer','Inteiro (1.234)'],
            ['decimal','Decimal (1.234,5)'],
            ['percent','Percentual (12,3%)'],
            ['compact','Compacto (1,2k · 3,4M)']
          ], style.dataLabelFormat || 'integer', v => _set('dataLabelFormat', v))));
          if ((style.dataLabelFormat || 'integer') === 'decimal' || (style.dataLabelFormat) === 'percent'){
            especBody.appendChild(field('Casas decimais', makeSelect([
              ['0','0'],['1','1'],['2','2'],['3','3']
            ], String(style.dataLabelDecimals != null ? style.dataLabelDecimals : 1),
              v => _set('dataLabelDecimals', parseInt(v)))));
          }
          especBody.appendChild(field('Posição do rótulo', makeSelect([
            ['top','Acima do ponto'],
            ['right','À direita'],
            ['bottom','Abaixo do ponto']
          ], style.dataLabelPosition || 'top', v => _set('dataLabelPosition', v))));
        }
        especBody.appendChild(field('Grid', makeToggle(style.chartGrid !== false, v => _set('chartGrid', v))));
        especBody.appendChild(field('Legenda', makeToggle(style.chartLegend !== false, v => _set('chartLegend', v))));
        especBody.appendChild(field('Animar transições', makeToggle(style.chartAnimation !== false, v => _set('chartAnimation', v))));
      } else if (def.id === 'distribution'){
        especBody.appendChild(field('Orientação', makeSelect([
          ['vertical','Vertical (barras de cima pra baixo)'],['horizontal','Horizontal']
        ], style.orientation || 'vertical', v => _set('orientation', v))));
        especBody.appendChild(field('Mostrar % nos rótulos', makeToggle(style.showPercent === true, v => _set('showPercent', v))));
        especBody.appendChild(field('Limitar a N categorias', makeSelect([
          ['all','Todas'],['5','Top 5'],['10','Top 10'],['20','Top 20']
        ], String(style.limit || 'all'), v => _set('limit', v === 'all' ? null : parseInt(v)))));
        especBody.appendChild(field('Agrupar resto em "Outros"', makeToggle(style.groupOthers === true, v => _set('groupOthers', v))));
      } else if (def.id === 'distrib-time'){
        // Auditoria 2026.6 (RÓTULO-DADOS): controles de rótulo de dados no
        // distrib-time (antes só no time-series). O renderer consulta
        // style.showDataLabels/Format/Decimals.
        especBody.appendChild(field('Rótulo de dados', makeToggle(style.showDataLabels === true, v => _set('showDataLabels', v)),
          'Mostra o valor em cima de cada barra.'));
        if (style.showDataLabels === true){
          especBody.appendChild(field('Formato do rótulo', makeSelect([
            ['integer','Inteiro (1.234)'],['decimal','Decimal (1.234,5)'],['percent','Percentual (12,3%)'],['compact','Compacto (1,2k · 3,4M)']
          ], style.dataLabelFormat || 'integer', v => _set('dataLabelFormat', v))));
          if ((style.dataLabelFormat || 'integer') === 'decimal' || style.dataLabelFormat === 'percent'){
            especBody.appendChild(field('Casas decimais', makeSelect([
              ['0','0'],['1','1'],['2','2'],['3','3']
            ], String(style.dataLabelDecimals != null ? style.dataLabelDecimals : 1), v => _set('dataLabelDecimals', parseInt(v)))));
          }
        }
      } else if (def.id === 'table' || def.id === 'pivot'){
        especBody.appendChild(field('Linhas alternadas (zebra)', makeToggle(style.zebra !== false, v => _set('zebra', v))));
        especBody.appendChild(field('Cabeçalho sticky', makeToggle(style.stickyHeader !== false, v => _set('stickyHeader', v))));
        especBody.appendChild(field('Heatmap em numéricas', makeToggle(style.heatmap === true, v => _set('heatmap', v)),
          'Cor de fundo das células varia conforme o valor (intensidade).'));
        especBody.appendChild(field('Negrito em totais', makeToggle(style.boldTotals !== false, v => _set('boldTotals', v))));

        // Prompt 8 v5.4: configuração de drill-down (só pra table, não pra pivot)
        if (def.id === 'table'){
          especBody.appendChild(_divider());
          especBody.appendChild(_subHeading('Drill-down hierárquico', 'agregação por níveis'));
          const ctx2 = _ctx();  // Auditoria 2026.6 (PROPS-CTX): era _ctxFor() — helper inexistente neste módulo, lançava ReferenceError e quebrava a aba Visual da tabela. O helper local é _ctx().
          const isDrillMode = (cfg.mode || 'flat') === 'drill';
          especBody.appendChild(field('Modo de exibição', makeSelect([
            ['flat','📋 Linhas planas (default)'],
            ['drill','🔽 Drill-down (agregado por níveis)']
          ], cfg.mode || 'flat', v => _setCfg('mode', v)),
            'Drill-down agrupa linhas por colunas hierárquicas e mostra agregado expansível.'));
          if (isDrillMode){
            // Multi-select de drill columns (categóricas)
            const cats = (ctx2.columns || []).filter(c => {
              const grp = SolsticeTypes.group((ctx2.types[c] || {}).type);
              return grp === 'categorical' || grp === 'id' || grp === 'temporal';
            });
            const drillCols = (cfg.drillColumns || []);
            const drillWrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:4px;' });
            drillWrap.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);' },
              'Ordem dos níveis (clique para adicionar/remover):'));
            const chipsWrap = SolsticeUtils.el('div', { style:'display:flex;flex-wrap:wrap;gap:3px;' });
            // Chips das colunas já selecionadas (na ordem) com botão "remover" + setas
            drillCols.forEach((c, idx) => {
              const chip = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:3px;padding:3px 6px;background:var(--c-accent);color:#fff;border-radius:var(--rad-xs);font-size:10px;font-family:var(--font-mono);' });
              chip.appendChild(SolsticeUtils.el('span', null, (idx+1) + '. ' + c));
              if (idx > 0){
                chip.appendChild(SolsticeUtils.el('button', {
                  type:'button',
                  style:'background:transparent;color:#fff;border:none;cursor:pointer;padding:0 2px;font-size:10px;',
                  title:'Subir nível',
                  onclick: () => {
                    const nc = drillCols.slice();
                    [nc[idx-1], nc[idx]] = [nc[idx], nc[idx-1]];
                    _setCfg('drillColumns', nc);
                  }
                }, '↑'));
              }
              chip.appendChild(SolsticeUtils.el('button', {
                type:'button',
                style:'background:transparent;color:#fff;border:none;cursor:pointer;padding:0 2px;font-size:11px;',
                title:'Remover',
                onclick: () => _setCfg('drillColumns', drillCols.filter(x => x !== c))
              }, '×'));
              chipsWrap.appendChild(chip);
            });
            // Botões pra adicionar colunas restantes
            cats.filter(c => !drillCols.includes(c)).forEach(c => {
              const chip = SolsticeUtils.el('button', {
                type:'button',
                style:'padding:3px 6px;background:var(--c-surface);border:1px dashed var(--c-border);border-radius:var(--rad-xs);font-size:10px;cursor:pointer;font-family:var(--font-mono);color:var(--c-text-2);',
                title:'Adicionar como próximo nível',
                onclick: () => _setCfg('drillColumns', [...drillCols, c])
              }, '+ ' + c);
              chipsWrap.appendChild(chip);
            });
            if (!cats.length){
              chipsWrap.appendChild(SolsticeUtils.el('span', { style:'font-size:10px;color:var(--c-muted);font-style:italic;' },
                'Nenhuma coluna categórica disponível.'));
            }
            drillWrap.appendChild(chipsWrap);
            especBody.appendChild(field('Colunas de hierarquia', drillWrap));

            // Métrica
            const nums = (ctx2.columns || []).filter(c => SolsticeTypes.group((ctx2.types[c] || {}).type) === 'numeric');
            especBody.appendChild(field('Coluna da métrica', makeSelect(
              [['', '(selecione)']].concat(nums.map(c => [c, c])),
              cfg.metricColumn || '', v => _setCfg('metricColumn', v || null)
            ), 'Coluna numérica que será agregada em cada nível.'));
            especBody.appendChild(field('Agregação', makeSelect([
              ['sum','Soma'],['avg','Média'],['count','Contagem'],['min','Mínimo'],['max','Máximo']
            ], cfg.metricAgg || 'sum', v => _setCfg('metricAgg', v))));
          }
        }
      } else if (def.id === 'scatter'){
        especBody.appendChild(field('Tamanho do ponto', makeSelect([
          ['xs','Mínimo (2px)'],['sm','Pequeno (4px)'],['md','Médio (6px)'],['lg','Grande (10px)']
        ], style.pointSize || 'md', v => _set('pointSize', v))));
        especBody.appendChild(field('Opacidade dos pontos', makeSelect([
          ['1','100%'],['0.8','80%'],['0.6','60%'],['0.4','40%']
        ], String(style.pointOpacity || 0.8), v => _set('pointOpacity', parseFloat(v)))));
        especBody.appendChild(field('Linha de regressão', makeToggle(style.showRegression === true, v => _set('showRegression', v))));
      } else if (def.id === 'sankey'){
        especBody.appendChild(field('Cor por origem', makeToggle(style.colorByOrigin !== false, v => _set('colorByOrigin', v))));
        especBody.appendChild(field('Opacidade dos links', makeSelect([
          ['0.3','30%'],['0.5','50%'],['0.7','70%'],['1','100%']
        ], String(style.linkOpacity || 0.5), v => _set('linkOpacity', parseFloat(v)))));
      } else if (def.id === 'funnel'){
        especBody.appendChild(field('Mostrar % de conversão', makeToggle(style.showConversion !== false, v => _set('showConversion', v))));
        especBody.appendChild(field('Gradient nas etapas', makeToggle(style.gradient === true, v => _set('gradient', v))));
      } else if (def.id === 'gauge'){
        especBody.appendChild(field('Espessura do arco', makeSelect([
          ['thin','Fina'],['medium','Média'],['thick','Grossa']
        ], style.arcWidth || 'medium', v => _set('arcWidth', v))));
        especBody.appendChild(field('Mostrar marcas (ticks)', makeToggle(style.showTicks !== false, v => _set('showTicks', v))));
      } else if (def.id === 'boxplot'){
        especBody.appendChild(field('Mostrar outliers', makeToggle(style.showOutliers !== false, v => _set('showOutliers', v))));
        especBody.appendChild(field('Cor por grupo', makeToggle(style.colorByGroup === true, v => _set('colorByGroup', v))));
      } else {
        especBody.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:10px;line-height:1.5;font-style:italic;' },
          def.name + ' herda as configurações de Aparência/Tipografia/Cores acima.'));
      }

      // ===== SEÇÃO 5: VISIBILIDADE =====
      const visBody = _section('👁️', 'Visibilidade', false);
      visBody.appendChild(field('Mostrar título', makeToggle(style.showTitle !== false, v => _set('showTitle', v))));
      visBody.appendChild(field('Mostrar subtítulo', makeToggle(style.showSubtitle !== false, v => _set('showSubtitle', v))));
      visBody.appendChild(field('Mostrar rodapé/legenda', makeToggle(style.showFooter !== false, v => _set('showFooter', v))));
      visBody.appendChild(field('Modo compacto', makeToggle(style.compact === true, v => _set('compact', v)),
        'Diminui altura mínima e padding. Bom em grids densos.'));

      // ===== SEÇÃO 6: PRESETS (MOVIDA PARA O FIM · Polish v7) =====
      // Personas pediram: customização primeiro, preset como ATALHO no final.
      // Camila: "Presets em primeiro empurra customização pra baixo. Eu QUERO customizar."
      const presetsBody = _section('✨', 'Presets prontos', false);
      presetsBody.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-text-2);margin-bottom:8px;line-height:1.5;' },
        'Aplica visual completo de uma vez. Clique para aplicar · 💾 salva o estilo atual como novo preset.'));
      const presetsGrid = SolsticeUtils.el('div', { class:'solstice__style-presets-grid' });
      SolsticeStyle.listPresets().forEach(p => {
        const card = SolsticeUtils.el('button', {
          class: 'solstice__style-preset-card' + (p.key === curPreset ? ' is-active' : '') + (p.custom ? ' is-custom' : ''),
          type:'button',
          title: p.description,
          'data-preset-key': p.key,
          onclick: () => _setMany({ preset: p.key })
        });
        card.appendChild(SolsticeUtils.el('div', { class:'solstice__style-preset-label' },
          (p.custom ? '⭐ ' : '') + p.label));
        if (p.custom){
          const rm = SolsticeUtils.el('button', {
            type:'button',
            class:'solstice__style-preset-remove',
            title:'Remover preset salvo',
            'aria-label':'Remover preset ' + p.label,
            onclick: async (e) => {
              e.stopPropagation();
              const ok = await SolsticeModal.confirm({
                title:'Remover preset',
                message:'Tem certeza que quer remover o preset "' + p.label + '"?',
                confirmLabel:'Remover',
                danger: true
              });
              if (ok){
                SolsticeStyle.removeUserPreset(p.key);
                render();
              }
            }
          }, '×');
          card.appendChild(rm);
        }
        presetsGrid.appendChild(card);
      });
      presetsBody.appendChild(presetsGrid);
      const savePresetBtn = SolsticeUtils.el('button', {
        class:'solstice__btn',
        style:'width:100%;font-size:11px;margin-top:8px;',
        title:'Salva o estilo atual como preset personalizado pra reutilizar',
        onclick: async () => {
          const name = await SolsticeModal.prompt({
            title:'💾 Salvar preset personalizado',
            message:'Dê um nome ao preset (ex: "Cartão Vendas", "KPI Marca"):',
            placeholder:'Meu preset',
            defaultValue:''
          });
          if (!name || !name.trim()) return;
          const ok = SolsticeStyle.saveUserPreset(name.trim(), style);
          if (ok){
            SolsticeToast.success('Preset salvo', name.trim() + ' · aparece em Presets com ⭐');
            render();
          }
        }
      }, '💾 Salvar estilo atual como preset');
      presetsBody.appendChild(savePresetBtn);

      // ===== AÇÕES =====
      const acts = SolsticeUtils.el('div', { style:'display:flex;gap:6px;margin-top:var(--sp-4);padding-top:var(--sp-3);border-top:1px solid var(--c-border);flex-wrap:wrap;' });

      // Restaurar: zera slot.config.style por substituição (não merge).
      acts.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--ghost',
        style:'flex:1;font-size:11px;min-width:90px;',
        title:'Restaura todos os defaults (limpa cor, sombra, borda, tudo)',
        onclick: async () => {
          const ok = await SolsticeModal.confirm({
            title:'Restaurar visual?',
            message:'Vai limpar TODAS as customizações (cor, borda, sombra, tipografia, preset). Componente volta ao default. Continuar?',
            confirmLabel:'Restaurar',
            danger: false
          });
          if (!ok) return;
          _markQuickUpdate();
          const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
          for (const s of sections) for (const r of s.rows){
            const sl = r.slots.find(x => x.id === slot.id);
            if (sl){
              sl.config = sl.config || {};
              sl.config.style = {}; // SUBSTITUI por vazio (não merge)
              SolsticeStore.set('canvas.sections', sections);
              SolsticeToast.success('Estilo restaurado', 'Defaults aplicados');
              break;
            }
          }
        }
      }, '↺ Restaurar'));

      // Copiar estilo (clipboard interno + sistema)
      acts.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn',
        style:'flex:1;font-size:11px;min-width:90px;',
        title:'Copia este estilo. Use "Colar" em outro componente.',
        onclick: () => {
          SolsticeStyle.copyToClipboard(style);
          SolsticeToast.success('Estilo copiado', 'Selecione outro componente e clique em "📥 Colar estilo".');
          // Força re-render do Inspector pra mostrar botão Colar habilitado
          if (selectedId) setTimeout(() => render(), 50);
        }
      }, '📋 Copiar'));

      // Colar estilo (só se há algo no clipboard interno)
      const pasteBtn = SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--primary',
        style:'flex:1;font-size:11px;min-width:90px;',
        title:'Aplica o estilo copiado a este componente',
        onclick: () => {
          const clip = SolsticeStyle.getClipboard();
          if (!clip){
            SolsticeToast.warn('Sem estilo copiado', 'Use "📋 Copiar" em outro componente primeiro.');
            return;
          }
          _setMany(clip);
          SolsticeToast.success('Estilo colado', Object.keys(clip).length + ' propriedade' + (Object.keys(clip).length === 1 ? '' : 's') + ' aplicada' + (Object.keys(clip).length === 1 ? '' : 's'));
        }
      }, '📥 Colar estilo');
      if (!SolsticeStyle.hasClipboard()){
        pasteBtn.disabled = true;
        pasteBtn.style.opacity = '0.5';
        pasteBtn.style.cursor = 'not-allowed';
        pasteBtn.title = 'Nenhum estilo copiado ainda. Use "📋 Copiar" primeiro em outro componente.';
      }
      acts.appendChild(pasteBtn);

      host.appendChild(acts);
    }

    /* ============================================================
       Bloco 7 — Aba "📈 Análise"
       Mostra estatísticas relevantes ao componente selecionado, com
       explicações no espírito "Por que esse número?". Usa SolsticeStats
       para todas as métricas. Lê a coluna principal do slot.config e
       computa via SolsticeStats.describe + extras context-aware.
       ============================================================ */
    function _renderStatsTab(host, slot, def){
      const ctx = _ctx();
      const cfg = slot.config || {};

      // Resolve a coluna numérica principal por tipo de componente
      function primaryNumericColumn(){
        if (def.id === 'kpi' || def.id === 'distribution' || def.id === 'gauge') return cfg.column;
        if (def.id === 'time-series') return cfg.yColumn;
        if (def.id === 'scatter')     return cfg.yColumn;
        if (def.id === 'boxplot')     return cfg.valueColumn;
        if (def.id === 'heatmap-cal') return cfg.valueColumn;
        if (def.id === 'sankey')      return cfg.valueColumn;
        if (def.id === 'table')       return null;
        return null;
      }

      function row(label, value, hint){
        const r = SolsticeUtils.el('div', { class:'solstice__stats-row' });
        r.appendChild(SolsticeUtils.el('div', { class:'solstice__stats-label', title: hint || '' }, label));
        r.appendChild(SolsticeUtils.el('div', { class:'solstice__stats-value' }, value));
        return r;
      }

      function section(title){
        return SolsticeUtils.el('div', { class:'solstice__stats-section-title' }, title);
      }

      function fmt(v, digits){
        if (v == null || isNaN(v)) return '—';
        return ctx.L.decimal(v, digits == null ? 2 : digits);
      }

      const col = primaryNumericColumn();
      if (!col){
        host.appendChild(SolsticeUtils.el('div', { class:'solstice__stats-empty' },
          'Configure ao menos uma coluna numérica em 📊 Dados para ver a análise estatística.'));
        return;
      }

      const values = ctx.rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
      if (!values.length){
        host.appendChild(SolsticeUtils.el('div', { class:'solstice__stats-empty' },
          'Sem valores numéricos válidos em "' + SolsticeHumanize.column(col, ctx.dictionary) + '".'));
        return;
      }

      const desc = SolsticeStats.describe(values);

      // --- Cabeçalho explicativo ---
      const header = SolsticeUtils.el('div', { class:'solstice__stats-explain' });
      header.appendChild(SolsticeUtils.el('strong', null, '🔬 Por que esse número?'));
      header.appendChild(SolsticeUtils.el('div', { style:'margin-top:4px;' },
        'Análise calculada sobre ' + SolsticeHumanize.recordCount(desc.n) +
        ' de "' + SolsticeHumanize.column(col, ctx.dictionary) + '"' +
        (desc.nulls ? ' (' + desc.nulls + ' nulos ignorados)' : '') + '.'));
      host.appendChild(header);

      // --- Descritivas ---
      host.appendChild(section('📊 Distribuição central'));
      host.appendChild(row('Média',   fmt(desc.mean),   'Soma dividida pela quantidade. Sensível a outliers.'));
      host.appendChild(row('Mediana', fmt(desc.median), 'Valor central quando ordenado. Robusto a outliers.'));
      host.appendChild(row('Desvio padrão', fmt(desc.stdDev), 'Quanto os valores variam em torno da média.'));

      host.appendChild(section('📏 Faixa e quartis'));
      host.appendChild(row('Mínimo',    fmt(desc.min)));
      host.appendChild(row('Q1 (25%)',  fmt(desc.q1), '25% dos valores estão abaixo deste ponto.'));
      host.appendChild(row('Q3 (75%)',  fmt(desc.q3), '75% dos valores estão abaixo deste ponto.'));
      host.appendChild(row('Máximo',    fmt(desc.max)));
      host.appendChild(row('IQR',       fmt(desc.iqr), 'Q3 − Q1. Faixa onde está o meio (50%) da distribuição.'));

      // --- Forma ---
      host.appendChild(section('🔍 Forma da distribuição'));
      const skTxt = desc.skewness == null ? '—' :
        (Math.abs(desc.skewness) < 0.2 ? 'Simétrica' :
         desc.skewness > 0 ? 'Cauda à direita (alguns valores muito altos)'
                           : 'Cauda à esquerda (alguns valores muito baixos)');
      host.appendChild(row('Assimetria', fmt(desc.skewness) + ' · ' + skTxt,
        'Skewness Pearson 3. Próximo de 0 = simétrica. >0 = cauda direita. <0 = cauda esquerda.'));
      const ktTxt = desc.kurtosis == null ? '—' :
        (Math.abs(desc.kurtosis) < 0.5 ? 'Normal-like' :
         desc.kurtosis > 0 ? 'Caudas pesadas (mais outliers do que normal)'
                           : 'Caudas leves (poucos outliers)');
      host.appendChild(row('Curtose', fmt(desc.kurtosis) + ' · ' + ktTxt,
        'Excesso de curtose (Fisher). 0 = normal. >0 = caudas pesadas. <0 = caudas leves.'));

      // --- Outliers ---
      host.appendChild(section('⚠️ Outliers'));
      host.appendChild(row('Detectados (IQR 1.5×)', desc.outlierCount + ' de ' + desc.n,
        'Valores fora de [Q1 − 1.5·IQR, Q3 + 1.5·IQR]. Regra de Tukey.'));
      const pctOut = desc.n ? (desc.outlierCount / desc.n * 100).toFixed(1) : '0';
      host.appendChild(row('% do total', pctOut + '%'));

      // --- Extras context-aware ---
      if (def.id === 'time-series'){
        const t = SolsticeStats.trend(values);
        if (t){
          host.appendChild(section('📈 Tendência'));
          const dirLabel = t.direction === 'up' ? '🔼 Subindo' : t.direction === 'down' ? '🔽 Descendo' : '➡️ Estável';
          host.appendChild(row('Direção', dirLabel,
            'Calculada via regressão linear sobre os valores ordenados.'));
          host.appendChild(row('Variação total', (t.totalChange > 0 ? '+' : '') + fmt(t.totalChange) +
            ' (' + fmt(t.magnitude * 100, 1) + '% da média)'));
          host.appendChild(row('R² da regressão', fmt(t.r2, 3),
            'Quanto a variação é explicada por uma linha reta. Próximo de 1 = tendência forte e linear.'));
          // Forecast 5 períodos à frente
          // ADR-182 (Fix-14 v5.5): honest text — Holt-Winters não é "via console",
          // está acessível na aba 🔬 Métodos quando série tem >= 24 pontos.
          const fc = SolsticeStats.linearForecast(values, 5);
          if (fc.length){
            const hint = values.length >= 24
              ? 'Projeção linear. Holt-Winters (com sazonalidade) disponível na aba 🔬 Métodos do Inspector.'
              : 'Projeção linear simples. Holt-Winters precisa ≥ 24 pontos (esta série tem ' + values.length + ').';
            host.appendChild(row('Próximos 5 (linear)', fc.map(v => fmt(v, 0)).join(' · '), hint));
          }
        }
      }

      if (def.id === 'scatter' && cfg.xColumn && cfg.yColumn){
        const xs = ctx.rows.map(r => SolsticeStats.parseNum(r[cfg.xColumn]));
        const ys = ctx.rows.map(r => SolsticeStats.parseNum(r[cfg.yColumn]));
        const r = SolsticeStats.correlation(xs, ys);
        const rho = SolsticeStats.correlationSpearman(xs, ys);
        host.appendChild(section('🔗 Correlação'));
        const strength = r == null ? '—' :
          Math.abs(r) >= 0.7 ? 'forte' : Math.abs(r) >= 0.4 ? 'moderada' : 'fraca';
        host.appendChild(row('Pearson (linear)', fmt(r, 3) + ' · ' + strength,
          'Mede correlação LINEAR. Entre -1 e 1.'));
        host.appendChild(row('Spearman (monotônica)', fmt(rho, 3),
          'Correlação por postos. Captura relações não-lineares mas monotônicas.'));
        if (r != null && rho != null && Math.abs(Math.abs(rho) - Math.abs(r)) > 0.15){
          host.appendChild(SolsticeUtils.el('div',
            { class:'solstice__stats-note' },
            '💡 |ρ| diferente de |r| sugere relação não-linear. Considere transformação log/raiz.'));
        }
      }

      if (def.id === 'gauge' && cfg.target != null){
        const m = SolsticeStats.mean(values);
        const dist = m - cfg.target;
        host.appendChild(section('🎯 Distância da meta'));
        host.appendChild(row('Meta', fmt(cfg.target)));
        host.appendChild(row('Atual (média)', fmt(m)));
        host.appendChild(row('Diferença', (dist >= 0 ? '+' : '') + fmt(dist) +
          ' (' + fmt(cfg.target ? Math.abs(dist / cfg.target * 100) : 0, 1) + '%)'));
      }

      if (def.id === 'boxplot' && cfg.groupColumn){
        // Estatísticas por grupo
        const groups = new Map();
        for (const r of ctx.rows){
          const v = SolsticeStats.parseNum(r[col]);
          if (isNaN(v)) continue;
          const g = String(r[cfg.groupColumn]);
          if (!groups.has(g)) groups.set(g, []);
          groups.get(g).push(v);
        }
        host.appendChild(section('📦 Por grupo'));
        Array.from(groups.entries()).slice(0, 6).forEach(([g, vs]) => {
          host.appendChild(row(g.length > 16 ? g.slice(0,15) + '…' : g,
            'med=' + fmt(SolsticeStats.median(vs)) + ' · n=' + vs.length));
        });
      }

      // --- Footer com link ao console ---
      host.appendChild(SolsticeUtils.el('div', { class:'solstice__stats-footer' },
        '🔬 Console: Solstice.Stats.describe(Solstice.Store.get(\'ingest\').rows.map(r => SolsticeStats.parseNum(r[\'' + col + '\']))) — reproduz estas métricas.'));
    }

    /**
     * ADR-162 (Camada 1 D5): aba Análise LEVE no Inspector.
     * Mostra resumo compacto (3-4 métricas) + botão que abre o drawer expandido
     * (SolsticeAnalysis · ADR-065). Reusa SolsticeStats.describe sem duplicar lógica.
     */
    function _renderAnalysisQuickInto(host, slot, def){
      const ctx = _ctx();
      // Heurística: pega coluna numérica primária do componente.
      const cfg = slot.config || {};
      const colName = cfg.column || cfg.valueColumn || cfg.yColumn || cfg.xColumn || null;
      const ingest = SolsticeStore.get('ingest') || {};
      const types = ingest.types || {};
      const colType = colName ? types[colName] : null;
      const isNumeric = colName && (colType === 'currency' || colType === 'number' || colType === 'percentage' || colType === 'integer');

      if (!colName || !isNumeric){
        host.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:var(--fs-xs);line-height:1.5;margin-bottom:var(--sp-2);' },
          'Configure uma coluna numérica na aba Dados para ver a análise estatística.'));
        host.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn',
          style:'width:100%;justify-content:center;',
          onclick: () => SolsticeAnalysis.open(slot.id)
        }, '🔍 Abrir drawer de análise'));
        return;
      }

      const values = (ctx.rows || []).map(r => SolsticeStats.parseNum(r[colName])).filter(v => !isNaN(v));
      if (values.length < 2){
        host.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:var(--fs-xs);line-height:1.5;margin-bottom:var(--sp-2);' },
          'Não há valores suficientes para análise (mínimo 2).'));
        return;
      }

      const d = SolsticeStats.describe(values) || {};
      const colLabel = SolsticeHumanize.column(colName, ctx.dictionary);

      const fmtNum = (v) => {
        if (v == null || isNaN(v)) return '—';
        if (Math.abs(v) >= 1000) return SolsticeLocale.integer(Math.round(v));
        return SolsticeLocale.decimal(v, 2).replace('.', ',');
      };

      // 3 cards compactos
      const cardsWrap = SolsticeUtils.el('div', { style:'display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2);margin-bottom:var(--sp-3);' });
      const card = (label, value, sub) => {
        const c = SolsticeUtils.el('div', { style:'padding:8px 10px;background:var(--c-surface-2);border-radius:var(--rad-sm);border:1px solid var(--c-border);' });
        c.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--c-muted);font-weight:var(--fw-semibold);' }, label));
        c.appendChild(SolsticeUtils.el('div', { style:'font-size:var(--fs-md);font-weight:var(--fw-semibold);color:var(--c-text);font-variant-numeric:tabular-nums;margin-top:2px;' }, value));
        if (sub) c.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-text-2);margin-top:2px;' }, sub));
        return c;
      };

      cardsWrap.appendChild(card('Média', fmtNum(d.mean), 'n = ' + values.length));
      cardsWrap.appendChild(card('Mediana', fmtNum(d.median), 'σ = ' + fmtNum(d.stdDev)));
      cardsWrap.appendChild(card('Faixa', fmtNum(d.min) + ' → ' + fmtNum(d.max)));
      // Outliers IQR 1.5
      const outl = SolsticeStats.outliersIQR ? SolsticeStats.outliersIQR(values) : { indices: [] };
      const outPct = values.length ? (outl.indices.length / values.length * 100) : 0;
      cardsWrap.appendChild(card('Outliers', outl.indices.length + ' (' + SolsticeLocale.decimal(outPct, 1).replace('.', ',') + '%)', 'via IQR 1.5×'));

      host.appendChild(SolsticeUtils.el('div', { style:'font-size:var(--fs-xs);color:var(--c-muted);margin-bottom:var(--sp-2);line-height:1.5;' },
        'Resumo de ' + colLabel + '. Para correlações, sazonalidade e forecast, abra a análise expandida.'));
      host.appendChild(cardsWrap);

      host.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--primary',
        style:'width:100%;justify-content:center;',
        onclick: () => SolsticeAnalysis.open(slot.id)
      }, '🔍 Ver análise expandida'));
    }

    function _renderDecisionsTab(host, slot){
      const entries = SolsticeAudit.list({ componentId: slot.id });
      if (!entries.length){
        host.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:var(--fs-xs);' },
          'Nenhuma decisão registrada para este componente ainda. Edite as propriedades para gerar entradas.'));
        return;
      }
      const list = SolsticeUtils.el('div', { class:'solstice__audit-list', style:'max-height:300px;' });
      entries.slice().reverse().slice(0, 10).forEach(e => {
        const card = SolsticeUtils.el('div', { class:'solstice__audit-entry' });
        card.appendChild(SolsticeUtils.el('div', { class:'solstice__audit-entry-action' }, e.action));
        card.appendChild(SolsticeUtils.el('div', { class:'solstice__audit-entry-meta' }, new Date(e.ts).toLocaleTimeString('pt-BR')));
        if (e.details){
          card.appendChild(SolsticeUtils.el('div', { class:'solstice__audit-entry-details' },
            JSON.stringify(e.details, null, 2)));
        }
        list.appendChild(card);
      });
      host.appendChild(list);
      host.appendChild(SolsticeUtils.el('button', { class:'solstice__btn', style:'margin-top:var(--sp-2);width:100%;',
        onclick: () => SolsticeAudit.openModal({ componentId: slot.id }) }, 'Ver todas no modal'));
    }

    /**
     * ADR-168 (Onda 3 / T7) — aba 🔬 Métodos.
     * Lista métodos estatísticos USADOS por este componente (baseado em
     * slot.type), com fórmula curta + assumption + opção de trocar quando
     * aplicável (Pearson↔Spearman, IQR 1.5↔3.0, etc.). Briefing v5.4:
     * "tema que mais diferencia o Solstice no mercado. Vale capricho."
     */
    /** Auditoria 2026 (RT-02): sub-função extraída de _renderMethodsTab.
        Monta o card de UM método: cabeçalho + fórmula + assumption + API +
        seletor de alternativas. Recebe `slot` para que o onchange do seletor
        possa persistir a escolha no slot.config. */
    function _buildMethodCard(m, slot){
      const card = SolsticeUtils.el('div', { style:'padding:10px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:6px;margin-bottom:8px;' });
      card.appendChild(SolsticeUtils.el('div', { style:'font-weight:var(--fw-semibold);font-size:var(--fs-sm);color:var(--c-text);margin-bottom:4px;' }, m.name));
      card.appendChild(SolsticeUtils.el('div', {
        style:'font-family:var(--font-mono);font-size:11px;color:var(--c-text-2);background:var(--c-surface);padding:4px 6px;border-radius:4px;margin-bottom:6px;word-break:break-word;'
      }, m.formula));
      if (m.assumption){
        card.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);line-height:1.4;margin-bottom:4px;' },
          '⚠ ' + m.assumption));
      }
      if (m.api){
        card.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;font-family:var(--font-mono);color:var(--c-muted);' },
          'API: ' + m.api));
      }
      if (Array.isArray(m.alternatives) && m.alternatives.length && m.settingKey){
        const sel = SolsticeUtils.el('select', {
          class:'solstice__props-select',
          style:'width:100%;margin-top:8px;font-size:12px;',
          onchange: (e) => {
            // Code Review 2026 (#2): substitui busca aninhada de section/row/slot
            // por SolsticeCanvas.withSlot — mesma semântica, sem boilerplate.
            SolsticeCanvas.withSlot(slot.id, sl => {
              sl.config = sl.config || {};
              sl.config[m.settingKey] = e.target.value;
            });
            try { SolsticeAudit.record({ action:'change_method', target: slot.id, details:{ method: m.name, settingKey: m.settingKey, value: e.target.value } }); } catch(_){}
            SolsticeToast.info('Método alterado', m.name + ' → ' + e.target.value);
          }
        });
        const currentVal = (slot.config && slot.config[m.settingKey]) || m.alternatives[0].value;
        m.alternatives.forEach(alt => {
          const opt = SolsticeUtils.el('option', { value: alt.value }, alt.label);
          if (alt.value === currentVal) opt.selected = true;
          sel.appendChild(opt);
        });
        card.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);margin-top:6px;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.04em;' }, 'Trocar método'));
        card.appendChild(sel);
      }
      return card;
    }

    function _renderMethodsTab(host, slot, def){
      // Cabeçalho explicativo
      host.appendChild(SolsticeUtils.el('div', {
        style:'color:var(--c-muted);font-size:var(--fs-xs);margin-bottom:var(--sp-3);line-height:1.5;'
      }, 'Métodos estatísticos usados por este componente. Toda regra, fórmula e premissa é explícita.'));

      // METHODS_BY_TYPE: mapa de slot.type → array de métodos aplicados
      const METHODS_BY_TYPE = {
        'kpi': [
          { name: 'Agregação', formula: 'agg(values) — sum/avg/median/min/max/count',
            assumption: 'Valores numéricos não-nulos. NaNs ignorados.',
            api: 'SolsticeStats.{sum,mean,median,min,max}' },
          { name: 'Δ% período', formula: '(atual - anterior) / anterior',
            assumption: 'Comparação válida só se ambos os períodos têm dados.',
            api: 'SolsticeStats.compareValues',
            condition: () => !!(slot.config && slot.config.comparison) }
        ],
        'time-series': [
          { name: 'Trend (regressão linear)', formula: 'y = β₀ + β₁·x · R²',
            assumption: 'Pontos suficientes (≥5). Variável dependente numérica.',
            api: 'SolsticeStats.linearRegression' },
          { name: 'Downsampling LTTB', formula: 'Largest Triangle Three Buckets',
            assumption: 'Aplicado quando rows > 2000 pra performance.',
            api: 'SolsticeStats.lttb',
            condition: () => true }
        ],
        'scatter': [
          { name: 'Correlação Pearson', formula: 'r = Σ((x-x̄)(y-ȳ)) / √(Σ(x-x̄)²·Σ(y-ȳ)²)',
            assumption: 'Relação linear entre X e Y. Sensível a outliers.',
            api: 'SolsticeStats.pearson',
            alternatives: [
              { value:'pearson', label:'Pearson (default)' },
              { value:'spearman', label:'Spearman (robusto a outliers, monotônico)' }
            ],
            settingKey: 'corrMethod' },
          { name: 'Downsampling 2D', formula: 'LTTB 2D · preserva outliers extremos',
            assumption: 'Mantém pontos sentinelas (min/max/outliers).',
            api: 'SolsticeStats.lttb2D' }
        ],
        'distribution': [
          { name: 'Bins (Sturges/Scott)', formula: 'k = ⌈log₂(n)⌉ + 1',
            assumption: 'Distribuição razoavelmente simétrica pra Sturges.',
            api: 'SolsticeStats.histogram' }
        ],
        'boxplot': [
          { name: 'Quartis (Q1, Q2, Q3)', formula: 'Tukey 5-number summary',
            assumption: 'Outliers = valor < Q1−k·IQR ou > Q3+k·IQR.',
            api: 'SolsticeStats.quartiles',
            alternatives: [
              { value:'1.5', label:'IQR × 1.5 (Tukey clássico)' },
              { value:'3.0', label:'IQR × 3.0 (só outliers extremos)' }
            ],
            settingKey: 'iqrMultiplier' }
        ],
        'gauge': [
          { name: 'Agregação', formula: 'agg(values) — geralmente avg/sum',
            assumption: 'Min/max/target manuais ou inferidos do dataset.',
            api: 'SolsticeStats.{mean,sum}' }
        ],
        'sankey': [
          { name: 'Agregação por par (source,target)', formula: 'Σ valueColumn agrupado por (s,t)',
            assumption: 'Categorias source/target finitas. Top-N pra grandes.',
            api: 'group + sum manual' }
        ],
        'pivot': [
          { name: 'Agregação cruzada', formula: 'agg(values) por (linha × coluna)',
            assumption: 'Cardinalidade aceitável (< 100×100). Heatmap opcional.',
            api: 'SolsticeStats.pivot' }
        ],
        'table': [
          { name: 'Agregação grouped (opcional)', formula: 'agg(values) por groupBy column',
            assumption: 'Top-N controlado por rowLimit. Drill-down hierárquico via mode=drill.',
            api: 'manual group + sort' }
        ],
        'heatmap-cal': [
          { name: 'Agregação por dia', formula: 'agg(values) bucketed por dt::date',
            assumption: 'Coluna temporal válida. Lacunas viram cinza.',
            api: 'SolsticeStats.{sum,mean,count}' }
        ]
      };

      const methods = METHODS_BY_TYPE[slot.type] || [];
      if (!methods.length){
        host.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:var(--fs-xs);font-style:italic;' },
          'Este tipo de componente não usa métodos estatísticos explícitos.'));
        return;
      }

      // Auditoria 2026 (RT-02): renderização extraída em 3 sub-funções.
      methods.forEach(m => {
        if (typeof m.condition === 'function' && !m.condition()) return;
        host.appendChild(_buildMethodCard(m, slot));
      });
      _renderRecommenderProvenance(host, slot);
      _renderInferenceAuditSection(host, slot);
    }

    /** Auditoria 2026 (RT-02): seção "Recommender — regra que gerou este componente". */
    function _renderRecommenderProvenance(host, slot){
      const decisions = (typeof SolsticeAudit !== 'undefined' && SolsticeAudit.records)
        ? SolsticeAudit.records().filter(r => r.target === slot.id && r.action === 'auto_dashboard') : [];
      if (!decisions.length) return;
      host.appendChild(SolsticeUtils.el('div', { style:'margin-top:var(--sp-3);font-size:10px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;' }, 'Recommender — regra que gerou este componente'));
      const last = decisions[decisions.length - 1];
      const ruleCard = SolsticeUtils.el('div', { style:'padding:8px;background:color-mix(in srgb, var(--c-info) 8%, var(--c-surface-2));border-radius:6px;font-size:11px;font-family:var(--font-mono);color:var(--c-text-2);' });
      ruleCard.textContent = JSON.stringify(last.details || {}, null, 2);
      host.appendChild(ruleCard);
    }

    /** Auditoria 2026 (RT-02): seção "Inferência semântica das colunas". */
    function _renderInferenceAuditSection(host, slot){
      const cfg = slot.config || {};
      const colsUsed = [];
      ['column','xColumn','yColumn','valueColumn','sourceColumn','targetColumn','groupColumn','sizeColumn','dateColumn','groupBy'].forEach(k => {
        if (typeof cfg[k] === 'string' && cfg[k]) colsUsed.push({ key: k, name: cfg[k] });
      });
      if (!colsUsed.length || typeof SolsticeInference === 'undefined') return;
      host.appendChild(SolsticeUtils.el('div', {
        style:'margin-top:var(--sp-4);font-size:10px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;'
      }, 'Inferência semântica das colunas (audit trail)'));
      colsUsed.forEach(({ key, name }) => host.appendChild(_buildInferenceAuditCard(key, name, slot)));
    }

    /** Auditoria 2026 (RT-02): card de UMA coluna no audit trail de inferência. */
    function _buildInferenceAuditCard(key, name, slot){
      const audit = SolsticeInference.lastAuditFor(name);
      const card = SolsticeUtils.el('div', {
        style:'padding:10px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:6px;margin-bottom:8px;'
      });
      // Header
      const head = SolsticeUtils.el('div', { style:'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;' });
      head.appendChild(SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:2px;' },
        SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);text-transform:uppercase;' }, key),
        SolsticeUtils.el('div', { style:'font-family:var(--font-mono);font-size:12px;color:var(--c-text);font-weight:var(--fw-semibold);' }, name)
      ));
      if (audit){
        const winnerEl = SolsticeUtils.el('div', { style:'font-size:11px;text-align:right;' });
        winnerEl.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-accent);font-weight:var(--fw-semibold);' },
          (audit.winner || '∅') + ' / ' + audit.type));
        winnerEl.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:10px;' },
          audit.fallback_used ? 'fallback ' : '',
          'conf ' + Math.round((audit.confidence || 0) * 100) + '%'));
        head.appendChild(winnerEl);
      }
      card.appendChild(head);
      if (!audit){
        card.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);font-style:italic;' },
          'Nenhuma inferência rodou — importe um CSV primeiro.'));
        return card;
      }
      // Tokens
      card.appendChild(SolsticeUtils.el('div', {
        style:'font-size:10px;font-family:var(--font-mono);color:var(--c-muted);margin-bottom:4px;'
      }, 'tokens: [' + audit.tokens.join(', ') + ']' +
          (audit.unit_hints && audit.unit_hints.length ? ' · units: [' + audit.unit_hints.join(',') + ']' : '')));
      // Top 3 candidates
      const candList = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:2px;font-family:var(--font-mono);font-size:11px;margin-top:6px;' });
      (audit.candidates || []).slice(0, 3).forEach((c) => {
        const isWinner = c.concept_id === audit.winner;
        const row = SolsticeUtils.el('div', {
          style:'display:flex;justify-content:space-between;padding:3px 6px;border-radius:3px;' +
            (isWinner ? 'background:color-mix(in srgb, var(--c-success) 18%, var(--c-surface));color:var(--c-text);font-weight:var(--fw-semibold);' : 'color:var(--c-text-2);')
        });
        row.appendChild(SolsticeUtils.el('span', null, (isWinner ? '✓ ' : '  ') + c.concept_id));
        row.appendChild(SolsticeUtils.el('span', null, String(c.score)));
        candList.appendChild(row);
      });
      card.appendChild(candList);
      // Learning bonus
      let bonus = 0;
      try {
        if (audit.winner && typeof SolsticeLearning !== 'undefined' && SolsticeLearning.getBonusForConcept){
          bonus = SolsticeLearning.getBonusForConcept(name, audit.winner) || 0;
        }
      } catch(_){}
      if (bonus > 0){
        card.appendChild(SolsticeUtils.el('div', {
          style:'margin-top:6px;padding:4px 8px;background:color-mix(in srgb, var(--c-warn) 14%, var(--c-surface));border-radius:4px;font-size:11px;color:var(--c-text);'
        }, '⭐ Aprendizado local aplicado: +' + bonus + 'pt'));
      }
      // Botão "Corrigir tipo"
      const correctBtn = SolsticeUtils.el('button', {
        class:'solstice__btn',
        style:'margin-top:8px;width:100%;font-size:12px;',
        onclick: async () => {
          const conceptOpts = SolsticeConcepts.list().map(c => ({
            value: c.id, label: c.id + ' → ' + c.type, icon:'',
            desc: c.anchors.slice(0, 4).join(', ')
          }));
          const choice = await SolsticeModal.select({
            title: 'Corrigir inferência de "' + name + '"',
            message: 'Escolha o conceito correto. O sistema aprende: na próxima coluna com tokens parecidos, esse conceito ganha bonus de +20 a +40 no scoring.',
            options: conceptOpts,
            defaultValue: audit.winner,
            confirmLabel: 'Corrigir',
            searchable: 'auto'
          });
          if (!choice || choice === audit.winner) return;
          const newConcept = SolsticeConcepts.get(choice);
          SolsticeLearning.recordCorrection(name, audit.type, newConcept.type, choice);
          SolsticeInference.clearAudit();
          SolsticeToast.success('⭐ Aprendizado registrado',
            'Próxima coluna com tokens "' + audit.tokens.slice(0,3).join('/') + '" usa ' + choice);
          setTimeout(() => SolsticeProps.select(slot.id), 100);
        }
      }, '✏️ Corrigir conceito desta coluna');
      card.appendChild(correctBtn);
      return card;
    }

    function _renderProvenanceTab(host, slot){
      host.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:var(--fs-xs);margin-bottom:var(--sp-2);' },
        '🔬 De onde vem o número renderizado por este componente.'));
      host.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', style:'width:100%;',
        onclick: () => SolsticeAudit.openProvenance(slot.id) }, '🔬 Abrir Provenance Trail'));
    }

    function init(){
      // ADR-162 (Camada 1 D5): migração leve da chave de accordion
      // 'ui.accordion.inspector.visual' → 'ui.accordion.inspector.estilo'.
      // Só copia se a nova chave estiver vazia (não sobrescreve preferência atual).
      try {
        const oldVal = SolsticeStore.get('ui.accordion.inspector.visual');
        const newVal = SolsticeStore.get('ui.accordion.inspector.estilo');
        if (oldVal != null && newVal == null){
          SolsticeStore.set('ui.accordion.inspector.estilo', oldVal);
        }
      } catch(_){ /* silencioso */ }

      // Polish v7: detecta "style quick update" e evita re-render total do Inspector.
      // Sem isso, qualquer clique em paleta/preset destruía+recriava 200+ nodes
      // do Inspector causando o tremor que o Lucas reportou.
      function _quickUpdateStyleState(){
        if (!selectedId) return;
        const slot = _findSlot(selectedId);
        if (!slot) return;
        const style = (slot.config && slot.config.style) || {};
        // Atualiza is-active dos preset cards
        const curPreset = style.preset || 'default';
        document.querySelectorAll('.solstice__style-preset-card[data-preset-key]').forEach(card => {
          card.classList.toggle('is-active', card.getAttribute('data-preset-key') === curPreset);
        });
        // Atualiza is-active dos palette cards
        const curPalette = style.palette || 'auto';
        document.querySelectorAll('.solstice__style-palette[data-palette-key]').forEach(card => {
          card.classList.toggle('is-active', card.getAttribute('data-palette-key') === curPalette);
        });
      }

      SolsticeStore.subscribe('canvas.sections', () => {
        // Se o slot selecionado deixou de existir, deseleciona
        if (selectedId && !_findSlot(selectedId)) { deselect(); return; }

        // Polish v7: se a última mudança veio de _set/_setMany do MESMO slot
        // selecionado dentro dos últimos 200ms, é uma mudança de style.
        // Faz update parcial em vez de render() completo.
        const q = window.__solsticeStyleQuickUpdate;
        if (q && q.slotId === selectedId && (Date.now() - q.ts) < 200){
          window.__solsticeStyleQuickUpdate = null;
          _quickUpdateStyleState();
          if (selectedId) _markSelected(selectedId);
          return;
        }

        // Auditoria 2026.6 (SMOOTH-INSPECTOR): mudança de DADOS só-valor (agg, bin,
        // limite...) — o controle já mostra o novo valor; pula o rebuild do
        // inspector pra não piscar/perder foco. Só reconstrói quando a mudança
        // revela/esconde campos (estrutural) ou veio de fora do inspector.
        const cq = window.__solsticeConfigQuickUpdate;
        if (cq && cq.slotId === selectedId && (Date.now() - cq.ts) < 300){
          window.__solsticeConfigQuickUpdate = null;
          if (!cq.structural){ if (selectedId) _markSelected(selectedId); return; }
        }
        window.__solsticeConfigQuickUpdate = null;

        render();
        if (selectedId) _markSelected(selectedId);
      });
    }

    return { select, deselect, render, init };
  })();
