
  /* ============================================================
     SolsticeRelationships (SOL-B1) — Modelo de Dados
     Define vínculos entre datasets do MultiCSV (1:1, 1:N, N:1).
     Valida cardinalidade contra os dados reais e expõe colunas
     joined no ctx do componente (prefixadas pelo nome da base destino),
     pra que colSelect dropdowns mostrem "<base>.<coluna>" automaticamente.
     UI: painel "🔗 Modelo de Dados" na sidebar de Dados, abaixo das bases.
     ============================================================ */
  const SolsticeRelationships = (function(){
    const STORE_KEY = 'relationships';

    function list(){ return SolsticeStore.get(STORE_KEY) || []; }
    function get(id){ return list().find(r => r.id === id) || null; }

    /**
     * DEDUP2 v4 (Auditoria 2026.4): auto-detect de relacionamentos por
     * similaridade de nome de coluna entre bases. Antes mostrava "0 relacionamentos"
     * mesmo quando havia colunas chave óbvias com nomes próximos (ex: base A
     * tem "ID_Atendimento", base B tem "id_atend" → não detectava).
     * Agora normaliza nomes (lowercase + remove _) e sugere 1:N quando match.
     * Heurística: normaliza (lowercase, sem _-), pega prefixo comum mínimo 3 chars.
     * Cardinalidade inferida: lado com valores únicos = "1", outro = "N".
     */
    function _normColName(s){
      return String(s||'').toLowerCase().replace(/[_\-\s]+/g,'').replace(/[^a-z0-9]/g,'');
    }
    function suggestAuto(){
      const ds = _datasets();
      if (ds.length < 2) return [];
      const existing = list();
      const _exists = (a, ca, b, cb) => existing.some(r =>
        (r.fromDatasetId === a && r.fromColumn === ca && r.toDatasetId === b && r.toColumn === cb) ||
        (r.fromDatasetId === b && r.fromColumn === cb && r.toDatasetId === a && r.toColumn === ca));
      const suggestions = [];
      for (let i = 0; i < ds.length; i++){
        for (let j = i + 1; j < ds.length; j++){
          const A = ds[i], B = ds[j];
          (A.columns || []).forEach(cA => {
            const nA = _normColName(cA);
            if (nA.length < 3) return; // evita "id" puro (muito genérico)
            (B.columns || []).forEach(cB => {
              const nB = _normColName(cB);
              if (nB.length < 3) return;
              if (nA === nB || nA.indexOf(nB) === 0 || nB.indexOf(nA) === 0){
                if (_exists(A.id, cA, B.id, cB)) return;
                // Inferir cardinalidade
                const _unique = (rows, col) => {
                  const s = new Set();
                  for (const r of (rows||[])){ const v = r[col]; if (v != null && v !== '') s.add(String(v)); }
                  return s.size === (rows||[]).filter(r => r[col] != null && r[col] !== '').length;
                };
                const aUnique = _unique(A.rows, cA);
                const bUnique = _unique(B.rows, cB);
                let cardinality = 'N:N';
                if (aUnique && bUnique) cardinality = '1:1';
                else if (aUnique && !bUnique) cardinality = '1:N';
                else if (!aUnique && bUnique) cardinality = 'N:1';
                suggestions.push({
                  fromDatasetId: A.id, fromColumn: cA,
                  toDatasetId:   B.id, toColumn:   cB,
                  cardinality,
                  similarity: nA === nB ? 1.0 : (Math.min(nA.length, nB.length) / Math.max(nA.length, nB.length)),
                  reason: nA === nB ? 'nomes iguais (normalizados)' : 'prefixo comum'
                });
              }
            });
          });
        }
      }
      // Ordena por similaridade desc
      suggestions.sort((a,b) => b.similarity - a.similarity);
      return suggestions;
    }
    function _id(){ return 'rel_' + Date.now().toString(36) + '_' + Math.floor(Math.random()*1000); }
    function _save(arr){ SolsticeStore.set(STORE_KEY, arr); }
    function _datasets(){ return SolsticeStore.get('datasets') || []; }
    function _datasetById(id){ return _datasets().find(d => d.id === id); }

    function validate(rel){
      const fromDs = _datasetById(rel.fromDatasetId);
      const toDs   = _datasetById(rel.toDatasetId);
      if (!fromDs || !toDs) return { ok:false, summary:'Base não encontrada.', issues:['Selecione bases válidas.'], mismatch:true };
      const fromRows = fromDs.rows || [];
      const toRows = toDs.rows || [];
      const fromCounts = {}; const toCounts = {};
      fromRows.forEach(r => { const v = r[rel.fromColumn]; if (v == null || v === '') return; const k = String(v); fromCounts[k] = (fromCounts[k]||0)+1; });
      toRows.forEach(r => { const v = r[rel.toColumn]; if (v == null || v === '') return; const k = String(v); toCounts[k] = (toCounts[k]||0)+1; });
      const fromDup = Object.values(fromCounts).filter(c => c > 1).length;
      const toDup   = Object.values(toCounts).filter(c => c > 1).length;
      const fromUnique = fromDup === 0;
      const toUnique = toDup === 0;
      let expFromUnique, expToUnique;
      if (rel.cardinality === '1:1'){ expFromUnique = true;  expToUnique = true;  }
      else if (rel.cardinality === '1:N'){ expFromUnique = true;  expToUnique = false; }
      else if (rel.cardinality === 'N:1'){ expFromUnique = false; expToUnique = true;  }
      else { expFromUnique = false; expToUnique = false; }
      const issues = [];
      if (expFromUnique && !fromUnique) issues.push('"' + rel.fromColumn + '" em ' + fromDs.name + ' tem ' + fromDup + ' valor(es) repetido(s); cardinalidade ' + rel.cardinality + ' espera único.');
      if (expToUnique && !toUnique) issues.push('"' + rel.toColumn + '" em ' + toDs.name + ' tem ' + toDup + ' valor(es) repetido(s); cardinalidade ' + rel.cardinality + ' espera único.');
      const fromKeys = Object.keys(fromCounts);
      const toKeysSet = new Set(Object.keys(toCounts));
      const matchCount = fromKeys.filter(k => toKeysSet.has(k)).length;
      const summary = matchCount + ' chave(s) em comum (de ' + fromKeys.length + ' em ' + fromDs.name + ' e ' + toKeysSet.size + ' em ' + toDs.name + ').';
      return { ok: issues.length === 0, summary, issues, mismatch: issues.length > 0, matchCount };
    }

    function create(spec){
      const rel = Object.assign({ id: _id() }, spec);
      const v = validate(rel);
      const arr = list().slice();
      arr.push(rel);
      _save(arr);
      if (v.ok) SolsticeToast.success('Relacionamento criado', v.summary);
      else      SolsticeToast.warn('Relacionamento criado com avisos', v.issues.join(' '));
      return { rel, validation: v };
    }

    function remove(id){ _save(list().filter(r => r.id !== id)); }

    // SOL-B1: enriquece ctx com colunas joined das bases relacionadas.
    // Clona rows (não muta) e adiciona ds.colname com valor resolvido via FK.
    function enrich(ctx, baseDatasetId){
      const rels = list().filter(r => r.fromDatasetId === baseDatasetId);
      if (!rels.length) return ctx;
      const newCols = ctx.columns.slice();
      const newTypes = Object.assign({}, ctx.types);
      const newRows = ctx.rows.map(r => Object.assign({}, r));
      rels.forEach(rel => {
        const toDs = _datasetById(rel.toDatasetId);
        if (!toDs) return;
        const toName = (toDs.name || rel.toDatasetId).replace(/[^a-zA-Z0-9_]+/g, '_');
        const lookup = new Map();
        (toDs.rows || []).forEach(row => {
          const k = row[rel.toColumn];
          if (k == null || k === '') return;
          const key = String(k);
          if (!lookup.has(key)) lookup.set(key, row);
        });
        (toDs.columns || []).forEach(c => {
          if (c === rel.toColumn) return;
          const joinedCol = toName + '.' + c;
          if (newCols.indexOf(joinedCol) < 0){
            newCols.push(joinedCol);
            if (toDs.types && toDs.types[c]) newTypes[joinedCol] = toDs.types[c];
          }
        });
        newRows.forEach(row => {
          const fromVal = row[rel.fromColumn];
          if (fromVal == null) return;
          const matched = lookup.get(String(fromVal));
          if (!matched) return;
          (toDs.columns || []).forEach(c => {
            if (c === rel.toColumn) return;
            row[toName + '.' + c] = matched[c];
          });
        });
      });
      return Object.assign({}, ctx, { columns: newCols, types: newTypes, rows: newRows, rowsAll: newRows });
    }

    function _openCreateModal(){
      const datasets = _datasets();
      if (datasets.length < 2){
        SolsticeToast.warn('Pelo menos 2 bases carregadas', 'Importe outra base via 📁 Importar antes de criar relacionamento.');
        return;
      }
      const local = {
        fromDatasetId: datasets[0].id,
        toDatasetId:   datasets[1].id,
        fromColumn: '', toColumn: '',
        cardinality: '1:N'
      };
      function _colsOf(id){ const d = _datasetById(id); return (d && d.columns) || []; }
      function _autoCol(a, b){
        const aCols = _colsOf(a);
        const bSet = new Set(_colsOf(b));
        return aCols.find(c => bSet.has(c)) || aCols[0] || '';
      }
      local.fromColumn = _autoCol(local.fromDatasetId, local.toDatasetId);
      local.toColumn   = _autoCol(local.toDatasetId,   local.fromDatasetId);

      const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:12px;font-size:13px;' });
      wrap.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:12px;line-height:1.4;' },
        'Vínculo entre 2 bases por chave (ID comum). Solstice valida a cardinalidade contra os dados reais.'));

      function _dsSelect(currentId, onChange){
        const sel = SolsticeUtils.el('select', { class:'solstice__props-select' });
        datasets.forEach(d => {
          const o = SolsticeUtils.el('option', { value: d.id }, d.name + ' (' + (d.rows ? d.rows.length : 0) + ' linhas)');
          if (d.id === currentId) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', e => onChange(e.target.value));
        return sel;
      }
      function _colSelect(dsId, currentCol, onChange){
        const sel = SolsticeUtils.el('select', { class:'solstice__props-select' });
        _colsOf(dsId).forEach(c => {
          const o = SolsticeUtils.el('option', { value: c }, c);
          if (c === currentCol) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', e => onChange(e.target.value));
        return sel;
      }

      const fromBox = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--c-surface-2);border-radius:6px;' });
      fromBox.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;font-size:11px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.05em;' }, '▶ Base origem'));
      const fromDsSel = _dsSelect(local.fromDatasetId, v => { local.fromDatasetId = v; local.fromColumn = _autoCol(v, local.toDatasetId); _rebuildCols(); });
      const fromColSel = _colSelect(local.fromDatasetId, local.fromColumn, v => { local.fromColumn = v; _refresh(); });
      fromBox.appendChild(fromDsSel);
      fromBox.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);' }, 'Coluna chave:'));
      fromBox.appendChild(fromColSel);
      wrap.appendChild(fromBox);

      const cardBox = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:6px;' });
      cardBox.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;font-size:12px;' }, '🔢 Cardinalidade'));
      [
        ['1:1', '1 ↔ 1 (chave única em ambos os lados)'],
        ['1:N', '1 → N (chave única na origem, repetida no destino)'],
        ['N:1', 'N ← 1 (chave repetida na origem, única no destino)']
      ].forEach(([v, l]) => {
        const r = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;' });
        const rb = SolsticeUtils.el('input', { type:'radio', name:'rel-cardinality', value: v });
        if (local.cardinality === v) rb.checked = true;
        rb.addEventListener('change', () => { local.cardinality = v; _refresh(); });
        r.appendChild(rb);
        r.appendChild(SolsticeUtils.el('span', null, ' ' + l));
        cardBox.appendChild(r);
      });
      wrap.appendChild(cardBox);

      const toBox = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--c-surface-2);border-radius:6px;' });
      toBox.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;font-size:11px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.05em;' }, '◀ Base destino'));
      const toDsSel = _dsSelect(local.toDatasetId, v => { local.toDatasetId = v; local.toColumn = _autoCol(v, local.fromDatasetId); _rebuildCols(); });
      const toColSel = _colSelect(local.toDatasetId, local.toColumn, v => { local.toColumn = v; _refresh(); });
      toBox.appendChild(toDsSel);
      toBox.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);' }, 'Coluna chave:'));
      toBox.appendChild(toColSel);
      wrap.appendChild(toBox);

      const preview = SolsticeUtils.el('div', { style:'padding:8px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:6px;font-size:11px;line-height:1.4;color:var(--c-text-2);' });
      wrap.appendChild(preview);

      function _refresh(){
        const v = validate({
          fromDatasetId: local.fromDatasetId, fromColumn: local.fromColumn,
          toDatasetId: local.toDatasetId, toColumn: local.toColumn,
          cardinality: local.cardinality
        });
        preview.innerHTML = '';
        if (v.ok){
          preview.style.borderColor = 'var(--c-success)';
          preview.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-success);font-weight:600;' }, '✓ Cardinalidade consistente'));
        } else {
          preview.style.borderColor = 'var(--c-warn)';
          preview.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-warn);font-weight:600;' }, '⚠ Cardinalidade inconsistente com os dados'));
          (v.issues || []).forEach(iss => preview.appendChild(SolsticeUtils.el('div', null, '• ' + iss)));
        }
        preview.appendChild(SolsticeUtils.el('div', { style:'margin-top:4px;color:var(--c-muted);' }, v.summary));
      }
      function _rebuildCols(){
        fromColSel.innerHTML = '';
        _colsOf(local.fromDatasetId).forEach(c => {
          const o = SolsticeUtils.el('option', { value: c }, c);
          if (c === local.fromColumn) o.selected = true;
          fromColSel.appendChild(o);
        });
        toColSel.innerHTML = '';
        _colsOf(local.toDatasetId).forEach(c => {
          const o = SolsticeUtils.el('option', { value: c }, c);
          if (c === local.toColumn) o.selected = true;
          toColSel.appendChild(o);
        });
        _refresh();
      }
      _refresh();

      SolsticeModal.show({
        title: '🔗 Novo relacionamento',
        size: 'md',
        body: wrap,
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', onclick: () => close(null) }, 'Cancelar'),
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary',
            onclick: () => {
              if (!local.fromColumn || !local.toColumn){ SolsticeToast.warn('Escolha colunas em ambos os lados'); return; }
              create(local);
              close(null);
            }
          }, 'Salvar relacionamento')
        ]
      });
    }

    function _renderPanel(){
      const host = document.getElementById('v56-relationships-panel');
      if (!host) return;
      host.innerHTML = '';
      host.appendChild(SolsticeUtils.el('div', { class:'v56-datasets__title' },
        SolsticeUtils.el('span', null, '🔗 Relacionamentos'),
        SolsticeUtils.el('button', { class:'v56-datasets__add', title:'Criar relacionamento entre bases', onclick: _openCreateModal }, '+ Relação')
      ));
      const arr = list();
      const datasets = _datasets();

      // DEDUP2 v4 (Auditoria 2026.4): mostra sugestões auto-detectadas por
      // similaridade de nome de coluna (ex: ID_Atendimento ↔ id_atend).
      // Antes a UI mostrava "0 relacionamentos" mesmo quando colunas óbvias casavam.
      const sugg = suggestAuto();
      if (sugg.length){
        const suggBox = SolsticeUtils.el('div', {
          style:'margin:6px 0 8px;padding:8px;background:color-mix(in srgb, var(--c-accent) 6%, var(--c-surface));border:1px dashed color-mix(in srgb, var(--c-accent) 35%, transparent);border-radius:var(--rad-sm);'
        });
        suggBox.appendChild(SolsticeUtils.el('div', {
          style:'font-size:10px;color:var(--c-accent);font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;'
        }, '💡 ' + sugg.length + ' relacionamento(s) sugerido(s)'));
        sugg.slice(0, 3).forEach(s => {
          const fromDs = datasets.find(d => d.id === s.fromDatasetId);
          const toDs   = datasets.find(d => d.id === s.toDatasetId);
          const row = SolsticeUtils.el('div', {
            style:'display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;'
          });
          row.appendChild(SolsticeUtils.el('div', { style:'flex:1;min-width:0;overflow:hidden;' },
            SolsticeUtils.el('div', { style:'font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' },
              (fromDs ? fromDs.name : '?') + ' ' + s.cardinality + ' ' + (toDs ? toDs.name : '?')),
            SolsticeUtils.el('div', { style:'font-family:var(--font-mono);font-size:10px;color:var(--c-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' },
              s.fromColumn + ' ↔ ' + s.toColumn)
          ));
          row.appendChild(SolsticeUtils.el('button', {
            class:'v56-datasets__add',
            style:'font-size:10px;padding:3px 8px;',
            title:'Aplicar este relacionamento (' + s.reason + ')',
            onclick: () => {
              create({
                fromDatasetId: s.fromDatasetId, fromColumn: s.fromColumn,
                toDatasetId: s.toDatasetId, toColumn: s.toColumn,
                cardinality: s.cardinality
              });
              _renderPanel();
            }
          }, '✓ Aplicar'));
          suggBox.appendChild(row);
        });
        host.appendChild(suggBox);
      }

      const listEl = SolsticeUtils.el('div', { class:'v56-datasets__list', style:'max-height:220px;overflow-y:auto;' });
      if (!arr.length){
        listEl.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);padding:6px;text-align:center;line-height:1.4;' },
          sugg.length
            ? 'Aplique uma das sugestões acima ou crie manualmente.'
            : 'Sem relacionamentos. Defina vínculos entre 2 bases por ID comum pra usar colunas cruzadas em componentes.'));
      } else {
        // S5-03 (Sprint 5 / Marcos PowerBI · MA-01, MA-02): visual de vínculos
        // agrupado POR dataset de origem. Antes era lista plana de "A → B".
        // Agora: "📁 vendas" header com filhos "↳ produtos (1:N) · id ↔ id" abaixo.
        // Cardinalidade ganha cor visual: 1:1 (azul), 1:N (verde), N:N (laranja).
        const CARD_COLORS = { '1:1': 'var(--c-accent)', '1:N': 'var(--c-success)', 'N:1': 'var(--c-success)', 'N:N': 'var(--c-warn)' };
        const byFrom = new Map();
        arr.forEach(r => {
          if (!byFrom.has(r.fromDatasetId)) byFrom.set(r.fromDatasetId, []);
          byFrom.get(r.fromDatasetId).push(r);
        });
        byFrom.forEach((rels, fromId) => {
          const fromDs = datasets.find(d => d.id === fromId);
          // Header da pasta-origem
          const grpHead = SolsticeUtils.el('div', {
            style:'font-size:11px;font-weight:600;color:var(--c-text);padding:6px 4px 2px;display:flex;align-items:center;gap:6px;'
          });
          grpHead.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true' }, '📁'));
          grpHead.appendChild(SolsticeUtils.el('span', { style:'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;' },
            (fromDs ? fromDs.name : '?')));
          grpHead.appendChild(SolsticeUtils.el('span', { style:'font-size:10px;color:var(--c-muted);font-weight:400;' },
            rels.length + ' vínculo' + (rels.length > 1 ? 's' : '')));
          listEl.appendChild(grpHead);
          // Filhos (vínculos saindo dessa origem)
          rels.forEach(rel => {
            const toDs   = datasets.find(d => d.id === rel.toDatasetId);
            const item = SolsticeUtils.el('div', {
              class:'v56-dataset-item',
              style:'margin-left:14px;border-left:2px solid ' + (CARD_COLORS[rel.cardinality] || 'var(--c-border)') + ';padding-left:8px;'
            });
            const main = SolsticeUtils.el('div', { style:'flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:column;gap:1px;' });
            // Linha 1: "↳ destinoDataset" + badge cardinalidade
            const line1 = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:6px;font-size:11px;' });
            line1.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-muted);' }, '↳'));
            line1.appendChild(SolsticeUtils.el('span', { style:'font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' },
              (toDs ? toDs.name : '?')));
            line1.appendChild(SolsticeUtils.el('span', {
              style:'font-family:var(--font-mono);font-size:9px;padding:1px 6px;border-radius:8px;background:color-mix(in srgb, ' + (CARD_COLORS[rel.cardinality] || 'var(--c-border)') + ' 18%, transparent);color:' + (CARD_COLORS[rel.cardinality] || 'var(--c-text)') + ';font-weight:600;'
            }, rel.cardinality || '1:N'));
            main.appendChild(line1);
            // Linha 2: colunas vinculadas
            main.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);font-family:var(--font-mono);' },
              rel.fromColumn + ' ↔ ' + rel.toColumn));
            item.appendChild(main);
            item.appendChild(SolsticeUtils.el('button', {
              class:'v56-dataset-item__rm', title:'Remover relacionamento',
              onclick: (e) => { e.stopPropagation(); remove(rel.id); _renderPanel(); SolsticeToast.info('Relacionamento removido'); }
            }, '×'));
            listEl.appendChild(item);
          });
        });
      }
      host.appendChild(listEl);
    }

    function _mountPanel(){
      // DEDUP1 v4 (Auditoria 2026.4): Relacionamentos vive agora em #modelo-panel
      // (não em #data-panel) — Modelo concentra TUDO sobre bases e suas conexões.
      const dataPanel = document.getElementById('modelo-panel') || document.getElementById('data-panel');
      if (!dataPanel){ setTimeout(_mountPanel, 400); return; }
      if (document.getElementById('v56-relationships-panel')){ _renderPanel(); return; }
      const panel = SolsticeUtils.el('div', { class:'v56-datasets', id:'v56-relationships-panel', style:'margin-top:8px;' });
      const bases = document.getElementById('v56-datasets-panel');
      if (bases && bases.parentNode) bases.parentNode.insertBefore(panel, bases.nextSibling);
      else dataPanel.appendChild(panel);
      _renderPanel();
    }

    function install(){
      _mountPanel();
      try {
        SolsticeStore.subscribe(STORE_KEY, _renderPanel);
        SolsticeStore.subscribe('datasets', _renderPanel);
      } catch(_){}
      setTimeout(_mountPanel, 1000);
      setTimeout(_mountPanel, 2500);
    }

    return { list, get, create, remove, validate, enrich, install, _renderPanel, _openCreateModal, suggestAuto };
  })();
