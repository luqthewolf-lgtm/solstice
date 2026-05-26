
  /* ============================================================
     BLOCO 10 — SolsticeAutoDashboard (ADR-077)
     Pipeline 4 etapas:
       1. ColumnScore.top(ctx, 8) → top colunas
       2. Recommender.recommend(ctx) → recomendações
       3. Filtra confidence ≥ 60; agrupa em até 4 sections
       4. Se conf média < 70% → modal de confirmação; senão aplica
     ============================================================ */
  const SolsticeAutoDashboard = (function(){

    function _ctxFor(){
      const ingest = SolsticeStore.get('ingest') || {};
      return {
        rows: ingest.rows || [],
        rowsAll: ingest.rows || [], // sem filtros — autodash usa dataset completo
        columns: ingest.columns || [],
        types: ingest.types || {},
        dictionary: SolsticeStore.get('dictionary'),
        L: SolsticeLocale
      };
    }

    /**
     * Constrói sections a partir de recomendações selecionadas.
     * HOTFIX v5.5 #114: Lucas "organize corretamente o autodash board para
     * que fique mais carinha de I.A que montou tudo pra você da melhor forma".
     * - Cada section ganha aiGenerated=true (badge ✨ IA no header)
     * - Títulos numerados sequencialmente (1. / 2. / 3. ...)
     * - Subtitle narra POR QUE essa section existe + reasoning das recs
     * - Sections agrupadas semanticamente por tipo de visualização
     */
    function _buildSections(recs, meta){
      meta = meta || {};
      const sections = [];
      // R-04 v3: pega o datasetId ativo no momento da criação dos slots.
      // Antes os slots saíam SEM datasetId — `slot.config.datasetId = undefined` —
      // dependendo do fallback do _ctx() para puxar do ingest global. Agora gravamos
      // a base de origem no slot, permitindo que múltiplas bases coexistam no canvas
      // sem confusão (U-13 honrado desde a criação).
      const _activeDsId = SolsticeStore.get('datasets.activeId') || null;
      // Mapa tipo → categoria narrativa (pra agrupar visualmente)
      const CATEGORIES = {
        kpi:           'overview',
        bignum:        'overview',
        gauge:         'overview',
        'time-series': 'temporal',
        'heatmap-cal': 'temporal',
        'distrib-time':'temporal',
        distribution:  'comparison',
        boxplot:       'comparison',
        funnel:        'comparison',
        scatter:       'relation',
        sankey:        'relation',
        pivot:         'relation',
        'metric-graph':'relation',
        table:         'detail',
        markdown:      'detail',
        'narrative-auto': 'detail',
        'demand-list': 'detail',
        'event-timeline':'detail'
      };
      // Títulos + subtitles por categoria (a IA "explica" por que escolheu)
      const CAT_META = {
        overview: {
          title: 'Visão executiva',
          subtitle: 'Os KPIs principais detectados pela IA — números que respondem "como está hoje".'
        },
        temporal: {
          title: 'Evolução no tempo',
          subtitle: 'Como as métricas mudam ao longo do período coberto pelos dados.'
        },
        comparison: {
          title: 'Distribuição & Comparação',
          subtitle: 'Como valores e categorias se distribuem — picos, vales, concentração.'
        },
        relation: {
          title: 'Relações & Correlações',
          subtitle: 'Como variáveis se conectam entre si — padrões cruzados.'
        },
        detail: {
          title: 'Detalhamento',
          subtitle: 'Para inspeção linha-a-linha e contexto adicional.'
        }
      };

      // Ordem narrativa das categorias
      const CAT_ORDER = ['overview', 'temporal', 'comparison', 'relation', 'detail'];

      // Agrupa recs por categoria
      const byCat = {};
      CAT_ORDER.forEach(c => byCat[c] = []);
      recs.forEach(r => {
        const c = CATEGORIES[r.componentType] || 'detail';
        (byCat[c] || (byCat[c] = [])).push(r);
      });

      // Constrói até 5 sections, numeradas
      let sectionIdx = 0;
      for (const cat of CAT_ORDER){
        const list = byCat[cat];
        if (!list || !list.length) continue;
        if (sections.length >= 5) break;

        const meta = CAT_META[cat] || { title: 'Análise', subtitle: 'Componentes adicionais.' };
        sectionIdx++;
        const numberedTitle = sectionIdx + '. ' + meta.title;

        // Decide layout da primeira row baseado no tamanho
        // Overview com 3 KPIs vira 3-col, etc
        const rows = [];
        let cursor = 0;
        while (cursor < list.length){
          // KPIs/gauges: 3 por linha; outros: 2 por linha (1 se sobrar)
          const isKpiCat = cat === 'overview';
          const batchSize = isKpiCat ? Math.min(3, list.length - cursor) : Math.min(2, list.length - cursor);
          const batch = list.slice(cursor, cursor + batchSize);
          cursor += batchSize;

          const layout = batch.length === 3 ? '3col-equal'
                       : batch.length === 2 ? '2col-equal'
                       : '1col';

          rows.push({
            id: SolsticeUtils.uuid(),
            layout,
            slots: batch.map(r => {
              // R-04 v3 + KPI1 v4 (Auditoria 2026.4): incorpora datasetId no config
              // desde a criação. KPIs sem height fixo de 180 — CSS gerencia altura
              // natural (min-height 80px). Usuário pode aumentar via resize.
              const baseCfg = Object.assign({}, r.config || {});
              if (_activeDsId && !baseCfg.datasetId) baseCfg.datasetId = _activeDsId;
              return {
                id: SolsticeUtils.uuid(),
                type: r.componentType,
                config: baseCfg,
                aiGenerated: true,
                aiReasoning: r.reasoning || null
              };
            })
          });
        }

        // Subtitle enriquecido: meta default + reasoning das top recs (até 2)
        const topReasons = list.slice(0, 2).map(r => r.reasoning).filter(Boolean);
        const enrichedSubtitle = topReasons.length
          ? meta.subtitle + ' Inclui: ' + topReasons.join(' · ') + '.'
          : meta.subtitle;

        sections.push({
          id: SolsticeUtils.uuid(),
          title: numberedTitle,
          subtitle: enrichedSubtitle,
          aiGenerated: true,
          rows
        });
      }
      // HOTFIX v5.5 #114: prepend INTRO narrativa "carinha de IA"
      // Auditoria 2026.4: AutoDashboard reorganizado pra ficar com narrativa de IA —
      // de I.A que montou tudo pra você da melhor forma possível"
      if (sections.length){
        const avgConf = Math.round(meta.avgConf || 0);
        const totalRecs = recs.length;
        const totalAnalyzed = meta.totalAnalyzed || totalRecs;
        const ingest = SolsticeStore.get('ingest');
        const nRows = ingest && ingest.rows ? ingest.rows.length : 0;
        const nCols = ingest && ingest.columns ? ingest.columns.length : 0;
        // Coleta os tipos de componentes que entraram (pra mostrar na narrativa)
        const compTypes = Array.from(new Set(recs.map(r => r.componentType)));
        const compTypeLabels = compTypes.map(t => {
          const def = SolsticeComponents.get(t);
          return def ? def.name : t;
        });

        // Auditoria 2026.6 (SUMARIO-IA): enriquecido com DADOS REAIS — período
        // coberto, métricas principais com valores, destaques (reasoning das recs)
        // e qualidade. Antes só dizia nº de componentes/confiança/tipos (meta).
        // Tudo em loop (sem Math.min(...arr)/spread) → seguro em base grande.
        const _dict = ingest && ingest.dictionary || SolsticeStore.get('dictionary');
        // Período coberto (1ª coluna temporal)
        let _periodo = '';
        try {
          const _tcol = (ingest.columns || []).find(c => SolsticeTypes.group((ingest.types[c] || {}).type) === 'temporal');
          if (_tcol && ingest.rows){
            let _mn = Infinity, _mx = -Infinity;
            for (const r of ingest.rows){ const d = SolsticeTypes.toDate(r[_tcol]); const t = d && d.getTime ? d.getTime() : NaN; if (isNaN(t)) continue; if (t < _mn) _mn = t; if (t > _mx) _mx = t; }
            if (_mn !== Infinity){ const _f = ms => new Date(ms).toLocaleDateString('pt-BR'); _periodo = ' · período **' + _f(_mn) + '** → **' + _f(_mx) + '**'; }
          }
        } catch(_){}
        // Métricas principais (recs escalares — kpi/bignum/gauge)
        const _metricLines = [];
        try {
          const _scal = recs.filter(r => ['kpi','bignum','gauge'].indexOf(r.componentType) >= 0 && r.config && r.config.column).slice(0, 4);
          const _aggL = { sum:'soma', avg:'média', min:'mínimo', max:'máximo', count:'contagem' };
          for (const r of _scal){
            const col = r.config.column, agg = r.config.agg || 'sum';
            let s = 0, n = 0, mn = Infinity, mx = -Infinity;
            for (const row of ingest.rows){ const v = SolsticeStats.parseNum(row[col]); if (isNaN(v)) continue; s += v; n++; if (v < mn) mn = v; if (v > mx) mx = v; }
            if (!n) continue;
            const val = agg === 'avg' ? s/n : agg === 'min' ? mn : agg === 'max' ? mx : agg === 'count' ? n : s;
            const fmt = Math.abs(val) >= 1000 ? SolsticeLocale.integer(Math.round(val)) : SolsticeLocale.decimal(val, 2);
            _metricLines.push('- **' + SolsticeHumanize.column(col, _dict) + '**: ' + fmt + ' _(' + (_aggL[agg] || agg) + ')_');
          }
        } catch(_){}
        // Destaques (reasoning das principais recomendações)
        const _destaques = recs.slice(0, 3).map(r => (r.reasoning || '').replace(/\s+/g, ' ').trim()).filter(s => s.length > 3);
        // Qualidade
        let _q = null; try { _q = SolsticeQuality.compute(ingest).score; } catch(_){}

        const _md = [
          '## 🪄 Dashboard montado pela IA',
          '',
          'Analisei **' + SolsticeLocale.integer(nRows) + ' linhas × ' + nCols + ' colunas**' + _periodo +
            ' e montei **' + totalRecs + ' componente' + (totalRecs === 1 ? '' : 's') + '** em **' +
            sections.length + ' seç' + (sections.length === 1 ? 'ão' : 'ões') + '**' +
            (_q != null ? ' · qualidade da base **' + _q + '/100**' : '') + '.'
        ];
        if (_metricLines.length){
          _md.push('', '### 🔢 Números principais', _metricLines.join('\n'));
        }
        if (_destaques.length){
          _md.push('', '### 📌 O que olhar primeiro', _destaques.map(d => '- ' + d).join('\n'));
        }
        _md.push('',
          '**Confiança média da montagem:** ' + avgConf + '%' +
            (avgConf >= 75 ? ' — alta, pronto pra uso.' :
             avgConf >= 60 ? ' — boa, revise se algum bloco não fizer sentido.' :
                             ' — moderada, ajuste fino recomendado.') +
            (totalAnalyzed > totalRecs ? ' _(' + totalAnalyzed + ' regras avaliadas, ' + totalRecs + ' aprovadas)_' : ''),
          '',
          '_Cada seção tem **✨ IA** no título. Tudo é editável — renomeie, mova, troque tipo, redimensione, filtre, clique pra cruzar (cross-filter)._'
        );
        const introMarkdown = _md.join('\n');

        const intro = {
          id: SolsticeUtils.uuid(),
          title: '✨ Sumário da IA',
          subtitle: 'A IA explica o que detectou e por que organizou desse jeito.',
          aiGenerated: true,
          rows: [{
            id: SolsticeUtils.uuid(),
            layout: '1col',
            slots: [{
              id: SolsticeUtils.uuid(),
              type: 'markdown',
              config: { text: introMarkdown },  // markdown component usa cfg.text
              aiGenerated: true,
              aiReasoning: 'Narrativa explicativa da IA — sumariza decisões.'
            }]
          }]
        };
        sections.unshift(intro);
      }
      return sections;
    }

    /** Render lista de recomendações com checkboxes (modal de confirmação). */
    function _renderRecsList(recs, onChange){
      const wrap = SolsticeUtils.el('div', { class:'solstice__recs-list' });
      recs.forEach((r, i) => {
        const def = SolsticeComponents.get(r.componentType);
        const tier = r.confidence >= 75 ? 'high' : r.confidence >= 60 ? 'med' : 'low';
        const item = SolsticeUtils.el('div', { class:'solstice__rec-item' });
        const cb = SolsticeUtils.el('input', { type:'checkbox',
          onchange: (e) => onChange(i, e.target.checked) });
        cb.checked = true;
        item.appendChild(cb);
        const body = SolsticeUtils.el('div', { class:'solstice__rec-item-body' });
        const title = SolsticeUtils.el('div', { class:'solstice__rec-item-title' });
        title.appendChild(SolsticeUtils.el('span', { class:'solstice__rec-item-icon' }, def ? def.icon : '🧩'));
        title.appendChild(SolsticeUtils.el('span', null, def ? def.name : r.componentType));
        body.appendChild(title);
        body.appendChild(SolsticeUtils.el('div', { class:'solstice__rec-item-reason' }, r.reasoning));
        item.appendChild(body);
        item.appendChild(SolsticeUtils.el('div', { class:'solstice__rec-item-confidence solstice__rec-item-confidence--' + tier },
          r.confidence + '%'));
        wrap.appendChild(item);
      });
      return wrap;
    }

    /**
     * run(opts) — opts:
     *   intent: string opcional para filtrar regras
     *   force: força modal mesmo com alta confiança (mantido p/ compat)
     *   silent: ADR-161 (Onda 1 / T3 Express Mode) — pula modal quando
     *           avgConf >= 40% (safety floor). Para imports automáticos
     *           sem fricção. Auditoria 2026.4: fluxo "import → autoDash silenciosa" é o esperado.
     */
    async function run(opts){
      opts = opts || {};
      const ctx = _ctxFor();
      if (!ctx.rows.length){ SolsticeToast.warn('Auto-Dashboard', 'Importe um CSV primeiro.'); return; }

      const recs = SolsticeRecommender.recommend(ctx, { intent: opts.intent });
      if (!recs.length){ SolsticeToast.info('Auto-Dashboard', 'Nenhuma recomendação aplicável.'); return; }

      const filtered = recs.filter(r => r.confidence >= 60).slice(0, 8);
      if (!filtered.length){ SolsticeToast.warn('Auto-Dashboard', 'Confiança baixa em todas as recomendações. Use o Wizard.'); return; }

      const avgConf = filtered.reduce((s, r) => s + r.confidence, 0) / filtered.length;
      // ADR-161: Express/silent só pula modal se conf >= 40 (safety floor).
      // Conf < 40 ainda mostra modal mesmo em silent — proteção contra recs ruins.
      const needsConfirm = opts.force || (opts.silent ? avgConf < 40 : avgConf < 70);

      // Estado mutável das seleções
      const selected = filtered.map(() => true);

      function _applyNow(){
        const finalRecs = filtered.filter((_, i) => selected[i]);
        if (!finalRecs.length){ SolsticeToast.warn('Nada selecionado', 'Marque ao menos 1 componente.'); return false; }
        // HOTFIX v5.5 #114: passa meta pro _buildSections (avgConf, totals)
        const finalAvgConf = finalRecs.reduce((s, r) => s + r.confidence, 0) / finalRecs.length;
        const sections = _buildSections(finalRecs, {
          avgConf: finalAvgConf,
          totalAnalyzed: recs.length,
          intent: opts.intent || null
        });
        const current = SolsticeStore.get('canvas.sections') || [];
        SolsticeStore.set('canvas.sections', current.concat(sections));
        SolsticeAudit.record({
          action: 'auto_dashboard',
          details: {
            intent: opts.intent || 'all',
            count: finalRecs.length,
            avgConfidence: Math.round(avgConf),
            recIds: finalRecs.map(r => r.ruleId)
          }
        });
        SolsticeToast.success('🪄 Dashboard montado pela IA',
          finalRecs.length + ' componente(s) em ' + sections.length + ' seção(ões) — confiança ' + Math.round(finalAvgConf) + '%');
        return true;
      }

      if (!needsConfirm){
        _applyNow();
        return;
      }

      // Modal de confirmação
      await SolsticeModal.show({
        title: '🪄 Auto-Dashboard sugerido',
        size: 'lg',
        body: (close) => {
          const wrap = SolsticeUtils.el('div');
          wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__recs-summary' },
            SolsticeUtils.el('strong', null, 'Confiança média: ' + Math.round(avgConf) + '%. '),
            document.createTextNode('Revise os componentes sugeridos — desmarque os que não quiser. ' +
              filtered.length + ' recomendação(ões) baseadas no seu dataset.')
          ));
          wrap.appendChild(_renderRecsList(filtered, (i, v) => { selected[i] = v; }));
          return wrap;
        },
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn', onclick: () => close(null) }, 'Cancelar'),
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary',
            onclick: () => { if (_applyNow()) close(null); }
          }, 'Aplicar selecionados')
        ]
      });
    }

    return { run, _buildSections };
  })();
