
  /* ============================================================
     BLOCO 8 — SolsticeInsights
     Painel de Insights Executivos no topo do canvas. Analisa o dataset
     e gera entre 0 e 8 insights priorizados por importância. Cada
     insight tem { id, kind, icon, title, text, severity, score, meta }.
     Kinds suportados:
       trend, outliers, pareto, seasonality, recency, top, concentration
     Renderiza dentro do canvas (acima dos sections). Colapsável.
     ============================================================ */
  const SolsticeInsights = (function(){
    let insightsCache = [];
    let containerEl = null;

    /**
     * Computa insights a partir do dataset atual. Função pura — devolve
     * array de objetos { id, kind, icon, title, text, severity, score, meta }
     * severity: 'success' | 'warn' | 'error' | 'info'
     * score: 0-100 (usado para ordenar e limitar a top 8)
     */
    function compute(){
      const ingest = SolsticeStore.get('ingest');
      const dict = SolsticeStore.get('dictionary');
      if (!ingest || !ingest.rows || !ingest.rows.length) return [];
      const rows = ingest.rows;
      const cols = ingest.columns || [];
      const types = ingest.types || {};
      const insights = [];

      const numericCols = cols.filter(c => SolsticeTypes.group(types[c] && types[c].type) === 'numeric');
      const tempCols = cols.filter(c => SolsticeTypes.group(types[c] && types[c].type) === 'temporal');
      const catCols = cols.filter(c => SolsticeTypes.group(types[c] && types[c].type) === 'categorical');

      // Helper: higherIsBetter de uma coluna
      function hib(col){
        const d = dict && dict.columns && dict.columns[col];
        return d && d.higherIsBetter;
      }
      function friendly(col){ return SolsticeHumanize.column(col, dict); }

      // === INSIGHT 1: TENDÊNCIA forte numa numérica ===
      // HOTFIX v5.5 #113 (Auditoria 2026.4): aumentado nº de insights detectados —
      // Threshold reduzido de 10%→5% magnitude e R²=0.30→0.20.
      // Também passou de slice(0,6) → slice(0,10) (mais colunas analisadas).
      numericCols.slice(0, 10).forEach(col => {
        const values = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
        if (values.length < 10) return;
        const t = SolsticeStats.trend(values);
        if (!t || t.direction === 'flat') return;
        if (t.magnitude < 0.05 || (t.r2 != null && t.r2 < 0.20)) return;
        const isUp = t.direction === 'up';
        const isGood = hib(col) === true ? isUp : hib(col) === false ? !isUp : null;
        const sev = isGood === true ? 'success' : isGood === false ? 'error' : 'info';
        const icon = isUp ? '📈' : '📉';
        const dirTxt = isUp ? 'subindo' : 'caindo';
        insights.push({
          id: 'trend-' + col,
          kind: 'trend', icon,
          title: 'Tendência ' + (isUp ? 'de alta' : 'de queda') + ': ' + friendly(col),
          text: friendly(col) + ' está ' + dirTxt + ' — variação total ' +
                (t.totalChange > 0 ? '+' : '') + SolsticeLocale.decimal(t.totalChange, 1) +
                ' (' + SolsticeLocale.decimal(t.magnitude * 100, 1) + '% da média)' +
                (t.r2 != null ? ' · R² = ' + SolsticeLocale.decimal(t.r2, 2) : ''),
          severity: sev,
          score: Math.min(100, t.magnitude * 100 * (t.r2 || 0.5) * 2),
          meta: { column: col, trend: t }
        });
      });

      // === INSIGHT 2: OUTLIERS significativos ===
      // HOTFIX #113: threshold reduzido de 2%→1% pra mostrar mais
      numericCols.slice(0, 10).forEach(col => {
        const values = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
        if (values.length < 10) return;
        const ou = SolsticeStats.outliersIQR(values, 1.5);
        const pct = ou.values.length / values.length;
        if (pct < 0.01) return; // <1% não interessa
        const sev = pct > 0.10 ? 'error' : pct > 0.05 ? 'warn' : 'info';
        insights.push({
          id: 'outliers-' + col,
          kind: 'outliers', icon: '⚠️',
          title: 'Outliers em ' + friendly(col),
          text: ou.values.length + ' valor' + (ou.values.length === 1 ? '' : 'es') +
                ' fora da faixa típica (' + SolsticeLocale.decimal(pct * 100, 1) + '% do total). ' +
                'IQR 1.5×: faixa válida ' + SolsticeLocale.decimal(ou.fences.lo, 1) +
                ' a ' + SolsticeLocale.decimal(ou.fences.hi, 1) +
                /* Auditoria 2026 (L-T-2 / A-209): outlier estatístico não é erro. */
                '. Outlier estatístico ≠ erro — investigue se são valores reais (clientes high-value) ou ruído antes de remover.',
          severity: sev,
          score: Math.min(100, pct * 100 * 3),
          meta: { column: col, count: ou.values.length, pct }
        });
      });

      // === INSIGHT 3: PARETO 80/20 em categórica × numérica ===
      // Pega primeira cat com 3-30 distintos × primeira numérica
      if (catCols.length && numericCols.length){
        const catCol = catCols.find(c => {
          const d = SolsticeStats.distinctCount(rows.map(r => r[c]));
          return d >= 3 && d <= 30;
        });
        const numCol = numericCols[0];
        if (catCol && numCol){
          const agg = new Map();
          for (const r of rows){
            const k = String(r[catCol] || '—');
            const v = SolsticeStats.parseNum(r[numCol]); if (isNaN(v)) continue;
            agg.set(k, (agg.get(k) || 0) + v);
          }
          const sorted = Array.from(agg.entries()).sort((a, b) => b[1] - a[1]);
          const total = sorted.reduce((s, [, v]) => s + v, 0);
          if (total > 0 && sorted.length >= 3){
            let cumulative = 0;
            let topN = 0;
            for (const [, v] of sorted){
              cumulative += v; topN++;
              if (cumulative / total >= 0.80) break;
            }
            const pctTop = (topN / sorted.length) * 100;
            const topNames = sorted.slice(0, Math.min(topN, 3)).map(([k]) => k).join(', ');
            insights.push({
              id: 'pareto-' + catCol + '-' + numCol,
              kind: 'pareto', icon: '🎯',
              title: 'Concentração Pareto em ' + friendly(catCol),
              text: SolsticeLocale.decimal(pctTop, 0) + '% das categorias (' + topN + ' de ' + sorted.length +
                    ') concentram 80% de ' + friendly(numCol) + '. Top: ' + topNames +
                    (topN < sorted.length ? '…' : ''),
              severity: pctTop < 30 ? 'warn' : 'info',
              score: Math.min(100, (100 - pctTop) * 1.2),
              meta: { catColumn: catCol, numColumn: numCol, topN, totalGroups: sorted.length }
            });
          }
        }
      }

      // === INSIGHT 4: SAZONALIDADE detectada em série temporal ===
      if (tempCols.length && numericCols.length){
        const tempCol = tempCols[0];
        const numCol = numericCols[0];
        // Agrega por mês — se autocorrelação no lag 12 > 0.5, sazonal anual
        const byMonth = new Map();
        for (const r of rows){
          const d = new Date(r[tempCol]); if (isNaN(d)) continue;
          const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
          const v = SolsticeStats.parseNum(r[numCol]); if (isNaN(v)) continue;
          byMonth.set(k, (byMonth.get(k) || 0) + v);
        }
        const monthly = Array.from(byMonth.entries()).sort().map(([, v]) => v);
        if (monthly.length >= 24){
          const ac = SolsticeStats.autocorrelation(monthly, 12);
          if (ac != null && ac > 0.4){
            insights.push({
              id: 'season-' + numCol,
              kind: 'seasonality', icon: '🔄',
              title: 'Sazonalidade anual em ' + friendly(numCol),
              text: 'Autocorrelação anual (lag 12 meses) = ' + SolsticeLocale.decimal(ac, 2) +
                    '. Padrão sazonal forte — repete a cada ~12 meses.',
              severity: 'info',
              score: 60 + (ac * 30),
              meta: { column: numCol, autocorr: ac }
            });
          }
        }
      }

      // === INSIGHT 5: MUDANÇA RECENTE — primeira metade vs segunda ===
      // HOTFIX #113: threshold de 20%→10%, slice 3→6
      numericCols.slice(0, 6).forEach(col => {
        const values = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
        if (values.length < 20) return;
        const half = Math.floor(values.length / 2);
        const m1 = SolsticeStats.mean(values.slice(0, half));
        const m2 = SolsticeStats.mean(values.slice(half));
        if (m1 == null || m2 == null || m1 === 0) return;
        const pct = (m2 - m1) / Math.abs(m1);
        if (Math.abs(pct) < 0.10) return; // <10% não é interessante
        const isUp = pct > 0;
        const isGood = hib(col) === true ? isUp : hib(col) === false ? !isUp : null;
        const sev = isGood === true ? 'success' : isGood === false ? 'error' : 'info';
        insights.push({
          id: 'recency-' + col,
          kind: 'recency', icon: isUp ? '🔼' : '🔽',
          title: 'Mudança recente em ' + friendly(col),
          text: 'Comparando primeira metade dos registros com segunda: ' +
                (isUp ? '+' : '') + SolsticeLocale.decimal(pct * 100, 1) + '%' +
                ' (' + SolsticeLocale.decimal(m1, 1) + ' → ' + SolsticeLocale.decimal(m2, 1) + ')',
          severity: sev,
          score: Math.min(100, Math.abs(pct) * 100),
          meta: { column: col, pct, m1, m2 }
        });
      });

      // === INSIGHT 6: TOP CATEGORIA dominante ===
      catCols.slice(0, 3).forEach(col => {
        const counts = new Map();
        rows.forEach(r => { const k = String(r[col] || '—'); counts.set(k, (counts.get(k) || 0) + 1); });
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        if (sorted.length < 2) return;
        const total = rows.length;
        const topPct = sorted[0][1] / total;
        if (topPct < 0.40) return;
        insights.push({
          id: 'top-' + col,
          kind: 'top', icon: '👑',
          title: 'Categoria dominante em ' + friendly(col),
          text: '"' + sorted[0][0] + '" representa ' +
                SolsticeLocale.decimal(topPct * 100, 0) + '% dos registros (' +
                sorted[0][1] + ' de ' + total + '). ' +
                (sorted[1] ? 'Próxima: "' + sorted[1][0] + '" com ' + SolsticeLocale.decimal(sorted[1][1]/total * 100, 0) + '%.' : ''),
          severity: topPct > 0.80 ? 'warn' : 'info',
          score: topPct * 100,
          meta: { column: col, top: sorted[0][0], pct: topPct }
        });
      });

      // === INSIGHT 7 (NOVO #113): CORRELAÇÃO entre pares de numéricas ===
      // Auditoria 2026.4: insight de correlação agora mostra TODOS os pares com |r| > 0.5 (antes mostrava só 1).
      if (numericCols.length >= 2){
        const seen = new Set();
        const top = numericCols.slice(0, 8);
        for (let i = 0; i < top.length; i++){
          for (let j = i + 1; j < top.length; j++){
            const a = top[i], b = top[j];
            const key = a + '||' + b;
            if (seen.has(key)) continue;
            seen.add(key);
            // Pares de (xa, yb) sem NaN
            const xs = [], ys = [];
            for (const r of rows){
              const x = SolsticeStats.parseNum(r[a]); const y = SolsticeStats.parseNum(r[b]);
              if (isNaN(x) || isNaN(y)) continue;
              xs.push(x); ys.push(y);
            }
            if (xs.length < 20) continue;
            const r = (SolsticeStats.correlation ? SolsticeStats.correlation(xs, ys) : null);
            if (r == null || isNaN(r)) continue;
            const absR = Math.abs(r);
            if (absR < 0.50) continue;
            const strength = absR > 0.85 ? 'muito forte' : absR > 0.70 ? 'forte' : 'moderada';
            const dir = r > 0 ? 'positiva' : 'negativa';
            // Auditoria 2026 (B-01 / A-201): disclaimer obrigatório — correlação ≠ causalidade.
            // Pearson r mede ASSOCIAÇÃO LINEAR; nunca direção nem causa.
            // Sufixo extra para |r| ≥ 0.85 alerta sobre variável confundidora.
            const _causalDisclaimer = absR >= 0.85
              ? ' Correlação não é causalidade — considere variável confundidora ou tendência comum.'
              : ' Correlação não é causalidade; investigue o mecanismo antes de concluir.';
            insights.push({
              id: 'corr-' + a + '-' + b,
              kind: 'correlation', icon: '🔗',
              title: 'Correlação ' + dir + ' ' + strength + ': ' + friendly(a) + ' × ' + friendly(b),
              text: 'r = ' + SolsticeLocale.decimal(r, 2) + (r > 0
                ? ' — quando ' + friendly(a) + ' sobe, ' + friendly(b) + ' tende a subir junto.'
                : ' — quando ' + friendly(a) + ' sobe, ' + friendly(b) + ' tende a cair.') + _causalDisclaimer,
              severity: 'info',
              score: 40 + (absR * 50),
              meta: { columnA: a, columnB: b, r }
            });
          }
        }
      }

      // === INSIGHT 8 (NOVO #113): COMPLETENESS / NULOS por coluna ===
      // Colunas com >10% de nulos viram alerta.
      cols.slice(0, 12).forEach(col => {
        let nulls = 0;
        for (const r of rows){
          const v = r[col];
          if (v == null || v === '') nulls++;
        }
        const pct = nulls / rows.length;
        if (pct < 0.10) return;
        const sev = pct > 0.40 ? 'error' : pct > 0.20 ? 'warn' : 'info';
        insights.push({
          id: 'nulls-' + col,
          kind: 'completeness', icon: '🕳️',
          title: 'Dados faltando em ' + friendly(col),
          text: SolsticeLocale.decimal(pct * 100, 1) + '% nulo/vazio (' + nulls + ' de ' + rows.length + ' linhas). ' +
                (pct > 0.40 ? 'Crítico — pode invalidar análises.' :
                 pct > 0.20 ? 'Atenção — confirme se é esperado.' :
                              'Investigar fonte.'),
          severity: sev,
          score: Math.min(100, pct * 100 * 1.5),
          meta: { column: col, pct, nulls }
        });
      });

      // === INSIGHT 9 v4 (Sprint 23 / UX-01) — INVENTÁRIO DE COLUNAS ===
      // Auditoria 2026.4 marcou esse insight como "O que dá pra construir".
      // Sprint 23: user reportou que título era ruim ("Eu falei pra tirar também
      // o que dá pra construir da esquerda") + linguagem técnica em vez de business.
      // Novo título neutro descritivo. Continua opt-out via ui.insights.hideOverview,
      // mas agora *default oculto* (line 30375) — não aparece a menos que o usuário
      // peça. Texto também vira mais business: foco em "o que medir", não em "o que
      // montar".
      (function _overviewActionable(){
        const _friendly = (col) => (dict && dict.columns && dict.columns[col] && dict.columns[col].friendlyName) || col;
        const _sampleNames = (arr, n) => arr.slice(0, n).map(_friendly).join(', ');
        const parts = [];
        if (numericCols.length) {
          parts.push('📊 ' + numericCols.length + ' medida' + (numericCols.length === 1 ? '' : 's') +
                     ' pronta(s) pra somar/calcular: ' + _sampleNames(numericCols, 3) +
                     (numericCols.length > 3 ? '…' : ''));
        }
        if (tempCols.length) {
          parts.push('📅 ' + tempCols.length + ' coluna' + (tempCols.length === 1 ? '' : 's') +
                     ' de tempo pra evolução/sazonalidade: ' + _sampleNames(tempCols, 2));
        }
        if (catCols.length) {
          parts.push('🏷️ ' + catCols.length + ' categoria' + (catCols.length === 1 ? '' : 's') +
                     ' pra segmentar/comparar: ' + _sampleNames(catCols, 3) +
                     (catCols.length > 3 ? '…' : ''));
        }
        insights.push({
          id: 'overview',
          kind: 'overview', icon: '🧰',
          title: 'Inventário de colunas',
          text: parts.join(' · '),
          severity: 'info',
          score: 20,
          meta: { rows: rows.length, cols: cols.length, numeric: numericCols.length, temporal: tempCols.length, categorical: catCols.length }
        });
      })();

      // === INSIGHT 10 v3 (BUG-04 / G2-08 · Auditoria 2026.4): "PERÍODO COBERTO" REMOVIDO ===
      // Insight de "período coberto" (X dias) era ruidoso e não acionável —
      // a informação está disponível pelo filtro de data e pelo head do dataset.
      // Insights devem propor decisão; range temporal é metadata, não insight.

      // === INSIGHT 11 (NOVO #113): RANGE EXTREMO (numéricas com range >> avg) ===
      // Identifica colunas com escala muito ampla — sugere agrupamento ou normalização.
      numericCols.slice(0, 8).forEach(col => {
        const values = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
        if (values.length < 20) return;
        const [mn, mx] = SolsticeStats.minMax(values); /* code review 2026: minMax safe */
        const avg = SolsticeStats.mean(values);
        if (!avg || avg === 0) return;
        const ratio = (mx - mn) / Math.abs(avg);
        if (ratio < 8) return; // range >= 8× a média é "extremo"
        insights.push({
          id: 'range-' + col,
          kind: 'range', icon: '↔️',
          title: 'Escala ampla em ' + friendly(col),
          text: 'Vai de ' + SolsticeLocale.decimal(mn, 1) + ' a ' + SolsticeLocale.decimal(mx, 1) +
                ' (range ' + SolsticeLocale.decimal(ratio, 1) + '× a média). ' +
                'Pode valer agrupar em faixas ou normalizar.',
          severity: 'info',
          score: Math.min(70, 30 + ratio * 2),
          meta: { column: col, min: mn, max: mx, avg, ratio }
        });
      });

      // === INSIGHT 12 (NOVO #113): CARDINALIDADE de categóricas ===
      // Coluna texto com cardinalidade próxima a 100% (parece ID disfarçado)
      // OU com cardinalidade muito baixa (quase constante).
      catCols.slice(0, 6).forEach(col => {
        const distinct = SolsticeStats.distinctCount(rows.map(r => r[col]));
        const ratio = distinct / rows.length;
        if (ratio > 0.95 && rows.length > 30){
          insights.push({
            id: 'cardhi-' + col,
            kind: 'cardinality', icon: '🆔',
            title: friendly(col) + ' parece um identificador',
            text: distinct + ' valores únicos em ' + rows.length + ' linhas (' +
                  SolsticeLocale.decimal(ratio * 100, 0) + '%). ' +
                  'Considere mudar tipo pra identifier — agrupar por isso não dá insight.',
            severity: 'warn',
            score: 50,
            meta: { column: col, distinct, ratio, kind: 'high' }
          });
        } else if (distinct === 1 && rows.length > 5){
          insights.push({
            id: 'cardlo-' + col,
            kind: 'cardinality', icon: '🗿',
            title: friendly(col) + ' é constante',
            text: 'Todos os ' + rows.length + ' registros têm o mesmo valor ("' +
                  String(rows[0][col] || '—').slice(0, 40) + '"). Provavelmente irrelevante pra comparação.',
            severity: 'info',
            score: 35,
            meta: { column: col, distinct: 1, kind: 'low' }
          });
        }
      });

      // === INSIGHT 13 (Auditoria 2026.4 / Sprint 18): ANOMALIA INLINE ===
      // Detecta pontos individuais que destoam significativamente do contexto
      // local em uma série temporal. Diferente de outliersIQR (que olha o dataset
      // inteiro), aqui usamos rolling median + MAD numa janela de 7 pontos —
      // captura anomalias contextuais (ex: "venda zero numa semana, sem feriado").
      // Benchmark Carlos (CA-03 da Auditoria 2026.3): Tableau Pulse / Power BI
      // Quick Insights destacam esse tipo de coisa.
      if (tempCols.length && numericCols.length){
        const tempCol = tempCols[0];
        const numCol = numericCols[0];
        // Ordena rows por data e pega a série
        const series = rows
          .map(r => ({ d: new Date(r[tempCol]), v: SolsticeStats.parseNum(r[numCol]) }))
          .filter(p => !isNaN(p.d.getTime()) && !isNaN(p.v))
          .sort((a, b) => a.d - b.d);
        if (series.length >= 14){
          const WIN = 7; // janela de 7 pontos (3 antes + ponto + 3 depois)
          const half = Math.floor(WIN / 2);
          const anomalies = [];
          for (let i = half; i < series.length - half; i++){
            const window = [];
            for (let j = i - half; j <= i + half; j++){
              if (j !== i) window.push(series[j].v);
            }
            // Mediana + MAD da janela vizinha (exclui o ponto sob teste)
            const med = SolsticeStats.median(window);
            const mad = SolsticeStats.mad(window);
            if (med == null || mad == null || mad === 0) continue;
            // Modified Z-Score (Iglewicz/Hoaglin), threshold 3.5
            const mz = Math.abs(0.6745 * (series[i].v - med) / mad);
            if (mz > 3.5){
              anomalies.push({ idx: i, point: series[i], mz, med });
            }
          }
          if (anomalies.length){
            // Limita aos 3 mais extremos pra não inundar
            anomalies.sort((a, b) => b.mz - a.mz);
            const top = anomalies.slice(0, 3);
            const dates = top.map(a => a.point.d.toLocaleDateString('pt-BR')).join(', ');
            insights.push({
              id: 'anomaly-' + numCol,
              kind: 'anomaly', icon: '🚨',
              title: 'Anomalia em ' + friendly(numCol),
              text: anomalies.length + ' ponto' + (anomalies.length > 1 ? 's' : '') +
                    ' fora do padrão local detectado' + (anomalies.length > 1 ? 's' : '') +
                    ' (rolling median + MAD, janela 7). ' +
                    'Top extremo' + (top.length > 1 ? 's' : '') + ': ' + dates +
                    '. Diferente de outlier global — esses pontos destoam dos vizinhos imediatos.',
              severity: anomalies.length > 5 ? 'warn' : 'info',
              score: Math.min(95, 50 + anomalies.length * 5 + top[0].mz * 3),
              meta: { column: numCol, count: anomalies.length, top, method: 'rolling-median-mad' }
            });
          }
        }
      }

      // Ordena por score desc. Cap subiu de 8 → 12 (Auditoria 2026.4: mostrar mais insights por padrão).
      insights.sort((a, b) => b.score - a.score);
      return insights.slice(0, 12);
    }

    /** Camada Polish v3: explicação educativa por tipo de insight.
        Texto em linguagem clara pra cliente NÃO-técnico entender o que fazer
        com a informação. */
    function _explainKind(insight){
      const k = insight.kind;
      const m = insight.meta || {};
      if (k === 'trend'){
        const dir = m.trend && m.trend.direction === 'up' ? 'crescendo' : 'caindo';
        const r2 = (m.trend && m.trend.r2 != null) ? m.trend.r2 : null;
        const conf = r2 != null
          ? (r2 > 0.7 ? 'muito previsível (R² alto)' : r2 > 0.4 ? 'razoavelmente previsível' : 'irregular (R² baixo)')
          : 'sem medida de previsibilidade';
        return {
          what: 'A linha está ' + dir + ' ao longo do tempo de forma ' + conf + '.',
          why: 'Vale a pena olhar porque mudanças consistentes raramente são acaso — refletem mudança real (sazonal, estratégica, mercado).',
          do: [
            r2 != null && r2 > 0.5 ? 'Use essa tendência pra projetar próximo trimestre.' : 'Confirme se há padrão real ou só ruído antes de planejar com base nisso.',
            'Identifique o que está dirigindo a mudança (campanha, sazonalidade, problema operacional).',
            'Se for boa: investigue se dá pra acelerar. Se for ruim: investigue causa raiz antes de virar problema grande.'
          ]
        };
      }
      if (k === 'outliers'){
        return {
          what: m.count + ' valor(es) estão fora da faixa típica desta coluna (IQR 1.5×).',
          why: 'Outliers podem ser: (a) erro de cadastro/lançamento, (b) caso excepcional real (cliente VIP, transação fraude), (c) oportunidade ou alerta.',
          do: [
            'Abra a tabela e filtre os outliers — olhe linha por linha (caso < 20).',
            'Pergunte: "este número faz sentido pro contexto?". Se não, é dado sujo → corrija na fonte.',
            'Se forem reais, classifique-os em "grupo especial" pra tratar separado (ex: top clientes, ou exceções da operação).'
          ]
        };
      }
      if (k === 'pareto'){
        return {
          what: 'Poucos itens (' + m.topN + ' de ' + m.totalGroups + ') concentram 80% do total — Lei de Pareto.',
          why: 'Esse padrão é universal em vendas, custos, reclamações: 20% das causas geram 80% dos efeitos. Saber disso evita perder tempo no que não importa.',
          do: [
            'Foque seu esforço no top ' + m.topN + ' itens — eles protegem o resultado principal.',
            'Os 80% restantes podem ser automatizados, terceirizados ou padronizados.',
            'CUIDADO: se um item top sair, o impacto é desproporcional. Diversifique se a concentração for alta demais.'
          ]
        };
      }
      if (k === 'seasonal' || k === 'seasonality'){
        return {
          what: 'Encontrei padrão que se repete em intervalos regulares (sazonalidade).',
          why: 'Sazonalidade explica picos/vales sem você precisar inventar narrativa. Ignorar leva a decisões erradas (achar que campanha funcionou quando era só Natal).',
          do: [
            'Compare períodos similares (mês vs. mesmo mês do ano anterior, não vs. mês passado).',
            'Provisione recursos/estoque antes do pico previsível.',
            'Em mês de baixa esperada, não corte agressivamente — o ciclo volta.'
          ]
        };
      }
      if (k === 'recency' || k === 'recency-change'){
        return {
          what: 'Comparei a 1ª metade do período com a 2ª — há diferença significativa.',
          why: 'Mudança recente pode ser: campanha nova, problema novo, mudança de regime, ou ruído. Detectar cedo evita ser pego de surpresa.',
          do: [
            'Pergunte: o que mudou na operação/mercado entre os dois períodos?',
            'Se for melhoria, identifique a causa e tente sustentar.',
            'Se for piora, investigue rápido — 2 meses de queda pode virar 6 sem ação.'
          ]
        };
      }
      if (k === 'top' || k === 'categoria-dominante'){
        return {
          what: 'Uma categoria domina mais de 40% do total.',
          why: 'Concentração alta = risco de concentração. Se essa categoria cair, o resultado total cai junto.',
          do: [
            'Estratégia A: aceitar e proteger essa categoria (CRM, retenção, qualidade).',
            'Estratégia B: diversificar — investir em categorias menores até reduzir dependência.',
            'Geralmente faz as DUAS: protege a top + cresce a 2ª/3ª pra distribuir risco.'
          ]
        };
      }
      // HOTFIX v5.5 #113: novas categorias de insight
      if (k === 'correlation'){
        const r = (m.r != null) ? m.r : 0;
        const dir = r > 0 ? 'positiva' : 'negativa';
        const strength = Math.abs(r) > 0.85 ? 'muito forte' : Math.abs(r) > 0.70 ? 'forte' : 'moderada';
        return {
          what: 'Duas métricas se movem juntas (' + dir + ' ' + strength + '). r = ' + SolsticeLocale.decimal(r, 2) + '.',
          why: 'Correlação não é causalidade, mas indica que vale investigar. Se r > 0.8, possivelmente uma "predice" a outra OU as duas dependem de causa comum.',
          do: [
            'Olhe um scatter plot — confirme se a relação é linear ou tem padrões estranhos.',
            'Pergunte: é causa-efeito ou ambas dependem de outra coisa (sazonal, mercado, campanha)?',
            'Se for previsível, use uma pra estimar a outra quando faltar dado.'
          ]
        };
      }
      if (k === 'completeness'){
        return {
          what: SolsticeLocale.decimal((m.pct || 0) * 100, 1) + '% das linhas têm essa coluna vazia/nula.',
          why: 'Dado faltando contamina análises silenciosamente. Médias ficam tortas, contagens parecem certas mas escondem buraco.',
          do: [
            'Investigue a fonte: por que faltou? (sistema, opcional, erro de ingestão)',
            'Decida: imputar (preencher com média/zero/anterior), filtrar essas linhas, ou aceitar.',
            'Se for crítico (>40%), pare e resolva ANTES de tirar conclusões.'
          ]
        };
      }
      if (k === 'overview'){
        return {
          what: 'Resumo estrutural: ' + m.rows + ' linhas × ' + m.cols + ' colunas. ' +
                m.numeric + ' numéricas, ' + m.temporal + ' datas, ' + m.categorical + ' categóricas.',
          why: 'Saber a forma do dataset antes de qualquer análise evita perguntas que ele não consegue responder.',
          do: [
            (m.temporal === 0 ? 'Sem coluna temporal: análises de tendência não vão funcionar.' : 'Tem ' + m.temporal + ' data(s) — explore evolução temporal.'),
            (m.numeric === 0 ? 'Sem numéricas: limitado a contagens e proporções.' : 'Use as numéricas pra KPIs e métricas.'),
            'Confira tipos na sidebar Dados antes de filtrar/agregar.'
          ]
        };
      }
      if (k === 'period'){
        return {
          what: 'Os dados cobrem ' + SolsticeHumanize.timeRange(m.days * 24 * 60 * 60 * 1000) + '.',
          why: 'Período curto = conclusões frágeis (pode ser só ruído). Período longo = sazonalidade pode estar mascarando coisa.',
          do: [
            (m.days < 30 ? 'Período curto: cuidado com extrapolação. Procure mais histórico se possível.' : 'Período longo o suficiente — compare períodos similares (ex: mês vs mesmo mês ano anterior).'),
            'Verifique se o intervalo cobre datas relevantes (lançamentos, mudanças de processo).',
            'Filtre por janela específica se quiser focar em um sub-período.'
          ]
        };
      }
      if (k === 'range'){
        return {
          what: 'A coluna varia ' + (m.ratio ? SolsticeLocale.decimal(m.ratio, 1) : '?') + '× a média (range muito amplo).',
          why: 'Escala ampla esconde detalhes: numa média, valores extremos puxam tudo. Em gráficos, pequenas variações ficam invisíveis ao lado de gigantes.',
          do: [
            'Considere agrupar em faixas (P0-P25, P25-P50...) pra ver distribuição mais clara.',
            'Use eixo logarítmico em gráficos quando range > 10× a média.',
            'Pergunte se os extremos são reais ou erros de cadastro.'
          ]
        };
      }
      if (k === 'cardinality'){
        if (m.kind === 'high'){
          return {
            what: 'Essa coluna tem ' + m.distinct + ' valores únicos em ' + Math.round(m.distinct/m.ratio) + ' linhas — comporta-se como ID.',
            why: 'Agrupar por isso não dá insight: cada grupo tem 1 linha. O Solstice provavelmente está marcando como categoria, mas é identificador.',
            do: [
              'Mude tipo pra "identifier" via ⚙️ Dados → header da coluna.',
              'Use essa coluna pra JOIN/lookup, não pra agregação.',
              'Se for chave de negócio (CPF, CNPJ), confirme tipo específico.'
            ]
          };
        }
        return {
          what: 'Essa coluna tem só 1 valor único em todas as linhas.',
          why: 'Constantes não diferenciam nada — ocupam espaço sem ajudar análise.',
          do: [
            'Confirme se é esperado (ex: dataset filtrado já por essa coluna).',
            'Considere remover do dashboard pra não confundir.',
            'Se mudou recentemente, pode indicar dado novo entrando.'
          ]
        };
      }
      if (k === 'anomaly'){
        const count = m.count || 0;
        const topDates = (m.top || []).map(a => a.point && a.point.d && a.point.d.toLocaleDateString('pt-BR')).filter(Boolean);
        return {
          what: count + ' ponto(s) destoaram dos vizinhos imediatos numa janela de 7 observações' +
                (topDates.length ? ' (mais extremos: ' + topDates.join(', ') + ')' : '') + '.',
          why: 'Anomalia local ≠ outlier global. Aqui o que importa é "isto é estranho COMPARADO AO QUE ACONTECEU ANTES E DEPOIS" — captura sazonalidade respeitada e dispara só quando algo realmente sai do padrão local (queda em semana sem feriado, pico em dia comum).',
          do: [
            'Investigue o contexto de cada ponto extremo: campanha, falha, feriado oculto, problema operacional?',
            'Se for falha de coleta, marque o dado como suspeito ou filtre.',
            'Se for real, anote no comentário do componente — vira historiografia útil em revisões.',
            'Considere alertas (futuro): em produção, configure threshold por coluna.'
          ]
        };
      }
      // Fallback genérico
      return {
        what: insight.text,
        why: 'Insight detectado automaticamente pelo Solstice.',
        do: ['Explore o dataset filtrando pelo que parece estranho.', 'Compare com período/categoria similar.', 'Documente sua hipótese antes de testá-la nos dados.']
      };
    }

    function _renderCard(insight){
      const card = SolsticeUtils.el('div', {
        class: 'solstice__insight-card solstice__insight-card--' + insight.severity,
        'data-insight-id': insight.id
      });
      const head = SolsticeUtils.el('div', { style:'display:flex;align-items:flex-start;gap:8px;' });
      head.appendChild(SolsticeUtils.el('div', { class:'solstice__insight-icon' }, insight.icon));
      const titleWrap = SolsticeUtils.el('div', { style:'flex:1;min-width:0;' });
      titleWrap.appendChild(SolsticeUtils.el('div', { class:'solstice__insight-title' }, insight.title));
      titleWrap.appendChild(SolsticeUtils.el('div', { class:'solstice__insight-text' }, insight.text));
      head.appendChild(titleWrap);
      // Camada Polish v3: botão "Entender" expande explicação educativa
      const explainBtn = SolsticeUtils.el('button', {
        class:'solstice__insight-explain-btn',
        type:'button',
        title:'Explicar em linguagem clara o que esse insight significa',
        'aria-label':'Ver explicação'
      }, '💡');
      head.appendChild(explainBtn);
      card.appendChild(head);

      // Seção expandida com explicação (oculta por padrão)
      const expl = _explainKind(insight);
      const explainBox = SolsticeUtils.el('div', { class:'solstice__insight-explain solstice__hidden' });
      explainBox.appendChild(SolsticeUtils.el('div', { class:'solstice__insight-explain-section' },
        SolsticeUtils.el('strong', null, '🔎 O que é: '),
        document.createTextNode(expl.what)
      ));
      explainBox.appendChild(SolsticeUtils.el('div', { class:'solstice__insight-explain-section' },
        SolsticeUtils.el('strong', null, '❓ Por que importa: '),
        document.createTextNode(expl.why)
      ));
      const doList = SolsticeUtils.el('ul', { class:'solstice__insight-explain-do' });
      expl.do.forEach(d => doList.appendChild(SolsticeUtils.el('li', null, d)));
      explainBox.appendChild(SolsticeUtils.el('div', { class:'solstice__insight-explain-section' },
        SolsticeUtils.el('strong', null, '✅ O que fazer:')
      ));
      explainBox.appendChild(doList);
      card.appendChild(explainBox);

      explainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = explainBox.classList.toggle('solstice__hidden');
        explainBtn.classList.toggle('is-active', !isHidden);
        explainBtn.textContent = isHidden ? '💡' : '✕';
      });
      return card;
    }

    /**
     * Renderiza o painel no topo do canvas (acima das sections).
     * Chamado por SolsticeCanvas.render quando insights existem.
     */
    // Auditoria 2026 (U-4): classifica cada `kind` por audiência.
    // - "business": ajuda decisão de negócio (tendência, ranking, etc.)
    // - "technical": qualidade de dado, base e correção (nulos, outliers,
    //                cardinalidade, completeness)
    // Padrão default = "business" — kinds desconhecidos vão pra Negócio.
    const _AUDIENCE_OF_KIND = {
      trend: 'business', recent_change: 'business', pareto: 'business',
      top: 'business', recommend: 'business', kpi_snapshot: 'business',
      anomaly: 'business', composition: 'business', seasonality: 'business',
      yoy: 'business', mom: 'business', impact: 'business',
      // técnico:
      outliers: 'technical', correlation: 'technical',
      completeness: 'technical', cardinality: 'technical',
      distribution: 'technical', monotonic: 'technical',
      duplicates: 'technical', missing: 'technical'
    };
    function _audienceOf(insight){
      if (insight && insight.audience) return insight.audience;
      return _AUDIENCE_OF_KIND[insight && insight.kind] || 'business';
    }

    function renderInto(parentEl){
      if (!parentEl) return;
      // S5-02 (Sprint 5 / Yuki Notion · YT-03): toggle global pra esconder TUDO.
      // Auditoria 2026.6 (INSIGHT-OPCAO): quando oculto, em vez de sumir por
      // completo (deixando o usuário sem como reabilitar — não havia opção em
      // Configurações de fato), mostra uma faixa fina pra reexibir. Resolve o
      // "precisa de opções em algum lugar".
      if (SolsticeStore.get('ui.insights.hidden') === true){
        const restore = SolsticeUtils.el('button', {
          type: 'button',
          class: 'solstice__insights-restore',
          title: 'Reexibir o painel de Insights',
          onclick: () => {
            SolsticeStore.set('ui.insights.hidden', false);
            if (typeof SolsticeCanvas !== 'undefined' && SolsticeCanvas.render) SolsticeCanvas.render();
          }
        }, '💡 Insights ocultos — clique para mostrar');
        parentEl.appendChild(restore);
        return;
      }
      let insights = compute();
      // Sprint 23 / UX-01: usuário pediu pra tirar "O que dá pra construir"
      // do sidebar. Invertendo o default: agora overview fica OCULTO por padrão.
      // User pode reabilitar via setting ui.insights.hideOverview = false.
      // Antes: hideOverview === true → oculta (default false = mostra).
      // Agora: hideOverview !== false → oculta (default ausente = oculta).
      const _hideOverview = SolsticeStore.get('ui.insights.hideOverview');
      if (_hideOverview !== false){
        insights = insights.filter(i => i.id !== 'overview' && i.kind !== 'overview');
      }
      insightsCache = insights;
      if (!insights.length) return; // não renderiza painel quando vazio

      const business = insights.filter(i => _audienceOf(i) === 'business');
      const technical = insights.filter(i => _audienceOf(i) === 'technical');
      // S5-02: default expandido se nunca configurado (antes era expandido também)
      // mas agora respeita o setting persistente
      const isCollapsed = !!SolsticeStore.get('ui.insights.collapsed');
      // Tab ativa (persistido): default Negócio.
      let activeTab = SolsticeStore.get('ui.insights.tab') || 'business';
      if (activeTab === 'business' && business.length === 0 && technical.length > 0) activeTab = 'technical';

      const wrap = SolsticeUtils.el('div', {
        class: 'solstice__insights' + (isCollapsed ? ' is-collapsed' : '')
      });
      const head = SolsticeUtils.el('div', {
        class: 'solstice__insights-head',
        onclick: () => {
          wrap.classList.toggle('is-collapsed');
          SolsticeStore.set('ui.insights.collapsed', wrap.classList.contains('is-collapsed'));
        }
      });
      const titleEl = SolsticeUtils.el('div', { class:'solstice__insights-title' });
      titleEl.appendChild(SolsticeUtils.el('span', null, '💡'));
      titleEl.appendChild(SolsticeUtils.el('span', null, 'Insights'));
      titleEl.appendChild(SolsticeUtils.el('span', { class:'solstice__insights-count' }, String(insights.length)));
      head.appendChild(titleEl);
      const actions = SolsticeUtils.el('div', { class:'solstice__insights-actions' });
      // S5-02 (Sprint 5): botão "esconder esta seção" no header.
      // Click no X interno (não no collapse) → salva ui.insights.hidden=true.
      const hideBtn = SolsticeUtils.el('button', {
        type: 'button',
        title: 'Esconder painel de insights · clique na faixa pra reexibir',
        'aria-label': 'Esconder insights',
        style: 'background:transparent;border:none;color:var(--c-muted);font-size:14px;cursor:pointer;padding:2px 6px;margin-right:4px;border-radius:3px;',
        onclick: (e) => {
          e.stopPropagation();
          SolsticeStore.set('ui.insights.hidden', true);
          // Re-renderiza o canvas (removerá esse painel)
          if (typeof SolsticeCanvas !== 'undefined' && SolsticeCanvas.render) SolsticeCanvas.render();
          SolsticeToast.info('Insights ocultos', 'Clique na faixa "💡 Insights ocultos" pra reexibir.');
        }
      }, '✕');
      hideBtn.addEventListener('mouseenter', () => { hideBtn.style.color = 'var(--c-text)'; hideBtn.style.background = 'var(--c-surface-2)'; });
      hideBtn.addEventListener('mouseleave', () => { hideBtn.style.color = 'var(--c-muted)'; hideBtn.style.background = 'transparent'; });
      actions.appendChild(hideBtn);
      actions.appendChild(SolsticeUtils.el('span', { class:'solstice__insights-toggle' }, '▼'));
      head.appendChild(actions);
      wrap.appendChild(head);

      // Auditoria 2026 (U-4) + BUG4 v4: abas Negócio/Técnico.
      // Auditoria 2026.4: bug — quando o usuário fechava o painel Insights,
      // as abas internas Negócio/Qualidade não fechavam junto, ficavam órfãs
      // visualmente. Causa: style="display:flex" inline sobrescrevia o CSS
      // display:none quando .is-collapsed.
      // Fix: removeu o display:flex inline — agora usa CSS class .solstice__insights-tabs
      // que tem display:flex base + display:none quando .is-collapsed.
      const tabs = SolsticeUtils.el('div', {
        class:'solstice__insights-tabs',
        style:'gap:4px;padding:4px 8px;border-bottom:1px solid var(--c-border);'
      });
      const body = SolsticeUtils.el('div', { class:'solstice__insights-body' });

      // SOL-D7: tabs e body atualizados in-place (sem destruir/reanexar wrap).
      // Antes: onclick fazia `wrap.remove(); renderInto(parent)`, o que reanexava
      // o wrap como último child do parent — se outro filho mudou de altura
      // entre clicks, o painel "saltava" visualmente. Agora só o conteúdo do
      // body troca + estilos das tabs atualizam.
      function _refreshBodyD7(){
        body.innerHTML = '';
        const visible = (activeTab === 'technical') ? technical : business;
        if (!visible.length){
          body.appendChild(SolsticeUtils.el('div', {
            style:'padding:16px;color:var(--c-muted);font-size:12px;text-align:center;'
          }, activeTab === 'business'
              ? 'Sem insights de negócio detectados ainda. Adicione KPIs e gráficos de tendência para alimentar esta aba.'
              : 'Sem insights técnicos. Bom sinal — base de dados parece limpa.'));
        } else {
          visible.forEach(i => body.appendChild(_renderCard(i)));
        }
      }
      function _refreshTabStylesD7(){
        Array.from(tabs.children).forEach(btn => {
          const id = btn.dataset && btn.dataset.tab;
          if (!id) return;
          const isActive = id === activeTab;
          btn.classList.toggle('is-active', isActive);
          btn.style.background = isActive ? 'var(--c-surface-2)' : 'transparent';
          btn.style.borderBottom = '2px solid ' + (isActive ? 'var(--c-accent)' : 'transparent');
        });
      }

      function _makeTab(id, label, count){
        const btn = SolsticeUtils.el('button', {
          type: 'button',
          'data-tab': id,
          class: 'solstice__insights-tab' + (activeTab === id ? ' is-active' : ''),
          style: 'background:' + (activeTab === id ? 'var(--c-surface-2)' : 'transparent') +
                 ';border:none;border-bottom:2px solid ' + (activeTab === id ? 'var(--c-accent)' : 'transparent') +
                 ';padding:6px 10px;cursor:pointer;font-size:12px;color:var(--c-text);',
          onclick: (e) => {
            e.stopPropagation();
            if (activeTab === id) return;
            activeTab = id;
            SolsticeStore.set('ui.insights.tab', id);
            _refreshBodyD7();
            _refreshTabStylesD7();
          }
        });
        btn.appendChild(SolsticeUtils.el('span', null, label));
        btn.appendChild(SolsticeUtils.el('span', {
          style:'margin-left:6px;font-size:10px;color:var(--c-muted);'
        }, '(' + count + ')'));
        return btn;
      }
      tabs.appendChild(_makeTab('business', '📊 Negócio', business.length));
      tabs.appendChild(_makeTab('technical', '🔧 Qualidade/base', technical.length));
      wrap.appendChild(tabs);

      _refreshBodyD7();
      wrap.appendChild(body);
      parentEl.appendChild(wrap);
      containerEl = wrap;
    }

    function list(){ return insightsCache.slice(); }

    function init(){
      // Patch 1A (ADR-112) — debounce 500ms para evitar recompute em rajadas (ex: aplicar dicionário muda múltiplas chaves)
      const rerender = SolsticeUtils.debounce(() => SolsticeCanvas && SolsticeCanvas.render && SolsticeCanvas.render(), 500);
      SolsticeStore.subscribe('ingest', rerender);
      SolsticeStore.subscribe('dictionary', rerender);
    }

    return { compute, renderInto, list, init };
  })();
