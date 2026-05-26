
  /* ============================================================
     Patch 2 (ADR-135) — SolsticeExportData
     Export de dados (CSV filtrado, CSV completo, JSON com dashboard).
     CSV usa UTF-8 com BOM (compat Excel).
     ============================================================ */
  const SolsticeExportData = (function(){
    function _csvRow(values){
      return values.map(v => {
        const s = v == null ? '' : String(v);
        if (/[",;\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(';');  // pt-BR Excel prefere ';'
    }

    function _datasetName(){
      const n = SolsticeStore.get('dataset.name') || 'solstice';
      return String(n).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    }

    function _toCSV(rows, columns, includeMeasures){
      const lines = [_csvRow(columns)];
      for (const r of rows){
        lines.push(_csvRow(columns.map(c => r[c])));
      }
      const BOM = '﻿';
      return BOM + lines.join('\n');
    }

    function _download(content, mime, fileName){
      const blob = new Blob([content], { type: mime + ';charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 200);
    }

    function openModal(){
      const ingest = SolsticeStore.get('ingest') || {};
      const allRows = ingest.rows || [];
      const filteredRows = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.apply(allRows) : allRows;
      const filters = SolsticeStore.get('filters') || {};
      const filterCount = Object.keys(filters).length;
      const measures = ingest.calculatedMeasures || {};
      const hasMeasures = Object.keys(measures).length > 0;

      const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:12px;font-size:13px;' });

      // Tipo
      const typeWrap = SolsticeUtils.el('div', { style:'padding:10px;background:var(--c-surface-2);border-radius:6px;' });
      typeWrap.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;margin-bottom:6px;' }, 'Exportar:'));
      const opts = [
        { value:'csv-filtered', label:'CSV filtrado (apenas linhas visíveis · ' + filteredRows.length + ' de ' + allRows.length + ')' },
        { value:'csv-full', label:'CSV completo (dataset original · ' + allRows.length + ' linhas)' },
        { value:'json', label:'JSON (dados + componentes + configs)' }
      ];
      opts.forEach((o, i) => {
        const lab = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;padding:4px;cursor:pointer;' });
        const r = SolsticeUtils.el('input', { type:'radio', name:'export-type', value:o.value });
        if (i === 0) r.checked = true;
        lab.appendChild(r); lab.appendChild(SolsticeUtils.el('span', null, o.label));
        typeWrap.appendChild(lab);
      });
      wrap.appendChild(typeWrap);

      // Filtros ativos
      if (filterCount){
        const fWrap = SolsticeUtils.el('div', { style:'padding:8px;background:var(--c-surface-2);border-radius:6px;font-size:11px;color:var(--c-muted);' });
        fWrap.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;color:var(--c-text);margin-bottom:4px;' }, 'Filtros ativos:'));
        Object.keys(filters).forEach(k => {
          const v = filters[k];
          let desc = '';
          if (Array.isArray(v)) desc = v.join(', ');
          else if (v && (v.min != null || v.max != null)) desc = (v.min || '−∞') + ' a ' + (v.max || '+∞');
          else if (v && (v.from || v.to)) desc = (v.from || '') + ' → ' + (v.to || '');
          fWrap.appendChild(SolsticeUtils.el('div', null, '✓ ' + k + ': ' + desc));
        });
        wrap.appendChild(fWrap);
      }

      // Opções
      const optsWrap = SolsticeUtils.el('div', { style:'padding:8px;background:var(--c-surface-2);border-radius:6px;' });
      optsWrap.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;margin-bottom:6px;font-size:11px;' }, 'Incluir:'));
      const inclMeas = SolsticeUtils.el('input', { type:'checkbox' });
      if (hasMeasures) inclMeas.checked = true;
      const inclDict = SolsticeUtils.el('input', { type:'checkbox' });
      inclDict.checked = true;
      const labMeas = SolsticeUtils.el('label', { style:'display:flex;gap:6px;cursor:pointer;font-size:12px;' });
      labMeas.appendChild(inclMeas); labMeas.appendChild(document.createTextNode(' Medidas calculadas (' + Object.keys(measures).length + ')'));
      const labDict = SolsticeUtils.el('label', { style:'display:flex;gap:6px;cursor:pointer;font-size:12px;margin-top:4px;' });
      labDict.appendChild(inclDict); labDict.appendChild(document.createTextNode(' Dicionário semântico'));
      optsWrap.appendChild(labMeas); optsWrap.appendChild(labDict);
      wrap.appendChild(optsWrap);

      // Info encoding
      wrap.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);' },
        'Encoding: UTF-8 com BOM (compat Excel) · Separador: ;'));

      SolsticeModal.show({
        title: '⬇️ Exportar dados',
        body: wrap,
        buttons: [
          { label:'Cancelar', kind:'ghost', onClick: () => true },
          { label:'Baixar', kind:'primary', onClick: () => {
            const type = wrap.querySelector('input[name="export-type"]:checked').value;
            const ts = new Date().toISOString().slice(0,16).replace(/[T:]/g, '-');
            if (type === 'csv-filtered'){
              const cols = (ingest.columns || []).slice();
              if (!inclMeas.checked){
                // Remove medidas calculadas das colunas
                Object.keys(measures).forEach(m => { const i = cols.indexOf(m); if (i >= 0) cols.splice(i, 1); });
              }
              const csv = _toCSV(filteredRows, cols);
              _download(csv, 'text/csv', 'solstice-' + _datasetName() + '-filtrado-' + ts + '.csv');
            } else if (type === 'csv-full'){
              const cols = (ingest.columns || []).slice();
              if (!inclMeas.checked){
                Object.keys(measures).forEach(m => { const i = cols.indexOf(m); if (i >= 0) cols.splice(i, 1); });
              }
              const csv = _toCSV(allRows, cols);
              _download(csv, 'text/csv', 'solstice-' + _datasetName() + '-completo-' + ts + '.csv');
            } else {
              const state = {
                dataset: { name: SolsticeStore.get('dataset.name'), rows: filteredRows, columns: ingest.columns },
                canvas: { sections: SolsticeStore.get('canvas.sections') || [], header: SolsticeStore.get('canvas.header') || {} },
                dictionary: inclDict.checked ? SolsticeStore.get('dictionary') : null,
                calculatedMeasures: inclMeas.checked ? measures : null,
                filters,
                exportedAt: new Date().toISOString()
              };
              _download(JSON.stringify(state, null, 2), 'application/json', 'solstice-' + _datasetName() + '-' + ts + '.json');
            }
            SolsticeAudit.record({ action:'export_data', details:{ type, rows: type === 'csv-full' ? allRows.length : filteredRows.length }});
            SolsticeToast.success('Exportado');
            return true;
          }}
        ]
      });
    }

    return { openModal };
  })();
