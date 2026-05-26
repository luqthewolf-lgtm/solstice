
  /* ============================================================
     B8-01 (v6-autonomous / I18N-01 — Yuki/Mercado Pago) — SolsticeI18n
     Wrapper minimalista pra strings centralizadas. Pre-existente
     SolsticeLocale.t() cobre dicionário grande; SolsticeI18n cobre
     micro-vocabulário usado em código novo (botões, labels, status).

     Migração gradual: novo código deve usar SolsticeI18n.t('save')
     em vez de hardcoded 'Salvar'. Strings sem chave caem no fallback
     do default (= a própria string).

     SolsticeI18n.t(key)              → string traduzida
     SolsticeI18n.tn(key, n)          → pluralização simples (1: sg, *: pl)
     SolsticeI18n.register(map)       → adicionar termos custom
     SolsticeI18n.allKeys()           → debug
     ============================================================ */
  const SolsticeI18n = (function(){
    const DICTS = {
      'pt-BR': {
        // Ações comuns (botões)
        'save':       'Salvar',
        'cancel':     'Cancelar',
        'close':      'Fechar',
        'export':     'Exportar',
        'import':     'Importar',
        'delete':     'Excluir',
        'remove':     'Remover',
        'edit':       'Editar',
        'apply':      'Aplicar',
        'confirm':    'Confirmar',
        'undo':       'Desfazer',
        'redo':       'Refazer',
        'open':       'Abrir',
        'new':        'Novo',
        'refresh':    'Recarregar',
        'copy':       'Copiar',
        // Status
        'loading':    'Carregando…',
        'saved':      'Salvo',
        'error':      'Erro',
        'success':    'Sucesso',
        'warning':    'Aviso',
        // Quantitativos
        'rows':       'linhas',
        'row':        'linha',
        'cols':       'colunas',
        'col':        'coluna',
        'records':    'registros',
        'record':     'registro',
        // Time
        'today':      'hoje',
        'yesterday':  'ontem',
        'days_ago':   'dias atrás',
        'min_ago':    'min atrás'
      },
      'en-US': {
        'save':'Save','cancel':'Cancel','close':'Close','export':'Export','import':'Import',
        'delete':'Delete','remove':'Remove','edit':'Edit','apply':'Apply','confirm':'Confirm',
        'undo':'Undo','redo':'Redo','open':'Open','new':'New','refresh':'Refresh','copy':'Copy',
        'loading':'Loading…','saved':'Saved','error':'Error','success':'Success','warning':'Warning',
        'rows':'rows','row':'row','cols':'columns','col':'column','records':'records','record':'record',
        'today':'today','yesterday':'yesterday','days_ago':'days ago','min_ago':'min ago'
      }
    };

    function _currentLocale(){
      try {
        return (typeof SolsticeLocale !== 'undefined' && SolsticeLocale.get)
          ? SolsticeLocale.get()
          : 'pt-BR';
      } catch(_){ return 'pt-BR'; }
    }

    function t(key){
      const loc = _currentLocale();
      const dict = DICTS[loc] || DICTS['pt-BR'];
      return dict[key] || key; // fallback: retorna a chave (útil pra debug)
    }

    function tn(key, n){
      // Pluralização ingênua: chave singular tem 'col', plural 'cols'
      const singular = t(key);
      const pluralKey = key + (key.endsWith('s') ? '' : 's');
      const plural = DICTS[_currentLocale()] && DICTS[_currentLocale()][pluralKey] || singular;
      return n === 1 ? singular : plural;
    }

    function register(map){
      const loc = _currentLocale();
      if (!DICTS[loc]) DICTS[loc] = {};
      Object.assign(DICTS[loc], map || {});
    }

    function allKeys(){
      const loc = _currentLocale();
      return Object.keys(DICTS[loc] || {});
    }

    return { t, tn, register, allKeys };
  })();
