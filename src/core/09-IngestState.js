
  /* ============================================================
     SolsticeIngestState (R-02 v3) — helper para mutar 'ingest'
     ------------------------------------------------------------
     Antes: 58 chamadas `set('ingest', { ...ingest, X: y })` com
     padrões heterogêneos. Spread vs Object.assign, ordem diferente
     dos campos, esquecimento de errors/encoding. Risco real de
     perder campos em algum caminho.
     Agora: SolsticeIngestState.patch({rows, columns, types, ...})
     faz merge raso e dispara 1 set. Padrão único.
     Nome propositalmente NÃO conflita com SolsticeIngest existente
     (módulo de parse de CSV).
     ============================================================ */
  const SolsticeIngestState = (function(){
    function get(){ return SolsticeStore.get('ingest') || {}; }
    function set(next){ SolsticeStore.set('ingest', next); }
    function patch(diff){
      if (!diff || typeof diff !== 'object') return get();
      const cur = get();
      const next = Object.assign({}, cur, diff);
      set(next);
      return next;
    }
    function setRows(rows){ return patch({ rows: rows || [] }); }
    function setColumns(columns){ return patch({ columns: columns || [] }); }
    function setTypes(types){ return patch({ types: types || {} }); }
    function addCalculated(name, def){
      const cur = get();
      const measures = Object.assign({}, cur.calculatedMeasures || {});
      measures[name] = def;
      return patch({ calculatedMeasures: measures });
    }
    function removeCalculated(name){
      const cur = get();
      const measures = Object.assign({}, cur.calculatedMeasures || {});
      delete measures[name];
      return patch({ calculatedMeasures: measures });
    }
    function clear(){ set(null); }
    // Auditoria 2026 (RT-03): adapter pra cumprir SolsticeStoreContract.
    function subscribe(path, cb){
      const fullPath = path ? 'ingest.' + path : 'ingest';
      return SolsticeStore.subscribe(fullPath, cb);
    }
    return { get, set, subscribe, patch, setRows, setColumns, setTypes, addCalculated, removeCalculated, clear };
  })();
