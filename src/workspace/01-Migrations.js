
  /* ============================================================
     Patch 1A (ADR-116) — SolsticeMigrations
     Migrações idempotentes para snapshots/state de versões anteriores.
     ============================================================ */
  const SolsticeMigrations = (function(){
    const MIGRATIONS = [
      // v5.3.0 → v5.3.0+patch1a — Modo Livre removido
      {
        id:'remove_free_mode', from:'<patch1a', to:'patch1a',
        apply(state){
          if (!state || !state.canvas || !state.canvas.sections) return state;
          let changed = 0;
          for (const sec of state.canvas.sections){
            for (const r of (sec.rows || [])){
              if (r.mode === 'free'){ r.mode = 'grid'; changed++; }
              // Limpa posições absolutas dos slots
              if (Array.isArray(r.slots)){
                for (const s of r.slots){
                  if (s.x != null || s.y != null || s.w != null || s.h != null){
                    delete s.x; delete s.y; delete s.w; delete s.h;
                    changed++;
                  }
                }
              }
            }
          }
          // Auditoria 2026 (JM-02): log de migração gated por SolsticeLog.info.
          // Migrações rodam uma vez por estado antigo carregado — informativo
          // útil em debug, ruidoso em produção.
          if (changed) SolsticeLog.info('[Migrations] remove_free_mode aplicado em ' + changed + ' nós');
          return state;
        }
      },
      // Prompt 11 v5.4 → Multi-páginas: canvas.sections vira canvas.pages[0].sections
      {
        id: 'multipage_v54', from: '<v5.4', to: 'v5.4',
        apply(state){
          if (!state || !state.canvas) return state;
          // Já tem pages? Skip
          if (Array.isArray(state.canvas.pages) && state.canvas.pages.length) return state;
          // Tem sections (formato antigo) → empacota em página única
          if (Array.isArray(state.canvas.sections)){
            const pageId = 'page_' + Date.now().toString(36);
            state.canvas.pages = [{
              id: pageId,
              name: 'Página 1',
              icon: '📊',
              sections: state.canvas.sections
            }];
            state.canvas.activeId = pageId;
            // Auditoria 2026 (JM-02): idem — gated por SolsticeLog.info.
            SolsticeLog.info('[Migrations] multipage_v54: ' + state.canvas.sections.length + ' sections migradas para página única.');
          }
          return state;
        }
      }
    ];

    function applyAll(state){
      if (!state) return state;
      for (const m of MIGRATIONS){
        try { state = m.apply(state); }
        catch(err){ SolsticeLog.warn('[Migrations] falha em ' + m.id, err); }
      }
      return state;
    }

    return { applyAll, MIGRATIONS };
  })();
