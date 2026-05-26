
  /* ============================================================
     SolsticeResize — handle vertical entre slots com magic snap.
     Persiste em row.widths (array de %). Quando widths existe,
     Canvas aplica style.gridTemplateColumns inline (Bloco 3 hook).
     Magic snap: 25/33/50/66/75%.
     ============================================================ */
  const SolsticeResize = (function(){
    const SNAPS = [25, 33.33, 50, 66.67, 75];
    const SNAP_TOL = 2.5;  // % de tolerância

    let active = null;  // { rowEl, secId, rowId, leftSlot, rightSlot, startX, startWidths, totalPx, badge }

    function _maybeSnap(pct){
      for (const s of SNAPS){
        if (Math.abs(pct - s) < SNAP_TOL) return s;
      }
      return pct;
    }

    function _onMouseDown(e){
      const handle = e.target.closest('.solstice__resize-handle');
      if (!handle) return;
      e.preventDefault();
      const rowEl = handle.closest('.solstice__row');
      const slots = SolsticeUtils.qsa('.solstice__slot', rowEl);
      const idx = +handle.dataset.idx;   // índice do divisor (0 = entre slot 0 e 1)
      if (!slots[idx] || !slots[idx+1]) return;
      const rect = rowEl.getBoundingClientRect();
      const sec  = SolsticeStore.get('canvas.sections').find(s => s.id === rowEl.closest('.solstice__section').dataset.id);
      const row  = sec && sec.rows.find(r => r.id === rowEl.dataset.id);
      if (!row) return;

      // Calcula widths iniciais (em %) a partir do estado atual ou layout default
      let widths = (row.widths && row.widths.slice()) || _widthsFromLayout(row.layout, slots.length);

      const badge = SolsticeUtils.el('div', { class:'solstice__resize-badge' }, '');
      document.body.appendChild(badge);

      active = {
        rowEl, secId: sec.id, rowId: row.id,
        idx, startX: e.clientX, startWidths: widths,
        totalPx: rect.width, badge, row
      };
      handle.classList.add('is-active');
      document.body.style.cursor = 'col-resize';
    }

    function _widthsFromLayout(layout, slotCount){
      // Aproximação inicial: distribuição igual (fração 1fr cada).
      // Cobrir layouts não-igualitários explicitamente é nice-to-have, mas iniciar
      // com igual já dá UX razoável (usuário ajusta logo após).
      const equal = 100 / slotCount;
      return Array(slotCount).fill(equal);
    }

    function _onMouseMove(e){
      if (!active) return;
      const deltaPx = e.clientX - active.startX;
      const deltaPct = (deltaPx / active.totalPx) * 100;
      const w = active.startWidths.slice();
      let leftNew = w[active.idx] + deltaPct;
      let rightNew = w[active.idx+1] - deltaPct;
      // Magic snap
      leftNew = _maybeSnap(leftNew);
      // recalcula right pra manter soma constante
      rightNew = (w[active.idx] + w[active.idx+1]) - leftNew;
      // Limites mínimos (5%)
      if (leftNew < 5 || rightNew < 5) return;
      w[active.idx] = leftNew;
      w[active.idx+1] = rightNew;

      // Aplica visualmente (sem commit no Store ainda)
      active.rowEl.style.gridTemplateColumns = w.map(p => p.toFixed(2) + 'fr').join(' ');
      active.previewWidths = w;

      // Badge
      active.badge.textContent = Math.round(leftNew) + '% | ' + Math.round(rightNew) + '%';
      active.badge.style.left = (e.clientX) + 'px';
      active.badge.style.top  = (e.clientY) + 'px';
    }

    function _onMouseUp(){
      if (!active) return;
      const { secId, rowId, previewWidths, badge, rowEl } = active;
      if (previewWidths){
        // Commit no Store (gera 1 snapshot do Undo)
        const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
        const sec = sections.find(s => s.id === secId);
        const row = sec && sec.rows.find(r => r.id === rowId);
        if (row){ row.widths = previewWidths; row.layout = 'custom'; }
        SolsticeStore.set('canvas.sections', sections);
      }
      SolsticeUtils.qsa('.solstice__resize-handle.is-active').forEach(h => h.classList.remove('is-active'));
      badge.remove();
      document.body.style.cursor = '';
      active = null;
    }

    function init(){
      // Event delegation no canvas
      const canvas = document.querySelector('.solstice__canvas');
      if (canvas){
        canvas.addEventListener('mousedown', _onMouseDown);
        document.addEventListener('mousemove', _onMouseMove);
        document.addEventListener('mouseup',   _onMouseUp);
      }
    }

    /**
     * SOL-H5 v2 · Encolher sem vazio fantasma (Auditoria 2026.4).
     * Quando o usuário diminui um bloco de 4 colunas para 1, antes ficava
     * espaço vazio residual nas 3 colunas adjacentes — visual quebrado.
     * Agora os outros blocos da row crescem proporcionalmente pra preencher.
     * Quando aumenta de volta — encolher de novo —
     * estável".
     *
     * compactRow(secId, rowId) — redistribui as larguras dos slots de uma row
     * para somar 100% sem espaço vazio. Se a row tem custom widths que somam
     * < 100%, escala proporcional. Se um slot foi "encolhido" abaixo do mínimo,
     * o restante é absorvido pelos vizinhos.
     */
    function compactRow(secId, rowId){
      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      const sec = sections.find(s => s.id === secId);
      const row = sec && sec.rows.find(r => r.id === rowId);
      if (!row) return false;
      const n = (row.slots || []).length;
      if (!n) return false;
      const w = (row.widths && row.widths.slice()) || Array(n).fill(100 / n);
      const sum = w.reduce((a, b) => a + b, 0);
      if (sum < 1) {
        // Estado degenerado — recoloca tudo igual
        row.widths = Array(n).fill(100 / n);
      } else {
        const scale = 100 / sum;
        row.widths = w.map(p => Math.max(5, p * scale));
        // Re-normaliza após o mínimo de 5%
        const s2 = row.widths.reduce((a, b) => a + b, 0);
        if (s2 !== 100) row.widths = row.widths.map(p => p * (100 / s2));
      }
      row.layout = 'custom';
      SolsticeStore.set('canvas.sections', sections);
      return true;
    }

    /**
     * SOL-H5 v2 · Encolhe um slot para o tamanho mínimo e devolve o espaço
     * aos vizinhos — sem deixar vazio. Útil quando o usuário arrasta o handle
     * pra esquerda mas o row não compacta sozinho.
     */
    function shrinkToFit(secId, rowId, slotIdx, targetPct){
      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      const sec = sections.find(s => s.id === secId);
      const row = sec && sec.rows.find(r => r.id === rowId);
      if (!row) return false;
      const n = (row.slots || []).length;
      if (slotIdx < 0 || slotIdx >= n) return false;
      const w = (row.widths && row.widths.slice()) || Array(n).fill(100 / n);
      const target = Math.max(5, Math.min(95, targetPct == null ? 100 / n : targetPct));
      const old = w[slotIdx];
      const delta = old - target;
      w[slotIdx] = target;
      // Redistribui o delta entre os outros slots proporcionalmente
      const others = w.length - 1;
      if (others > 0 && delta !== 0){
        const otherSum = w.reduce((a, b, i) => a + (i === slotIdx ? 0 : b), 0);
        if (otherSum > 0){
          for (let i = 0; i < w.length; i++){
            if (i === slotIdx) continue;
            w[i] = w[i] + (w[i] / otherSum) * delta;
          }
        }
      }
      row.widths = w;
      row.layout = 'custom';
      SolsticeStore.set('canvas.sections', sections);
      return true;
    }

    return { init, _maybeSnap, SNAPS, compactRow, shrinkToFit };
  })();
