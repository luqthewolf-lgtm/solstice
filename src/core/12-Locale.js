
  /* ============================================================
     SolsticeLocale — formatação dinâmica
     pt-BR / en-US / es-ES / en-GB
     ============================================================ */
  const SolsticeLocale = (function(){
    const SUPPORTED = ['pt-BR', 'en-US', 'es-ES', 'en-GB'];

    const STRINGS = {
      'pt-BR': {
        'canvas.title': 'Bem-vindo ao Solstice',
        'canvas.subtitle': 'A fundação está montada. Carregue um CSV ou explore o dataset dummy de vendas BR para conhecer o Dicionário Semântico.',
        'canvas.action.dummy': '📊 Carregar CSV dummy de vendas BR',
        'canvas.action.import': '📁 Importar CSV (Bloco 2)',
        'onb.1.title': 'Olá! Eu sou o Solstice',
        'onb.1.text': 'Sua ferramenta de BI single-file: agnóstico, portável, auditável. Tudo roda local — sem servidor, sem upload.',
        'onb.2.title': 'Dicionário Semântico',
        'onb.2.text': 'Reconheço automaticamente colunas de Banco PJ, Vendas, RH, Marketing, Operacional e Pesquisa Científica. Você ajusta o que quiser.',
        'onb.3.title': '4 diferenciais únicos',
        'onb.3.text': 'Auditoria de Decisões · Narrativa Automática · Modo Comentário · Grafo de Métricas. Tudo em construção, bloco a bloco.',
        'onb.next': 'Próximo',
        'onb.skip': 'Pular',
        'onb.start': 'Começar',
        'dict.title': 'Configurar Dicionário Semântico',
        'dict.subtitle': 'Detectei que esse CSV se parece com',
        'dict.col': 'Coluna técnica',
        'dict.friendly': 'Nome amigável',
        'dict.unit': 'Unidade',
        'dict.higher': 'Maior é melhor?',
        'dict.conf': 'Confiança',
        'dict.apply': 'Aplicar dicionário',
        'dict.skip': 'Pular',
        'dict.detected': 'Dicionário detectado',
        'err.close': 'Fechar',
        'err.details': 'Detalhes técnicos',
        'toast.theme.changed': 'Tema atualizado',
        'toast.locale.changed': 'Idioma atualizado',
        'toast.dummy.loaded': 'CSV dummy carregado',
        'toast.profile.created': 'Perfil criado'
      },
      'en-US': {
        'canvas.title': 'Welcome to Solstice',
        'canvas.subtitle': 'The foundation is in place. Load a CSV or try the sample dataset to explore the Semantic Dictionary.',
        'canvas.action.dummy': '📊 Load sample sales CSV',
        'canvas.action.import': '📁 Import CSV (Block 2)',
        'onb.1.title': 'Hi! I\'m Solstice',
        'onb.1.text': 'Your single-file BI tool: agnostic, portable, auditable. Everything runs locally — no server, no uploads.',
        'onb.2.title': 'Semantic Dictionary',
        'onb.2.text': 'I automatically recognize columns from Corporate Banking, Sales, HR, Marketing, Operations and Scientific Research.',
        'onb.3.title': '4 unique differentials',
        'onb.3.text': 'Decision Audit · Automatic Narrative · Comment Mode · Metrics Graph. All being built, block by block.',
        'onb.next': 'Next', 'onb.skip': 'Skip', 'onb.start': 'Start',
        'dict.title': 'Configure Semantic Dictionary',
        'dict.subtitle': 'I detected this CSV looks like',
        'dict.col': 'Technical column', 'dict.friendly': 'Friendly name',
        'dict.unit': 'Unit', 'dict.higher': 'Higher is better?',
        'dict.conf': 'Confidence', 'dict.apply': 'Apply dictionary', 'dict.skip': 'Skip',
        'dict.detected': 'Detected dictionary',
        'err.close': 'Close', 'err.details': 'Technical details',
        'toast.theme.changed': 'Theme updated', 'toast.locale.changed': 'Language updated',
        'toast.dummy.loaded': 'Sample CSV loaded', 'toast.profile.created': 'Profile created'
      },
      'es-ES': {
        'canvas.title': 'Bienvenido a Solstice',
        'canvas.subtitle': 'La base está lista. Carga un CSV o prueba el dataset de ejemplo para explorar el Diccionario Semántico.',
        'canvas.action.dummy': '📊 Cargar CSV de ejemplo',
        'canvas.action.import': '📁 Importar CSV (Bloque 2)',
        'onb.1.title': '¡Hola! Soy Solstice',
        'onb.1.text': 'Tu herramienta de BI en un solo archivo: agnóstica, portable, auditable. Todo corre local — sin servidor, sin subir nada.',
        'onb.2.title': 'Diccionario Semántico',
        'onb.2.text': 'Reconozco automáticamente columnas de Banca, Ventas, RRHH, Marketing, Operaciones y Ciencia.',
        'onb.3.title': '4 diferenciales únicos',
        'onb.3.text': 'Auditoría de Decisiones · Narrativa Automática · Modo Comentario · Grafo de Métricas.',
        'onb.next': 'Siguiente', 'onb.skip': 'Omitir', 'onb.start': 'Comenzar',
        'dict.title': 'Configurar Diccionario Semántico',
        'dict.subtitle': 'Detecté que este CSV se parece a',
        'dict.col': 'Columna técnica', 'dict.friendly': 'Nombre amigable',
        'dict.unit': 'Unidad', 'dict.higher': '¿Mayor es mejor?',
        'dict.conf': 'Confianza', 'dict.apply': 'Aplicar', 'dict.skip': 'Omitir',
        'dict.detected': 'Diccionario detectado',
        'err.close': 'Cerrar', 'err.details': 'Detalles técnicos',
        'toast.theme.changed': 'Tema actualizado', 'toast.locale.changed': 'Idioma actualizado',
        'toast.dummy.loaded': 'CSV de ejemplo cargado', 'toast.profile.created': 'Perfil creado'
      },
      'en-GB': {
        'canvas.title': 'Welcome to Solstice',
        'canvas.subtitle': 'The foundation is in place. Load a CSV or try the sample dataset to explore the Semantic Dictionary.',
        'canvas.action.dummy': '📊 Load sample sales CSV',
        'canvas.action.import': '📁 Import CSV (Block 2)',
        'onb.1.title': 'Hi! I\'m Solstice',
        'onb.1.text': 'Your single-file BI tool: agnostic, portable, auditable. Everything runs locally — no server, no uploads.',
        'onb.2.title': 'Semantic Dictionary',
        'onb.2.text': 'I automatically recognise columns from Corporate Banking, Sales, HR, Marketing, Operations and Scientific Research.',
        'onb.3.title': '4 unique differentials',
        'onb.3.text': 'Decision Audit · Automatic Narrative · Comment Mode · Metrics Graph.',
        'onb.next': 'Next', 'onb.skip': 'Skip', 'onb.start': 'Start',
        'dict.title': 'Configure Semantic Dictionary',
        'dict.subtitle': 'I detected this CSV looks like',
        'dict.col': 'Technical column', 'dict.friendly': 'Friendly name',
        'dict.unit': 'Unit', 'dict.higher': 'Higher is better?',
        'dict.conf': 'Confidence', 'dict.apply': 'Apply dictionary', 'dict.skip': 'Skip',
        'dict.detected': 'Detected dictionary',
        'err.close': 'Close', 'err.details': 'Technical details',
        'toast.theme.changed': 'Theme updated', 'toast.locale.changed': 'Language updated',
        'toast.dummy.loaded': 'Sample CSV loaded', 'toast.profile.created': 'Profile created'
      }
    };

    const CURRENCY = { 'pt-BR':'BRL', 'en-US':'USD', 'es-ES':'EUR', 'en-GB':'GBP' };

    function _detect(){
      const browser = (navigator.language || 'pt-BR');
      if (SUPPORTED.indexOf(browser) >= 0) return browser;
      const short = browser.slice(0,2);
      return SUPPORTED.find(l => l.startsWith(short)) || 'pt-BR';
    }

    let current = (function(){
      try { return localStorage.getItem('solstice.locale') || _detect(); }
      catch(e){ return _detect(); }
    })();

    function set(code){
      if (SUPPORTED.indexOf(code) < 0) throw new Error('Locale não suportado: '+code);
      current = code;
      // Auditoria 2026 (AP-02): avisar se locale não persistir (usuário mudou idioma).
      SolsticeStorage.safeSet('solstice.locale', code);
      document.documentElement.lang = code;
      SolsticeStore.set('locale', code);
      _retranslate();
      SolsticeUtils.fire('locale:changed', { locale: code });
    }
    function get(){ return current; }
    function listSupported(){ return SUPPORTED.slice(); }

    function t(key, vars){
      let s = (STRINGS[current] && STRINGS[current][key]) || STRINGS['pt-BR'][key] || key;
      if (vars){
        for (const k in vars) s = s.replace(new RegExp('\\{'+k+'\\}','g'), vars[k]);
      }
      return s;
    }

    function _retranslate(){
      SolsticeUtils.qsa('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
      });
    }

    function n(num, opts){
      if (num == null || isNaN(num)) return '—';
      return new Intl.NumberFormat(current, opts).format(num);
    }
    function integer(num){ return n(num, { maximumFractionDigits: 0 }); }
    // Smart rounding: arredonda para 0 decimais quando valor >= 1.
    // Smart rounding:
    //   |v| >= 10  → 0 decimais (KPIs grandes não precisam de "1.250,75")
    //   |v| >= 1   → 0 decimais (Lucas pediu radical)
    //   |v| < 1    → mantém digits solicitado (precisão importante quando v pequeno)
    // Eixos de chart e tooltips passam digits explicitamente; respeitamos.
    function decimal(num, digits){
      if (num == null || isNaN(num)) return '—';
      const abs = Math.abs(num);
      // Default: 0 decimal pra valores ≥ 1. Só sub-unitários mantêm precisão.
      let maxDigits;
      if (digits != null){
        // Caller pediu digits explícito — respeita, mas força 0 se valor grande
        maxDigits = abs >= 100 ? 0 : digits;
      } else {
        maxDigits = abs >= 1 ? 0 : 2;
      }
      return n(num, { minimumFractionDigits: 0, maximumFractionDigits: maxDigits });
    }
    function currency(num, code){
      // Currency sem decimais quando |v| >= 100 (R$ 1.250.500 vs R$ 1.250.500,00).
      if (num == null || isNaN(num)) return '—';
      const abs = Math.abs(num);
      const maxDigits = abs >= 100 ? 0 : 2;
      return n(num, { style:'currency', currency: code || CURRENCY[current],
                      minimumFractionDigits: 0, maximumFractionDigits: maxDigits });
    }
    function percent(num, digits){
      // Percent sem decimais por default (90% vs 90,00%).
      if (num == null || isNaN(num)) return '—';
      const maxDigits = digits != null ? digits : 0;
      return n(num, { style:'percent', minimumFractionDigits: 0, maximumFractionDigits: maxDigits });
    }
    function date(d, opts){
      const dt = d instanceof Date ? d : new Date(d);
      return new Intl.DateTimeFormat(current, opts || { dateStyle:'medium' }).format(dt);
    }
    function datetime(d){
      return date(d, { dateStyle:'medium', timeStyle:'short' });
    }

    // Auditoria 2026 (RT-03): adapter pra cumprir SolsticeStoreContract.
    function subscribe(_path, cb){ return SolsticeStore.subscribe('locale', cb); }
    return { set, get, subscribe, listSupported, t, n, integer, decimal, currency, percent, date, datetime };
  })();
