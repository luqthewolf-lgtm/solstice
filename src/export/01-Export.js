
  /* ============================================================
     BLOCO 11 — SolsticeExport (ADR-082)
     Gera HTML standalone com dashboard.html atual + estado embutido.
     Auto-hidrata no boot via flag data-embedded-mode.
     ============================================================ */
  const SolsticeExport = (function(){

    /** Gera HTML completo com state embutido. */
    function buildStandaloneHTML(opts){
      opts = opts || {};
      const includeData = opts.includeData !== false;
      const state = SolsticeSnapshots._captureState();
      if (!includeData) state.ingest = null;  // só estrutura; usuário importa CSV de novo
      const json = JSON.stringify(state);
      const compressed = SolsticeLZ.compressToBase64(json);

      // Pega o HTML do documento atual
      const html = document.documentElement.outerHTML;
      // Marca como embedded e injeta o state no início do <head>
      const injection = '<meta name="solstice-embedded" content="1">\n' +
                        '<script id="solstice-embedded-state" type="application/octet-stream">' + compressed + '<\/script>';
      const out = html.replace(/<head([^>]*)>/i, '<head$1>\n' + injection);
      // Snippet de auto-hidratação no fim do body
      const hydration =
        '\n<script>\n' +
        '(function(){\n' +
        '  function rehydrate(){\n' +
        '    if (!window.Solstice || !window.Solstice.LZ) return setTimeout(rehydrate, 100);\n' +
        '    var meta = document.querySelector(\'meta[name="solstice-embedded"]\');\n' +
        '    if (!meta) return;\n' +
        '    var script = document.getElementById("solstice-embedded-state");\n' +
        '    if (!script) return;\n' +
        '    try {\n' +
        '      var raw = window.Solstice.LZ.decompressFromBase64(script.textContent.trim());\n' +
        '      var state = JSON.parse(raw);\n' +
        '      var S = window.Solstice.Store;\n' +
        '      S.batch(function(){\n' +
        '        S.set("canvas.sections", state.canvas && state.canvas.sections || []);\n' +
        '        S.set("canvas.header",   state.canvas && state.canvas.header   || {});\n' +
        '        S.set("filters",         state.filters || {});\n' +
        '        S.set("params",          state.params  || {});\n' +
        '        S.set("dictionary",      state.dictionary || null);\n' +
        '        if (state.ingest){\n' +
        '          S.set("ingest", state.ingest);\n' +
        '          S.set("dataset.ready", true);\n' +
        '          S.set("dataset.rows", state.ingest.rows);\n' +
        '          S.set("dataset.columns", state.ingest.columns);\n' +
        '          S.set("dataset.name", state.ingest.sourceName || "embedded");\n' +
        '          S.set("dataset.source", "embedded");\n' +
        '        }\n' +
        '      });\n' +
        '      if (window.Solstice.Canvas && window.Solstice.Canvas.render) window.Solstice.Canvas.render();\n' +
        '      console.log("%c[Solstice] Estado embedded rehidratado", "color:#4ADE80;font-weight:bold;");\n' +
        '    } catch(e){ console.error("[Solstice] Rehidratação falhou:", e); }\n' +
        '  }\n' +
        '  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ setTimeout(rehydrate, 200); });\n' +
        '  else setTimeout(rehydrate, 200);\n' +
        '})();\n' +
        '<\/script>\n';
      return out.replace(/<\/body>/i, hydration + '</body>');
    }

    async function openExportModal(){
      await SolsticeModal.show({
        title: '⬇️ Exportar dashboard',
        size: 'lg',
        body: (close) => {
          const wrap = SolsticeUtils.el('div', { class:'solstice__export-options' });

          const optA = SolsticeUtils.el('div', { class:'solstice__export-option', onclick: async () => {
            // Auditoria 2026 (M-L-1 / A-801): se dataset é banco_pj,
            // exige confirmação explícita — quem receber este arquivo
            // verá os dados crus.
            const dict = SolsticeStore.get('dictionary') || {};
            const isPJ = dict._presetKey === 'banco_pj';
            if (isPJ){
              const ok = await SolsticeModal.confirm({
                title: '⚠️ Exportar HTML com dados de Carteira PJ',
                message: 'Este arquivo conterá o dataset embutido em texto comprimido — qualquer pessoa que abrir verá os dados. Compartilhe apenas com destinatários autorizados.',
                danger: true,
                confirmLabel: 'Sim, exportar mesmo assim',
                cancelLabel: 'Cancelar'
              });
              if (!ok) return;
            }
            const html = buildStandaloneHTML({ includeData: true });
            const blob = new Blob([html], { type: 'text/html' });
            await SolsticeFileSystem.saveBlob(blob, 'solstice-dashboard-' + Date.now() + '.html');
            SolsticeToast.success('HTML exportado', Math.round(blob.size / 1024) + ' KB');
            SolsticeAudit.record({ action:'export_html', details:{ includeData: true, size: blob.size, presetKey: dict._presetKey || null } });
            close(null);
          }});
          optA.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-title' },
            '📄 HTML standalone com dados embutidos'));
          // Auditoria 2026 (M-L-1 / A-801): aviso de sensibilidade explícito
          // na descrição. Antes apenas "Ideal para compartilhar via e-mail".
          optA.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-desc' },
            '⚠️ Os dados ficam embutidos no arquivo HTML — qualquer pessoa que abrir vê o dataset cru. ' +
            'Inclui canvas + filtros + parâmetros + dicionário + dataset. Compartilhe apenas com destinatários autorizados.'));
          optA.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-meta' },
            'Tamanho típico: ~600 KB + dataset comprimido'));
          wrap.appendChild(optA);

          const optB = SolsticeUtils.el('div', { class:'solstice__export-option', onclick: async () => {
            const html = buildStandaloneHTML({ includeData: false });
            const blob = new Blob([html], { type: 'text/html' });
            await SolsticeFileSystem.saveBlob(blob, 'solstice-template-' + Date.now() + '.html');
            SolsticeToast.success('Template exportado', Math.round(blob.size / 1024) + ' KB');
            SolsticeAudit.record({ action:'export_html', details:{ includeData: false, size: blob.size } });
            close(null);
          }});
          optB.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-title' },
            '📑 HTML standalone SEM dados (template)'));
          optB.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-desc' },
            'Mesma estrutura — canvas, filtros, parâmetros e dicionário —  mas SEM o dataset. ' +
            'Usuário do destino importa o próprio CSV. Útil para distribuir templates de dashboard.'));
          optB.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-meta' },
            'Tamanho típico: ~600 KB'));
          wrap.appendChild(optB);

          const optC = SolsticeUtils.el('div', { class:'solstice__export-option', onclick: async () => {
            const state = SolsticeSnapshots._captureState();
            await SolsticeFileSystem.saveJSON(state, 'solstice-state-' + Date.now() + '.solstice.json');
            SolsticeToast.success('JSON exportado', 'Estado salvo · pode ser reaberto via 📂 Abrir');
            SolsticeAudit.record({ action:'export_json', details:{ size: JSON.stringify(state).length } });
            close(null);
          }});
          optC.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-title' },
            '🗂️ JSON puro (.solstice.json)'));
          optC.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-desc' },
            'Apenas o estado em JSON, sem HTML. Útil para versionar com git ou processar com scripts. ' +
            'Reabra via 📂 Abrir.'));
          optC.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-meta' },
            'Sem compressão · maior em bytes, mas legível'));
          wrap.appendChild(optC);

          // Prompt 12 v5.4: opção XLSX via SheetJS
          const optD = SolsticeUtils.el('div', { class:'solstice__export-option', onclick: async () => {
            close(null);
            await openXLSXModal();
          }});
          optD.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-title' },
            '📊 Excel (XLSX) — multi-aba com formatação'));
          optD.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-desc' },
            'Aba Dados + Resumo + 1 por componente + Metadados. Headers em negrito, currency BRL formatada, datas dd/mm/yyyy. ' +
            'Abre direto no Excel/LibreOffice/Google Sheets. Ideal para gestores não-técnicos.'));
          optD.appendChild(SolsticeUtils.el('div', { class:'solstice__export-option-meta' },
            'Tamanho típico: ~50-500 KB · usa SheetJS (CDN)'));
          wrap.appendChild(optD);

          return wrap;
        },
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn', onclick: () => close(null) }, 'Cancelar')
        ]
      });
    }

    /** Prompt 12 v5.4 — Modal pré-export XLSX com checkboxes. */
    async function openXLSXModal(){
      const ingest = SolsticeStore.get('ingest');
      if (!ingest || !ingest.rows || !ingest.rows.length){
        SolsticeToast.warn('Sem dataset', 'Importe um CSV antes de exportar XLSX.');
        return;
      }
      if (typeof XLSX === 'undefined'){
        SolsticeToast.warn('SheetJS não carregada', 'Aguarde o CDN ou recarregue a página.');
        return;
      }
      let opts = {
        includeRaw: true,
        includeSummary: true,
        includePerComponent: true,
        applyFilters: true,
        maxRows: 50000
      };
      await SolsticeModal.show({
        title: '📊 Exportar para Excel (XLSX)',
        size: 'md',
        body: () => {
          const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--c-text);' });
          function chk(label, key, hint){
            const lab = SolsticeUtils.el('label', { style:'display:flex;align-items:flex-start;gap:8px;padding:6px 8px;background:var(--c-surface-2);border-radius:var(--rad-xs);cursor:pointer;' });
            const cb = SolsticeUtils.el('input', { type:'checkbox' });
            if (opts[key]) cb.checked = true;
            cb.addEventListener('change', e => { opts[key] = !!e.target.checked; });
            lab.appendChild(cb);
            const body = SolsticeUtils.el('div', { style:'flex:1;' });
            body.appendChild(SolsticeUtils.el('div', { style:'font-weight:var(--fw-semibold);' }, label));
            if (hint) body.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-text-2);margin-top:2px;' }, hint));
            lab.appendChild(body);
            return lab;
          }
          wrap.appendChild(chk('📋 Aba "Dados" com linhas originais', 'includeRaw',
            'Todas as linhas do dataset (limitado pelo "Máx linhas por aba").'));
          wrap.appendChild(chk('📈 Aba "Resumo" com KPIs', 'includeSummary',
            'KPIs e métricas principais como tabela compacta.'));
          wrap.appendChild(chk('🧩 1 aba por componente do canvas', 'includePerComponent',
            'Cada componente gera sua própria aba com dados agregados.'));
          wrap.appendChild(chk('🔍 Aplicar filtros globais aos dados', 'applyFilters',
            'Se marcado, exporta só rows que passam pelos filtros globais ativos.'));
          const rowsLab = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--c-text-2);padding:6px 8px;' });
          rowsLab.appendChild(SolsticeUtils.el('span', null, 'Máx linhas por aba:'));
          const rowsSel = SolsticeUtils.el('select', { style:'padding:4px 8px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:12px;' });
          [[5000,'5 mil'], [50000, '50 mil (recomendado)'], [500000, '500 mil (cuidado)'], [0, 'Todas']].forEach(([v, l]) => {
            const o = SolsticeUtils.el('option', { value: String(v) }, l);
            if (v === opts.maxRows) o.selected = true;
            rowsSel.appendChild(o);
          });
          rowsSel.addEventListener('change', e => { opts.maxRows = parseInt(e.target.value, 10); });
          rowsLab.appendChild(rowsSel);
          wrap.appendChild(rowsLab);
          return wrap;
        },
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', onclick: () => close(null) }, 'Cancelar'),
          SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--primary',
            onclick: async () => {
              close(null);
              SolsticeToast.info('Gerando XLSX…', 'Pode levar alguns segundos com datasets grandes.');
              try {
                const blob = await _buildXLSX(opts);
                const name = (SolsticeStore.get('dataset.name') || 'solstice').replace(/\.[^/.]+$/, '');
                const filename = name + '-' + new Date().toISOString().slice(0,10) + '.xlsx';
                if (SolsticeFileSystem && SolsticeFileSystem.saveBlob){
                  await SolsticeFileSystem.saveBlob(blob, filename);
                } else {
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = filename;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }
                SolsticeToast.success('XLSX exportado', Math.round(blob.size / 1024) + ' KB');
                SolsticeAudit.record({ action:'export_xlsx', target:'dataset', details:{ size: blob.size, opts } });
              } catch(err){
                console.error('[XLSX export]', err);
                SolsticeToast.error('Falha no export', err.message);
              }
            }
          }, '📊 Exportar XLSX')
        ]
      });
    }

    /** Prompt 12 v5.4 — Constrói workbook XLSX e retorna Blob. */
    async function _buildXLSX(opts){
      opts = opts || {};
      const ingest = SolsticeStore.get('ingest');
      const dict = SolsticeStore.get('dictionary');
      const filters = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.get() : {};
      const sections = SolsticeStore.get('canvas.sections') || [];

      // Aplica filtros se pedido
      let activeRows = ingest.rows;
      if (opts.applyFilters && typeof SolsticeFilters !== 'undefined'){
        activeRows = SolsticeFilters.apply(ingest.rows);
      }
      const limitRows = (rs) => opts.maxRows && opts.maxRows > 0 ? rs.slice(0, opts.maxRows) : rs;

      const wb = XLSX.utils.book_new();

      // === Aba "Dados" (raw) ===
      if (opts.includeRaw){
        const rows = limitRows(activeRows);
        const aoa = [ingest.columns];
        for (const r of rows){
          aoa.push(ingest.columns.map(c => {
            const v = r[c];
            if (v == null || v === '') return null;
            // Detecta numero
            const colType = (ingest.types[c] || {}).type;
            if (colType === 'integer' || colType === 'decimal' || colType === 'currency' || colType === 'percentage'){
              // Auditoria 2026 (R-20 / A-1105 + A-301): SolsticeBR.toNumber
              // honra agrupador pt-BR. Antes, `1.234,56` virava `1.23456`
              // no Excel — soma errada para auditor.
              const n = SolsticeBR.toNumber(v);
              if (!isNaN(n)) return n;
            }
            return v;
          }));
        }
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        // Formata colunas numericas e congela header
        _applyXLSXFormatting(ws, ingest.columns, ingest.types);
        ws['!freeze'] = { ySplit: 1 };
        // B6-01 (v6-autonomous / PW-04 — Augusto power user): autofilter habilitado
        // na aba Dados. Excel mostra dropdown filter em cada coluna automaticamente.
        if (ws['!ref']){
          ws['!autofilter'] = { ref: ws['!ref'] };
        }
        XLSX.utils.book_append_sheet(wb, ws, _sheetName('Dados'));
      }

      // === Aba "Resumo" ===
      if (opts.includeSummary){
        const summaryRows = [['Métrica', 'Valor', 'Coluna', 'Notas']];
        const cols = ingest.columns;
        const numericCols = cols.filter(c => {
          const t = (ingest.types[c] || {}).type;
          return ['integer','decimal','currency','percentage'].includes(t);
        });
        summaryRows.push(['Total de linhas', ingest.rows.length, '', '']);
        summaryRows.push(['Total de colunas', cols.length, '', '']);
        summaryRows.push(['Linhas filtradas', activeRows.length, '', opts.applyFilters ? 'após filtros globais' : 'sem filtro']);
        // Stats por coluna numerica
        for (const c of numericCols.slice(0, 20)){
          const vals = activeRows.map(r => SolsticeStats.parseNum(r[c])).filter(v => !isNaN(v));
          if (!vals.length) continue;
          const sum = vals.reduce((a,b)=>a+b,0);
          const mean = sum / vals.length;
          const friendly = (dict && dict.columns && dict.columns[c] && dict.columns[c].friendlyName) || c;
          summaryRows.push(['Soma de ' + friendly, sum, c, '']);
          summaryRows.push(['Média de ' + friendly, mean, c, '']);
          const sorted = vals.slice().sort((a,b)=>a-b);
          const median = sorted.length % 2 ? sorted[(sorted.length-1)/2] : (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2;
          summaryRows.push(['Mediana de ' + friendly, median, c, '']);
          summaryRows.push(['Mín ' + friendly, SolsticeStats.min(vals), c, '']);
          summaryRows.push(['Máx ' + friendly, SolsticeStats.max(vals), c, '']);
        }
        const ws = XLSX.utils.aoa_to_sheet(summaryRows);
        ws['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 20 }, { wch: 24 }];
        ws['!freeze'] = { ySplit: 1 };
        XLSX.utils.book_append_sheet(wb, ws, _sheetName('Resumo'));
      }

      // === 1 aba por componente ===
      if (opts.includePerComponent){
        const usedNames = new Set();
        for (const sec of sections){
          for (const r of sec.rows){
            for (const sl of r.slots){
              if (!sl.type || sl.type === 'empty') continue;
              const aoa = _componentToSheet(sl, activeRows, ingest, dict);
              if (!aoa) continue;
              const baseName = (sl.type + '_' + (sl.config && (sl.config.column || sl.config.yColumn || sl.id.slice(0,4)) || sl.id.slice(0,4))).slice(0, 28);
              let name = baseName, n = 1;
              while (usedNames.has(name)){ name = baseName.slice(0, 26) + '_' + (n++); }
              usedNames.add(name);
              const ws = XLSX.utils.aoa_to_sheet(aoa);
              XLSX.utils.book_append_sheet(wb, ws, _sheetName(name));
            }
          }
        }
      }

      // === Aba Metadados ===
      const meta = [
        ['Solstice Dashboard Export', '', ''],
        ['Data', new Date().toLocaleString('pt-BR'), ''],
        ['Dataset', SolsticeStore.get('dataset.name') || '(sem nome)', ''],
        ['Total linhas (originais)', ingest.rows.length, ''],
        ['Total colunas', ingest.columns.length, ''],
        ['Total linhas exportadas (após filtros)', activeRows.length, ''],
        ['Limite de linhas por aba', opts.maxRows || 'sem limite', ''],
        ['Dicionário ativo', dict ? (dict.name || dict._presetKey || dict.domain || 'custom') : 'nenhum', ''],
        ['', '', ''],
        ['Filtros globais ativos', '', '']
      ];
      if (filters && filters.byColumn){
        for (const [col, f] of Object.entries(filters.byColumn)){
          meta.push(['  ' + col, JSON.stringify(f), '']);
        }
      } else if (Object.keys(filters || {}).length){
        meta.push(['  (estado)', JSON.stringify(filters), '']);
      } else {
        meta.push(['  (nenhum)', '', '']);
      }
      meta.push(['', '', '']);
      meta.push(['Sections (canvas)', String(sections.length), '']);
      meta.push(['Componentes (slots)', String(sections.reduce((acc, s) => acc + s.rows.reduce((ac, r) => ac + r.slots.length, 0), 0)), '']);
      const wsMeta = XLSX.utils.aoa_to_sheet(meta);
      wsMeta['!cols'] = [{ wch: 36 }, { wch: 40 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsMeta, _sheetName('Metadados'));

      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    /** Aplica formatação por tipo nas colunas numéricas/data + auto-width. */
    function _applyXLSXFormatting(ws, columns, types){
      const colWidths = [];
      for (let i = 0; i < columns.length; i++){
        const c = columns[i];
        const t = (types[c] || {}).type;
        let fmt = null;
        if (t === 'currency') fmt = '[$R$ ]#,##0.00';
        else if (t === 'percentage') fmt = '0.00%';
        else if (t === 'integer') fmt = '#,##0';
        else if (t === 'decimal') fmt = '#,##0.00';
        else if (t === 'date_only') fmt = 'dd/mm/yyyy';
        else if (t === 'temporal') fmt = 'dd/mm/yyyy hh:mm';
        if (fmt){
          // Aplica formato em todas células da coluna (skip header)
          const range = XLSX.utils.decode_range(ws['!ref']);
          for (let R = range.s.r + 1; R <= range.e.r; R++){
            const ref = XLSX.utils.encode_cell({ c: i, r: R });
            if (ws[ref]) ws[ref].z = fmt;
          }
        }
        colWidths.push({ wch: Math.min(40, Math.max(10, c.length + 2)) });
      }
      ws['!cols'] = colWidths;
    }

    /** Nome de aba XLSX (max 31 chars, sem chars proibidos). */
    function _sheetName(name){
      return String(name).slice(0, 31).replace(/[\\\/\?\*\[\]:]/g, '_');
    }

    /** Para cada componente, gera AoA com dados agregados específicos do tipo. */
    function _componentToSheet(slot, rows, ingest, dict){
      const cfg = slot.config || {};
      const type = slot.type;
      const friendly = (col) => (dict && dict.columns && dict.columns[col] && dict.columns[col].friendlyName) || col;

      try {
        if (type === 'kpi' || type === 'bignum' || type === 'gauge'){
          const col = cfg.column;
          if (!col) return null;
          const vals = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
          const agg = cfg.agg || 'sum';
          const aoa = [['Métrica', 'Valor']];
          if (agg === 'sum') aoa.push(['Soma', vals.reduce((a,b)=>a+b,0)]);
          if (agg === 'avg') aoa.push(['Média', vals.reduce((a,b)=>a+b,0)/vals.length]);
          if (agg === 'count') aoa.push(['Contagem', vals.length]);
          if (agg === 'min') aoa.push(['Mínimo', SolsticeStats.min(vals)]);
          if (agg === 'max') aoa.push(['Máximo', SolsticeStats.max(vals)]);
          if (agg === 'median'){
            const s = vals.slice().sort((a,b)=>a-b);
            aoa.push(['Mediana', s.length % 2 ? s[(s.length-1)/2] : (s[s.length/2-1]+s[s.length/2])/2]);
          }
          aoa.push(['Coluna', friendly(col)]);
          aoa.push(['Agregação', agg]);
          aoa.push(['N (válidos)', vals.length]);
          return aoa;
        }
        if (type === 'table'){
          return null; // já é o conteúdo da aba Dados; evita duplicação
        }
        if (type === 'distribution'){
          const col = cfg.column;
          if (!col) return null;
          const counts = new Map();
          for (const r of rows){
            const k = r[col] == null ? '(vazio)' : String(r[col]);
            counts.set(k, (counts.get(k) || 0) + 1);
          }
          const aoa = [[friendly(col), 'Contagem', '% do total']];
          const total = rows.length || 1;
          Array.from(counts).sort((a,b) => b[1]-a[1]).forEach(([k, n]) => {
            aoa.push([k, n, n / total]);
          });
          return aoa;
        }
        if (type === 'time-series'){
          const xCol = cfg.xColumn, yCol = cfg.yColumn;
          if (!xCol || !yCol) return null;
          const aoa = [[friendly(xCol), friendly(yCol)]];
          for (const r of rows){
            const y = SolsticeStats.parseNum(r[yCol]);
            if (isNaN(y)) continue;
            aoa.push([r[xCol], y]);
          }
          return aoa;
        }
        if (type === 'scatter'){
          const xCol = cfg.xColumn, yCol = cfg.yColumn;
          if (!xCol || !yCol) return null;
          const aoa = [[friendly(xCol), friendly(yCol)]];
          for (const r of rows){
            const x = SolsticeStats.parseNum(r[xCol]), y = SolsticeStats.parseNum(r[yCol]);
            if (isNaN(x) || isNaN(y)) continue;
            aoa.push([x, y]);
          }
          return aoa;
        }
        if (type === 'boxplot'){
          const col = cfg.valueColumn;
          if (!col) return null;
          const vals = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
          if (!vals.length) return null;
          // Auditoria 2026.2 (MC-A1): usa SolsticeStats.quartiles (interpolação
          // linear, type-7 igual NumPy) em vez da aproximação grosseira
          // `s[Math.floor(p*(n-1))]`. Antes o XLSX exportava Q1/Q3 diferentes
          // do box plot renderizado — auditor reabria caso de "número não bate".
          const qres = SolsticeStats.quartiles(vals);
          if (!qres) return null;
          return [
            ['Estatística', 'Valor'],
            ['N', vals.length],
            ['Mín', qres.min],
            ['Q1', qres.q1],
            ['Mediana', qres.median],
            ['Q3', qres.q3],
            ['Máx', qres.max],
            ['IQR', qres.iqr],
            ['Coluna', friendly(col)]
          ];
        }
        return null;
      } catch(err){
        return null;
      }
    }

    return { buildStandaloneHTML, openExportModal, openXLSXModal, _buildXLSX };
  })();
