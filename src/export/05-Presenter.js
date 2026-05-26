
  /* ============================================================
     BLOCO 12 — SolsticePresenter (ADR-086)
     Modo Apresentador: dual-pane com notas + timer + preview próximo.
     Versão simplificada: usa overlay no mesmo window (não dual-window
     com window.open para evitar bloqueio de popup em vários browsers).
     ============================================================ */
  const SolsticePresenter = (function(){
    let overlay = null;
    let slideIndex = 0;
    let startTs = 0;
    let timerInterval = null;

    function _sections(){ return SolsticeStore.get('canvas.sections') || []; }

    // Auditoria 2026 (R-18 / A-1102): Apresentador dual-window real.
    // Antes: overlay no mesmo monitor (apesar de o comentário interno
    // admitir). Agora: tenta window.open(); se popup bloqueado, cai no
    // overlay com aviso explícito. Sync entre janelas via BroadcastChannel
    // (nome 'solstice-presenter').
    let presenterWin = null;
    let bc = null;
    // Auditoria 2026 (cleanliness): _broadcast removida — wrapper definido mas
    // nunca usado; o presenter usa BroadcastChannel diretamente quando precisa.

    function open(index){
      slideIndex = index || 0;
      startTs = Date.now();
      // Tenta dual-window
      try {
        presenterWin = window.open('', 'solstice-presenter', 'width=900,height=600,popup=yes');
      } catch(_){ presenterWin = null; }
      if (presenterWin && !presenterWin.closed){
        _renderDualWindow();
        // Auditoria 2026 (MC-02): garante que não há intervalo anterior pendurado
        // antes de reatribuir o handle. Sem isso, abrir o apresentador 2× deixa
        // o primeiro intervalo órfão e _updateTimer dispara em duplicado.
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(_updateTimer, 1000);
        try {
          bc = new BroadcastChannel('solstice-presenter');
          bc.onmessage = (ev) => {
            if (!ev || !ev.data) return;
            if (ev.data.type === 'next') next();
            else if (ev.data.type === 'prev') prev();
            else if (ev.data.type === 'close') close();
          };
        } catch(_){ bc = null; }
        SolsticeToast.success('Apresentador aberto em nova janela', 'Notas e timer estão lá.');
        return;
      }
      // Fallback: overlay no mesmo monitor, mas avisa o usuário.
      SolsticeToast.warn('Pop-up bloqueado', 'Usando overlay no mesmo monitor. Permita pop-ups para janela separada.');
      _render();
      // Auditoria 2026 (MC-02): idem — limpa intervalo anterior antes de reatribuir.
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(_updateTimer, 1000);
    }

    function _renderDualWindow(){
      if (!presenterWin || presenterWin.closed) return;
      const sec = _sections()[slideIndex] || {};
      const nextSec = _sections()[slideIndex + 1];
      const css = `body{margin:0;font-family:system-ui,sans-serif;background:#0f1419;color:#eaf5ee;display:grid;grid-template-rows:auto 1fr auto;height:100vh;}
        h1{margin:24px;font-size:32px;}
        .notes{margin:0 24px;padding:16px;background:#1b232d;border-radius:8px;overflow:auto;}
        .footer{padding:16px 24px;display:flex;justify-content:space-between;align-items:center;background:#131a22;}
        .timer{font-family:monospace;font-size:24px;}
        .btn{background:#2dd4bf;color:#0f1419;border:0;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px;margin-right:8px;}`;
      // Auditoria 2026 (JM-01 / HV-01): escape unificado via SolsticeUtils.escapeHtml
      // para títulos e fallback de notas. Notas mantêm escape parcial (permite
      // <em>/</em> literais — é design intencional pra grifo nas notas do apresentador).
      const escTitle = (s) => SolsticeUtils.escapeHtml(String(s || ''));
      const escNotesAllowEm = (s) => String(s || '').replace(/<(?!em|\/em)/g, '&lt;');
      const titleSafe = escTitle(sec.title || ('Slide ' + (slideIndex+1)));
      const notesSafe = escNotesAllowEm(sec.notes || '<em style="opacity:.6">Sem notas para esta seção.</em>');
      const nextTitleSafe = nextSec ? escTitle(nextSec.title || '') : '';
      // Auditoria 2026.2 (MC-A2): elimina doc-write — único uso no arquivo.
      // Antes: doc.write injetava todo o HTML da janela secundária. Agora
      // construímos via DOM API (createElement) na janela existente; mesmo
      // comportamento + listener delegado em data-cmd para botões.
      const pdoc = presenterWin.document;
      try { pdoc.documentElement.setAttribute('lang', 'pt-BR'); } catch(_){}
      while (pdoc.documentElement.firstChild){
        pdoc.documentElement.removeChild(pdoc.documentElement.firstChild);
      }
      const headEl = pdoc.createElement('head');
      const charsetEl = pdoc.createElement('meta'); charsetEl.setAttribute('charset', 'utf-8');
      const titleEl = pdoc.createElement('title'); titleEl.textContent = 'Apresentador · Solstice';
      const styleEl = pdoc.createElement('style'); styleEl.textContent = css;
      headEl.append(charsetEl, titleEl, styleEl);
      const bodyEl = pdoc.createElement('body');
      const h1 = pdoc.createElement('h1'); h1.textContent = sec.title || ('Slide ' + (slideIndex+1));
      const notesDiv = pdoc.createElement('div'); notesDiv.className = 'notes';
      notesDiv.appendChild(pdoc.createTextNode('📝 '));
      const notesContent = pdoc.createElement('span');
      notesContent.innerHTML = notesSafe;  // já filtrado por escNotesAllowEm
      notesDiv.appendChild(notesContent);
      if (nextSec){
        const hr = pdoc.createElement('hr'); hr.style.opacity = '.2'; hr.style.margin = '16px 0';
        notesDiv.appendChild(hr);
        const strong = pdoc.createElement('strong'); strong.textContent = '⏭️ PRÓXIMA: ';
        notesDiv.appendChild(strong);
        notesDiv.appendChild(pdoc.createTextNode(nextSec.title || ''));
      }
      const footerEl = pdoc.createElement('div'); footerEl.className = 'footer';
      const navWrap = pdoc.createElement('div');
      const btnPrev = pdoc.createElement('button'); btnPrev.className = 'btn'; btnPrev.textContent = '← Anterior'; btnPrev.dataset.cmd = 'prev';
      const btnNext = pdoc.createElement('button'); btnNext.className = 'btn'; btnNext.textContent = 'Próximo →'; btnNext.dataset.cmd = 'next';
      navWrap.append(btnPrev, btnNext);
      const timerElP = pdoc.createElement('div'); timerElP.className = 'timer'; timerElP.id = 't'; timerElP.textContent = '00:00';
      const btnClose = pdoc.createElement('button'); btnClose.className = 'btn'; btnClose.textContent = '✕ Fechar'; btnClose.dataset.cmd = 'close';
      footerEl.append(navWrap, timerElP, btnClose);
      const scriptEl = pdoc.createElement('script');
      scriptEl.textContent =
        "(function(){\n" +
        "  var bc = new BroadcastChannel('solstice-presenter');\n" +
        "  var startTs = " + startTs + ";\n" +
        "  function tick(){\n" +
        "    var e = Math.floor((Date.now()-startTs)/1000);\n" +
        "    var mm = String(Math.floor(e/60)).padStart(2,'0');\n" +
        "    var ss = String(e%60).padStart(2,'0');\n" +
        "    var el = document.getElementById('t');\n" +
        "    if (el) el.textContent = mm+':'+ss;\n" +
        "  }\n" +
        "  window._solsticePresenterTimer = setInterval(tick, 1000);\n" +
        "  window.addEventListener('beforeunload', function(){\n" +
        "    if (window._solsticePresenterTimer){ clearInterval(window._solsticePresenterTimer); window._solsticePresenterTimer = null; }\n" +
        "    try { bc.close(); } catch(_){}\n" +
        "  });\n" +
        "  document.addEventListener('click', function(ev){\n" +
        "    var btn = ev.target && ev.target.closest && ev.target.closest('[data-cmd]');\n" +
        "    if (!btn) return;\n" +
        "    var cmd = btn.dataset.cmd;\n" +
        "    if (cmd === 'close'){ bc.postMessage({type:'close'}); window.close(); }\n" +
        "    else if (cmd === 'next' || cmd === 'prev'){ bc.postMessage({type:cmd}); }\n" +
        "  });\n" +
        "})();";
      bodyEl.append(h1, notesDiv, footerEl, scriptEl);
      pdoc.documentElement.append(headEl, bodyEl);
    }

    function close(){
      if (overlay){ overlay.remove(); overlay = null; }
      if (timerInterval){ clearInterval(timerInterval); timerInterval = null; }
      if (presenterWin && !presenterWin.closed){ try { presenterWin.close(); } catch(_){} }
      presenterWin = null;
      if (bc){ try { bc.close(); } catch(_){} bc = null; }
    }
    function next(){
      const secs = _sections();
      if (slideIndex < secs.length - 1){
        slideIndex++;
        if (presenterWin && !presenterWin.closed) _renderDualWindow();
        else _render();
      }
    }
    function prev(){
      if (slideIndex > 0){
        slideIndex--;
        if (presenterWin && !presenterWin.closed) _renderDualWindow();
        else _render();
      }
    }

    function _updateTimer(){
      const el = document.querySelector('.solstice__presenter-timer');
      if (!el) return;
      const elapsed = Math.floor((Date.now() - startTs) / 1000);
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      el.textContent = mm + ':' + ss;
    }

    function _render(){
      if (overlay) overlay.remove();
      const secs = _sections();
      if (!secs.length){ SolsticeToast.warn('Apresentador', 'Sem seções para apresentar.'); return; }
      const sec = secs[slideIndex];
      const nextSec = secs[slideIndex + 1];

      overlay = SolsticeUtils.el('div', { class:'solstice__presenter' });

      // Painel atual — só título e contagem de slots por agora
      const current = SolsticeUtils.el('div', { class:'solstice__presenter-current' });
      current.appendChild(SolsticeUtils.el('h2', { style:'font-family:var(--font-display);font-size:var(--fs-3xl);font-weight:var(--fw-bold);color:var(--c-text);margin-bottom:var(--sp-3);' },
        sec.title || ('Slide ' + (slideIndex + 1))));
      current.appendChild(SolsticeUtils.el('div', { style:'font-size:var(--fs-md);color:var(--c-muted);margin-bottom:var(--sp-4);' },
        sec.rows.length + ' linha(s) · ' +
        sec.rows.reduce((s, r) => s + r.slots.filter(sl => sl.type && sl.type !== 'empty').length, 0) +
        ' componente(s)'));
      // Slots resumidos
      sec.rows.forEach((row, ri) => {
        row.slots.forEach(slot => {
          if (!slot.type || slot.type === 'empty') return;
          const def = SolsticeComponents.get(slot.type);
          const tag = SolsticeUtils.el('div', { style:'background:var(--c-surface-2);border-radius:var(--rad-sm);padding:var(--sp-2) var(--sp-3);margin-bottom:6px;font-size:var(--fs-sm);' },
            (def ? def.icon : '🧩') + ' ' + (def ? def.name : slot.type));
          current.appendChild(tag);
        });
      });

      // Painel notas + preview
      const notes = SolsticeUtils.el('div', { class:'solstice__presenter-notes' });
      notes.appendChild(SolsticeUtils.el('div', { class:'solstice__presenter-notes-label' }, '📝 Notas'));
      const notesText = (sec.notes || '').trim() ||
        'Nenhuma nota para esta seção. Clique em "✏️ Editar notas" no modo Edit (B13) para adicionar.';
      notes.appendChild(SolsticeUtils.el('div', { class:'solstice__presenter-notes-text' }, notesText));
      if (nextSec){
        const preview = SolsticeUtils.el('div', { class:'solstice__presenter-preview' });
        preview.appendChild(SolsticeUtils.el('div', { class:'solstice__presenter-preview-label' }, '⏭️ PRÓXIMA'));
        preview.appendChild(SolsticeUtils.el('div', { class:'solstice__presenter-preview-title' }, nextSec.title || ('Slide ' + (slideIndex + 2))));
        notes.appendChild(preview);
      }

      // Footer com nav + timer
      const footer = SolsticeUtils.el('div', { class:'solstice__presenter-footer' });
      const nav = SolsticeUtils.el('div', { style:'display:flex;gap:var(--sp-2);align-items:center;' });
      nav.appendChild(SolsticeUtils.el('button', { class:'solstice__btn', onclick: prev, disabled: slideIndex === 0 ? '' : null }, '← Anterior'));
      nav.appendChild(SolsticeUtils.el('span', { style:'font-family:var(--font-mono);font-size:var(--fs-sm);color:var(--c-muted);' },
        (slideIndex + 1) + ' / ' + secs.length));
      nav.appendChild(SolsticeUtils.el('button', { class:'solstice__btn', onclick: next, disabled: slideIndex === secs.length - 1 ? '' : null }, 'Próximo →'));
      footer.appendChild(nav);
      footer.appendChild(SolsticeUtils.el('div', { class:'solstice__presenter-timer' }, '00:00'));
      footer.appendChild(SolsticeUtils.el('button', { class:'solstice__btn', onclick: close }, '✕ Fechar'));

      overlay.append(current, notes, footer);
      document.body.appendChild(overlay);
    }

    function init(){
      document.addEventListener('keydown', (e) => {
        if (!overlay) return;
        if (e.key === 'ArrowRight'){ e.preventDefault(); next(); }
        else if (e.key === 'ArrowLeft'){ e.preventDefault(); prev(); }
        else if (e.key === 'Escape'){ e.preventDefault(); close(); }
      });
    }

    return { open, close, next, prev, init };
  })();
