
  /* ============================================================
     Patch 1A (ADR-119) — SolsticeLimits
     Modal "Limites do Solstice" (ajuda). Mostrado via SolsticeLimits.open()
     ou botão na Configurações / Ajuda.
     ============================================================ */
  const SolsticeLimits = (function(){
    const LIMITS = [
      { area:'Linhas',         value:'até 50k testado · 100k aceitável · acima → Parquet/DuckDB',  note:'Performance' },
      { area:'Colunas',        value:'até 200 sem degradação',                                       note:'UI/Editor' },
      { area:'Componentes',    value:'até 50 por dashboard',                                         note:'Memória' },
      { area:'Snapshots',      value:'cap 30 por perfil em localStorage',                            note:'B11' },
      { area:'Insights',       value:'top 8 mostrados; recompute throttled 500ms',                   note:'ADR-112' },
      { area:'Séries longas',  value:'auto LTTB para 600 pontos quando > 800',                       note:'ADR-114' },
      { area:'Cache slot',     value:'TTL 5 min · até 100 entradas LRU',                             note:'ADR-113' },
      { area:'Stats async',    value:'(Patch 1A.P1 — Worker reservado para futura ativação)',        note:'ADR-???' }
    ];

    function open(){
      const body = SolsticeUtils.el('div', { style:'font-size:12px;line-height:1.6;' });
      const table = SolsticeUtils.el('table', { style:'width:100%;border-collapse:collapse;font-family:var(--font-mono);' });
      LIMITS.forEach(l => {
        const tr = SolsticeUtils.el('tr');
        tr.appendChild(SolsticeUtils.el('td', { style:'padding:6px 8px;color:var(--c-text);font-weight:600;width:30%;border-bottom:1px solid var(--c-border);' }, l.area));
        tr.appendChild(SolsticeUtils.el('td', { style:'padding:6px 8px;color:var(--c-text-2);border-bottom:1px solid var(--c-border);' }, l.value));
        tr.appendChild(SolsticeUtils.el('td', { style:'padding:6px 8px;color:var(--c-muted);font-size:10px;border-bottom:1px solid var(--c-border);' }, l.note));
        table.appendChild(tr);
      });
      body.appendChild(table);
      body.appendChild(SolsticeUtils.el('div', { style:'margin-top:12px;padding:8px;background:var(--c-surface-2);border-radius:6px;font-size:11px;color:var(--c-muted);' },
        'Limites são metas testadas — não barreiras rígidas. Acima delas pode funcionar com lentidão progressiva.'));
      SolsticeModal.show({
        title: '📏 Limites declarados',
        body,
        buttons: [{ label:'Entendi', kind:'primary', onClick: () => true }]
      });
    }

    return { open, LIMITS };
  })();
