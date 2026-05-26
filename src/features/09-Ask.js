
  /* ============================================================
     BLOCO 8 — SolsticeAsk
     "Pergunte ao Solstice" via Ctrl+P. Command palette tipo Spotlight.
     Parser regex simples reconhece padrões pt-BR:
       - "qual a média/mediana/soma/máximo/mínimo de <col>?"
       - "quantos outliers em <col>?"
       - "top <N> em <col>" / "top <N> <col> por <col2>"
       - "correlação entre <X> e <Y>"
       - "quantos registros?"
       - "quantas categorias em <col>?"
       - "tendência de <col>"
     ============================================================ */
  const SolsticeAsk = (function(){
    let isOpen = false;
    let panelEl = null;

    /** Resolve nome de coluna por friendlyName OU nome técnico (case-insensitive). */
    function _resolveColumn(name){
      if (!name) return null;
      const ingest = SolsticeStore.get('ingest');
      const dict = SolsticeStore.get('dictionary');
      if (!ingest || !ingest.columns) return null;
      const n = String(name).trim().toLowerCase();
      // Match exato
      for (const c of ingest.columns) if (c.toLowerCase() === n) return c;
      // Friendly name
      if (dict && dict.columns){
        for (const c of ingest.columns){
          const fn = (dict.columns[c] && dict.columns[c].friendlyName) || '';
          if (fn.toLowerCase() === n) return c;
        }
      }
      // Match parcial (startsWith)
      for (const c of ingest.columns) if (c.toLowerCase().startsWith(n)) return c;
      if (dict && dict.columns){
        for (const c of ingest.columns){
          const fn = (dict.columns[c] && dict.columns[c].friendlyName) || '';
          if (fn.toLowerCase().startsWith(n)) return c;
        }
      }
      return null;
    }

    /** Tenta interpretar pergunta e retorna { ok, title, value, formula, error }. */
    function parse(query){
      const q = String(query).trim().toLowerCase();
      if (!q) return { ok: false, error: 'Pergunta vazia.' };
      const ingest = SolsticeStore.get('ingest');
      const dict = SolsticeStore.get('dictionary');
      if (!ingest || !ingest.rows || !ingest.rows.length){
        return { ok: false, error: 'Importe um CSV primeiro.' };
      }
      const rows = ingest.rows;

      // PADRÃO: "quantos registros"
      if (/quantos? registros|n[uú]mero de registros|total de linhas/.test(q)){
        return { ok: true, title: 'Total de registros', value: SolsticeHumanize.recordCount(rows.length), formula: 'rows.length',
          suggest: [
            { type:'bignum', icon:'🔢', label:'Adicionar como Big Number', config: {} }
          ] };
      }

      // PADRÃO: "quantas categorias em X" / "distintos em X"
      let m = q.match(/(?:quantas? (?:categorias|distintos|[uú]nicos)|categorias? distintas?) (?:em|de|na coluna|do)\s+(.+)/);
      if (m){
        const col = _resolveColumn(m[1]);
        if (!col) return { ok: false, error: 'Não encontrei a coluna "' + m[1] + '".' };
        const d = SolsticeStats.distinctCount(rows.map(r => r[col]));
        return { ok: true, title: 'Distintos em ' + SolsticeHumanize.column(col, dict), value: SolsticeLocale.integer(d), formula: 'distinctCount(' + col + ')',
          suggest: [
            { type:'distribution', icon:'📉', label:'Adicionar como Distribuição', config: { column: col } },
            { type:'table',        icon:'📋', label:'Adicionar como Tabela',     config: { columns: [col] } }
          ] };
      }

      // PADRÃO: "qual a média/mediana/etc de X" e variantes
      m = q.match(/(?:qual (?:[éa] |o )?|me d[êe] (?:o |a )?)?(m[éz]dia|mediana|soma|total|m[áa]ximo|m[íi]nimo|desvio padr[ãa]o|stddev) (?:de|do|da|na coluna)\s+(.+)/);
      if (m){
        const opMap = { 'média':'mean','media':'mean','mediana':'median','soma':'sum','total':'sum','máximo':'max','maximo':'max','mínimo':'min','minimo':'min','desvio padrão':'stdDev','desvio padrao':'stdDev','stddev':'stdDev' };
        const op = opMap[m[1]];
        const col = _resolveColumn(m[2]);
        if (!col) return { ok: false, error: 'Não encontrei a coluna "' + m[2] + '".' };
        const values = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
        if (!values.length) return { ok: false, error: 'Coluna "' + col + '" não tem valores numéricos válidos.' };
        const v = SolsticeStats[op](values);
        const typeDef = SolsticeTypes.getType((ingest.types || {})[col] && ingest.types[col].type);
        const formatted = typeDef && typeDef.format
          ? (function(){ try { return typeDef.format(v, SolsticeLocale); } catch(e){ return SolsticeLocale.decimal(v, 2); }})()
          : SolsticeLocale.decimal(v, 2);
        const aggUI = op === 'mean' ? 'avg' : op;
        return { ok: true, title: SolsticeHumanize.aggregation(aggUI) + ' de ' + SolsticeHumanize.column(col, dict), value: formatted, formula: 'Stats.' + op + '(' + col + ') sobre ' + values.length + ' valores',
          suggest: [
            { type:'kpi',          icon:'📊', label:'Adicionar como KPI',          config: { column: col, aggregation: aggUI } },
            { type:'bignum',       icon:'🔢', label:'Adicionar como Big Number',   config: { column: col, aggregation: aggUI } },
            { type:'distribution', icon:'📉', label:'Ver Distribuição (histograma)', config: { column: col } }
          ] };
      }

      // PADRÃO: "quantos outliers em X"
      m = q.match(/quantos? outliers? (?:em|de|na coluna|do)\s+(.+)/);
      if (m){
        const col = _resolveColumn(m[1]);
        if (!col) return { ok: false, error: 'Não encontrei a coluna "' + m[1] + '".' };
        const values = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
        if (!values.length) return { ok: false, error: 'Coluna sem valores numéricos.' };
        const ou = SolsticeStats.outliersIQR(values, 1.5);
        const pct = (ou.values.length / values.length * 100).toFixed(1);
        return { ok: true, title: 'Outliers em ' + SolsticeHumanize.column(col, dict),
                 value: ou.values.length + ' (' + pct + '%)',
                 formula: 'outliersIQR(' + col + ', 1.5) · faixa [' + SolsticeLocale.decimal(ou.fences.lo, 1) + ', ' + SolsticeLocale.decimal(ou.fences.hi, 1) + ']',
          suggest: [
            { type:'boxplot',      icon:'📦', label:'Adicionar como Box Plot',      config: { valueColumn: col } },
            { type:'distribution', icon:'📉', label:'Adicionar como Distribuição',  config: { column: col } }
          ] };
      }

      // PADRÃO: "correlação entre X e Y"
      m = q.match(/correla[çc][ãa]o (?:entre|de)\s+(.+?)\s+(?:e|com|vs)\s+(.+)/);
      if (m){
        const colA = _resolveColumn(m[1]);
        const colB = _resolveColumn(m[2]);
        if (!colA) return { ok: false, error: 'Não encontrei a coluna "' + m[1] + '".' };
        if (!colB) return { ok: false, error: 'Não encontrei a coluna "' + m[2] + '".' };
        const xs = rows.map(r => SolsticeStats.parseNum(r[colA]));
        const ys = rows.map(r => SolsticeStats.parseNum(r[colB]));
        const r = SolsticeStats.correlation(xs, ys);
        if (r == null) return { ok: false, error: 'Não foi possível calcular (poucos pares válidos).' };
        const strength = Math.abs(r) >= 0.7 ? 'forte' : Math.abs(r) >= 0.4 ? 'moderada' : 'fraca';
        return { ok: true, title: 'Correlação ' + SolsticeHumanize.column(colA, dict) + ' × ' + SolsticeHumanize.column(colB, dict),
                 value: SolsticeLocale.decimal(r, 3) + ' (' + strength + ')',
                 formula: 'Pearson r = cov(x,y)/(σx·σy)',
          suggest: [
            { type:'scatter', icon:'⚡', label:'Adicionar como Scatter',      config: { xColumn: colA, yColumn: colB, showRegression: true } }
          ] };
      }

      // PADRÃO: "top N em X" ou "top N X por Y"
      m = q.match(/top\s+(\d+)\s+(?:em\s+)?(.+?)(?:\s+por\s+(.+))?$/);
      if (m){
        const n = Math.min(20, parseInt(m[1]));
        const catCol = _resolveColumn(m[2]);
        if (!catCol) return { ok: false, error: 'Não encontrei a coluna "' + m[2] + '".' };
        let numCol = m[3] ? _resolveColumn(m[3]) : null;
        // Se não especificou Y, usa contagem
        const agg = new Map();
        for (const r of rows){
          const k = String(r[catCol] || '—');
          if (numCol){
            const v = SolsticeStats.parseNum(r[numCol]); if (isNaN(v)) continue;
            agg.set(k, (agg.get(k) || 0) + v);
          } else {
            agg.set(k, (agg.get(k) || 0) + 1);
          }
        }
        const sorted = Array.from(agg.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
        const formatted = sorted.map(([k, v]) => k + ': ' + SolsticeLocale.decimal(v, 1)).join(' · ');
        const suggest = [
          { type:'table',   icon:'📋', label:'Adicionar como Tabela ranqueada', config: { columns: [catCol, numCol].filter(Boolean), sortBy: numCol || catCol, sortDir: 'desc', limit: n } }
        ];
        if (numCol){
          suggest.push({ type:'sankey', icon:'🌊', label:'Adicionar como Sankey', config: { sourceColumn: catCol, valueColumn: numCol } });
          suggest.push({ type:'funnel', icon:'🔻', label:'Adicionar como Funil',  config: { stageColumn: catCol, valueColumn: numCol } });
        }
        return { ok: true, title: 'Top ' + n + ' em ' + SolsticeHumanize.column(catCol, dict) + (numCol ? ' por ' + SolsticeHumanize.column(numCol, dict) : ' (por contagem)'),
                 value: formatted,
                 formula: 'sort(group(' + catCol + '), ' + (numCol ? 'sum(' + numCol + ')' : 'count') + ') · top ' + n,
                 suggest };
      }

      // PADRÃO: "tendência de X"
      m = q.match(/tend[êe]ncia (?:de|do|da)\s+(.+)/);
      if (m){
        const col = _resolveColumn(m[1]);
        if (!col) return { ok: false, error: 'Não encontrei a coluna "' + m[1] + '".' };
        const values = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
        if (values.length < 3) return { ok: false, error: 'Pouco dado para tendência (mínimo 3 valores).' };
        const t = SolsticeStats.trend(values);
        if (!t) return { ok: false, error: 'Não foi possível calcular tendência.' };
        const dirLabel = t.direction === 'up' ? '🔼 Subindo' : t.direction === 'down' ? '🔽 Descendo' : '➡️ Estável';
        return { ok: true, title: 'Tendência de ' + SolsticeHumanize.column(col, dict),
                 value: dirLabel + ' · ' + SolsticeLocale.decimal(t.magnitude * 100, 1) + '%',
                 formula: 'linearRegression(values).slope · R² = ' + SolsticeLocale.decimal(t.r2 || 0, 2),
          suggest: [
            { type:'time-series', icon:'📈', label:'Adicionar como Série Temporal', config: { yColumn: col } },
            { type:'kpi',         icon:'📊', label:'Adicionar como KPI (Δ% período)', config: { column: col, aggregation: 'sum' } }
          ] };
      }

      return { ok: false, error: 'Não entendi a pergunta. Veja exemplos de comandos suportados abaixo.' };
    }

    function open(){
      if (isOpen) return;
      isOpen = true;
      const overlay = SolsticeUtils.el('div', {
        class: 'solstice__ask-overlay',
        onclick: (e) => { if (e.target === overlay) close(); }
      });
      const panel = SolsticeUtils.el('div', { class:'solstice__ask-panel' });
      const inputWrap = SolsticeUtils.el('div', { class:'solstice__ask-input-wrap' });
      inputWrap.appendChild(SolsticeUtils.el('span', { style:'font-size:18px;' }, '🔍'));
      const input = SolsticeUtils.el('input', {
        class:'solstice__ask-input', type:'text',
        placeholder:'Pergunte algo sobre seus dados…'
      });
      inputWrap.appendChild(input);
      inputWrap.appendChild(SolsticeUtils.el('span', { class:'solstice__ask-kbd' }, 'Esc'));
      panel.appendChild(inputWrap);

      const bodyEl = SolsticeUtils.el('div', { class:'solstice__ask-body' });
      panel.appendChild(bodyEl);

      function showSuggestions(){
        bodyEl.innerHTML = '';
        // JR-04 (Sprint 1B): Wizard "que pergunta?" — agrupa sugestões por
        // categoria com ícone, ajudando usuário a entender o universo de coisas
        // que pode perguntar. Antes era lista plana de 7 strings.
        // SOL-G6: sugestões são derivadas das colunas reais da base.
        const _ingestG6 = SolsticeStore.get('ingest') || {};
        const _colsG6   = _ingestG6.columns || [];
        const _cmG6     = _ingestG6.columnsMeta || {};
        const _grpG6    = (c) => (typeof SolsticeTypes !== 'undefined' && SolsticeTypes.group)
          ? SolsticeTypes.group(_cmG6[c] && _cmG6[c].type) : null;
        const _numsG6   = _colsG6.filter(c => _grpG6(c) === 'numeric');
        const _catsG6   = _colsG6.filter(c => _grpG6(c) === 'categorical');
        const _tempsG6  = _colsG6.filter(c => _grpG6(c) === 'temporal');

        // Sem dataset: mensagem amigável + CTAs (importar/exemplo) + catálogo genérico
        // Auditoria 2026.2 (BR-A1 + H1): em vez de só dizer "importe primeiro",
        // oferecemos CTAs claras + 7 perguntas universais que funcionam mesmo
        // sem CSV ainda. O super prompt pediu "catálogo genérico ~15-20 perguntas".
        if (_colsG6.length === 0){
          const banner = SolsticeUtils.el('div', {
            style:'font-size:12px;color:var(--c-text-2);margin-bottom:10px;padding:10px 12px;background:var(--c-surface-2);border-radius:6px;border-left:2px solid var(--c-accent);'
          });
          banner.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;color:var(--c-text);margin-bottom:4px;' },
            '💡 Importe um CSV primeiro'));
          banner.appendChild(SolsticeUtils.el('div', null,
            'Depois você poderá perguntar coisas como "qual a média de receita", "top 5 clientes", "tendência das vendas".'));
          bodyEl.appendChild(banner);

          const ctaWrap = SolsticeUtils.el('div', { style:'display:flex;gap:8px;margin-bottom:12px;' });
          const ctaExample = SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--primary',
            style:'flex:1;',
            onclick: () => {
              try {
                close();
                if (typeof _loadDummyDataset === 'function') _loadDummyDataset();
                else if (window.Solstice && window.Solstice.Dummy && window.Solstice.Dummy.load) window.Solstice.Dummy.load();
                setTimeout(() => {
                  try { if (typeof SolsticeAutoDashboard !== 'undefined') SolsticeAutoDashboard.run({ silent: true }); }
                  catch(_){}
                }, 600);
              } catch(_){}
            }
          }, '✨ Ver com dataset de exemplo');
          const ctaImport = SolsticeUtils.el('button', {
            class:'solstice__btn',
            style:'flex:1;',
            onclick: () => {
              close();
              const fi = document.getElementById('file-input');
              if (fi) fi.click();
            }
          }, '📁 Importar meu CSV');
          ctaWrap.append(ctaExample, ctaImport);
          bodyEl.appendChild(ctaWrap);

          bodyEl.appendChild(SolsticeUtils.el('div',
            { style:'font-size:10px;color:var(--c-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;' },
            'Perguntas que você poderá fazer'));
          const universals = [
            'quantos registros',
            'resumo do dataset',
            'qual a tendência geral',
            'onde está concentrado o volume',
            'quais são os 5 maiores',
            'existe algum valor fora do padrão',
            'o que mudou em relação ao período anterior'
          ];
          universals.forEach(s => {
            bodyEl.appendChild(SolsticeUtils.el('div', { class:'solstice__ask-suggestion',
              onclick: () => { input.value = s; doAsk(); }
            }, s));
          });
          return;
        }

        // Auditoria 2026.2 (H1): biblioteca expandida — 20+ perguntas em 6
        // categorias, mistura contextual (schema do dataset) + catálogo genérico
        // de negócio que sempre aparece. Antes ~12 perguntas — agora ~22.
        const categories = [];

        // Estatística (precisa de coluna numérica)
        if (_numsG6[0]){
          categories.push({
            icon: '📊',
            label: 'Estatística',
            hint: 'agregações sobre números',
            items: [
              'qual a média de ' + _numsG6[0],
              'soma de ' + _numsG6[0],
              'máximo de ' + _numsG6[0],
              _numsG6[1] ? 'qual a mediana de ' + _numsG6[1] : null,
              _numsG6[1] ? 'desvio padrão de ' + _numsG6[1] : null
            ].filter(Boolean)
          });
        }

        // Comparação / ranking
        if (_catsG6[0] && _numsG6[0]){
          categories.push({
            icon: '🏆',
            label: 'Comparação',
            hint: 'rankings e melhores/piores',
            items: [
              'top 5 em ' + _catsG6[0] + ' por ' + _numsG6[0],
              'top 10 em ' + _catsG6[0] + ' por ' + _numsG6[0],
              'quantas categorias em ' + _catsG6[0],
              _catsG6[1] ? 'quantas categorias em ' + _catsG6[1] : null,
              _catsG6[0] ? 'qual ' + _catsG6[0] + ' tem maior volume' : null
            ].filter(Boolean)
          });
        }

        // Tendência (precisa de coluna temporal)
        if (_tempsG6[0] && _numsG6[0]){
          categories.push({
            icon: '📈',
            label: 'Tendência',
            hint: 'evolução ao longo do tempo',
            items: [
              'tendência de ' + _numsG6[0] + ' ao longo de ' + _tempsG6[0],
              'qual foi o melhor mês em ' + _numsG6[0],
              'qual foi o pior mês em ' + _numsG6[0],
              _numsG6[1] ? 'tendência de ' + _numsG6[1] : null
            ].filter(Boolean)
          });
        }

        // Qualidade / outliers
        if (_numsG6[0]){
          categories.push({
            icon: '🔍',
            label: 'Qualidade',
            hint: 'outliers e correlações',
            items: [
              'quantos outliers em ' + _numsG6[0],
              _numsG6[1] ? 'correlação entre ' + _numsG6[0] + ' e ' + _numsG6[1] : null,
              'existe algum valor fora do padrão',
              _numsG6[1] ? 'distribuição de ' + _numsG6[1] : 'distribuição de ' + _numsG6[0]
            ].filter(Boolean)
          });
        }

        // Negócio — sempre disponível, perguntas genéricas que NL processa
        categories.push({
          icon: '💼',
          label: 'Negócio',
          hint: 'perguntas executivas universais',
          items: [
            'onde está concentrado o volume',
            'qual a participação de cada categoria no total',
            'o que mudou recentemente',
            'quais são os principais destaques',
            'tem algo preocupante nesses dados'
          ]
        });

        // Universal (sempre disponível)
        categories.push({
          icon: '📋',
          label: 'Sobre o dataset',
          hint: 'visão geral',
          items: [
            'quantos registros',
            'resumo do dataset',
            'liste as colunas'
          ]
        });

        // Renderiza categorias
        categories.forEach((cat, catIdx) => {
          const header = SolsticeUtils.el('div', {
            style: 'display:flex;align-items:baseline;gap:6px;font-size:10px;color:var(--c-muted);margin:' + (catIdx === 0 ? '0' : '12px') + ' 0 6px 0;text-transform:uppercase;letter-spacing:0.04em;'
          });
          header.appendChild(SolsticeUtils.el('span', { style:'font-size:13px;', 'aria-hidden':'true' }, cat.icon));
          header.appendChild(SolsticeUtils.el('span', null, cat.label));
          header.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-muted);opacity:0.7;font-weight:normal;text-transform:none;letter-spacing:0;' }, '· ' + cat.hint));
          bodyEl.appendChild(header);
          cat.items.forEach(s => {
            bodyEl.appendChild(SolsticeUtils.el('div', { class:'solstice__ask-suggestion',
              onclick: () => { input.value = s; doAsk(); }
            }, s));
          });
        });
      }

      function doAsk(){
        // ADR-167 (Onda 3 / T6): unificação Ask + Query.
        // Antes: SolsticeAsk.parse() (regex, 7 intents) e SolsticeQuery.ask()
        // (4 camadas + Levenshtein + BYO-LLM, 30 intents) competiam.
        // Briefing v5.4 personas P2 Diego, P7 Júlia: "comportamento divergente
        // entre os dois pontos de entrada". Agora: Ctrl+P (Ask UI) usa Query
        // como engine primária. Parser regex fica como FALLBACK pra preservar
        // parity nas 7 intents legadas (média/mediana/soma/distincts/topN/
        // correlação/trend) caso Query devolva confidence < 0.4.
        const text = (input.value || '').trim();
        bodyEl.innerHTML = '';
        if (!text){
          showSuggestionsAppend();
          return;
        }

        let queryResult = null;
        let usedFallback = false;
        try {
          if (typeof SolsticeQuery !== 'undefined' && SolsticeQuery.ask){
            queryResult = SolsticeQuery.ask(text);
          }
        } catch (err){
          SolsticeLog.warn('[Ask] SolsticeQuery threw, falling back to legacy parse:', err);
        }

        // Adapta result do Query pra UI estruturada do Ask
        if (queryResult && queryResult.confidence >= 0.4 && queryResult.answer){
          const result = SolsticeUtils.el('div', { class:'solstice__ask-result' });
          result.appendChild(SolsticeUtils.el('div',
            { style:'font-size:11px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;' },
            'Resposta'));
          const valueEl = SolsticeUtils.el('div', { class:'solstice__ask-result-value' });
          // Markdown leve: **bold** + \n. Auditoria 2026 (JM-01 / HV-01):
          // delega o escape ao SolsticeUtils.escapeHtml em vez de manter regex
          // ad-hoc — uma fonte só de verdade para o que é HTML-safe.
          const html = SolsticeUtils.escapeHtml(String(queryResult.answer))
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
          valueEl.innerHTML = html;
          result.appendChild(valueEl);
          // Provenance: confidence + source (Query layers / LLM / legacy)
          result.appendChild(SolsticeUtils.el('div',
            { class:'solstice__ask-result-formula' },
            'confidence ' + Math.round(queryResult.confidence * 100) + '% · via SolsticeQuery' +
            (queryResult.source ? ' (' + queryResult.source + ')' : '')));
          bodyEl.appendChild(result);

          // Ação: criar componente (se Query sugeriu)
          if (queryResult.action && queryResult.action.type === 'create_component'){
            const btn = SolsticeUtils.el('button', {
              class:'solstice__btn solstice__btn--primary',
              style:'margin-top:var(--sp-3);',
              onclick: () => {
                try {
                  if (typeof SolsticeComponents !== 'undefined' && SolsticeComponents.addByType){
                    SolsticeComponents.addByType(queryResult.action.componentType, queryResult.action.config || {});
                    close();
                  }
                } catch(err){
                  SolsticeToast.error('Erro ao adicionar componente', err.message || String(err));
                }
              }
            }, '📊 Adicionar visualização');
            bodyEl.appendChild(btn);
          }
          return;
        }

        // Fallback: legacy regex parser (7 intents). Mantém parity.
        usedFallback = true;
        const res = parse(text);
        if (!res.ok){
          bodyEl.appendChild(SolsticeUtils.el('div', { class:'solstice__ask-error' },
            '⚠️ ' + res.error));
          showSuggestionsAppend();
          return;
        }
        const result = SolsticeUtils.el('div', { class:'solstice__ask-result' });
        result.appendChild(SolsticeUtils.el('div',
          { style:'font-size:11px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;' },
          res.title));
        result.appendChild(SolsticeUtils.el('div', { class:'solstice__ask-result-value' }, res.value));
        if (res.formula) result.appendChild(SolsticeUtils.el('div', { class:'solstice__ask-result-formula' },
          res.formula + ' · via parser regex (legado)'));
        bodyEl.appendChild(result);

        if (Array.isArray(res.suggest) && res.suggest.length){
          const actionsHead = SolsticeUtils.el('div',
            { class:'solstice__ask-actions-head' },
            'Adicionar ao dashboard');
          bodyEl.appendChild(actionsHead);
          const actions = SolsticeUtils.el('div', { class:'solstice__ask-actions' });
          res.suggest.forEach(s => {
            const btn = SolsticeUtils.el('button', {
              class: 'solstice__ask-action',
              type: 'button',
              title: s.label,
              'aria-label': s.label,
              onclick: () => {
                try {
                  if (typeof SolsticeComponents !== 'undefined' && SolsticeComponents.addByType){
                    SolsticeComponents.addByType(s.type, s.config || {});
                    close();
                  }
                } catch(e){
                  SolsticeToast.error('Erro ao adicionar componente', e.message || String(e));
                }
              }
            });
            btn.appendChild(SolsticeUtils.el('span', { class:'solstice__ask-action-icon', 'aria-hidden':'true' }, s.icon || '+'));
            btn.appendChild(SolsticeUtils.el('span', { class:'solstice__ask-action-label' }, s.label));
            actions.appendChild(btn);
          });
          bodyEl.appendChild(actions);
        }
      }

      function showSuggestionsAppend(){
        const sep = SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);margin-top:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;' },
          'Tente:');
        bodyEl.appendChild(sep);
        ['qual a média de [coluna]', 'top 5 em [categoria] por [numérica]', 'correlação entre [X] e [Y]'].forEach(s => {
          bodyEl.appendChild(SolsticeUtils.el('div', { class:'solstice__ask-suggestion',
            onclick: () => { input.value = s.replace(/\[coluna\]/, '').replace(/\[X\]/, '').replace(/\[Y\]/, '').replace(/\[categoria\]/, '').replace(/\[numérica\]/, '').trim(); input.focus(); }
          }, s));
        });
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter'){ e.preventDefault(); doAsk(); }
        if (e.key === 'Escape'){ e.preventDefault(); close(); }
      });

      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      panelEl = overlay;
      setTimeout(() => input.focus(), 50);
      showSuggestions();
    }

    function close(){
      if (panelEl){ panelEl.remove(); panelEl = null; }
      isOpen = false;
    }

    function init(){
      document.addEventListener('keydown', (e) => {
        // Ctrl+P abre. Bloqueia o "imprimir" do browser.
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p'){
          // Não intercepta se está num input/textarea/contenteditable
          const tag = e.target && e.target.tagName;
          const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
          if (isEditing) return;
          e.preventDefault();
          if (isOpen) close(); else open();
        }
      });
    }

    return { open, close, parse, init, isOpen: () => isOpen };
  })();
