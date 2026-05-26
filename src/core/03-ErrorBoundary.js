
  /* ============================================================
     B2-01 (v6-autonomous / RES-01 — Sofia/Auth0) — SolsticeErrorBoundary
     Handler global de erros JS não-capturados.

     Antes: erros silenciosos só apareciam no DevTools. Usuário via comportamento
     errado (botão não faz nada, dado some) sem entender o que aconteceu.

     Agora:
       • window.addEventListener('error') → loga + toast "Algo deu errado"
       • window.addEventListener('unhandledrejection') → loga promises rejeitadas
       • Mantém últimos 50 erros em SolsticeStore('errors.log') pra debug
       • Em modo debug (?debug=true), mostra stack trace inline

     Princípios:
       • Errar é humano — silenciar é negligente
       • Toast suave (não modal) — não bloqueia uso
       • Log estruturado: { ts, type, message, stack, source, line, col }
     ============================================================ */
  const SolsticeErrorBoundary = (function(){
    const MAX_LOG = 50;
    const _log = [];
    let _toastDebounceTs = 0;
    const TOAST_DEBOUNCE_MS = 5000; // 1 toast por 5s no máximo
    let _initialized = false;

    function _record(entry){
      entry.ts = Date.now();
      _log.push(entry);
      if (_log.length > MAX_LOG) _log.shift();
      try { if (typeof SolsticeStore !== 'undefined') SolsticeStore.set('errors.log', _log.slice()); } catch(_){}
    }

    function _maybeToast(humanMsg){
      const now = Date.now();
      if (now - _toastDebounceTs < TOAST_DEBOUNCE_MS) return;
      _toastDebounceTs = now;
      try {
        if (typeof SolsticeToast !== 'undefined' && SolsticeToast.warn){
          SolsticeToast.warn('Algo deu errado', humanMsg + ' · Veja Console (F12) pra detalhes.');
        }
      } catch(_){}
    }

    function init(){
      if (_initialized) return;
      _initialized = true;
      // Erros JS síncronos
      window.addEventListener('error', (e) => {
        // Filtra erros de recurso (CSS/img/script que falhou ao carregar) — esses já
        // aparecem na Network tab, não vale toast.
        if (e && e.target && e.target !== window && e.target.tagName) return;
        _record({
          type: 'error',
          message: (e && e.message) || 'Erro desconhecido',
          stack: (e && e.error && e.error.stack) || null,
          source: e && e.filename,
          line: e && e.lineno,
          col: e && e.colno
        });
        console.error('[SolsticeError]', e && e.message, e && e.error);
        _maybeToast('Erro JS: ' + ((e && e.message) || 'desconhecido').slice(0, 80));
      });
      // Promises rejeitadas sem .catch
      window.addEventListener('unhandledrejection', (e) => {
        const reason = e && e.reason;
        const msg = (reason && (reason.message || reason.toString())) || 'Promise rejeitada';
        _record({
          type: 'unhandled-rejection',
          message: msg,
          stack: (reason && reason.stack) || null
        });
        console.error('[SolsticeError] Unhandled rejection:', reason);
        _maybeToast('Operação assíncrona falhou: ' + msg.slice(0, 80));
      });
      // Loga no console que está ativo
      try { console.info('[SolsticeErrorBoundary] handler global ativo'); } catch(_){}
    }

    function getLog(){ return _log.slice(); }
    function clear(){ _log.length = 0; try { SolsticeStore.set('errors.log', []); } catch(_){} }

    /**
     * SolsticeErrorBoundary API pública.
     * @typedef {Object} ErrorEntry
     * @property {number} ts       timestamp ms
     * @property {string} type     'error' | 'unhandled-rejection'
     * @property {string} message  texto do erro
     * @property {string} [stack]  stack trace (se disponível)
     * @property {string} [source] arquivo onde ocorreu
     * @property {number} [line]
     * @property {number} [col]
     *
     * @returns {{
     *   init(): void,                  // anexa listeners globais (idempotente)
     *   getLog(): ErrorEntry[],        // últimos 50 erros (cópia)
     *   clear(): void                  // limpa log
     * }}
     */
    return { init, getLog, clear };
  })();
