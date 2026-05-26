
  /* ============================================================
     SolsticeMinimap — outline SVG/DIV fixed no canto inferior direito.
     Cada section vira retângulo. Click na section rola canvas até ela.
     ============================================================ */
  const SolsticeMinimap = (function(){
    let collapsed = false;
    let elRoot = null;

    // Auditoria 2026 (U-9): minimap agora é OPT-IN via Settings.
    // Chave persistida: localStorage.solstice.settings.minimap.enabled
    // (espelhada em SolsticeStore para reatividade). Default: false.
    function isEnabled(){
      // Prioridade: Store > localStorage > default false
      const fromStore = SolsticeStore.get('settings.minimap.enabled');
      if (fromStore != null) return !!fromStore;
      try {
        const ls = localStorage.getItem('solstice.settings.minimap.enabled');
        if (ls != null) return ls === 'true';
      } catch(_){}
      return false;
    }
    function setEnabled(on){
      const val = !!on;
      SolsticeStore.set('settings.minimap.enabled', val);
      // Auditoria 2026 (AP-02): silent — toggle de UX, recupera por Store no boot.
      SolsticeStorage.safeSet('solstice.settings.minimap.enabled', String(val), { silent: true });
      if (val){
        render();
      } else {
        if (elRoot){ elRoot.remove(); elRoot = null; }
      }
    }

    function ensure(){
      if (elRoot) return elRoot;
      elRoot = SolsticeUtils.el('div', { class:'solstice__minimap', id:'minimap' });
      document.body.appendChild(elRoot);
      return elRoot;
    }

    function render(){
      // Auditoria 2026 (U-9): respeita o opt-in. Quando desabilitado,
      // garante que o elemento não está no DOM.
      if (!isEnabled()){
        if (elRoot){ elRoot.remove(); elRoot = null; }
        return;
      }
      const root = ensure();
      const sections = SolsticeStore.get('canvas.sections') || [];
      // Esconde se não há seções
      root.classList.toggle('solstice__hidden', sections.length === 0);
      root.classList.toggle('solstice__minimap-collapsed', collapsed);

      // Auditoria 2026 (MC-01): cleanup defensivo antes de repintar minimap.
      SolsticeUtils.cleanupListeners(root);
      root.innerHTML = '';
      const head = SolsticeUtils.el('div', { class:'solstice__minimap-head' },
        SolsticeUtils.el('span', null, '🗺️ ' + sections.length + (sections.length === 1 ? ' seção' : ' seções')),
        SolsticeUtils.el('button', {
          class:'solstice__minimap-toggle',
          title: collapsed ? 'Expandir minimap' : 'Recolher minimap',
          onclick: () => { collapsed = !collapsed; render(); }
        }, collapsed ? '▢' : '▭')
      );
      root.appendChild(head);

      if (collapsed) return;

      const canvas = SolsticeUtils.el('div', { class:'solstice__minimap-canvas' });
      sections.forEach(sec => {
        const sCard = SolsticeUtils.el('div', {
          class:'solstice__minimap-section',
          title:'Ir para "' + sec.title + '"',
          onclick: () => _scrollToSection(sec.id)
        });
        sCard.appendChild(SolsticeUtils.el('div', { class:'solstice__minimap-section-title' }, sec.title));
        sec.rows.forEach(r => {
          const rowEl = SolsticeUtils.el('div', { class:'solstice__minimap-row' });
          (r.slots || []).forEach(() => rowEl.appendChild(SolsticeUtils.el('div', { class:'solstice__minimap-slot' })));
          sCard.appendChild(rowEl);
        });
        canvas.appendChild(sCard);
      });
      root.appendChild(canvas);
    }

    function _scrollToSection(secId){
      const el = document.querySelector('.solstice__section[data-id="'+secId+'"]');
      if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
    }

    function init(){
      // Não força o render no boot — respeita opt-in.
      if (isEnabled()) render();
      SolsticeStore.subscribe('canvas.sections', render);
      SolsticeStore.subscribe('settings.minimap.enabled', render);
    }

    return { init, render, isEnabled, setEnabled, toggle: () => { collapsed = !collapsed; render(); } };
  })();
