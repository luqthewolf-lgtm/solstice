
  const SolsticeNarrative = (function(){
    let currentTone = 'executivo';
    let currentDepth = 'medium';

    /** Frases-base por contexto + tom. */
    const T = {
      // Sumário do componente
      intro: {
        executivo: 'Indicador {friendly} ({agg_label}) atingiu {value} sobre {n_records}.',
        analitico: 'A coluna {friendly} ({agg_label}) atingiu o valor {value} considerando {n_records} válidos (nulos descartados).',
        casual:    'O valor de {friendly} é {value}, calculado a partir de {n_records}.'
      },
      trend_up: {
        executivo: 'Tendência clara de alta nos últimos períodos ({pct}%, R²={r2}).',
        analitico: 'Regressão linear indica tendência ascendente com inclinação positiva (variação total {totalChange}, R²={r2}).',
        casual:    'Está subindo de forma consistente ({pct}%).'
      },
      trend_down: {
        executivo: 'Atenção: tendência consistente de queda ({pct}%).',
        analitico: 'Regressão linear indica tendência descendente (variação total {totalChange}, R²={r2}).',
        casual:    'Está caindo ao longo do período ({pct}%).'
      },
      trend_flat: {
        executivo: 'Indicador estável no período.',
        analitico: 'A série é aproximadamente estacionária (magnitude < 2% da média).',
        casual:    'Sem grandes mudanças no período.'
      },
      outliers_present: {
        executivo: 'Identificados {n} valores fora do padrão ({pct}% do total) — investigar.',
        analitico: 'Detecção de outliers via IQR 1.5×: {n} pontos fora de [{lo}, {hi}], {pct}% do total.',
        casual:    'Tem {n} valores bem fora do normal ({pct}%).'
      },
      directional_good: {
        executivo: 'Movimento favorável dado o objetivo (maior é melhor).',
        analitico: 'A direção do movimento está alinhada com higherIsBetter=true do dicionário.',
        casual:    'Boa notícia — quanto mais, melhor!'
      },
      directional_bad: {
        executivo: 'Movimento desfavorável dado o objetivo.',
        analitico: 'A direção do movimento contraria higherIsBetter do dicionário.',
        casual:    'Atenção — esse indicador deveria estar indo no sentido oposto.'
      },
      comparison: {
        executivo: 'Variação vs {baseline_label}: {delta}.',
        analitico: 'Delta em relação a {baseline_label} = {delta} ({baseline_value} → {value}).',
        casual:    'Comparado com {baseline_label}: {delta}.'
      }
    };

    function _phrase(key, vars){
      const tplGroup = T[key];
      if (!tplGroup) return '';
      const tpl = tplGroup[currentTone] || tplGroup.executivo;
      return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? String(vars[k]) : '');
    }

    /** Helper de tradução agg → label pt-BR via Humanize (já existe). */
    function _aggLabel(agg){ return SolsticeHumanize.aggregation(agg) || agg; }

    /**
     * Gera narrativa para slot. Retorna string com parágrafos separados por \n\n.
     */
    function build(slotId){
      const sec = SolsticeStore.get('canvas.sections') || [];
      let slot = null;
      for (const s of sec) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slotId);
        if (sl){ slot = sl; break; }
      }
      if (!slot) return 'Componente não encontrado.';
      const def = SolsticeComponents.get(slot.type);
      if (!def) return 'Tipo de componente desconhecido.';
      if (slot.type === 'markdown') return 'Markdown não possui narrativa estatística — é um componente puramente textual.';

      const ingest = SolsticeStore.get('ingest');
      const dict = SolsticeStore.get('dictionary');
      const rows = (ingest && ingest.rows) || [];
      const cfg = slot.config || {};

      // Resolve coluna primária e agg
      let col, agg;
      if (def.id === 'kpi'){ col = cfg.column; agg = cfg.agg || 'sum'; }
      else if (def.id === 'distribution') { col = cfg.column; agg = 'count'; }
      else if (def.id === 'gauge') { col = cfg.column; agg = cfg.agg || 'avg'; }
      else if (def.id === 'time-series') { col = cfg.yColumn; agg = 'sum'; }
      else if (def.id === 'scatter') { col = cfg.yColumn; agg = 'avg'; }
      else if (def.id === 'boxplot') { col = cfg.valueColumn; agg = 'median'; }
      else if (def.id === 'heatmap-cal') { col = cfg.valueColumn || null; agg = cfg.agg || 'sum'; }
      else if (def.id === 'sankey') { col = cfg.valueColumn; agg = 'sum'; }
      if (!col){ return 'Configure ao menos uma coluna numérica para gerar narrativa.'; }
      const values = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
      if (!values.length) return 'Sem valores válidos para gerar narrativa.';

      const dictCol = dict && dict.columns && dict.columns[col];
      const friendly = SolsticeHumanize.column(col, dict);
      const higherIsBetter = dictCol && dictCol.higherIsBetter;

      // Computa valor agregado
      let value;
      if (agg === 'sum')        value = SolsticeStats.sum(values);
      else if (agg === 'avg' || agg === 'mean') value = SolsticeStats.mean(values);
      else if (agg === 'median')value = SolsticeStats.median(values);
      else if (agg === 'min')   value = SolsticeStats.min(values);
      else if (agg === 'max')   value = SolsticeStats.max(values);
      else if (agg === 'count') value = SolsticeStats.count(values);
      else                       value = SolsticeStats.sum(values);

      const typeDef = SolsticeTypes.getType((ingest.types || {})[col] && ingest.types[col].type);
      const formatted = typeDef && typeDef.format
        ? (function(){ try { return typeDef.format(value, SolsticeLocale); } catch(e){ return SolsticeLocale.decimal(value, 2); }})()
        : SolsticeLocale.decimal(value, 2);

      const paragraphs = [];

      // Parágrafo 1: introdução
      paragraphs.push(_phrase('intro', {
        friendly, agg_label: _aggLabel(agg),
        value: formatted,
        n_records: SolsticeHumanize.recordCount(values.length)
      }));

      // Parágrafo 2: tendência (se aplicável)
      if (currentDepth !== 'short'){
        const t = SolsticeStats.trend(values);
        if (t){
          const key = t.direction === 'up' ? 'trend_up' : t.direction === 'down' ? 'trend_down' : 'trend_flat';
          const sentence = _phrase(key, {
            pct: SolsticeLocale.decimal(t.magnitude * 100, 1),
            r2: t.r2 != null ? SolsticeLocale.decimal(t.r2, 2) : '—',
            totalChange: SolsticeLocale.decimal(t.totalChange, 1)
          });
          paragraphs.push(sentence);
          // Direcional se higherIsBetter conhecido
          if (higherIsBetter === true && t.direction === 'up') paragraphs.push(_phrase('directional_good', {}));
          else if (higherIsBetter === false && t.direction === 'up') paragraphs.push(_phrase('directional_bad', {}));
          else if (higherIsBetter === true && t.direction === 'down') paragraphs.push(_phrase('directional_bad', {}));
          else if (higherIsBetter === false && t.direction === 'down') paragraphs.push(_phrase('directional_good', {}));
        }
      }

      // Parágrafo 3: outliers (se long)
      if (currentDepth === 'long'){
        const ou = SolsticeStats.outliersIQR(values, 1.5);
        if (ou.values.length > 0){
          paragraphs.push(_phrase('outliers_present', {
            n: ou.values.length,
            pct: SolsticeLocale.decimal(ou.values.length / values.length * 100, 1),
            lo: SolsticeLocale.decimal(ou.fences.lo, 1),
            hi: SolsticeLocale.decimal(ou.fences.hi, 1)
          }));
        }
      }

      // Parágrafo 4: comparação (KPI com config.comparison)
      if (def.id === 'kpi' && cfg.comparison && cfg.comparison.type !== 'none'){
        const ci = SolsticeKPI.calculateDelta(values, cfg);
        if (ci){
          const deltaInfo = SolsticeHumanize.delta(ci.pct, higherIsBetter, ci.baselineLabel);
          paragraphs.push(_phrase('comparison', {
            baseline_label: ci.baselineLabel || 'baseline',
            delta: deltaInfo.text,
            baseline_value: SolsticeLocale.decimal(ci.baseline, 1),
            value: formatted
          }));
        }
      }

      return paragraphs.filter(Boolean).join('\n\n');
    }

    function setTone(tone){ if (['executivo', 'analitico', 'casual'].includes(tone)) currentTone = tone; }
    function setDepth(d){ if (['short', 'medium', 'long'].includes(d)) currentDepth = d; }
    function getTone(){ return currentTone; }
    function getDepth(){ return currentDepth; }

    /**
     * Abre modal com narrativa do slot. Permite trocar tom/profundidade
     * ao vivo, copiar para clipboard, baixar markdown ou abrir email.
     */
    async function openModal(slotId){
      let text = '';
      function refresh(bodyEl){
        text = build(slotId);
        bodyEl.textContent = text;
      }

      await SolsticeModal.show({
        title: '📖 Narrativa automática',
        size: 'lg',
        body: (close) => {
          const wrap = SolsticeUtils.el('div');

          // Controls
          const ctrl = SolsticeUtils.el('div', { class:'solstice__narrative-controls' });
          ctrl.appendChild(SolsticeUtils.el('span', { class:'solstice__narrative-label' }, 'Tom:'));
          const tones = [['executivo','👔 Executivo'], ['analitico','🔬 Analítico'], ['casual','💬 Casual']];
          tones.forEach(([v, label]) => {
            const pill = SolsticeUtils.el('span',
              { class:'solstice__narrative-pill' + (currentTone === v ? ' is-active' : ''),
                onclick: () => { setTone(v); refresh(body); ctrl.querySelectorAll('.solstice__narrative-pill').forEach(p => p.dataset.kind === 'tone' && p.classList.toggle('is-active', p.dataset.value === v)); },
                'data-kind': 'tone', 'data-value': v }, label);
            ctrl.appendChild(pill);
          });
          ctrl.appendChild(SolsticeUtils.el('span', { class:'solstice__narrative-label' }, 'Profundidade:'));
          const depths = [['short', '📄 Curta'], ['medium','📑 Média'], ['long','📚 Longa']];
          depths.forEach(([v, label]) => {
            const pill = SolsticeUtils.el('span',
              { class:'solstice__narrative-pill' + (currentDepth === v ? ' is-active' : ''),
                onclick: () => { setDepth(v); refresh(body); ctrl.querySelectorAll('.solstice__narrative-pill').forEach(p => p.dataset.kind === 'depth' && p.classList.toggle('is-active', p.dataset.value === v)); },
                'data-kind': 'depth', 'data-value': v }, label);
            ctrl.appendChild(pill);
          });
          wrap.appendChild(ctrl);

          // Body
          const body = SolsticeUtils.el('div', { class:'solstice__narrative-body' });
          refresh(body);
          wrap.appendChild(body);
          return wrap;
        },
        footer: (close) => [
          SolsticeUtils.el('button', {
            class:'solstice__btn',
            onclick: async () => {
              try { await navigator.clipboard.writeText(text); SolsticeToast.success('Copiado', 'Narrativa no clipboard'); }
              catch(e){ SolsticeToast.warn('Falhou', 'Use Ctrl+A → Ctrl+C manualmente.'); }
            }
          }, '📋 Copiar'),
          SolsticeUtils.el('button', {
            class:'solstice__btn',
            onclick: () => {
              const blob = new Blob([text], { type: 'text/markdown' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'narrativa-solstice-' + Date.now() + '.md';
              a.click();
              URL.revokeObjectURL(a.href);
            }
          }, '⬇️ Markdown'),
          SolsticeUtils.el('button', {
            class:'solstice__btn',
            onclick: () => {
              const subj = encodeURIComponent('Narrativa Solstice');
              const bod = encodeURIComponent(text);
              window.open('mailto:?subject=' + subj + '&body=' + bod);
            }
          }, '✉️ Email'),
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Fechar')
        ]
      });
    }

    /**
     * Patch Corretivo (ADR-156): Resumo Executivo v2 com 5 seções estruturadas.
     * Período · Destaques + · Alertas · Visão geral · Recomendações · Anomalias.
     */
    function buildDashboardSummary(){
      const ingest = SolsticeStore.get('ingest') || {};
      const dict = SolsticeStore.get('dictionary');
      const rows = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.apply(ingest.rows || []) : (ingest.rows || []);
      const sections = SolsticeStore.get('canvas.sections') || [];
      const datasetName = SolsticeStore.get('dataset.name') || 'dataset';
      const lines = [];

      function _collect(type){
        const out = [];
        for (const sec of sections) for (const r of sec.rows) for (const sl of r.slots){
          if (sl.type === type) out.push(sl);
        }
        return out;
      }
      function _f(col){ return (dict && dict.columns && dict.columns[col] && dict.columns[col].friendlyName) || col; }
      function _v(val, col){
        const meta = dict && dict.columns && dict.columns[col];
        const unit = meta && meta.unit;
        if (val == null || isNaN(val)) return '—';
        let s;
        try { s = Number(val).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); } catch(e){ s = String(val); }
        if (unit === 'BRL' || unit === 'currency') return 'R$ ' + s;
        if (unit === 'pct' || unit === '%') return s + '%';
        return s;
      }

      // === HEADER ===
      const headerTitle = (SolsticeStore.get('canvas.header') && SolsticeStore.get('canvas.header.title')) || 'Análise';
      lines.push('# Resumo Executivo · ' + datasetName);
      lines.push('');
      lines.push('**Dashboard:** ' + headerTitle);
      lines.push('**Gerado em:** ' + new Date().toLocaleString('pt-BR'));
      lines.push('');

      // === FILTROS APLICADOS (Camada 1 polish v5) ===
      // Deixa EXPLÍCITO que a narrativa considera os filtros atuais.
      const activeFilters = SolsticeStore.get('filters') || {};
      const filterEntries = Object.entries(activeFilters).filter(([_, v]) => {
        if (Array.isArray(v)) return v.length > 0;
        if (v && typeof v === 'object') return v.min != null || v.max != null || v.from || v.to;
        return false;
      });
      const crossFilter = SolsticeStore.get('crossfilter');
      if (filterEntries.length || (crossFilter && crossFilter.column)){
        lines.push('## 🔍 Filtros aplicados');
        filterEntries.forEach(([col, val]) => {
          const friendly = _f(col);
          if (Array.isArray(val)){
            lines.push('- **' + friendly + '** = ' + val.slice(0, 5).join(', ') + (val.length > 5 ? ' (+' + (val.length - 5) + ')' : ''));
          } else if (val.min != null || val.max != null){
            lines.push('- **' + friendly + '** entre ' + _v(val.min, col) + ' e ' + _v(val.max, col));
          } else if (val.from || val.to){
            lines.push('- **' + friendly + '** período ' + (val.from || '?') + ' → ' + (val.to || '?'));
          }
        });
        if (crossFilter && crossFilter.column){
          lines.push('- 🎯 **Cross-filter:** ' + _f(crossFilter.column) + ' = ' + crossFilter.value);
        }
        lines.push('');
        lines.push('_Os números abaixo refletem APENAS estas linhas filtradas (' + rows.length.toLocaleString('pt-BR') + ' de ' + (ingest.rows || []).length.toLocaleString('pt-BR') + ')._');
        lines.push('');
      }

      // Auditoria 2026 (U-11): seção "Período analisado" REMOVIDA daqui.
      // Já é mostrada na status bar do app (rodapé) — redundante no
      // resumo executivo. A informação está exposta no contexto certo,
      // não precisa ser repetida em texto de negócio.

      // === Coleta KPIs com analytics ===
      // Sprint 36 / EV-COMP-12: bug crítico — Narrativa Automática mostrava
      // placeholder "Adicione KPIs..." mesmo com 4 KPIs aplicados. Causa:
      // `SolsticeStats.parseNum(r[col])` falha em colunas BR ("R$ 1.234,56"), values=[],
      // kpiAnalytics=[], cai no fallback. Migrado pra SolsticeStats.parseNum
      // (J-1, Sprint 33). Também coleta 'bignum' (que conta como KPI).
      const kpis = _collect('kpi').concat(_collect('bignum'));
      const kpiAnalytics = kpis.map(k => {
        const col = k.config && k.config.column;
        if (!col) return null;
        const agg = (k.config && k.config.agg) || 'sum';
        const values = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
        if (!values.length) return null;
        const val = SolsticeStats[agg] ? SolsticeStats[agg](values) : SolsticeStats.sum(values);
        const trend = SolsticeStats.trend(values) || { direction:'flat', magnitude:0 };
        const meta = (dict && dict.columns && dict.columns[col]) || {};
        const hib = meta.higherIsBetter;
        // Score: |magnitude| × (1 if hib aligned else -1)
        let score = (trend.magnitude || 0);
        let isPositive = null;
        if (hib === true && trend.direction === 'up') isPositive = true;
        else if (hib === true && trend.direction === 'down') isPositive = false;
        else if (hib === false && trend.direction === 'down') isPositive = true;
        else if (hib === false && trend.direction === 'up') isPositive = false;
        return { col, agg, val, trend, meta, isPositive, score, friendly: _f(col) };
      }).filter(Boolean);

      // === 🏆 DESTAQUES POSITIVOS (top 3) ===
      const positives = kpiAnalytics.filter(k => k.isPositive === true && Math.abs(k.trend.magnitude) > 0.02)
        .sort((a, b) => Math.abs(b.trend.magnitude) - Math.abs(a.trend.magnitude))
        .slice(0, 3);
      if (positives.length){
        lines.push('## 🏆 Destaques positivos');
        positives.forEach((p, i) => {
          const arrow = p.trend.direction === 'up' ? '↑' : '↓';
          lines.push((i+1) + '. **' + p.friendly + '** ' + arrow + ' ' + (Math.abs(p.trend.magnitude)*100).toFixed(1) + '% — atual ' + _v(p.val, p.col) + (p.meta.higherIsBetter ? ' (maior é melhor)' : ' (menor é melhor)'));
        });
        lines.push('');
      }

      // === ⚠️ ALERTAS (top 3) ===
      const alerts = kpiAnalytics.filter(k => k.isPositive === false && Math.abs(k.trend.magnitude) > 0.02)
        .sort((a, b) => Math.abs(b.trend.magnitude) - Math.abs(a.trend.magnitude))
        .slice(0, 3);
      if (alerts.length){
        lines.push('## ⚠️ Alertas');
        alerts.forEach((a, i) => {
          const arrow = a.trend.direction === 'up' ? '↑' : '↓';
          lines.push((i+1) + '. **' + a.friendly + '** ' + arrow + ' ' + (Math.abs(a.trend.magnitude)*100).toFixed(1) + '% — atual ' + _v(a.val, a.col) + ' (direção desfavorável)');
        });
        lines.push('');
      }

      // Auditoria 2026 (U-11): seção "📊 Visão geral" REMOVIDA daqui.
      // O usuário já tem a tabela do dataset na sidebar Dados e os KPIs
      // visíveis no canvas. Repetir em texto ASCII no resumo executivo é
      // redundância. Os destaques positivos/alertas (acima) já contam a
      // história importante; quem quer o detalhe abre o canvas/Editor.

      // === 🎯 RECOMENDAÇÕES acionáveis ===
      const recs = [];
      alerts.forEach(a => {
        const verb = a.meta.higherIsBetter ? 'Investigar causa da queda em' : 'Conter alta em';
        recs.push(verb + ' **' + a.friendly + '** — atual ' + _v(a.val, a.col) + '; variação ' + (Math.abs(a.trend.magnitude)*100).toFixed(1) + '%');
      });
      // Outliers como recomendação acionável
      kpiAnalytics.forEach(k => {
        const values = rows.map(r => SolsticeStats.parseNum(r[k.col])).filter(v => !isNaN(v));
        const outs = (SolsticeStats.outliersIQR(values).indices || []).length;  // OUTLIER-SHAPE 2026.6
        if (outs > values.length * 0.05){
          recs.push('Revisar registros anormais em **' + k.friendly + '** — ' + outs + ' outliers (' + (outs/values.length*100).toFixed(0) + '%)');
        }
      });
      if (recs.length){
        lines.push('## 🎯 Recomendações');
        recs.slice(0, 5).forEach(r => lines.push('- ' + r));
        lines.push('');
      }

      // === 🔍 ANOMALIAS detectadas ===
      const anomalies = [];
      kpiAnalytics.forEach(k => {
        const values = rows.map(r => SolsticeStats.parseNum(r[k.col])).filter(v => !isNaN(v));
        const outs = SolsticeStats.outliersIQR(values).indices || [];  // OUTLIER-SHAPE 2026.6
        if (outs.length > values.length * 0.03){
          const pct = (outs.length/values.length*100).toFixed(0);
          anomalies.push('**' + k.friendly + '**: ' + outs.length + ' outliers (' + pct + '%) — valores extremos podem distorcer média');
        }
      });
      if (anomalies.length){
        lines.push('## 🔍 Anomalias detectadas');
        anomalies.forEach(a => lines.push('- ' + a));
        lines.push('');
      }

      // Sprint 36 / EV-COMP-12: fallback mais informativo — distingue
      // "sem KPI no dashboard" de "KPIs sem coluna configurada"
      if (!kpiAnalytics.length){
        if (!kpis.length){
          lines.push('_Sem KPI Cards ou BigNum no dashboard. Adicione pelo menos um para ver destaques/alertas no resumo._');
        } else {
          lines.push('_Há ' + kpis.length + ' KPI(s) no dashboard, mas nenhum tem coluna numérica configurada. Selecione cada KPI e escolha uma coluna em ⚙️ Configurar._');
        }
      }

      // Auditoria 2026 (M-N-1 / A-707): leitura cruzada entre métricas.
      // Quando há ≥2 KPIs com tendência clara, calcula correlação local
      // (Pearson) e acrescenta parágrafo de "Como as métricas se movem
      // juntas". Sem LLM externo. Disclaimer obrigatório (≠ causalidade).
      const measurableCols = kpiAnalytics
        .filter(k => k.trend && Math.abs(k.trend.magnitude) > 0.02)
        .slice(0, 5)
        .map(k => k.col);
      if (measurableCols.length >= 2 && typeof SolsticeStats !== 'undefined' && SolsticeStats.correlation){
        const correlations = [];
        for (let i = 0; i < measurableCols.length; i++){
          for (let j = i + 1; j < measurableCols.length; j++){
            const a = measurableCols[i], b = measurableCols[j];
            const xs = [], ys = [];
            for (const r of rows){
              const x = SolsticeStats.parseNum(r[a]); const y = SolsticeStats.parseNum(r[b]);
              if (!isNaN(x) && !isNaN(y)){ xs.push(x); ys.push(y); }
            }
            if (xs.length < 20) continue;
            const r = SolsticeStats.correlation(xs, ys);
            if (r != null && !isNaN(r) && Math.abs(r) >= 0.5){
              correlations.push({ a, b, r });
            }
          }
        }
        if (correlations.length){
          lines.push('## 🔗 Como as métricas se movem juntas');
          correlations.slice(0, 3).forEach(c => {
            const dir = c.r > 0 ? 'juntas (positiva)' : 'em oposição (negativa)';
            const intensity = Math.abs(c.r) >= 0.8 ? 'muito forte' : Math.abs(c.r) >= 0.7 ? 'forte' : 'moderada';
            lines.push('- **' + _f(c.a) + '** e **' + _f(c.b) + '** se movem ' + dir + ' (r=' + c.r.toFixed(2) + ', ' + intensity + ').');
          });
          lines.push('');
          lines.push('_Correlação não é causalidade — investigue o mecanismo antes de concluir._');
          lines.push('');
        }
      }

      return lines.join('\n');
    }

    /**
     * Patch 1B (ADR-124): modal mostrando o resumo executivo.
     */
    function openDashboardSummary(){
      const text = buildDashboardSummary();
      const html = SolsticeUtils.el('pre', {
        style:'white-space:pre-wrap;font-family:var(--font-mono);font-size:11.5px;line-height:1.55;max-height:60vh;overflow:auto;padding:12px;background:var(--c-surface-2);border-radius:8px;'
      }, text);
      const body = SolsticeUtils.el('div'); body.appendChild(html);
      let close;
      SolsticeModal.show({
        title: '📖 Resumo Executivo',
        body,
        buttons: [
          { label:'📋 Copiar', kind:'ghost', onClick: () => {
            try { navigator.clipboard.writeText(text); SolsticeToast.success('Copiado para área de transferência'); }
            catch(e){ SolsticeToast.error('Falha ao copiar'); }
            return false;
          }},
          { label:'⬇️ Baixar .md', kind:'ghost', onClick: () => {
            const blob = new Blob([text], { type:'text/markdown' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'resumo-executivo-' + Date.now() + '.md';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 200);
            return false;
          }},
          { label:'✉️ Email', kind:'ghost', onClick: () => {
            const subj = encodeURIComponent('Resumo Executivo · Solstice');
            const bod  = encodeURIComponent(text);
            window.open('mailto:?subject=' + subj + '&body=' + bod);
            return false;
          }},
          { label:'Fechar', kind:'primary', onClick: () => true }
        ]
      });
    }

    /**
     * Sprint 26 / F-23: painel inline persistente do Resumo Executivo.
     * Renderiza um accordion no topo do canvas (acima das seções) com o texto
     * do buildDashboardSummary. Estado aberto/fechado persiste em
     * Store.ui.execSummary.collapsed (default = aberto na 1ª vez).
     */
    function renderSummaryInto(canvasEl){
      if (!canvasEl) return;
      // Só renderiza se há sections + dataset
      const sections = SolsticeStore.get('canvas.sections') || [];
      const dsReady = SolsticeStore.get('dataset.ready');
      if (!sections.length || !dsReady) return;
      const text = (function(){
        try { return buildDashboardSummary(); } catch(_){ return ''; }
      })();
      if (!text || text.length < 30) return; // não renderiza se vazio/curto

      const isCollapsed = SolsticeStore.get('ui.execSummary.collapsed') === true;
      const wrap = SolsticeUtils.el('div', {
        class: 'solstice__exec-summary' + (isCollapsed ? ' is-collapsed' : ''),
        style: 'background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--rad-md);margin:var(--sp-3) var(--sp-4) var(--sp-3);overflow:hidden;'
      });
      const head = SolsticeUtils.el('div', {
        style: 'display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;font-size:12px;font-weight:600;color:var(--c-text);user-select:none;background:var(--c-surface-3);',
        onclick: () => {
          const next = !wrap.classList.contains('is-collapsed');
          wrap.classList.toggle('is-collapsed', next);
          SolsticeStore.set('ui.execSummary.collapsed', next);
          body.style.display = next ? 'none' : '';
        }
      });
      head.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true' }, '📖'));
      head.appendChild(SolsticeUtils.el('span', { style:'flex:1;' }, 'Resumo executivo'));
      head.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--ghost',
        style:'font-size:11px;padding:2px 8px;',
        title:'Copiar texto pra área de transferência',
        onclick: (e) => {
          e.stopPropagation();
          try { navigator.clipboard.writeText(text); SolsticeToast.success('Copiado'); }
          catch(_){ SolsticeToast.error('Falha ao copiar'); }
        }
      }, '📋 Copiar'));
      head.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-muted);font-size:10px;' }, isCollapsed ? '▶' : '▼'));
      wrap.appendChild(head);
      const body = SolsticeUtils.el('pre', {
        style: 'white-space:pre-wrap;font-family:var(--font-mono);font-size:11.5px;line-height:1.55;padding:14px 18px;color:var(--c-text);max-height:300px;overflow:auto;margin:0;' +
               (isCollapsed ? 'display:none;' : '')
      }, text);
      wrap.appendChild(body);
      canvasEl.appendChild(wrap);
    }

    return { build, openModal, setTone, setDepth, getTone, getDepth, buildDashboardSummary, openDashboardSummary, renderSummaryInto, _T: T };
  })();
