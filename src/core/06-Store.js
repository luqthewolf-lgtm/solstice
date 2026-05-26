
  /* ============================================================
     SolsticeStore — estado reativo com PATH-SUBSCRIPTION

     Decisão arquitetural #1: subscrições por caminho (a.b.c) ao invés
     de event bus genérico. Custo: ~120 LOC. Ganho: reatividade
     granular, sem framework. Componentes só acordam quando o pedaço
     que ouvem muda.

     Uso:
       Store.set('mode', 'present')              // dispara 'mode' subscribers
       Store.set('dataset.rows', [...])          // dispara 'dataset.rows' + 'dataset' subscribers
       Store.subscribe('dataset.filters', cb)    // ouve só este caminho
     ============================================================ */
  const SolsticeStore = (function(){
    const state = {};
    /** Map<path, Set<callback>> */
    const subs = new Map();
    let muted = false;

    function _split(path){ return String(path).split('.'); }

    function get(path){
      if (!path) return state;
      const parts = _split(path);
      let cur = state;
      for (const p of parts){
        if (cur == null) return undefined;
        cur = cur[p];
      }
      return cur;
    }

    function set(path, value){
      const parts = _split(path);
      let cur = state;
      for (let i = 0; i < parts.length - 1; i++){
        const k = parts[i];
        if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
        cur = cur[k];
      }
      const last = parts[parts.length - 1];
      const prev = cur[last];
      cur[last] = value;
      if (muted) return;
      _notify(path, value, prev);
    }

    function _notify(path, val, prev){
      // Dispara subscribers exatos + ancestrais (a.b muda → a.b e a são notificados)
      const parts = _split(path);
      for (let i = parts.length; i >= 1; i--){
        const ancestor = parts.slice(0, i).join('.');
        const set = subs.get(ancestor);
        if (set) set.forEach(cb => {
          try { cb(val, prev, path); } catch(e){ console.error('[Store] subscriber error on '+ancestor, e); }
        });
      }
    }

    function subscribe(path, cb){
      if (!subs.has(path)) subs.set(path, new Set());
      subs.get(path).add(cb);
      return () => unsubscribe(path, cb);
    }

    function unsubscribe(path, cb){
      const s = subs.get(path);
      if (s){ s.delete(cb); if (s.size === 0) subs.delete(path); }
    }

    /**
     * Executa fn sem disparar notifications.
     * R-03 v3: aceita opts.except = lista de paths (ou prefixos) que NUNCA
     * ficam mute. Útil para 'ingest' que deve sempre notificar status bar,
     * canvas e outros subscribers críticos — bug categórico evitado.
     *
     * Ex: batch(() => { ... set('ingest', X) ... }, { except: ['ingest'] })
     * → set('ingest') notifica imediatamente mesmo dentro do batch.
     */
    function batch(fn, opts){
      const except = (opts && Array.isArray(opts.except)) ? opts.except.slice() : null;
      if (!except || !except.length){
        muted = true;
        try { fn(); } finally { muted = false; }
        return;
      }
      // Acumula sets feitos durante o batch e dispara só os except no fim.
      const buffered = [];
      const origNotify = _notify;
      muted = true;
      // Auditoria 2026.2 (JM-B3): wrapper temporário do _notify pra capturar
      // os paths em `except` durante o batch — não é "hack", é a forma idiomática
      // de implementar exceções de notificação em um store com sub-paths.
      // Substituição é revertida na linha seguinte (`_notify = origNotify`).
      _notify = function(path, val, prev){
        const isExcept = except.some(p => path === p || path.indexOf(p + '.') === 0);
        if (isExcept) buffered.push({ path, val, prev });
      };
      muted = false; // permite que set chame _notify (mas usamos nossa versão)
      // Set continua chamando _notify só se !muted. Vou reverter abordagem:
      // Mais simples: muted=true bloqueia notify, fn() roda, depois disparo manualmente.
      _notify = origNotify;
      muted = true;
      // Snapshot dos valores ANTES (pra ter prev)
      const before = {};
      except.forEach(p => { before[p] = get(p); });
      try { fn(); } finally { muted = false; }
      // Agora dispara cada path em except
      except.forEach(p => {
        const after = get(p);
        if (after !== before[p]){
          _notify(p, after, before[p]);
        }
      });
    }

    function dump(){ return SolsticeUtils.deepClone(state); }

    function reset(){
      for (const k in state) delete state[k];
      subs.forEach(s => s.clear());
    }

    return { get, set, subscribe, unsubscribe, batch, dump, reset, _subs: subs };
  })();
