
  /* ============================================================
     BLOCO 8 — SolsticeNarrative
     Gerador de narrativa automática para componente selecionado.
     3 tons: executivo (objetivo, decisor) · analítico (preciso, números) · casual (acessível).
     3 profundidades: short, medium, long.
     Templates pt-BR com slots para friendlyName + valores formatados.
     Exporta markdown / copia / e-mail.
     ============================================================ */

  /* ============================================================
     PATCH 1B — SolsticeQuery (ADR-106)
     Motor próprio de linguagem natural. Sem servidor, sem IA externa.
     4 camadas: tokenize → resolveEntities → detectIntent → handler.
     30 intents cobrem 70-80% das perguntas comuns. Resto via BYO-LLM
     (ADR-108) com fallback automático quando confidence < 0.4.
     ============================================================ */
  const SolsticeQuery = (function(){
    const STOP_WORDS_PT = new Set([
      'a','o','de','do','da','em','na','no','para','por','com','um','uma',
      'os','as','dos','das','que','qual','quais','meu','minha','meus','minhas',
      'seu','sua','seus','suas','este','esta','estes','estas','esse','essa',
      'esses','essas','aquele','aquela','aqueles','aquelas','isto','isso','aquilo',
      'e','ou','mas','se','ja','tambem','muito','pouco','mais','menos'
    ]);

    const AGG_LABELS_PT = {
      mean: 'Média', median: 'Mediana', sum: 'Soma', max: 'Máximo',
      min: 'Mínimo', count: 'Contagem', stddev: 'Desvio padrão'
    };

    const AGG_MAP = {
      'media': 'mean','média':'mean','medias':'mean','médias':'mean','mean':'mean',
      'mediana': 'median','median':'median',
      'soma': 'sum','total':'sum','somatorio':'sum','somatório':'sum',
      'maximo':'max','máximo':'max','max':'max','maior':'max','pico':'max',
      'minimo':'min','mínimo':'min','min':'min','menor':'min','vale':'min',
      'contar':'count','contagem':'count','count':'count','quantos':'count','quantas':'count','quantidade':'count'
    };

    /* ===== CAMADA 1 — Tokenização ===== */
    function _norm(s){
      return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    }
    function tokenize(text){
      return _norm(text)
        .replace(/[^\w\s]/g,' ')
        .split(/\s+/)
        .filter(t => t && !STOP_WORDS_PT.has(t));
    }

    /** Levenshtein distance — usado como último recurso em findColumnByName. */
    function levenshtein(a, b){
      a = a || ''; b = b || '';
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      const m = a.length, n = b.length;
      const prev = new Array(n+1), cur = new Array(n+1);
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++){
        cur[0] = i;
        for (let j = 1; j <= n; j++){
          const cost = a[i-1] === b[j-1] ? 0 : 1;
          cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost);
        }
        for (let j = 0; j <= n; j++) prev[j] = cur[j];
      }
      return prev[n];
    }

    /* ===== CAMADA 2 — Resolução de entidades ===== */
    function findColumnByName(token, ctx){
      const target = _norm(token);
      const dict = ctx.dictionary;
      // 1) Exact / includes em friendlyName ou nome técnico
      for (const col of (ctx.columns || [])){
        const friendlyRaw = (dict && dict.columns && dict.columns[col] && dict.columns[col].friendlyName) || col;
        const friendly = _norm(friendlyRaw);
        if (friendly === target || friendly.includes(target) || _norm(col).includes(target)) return col;
        const synonyms = (dict && dict.columns && dict.columns[col] && dict.columns[col].synonyms) || [];
        for (const syn of synonyms){
          const sn = _norm(syn);
          if (sn === target || sn.includes(target)) return col;
        }
      }
      // Auditoria 2026 (M-Q-3 / A-706): consulta sinônimos aprendidos pelo
      // usuário em runtime via SolsticeLearning.addSynonym. Persistido em
      // localStorage.solstice.learning.{profileId}.synonyms.
      if (typeof SolsticeLearning !== 'undefined' && SolsticeLearning.findColumnBySynonym){
        const learned = SolsticeLearning.findColumnBySynonym(token);
        if (learned && (ctx.columns || []).includes(learned)) return learned;
      }
      // 2) Levenshtein ≤ 2 contra nome técnico
      for (const col of (ctx.columns || [])){
        if (levenshtein(_norm(col), target) <= 2) return col;
      }
      return null;
    }

    function _userGroup(typeMeta){
      if (!typeMeta) return 'unknown';
      const t = typeMeta.type || typeMeta;
      const g = (typeof SolsticeTypes !== 'undefined') ? SolsticeTypes.group(t) : null;
      if (g === 'numeric') return 'measure';
      if (g === 'temporal') return 'temporal';
      if (g === 'categorical') return t === 'ordinal' ? 'ordinal' : 'dimension';
      return 'dimension';
    }

    function resolveEntities(tokens, ctx){
      const resolved = {
        metrics: [], dimensions: [], temporal: null, agg: null, limit: null,
        unrecognized: []
      };
      for (const tok of tokens){
        // Agregação?
        if (AGG_MAP[tok]){ resolved.agg = AGG_MAP[tok]; continue; }
        // Número?
        if (/^\d+$/.test(tok)){
          const n = parseInt(tok, 10);
          if (!isNaN(n)) resolved.limit = n;
          continue;
        }
        // Coluna?
        const col = findColumnByName(tok, ctx);
        if (col){
          const grp = _userGroup(ctx.types && ctx.types[col]);
          if (grp === 'measure' && !resolved.metrics.includes(col)) resolved.metrics.push(col);
          else if ((grp === 'dimension' || grp === 'ordinal') && !resolved.dimensions.includes(col)) resolved.dimensions.push(col);
          else if (grp === 'temporal' && !resolved.temporal) resolved.temporal = col;
          continue;
        }
        resolved.unrecognized.push(tok);
      }
      // Default temporal: primeira coluna temporal do dataset
      if (!resolved.temporal && ctx.columns){
        for (const c of ctx.columns){
          if (_userGroup(ctx.types && ctx.types[c]) === 'temporal'){ resolved.temporal = c; break; }
        }
      }
      return resolved;
    }

    /* ===== CAMADA 3 — Intents ===== */
    const INTENTS = [
      { id:'aggregate',     keywords:['media','mediana','soma','total','maximo','minimo','count','contagem','quantidade'], requires:['agg','metric'], examples:['média de receita','soma das vendas','máximo de ticket'] },
      { id:'trend',         keywords:['tendencia','evolucao','crescimento','queda','variacao','mudanca','direcao'], requires:['metric'], optional:['temporal'], examples:['tendência de receita','como evoluiu o churn'] },
      { id:'compare',       keywords:['compara','comparacao','versus','vs','diferenca','contraste'], requires:['metric','dimension'], examples:['compara receita por região'] },
      { id:'top',           keywords:['top','maiores','melhores','principais','ranking','primeiros'], requires:['dimension'], optional:['metric','limit'], examples:['top 5 clientes','maiores produtos'] },
      { id:'bottom',        keywords:['piores','menores','ultimos','baixos','fundo'], requires:['dimension'], optional:['metric','limit'], examples:['piores vendedores'] },
      { id:'outliers',      keywords:['outliers','anormais','estranhos','atipicos','fora','curva'], requires:['metric'], examples:['outliers em ticket'] },
      { id:'correlate',     keywords:['correlacao','relacao','dependencia','influencia','liga'], requires:['metric','metric2'], examples:['correlação entre receita e custo'] },
      { id:'distribution',  keywords:['distribuicao','frequencia','histograma','concentracao','espalha'], requires:['metric'], examples:['distribuição de receita'] },
      { id:'health',        keywords:['ta','tá','esta','está','indo','bom','bem','ruim','mal','saudavel','vai','va','saude'], requires:['metric'], special:'health_report', examples:['receita tá boa?','inadimplência está bem?'] },
      { id:'forecast',      keywords:['previsao','projecao','estimativa','futuro','proximo','vai','sera'], requires:['metric'], optional:['limit'], examples:['previsão de vendas 3 meses'] },
      { id:'count_total',   keywords:['quantos','quantas','total','registros','linhas'], requires:[], examples:['quantos registros'] },
      { id:'distinct_count',keywords:['distintos','unicos','diferentes','categorias'], requires:['dimension'], examples:['quantas categorias em produto'] },
      { id:'pareto',        keywords:['80','20','pareto','concentra','maioria'], requires:['dimension','metric'], examples:['pareto de produtos'] },
      { id:'seasonality',   keywords:['sazonal','padrao','semanal','mensal','diario','periodicidade'], requires:['metric'], optional:['temporal'], examples:['sazonalidade da receita'] },
      { id:'recent_change', keywords:['ultimo','recente','agora','recentemente'], requires:['metric'], examples:['o que mudou recentemente'] },
      { id:'segment',       keywords:['segmenta','clusters','agrupa','grupos','perfis'], requires:['metric'], optional:['metric2'], examples:['segmenta clientes por receita'] },
      { id:'composition',   keywords:['composicao','porcentagem','percentual','share','participacao'], requires:['dimension'], optional:['metric'], examples:['composição por região'] },
      { id:'describe',      keywords:['resumo','sumario','descreve','estatistica','overview'], requires:['metric'], examples:['resumo de receita'] },
      { id:'yoy',           keywords:['ano','anterior','passado','y-o-y','yoy'], requires:['metric'], optional:['temporal'], examples:['crescimento vs ano anterior'] },
      { id:'mom',           keywords:['mes','m-o-m','mom'], requires:['metric'], examples:['variação mês a mês'] },
      { id:'table_view',    keywords:['lista','tabela','mostra','exibe','detalha'], requires:['dimension'], examples:['lista os clientes'] },
      { id:'filter_query',  keywords:['onde','quando','filtro','filtrar','buscar'], requires:['dimension'], examples:['onde a receita é maior que 1000'] },
      { id:'group_sum',     keywords:['por','agrupado','agrupa','separa'], requires:['metric','dimension'], examples:['receita por região'] },
      { id:'period_compare',keywords:['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro','q1','q2','q3','q4','trimestre'], requires:['metric'], examples:['receita de janeiro vs fevereiro'] },
      { id:'anomaly',       keywords:['anomalia','suspeito','irregular','problema'], requires:[], examples:['detecta anomalias'] },
      { id:'impact',        keywords:['impacto','afeta','influi','contribui'], requires:['metric'], optional:['dimension'], examples:['qual canal mais impacta receita'] },
      { id:'recommend',     keywords:['recomenda','sugere','deve','melhor','acao','fazer'], requires:['metric'], examples:['o que devo fazer com a inadimplência'] },
      { id:'kpi_snapshot',  keywords:['kpi','indicador','metrica','medida','principal'], requires:['metric'], examples:['kpi da receita'] },
      { id:'history',       keywords:['historico','passado','antigo','origem'], requires:['metric'], examples:['histórico de receita'] },
      // Auditoria 2026 (B-04 / A-705): what-if local — pergunta estratégica
      // central em BI bancário. Mantém o dado no banco (não vai a LLM externo).
      { id:'what_if',       keywords:['se','suponha','imagine','what','if','simulacao','simulação','subir','aumentar','crescer','reduzir','cair','descer','diminuir'], requires:['metric'], examples:['se ticket médio subir 10%, receita?','se receita cair 5%, qual o total?'] },
      { id:'general',       keywords:[], requires:[], examples:['mostra os dados'] }
    ];

    // Auditoria 2026 (M-Q-2 / A-703): fuzzy match em keywords de intent.
    // Antes Levenshtein só rodava em nomes de coluna — typos em keywords
    // ("meida" vs "media") faziam a pergunta cair em 'general'. Agora um
    // typo de até 1 letra ainda casa.
    function _fuzzyKeywordMatch(tok, keywords, maxDist){
      if (!tok || !keywords || !keywords.length) return false;
      // exato primeiro (rápido)
      if (keywords.includes(tok)) return true;
      // Auditoria 2026.6 (ASK-FUZZY): tolerância 1 até 7 letras (era ≤5→1, >5→2).
      // O ≤2 em palavras médias casava palavras DIFERENTES — ex: keyword "recente"
      // batia no token "receita" (distância 2), fazendo "receita por região" cair
      // em recent_change ("variação") em vez de group_sum (ranking por dimensão).
      // Distância 2 só para palavras longas (≥8 letras), onde é mais seguro.
      const d = (maxDist != null) ? maxDist : (tok.length <= 7 ? 1 : 2);
      for (const k of keywords){
        if (Math.abs(tok.length - k.length) > d) continue; // poda barata
        if (levenshtein(tok, k) <= d) return true;
      }
      return false;
    }

    // Auditoria 2026 (M-Q-1 / A-701): threshold ajustável. Override via
    // SolsticeQuery.setConfidenceThreshold(detectMin, fallbackMin) ou
    // localStorage.solstice.confidence.{detect,fallback}.
    let _detectMin = 0.2;
    function _readConfidenceFromStorage(){
      try {
        const d = parseFloat(localStorage.getItem('solstice.confidence.detect'));
        if (!isNaN(d) && d >= 0 && d <= 1) _detectMin = d;
      } catch(_){}
    }
    _readConfidenceFromStorage();

    function detectIntent(tokens, resolved){
      const scored = INTENTS.map(intent => {
        // Auditoria 2026 (M-Q-2 / A-703): conta keyword com tolerância a typo.
        const matched = intent.keywords.filter(k => _fuzzyKeywordMatch(k, tokens, null)).length;
        const kwScore = intent.keywords.length === 0 ? 0.1 : matched / intent.keywords.length;
        const requireOk = (intent.requires || []).every(req => {
          if (req === 'metric')    return resolved.metrics.length > 0;
          if (req === 'metric2')   return resolved.metrics.length >= 2;
          if (req === 'dimension') return resolved.dimensions.length > 0;
          if (req === 'temporal')  return !!resolved.temporal;
          if (req === 'agg')       return !!resolved.agg;
          return false;
        });
        const requireBonus = requireOk ? 0.3 : 0;
        return { intent, score: kwScore + requireBonus };
      });
      scored.sort((a,b) => b.score - a.score);
      let winner = scored[0].score > _detectMin ? scored[0].intent : INTENTS.find(x => x.id === 'general');
      // Auditoria 2026.6 (ASK-BREAKDOWN): "X por <dimensão>" é o caso mais comum
      // de pergunta. Como "por" é stopword (some na tokenização), o group_sum não
      // casava por keyword e a pergunta caía em intents genéricos/temporais
      // (count_total, recent_change, general…) que IGNORAM a dimensão. Quando há
      // métrica E dimensão resolvidas e o vencedor é um desses, interpretamos como
      // agrupamento (group_sum → ranking por dimensão) — o que o usuário quer.
      if (resolved && resolved.metrics.length > 0 && resolved.dimensions.length > 0 &&
          ['general','count_total','recent_change','aggregate','health','describe','seasonality'].includes(winner.id)){
        const gs = INTENTS.find(x => x.id === 'group_sum');
        if (gs) winner = gs;
      }
      return winner;
    }

    /* ===== CAMADA 4 — Handlers ===== */
    function _fmt(val, meta){
      if (val == null || isNaN(val)) return '—';
      const unit = meta && meta.unit;
      const decimals = (unit === 'BRL' || unit === 'currency') ? 2 : (Math.abs(val) >= 100 ? 0 : 2);
      let s;
      try {
        s = Number(val).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      } catch(e){ s = String(val); }
      if (unit === 'BRL' || unit === 'currency') return 'R$ ' + s;
      if (unit === 'pct' || unit === '%') return s + '%';
      if (unit) return s + ' ' + unit;
      return s;
    }

    function _friendly(col, ctx){
      if (typeof SolsticeHumanize !== 'undefined') return SolsticeHumanize.column(col, ctx.dictionary);
      const meta = ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[col];
      return (meta && meta.friendlyName) || col;
    }

    function _meta(col, ctx){
      return (ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[col]) || null;
    }

    function _numericValues(col, rows){
      return rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
    }

    function _byGroup(col, dim, rows, agg){
      const groups = new Map();
      const aggFn = agg || 'sum';
      for (const r of rows){
        const k = r[dim];
        const v = SolsticeStats.parseNum(r[col]);
        if (isNaN(v)) continue;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(v);
      }
      const out = [];
      for (const [k, arr] of groups){
        let val;
        if (aggFn === 'sum')        val = arr.reduce((a,b) => a+b, 0);
        else if (aggFn === 'count') val = arr.length;
        else if (aggFn === 'max')   val = SolsticeStats.max(arr);
        else if (aggFn === 'min')   val = SolsticeStats.min(arr);
        else                        val = arr.reduce((a,b) => a+b, 0) / arr.length;
        out.push({ key: k, value: val, n: arr.length });
      }
      return out.sort((a,b) => b.value - a.value);
    }

    const HANDLERS = {
      aggregate(s, ctx){
        const col = s.metrics[0]; const agg = s.agg || 'mean';
        if (!col) return { answer:'Não identifiquei a métrica. Tente: "média de **<coluna>**".', action:null, confidence:0.2 };
        const values = _numericValues(col, ctx.rows);
        if (!values.length) return { answer:`Sem valores numéricos válidos em ${_friendly(col, ctx)}.`, action:null, confidence:0.4 };
        const fn = SolsticeStats[agg] || SolsticeStats.mean;
        const result = fn(values);
        const meta = _meta(col, ctx);
        return {
          answer: `**${AGG_LABELS_PT[agg] || agg}** de **${_friendly(col, ctx)}**: ${_fmt(result, meta)} (${values.length} registros válidos).`,
          action: { type:'create_component', componentType:'kpi', config:{ column: col, agg } },
          confidence: 0.9
        };
      },
      health(s, ctx){
        const col = s.metrics[0];
        if (!col) return { answer:'Especifique uma métrica para avaliar (ex: "receita tá boa?").', action:null, confidence:0.2 };
        const values = _numericValues(col, ctx.rows);
        if (values.length < 3) return { answer:'Dados insuficientes para diagnóstico.', action:null, confidence:0.3 };
        const stats = SolsticeStats.describe(values) || { mean: values.reduce((a,b)=>a+b,0)/values.length };
        const trend = SolsticeStats.trend(values) || { direction:'flat', magnitude: 0 };
        const outliers = (SolsticeStats.outliersIQR(values).indices || []).length;  // OUTLIER-SHAPE 2026.6
        const meta = _meta(col, ctx);
        const hib = meta && meta.higherIsBetter;
        const dir = trend.direction;
        let verdict, advice, severity;
        if (dir === 'flat'){ verdict='estável'; severity='neutral'; advice='Sem variação significativa no período.'; }
        else if (dir === 'up' && hib === true)  { verdict='saudável 📈'; severity='positive'; advice='Mantenha o ritmo.'; }
        else if (dir === 'down' && hib === true){ verdict='requer atenção 📉'; severity='negative'; advice='Investigue a causa da queda.'; }
        else if (dir === 'up' && hib === false) { verdict='preocupante 📈⚠️'; severity='negative'; advice='Tome ação corretiva urgente.'; }
        else if (dir === 'down' && hib === false){verdict='positivo 📉'; severity='positive'; advice='Continue controlando.'; }
        else { verdict = dir === 'up' ? 'em alta' : 'em queda'; severity='neutral'; advice='Defina higherIsBetter no dicionário para diagnóstico mais preciso.'; }
        return {
          answer: `**${_friendly(col, ctx)}** está **${verdict}**.\n\n` +
                  `📊 Valor médio: ${_fmt(stats.mean, meta)}\n` +
                  `📈 Tendência: ${dir === 'up' ? '↑ alta' : dir === 'down' ? '↓ queda' : '→ estável'} (${(trend.magnitude*100).toFixed(1)}%)\n` +
                  `⚠️ Outliers: ${outliers} (${(outliers/values.length*100).toFixed(0)}%)\n\n` +
                  `**💡 Recomendação:** ${advice}`,
          action: { type:'create_component', componentType:'time-series', config:{ yColumn: col } },
          confidence: 0.85, severity
        };
      },
      trend(s, ctx){
        const col = s.metrics[0];
        if (!col) return { answer:'Especifique a métrica (ex: "tendência de receita").', action:null, confidence:0.2 };
        const values = _numericValues(col, ctx.rows);
        const trend = SolsticeStats.trend(values);
        if (!trend) return { answer:'Sem dados suficientes para detectar tendência.', action:null, confidence:0.3 };
        const dir = trend.direction === 'up' ? '↑ alta' : trend.direction === 'down' ? '↓ queda' : '→ estável';
        return {
          answer: `Tendência de **${_friendly(col, ctx)}**: ${dir} de ${(trend.magnitude*100).toFixed(1)}% (R²=${(trend.r2||0).toFixed(2)}).`,
          action: { type:'create_component', componentType:'time-series', config:{ yColumn: col, xColumn: s.temporal } },
          confidence: 0.88
        };
      },
      compare(s, ctx){
        const col = s.metrics[0]; const dim = s.dimensions[0];
        if (!col || !dim) return { answer:'Preciso de métrica + dimensão. Ex: "compara receita por região".', action:null, confidence:0.2 };
        const groups = _byGroup(col, dim, ctx.rows, s.agg || 'sum');
        const top3 = groups.slice(0, 3).map(g => `**${g.key}**: ${_fmt(g.value, _meta(col, ctx))}`).join(' · ');
        return {
          answer: `Comparação de **${_friendly(col, ctx)}** por **${_friendly(dim, ctx)}** (top 3): ${top3}.`,
          action: { type:'create_component', componentType:'distribution', config:{ column: col, groupColumn: dim } },
          confidence: 0.85
        };
      },
      top(s, ctx){
        const dim = s.dimensions[0]; const col = s.metrics[0]; const n = s.limit || 5;
        if (!dim) return { answer:'Preciso de uma dimensão (ex: "top 5 clientes").', action:null, confidence:0.2 };
        if (!col){
          const cnt = new Map();
          for (const r of ctx.rows){ const k = r[dim]; cnt.set(k, (cnt.get(k)||0)+1); }
          const sorted = [...cnt].sort((a,b) => b[1]-a[1]).slice(0, n);
          return { answer:`Top ${n} **${_friendly(dim, ctx)}** por contagem: ` + sorted.map(([k,v]) => `${k} (${v})`).join(' · '), action:{ type:'create_component', componentType:'table', config:{} }, confidence: 0.75 };
        }
        const groups = _byGroup(col, dim, ctx.rows, s.agg || 'sum').slice(0, n);
        return {
          answer: `Top ${n} **${_friendly(dim, ctx)}** por **${_friendly(col, ctx)}**: ` + groups.map(g => `${g.key} (${_fmt(g.value, _meta(col, ctx))})`).join(' · '),
          action: { type:'create_component', componentType:'table', config:{} },
          confidence: 0.85
        };
      },
      bottom(s, ctx){
        const dim = s.dimensions[0]; const col = s.metrics[0]; const n = s.limit || 5;
        if (!dim) return { answer:'Preciso de uma dimensão.', action:null, confidence:0.2 };
        const groups = _byGroup(col || (ctx.columns[0]), dim, ctx.rows, s.agg || 'sum').reverse().slice(0, n);
        return {
          answer: `Bottom ${n} **${_friendly(dim, ctx)}** por **${col ? _friendly(col, ctx) : 'contagem'}**: ` + groups.map(g => `${g.key} (${_fmt(g.value, _meta(col, ctx))})`).join(' · '),
          action: { type:'create_component', componentType:'table', config:{} },
          confidence: 0.82
        };
      },
      outliers(s, ctx){
        const col = s.metrics[0];
        if (!col) return { answer:'Especifique a métrica.', action:null, confidence:0.2 };
        const values = _numericValues(col, ctx.rows);
        // Auditoria 2026.6 (OUTLIER-SHAPE): outliersIQR retorna {indices,values,
        // fences} — não um array. Ler .length direto dava "undefined outliers /
        // NaN%". Usa .indices (sempre presente, inclusive no early-return).
        const outs = SolsticeStats.outliersIQR(values).indices || [];
        return {
          answer: `Detectados **${outs.length}** outliers em **${_friendly(col, ctx)}** (${(outs.length/values.length*100).toFixed(1)}% do total).`,
          action: { type:'create_component', componentType:'boxplot', config:{ valueColumn: col } },
          confidence: 0.85
        };
      },
      correlate(s, ctx){
        const a = s.metrics[0]; const b = s.metrics[1];
        if (!a || !b) return { answer:'Preciso de 2 métricas. Ex: "correlação entre receita e custo".', action:null, confidence:0.2 };
        const xs = _numericValues(a, ctx.rows);
        const ys = _numericValues(b, ctx.rows);
        const n = Math.min(xs.length, ys.length);
        const r = (SolsticeStats.correlation && SolsticeStats.correlation(xs.slice(0,n), ys.slice(0,n))) || 0;
        const strong = Math.abs(r) > 0.7 ? 'forte' : Math.abs(r) > 0.4 ? 'moderada' : 'fraca';
        return {
          answer: `Correlação **${strong}** entre **${_friendly(a, ctx)}** e **${_friendly(b, ctx)}**: r = ${r.toFixed(3)}.`,
          action: { type:'create_component', componentType:'scatter', config:{ xColumn: a, yColumn: b } },
          confidence: 0.88
        };
      },
      distribution(s, ctx){
        const col = s.metrics[0];
        if (!col) return { answer:'Especifique a métrica.', action:null, confidence:0.2 };
        const values = _numericValues(col, ctx.rows);
        const stats = SolsticeStats.describe(values) || {};
        return {
          answer: `Distribuição de **${_friendly(col, ctx)}** — min=${_fmt(stats.min)} · mediana=${_fmt(stats.median)} · max=${_fmt(stats.max)} (n=${values.length}).`,
          action: { type:'create_component', componentType:'distribution', config:{ column: col } },
          confidence: 0.85
        };
      },
      count_total(s, ctx){
        return { answer:`Total: **${ctx.rows.length}** registros (${(ctx.columns||[]).length} colunas).`, action:null, confidence:1.0 };
      },

      /* ===== STUBS honestos — resposta + ação plausível, cálculo simplificado ===== */
      forecast(s, ctx){
        // ADR-168 (Onda 3 / T7) — Honest mode: usa Holt-Winters DE VERDADE
        // quando há sazonalidade detectável (autocorr forte em lag ~12 ou 24),
        // senão cai pra tendência linear. Antes: mencionava HW mas só fazia
        // linear (briefing v5.4 P7 Júlia: "Forecast Holt-Winters sem
        // implementação real"). Agora a função real é executada.
        const col = s.metrics[0];
        if (!col) return { answer:'Especifique a métrica para projetar.', action:null, confidence:0.2 };
        const values = _numericValues(col, ctx.rows);
        if (values.length < 4) return { answer:'Dados insuficientes para projetar.', action:null, confidence:0.3 };
        const n = s.limit || 3;
        let projection, method, methodLabel, formulaLabel;
        // Tenta Holt-Winters se há sazonalidade detectável
        const season = (values.length >= 24) ? 12 : (values.length >= 14 ? 7 : null);
        const hasSeason = season && values.length >= 2 * season;
        if (hasSeason && SolsticeStats.holtWinters){
          try {
            const fc = SolsticeStats.holtWinters(values, n, season);
            projection = fc[fc.length - 1];
            method = 'holtWinters';
            methodLabel = 'Holt-Winters aditivo (α=0.5, β=0.3, γ=0.3, S=' + season + ')';
            formulaLabel = 'L_t + h·T_t + S_(t+h-S)';
          } catch (e){
            method = 'linear-fallback';
          }
        }
        if (!projection){
          const trend = SolsticeStats.trend(values);
          const last = values[values.length - 1];
          projection = trend && trend.slope ? last + trend.slope * n : last;
          method = 'linear';
          methodLabel = 'tendência linear (Holt-Winters precisa ≥ 2 ciclos sazonais)';
          formulaLabel = 'last + slope·n';
        }
        return {
          answer: `Projeção para **${_friendly(col, ctx)}** em ${n} períodos: ${_fmt(projection, _meta(col, ctx))}.\nMétodo: ${methodLabel}\nFórmula: \`${formulaLabel}\``,
          action: { type:'create_component', componentType:'time-series', config:{ yColumn: col, showForecast: true, forecastPeriods: n, forecastMethod: (method === 'holtWinters' ? 'holtWinters' : 'linear') } },
          confidence: method === 'holtWinters' ? 0.85 : 0.6,
          source: method
        };
      },
      distinct_count(s, ctx){
        const dim = s.dimensions[0];
        if (!dim) return { answer:'Especifique a dimensão.', action:null, confidence:0.2 };
        const set = new Set(ctx.rows.map(r => r[dim]));
        return { answer:`**${_friendly(dim, ctx)}** tem ${set.size} valores distintos.`, action:null, confidence:0.95 };
      },
      pareto(s, ctx){
        const dim = s.dimensions[0]; const col = s.metrics[0];
        if (!dim || !col) return { answer:'Preciso de dimensão + métrica para Pareto.', action:null, confidence:0.2 };
        const groups = _byGroup(col, dim, ctx.rows, 'sum');
        const total = groups.reduce((a,g) => a+g.value, 0);
        let cum = 0, count80 = 0;
        for (const g of groups){ cum += g.value; count80++; if (cum/total >= 0.8) break; }
        return { answer:`Pareto: ${count80} de ${groups.length} **${_friendly(dim, ctx)}** concentram 80% de **${_friendly(col, ctx)}** (${(count80/groups.length*100).toFixed(0)}% das categorias).`, action:{ type:'create_component', componentType:'table', config:{} }, confidence: 0.8 };
      },
      seasonality(s, ctx){
        const col = s.metrics[0];
        if (!col) return { answer:'Especifique a métrica.', action:null, confidence:0.2 };
        return { answer:`Análise de sazonalidade de **${_friendly(col, ctx)}** disponível em 📈 Análise no componente (autocorrelação + decomposição).`, action:{ type:'create_component', componentType:'time-series', config:{ yColumn: col } }, confidence: 0.5 };
      },
      recent_change(s, ctx){
        const col = s.metrics[0];
        if (!col) return { answer:'Especifique a métrica.', action:null, confidence:0.2 };
        const values = _numericValues(col, ctx.rows);
        if (values.length < 2) return { answer:'Dados insuficientes.', action:null, confidence:0.3 };
        const last = values[values.length-1]; const prev = values[values.length-2];
        const pct = prev !== 0 ? ((last-prev)/Math.abs(prev))*100 : 0;
        return { answer:`Variação do último ponto vs anterior em **${_friendly(col, ctx)}**: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%.`, action:null, confidence: 0.7 };
      },
      // Auditoria 2026 (B-07 / A-702): segmentação local via K-means (Lloyd)
      // sobre 1 ou 2 métricas. Sem LLM externo — atende objetivo LGPD.
      // Substitui o stub anterior que jogava a pergunta no LLM.
      segment(s, ctx){
        const m1 = s.metrics[0];
        if (!m1) return { answer:'Não identifiquei a métrica. Tente: "segmenta clientes por **<coluna>**".', action:null, confidence:0.3 };
        const m2 = s.metrics[1] || null;
        // Monta pontos (1D ou 2D conforme há m2).
        const pts = [];
        for (const r of ctx.rows){
          const x = SolsticeStats.parseNum(r[m1]); if (isNaN(x)) continue;
          if (m2){
            const y = SolsticeStats.parseNum(r[m2]); if (isNaN(y)) continue;
            pts.push([x, y]);
          } else {
            pts.push([x]);
          }
        }
        if (pts.length < 6) return { answer:`Dados insuficientes (n=${pts.length}) para segmentar com confiança. Mínimo: 6 pontos.`, action:null, confidence:0.3 };
        // k automático com cap em 5 e mínimo 3.
        const k = Math.max(3, Math.min(5, Math.floor(Math.sqrt(pts.length / 2))));
        const dim = pts[0].length;
        // Inicialização: k pontos espaçados ao longo da amostra ordenada (1D) ou
        // ao longo do índice (2D). Não é k-means++, mas é determinístico.
        const sorted = pts.slice().sort((a,b) => a[0] - b[0]);
        const centroids = [];
        for (let i = 0; i < k; i++){
          const idx = Math.floor((i + 0.5) * sorted.length / k);
          centroids.push(sorted[idx].slice());
        }
        const assign = new Array(pts.length).fill(0);
        const _dist2 = (a, b) => { let s2 = 0; for (let d = 0; d < dim; d++){ const dv = a[d] - b[d]; s2 += dv * dv; } return s2; };
        let changed = true; let iter = 0;
        while (changed && iter < 20){
          changed = false; iter++;
          // Atribuir
          for (let i = 0; i < pts.length; i++){
            let best = 0; let bestD = _dist2(pts[i], centroids[0]);
            for (let c = 1; c < k; c++){
              const dd = _dist2(pts[i], centroids[c]);
              if (dd < bestD){ bestD = dd; best = c; }
            }
            if (assign[i] !== best){ assign[i] = best; changed = true; }
          }
          // Recalcular
          const sums = Array.from({length:k}, () => new Array(dim).fill(0));
          const counts = new Array(k).fill(0);
          for (let i = 0; i < pts.length; i++){
            const c = assign[i]; counts[c]++;
            for (let d = 0; d < dim; d++) sums[c][d] += pts[i][d];
          }
          for (let c = 0; c < k; c++){
            if (counts[c] === 0) continue;
            for (let d = 0; d < dim; d++) centroids[c][d] = sums[c][d] / counts[c];
          }
        }
        // Resumo: tamanho e centróide de cada cluster.
        const sizes = new Array(k).fill(0);
        for (const a of assign) sizes[a]++;
        const meta1 = _meta(m1, ctx);
        const meta2 = m2 ? _meta(m2, ctx) : null;
        const fr1 = _friendly(m1, ctx);
        const fr2 = m2 ? _friendly(m2, ctx) : null;
        // Ordena clusters por centróide (m1) ascendente para narrativa estável.
        const order = centroids.map((c, i) => ({ i, c, n: sizes[i] }))
                               .sort((a,b) => a.c[0] - b.c[0]);
        const lines = order.map((o, rank) => {
          const pct = ((o.n / pts.length) * 100).toFixed(0);
          const v1 = _fmt(o.c[0], meta1);
          const v2 = m2 ? ' · ' + fr2 + '=' + _fmt(o.c[1], meta2) : '';
          return `**Segmento ${rank + 1}** — ${fr1}=${v1}${v2} · ${o.n} pontos (${pct}%)`;
        });
        const compType = m2 ? 'scatter' : 'distribution';
        const config = m2 ? { xColumn: m1, yColumn: m2 } : { column: m1 };
        return {
          answer: `Segmentação local (K-means k=${k}, ${iter} iterações sobre n=${pts.length}). Cálculo local; nenhum dado enviado a LLM externo.\n` + lines.join('\n'),
          action: { type:'create_component', componentType: compType, config },
          confidence: 0.8,
          source: 'kmeans_local'
        };
      },
      // Auditoria 2026 (B-04 / A-705): what-if local. Calcula no cliente,
      // nunca envia dado para LLM externo (objetivo LGPD).
      what_if(s, ctx){
        const col = s.metrics[0];
        if (!col) return { answer:'Não identifiquei a métrica. Tente: "se **<coluna>** subir 10%".', action:null, confidence:0.3 };
        const raw = ctx._raw || '';
        const pctMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
        if (!pctMatch){
          return { answer:`Não identifiquei o percentual. Tente: "se **${_friendly(col, ctx)}** subir **10%**".`, action:null, confidence:0.3 };
        }
        const pct = parseFloat(pctMatch[1].replace(',', '.')) / 100;
        const lower = raw.toLowerCase();
        const sign = /\b(cair|descer|reduzir|cai|diminuir|baixar|queda)\b/.test(lower) ? -1
                   : /\b(subir|aumentar|crescer|sobe|cresce|elevar|alta)\b/.test(lower) ? +1
                   : +1; // default subir
        const values = _numericValues(col, ctx.rows);
        if (!values.length) return { answer:`Sem valores numéricos válidos em ${_friendly(col, ctx)}.`, action:null, confidence:0.4 };
        const sum = values.reduce((a,b) => a+b, 0);
        const sim = sum * (1 + sign * pct);
        const delta = sim - sum;
        const meta = _meta(col, ctx);
        const dirWord = sign > 0 ? 'subir' : 'cair';
        const pctTimes100 = pct * 100;
        const pctLabel = (pctTimes100 % 1 === 0 ? pctTimes100.toFixed(0) : pctTimes100.toFixed(1)) + '%';
        const signLabel = sign > 0 ? '+' : '−';
        return {
          answer: `Se **${_friendly(col, ctx)}** ${dirWord} **${pctLabel}**, o total passa de ${_fmt(sum, meta)} para ${_fmt(sim, meta)} (Δ ${signLabel}${_fmt(Math.abs(delta), meta)}). Cálculo local; nenhum dado enviado a LLM externo.`,
          action: null,
          confidence: 0.85,
          source: 'what_if_local'
        };
      },
      composition(s, ctx){
        const dim = s.dimensions[0]; const col = s.metrics[0];
        if (!dim) return { answer:'Especifique a dimensão.', action:null, confidence:0.2 };
        const groups = col ? _byGroup(col, dim, ctx.rows, 'sum') : (function(){ const cnt = new Map(); for (const r of ctx.rows){ const k = r[dim]; cnt.set(k, (cnt.get(k)||0)+1); } return [...cnt].map(([k,v])=>({key:k,value:v})); })();
        const total = groups.reduce((a,g) => a+g.value, 0) || 1;
        const top3 = groups.slice(0, 3).map(g => `${g.key} (${(g.value/total*100).toFixed(0)}%)`).join(' · ');
        return { answer:`Composição por **${_friendly(dim, ctx)}**: ${top3}.`, action:{ type:'create_component', componentType:'distribution', config:{ column: col || dim, groupColumn: dim } }, confidence: 0.8 };
      },
      describe(s, ctx){
        const col = s.metrics[0];
        if (!col) return { answer:'Especifique a métrica.', action:null, confidence:0.2 };
        const values = _numericValues(col, ctx.rows);
        const d = SolsticeStats.describe(values) || {};
        const meta = _meta(col, ctx);
        return { answer:`Resumo de **${_friendly(col, ctx)}** (n=${values.length}): média=${_fmt(d.mean, meta)} · mediana=${_fmt(d.median, meta)} · σ=${_fmt(d.stddev, meta)} · min=${_fmt(d.min, meta)} · max=${_fmt(d.max, meta)}.`, action:{ type:'create_component', componentType:'kpi', config:{ column: col, agg:'mean' } }, confidence: 0.9 };
      },
      yoy(s, ctx){ return { answer:`Crescimento ano-a-ano requer coluna temporal com múltiplos anos. Use 📈 Análise no componente para detalhe.`, action:null, confidence:0.4 }; },
      mom(s, ctx){ return { answer:`Variação mês-a-mês requer coluna temporal mensal. Use 📈 Análise no componente.`, action:null, confidence:0.4 }; },
      table_view(s, ctx){
        return { answer:`Criando uma tabela detalhada${s.dimensions[0] ? ' agrupada por **' + _friendly(s.dimensions[0], ctx) + '**' : ''}.`, action:{ type:'create_component', componentType:'table', config:{} }, confidence: 0.7 };
      },
      // Auditoria 2026 (R-16 / A-704): filter_query agora resolve condições
      // simples (`> < = >= <=` + número/data) sobre a métrica detectada.
      // Antes mandava o usuário para a UI manual com confidence baixa.
      filter_query(s, ctx){
        const raw = ctx._raw || '';
        // Detecta operador + valor (com vírgula decimal pt-BR opcional).
        const m = raw.match(/(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)/);
        if (!m){
          return { answer:'Não identifiquei a condição. Tente: "onde **<coluna>** > 1000".', action:null, confidence:0.3 };
        }
        const op = m[1];
        const valStr = m[2].replace(',', '.');
        const val = parseFloat(valStr);
        // Determina coluna alvo: primeira métrica, ou primeira dimensão numérica.
        const col = s.metrics[0] || s.dimensions[0];
        if (!col) return { answer:'Não identifiquei a coluna. Tente: "onde **receita** > 1000".', action:null, confidence:0.3 };
        // Filtra linhas
        const rows = ctx.rows || [];
        const matched = rows.filter(r => {
          const v = SolsticeStats.parseNum(r[col]); if (isNaN(v)) return false;
          if (op === '>')  return v >  val;
          if (op === '<')  return v <  val;
          if (op === '>=') return v >= val;
          if (op === '<=') return v <= val;
          return v === val;
        });
        const pct = rows.length ? ((matched.length / rows.length) * 100).toFixed(1) : '0';
        return {
          answer: `${matched.length} de ${rows.length} linhas (${pct}%) têm **${_friendly(col, ctx)}** ${op} ${valStr}. Cálculo local; aplique no filtro global pela barra de Filtros se quiser persistir.`,
          action: { type:'create_component', componentType:'table', config:{ localFilters: [{ column: col, op, value: val }] } },
          confidence: 0.8,
          source: 'filter_query_local'
        };
      },
      group_sum(s, ctx){ return HANDLERS.compare(s, ctx); },
      period_compare(s, ctx){
        const col = s.metrics[0];
        return { answer:`Comparação de períodos nominais (jan/fev/Q1/Q2 etc) ainda não usa filtragem direta — disponível visualmente via Filtros Globais (B9) com presets de data.`, action:{ type:'create_component', componentType:'time-series', config:{ yColumn: col } }, confidence: 0.4 };
      },
      anomaly(s, ctx){
        // Detecta outliers nas 3 primeiras numéricas
        const numCols = (ctx.columns || []).filter(c => _userGroup(ctx.types && ctx.types[c]) === 'measure').slice(0, 3);
        const flagged = [];
        for (const col of numCols){
          const values = _numericValues(col, ctx.rows);
          const outs = (SolsticeStats.outliersIQR(values).indices || []).length;  // OUTLIER-SHAPE 2026.6
          if (outs > values.length * 0.05) flagged.push(`${_friendly(col, ctx)} (${outs} outliers)`);
        }
        return { answer: flagged.length ? `Anomalias detectadas em: ${flagged.join(' · ')}.` : 'Nenhuma anomalia significativa detectada nas 3 primeiras métricas.', action:null, confidence: 0.7 };
      },
      impact(s, ctx){ return HANDLERS.compare(s, ctx); },
      recommend(s, ctx){
        const h = HANDLERS.health(s, ctx);
        return { answer: h.answer.replace('Recomendação', 'Próximo passo recomendado'), action: h.action, confidence: h.confidence };
      },
      kpi_snapshot(s, ctx){
        const col = s.metrics[0];
        if (!col) return { answer:'Especifique a métrica.', action:null, confidence:0.2 };
        return { answer:`KPI de **${_friendly(col, ctx)}** criado. Configure agg/comparação no Inspector.`, action:{ type:'create_component', componentType:'kpi', config:{ column: col } }, confidence: 0.85 };
      },
      history(s, ctx){
        const col = s.metrics[0];
        if (!col) return { answer:'Especifique a métrica.', action:null, confidence:0.2 };
        return { answer:`Série temporal histórica de **${_friendly(col, ctx)}** criada.`, action:{ type:'create_component', componentType:'time-series', config:{ yColumn: col } }, confidence: 0.8 };
      },
      general(s, ctx){
        const cols = (ctx.columns || []).slice(0, 3).map(c => _friendly(c, ctx)).join(', ');
        return {
          answer: `Não entendi totalmente. Algumas ideias para o seu dataset (${ctx.rows.length} registros, colunas: ${cols}):\n\n` +
                  `• "tendência de **<métrica>**"\n• "top 5 **<dimensão>** por **<métrica>**"\n• "**<métrica>** está bem?"`,
          action: null, confidence: 0.15
        };
      }
    };

    /* ===== Camada 5 — API pública ===== */
    const _history = [];
    function _historyAdd(q, resp){
      _history.unshift({ q, resp, at: Date.now() });
      while (_history.length > 50) _history.pop();
    }

    function _parseLocal(text, ctx){
      const tokens = tokenize(text);
      const resolved = resolveEntities(tokens, ctx);
      const intent = detectIntent(tokens, resolved);
      const handler = HANDLERS[intent.id] || HANDLERS.general;
      // Auditoria 2026 (B-04 / A-705): handlers (ex.: what_if) precisam do
      // texto cru para extrair "10%", "subir/cair" etc.
      const enrichedCtx = Object.assign({}, ctx, { _raw: text });
      const result = handler(resolved, enrichedCtx);
      return Object.assign({ intent: intent.id, slots: resolved, source: 'local' }, result);
    }

    function ask(text, ctx){
      ctx = ctx || _defaultCtx();
      const result = _parseLocal(text, ctx);
      _historyAdd(text, result);
      return result;
    }

    function _defaultCtx(){
      const ingest = SolsticeStore.get('ingest') || {};
      const allRows = ingest.rows || [];
      const filtered = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.apply(allRows) : allRows;
      return {
        rows: filtered, rowsAll: allRows,
        columns: ingest.columns || [],
        types: ingest.types || {},
        dictionary: SolsticeStore.get('dictionary'),
        L: SolsticeLocale
      };
    }

    function suggest(partial, ctx){
      ctx = ctx || _defaultCtx();
      partial = (partial || '').trim();
      const out = [];
      const allExamples = INTENTS.flatMap(i => i.examples || []);
      // Filtra por substring de partial
      const term = _norm(partial);
      for (const ex of allExamples){
        if (_norm(ex).includes(term)) out.push(ex);
        if (out.length >= 8) break;
      }
      // Personaliza com nomes de colunas se vazio
      if (!out.length && ctx.columns && ctx.columns.length){
        const col = _friendly(ctx.columns[0], ctx);
        out.push(`tendência de ${col}`, `${col} está bem?`, `top 5 ${col}`);
      }
      return out.slice(0, 6);
    }

    function examples(ctx){
      // ADR-177 (Fix-9 v5.5): exemplos variados cobrindo 6-8 intents diferentes,
      // personalizados por domínio detectado. Auditoria 2026.4: o catálogo do "Ask"
      // está muito genérica e não há como tirar insights da maioria dos casos".
      // ANTES: 2-3 sugestões pobres (tendência + está bem + top 5).
      // AGORA: 6-8 sugestões cobrindo aggregate/trend/top/impact/anomaly/recommend/period_compare/pareto.
      ctx = ctx || _defaultCtx();
      if (!ctx.columns || !ctx.columns.length){
        return [
          'média de receita',
          'tendência das vendas no último ano',
          'top 5 clientes por receita',
          'qual canal tem pior performance?',
          'há anomalias nos dados?',
          'o que devo priorizar?'
        ];
      }

      const nums = ctx.columns.filter(c => _userGroup(ctx.types && ctx.types[c]) === 'measure');
      const dims = ctx.columns.filter(c => _userGroup(ctx.types && ctx.types[c]) === 'dimension');
      const temps = ctx.columns.filter(c => {
        const grp = SolsticeTypes && SolsticeTypes.group(ctx.types && ctx.types[c] && ctx.types[c].type);
        return grp === 'temporal';
      });

      // Detecta domínio uma vez
      let activeDomain = null;
      try {
        if (typeof SolsticeDomain !== 'undefined'){
          const d = SolsticeDomain.detectDomain({ columns: ctx.columns });
          if (d.confidence >= 40) activeDomain = d.domain;
        }
      } catch(_){}

      const out = [];

      // Exemplos domain-specific PRIMEIRO (mais ressonância)
      if (activeDomain === 'banco_pj'){
        const hasSLA = ctx.columns.find(c => /sla/i.test(c));
        const hasCanal = ctx.columns.find(c => /canal/i.test(c));
        const hasNps = ctx.columns.find(c => /nps|satisfac/i.test(c));
        const hasEscal = ctx.columns.find(c => /escalon|reabertura/i.test(c));
        const hasInad = ctx.columns.find(c => /dpd|inadim/i.test(c));
        if (hasSLA && hasCanal) out.push('qual canal tem pior SLA?');
        if (hasEscal) out.push('clientes com mais escalonamentos');
        if (hasNps && dims[0]) out.push(`NPS por ${_friendly(dims[0], ctx)}`);
        if (hasInad) out.push('como está a inadimplência?');
      } else if (activeDomain === 'vendas'){
        const hasTicket = ctx.columns.find(c => /ticket|aov/i.test(c));
        const hasMargem = ctx.columns.find(c => /margem|margin/i.test(c));
        if (hasTicket && dims[0]) out.push(`ticket médio por ${_friendly(dims[0], ctx)}`);
        if (hasMargem) out.push('produtos com maior margem');
      }

      // Agora os exemplos genéricos cobrindo intents variados
      if (nums[0]) out.push(`tendência de ${_friendly(nums[0], ctx)}`);
      if (dims[0] && nums[0]) out.push(`top 5 ${_friendly(dims[0], ctx)} por ${_friendly(nums[0], ctx)}`);
      if (dims[0] && nums[0]) out.push(`qual ${_friendly(dims[0], ctx)} mais impacta ${_friendly(nums[0], ctx)}?`);
      if (nums[0]) out.push(`outliers em ${_friendly(nums[0], ctx)}`);
      if (dims[0] && dims.length >= 1 && nums[0]) out.push(`pareto 80/20 de ${_friendly(nums[0], ctx)} por ${_friendly(dims[0], ctx)}`);
      if (temps[0] && nums[0]) out.push(`${_friendly(nums[0], ctx)} do último mês vs penúltimo`);
      out.push('há anomalias nos dados?');
      out.push('o que devo priorizar?');

      // Dedupe + limit 8
      const seen = new Set();
      return out.filter(s => { if (seen.has(s)) return false; seen.add(s); return true; }).slice(0, 8);
    }

    return {
      ask, suggest, examples,
      tokenize, detectIntent, resolveEntities, levenshtein,
      _intents: INTENTS,
      history: {
        add: _historyAdd,
        list: () => _history.slice(),
        clear: () => _history.length = 0
      }
    };
  })();
