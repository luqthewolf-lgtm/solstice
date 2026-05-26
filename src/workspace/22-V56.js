
  /* ============================================================
     SOLSTICE v5.6 — PATCH BUNDLE
     7 melhorias agrupadas em um módulo único auto-instalado.
     Estratégia: monkey-patch dos módulos existentes sem alterar
     o código original — minimiza risco e fica fácil rollback.

     1. Tabela virtualizada (windowing)
     2. Export PNG/PDF de alta resolução
     3. Cross-filter em time-series, scatter e tabela
     4. Templates de comparação de períodos
     5. Multi-CSV (gerência de datasets paralelos)
     6. Responsividade universal (parceria com CSS layer v56patch)
     7. Bugfixes de UI (ícones, overflow, mobile toggle)
     ============================================================ */
  const SolsticeV56 = (function(){
    const VERSION = '5.6.0-patched';
    let _patched = false;

    /* ----------------------------------------------------------
       (A) UTILS auxiliares — independentes para evitar acoplamento
       ---------------------------------------------------------- */
    function _el(tag, attrs, ...children){
      const e = document.createElement(tag);
      if (attrs){
        for (const k in attrs){
          if (k === 'style' && typeof attrs[k] === 'object'){
            Object.assign(e.style, attrs[k]);
          } else if (k.startsWith('on') && typeof attrs[k] === 'function'){
            e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
          } else if (k === 'class') {
            e.className = attrs[k];
          } else if (attrs[k] != null) {
            e.setAttribute(k, attrs[k]);
          }
        }
      }
      children.flat().forEach(c => {
        if (c == null) return;
        e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      });
      return e;
    }
    function _fmt(v){
      if (v == null || v === '') return '—';
      if (typeof v === 'number') {
        if (!isFinite(v)) return String(v);
        if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(2) + 'M';
        if (Math.abs(v) >= 1e3) return (v/1e3).toFixed(2) + 'k';
        return Math.abs(v) < 1 && v !== 0 ? v.toFixed(4) : (Number.isInteger(v) ? v.toString() : v.toFixed(2));
      }
      const s = String(v);
      return s.length > 80 ? s.slice(0, 77) + '…' : s;
    }
    function _toast(kind, title, msg){
      try {
        if (window.Solstice && window.Solstice.Toast && window.Solstice.Toast[kind]) {
          return window.Solstice.Toast[kind](title, msg);
        }
        if (typeof SolsticeToast !== 'undefined' && SolsticeToast[kind]){
          return SolsticeToast[kind](title, msg);
        }
      } catch(_){}
      // Auditoria 2026 (JM-02): fallback console gated por debug, mas mantém
      // console.warn em qualquer erro de toast porque pode esconder bug real.
      if (typeof SolsticeLog !== 'undefined') SolsticeLog.debug('[v5.6 toast.' + kind + ']', title, msg || '');
      else console.warn('[v5.6 toast.' + kind + ']', title, msg || '');
    }

    /* ==========================================================
       (1) TABELA VIRTUALIZADA — windowing puro em JS
       ----------------------------------------------------------
       Renderiza só as linhas visíveis no viewport + overscan.
       Escala para 500k+ linhas sem travar.
       Substitui o renderer 'table' (modo flat) quando rows > 800.
       ========================================================== */
    const Vtable = {
      ROW_HEIGHT: 28,
      OVERSCAN: 8,

      render(slot, host, ctx){
        const cfg = (slot && slot.config) || {};
        const rows = ctx.rows || [];
        const cols = ctx.columns || [];
        if (!rows.length){
          host.appendChild(_el('div', { class: 'solstice__comp-empty' }, 'Sem dados.'));
          return;
        }
        // Estado mutável da instância
        const state = {
          sortCol: cfg.sortCol || null,
          sortDir: cfg.sortDir || 'asc',
          filter: '',
          rows: rows
        };

        // Pré-calcula tipos numéricos (para alinhamento)
        const numericSet = new Set();
        cols.forEach(c => {
          const t = ctx.types && ctx.types[c] && ctx.types[c].type;
          if (['integer','decimal','currency','percentage','number'].includes(t)) numericSet.add(c);
        });

        // Heat range cacheado por coluna numérica
        const heat = {};
        if (cfg.heat !== false){
          numericSet.forEach(c => {
            let mn = Infinity, mx = -Infinity;
            for (let i = 0; i < rows.length; i++){
              const v = parseFloat(rows[i][c]);
              if (!isNaN(v)){ if (v < mn) mn = v; if (v > mx) mx = v; }
            }
            if (isFinite(mn) && isFinite(mx)) heat[c] = { min: mn, max: mx };
          });
        }

        // Estrutura DOM
        // Auditoria 2026.4 (Sprint 12 / A11y-01): Vtable ganha semântica de grid
        // para leitores de tela. role=grid + aria-rowcount/colcount + role=row/
        // columnheader/gridcell. NVDA/JAWS/VoiceOver agora anunciam linha N de M.
        const wrap = _el('div', {
          class: 'v56-vtable',
          tabindex: '0',
          role: 'grid',
          'aria-rowcount': String((rows && rows.length) || 0),
          'aria-colcount': String(cols.length),
          'aria-label': 'Tabela com ' + ((rows && rows.length) || 0) + ' linhas e ' + cols.length + ' colunas, virtualizada'
        });

        // Largura de coluna: 1fr para todas, com mínimo 80px
        const gridCols = cols.map(() => 'minmax(80px,1fr)').join(' ');

        // === Header ===
        const head = _el('div', { class: 'v56-vtable__head', role: 'row' });
        head.style.gridTemplateColumns = gridCols;
        cols.forEach((c, idx) => {
          const friendly = (ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[c] && ctx.dictionary.columns[c].friendlyName) || c;
          // Auditoria 2026.4 (A11y-01): columnheader + aria-sort + aria-colindex.
          // Estado de ordenação anunciado pelo leitor de tela.
          const th = _el('div', {
            title: 'Clique para ordenar por ' + friendly,
            role: 'columnheader',
            'aria-colindex': String(idx + 1),
            'aria-sort': 'none',
            tabindex: '-1'
          }, friendly);
          th.addEventListener('click', () => {
            if (state.sortCol === c){
              state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
              state.sortCol = c; state.sortDir = 'asc';
            }
            applyFilterSort(); renderWindow();
            // Persiste no slot pra próximo render
            if (slot && slot.config) {
              slot.config.sortCol = state.sortCol;
              slot.config.sortDir = state.sortDir;
            }
            // Auditoria 2026.4 (A11y-01): atualiza aria-sort + reseta indicadores
            head.querySelectorAll('[role="columnheader"]').forEach(d => {
              d.setAttribute('aria-sort', 'none');
              d.textContent = d.textContent.replace(/ [▲▼]$/, '');
            });
            th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
            th.textContent = (friendly) + (state.sortDir === 'asc' ? ' ▲' : ' ▼');
          });
          if (state.sortCol === c){
            th.textContent = friendly + (state.sortDir === 'asc' ? ' ▲' : ' ▼');
            th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
          }
          head.appendChild(th);
        });
        wrap.appendChild(head);

        // === Viewport ===
        const viewport = _el('div', { class: 'v56-vtable__viewport', role: 'rowgroup' });
        const spacer = _el('div', { class: 'v56-vtable__spacer' });
        const rowsHost = _el('div', { class: 'v56-vtable__rows' });
        spacer.appendChild(rowsHost);
        viewport.appendChild(spacer);
        wrap.appendChild(viewport);

        // === Footer ===
        const footer = _el('div', { class: 'v56-vtable__footer' });
        // Auditoria 2026.4 (A11y-01): live region pra anunciar mudanças de
        // contagem de linhas quando o filtro muda (NVDA/JAWS leem o número novo).
        const statsEl = _el('span', { 'aria-live': 'polite', 'aria-atomic': 'true' }, '');
        const searchInput = _el('input', {
          type: 'text', class: 'v56-vtable__search',
          placeholder: '🔎 Filtrar…',
          'aria-label': 'Filtrar linhas da tabela',
          'aria-controls': 'v56-vtable-rows-' + Math.random().toString(36).slice(2, 8)
        });
        searchInput.addEventListener('input', () => {
          state.filter = searchInput.value.toLowerCase();
          applyFilterSort(); renderWindow();
        });
        footer.appendChild(statsEl);
        footer.appendChild(searchInput);
        wrap.appendChild(footer);

        host.appendChild(wrap);

        // === Lógica de ordenação + filtragem ===
        let filteredRows = rows.slice();
        function applyFilterSort(){
          if (!state.filter){
            filteredRows = rows.slice();
          } else {
            const needle = state.filter;
            filteredRows = rows.filter(r => {
              for (let i = 0; i < cols.length; i++){
                const v = r[cols[i]];
                if (v != null && String(v).toLowerCase().indexOf(needle) !== -1) return true;
              }
              return false;
            });
          }
          if (state.sortCol){
            const col = state.sortCol;
            const isNum = numericSet.has(col);
            const dir = state.sortDir === 'asc' ? 1 : -1;
            filteredRows.sort((a, b) => {
              const va = a[col], vb = b[col];
              if (va == null || va === '') return 1;
              if (vb == null || vb === '') return -1;
              if (isNum){
                const na = parseFloat(va), nb = parseFloat(vb);
                if (isNaN(na)) return 1;
                if (isNaN(nb)) return -1;
                return (na - nb) * dir;
              }
              return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * dir;
            });
          }
          spacer.style.height = (filteredRows.length * Vtable.ROW_HEIGHT) + 'px';
          statsEl.textContent = filteredRows.length.toLocaleString('pt-BR') + ' linha(s) · ' + cols.length + ' col · virtualizado';
          // Auditoria 2026.4 (A11y-01): aria-rowcount reflete linhas filtradas
          // pra leitor de tela anunciar contagem real após filtragem/sort.
          wrap.setAttribute('aria-rowcount', String(filteredRows.length));
        }

        // === Render da janela visível ===
        function renderWindow(){
          const vh = viewport.clientHeight || 300;
          const scrollTop = viewport.scrollTop;
          const firstIdx = Math.max(0, Math.floor(scrollTop / Vtable.ROW_HEIGHT) - Vtable.OVERSCAN);
          const visibleCount = Math.ceil(vh / Vtable.ROW_HEIGHT) + Vtable.OVERSCAN * 2;
          const lastIdx = Math.min(filteredRows.length, firstIdx + visibleCount);

          rowsHost.style.transform = 'translateY(' + (firstIdx * Vtable.ROW_HEIGHT) + 'px)';
          // Reusa nós existentes sempre que possível
          const need = lastIdx - firstIdx;
          while (rowsHost.children.length < need){
            rowsHost.appendChild(_makeRowNode());
          }
          while (rowsHost.children.length > need){
            rowsHost.removeChild(rowsHost.lastChild);
          }
          for (let i = 0; i < need; i++){
            const row = filteredRows[firstIdx + i];
            _paintRow(rowsHost.children[i], row, firstIdx + i);
          }
        }

        function _makeRowNode(){
          // Auditoria 2026.4 (A11y-01): role=row + role=gridcell + aria-colindex
          const node = _el('div', {
            class: 'v56-vtable__row',
            tabindex: '-1',
            role: 'row'
          });
          node.style.gridTemplateColumns = gridCols;
          node.style.height = Vtable.ROW_HEIGHT + 'px';
          for (let i = 0; i < cols.length; i++){
            node.appendChild(_el('div', {
              role: 'gridcell',
              'aria-colindex': String(i + 1)
            }));
          }
          // Cross-filter: clique numa célula ativa filtro por (coluna, valor)
          node.addEventListener('click', (e) => {
            const idx = Array.prototype.indexOf.call(node.children, e.target.closest('div'));
            if (idx < 0) return;
            const col = cols[idx];
            const v = node.__row && node.__row[col];
            if (v == null || v === '') return;
            try {
              if (typeof SolsticeCrossFilter !== 'undefined' && SolsticeCrossFilter.activate){
                SolsticeCrossFilter.activate(col, v);
                _toast('info', 'Cross-filter', col + ' = ' + _fmt(v));
              }
            } catch(_){}
          });
          return node;
        }

        function _paintRow(node, row, absIdx){
          node.__row = row;
          // Auditoria 2026.4 (A11y-01): aria-rowindex no escopo de toda a tabela
          // (não só janela visível). +2 pois aria-rowindex é 1-based e header = 1.
          node.setAttribute('aria-rowindex', String(absIdx + 2));
          for (let i = 0; i < cols.length; i++){
            const c = cols[i];
            const v = row[c];
            const cell = node.children[i];
            cell.className = numericSet.has(c) ? 'num' : '';
            cell.textContent = (v == null || v === '') ? '—' : _fmt(v);
            cell.title = String(v == null ? '' : v);
            // Heatmap subtle
            if (heat[c] && v != null){
              const n = parseFloat(v);
              if (!isNaN(n)){
                const r = (n - heat[c].min) / ((heat[c].max - heat[c].min) || 1);
                cell.style.background = 'linear-gradient(90deg, transparent, rgba(91,168,255,' + (r*0.18).toFixed(2) + '))';
              } else {
                cell.style.background = '';
              }
            } else {
              cell.style.background = '';
            }
          }
        }

        // Bind scroll com requestAnimationFrame
        let scheduled = false;
        viewport.addEventListener('scroll', () => {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => {
            scheduled = false;
            renderWindow();
          });
        }, { passive: true });

        // Render inicial após DOM montar (precisa de clientHeight)
        applyFilterSort();
        requestAnimationFrame(() => renderWindow());
        // ResizeObserver pra recompor quando layout muda
        try {
          const ro = new ResizeObserver(() => renderWindow());
          ro.observe(viewport);
        } catch(_){}
      }
    };

    /* ==========================================================
       (2) EXPORT PNG / PDF de alta resolução
       ----------------------------------------------------------
       Estratégia primária: foreignObject SVG → canvas → PNG.
       Não depende de html2canvas. Funciona offline.
       PDF: usa a PNG e cria um PDF mínimo (1 página A4 paisagem).
       ========================================================== */
    const ExportImage = {

      async openModal(){
        // Pré-checagem: o canvas tem algum conteúdo?
        const canvasRoot = document.getElementById('canvas-root');
        if (!canvasRoot){
          _toast('warn', 'Canvas indisponível', 'Carregue um dashboard antes de exportar.');
          return;
        }
        if (typeof SolsticeModal === 'undefined' || !SolsticeModal.show){
          // Fallback: dispara PNG direto
          return ExportImage.exportPNG({ scale: 2 });
        }
        let opts = { scale: 2, format: 'png', bg: 'auto' };
        SolsticeModal.show({
          title: '🖼️ Exportar dashboard como imagem / PDF',
          size: 'md',
          body: () => {
            const wrap = _el('div', { style: 'display:flex;flex-direction:column;gap:10px;font-size:13px;color:var(--c-text);' });
            wrap.appendChild(_el('p', { style: 'color:var(--c-text-2);font-size:12px;line-height:1.5;margin:0 0 6px 0;' },
              'Captura o dashboard atual (com layout + estado + filtros aplicados) e gera uma imagem fiel para apresentações. ' +
              'Use 2× para slides comuns e 3× para impressão.'));

            const formatRow = _el('label', { style: 'display:flex;gap:8px;align-items:center;' },
              'Formato:'
            );
            const formatSel = _el('select', { style: 'padding:4px 8px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:4px;font-size:12px;color:var(--c-text);' });
            ['png', 'jpeg', 'pdf'].forEach(f => {
              const o = _el('option', { value: f }, f.toUpperCase());
              if (f === opts.format) o.selected = true;
              formatSel.appendChild(o);
            });
            formatSel.addEventListener('change', e => opts.format = e.target.value);
            formatRow.appendChild(formatSel);
            wrap.appendChild(formatRow);

            const scaleRow = _el('label', { style: 'display:flex;gap:8px;align-items:center;' },
              'Resolução:'
            );
            const scaleSel = _el('select', { style: 'padding:4px 8px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:4px;font-size:12px;color:var(--c-text);' });
            [[1,'1× (tela)'],[2,'2× (slides — recomendado)'],[3,'3× (impressão)'],[4,'4× (ultra alta)']].forEach(([v,l]) => {
              const o = _el('option', { value: String(v) }, l);
              if (v === opts.scale) o.selected = true;
              scaleSel.appendChild(o);
            });
            scaleSel.addEventListener('change', e => opts.scale = parseInt(e.target.value, 10));
            scaleRow.appendChild(scaleSel);
            wrap.appendChild(scaleRow);

            const bgRow = _el('label', { style: 'display:flex;gap:8px;align-items:center;' },
              'Fundo:'
            );
            const bgSel = _el('select', { style: 'padding:4px 8px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:4px;font-size:12px;color:var(--c-text);' });
            [['auto','Auto (tema)'],['white','Branco'],['transparent','Transparente (PNG)']].forEach(([v,l]) => {
              const o = _el('option', { value: v }, l);
              if (v === opts.bg) o.selected = true;
              bgSel.appendChild(o);
            });
            bgSel.addEventListener('change', e => opts.bg = e.target.value);
            bgRow.appendChild(bgSel);
            wrap.appendChild(bgRow);

            wrap.appendChild(_el('p', { style: 'color:var(--c-muted);font-size:11px;margin-top:6px;line-height:1.5;' },
              '⚠️ A captura faz um snapshot fiel do conteúdo visível do canvas. Componentes que dependem de Chart.js (linha/barra) são re-renderizados no momento da captura para garantir nitidez em qualquer DPI.'));
            return wrap;
          },
          footer: (close) => [
            _el('button', { class: 'solstice__btn solstice__btn--ghost', onclick: () => close(null) }, 'Cancelar'),
            _el('button', { class: 'solstice__btn solstice__btn--primary', onclick: async () => {
              close(null);
              if (opts.format === 'pdf') return ExportImage.exportPDF(opts);
              if (opts.format === 'jpeg') return ExportImage.exportPNG({ ...opts, mime: 'image/jpeg' });
              return ExportImage.exportPNG(opts);
            } }, '📸 Capturar')
          ]
        });
      },

      _showSpinner(label){
        const sp = _el('div', { class: 'v56-export-spinner' },
          _el('div', { style: 'font-size:32px;' }, '📸'),
          _el('div', null, label || 'Gerando imagem…'),
          _el('div', { class: 'v56-export-spinner__bar' })
        );
        document.body.appendChild(sp);
        return sp;
      },

      async exportPNG(opts){
        opts = opts || {};
        const scale = Math.max(1, Math.min(4, opts.scale || 2));
        const mime = opts.mime || 'image/png';
        const spinner = ExportImage._showSpinner('Gerando ' + (mime.includes('jpeg') ? 'JPEG' : 'PNG') + ' ' + scale + '×…');
        try {
          const dataUrl = await ExportImage._capture({ scale, mime, bg: opts.bg });
          const a = document.createElement('a');
          a.href = dataUrl;
          const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0,16);
          a.download = 'solstice-dashboard-' + ts + (mime === 'image/jpeg' ? '.jpg' : '.png');
          a.click();
          _toast('success', 'Imagem exportada', a.download);
        } catch(err){
          console.error('[v5.6 export]', err);
          _toast('error', 'Falha no export', err && err.message ? err.message : String(err));
        } finally {
          spinner.remove();
        }
      },

      async exportPDF(opts){
        opts = opts || {};
        const scale = Math.max(1, Math.min(3, opts.scale || 2));
        const spinner = ExportImage._showSpinner('Gerando PDF ' + scale + '×…');
        try {
          const dataUrl = await ExportImage._capture({ scale, mime: 'image/jpeg', bg: opts.bg === 'transparent' ? 'white' : opts.bg, quality: 0.92 });
          const pdf = ExportImage._buildPDF(dataUrl);
          const blob = new Blob([pdf], { type: 'application/pdf' });
          const a = document.createElement('a');
          const url = URL.createObjectURL(blob);
          a.href = url;
          const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0,16);
          a.download = 'solstice-dashboard-' + ts + '.pdf';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          _toast('success', 'PDF exportado', a.download);
        } catch(err){
          console.error('[v5.6 export PDF]', err);
          _toast('error', 'Falha no PDF', err && err.message ? err.message : String(err));
        } finally {
          spinner.remove();
        }
      },

      _roundRect(cx, x, y, w, h, r){
        r = Math.max(0, Math.min(r, w/2, h/2));
        cx.beginPath();
        cx.moveTo(x+r, y);
        cx.arcTo(x+w, y,   x+w, y+h, r);
        cx.arcTo(x+w, y+h, x,   y+h, r);
        cx.arcTo(x,   y+h, x,   y,   r);
        cx.arcTo(x,   y,   x+w, y,   r);
        cx.closePath();
      },

      async _capture(opts){
        // Auditoria 2026.6 (EXPORT-FIX): a estratégia antiga (foreignObject SVG →
        // canvas) CONTAMINAVA o canvas no Chrome moderno ("Tainted canvases may
        // not be exported") — toDataURL lançava SecurityError e NADA era baixado.
        // foreignObject em SVG-como-imagem taint o canvas por política de
        // segurança, sem como contornar. Reescrito como COMPOSITOR direto: desenha
        // fundos, gráficos (canvas Chart.js, limpos) e textos na mão. Sem
        // foreignObject → canvas limpo → toDataURL funciona. Offline, sem deps.
        const canvasRoot = document.getElementById('canvas-root');
        // Auditoria 2026.6 (EXPORT-CANVAS-ONLY): esconde a chrome de EDIÇÃO (toolbar
        // de + Seção/Templates/Auto…, minimap) durante a captura. display:none faz
        // o `visible()` pular ela nos passes E o reflow remover o espaço — então a
        // imagem/PDF sai só com o DASHBOARD (título + insights + seções), com todas
        // as cores/customizações. Restaurado no finally.
        const _hiddenForExport = [];
        try {
          canvasRoot.querySelectorAll('.solstice__canvas-toolbar, .solstice__minimap').forEach(e => { _hiddenForExport.push([e, e.style.display]); e.style.display = 'none'; });
          void canvasRoot.offsetHeight; // força reflow (recalcula alturas sem a toolbar)
        } catch(_){}
        const _restoreChrome = () => { _hiddenForExport.forEach(([e, d]) => { try { e.style.display = d; } catch(_){} }); };
        try {
        const width = Math.ceil(canvasRoot.scrollWidth || canvasRoot.getBoundingClientRect().width);
        const height = Math.ceil(canvasRoot.scrollHeight || canvasRoot.getBoundingClientRect().height);
        const scale = Math.max(1, Math.min(4, opts.scale || 2));

        // Re-renderiza charts crisp antes de capturar
        if (window.Chart && Chart.instances) {
          Object.values(Chart.instances).forEach(ch => { try { ch.resize(); ch.update('none'); } catch(_){} });
        }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const can = document.createElement('canvas');
        can.width = Math.max(1, width * scale);
        can.height = Math.max(1, height * scale);
        const cx = can.getContext('2d');
        cx.scale(scale, scale);
        cx.textBaseline = 'top';
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = 'high';

        // Fundo
        let bg = opts.bg;
        if (bg === 'auto' || !bg){
          const isDark = document.documentElement.getAttribute('data-mode') === 'dark';
          bg = isDark ? '#0B0F1A' : '#FFFFFF';
        }
        if (bg !== 'transparent'){ cx.fillStyle = bg; cx.fillRect(0, 0, width, height); }

        // Offset pra converter coordenadas de viewport → conteúdo do canvas-root
        const rootRect = canvasRoot.getBoundingClientRect();
        const ox = rootRect.left - canvasRoot.scrollLeft;
        const oy = rootRect.top - canvasRoot.scrollTop;
        const visible = (cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.01;

        // Passe 1 — fundos e bordas dos boxes (ordem do documento = pais antes dos filhos)
        const all = canvasRoot.querySelectorAll('*');
        all.forEach(el => {
          if (el.tagName === 'CANVAS') return;
          const cs = getComputedStyle(el);
          if (!visible(cs)) return;
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return;
          const x = r.left - ox, y = r.top - oy;
          const rad = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, 24);
          const bgc = cs.backgroundColor;
          if (bgc && bgc !== 'rgba(0, 0, 0, 0)' && bgc !== 'transparent'){
            cx.fillStyle = bgc; ExportImage._roundRect(cx, x, y, r.width, r.height, rad); cx.fill();
          }
          const bw = parseFloat(cs.borderTopWidth) || 0;
          const bc = cs.borderTopColor;
          if (bw > 0 && bc && bc !== 'rgba(0, 0, 0, 0)'){
            cx.strokeStyle = bc; cx.lineWidth = bw;
            ExportImage._roundRect(cx, x + bw/2, y + bw/2, r.width - bw, r.height - bw, rad); cx.stroke();
          }
        });

        // Passe 2 — gráficos (canvases Chart.js — limpos, não contaminam)
        canvasRoot.querySelectorAll('canvas').forEach(ch => {
          const r = ch.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return;
          try { cx.drawImage(ch, r.left - ox, r.top - oy, r.width, r.height); } catch(_){}
        });
        // Passe 2b — <img>/<svg> rasterizáveis (ícones data-url etc.)
        canvasRoot.querySelectorAll('img').forEach(im => {
          const r = im.getBoundingClientRect();
          if (r.width < 1 || r.height < 1 || !im.complete) return;
          try { cx.drawImage(im, r.left - ox, r.top - oy, r.width, r.height); } catch(_){}
        });

        // Passe 3 — textos (cada nó de texto desenhado na sua posição/estilo)
        const walker = document.createTreeWalker(canvasRoot, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())){
          const txt = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
          if (!txt) continue;
          const el = node.parentElement;
          if (!el || el.tagName === 'CANVAS' || el.closest('canvas')) continue;
          const cs = getComputedStyle(el);
          if (!visible(cs)) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const r = range.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          cx.fillStyle = cs.color || '#111827';
          cx.font = [cs.fontStyle, cs.fontWeight, cs.fontSize + '/' + cs.lineHeight, cs.fontFamily].join(' ');
          let x = r.left - ox;
          if (cs.textAlign === 'center') { cx.textAlign = 'center'; x = (r.left + r.width/2) - ox; }
          else if (cs.textAlign === 'right' || cs.textAlign === 'end') { cx.textAlign = 'right'; x = (r.left + r.width) - ox; }
          else cx.textAlign = 'left';
          // centraliza verticalmente na linha
          const y = r.top - oy + Math.max(0, (r.height - (parseFloat(cs.fontSize) || 12)) / 2) - 1;
          cx.fillText(txt, x, y);
        }
        cx.textAlign = 'left';

        return can.toDataURL(opts.mime || 'image/png', opts.quality || 0.95);
        } finally { _restoreChrome(); }
      },

      _loadImage(src){
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('Falha ao carregar SVG do dashboard: ' + (e && e.message ? e.message : 'desconhecido')));
          img.src = src;
        });
      },

      _inlineClone(src){
        // Clona profundamente e inline-iza estilos críticos (cores, fonte, layout)
        const clone = src.cloneNode(true);
        const srcAll = src.querySelectorAll('*');
        const cloneAll = clone.querySelectorAll('*');
        for (let i = 0; i < srcAll.length; i++){
          const s = srcAll[i], c = cloneAll[i];
          if (!c) continue;
          const cs = window.getComputedStyle(s);
          // Lista enxuta — propriedades visuais
          const props = [
            'color','background-color','background-image','background-position','background-size',
            'font-family','font-size','font-weight','font-style','line-height','letter-spacing',
            'text-align','text-decoration','white-space','text-overflow','overflow','overflow-x','overflow-y',
            'border','border-top','border-right','border-bottom','border-left','border-radius',
            'padding','margin','width','height','min-width','min-height','max-width','max-height',
            'display','flex','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis',
            'gap','grid-template-columns','grid-template-rows','grid-template-areas','grid-area','grid-column','grid-row',
            'justify-content','align-items','align-self','position','top','right','bottom','left','z-index',
            'box-shadow','opacity','transform','transition','fill','stroke','stroke-width','stroke-dasharray'
          ];
          let style = '';
          for (const p of props){
            const v = cs.getPropertyValue(p);
            if (v && v !== 'initial' && v !== 'normal' && v !== 'none' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
              style += p + ':' + v + ';';
            }
          }
          if (style) c.setAttribute('style', (c.getAttribute('style') || '') + style);
        }
        return clone;
      },

      _materializeCanvases(src, clone){
        const srcCanvases = src.querySelectorAll('canvas');
        const cloneCanvases = clone.querySelectorAll('canvas');
        for (let i = 0; i < srcCanvases.length; i++){
          const sc = srcCanvases[i], cc = cloneCanvases[i];
          if (!cc) continue;
          try {
            const dataUrl = sc.toDataURL('image/png');
            const img = document.createElement('img');
            img.src = dataUrl;
            const cs = window.getComputedStyle(sc);
            img.style.width = cs.width;
            img.style.height = cs.height;
            img.style.display = 'inline-block';
            cc.parentNode && cc.parentNode.replaceChild(img, cc);
          } catch(_){
            // canvas pode estar tainted — pula
          }
        }
      },

      _buildPDF(dataUrl){
        // PDF mínimo: 1 página, imagem JPEG embutida.
        // Tamanho página: A4 paisagem (842x595 pts).
        // Pega base64 do dataUrl
        const m = String(dataUrl).match(/^data:image\/jpeg;base64,(.+)$/) || String(dataUrl).match(/^data:image\/png;base64,(.+)$/);
        if (!m) throw new Error('PDF requer dataUrl de imagem JPEG/PNG válida');
        const isJPEG = /jpeg/.test(dataUrl);
        const base64 = m[1];
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        const pageW = 842, pageH = 595;
        // Detecta tamanho da imagem (header JPEG simples)
        let imgW = pageW, imgH = pageH;
        if (isJPEG){
          let i = 2;
          while (i < bytes.length){
            if (bytes[i] !== 0xFF) break;
            const marker = bytes[i+1];
            const size = (bytes[i+2] << 8) | bytes[i+3];
            // SOF0..SOF3 contém dimensões
            if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3){
              imgH = (bytes[i+5] << 8) | bytes[i+6];
              imgW = (bytes[i+7] << 8) | bytes[i+8];
              break;
            }
            i += 2 + size;
          }
        }
        // Caber dentro da página mantendo proporção
        const ratio = Math.min(pageW / imgW, pageH / imgH) * 0.96;
        const w = imgW * ratio;
        const h = imgH * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;

        // Monta PDF manualmente
        const objects = [];
        function addObj(s){ objects.push(s); return objects.length; }
        // 1: Catalog
        addObj('<< /Type /Catalog /Pages 2 0 R >>');
        // 2: Pages
        addObj('<< /Type /Pages /Count 1 /Kids [3 0 R] >>');
        // 3: Page
        addObj('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /Im1 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>');
        // 4: Image XObject
        const filter = isJPEG ? '/DCTDecode' : '/FlateDecode';
        addObj('<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ' + filter + ' /Length ' + bytes.length + ' >>\nstream\n', bytes);
        // 5: Content stream
        const content = 'q\n' + w.toFixed(2) + ' 0 0 ' + h.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm\n/Im1 Do\nQ';
        addObj('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');

        // Builda bytes do PDF
        const enc = new TextEncoder();
        const chunks = [];
        let offset = 0;
        const offsets = [];
        function push(s){ const b = typeof s === 'string' ? enc.encode(s) : s; chunks.push(b); offset += b.length; }
        push('%PDF-1.4\n%\xC3\xA1\xC3\xA9\n');
        // Reescreve objects c/ stream binário
        const objectStrings = [
          '<< /Type /Catalog /Pages 2 0 R >>',
          '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
          '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /Im1 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>'
        ];
        // 1, 2, 3
        for (let i = 0; i < 3; i++){
          offsets.push(offset);
          push((i+1) + ' 0 obj\n' + objectStrings[i] + '\nendobj\n');
        }
        // 4 — imagem
        offsets.push(offset);
        push('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ' + filter + ' /Length ' + bytes.length + ' >>\nstream\n');
        push(bytes);
        push('\nendstream\nendobj\n');
        // 5 — content
        offsets.push(offset);
        push('5 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream\nendobj\n');
        // XRef
        const xrefOffset = offset;
        push('xref\n0 6\n0000000000 65535 f \n');
        for (const o of offsets){
          push(String(o).padStart(10, '0') + ' 00000 n \n');
        }
        push('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF');

        // Concat
        let total = 0;
        chunks.forEach(c => total += c.length);
        const out = new Uint8Array(total);
        let p = 0;
        chunks.forEach(c => { out.set(c, p); p += c.length; });
        return out;
      }
    };

    /* ==========================================================
       (3) CROSS-FILTER em TIME-SERIES, SCATTER e TABLE
       ----------------------------------------------------------
       Ouve cliques globais no canvas e dispara SolsticeCrossFilter.
       Distribuição já tinha; agora time-series/scatter/tabela também.
       ========================================================== */
    const CrossFilterExt = {
      install(){
        const canvasRoot = document.getElementById('canvas-root');
        if (!canvasRoot) return;
        // Delegated listener — funciona mesmo se componentes forem re-renderizados.
        canvasRoot.addEventListener('click', (e) => {
          // Procura o componente alvo
          const comp = e.target.closest('.solstice__comp');
          if (!comp) return;
          const slotId = comp.getAttribute('data-slot-id') || comp.getAttribute('data-id');
          if (!slotId) return;
          const slot = CrossFilterExt._findSlot(slotId);
          if (!slot) return;
          const type = slot.type;
          if (!['time-series','scatter','distribution','table','bar'].includes(type)) return;

          if (type === 'time-series'){
            // Clique em ponto da série temporal → filtra por bin (data)
            const chartCanvas = e.target.closest('canvas');
            if (!chartCanvas || !window.Chart) return;
            const chart = Chart.getChart(chartCanvas);
            if (!chart) return;
            const evt = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
            if (!evt || !evt.length) return;
            const dp = evt[0];
            const label = chart.data.labels[dp.index];
            if (label != null && slot.config && slot.config.xColumn){
              SolsticeCrossFilter.activate(slot.config.xColumn, String(label));
              _toast('info', 'Cross-filter', slot.config.xColumn + ' = ' + label);
            }
          } else if (type === 'scatter'){
            // Clique num ponto SVG do scatter
            const point = e.target.closest('.solstice__scatter-point');
            if (!point || !slot.config) return;
            const cx = parseFloat(point.getAttribute('cx'));
            const cy = parseFloat(point.getAttribute('cy'));
            // Localiza valor mais próximo do tooltip nativo (já tem em <title>)
            const title = point.querySelector('title');
            if (title) {
              // Formato: "<x friendly>: <vx> · <y friendly>: <vy>"
              const m = String(title.textContent || '').match(/:\s*([\d,.\-]+)/);
              if (m && slot.config.xColumn){
                SolsticeCrossFilter.activate(slot.config.xColumn,
                  parseFloat(m[1].replace(',', '.')));
                _toast('info', 'Cross-filter (scatter)', slot.config.xColumn);
              }
            }
          }
          // tabela e distribution já têm handlers nativos
        }, true);
      },
      _findSlot(slotId){
        try {
          const sections = SolsticeStore.get('canvas.sections') || [];
          for (const sec of sections){
            for (const row of (sec.rows || [])){
              for (const s of (row.slots || [])){
                if (s.id === slotId) return s;
              }
            }
          }
        } catch(_){}
        return null;
      }
    };

    /* ==========================================================
       (4) TEMPLATES DE COMPARAÇÃO DE PERÍODOS
       ----------------------------------------------------------
       Adiciona 3 layouts agnósticos prontos: este mês vs anterior,
       esta semana vs anterior, e YoY (ano contra ano).
       ========================================================== */
    const PeriodCompare = {
      install(){
        if (typeof SolsticeTemplates === 'undefined' || !SolsticeTemplates.AGNOSTIC) return;
        const _row = (layout) => ({
          layout: layout || '1col',
          slots: Array.from({ length: SolsticeLayouts.slotCount(layout || '1col') }, () => ({ type: 'empty' }))
        });
        const _sec = (title, ...rows) => ({ title, rows });

        // Pega slots já configurados pra comparação automática
        function _build(periodKey){
          return [
            _sec('Indicadores · ' + PeriodCompare._label(periodKey),
              {
                layout: '4col-equal',
                slots: [
                  { type: 'kpi', config: { agg: 'sum', comparison: { type: 'previous-period', period: periodKey } } },
                  { type: 'kpi', config: { agg: 'avg', comparison: { type: 'previous-period', period: periodKey } } },
                  { type: 'kpi', config: { agg: 'count', comparison: { type: 'previous-period', period: periodKey } } },
                  { type: 'kpi', config: { agg: 'min',  comparison: { type: 'previous-period', period: periodKey } } }
                ]
              }
            ),
            _sec('Evolução com período anterior sobreposto',
              {
                layout: '1col',
                slots: [
                  { type: 'time-series', config: { bin: periodKey === 'month' ? 'day' : (periodKey === 'year' ? 'month' : 'day'),
                                                   kind: 'line', showCompare: true, compareMode: 'same-duration' } }
                ]
              }
            ),
            _sec('Detalhe lado a lado',
              {
                layout: '2col-equal',
                slots: [
                  { type: 'distribution', config: {} },
                  { type: 'table', config: { rowLimit: 50 } }
                ]
              }
            )
          ];
        }
        const templates = [
          {
            id: 'compare-month-vs-prev', icon: '📅',
            name: 'Comparação · este mês vs mês anterior',
            description: 'KPIs com delta, série temporal sobreposta e detalhe — atualizado automaticamente quando filtra período.',
            domain: null,
            build: () => _build('month')
          },
          {
            id: 'compare-week-vs-prev', icon: '🗓️',
            name: 'Comparação · esta semana vs semana anterior',
            description: '4 KPIs com delta semanal · série diária com semana anterior tracejada · tabela detalhada.',
            domain: null,
            build: () => _build('week')
          },
          {
            id: 'compare-yoy', icon: '📈',
            name: 'Comparação · YoY (este ano vs ano anterior)',
            description: 'Ano vs ano — KPIs com %∆, série mensal sobreposta e detalhe.',
            domain: null,
            build: () => _build('year')
          }
        ];
        // Sprint 29: push desativado. User pediu pra enxugar templates —
        // os 3 compare-* (mês/semana/ano) eram variações úteis mas
        // sobrepunham com o time-evolution. Mantidos só como helper
        // interno (_build) caso seja reativado.
        return;
        templates.forEach(t => {
          if (!SolsticeTemplates.AGNOSTIC.find(x => x.id === t.id)){
            SolsticeTemplates.AGNOSTIC.push(t);
          }
        });
      },
      _label(key){
        if (key === 'month') return 'mês atual vs mês anterior';
        if (key === 'week') return 'semana atual vs semana anterior';
        if (key === 'year') return 'ano atual vs ano anterior';
        return key;
      }
    };

    /* ==========================================================
       (5) MULTI-CSV — gestão de múltiplas bases paralelas
       ----------------------------------------------------------
       Permite carregar N CSVs, manter cada um como "dataset"
       nomeado em window.Solstice.Store.get('datasets'), trocar
       qual está ativo, e enxergar as medidas/colunas de cada um.
       UI: painel na sidebar de Dados.
       ========================================================== */
    const MultiCSV = {
      install(){
        // Move o dataset atual para um array (1 entrada inicial) quando carregar.
        if (typeof SolsticeStore === 'undefined') return;

        // Inicia container
        if (!SolsticeStore.get('datasets')) SolsticeStore.set('datasets', []);
        if (!SolsticeStore.get('datasets.activeId')) SolsticeStore.set('datasets.activeId', null);

        // Sempre que um dataset é carregado (ingest.ready), arquiva
        SolsticeStore.subscribe('dataset.ready', (ready) => {
          if (!ready) return;
          const ingest = SolsticeStore.get('ingest');
          const name = SolsticeStore.get('dataset.name');
          if (!ingest || !name) return;
          const list = (SolsticeStore.get('datasets') || []).slice();
          // Atualiza se já existir entrada com mesmo nome
          let entry = list.find(d => d.name === name);
          const id = entry ? entry.id : ('ds_' + Date.now() + '_' + Math.floor(Math.random()*1000));
          const newEntry = {
            id,
            name,
            rows: ingest.rows,
            columns: ingest.columns,
            types: ingest.types,
            dictionary: SolsticeStore.get('dictionary'),
            source: SolsticeStore.get('dataset.source'),
            createdAt: entry ? entry.createdAt : Date.now(),
            updatedAt: Date.now()
          };
          if (entry){
            const idx = list.findIndex(d => d.id === entry.id);
            list[idx] = newEntry;
          } else {
            list.push(newEntry);
          }
          SolsticeStore.set('datasets', list);
          SolsticeStore.set('datasets.activeId', id);
          MultiCSV.renderPanel();
        });

        // Renderiza painel quando dados mudam
        SolsticeStore.subscribe('datasets', () => MultiCSV.renderPanel());
        SolsticeStore.subscribe('datasets.activeId', () => MultiCSV.renderPanel());

        // Cria o painel UI sob o data-panel
        MultiCSV._mountUI();
      },

      _mountUI(){
        // DEDUP1 v4 (Auditoria 2026.4): "Modelo de dados" e "bases carregadas"
        // eram conceitos repetidos em painéis diferentes. Unificado em
        // #modelo-panel — aba Modelo concentra TUDO de base/relação.
        const dataPanel = document.getElementById('modelo-panel') || document.getElementById('data-panel');
        if (!dataPanel) {
          setTimeout(() => MultiCSV._mountUI(), 300);
          return;
        }
        let panel = document.getElementById('v56-datasets-panel');
        if (panel) return panel;
        panel = _el('div', { class: 'v56-datasets', id: 'v56-datasets-panel' });
        // Auditoria 2026 (U-5): título do painel ganha botão "Comparar"
        // que abre modal mostrando colunas lado a lado de TODAS as bases.
        panel.appendChild(_el('div', { class: 'v56-datasets__title' },
          _el('span', null, '📚 Bases carregadas'),
          _el('div', { style:'display:flex;gap:6px;' },
            _el('button', {
              class: 'v56-datasets__add',
              title: 'Comparar colunas entre todas as bases',
              onclick: () => MultiCSV.openCompare()
            }, '⇔ Comparar'),
            _el('button', {
              class: 'v56-datasets__add',
              title: 'Adicionar mais um CSV ao painel',
              onclick: () => MultiCSV.addMore()
            }, '+ CSV')
          )
        ));
        panel.appendChild(_el('div', { class: 'v56-datasets__list', id: 'v56-datasets-list' }));
        // Insere no topo do data-panel
        dataPanel.insertBefore(panel, dataPanel.firstChild);
        MultiCSV.renderPanel();
      },

      renderPanel(){
        const list = document.getElementById('v56-datasets-list');
        if (!list) return;
        const datasets = SolsticeStore.get('datasets') || [];
        const activeId = SolsticeStore.get('datasets.activeId');
        list.innerHTML = '';
        // G2-01 v3 (Auditoria 2026.4): CTA "Modelo de Dados" — promove a feature
        // de conectar bases por ID quando há ≥2 bases. Suporta os 4 tipos de
        // relação canônicos: esquema estrela, 1:N, 1:1, N:N.
        if (datasets.length >= 2 && typeof SolsticeRelationships !== 'undefined'){
          const rels = (SolsticeRelationships.list && SolsticeRelationships.list()) || [];
          const cta = _el('div', {
            class:'v56-datasets__model-cta',
            title:'Abrir Modelo de Dados — conectar bases por coluna chave (1:N · 1:1 · N:N)',
            onclick: () => {
              try {
                // Foca o painel de relacionamentos (já existe abaixo da lista).
                const p = document.getElementById('v56-relationships-panel');
                if (p){
                  p.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  p.style.boxShadow = '0 0 0 2px var(--c-accent)';
                  setTimeout(() => { p.style.boxShadow = ''; }, 1200);
                }
                // Se nenhum relacionamento ainda, abre direto o modal de criação.
                if (!rels.length && SolsticeRelationships._openCreateModal){
                  SolsticeRelationships._openCreateModal();
                } else if (!rels.length && SolsticeRelationships.create){
                  // Fallback: dispara um evento que o painel escuta
                  window.dispatchEvent(new CustomEvent('solstice:open-relationship-modal'));
                }
              } catch(e){ /* silencioso */ }
            }
          });
          cta.appendChild(_el('span', null, '🔗'));
          if (rels.length){
            cta.appendChild(_el('div', { style:'flex:1;' },
              _el('strong', null, 'Modelo de Dados'),
              _el('div', { style:'font-size:10px;color:var(--c-muted);margin-top:2px;' },
                rels.length + ' relacionamento' + (rels.length === 1 ? '' : 's') + ' · clique para gerenciar')));
          } else {
            cta.appendChild(_el('div', { style:'flex:1;' },
              _el('strong', null, 'Conectar bases'),
              _el('div', { style:'font-size:10px;color:var(--c-muted);margin-top:2px;' },
                'Vincule por ID (1:N · 1:1 · N:N) para cruzar colunas')));
          }
          cta.appendChild(_el('span', { style:'color:var(--c-accent);font-weight:bold;' }, '→'));
          list.appendChild(cta);
        }
        if (!datasets.length){
          list.appendChild(_el('div', { style: 'font-size:11px;color:var(--c-muted);padding:12px;text-align:center;line-height:1.5;' },
            'Sem bases carregadas. Use 📁 Importar (header) ou + CSV (acima) para começar.'));
          return;
        }
        // Auditoria 2026 (U-13): estado de "qual base está com preview
        // expandido". Por sessão, não persistido. Permite ver colunas
        // sem ativar a base.
        if (typeof MultiCSV._expanded === 'undefined') MultiCSV._expanded = new Set();
        datasets.forEach(d => {
          // Auditoria 2026 (U-5): tooltip rico com as colunas da base, sem
          // precisar ativar para ver. Trunca em 20 para não estourar tooltip.
          const colsList = (d.columns || []).slice(0, 20);
          const tooltipCols = colsList.length
            ? colsList.join(' · ') + ((d.columns || []).length > 20 ? ' (+' + ((d.columns || []).length - 20) + ')' : '')
            : '(sem colunas)';
          const isOpen = MultiCSV._expanded.has(d.id);
          const it = _el('div', {
            class: 'v56-dataset-item' + (d.id === activeId ? ' is-active' : '') + (isOpen ? ' is-expanded' : ''),
            title: d.name + ' · ' + (d.rows ? d.rows.length : 0) + ' linhas\nColunas: ' + tooltipCols,
            // Auditoria 2026 (U-13): click NÃO troca mais a base ativa.
            // Toggle preview. Para ativar, botão "▶ Ativar" explícito.
            onclick: (e) => {
              // Ignora cliques nos botões internos
              if (e.target.closest('button')) return;
              if (MultiCSV._expanded.has(d.id)) MultiCSV._expanded.delete(d.id);
              else MultiCSV._expanded.add(d.id);
              MultiCSV.renderPanel();
            }
          });
          // Linha de cabeçalho
          const head = _el('div', { style:'display:flex;align-items:center;gap:6px;width:100%;' });
          head.appendChild(_el('span', null, d.id === activeId ? '●' : '○'));
          head.appendChild(_el('span', { class: 'v56-dataset-item__name', style:'flex:1;overflow:hidden;text-overflow:ellipsis;' }, d.name));
          head.appendChild(_el('span', { class: 'v56-dataset-item__meta' },
            (d.rows ? d.rows.length.toLocaleString('pt-BR') : '0') + 'r · ' + (d.columns ? d.columns.length : 0) + 'c'));
          // Botão "Ativar" — só se NÃO for ativa.
          if (d.id !== activeId){
            head.appendChild(_el('button', {
              class: 'v56-dataset-item__rm',
              title: 'Ativar esta base como dataset principal do app',
              style:'background:var(--c-accent);color:#fff;border-color:var(--c-accent);font-weight:bold;',
              onclick: (e) => { e.stopPropagation(); MultiCSV.activate(d.id); }
            }, '▶'));
          }
          head.appendChild(_el('button', {
            class: 'v56-dataset-item__rm',
            title: 'Remover esta base do painel',
            onclick: (e) => { e.stopPropagation(); MultiCSV.remove(d.id); }
          }, '×'));
          it.appendChild(head);
          // Preview expandido das colunas (U-13)
          if (isOpen && (d.columns || []).length){
            const preview = _el('div', {
              style:'margin-top:6px;padding:6px 8px;background:var(--c-surface-2);border-radius:var(--rad-xs);font-family:var(--font-mono);font-size:11px;color:var(--c-text-2);max-height:160px;overflow-y:auto;line-height:1.5;'
            });
            (d.columns || []).forEach(c => {
              const t = (d.types && d.types[c] && d.types[c].type) || 'string';
              const row = _el('div', { style:'display:flex;justify-content:space-between;gap:8px;padding:1px 0;' });
              row.appendChild(_el('span', { style:'flex:1;overflow:hidden;text-overflow:ellipsis;' }, c));
              row.appendChild(_el('span', { style:'color:var(--c-muted);font-size:10px;' }, t));
              preview.appendChild(row);
            });
            it.appendChild(preview);
          }
          list.appendChild(it);
        });
      },

      // Auditoria 2026 (U-5 / U-6): modal "Comparar colunas". Mostra tabela
      // com 1 linha por coluna; para cada base, ✓ se tem a coluna (match
      // exato ou similar). Permite identificar relacionamentos potenciais
      // entre bases sem precisar trocar a ativa.
      openCompare(){
        const datasets = SolsticeStore.get('datasets') || [];
        if (datasets.length < 2){
          _toast('info', 'Sem o que comparar', 'Importe pelo menos 2 bases para comparar colunas.');
          return;
        }
        function _norm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''); }
        function _lev(a, b){
          const m = a.length, n = b.length;
          if (Math.abs(m - n) > 3) return 999;
          const dp = Array.from({length:m+1}, () => new Array(n+1).fill(0));
          for (let i = 0; i <= m; i++) dp[i][0] = i;
          for (let j = 0; j <= n; j++) dp[0][j] = j;
          for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++){
            dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
                                         : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
          }
          return dp[m][n];
        }
        // Universo: união normalizada de todas as colunas.
        const universe = new Map(); // normName → { rawNames: Set, count }
        for (const d of datasets){
          for (const c of (d.columns || [])){
            const k = _norm(c);
            if (!universe.has(k)) universe.set(k, { rawNames: new Set([c]), count: 0 });
            else universe.get(k).rawNames.add(c);
          }
        }
        // Para cada base, marca quais normalizadas tem (exato ou sim<=2)
        function _matchInDataset(d, normKey){
          const direct = (d.columns || []).find(c => _norm(c) === normKey);
          if (direct) return { col: direct, kind: 'exato' };
          for (const c of (d.columns || [])){
            const dist = _lev(_norm(c), normKey);
            if (dist <= 2) return { col: c, kind: 'similar (Lev=' + dist + ')' };
          }
          return null;
        }
        // Build modal
        const modal = _el('div', { style:'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;' });
        const inner = _el('div', { style:'background:var(--c-surface);border-radius:var(--rad-md);box-shadow:var(--sh-3);max-width:900px;width:100%;max-height:85vh;overflow:auto;padding:20px;' });
        inner.appendChild(_el('div', { style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;' },
          _el('h3', { style:'margin:0;font-size:18px;color:var(--c-text);' }, '⇔ Comparar colunas entre bases'),
          _el('button', { class:'solstice__btn', onclick: () => modal.remove() }, '✕ Fechar')
        ));
        inner.appendChild(_el('p', { style:'font-size:12px;color:var(--c-muted);margin:0 0 12px 0;line-height:1.4;' },
          'Mostra colunas presentes em cada base. ✓ = match exato. ≈ = match por similaridade (Levenshtein≤2). ' +
          'Útil para identificar relacionamentos entre bases sem exigir nome idêntico.'));
        // Tabela
        const table = _el('table', { style:'width:100%;border-collapse:collapse;font-size:12px;' });
        const thead = _el('thead');
        const trh = _el('tr');
        trh.appendChild(_el('th', { style:'text-align:left;padding:6px;border-bottom:1px solid var(--c-border);' }, 'Coluna'));
        datasets.forEach(d => {
          trh.appendChild(_el('th', { style:'text-align:left;padding:6px;border-bottom:1px solid var(--c-border);max-width:140px;overflow:hidden;text-overflow:ellipsis;' }, d.name));
        });
        thead.appendChild(trh);
        table.appendChild(thead);
        const tbody = _el('tbody');
        // Ordena por presença total (mais "ubíquas" primeiro)
        const rows = Array.from(universe.entries()).map(([k, info]) => {
          const matches = datasets.map(d => _matchInDataset(d, k));
          const present = matches.filter(m => m && m.kind === 'exato').length;
          return { key: k, info, matches, score: present };
        }).sort((a,b) => b.score - a.score);
        for (const r of rows){
          const tr = _el('tr');
          const sampleName = Array.from(r.info.rawNames)[0];
          tr.appendChild(_el('td', { style:'padding:6px;border-bottom:1px solid var(--c-border);font-family:var(--font-mono);font-size:11px;' }, sampleName));
          for (const m of r.matches){
            const td = _el('td', { style:'padding:6px;border-bottom:1px solid var(--c-border);' });
            if (m && m.kind === 'exato'){
              td.appendChild(_el('span', { style:'color:var(--c-success);font-weight:bold;', title: m.col }, '✓ ' + m.col));
            } else if (m){
              td.appendChild(_el('span', { style:'color:var(--c-warn);', title: m.col + ' (' + m.kind + ')' }, '≈ ' + m.col));
            } else {
              td.appendChild(_el('span', { style:'color:var(--c-muted);opacity:0.5;' }, '—'));
            }
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        inner.appendChild(table);
        modal.appendChild(inner);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
      },

      activate(id){
        const datasets = SolsticeStore.get('datasets') || [];
        const d = datasets.find(x => x.id === id);
        if (!d) return;
        // SOL-B3: antes de aplicar a troca, detectar quais slots no canvas
        // referenciam colunas que NÃO existem na nova base — pra avisar o usuário
        // em vez de deixar o componente cair no empty-state silenciosamente.
        const _newColsSet = new Set(d.columns || []);
        const _brokenSlotsB3 = [];
        const _refKeysB3 = ['column','xColumn','yColumn','sizeColumn','dateColumn','valueColumn','colorColumn','sourceColumn','targetColumn','groupColumn','category','dimension','measure'];
        const _sections = SolsticeStore.get('canvas.sections') || [];
        _sections.forEach(sec => (sec.rows || []).forEach(row => (row.slots || []).forEach(slot => {
          if (!slot || !slot.config || slot.config.datasetId) return; // slots com base própria não são afetados
          const cfg = slot.config;
          const missing = [];
          _refKeysB3.forEach(k => { if (cfg[k] && !_newColsSet.has(cfg[k])) missing.push(cfg[k]); });
          if (missing.length) _brokenSlotsB3.push({ id: slot.id, type: slot.type, missing });
        })));
        // Sprint 40 / fix crítico: limpa filtros que apontam pra colunas
        // que não existem na nova base ativa. Mesmo padrão do _runIngestFile.
        try {
          const _curFiltersMS = SolsticeStore.get('filters') || {};
          const _cleanFiltersMS = {};
          let _droppedMS = 0;
          Object.keys(_curFiltersMS).forEach(c => {
            if (_newColsSet.has(c)){ _cleanFiltersMS[c] = _curFiltersMS[c]; }
            else { _droppedMS++; }
          });
          if (_droppedMS > 0) SolsticeStore.set('filters', _cleanFiltersMS);
          const _sdMS = SolsticeStore.get('ui.filters.smartDefaults');
          if (Array.isArray(_sdMS)){
            const _sdCleanMS = _sdMS.filter(s => s && _newColsSet.has(s.column));
            if (_sdCleanMS.length !== _sdMS.length) SolsticeStore.set('ui.filters.smartDefaults', _sdCleanMS);
          }
          const _shownMS = SolsticeStore.get('ui.filters.shown');
          if (Array.isArray(_shownMS)){
            const _shownCleanMS = _shownMS.filter(c => _newColsSet.has(c));
            if (_shownCleanMS.length !== _shownMS.length) SolsticeStore.set('ui.filters.shown', _shownCleanMS);
          }
        } catch(_){}

        // BUG-02 v3 + R-03 v3: batch com except:['ingest'] garante que
        // subscribers de ingest disparam mesmo dentro do batch.
        SolsticeStore.batch(() => {
          SolsticeStore.set('ingest', { rows: d.rows, columns: d.columns, types: d.types, errors: [], encoding: { encoding: 'utf-8', confidence: 1 } });
          SolsticeStore.set('dataset.rows', d.rows);
          SolsticeStore.set('dataset.columns', d.columns);
          SolsticeStore.set('dataset.types', d.types);
          SolsticeStore.set('dataset.name', d.name);
          SolsticeStore.set('dataset.source', d.source || 'multi');
          if (d.dictionary) SolsticeStore.set('dictionary', d.dictionary);
          SolsticeStore.set('datasets.activeId', d.id);
        }, { except: ['ingest'] });
        SolsticeStore.set('dataset.ready', true);
        // BUG-02 v3: força refresh direto do status bar (defesa em profundidade).
        try {
          const rEl = document.getElementById('status-rows');
          const cEl = document.getElementById('status-cols');
          if (rEl) rEl.textContent = (d.rows || []).length.toLocaleString('pt-BR');
          if (cEl) cEl.textContent = String((d.columns || []).length);
        } catch(_){}
        try {
          SolsticeEditor.showPanel();
          SolsticeEditor.renderPreview && SolsticeEditor.renderPreview();
          SolsticeEditor.render && SolsticeEditor.render();
          SolsticeEditor.updateQualityCard && SolsticeEditor.updateQualityCard();
          SolsticeEditor.renderDatasetSummary && SolsticeEditor.renderDatasetSummary();
          if (SolsticeEditor.renderMeasuresPanel) SolsticeEditor.renderMeasuresPanel();
          if (SolsticeEditor.renderDataActions) SolsticeEditor.renderDataActions();
          SolsticeCanvas && SolsticeCanvas.render && SolsticeCanvas.render();
        } catch(_){}
        _toast('success', 'Base ativada', d.name);
        if (_brokenSlotsB3.length){
          const cols = Array.from(new Set(_brokenSlotsB3.flatMap(s => s.missing))).slice(0, 4);
          _toast('warn',
            _brokenSlotsB3.length + ' componente(s) sem coluna nesta base',
            'Faltam: ' + cols.join(', ') + (_brokenSlotsB3.flatMap(s=>s.missing).length > cols.length ? '…' : '') + ' · reconfigure no inspector.'
          );
        }
      },

      remove(id){
        const datasets = (SolsticeStore.get('datasets') || []).slice();
        const idx = datasets.findIndex(d => d.id === id);
        if (idx < 0) return;
        const wasActive = SolsticeStore.get('datasets.activeId') === id;
        datasets.splice(idx, 1);
        SolsticeStore.set('datasets', datasets);
        if (wasActive){
          if (datasets.length) MultiCSV.activate(datasets[0].id);
          else {
            SolsticeStore.set('datasets.activeId', null);
          }
        }
        _toast('info', 'Base removida', 'do painel · arquivo intacto no disco');
      },

      addMore(){
        // Dispara o file input. _runIngestFile já arquiva via subscribe.
        const fi = document.getElementById('file-input');
        if (fi) fi.click();
        else _toast('warn', 'File input ausente', 'Recarregue a página.');
      },

      // API pública pra pegar dataset por ID/nome
      get(idOrName){
        const ds = SolsticeStore.get('datasets') || [];
        return ds.find(d => d.id === idOrName || d.name === idOrName);
      }
    };

    /* ==========================================================
       (6) RESPONSIVIDADE — toggle de sidebar mobile + observador
       ========================================================== */
    const Responsive = {
      install(){
        Responsive._addToggle();
        Responsive._installResizeWatcher();
      },
      _addToggle(){
        const header = document.querySelector('.solstice__header');
        if (!header || header.querySelector('.v56-sidebar-toggle')) return;
        const btn = _el('button', {
          class: 'v56-sidebar-toggle',
          title: 'Mostrar/ocultar painel lateral',
          'aria-label': 'Alternar sidebar',
          onclick: () => {
            const app = document.getElementById('app');
            if (!app) return;
            const open = app.getAttribute('data-v56-sidebar') === 'open';
            app.setAttribute('data-v56-sidebar', open ? 'closed' : 'open');
          }
        }, '☰');
        // Coloca como primeiro filho do header pra mobile
        header.insertBefore(btn, header.firstChild);
      },
      _installResizeWatcher(){
        // ResizeObserver no body — força re-render dos charts e fecha sidebar se voltou pra desktop
        let timeoutId = null;
        window.addEventListener('resize', () => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            try {
              if (window.Chart && Chart.instances) {
                Object.values(Chart.instances).forEach(ch => { try { ch.resize(); } catch(_){} });
              }
            } catch(_){}
            if (window.innerWidth > 900){
              const app = document.getElementById('app');
              if (app && app.getAttribute('data-v56-sidebar')) {
                app.removeAttribute('data-v56-sidebar');
              }
            }
          }, 80);
        });
      }
    };

    /* ==========================================================
       (7) PATCHES no Export menu + Table renderer
       ----------------------------------------------------------
       Adiciona opção PNG/PDF no modal de export e troca o renderer
       da Tabela para a versão virtualizada quando rows > 800.
       ========================================================== */
    const Wire = {
      install(){
        Wire._patchTableRenderer();
        Wire._patchExportModal();
        Wire._patchTimeSeriesPostRender();
      },

      _patchTableRenderer(){
        if (typeof SolsticeComponents === 'undefined' || !SolsticeComponents.registry) return;
        const def = SolsticeComponents.registry['table'];
        if (!def) return;
        if (def.__v56Patched) return;
        const original = def.render.bind(def);
        def.render = function(slot, host, ctx){
          const cfg = (slot && slot.config) || {};
          const rows = ctx.rows || [];
          // Modo flat + dataset grande → vai pra virtualizada
          if ((cfg.mode || 'flat') === 'flat' && rows.length > 800){
            try { return Vtable.render(slot, host, ctx); }
            catch(err){
              console.warn('[v5.6 Vtable falhou, usando renderer original]', err);
              return original(slot, host, ctx);
            }
          }
          // Senão, comportamento original (drill, ou flat com poucas linhas)
          return original(slot, host, ctx);
        };
        def.__v56Patched = true;
      },

      _patchExportModal(){
        if (typeof SolsticeExport === 'undefined') return;
        if (SolsticeExport.__v56Patched) return;
        const orig = SolsticeExport.openExportModal;
        SolsticeExport.openExportModal = async function(){
          // Antes de abrir o modal padrão, injeta nossa opção via timer
          await orig.apply(this, arguments);
        };
        // Plug B: adiciona um botão direto no header (mais visível)
        const exportBtn = document.getElementById('btn-export-menu');
        if (exportBtn && !document.getElementById('v56-export-image-btn')){
          // Não substitui — adiciona um menu item ao clicar.
          // Se houver dropdown que liste itens, injeta lá; caso contrário, o usuário pode
          // chamar via Command Palette / API: window.Solstice.V56.ExportImage.openModal()
        }
        // Plug C: integra no Command Palette
        try {
          if (typeof SolsticeCommandPalette !== 'undefined' && SolsticeCommandPalette.register){
            SolsticeCommandPalette.register({
              id: 'export-image',
              label: 'Exportar dashboard como imagem (PNG / JPEG / PDF)',
              icon: '🖼️',
              category: 'Export',
              syn: 'png pdf imagem screenshot apresentacao',
              run: () => ExportImage.openModal()
            });
            SolsticeCommandPalette.register({
              id: 'add-csv',
              label: 'Adicionar mais um CSV (multi-base)',
              icon: '📚',
              category: 'Dados',
              syn: 'csv multi base novo dataset',
              run: () => MultiCSV.addMore()
            });
          }
        } catch(_){}
        // Plug D: adiciona um botão visível ao lado de Exportar
        setTimeout(() => {
          const grp = document.querySelector('.solstice__header-actions .solstice__toolbar-group');
          if (!grp) return;
          if (document.getElementById('v56-export-image-btn')) return;
          const btn = _el('button', {
            id: 'v56-export-image-btn',
            class: 'solstice__btn',
            title: 'Exportar dashboard como imagem PNG / JPEG / PDF de alta resolução',
            'aria-label': 'Exportar como imagem',
            onclick: () => ExportImage.openModal()
          }, '🖼️ Imagem');
          // Adiciona no grupo "Arquivo"
          const exportBtn = document.getElementById('btn-export-menu');
          if (exportBtn && exportBtn.parentNode){
            exportBtn.parentNode.appendChild(btn);
          } else {
            grp.appendChild(btn);
          }
        }, 800);

        SolsticeExport.__v56Patched = true;
      },

      _patchTimeSeriesPostRender(){
        // Garante que o canvas de chart.js do time-series tenha cursor pointer
        // pra indicar que clica
        const css = document.createElement('style');
        css.textContent = '.solstice__comp[data-comp-type="time-series"] canvas, ' +
                          '.solstice__comp[data-comp-type="scatter"] .solstice__scatter-point { cursor: pointer; }';
        document.head.appendChild(css);
      }
    };

    /* ==========================================================
       (8) NEW COMPONENTS — bar, donut, area, waterfall
       ----------------------------------------------------------
       Identificado pelas 22 personas: muita gente procurou
       "gráfico de barras", "pizza", "waterfall" pelo nome e não
       achou. Registramos aliases que reusam renderers existentes.
       ========================================================== */
    const NewComponents = {
      install(){
        if (typeof SolsticeComponents === 'undefined' || !SolsticeComponents.register) return;
        if (NewComponents.__installed) return;
        NewComponents.__installed = true;
        const reg = SolsticeComponents.registry;
        if (!reg) return;

        // === BAR CHART (vertical/horizontal/ordenado) ===
        // Implementação: usa o renderer de Distribuição em modo categórica,
        // mas com etiqueta "Bar Chart" e config default que escolhe top categórica.
        if (!reg['bar']){
          const distDef = reg['distribution'];
          SolsticeComponents.register({
            id: 'bar', name: 'Gráfico de Barras', icon: '📊',
            description: 'Comparação categórica ordenada (vertical ou horizontal). Aceita ordenação asc/desc.',
            defaultConfig: (ctx) => {
              const def = (distDef && distDef.defaultConfig) ? distDef.defaultConfig(ctx) : {};
              // Força modo categórica priorizada
              const catCol = (ctx.columns || []).find(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'categorical';
              });
              return Object.assign({}, def, {
                column: catCol || def.column,
                orientation: 'horizontal',
                sortDesc: true,
                topN: 12,
                showLabels: true
              });
            },
            render(slot, host, ctx){
              if (!distDef || !distDef.render) {
                host.appendChild(_el('div', { class: 'solstice__comp-empty' }, 'Renderer não disponível.'));
                return;
              }
              // Delega para distribution.render
              return distDef.render(slot, host, ctx);
            }
          });
        }

        // === DONUT / PIZZA — composição de partes do todo ===
        if (!reg['donut']){
          const distDef = reg['distribution'];
          SolsticeComponents.register({
            id: 'donut', name: 'Donut / Pizza', icon: '🍩',
            description: 'Composição de partes do todo. Top categorias com fatias e percentual.',
            defaultConfig: (ctx) => {
              const catCol = (ctx.columns || []).find(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'categorical';
              });
              return { column: catCol || (ctx.columns || [])[0], topN: 6, showPercent: true, kind: 'donut' };
            },
            render(slot, host, ctx){
              const cfg = (slot && slot.config) || {};
              const col = cfg.column;
              if (!col){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' }, 'Selecione uma coluna categórica.'));
                return;
              }
              const counts = new Map();
              for (const r of (ctx.rows || [])){
                const v = r[col];
                if (v == null || v === '') continue;
                const k = String(v);
                counts.set(k, (counts.get(k) || 0) + 1);
              }
              if (!counts.size){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' }, 'Sem valores.'));
                return;
              }
              const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
              const topN = cfg.topN || 6;
              const top = sorted.slice(0, topN);
              const rest = sorted.slice(topN);
              if (rest.length){
                top.push(['Outros', rest.reduce((s, [, v]) => s + v, 0)]);
              }
              const total = top.reduce((s, [, v]) => s + v, 0);

              const W = 280, H = 220, cx = W/2, cy = H/2;
              const r = Math.min(W, H) / 2 - 16;
              const inner = (cfg.kind === 'pizza' ? 0 : r * 0.55);
              const NS = 'http://www.w3.org/2000/svg';
              const PALETTE = ['#5BA8FF','#F59E0B','#10B981','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#94A3B8'];

              const svg = document.createElementNS(NS, 'svg');
              svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
              svg.setAttribute('class', 'solstice__chart-svg');
              svg.style.width = '100%';
              svg.style.height = '100%';

              let acc = -Math.PI / 2; // 12h
              top.forEach(([k, v], i) => {
                const angle = (v / total) * Math.PI * 2;
                const x1 = cx + r * Math.cos(acc);
                const y1 = cy + r * Math.sin(acc);
                const x2 = cx + r * Math.cos(acc + angle);
                const y2 = cy + r * Math.sin(acc + angle);
                const large = angle > Math.PI ? 1 : 0;
                // Path: arco externo + linha pra centro (ou arco interno)
                let d;
                if (inner > 0){
                  const ix1 = cx + inner * Math.cos(acc);
                  const iy1 = cy + inner * Math.sin(acc);
                  const ix2 = cx + inner * Math.cos(acc + angle);
                  const iy2 = cy + inner * Math.sin(acc + angle);
                  d = 'M' + x1 + ',' + y1 +
                      ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x2 + ',' + y2 +
                      ' L' + ix2 + ',' + iy2 +
                      ' A' + inner + ',' + inner + ' 0 ' + large + ' 0 ' + ix1 + ',' + iy1 + ' Z';
                } else {
                  d = 'M' + cx + ',' + cy +
                      ' L' + x1 + ',' + y1 +
                      ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x2 + ',' + y2 + ' Z';
                }
                const path = document.createElementNS(NS, 'path');
                path.setAttribute('d', d);
                path.setAttribute('fill', PALETTE[i % PALETTE.length]);
                path.style.cursor = 'pointer';
                const title = document.createElementNS(NS, 'title');
                title.textContent = k + ': ' + v + ' (' + ((v/total)*100).toFixed(1) + '%)';
                path.appendChild(title);
                // Cross-filter
                path.addEventListener('click', () => {
                  try { SolsticeCrossFilter && SolsticeCrossFilter.activate && SolsticeCrossFilter.activate(col, k); } catch(_){}
                });
                svg.appendChild(path);
                acc += angle;
              });

              // Centro: total
              if (inner > 0){
                const c = document.createElementNS(NS, 'text');
                c.setAttribute('x', cx);
                c.setAttribute('y', cy);
                c.setAttribute('text-anchor', 'middle');
                c.setAttribute('font-size', '20');
                c.setAttribute('font-weight', '700');
                c.setAttribute('fill', 'currentColor');
                c.setAttribute('dy', '.35em');
                c.textContent = total >= 1000 ? (total/1000).toFixed(1) + 'k' : String(total);
                svg.appendChild(c);
              }

              const wrap = _el('div', { style: 'display:flex;gap:8px;height:100%;align-items:center;' });
              const svgWrap = _el('div', { style: 'flex:1;min-width:0;height:100%;' });
              svgWrap.appendChild(svg);
              const legend = _el('div', { style: 'flex:1;min-width:0;font-size:11px;display:flex;flex-direction:column;gap:3px;overflow:auto;' });
              top.forEach(([k, v], i) => {
                const it = _el('div', { style: 'display:flex;align-items:center;gap:6px;' },
                  _el('span', { style: 'width:10px;height:10px;background:' + PALETTE[i % PALETTE.length] + ';border-radius:2px;flex-shrink:0;' }),
                  _el('span', { style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, k),
                  _el('span', { style: 'font-family:var(--font-mono);color:var(--c-muted);font-size:10px;' }, cfg.showPercent ? ((v/total)*100).toFixed(1)+'%' : String(v))
                );
                legend.appendChild(it);
              });
              wrap.appendChild(svgWrap);
              wrap.appendChild(legend);
              host.appendChild(wrap);
            }
          });
        }

        // === AREA — alias semântico do time-series com kind:area ===
        if (!reg['area']){
          const tsDef = reg['time-series'];
          SolsticeComponents.register({
            id: 'area', name: 'Área (preenchida)', icon: '🏔️',
            description: 'Evolução temporal com área preenchida — destaca volume acumulado.',
            defaultConfig: (ctx) => {
              const def = (tsDef && tsDef.defaultConfig) ? tsDef.defaultConfig(ctx) : {};
              return Object.assign({}, def, { kind: 'area' });
            },
            render(slot, host, ctx){
              if (!tsDef || !tsDef.render){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' }, 'Renderer não disponível.'));
                return;
              }
              return tsDef.render(slot, host, ctx);
            }
          });
        }

        // === WATERFALL — pedido das CFOs (Roberto + Helena) ===
        if (!reg['waterfall']){
          SolsticeComponents.register({
            id: 'waterfall', name: 'Waterfall (cascata)', icon: '🪜',
            description: 'Decomposição de saldo: entradas e saídas que constroem o total final. Clássico para DRE.',
            defaultConfig: (ctx) => {
              const cats = (ctx.columns || []).filter(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'categorical';
              });
              const nums = (ctx.columns || []).filter(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'numeric';
              });
              return { categoryColumn: cats[0] || null, valueColumn: nums[0] || null, agg: 'sum', topN: 10 };
            },
            render(slot, host, ctx){
              const cfg = (slot && slot.config) || {};
              const catCol = cfg.categoryColumn;
              const valCol = cfg.valueColumn;
              if (!catCol || !valCol){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' },
                  'Selecione coluna categoria (ex: linha do DRE) e numérica (ex: valor).'));
                return;
              }
              const groups = new Map();
              for (const r of (ctx.rows || [])){
                const k = String(r[catCol] == null ? '—' : r[catCol]);
                const v = SolsticeStats.parseNum(r[valCol]);
                if (isNaN(v)) continue;
                if (cfg.agg === 'count') groups.set(k, (groups.get(k) || 0) + 1);
                else groups.set(k, (groups.get(k) || 0) + v); // sum default
              }
              const entries = Array.from(groups.entries());
              if (!entries.length){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' }, 'Sem valores.'));
                return;
              }
              // Acumulado pra construir as alturas
              let running = 0;
              const bars = entries.map(([k, v]) => {
                const start = running;
                running += v;
                return { label: k, value: v, start, end: running };
              });
              // Adiciona "Total" no fim
              bars.push({ label: 'Total', value: running, start: 0, end: running, isTotal: true });

              const W = 460, H = 240, padL = 38, padR = 10, padT = 12, padB = 36;
              const innerW = W - padL - padR;
              const innerH = H - padT - padB;
              const bw = innerW / bars.length;
              const maxAbs = Math.max(...bars.map(b => Math.abs(b.end)));
              const yScale = (val) => padT + innerH - (val / maxAbs) * innerH;
              const NS = 'http://www.w3.org/2000/svg';
              const svg = document.createElementNS(NS, 'svg');
              svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
              svg.setAttribute('class', 'solstice__chart-svg');
              svg.style.width = '100%'; svg.style.height = '100%';

              // Linhas zero + grade
              const zero = yScale(0);
              for (let i = 0; i <= 4; i++){
                const y = padT + (i/4) * innerH;
                const ln = document.createElementNS(NS, 'line');
                ln.setAttribute('x1', padL); ln.setAttribute('x2', W - padR);
                ln.setAttribute('y1', y); ln.setAttribute('y2', y);
                ln.setAttribute('stroke', 'currentColor'); ln.setAttribute('stroke-width', '0.5');
                ln.style.opacity = '0.1';
                svg.appendChild(ln);
              }
              // Eixo zero destacado
              const ln0 = document.createElementNS(NS, 'line');
              ln0.setAttribute('x1', padL); ln0.setAttribute('x2', W - padR);
              ln0.setAttribute('y1', zero); ln0.setAttribute('y2', zero);
              ln0.setAttribute('stroke', 'currentColor'); ln0.setAttribute('stroke-width', '1'); ln0.style.opacity = '0.35';
              svg.appendChild(ln0);

              bars.forEach((b, i) => {
                const x = padL + i * bw + 2;
                const w = bw - 4;
                const topY = yScale(Math.max(b.start, b.end));
                const botY = yScale(Math.min(b.start, b.end));
                const h = Math.max(2, botY - topY);
                const rect = document.createElementNS(NS, 'rect');
                rect.setAttribute('x', x.toFixed(1));
                rect.setAttribute('y', topY.toFixed(1));
                rect.setAttribute('width', w.toFixed(1));
                rect.setAttribute('height', h.toFixed(1));
                let color = '#10B981'; // verde — positivo
                if (b.isTotal) color = '#5BA8FF';
                else if (b.value < 0) color = '#EF4444';
                rect.setAttribute('fill', color);
                rect.style.opacity = '0.9';
                rect.style.cursor = 'pointer';
                const title = document.createElementNS(NS, 'title');
                title.textContent = b.label + ': ' + b.value.toFixed(2) + (b.isTotal ? ' (acumulado)' : '');
                rect.appendChild(title);
                rect.addEventListener('click', () => {
                  if (!b.isTotal){
                    try { SolsticeCrossFilter && SolsticeCrossFilter.activate && SolsticeCrossFilter.activate(catCol, b.label); } catch(_){}
                  }
                });
                svg.appendChild(rect);

                // Conector tracejado entre barras
                if (i < bars.length - 1 && !bars[i+1].isTotal){
                  const nx = padL + (i+1) * bw + 2;
                  const y = yScale(b.end);
                  const cn = document.createElementNS(NS, 'line');
                  cn.setAttribute('x1', (x + w).toFixed(1));
                  cn.setAttribute('x2', nx.toFixed(1));
                  cn.setAttribute('y1', y.toFixed(1)); cn.setAttribute('y2', y.toFixed(1));
                  cn.setAttribute('stroke', 'currentColor');
                  cn.setAttribute('stroke-width', '1');
                  cn.setAttribute('stroke-dasharray', '3,3');
                  cn.style.opacity = '0.45';
                  svg.appendChild(cn);
                }

                // Label categoria
                const lbl = document.createElementNS(NS, 'text');
                lbl.setAttribute('x', (x + w/2).toFixed(1));
                lbl.setAttribute('y', (H - 18).toFixed(1));
                lbl.setAttribute('text-anchor', 'middle');
                lbl.setAttribute('font-size', '9');
                lbl.setAttribute('fill', 'currentColor');
                lbl.style.opacity = '0.85';
                const labStr = b.label.length > 12 ? b.label.slice(0, 11) + '…' : b.label;
                lbl.textContent = labStr;
                svg.appendChild(lbl);

                // Valor
                const val = document.createElementNS(NS, 'text');
                val.setAttribute('x', (x + w/2).toFixed(1));
                val.setAttribute('y', (H - 4).toFixed(1));
                val.setAttribute('text-anchor', 'middle');
                val.setAttribute('font-size', '9');
                val.setAttribute('fill', 'currentColor');
                val.style.fontFamily = 'var(--font-mono)';
                val.style.opacity = '0.7';
                val.textContent = b.value >= 1000 ? (b.value/1000).toFixed(1) + 'k' : b.value.toFixed(1);
                svg.appendChild(val);
              });
              host.appendChild(svg);
            }
          });
        }
      }
    };

    /* ==========================================================
       (10) ROUND-3 COMPONENTS — heatmap matricial, treemap, radar,
            tile map Brasil (choropleth simplificado)
       ----------------------------------------------------------
       Pedidos repetidos em 46 personas. Implementação SVG nativa,
       sem libs externas, peso baixo.
       ========================================================== */
    const Round3Components = {
      install(){
        if (typeof SolsticeComponents === 'undefined') return;
        if (Round3Components.__installed) return;
        Round3Components.__installed = true;
        const reg = SolsticeComponents.registry;
        if (!reg) return;

        // PALETA universal pra heatmap (azul → laranja, divergente)
        function _heatColor(t){
          // t em [0,1] — sequencial azul → branco → vermelho
          t = Math.max(0, Math.min(1, t));
          if (t < 0.5){
            const k = t * 2; // 0..1 no segmento azul → branco
            const r = Math.round(91 + k * (255-91));
            const g = Math.round(168 + k * (255-168));
            const b = Math.round(255);
            return 'rgb(' + r + ',' + g + ',' + b + ')';
          } else {
            const k = (t - 0.5) * 2; // 0..1 no segmento branco → laranja/vermelho
            const r = Math.round(255);
            const g = Math.round(255 - k * (255-100));
            const b = Math.round(255 - k * (255-50));
            return 'rgb(' + r + ',' + g + ',' + b + ')';
          }
        }

        // === HEATMAP MATRICIAL (linha × coluna × cor) ===
        if (!reg['heatmap']){
          SolsticeComponents.register({
            id: 'heatmap', name: 'Heatmap (Matriz)', icon: '🔥',
            description: 'Matriz coloridado por valor — linha × coluna × cor. Surveys, correlação, intensidade.',
            defaultConfig: (ctx) => {
              const cats = (ctx.columns || []).filter(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'categorical';
              });
              const nums = (ctx.columns || []).filter(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'numeric';
              });
              return {
                rowColumn: cats[0] || null,
                colColumn: cats[1] || cats[0] || null,
                valueColumn: nums[0] || null,
                agg: 'avg',
                maxRows: 20,
                maxCols: 20
              };
            },
            render(slot, host, ctx){
              const cfg = (slot && slot.config) || {};
              const rowCol = cfg.rowColumn, colCol = cfg.colColumn, valCol = cfg.valueColumn;
              if (!rowCol || !colCol){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' },
                  'Selecione 2 colunas categóricas (linha e coluna) e opcionalmente uma numérica.'));
                return;
              }
              // Agrega
              const matrix = new Map(); // rowKey → Map<colKey, {sum, count}>
              const rowSet = new Set(), colSet = new Set();
              for (const r of (ctx.rows || [])){
                const rk = r[rowCol] == null ? '—' : String(r[rowCol]);
                const ck = r[colCol] == null ? '—' : String(r[colCol]);
                rowSet.add(rk); colSet.add(ck);
                if (!matrix.has(rk)) matrix.set(rk, new Map());
                const m = matrix.get(rk);
                if (!m.has(ck)) m.set(ck, { sum: 0, count: 0 });
                const cell = m.get(ck);
                if (valCol){
                  const v = SolsticeStats.parseNum(r[valCol]);
                  if (!isNaN(v)){ cell.sum += v; cell.count++; }
                } else {
                  cell.count++;
                }
              }
              const maxRows = cfg.maxRows || 20;
              const maxCols = cfg.maxCols || 20;
              const rows = Array.from(rowSet).slice(0, maxRows);
              const cols = Array.from(colSet).slice(0, maxCols);

              // Calcula valor de cada célula
              const data = [];
              let mn = Infinity, mx = -Infinity;
              rows.forEach(rk => {
                const m = matrix.get(rk) || new Map();
                cols.forEach(ck => {
                  const cell = m.get(ck);
                  let v = null;
                  if (cell){
                    if (cfg.agg === 'count' || !valCol) v = cell.count;
                    else if (cfg.agg === 'sum') v = cell.sum;
                    else v = cell.count ? cell.sum / cell.count : null; // avg
                  }
                  if (v != null){ if (v < mn) mn = v; if (v > mx) mx = v; }
                  data.push({ rk, ck, v });
                });
              });
              if (!isFinite(mn) || !isFinite(mx)){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' }, 'Sem dados.'));
                return;
              }

              const W = 460, H = 240;
              const padL = 90, padT = 50, padR = 12, padB = 12;
              const innerW = W - padL - padR;
              const innerH = H - padT - padB;
              const cw = innerW / cols.length;
              const ch = innerH / rows.length;
              const NS = 'http://www.w3.org/2000/svg';
              const svg = document.createElementNS(NS, 'svg');
              svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
              svg.setAttribute('class', 'solstice__chart-svg');
              svg.style.width = '100%'; svg.style.height = '100%';

              // Header (col labels) — rotacionado se muitos
              cols.forEach((ck, ci) => {
                const x = padL + ci * cw + cw / 2;
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', x);
                t.setAttribute('y', padT - 4);
                t.setAttribute('text-anchor', cols.length > 8 ? 'start' : 'middle');
                t.setAttribute('font-size', '9');
                t.setAttribute('fill', 'currentColor');
                if (cols.length > 8){
                  t.setAttribute('transform', 'rotate(-45 ' + x + ',' + (padT - 4) + ')');
                }
                t.textContent = ck.length > 14 ? ck.slice(0, 13) + '…' : ck;
                svg.appendChild(t);
              });
              // Row labels
              rows.forEach((rk, ri) => {
                const y = padT + ri * ch + ch / 2 + 3;
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', padL - 4);
                t.setAttribute('y', y);
                t.setAttribute('text-anchor', 'end');
                t.setAttribute('font-size', '9');
                t.setAttribute('fill', 'currentColor');
                t.textContent = rk.length > 14 ? rk.slice(0, 13) + '…' : rk;
                svg.appendChild(t);
              });

              // Cells
              const range = (mx - mn) || 1;
              data.forEach(({ rk, ck, v }) => {
                const ri = rows.indexOf(rk);
                const ci = cols.indexOf(ck);
                if (ri < 0 || ci < 0) return;
                const x = padL + ci * cw;
                const y = padT + ri * ch;
                const rect = document.createElementNS(NS, 'rect');
                rect.setAttribute('x', (x + 1).toFixed(1));
                rect.setAttribute('y', (y + 1).toFixed(1));
                rect.setAttribute('width', Math.max(0, cw - 2).toFixed(1));
                rect.setAttribute('height', Math.max(0, ch - 2).toFixed(1));
                if (v == null){
                  rect.setAttribute('fill', 'rgba(120,120,120,0.06)');
                } else {
                  rect.setAttribute('fill', _heatColor((v - mn) / range));
                  rect.style.cursor = 'pointer';
                  rect.addEventListener('click', () => {
                    try { SolsticeCrossFilter && SolsticeCrossFilter.activate && SolsticeCrossFilter.activate(rowCol, rk); } catch(_){}
                  });
                }
                const title = document.createElementNS(NS, 'title');
                title.textContent = rk + ' · ' + ck + ' = ' + (v == null ? '—' : (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)));
                rect.appendChild(title);
                svg.appendChild(rect);
                // Valor in-cell se célula grande
                if (cw > 36 && ch > 22 && v != null){
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', (x + cw/2).toFixed(1));
                  t.setAttribute('y', (y + ch/2 + 3).toFixed(1));
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-size', '8');
                  t.setAttribute('fill', '#0F172A');
                  t.style.fontFamily = 'var(--font-mono)';
                  t.textContent = Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
                  svg.appendChild(t);
                }
              });
              // Legenda de cor (mín/máx)
              const legY = H - 6;
              const legW = 110;
              const legX = W - padR - legW;
              for (let i = 0; i < legW; i++){
                const ln = document.createElementNS(NS, 'line');
                ln.setAttribute('x1', (legX + i)); ln.setAttribute('x2', (legX + i));
                ln.setAttribute('y1', legY - 4); ln.setAttribute('y2', legY);
                ln.setAttribute('stroke', _heatColor(i / legW));
                svg.appendChild(ln);
              }
              const lblMn = document.createElementNS(NS, 'text');
              lblMn.setAttribute('x', legX); lblMn.setAttribute('y', legY + 8);
              lblMn.setAttribute('font-size', '8'); lblMn.setAttribute('fill', 'currentColor');
              lblMn.textContent = (Math.abs(mn) >= 100 ? mn.toFixed(0) : mn.toFixed(1));
              svg.appendChild(lblMn);
              const lblMx = document.createElementNS(NS, 'text');
              lblMx.setAttribute('x', legX + legW); lblMx.setAttribute('y', legY + 8);
              lblMx.setAttribute('text-anchor', 'end');
              lblMx.setAttribute('font-size', '8'); lblMx.setAttribute('fill', 'currentColor');
              lblMx.textContent = (Math.abs(mx) >= 100 ? mx.toFixed(0) : mx.toFixed(1));
              svg.appendChild(lblMx);
              host.appendChild(svg);
            }
          });
        }

        // === TREEMAP (squarify simplificado) ===
        if (!reg['treemap']){
          SolsticeComponents.register({
            id: 'treemap', name: 'Treemap', icon: '🟦',
            description: 'Composição hierárquica por área. Quanto maior o retângulo, maior o valor.',
            defaultConfig: (ctx) => {
              const cats = (ctx.columns || []).filter(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'categorical';
              });
              const nums = (ctx.columns || []).filter(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'numeric';
              });
              return {
                groupColumn: cats[0] || null,
                valueColumn: nums[0] || null,
                topN: 24
              };
            },
            render(slot, host, ctx){
              const cfg = (slot && slot.config) || {};
              const gCol = cfg.groupColumn, vCol = cfg.valueColumn;
              if (!gCol){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' },
                  'Selecione coluna categórica para agrupar.'));
                return;
              }
              const groups = new Map();
              for (const r of (ctx.rows || [])){
                const k = r[gCol] == null ? '—' : String(r[gCol]);
                let v = 1;
                if (vCol){
                  const p = SolsticeStats.parseNum(r[vCol]);
                  if (!isNaN(p)) v = p; else continue;
                }
                groups.set(k, (groups.get(k) || 0) + v);
              }
              const sorted = Array.from(groups.entries()).filter(([,v]) => v > 0).sort((a,b) => b[1] - a[1]);
              const topN = cfg.topN || 24;
              const items = sorted.slice(0, topN).map(([k, v]) => ({ label: k, value: v }));
              if (!items.length){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' }, 'Sem valores positivos.'));
                return;
              }
              const total = items.reduce((s, i) => s + i.value, 0);

              const W = 460, H = 240;
              // Squarify simplificado — row-based packing
              const PALETTE = ['#5BA8FF','#F59E0B','#10B981','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#94A3B8','#A78BFA','#22D3EE','#F472B6'];
              const NS = 'http://www.w3.org/2000/svg';
              const svg = document.createElementNS(NS, 'svg');
              svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
              svg.setAttribute('class', 'solstice__chart-svg');
              svg.style.width = '100%'; svg.style.height = '100%';

              // Algoritmo: divide área em retângulos com proporção ~= sqrt(qtd) por linha
              let remaining = items.slice();
              let x = 0, y = 0;
              let availW = W, availH = H;
              let valuesLeft = total;

              while (remaining.length){
                // Quantos itens nessa "linha"
                const n = Math.min(remaining.length, Math.max(1, Math.round(Math.sqrt(remaining.length))));
                const rowItems = remaining.splice(0, n);
                const rowSum = rowItems.reduce((s, i) => s + i.value, 0);
                // Decide orientação: linha horizontal se largura > altura
                const horizontal = availW >= availH;
                const totalSpan = horizontal ? availW : availH;
                const fixedSpan = (rowSum / valuesLeft) * (horizontal ? availH : availW);
                let cur = horizontal ? x : y;
                rowItems.forEach((it, idx) => {
                  const len = (it.value / rowSum) * totalSpan;
                  const rx = horizontal ? cur : x;
                  const ry = horizontal ? y : cur;
                  const rw = horizontal ? len : fixedSpan;
                  const rh = horizontal ? fixedSpan : len;
                  const rect = document.createElementNS(NS, 'rect');
                  rect.setAttribute('x', rx.toFixed(1));
                  rect.setAttribute('y', ry.toFixed(1));
                  rect.setAttribute('width', Math.max(0, rw - 1).toFixed(1));
                  rect.setAttribute('height', Math.max(0, rh - 1).toFixed(1));
                  rect.setAttribute('fill', PALETTE[(items.indexOf(it)) % PALETTE.length]);
                  rect.style.opacity = '0.85';
                  rect.style.cursor = 'pointer';
                  rect.setAttribute('rx', '2');
                  const ttl = document.createElementNS(NS, 'title');
                  const pct = (it.value / total * 100).toFixed(1);
                  ttl.textContent = it.label + ': ' + (it.value >= 1000 ? (it.value/1000).toFixed(1) + 'k' : it.value.toFixed(1)) + ' (' + pct + '%)';
                  rect.appendChild(ttl);
                  rect.addEventListener('click', () => {
                    try { SolsticeCrossFilter && SolsticeCrossFilter.activate && SolsticeCrossFilter.activate(gCol, it.label); } catch(_){}
                  });
                  svg.appendChild(rect);

                  // Label inline se tiver espaço
                  if (rw > 56 && rh > 26){
                    const t = document.createElementNS(NS, 'text');
                    t.setAttribute('x', (rx + 4).toFixed(1));
                    t.setAttribute('y', (ry + 12).toFixed(1));
                    t.setAttribute('font-size', '10');
                    t.setAttribute('fill', '#0F172A');
                    t.style.fontWeight = '600';
                    t.textContent = it.label.length > Math.floor(rw/6) ? it.label.slice(0, Math.floor(rw/6)) + '…' : it.label;
                    svg.appendChild(t);
                    const t2 = document.createElementNS(NS, 'text');
                    t2.setAttribute('x', (rx + 4).toFixed(1));
                    t2.setAttribute('y', (ry + 24).toFixed(1));
                    t2.setAttribute('font-size', '9');
                    t2.setAttribute('fill', '#0F172A');
                    t2.style.opacity = '0.75';
                    t2.style.fontFamily = 'var(--font-mono)';
                    t2.textContent = pct + '%';
                    svg.appendChild(t2);
                  }
                  cur += len;
                });
                if (horizontal){ y += fixedSpan; availH -= fixedSpan; }
                else { x += fixedSpan; availW -= fixedSpan; }
                valuesLeft -= rowSum;
                if (availW <= 0 || availH <= 0) break;
              }
              host.appendChild(svg);
            }
          });
        }

        // === RADAR CHART ===
        if (!reg['radar']){
          SolsticeComponents.register({
            id: 'radar', name: 'Radar (eixos polares)', icon: '🕷️',
            description: 'Perfil de múltiplos atributos numéricos. Compara um item contra média ou múltiplos itens.',
            defaultConfig: (ctx) => {
              const cats = (ctx.columns || []).filter(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'categorical';
              });
              const nums = (ctx.columns || []).filter(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'numeric';
              });
              return {
                groupColumn: cats[0] || null,
                metricColumns: nums.slice(0, 6),
                showAverage: true,
                topN: 3
              };
            },
            render(slot, host, ctx){
              const cfg = (slot && slot.config) || {};
              const gCol = cfg.groupColumn;
              const metrics = (cfg.metricColumns || []).filter(c => (ctx.columns || []).includes(c));
              if (!gCol || metrics.length < 3){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' },
                  'Radar precisa de 1 categoria + 3 ou mais colunas numéricas.'));
                return;
              }
              // Agrupa: média de cada métrica por grupo
              const groupAgg = new Map();
              for (const r of (ctx.rows || [])){
                const k = r[gCol] == null ? '—' : String(r[gCol]);
                if (!groupAgg.has(k)) groupAgg.set(k, {});
                const a = groupAgg.get(k);
                metrics.forEach(m => {
                  const v = SolsticeStats.parseNum(r[m]);
                  if (isNaN(v)) return;
                  if (!a[m]) a[m] = { sum: 0, count: 0 };
                  a[m].sum += v; a[m].count++;
                });
              }
              // Top N grupos pela soma da 1ª métrica
              const sortedGroups = Array.from(groupAgg.entries())
                .filter(([, a]) => a[metrics[0]])
                .sort((a, b) => (b[1][metrics[0]].sum) - (a[1][metrics[0]].sum))
                .slice(0, cfg.topN || 3);

              if (!sortedGroups.length){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' }, 'Sem grupos válidos.'));
                return;
              }
              // Min/max global por métrica para normalizar
              const ranges = {};
              metrics.forEach(m => {
                let mn = Infinity, mx = -Infinity;
                groupAgg.forEach(a => {
                  if (!a[m]) return;
                  const avg = a[m].sum / a[m].count;
                  if (avg < mn) mn = avg; if (avg > mx) mx = avg;
                });
                ranges[m] = { min: mn, max: mx };
              });

              const W = 380, H = 240;
              const cx = W/2, cy = H/2;
              const r = Math.min(W, H) / 2 - 30;
              const PALETTE = ['#5BA8FF','#F59E0B','#10B981','#EF4444','#8B5CF6'];
              const NS = 'http://www.w3.org/2000/svg';
              const svg = document.createElementNS(NS, 'svg');
              svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
              svg.setAttribute('class', 'solstice__chart-svg');
              svg.style.width = '100%'; svg.style.height = '100%';

              // Grade circular (4 níveis)
              for (let i = 1; i <= 4; i++){
                const c = document.createElementNS(NS, 'circle');
                c.setAttribute('cx', cx); c.setAttribute('cy', cy);
                c.setAttribute('r', (r * i / 4).toFixed(1));
                c.setAttribute('fill', 'none');
                c.setAttribute('stroke', 'currentColor');
                c.setAttribute('stroke-width', '0.5');
                c.style.opacity = '0.15';
                svg.appendChild(c);
              }
              // Eixos + labels
              const n = metrics.length;
              metrics.forEach((m, i) => {
                const angle = (i / n) * Math.PI * 2 - Math.PI/2;
                const x2 = cx + r * Math.cos(angle);
                const y2 = cy + r * Math.sin(angle);
                const ln = document.createElementNS(NS, 'line');
                ln.setAttribute('x1', cx); ln.setAttribute('y1', cy);
                ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
                ln.setAttribute('stroke', 'currentColor');
                ln.setAttribute('stroke-width', '0.5');
                ln.style.opacity = '0.2';
                svg.appendChild(ln);
                // Label
                const lx = cx + (r + 14) * Math.cos(angle);
                const ly = cy + (r + 14) * Math.sin(angle);
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', lx); t.setAttribute('y', ly);
                t.setAttribute('text-anchor', Math.abs(Math.cos(angle)) < 0.3 ? 'middle' : (Math.cos(angle) > 0 ? 'start' : 'end'));
                t.setAttribute('font-size', '9');
                t.setAttribute('fill', 'currentColor');
                t.textContent = m.length > 12 ? m.slice(0, 11) + '…' : m;
                svg.appendChild(t);
              });
              // Polígono pra cada grupo
              const legend = _el('div', { style: 'display:flex;gap:8px;font-size:10px;justify-content:center;flex-wrap:wrap;margin-top:4px;' });
              sortedGroups.forEach(([gk, a], gi) => {
                const points = metrics.map((m, mi) => {
                  const angle = (mi / n) * Math.PI * 2 - Math.PI/2;
                  const cell = a[m];
                  let val = cell ? (cell.sum / cell.count) : ranges[m].min;
                  const range = (ranges[m].max - ranges[m].min) || 1;
                  const norm = (val - ranges[m].min) / range;
                  const rad = r * norm;
                  return (cx + rad * Math.cos(angle)).toFixed(1) + ',' + (cy + rad * Math.sin(angle)).toFixed(1);
                }).join(' ');
                const poly = document.createElementNS(NS, 'polygon');
                poly.setAttribute('points', points);
                poly.setAttribute('fill', PALETTE[gi % PALETTE.length]);
                poly.setAttribute('stroke', PALETTE[gi % PALETTE.length]);
                poly.setAttribute('stroke-width', '2');
                poly.style.fillOpacity = '0.15';
                svg.appendChild(poly);
                legend.appendChild(_el('span', { style: 'display:flex;align-items:center;gap:4px;' },
                  _el('span', { style: 'width:10px;height:10px;background:' + PALETTE[gi % PALETTE.length] + ';border-radius:2px;' }),
                  _el('span', null, gk.length > 16 ? gk.slice(0, 15) + '…' : gk)
                ));
              });
              host.appendChild(svg);
              host.appendChild(legend);
            }
          });
        }

        // === TILE MAP BRASIL (choropleth simplificado) ===
        if (!reg['choropleth-br']){
          // Coordenadas tile-grid dos 27 UFs em grid 9x10 — referência: tilegrams BR
          // [row, col] indexado de 0
          const UF_TILES = {
            'RR': [0, 4], 'AP': [0, 5],
            'AM': [1, 3], 'PA': [1, 4], 'MA': [1, 5], 'CE': [1, 6], 'RN': [1, 7],
            'AC': [2, 2], 'TO': [2, 4], 'PI': [2, 5], 'PE': [2, 6], 'PB': [2, 7],
            'RO': [3, 2], 'MT': [3, 3], 'BA': [3, 5], 'AL': [3, 6], 'SE': [3, 7],
            'MS': [4, 3], 'GO': [4, 4], 'MG': [4, 5], 'ES': [4, 6],
            'DF': [4, 4.5],  // sobrepõe GO levemente — opcional, decidi colocar entre GO e MG
            'SP': [5, 4], 'RJ': [5, 5],
            'PR': [6, 4],
            'SC': [7, 4],
            'RS': [8, 4]
          };
          // Mapeia nome completo → UF
          const UF_NAMES = {
            'acre':'AC','alagoas':'AL','amapa':'AP','amapá':'AP','amazonas':'AM',
            'bahia':'BA','ceara':'CE','ceará':'CE','distrito federal':'DF','espirito santo':'ES','espírito santo':'ES',
            'goias':'GO','goiás':'GO','maranhao':'MA','maranhão':'MA','mato grosso':'MT','mato grosso do sul':'MS',
            'minas gerais':'MG','para':'PA','pará':'PA','paraiba':'PB','paraíba':'PB','parana':'PR','paraná':'PR',
            'pernambuco':'PE','piaui':'PI','piauí':'PI','rio de janeiro':'RJ','rio grande do norte':'RN',
            'rio grande do sul':'RS','rondonia':'RO','rondônia':'RO','roraima':'RR','santa catarina':'SC',
            'sao paulo':'SP','são paulo':'SP','sergipe':'SE','tocantins':'TO'
          };
          function _normUF(v){
            if (v == null) return null;
            const s = String(v).trim();
            const up = s.toUpperCase();
            if (UF_TILES[up]) return up;
            const lo = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
            return UF_NAMES[lo] || null;
          }

          SolsticeComponents.register({
            id: 'choropleth-br', name: 'Mapa Brasil (tile)', icon: '🇧🇷',
            description: 'Tile-grid dos 27 estados com cor por valor. Ideal para indicadores regionais sem dependência de SVG geográfico pesado.',
            defaultConfig: (ctx) => {
              // Auto-detect coluna de UF
              const cols = ctx.columns || [];
              let ufCol = null;
              for (const c of cols){
                const sample = (ctx.rows || []).slice(0, 50).map(r => r[c]);
                let hits = 0;
                for (const v of sample){ if (_normUF(v)) hits++; }
                if (hits / Math.max(1, sample.length) > 0.5){ ufCol = c; break; }
              }
              const nums = cols.filter(c => {
                const t = ctx.types && ctx.types[c] && ctx.types[c].type;
                return t && SolsticeTypes.group(t) === 'numeric';
              });
              return { ufColumn: ufCol, valueColumn: nums[0] || null, agg: 'sum' };
            },
            render(slot, host, ctx){
              const cfg = (slot && slot.config) || {};
              const ufCol = cfg.ufColumn, vCol = cfg.valueColumn;
              if (!ufCol){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' },
                  'Selecione coluna com UF/estado em ⚙️ (ex: SP, BA, "Rio de Janeiro").'));
                return;
              }
              // Agrega
              const agg = {};
              for (const r of (ctx.rows || [])){
                const uf = _normUF(r[ufCol]);
                if (!uf) continue;
                if (!agg[uf]) agg[uf] = { sum: 0, count: 0 };
                if (vCol){
                  const v = SolsticeStats.parseNum(r[vCol]);
                  if (!isNaN(v)){ agg[uf].sum += v; agg[uf].count++; }
                } else {
                  agg[uf].count++;
                }
              }
              const values = {};
              let mn = Infinity, mx = -Infinity;
              for (const uf in agg){
                let v;
                if (cfg.agg === 'count' || !vCol) v = agg[uf].count;
                else if (cfg.agg === 'avg') v = agg[uf].count ? agg[uf].sum / agg[uf].count : null;
                else v = agg[uf].sum;
                if (v == null) continue;
                values[uf] = v;
                if (v < mn) mn = v; if (v > mx) mx = v;
              }
              if (!isFinite(mn)){
                host.appendChild(_el('div', { class: 'solstice__comp-empty' },
                  'Nenhum UF reconhecido. Use siglas (SP, RJ) ou nomes completos.'));
                return;
              }

              const W = 360, H = 320;
              const cell = 32;
              const padX = (W - 9 * cell) / 2;
              const padY = 8;
              const NS = 'http://www.w3.org/2000/svg';
              const svg = document.createElementNS(NS, 'svg');
              svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
              svg.setAttribute('class', 'solstice__chart-svg');
              svg.style.width = '100%'; svg.style.height = '100%';

              const range = (mx - mn) || 1;
              Object.entries(UF_TILES).forEach(([uf, [row, col]]) => {
                const v = values[uf];
                const x = padX + col * cell;
                const y = padY + row * cell;
                const rect = document.createElementNS(NS, 'rect');
                rect.setAttribute('x', x.toFixed(1)); rect.setAttribute('y', y.toFixed(1));
                rect.setAttribute('width', (cell - 2).toFixed(1));
                rect.setAttribute('height', (cell - 2).toFixed(1));
                rect.setAttribute('rx', '3');
                if (v == null){
                  rect.setAttribute('fill', 'rgba(120,120,120,0.10)');
                  rect.setAttribute('stroke', 'rgba(120,120,120,0.25)');
                } else {
                  rect.setAttribute('fill', _heatColor((v - mn) / range));
                  rect.style.cursor = 'pointer';
                  rect.addEventListener('click', () => {
                    try { SolsticeCrossFilter && SolsticeCrossFilter.activate && SolsticeCrossFilter.activate(ufCol, uf); } catch(_){}
                  });
                }
                const ttl = document.createElementNS(NS, 'title');
                ttl.textContent = uf + (v == null ? ' (sem dado)' : (': ' + (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2))));
                rect.appendChild(ttl);
                svg.appendChild(rect);
                // Sigla UF
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', (x + (cell-2)/2).toFixed(1));
                t.setAttribute('y', (y + 14).toFixed(1));
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-size', '10');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', v == null ? 'currentColor' : '#0F172A');
                t.textContent = uf;
                svg.appendChild(t);
                // Valor
                if (v != null){
                  const tv = document.createElementNS(NS, 'text');
                  tv.setAttribute('x', (x + (cell-2)/2).toFixed(1));
                  tv.setAttribute('y', (y + 24).toFixed(1));
                  tv.setAttribute('text-anchor', 'middle');
                  tv.setAttribute('font-size', '8');
                  tv.setAttribute('fill', '#0F172A');
                  tv.style.fontFamily = 'var(--font-mono)';
                  tv.style.opacity = '0.75';
                  tv.textContent = Math.abs(v) >= 1000 ? (v/1000).toFixed(1)+'k' : (v >= 10 ? v.toFixed(0) : v.toFixed(1));
                  svg.appendChild(tv);
                }
              });
              // Legenda
              const legY = H - 14;
              const legW = 180;
              const legX = (W - legW) / 2;
              for (let i = 0; i < legW; i++){
                const ln = document.createElementNS(NS, 'line');
                ln.setAttribute('x1', (legX + i)); ln.setAttribute('x2', (legX + i));
                ln.setAttribute('y1', legY); ln.setAttribute('y2', legY + 5);
                ln.setAttribute('stroke', _heatColor(i / legW));
                svg.appendChild(ln);
              }
              const lmn = document.createElementNS(NS, 'text');
              lmn.setAttribute('x', legX); lmn.setAttribute('y', legY - 2);
              lmn.setAttribute('font-size', '8'); lmn.setAttribute('fill', 'currentColor');
              lmn.textContent = Math.abs(mn) >= 1000 ? (mn/1000).toFixed(1)+'k' : mn.toFixed(1);
              svg.appendChild(lmn);
              const lmx = document.createElementNS(NS, 'text');
              lmx.setAttribute('x', legX + legW); lmx.setAttribute('y', legY - 2);
              lmx.setAttribute('text-anchor', 'end');
              lmx.setAttribute('font-size', '8'); lmx.setAttribute('fill', 'currentColor');
              lmx.textContent = Math.abs(mx) >= 1000 ? (mx/1000).toFixed(1)+'k' : mx.toFixed(1);
              svg.appendChild(lmx);
              host.appendChild(svg);
            }
          });
        }
      }
    };

    /* ==========================================================
       (11) UX MILESTONES — derivado das frustrações de personas
            de perfil baixo (Júlio, Hugo, Sofia, Cíntia, Yasmin, etc.)
       ----------------------------------------------------------
       (11a) CTA gigante no canvas vazio
       (11b) Modo Iniciante — esconde abas Style/Analysis no inspector
       (11c) Branding rápido — header com título + cor + logo
       (11d) Pareto = Bar com linha % cumulativa
       ========================================================== */
    const UX3 = {
      install(){
        if (UX3.__installed) return;
        UX3.__installed = true;
        UX3._injectStyles();
        UX3._installCanvasCTA();
        UX3._installBeginnerMode();
        UX3._installBranding();
        UX3._patchBarPareto();
      },

      _injectStyles(){
        const css = document.createElement('style');
        css.textContent = `
          .v56-canvas-cta {
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 40px 24px;
            min-height: 50vh;
            text-align: center;
            color: var(--c-text-2);
            background: linear-gradient(180deg, transparent, var(--c-surface-2));
            border-radius: var(--rad-lg);
            margin: 16px;
            border: 2px dashed var(--c-border);
          }
          .v56-canvas-cta__icon { font-size: 56px; margin-bottom: 14px; opacity: 0.85; }
          .v56-canvas-cta__title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--c-text); margin-bottom: 6px; }
          .v56-canvas-cta__sub { font-size: 13px; color: var(--c-text-2); max-width: 480px; margin-bottom: 22px; line-height: 1.5; }
          .v56-canvas-cta__actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
          .v56-canvas-cta__btn {
            background: var(--c-accent); color: #fff;
            border: 0; padding: 12px 22px; border-radius: var(--rad-md);
            font-size: 14px; font-weight: 600; cursor: pointer;
            transition: transform 0.15s, box-shadow 0.15s;
            display: inline-flex; align-items: center; gap: 8px;
          }
          .v56-canvas-cta__btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,0,0,0.25); }
          .v56-canvas-cta__btn--ghost {
            background: var(--c-surface);
            color: var(--c-text);
            border: 1px solid var(--c-border);
          }
          .v56-canvas-cta__hint {
            margin-top: 18px; font-size: 11px; color: var(--c-muted);
            display: flex; gap: 16px; align-items: center;
          }
          .v56-canvas-cta__hint kbd {
            background: var(--c-surface);
            border: 1px solid var(--c-border);
            padding: 2px 6px; border-radius: 3px;
            font-family: var(--font-mono); font-size: 10px;
          }
          /* Modo iniciante — esconde accordions avançadas do inspector
             CORRIGIDO: o inspector usa createAccordion (não data-tab),
             então marcamos cada accordion com data-v56-section pelo Store key,
             e CSS esconde os "avançados" (estilo / análise / métodos / decisões).
             O JS abaixo (_installBeginnerMode) marca os accordions após render. */
          .solstice__app[data-v56-beginner="1"] .solstice__accord[data-v56-section="estilo"],
          .solstice__app[data-v56-beginner="1"] .solstice__accord[data-v56-section="analise"],
          .solstice__app[data-v56-beginner="1"] .solstice__accord[data-v56-section="metodos"],
          .solstice__app[data-v56-beginner="1"] .solstice__accord[data-v56-section="decisoes"],
          .solstice__app[data-v56-beginner="1"] .solstice__accord[data-v56-section="origem"] {
            display: none !important;
          }
          /* Toggle modo iniciante na sidebar */
          .v56-beginner-toggle {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 10px; margin-top: 8px;
            background: var(--c-surface-2);
            border-radius: var(--rad-sm);
            cursor: pointer; font-size: 11px;
            color: var(--c-text-2);
            user-select: none;
          }
          .v56-beginner-toggle:hover { background: var(--c-surface-3); }
          .v56-beginner-toggle input { cursor: pointer; }
          /* Branding bar */
          .v56-brand-bar {
            display: flex; align-items: center; gap: 12px;
            padding: 10px 16px; margin: 0 16px 12px 16px;
            background: var(--c-surface-2);
            border: 1px solid var(--c-border);
            border-radius: var(--rad-md);
            position: relative;
          }
          .v56-brand-bar__logo {
            width: 36px; height: 36px;
            background: var(--c-accent);
            border-radius: var(--rad-sm);
            display: flex; align-items: center; justify-content: center;
            color: #fff; font-weight: 700; font-size: 16px;
            flex-shrink: 0;
            overflow: hidden;
          }
          .v56-brand-bar__logo img { width: 100%; height: 100%; object-fit: contain; }
          .v56-brand-bar__title {
            flex: 1; background: transparent; border: 0; outline: 0;
            font-family: var(--font-display); font-size: 18px;
            font-weight: 700; color: var(--c-text);
            min-width: 0;
          }
          .v56-brand-bar__title::placeholder { color: var(--c-muted); font-weight: 400; }
          .v56-brand-bar__edit {
            font-size: 11px; color: var(--c-muted); cursor: pointer;
            background: transparent; border: 0;
            display: inline-flex; align-items: center; gap: 4px;
          }
          .v56-brand-bar__edit:hover { color: var(--c-accent); }
          .v56-brand-bar__color-pop {
            position: absolute; top: 100%; right: 16px; margin-top: 4px;
            background: var(--c-surface); border: 1px solid var(--c-border);
            border-radius: var(--rad-sm); padding: 8px;
            display: flex; gap: 6px; z-index: 100;
            box-shadow: 0 6px 14px rgba(0,0,0,0.2);
          }
          .v56-brand-bar__color-pop button {
            width: 22px; height: 22px; border-radius: 50%;
            border: 2px solid transparent; cursor: pointer; padding: 0;
          }
          .v56-brand-bar__color-pop button:hover { border-color: #fff; }
        `;
        document.head.appendChild(css);
      },

      _installCanvasCTA(){
        // FEATURE REMOVIDA — Lucas (feedback): CTA "Comece pelo primeiro componente"
        // estava aparecendo junto da welcome screen (que já tem 9 templates +
        // chat + 2 botões de import). Era redundante e poluía a tela.
        // Mantemos a função vazia pra não quebrar a chamada no install().
        // Limpa CTA antigo do localStorage/DOM se algum reload deixou resíduo.
        const canvasRoot = document.getElementById('canvas-root');
        if (canvasRoot){
          const old = canvasRoot.querySelector('#v56-canvas-cta');
          if (old) old.remove();
        }
        return;
        /* CÓDIGO DESLIGADO — preservado pra possível reativação futura
        // Observa o canvas-root e mostra o CTA quando não há seções
        if (!canvasRoot) {
          setTimeout(() => UX3._installCanvasCTA(), 400);
          return;
        }
        function check(){
          const sections = SolsticeStore.get('canvas.sections') || [];
          const dsReady = SolsticeStore.get('dataset.ready');
          const hasContent = sections.length > 0 && sections.some(s =>
            (s.rows || []).some(r => (r.slots || []).some(sl => sl.type && sl.type !== 'empty'))
          );
          const old = document.getElementById('v56-canvas-cta');
          if (old) old.remove();
          if (hasContent || !dsReady) return;
          if (canvasRoot.querySelector('.solstice__welcome, .solstice__canvas-empty')) return;
          const brand = document.getElementById('v56-brand-bar');
          if (brand && canvasRoot.querySelector('.solstice__welcome')) brand.style.display = 'none';
          // Insere CTA
          const cta = _el('div', { class: 'v56-canvas-cta', id: 'v56-canvas-cta' },
            _el('div', { class: 'v56-canvas-cta__icon' }, '🧩'),
            _el('div', { class: 'v56-canvas-cta__title' }, 'Comece pelo primeiro componente'),
            _el('div', { class: 'v56-canvas-cta__sub' },
              'Seu CSV está carregado. Escolha um componente abaixo para começar — você pode adicionar quantos quiser e organizar livremente.'),
            _el('div', { class: 'v56-canvas-cta__actions' },
              _el('button', {
                class: 'v56-canvas-cta__btn',
                onclick: () => {
                  // Abre painel de componentes
                  if (typeof SolsticeSidebarTabs !== 'undefined' && SolsticeSidebarTabs.activate){
                    SolsticeSidebarTabs.activate('componentes');
                  }
                  // Adiciona um KPI direto pra ajudar
                  try { SolsticeComponents.addByType('kpi'); } catch(_){}
                }
              }, '+ Adicionar primeiro componente'),
              _el('button', {
                class: 'v56-canvas-cta__btn v56-canvas-cta__btn--ghost',
                onclick: () => {
                  try {
                    if (typeof SolsticeTemplates !== 'undefined' && SolsticeTemplates.openPicker){
                      SolsticeTemplates.openPicker();
                    }
                  } catch(_){}
                }
              }, '🗂️ Aplicar template pronto'),
              _el('button', {
                class: 'v56-canvas-cta__btn v56-canvas-cta__btn--ghost',
                onclick: () => {
                  try {
                    if (typeof SolsticeAutoDashboard !== 'undefined' && SolsticeAutoDashboard.run){
                      SolsticeAutoDashboard.run();
                    }
                  } catch(_){}
                }
              }, '✨ Sugerir dashboard automático')
            ),
            _el('div', { class: 'v56-canvas-cta__hint' },
              _el('span', null,
                _el('kbd', null, 'Ctrl'), ' + ', _el('kbd', null, 'K'),
                ' abre o atalho de ações'),
              _el('span', null, 'ou arraste um componente do painel ao lado →')
            )
          );
          // Insere depois da tabbar de páginas
          const tabbar = document.getElementById('pages-tabbar');
          if (tabbar && tabbar.parentNode === canvasRoot){
            tabbar.insertAdjacentElement('afterend', cta);
          } else {
            canvasRoot.appendChild(cta);
          }
        }
        try {
          SolsticeStore.subscribe('canvas.sections', () => setTimeout(check, 60));
          SolsticeStore.subscribe('dataset.ready', () => setTimeout(check, 120));
        } catch(_){}
        setTimeout(check, 600);
        */ // fim do bloco desligado
      },

      _installBeginnerMode(){
        // CORREÇÃO REAL: inspector usa createAccordion com Store.key, NÃO botões com data-tab.
        // Marcamos cada accordion com data-v56-section pela `key` que o createAccordion expõe.
        // O CSS já tem os seletores `.solstice__accord[data-v56-section="estilo"]` etc.
        const saved = localStorage.getItem('solstice.beginnerMode') === '1';
        const app = document.getElementById('app');
        if (app && saved) app.setAttribute('data-v56-beginner', '1');

        // Mapeia key do Store → tag curta usada no CSS
        const KEY_TO_TAG = {
          'inspector.estilo':      'estilo',
          'inspector.analise':     'analise',
          'inspector.metodos':     'metodos',
          'inspector.decisoes':    'decisoes',
          'inspector.origem':      'origem',
          'inspector.avisos':      'avisos',     // visível em ambos modos
          'inspector.dados':       'dados',      // visível em ambos modos
          'inspector.comparacao':  'comparacao'  // visível em ambos
        };

        function markAccordions(){
          const insp = document.getElementById('inspector-body');
          if (!insp) return;
          // Cada accordion tem um header com onclick referente à chave do Store. Como
          // o createAccordion (linha ~14458) salva a key em data-key, usamos isso.
          // Se data-key não existir, fallback no texto do título.
          const accords = insp.querySelectorAll('.solstice__accord');
          accords.forEach(acc => {
            if (acc.getAttribute('data-v56-section')) return;
            // Tenta data-key (caso createAccordion exponha)
            const dk = acc.getAttribute('data-key') || acc.getAttribute('data-accord-key');
            if (dk && KEY_TO_TAG[dk]){
              acc.setAttribute('data-v56-section', KEY_TO_TAG[dk]);
              return;
            }
            // Fallback: lê o texto do título
            const ttl = acc.querySelector('.solstice__accord-title');
            const text = (ttl && ttl.textContent || '').toLowerCase();
            if (text.indexOf('estilo') >= 0) acc.setAttribute('data-v56-section', 'estilo');
            else if (text.indexOf('análise') >= 0 || text.indexOf('analise') >= 0) acc.setAttribute('data-v56-section', 'analise');
            else if (text.indexOf('métodos') >= 0 || text.indexOf('metodos') >= 0) acc.setAttribute('data-v56-section', 'metodos');
            else if (text.indexOf('decisões') >= 0 || text.indexOf('decisoes') >= 0) acc.setAttribute('data-v56-section', 'decisoes');
            else if (text.indexOf('origem') >= 0) acc.setAttribute('data-v56-section', 'origem');
            else if (text.indexOf('dados') >= 0) acc.setAttribute('data-v56-section', 'dados');
            else if (text.indexOf('avisos') >= 0) acc.setAttribute('data-v56-section', 'avisos');
            else if (text.indexOf('comparação') >= 0 || text.indexOf('comparacao') >= 0) acc.setAttribute('data-v56-section', 'comparacao');
          });
        }
        // MutationObserver: cada vez que o inspector é re-renderizado (selectedSlot muda),
        // re-marca as accordions
        const inspBody = document.getElementById('inspector-body');
        if (inspBody){
          const mo = new MutationObserver(() => markAccordions());
          mo.observe(inspBody, { childList: true, subtree: true });
        }
        // Marca já no primeiro paint
        setTimeout(markAccordions, 300);
        setTimeout(markAccordions, 1000);

        // Toggle UI
        function mount(){
          const sidebarFooter = document.querySelector('.solstice__sidebar-footer-btns');
          if (!sidebarFooter || document.getElementById('v56-beginner-toggle')) {
            return;
          }
          const wrap = _el('label', { class: 'v56-beginner-toggle', id: 'v56-beginner-toggle',
            title: 'Esconde Estilo, Análise, Métodos, Decisões e Origem do inspector. Fica só "Dados" e "Avisos".' });
          const cb = _el('input', { type: 'checkbox' });
          cb.checked = saved;
          cb.addEventListener('change', () => {
            const app = document.getElementById('app');
            // Auditoria 2026 (AP-02): silent — toggle de modo UX.
            if (cb.checked) {
              app && app.setAttribute('data-v56-beginner', '1');
              SolsticeStorage.safeSet('solstice.beginnerMode', '1', { silent: true });
              markAccordions(); // garante que estão marcadas
              _toast('info', '🌱 Modo iniciante ativo', 'Inspector mostra só Dados e Avisos. Estilo/Análise/Métodos escondidos.');
            } else {
              app && app.removeAttribute('data-v56-beginner');
              SolsticeStorage.safeSet('solstice.beginnerMode', '0', { silent: true });
              _toast('info', 'Modo completo', 'Todas as seções do inspector voltaram.');
            }
          });
          wrap.appendChild(cb);
          wrap.appendChild(_el('span', null, '🌱 Modo iniciante'));
          sidebarFooter.appendChild(wrap);
        }
        mount();
        if (!document.getElementById('v56-beginner-toggle')) {
          setTimeout(mount, 600);
          setTimeout(mount, 1500);
        }
      },

      _installBranding(){
        // SOL-feedback (Auditoria 2026.4): v56-brand-bar REMOVIDA. Era a 3ª
        // superfície de branding (depois do app header e do DashHeader do canvas) —
        // redundante e poluía o layout. Logo agora vive só no DashHeader (canvas)
        // e cor vive na paleta do app (header). Função vira no-op
        // — código abaixo é unreachable mas mantido para histórico.
        const _existingBrandBar = document.getElementById('v56-brand-bar');
        if (_existingBrandBar) _existingBrandBar.remove();
        return;
        // ---- código original (desativado) ----
        const canvasRoot = document.getElementById('canvas-root');
        if (!canvasRoot) { setTimeout(() => UX3._installBranding(), 400); return; }

        function mount(){
          if (document.getElementById('v56-brand-bar')) return;
          // BUG FIX: não mostra branding quando welcome screen está renderizado
          if (canvasRoot.querySelector('.solstice__welcome, .solstice__canvas-empty')) return;
          // Só mostra se já tem ao menos uma seção com componente real
          const sections = SolsticeStore.get('canvas.sections') || [];
          const hasContent = sections.some(s => (s.rows || []).some(r => (r.slots || []).some(sl => sl.type && sl.type !== 'empty')));
          if (!hasContent) return;
          const saved = (function(){
            try { return JSON.parse(localStorage.getItem('solstice.branding') || '{}'); }
            catch(_){ return {}; }
          })();
          const bar = _el('div', { class: 'v56-brand-bar', id: 'v56-brand-bar' });
          const logo = _el('div', { class: 'v56-brand-bar__logo', id: 'v56-brand-logo' },
            saved.logo
              ? _el('img', { src: saved.logo, alt: 'logo' })
              : document.createTextNode((saved.title || 'S').slice(0, 1).toUpperCase())
          );
          const title = _el('input', {
            class: 'v56-brand-bar__title',
            id: 'v56-brand-title',
            type: 'text',
            placeholder: 'Nome do dashboard…',
            value: saved.title || ''
          });
          title.addEventListener('input', () => {
            saved.title = title.value;
            // Auditoria 2026 (AP-02): silent — input dispara por keystroke,
            // toast em cada tecla seria spam. Logo/cor (ações únicas) avisam.
            SolsticeStorage.safeSet('solstice.branding', JSON.stringify(saved), { silent: true });
            // Atualiza logo se não tem imagem
            if (!saved.logo){
              logo.textContent = (title.value || 'S').slice(0,1).toUpperCase();
            }
          });
          const colorBtn = _el('button', { class: 'v56-brand-bar__edit', title: 'Trocar cor de destaque' },
            '🎨 Cor');
          const logoBtn = _el('button', { class: 'v56-brand-bar__edit', title: 'Carregar logotipo (PNG/SVG)' },
            '🖼️ Logo');
          const fileInput = _el('input', { type: 'file', accept: 'image/*', style: 'display:none;' });
          fileInput.addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const fr = new FileReader();
            fr.onload = () => {
              saved.logo = fr.result;
              // Auditoria 2026 (AP-02): ação explícita do usuário — avisar.
              const ok = SolsticeStorage.safeSet('solstice.branding', JSON.stringify(saved));
              logo.innerHTML = '';
              logo.appendChild(_el('img', { src: fr.result, alt: 'logo' }));
              if (ok) _toast('success', 'Logo carregada', 'Salva no localStorage');
            };
            fr.readAsDataURL(f);
            fileInput.value = '';
          });
          logoBtn.addEventListener('click', () => fileInput.click());
          // Color picker
          colorBtn.addEventListener('click', () => {
            const ex = bar.querySelector('.v56-brand-bar__color-pop');
            if (ex){ ex.remove(); return; }
            const pop = _el('div', { class: 'v56-brand-bar__color-pop' });
            ['#5BA8FF','#F59E0B','#10B981','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#94A3B8','#0F172A'].forEach(c => {
              const b = _el('button', {
                style: 'background:' + c,
                title: c,
                onclick: () => {
                  saved.color = c;
                  // Auditoria 2026 (AP-02): ação explícita — avisar se falhar.
                  SolsticeStorage.safeSet('solstice.branding', JSON.stringify(saved));
                  document.documentElement.style.setProperty('--c-accent', c);
                  logo.style.background = c;
                  pop.remove();
                  _toast('success', 'Cor aplicada', c);
                }
              });
              pop.appendChild(b);
            });
            bar.appendChild(pop);
            // Auditoria 2026 (MC-01 / HV-02): trackListener com pop como host.
            setTimeout(() => {
              const close = (e) => {
                if (!pop.contains(e.target) && e.target !== colorBtn){
                  SolsticeUtils.cleanupListeners(pop);
                  pop.remove();
                }
              };
              SolsticeUtils.trackListener(pop, document, 'click', close);
            }, 50);
          });

          bar.appendChild(logo);
          bar.appendChild(title);
          bar.appendChild(colorBtn);
          bar.appendChild(logoBtn);
          bar.appendChild(fileInput);

          // Aplica cor salva ao carregar
          if (saved.color){
            document.documentElement.style.setProperty('--c-accent', saved.color);
            logo.style.background = saved.color;
          }

          // Insere depois da tabbar de páginas
          const tabbar = document.getElementById('pages-tabbar');
          if (tabbar && tabbar.parentNode === canvasRoot){
            tabbar.insertAdjacentElement('afterend', bar);
          } else {
            canvasRoot.insertBefore(bar, canvasRoot.firstChild);
          }
        }
        mount();
        // Persistente: re-monta após renders do canvas
        try {
          SolsticeStore.subscribe('canvas.sections', () => {
            setTimeout(() => {
              if (!document.getElementById('v56-brand-bar')) mount();
            }, 80);
          });
        } catch(_){}
      },

      _patchBarPareto(){
        // Adiciona suporte a "showCumulative" no componente Bar
        // Quando ligado, sobrepõe linha % cumulativa no SVG do bar.
        // Como Bar atualmente delega para Distribution.render, hookamos
        // depois do render injetando uma linha SVG.
        const ro = new MutationObserver((mutations) => {
          mutations.forEach(m => {
            m.addedNodes.forEach(node => {
              if (!(node instanceof HTMLElement)) return;
              // Tenta achar comp do tipo bar
              const comps = node.matches && node.matches('.solstice__comp')
                ? [node]
                : node.querySelectorAll ? node.querySelectorAll('.solstice__comp') : [];
              comps.forEach(c => {
                if (c.getAttribute('data-comp-type') !== 'bar') return;
                if (c.getAttribute('data-v56-pareto-done') === '1') return;
                // Procura slot config
                const slotId = c.getAttribute('data-slot-id') || c.getAttribute('data-id');
                if (!slotId) return;
                let slot = null;
                try {
                  const secs = SolsticeStore.get('canvas.sections') || [];
                  for (const s of secs) for (const r of (s.rows || [])){
                    const sl = (r.slots || []).find(x => x.id === slotId);
                    if (sl){ slot = sl; break; }
                  }
                } catch(_){}
                if (!slot || !slot.config || !slot.config.showCumulative) return;
                // Procura SVG das barras
                setTimeout(() => UX3._overlayParetoLine(c, slot), 80);
                c.setAttribute('data-v56-pareto-done', '1');
              });
            });
          });
        });
        ro.observe(document.body, { childList: true, subtree: true });
      },

      _overlayParetoLine(compEl, slot){
        const svg = compEl.querySelector('svg.solstice__hist');
        if (!svg) return;
        // Lê barras existentes via attribute data ou recalcula
        const rects = svg.querySelectorAll('rect');
        if (!rects.length) return;
        const heights = [];
        const xs = [];
        rects.forEach(r => {
          const h = parseFloat(r.getAttribute('height'));
          const x = parseFloat(r.getAttribute('x'));
          const w = parseFloat(r.getAttribute('width'));
          heights.push(h);
          xs.push(x + w / 2);
        });
        const total = heights.reduce((s, v) => s + v, 0);
        if (total <= 0) return;
        let acc = 0;
        const NS = 'http://www.w3.org/2000/svg';
        // Pega altura do viewbox
        const vb = (svg.getAttribute('viewBox') || '0 0 100 100').split(/\s+/);
        const W = parseFloat(vb[2]) || 100;
        const H = parseFloat(vb[3]) || 100;
        const pts = heights.map((h, i) => {
          acc += h;
          const pct = acc / total;
          const x = xs[i];
          const y = H - 12 - pct * (H - 28); // canto inferior reservado pros labels
          return x.toFixed(1) + ',' + y.toFixed(1);
        }).join(' ');
        const poly = document.createElementNS(NS, 'polyline');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', '#F59E0B');
        poly.setAttribute('stroke-width', '2');
        poly.setAttribute('stroke-linecap', 'round');
        poly.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(poly);
        // Pontos
        pts.split(' ').forEach((pStr, i) => {
          const [x, y] = pStr.split(',').map(Number);
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '2.5');
          c.setAttribute('fill', '#F59E0B');
          svg.appendChild(c);
        });
        // Label "% acumulado"
        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', W - 4);
        lbl.setAttribute('y', 10);
        lbl.setAttribute('text-anchor', 'end');
        lbl.setAttribute('font-size', '9');
        lbl.setAttribute('fill', '#F59E0B');
        lbl.style.fontFamily = 'var(--font-mono)';
        lbl.textContent = '% acumulado';
        svg.appendChild(lbl);
      }
    };

    /* ==========================================================
       (12) MODO AMIGÁVEL — Lucas (feedback rodada 3):
            "se eu falar correlação pra pessoa ela não vai entender"
       ----------------------------------------------------------
       Toggle global que troca nomes técnicos por linguagem cotidiana
       em TODA a interface: catálogo, tooltips, descrições, menu.
       Aplica via [data-friendly="1"] no root + intercepta textos.
       ========================================================== */
    const FriendlyMode = {
      // Mapa jargão → linguagem cotidiana
      DICT: {
        // Componentes
        'KPI Card': 'Número Importante',
        'Big Number': 'Número Gigante',
        'Série Temporal': 'Evolução no Tempo',
        'Distribuição': 'Como os valores se espalham',
        'Tabela': 'Tabela',
        'Gráfico de Barras': 'Comparar Categorias',
        'Donut / Pizza': 'Pizza (partes do todo)',
        'Área (preenchida)': 'Volume ao longo do tempo',
        'Scatter / Bubble': 'Pontos espalhados (X vs Y)',
        'Box Plot': 'Caixa de Variação',
        'Gauge': 'Velocímetro de Meta',
        'Heatmap Calendário': 'Calendário Colorido',
        'Heatmap (Matriz)': 'Matriz Colorida',
        'Distribuição Temporal': 'Duas medidas no tempo',
        'Radar (eixos polares)': 'Perfil de Atributos',
        'Sankey': 'Fluxo entre Categorias',
        'Funil de Conversão': 'Funil',
        'Waterfall (cascata)': 'Cascata (Entradas e Saídas)',
        'Matriz': 'Tabela Cruzada',
        'Treemap': 'Blocos por Tamanho',
        'Mapa Brasil (tile)': 'Mapa do Brasil',
        'Filtro Range': 'Filtro de Intervalo',
        'Texto / Markdown': 'Bloco de Texto',
        'Narrativa Automática': 'Resumo Automático',
        'Linha do Tempo': 'Linha do Tempo',
        'Lista de Demandas': 'Lista de Tarefas',
        'Grafo de Métricas': 'Rede de Indicadores',
        // Grupos do catálogo
        'Essenciais': 'O básico',
        'Análise & Comparação': 'Comparar e investigar',
        'Fluxo & Estrutura': 'Origem, destino, composição',
        'Mapas & Geo': 'Mapas',
        'Filtros & Texto': 'Filtros e anotações',
        'Diferenciais & Operacional': 'Avançado',
        // Aggregations
        'Soma': 'Total',
        'Média': 'Valor médio',
        'Mediana': 'Valor do meio',
        'Mínimo': 'Menor valor',
        'Máximo': 'Maior valor',
        'Desvio padrão': 'Quão diferentes são os valores',
        'Percentil 95': 'Valor que 95% das vezes não passa',
        'Quantidade': 'Quantas linhas',
        // Conceitos
        'Correlação': 'Como dois números se relacionam',
        'Outliers': 'Pontos fora do normal',
        'Pareto': 'Os poucos que causam muito (regra 80/20)',
        'Cross-filter': 'Filtrar clicando no gráfico',
        'Drill-down': 'Detalhar com mais profundidade',
        'Pivot': 'Tabela Cruzada',
        'Histograma': 'Quantos valores caem em cada faixa',
        'Boxplot': 'Caixa que mostra variação',
        'Regressão linear': 'Linha de tendência',
        'Forecast': 'Previsão',
        'Período anterior': 'Mês/semana passado',
        'YoY': 'Ano contra ano',
        'MoM': 'Mês contra mês',
        // Botões
        'Importar': 'Carregar arquivo',
        'Exportar': 'Baixar resultado',
        'Dicionário': 'Apelido das colunas',
        'Snapshots': 'Fotografias salvas',
        // Descrições de componente (substring matches)
        'agnóstico': 'serve para qualquer dado',
        'dataset': 'planilha',
        'frequência': 'quantas vezes aparece',
        'cardinalidade': 'quantos valores diferentes existem',
        'normalização': 'padronizar a escala',
        'segmentação': 'separar em grupos',
        'agrupamento': 'juntar parecidos',
        'agregação': 'resumir em um número'
      },

      // Sinaliza se está ativo
      isActive(){
        return document.documentElement.getAttribute('data-friendly') === '1';
      },

      // Toggle
      toggle(on){
        const enabled = on != null ? !!on : !FriendlyMode.isActive();
        document.documentElement.setAttribute('data-friendly', enabled ? '1' : '0');
        // Auditoria 2026 (AP-02): silent — toggle de modo UX.
        SolsticeStorage.safeSet('solstice.friendlyMode', enabled ? '1' : '0', { silent: true });
        // Atualiza visual: percorre catálogo de componentes e re-renderiza painel
        FriendlyMode._applyToCatalog();
        // Re-renderiza componentes do canvas pra atualizar títulos
        try { SolsticeCanvas && SolsticeCanvas.render && SolsticeCanvas.render(); } catch(_){}
        _toast(enabled ? 'success' : 'info',
          enabled ? '🧑‍🤝‍🧑 Modo Amigável ativado' : 'Modo Técnico de volta',
          enabled
            ? 'Trocando termos por linguagem do dia-a-dia.'
            : 'Termos técnicos restaurados.'
        );
      },

      _translate(text){
        if (!text || !FriendlyMode.isActive()) return text;
        if (FriendlyMode.DICT[text] != null) return FriendlyMode.DICT[text];
        // Procura match exato no início ou após espaço
        let out = text;
        Object.keys(FriendlyMode.DICT).forEach(k => {
          // Apenas substitui se a palavra está toda em out (case-insensitive)
          const re = new RegExp('\\b' + k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'gi');
          out = out.replace(re, FriendlyMode.DICT[k]);
        });
        return out;
      },

      // Aplica tradução no catálogo (cards de componente)
      _applyToCatalog(){
        const host = document.getElementById('components-panel');
        if (host){
          const cards = host.querySelectorAll('.solstice__cat-card');
          cards.forEach(card => {
            const nameEl = card.querySelector('.solstice__cat-card-name');
            const descEl = card.querySelector('.solstice__cat-card-desc');
            if (nameEl){
              const original = nameEl.getAttribute('data-name') || nameEl.textContent;
              if (!nameEl.getAttribute('data-name')) nameEl.setAttribute('data-name', original);
              nameEl.textContent = FriendlyMode._translate(original);
            }
            if (descEl){
              const original = descEl.getAttribute('data-original') || descEl.textContent;
              if (!descEl.getAttribute('data-original')) descEl.setAttribute('data-original', original);
              descEl.textContent = FriendlyMode._translate(original);
            }
          });
          // Catálogo: títulos dos accordions
          host.querySelectorAll('.solstice__accord-title').forEach(t => {
            const original = t.getAttribute('data-original') || t.textContent;
            if (!t.getAttribute('data-original')) t.setAttribute('data-original', original);
            t.textContent = FriendlyMode._translate(original);
          });
        }
        // Inspector: títulos dos accordions (Dados, Estilo, Análise, Métodos, Comparação...)
        const insp = document.getElementById('inspector-body');
        if (insp){
          insp.querySelectorAll('.solstice__accord-title').forEach(t => {
            const original = t.getAttribute('data-original') || t.textContent;
            if (!t.getAttribute('data-original')) t.setAttribute('data-original', original);
            t.textContent = FriendlyMode._translate(original);
          });
          // Labels dos campos (UPPERCASE)
          insp.querySelectorAll('.solstice__props-label').forEach(l => {
            const original = l.getAttribute('data-original') || l.textContent;
            if (!l.getAttribute('data-original')) l.setAttribute('data-original', original);
            l.textContent = FriendlyMode._translate(original);
          });
        }
        // Welcome screen: títulos dos templates inline
        const welcome = document.querySelector('.solstice__welcome');
        if (welcome){
          welcome.querySelectorAll('.solstice__welcome-template-name, .solstice__welcome-path-title, .solstice__welcome-path-desc').forEach(el => {
            const original = el.getAttribute('data-original') || el.textContent;
            if (!el.getAttribute('data-original')) el.setAttribute('data-original', original);
            el.textContent = FriendlyMode._translate(original);
          });
        }
        // Canvas: títulos de componentes renderizados
        document.querySelectorAll('.solstice__comp__title, .solstice__comp-title, .solstice__section-title').forEach(t => {
          const original = t.getAttribute('data-original') || t.textContent;
          if (!t.getAttribute('data-original')) t.setAttribute('data-original', original);
          t.textContent = FriendlyMode._translate(original);
        });
      },

      install(){
        if (FriendlyMode.__installed) return;
        FriendlyMode.__installed = true;
        // Carrega estado salvo
        const saved = localStorage.getItem('solstice.friendlyMode') === '1';
        if (saved) document.documentElement.setAttribute('data-friendly', '1');

        // CSS: toggle visualizado na sidebar footer
        const css = document.createElement('style');
        css.textContent = `
          .v56-friendly-toggle {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 10px; margin-top: 6px;
            background: linear-gradient(135deg, color-mix(in srgb, var(--c-accent) 12%, transparent), transparent);
            border: 1px solid color-mix(in srgb, var(--c-accent) 28%, transparent);
            border-radius: var(--rad-sm);
            cursor: pointer; font-size: 11px;
            color: var(--c-text);
            user-select: none;
          }
          .v56-friendly-toggle:hover { background: color-mix(in srgb, var(--c-accent) 18%, transparent); }
          .v56-friendly-toggle input { cursor: pointer; }
          :root[data-friendly="1"] .v56-friendly-toggle {
            background: color-mix(in srgb, var(--c-accent) 22%, transparent);
            border-color: var(--c-accent);
            font-weight: 600;
          }
        `;
        document.head.appendChild(css);

        // Botão no rodapé da sidebar (junto com modo iniciante)
        function mount(){
          const sidebarFooter = document.querySelector('.solstice__sidebar-footer-btns');
          if (!sidebarFooter || document.getElementById('v56-friendly-toggle')) return;
          const wrap = _el('label', { class: 'v56-friendly-toggle', id: 'v56-friendly-toggle',
            title: 'Substitui termos técnicos por linguagem do dia-a-dia em toda a interface' });
          const cb = _el('input', { type: 'checkbox' });
          cb.checked = saved;
          cb.addEventListener('change', () => FriendlyMode.toggle(cb.checked));
          wrap.appendChild(cb);
          wrap.appendChild(_el('span', null, '🧑‍🤝‍🧑 Modo Amigável (esconde jargão)'));
          sidebarFooter.appendChild(wrap);
        }
        mount();
        if (!document.getElementById('v56-friendly-toggle')){
          setTimeout(mount, 600);
          setTimeout(mount, 1500);
        }
        // Quando catálogo é re-renderizado, aplica tradução novamente
        try {
          SolsticeStore.subscribe('ui.activeTab', (tab) => {
            if (tab === 'componentes'){
              setTimeout(FriendlyMode._applyToCatalog, 200);
              setTimeout(FriendlyMode._applyToCatalog, 600);
            }
          });
          // Quando o inspector renderiza com componente selecionado
          SolsticeStore.subscribe('ui.inspector.slotId', () => {
            setTimeout(FriendlyMode._applyToCatalog, 100);
          });
          // Quando canvas re-renderiza
          SolsticeStore.subscribe('canvas.sections', () => {
            setTimeout(FriendlyMode._applyToCatalog, 200);
          });
          // Quando dataset acabou de carregar (mostra welcome com templates)
          SolsticeStore.subscribe('dataset.ready', () => {
            setTimeout(FriendlyMode._applyToCatalog, 300);
            setTimeout(FriendlyMode._applyToCatalog, 1200);
          });
        } catch(_){}
        // MutationObserver geral no body — pega QUALQUER novo elemento
        // com texto que precise ser traduzido. Throttle para não travar.
        let pending = false;
        const mo = new MutationObserver(() => {
          if (!FriendlyMode.isActive()) return;
          if (pending) return;
          pending = true;
          setTimeout(() => { pending = false; FriendlyMode._applyToCatalog(); }, 250);
        });
        mo.observe(document.body, { childList: true, subtree: true });

        // Aplicação inicial
        if (saved){
          setTimeout(FriendlyMode._applyToCatalog, 1000);
          setTimeout(FriendlyMode._applyToCatalog, 2500);
        }
      }
    };

    /* ==========================================================
       (13) WIZARD DE ATRIBUIÇÃO DE COLUNAS PÓS-TEMPLATE
       ----------------------------------------------------------
       Lucas (feedback rodada 3):
       "ao colocar no template já poderia deixar para pessoa escolher
        em um click qual coluna ela quer colocar em cada componente"

       Quando usuário aplica um template:
       1. Coletamos cada slot e identificamos quais campos de coluna
          (column, xColumn, yColumn, valueColumn, groupColumn, etc.)
          eles precisam.
       2. Abrimos um modal com uma seção por slot, mostrando o tipo
          do componente e dropdowns para cada campo de coluna.
       3. Defaults pré-preenchidos com o que o template já trouxe.
       4. Ao confirmar, atualiza configs e re-renderiza.
       ========================================================== */
    const TemplateWizard = {
      COL_KEYS: [
        'column', 'xColumn', 'yColumn', 'valueColumn', 'sourceColumn',
        'targetColumn', 'groupColumn', 'sizeColumn', 'dateColumn', 'groupBy',
        'rowColumn', 'colColumn', 'ufColumn', 'categoryColumn'
      ],
      KEY_LABELS: {
        'column': 'Coluna',
        'xColumn': 'Eixo X',
        'yColumn': 'Eixo Y',
        'valueColumn': 'Valor (numérico)',
        'sourceColumn': 'Origem',
        'targetColumn': 'Destino',
        'groupColumn': 'Agrupar por',
        'sizeColumn': 'Tamanho do ponto',
        'dateColumn': 'Coluna de data',
        'groupBy': 'Agrupar por',
        'rowColumn': 'Linha',
        'colColumn': 'Coluna',
        'ufColumn': 'Coluna de UF/estado',
        'categoryColumn': 'Categoria'
      },

      install(){
        if (TemplateWizard.__installed) return;
        if (typeof SolsticeTemplates === 'undefined' || !SolsticeTemplates.apply) return;
        TemplateWizard.__installed = true;
        const origApply = SolsticeTemplates.apply.bind(SolsticeTemplates);
        SolsticeTemplates.apply = function(id){
          // Acha o template
          const t = SolsticeTemplates.getAll().find(x => x.id === id);
          if (!t || typeof t.build !== 'function'){
            return origApply(id);
          }
          // Constrói as sections (sem aplicar ainda)
          const sections = t.build();
          // Remap automático (mantém comportamento atual)
          const ingest = SolsticeStore.get('ingest') || {};
          const ctx = {
            columns: ingest.columns || [],
            types: ingest.types || {},
            dictionary: SolsticeStore.get('dictionary'),
            domain: t.domain || null
          };
          // Coleta slots
          const allSlots = [];
          sections.forEach(sec => (sec.rows || []).forEach(row => (row.slots || []).forEach(slot => {
            if (slot && slot.type && slot.type !== 'empty') allSlots.push(slot);
          })));
          if (!allSlots.length || !ctx.columns.length){
            // Sem colunas pra escolher — aplica direto
            return origApply(id);
          }
          // Abre wizard
          TemplateWizard._openModal(t, sections, ctx);
        };
      },

      _openModal(template, sections, ctx){
        if (typeof SolsticeModal === 'undefined' || !SolsticeModal.show){
          // Fallback: aplica direto
          SolsticeCanvas.applyTemplate(sections);
          return;
        }
        // Estado local: copia config dos slots para edição
        const editedConfigs = new Map(); // slotRef → cfg
        sections.forEach(sec => (sec.rows || []).forEach(row => (row.slots || []).forEach(slot => {
          if (slot && slot.type && slot.type !== 'empty'){
            editedConfigs.set(slot, JSON.parse(JSON.stringify(slot.config || {})));
          }
        })));

        const numCols = ctx.columns.filter(c => {
          const t = ctx.types[c] && ctx.types[c].type;
          return t && SolsticeTypes.group(t) === 'numeric';
        });
        const catCols = ctx.columns.filter(c => {
          const t = ctx.types[c] && ctx.types[c].type;
          return t && SolsticeTypes.group(t) === 'categorical';
        });
        const timeCols = ctx.columns.filter(c => {
          const t = ctx.types[c] && ctx.types[c].type;
          return t && SolsticeTypes.group(t) === 'temporal';
        });

        function colsForKey(key){
          if (key === 'xColumn') return timeCols.length ? timeCols : ctx.columns;
          if (key === 'yColumn' || key === 'valueColumn' || key === 'sizeColumn') return numCols.length ? numCols : ctx.columns;
          if (key === 'dateColumn') return timeCols.length ? timeCols : ctx.columns;
          if (key === 'column'){
            // Para distribution/donut/bar pode ser cat OU num
            return ctx.columns;
          }
          if (key === 'groupColumn' || key === 'groupBy' || key === 'sourceColumn' || key === 'targetColumn' || key === 'rowColumn' || key === 'colColumn' || key === 'categoryColumn') {
            return catCols.length ? catCols : ctx.columns;
          }
          if (key === 'ufColumn') return ctx.columns;
          return ctx.columns;
        }

        function _friendly(c){
          if (!c) return '—';
          const d = ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[c];
          return d && d.friendlyName ? d.friendlyName + ' (' + c + ')' : c;
        }

        SolsticeModal.show({
          title: '🗂️ Aplicar "' + template.name + '" — ajuste as colunas',
          size: 'lg',
          body: () => {
            const wrap = _el('div', { style: 'display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--c-text);max-height:60vh;overflow-y:auto;' });
            wrap.appendChild(_el('p', { style: 'color:var(--c-text-2);font-size:12px;line-height:1.55;margin:0;' },
              FriendlyMode.isActive()
                ? 'Para cada quadrinho do dashboard, escolha qual coluna da sua planilha vai aparecer. Já preenchi com o que pareceu fazer sentido.'
                : 'Cada componente do template tem alguns campos. Selecione quais colunas usar — os defaults vieram do remap automático.'
            ));
            let slotIdx = 0;
            sections.forEach(sec => (sec.rows || []).forEach(row => (row.slots || []).forEach(slot => {
              if (!slot || !slot.type || slot.type === 'empty') return;
              slotIdx++;
              const def = SolsticeComponents.get(slot.type);
              const cfg = editedConfigs.get(slot);
              const card = _el('div', { style: 'border:1px solid var(--c-border);border-radius:var(--rad-sm);padding:10px 12px;background:var(--c-surface-2);' });
              const head = _el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:600;' },
                _el('span', { style: 'font-size:18px;' }, def ? def.icon : '🧩'),
                _el('span', null, '#' + slotIdx + ' · ' + (def ? FriendlyMode._translate(def.name) : slot.type))
              );
              card.appendChild(head);

              // Para cada chave de coluna que esse slot tem, monta dropdown
              const keysFound = TemplateWizard.COL_KEYS.filter(k => k in cfg);
              if (!keysFound.length){
                card.appendChild(_el('div', { style: 'font-size:11px;color:var(--c-muted);' },
                  'Este componente não precisa de coluna específica.'));
              } else {
                const grid = _el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px;' });
                keysFound.forEach(k => {
                  const lbl = _el('label', { style: 'display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--c-text-2);' });
                  lbl.appendChild(_el('span', null, FriendlyMode._translate(TemplateWizard.KEY_LABELS[k] || k)));
                  const sel = _el('select', { style: 'padding:5px 8px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:12px;color:var(--c-text);' });
                  // Opção "nenhum"
                  const noneOpt = _el('option', { value: '' }, '— nenhum —');
                  sel.appendChild(noneOpt);
                  const options = colsForKey(k);
                  options.forEach(c => {
                    const o = _el('option', { value: c }, _friendly(c));
                    if (cfg[k] === c) o.selected = true;
                    sel.appendChild(o);
                  });
                  if (cfg[k] && !options.includes(cfg[k])){
                    // Coluna preenchida mas inválida — destaca
                    const o = _el('option', { value: cfg[k] }, '⚠️ ' + cfg[k] + ' (não existe)');
                    o.selected = true;
                    sel.appendChild(o);
                  }
                  sel.addEventListener('change', (e) => {
                    cfg[k] = e.target.value || null;
                  });
                  lbl.appendChild(sel);
                  grid.appendChild(lbl);
                });
                card.appendChild(grid);
              }
              wrap.appendChild(card);
            })));
            return wrap;
          },
          footer: (close) => [
            _el('button', { class: 'solstice__btn solstice__btn--ghost', onclick: () => close(null) }, 'Cancelar'),
            _el('button', { class: 'solstice__btn', onclick: () => {
              // Pula wizard — aplica como veio
              close(null);
              SolsticeCanvas.applyTemplate(sections);
              _toast('info', 'Template aplicado', 'Usei os defaults — ajuste depois no inspector se quiser.');
            } }, 'Pular e usar defaults'),
            _el('button', { class: 'solstice__btn solstice__btn--primary', onclick: () => {
              // Aplica configs editadas
              sections.forEach(sec => (sec.rows || []).forEach(row => (row.slots || []).forEach(slot => {
                if (editedConfigs.has(slot)){
                  slot.config = editedConfigs.get(slot);
                  if (slot._unboundColumns) delete slot._unboundColumns;
                }
              })));
              close(null);
              SolsticeCanvas.applyTemplate(sections);
              try {
                SolsticeAudit.record({ action: 'apply_template_wizard', target: template.id,
                  details: { slots: editedConfigs.size } });
              } catch(_){}
              _toast('success', '✅ Dashboard criado', '"' + template.name + '" com colunas escolhidas.');
            } }, '🚀 Aplicar com minhas colunas')
          ]
        });
      }
    };

    /* ==========================================================
       (14) DIVERSIFICAÇÃO DE LAYOUTS — Lucas (feedback rodada 3):
            "sempre sai 2 componentes em cada linha e seção.
             não informativo."
       ----------------------------------------------------------
       Patcheia o build dos templates de COMPARAÇÃO DE PERÍODOS
       (compare-month/week/year) e do auto-dashboard pra usar
       layouts variados (4-col KPIs no topo, 1-col destaque grande,
       3-col detalhe).
       ========================================================== */
    const LayoutDiv = {
      install(){
        if (LayoutDiv.__installed) return;
        if (typeof SolsticeTemplates === 'undefined') return;
        LayoutDiv.__installed = true;

        // Re-edita os 3 templates de comparação pra ter mais variedade
        const ids = ['compare-month-vs-prev', 'compare-week-vs-prev', 'compare-yoy'];
        ids.forEach(id => {
          const t = SolsticeTemplates.AGNOSTIC.find(x => x.id === id);
          if (!t) return;
          const periodKey = id === 'compare-month-vs-prev' ? 'month'
                          : id === 'compare-week-vs-prev'  ? 'week'
                          : 'year';
          t.build = function(){
            return [
              {
                title: '⭐ Destaques do período',
                rows: [
                  {
                    layout: '4col-equal',
                    slots: [
                      { type: 'bignum', config: { agg: 'sum', comparison: { type: 'previous-period', period: periodKey } } },
                      { type: 'kpi',    config: { agg: 'avg', comparison: { type: 'previous-period', period: periodKey } } },
                      { type: 'kpi',    config: { agg: 'count', comparison: { type: 'previous-period', period: periodKey } } },
                      { type: 'gauge',  config: { agg: 'avg' } }
                    ]
                  }
                ]
              },
              {
                title: '📈 Evolução com período anterior sobreposto',
                rows: [
                  {
                    layout: '1col',
                    slots: [
                      { type: 'time-series', config: {
                        bin: periodKey === 'month' ? 'day' : (periodKey === 'year' ? 'month' : 'day'),
                        kind: 'line', showCompare: true, compareMode: 'same-duration'
                      } }
                    ]
                  }
                ]
              },
              {
                title: '🔍 Por onde se distribui',
                rows: [
                  {
                    layout: '3col-equal',
                    slots: [
                      { type: 'donut', config: {} },
                      { type: 'bar',   config: { sortDesc: true, topN: 8 } },
                      { type: 'distribution', config: {} }
                    ]
                  }
                ]
              },
              {
                title: '📋 Detalhe',
                rows: [
                  { layout: '2col-2-1',
                    slots: [
                      { type: 'table', config: { rowLimit: 50 } },
                      { type: 'narrative-auto', config: {} }
                    ]
                  }
                ]
              }
            ];
          };
        });

        // Sprint 29: visao-geral-diversificada removido — user pediu pra
        // enxugar (era basicamente bignum + 3 KPIs + time-series, redundante
        // com 'kpi-trend'). Bloco mantido como comentário pra fácil reativação.
        if (false && !SolsticeTemplates.AGNOSTIC.find(t => t.id === 'visao-geral-diversificada')){
          SolsticeTemplates.AGNOSTIC.push({
            id: 'visao-geral-diversificada', icon: '🎯',
            name: 'Visão Geral (layout variado)',
            description: '4 números importantes no topo · um destaque grande · três comparações lado a lado · detalhe e resumo.',
            domain: null,
            build: () => [
              {
                title: 'Indicadores chave',
                rows: [{
                  layout: '4col-equal',
                  slots: [
                    { type: 'bignum', config: { agg: 'sum' } },
                    { type: 'kpi',    config: { agg: 'avg' } },
                    { type: 'kpi',    config: { agg: 'count' } },
                    { type: 'gauge',  config: { agg: 'avg' } }
                  ]
                }]
              },
              {
                title: 'Tendência principal',
                rows: [{
                  layout: '1col',
                  slots: [{ type: 'time-series', config: { bin: 'month', kind: 'area' } }]
                }]
              },
              {
                title: 'Onde está concentrado',
                rows: [{
                  layout: '3col-equal',
                  slots: [
                    { type: 'donut',        config: {} },
                    { type: 'bar',          config: { sortDesc: true, topN: 10 } },
                    { type: 'treemap',      config: {} }
                  ]
                }]
              },
              {
                title: 'Visão detalhada',
                rows: [{
                  layout: '2col-2-1',
                  slots: [
                    { type: 'table',          config: { rowLimit: 80 } },
                    { type: 'narrative-auto', config: {} }
                  ]
                }]
              }
            ]
          });
        }
      }
    };

    /* ==========================================================
       (9) REORGANIZAÇÃO DO CATÁLOGO — derivada do uso real
       ----------------------------------------------------------
       Auditoria por 46 personas (2 rodadas). v5.7 adiciona:
       heatmap matricial, treemap, radar, choropleth-br.
       ========================================================== */
    const Reorg = {
      // Nova taxonomia
      GROUPS: [
        { key: 'essenciais',  title: 'Essenciais',        icon: '⭐', openByDefault: true,
          // Sprint 42: distrib-time promovido pra essenciais — espelha a
          // mesma reorganização feita no catálogo principal (linha ~26696).
          ids: ['kpi', 'bignum', 'time-series', 'table', 'bar', 'donut', 'distribution', 'distrib-time', 'area'] },
        { key: 'analise',     title: 'Análise & Comparação', icon: '🔬', openByDefault: false,
          ids: ['scatter', 'boxplot', 'gauge', 'heatmap-cal', 'heatmap', 'radar'] },
        { key: 'fluxo',       title: 'Fluxo & Estrutura', icon: '🌊', openByDefault: false,
          ids: ['sankey', 'funnel', 'waterfall', 'pivot', 'treemap'] },
        { key: 'mapas',       title: 'Mapas & Geo',       icon: '🗺️', openByDefault: false,
          ids: ['choropleth-br'] },
        { key: 'filtros',     title: 'Filtros & Texto',   icon: '🎚️', openByDefault: false,
          ids: ['slider', 'markdown', 'narrative-auto'] },
        { key: 'diferenciais', title: 'Diferenciais & Operacional', icon: '✨', openByDefault: false,
          ids: ['event-timeline', 'demand-list', 'metric-graph'] }
      ],

      install(){
        if (Reorg.__installed) return;
        Reorg.__installed = true;
        // SOL-feedback: Reorg.install virou no-op. A taxonomia NEW foi inlineada
        // direto em SolsticeSidebarTabs._renderComponentsPanel (groups array).
        // Não há mais necessidade de monkey-patch via timeout — eliminou o
        // flash "Básicos/Avançados → Essenciais/Análise" que o usuário via.
      },

      _rebuildPanel(){
        const host = document.getElementById('components-panel');
        if (!host) return;
        // Não rebuilda se nosso layout já está lá (verifica marker)
        if (host.getAttribute('data-v56-reorg') === '1') return;
        // Limpa accordions existentes
        const accordions = host.querySelectorAll('.solstice__accord');
        accordions.forEach(a => a.remove());

        // Acha onde reinserir: depois do .solstice__cat-search
        const search = host.querySelector('.solstice__cat-search');
        const emptyEl = host.querySelector('.solstice__cat-empty');
        const helper = host.querySelector('.solstice__catalog-helper');

        const dsReady = SolsticeStore.get('dataset.ready');
        const selectedSlotId = SolsticeStore.get('ui.inspector.slotId') || SolsticeStore.get('ui.selectedSlot');
        const selectedSlot = (function(){
          if (!selectedSlotId) return null;
          const secs = SolsticeStore.get('canvas.sections') || [];
          for (const s of secs) for (const r of (s.rows || [])){
            const sl = (r.slots || []).find(x => x.id === selectedSlotId);
            if (sl) return sl;
          }
          return null;
        })();
        const inReplaceMode = !!selectedSlot && selectedSlot.type && selectedSlot.type !== 'empty';

        // Re-cria accordions com os GROUPS novos
        Reorg.GROUPS.forEach(g => {
          const defs = g.ids.map(id => SolsticeComponents.get(id)).filter(Boolean);
          if (!defs.length) return;
          const section = createAccordion({
            icon: g.icon, title: g.title, key: 'catalog.v56.' + g.key,
            openByDefault: g.openByDefault,
            count: defs.length,
            build: (body) => {
              body.classList.add('solstice__catalog-group');
              const grid = SolsticeUtils.el('div', { class: 'solstice__cat-grid' });
              defs.forEach(def => {
                const isSelf = inReplaceMode && selectedSlot.type === def.id;
                const card = SolsticeUtils.el('button', {
                  class: 'solstice__cat-card' + (dsReady ? '' : ' is-disabled') + (isSelf ? ' is-selected' : ''),
                  type: 'button',
                  draggable: dsReady ? 'true' : 'false',
                  'aria-disabled': dsReady ? 'false' : 'true',
                  title: !dsReady ? 'Importe um CSV primeiro'
                       : inReplaceMode ? (isSelf ? 'Já é este tipo' : 'Substituir selecionado por ' + def.name)
                       : ('Click para adicionar OU arraste para o canvas'),
                  ondragstart: (e) => {
                    if (!dsReady) return;
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                      fromCatalog: true, componentType: def.id
                    }));
                    card.classList.add('is-dragging');
                  },
                  ondragend: () => card.classList.remove('is-dragging'),
                  onclick: () => {
                    if (!dsReady) return;
                    if (inReplaceMode && !isSelf){
                      // Replace flow: reuse SolsticeProps select
                      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
                      for (const s of sections) for (const r of (s.rows || [])){
                        const sl = (r.slots || []).find(x => x.id === selectedSlotId);
                        if (sl){
                          const fromType = sl.type;
                          sl.type = def.id;
                          const ingest = SolsticeStore.get('ingest');
                          const allRows = (ingest && ingest.rows) || [];
                          const filteredRows = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.apply(allRows) : allRows;
                          const ctx = { rows: filteredRows, rowsAll: allRows, columns: (ingest && ingest.columns) || [], types: (ingest && ingest.types) || {}, dictionary: SolsticeStore.get('dictionary'), L: SolsticeLocale };
                          sl.config = def.defaultConfig ? def.defaultConfig(ctx) : {};
                          SolsticeStore.set('canvas.sections', sections);
                          try { SolsticeAudit.record({ action: 'change_component_type', target: selectedSlotId, details: { from: fromType, to: def.id, source: 'v56-catalog' } }); } catch(_){}
                          _toast('info', 'Componente trocado', fromType + ' → ' + def.name);
                          setTimeout(() => SolsticeProps.select(selectedSlotId), 80);
                          return;
                        }
                      }
                    } else if (!inReplaceMode){
                      SolsticeComponents.addByType(def.id);
                    }
                  }
                });
                card.appendChild(SolsticeUtils.el('div', { class: 'solstice__cat-card-icon', 'aria-hidden': 'true' }, def.icon));
                const nameEl = SolsticeUtils.el('div', { class: 'solstice__cat-card-name', 'data-name': def.name }, def.name);
                card.appendChild(nameEl);
                card.appendChild(SolsticeUtils.el('div', { class: 'solstice__cat-card-desc' }, def.description || ''));
                card.appendChild(SolsticeUtils.el('div', { class: 'solstice__cat-card-add' },
                  inReplaceMode ? (isSelf ? '✓ Atual' : '🔄 Substituir') : '+ Adicionar'));
                card.setAttribute('data-comp-id', def.id);
                grid.appendChild(card);
              });
              body.appendChild(grid);
            }
          });
          // Inserir antes do helper (se existir) ou no fim
          if (helper) host.insertBefore(section, helper);
          else host.appendChild(section);
        });
        host.setAttribute('data-v56-reorg', '1');

        // Reaplica a busca textual sobre os novos cards
        Reorg._wireSearch(host);
      },

      _wireSearch(host){
        const searchInput = host.querySelector('.solstice__cat-search-input');
        const emptyEl = host.querySelector('.solstice__cat-empty');
        if (!searchInput) return;
        const accordionEls = host.querySelectorAll('.solstice__accord');
        const cardEls = host.querySelectorAll('.solstice__cat-card[data-comp-id]');

        function norm(s){
          return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        }
        // Sinônimos para os componentes novos
        const NEW_SYN = {
          'bar':       ['barras', 'gráfico de barras', 'grafico de barras', 'horizontal', 'vertical', 'ranking'],
          'donut':     ['donut', 'pizza', 'pie', 'rosca', 'fatia', 'composição', 'composicao', 'percentual'],
          'area':      ['area', 'área', 'preenchida', 'volume', 'cumulativo'],
          'waterfall': ['cascata', 'cascade', 'dre', 'balance', 'incremento', 'decomposicao', 'decomposição', 'p&l']
        };

        function matches(def, q){
          if (!q) return true;
          if (norm(def.name).includes(q)) return true;
          if (norm(def.description || '').includes(q)) return true;
          const syn = NEW_SYN[def.id] || [];
          return syn.some(s => norm(s).includes(q));
        }
        function apply(rawQ){
          const q = norm((rawQ || '').trim());
          if (!q){
            cardEls.forEach(c => c.classList.remove('solstice__hidden'));
            accordionEls.forEach(a => a.classList.remove('solstice__hidden'));
            if (emptyEl) emptyEl.classList.add('solstice__hidden');
            return;
          }
          let total = 0;
          cardEls.forEach(c => {
            const id = c.getAttribute('data-comp-id');
            const def = SolsticeComponents.get(id);
            const ok = def && matches(def, q);
            c.classList.toggle('solstice__hidden', !ok);
            if (ok) total++;
          });
          accordionEls.forEach(a => {
            const visible = a.querySelectorAll('.solstice__cat-card[data-comp-id]:not(.solstice__hidden)');
            a.classList.toggle('solstice__hidden', visible.length === 0);
            if (visible.length) a.classList.add('is-open');
          });
          if (emptyEl) emptyEl.classList.toggle('solstice__hidden', total > 0);
        }
        // Não duplica listener
        const old = searchInput.__v56Handler;
        if (old) searchInput.removeEventListener('input', old);
        const debounced = SolsticeUtils.debounce(apply, 80);
        searchInput.__v56Handler = (e) => debounced(e.target.value);
        searchInput.addEventListener('input', searchInput.__v56Handler);
      }
    };

    /* ==========================================================
       Auto-install — espera que o app esteja pronto
       Auditoria 2026 (G-01 / A-105) parcial: catálogo das 12 sub-features
       expostas como objetos públicos para inspeção/teste/disable seletivo
       sem precisar fragmentar o módulo em IIFEs separadas (esforço G real).
       Cada install() reporta erro estruturado via SolsticeErrors em vez de
       console.warn mudo. Lista de sub-features:
         Responsive · CrossFilterExt · PeriodCompare · MultiCSV · Wire ·
         NewComponents · Round3Components · UX3 · FriendlyMode ·
         TemplateWizard · LayoutDiv · Reorg
       ========================================================== */
    const _SUB_FEATURES = [
      { id: 'Responsive',        ref: () => Responsive },
      { id: 'CrossFilterExt',    ref: () => CrossFilterExt },
      { id: 'PeriodCompare',     ref: () => PeriodCompare },
      { id: 'MultiCSV',          ref: () => MultiCSV },
      { id: 'Wire',              ref: () => Wire },
      { id: 'NewComponents',     ref: () => NewComponents },
      { id: 'Round3Components',  ref: () => Round3Components },
      { id: 'UX3',               ref: () => UX3 },
      { id: 'FriendlyMode',      ref: () => FriendlyMode },
      { id: 'TemplateWizard',    ref: () => TemplateWizard },
      { id: 'LayoutDiv',         ref: () => LayoutDiv },
      { id: 'Reorg',             ref: () => Reorg }
    ];
    function install(){
      if (_patched) return;
      _patched = true;
      const installed = [], failed = [];
      for (const sf of _SUB_FEATURES){
        try {
          const mod = sf.ref();
          if (mod && typeof mod.install === 'function'){
            mod.install();
            installed.push(sf.id);
          }
        } catch(e){
          failed.push({ id: sf.id, error: String(e && e.message || e) });
          // Reporte estruturado em vez de console.warn mudo
          if (typeof SolsticeErrors !== 'undefined' && SolsticeErrors.register){
            try { console.warn('[v5.6 ' + sf.id + ' falhou]', e); } catch(_){}
          }
        }
      }
      if (failed.length){
        console.warn('[Solstice v5.6 patched] ⚠ ' + failed.length + ' sub-feature(s) falharam:', failed);
      }
      // Auditoria 2026 (JM-02): banner público via SolsticeLog.boot.
      SolsticeLog.boot('[Solstice v5.6 patched] ✓ ' + installed.length + '/' + _SUB_FEATURES.length + ' sub-features ativas');
    }

    // Tenta instalar agora (se o app já existir) e também em DOMContentLoaded
    if (document.readyState === 'complete' || document.readyState === 'interactive'){
      setTimeout(install, 250);
    } else {
      document.addEventListener('DOMContentLoaded', () => setTimeout(install, 250));
    }
    // Garantia extra: instala 1.5s depois também (caso módulos venham async)
    setTimeout(install, 1500);

    return {
      VERSION,
      install,
      // Auditoria 2026 (G-01 / A-105): catálogo público das sub-features.
      // Permite Solstice.V56.subFeatures().filter(...).disable() etc.
      // Caminho preparado para futura extração em IIFEs próprias.
      subFeatures(){ return _SUB_FEATURES.map(s => s.id); },
      Vtable, ExportImage, CrossFilterExt, PeriodCompare, MultiCSV, Responsive, Wire,
      NewComponents, Round3Components, UX3, FriendlyMode, TemplateWizard, LayoutDiv, Reorg
    };
  })();
