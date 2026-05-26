
  /* ============================================================
     Erros adicionais do Bloco 2
     ============================================================ */
  SolsticeErrors.register('CSV_DELIMITER_AMBIGUOUS', {
    sev: 'warn', icon: '↔️',
    message: 'Não consegui ter certeza do separador deste CSV.',
    suggestion: 'Detectei {delimiter} como provável, mas confiança baixa. Verifique se o arquivo está bem formatado.'
  });
  SolsticeErrors.register('COLUMN_HIGH_NULL_RATIO', {
    sev: 'warn', icon: '🕳️',
    message: 'A coluna "{col}" tem {pct}% de valores nulos.',
    suggestion: 'Considere remover a coluna ou preencher valores com transformação `fillna`.'
  });
  SolsticeErrors.register('COLUMN_TYPE_AMBIGUOUS', {
    sev: 'info', icon: '🤷',
    message: 'A coluna "{col}" tem tipo ambíguo.',
    suggestion: 'Selecionei "{type}" com {pct}% de confiança. Você pode mudar manualmente no editor.'
  });
  SolsticeErrors.register('INVALID_CPF', {
    sev: 'error', icon: '🆔',
    message: 'CPF inválido: "{value}".',
    suggestion: 'Verifique se os 11 dígitos estão corretos. CPFs com todos dígitos iguais (ex: 111.111.111-11) não são válidos.'
  });
  SolsticeErrors.register('INVALID_CNPJ', {
    sev: 'error', icon: '🏢',
    message: 'CNPJ inválido: "{value}".',
    suggestion: 'Verifique se os 14 dígitos estão corretos e se o dígito verificador bate.'
  });

  /* ============================================================
     BLOCO 3 — CANVAS / LAYOUTS / TEMPLATES
     ============================================================ */

  /* ============================================================
     SolsticeLayouts — 10 layouts pré-definidos + custom
     Cada layout: id, name, icon, slotCount, gridTemplate (data-layout attr no .solstice__row)
     ============================================================ */
  const SolsticeLayouts = (function(){
    // Polish v8e: layouts até 8 colunas + variações mistas.
    // Era max 4col; Lucas pediu "criar mais que 4 componentes".
    const LAYOUTS = {
      '1col':        { name:'1 coluna',          icon:'▭',         slotCount:1 },
      '2col-equal':  { name:'2 colunas iguais',  icon:'▭▭',        slotCount:2 },
      '2col-2-1':    { name:'2/3 + 1/3',         icon:'▭▫',        slotCount:2 },
      '2col-1-2':    { name:'1/3 + 2/3',         icon:'▫▭',        slotCount:2 },
      '3col-equal':  { name:'3 colunas iguais',  icon:'▭▭▭',       slotCount:3 },
      '3col-1-2-1':  { name:'1/4 + 1/2 + 1/4',   icon:'▫▭▫',       slotCount:3 },
      '4col-equal':  { name:'4 colunas iguais',  icon:'▭▭▭▭',      slotCount:4 },
      // Polish v8e — novos layouts
      '5col-equal':  { name:'5 colunas iguais',  icon:'▭▭▭▭▭',     slotCount:5 },
      '6col-equal':  { name:'6 colunas iguais',  icon:'▭▭▭▭▭▭',    slotCount:6 },
      '8col-equal':  { name:'8 colunas (dense)', icon:'▭×8',       slotCount:8 },
      '4col-2-1-1':  { name:'1/2 + 1/4 + 1/4 (4)', icon:'▭▭▫▫',    slotCount:4 },
      '5col-2-1-1-1':{ name:'KPI grande + 3 (5)', icon:'▭▭▫▫▫',    slotCount:5 },
      // Polish v8a-fix4 (Auditoria 2026.4): layouts pra MAIS componentes —
      // permite linhas densas com 10+ componentes (ex: barra de mini-KPIs)
      '10col-equal': { name:'10 colunas (mini KPIs)', icon:'▭×10',  slotCount:10 },
      '12col-equal': { name:'12 colunas (ultra dense)', icon:'▭×12', slotCount:12 },
      'auto-fit':    { name:'Auto (responsivo, min 180px)', icon:'▭…',  slotCount:6 }, // slotCount inicial, CSS faz wrap
      'hero-bottom': { name:'Hero + 2 abaixo',   icon:'▭/▭▭',      slotCount:3 },
      'sidebar-main':{ name:'Sidebar + Principal',icon:'▫▭',       slotCount:2 },
      'custom':      { name:'Personalizado',     icon:'⋯',         slotCount:1 }
    };

    function get(id){ return LAYOUTS[id] || LAYOUTS['1col']; }
    function list(){ return Object.keys(LAYOUTS); }
    function slotCount(id){ return get(id).slotCount; }

    /** Reajusta a quantidade de slots de uma row ao trocar o layout. */
    function reslot(row, newLayout){
      const target = slotCount(newLayout);
      row.layout = newLayout;
      while (row.slots.length < target) row.slots.push({ id: SolsticeUtils.uuid(), type: 'empty' });
      while (row.slots.length > target) row.slots.pop();
      return row;
    }

    return { LAYOUTS, get, list, slotCount, reslot };
  })();
