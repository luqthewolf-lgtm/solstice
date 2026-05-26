
  /* ============================================================
     Patch 2 · F9 (ADR-139) — SolsticeDuck (DuckDB-WASM opt-in)
     Lazy-load via CDN jsdelivr. Para datasets > 100k linhas, queries
     SQL ficam 10-100× mais rápidas que JS in-memory. Opcional —
     usuário ativa em Configurações.
     ============================================================ */
  const SolsticeDuck = (function(){
    const STORAGE_KEY = 'solstice.duck.enabled';
    let db = null;
    let conn = null;
    let loading = false;
    let loadPromise = null;
    let lastError = null;

    function isEnabled(){
      try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch(e){ return false; }
    }
    function setEnabled(v){
      // Auditoria 2026 (AP-02): silent — toggle de feature opcional.
      SolsticeStorage.safeSet(STORAGE_KEY, v ? 'true' : 'false', { silent: true });
    }

    /** Lazy-load do duckdb-wasm via CDN jsdelivr. ~5MB primeira vez (cached). */
    async function load(){
      if (db && conn) return { ok: true };
      if (loadPromise) return loadPromise;
      loading = true;
      loadPromise = (async () => {
        try {
          // Dynamic import do bundle ESM via CDN
          const duckdb = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm');
          const JSDELIVR = duckdb.getJsDelivrBundles();
          const bundle = await duckdb.selectBundle(JSDELIVR);
          const worker_url = URL.createObjectURL(
            new Blob([`importScripts("${bundle.mainWorker}");`], { type:'text/javascript' })
          );
          const worker = new Worker(worker_url);
          const logger = new duckdb.ConsoleLogger();
          db = new duckdb.AsyncDuckDB(logger, worker);
          await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
          URL.revokeObjectURL(worker_url);
          conn = await db.connect();
          loading = false;
          return { ok: true };
        } catch(err){
          lastError = err && err.message || String(err);
          loading = false;
          db = null; conn = null;
          return { ok: false, error: lastError };
        }
      })();
      return loadPromise;
    }

    /** Registra o dataset atual do Solstice como tabela DuckDB chamada 'data'. */
    async function registerDataset(){
      if (!conn){ const r = await load(); if (!r.ok) return r; }
      const ingest = SolsticeStore.get('ingest') || {};
      const rows = ingest.rows || [];
      if (!rows.length) return { ok: false, error: 'Nenhum dataset carregado' };
      // Drop tabela se existir
      try { await conn.query("DROP TABLE IF EXISTS data;"); } catch(e){}
      // Registra via JSON inserts (mais simples que CSV interno para datasets já parseados)
      const json = JSON.stringify(rows);
      const fileName = 'solstice-data.json';
      try {
        await db.registerFileText(fileName, json);
        await conn.query("CREATE TABLE data AS SELECT * FROM read_json_auto('" + fileName + "');");
        return { ok: true, rows: rows.length };
      } catch(err){
        return { ok: false, error: err.message };
      }
    }

    /** Roda uma query SQL e retorna array de objects. */
    async function query(sql){
      if (!conn){ const r = await load(); if (!r.ok) return r; }
      try {
        const result = await conn.query(sql);
        return { ok: true, rows: result.toArray().map(r => r.toJSON ? r.toJSON() : Object.assign({}, r)) };
      } catch(err){
        return { ok: false, error: err.message };
      }
    }

    function isReady(){ return !!(db && conn); }
    function getError(){ return lastError; }
    function isLoading(){ return loading; }

    return { load, registerDataset, query, isReady, isEnabled, setEnabled, isLoading, getError };
  })();
