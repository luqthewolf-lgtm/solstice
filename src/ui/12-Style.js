
  /* ============================================================
     SolsticeStyle (Camada Style — Polish criativo) — Sistema universal
     de personalização visual de TODOS os componentes do canvas.
     Componentes lêem slot.config.style e chamam SolsticeStyle.apply(host)
     que injeta CSS custom properties no .solstice__comp.
     ============================================================ */
  const SolsticeStyle = (function(){
    // Schema completo das propriedades visuais que cada slot pode ter.
    // 'auto' = herda do tema. Outros valores sobrescrevem.
    const DEFAULTS = {
      // Aparência geral
      preset:       'default',          // referência ao preset aplicado
      background:   'auto',             // 'auto' | hex | css gradient string
      backgroundOpacity: 1.0,
      border:       'subtle',           // 'none' | 'subtle' | 'solid' | 'thick' | 'dashed'
      borderColor:  'auto',             // 'auto' | hex
      radius:       'md',               // 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
      shadow:       'sm',               // 'none' | 'sm' | 'md' | 'lg' | 'glow'
      padding:      'comfortable',      // 'compact' | 'comfortable' | 'spacious'
      // Tipografia
      titleColor:   'auto',
      valueColor:   'auto',
      accentColor:  'auto',
      textColor:    'auto',
      fontFamily:   'auto',             // 'auto' | 'display' | 'mono' | 'sans'
      fontScale:    'md',               // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
      fontWeight:   'normal',           // 'light' | 'normal' | 'medium' | 'bold'
      textAlign:    'left',             // 'left' | 'center' | 'right'
      // Layout & elementos
      showTitle:    true,
      showSubtitle: true,
      showFooter:   true,
      compact:      false,
      // Específicos (charts)
      palette:      'auto',             // referência a uma chave de PALETTES
      chartLineStyle: 'smooth',         // 'smooth' | 'sharp' | 'stepped'
      chartGrid:    true,
      chartLegend:  true,
      chartAnimation: true,
      // KPI/BigNum específicos
      kpiDeltaPosition: 'below',        // 'below' | 'inline' | 'hidden'
      bignumGiant:  false               // BigNum em modo extra-grande
    };

    // 6 presets que aplicam combinações pré-definidas (visualmente distintos)
    const PRESETS = {
      'default': {
        label: 'Padrão',
        description: 'Visual equilibrado, herda do tema',
        sample: 'border subtle · radius md · shadow sm'
      },
      'minimal': {
        label: 'Minimalista',
        description: 'Sem bordas, sem sombra, espaço amplo',
        sample: 'border none · radius sm · shadow none · padding spacious',
        overrides: { border:'none', shadow:'none', radius:'sm', padding:'spacious' }
      },
      'card': {
        label: 'Card destacado',
        description: 'Sombra média + cantos arredondados',
        sample: 'border subtle · radius lg · shadow md',
        overrides: { border:'subtle', shadow:'md', radius:'lg' }
      },
      'glass': {
        label: 'Glass (vidro)',
        description: 'Translúcido + sombra forte',
        sample: 'bg vidro · border subtle · shadow lg · radius xl',
        overrides: { background:'glass', border:'subtle', shadow:'lg', radius:'xl', backgroundOpacity: 0.6 }
      },
      'brutalist': {
        label: 'Brutalista',
        description: 'Borda grossa, sem arredondamento, sem sombra',
        sample: 'border thick · radius none · shadow none',
        overrides: { border:'thick', radius:'none', shadow:'none' }
      },
      'highlight': {
        label: 'Destaque',
        description: 'Borda accent + brilho/glow',
        sample: 'border accent · shadow glow · radius md',
        overrides: { border:'solid', borderColor:'accent', shadow:'glow', radius:'md' }
      },
      'compact': {
        label: 'Compacto',
        description: 'Tudo apertado, tipografia menor',
        sample: 'padding compact · fontScale xs · radius sm',
        overrides: { padding:'compact', fontScale:'xs', radius:'sm', shadow:'none' }
      }
    };

    // Paletas de cor para charts.
    // 'auto' agora aponta pra paleta 'friendly' (colorblind-safe, alta legibilidade,
    // boa em dark E light) — antes era null que não pintava nada.
    const PALETTES = {
      'auto':       { label:'Automática (Amigável)', colors: ['#4D9FFF','#4ADE80','#FBBF24','#A78BFA','#F87171','#22D3EE','#FB923C','#F472B6','#34D399','#818CF8','#FACC15','#2DD4BF'] },
      'friendly':   { label:'Amigável (cliente)', colors: ['#4D9FFF','#4ADE80','#FBBF24','#A78BFA','#F87171','#22D3EE','#FB923C','#F472B6','#34D399','#818CF8','#FACC15','#2DD4BF'] },
      'colorblind': { label:'Acessível (CB-safe)', colors: ['#0173B2','#DE8F05','#029E73','#CC78BC','#ECE133','#56B4E9','#D55E00','#CC79A7','#F0E442','#009E73','#0072B2','#E69F00'] },
      'corporate':  { label:'Corporativo', colors: ['#003D7A','#0066B2','#3399CC','#66BBE5','#99DDFF','#CCE8FF','#1A5490','#4D88B5','#7FAACA','#B2CCDF','#003D7A','#3399CC'] },
      'pastel':     { label:'Pastel',     colors: ['#FFB5BA','#FFD580','#B5EAD7','#C7CEEA','#E2C5E1','#FFDAC1','#A8D8EA','#FFAAA5','#FFD3B5','#DCEDC1','#E6CCFF','#FFE5B4'] },
      'vibrant':    { label:'Vibrante',   colors: ['#FF6B6B','#4ECDC4','#FFE66D','#A8E6CF','#FF8B94','#5D8AA8','#F38181','#95E1D3','#FCE38A','#EAFFD0','#F6BBA8','#A8D8EA'] },
      'earth':      { label:'Terra',      colors: ['#8B4513','#CD853F','#DEB887','#F4A460','#D2691E','#A0522D','#BC8F8F','#F5DEB3','#DAA520','#B8860B','#CD5C5C','#8B7355'] },
      'monochrome': { label:'Monocromática', colors: ['#1F2937','#4B5563','#6B7280','#9CA3AF','#D1D5DB','#E5E7EB','#374151','#6B7280','#9CA3AF','#D1D5DB','#F3F4F6','#FFFFFF'] },
      'rainbow':    { label:'Arco-íris',  colors: ['#FF595E','#FF924C','#FFCA3A','#8AC926','#1982C4','#6A4C93','#F44336','#FF9800','#FFEB3B','#4CAF50','#03A9F4','#9C27B0'] },
      'sunset':     { label:'Pôr do sol', colors: ['#F8B195','#F67280','#C06C84','#6C5B7B','#355C7D','#A8E6CE','#FFEFC8','#FFAA64','#FF8364','#EF4444','#B91C1C','#7F1D1D'] },
      // SOL-H4 v2: paleta Itaú para charts. Núcleo laranja com gradação
      // tons quentes + neutros (compatível com identidade corporativa).
      'itau':       { label:'Itaú',       colors: ['#FF6C00','#EC5F00','#B84800','#FFB87A','#7A3A00','#FF8A33','#3A2A1A','#FFE0BF','#CC5600','#5A4030','#FFC994','#1A0E00'] }
    };

    // Mapeamentos numéricos pra CSS
    const BORDER_WIDTH = { none:'0', subtle:'1px', solid:'1px', thick:'3px', dashed:'2px' };
    const BORDER_STYLE = { none:'none', subtle:'solid', solid:'solid', thick:'solid', dashed:'dashed' };
    const RADIUS = { none:'0', sm:'4px', md:'8px', lg:'12px', xl:'18px', full:'9999px' };
    // Camada Polish v5: sombras adaptativas REAIS por tema via CSS variables.
    // Light: sombra preta (rgba(0,0,0,X)) clássica.
    // Dark:  sombra BRANCA (rgba(255,255,255,X)) — destaca o card no fundo escuro
    //        exatamente como preto destaca em fundo branco.
    // As variáveis --shadow-sm/md/lg estão definidas no CSS por seletor de tema.
    const SHADOW = {
      none: 'none',
      sm:   'var(--solstice-shadow-sm)',
      md:   'var(--solstice-shadow-md)',
      lg:   'var(--solstice-shadow-lg)',
      glow: '0 0 0 2px color-mix(in srgb, var(--c-accent) 30%, transparent), 0 4px 16px color-mix(in srgb, var(--c-accent) 25%, transparent)'
    };
    const PADDING = { compact:'8px', comfortable:'16px', spacious:'24px' };
    const FONT_FAMILY = {
      auto:    'inherit',
      display: 'var(--font-display)',
      mono:    'var(--font-mono)',
      sans:    "'Inter', 'Helvetica Neue', sans-serif"
    };
    const FONT_SCALE = { xs:'0.85', sm:'0.92', md:'1', lg:'1.1', xl:'1.25', '2xl':'1.5' };
    const FONT_WEIGHT = { light:'300', normal:'400', medium:'500', bold:'700' };

    /** Resolve style aplicando preset overrides + valores explícitos */
    function resolve(style){
      const s = { ...DEFAULTS };
      // Aplica preset primeiro
      const p = PRESETS[style && style.preset || 'default'];
      if (p && p.overrides) Object.assign(s, p.overrides);
      // Depois aplica valores explícitos do usuário (mais alta prioridade)
      if (style){
        Object.keys(style).forEach(k => {
          if (style[k] !== undefined && style[k] !== null && style[k] !== 'auto') {
            s[k] = style[k];
          }
        });
      }
      return s;
    }

    /** Aplica style no host (.solstice__comp) via CSS custom properties + classes */
    function apply(host, style){
      if (!host) return;
      const s = resolve(style || {});
      const setVar = (k, v) => host.style.setProperty(k, v);

      // Background
      if (s.background === 'glass'){
        setVar('--comp-bg', 'color-mix(in srgb, var(--c-surface) ' + Math.round(s.backgroundOpacity * 100) + '%, transparent)');
        host.style.backdropFilter = 'blur(12px)';
      } else if (s.background && s.background !== 'auto'){
        setVar('--comp-bg', s.background);
        host.style.backdropFilter = '';
      } else {
        host.style.removeProperty('--comp-bg');
        host.style.backdropFilter = '';
      }

      // Border
      setVar('--comp-border-width', BORDER_WIDTH[s.border] || '1px');
      setVar('--comp-border-style', BORDER_STYLE[s.border] || 'solid');
      if (s.borderColor === 'accent'){
        setVar('--comp-border-color', 'var(--c-accent)');
      } else if (s.borderColor && s.borderColor !== 'auto'){
        setVar('--comp-border-color', s.borderColor);
      } else {
        host.style.removeProperty('--comp-border-color');
      }

      // Radius + shadow + padding
      setVar('--comp-radius', RADIUS[s.radius] || RADIUS.md);
      setVar('--comp-shadow', SHADOW[s.shadow] || SHADOW.sm);
      setVar('--comp-padding', PADDING[s.padding] || PADDING.comfortable);

      // Tipografia
      setVar('--comp-font-family', FONT_FAMILY[s.fontFamily] || 'inherit');
      setVar('--comp-font-scale', FONT_SCALE[s.fontScale] || '1');
      setVar('--comp-font-weight', FONT_WEIGHT[s.fontWeight] || '400');
      setVar('--comp-text-align', s.textAlign || 'left');

      // Cores
      if (s.accentColor && s.accentColor !== 'auto') setVar('--comp-accent', s.accentColor); else host.style.removeProperty('--comp-accent');
      if (s.titleColor && s.titleColor !== 'auto') setVar('--comp-title-color', s.titleColor); else host.style.removeProperty('--comp-title-color');
      if (s.valueColor && s.valueColor !== 'auto') setVar('--comp-value-color', s.valueColor); else host.style.removeProperty('--comp-value-color');
      if (s.textColor && s.textColor !== 'auto') setVar('--comp-text-color', s.textColor); else host.style.removeProperty('--comp-text-color');

      // Classes condicionais
      host.classList.toggle('solstice__comp--no-title',    s.showTitle === false);
      host.classList.toggle('solstice__comp--no-subtitle', s.showSubtitle === false);
      host.classList.toggle('solstice__comp--no-footer',   s.showFooter === false);
      host.classList.toggle('solstice__comp--centered',    s.textAlign === 'center');
      host.classList.toggle('solstice__comp--right',       s.textAlign === 'right');
      host.classList.toggle('solstice__comp--compact',     s.compact === true);
      host.classList.toggle('solstice__comp--giant',       s.bignumGiant === true);

      // Data attribute pro preset (pra CSS gancho)
      host.setAttribute('data-style-preset', s.preset || 'default');
    }

    function preset(name){
      if (PRESETS[name]) return PRESETS[name];
      // Camada Polish v5: presets salvos pelo usuário ficam em Store.ui.style.userPresets
      const user = SolsticeStore.get('ui.style.userPresets') || {};
      return user[name] || PRESETS.default;
    }
    function listPresets(){
      const builtin = Object.keys(PRESETS).map(k => ({ key:k, ...PRESETS[k], builtin: true }));
      const user = SolsticeStore.get('ui.style.userPresets') || {};
      const custom = Object.keys(user).map(k => ({ key:k, ...user[k], builtin: false, custom: true }));
      return builtin.concat(custom);
    }
    function saveUserPreset(name, style){
      if (!name || !name.trim()) return false;
      const safeName = name.trim().slice(0, 40);
      const user = SolsticeStore.get('ui.style.userPresets') || {};
      user[safeName] = {
        label: safeName,
        description: 'Preset personalizado',
        sample: 'salvo por você',
        overrides: SolsticeUtils.deepClone(style || {})
      };
      SolsticeStore.set('ui.style.userPresets', user);
      return true;
    }
    function removeUserPreset(name){
      const user = SolsticeStore.get('ui.style.userPresets') || {};
      if (user[name]){
        delete user[name];
        SolsticeStore.set('ui.style.userPresets', user);
        return true;
      }
      return false;
    }
    function paletteColors(name){
      // G3-23 v3 · paleta global propaga. Quando o usuário NÃO escolheu paleta
      // específica do gráfico (name = 'auto' ou null), olhamos o tema GLOBAL
      // (SolsticeTheme.get('palette')) e usamos a paleta correspondente.
      // Override manual no Inspector continua tendo precedência (name ≠ 'auto').
      if (!name || name === 'auto'){
        try {
          const globalPal = (typeof SolsticeTheme !== 'undefined' && SolsticeTheme.get)
            ? SolsticeTheme.get('palette') : null;
          if (globalPal && PALETTES[globalPal] && PALETTES[globalPal].colors){
            return PALETTES[globalPal].colors;
          }
        } catch(_){}
        return PALETTES.auto ? PALETTES.auto.colors : null;
      }
      const p = PALETTES[name];
      return (p && p.colors) ? p.colors : null;
    }
    function listPalettes(){ return Object.keys(PALETTES).map(k => ({ key:k, ...PALETTES[k] })); }

    // Clipboard interno pra copiar/colar estilo entre componentes
    // (não depende de navigator.clipboard que pode falhar em file://)
    let _clipboard = null;
    function copyToClipboard(style){
      _clipboard = SolsticeUtils.deepClone(style || {});
      // Tenta também copiar pro clipboard do sistema (best-effort)
      try {
        if (navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(JSON.stringify(_clipboard, null, 2));
        }
      } catch(_){}
      return _clipboard;
    }
    function hasClipboard(){ return _clipboard != null; }
    function getClipboard(){ return _clipboard ? SolsticeUtils.deepClone(_clipboard) : null; }

    // SOL-D5 v2: API pública para adicionar cor recente + ouvir o evento de
    // atualização. Usada pelo color picker (Props) e por integrações externas
    // (snapshots, comandos).
    function addRecentColor(color){
      if (!color || color === 'auto' || !/^#[0-9a-fA-F]{6}$/.test(color)) return false;
      const r = SolsticeStore.get('ui.style.recentColors') || [];
      const cur = (Array.isArray(r) ? r : []).filter(c => c.toLowerCase() !== color.toLowerCase());
      cur.unshift(color);
      SolsticeStore.set('ui.style.recentColors', cur.slice(0, 5));
      try { window.dispatchEvent(new CustomEvent('solstice:recent-color', { detail:{ color } })); } catch(_){}
      return true;
    }
    function listRecentColors(){
      const r = SolsticeStore.get('ui.style.recentColors');
      return Array.isArray(r) ? r.slice() : [];
    }

    return { DEFAULTS, PRESETS, PALETTES, resolve, apply, preset, listPresets, paletteColors, listPalettes,
      copyToClipboard, hasClipboard, getClipboard,
      saveUserPreset, removeUserPreset,
      addRecentColor, listRecentColors };
  })();
