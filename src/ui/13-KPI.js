
  /* ============================================================
     SolsticeKPI (Patch B5-r3) — cálculo de delta com 8 tipos de
     comparação configurável. Retorna { pct, baseline, baselineLabel,
     direction } para o KPI Card renderizar a linha de comparação.
     ============================================================ */
  const SolsticeKPI = (function(){

    const COMPARISON_TYPES = [
      { value: 'previous-period',         label: 'Período anterior automático', short: 'Período anterior' },
      { value: 'same-period-last-year',   label: 'Mesmo período (1 ano atrás)', short: 'Mesmo período (1a)' },
      { value: 'fixed-target',            label: 'Meta fixa',                   short: 'Meta fixa' },
      { value: 'historical-mean',         label: 'Média histórica',              short: 'Média histórica' },
      { value: 'historical-median',       label: 'Mediana histórica',            short: 'Mediana histórica' },
      { value: 'first-value',             label: 'Primeiro valor',               short: 'Primeiro valor' },
      { value: 'last-value',              label: 'Último valor',                 short: 'Último valor' },
      { value: 'none',                    label: 'Sem comparação',               short: 'Sem comparação' }
    ];

    /**
     * Mapa de compatibilidade estatística entre agregação e baseline.
     * (ADR-044) Comparações fora deste mapa são consideradas suspeitas
     * e ficam atrás de "+ Mais opções" com aviso.
     */
    const AGG_COMPARISON_COMPAT = {
      sum:    ['previous-period', 'same-period-last-year', 'fixed-target', 'first-value', 'last-value', 'none'],
      avg:    ['previous-period', 'same-period-last-year', 'fixed-target', 'historical-mean', 'first-value', 'last-value', 'none'],
      mean:   ['previous-period', 'same-period-last-year', 'fixed-target', 'historical-mean', 'first-value', 'last-value', 'none'],
      median: ['previous-period', 'same-period-last-year', 'fixed-target', 'historical-median', 'first-value', 'last-value', 'none'],
      count:  ['previous-period', 'same-period-last-year', 'fixed-target', 'none'],
      min:    ['previous-period', 'same-period-last-year', 'fixed-target', 'historical-mean', 'none'],
      max:    ['previous-period', 'same-period-last-year', 'fixed-target', 'historical-mean', 'none'],
      stddev: ['previous-period', 'fixed-target', 'historical-mean', 'none']
    };

    /** Motivos pelos quais um par {agg, baseline} é desencorajado. Tooltip de aviso. */
    const INCOMPAT_REASON = {
      'sum:historical-mean':    'Soma cresce com mais dados; média histórica como baseline gera crescimento artificial.',
      'sum:historical-median':  'Mesmo problema da média; mediana sobre todos os pontos não compara com soma agregada.',
      'count:historical-mean':  'Contagem cumulativa não compara bem com média histórica.',
      'count:historical-median':'Idem média.',
      'count:first-value':      'Comparar contagem total com o primeiro registro é geralmente irrelevante.',
      'count:last-value':       'Idem primeiro registro.',
      'min:historical-median':  'Mínimo absoluto vs mediana histórica: combinação estatística confusa.',
      'min:first-value':        'Mínimo vs primeiro valor: comparação raramente significativa.',
      'min:last-value':         'Idem primeiro valor.',
      'max:historical-median':  'Mesmo motivo do mínimo.',
      'max:first-value':        'Idem mínimo.',
      'max:last-value':         'Idem.',
      'stddev:same-period-last-year': 'Desvio padrão ano-sobre-ano é raramente comparável diretamente.',
      'stddev:historical-median':     'Desvio vs mediana mistura escalas estatísticas distintas.',
      'stddev:first-value':           'Desvio padrão vs ponto individual: não faz sentido.',
      'stddev:last-value':            'Idem.'
    };

    function isCompatible(agg, baselineType){
      const ok = AGG_COMPARISON_COMPAT[String(agg || '').toLowerCase()];
      if (!ok) return true;  // agregação desconhecida → permite tudo
      return ok.indexOf(baselineType) >= 0;
    }
    function incompatReason(agg, baselineType){
      const k = String(agg || '').toLowerCase() + ':' + baselineType;
      return INCOMPAT_REASON[k] || 'Esta combinação pode produzir resultados confusos.';
    }

    function _aggregate(values, agg){
      if (!values.length) return null;
      if (agg === 'sum')        return values.reduce((a,b)=>a+b, 0);
      if (agg === 'avg' || agg === 'mean') return values.reduce((a,b)=>a+b, 0) / values.length;
      if (agg === 'min')        return SolsticeStats.min(values);
      if (agg === 'max')        return SolsticeStats.max(values);
      if (agg === 'count')      return values.length;
      if (agg === 'median'){
        const s = values.slice().sort((a,b)=>a-b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
      }
      return values.reduce((a,b)=>a+b, 0);
    }

    /**
     * Calcula delta vs baseline conforme config.comparison.
     * Retorna null se config.type === 'none' ou se não há dados suficientes.
     */
    function calculateDelta(values, config){
      if (!values || !values.length) return null;
      const comp = (config && config.comparison) || { type: 'previous-period' };
      const agg = (config && config.agg) || 'sum';
      const current = _aggregate(values, agg);

      let baseline, baselineLabel;
      switch (comp.type){
        case 'none':
          return null;

        case 'previous-period': {
          // Divide série em 2 metades como proxy de período
          if (values.length < 4) return null;
          const half = Math.floor(values.length / 2);
          baseline = _aggregate(values.slice(0, half), agg);
          baselineLabel = 'período anterior';
          break;
        }

        case 'same-period-last-year': {
          // Sem coluna temporal completa o cálculo é aproximado: usa início (10%) como proxy
          if (values.length < 12) return null;
          const slice = Math.max(1, Math.floor(values.length / 12));
          baseline = _aggregate(values.slice(0, slice), agg);
          baselineLabel = 'mesmo período do ano passado';
          break;
        }

        case 'fixed-target': {
          const t = parseFloat(comp.targetValue);
          if (isNaN(t)) return null;
          baseline = t;
          baselineLabel = comp.targetLabel || 'meta';
          break;
        }

        case 'historical-mean':
          baseline = _aggregate(values, 'avg');
          baselineLabel = 'média histórica';
          break;

        case 'historical-median':
          baseline = _aggregate(values, 'median');
          baselineLabel = 'mediana histórica';
          break;

        case 'first-value':
          baseline = values[0];
          baselineLabel = 'primeiro registro';
          break;

        case 'last-value':
          baseline = values[values.length - 1];
          baselineLabel = 'último registro';
          break;

        default:
          return null;
      }

      if (baseline === null || baseline === undefined || isNaN(baseline)) return null;
      const pct = baseline !== 0 ? ((current - baseline) / Math.abs(baseline)) * 100 : 0;
      const direction = pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat';

      return { pct, baseline, baselineLabel, direction, current };
    }

    function listTypes(){ return COMPARISON_TYPES.slice(); }
    function getType(value){ return COMPARISON_TYPES.find(t => t.value === value); }

    return { calculateDelta, listTypes, getType, isCompatible, incompatReason, COMPARISON_TYPES, AGG_COMPARISON_COMPAT };
  })();
