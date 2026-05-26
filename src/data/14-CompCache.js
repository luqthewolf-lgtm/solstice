
  /* ============================================================
     Patch 1A (ADR-113) — SolsticeCompCache
     LRU simples por slot.id + hash do contexto. TTL 5min, cap 100.
     ============================================================ */
  const SolsticeCompCache = (function(){
    const cache = new Map();     // slotId → { hash, result, at }
    const TTL = 300000;          // 5min
    const CAP = 100;

    function _hashOf(slotId, config, rows){
      const n = rows ? rows.length : 0;
      const first = (n && rows[0]) ? JSON.stringify(rows[0]) : '';
      const last  = (n && rows[n-1]) ? JSON.stringify(rows[n-1]) : '';
      const fp = SolsticeStore.get('ingest.fingerprint') || '';
      return SolsticeUtils.hash(slotId + '|' + fp + '|' + n + '|' + first + '|' + last + '|' + JSON.stringify(config || {}));
    }

    function _evict(){
      // Remove TTL expired
      const now = Date.now();
      for (const [k, v] of cache){
        if (now - v.at > TTL) cache.delete(k);
      }
      // LRU: se ainda passa do cap, descarta mais antigos
      while (cache.size > CAP){
        const first = cache.keys().next().value;
        cache.delete(first);
      }
    }

    /**
     * get(slotId, config, rows, computeFn) → resultado
     * Cache hit: retorna result armazenado e atualiza `at` (LRU).
     * Cache miss: chama compute(), cacheia, evicts se necessário.
     */
    function get(slotId, config, rows, computeFn){
      const hash = _hashOf(slotId, config, rows);
      const hit = cache.get(slotId);
      if (hit && hit.hash === hash){
        hit.at = Date.now();
        // Move para fim do Map (LRU semantics)
        cache.delete(slotId); cache.set(slotId, hit);
        return hit.result;
      }
      const result = computeFn();
      cache.set(slotId, { hash, result, at: Date.now() });
      if (cache.size > CAP) _evict();
      return result;
    }

    function invalidate(slotId){ if (slotId) cache.delete(slotId); else cache.clear(); }
    function size(){ return cache.size; }

    // Invalida cache global em mudanças estruturais
    SolsticeStore.subscribe('ingest', () => cache.clear());
    SolsticeStore.subscribe('canvas.sections', () => { /* deixa LRU expirar — refresh natural */ });

    return { get, invalidate, size };
  })();
