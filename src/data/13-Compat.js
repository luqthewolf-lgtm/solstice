
  /* ============================================================
     Patch 1A (ADR-111) — SolsticeCompat
     Tabela de compatibilidade componente × campo → grupos aceitos.
     Inspector usa allowedColumnsFor para filtrar selects.
     ============================================================ */
  const SolsticeCompat = (function(){
    const COMPATIBILITY = {
      'kpi':           { column: ['measure'] },
      'gauge':         { column: ['measure'] },
      'time-series':   { xColumn: ['temporal'], yColumn: ['measure'] },
      'scatter':       { xColumn: ['measure'], yColumn: ['measure'], sizeColumn: ['measure'] },
      'distribution':  { column: ['measure'] },
      'boxplot':       { valueColumn: ['measure'], groupColumn: ['dimension', 'ordinal'] },
      'sankey':        { sourceColumn: ['dimension', 'ordinal'], targetColumn: ['dimension', 'ordinal'], valueColumn: ['measure'] },
      'heatmap-cal':   { dateColumn: ['temporal'], valueColumn: ['measure'] },
      'distrib-time':  { xColumn: ['temporal'], yColumn: ['measure'] },
      'pivot':         { rowDimension: ['dimension','ordinal'], colDimension: ['dimension','ordinal'], valueColumn: ['measure'] },
      'slider':        { column: ['measure'] },
      'bignum':        { column: ['measure'] },
      'funnel':        { stageColumn: ['dimension','ordinal'], valueColumn: ['measure'] },
      'event-timeline':{ dateColumn: ['temporal'], labelColumn: ['dimension','ordinal'], valueColumn: ['measure'] },
      'table':         null,
      'markdown':      null,
      'demand-list':   null,
      'metric-graph':  null
    };

    function _columnMeta(col){
      const ingest = SolsticeStore.get('ingest') || {};
      const cm = ingest.columnsMeta || {};
      return cm[col] || null;
    }

    /**
     * allowedColumnsFor(componentType, fieldName, ctx) → Array<string>
     * Retorna apenas colunas cujo userGroup está na lista permitida.
     * Se a tabela não restringe esse field (null), retorna todas.
     *
     * Auditoria 2026 (U-2): se NÃO houver coluna compatível, devolve
     * TODAS as colunas como fallback (com flag `_fallback` para o caller
     * mostrar aviso). Sem isso, o seletor ficava vazio e o usuário não
     * conseguia configurar o componente — inferência apertada de
     * "measure" engolia colunas legítimas (ex.: numeric tratada como id
     * por cardinalidade alta).
     */
    function allowedColumnsFor(componentType, fieldName, ctx){
      const def = COMPATIBILITY[componentType];
      if (!def) return ctx.columns;
      const allowed = def[fieldName];
      if (!allowed) return ctx.columns;
      const compatibles = (ctx.columns || []).filter(col => {
        const t = ctx.types && ctx.types[col];
        if (!t) return false;
        const ug = SolsticeTypes.userGroup(t.type, _columnMeta(col));
        return allowed.includes(ug);
      });
      if (compatibles.length > 0) return compatibles;
      // Fallback: nenhuma coluna ideal. Devolve todas (sinalizada).
      const all = (ctx.columns || []).slice();
      all._fallback = true;
      all._expected = allowed;
      return all;
    }

    /** True se a coluna é "ideal" (compatível pela tabela rígida). */
    function isPreferredColumn(componentType, fieldName, col, ctx){
      const def = COMPATIBILITY[componentType];
      if (!def) return true;
      const allowed = def[fieldName];
      if (!allowed) return true;
      const t = ctx.types && ctx.types[col];
      if (!t) return false;
      const ug = SolsticeTypes.userGroup(t.type, _columnMeta(col));
      return allowed.includes(ug);
    }

    return { COMPATIBILITY, allowedColumnsFor, isPreferredColumn };
  })();
