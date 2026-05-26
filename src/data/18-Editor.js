
  /* ============================================================
     SolsticeEditor — UI inline na sidebar
     ============================================================ */
  const SolsticeEditor = (function(){

    // RC-03 (Sprint 2): hash determinístico (não-criptográfico — DJB2 + base36).
    // Mesmo valor → mesmo hash em qualquer execução, permitindo joins anonimizados.
    function _solsticeHash(s){
      let h = 5381;
      const str = String(s == null ? '' : s);
      for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
      return 'h_' + Math.abs(h).toString(36);
    }
    function _solsticeFakeName(seed){
      const first = ['Ana','Bruno','Carla','Diego','Elena','Felipe','Gabriela','Hugo','Isabel','João','Karen','Lucas','Marina','Nathan','Olívia'];
      const last  = ['Silva','Souza','Oliveira','Santos','Lima','Costa','Pereira','Rodrigues','Almeida','Carvalho','Gomes','Martins','Ferreira'];
      const h = Math.abs(parseInt(_solsticeHash(seed).slice(2), 36) || 0);
      return first[h % first.length] + ' ' + last[(h >> 4) % last.length];
    }
    function _solsticeFakeEmail(seed){
      const h = Math.abs(parseInt(_solsticeHash(seed).slice(2), 36) || 0);
      return 'user' + (h % 10000) + '@example.com';
    }
    function _solsticeFakePhone(seed){
      const h = Math.abs(parseInt(_solsticeHash(seed).slice(2), 36) || 0);
      const a = String(11 + (h % 89)).padStart(2,'0');
      const b = String((h >> 4) % 100000000).padStart(8,'0');
      return '(' + a + ') 9' + b.slice(0,4) + '-' + b.slice(4);
    }

    const TRANSFORMATIONS = {
      'trim':       { label:'Aparar espaços', fn: v => typeof v === 'string' ? v.trim() : v },
      'upper':      { label:'MAIÚSCULAS',    fn: v => typeof v === 'string' ? v.toUpperCase() : v },
      'lower':      { label:'minúsculas',    fn: v => typeof v === 'string' ? v.toLowerCase() : v },
      'titleCase':  { label:'Title Case',    fn: v => typeof v === 'string' ? v.replace(/\b\w/g, c => c.toUpperCase()) : v },
      'fillna':     { label:'Preencher nulos com 0', fn: v => (v == null || v === '') ? 0 : v },
      // Auditoria 2026 (R-01b / A-301): "Forçar número" honra pt-BR.
      'parseNum':   { label:'Forçar número', fn: v => { const n = SolsticeBR.toNumber(v); return isNaN(n) ? v : n; } },
      'parseDate':  { label:'Forçar data ISO', fn: v => { const d = new Date(v); return isNaN(d) ? v : d.toISOString().slice(0,10); } },
      'removeAccent': { label:'Sem acentos', fn: v => typeof v === 'string' ? v.normalize('NFD').replace(/[̀-ͯ]/g,'') : v },

      // RC-03 (Sprint 2): anonimização LGPD/PII one-click. 4 estratégias.
      'anonMaskCpf': { label:'🔒 Anonimizar (mascarar CPF)', fn: v => {
        if (v == null || v === '') return v;
        if (typeof SolsticeBR !== 'undefined' && SolsticeBR.maskCPF) return SolsticeBR.maskCPF(v);
        const s = String(v).replace(/\D/g, '');
        return s.length === 11 ? s.slice(0,3) + '.***.***-' + s.slice(9) : v;
      }},
      'anonHash':    { label:'🔒 Anonimizar (hash determinístico)', fn: v => (v == null || v === '') ? v : _solsticeHash(v) },
      'anonRedact':  { label:'🔒 Anonimizar (redigir totalmente)', fn: v => (v == null || v === '') ? v : '[redigido]' },
      'anonFakeName':{ label:'🔒 Anonimizar (nome fictício)',   fn: v => (v == null || v === '') ? v : _solsticeFakeName(v) },
      'anonFakeEmail':{label:'🔒 Anonimizar (email fictício)',  fn: v => (v == null || v === '') ? v : _solsticeFakeEmail(v) },
      'anonFakePhone':{label:'🔒 Anonimizar (telefone fictício)',fn: v => (v == null || v === '') ? v : _solsticeFakePhone(v) }
    };

    function _renameColumn(rows, columns, oldName, newName){
      if (!newName || newName === oldName) return { rows, columns };
      const newCols = columns.map(c => c === oldName ? newName : c);
      const newRows = rows.map(r => {
        const o = {};
        for (const c of columns) o[c === oldName ? newName : c] = r[c];
        return o;
      });
      return { rows: newRows, columns: newCols };
    }

    function _dropColumn(rows, columns, name){
      const newCols = columns.filter(c => c !== name);
      const newRows = rows.map(r => {
        const o = {};
        for (const c of newCols) o[c] = r[c];
        return o;
      });
      return { rows: newRows, columns: newCols };
    }

    function _applyTransform(rows, name, tKey){
      const t = TRANSFORMATIONS[tKey]; if (!t) return rows;
      return rows.map(r => ({ ...r, [name]: t.fn(r[name]) }));
    }

    function _changeType(types, name, newType){
      return { ...types, [name]: { ...types[name], type: newType, confidence: 1, manual: true } };
    }

    /**
     * Auditoria 2026 (RT-02): sub-função extraída de render() do SolsticeEditor.
     * Constrói o card visual de UMA coluna do editor (cabeçalho com nome editável,
     * actions, info estatística e fillbar de preenchimento). Independente do resto
     * da render — recebe tudo que precisa pelos parâmetros.
     */
    function _buildColumnCard(col, ingest, dict){
      const { rows, columns, types } = ingest;
      const t = types[col];
      const colIssue = ingest.issues.byColumn[col] || { nulls: 0, invalid: 0 };
      const filledCount = rows.length - colIssue.nulls;
      const filledPct = rows.length > 0 ? Math.round((filledCount / rows.length) * 100) : 0;
      const uniqCount = new Set(rows.map(r => r[col])).size;
      const unit = (dict && dict.columns && dict.columns[col] && dict.columns[col].unit) || '';

      const card = SolsticeUtils.el('div', { class:'solstice__editor-col' });

      // Linha 1: ícone + nome editável + actions
      const head = SolsticeUtils.el('div', { class:'solstice__editor-col-head' });
      head.appendChild(SolsticeUtils.el('span', { class:'solstice__editor-col-icon', 'aria-hidden':'true' }, SolsticeTypes.icon(t.type)));

      const nameSpan = SolsticeUtils.el('span', {
        class:'solstice__editor-col-name',
        title: col + ' · clique para renomear', // Auditoria 2026.6: nome completo no hover (elipsa quando longo)
        onclick: function(){ this.contentEditable = 'true'; this.focus(); }
      }, col);
      nameSpan.addEventListener('blur', function(){
        this.contentEditable = 'false';
        const newName = this.textContent.trim();
        if (newName && newName !== col){
          if (columns.indexOf(newName) >= 0){
            SolsticeToast.warn('Já existe coluna', '"'+newName+'" já existe');
            this.textContent = col;
            return;
          }
          const upd = _renameColumn(rows, columns, col, newName);
          const newTypes = { ...types, [newName]: types[col] }; delete newTypes[col];
          SolsticeStore.set('ingest', { ...ingest, rows: upd.rows, columns: upd.columns, types: newTypes });
          renderPreview(); render(); updateQualityCard();
          SolsticeToast.info('Coluna renomeada', col + ' → ' + newName);
        }
      });
      nameSpan.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); this.blur(); } });
      head.appendChild(nameSpan);

      const actions = SolsticeUtils.el('span', { class:'solstice__editor-col-actions' });
      actions.append(
        SolsticeUtils.el('button', { class:'solstice__editor-col-btn', title:'Mudar tipo', onclick: () => _openTypeMenu(col, t.type) }, '🏷️'),
        SolsticeUtils.el('button', {
          class:'solstice__editor-col-btn',
          title:'Corrigir conceito (aprendizado local)',
          onclick: () => _openConceptCorrection(col)
        }, '✏️'),
        SolsticeUtils.el('button', { class:'solstice__editor-col-btn', title:'Transformar', onclick: () => _openTransformMenu(col) }, '⚡'),
        SolsticeUtils.el('button', { class:'solstice__editor-col-btn', title:'Remover coluna', onclick: () => _confirmDrop(col) }, '🗑️')
      );
      head.appendChild(actions);
      card.appendChild(head);

      // Linha 2: tipo · conceito · unidade · sumário (média/range/únicos)
      card.appendChild(_buildColumnInfo(col, t, rows, unit, uniqCount, card));

      // Linha 3: fillbar (preenchimento)
      card.appendChild(_buildColumnFillRow(filledPct, filledCount, rows.length));
      return card;
    }

    /** Auditoria 2026 (RT-02): info estatística da coluna (tipo · conceito · sumário). */
    function _buildColumnInfo(col, t, rows, unit, uniqCount, card){
      const info = SolsticeUtils.el('div', { class:'solstice__editor-col-info' });
      info.appendChild(SolsticeUtils.el('span', null, SolsticeTypes.label(t.type)));
      if (t.concept && t.manuallyCorrected){
        info.appendChild(SolsticeUtils.el('span', { class:'solstice__editor-col-info-sep' }, '·'));
        info.appendChild(SolsticeUtils.el('span', {
          style: 'color:var(--c-accent);font-family:var(--font-mono);font-size:10px;',
          title: 'Conceito corrigido manualmente: ' + t.concept
        }, '⭐ ' + t.concept));
      } else if (t.concept){
        const iconEl = card.querySelector('.solstice__editor-col-icon');
        if (iconEl) iconEl.title = SolsticeTypes.label(t.type) + ' · conceito: ' + t.concept;
      }
      if (unit){
        info.appendChild(SolsticeUtils.el('span', { class:'solstice__editor-col-info-sep' }, '·'));
        info.appendChild(SolsticeUtils.el('span', null, unit));
      }
      const _group = SolsticeTypes.group(t.type);
      let _rightSummary = null;
      if (_group === 'numeric'){
        // Auditoria 2026.6 (BIG-DATA): passada única (sem alocar array de N
        // valores por render) — reduz o custo do re-render em base grande.
        let _sum = 0, _vcount = 0;
        for (let i = 0; i < rows.length; i++){
          const n = SolsticeStats.parseNum(rows[i][col]);
          if (isNaN(n)) continue;
          _sum += n; _vcount++;
        }
        if (_vcount){
          const _avg = _sum / _vcount;
          const _fmt = (n) => Math.abs(n) >= 1000 ? SolsticeLocale.integer(Math.round(n)) : SolsticeLocale.decimal(n, 2);
          _rightSummary = {
            text: 'média ' + _fmt(_avg) + (unit ? ' ' + unit : ''),
            title: 'Média: ' + _fmt(_avg) + (unit ? ' ' + unit : '') + ' · sobre ' + _vcount + ' valores válidos'
          };
        }
      } else if (_group === 'temporal'){
        // Auditoria 2026.6 (BIG-DATA): loop em vez de Math.min/max.apply(null, arr)
        // — o spread estourava a pilha (RangeError) com 100k+ datas. Acumula em
        // 1 passada sem alocar array de timestamps.
        let _minT = Infinity, _maxT = -Infinity, _dcount = 0;
        for (let i = 0; i < rows.length; i++){
          const d = new Date(rows[i][col]);
          const ts = d.getTime();
          if (isNaN(ts)) continue;
          _dcount++;
          if (ts < _minT) _minT = ts;
          if (ts > _maxT) _maxT = ts;
        }
        const _dates = { length: _dcount };
        if (_dates.length){
          const _min = new Date(_minT);
          const _max = new Date(_maxT);
          const _fmtD = (d) => d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });
          _rightSummary = {
            text: _fmtD(_min) + ' → ' + _fmtD(_max),
            title: 'Período: ' + _fmtD(_min) + ' até ' + _fmtD(_max) + ' (' + _dates.length + ' datas válidas)'
          };
        }
      }
      if (!_rightSummary){
        _rightSummary = {
          text: SolsticeLocale.integer(uniqCount) + ' únicos',
          title: SolsticeLocale.integer(uniqCount) + ' valores distintos'
        };
      }
      info.appendChild(SolsticeUtils.el('span', {
        class: 'solstice__editor-col-info-uniq',
        title: _rightSummary.title
      }, _rightSummary.text));
      return info;
    }

    /** Auditoria 2026 (RT-02): linha de preenchimento (fillbar + % opcional). */
    function _buildColumnFillRow(filledPct, filledCount, total){
      const fillrow = SolsticeUtils.el('div', { class:'solstice__editor-col-fillrow' });
      fillrow.appendChild(_fillBar(filledPct, filledCount, total));
      let pctClass = 'solstice__editor-col-fillpct';
      if (filledPct === 100) pctClass += ' solstice__editor-col-fillpct--success';
      else if (filledPct >= 80) pctClass += ' solstice__editor-col-fillpct--accent';
      else if (filledPct >= 60) pctClass += ' solstice__editor-col-fillpct--warn';
      else pctClass += ' solstice__editor-col-fillpct--error';
      if (filledPct < 100){
        fillrow.appendChild(SolsticeUtils.el('span', {
          class: pctClass,
          title: filledCount + ' de ' + total + ' linhas preenchidas (' + filledPct + '%)'
        }, filledPct + '%'));
      } else {
        fillrow.title = '100% preenchido · ' + total + ' linhas';
      }
      return fillrow;
    }

    /** Renderiza o editor na sidebar (#editor-panel). */
    function render(){
      const panel = document.getElementById('editor-panel');
      if (!panel) return;
      // Auditoria 2026.6 (UX — "parece que reseta"): preserva a posição de scroll
      // da sidebar através do re-render. ANTES, qualquer edit (renomear coluna,
      // mudar tipo, criar medida...) fazia panel.innerHTML='' e a sidebar pulava
      // pro topo — o usuário perdia o lugar. Restaurado no fim de render().
      const _scroller = panel.closest('.solstice__sidebar') || panel.parentElement;
      const _savedScroll = _scroller ? _scroller.scrollTop : 0;
      const ingest = SolsticeStore.get('ingest');
      if (!ingest || !ingest.columns){
        // Auditoria 2026 (MC-01): cleanup defensivo antes de descartar conteúdo.
        SolsticeUtils.cleanupListeners(panel);
        panel.innerHTML = '';
        panel.__editorFolder = null;  // FIXBUG: evita ref órfã
        return;
      }

      const { rows, columns, types } = ingest;

      // Auditoria 2026 (MC-01): cleanup defensivo antes de descartar conteúdo.
      SolsticeUtils.cleanupListeners(panel);
      panel.innerHTML = '';
      panel.__editorFolder = null;  // FIXBUG v5: limpa ref antiga antes de criar nova
                                     // (era a causa de "clica e não abre" — append ia em órfão)

      const dict = SolsticeStore.get('dictionary');

      // PASTAS v5 · Auditoria 2026.4 (JM-07): com multi-CSV, segunda base
      // importada ficava invisível na sidebar (só a ativa aparecia). Fix:
      // itera TODAS as bases carregadas — ativa = aberta, outras = fechadas
      // com lista compacta. Clique em outra base = ativa via MultiCSV.
      const activeId = SolsticeStore.get('datasets.activeId');
      const datasets = SolsticeStore.get('datasets') || [];
      const activeDsName = SolsticeStore.get('dataset.name') || 'sem_nome.csv';

      // ÍCONE v5: 🗃️ (file box) — mais "base de dados" que 📁 pasta genérica.
      const _baseIcon = '🗃️';

      // 1) Pasta ATIVA — abre por default, conteúdo rico (cards completos)
      const folderDetails = SolsticeUtils.el('details', {
        class:'solstice__editor-folder solstice__editor-folder--active',
        open: ''
      });
      const folderSummary = SolsticeUtils.el('summary', {
        class:'solstice__editor-folder-summary',
        style:'cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--c-surface-2);border:1px solid var(--c-border);border-left:3px solid var(--c-accent);border-radius:var(--rad-sm);margin-bottom:4px;font-size:12px;'
      });
      folderSummary.appendChild(SolsticeUtils.el('span', { style:'font-size:14px;' }, _baseIcon));
      folderSummary.appendChild(SolsticeUtils.el('span', {
        style:'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;'
      }, activeDsName));
      folderSummary.appendChild(SolsticeUtils.el('span', {
        style:'font-family:var(--font-mono);font-size:10px;color:var(--c-muted);'
      }, columns.length + ' col'));
      folderDetails.appendChild(folderSummary);
      panel.__editorFolder = folderDetails;
      panel.appendChild(folderDetails);

      // Patch 1A (ADR-128): virtualização leve — renderiza primeiros 30, "mostrar mais" para o resto.
      const VIRTUAL_BATCH = 30;
      const storedBatch = SolsticeStore.get('ui.editor.batchSize');
      let visibleCount = Math.min(Math.max(VIRTUAL_BATCH, storedBatch || VIRTUAL_BATCH), columns.length);
      const visibleColumns = columns.slice(0, visibleCount);

      // Auditoria 2026 (RT-02): renderização do card de coluna extraída em
      // _buildColumnCard (com _buildColumnInfo e _buildColumnFillRow). Diminui
      // render() de 278 → ~140 linhas e isola a montagem de um único card.
      visibleColumns.forEach(col => {
        const card = _buildColumnCard(col, ingest, dict);
        // DADOS1 v4: insere card DENTRO da pasta (não direto no panel)
        (panel.__editorFolder || panel).appendChild(card);
      });

      // Fix 6 (Camada 1): bloco de Medidas Calculadas movido para o TOPO da função
      // (logo após o panel.innerHTML='', antes do título das colunas).

      // Patch 1A (ADR-128): botão "Mostrar mais N colunas" quando há mais
      if (columns.length > visibleCount){
        const remaining = columns.length - visibleCount;
        const moreBtn = SolsticeUtils.el('button', {
          class:'solstice__btn',
          style:'width:100%;margin-top:8px;font-size:11px;',
          onclick: () => {
            // Re-render com mais; SolsticeEditor já é stateless, podemos só atualizar VIRTUAL_BATCH
            // Solução simples: aumenta o batch global no Store e re-renderiza
            SolsticeStore.set('ui.editor.batchSize', visibleCount + VIRTUAL_BATCH);
            render();
          }
        }, '▼ Mostrar mais ' + Math.min(VIRTUAL_BATCH, remaining) + ' coluna' + (remaining === 1 ? '' : 's') + ' (' + remaining + ' restante' + (remaining === 1 ? '' : 's') + ')');
        (panel.__editorFolder || panel).appendChild(moreBtn);
      }

      // PASTAS v6 (Sprint 25 / F-05 + F-06): renderiza outras bases como pastas
      // ABERTAS abaixo da ativa, com colunas visíveis. Antes ficavam fechadas
      // — user reclamou que "2ª base não mostra colunas". Agora vê tudo ao
      // mesmo tempo. Mantém botão Ativar pra trocar base principal.
      // F-06: mantém aqui ao invés de duplicar em Modelo — esta é a view de
      // colunas (Dados), Modelo trata da TOPOLOGIA das bases e relações.
      const otherDatasets = datasets.filter(d => d.id !== activeId);
      otherDatasets.forEach(ds => {
        const otherFolder = SolsticeUtils.el('details', {
          class:'solstice__editor-folder',
          open: '',  // Sprint 25 / F-05: aberta por default pra ver colunas
          style:'margin-top:4px;'
        });
        const otherSummary = SolsticeUtils.el('summary', {
          class:'solstice__editor-folder-summary',
          style:'cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--rad-sm);font-size:12px;opacity:0.85;'
        });
        otherSummary.appendChild(SolsticeUtils.el('span', { style:'font-size:14px;' }, _baseIcon));
        otherSummary.appendChild(SolsticeUtils.el('span', {
          style:'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
        }, ds.name));
        otherSummary.appendChild(SolsticeUtils.el('span', {
          style:'font-family:var(--font-mono);font-size:10px;color:var(--c-muted);'
        }, (ds.columns || []).length + ' col'));
        // Sprint 25 / F-07: agora 2 botões — Ativar (vira principal) e Desvincular (remove do painel)
        otherSummary.appendChild(SolsticeUtils.el('button', {
          style:'background:transparent;color:var(--c-muted);border:1px solid var(--c-border);border-radius:var(--rad-xs);padding:2px 8px;font-size:10px;cursor:pointer;',
          title:'Remover esta base do painel (arquivo original intacto)',
          onclick: async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              const ok = await SolsticeModal.confirm({
                title: 'Desvincular base?',
                message: 'A base "' + ds.name + '" será removida do painel. O arquivo original não é deletado.',
                confirmLabel: 'Desvincular',
                danger: true
              });
              if (!ok) return;
              const MC = (window.Solstice && window.Solstice.V56 && window.Solstice.V56.MultiCSV);
              if (MC && MC.remove) MC.remove(ds.id);
            } catch(_){}
          }
        }, '✕'));
        otherSummary.appendChild(SolsticeUtils.el('button', {
          style:'background:var(--c-accent);color:#fff;border:0;border-radius:var(--rad-xs);padding:2px 8px;font-size:10px;font-weight:600;cursor:pointer;',
          title:'Ativar esta base como principal do app',
          onclick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              const MC = (window.Solstice && window.Solstice.V56 && window.Solstice.V56.MultiCSV);
              if (MC && MC.activate) MC.activate(ds.id);
            } catch(_){}
          }
        }, '▶ Ativar'));
        otherFolder.appendChild(otherSummary);
        // Body com lista compacta (sem fillbar/issues — só nome + tipo).
        // Sprint 25 / F-05: aumentado limite de 15 → 30 colunas pra cobrir
        // casos mais comuns sem precisar de "+ X colunas" truncado.
        const body = SolsticeUtils.el('div', {
          style:'padding:6px 8px;display:flex;flex-direction:column;gap:2px;font-family:var(--font-mono);font-size:11px;color:var(--c-text-2);'
        });
        (ds.columns || []).slice(0, 30).forEach(c => {
          const t = (ds.types && ds.types[c] && ds.types[c].type) || '?';
          const ic = (typeof SolsticeTypes !== 'undefined' && SolsticeTypes.icon) ? (SolsticeTypes.icon(t) || '·') : '·';
          body.appendChild(SolsticeUtils.el('div', {
            style:'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
          }, ic + ' ' + c));
        });
        if ((ds.columns || []).length > 30){
          body.appendChild(SolsticeUtils.el('div', {
            style:'color:var(--c-muted);font-size:10px;margin-top:2px;'
          }, '+ ' + ((ds.columns || []).length - 30) + ' colunas — ative pra ver todas'));
        }
        otherFolder.appendChild(body);
        panel.appendChild(otherFolder);
      });

      // Auditoria 2026.6 (UX): restaura o scroll da sidebar (capturado no topo)
      // pra não "pular pro topo" a cada edit. Dois frames pra vencer o relayout.
      if (_scroller && _savedScroll){
        _scroller.scrollTop = _savedScroll;
        requestAnimationFrame(() => { try { _scroller.scrollTop = _savedScroll; } catch(_){} });
      }
    }

    async function _confirmDrop(col){
      const ok = await SolsticeModal.confirm({
        title: 'Remover coluna',
        message: 'Tem certeza que deseja remover a coluna "' + col + '"? Os dados originais não são perdidos — recarregue o CSV para restaurar.',
        confirmLabel: 'Remover',
        cancelLabel: 'Cancelar',
        danger: true
      });
      if (!ok) return;
      const ingest = SolsticeStore.get('ingest');
      const upd = _dropColumn(ingest.rows, ingest.columns, col);
      const newTypes = { ...ingest.types }; delete newTypes[col];
      SolsticeStore.set('ingest', { ...ingest, rows: upd.rows, columns: upd.columns, types: newTypes });
      renderPreview(); render(); updateQualityCard();
      SolsticeToast.warn('Coluna removida', col);
    }

    /**
     * ADR-178 (Onda 0 fix) — Corrigir conceito de uma coluna via UI da sidebar.
     * Diferente do "Mudar tipo" (que só rotula). Corrigir CONCEITO registra
     * aprendizado em SolsticeLearning → próxima coluna parecida usa esse
     * conceito automaticamente (+20 a +40 no scoring).
     * Auditoria 2026.4: botão tornado visível na sidebar (antes estava
     * enterrado em menu secundário — usuários não achavam).
     */
    async function _openConceptCorrection(col){
      const ingest = SolsticeStore.get('ingest');
      if (!ingest) return;
      const t = ingest.types[col];
      const currentConcept = (t && t.concept) || null;
      const currentType = (t && t.type) || 'dimension';

      // Mostra audit trail se houver (do SolsticeInference)
      const audit = (t && t.audit) || (typeof SolsticeInference !== 'undefined'
        ? SolsticeInference.lastAuditFor(col) : null);

      const opts = SolsticeConcepts.list().map(c => ({
        value: c.id,
        label: c.id + ' → ' + SolsticeTypes.label(c.type),
        icon: '',
        desc: c.anchors.slice(0, 5).join(', '),
        synonyms: c.anchors
      }));

      const choice = await SolsticeModal.select({
        title: 'Corrigir conceito de "' + col + '"',
        message: 'Tipo atual: ' + SolsticeTypes.label(currentType) +
          (currentConcept ? ' · Conceito: ' + currentConcept : ' · Sem conceito (fallback)') +
          (audit && audit.candidates && audit.candidates.length
            ? '\n\nTop 3 candidatos: ' + audit.candidates.slice(0, 3).map(c => c.concept_id + '(' + c.score + ')').join(', ')
            : '') +
          '\n\nEscolha o conceito correto. O sistema vai aprender: próxima coluna com tokens parecidos usa esse conceito.',
        options: opts,
        defaultValue: currentConcept,
        confirmLabel: 'Corrigir e aprender',
        searchable: 'auto',
        size: 'lg'
      });
      if (!choice || choice === currentConcept) return;

      const newConcept = SolsticeConcepts.get(choice);
      if (!newConcept) return;

      // 1) Registra aprendizado
      if (typeof SolsticeLearning !== 'undefined' && SolsticeLearning.recordCorrection){
        SolsticeLearning.recordCorrection(col, currentType, newConcept.type, choice);
      }

      // 2) Atualiza tipo no Store + UI imediatamente
      const newTypes = { ...ingest.types };
      newTypes[col] = {
        ...t,
        type: newConcept.type,
        concept: choice,
        confidence: 1.0,           // correção manual = certeza
        source: 'manual_correction',
        manuallyCorrected: true
      };
      SolsticeStore.set('ingest', { ...ingest, types: newTypes });

      // 3) Limpa cache do Inference pra re-rodar outras colunas com bonus learning
      try { SolsticeInference.clearAudit && SolsticeInference.clearAudit(); } catch(_){}

      // 4) Re-render
      render();
      try { renderPreview(); updateQualityCard(); } catch(_){}

      SolsticeToast.success('⭐ Aprendizado registrado',
        col + ' → ' + choice + ' (' + SolsticeTypes.label(newConcept.type) + ')');
    }

    async function _openTypeMenu(col, currentType){
      // Sinônimos por tipo para enriquecer a busca textual (ADR-017).
      // Ex: digitar "moeda" acha "currency"; digitar "data" acha "temporal/date_only".
      const TYPE_SYNONYMS = {
        currency:    ['moeda','dinheiro','valor','reais','real','money','currency'],
        percentage:  ['percentual','porcentagem','pct','%','percent'],
        integer:     ['inteiro','int','número','numero','count'],
        decimal:     ['decimal','float','número decimal','com vírgula','flutuante'],
        measure:     ['medida','métrica','metrica','measure','número','numero'],
        duration:    ['duração','duracao','tempo','time spent'],
        temporal:    ['data','hora','date','datetime','timestamp'],
        date_only:   ['data','date','dia','dt'],
        time_only:   ['hora','time','horário','horario'],
        timestamp:   ['timestamp','data hora','date time'],
        identifier:  ['id','identificador','chave'],
        cpf:         ['cpf','documento','pessoa física','pessoa fisica'],
        cnpj:        ['cnpj','documento','pessoa jurídica','pessoa juridica','empresa'],
        cep:         ['cep','postal','endereço','endereco'],
        hash:        ['hash','uuid','token'],
        email:       ['email','e-mail','correio','contato'],
        phone_br:    ['telefone','celular','contato','fone'],
        phone_intl:  ['telefone','phone','contato internacional'],
        url:         ['url','link','site','endereço web'],
        geo_uf:      ['uf','estado','sigla'],
        geo_country: ['país','pais','country','nação'],
        geo_lat:     ['lat','latitude','coordenada'],
        geo_lng:     ['lng','lon','long','longitude','coordenada'],
        address:     ['endereço','endereco','rua','logradouro'],
        json_encoded:['json','objeto','estrutura'],
        array_encoded:['lista','array','vetor'],
        xml_encoded: ['xml','marcação','marcacao'],
        flag:        ['sim','não','nao','booleano','bool','flag','true','false'],
        dimension:   ['dimensão','dimensao','categoria','texto'],
        ordinal:     ['ordinal','escala','ranking','nível','nivel'],
        sparse:      ['esparsa','vazia','nulos','nullable'],
        constant:    ['constante','único valor','unico valor','fixa']
      };

      // HOTFIX v5.5 #111: redesign do "mudar tipo" — Lucas pediu "abinhas + dropdown +
      // tamanho mais harmonioso". Antes: lista achatada com headers de grupo (modal lg).
      // Agora: modal XL com 3 modos de seleção convivendo:
      //   1) Dropdown <select> no topo (super rápido — escolha + Enter)
      //   2) Tabs com 6 categorias (Números/Datas/Texto/IDs/Localização/Avançado)
      //   3) Busca textual com synonyms (filtro cross-tab)
      // Card grid (2 colunas) com icon + label grande + sublinha técnica.
      const BUCKETS = [
        { key:'num',  name: 'Números',         icon:'🔢', types: ['measure','currency','percentage','integer','decimal','duration'] },
        { key:'date', name: 'Datas',           icon:'📅', types: ['temporal','date_only','time_only','timestamp'] },
        { key:'txt',  name: 'Texto/Categoria', icon:'🏷️', types: ['dimension','ordinal','flag'] },
        { key:'id',   name: 'Identificadores', icon:'🆔', types: ['identifier','cpf','cnpj','cep','hash','email','phone_br'] },
        { key:'geo',  name: 'Localização',     icon:'📍', types: ['geo_uf','geo_country','geo_lat','geo_lng','address'] },
        { key:'adv',  name: 'Avançado',        icon:'⚙️', types: ['url','phone_intl','json_encoded','array_encoded','xml_encoded','sparse','constant'] }
      ];
      const allTypes = SolsticeTypes.listTypes();
      const seenTypes = new Set();
      BUCKETS.forEach(b => {
        b.types = b.types.filter(t => allTypes.indexOf(t) !== -1);
        b.types.forEach(t => seenTypes.add(t));
      });
      // Tipos não-catalogados → bucket Avançado
      const advBucket = BUCKETS.find(b => b.key === 'adv');
      allTypes.forEach(t => { if (!seenTypes.has(t)) advBucket.types.push(t); });

      function _norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }
      function _matchesQuery(t, q){
        if (!q) return true;
        const hay = _norm([t, SolsticeTypes.label(t), (TYPE_SYNONYMS[t]||[]).join(' ')].join(' '));
        return hay.indexOf(q) >= 0;
      }
      // Bucket inicial: aba que contém o tipo atual
      const initialBucket = BUCKETS.find(b => b.types.indexOf(currentType) !== -1) || BUCKETS[0];

      const choice = await new Promise(resolve => {
        let chosen = currentType;
        let activeBucket = initialBucket.key;
        let query = '';

        // ===== Topo: dropdown rápido =====
        const dropdown = SolsticeUtils.el('select', {
          class: 'solstice__type-dropdown',
          'aria-label': 'Selecionar tipo rapidamente',
          style: 'width:100%;padding:10px 12px;font-size:14px;border:1px solid var(--c-border);border-radius:8px;background:var(--c-surface-2);color:var(--c-text);margin-bottom:14px;cursor:pointer;'
        });
        BUCKETS.forEach(b => {
          if (!b.types.length) return;
          const og = document.createElement('optgroup');
          og.label = b.icon + ' ' + b.name;
          b.types.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = (SolsticeTypes.icon(t) ? SolsticeTypes.icon(t) + ' ' : '') + SolsticeTypes.label(t);
            if (t === currentType) opt.selected = true;
            og.appendChild(opt);
          });
          dropdown.appendChild(og);
        });

        // ===== Busca =====
        const searchInput = SolsticeUtils.el('input', {
          type:'search', placeholder:'Buscar (moeda, data, cpf, json...)',
          class:'solstice__type-search',
          'aria-label':'Buscar tipo',
          autocomplete:'off',
          style:'width:100%;padding:9px 12px;font-size:13px;border:1px solid var(--c-border);border-radius:8px;background:var(--c-surface);color:var(--c-text);margin-bottom:12px;'
        });

        // ===== Tabs =====
        const tabBar = SolsticeUtils.el('div', {
          role:'tablist',
          style:'display:flex;gap:4px;border-bottom:1px solid var(--c-border);margin-bottom:14px;overflow-x:auto;'
        });
        const tabs = {};
        BUCKETS.forEach(b => {
          if (!b.types.length) return;
          const isActive = b.key === activeBucket;
          const btn = SolsticeUtils.el('button', {
            type:'button',
            role:'tab',
            'aria-selected': isActive ? 'true' : 'false',
            tabindex: isActive ? '0' : '-1',
            style:'padding:9px 14px;border:none;border-bottom:2px solid '+(isActive?'var(--c-accent)':'transparent')+';background:transparent;color:'+(isActive?'var(--c-text)':'var(--c-muted)')+';font-size:13px;font-weight:'+(isActive?'600':'500')+';cursor:pointer;white-space:nowrap;transition:all 120ms;',
            onclick: () => _selectTab(b.key)
          },
            SolsticeUtils.el('span', { style:'margin-right:5px;' }, b.icon),
            SolsticeUtils.el('span', null, b.name),
            SolsticeUtils.el('span', { style:'margin-left:6px;font-size:10px;opacity:0.6;' }, '(' + b.types.length + ')')
          );
          tabs[b.key] = btn;
          tabBar.appendChild(btn);
        });

        // ===== Grid de cards =====
        // HOTFIX v5.5 #115 + SOL-F2 v2: Lucas reportou "quantidade de sobra que contem
        // e fica feio demais observar dessa forma — quase 75-80% do espaço vazio".
        // Trocado pra grid de chips compacto, responsivo, sem espaço vazio à direita:
        //   - minmax(130px, 1fr) — 2 a 6 colunas conforme largura disponível
        //   - Cards menores (min-height 44px) + ícone à esquerda + label compacto
        //   - Aba pequena (4 tipos) preenche 1 linha horizontal — sem desperdício
        const grid = SolsticeUtils.el('div', {
          class:'solstice__type-chips-grid',
          style:'display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:6px;max-height:340px;overflow-y:auto;padding:2px;align-content:start;'
        });
        const emptyMsg = SolsticeUtils.el('div', {
          style:'padding:30px;text-align:center;color:var(--c-muted);font-size:13px;display:none;'
        }, 'Nenhum tipo encontrado. Tente outra palavra.');

        function _renderCard(t){
          const isSelected = t === chosen;
          // HOTFIX v5.5 #115: cards mais compactos (gap 8, padding 10, fonte 13/10)
          // pra caber mais por linha e nao parecer "sobrando" em abas pequenas.
          const card = SolsticeUtils.el('button', {
            type:'button',
            'data-type': t,
            'aria-pressed': isSelected ? 'true' : 'false',
            style:'display:flex;align-items:center;gap:8px;padding:10px;border:2px solid '+(isSelected?'var(--c-accent)':'var(--c-border)')+';border-radius:8px;background:'+(isSelected?'var(--c-accent-bg, rgba(99,102,241,0.08))':'var(--c-surface-2)')+';color:var(--c-text);cursor:pointer;text-align:left;transition:all 120ms;font-family:inherit;min-height:54px;',
            onmouseenter: (e) => { if (t !== chosen){ e.currentTarget.style.borderColor = 'var(--c-muted)'; } },
            onmouseleave: (e) => { if (t !== chosen){ e.currentTarget.style.borderColor = 'var(--c-border)'; } },
            onclick: () => { chosen = t; dropdown.value = t; _refreshGrid(); },
            ondblclick: () => { chosen = t; resolve(t); close(); }
          },
            SolsticeUtils.el('span', { style:'font-size:18px;line-height:1;flex-shrink:0;' }, SolsticeTypes.icon(t) || '·'),
            SolsticeUtils.el('div', { style:'flex:1;min-width:0;' },
              SolsticeUtils.el('div', { style:'font-size:13px;font-weight:600;line-height:1.2;margin-bottom:1px;' }, SolsticeTypes.label(t)),
              SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);font-family:var(--font-mono);opacity:0.75;line-height:1.2;' }, t)
            )
          );
          return card;
        }
        function _refreshGrid(){
          grid.innerHTML = '';
          const bucket = BUCKETS.find(b => b.key === activeBucket);
          const list = (bucket ? bucket.types : []).filter(t => _matchesQuery(t, query));
          if (!list.length){
            emptyMsg.style.display = '';
            grid.style.display = 'none';
          } else {
            emptyMsg.style.display = 'none';
            grid.style.display = '';
            list.forEach(t => grid.appendChild(_renderCard(t)));
          }
        }
        function _selectTab(key){
          activeBucket = key;
          Object.entries(tabs).forEach(([k, btn]) => {
            const active = k === key;
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.tabIndex = active ? 0 : -1;
            btn.style.borderBottomColor = active ? 'var(--c-accent)' : 'transparent';
            btn.style.color = active ? 'var(--c-text)' : 'var(--c-muted)';
            btn.style.fontWeight = active ? '600' : '500';
          });
          _refreshGrid();
        }

        // ===== Eventos =====
        dropdown.addEventListener('change', e => {
          chosen = e.target.value;
          // Pula pra aba onde o tipo vive
          const b = BUCKETS.find(bk => bk.types.indexOf(chosen) !== -1);
          if (b) _selectTab(b.key);
          else _refreshGrid();
        });
        let qDeb;
        searchInput.addEventListener('input', e => {
          clearTimeout(qDeb);
          qDeb = setTimeout(() => { query = _norm(e.target.value); _refreshGrid(); }, 80);
        });

        _refreshGrid();

        let close;
        // HOTFIX v5.5 #115: removido min-height fixo (era 480px) — modal agora
        // se adapta a quantidade de tipos da aba ativa. Sem espaco vazio feio.
        const body = SolsticeUtils.el('div', null,
          SolsticeUtils.el('div', { style:'font-size:12px;color:var(--c-muted);margin-bottom:8px;' },
            'Atalho: dropdown abaixo (rápido) · abas (navegar) · busca (encontrar). Clique duplo aplica direto.'),
          dropdown,
          searchInput,
          tabBar,
          grid,
          emptyMsg
        );

        SolsticeModal.show({
          title: 'Mudar tipo de "' + col + '"',
          // HOTFIX #115: lg em vez de xl — menos largo, mais focado
          // (xl 1400px era exagero pra um modal com lista de tipos)
          size: 'lg',
          body,
          onOpen: ({ close: closeFn }) => { close = closeFn; },
          footer: (closeFn) => {
            close = closeFn;
            return [
              SolsticeUtils.el('button', {
                class:'solstice__btn solstice__btn--ghost',
                onclick: () => { resolve(null); closeFn(null); }
              }, 'Cancelar'),
              SolsticeUtils.el('button', {
                class:'solstice__btn solstice__btn--primary',
                onclick: () => { resolve(chosen); closeFn(chosen); }
              }, 'Aplicar tipo')
            ];
          }
        });
      });

      if (!choice || choice === currentType) return;
      const ingest = SolsticeStore.get('ingest');
      const newTypes = _changeType(ingest.types, col, choice);
      SolsticeStore.set('ingest', { ...ingest, types: newTypes });
      render(); renderPreview(); updateQualityCard();
      SolsticeToast.info('Tipo alterado', col + ' → ' + SolsticeTypes.label(choice));
    }

    async function _openTransformMenu(col){
      const keys = Object.keys(TRANSFORMATIONS);

      // Prompt 7 v5.4: se a coluna é json_encoded, oferece ação especial "Expandir JSON"
      // no TOPO do menu (antes das transformações padrão).
      const ingest = SolsticeStore.get('ingest');
      const colType = (ingest && ingest.types && ingest.types[col] && ingest.types[col].type) || null;

      // ADR-175 (Fix-7 v5.5): preview antes/depois com 3 valores reais.
      // Auditoria 2026.4: transformação de coluna agora mostra exemplo concreto
      // do dataset — antes era texto abstrato ("Aplica X em Y"). Pega 3 valores
      // distintos não-nulos da coluna (sample sem repetir).
      const sampleValues = [];
      if (ingest && ingest.rows){
        const seen = new Set();
        for (const r of ingest.rows){
          const v = r[col];
          if (v == null || v === '') continue;
          const s = String(v);
          if (seen.has(s)) continue;
          seen.add(s);
          sampleValues.push(v);
          if (sampleValues.length >= 3) break;
        }
      }

      // Helper: gera preview "antes → depois" + marca casos sem mudança
      function _previewDesc(tKey){
        if (tKey === '__expand_json__') return 'Cria 1 coluna nova por chave do JSON';
        const fn = TRANSFORMATIONS[tKey] && TRANSFORMATIONS[tKey].fn;
        if (!fn || !sampleValues.length) return '';
        let changed = 0;
        const lines = sampleValues.map(v => {
          let after;
          try { after = fn(v); } catch(_){ after = v; }
          const before = String(v);
          const afterStr = String(after);
          if (before !== afterStr) changed++;
          // Trunca strings longas pra caber no desc
          const truncBefore = before.length > 22 ? before.slice(0, 20) + '…' : before;
          const truncAfter = afterStr.length > 22 ? afterStr.slice(0, 20) + '…' : afterStr;
          return '"' + truncBefore + '" → "' + truncAfter + '"';
        });
        if (changed === 0) return '🟡 Nenhum valor seria alterado neste sample.';
        return lines.join(' · ');
      }

      const options = keys.map(k => ({
        value: k,
        label: TRANSFORMATIONS[k].label,
        icon: '⚡',
        desc: _previewDesc(k)
      }));

      if (colType === 'json_encoded'){
        options.unshift({
          value: '__expand_json__',
          label: 'Expandir JSON em colunas',
          icon: '🔓',
          desc: 'Cria 1 coluna nova por chave do JSON (com prefixo configurável)'
        });
      }

      const choice = await SolsticeModal.select({
        title: 'Transformar "' + col + '"',
        // Auditoria 2026 (R-17 / A-1001): mensagem corrigida — undo agora cobre.
        message: 'A transformação será aplicada a todos os valores da coluna. Pode ser desfeita com Ctrl+Z.',
        options,
        confirmLabel: 'Aplicar transformação'
      });
      if (!choice) return;

      // Prompt 7: ação especial não-passável pelo _applyTransform
      if (choice === '__expand_json__'){
        await _expandJSONColumn(col);
        return;
      }

      // Auditoria 2026 (R-17 / A-1001): captura ingest antes da mutação
      // pra que Ctrl+Z restaure. SolsticeUndo.push aceita um snapshot
      // arbitrário com `restore: () => ...`.
      if (typeof SolsticeUndo !== 'undefined' && SolsticeUndo.pushCustom){
        const before = SolsticeUtils.deepClone(ingest);
        SolsticeUndo.pushCustom({
          label: 'Transformação · ' + col + ' · ' + (TRANSFORMATIONS[choice] && TRANSFORMATIONS[choice].label || choice),
          restore: () => {
            SolsticeStore.set('ingest', before);
            render(); renderPreview(); updateQualityCard();
          }
        });
      }
      const newRows = _applyTransform(ingest.rows, col, choice);
      SolsticeStore.set('ingest', { ...ingest, rows: newRows });
      render(); renderPreview(); updateQualityCard();
      SolsticeToast.success('Transformação aplicada · Ctrl+Z para desfazer', TRANSFORMATIONS[choice].label);
    }

    /** Prompt 7 v5.4 — Expandir JSON em colunas.
     *  1. Parseia as primeiras 50 linhas pra descobrir chaves (e profundidade)
     *  2. Abre modal com checkbox por chave + prefixo + opção "manter original"
     *  3. Aplica: cria N colunas novas, parseia JSON de cada linha, distribui valores
     *  4. Linhas com JSON inválido → null + warning final ("X linhas ignoradas")
     *  5. Re-inferir tipos das colunas novas via SolsticeTypes
     *  6. Audit: action='json_expand' details com cols criadas */
    async function _expandJSONColumn(col){
      const ingest = SolsticeStore.get('ingest');
      if (!ingest || !ingest.rows) return;

      // 1. Sample primeiras 50 linhas pra descobrir chaves
      const sampleN = Math.min(50, ingest.rows.length);
      const keyStats = new Map(); // key -> { count, sampleValues: [], hasNested: bool }
      let invalidCount = 0;
      for (let i = 0; i < sampleN; i++){
        const raw = ingest.rows[i][col];
        if (raw == null || raw === '') continue;
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (obj && typeof obj === 'object' && !Array.isArray(obj)){
            for (const k in obj){
              if (!keyStats.has(k)) keyStats.set(k, { count: 0, sampleValues: [], hasNested: false });
              const s = keyStats.get(k);
              s.count++;
              if (s.sampleValues.length < 3) s.sampleValues.push(obj[k]);
              if (obj[k] && typeof obj[k] === 'object') s.hasNested = true;
            }
          }
        } catch(e){ invalidCount++; }
      }

      if (!keyStats.size){
        SolsticeToast.warn('Sem chaves detectadas',
          'Não foi possível extrair chaves JSON da amostra. ' +
          (invalidCount ? invalidCount + ' linhas com JSON inválido.' : 'Verifique se os valores são objetos JSON.'));
        return;
      }

      // 2. Modal com configuração
      const selectedKeys = new Set(keyStats.keys()); // default: tudo selecionado
      let prefix = col + '_';
      let keepOriginal = true;
      let expandNested = false;
      // Auditoria 2026 (M-I-3 / A-306): profundidade configurável (1..4).
      // 1 = sem nested (todos objetos viram string). 2 = expande 1 nível
      // além. 3-4 = recursivo. Default 1 preserva comportamento anterior
      // (boolean false) — usuário escolhe explicitamente >1.
      let _maxDepth = 1;

      const userChoice = await new Promise(resolve => {
        SolsticeModal.show({
          title: '🔓 Expandir JSON em colunas',
          size: 'lg',
          body: () => {
            const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:12px;' });

            // Header info
            wrap.appendChild(SolsticeUtils.el('div', {
              style:'padding:8px 12px;background:color-mix(in srgb, var(--c-accent) 8%, transparent);border-left:3px solid var(--c-accent);border-radius:var(--rad-sm);font-size:12px;line-height:1.5;'
            },
              SolsticeUtils.el('div', null, '📊 Detectadas ', SolsticeUtils.el('strong', null, String(keyStats.size)), ' chaves nas primeiras ' + sampleN + ' linhas'),
              invalidCount ? SolsticeUtils.el('div', { style:'color:var(--c-warn);margin-top:2px;' },
                '⚠️ ' + invalidCount + ' linha(s) com JSON inválido (serão null nas colunas filhas)') : null
            ));

            // Prefixo
            const prefRow = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:8px;font-size:12px;' });
            prefRow.appendChild(SolsticeUtils.el('span', { style:'min-width:80px;color:var(--c-text-2);' }, 'Prefixo:'));
            const prefInp = SolsticeUtils.el('input', {
              type:'text', value: prefix,
              style:'flex:1;padding:6px 8px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:12px;font-family:var(--font-mono);'
            });
            prefInp.addEventListener('input', e => { prefix = e.target.value; });
            prefRow.appendChild(prefInp);
            wrap.appendChild(prefRow);

            // Lista de chaves com checkbox
            const listLabel = SolsticeUtils.el('div', { style:'font-size:12px;font-weight:var(--fw-semibold);color:var(--c-text);' }, 'Chaves para extrair:');
            wrap.appendChild(listLabel);
            const list = SolsticeUtils.el('div', {
              style:'max-height:280px;overflow-y:auto;border:1px solid var(--c-border);border-radius:var(--rad-sm);background:var(--c-surface-2);padding:6px;'
            });
            Array.from(keyStats.entries()).sort((a, b) => b[1].count - a[1].count).forEach(([k, st]) => {
              const row = SolsticeUtils.el('label', {
                style:'display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--c-surface);border-radius:var(--rad-xs);margin-bottom:3px;cursor:pointer;font-size:12px;'
              });
              const cb = SolsticeUtils.el('input', { type:'checkbox', checked: true });
              cb.addEventListener('change', e => {
                if (e.target.checked) selectedKeys.add(k); else selectedKeys.delete(k);
              });
              row.appendChild(cb);
              row.appendChild(SolsticeUtils.el('span', { style:'font-family:var(--font-mono);font-weight:var(--fw-semibold);flex:1;overflow:hidden;text-overflow:ellipsis;' }, k));
              row.appendChild(SolsticeUtils.el('span', { style:'font-size:10px;color:var(--c-muted);' },
                st.count + '/' + sampleN + (st.hasNested ? ' · 🔗 aninhado' : '')));
              // Amostra dos primeiros 2 valores
              if (st.sampleValues.length){
                const sampleTxt = st.sampleValues.slice(0, 2).map(v =>
                  typeof v === 'object' ? '{…}' : String(v).slice(0, 16)
                ).join(', ');
                row.appendChild(SolsticeUtils.el('span', {
                  style:'font-size:10px;color:var(--c-muted);font-style:italic;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
                  title: 'Amostra: ' + sampleTxt
                }, sampleTxt));
              }
              list.appendChild(row);
            });
            wrap.appendChild(list);

            // Opção: manter original
            const keepRow = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--c-text-2);' });
            const keepCb = SolsticeUtils.el('input', { type:'checkbox', checked: true });
            keepCb.addEventListener('change', e => { keepOriginal = !!e.target.checked; });
            keepRow.appendChild(keepCb);
            keepRow.appendChild(SolsticeUtils.el('span', null, 'Manter a coluna original "' + col + '" (em vez de substituir)'));
            wrap.appendChild(keepRow);

            // Auditoria 2026 (M-I-3 / A-306): aninhados agora têm profundidade
            // configurável (1-4). Antes era checkbox boolean (1 nível só).
            const hasAnyNested = Array.from(keyStats.values()).some(s => s.hasNested);
            if (hasAnyNested){
              const nestedRow = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--c-text-2);' });
              nestedRow.appendChild(SolsticeUtils.el('span', null, 'Profundidade de expansão (1 = sem aninhados, 4 = recursivo profundo):'));
              const depthInp = SolsticeUtils.el('input', {
                type: 'number', min: '1', max: '4', value: '1',
                style: 'width:60px;padding:4px 8px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:12px;'
              });
              depthInp.addEventListener('input', e => {
                const v = parseInt(e.target.value, 10);
                expandNested = v > 1;
                _maxDepth = (isNaN(v) ? 1 : Math.max(1, Math.min(4, v)));
              });
              nestedRow.appendChild(depthInp);
              wrap.appendChild(nestedRow);
            }

            return wrap;
          },
          footer: (close) => [
            SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', onclick: () => { resolve(null); close(null); } }, 'Cancelar'),
            SolsticeUtils.el('button', {
              class:'solstice__btn solstice__btn--primary',
              onclick: () => {
                if (!selectedKeys.size){ SolsticeToast.warn('Selecione ao menos uma chave'); return; }
                // Auditoria 2026 (M-I-3 / A-306): inclui maxDepth no userChoice.
                resolve({ keys: Array.from(selectedKeys), prefix, keepOriginal, expandNested, maxDepth: _maxDepth });
                close(true);
              }
            }, '🔓 Expandir')
          ]
        });
      });

      if (!userChoice) return;

      // Auditoria 2026 (M-I-3 / A-306): flatten recursivo até profundidade
      // maxDepth. Para depth ≥ maxDepth, valores objeto/array viram string.
      function _flattenInto(obj, prefix, depth, maxDepth, out){
        if (obj == null){ out[prefix] = null; return; }
        if (typeof obj !== 'object' || Array.isArray(obj)){
          out[prefix] = (typeof obj === 'object') ? JSON.stringify(obj) : obj;
          return;
        }
        if (depth >= maxDepth){
          out[prefix] = JSON.stringify(obj);
          return;
        }
        for (const k in obj){
          _flattenInto(obj[k], prefix + '_' + k, depth + 1, maxDepth, out);
        }
      }

      // 3. Aplica: cria novas colunas com flatten recursivo.
      const maxDepth = userChoice.maxDepth || 1;
      // Descobre o conjunto completo de col-names possível via varredura
      // da amostra (com a profundidade escolhida).
      const allColNames = new Set();
      for (let i = 0; i < sampleN; i++){
        const raw = ingest.rows[i][col];
        if (raw == null || raw === '') continue;
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
          for (const k of userChoice.keys){
            if (!(k in obj)) continue;
            const tmp = {};
            _flattenInto(obj[k], userChoice.prefix + k, 1, maxDepth, tmp);
            Object.keys(tmp).forEach(n => allColNames.add(n));
          }
        } catch(_){}
      }
      const newColNames = Array.from(allColNames);

      let invalidRows = 0;
      const newRows = ingest.rows.map(r => {
        const out = { ...r };
        if (!userChoice.keepOriginal) delete out[col];
        let obj = null;
        const raw = r[col];
        if (raw != null && raw !== ''){
          try { obj = typeof raw === 'string' ? JSON.parse(raw) : raw; }
          catch(e){ invalidRows++; }
        }
        for (const k of userChoice.keys){
          const v = (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj[k] : null;
          _flattenInto(v, userChoice.prefix + k, 1, maxDepth, out);
        }
        // Garante todas as colunas (mesmo as ausentes nesta linha) com null.
        for (const nc of newColNames){
          if (!(nc in out)) out[nc] = null;
        }
        return out;
      });

      // 4. Re-inferir tipos das colunas novas + monta lista final de colunas
      const newColumns = userChoice.keepOriginal
        ? [...ingest.columns, ...newColNames]
        : ingest.columns.filter(c => c !== col).concat(newColNames);

      const newTypes = { ...ingest.types };
      if (!userChoice.keepOriginal) delete newTypes[col];
      for (const nc of newColNames){
        const values = newRows.map(r => r[nc]);
        newTypes[nc] = SolsticeTypes.inferColumn(values);
      }
      // Auditoria 2026 (M-I-3 / A-306): nestedColNames antigo removido —
      // tudo agora vive em newColNames pela varredura recursiva.
      const _nestedColNamesLegacyEmpty = []; // mantido por compat para o loop abaixo
      for (const ncObj of _nestedColNamesLegacyEmpty){
        const values = newRows.map(r => r[ncObj.name]);
        newTypes[ncObj.name] = SolsticeTypes.inferColumn(values);
      }

      SolsticeStore.set('ingest', { ...ingest, rows: newRows, columns: newColumns, types: newTypes });

      // 5. Audit
      try {
        if (typeof SolsticeAudit !== 'undefined' && SolsticeAudit.record){
          SolsticeAudit.record({
            action: 'json_expand',
            target: col,
            details: {
              column: col,
              keys: userChoice.keys,
              prefix: userChoice.prefix,
              newColumns: newColNames.length,
              maxDepth,
              invalidRows,
              keepOriginal: userChoice.keepOriginal,
              expandNested: userChoice.expandNested
            }
          });
        }
      } catch(_) {}

      render(); renderPreview(); updateQualityCard();
      SolsticeToast.success('JSON expandido',
        (newColNames.length + nestedColNames.length) + ' colunas criadas' +
          (invalidRows ? ' · ' + invalidRows + ' linhas com JSON inválido (null nas filhas)' : ''));
    }

    // Auditoria 2026 (cleanliness): _renderColSparkline removida — sparkline
    // do editor foi descontinuada, função nunca era chamada (ADR-136 legacy).

    /**
     * Barra de preenchimento — gradient semáforo VERMELHO → AMARELO → VERDE
     * sobre todo o eixo, mostrando quanto a coluna está preenchida.
     *   0%   pior  → vermelho
     *   50%  meio  → amarelo
     *   100% melhor→ verde
     * gradientUnits=userSpaceOnUse: o gradient é fixo no SVG. Assim pct=30%
     * mostra só vermelho, pct=60% mostra vermelho→amarelo, pct=100% mostra todo.
     */
    /**
     * _fillBar — Lucas (HOTFIX v5.5): "100% verde total. 50% amarelo total.
     * 0% vermelho total." A barra agora tem cor SÓLIDA interpolada conforme
     * o pct. Ex: 80% = mistura verde-amarelo puxando pra verde.
     * ANTES: gradient fixo R→Y→G na barra inteira (mesma barra em 100% mostrava
     * vermelho do lado esquerdo, fluxo errado).
     */
    function _interpolateRYG(pct){
      // 0=red, 50=yellow, 100=green. Interpola RGB linear.
      const p = Math.max(0, Math.min(100, pct)) / 100;
      // Anchor colors (token values reais dos temas):
      // c-error  ~ #F87171 (rgb 248, 113, 113)
      // c-warn   ~ #FBBF24 (rgb 251, 191,  36)
      // c-success~ #4ADE80 (rgb  74, 222, 128)
      let r, g, b;
      if (p <= 0.5){
        // red → yellow
        const t = p / 0.5;
        r = Math.round(248 + (251 - 248) * t);
        g = Math.round(113 + (191 - 113) * t);
        b = Math.round(113 + (36  - 113) * t);
      } else {
        // yellow → green
        const t = (p - 0.5) / 0.5;
        r = Math.round(251 + (74  - 251) * t);
        g = Math.round(191 + (222 - 191) * t);
        b = Math.round(36  + (128 - 36)  * t);
      }
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function _fillBar(pct, filledCount, totalCount){
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'solstice__fill-bar' + (pct === 100 ? ' is-full' : ''));
      svg.setAttribute('viewBox', '0 0 240 6');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('role', 'progressbar');
      svg.setAttribute('aria-valuenow', String(pct));
      svg.setAttribute('aria-valuemin', '0');
      svg.setAttribute('aria-valuemax', '100');

      const title = document.createElementNS(NS, 'title');
      title.textContent = SolsticeLocale.integer(filledCount) + ' de ' + SolsticeLocale.integer(totalCount)
        + ' preenchidos (' + pct + '%)'
        + (pct === 100 ? ' · 🎉 coluna 100% preenchida!' : '');
      svg.appendChild(title);

      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x','0'); bg.setAttribute('y','0');
      bg.setAttribute('width','240'); bg.setAttribute('height','6');
      bg.setAttribute('rx','3');
      bg.setAttribute('fill','var(--c-surface-3)');
      svg.appendChild(bg);

      const fill = document.createElementNS(NS, 'rect');
      fill.setAttribute('x','0'); fill.setAttribute('y','0');
      fill.setAttribute('width', (240 * pct / 100).toFixed(1));
      fill.setAttribute('height','6');
      fill.setAttribute('rx','3');
      // Cor SÓLIDA interpolada (0=R · 50=Y · 100=G).
      fill.setAttribute('fill', _interpolateRYG(pct));
      svg.appendChild(fill);

      return svg;
    }

    // Auditoria 2026 (cleanliness): _fillColor removida — _fillBar usa
    // _interpolateRYG diretamente; este helper duplicava lógica não usada.

    /**
     * Renderiza preview de tabela do dataset.
     * Bloco 2 inicial: escrevia no canvas. Bloco 3: canvas pertence ao SolsticeCanvas,
     * então o preview abre num modal grande (acessível pela toolbar do canvas).
     */
    function renderPreview(){
      const ingest = SolsticeStore.get('ingest');
      if (!ingest) return;
      _renderPreviewIntoModal(ingest);
    }

    /**
     * Patch Corretivo (BUG EDIT — ADR-154): edita célula in-place.
     * Enter salva · Esc cancela · blur salva.
     */
    function _onCellDblClick(e, rowIdx, colName, currentVal){
      const td = e.currentTarget;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentVal;
      input.style.cssText = 'width:100%;padding:4px 6px;border:2px solid var(--c-accent);border-radius:3px;background:var(--c-surface);color:var(--c-text);font:inherit;font-family:var(--font-mono);font-size:11px;outline:none;';
      td.innerHTML = '';
      td.appendChild(input);
      input.focus(); input.select();
      let done = false;
      function commit(){
        if (done) return; done = true;
        const newVal = input.value;
        if (newVal !== currentVal){
          const ingest = SolsticeStore.get('ingest') || {};
          const rows = (ingest.rows || []).slice();
          rows[rowIdx] = Object.assign({}, rows[rowIdx], { [colName]: newVal });
          SolsticeStore.set('ingest', Object.assign({}, ingest, { rows }));
          SolsticeAudit.record({ action:'edit_cell', target: colName, details: { rowIdx, from: currentVal, to: newVal } });
          SolsticeToast.info('Célula atualizada', colName + ' linha ' + (rowIdx + 1));
        }
        td.textContent = input.value || '—';
      }
      function cancel(){
        if (done) return; done = true;
        td.textContent = currentVal || '—';
      }
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter'){ ev.preventDefault(); commit(); }
        else if (ev.key === 'Escape'){ ev.preventDefault(); input.removeEventListener('blur', commit); cancel(); }
      });
    }

    function _buildPreviewElement(ingest){
      const { rows, columns, types, sourceName } = ingest;
      const dict = SolsticeStore.get('dictionary');
      // Camada 1 polish v5: mostra mais linhas (200) — modal full tem espaço.
      // Sprint 26 / F-09: título e legenda mais claros pra usuário entender
      // que é preview (não full), e o quanto está sendo mostrado.
      const MAX = 200;
      const showRows = rows.slice(0, MAX);
      const isTruncated = rows.length > MAX;
      const wrap = SolsticeUtils.el('div', { class:'solstice__data-preview' });
      const titleText = '📋 ' + (isTruncated ? 'Preview (' + MAX + ' de ' + SolsticeLocale.integer(rows.length) + ')' : 'Tabela completa') + (sourceName ? ' — ' + sourceName : '');
      const head = SolsticeUtils.el('div', { class:'solstice__data-preview-head' },
        SolsticeUtils.el('div', { class:'solstice__data-preview-title' }, titleText),
        SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:var(--fs-sm);font-family:var(--font-mono);' },
          SolsticeLocale.integer(rows.length) + ' linhas total · ' + columns.length + ' colunas · mostrando ' + showRows.length)
      );
      wrap.appendChild(head);

      // Hint sobre as ações disponíveis no header
      wrap.appendChild(SolsticeUtils.el('div', {
        style:'padding:6px 12px;background:color-mix(in srgb,var(--c-accent) 8%, transparent);font-size:11px;color:var(--c-text-2);line-height:1.5;border-bottom:1px solid var(--c-border);'
      },
        '💡 Clique no ',
        SolsticeUtils.el('strong', null, 'nome da coluna'),
        ' para mudar o tipo · clique em ',
        SolsticeUtils.el('strong', null, '⚡'),
        ' para transformar · duplo-clique numa célula para editar valor.'));

      const tw = SolsticeUtils.el('div', { class:'solstice__data-table-wrap' });
      // B5-02 (v6-autonomous / AC-03 — Marina/NVDA): tabela semântica
      // role=table garante leitores reconhecerem; aria-rowcount/colcount
      // ajudam NVDA a anunciar "linha 3 de 47". <caption> dá contexto.
      const table = SolsticeUtils.el('table', {
        class:'solstice__data-table',
        role: 'table',
        'aria-rowcount': String((rows && rows.length) || 0),
        'aria-colcount': String((columns && columns.length) || 0)
      });
      const captionTxt = 'Preview do dataset' + (rows ? ' — ' + rows.length + ' linhas · ' + columns.length + ' colunas' : '');
      table.appendChild(SolsticeUtils.el('caption', {
        style:'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;'
      }, captionTxt));
      const thead = SolsticeUtils.el('thead');
      const trh = SolsticeUtils.el('tr');
      columns.forEach(c => {
        const t = types[c];
        const friendly = SolsticeHumanize.column(c, dict);
        // Header clicável: nome → mudar tipo · ⚡ → transformar
        // B5-02: scope="col" pra NVDA anunciar coluna ao ler célula
        const th = SolsticeUtils.el('th', { class:'solstice__data-preview-th-rich', scope: 'col' });
        const nameBtn = SolsticeUtils.el('button', {
          class:'solstice__data-preview-th-name',
          type:'button',
          title:'Clique para mudar o tipo desta coluna',
          'aria-label':'Mudar tipo da coluna ' + c,
          onclick: () => {
            if (SolsticeEditor && SolsticeEditor.openTypeMenu) SolsticeEditor.openTypeMenu(c, t.type);
          }
        },
          SolsticeUtils.el('span', { 'aria-hidden':'true', style:'margin-right:6px;font-size:14px;' }, SolsticeTypes.icon(t.type)),
          SolsticeUtils.el('span', null, friendly)
        );
        th.appendChild(nameBtn);
        const typeRow = SolsticeUtils.el('div', { class:'solstice__data-preview-th-type' });
        typeRow.appendChild(SolsticeUtils.el('small', null, SolsticeTypes.label(t.type)));
        const xformBtn = SolsticeUtils.el('button', {
          class:'solstice__data-preview-th-xform',
          type:'button',
          title:'Transformar valores desta coluna',
          'aria-label':'Transformar coluna ' + c,
          onclick: () => {
            if (SolsticeEditor && SolsticeEditor.openTransformMenu) SolsticeEditor.openTransformMenu(c);
          }
        }, '⚡');
        typeRow.appendChild(xformBtn);
        th.appendChild(typeRow);
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = SolsticeUtils.el('tbody');
      showRows.forEach((r, rowIdx) => {
        const tr = SolsticeUtils.el('tr');
        columns.forEach(c => {
          const v = r[c];
          const def = SolsticeTypes.getType(types[c].type);
          const isNum = SolsticeTypes.group(types[c].type) === 'numeric';
          const isNull = v == null || v === '';
          const isInvalid = !isNull && def && def.validate && !def.validate(v);
          const cls = (isNum ? 'is-num ' : 'is-text ') + (isNull ? 'is-null ' : '') + (isInvalid ? 'is-invalid' : '');
          const display = isNull ? '—' : (def && def.format ? (function(){ try { return def.format(v, SolsticeLocale); } catch(e){ return v; }})() : v);
          // Patch Corretivo (BUG EDIT — ADR-154): dupla-clique edita célula in-place
          const td = SolsticeUtils.el('td', {
            class: cls.trim() + ' is-editable',
            'data-row-idx': String(rowIdx),
            'data-col-name': c,
            title: 'Dupla-clique para editar',
            style: 'cursor:text;border-bottom:1px dashed transparent;',
            ondblclick: (e) => _onCellDblClick(e, rowIdx, c, isNull ? '' : String(v))
          }, String(display));
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tw.appendChild(table);
      wrap.appendChild(tw);
      return wrap;
    }

    function _renderPreviewIntoModal(ingest){
      // Atualiza container do modal (se aberto), senão mantém para próxima abertura
      const host = document.getElementById('preview-host');
      if (!host) return;
      host.innerHTML = '';
      host.appendChild(_buildPreviewElement(ingest));
    }

    /** Abre modal grande com a preview da tabela (acessível pela toolbar do canvas). */
    function openPreview(){
      const ingest = SolsticeStore.get('ingest');
      if (!ingest){
        SolsticeToast.warn('Sem dataset', 'Carregue um CSV antes de abrir a preview.');
        return;
      }
      SolsticeModal.show({
        title: '📄 Preview do dataset — ' + (ingest.sourceName || 'sem nome'),
        size: 'xl',
        body: (close) => {
          const host = SolsticeUtils.el('div', { id:'preview-host' });
          host.appendChild(_buildPreviewElement(ingest));
          return host;
        },
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Fechar')
        ]
      });
    }

    /**
     * Renderiza o card "Resumo do Dataset" no topo da aba Dados (Patch B6-r1).
     * Lê de SolsticeDataset.summary(). Reativo a ingest e dataset.types.
     */
    /** Render painel de Medidas Calculadas em formato compacto.
     *
     *  ANTES: header com ícone 24px + título + SUBTÍTULO LONGO + CTA + grid de cards
     *         com nome + fórmula + DESCRIÇÃO (3 linhas por card, ocupando 60-80px cada).
     *  AGORA: linha única "🧮 Medidas · N · [+ Nova]"
     *         + lista compacta inline (nome em mono, hover mostra fórmula no tooltip).
     *         Sem descrição, sem subtítulo genérico.
     */
    function renderMeasuresPanel(){
      const host = document.getElementById('measures-panel');
      if (!host) return;
      const ingest = SolsticeStore.get('ingest');
      if (!ingest || !ingest.columns){ host.classList.add('solstice__hidden'); return; }
      host.classList.remove('solstice__hidden');
      host.innerHTML = '';

      const measures = (typeof SolsticeMeasures !== 'undefined') ? SolsticeMeasures.list() : {};
      const names = Object.keys(measures);

      // Header em 1 linha só: ícone + label + count + CTA pequeno (não-primary se já tem medidas)
      const head = SolsticeUtils.el('div', { class:'solstice__measures-head' });
      const label = SolsticeUtils.el('span', { class:'solstice__measures-label' });
      label.appendChild(SolsticeUtils.el('span', { class:'solstice__measures-icon-sm' }, '🧮'));
      label.appendChild(SolsticeUtils.el('span', null, 'Medidas'));
      if (names.length){
        // SOL-F3: contador clicável — rola a lista nomeada à vista (sem
        // scroll-jump: block:'nearest' só rola se necessário). Lista já é
        // sempre renderizada inline; clique apenas garante visibilidade.
        label.appendChild(SolsticeUtils.el('button', {
          type: 'button',
          class: 'solstice__measures-count',
          style: 'background:transparent;border:0;padding:1px 6px;cursor:pointer;color:inherit;font:inherit;',
          title: 'Ver lista de medidas',
          'aria-label': names.length + ' medidas — clique para focar a lista',
          onclick: () => {
            const list = host.querySelector('.solstice__measures-list');
            if (list) list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, String(names.length)));
      }
      head.appendChild(label);
      const cta = SolsticeUtils.el('button', {
        class: names.length ? 'solstice__btn solstice__btn--ghost' : 'solstice__btn solstice__btn--primary',
        style:'flex-shrink:0;font-size:11px;padding:3px 10px;',
        title:'Criar nova medida com fórmula DAX-like (ex: receita - custo)',
        'aria-label':'Criar nova medida calculada',
        onclick: () => { if (typeof SolsticeMeasures !== 'undefined') SolsticeMeasures.openBuilder(); }
      }, '+ Nova');
      head.appendChild(cta);
      host.appendChild(head);

      // Lista compacta (chips inline) — só se houver medidas
      if (names.length){
        const list = SolsticeUtils.el('div', { class:'solstice__measures-list' });
        names.forEach(n => {
          const def = measures[n];
          const chip = SolsticeUtils.el('button', {
            type:'button',
            class:'solstice__measures-chip',
            title: n + ' = ' + def.formula + (def.description ? '\n' + def.description : ''),
            onclick: () => { if (typeof SolsticeMeasures !== 'undefined') SolsticeMeasures.openBuilder(n); }
          });
          chip.appendChild(SolsticeUtils.el('span', { class:'solstice__measures-chip-icon' }, '∑'));
          chip.appendChild(SolsticeUtils.el('span', { class:'solstice__measures-chip-name' }, n));
          list.appendChild(chip);
        });
        host.appendChild(list);
      }
      // Estado vazio: NÃO mostra texto de placeholder. Antes: "Nenhuma. Crie expressões como..." — Auditoria 2026.4: placeholder desnecessário, ação principal já está visível.
      // CTA "+ Nova" no header já comunica que pode criar.
    }

    /** Polish v8a: ações rápidas (Criar coluna + Tabela) ABAIXO do resumo do dataset.
     *  Antes ficavam no topo isolado; agora estão no contexto certo (entre resumo e colunas). */
    /**
     * RC-03 (Sprint 2): Auto-detector de PII + modal de anonimização.
     * Heurística:
     *  1. Nome da coluna: cpf, cnpj, email, telefone, nome, endereco, rg, etc
     *  2. Sample de até 50 valores: testa CPF/CNPJ/email/phone via regex+validador
     *
     * Para cada coluna detectada, sugere uma estratégia padrão (mask/hash/fake/redact)
     * mas usuário pode trocar. Aplica em batch com undo.
     */
    const PII_PATTERNS = {
      cpf:      { rxName: /\bcpf\b/i,                     rxVal: /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/,                            defaultStrategy:'anonMaskCpf', label:'CPF' },
      cnpj:     { rxName: /\bcnpj\b/i,                    rxVal: /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/,                    defaultStrategy:'anonHash',    label:'CNPJ' },
      email:    { rxName: /e[\-_ ]?mail|email/i,          rxVal: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,                                defaultStrategy:'anonFakeEmail', label:'Email' },
      phone:    { rxName: /telefone|fone|celular|whats/i, rxVal: /^\(?\d{2}\)?\s*9?\s*\d{4,5}[\-\s]?\d{4}$/,                  defaultStrategy:'anonFakePhone', label:'Telefone' },
      name:     { rxName: /\b(nome|cliente|paciente|aluno|usuario|colaborador|funcionario|atendente|vendedor)\b/i, rxVal: null, defaultStrategy:'anonFakeName', label:'Nome' },
      rg:       { rxName: /\brg\b|identidade/i,           rxVal: /^\d{1,2}\.?\d{3}\.?\d{3}-?[\dX]$/i,                         defaultStrategy:'anonHash',    label:'RG' },
      address:  { rxName: /endereco|endereço|rua|logradouro|cep/i, rxVal: null,                                                defaultStrategy:'anonRedact',  label:'Endereço' }
    };
    function _detectPII(ingest){
      const out = []; // [{col, type, label, suggested, matches}]
      if (!ingest || !ingest.columns) return out;
      const sampleN = Math.min(50, (ingest.rows || []).length);
      ingest.columns.forEach(col => {
        const sample = [];
        for (let i = 0; i < sampleN; i++){
          const v = ingest.rows[i] && ingest.rows[i][col];
          if (v != null && v !== '') sample.push(String(v));
          if (sample.length >= 20) break;
        }
        for (const key in PII_PATTERNS){
          const pat = PII_PATTERNS[key];
          const nameHit = pat.rxName && pat.rxName.test(col);
          let valHits = 0;
          if (pat.rxVal && sample.length){
            sample.forEach(s => { if (pat.rxVal.test(s.replace(/\s+/g,''))) valHits++; });
          }
          // Critério: nome bate OU >=50% do sample bate o padrão de valor
          if (nameHit || (sample.length && valHits / sample.length >= 0.5)){
            out.push({
              col, type: key, label: pat.label,
              suggested: pat.defaultStrategy,
              matches: nameHit ? 'nome' : (valHits + '/' + sample.length + ' valores')
            });
            break; // primeira detecção ganha
          }
        }
      });
      return out;
    }
    async function _openAnonymizeModal(){
      const ingest = SolsticeStore.get('ingest');
      if (!ingest || !ingest.rows || !ingest.rows.length){
        SolsticeToast.warn('Sem dataset', 'Importe um CSV primeiro.');
        return;
      }
      const detected = _detectPII(ingest);
      // Estado mutável: por coluna, escolha do usuário {col, strategy, enabled}
      const choices = detected.map(d => ({ col: d.col, label: d.label, matches: d.matches, strategy: d.suggested, enabled: true }));

      function _build(close){
        const body = SolsticeUtils.el('div');
        body.appendChild(SolsticeUtils.el('div', {
          style:'padding:10px 12px;background:color-mix(in srgb,var(--c-warn) 10%, var(--c-surface-2));border-radius:6px;border-left:3px solid var(--c-warn);font-size:12px;margin-bottom:12px;line-height:1.5;'
        }, '🔒 ', SolsticeUtils.el('strong', null, 'LGPD · privacidade'),
           ': anonimização é determinística (mesmo valor → mesmo resultado), o que preserva contagens/joins. Hash não é reversível. ',
           SolsticeUtils.el('strong', null, 'Ctrl+Z desfaz.')));

        if (!choices.length){
          body.appendChild(SolsticeUtils.el('div', { style:'padding:20px;text-align:center;color:var(--c-text-2);font-size:13px;' },
            '✓ Nenhuma coluna com PII detectada automaticamente.',
            SolsticeUtils.el('br'),
            SolsticeUtils.el('small', { style:'color:var(--c-muted);' },
              'Se você quer anonimizar uma coluna específica, use o ⚡ da preview (opções "🔒 Anonimizar …").')));
          return body;
        }

        body.appendChild(SolsticeUtils.el('div', {
          style:'font-size:11px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;'
        }, choices.length + ' coluna(s) detectada(s) — escolha estratégia:'));

        const STRAT_OPTIONS = [
          ['anonMaskCpf',   'Mascarar (123.***.***-45)'],
          ['anonHash',      'Hash determinístico (h_a1b2c3)'],
          ['anonFakeName',  'Substituir por nome fictício'],
          ['anonFakeEmail', 'Substituir por email fictício'],
          ['anonFakePhone', 'Substituir por telefone fictício'],
          ['anonRedact',    'Redigir totalmente ([redigido])']
        ];

        choices.forEach((c, idx) => {
          const row = SolsticeUtils.el('div', {
            style:'display:grid;grid-template-columns:auto 1fr 200px;gap:10px;align-items:center;padding:8px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:6px;margin-bottom:6px;'
          });
          const cb = SolsticeUtils.el('input', { type:'checkbox', checked: c.enabled,
            onchange: e => { c.enabled = e.target.checked; }
          });
          row.appendChild(cb);
          const info = SolsticeUtils.el('div');
          info.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;font-size:13px;' },
            c.col, SolsticeUtils.el('span', { style:'color:var(--c-muted);font-weight:400;font-size:11px;margin-left:6px;' },
              '· ' + c.label + ' (' + c.matches + ')')));
          row.appendChild(info);
          const sel = SolsticeUtils.el('select', { style:'font-size:12px;padding:4px 6px;border-radius:4px;border:1px solid var(--c-border);background:var(--c-surface);color:var(--c-text);',
            onchange: e => { c.strategy = e.target.value; }
          });
          STRAT_OPTIONS.forEach(([v, l]) => {
            const opt = SolsticeUtils.el('option', { value: v }, l);
            if (v === c.strategy) opt.selected = true;
            sel.appendChild(opt);
          });
          row.appendChild(sel);
          body.appendChild(row);
        });

        return body;
      }

      const action = await new Promise(resolve => {
        SolsticeModal.show({
          title: '🔒 Anonimizar dados pessoais',
          size: 'lg',
          body: _build,
          footer: (close) => [
            SolsticeUtils.el('button', { class:'solstice__btn', onclick: () => { resolve(null); close(null); }}, 'Cancelar'),
            choices.length ? SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => { resolve('apply'); close('apply'); }}, 'Aplicar anonimização') : null
          ].filter(Boolean)
        });
      });
      if (action !== 'apply') return;

      // Aplicar transformação por coluna
      const active = choices.filter(c => c.enabled);
      if (!active.length){ SolsticeToast.info('Nada a fazer', 'Nenhuma coluna marcada.'); return; }

      const before = SolsticeUtils.deepClone(ingest);
      if (typeof SolsticeUndo !== 'undefined' && SolsticeUndo.pushCustom){
        SolsticeUndo.pushCustom({
          label: 'Anonimização de ' + active.length + ' coluna(s)',
          restore: () => {
            SolsticeStore.set('ingest', before);
            render(); renderPreview(); updateQualityCard();
          }
        });
      }
      let newRows = ingest.rows;
      active.forEach(c => {
        newRows = _applyTransform(newRows, c.col, c.strategy);
      });
      SolsticeStore.set('ingest', { ...ingest, rows: newRows });
      render(); renderPreview(); updateQualityCard();
      if (typeof SolsticeAudit !== 'undefined' && SolsticeAudit.record){
        SolsticeAudit.record({
          action: 'anonymize_pii',
          details: { columns: active.map(c => ({ col: c.col, strategy: c.strategy })) }
        });
      }
      SolsticeToast.success('Anonimizado · Ctrl+Z para desfazer',
        active.length + ' coluna(s) anonimizada(s)');
    }

    function renderDataActions(){
      const host = document.getElementById('data-actions');
      if (!host) return;
      const dsReady = SolsticeStore.get('dataset.ready');
      if (!dsReady){ host.classList.add('solstice__hidden'); return; }
      host.classList.remove('solstice__hidden');
      host.innerHTML = '';

      // CALC1 v4 (Auditoria 2026.4): colunas calculadas com affordance forte.
       // CTA grande proeminente + lista visual das calculadas com fórmula
       // visível inline (antes só em tooltip — usuário não descobria a feature).
      // Auditoria 2026.6 (SIDEBAR): empilhado na vertical. Lado a lado (flex:1) em
      // 240px dava ~100px por botão e "∑ Nova coluna calculada" quebrava em 3
      // linhas com o ∑ colado. Full-width cada um cabe o rótulo numa linha só.
      const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:6px;' });
      const tableBtn = SolsticeUtils.el('button', {
        class:'solstice__btn',
        style:'width:100%;justify-content:center;font-size:12px;white-space:nowrap;',
        title:'Abrir tabela completa (alterar tipos · ⚡ transformar)',
        onclick: () => { if (SolsticeEditor && SolsticeEditor.openPreview) SolsticeEditor.openPreview(); }
      }, '📋 Tabela completa');
      wrap.appendChild(tableBtn);

      const calcBtn = SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--primary',
        style:'width:100%;justify-content:center;font-size:12px;font-weight:600;white-space:nowrap;',
        title:'Criar coluna calculada por linha (margem, alerta, etc)',
        onclick: () => {
          if (typeof SolsticeSidebarTabs !== 'undefined' && SolsticeSidebarTabs.openCalculatedColumnModal){
            SolsticeSidebarTabs.openCalculatedColumnModal();
          } else {
            SolsticeToast.warn('Erro interno', 'Função de coluna calculada não disponível');
          }
        }
      }, '∑ Nova coluna calculada');
      wrap.appendChild(calcBtn);

      host.appendChild(wrap);

      // RC-03 (Sprint 2): botão Auto-Anonimizar PII detectado.
      // Saúde, jurídico e financeiro precisam dessa one-click feature.
      const anonRow = SolsticeUtils.el('div', { style:'display:flex;gap:6px;margin-top:6px;' });
      const anonBtn = SolsticeUtils.el('button', {
        class:'solstice__btn',
        style:'flex:1;justify-content:center;font-size:11px;border-color:color-mix(in srgb, var(--c-warn) 30%, var(--c-border));',
        title:'Detecta colunas com CPF/CNPJ/email/telefone/nome e anonimiza com 1 clique',
        onclick: _openAnonymizeModal
      }, '🔒 Anonimizar PII');
      anonRow.appendChild(anonBtn);
      host.appendChild(anonRow);

      // Lista de colunas calculadas — CALC1 v4: cards com fórmula visível
      if (SolsticeStore.get('ingest') && SolsticeStore.get('ingest').derivedColumns){
        const dc = SolsticeStore.get('ingest').derivedColumns;
        const ks = Object.keys(dc);
        if (ks.length){
          const list = SolsticeUtils.el('div', {
            style:'margin-top:10px;background:color-mix(in srgb, var(--c-accent) 6%, var(--c-surface-2));border:1px solid color-mix(in srgb, var(--c-accent) 25%, var(--c-border));border-radius:var(--rad-md);padding:10px;'
          });
          list.appendChild(SolsticeUtils.el('div', {
            style:'font-size:10px;font-weight:700;color:var(--c-accent);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;'
          }, '∑ ' + ks.length + ' COLUNA(S) CALCULADA(S)'));
          ks.forEach(n => {
            const item = SolsticeUtils.el('div', {
              style:'display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--rad-sm);margin-bottom:4px;cursor:pointer;transition:all var(--t-fast);',
              onmouseenter: e => e.currentTarget.style.borderColor = 'var(--c-accent)',
              onmouseleave: e => e.currentTarget.style.borderColor = 'var(--c-border)',
              onclick: () => {
                if (typeof SolsticeSidebarTabs !== 'undefined' && SolsticeSidebarTabs.openCalculatedColumnModal){
                  SolsticeSidebarTabs.openCalculatedColumnModal(n);
                }
              }
            });
            item.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-accent);font-weight:700;font-family:var(--font-mono);' }, '∑'));
            const body = SolsticeUtils.el('div', { style:'flex:1;min-width:0;' });
            body.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, n));
            body.appendChild(SolsticeUtils.el('div', { style:'font-family:var(--font-mono);font-size:10px;color:var(--c-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, dc[n].formula || '—'));
            item.appendChild(body);
            item.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-muted);font-size:11px;' }, '✎'));
            list.appendChild(item);
          });
          host.appendChild(list);
        }
      }
    }

    function renderDatasetSummary(){
      const host = document.getElementById('dataset-summary');
      if (!host) return;
      const sum = SolsticeDataset.summary();
      if (!sum.totalRows){
        host.classList.add('solstice__hidden');
        return;
      }
      host.classList.remove('solstice__hidden');
      host.innerHTML = '';

      // SOL-H1 v2 · Auditoria 2026.4 (JM-07): resumo enxuto. Estatísticas cruas
      // de tamanho ("200 linhas, 11 colunas, 6 numéricas, período coberto") não
      // são acionáveis no resumo do dataset — usuário não decide nada com elas.
      // Removemos o big text de "X linhas" e o título passa a ser direto.
      // A contagem continua disponível discreta via tooltip do head.
      // Sprint 23 / UX-01: "O que dá pra construir" foi reportado pelo usuário
      // como linguagem ruim (técnica, não business). Tira o texto: o painel já
      // mostra os grupos de colunas — não precisa de label redundante no head.
      // Mantém o título acessível via aria-label pro screen reader.
      const head = SolsticeUtils.el('div', {
        class:'solstice__dataset-summary-head',
        title: SolsticeLocale.integer(sum.totalRows) + (sum.totalRows === 1 ? ' linha' : ' linhas'),
        'aria-label': 'Resumo do dataset'
      },
        SolsticeUtils.el('span', null, '📊 Dados disponíveis')
      );
      host.appendChild(head);
      // Bloco "X linhas" em destaque foi REMOVIDO (SOL-H1). Mantido marcador
      // discreto pra atender callers que ainda buscam .solstice__dataset-summary-rows.
      const rowsMute = SolsticeUtils.el('div', {
        class:'solstice__dataset-summary-rows solstice__dataset-summary-rows--mute',
        style:'display:none;', // não aparece visualmente
        'data-rows': String(sum.totalRows),
        'data-cols': String(sum.totalColumns)
      });
      host.appendChild(rowsMute);

      const list = SolsticeUtils.el('div', { class:'solstice__dataset-summary-list' });
      // Ordem fixa de grupos
      const order = ['numeric','categorical','temporal','id','contact','geo','struct','special'];
      for (const g of order){
        const cols = sum.groups[g];
        if (!cols || !cols.length) continue;
        const meta = SolsticeDataset.groupMeta(g);
        const count = cols.length;
        const sample = cols.slice(0, 3).map(c => c.friendlyName).join(', ');
        const more = cols.length > 3 ? ' · +' + (cols.length - 3) : '';
        const label = count === 1 ? meta.singular : meta.plural;

        const item = SolsticeUtils.el('div', {
          class:'solstice__dataset-summary-item',
          title: cols.map(c => c.friendlyName + ' (' + SolsticeTypes.label(c.type) + ')').join('\n'),
          onclick: () => {
            // Atalho: scroll até o editor de colunas (foco visual em colunas do grupo)
            const ed = document.getElementById('editor-panel');
            if (ed) ed.scrollIntoView({ behavior:'smooth', block:'nearest' });
            SolsticeToast.info(label + ' selecionadas', count + ' coluna(s): ' + sample + more);
          }
        });
        item.appendChild(SolsticeUtils.el('span', { class:'solstice__dataset-summary-icon', 'aria-hidden':'true' }, meta.icon));
        item.appendChild(SolsticeUtils.el('span', { class:'solstice__dataset-summary-count' }, String(count)));
        item.appendChild(SolsticeUtils.el('span', { class:'solstice__dataset-summary-cols' },
          label + ' · ' + sample + more));
        list.appendChild(item);
      }
      host.appendChild(list);
    }

    function updateQualityCard(){
      const card = document.getElementById('quality-card');
      const ingest = SolsticeStore.get('ingest');
      if (!card || !ingest) return;
      const q = SolsticeQuality.compute(ingest);
      const sevClass = q.score >= 85 ? 'high' : q.score >= 60 ? 'med' : 'low';
      card.innerHTML = '';
      card.appendChild(SolsticeUtils.el('div', { class:'solstice__quality-title' },
        SolsticeUtils.el('span', null, 'Qualidade'),
        SolsticeUtils.el('span', { style:'font-family:var(--font-mono);font-size:10px;' }, q.profile)
      ));
      card.appendChild(SolsticeUtils.el('div', { class:'solstice__quality-score solstice__quality-score--'+sevClass }, String(q.score) + '/100'));
      card.appendChild(SolsticeUtils.el('div', { class:'solstice__quality-meta' },
        ingest.rows.length + ' linhas · ' + ingest.columns.length + ' colunas'));
      const bar = SolsticeUtils.el('div', { class:'solstice__quality-bar' });
      bar.appendChild(SolsticeUtils.el('div', { class:'solstice__quality-bar-fill', style:'width:'+q.score+'%' }));
      card.appendChild(bar);

      // === Prompt 9 v5.4: Seção de erros de parse ===
      // PapaParse popula ingest.errors[]. Antes ficavam silenciosos no console.
      // Agora aparecem em destaque visual no Quality card, com cor por severidade
      // e modal de detalhes clicável para reparo.
      const parseErrors = (ingest.errors || []);
      const totalRows = ingest.rows.length || 1;
      const errorRate = parseErrors.length / totalRows;
      if (parseErrors.length > 0 || errorRate > 0){
        const cls = parseErrors.length === 0 ? 'parse-ok'
                   : (errorRate < 0.01 && parseErrors.length <= 5) ? 'parse-warn'
                   : 'parse-error';
        const label = parseErrors.length === 0 ? 'Parse limpo ✓'
                    : (errorRate < 0.01 && parseErrors.length <= 5) ? parseErrors.length + ' linhas com problema'
                    : Math.round(errorRate * 100) + '% das linhas com problema — revisar';
        const icon = cls === 'parse-ok' ? '✅' : cls === 'parse-warn' ? '⚠️' : '🔴';
        const errBlock = SolsticeUtils.el('button', {
          type: 'button',
          class: 'solstice__quality-parse-errors solstice__quality-parse-errors--' + cls,
          title: 'Clique para ver linhas problemáticas e opções de reparo',
          onclick: () => _openParseErrorsModal(parseErrors)
        });
        errBlock.appendChild(SolsticeUtils.el('span', null, icon));
        errBlock.appendChild(SolsticeUtils.el('span', { style:'flex:1;text-align:left;' }, label));
        if (parseErrors.length > 0){
          errBlock.appendChild(SolsticeUtils.el('span', { style:'font-size:10px;opacity:0.8;' }, 'detalhes →'));
        }
        card.appendChild(errBlock);
      }
      // Prompt 3: Caracteres invisíveis nos nomes de coluna
      const dirty = ingest.dirtyColumnNames || [];
      if (dirty.length){
        const dirtBlock = SolsticeUtils.el('button', {
          type: 'button',
          class: 'solstice__quality-parse-errors solstice__quality-parse-errors--parse-warn',
          title: 'Caracteres invisíveis (BOM, NBSP, ZWSP) limpos automaticamente dos nomes de coluna',
          onclick: () => SolsticeModal.show({
            title: '🔍 Caracteres invisíveis nos nomes de coluna',
            size: 'md',
            body: () => {
              const w = SolsticeUtils.el('div', { style:'font-size:13px;line-height:1.6;color:var(--c-text);' });
              w.appendChild(SolsticeUtils.el('p', null,
                'O Solstice detectou caracteres invisíveis (BOM, NBSP, zero-width spaces) nos seguintes nomes de coluna e fez a limpeza automaticamente:'));
              const list = SolsticeUtils.el('ul', { style:'margin:8px 0;padding-left:20px;' });
              dirty.forEach(d => list.appendChild(SolsticeUtils.el('li', { style:'font-family:var(--font-mono);font-size:12px;' }, d)));
              w.appendChild(list);
              w.appendChild(SolsticeUtils.el('p', { style:'color:var(--c-muted);font-size:11px;' },
                'Causa comum: CSV exportado do Excel pt-BR com BOM, ou de sistemas legacy (SAS, mainframe). Comportamento atual: limpo silenciosamente para evitar quebrar match de sinônimos do dicionário.'));
              return w;
            },
            footer: (close) => [
              SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'OK')
            ]
          })
        });
        dirtBlock.appendChild(SolsticeUtils.el('span', null, '🧹'));
        dirtBlock.appendChild(SolsticeUtils.el('span', { style:'flex:1;text-align:left;' }, dirty.length + ' nome(s) de coluna limpos de invisíveis'));
        dirtBlock.appendChild(SolsticeUtils.el('span', { style:'font-size:10px;opacity:0.8;' }, 'detalhes →'));
        card.appendChild(dirtBlock);
      }

      // Flags (top 3)
      q.flags.slice(0, 3).forEach(f => {
        const icon = f.level === 'error' ? '❌' : f.level === 'warn' ? '⚠️' : 'ℹ️';
        card.appendChild(SolsticeUtils.el('div', { class:'solstice__quality-issue' },
          SolsticeUtils.el('span', null, icon),
          SolsticeUtils.el('span', null, f.col + ': ' + f.msg)));
      });
      if (q.flags.length > 3){
        card.appendChild(SolsticeUtils.el('div', { class:'solstice__quality-issue', style:'color:var(--c-muted);' },
          SolsticeUtils.el('span', null, '+ ' + (q.flags.length - 3) + ' outras flags')));
      }
    }

    /** Prompt 9 v5.4 — modal de detalhes dos erros de parse. */
    function _openParseErrorsModal(errors){
      const ingest = SolsticeStore.get('ingest');
      // Agrupar erros por tipo PapaParse (Quotes, Delimiter, FieldMismatch, etc)
      const byType = new Map();
      errors.forEach(e => {
        const type = e.type || 'Unknown';
        if (!byType.has(type)) byType.set(type, []);
        byType.get(type).push(e);
      });
      // Tradução PT-BR dos tipos de erro PapaParse
      const TYPE_LABEL = {
        'Quotes': 'Aspas mal-fechadas',
        'Delimiter': 'Separador inconsistente',
        'FieldMismatch': 'Campo a mais ou a menos',
        'Abort': 'Parse interrompido',
        'Unknown': 'Erro desconhecido'
      };

      SolsticeModal.show({
        title: '🔍 Erros de parse — ' + errors.length + ' problema(s)',
        size: 'lg',
        body: () => {
          const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:12px;font-size:13px;' });

          // Sumário por tipo
          wrap.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-text);font-weight:var(--fw-semibold);' },
            'Distribuição dos erros:'));
          const typesGrid = SolsticeUtils.el('div', { style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;' });
          for (const [type, errs] of byType){
            const card = SolsticeUtils.el('div', {
              style:'padding:8px 12px;background:color-mix(in srgb, var(--c-warn) 14%, transparent);border-left:3px solid var(--c-warn);border-radius:var(--rad-sm);'
            });
            card.appendChild(SolsticeUtils.el('div', { style:'font-weight:var(--fw-semibold);font-size:12px;' }, TYPE_LABEL[type] || type));
            card.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-text-2);' }, errs.length + ' ocorrência(s)'));
            typesGrid.appendChild(card);
          }
          wrap.appendChild(typesGrid);

          // Lista (até 50)
          wrap.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-text);font-weight:var(--fw-semibold);margin-top:8px;' },
            'Linhas problemáticas (até 50 amostras):'));
          const list = SolsticeUtils.el('div', {
            style:'max-height:320px;overflow-y:auto;border:1px solid var(--c-border);border-radius:var(--rad-sm);background:var(--c-surface-2);'
          });
          const sample = errors.slice(0, 50);
          sample.forEach((e, idx) => {
            const row = SolsticeUtils.el('div', {
              style:'padding:8px 12px;border-bottom:1px dashed var(--c-border);font-size:11px;line-height:1.5;'
            });
            row.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-warn);font-weight:var(--fw-semibold);' },
              (e.row != null ? 'Linha ' + (e.row + 1) : 'Linha ?') + ' · ' + (TYPE_LABEL[e.type] || e.type || 'Erro')));
            row.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-text-2);' }, e.message || 'Sem detalhes'));
            // Mostra o conteúdo da linha original se disponível
            if (e.row != null && ingest.rows && ingest.rows[e.row]){
              const rowData = ingest.rows[e.row];
              const preview = Object.entries(rowData).slice(0, 4).map(([k, v]) =>
                k + '=' + String(v == null ? '∅' : v).slice(0, 30)
              ).join(' · ');
              row.appendChild(SolsticeUtils.el('div', {
                style:'font-family:var(--font-mono);font-size:10px;color:var(--c-muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
              }, preview));
            }
            list.appendChild(row);
          });
          if (errors.length > 50){
            list.appendChild(SolsticeUtils.el('div', { style:'padding:8px 12px;color:var(--c-muted);font-style:italic;text-align:center;' },
              '+ ' + (errors.length - 50) + ' erros não mostrados.'));
          }
          wrap.appendChild(list);

          // Nota de reparo
          wrap.appendChild(SolsticeUtils.el('div', {
            style:'padding:10px 12px;background:color-mix(in srgb, var(--c-accent) 12%, transparent);border-left:3px solid var(--c-accent);border-radius:var(--rad-sm);font-size:11px;line-height:1.5;color:var(--c-text-2);'
          },
            SolsticeUtils.el('strong', null, '💡 Como reparar: '),
            'Reabrir o CSV num editor de texto (ex: VSCode) e procurar pelas linhas problemáticas. Causas comuns: aspas sem par, separador trocado no meio, quebras de linha dentro de campos sem aspas.'
          ));
          return wrap;
        },
        footer: (close) => [
          SolsticeUtils.el('button', {
            class:'solstice__btn',
            title:'Remove TODAS as linhas com erro do dataset. Audit fica registrado.',
            onclick: async () => {
              const ok = await SolsticeModal.confirm({
                title:'Remover linhas com erro?',
                message:'Vou remover ' + errors.length + ' linha(s) do dataset. Não tem undo automático. Continuar?',
                confirmLabel:'Remover',
                danger: true
              });
              if (!ok) return;
              const badRows = new Set(errors.map(e => e.row).filter(r => r != null));
              const ingestNow = SolsticeStore.get('ingest');
              const cleanRows = ingestNow.rows.filter((_, i) => !badRows.has(i));
              SolsticeStore.set('ingest', { ...ingestNow, rows: cleanRows, errors: [] });
              try {
                SolsticeAudit.record({
                  action: 'parse_errors_clean',
                  target: 'dataset',
                  details: { removedRows: badRows.size, originalRows: ingestNow.rows.length, finalRows: cleanRows.length }
                });
              } catch(_) {}
              SolsticeToast.success('Linhas removidas', badRows.size + ' linha(s) com erro de parse removidas');
              updateQualityCard(); renderPreview();
              close(null);
            }
          }, '🗑️ Remover linhas com erro'),
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Fechar')
        ]
      });
    }

    function showPanel(){
      const p = document.getElementById('data-panel');
      if (p) p.classList.remove('solstice__hidden');
    }

    return {
      render, renderPreview, openPreview, updateQualityCard, renderDatasetSummary, showPanel, TRANSFORMATIONS,
      // Polish v8a: novos renderers
      renderMeasuresPanel, renderDataActions,
      // Camada 1 polish v4: expostas pra sub-aba Preview (header clicável)
      openTypeMenu: _openTypeMenu,
      openTransformMenu: _openTransformMenu
    };
  })();
