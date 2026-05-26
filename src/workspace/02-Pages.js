
  /* ============================================================
     Prompt 11 v5.4 — SolsticePages
     Multi-páginas dentro de um único dashboard. Estrutura nova:
       canvas: {
         activeId: 'page_X',
         pages: [
           { id, name, icon, sections: [...] }
         ]
       }
     Mantém ALIAS `canvas.sections` apontando para a página ativa.
     Quando user troca página → swap canvas.sections + render.
     Snapshots antigos migrados via SolsticeMigrations.multipage_v54.
     ============================================================ */
  const SolsticePages = (function(){
    const DEFAULT_ICONS = ['📊', '📈', '📉', '🔍', '⚠️', '✨', '🎯', '🧪', '💼', '📋'];

    function _getCanvas(){
      let canvas = SolsticeStore.get('canvas') || {};
      if (!Array.isArray(canvas.pages) || !canvas.pages.length){
        // Auto-criação: se há sections sem páginas, empacota
        const sections = canvas.sections || [];
        const pageId = 'page_' + Date.now().toString(36);
        canvas = {
          ...canvas,
          pages: [{ id: pageId, name: 'Página 1', icon: '📊', sections }],
          activeId: pageId
        };
        SolsticeStore.set('canvas', canvas);
      }
      return canvas;
    }

    function list(){ return _getCanvas().pages.slice(); }
    function current(){
      const c = _getCanvas();
      return c.pages.find(p => p.id === c.activeId) || c.pages[0];
    }
    function activeId(){ return _getCanvas().activeId; }

    /** Salva sections atual na página ativa, troca para outra. */
    function switchTo(pageId){
      const c = _getCanvas();
      const target = c.pages.find(p => p.id === pageId);
      if (!target) return false;
      // 1. Persiste sections atuais na página que está saindo
      const currentSections = SolsticeStore.get('canvas.sections') || [];
      const curIdx = c.pages.findIndex(p => p.id === c.activeId);
      if (curIdx >= 0) c.pages[curIdx].sections = currentSections;
      // 2. Atualiza activeId e seta sections novas
      c.activeId = pageId;
      SolsticeStore.batch(() => {
        SolsticeStore.set('canvas', c);
        SolsticeStore.set('canvas.sections', target.sections || []);
      });
      try {
        if (typeof SolsticeAudit !== 'undefined') SolsticeAudit.record({
          action: 'page_switch', target: pageId, details: { name: target.name }
        });
      } catch(_){}
      return true;
    }

    function create(opts){
      opts = opts || {};
      const c = _getCanvas();
      // Persiste sections atuais primeiro
      const currentSections = SolsticeStore.get('canvas.sections') || [];
      const curIdx = c.pages.findIndex(p => p.id === c.activeId);
      if (curIdx >= 0) c.pages[curIdx].sections = currentSections;

      const newId = 'page_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1000);
      const newPage = {
        id: newId,
        name: opts.name || ('Página ' + (c.pages.length + 1)),
        icon: opts.icon || DEFAULT_ICONS[c.pages.length % DEFAULT_ICONS.length],
        sections: opts.sections || []
      };
      c.pages.push(newPage);
      c.activeId = newId;
      SolsticeStore.batch(() => {
        SolsticeStore.set('canvas', c);
        SolsticeStore.set('canvas.sections', newPage.sections);
      });
      try {
        if (typeof SolsticeAudit !== 'undefined') SolsticeAudit.record({
          action: 'page_create', target: newId, details: { name: newPage.name }
        });
      } catch(_){}
      return newPage;
    }

    function rename(pageId, newName){
      const c = _getCanvas();
      const p = c.pages.find(p => p.id === pageId);
      if (!p) return false;
      p.name = newName;
      SolsticeStore.set('canvas', c);
      try { SolsticeAudit.record({ action: 'page_rename', target: pageId, details: { name: newName } }); } catch(_){}
      return true;
    }

    function duplicate(pageId){
      const c = _getCanvas();
      const src = c.pages.find(p => p.id === pageId);
      if (!src) return null;
      // Se duplicando a ativa, primeiro persiste sections atuais
      if (pageId === c.activeId){
        src.sections = SolsticeStore.get('canvas.sections') || src.sections;
      }
      const newId = 'page_' + Date.now().toString(36);
      const newPage = {
        id: newId,
        name: src.name + ' (cópia)',
        icon: src.icon,
        sections: SolsticeUtils.deepClone(src.sections || [])
      };
      c.pages.push(newPage);
      c.activeId = newId;
      SolsticeStore.batch(() => {
        SolsticeStore.set('canvas', c);
        SolsticeStore.set('canvas.sections', newPage.sections);
      });
      try { SolsticeAudit.record({ action: 'page_duplicate', target: newId, details: { fromId: pageId } }); } catch(_){}
      return newPage;
    }

    function remove(pageId){
      const c = _getCanvas();
      if (c.pages.length === 1) return false; // não permite remover última
      const idx = c.pages.findIndex(p => p.id === pageId);
      if (idx < 0) return false;
      const removed = c.pages.splice(idx, 1)[0];
      // Se removeu a ativa, vai pra anterior (ou primeira)
      if (c.activeId === pageId){
        const nextIdx = Math.max(0, idx - 1);
        c.activeId = c.pages[nextIdx].id;
        SolsticeStore.batch(() => {
          SolsticeStore.set('canvas', c);
          SolsticeStore.set('canvas.sections', c.pages[nextIdx].sections || []);
        });
      } else {
        SolsticeStore.set('canvas', c);
      }
      try { SolsticeAudit.record({ action: 'page_remove', target: pageId, details: { name: removed.name } }); } catch(_){}
      return true;
    }

    function reorder(pageId, newIndex){
      const c = _getCanvas();
      const oldIdx = c.pages.findIndex(p => p.id === pageId);
      if (oldIdx < 0 || newIndex < 0 || newIndex >= c.pages.length) return false;
      const [p] = c.pages.splice(oldIdx, 1);
      c.pages.splice(newIndex, 0, p);
      SolsticeStore.set('canvas', c);
      return true;
    }

    /** Sync: quando 'canvas.sections' muda DE FORA, propaga pra página ativa
     *  na estrutura canvas.pages. Evita perda em snapshots/exports. */
    function _initSync(){
      try {
        SolsticeStore.subscribe('canvas.sections', () => {
          const c = SolsticeStore.get('canvas') || {};
          if (!Array.isArray(c.pages) || !c.activeId) return;
          const idx = c.pages.findIndex(p => p.id === c.activeId);
          if (idx >= 0){
            // Atualiza sections da página ativa SEM disparar subscribe novamente
            // (set silencioso: comparação por referência)
            c.pages[idx].sections = SolsticeStore.get('canvas.sections') || [];
          }
        });
      } catch(_){}
    }

    return { list, current, activeId, switchTo, create, rename, duplicate, remove, reorder, _initSync };
  })();
