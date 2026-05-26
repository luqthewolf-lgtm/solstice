
  /* ============================================================
     BLOCO 10 — SolsticeRecommender (ADR-076)
     Recomenda visualização para conjunto de colunas. 15+ regras
     declarativas, cada uma com função `when(ctx, cols) → bool` e
     `confidence(ctx, cols) → 0-100`. Retorna recomendações ordenadas.
     ============================================================ */
  const SolsticeRecommender = (function(){

    /** Helper: filtra colunas por grupo. */
    function _byGroup(ctx, group){
      const cols = (ctx.columns || []).filter(c => {
        const t = (ctx.types || {})[c];
        return t && SolsticeTypes.group(t.type) === group;
      });
      if (group !== 'numeric') return cols;
      // Auditoria 2026.6 (METRIC-POOL): tira colunas numéricas tipo-identificador
      // (num_conta, agência, anomes, funcional, id sequencial) do pool de MÉTRICAS
      // — somar/graficar códigos não faz sentido. Em base bancária/CRM real o
      // auto-dashboard fazia kpi[num_agencia:sum]. Assim só medidas de verdade
      // (nota, tempo, receita) entram. Fallback: se zerar tudo, devolve o original.
      const rows = ctx.rows || ctx.rowsAll || [];
      const filtered = cols.filter(c => {
        const low = String(c).toLowerCase();
        if (/^id$|_id$|^id_|id_|^c[oó]d|c[oó]digo|^seq|^chave$|^key$|matr[ií]cula|protocolo|cpf|cnpj|cep|^num|_num|n[uú]mero|ag[eê]ncia|^conta$|_conta$|^pv$|_pv$|carteira|dicom|funcional|chpras|anomes|telefone|^ddd|cod_|_cod/.test(low)) return false;
        // Auditoria 2026.6 (METRIC-POOL · texto-livre): nomes de coluna de TEXTO
        // (comentário, observação, descrição...) nunca são MÉTRICA — somar não faz
        // sentido. Defesa extra: mesmo se o tipo vier mal-inferido como número
        // (ex: coluna esparsa com poucos valores numéricos), fica fora do pool.
        // Reportado: auto-dashboard montava "soma de comentário".
        if (/coment|observ|descri|^obs$|_obs$|texto|motivo|justif|mensagem|^msg|feedback|relato|parecer|narrativ/.test(low)) return false;
        const t = (ctx.types || {})[c];
        if (t && t.type === 'integer' && rows.length){
          const distinct = SolsticeStats.distinctCount(rows.map(r => r[c]));
          if (distinct / rows.length > 0.92) return false;
        }
        return true;
      });
      return filtered.length ? filtered : cols;
    }

    /** Helper: distinct count seguro. */
    function _distinct(ctx, col){
      return SolsticeStats.distinctCount((ctx.rows || ctx.rowsAll || []).map(r => r[col]));
    }

    /** Helper: dictionary col entry. */
    function _dictCol(ctx, col){
      return ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[col];
    }

    /**
     * 15 regras de recomendação. Cada regra:
     *  { id, label, requires: { numeric: N, temporal: N, categorical: N }, build(ctx) → { componentType, config, confidence, reasoning } | null }
     *
     * build() devolve null se a regra NÃO se aplica ao contexto atual.
     */
    const RULES = [
      {
        id: 'kpi-from-hib',
        label: 'KPI a partir de coluna higherIsBetter',
        build(ctx){
          const numCols = _byGroup(ctx, 'numeric');
          const target = numCols.find(c => {
            const d = _dictCol(ctx, c);
            return d && (d.higherIsBetter === true || d.higherIsBetter === false);
          });
          if (!target) return null;
          return {
            componentType: 'kpi',
            config: { column: target, agg: 'sum', comparison: { type: 'previous-period', targetValue: null, targetLabel: '', periodSize: 'auto' } },
            confidence: 90,
            reasoning: 'Coluna "' + SolsticeHumanize.column(target, ctx.dictionary) + '" tem direcionalidade conhecida no dicionário — KPI é o tipo mais adequado.'
          };
        }
      },
      {
        id: 'kpi-from-top-numeric',
        label: 'Linha de KPIs das métricas mais importantes',
        build(ctx){
          // Auditoria 2026.6 (KPI-ROW): antes gerava 1 KPI só, deixando a "Visão
          // executiva" magra e o dashboard como coluna única. Agora emite os top 3
          // metrics (vira linha de 3 KPIs via layout 3col-equal do overview), com
          // agregação inteligente: SOMA pra valores aditivos (receita, quantidade)
          // e MÉDIA pra métricas per-unit/taxa (preço, ticket, idade, score, %).
          const numCols = _byGroup(ctx, 'numeric');
          if (!numCols.length) return null;
          const ranked = SolsticeColumnScore.rank(ctx).filter(r => numCols.includes(r.col));
          if (!ranked.length) return null;
          const _isRate = (col) => {
            const hay = (col + ' ' + SolsticeHumanize.column(col, ctx.dictionary)).toLowerCase();
            // per-unit / rate / medições que nunca fazem sentido SOMAR (Auditoria 2026.6).
            return /pre[çc]o|m[ée]di|ticket|taxa|rate|ratio|percent|perc|pct|%|idade|score|nota|unit|por_|_por|avg|temperatura|temp|\bph\b|latitude|longitude|\blat\b|\blng\b|umidade|press|densidade|velocidade|\bn[ií]vel|[ií]ndice/.test(hay);
          };
          return ranked.slice(0, 3).map((rk, i) => {
            const agg = _isRate(rk.col) ? 'avg' : 'sum';
            return {
              componentType: 'kpi',
              config: { column: rk.col, agg },
              confidence: 76 - i * 2,
              reasoning: 'Coluna "' + SolsticeHumanize.column(rk.col, ctx.dictionary) + '" (score ' + rk.score + '/100) — KPI ' + (agg === 'avg' ? '(média)' : '(total)') + '.'
            };
          });
        }
      },
      {
        id: 'distrib-time',
        // Auditoria 2026.6: o auto-dashboard passa a preferir DISTRIBUIÇÃO TEMPORAL
        // (barras por período + linha) em vez de Série Temporal pura — usuário:
        // "a distribuição temporal é mais usada que série temporal". distrib-time
        // mostra o volume por período E a tendência, cobrindo os dois casos.
        label: 'Distribuição temporal: barras por período + linha',
        build(ctx){
          const tempCols = _byGroup(ctx, 'temporal');
          const numCols  = _byGroup(ctx, 'numeric');
          if (!tempCols.length || !numCols.length) return null;
          const ranked = SolsticeColumnScore.rank(ctx).filter(r => numCols.includes(r.col));
          const y = ranked.length ? ranked[0].col : numCols[0];
          // Métrica de taxa (nota/índice/%) → média; senão soma (volume por período).
          const _low = String(y).toLowerCase();
          const yAgg = /nota|score|indice|índice|taxa|rate|percent|media|média|nps|csat|rating|avalia/.test(_low) ? 'avg' : 'sum';
          return {
            componentType: 'distrib-time',
            config: { xColumn: tempCols[0], yColumn: y, yAgg: yAgg, bin: 'month', showDistribution: true, showLine: true },
            confidence: 85,
            reasoning: 'Há coluna temporal "' + SolsticeHumanize.column(tempCols[0], ctx.dictionary) +
                       '" + numérica "' + SolsticeHumanize.column(y, ctx.dictionary) +
                       '" — distribuição por período (' + (yAgg === 'avg' ? 'média' : 'soma') + ') + tendência.'
          };
        }
      },
      {
        id: 'scatter-correlated',
        label: 'Scatter para par numérico correlacionado',
        build(ctx){
          const pair = SolsticeStats.bestNumericPair(ctx);
          if (!pair || !pair.x || !pair.y || pair.r == null) return null;
          const absR = Math.abs(pair.r);
          if (absR < 0.30) return null; // só recomenda se há correlação detectável
          const confidence = Math.min(95, Math.round(50 + absR * 50));
          const strength = absR >= 0.7 ? 'forte' : absR >= 0.4 ? 'moderada' : 'fraca';
          return {
            componentType: 'scatter',
            config: { xColumn: pair.x, yColumn: pair.y, sizeColumn: null, showRegression: true, clusters: 0 },
            confidence,
            reasoning: 'Correlação ' + strength + ' (r=' + pair.r.toFixed(2) + ') entre "' +
                       SolsticeHumanize.column(pair.x, ctx.dictionary) + '" e "' +
                       SolsticeHumanize.column(pair.y, ctx.dictionary) + '".'
          };
        }
      },
      {
        id: 'boxplot-grouped',
        label: 'Box Plot agrupado: numérica × cat (2-8)',
        build(ctx){
          const s = SolsticeStats.suggestBoxPlot(ctx);
          if (!s.valueColumn || !s.groupColumn) return null;
          return {
            componentType: 'boxplot',
            config: s,
            confidence: 80,
            reasoning: 'Distribuição de "' + SolsticeHumanize.column(s.valueColumn, ctx.dictionary) +
                       '" por "' + SolsticeHumanize.column(s.groupColumn, ctx.dictionary) +
                       '" (' + _distinct(ctx, s.groupColumn) + ' grupos).'
          };
        }
      },
      {
        id: 'distribution-single-num',
        label: 'Distribuição de coluna numérica',
        build(ctx){
          const numCols = _byGroup(ctx, 'numeric');
          if (!numCols.length) return null;
          const ranked = SolsticeColumnScore.rank(ctx).filter(r => numCols.includes(r.col));
          const col = ranked.length ? ranked[0].col : numCols[0];
          return {
            componentType: 'distribution',
            config: { column: col, bins: 20 },
            confidence: 65,
            reasoning: 'Histograma de "' + SolsticeHumanize.column(col, ctx.dictionary) +
                       '" — útil para entender forma e dispersão.'
          };
        }
      },
      {
        id: 'sankey-two-cats',
        label: 'Sankey: duas categóricas distintas',
        build(ctx){
          const s = SolsticeStats.suggestSankey(ctx);
          if (!s.sourceColumn || !s.targetColumn) return null;
          return {
            componentType: 'sankey',
            config: s,
            confidence: 75,
            reasoning: 'Fluxo entre "' + SolsticeHumanize.column(s.sourceColumn, ctx.dictionary) +
                       '" e "' + SolsticeHumanize.column(s.targetColumn, ctx.dictionary) + '".'
          };
        }
      },
      {
        id: 'gauge-pct',
        label: 'Gauge para coluna percentual',
        build(ctx){
          const pctCol = (ctx.columns || []).find(c => ((ctx.types || {})[c] || {}).type === 'percentage');
          if (!pctCol) return null;
          const s = SolsticeStats.suggestGauge(ctx);
          return {
            componentType: 'gauge',
            config: s,
            confidence: 85,
            reasoning: 'Coluna "' + SolsticeHumanize.column(pctCol, ctx.dictionary) +
                       '" é percentual — gauge dá leitura imediata.'
          };
        }
      },
      {
        id: 'gauge-from-hib',
        label: 'Gauge para métrica higherIsBetter (não-%)',
        build(ctx){
          const numCols = _byGroup(ctx, 'numeric');
          const pctCol = numCols.find(c => ((ctx.types || {})[c] || {}).type === 'percentage');
          if (pctCol) return null; // já coberto pela regra anterior
          const target = numCols.find(c => {
            const d = _dictCol(ctx, c);
            return d && (d.higherIsBetter === true || d.higherIsBetter === false);
          });
          if (!target) return null;
          const s = SolsticeStats.suggestGauge(ctx);
          if (!s.column) return null;
          return {
            componentType: 'gauge',
            config: s,
            confidence: 70,
            reasoning: 'Métrica "' + SolsticeHumanize.column(target, ctx.dictionary) +
                       '" com direcionalidade — gauge com meta em P75/P25.'
          };
        }
      },
      {
        id: 'heatmap-cal',
        label: 'Heatmap Calendário: temporal diário',
        build(ctx){
          const tempCols = _byGroup(ctx, 'temporal');
          if (!tempCols.length) return null;
          const rows = ctx.rows || ctx.rowsAll || [];
          // só recomenda se há tempo suficiente (≥ 60 dias distintos)
          const dates = new Set();
          for (const r of rows){
            const d = new Date(r[tempCols[0]]);
            if (!isNaN(d)) dates.add(d.toISOString().slice(0, 10));
          }
          if (dates.size < 60) return null;
          const numCols = _byGroup(ctx, 'numeric');
          const valCol = numCols[0] || null;
          return {
            componentType: 'heatmap-cal',
            config: { dateColumn: tempCols[0], valueColumn: valCol, agg: valCol ? 'sum' : 'count' },
            confidence: 70,
            reasoning: 'Coluna "' + SolsticeHumanize.column(tempCols[0], ctx.dictionary) +
                       '" tem ' + dates.size + ' dias distintos — calendário GitHub-style.'
          };
        }
      },
      {
        id: 'top-categorical',
        label: 'Distribuição categórica (top categorias)',
        build(ctx){
          const catCols = _byGroup(ctx, 'categorical');
          if (!catCols.length) return null;
          const cat = catCols.find(c => {
            const d = _distinct(ctx, c);
            return d >= 3 && d <= 30;
          });
          if (!cat) return null;
          const numCols = _byGroup(ctx, 'numeric');
          // se há numérica, usa Box Plot; senão é só distribuição categórica via Tabela
          if (numCols.length) return null; // box-plot-grouped já cobre
          return {
            componentType: 'table',
            config: { rowLimit: 50 },
            confidence: 60,
            reasoning: 'Categórica "' + SolsticeHumanize.column(cat, ctx.dictionary) +
                       '" (' + _distinct(ctx, cat) + ' distintos) — tabela é fallback seguro.'
          };
        }
      },
      {
        id: 'table-fallback',
        label: 'Tabela como fallback',
        build(ctx){
          const cols = ctx.columns || [];
          if (cols.length < 3) return null;
          return {
            componentType: 'table',
            config: { rowLimit: 50 },
            confidence: 50,
            reasoning: 'Tabela é fallback universal — sempre útil ter os dados crus.'
          };
        }
      },
      {
        id: 'forecast-series',
        label: 'Série + forecast Holt-Winters (analítico)',
        build(ctx){
          // só sugere se há série temporal longa (>= 24 meses ou >= 60 pontos)
          const tempCols = _byGroup(ctx, 'temporal');
          if (!tempCols.length) return null;
          const rows = ctx.rows || ctx.rowsAll || [];
          const dates = rows.map(r => new Date(r[tempCols[0]])).filter(d => !isNaN(d));
          if (dates.length < 60) return null;
          const numCols = _byGroup(ctx, 'numeric');
          if (!numCols.length) return null;
          return {
            componentType: 'time-series',
            config: { xColumn: tempCols[0], yColumn: numCols[0], bin: 'month', kind: 'line' },
            confidence: 78,
            reasoning: 'Série longa (' + dates.length + ' pontos) — habilita forecast Holt-Winters via 📈 Análise.'
          };
        }
      },
      {
        id: 'outlier-hunt',
        label: 'Box Plot único para caça de outliers',
        build(ctx){
          // recomenda quando há numérica com outliers IQR detectáveis
          const numCols = _byGroup(ctx, 'numeric');
          if (!numCols.length) return null;
          let bestCol = null, bestPct = 0;
          for (const c of numCols.slice(0, 6)){
            const vals = (ctx.rows || ctx.rowsAll || []).map(r => SolsticeStats.parseNum(r[c])).filter(v => !isNaN(v));
            if (vals.length < 20) continue;
            const ou = SolsticeStats.outliersIQR(vals, 1.5);
            const pct = ou.values.length / vals.length;
            if (pct > bestPct && pct > 0.03){ bestPct = pct; bestCol = c; }
          }
          if (!bestCol) return null;
          return {
            componentType: 'boxplot',
            config: { valueColumn: bestCol, groupColumn: null },
            confidence: Math.min(85, 60 + Math.round(bestPct * 200)),
            reasoning: 'Coluna "' + SolsticeHumanize.column(bestCol, ctx.dictionary) +
                       '" tem ' + (bestPct * 100).toFixed(1) + '% de outliers IQR — investigar.'
          };
        }
      },
      {
        id: 'markdown-narrative',
        label: 'Markdown com placeholders de contexto',
        build(ctx){
          const ingest = SolsticeStore.get('ingest');
          if (!ingest || !ingest.sourceName) return null;
          return {
            componentType: 'markdown',
            config: { text: '# {{dataset.name}}\n\nDataset com {{ingest.meta.rowsCount}} registros importado em ' +
                            new Date().toLocaleDateString('pt-BR') + '.\n\n' +
                            '- Veja insights no painel superior 💡\n- Use o Wizard 🧙 para criar visualizações guiadas\n- Filtros 🔍 estão sempre disponíveis' },
            confidence: 55,
            reasoning: 'Documenta o contexto do dataset — útil quando dashboard é compartilhado.'
          };
        }
      }
    ];

    /**
     * recommend(ctx) → array de recomendações ordenadas por confidence desc.
     * Aceita filtro opcional `intent` (string) que limita o conjunto de regras.
     */
    function recommend(ctx, opts){
      opts = opts || {};
      const out = [];
      // Patch Corretivo (BUG D): dedup por (componentType + coluna principal)
      const usedSig = new Set();
      RULES.forEach(rule => {
        if (opts.intent && !_intentMatches(rule, opts.intent)) return;
        try {
          const built = rule.build(ctx);
          if (!built) return;
          // Auditoria 2026.6 (MULTI-REC): uma regra pode devolver VÁRIAS
          // recomendações (ex: linha de KPIs com 3 métricas). Aceita array.
          const recsFromRule = Array.isArray(built) ? built : [built];
          for (const r of recsFromRule){
            if (!r || r.confidence == null) continue;
            const c = r.config || {};
            const mainCol = c.column || c.yColumn || c.valueColumn || c.sourceColumn || c.xColumn || '';
            // Auditoria 2026.6 (SCALAR-DEDUP): kpi/gauge/bignum mostram UM número de
            // uma coluna — a mesma coluna não deve virar gauge E kpi (era o caso de
            // margem_pct). Compartilham namespace 'scalar' no dedup.
            const _scalar = (r.componentType === 'kpi' || r.componentType === 'gauge' || r.componentType === 'bignum');
            const sig = (_scalar ? 'scalar' : (r.componentType || '')) + '::' + mainCol;
            if (usedSig.has(sig)) continue;
            usedSig.add(sig);
            out.push({ ...r, ruleId: rule.id, label: rule.label });
          }
        } catch(e){ /* regra falhou silenciosa */ }
      });
      out.sort((a, b) => b.confidence - a.confidence);
      return out;
    }

    /** Mapa intent → ruleIds aceitos. */
    const INTENT_RULES = {
      'comparar':    ['boxplot-grouped', 'top-categorical', 'sankey-two-cats', 'kpi-from-hib', 'kpi-from-top-numeric'],
      'distribuir':  ['distribution-single-num', 'boxplot-grouped', 'outlier-hunt'],
      'tendencia':   ['time-series', 'forecast-series', 'heatmap-cal'],
      'ranking':     ['top-categorical', 'boxplot-grouped', 'table-fallback'],
      'composicao':  ['sankey-two-cats', 'top-categorical', 'table-fallback'],
      'correlacao':  ['scatter-correlated', 'boxplot-grouped'],
      'tabular':     ['table-fallback'],
      'forecast':    ['forecast-series', 'time-series'],
      'outlier':     ['outlier-hunt', 'distribution-single-num', 'boxplot-grouped'],
      'pareto':      ['top-categorical', 'sankey-two-cats'],
      'periodos':    ['time-series', 'kpi-from-hib'],
      'custom':      [] // todas as regras
    };
    function _intentMatches(rule, intent){
      const ids = INTENT_RULES[intent];
      if (!ids || !ids.length) return true; // custom = aceita tudo
      return ids.includes(rule.id);
    }

    function listRules(){ return RULES.map(r => ({ id: r.id, label: r.label })); }
    function listIntents(){ return Object.keys(INTENT_RULES); }

    return { recommend, listRules, listIntents, INTENT_RULES, RULES };
  })();
