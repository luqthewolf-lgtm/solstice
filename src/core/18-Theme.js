
  /* ============================================================
     SolsticeTheme — paleta × modo × densidade
     Persiste em localStorage como objeto único 'solstice.theme'.
     ============================================================ */
  const SolsticeTheme = (function(){
    // SOL-H4 v2: 'itau' adicionada como paleta global. Cores definidas no @layer theme.
    // Sprint Solstice 2026.6: 'solstice' adicionada como 8ª paleta + default boot.
    // 'solstice' fica no início pra ser o primeiro do cycle e identidade do produto.
    const PALETTES = ['solstice','ocean','sunset','forest','vineyard','coffee','slate','itau'];
    const MODES = ['dark','light'];
    const DENSITIES = ['compact','comfortable','spacious'];

    function _load(){
      try {
        const raw = localStorage.getItem('solstice.theme');
        return raw ? JSON.parse(raw) : {};
      } catch(e){
        // Auditoria 2026 (MC-03): antes era catch silencioso — inconsistente
        // com o _load() análogo de SolsticeProfiles (que avisa via
        // SolsticeErrors.show). Agora padroniza: avisa por console.warn
        // sempre, e por toast quando o app já carregou (boot precoce não
        // tem SolsticeToast disponível ainda).
        console.warn('[SolsticeTheme] Tema salvo está corrompido — usando defaults.', e && e.message);
        setTimeout(() => {
          if (typeof SolsticeToast !== 'undefined' && SolsticeToast.warn){
            SolsticeToast.warn('Tema corrompido', 'Usando padrões. Configure outra vez em Temas.');
          }
        }, 0);
        return {};
      }
    }
    function _save(t){
      // Auditoria 2026 (AP-02): SolsticeStorage.safeSet avisa o usuário se
      // a escrita falhar (cota cheia, modo anônimo). Antes: catch silencioso.
      SolsticeStorage.safeSet('solstice.theme', JSON.stringify(t));
    }

    function get(name){
      return document.documentElement.getAttribute('data-'+name);
    }
    function set(name, value){
      const allowed = name==='mode'?MODES:name==='palette'?PALETTES:name==='density'?DENSITIES:null;
      if (!allowed || allowed.indexOf(value) < 0) return false;
      document.documentElement.setAttribute('data-'+name, value);
      const t = _load(); t[name] = value; _save(t);
      SolsticeStore.set('theme.'+name, value);
      return true;
    }
    function cycle(name){
      const list = name==='mode'?MODES:name==='palette'?PALETTES:name==='density'?DENSITIES:[];
      const cur = get(name);
      const next = list[(list.indexOf(cur)+1) % list.length];
      set(name, next);
      return next;
    }
    function listPalettes(){ return PALETTES.slice(); }
    function listModes(){ return MODES.slice(); }
    function listDensities(){ return DENSITIES.slice(); }

    // Auditoria 2026 (RT-03): adapter pra cumprir SolsticeStoreContract.
    // subscribe('mode'|'palette'|'density', cb) delega pro Store central.
    function subscribe(path, cb){
      return SolsticeStore.subscribe('theme.' + path, cb);
    }

    return { get, set, cycle, subscribe, listPalettes, listModes, listDensities };
  })();
