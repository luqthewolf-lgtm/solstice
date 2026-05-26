
  /* ============================================================
     S6-01 (Sprint 6) — SolsticeExecutiveInsights
     Seção colapsável de "Insights Executivo" — narrativa de negócio.
     Diferente do SolsticeInsights (lista de cards):
       - Foca em 3-5 bullets de DECISÃO (não diagnóstico)
       - Linguagem business: "Sul cresceu 23% em receita" não
         "trend.r2=0.74"
       - Renderiza ACIMA do painel Insights regular
       - Hideable via ui.executive.hidden
       - Pode ser fechada SEM esconder permanentemente (toggle inline)
     ============================================================ */
  const SolsticeExecutiveInsights = (function(){

    /** Sintetiza top N insights de negócio em frases executivas. */
    function compute(){
      if (typeof SolsticeInsights === 'undefined') return [];
      const all = SolsticeInsights.compute();
      // Filtra só insights de NEGÓCIO (não técnicos) ordenados por score
      const business = all
        .filter(i => {
          // Heurística: kind business OU score >= 40
          const kind = i.kind || '';
          const tech = ['outliers','correlation','completeness','cardinality','distribution','monotonic','duplicates','missing'];
          return tech.indexOf(kind) < 0;
        })
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);
      // Converte cada insight em uma frase executiva
      return business.map(i => {
        const txt = String(i.text || '').replace(/^[💡🔥📈📉⚠️🎯⭐✨]+\s*/, '');
        return {
          id: i.id,
          icon: i.icon || '•',
          title: i.title,
          summary: txt,
          severity: i.severity || 'info'
        };
      });
    }

    function renderInto(parentEl){
      if (!parentEl) return;
      if (SolsticeStore.get('ui.executive.hidden') === true) return;
      const items = compute();
      // Auditoria 2026.2 (BR-A2): se não há business insights mas há dataset,
      // mostra fallback explicativo em vez de não renderizar. Antes o painel
      // sumia silenciosamente — usuário não sabia se a IA tinha sido executada.
      if (!items.length){
        const dsReady = !!SolsticeStore.get('dataset.ready');
        if (!dsReady) return;
        const allInsights = (typeof SolsticeInsights !== 'undefined') ? SolsticeInsights.compute() : [];
        const onlyTech = allInsights.length > 0;
        const fallback = SolsticeUtils.el('div', {
          class: 'solstice__executive',
          style: 'background: var(--c-surface-2);' +
                 'border: 1px dashed var(--c-border);' +
                 'border-radius: var(--rad-md); margin-bottom: var(--sp-3);' +
                 'padding: 12px 14px; font-size: 12px; color: var(--c-text-2); line-height: 1.5;'
        });
        fallback.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true', style:'font-size:14px;margin-right:6px;' }, '📈'));
        fallback.appendChild(SolsticeUtils.el('span', { style:'font-weight:600;color:var(--c-text);' }, 'Insights Executivo'));
        fallback.appendChild(SolsticeUtils.el('span', null,
          onlyTech
            ? ' — nada de negócio para destacar agora. A análise técnica está em "Insights" → aba Qualidade/base.'
            : ' — sem destaques relevantes neste dataset. Adicione KPIs ou tente outra base para gerar a narrativa executiva.'));
        parentEl.appendChild(fallback);
        return;
      }

      const isCollapsed = !!SolsticeStore.get('ui.executive.collapsed');
      const wrap = SolsticeUtils.el('div', {
        class: 'solstice__executive' + (isCollapsed ? ' is-collapsed' : ''),
        style: 'background: color-mix(in srgb, var(--c-accent) 6%, var(--c-surface));' +
               'border: 1px solid color-mix(in srgb, var(--c-accent) 25%, var(--c-border));' +
               'border-radius: var(--rad-md); margin-bottom: var(--sp-3);' +
               'overflow: hidden;'
      });

      const head = SolsticeUtils.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;border-bottom: 1px solid color-mix(in srgb, var(--c-accent) 15%, transparent);user-select:none;',
        onclick: () => {
          const collapsed = wrap.classList.toggle('is-collapsed');
          SolsticeStore.set('ui.executive.collapsed', collapsed);
          body.style.display = collapsed ? 'none' : 'block';
          toggle.textContent = collapsed ? '▶' : '▼';
        }
      });
      const titleWrap = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:8px;' });
      titleWrap.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true', style:'font-size:16px;' }, '📈'));
      titleWrap.appendChild(SolsticeUtils.el('span', { style:'font-weight:600;font-size:13px;color:var(--c-text);' }, 'Insights Executivo'));
      titleWrap.appendChild(SolsticeUtils.el('span', { style:'font-size:11px;color:var(--c-muted);font-weight:normal;' },
        items.length + ' destaque' + (items.length > 1 ? 's' : '')));
      head.appendChild(titleWrap);

      const actions = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:4px;' });
      const hideBtn = SolsticeUtils.el('button', {
        type:'button',
        title: 'Esconder permanentemente (reabilita em Configurações)',
        'aria-label':'Esconder Insights Executivo',
        style:'background:transparent;border:none;color:var(--c-muted);cursor:pointer;font-size:12px;padding:2px 6px;border-radius:3px;',
        onclick: (e) => {
          e.stopPropagation();
          SolsticeStore.set('ui.executive.hidden', true);
          if (typeof SolsticeCanvas !== 'undefined' && SolsticeCanvas.render) SolsticeCanvas.render();
          SolsticeToast.info('Insights Executivo ocultos', 'Reabilite em Configurações.');
        }
      }, '✕');
      const toggle = SolsticeUtils.el('span', { style:'color:var(--c-muted);font-size:10px;' }, isCollapsed ? '▶' : '▼');
      actions.appendChild(hideBtn);
      actions.appendChild(toggle);
      head.appendChild(actions);
      wrap.appendChild(head);

      const body = SolsticeUtils.el('div', { style: 'padding: 10px 14px;' + (isCollapsed ? 'display:none;' : '') });
      items.forEach(item => {
        const sevColor = item.severity === 'error' ? 'var(--c-error)'
                       : item.severity === 'warn' ? 'var(--c-warn)'
                       : item.severity === 'success' ? 'var(--c-success)'
                       : 'var(--c-accent)';
        const row = SolsticeUtils.el('div', {
          style: 'display:flex;gap:10px;padding:6px 0;align-items:flex-start;'
        });
        row.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true', style:'font-size:14px;flex-shrink:0;width:20px;text-align:center;color:' + sevColor + ';' }, item.icon));
        const txt = SolsticeUtils.el('div', { style:'flex:1;font-size:12px;line-height:1.5;color:var(--c-text);' });
        if (item.title) txt.appendChild(SolsticeUtils.el('span', { style:'font-weight:600;' }, item.title + (item.summary ? ' — ' : '')));
        if (item.summary) txt.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-text-2);' }, item.summary));
        row.appendChild(txt);
        body.appendChild(row);
      });
      // Auditoria 2026.2: link "Ver insights completos" no rodapé do executivo.
      // Atalho pro painel detalhado (Negócio + Qualidade).
      const footer = SolsticeUtils.el('div', {
        style:'padding:6px 14px 10px 14px;border-top:1px solid color-mix(in srgb, var(--c-accent) 12%, transparent);margin-top:4px;display:flex;justify-content:flex-end;'
      });
      const moreBtn = SolsticeUtils.el('button', {
        type:'button',
        style:'background:transparent;border:none;color:var(--c-accent);font-size:11px;cursor:pointer;padding:2px 4px;font-weight:600;',
        title:'Pular para o painel Insights completo (Negócio + Qualidade)',
        onclick: (e) => {
          e.stopPropagation();
          SolsticeStore.set('ui.insights.collapsed', false);
          const el = document.querySelector('.solstice__insights');
          if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
        }
      }, 'Ver insights completos →');
      footer.appendChild(moreBtn);
      body.appendChild(footer);
      wrap.appendChild(body);
      parentEl.appendChild(wrap);
    }

    function init(){
      // Re-render quando dataset muda
      SolsticeStore.subscribe('ingest', () => {
        if (typeof SolsticeCanvas !== 'undefined' && SolsticeCanvas.render) SolsticeCanvas.render();
      });
    }

    return { compute, renderInto, init };
  })();
