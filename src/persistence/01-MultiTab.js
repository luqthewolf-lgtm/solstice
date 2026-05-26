
  /* ============================================================
     B6-02 (v6-autonomous / PW-06 — Augusto power user) — SolsticeMultiTab
     Sincronização leve entre múltiplas abas via BroadcastChannel.
     Caso de uso: usuário tem 2 abas abertas (dashboard + análise);
     salva snapshot em uma, outra precisa saber.

     API:
       SolsticeMultiTab.notify(type, payload)   → envia pra outras abas
       SolsticeMultiTab.subscribe(type, cb)     → escuta msgs daquele tipo
       SolsticeMultiTab.isSupported()           → boolean

     Eventos auto-emitidos:
       'theme'      → mudança de palette/mode
       'view-saved' → SolsticeViews.save() em outra aba
       'snapshot'   → snapshot salvo
     ============================================================ */
  const SolsticeMultiTab = (function(){
    const CHANNEL = 'solstice-sync';
    const supported = typeof BroadcastChannel === 'function';
    let bc = null;
    const subs = new Map(); // type → Set<cb>

    function isSupported(){ return supported; }

    function _open(){
      if (bc || !supported) return bc;
      try {
        bc = new BroadcastChannel(CHANNEL);
        bc.onmessage = (ev) => {
          if (!ev || !ev.data || !ev.data.type) return;
          const type = ev.data.type;
          const setCb = subs.get(type);
          // Auditoria 2026.3 (MC-04 / HV-03): catches vazios silenciavam erros
          // de subscribers cross-tab. Agora SolsticeLog.warn — erro em handler
          // é informativo, não fatal.
          if (setCb) setCb.forEach(cb => {
            try { cb(ev.data.payload); }
            catch(e){ SolsticeLog.warn('[MultiTab] subscriber error · type=' + type, e); }
          });
          const wildSet = subs.get('*');
          if (wildSet) wildSet.forEach(cb => {
            try { cb(ev.data); }
            catch(e){ SolsticeLog.warn('[MultiTab] wildcard subscriber error', e); }
          });
        };
      } catch(e){ SolsticeLog.warn('[MultiTab]', e); bc = null; }
      return bc;
    }

    function notify(type, payload){
      if (!supported) return false;
      _open();
      if (!bc) return false;
      try { bc.postMessage({ type, payload, ts: Date.now() }); return true; }
      catch(_){ return false; }
    }

    function subscribe(type, cb){
      if (typeof cb !== 'function') return () => {};
      _open();
      if (!subs.has(type)) subs.set(type, new Set());
      subs.get(type).add(cb);
      return () => { const s = subs.get(type); if (s) s.delete(cb); };
    }

    function init(){
      _open();
      // Auto-emit theme change (palette + mode)
      try {
        SolsticeStore.subscribe('settings.theme.palette', (v) => notify('theme', { palette: v }));
        SolsticeStore.subscribe('settings.theme.mode',    (v) => notify('theme', { mode: v }));
      } catch(_){}
      // Auditoria 2026.3 (MC-07): fecha o BroadcastChannel ao sair da página.
      // Sem isso, o handle ficava dependente do GC — em sessão com muitas
      // abas/fecha-abre, acumulava. Mesmo padrão do SolsticePresenter (MC-A2).
      window.addEventListener('beforeunload', () => {
        if (bc){ try { bc.close(); } catch(_){} bc = null; }
      });
    }

    /**
     * SolsticeMultiTab — sync entre múltiplas abas via BroadcastChannel.
     * @returns {{
     *   isSupported(): boolean,                                   // BroadcastChannel disponível
     *   notify(type:string, payload?:any): boolean,               // envia pra outras abas
     *   subscribe(type:string, cb:(payload:any)=>void): ()=>void, // escuta msgs daquele tipo; '*' = todas
     *   init(): void                                              // anexa auto-emit pra theme changes
     * }}
     */
    return { isSupported, notify, subscribe, init };
  })();
