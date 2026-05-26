
  /* ============================================================
     B4-01 (v6-autonomous / PW-03 — Augusto power user) — SolsticeSavedViews
     Views salvas LEVES (vs SolsticeSnapshots que captura estado COMPLETO
     e vs SolsticeViews que persiste por workspace em ingest.savedViews).
     Uma View memoriza só preferências de visualização:
       • filtros globais
       • cross-filter ativo
       • página ativa (multi-page)
       • collapsed states (insights, filterbar)

     Caso de uso: analista que vive 5h/dia no produto, alterna entre
     visões "Mensal", "Por região Sul", "Top 10 clientes". Cada uma é
     1 click pra restaurar.

     IMPORTANTE: renomeado de SolsticeViews → SolsticeSavedViews para
     evitar conflito com módulo existente (Patch Final ADR-141) que
     também se chama SolsticeViews mas persiste em ingest.savedViews.

     API:
       SolsticeSavedViews.list()                   → array<{id, name, savedAt}>
       SolsticeSavedViews.save(name)               → cria view nova
       SolsticeSavedViews.apply(id)                → restaura filtros/página
       SolsticeSavedViews.remove(id)               → deleta
       SolsticeSavedViews.rename(id, newName)      → renomeia
     ============================================================ */
  const SolsticeSavedViews = (function(){
    const STORAGE_KEY = 'solstice.views.v1';

    function _read(){
      try {
        const raw = (typeof SolsticeStorage !== 'undefined' && SolsticeStorage.safeGet)
          ? SolsticeStorage.safeGet(STORAGE_KEY)
          : localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch(_){ return []; }
    }

    function _write(arr){
      try {
        const json = JSON.stringify(arr);
        if (typeof SolsticeStorage !== 'undefined' && SolsticeStorage.safeSet){
          SolsticeStorage.safeSet(STORAGE_KEY, json);
        } else {
          localStorage.setItem(STORAGE_KEY, json);
        }
        return true;
      } catch(_){ return false; }
    }

    function _captureState(){
      const state = {
        filters: SolsticeStore.get('filters') || {},
        crossfilter: SolsticeStore.get('crossfilter') || null
      };
      try {
        if (typeof SolsticePages !== 'undefined' && SolsticePages.activeId){
          state.pageId = SolsticePages.activeId();
        }
      } catch(_){}
      try {
        state.ui = {
          insightsCollapsed: !!SolsticeStore.get('ui.insights.collapsed'),
          filtersCollapsed: !!SolsticeStore.get('ui.filters.collapsed')
        };
      } catch(_){}
      return state;
    }

    function list(){
      return _read().map(v => ({ id: v.id, name: v.name, savedAt: v.savedAt }));
    }

    function save(name){
      name = String(name || '').trim();
      if (!name) return null;
      const arr = _read();
      const view = {
        id: 'view_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        name,
        savedAt: new Date().toISOString(),
        payload: _captureState()
      };
      arr.unshift(view);
      // Limit a 20 views — power user precisa mas não pode explodir
      if (arr.length > 20) arr.length = 20;
      _write(arr);
      if (typeof SolsticeAudit !== 'undefined' && SolsticeAudit.record){
        SolsticeAudit.record({ action: 'view_save', target: name, details: { id: view.id } });
      }
      return view;
    }

    function apply(id){
      const arr = _read();
      const v = arr.find(x => x.id === id);
      if (!v || !v.payload) return false;
      const p = v.payload;
      try {
        if (p.filters) SolsticeStore.set('filters', p.filters);
        if (p.crossfilter !== undefined) SolsticeStore.set('crossfilter', p.crossfilter);
        if (p.pageId && typeof SolsticePages !== 'undefined' && SolsticePages.switchTo){
          SolsticePages.switchTo(p.pageId);
        }
        if (p.ui){
          if (typeof p.ui.insightsCollapsed === 'boolean') SolsticeStore.set('ui.insights.collapsed', p.ui.insightsCollapsed);
          if (typeof p.ui.filtersCollapsed === 'boolean') SolsticeStore.set('ui.filters.collapsed', p.ui.filtersCollapsed);
        }
      } catch(e){ SolsticeLog.warn('[Views.apply]', e); return false; }
      if (typeof SolsticeAudit !== 'undefined' && SolsticeAudit.record){
        SolsticeAudit.record({ action: 'view_apply', target: v.name, details: { id } });
      }
      return true;
    }

    function remove(id){
      const arr = _read().filter(x => x.id !== id);
      _write(arr);
    }

    function rename(id, newName){
      const arr = _read();
      const v = arr.find(x => x.id === id);
      if (!v) return false;
      v.name = String(newName || '').trim() || v.name;
      _write(arr);
      return true;
    }

    /**
     * SolsticeSavedViews — views salvas em localStorage (max 20).
     * @typedef {Object} View
     * @property {string} id          'view_<base36>'
     * @property {string} name
     * @property {string} savedAt     ISO date
     * @property {Object} payload     { filters, crossfilter, pageId, ui }
     *
     * @returns {{
     *   list(): View[],
     *   save(name:string): View|null,
     *   apply(id:string): boolean,
     *   remove(id:string): void,
     *   rename(id:string, newName:string): boolean
     * }}
     */
    return { list, save, apply, remove, rename };
  })();
