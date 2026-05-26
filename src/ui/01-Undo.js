
  /* ============================================================
     BLOCO 4 — UNDO / RESIZE / DND / MINIMAP / FREE MODE
     ============================================================ */

  /* ============================================================
     SolsticeUndo — ring buffer de 50 snapshots de canvas.sections.
     Captura via subscribe (desacoplado do Canvas). Flag _suppress
     evita capturar durante o próprio undo/redo (loop).
     ============================================================ */
  const SolsticeUndo = (function(){
    const MAX = 50;
    const history = [];
    let pointer = -1;
    let suppress = false;

    function _capture(){
      if (suppress) return;
      const state = JSON.stringify(SolsticeStore.get('canvas.sections') || []);
      // Se houve "redo pendente" e o usuário fez nova mudança, descarta-os
      if (pointer < history.length - 1) history.splice(pointer + 1);
      // Não duplica entrada idêntica
      if (history.length && history[history.length - 1] === state) return;
      history.push(state);
      if (history.length > MAX) history.shift();
      else pointer++;
      _refreshToolbar();
    }

    function undo(){
      if (!canUndo()) return false;
      pointer--;
      _apply(history[pointer]);
      SolsticeToast.info('↺ Desfeito', 'Estado restaurado · ' + (pointer + 1) + '/' + history.length);
      return true;
    }
    function redo(){
      if (!canRedo()) return false;
      pointer++;
      _apply(history[pointer]);
      SolsticeToast.info('↻ Refeito', 'Estado restaurado · ' + (pointer + 1) + '/' + history.length);
      return true;
    }
    function _apply(state){
      suppress = true;
      try { SolsticeStore.set('canvas.sections', JSON.parse(state)); }
      finally { suppress = false; }
      _refreshToolbar();
    }
    function _refreshToolbar(){
      const u = document.getElementById('btn-undo'); if (u) u.disabled = !canUndo();
      const r = document.getElementById('btn-redo'); if (r) r.disabled = !canRedo();
    }

    function canUndo(){ return pointer > 0; }
    function canRedo(){ return pointer < history.length - 1; }
    function size(){ return history.length; }

    // Auditoria 2026 (R-17 / A-1001 + A-104): undo agora aceita "ações
    // custom" — qualquer mutação fora de canvas.sections (ex.: transform
    // de coluna no Editor) pode empurrar um custom-step com restore().
    // Comportamento: o custom-step intercepta o PRÓXIMO undo; após
    // restaurado, é removido. Ações de canvas continuam usando o ring
    // buffer normal.
    const customStack = [];
    function pushCustom(entry){
      if (!entry || typeof entry.restore !== 'function') return;
      customStack.push(entry);
      // Cap = mesmo MAX para evitar vazamento.
      if (customStack.length > MAX) customStack.shift();
      _refreshToolbar();
    }

    function init(){
      // captura estado inicial
      _capture();
      SolsticeStore.subscribe('canvas.sections', _capture);
      // atalhos
      window.addEventListener('keydown', e => {
        // ignorar se foco em input/textarea/contenteditable
        const t = document.activeElement;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')){
          e.preventDefault();
          // Custom-step tem prioridade — desfaz a mutação fora-do-canvas mais recente.
          if (customStack.length){
            const step = customStack.pop();
            try { step.restore(); SolsticeToast.info('↺ Desfeito', step.label || 'Ação restaurada'); }
            catch(err){ console.error('[Undo custom]', err); }
            _refreshToolbar();
            return;
          }
          undo();
        }
        else if (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); redo(); }
        else if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')){ e.preventDefault(); redo(); }
      });
    }

    return { undo, redo, canUndo, canRedo, size, init, _capture, pushCustom };
  })();
