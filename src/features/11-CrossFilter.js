
  /* ============================================================
     BLOCO 9 — SolsticeCrossFilter
     Filtro temporário disparado por clique em ponto/categoria/barra.
     Não persiste igual aos filtros globais — é "destaque" único.
     Mostra barra azul no topo "Cross-filter ativo: X = Y · ✕ Limpar".
     ============================================================ */
  const SolsticeCrossFilter = (function(){

    function activate(column, value, opts){
      // Auditoria 2026.6 (XFILTER-BIN): gráficos temporais (distrib-time/série)
      // clicam num BIN ("2024-01"), mas a coluna tem datas completas. opts.bin
      // (day/week/month/year) faz o filtro casar por PERÍODO, não match exato.
      SolsticeStore.set('crossfilter', { column, value, bin: (opts && opts.bin) || null });
      SolsticeAudit && SolsticeAudit.record && SolsticeAudit.record({
        action: 'crossfilter', target: column, details: { column, value, bin: (opts && opts.bin) || null }
      });
    }
    function clear(){ SolsticeStore.set('crossfilter', null); }
    function get(){ return SolsticeStore.get('crossfilter'); }
    function isActive(){ const c = get(); return !!(c && c.column != null && c.value != null); }

    /** Render bar do crossfilter ativo (acima da barra de filtros). */
    function renderInto(parentEl){
      if (!parentEl) return;
      const c = get();
      if (!c || c.column == null || c.value == null) return;
      const dict = SolsticeStore.get('dictionary');
      const bar = SolsticeUtils.el('div', { class:'solstice__crossfilter-bar' });
      const txt = SolsticeUtils.el('div', { class:'solstice__crossfilter-bar-text' });
      txt.appendChild(SolsticeUtils.el('span', null, '🎯'));
      txt.appendChild(SolsticeUtils.el('span', null,
        'Cross-filter: ' + SolsticeHumanize.column(c.column, dict) + ' = '));
      txt.appendChild(SolsticeUtils.el('strong', null, String(c.value)));
      bar.appendChild(txt);
      bar.appendChild(SolsticeUtils.el('button',
        { class:'solstice__crossfilter-bar-clear', onclick: clear }, '✕ Limpar'));
      parentEl.appendChild(bar);
    }

    function init(){
      // Esc limpa cross-filter (cascata depois de drawer/inspector)
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (document.querySelector('.solstice__modal-overlay')) return;
        if (SolsticeAnalysis && SolsticeAnalysis.isOpen && SolsticeAnalysis.isOpen()) return;
        if (SolsticeInspector && SolsticeInspector.isOpen && SolsticeInspector.isOpen()) return;
        if (isActive()){ clear(); e.preventDefault(); }
      });
    }

    return { activate, clear, get, isActive, renderInto, init };
  })();
