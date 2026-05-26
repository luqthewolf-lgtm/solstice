
  /* ============================================================
     SolsticeLog (R-08 v3) — logging com gate de debug
     ------------------------------------------------------------
     Gate via ?debug=1 OU localStorage.solstice.debug === '1'.
     Mantém log de boot público (sempre visível para confirmar
     que o app carregou). Demais .debug/.info ficam mudos por
     default. .warn e .error sempre passam (sinalizar problemas
     reais — não tomar liberdade de esconder isso do usuário).
     ============================================================ */
  const SolsticeLog = (function(){
    let _enabled = false;
    try {
      _enabled = (location.search.indexOf('debug=1') >= 0) ||
                 (localStorage.getItem('solstice.debug') === '1');
    } catch(_){}
    function setEnabled(v){
      _enabled = !!v;
      // Auditoria 2026 (AP-02): flag de debug — silent porque é setting interno.
      SolsticeStorage.safeSet('solstice.debug', _enabled ? '1' : '0', { silent: true });
    }
    function isEnabled(){ return _enabled; }
    function debug(...args){ if (_enabled) console.log(...args); }
    function info(...args){ if (_enabled) console.info(...args); }
    function warn(...args){ console.warn(...args); }
    function error(...args){ console.error(...args); }
    // boot() é o log público sempre visível ("[Solstice] boot OK")
    function boot(msg, color){
      console.log('%c' + msg, 'color:' + (color || '#4ADE80') + ';font-weight:bold;');
    }
    return { setEnabled, isEnabled, debug, info, warn, error, boot };
  })();
