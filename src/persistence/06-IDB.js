
  /* ============================================================
     B1-03 (v6-autonomous) — SolsticeIDB
     Wrapper minimalista de IndexedDB pra serializar handles e estado
     entre sessões. Existe pra:
       1) Persistir FileSystemDirectoryHandle (Folder Attach)
       2) (futuro) Cache de datasets pesados, snapshots binários

     API:
       SolsticeIDB.set(key, value) → Promise<void>
       SolsticeIDB.get(key)        → Promise<any|null>
       SolsticeIDB.del(key)        → Promise<void>
       SolsticeIDB.isSupported()   → boolean

     Schema: 1 DB "solstice-v1", 1 store "kv" {key, value}.
     ============================================================ */
  const SolsticeIDB = (function(){
    const DB_NAME = 'solstice-v1';
    const STORE   = 'kv';
    let _dbPromise = null;

    function isSupported(){ return typeof indexedDB !== 'undefined'; }

    function _open(){
      if (_dbPromise) return _dbPromise;
      _dbPromise = new Promise((resolve, reject) => {
        if (!isSupported()) return reject(new Error('IndexedDB indisponível'));
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      });
      return _dbPromise;
    }

    function _tx(mode){
      return _open().then(db => db.transaction(STORE, mode).objectStore(STORE));
    }

    function get(key){
      return _tx('readonly').then(store => new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result == null ? null : req.result);
        req.onerror   = () => reject(req.error);
      })).catch(() => null);
    }

    // Auditoria 2026.3 (MC-05 / AP-04 / HV-03): antes o .catch engolia o erro
    // e a promise resolvia com undefined — caller (ex.: SolsticeFolderAttach
    // persistindo o handle) recebia "sucesso" aparente. Agora set/del
    // RESOLVEM com boolean: true = persistiu, false = falhou. Quem chama
    // pode reagir (re-tentar, avisar usuário).
    function set(key, value){
      return _tx('readwrite').then(store => new Promise((resolve, reject) => {
        const req = store.put(value, key);
        req.onsuccess = () => resolve(true);
        req.onerror   = () => reject(req.error);
      })).catch(e => { SolsticeLog.warn('[SolsticeIDB.set]', e); return false; });
    }

    function del(key){
      return _tx('readwrite').then(store => new Promise((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror   = () => reject(req.error);
      })).catch(e => { SolsticeLog.warn('[SolsticeIDB.del]', e); return false; });
    }

    /**
     * SolsticeIDB — wrapper minimalista do IndexedDB.
     * @returns {{
     *   isSupported(): boolean,
     *   get(key:string): Promise<any|null>,
     *   set(key:string, value:any): Promise<void>,
     *   del(key:string): Promise<void>
     * }}
     */
    return { isSupported, get, set, del };
  })();
