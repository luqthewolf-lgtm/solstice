
  /* ============================================================
     BLOCO 8 — SolsticeInconsistencies
     Catálogo de 15 regras de inconsistência analítica. Cada regra:
       { id, label, description, when(ctx) → boolean, severity, hint }
     Validações são chamadas pelo SolsticeProps ao render do Inspector
     (badge inline com warn) e listadas em Solstice.Inconsistencies.list().
     ============================================================ */
  const SolsticeInconsistencies = (function(){
    /**
     * RULES — cada regra recebe ctx { slot, def, ingest, dict, rows, columns, types }
     * e retorna true se o problema é DETECTADO.
     * `id` é único; `severity` ∈ 'warn' | 'info' | 'error'.
     */
    const RULES = [
      {
        id: 'avg-of-avg',
        label: 'Média de média',
        severity: 'warn',
        description: 'KPI com agregação "média" sobre dados já agregados pode mascarar volume.',
        hint: 'Use Soma ou Mediana ponderada por volume.',
        when: (ctx) => ctx.def && ctx.def.id === 'kpi' && (ctx.slot.config || {}).agg === 'avg' &&
                       (ctx.dict && ctx.dict.columns && ctx.dict.columns[(ctx.slot.config||{}).column] &&
                        /media|avg|mean|pct|%|rate|taxa/i.test(ctx.dict.columns[(ctx.slot.config||{}).column].friendlyName || ''))
      },
      {
        id: 'sum-of-pct',
        label: 'Soma de percentual',
        severity: 'warn',
        description: 'Somar valores que já são % gera número sem significado.',
        hint: 'Use Média ou Mediana de % em vez de Soma.',
        when: (ctx) => {
          const cfg = ctx.slot.config || {};
          if (!cfg.column) return false;
          if (cfg.agg !== 'sum') return false;
          const t = (ctx.types[cfg.column] || {}).type;
          return t === 'percentage';
        }
      },
      {
        id: 'sum-of-id',
        label: 'Soma de identificador',
        severity: 'error',
        description: 'Somar IDs/CPF/CNPJ/CEP não tem significado de negócio.',
        hint: 'Use Contagem (count) ou Distinct count.',
        when: (ctx) => {
          const cfg = ctx.slot.config || {};
          if (!cfg.column) return false;
          if (cfg.agg !== 'sum') return false;
          const group = SolsticeTypes.group((ctx.types[cfg.column] || {}).type);
          return group === 'id';
        }
      },
      {
        id: 'count-vs-sum-confusion',
        label: 'Contagem vs Soma',
        severity: 'info',
        description: 'Confirme se a intenção é "quantos" (Contagem) ou "qual o total" (Soma).',
        hint: 'KPIs comuns: "Total de Vendas" = Soma; "Quantidade de Pedidos" = Contagem.',
        when: (ctx) => ctx.def && ctx.def.id === 'kpi' && (ctx.slot.config || {}).agg === 'sum' &&
                       SolsticeTypes.group((ctx.types[(ctx.slot.config||{}).column] || {}).type) === 'numeric' &&
                       (ctx.rows && ctx.rows.length < 30)
      },
      {
        id: 'high-null-col',
        label: 'Coluna com muitos nulos',
        severity: 'warn',
        description: 'Coluna selecionada tem mais de 50% de valores nulos.',
        hint: 'Considere filtrar nulos antes ou escolher outra coluna.',
        when: (ctx) => {
          const cfg = ctx.slot.config || {};
          const col = cfg.column || cfg.yColumn || cfg.valueColumn;
          if (!col) return false;
          const total = ctx.rows.length;
          const nulls = SolsticeStats.countNulls(ctx.rows.map(r => r[col]));
          return total > 0 && nulls / total > 0.50;
        }
      },
      {
        id: 'gauge-meta-fora-range',
        label: 'Meta fora do range',
        severity: 'warn',
        description: 'A meta configurada está fora do range mínimo/máximo do gauge — agulha não pode mostrar.',
        hint: 'Ajuste range ou meta.',
        when: (ctx) => {
          if (!ctx.def || ctx.def.id !== 'gauge') return false;
          const cfg = ctx.slot.config || {};
          if (cfg.target == null) return false;
          return cfg.target < cfg.min || cfg.target > cfg.max;
        }
      },
      {
        id: 'sankey-same-cols',
        label: 'Origem = Destino no Sankey',
        severity: 'error',
        description: 'sourceColumn e targetColumn devem ser colunas distintas.',
        hint: 'Escolha uma categórica diferente em ⚙️ Configurar → Dados.',
        when: (ctx) => ctx.def && ctx.def.id === 'sankey' &&
                       (ctx.slot.config || {}).sourceColumn === (ctx.slot.config || {}).targetColumn &&
                       (ctx.slot.config || {}).sourceColumn != null
      },
      {
        id: 'distrib-bins-extremos',
        label: 'Bins extremos na Distribuição',
        severity: 'info',
        description: 'Número de bins muito pequeno (<6) ou muito grande (>60) prejudica a leitura.',
        hint: 'Faixa típica: 15-30 bins.',
        when: (ctx) => {
          if (!ctx.def || ctx.def.id !== 'distribution') return false;
          const b = (ctx.slot.config || {}).bins || 20;
          return b < 6 || b > 60;
        }
      },
      {
        id: 'boxplot-grupos-demais',
        label: 'Box Plot com muitos grupos',
        severity: 'warn',
        description: 'Categórica de agrupamento com mais de 8 distintos — visualização fica saturada.',
        hint: 'Componente já corta para top-8 por contagem, mas considere uma categórica mais agregada.',
        when: (ctx) => {
          if (!ctx.def || ctx.def.id !== 'boxplot') return false;
          const gc = (ctx.slot.config || {}).groupColumn;
          if (!gc) return false;
          return SolsticeStats.distinctCount(ctx.rows.map(r => r[gc])) > 8;
        }
      },
      {
        id: 'scatter-poucos-pontos',
        label: 'Scatter com poucos pontos',
        severity: 'info',
        description: 'Scatter com menos de 10 pontos pareados não é estatisticamente robusto.',
        hint: 'Considere outra visualização (KPI, Tabela).',
        when: (ctx) => {
          if (!ctx.def || ctx.def.id !== 'scatter') return false;
          const cfg = ctx.slot.config || {};
          if (!cfg.xColumn || !cfg.yColumn) return false;
          let n = 0;
          for (const r of ctx.rows){
            const x = SolsticeStats.parseNum(r[cfg.xColumn]), y = SolsticeStats.parseNum(r[cfg.yColumn]);
            if (!isNaN(x) && !isNaN(y)) n++;
          }
          return n < 10;
        }
      },
      {
        id: 'monovalor',
        label: 'Coluna com 1 valor único',
        severity: 'warn',
        description: 'A coluna selecionada tem apenas 1 valor distinto — análise sem informação.',
        hint: 'Escolha outra coluna em ⚙️.',
        when: (ctx) => {
          const cfg = ctx.slot.config || {};
          const col = cfg.column || cfg.yColumn || cfg.valueColumn;
          if (!col) return false;
          return SolsticeStats.distinctCount(ctx.rows.map(r => r[col])) === 1;
        }
      },
      {
        id: 'comparison-no-temporal',
        label: 'Período anterior sem coluna temporal',
        severity: 'warn',
        description: 'Comparação "previous-period" foi configurada mas o dataset não tem coluna temporal — usa proxy (1ª vs 2ª metade dos registros).',
        hint: 'Aceitável até filtros globais B9. Considere "Meta fixa" ou "Média histórica".',
        when: (ctx) => {
          if (!ctx.def || ctx.def.id !== 'kpi') return false;
          const cmp = (ctx.slot.config || {}).comparison;
          if (!cmp || cmp.type !== 'previous-period') return false;
          return !ctx.columns.some(c => SolsticeTypes.group((ctx.types[c]||{}).type) === 'temporal');
        }
      },
      {
        id: 'time-series-poucos-pontos',
        label: 'Série Temporal com poucos pontos',
        severity: 'info',
        description: 'Menos de 5 pontos no eixo temporal — visualização pouco informativa.',
        hint: 'Tente um bin temporal mais granular (day em vez de month) ou outra coluna temporal.',
        when: (ctx) => {
          if (!ctx.def || ctx.def.id !== 'time-series') return false;
          const cfg = ctx.slot.config || {};
          if (!cfg.xColumn) return false;
          const keys = new Set();
          for (const r of ctx.rows){
            const d = new Date(r[cfg.xColumn]); if (isNaN(d)) continue;
            const k = cfg.bin === 'month' ? d.getFullYear() + '-' + d.getMonth()
                    : cfg.bin === 'week'  ? d.getFullYear() + '-' + Math.floor(d.getDate()/7)
                    : d.toISOString().slice(0, 10);
            keys.add(k);
          }
          return keys.size < 5;
        }
      },
      {
        id: 'agg-incompat-comparison',
        label: 'Agregação incompatível com comparação',
        severity: 'warn',
        description: 'A baseline atual da Comparação não faz sentido estatístico com a agregação escolhida.',
        hint: 'Esse alerta dispara antes do auto-switch (ADR-044). Ajuste agregação ou comparação.',
        when: (ctx) => {
          if (!ctx.def || ctx.def.id !== 'kpi') return false;
          const cfg = ctx.slot.config || {};
          const cmp = cfg.comparison;
          if (!cmp) return false;
          return !SolsticeKPI.isCompatible(cfg.agg || 'sum', cmp.type);
        }
      },
      {
        id: 'tabela-sem-filtro-grande',
        label: 'Tabela com 500+ linhas sem filtro',
        severity: 'info',
        description: 'Mais de 500 linhas e nenhum filtro — performance pode degradar.',
        hint: 'Aplique filtros globais (Bloco 9) ou reduza rowLimit em ⚙️.',
        when: (ctx) => {
          if (!ctx.def || ctx.def.id !== 'table') return false;
          return ctx.rows.length > 500;
        }
      }
    ];

    // === Prompt 4 v5.4 — regras de NÍVEL DE COLUNA ===
    // Diferente de RULES (que avalia slot+config), COLUMN_RULES varre cada coluna
    // do dataset e detecta inconsistências dos VALORES dentro dela. Cache por
    // (column, rowsLength) para evitar recálculo a cada checkSlot.

    // Regexes de detecção de dialetos de currency
    const CURRENCY_DIALECTS = [
      { code: 'BRL', label: 'BRL (R$)',  rx: /^\s*R\$\s*[\d.,\-]+\s*$/i },
      { code: 'USD', label: 'USD ($)',   rx: /^\s*(USD\s+|\$)\s*[\d.,\-]+\s*$|^\s*[\d.,\-]+\s*USD\s*$/i },
      { code: 'EUR', label: 'EUR (€)',   rx: /^\s*(€|EUR\s+)\s*[\d.,\-]+\s*$|^\s*[\d.,\-]+\s*€\s*$|^\s*[\d.,\-]+\s*EUR\s*$/i },
      { code: 'GBP', label: 'GBP (£)',   rx: /^\s*(£|GBP\s+)\s*[\d.,\-]+\s*$/i },
      { code: 'RAW', label: 'sem símbolo (decimal cru)', rx: /^\s*-?[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\s*$/ }
    ];
    // Regexes de formatos de data
    const DATE_FORMATS = [
      { code: 'ISO',     label: 'ISO 8601 (2024-05-01)',   rx: /^\s*\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\s*$/ },
      { code: 'BR',      label: 'BR (01/05/2024)',         rx: /^\s*\d{2}\/\d{2}\/\d{2,4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?\s*$/ },
      { code: 'EN',      label: 'EN ("May 1, 2024")',      rx: /^\s*[A-Za-z]+\s+\d{1,2},?\s+\d{4}\s*$/ },
      { code: 'UNIX_S', label: 'Unix timestamp (segundos)',  rx: /^\s*1[0-9]{9}\s*$/ },  // 946684800-4102444800 → ~1B até 1.5B
      { code: 'UNIX_MS',label: 'Unix timestamp (milissegundos)', rx: /^\s*1[0-9]{12}\s*$/ }
    ];

    function _detectCurrencyDialects(values){
      const counts = {};
      let matched = 0, total = 0;
      for (const v of values){
        if (v == null || v === '') continue;
        total++;
        const s = String(v).trim();
        for (const d of CURRENCY_DIALECTS){
          if (d.rx.test(s)){
            counts[d.code] = (counts[d.code] || 0) + 1;
            matched++;
            break;
          }
        }
      }
      // Considera "currency-like" quando >=50% das células fazem match em alguma regex
      const isCurrency = total > 0 && matched / total >= 0.50;
      // Considera "mixed" apenas se 2+ dialetos NÃO-RAW coexistem (RAW sozinho não é mistura)
      const symbolicCodes = Object.keys(counts).filter(c => c !== 'RAW' && counts[c] > 0);
      const mixed = symbolicCodes.length >= 2
        || (symbolicCodes.length >= 1 && (counts.RAW || 0) >= 2); // símbolo + decimal cru = mistura também
      return { isCurrency, counts, mixed, total, matched };
    }

    function _detectDateFormats(values, columnType){
      const counts = {};
      let matched = 0, total = 0;
      for (const v of values){
        if (v == null || v === '') continue;
        total++;
        const s = String(v).trim();
        for (const f of DATE_FORMATS){
          if (f.rx.test(s)){
            counts[f.code] = (counts[f.code] || 0) + 1;
            matched++;
            break;
          }
        }
      }
      // Considera "date-like" se tipo inferido é temporal/date_only OU >30% match
      const isDate = (['temporal','date_only'].includes(columnType)) || (total > 0 && matched / total >= 0.30);
      const formats = Object.keys(counts).filter(c => counts[c] > 0);
      const mixed = formats.length >= 2;
      return { isDate, counts, mixed, total, matched, formats };
    }

    // Cache: { datasetKey: { colName: hit | null } }
    let _columnCheckCache = null;
    let _columnCheckCacheKey = null;

    /** Retorna hits de coluna (id + label + severity + description + hint + affectedColumns).
     *  Usa amostragem (até 5000 linhas) para garantir <100ms em datasets grandes. */
    function checkColumns(){
      const ingest = SolsticeStore.get('ingest') || {};
      const rows = ingest.rows || [];
      const columns = ingest.columns || [];
      const types = ingest.types || {};
      const cacheKey = (columns.length) + ':' + (rows.length) + ':' + (ingest.meta && ingest.meta.rowsCount);
      if (_columnCheckCacheKey === cacheKey && _columnCheckCache) return _columnCheckCache;

      const sampleRows = rows.length > 5000 ? rows.slice(0, 5000) : rows;
      const hits = [];

      for (const col of columns){
        const colType = (types[col] || {}).type;
        const values = sampleRows.map(r => r[col]);

        // Regra A — currency_mixed_dialects
        const cur = _detectCurrencyDialects(values);
        if (cur.isCurrency && cur.mixed){
          const dialectsLabel = Object.entries(cur.counts)
            .filter(([k, v]) => v > 0)
            .map(([k, v]) => CURRENCY_DIALECTS.find(d => d.code === k).label + ' (' + v + ')')
            .join(', ');
          hits.push({
            id: 'currency_mixed_dialects',
            column: col,
            label: 'Moedas misturadas em "' + col + '"',
            severity: 'warn',
            description: 'Coluna "' + col + '" tem valores em moedas/formatos diferentes: ' + dialectsLabel + '. Agregações podem ficar incoerentes.',
            hint: 'Normalize para uma única moeda (Editor → ⚡ Transformar) ou separe em colunas distintas (ex: preço_BRL, preço_USD).',
            details: { dialects: cur.counts, matched: cur.matched, total: cur.total }
          });
        }

        // Regra B — date_heterogeneous_formats
        const dat = _detectDateFormats(values, colType);
        if (dat.isDate && dat.mixed){
          const formatsLabel = dat.formats
            .map(f => DATE_FORMATS.find(d => d.code === f).label + ' (' + dat.counts[f] + ')')
            .join(', ');
          hits.push({
            id: 'date_heterogeneous_formats',
            column: col,
            label: 'Datas em formatos mistos em "' + col + '"',
            severity: 'error',
            description: 'Coluna "' + col + '" tem formatos de data diferentes: ' + formatsLabel + '. Parsing fica ambíguo e ordenação cronológica quebra.',
            hint: 'Use o editor (⚡ Transformar) para padronizar para ISO 8601 (YYYY-MM-DD).',
            details: { formats: dat.counts, matched: dat.matched, total: dat.total }
          });
        }
      }
      _columnCheckCache = hits;
      _columnCheckCacheKey = cacheKey;
      return hits;
    }
    // Invalida cache quando ingest muda
    try {
      SolsticeStore.subscribe('ingest', () => { _columnCheckCache = null; _columnCheckCacheKey = null; });
    } catch(_) {}

    /** Lista todos os ids + descrições (útil para debug e dashboards futuros). */
    function catalog(){
      return [
        ...RULES.map(r => ({ id: r.id, label: r.label, severity: r.severity, description: r.description, hint: r.hint, scope: 'slot' })),
        { id: 'currency_mixed_dialects', label: 'Moedas misturadas (coluna)', severity: 'warn',
          description: 'Coluna currency com 2+ dialetos (BRL+USD+EUR+raw).',
          hint: 'Normalize para uma única moeda.', scope: 'column' },
        { id: 'date_heterogeneous_formats', label: 'Datas em formatos mistos (coluna)', severity: 'error',
          description: 'Coluna temporal com 2+ formatos (ISO+BR+EN+Unix).',
          hint: 'Padronize via ⚡ Transformar.', scope: 'column' }
      ];
    }

    /**
     * Avalia regras para um slot. Retorna array de hits { id, label, severity, description, hint }.
     *  Prompt 4 v5.4: agora inclui hits de COLUNA se o slot usa coluna afetada.
     */
    function checkSlot(slotId){
      const sec = SolsticeStore.get('canvas.sections') || [];
      let slot = null;
      for (const s of sec) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slotId);
        if (sl){ slot = sl; break; }
      }
      if (!slot) return [];
      const def = SolsticeComponents.get(slot.type);
      const ingest = SolsticeStore.get('ingest') || {};
      const ctx = {
        slot, def,
        ingest,
        rows: ingest.rows || [],
        columns: ingest.columns || [],
        types: ingest.types || {},
        dict: SolsticeStore.get('dictionary')
      };
      const hits = [];
      for (const rule of RULES){
        try {
          if (rule.when(ctx)){
            hits.push({ id: rule.id, label: rule.label, severity: rule.severity, description: rule.description, hint: rule.hint });
          }
        } catch(e){ /* regra deu erro — ignora silenciosamente */ }
      }

      // Prompt 4 v5.4: anexa hits de COLUNA se o slot usa coluna afetada.
      // Pega as colunas usadas pelo slot (config.column, yColumn, xColumn, etc).
      try {
        const cfg = slot.config || {};
        const usedCols = new Set([
          cfg.column, cfg.xColumn, cfg.yColumn, cfg.valueColumn,
          cfg.sourceColumn, cfg.targetColumn, cfg.groupBy, cfg.dateColumn
        ].filter(Boolean));
        if (usedCols.size){
          const colHits = checkColumns();
          for (const ch of colHits){
            if (usedCols.has(ch.column)){
              hits.push({ id: ch.id, label: ch.label, severity: ch.severity, description: ch.description, hint: ch.hint });
            }
          }
        }
      } catch(_) {}

      return hits;
    }

    return { catalog, checkSlot, checkColumns, RULES };
  })();
