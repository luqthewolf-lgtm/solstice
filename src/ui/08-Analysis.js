
  /* ============================================================
     B7-r2 — SolsticeAnalysis (ADR-065)
     Drawer inferior com análise estatística do componente selecionado.
     Acionado pelo botão 📈 no header da casca do componente.
     Conteúdo idêntico ao que a aba "📈 Análise" tinha antes (B7), só
     que agora em grid de cards (220px min) em vez de lista vertical.
     ============================================================ */
  const SolsticeAnalysis = (function(){
    let currentSlotId = null;
    const app    = () => document.querySelector('.solstice__app');
    const title  = () => document.getElementById('analysis-title');
    const meta   = () => document.getElementById('analysis-meta');
    const body   = () => document.getElementById('analysis-body');
    const foot   = () => document.getElementById('analysis-footer');

    function open(slotId){
      // ADR-160 (Onda 1 / T8a): "open-one-closes-other" — Analysis fecha
      // Inspector SEMPRE (não só em viewport estreito). Match com macro-ação
      // da persona P5 Camila no briefing v5.4: "5 zonas competindo por atenção".
      if (SolsticeInspector && SolsticeInspector.isOpen && SolsticeInspector.isOpen()){
        SolsticeInspector.close();
      }
      const wasOpen = !!SolsticeStore.get('ui.analysis.open');
      const switching = wasOpen && currentSlotId !== slotId;
      const b = body();
      // Patch 1A: fade 200ms ao trocar conteúdo (só quando já aberto e mudando de componente)
      if (switching && b){
        b.style.transition = 'opacity 200ms ease';
        b.style.opacity = '0';
        setTimeout(() => {
          currentSlotId = slotId;
          render(slotId);
          b.style.opacity = '1';
          // Limpa transition depois para não afetar outros estilos
          setTimeout(() => { b.style.transition = ''; }, 220);
        }, 200);
      } else {
        currentSlotId = slotId;
        render(slotId);
      }
      const a = app(); if (a) a.classList.add('has-analysis');
      SolsticeStore.set('ui.analysis.open', true);
      SolsticeStore.set('ui.analysis.slotId', slotId);
    }
    function close(){
      const a = app(); if (a) a.classList.remove('has-analysis');
      const b = body(); if (b) b.innerHTML = '';
      const f = foot(); if (f) f.innerHTML = '';
      currentSlotId = null;
      SolsticeStore.set('ui.analysis.open', false);
      SolsticeStore.set('ui.analysis.slotId', null);
    }
    function toggle(slotId){
      if (currentSlotId === slotId && SolsticeStore.get('ui.analysis.open')){
        close();
      } else {
        open(slotId);
      }
    }
    function isOpen(){
      return !!SolsticeStore.get('ui.analysis.open');
    }
    function getCurrentSlotId(){ return currentSlotId; }

    /**
     * Resolve a coluna numérica primária para o componente — mesma lógica
     * do antigo _renderStatsTab (B7), reaproveitada.
     */
    function _primaryCol(slot, def){
      const cfg = slot.config || {};
      if (def.id === 'kpi' || def.id === 'distribution' || def.id === 'gauge') return cfg.column;
      if (def.id === 'time-series' || def.id === 'scatter') return cfg.yColumn;
      if (def.id === 'boxplot') return cfg.valueColumn;
      if (def.id === 'heatmap-cal') return cfg.valueColumn;
      if (def.id === 'sankey') return cfg.valueColumn;
      return null;
    }

    function _ctxFor(){
      const ingest = SolsticeStore.get('ingest');
      return {
        rows: (ingest && ingest.rows) || [],
        columns: (ingest && ingest.columns) || [],
        types: (ingest && ingest.types) || {},
        dictionary: SolsticeStore.get('dictionary'),
        L: SolsticeLocale
      };
    }

    function render(slotId){
      const b = body(); const t = title(); const m = meta(); const f = foot();
      if (!b || !t) return;
      b.innerHTML = ''; if (f) f.innerHTML = ''; if (m) m.textContent = '';

      // Localiza slot
      const sec = SolsticeStore.get('canvas.sections') || [];
      let slot = null;
      for (const s of sec) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slotId);
        if (sl){ slot = sl; break; }
      }
      if (!slot){
        b.appendChild(SolsticeUtils.el('div', { class:'solstice__analysis-explain' },
          'Componente não encontrado.'));
        return;
      }
      const def = SolsticeComponents.get(slot.type);
      if (!def){
        b.appendChild(SolsticeUtils.el('div', { class:'solstice__analysis-explain' },
          'Tipo de componente desconhecido: ' + slot.type));
        return;
      }
      if (slot.type === 'markdown'){
        b.appendChild(SolsticeUtils.el('div', { class:'solstice__analysis-explain' },
          'Markdown não tem análise estatística — é um componente puramente textual.'));
        return;
      }

      const ctx = _ctxFor();
      const col = _primaryCol(slot, def);
      if (!col){
        b.appendChild(SolsticeUtils.el('div', { class:'solstice__analysis-explain' },
          'Configure ao menos uma coluna numérica em ⚙️ Propriedades para ver a análise.'));
        return;
      }
      const allValues = (ctx.rows || []).map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
      if (!allValues.length){
        b.appendChild(SolsticeUtils.el('div', { class:'solstice__analysis-explain' },
          'Sem valores numéricos válidos em "' + SolsticeHumanize.column(col, ctx.dictionary) + '".'));
        return;
      }

      // === Amostragem aleatória (v5.4) ===
      // Estado persistente no Store por slot — usuário pode trabalhar com
      // amostra ao analisar dataset grande. Seed reproduzível garante mesma
      // amostra entre reloads/comparações.
      const sampleStateKey = 'ui.analysis.sample.' + slotId;
      let sampleState = SolsticeStore.get(sampleStateKey) || { enabled: false, k: Math.min(1000, allValues.length), seed: 42 };
      // Default seed (42, clássico) garante reprodutibilidade. Pode ser regenerada.
      let values;
      let sampleInfo = null;
      if (sampleState.enabled && allValues.length > sampleState.k){
        const r = SolsticeStats.randomSample(allValues, sampleState.k, { seed: sampleState.seed });
        values = r.sample;
        sampleInfo = { n: r.n, k: r.k, seed: r.seed };
      } else {
        values = allValues;
      }

      const desc = SolsticeStats.describe(values);

      // Atualiza meta do header
      if (m) m.textContent = '· ' + SolsticeHumanize.column(col, ctx.dictionary)
        + (sampleInfo ? ' · 🎲 amostra ' + sampleInfo.k + '/' + sampleInfo.n : '');

      function fmt(v, digits){
        if (v == null || isNaN(v)) return '—';
        return ctx.L.decimal(v, digits == null ? 2 : digits);
      }
      function row(label, value, hint){
        const r = SolsticeUtils.el('div', { class:'solstice__stats-row' });
        r.appendChild(SolsticeUtils.el('div', { class:'solstice__stats-label', title: hint || '' }, label));
        r.appendChild(SolsticeUtils.el('div', { class:'solstice__stats-value' }, value));
        return r;
      }
      function card(title){
        const c = SolsticeUtils.el('div', { class:'solstice__analysis-card' });
        c.appendChild(SolsticeUtils.el('div', { class:'solstice__analysis-card-title' }, title));
        return c;
      }

      // === BLOCO Amostragem (sempre visível, span total do grid) ===
      const samplingBox = SolsticeUtils.el('div', {
        class: 'solstice__analysis-sampling',
        style: 'grid-column: 1 / -1; padding: 8px 12px; background: var(--c-surface-2); border: 1px solid var(--c-border); border-radius: var(--rad-sm); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 12px;'
      });
      // Toggle on/off
      const toggleLab = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:var(--fw-semibold);' });
      const toggleInp = SolsticeUtils.el('input', { type:'checkbox' });
      if (sampleState.enabled) toggleInp.checked = true;
      toggleInp.addEventListener('change', e => {
        sampleState = { ...sampleState, enabled: !!e.target.checked };
        SolsticeStore.set(sampleStateKey, sampleState);
        render(slotId);
      });
      toggleLab.appendChild(toggleInp);
      toggleLab.appendChild(SolsticeUtils.el('span', null, '🎲 Amostragem aleatória'));
      samplingBox.appendChild(toggleLab);

      // Input N (linhas)
      const kLab = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;color:var(--c-text-2);' });
      kLab.appendChild(SolsticeUtils.el('span', null, 'N ='));
      const kInp = SolsticeUtils.el('input', {
        type:'number', min:'10', max: String(allValues.length), step:'10',
        value: String(Math.min(sampleState.k, allValues.length)),
        style:'width:90px;padding:3px 6px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:11px;font-family:var(--font-mono);'
      });
      kInp.addEventListener('change', e => {
        const v = parseInt(e.target.value, 10);
        if (isNaN(v) || v < 10) return;
        sampleState = { ...sampleState, k: Math.min(v, allValues.length) };
        SolsticeStore.set(sampleStateKey, sampleState);
        if (sampleState.enabled) render(slotId);
      });
      if (!sampleState.enabled){ kInp.disabled = true; kInp.style.opacity = '0.5'; }
      kLab.appendChild(kInp);
      kLab.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-muted);font-size:10px;' }, 'de ' + allValues.length));
      samplingBox.appendChild(kLab);

      // Input seed
      const seedLab = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;color:var(--c-text-2);' });
      seedLab.appendChild(SolsticeUtils.el('span', null, 'seed:'));
      const seedInp = SolsticeUtils.el('input', {
        type:'number', value: String(sampleState.seed),
        style:'width:80px;padding:3px 6px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:11px;font-family:var(--font-mono);'
      });
      seedInp.addEventListener('change', e => {
        const v = parseInt(e.target.value, 10);
        if (isNaN(v)) return;
        sampleState = { ...sampleState, seed: v };
        SolsticeStore.set(sampleStateKey, sampleState);
        if (sampleState.enabled) render(slotId);
      });
      if (!sampleState.enabled){ seedInp.disabled = true; seedInp.style.opacity = '0.5'; }
      seedLab.appendChild(seedInp);
      samplingBox.appendChild(seedLab);

      // Botão "Resemear" (gera seed novo)
      const reseedBtn = SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--ghost',
        style:'font-size:11px;padding:3px 8px;' + (sampleState.enabled ? '' : 'opacity:0.5;cursor:not-allowed;'),
        title:'Gera nova seed aleatória (cada clique = amostra diferente)',
        onclick: () => {
          if (!sampleState.enabled) return;
          sampleState = { ...sampleState, seed: Math.floor(Math.random() * 1000000) };
          SolsticeStore.set(sampleStateKey, sampleState);
          render(slotId);
        }
      }, '🎲 Nova seed');
      samplingBox.appendChild(reseedBtn);

      // Audit log button
      if (sampleInfo){
        samplingBox.appendChild(SolsticeUtils.el('span', {
          style:'margin-left:auto;font-size:10px;color:var(--c-muted);font-style:italic;'
        }, 'Amostra de ' + sampleInfo.k + '/' + sampleInfo.n + ' · seed=' + sampleInfo.seed));
      }
      b.appendChild(samplingBox);

      // Cabeçalho explicativo (ocupa todas as colunas do grid)
      b.appendChild(SolsticeUtils.el('div', { class:'solstice__analysis-explain' },
        SolsticeUtils.el('strong', null, '🔬 Por que esse número? '),
        document.createTextNode(
          'Análise calculada sobre ' + SolsticeHumanize.recordCount(desc.n) +
          (sampleInfo ? ' (amostra aleatória de ' + sampleInfo.n + ' totais · seed=' + sampleInfo.seed + ')' : '') +
          ' de "' + SolsticeHumanize.column(col, ctx.dictionary) + '"' +
          (desc.nulls ? ' (' + desc.nulls + ' nulos ignorados)' : '') + '.')
      ));

      // Card 1: Distribuição central
      const card1 = card('📊 Distribuição central');
      card1.appendChild(row('Média', fmt(desc.mean), 'Sensível a outliers'));
      card1.appendChild(row('Mediana', fmt(desc.median), 'Robusta a outliers'));
      card1.appendChild(row('Desvio padrão', fmt(desc.stdDev), 'Dispersão em torno da média'));
      b.appendChild(card1);

      // Card 2: Faixa e quartis
      const card2 = card('📏 Faixa e quartis');
      card2.appendChild(row('Mínimo', fmt(desc.min)));
      card2.appendChild(row('Q1 (25%)', fmt(desc.q1)));
      card2.appendChild(row('Q3 (75%)', fmt(desc.q3)));
      card2.appendChild(row('Máximo', fmt(desc.max)));
      card2.appendChild(row('IQR', fmt(desc.iqr), 'Q3 − Q1 · faixa do meio (50%)'));
      b.appendChild(card2);

      // Card 3: Forma
      const card3 = card('🔍 Forma');
      const skTxt = desc.skewness == null ? '—' :
        (Math.abs(desc.skewness) < 0.2 ? 'Simétrica' :
         desc.skewness > 0 ? 'Cauda à direita' : 'Cauda à esquerda');
      card3.appendChild(row('Assimetria', fmt(desc.skewness) + ' · ' + skTxt, 'Skewness Pearson 3'));
      const ktTxt = desc.kurtosis == null ? '—' :
        (Math.abs(desc.kurtosis) < 0.5 ? 'Normal-like' :
         desc.kurtosis > 0 ? 'Caudas pesadas' : 'Caudas leves');
      card3.appendChild(row('Curtose', fmt(desc.kurtosis) + ' · ' + ktTxt, 'Excesso de curtose (Fisher)'));
      b.appendChild(card3);

      // Card 4: Outliers
      const card4 = card('⚠️ Outliers');
      card4.appendChild(row('Detectados (IQR 1.5×)', desc.outlierCount + ' de ' + desc.n));
      const pctOut = desc.n ? (desc.outlierCount / desc.n * 100).toFixed(1) : '0';
      card4.appendChild(row('% do total', pctOut + '%'));
      b.appendChild(card4);

      // Card contextual: Time Series → tendência + forecast
      if (def.id === 'time-series'){
        const tr = SolsticeStats.trend(values);
        if (tr){
          const cT = card('📈 Tendência');
          const dirLabel = tr.direction === 'up' ? '🔼 Subindo' : tr.direction === 'down' ? '🔽 Descendo' : '➡️ Estável';
          cT.appendChild(row('Direção', dirLabel));
          cT.appendChild(row('Variação total', (tr.totalChange > 0 ? '+' : '') + fmt(tr.totalChange) +
            ' (' + fmt(tr.magnitude * 100, 1) + '%)'));
          cT.appendChild(row('R² da regressão', fmt(tr.r2, 3)));
          b.appendChild(cT);
          const fc = SolsticeStats.linearForecast(values, 5);
          if (fc.length){
            const cF = card('🔮 Forecast linear (5 períodos)');
            fc.forEach((v, i) => cF.appendChild(row('t+' + (i+1), fmt(v, 0))));
            b.appendChild(cF);
          }
        }
      }

      // Card contextual: Scatter → correlação
      if (def.id === 'scatter'){
        const cfg = slot.config || {};
        if (cfg.xColumn && cfg.yColumn){
          const xs = ctx.rows.map(r => SolsticeStats.parseNum(r[cfg.xColumn]));
          const ys = ctx.rows.map(r => SolsticeStats.parseNum(r[cfg.yColumn]));
          const r = SolsticeStats.correlation(xs, ys);
          const rho = SolsticeStats.correlationSpearman(xs, ys);
          const cR = card('🔗 Correlação');
          const strength = r == null ? '—' :
            (Math.abs(r) >= 0.7 ? 'forte' : Math.abs(r) >= 0.4 ? 'moderada' : 'fraca');
          cR.appendChild(row('Pearson (linear)', fmt(r, 3) + ' · ' + strength));
          cR.appendChild(row('Spearman (monotônica)', fmt(rho, 3)));
          if (r != null && rho != null && Math.abs(Math.abs(rho) - Math.abs(r)) > 0.15){
            cR.appendChild(SolsticeUtils.el('div', { class:'solstice__stats-note' },
              '💡 |ρ| ≠ |r| sugere relação não-linear. Considere log/raiz.'));
          }
          b.appendChild(cR);
        }
      }

      // Card contextual: Gauge → distância da meta
      if (def.id === 'gauge' && slot.config && slot.config.target != null){
        const mVal = SolsticeStats.mean(values);
        const dist = mVal - slot.config.target;
        const cM = card('🎯 Distância da meta');
        cM.appendChild(row('Meta', fmt(slot.config.target)));
        cM.appendChild(row('Atual (média)', fmt(mVal)));
        cM.appendChild(row('Diferença', (dist >= 0 ? '+' : '') + fmt(dist) +
          ' (' + fmt(slot.config.target ? Math.abs(dist / slot.config.target * 100) : 0, 1) + '%)'));
        b.appendChild(cM);
      }

      // Card contextual: Box Plot agrupado → top grupos
      if (def.id === 'boxplot' && slot.config && slot.config.groupColumn){
        const groups = new Map();
        for (const r of ctx.rows){
          const v = SolsticeStats.parseNum(r[col]); if (isNaN(v)) continue;
          const g = String(r[slot.config.groupColumn]);
          if (!groups.has(g)) groups.set(g, []);
          groups.get(g).push(v);
        }
        const cG = card('📦 Por grupo (top 6)');
        Array.from(groups.entries()).slice(0, 6).forEach(([g, vs]) => {
          cG.appendChild(row(g.length > 16 ? g.slice(0, 15) + '…' : g,
            'med=' + fmt(SolsticeStats.median(vs)) + ' · n=' + vs.length));
        });
        b.appendChild(cG);
      }

      // Footer com snippet
      if (f){
        f.textContent = '🔬 Solstice.Stats.describe(Solstice.Store.get(\'ingest\').rows.map(r => SolsticeStats.parseNum(r[\'' + col + '\']))) — reproduz no console.';
      }
    }

    function init(){
      const closeBtn = document.getElementById('analysis-close');
      if (closeBtn) closeBtn.addEventListener('click', close);
      // Re-renderiza se o slot atual for atualizado (mudou config)
      SolsticeStore.subscribe('canvas.sections', () => {
        if (currentSlotId && SolsticeStore.get('ui.analysis.open')){
          render(currentSlotId);
        }
      });
    }
    return { open, close, toggle, isOpen, render, init, getCurrentSlotId };
  })();
