
  /* ============================================================
     SolsticeDnD — drag-and-drop entre slots via HTML5 Drag API.
     Soltar = swap. Não suporta reordenar dentro da mesma row
     ainda (B12 fará).
     ============================================================ */
  const SolsticeDnD = (function(){

    function _onDragStart(e){
      const slot = e.target.closest('.solstice__slot');
      if (!slot) return;
      const row = slot.closest('.solstice__row');
      const sec = slot.closest('.solstice__section');
      if (!row || !sec) return;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({
        secId: sec.dataset.id,
        rowId: row.dataset.id,
        slotId: slot.dataset.id
      }));
      slot.classList.add('is-dragging');
    }
    function _onDragEnd(e){
      const slot = e.target.closest('.solstice__slot');
      if (slot) slot.classList.remove('is-dragging');
      SolsticeUtils.qsa('.solstice__slot.is-dragover').forEach(s => s.classList.remove('is-dragover'));
    }
    function _onDragOver(e){
      // Lucas Fix 17: SEMPRE preventDefault quando estamos no canvas — sem isso
      // o evento drop NUNCA dispara (a especificação HTML5 exige cancelar
      // dragover pra permitir drop). Antes retornávamos cedo quando não havia
      // slot/row/sec → drop nunca era recebido → "não consigo arrastar".
      const canvas = e.currentTarget;
      e.preventDefault();
      // ADR-162 (Onda 1 / T4): drop de ARQUIVO no canvas → import direto.
      // Detecta via dataTransfer.types contém 'Files'. Visual diferente do
      // slot drop (dashed accent border + label "Solte o CSV aqui").
      const isFileDrag = e.dataTransfer && e.dataTransfer.types &&
                         Array.from(e.dataTransfer.types).includes('Files');
      if (isFileDrag){
        e.dataTransfer.dropEffect = 'copy';
        SolsticeUtils.qsa('.is-dragover').forEach(el => el.classList.remove('is-dragover'));
        if (canvas) canvas.classList.add('is-file-dragover');
        return;
      }
      const slot = e.target.closest('.solstice__slot');
      const row = e.target.closest('.solstice__row');
      const sec = e.target.closest('.solstice__section');
      // Lucas Fix 18: CRÍTICO — dropEffect TEM que casar com effectAllowed do
      // source, senão o navegador REJEITA o drop. Catálogo seta 'copy',
      // swap slot seta 'move'. Antes eu setava 'move' fixo em slots → drop
      // do catálogo era silenciosamente bloqueado. Agora segue a origem.
      const effAllowed = e.dataTransfer.effectAllowed;
      e.dataTransfer.dropEffect = (effAllowed === 'copy') ? 'copy' :
                                  (effAllowed === 'move') ? 'move' :
                                  'copy';  // default copy se desconhecido
      // Limpa highlights antigos
      SolsticeUtils.qsa('.is-dragover').forEach(el => el.classList.remove('is-dragover'));
      if (slot) slot.classList.add('is-dragover');
      else if (row) row.classList.add('is-dragover');
      else if (sec) sec.classList.add('is-dragover');
      else if (canvas) canvas.classList.add('is-dragover');  // empty canvas fallback
    }
    function _onDragLeave(e){
      // Só limpa o canvas-level highlight quando saindo de fato do canvas
      const canvas = e.currentTarget;
      if (canvas && !canvas.contains(e.relatedTarget)) {
        canvas.classList.remove('is-dragover');
        canvas.classList.remove('is-file-dragover');  // ADR-162
      }
      const slot = e.target.closest('.solstice__slot');
      const row = e.target.closest('.solstice__row');
      const sec = e.target.closest('.solstice__section');
      if (slot) slot.classList.remove('is-dragover');
      if (row) row.classList.remove('is-dragover');
      if (sec) sec.classList.remove('is-dragover');
    }
    function _onDrop(e){
      const canvas = e.currentTarget;
      const slot = e.target.closest('.solstice__slot');
      const row = e.target.closest('.solstice__row');
      const sec = e.target.closest('.solstice__section');
      e.preventDefault();
      SolsticeUtils.qsa('.is-dragover').forEach(el => el.classList.remove('is-dragover'));
      if (canvas){ canvas.classList.remove('is-dragover'); canvas.classList.remove('is-file-dragover'); }

      // ADR-162 (Onda 1 / T4): drop de ARQUIVO → import direto.
      // Aceita CSV/TSV/TXT (mesmos formatos do #file-input). Reusa _runIngestFile.
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0){
        const f = files[0];
        const name = (f.name || '').toLowerCase();
        const validExt = ['.csv', '.tsv', '.txt', '.json'].some(ext => name.endsWith(ext));
        if (!validExt){
          SolsticeToast.warn('Formato não suportado', 'Use CSV, TSV, TXT ou JSON. Recebido: ' + (f.name || 'arquivo sem nome'));
          return;
        }
        try { SolsticeAudit.record({ action:'drop_file_to_canvas', details:{ name: f.name, size: f.size, type: f.type } }); } catch(_){}
        // Respeita Express Mode (Settings) automaticamente — _runIngestFile lê o setting
        _runIngestFile(f);
        return;
      }

      let payload;
      try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); }
      catch(err){ return; }

      // === Lucas Fix 16: drop do CATÁLOGO ===
      if (payload.fromCatalog && payload.componentType){
        const ingest = SolsticeStore.get('ingest') || {};
        const ctx = {
          rows: ingest.rows || [],
          columns: ingest.columns || [],
          types: ingest.types || {},
          dictionary: SolsticeStore.get('dictionary'),
          L: SolsticeLocale
        };
        const def = SolsticeComponents.get(payload.componentType);
        if (!def) return;
        // Auditoria 2026 (U-13): grava o dataset ativo no momento do drop.
        // Bases coexistem — KPI da base A continua funcionando se ativar B.
        const _activeDsId = SolsticeStore.get('datasets.activeId');
        const baseCfg = def.defaultConfig ? def.defaultConfig(ctx) : {};
        if (_activeDsId) baseCfg.datasetId = _activeDsId;
        const newSlot = {
          id: SolsticeUtils.uuid(),
          type: payload.componentType,
          config: baseCfg
        };
        const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);

        // Estratégia de DROP por target:
        // 1) Em slot vazio → preenche o slot
        // 2) Em slot com componente → SUBSTITUI por default (intuitivo
        //    Power BI/QuickSight). Shift-drop = expandir row para direita.
        // 3) Em row (espaço não-slot) → nova row 1col abaixo dessa
        // 4) Em section (espaço não-row) → nova row 1col no final
        // Auditoria 2026 (U-1): comportamento default mudou de "expandir
        // row" para "substituir" — alinha com PowerBI/QuickSight e com a
        // expectativa visual do usuário ao "jogar" KPI em cima da tabela.
        const _expandKey = !!(e && (e.shiftKey || e.altKey));
        if (slot){
          const secId = sec.dataset.id, rowId = row.dataset.id, slotId = slot.dataset.id;
          for (const s of sections) for (const r of s.rows){
            const idx = r.slots.findIndex(x => x.id === slotId);
            if (idx < 0) continue;
            const isEmpty = !r.slots[idx].type || r.slots[idx].type === 'empty';
            if (isEmpty){
              r.slots[idx] = newSlot;
              SolsticeStore.set('canvas.sections', sections);
              try { SolsticeAudit.record({ action:'drop_to_slot', target: newSlot.id, details:{ type: payload.componentType, mode:'fill' }}); } catch(_){}
              SolsticeToast.success('✓ Componente adicionado', def.name);
              setTimeout(() => SolsticeProps.select(newSlot.id), 80);
              return;
            }
            // Auditoria 2026 (U-1): default = substituir. Preserva o id
            // do slot original (não quebra referências) e troca type+config.
            if (!_expandKey){
              const prevType = r.slots[idx].type;
              r.slots[idx] = { ...r.slots[idx], type: newSlot.type, config: newSlot.config };
              SolsticeStore.set('canvas.sections', sections);
              try { SolsticeAudit.record({ action:'replace_slot', target: r.slots[idx].id, details:{ from: prevType, to: payload.componentType, source: 'catalog-drop' }}); } catch(_){}
              SolsticeToast.success('✓ ' + def.name + ' substituiu ' + (prevType || 'slot'),
                'Segure Shift no próximo drop para colocar lado a lado.');
              setTimeout(() => SolsticeProps.select(r.slots[idx].id), 80);
              return;
            }
            // Shift-drop = expandir row à direita (comportamento legado).
            // Lucas Fix 19: upgradeMap SEQUENCIAL 1→2→3→4→5→6 (sem pular).
            const upgradeMap = {
              '1col':'2col-equal',
              '2col-equal':'3col-equal',
              '3col-equal':'4col-equal',
              '4col-equal':'5col-equal',
              '5col-equal':'6col-equal'
              // 6col-equal → SEM upgrade. Cai no fallback abaixo (nova row).
            };
            const upgradeTo = upgradeMap[r.layout];
            if (upgradeTo){
              r.layout = upgradeTo;
              r.slots.splice(idx + 1, 0, newSlot);
              // Garante slots.length === target (matemática bate sem padding).
              const target = SolsticeLayouts.slotCount(upgradeTo);
              while (r.slots.length < target) r.slots.push({ id: SolsticeUtils.uuid(), type:'empty' });
              // Defensive: limpa empties extras (caso row tivesse slots vazios pré-existentes)
              while (r.slots.length > target) r.slots.pop();
              SolsticeStore.set('canvas.sections', sections);
              try { SolsticeAudit.record({ action:'drop_to_slot', target: newSlot.id, details:{ type: payload.componentType, mode:'expand-right' }}); } catch(_){}
              SolsticeToast.success('✓ Componente adicionado', def.name + ' à direita (Shift)');
              setTimeout(() => SolsticeProps.select(newSlot.id), 80);
              return;
            }
            // Layout já máximo → cria nova row 1col abaixo
            const rowIdx = (sections.find(x => x.id === secId)?.rows.findIndex(r2 => r2.id === rowId)) ?? 0;
            sec && sections.find(x => x.id === secId).rows.splice(rowIdx + 1, 0, {
              id: SolsticeUtils.uuid(), layout: '1col', slots: [newSlot]
            });
            SolsticeStore.set('canvas.sections', sections);
            try { SolsticeAudit.record({ action:'drop_to_slot', target: newSlot.id, details:{ type: payload.componentType, mode:'new-row-below' }}); } catch(_){}
            SolsticeToast.success('✓ Componente adicionado', def.name + ' em nova linha');
            setTimeout(() => SolsticeProps.select(newSlot.id), 80);
            return;
          }
          return;
        }
        // Drop em ROW (não-slot): nova row abaixo
        if (row){
          const secId = sec.dataset.id, rowId = row.dataset.id;
          const sec2 = sections.find(x => x.id === secId);
          const rowIdx = sec2.rows.findIndex(r => r.id === rowId);
          sec2.rows.splice(rowIdx + 1, 0, { id: SolsticeUtils.uuid(), layout:'1col', slots:[newSlot] });
          SolsticeStore.set('canvas.sections', sections);
          try { SolsticeAudit.record({ action:'drop_to_row', target: newSlot.id, details:{ type: payload.componentType, mode:'new-row-below' }}); } catch(_){}
          SolsticeToast.success('✓ Nova linha', def.name);
          setTimeout(() => SolsticeProps.select(newSlot.id), 80);
          return;
        }
        // Drop em SECTION: nova row no final
        if (sec){
          const sec2 = sections.find(x => x.id === sec.dataset.id);
          sec2.rows.push({ id: SolsticeUtils.uuid(), layout:'1col', slots:[newSlot] });
          SolsticeStore.set('canvas.sections', sections);
          try { SolsticeAudit.record({ action:'drop_to_section', target: newSlot.id, details:{ type: payload.componentType, mode:'append-row' }}); } catch(_){}
          SolsticeToast.success('✓ Nova linha na seção', def.name);
          setTimeout(() => SolsticeProps.select(newSlot.id), 80);
          return;
        }
        // Lucas Fix 17: Fallback — drop em área SEM section/row/sec
        // (canvas vazio OU área entre seções). Cria nova section com 1 row 1col.
        if (sections.length === 0){
          // Canvas inteiramente vazio: cria primeira seção
          sections.push({
            id: SolsticeUtils.uuid(),
            title: 'Nova seção',
            rows: [{ id: SolsticeUtils.uuid(), layout:'1col', slots:[newSlot] }]
          });
        } else {
          // Há sections — adiciona row no final da última
          const lastSec = sections[sections.length - 1];
          lastSec.rows.push({ id: SolsticeUtils.uuid(), layout:'1col', slots:[newSlot] });
        }
        SolsticeStore.set('canvas.sections', sections);
        try { SolsticeAudit.record({ action:'drop_to_canvas', target: newSlot.id, details:{ type: payload.componentType, mode: sections.length === 1 ? 'first-section' : 'append-last-section' }}); } catch(_){}
        SolsticeToast.success('✓ Componente adicionado', def.name);
        setTimeout(() => SolsticeProps.select(newSlot.id), 80);
        return;
      }

      // === Comportamento original: swap entre slots existentes ===
      if (!slot) return;
      const dstRow = slot.closest('.solstice__row');
      const dstSec = slot.closest('.solstice__section');
      const dst = { secId: dstSec.dataset.id, rowId: dstRow.dataset.id, slotId: slot.dataset.id };
      if (payload.slotId === dst.slotId) return;   // mesmo slot, no-op

      // Swap no Store
      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      function _findSlot(secId, rowId, slotId){
        const s = sections.find(x => x.id === secId);
        const r = s && s.rows.find(x => x.id === rowId);
        const i = r && r.slots.findIndex(x => x.id === slotId);
        return r && i >= 0 ? { row: r, idx: i } : null;
      }
      const a = _findSlot(payload.secId, payload.rowId, payload.slotId);
      const b = _findSlot(dst.secId, dst.rowId, dst.slotId);
      if (!a || !b) return;
      const tmp = a.row.slots[a.idx];
      a.row.slots[a.idx] = b.row.slots[b.idx];
      b.row.slots[b.idx] = tmp;
      SolsticeStore.set('canvas.sections', sections);
      SolsticeToast.info('🔀 Slots trocados', 'Use Ctrl+Z para desfazer.');
    }

    // ============================================================
    // Auditoria 2026 (B-06 / A-605) — Alternativa de teclado para DnD.
    // Antes: mover/swap só por mouse. Agora: Tab navega entre slots;
    // Enter/Space entra em "modo mover"; setas swap com vizinho; Enter
    // confirma; Esc cancela. WCAG 2.1.1 (Keyboard Accessible).
    // ============================================================
    let _kbGrab = null; // { slotEl, original: {secId, rowId, slotId} }

    function _ensureKbAttrs(canvas){
      canvas.querySelectorAll('.solstice__slot').forEach(s => {
        if (!s.hasAttribute('tabindex')) s.setAttribute('tabindex', '0');
        if (!s.hasAttribute('role')) s.setAttribute('role', 'gridcell');
        if (!s.hasAttribute('aria-label')) {
          s.setAttribute('aria-label', 'Componente — Enter para mover, setas para reposicionar, Esc para cancelar.');
        }
      });
    }

    function _injectKbStyles(){
      if (document.getElementById('solstice-dnd-kbd-style')) return;
      const style = document.createElement('style');
      style.id = 'solstice-dnd-kbd-style';
      style.textContent =
        '.solstice__slot.is-keyboard-grabbed{' +
          'outline:3px dashed var(--c-accent);outline-offset:2px;' +
          'box-shadow:0 0 0 6px color-mix(in srgb,var(--c-accent) 18%,transparent);' +
          'z-index:10;position:relative;' +
        '}' +
        '.solstice__slot:focus-visible{' +
          'outline:2px solid var(--c-accent);outline-offset:2px;' +
        '}';
      document.head.appendChild(style);
    }

    function _findSlotInStore(sections, secId, rowId, slotId){
      const s = sections.find(x => x.id === secId);
      const r = s && s.rows.find(x => x.id === rowId);
      const i = r && r.slots.findIndex(x => x.id === slotId);
      return r && i >= 0 ? { row: r, idx: i } : null;
    }

    function _swapWithNeighbor(grab, dir){
      const slot = grab.slotEl;
      const rect = slot.getBoundingClientRect();
      const all = Array.from(document.querySelectorAll('.solstice__slot'));
      let best = null, bestDist = Infinity;
      for (const s of all){
        if (s === slot) continue;
        const r = s.getBoundingClientRect();
        const dx = r.left - rect.left;
        const dy = r.top - rect.top;
        const sameDir = (dir==='right' && dx > 8) || (dir==='left' && dx < -8) ||
                        (dir==='down'  && dy > 8) || (dir==='up'   && dy < -8);
        if (!sameDir) continue;
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist){ bestDist = dist; best = s; }
      }
      if (!best) return false;
      const targetRow = best.closest('.solstice__row');
      const targetSec = best.closest('.solstice__section');
      if (!targetRow || !targetSec) return false;
      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      const a = _findSlotInStore(sections, grab.original.secId, grab.original.rowId, grab.original.slotId);
      const b = _findSlotInStore(sections, targetSec.dataset.id, targetRow.dataset.id, best.dataset.id);
      if (!a || !b) return false;
      const tmp = a.row.slots[a.idx];
      a.row.slots[a.idx] = b.row.slots[b.idx];
      b.row.slots[b.idx] = tmp;
      SolsticeStore.set('canvas.sections', sections);
      // Após re-render, encontra o slot original (agora na posição do target).
      setTimeout(() => {
        const moved = document.querySelector('.solstice__slot[data-id="' + grab.original.slotId + '"]');
        if (moved){
          moved.classList.add('is-keyboard-grabbed');
          moved.setAttribute('aria-grabbed', 'true');
          moved.focus();
          grab.slotEl = moved;
        }
      }, 50);
      return true;
    }

    function _onKeydown(e){
      const slot = e.target.closest('.solstice__slot');
      if (!slot) return;
      // Não interferir com inputs/contentEditable dentro do slot.
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

      if (!_kbGrab){
        if (e.key === 'Enter' || e.key === ' '){
          const row = slot.closest('.solstice__row');
          const sec = slot.closest('.solstice__section');
          if (!row || !sec) return;
          e.preventDefault();
          _kbGrab = {
            slotEl: slot,
            original: { secId: sec.dataset.id, rowId: row.dataset.id, slotId: slot.dataset.id }
          };
          slot.classList.add('is-keyboard-grabbed');
          slot.setAttribute('aria-grabbed', 'true');
          SolsticeToast.info('🎯 Modo mover ativo', 'Setas para mover · Enter confirma · Esc cancela');
        }
        return;
      }

      // Em modo grab
      if (e.key === 'Escape'){
        e.preventDefault();
        _kbGrab.slotEl.classList.remove('is-keyboard-grabbed');
        _kbGrab.slotEl.removeAttribute('aria-grabbed');
        _kbGrab = null;
        SolsticeToast.info('Movimento cancelado', 'Use Ctrl+Z para reverter swaps prévios se já houve trocas.');
        return;
      }
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        _kbGrab.slotEl.classList.remove('is-keyboard-grabbed');
        _kbGrab.slotEl.removeAttribute('aria-grabbed');
        SolsticeToast.success('✓ Componente movido');
        _kbGrab = null;
        return;
      }
      const dirMap = { ArrowRight:'right', ArrowLeft:'left', ArrowDown:'down', ArrowUp:'up' };
      const dir = dirMap[e.key];
      if (!dir) return;
      e.preventDefault();
      const moved = _swapWithNeighbor(_kbGrab, dir);
      if (!moved) SolsticeToast.info('Sem vizinho nessa direção');
    }

    function init(){
      const canvas = document.querySelector('.solstice__canvas');
      if (!canvas) return;
      canvas.addEventListener('dragstart', _onDragStart);
      canvas.addEventListener('dragend',   _onDragEnd);
      canvas.addEventListener('dragover',  _onDragOver);
      canvas.addEventListener('dragleave', _onDragLeave);
      canvas.addEventListener('drop',      _onDrop);

      // Auditoria 2026 (B-06 / A-605) — wiring de teclado
      _injectKbStyles();
      canvas.addEventListener('keydown', _onKeydown);
      _ensureKbAttrs(canvas);
      // Re-aplica atributos a cada re-render do canvas (slots novos chegam).
      const mo = new MutationObserver(() => _ensureKbAttrs(canvas));
      mo.observe(canvas, { childList: true, subtree: true });
    }

    return { init };
  })();
