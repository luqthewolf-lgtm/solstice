
  /* ============================================================
     SolsticeBoot (R-05 v3) — orquestração do pós-import
     ------------------------------------------------------------
     Antes: 4 subscribers de 'dataset.ready' espalhados no boot()
     com try/catch local cada um — difícil de listar/debugar.
     Agora: registra callbacks com label num único subscribe;
     try/catch isolado por handler (falha não derruba outros).
     ============================================================ */
  const SolsticeBoot = (function(){
    const handlers = [];
    let _subscribed = false;
    function _runAll(ready){
      if (!ready) return;
      handlers.forEach(h => {
        try { h.fn(ready); }
        catch(e){ SolsticeLog.warn('[SolsticeBoot]', h.label, 'falhou:', e); }
      });
    }
    function _ensureSubscribed(){
      if (_subscribed) return;
      _subscribed = true;
      SolsticeStore.subscribe('dataset.ready', _runAll);
    }
    function onDatasetReady(label, fn){
      if (typeof fn !== 'function') return;
      handlers.push({ label: String(label || 'anon'), fn });
      _ensureSubscribed();
    }
    function list(){ return handlers.map(h => h.label); }
    function fireNow(){
      const r = SolsticeStore.get('dataset.ready');
      if (r) _runAll(r);
    }
    return { onDatasetReady, list, fireNow };
  })();
