
  /* ============================================================
     Patch 1B (ADR-125) — SolsticeHints
     Dicas progressivas dispensáveis. Substituem Tour bloqueante para
     onboarding suave. Persistem dismissal em sessionStorage (1 sessão)
     e via localStorage para desabilitar totalmente.
     ============================================================ */
  const SolsticeHints = (function(){
    const DISABLE_KEY = 'solstice.hints.disabled';
    const SEEN_PREFIX = 'solstice.hint.seen.';

    const HINTS = [
      { id:'h1_import',  selector:'.solstice__btn--primary',
        text:'💡 Comece importando um CSV ou clique em "Carregar exemplo".',
        trigger: () => !SolsticeStore.get('dataset.ready'),
        position:'bottom', delay: 1000 },
      { id:'h2_query',   selector:'.solstice__welcome-input',
        text:'💬 Você pode fazer perguntas em português sobre seus dados aqui.',
        trigger: () => !SolsticeStore.get('dataset.ready'),
        position:'bottom', delay: 2500 },
      { id:'h3_autodash', selector:'.solstice__canvas-toolbar button[title*="Auto-Dashboard"]',
        text:'🪄 Ou clique aqui para gerar um dashboard automaticamente.',
        trigger: () => SolsticeStore.get('dataset.ready'),
        position:'bottom', delay: 1500 }
    ];

    function _seenKey(id){ return SEEN_PREFIX + id; }

    function _createTooltip(text, anchor, position){
      const rect = anchor.getBoundingClientRect();
      const tip = SolsticeUtils.el('div', {
        class:'solstice__hint-tooltip',
        role:'status'
      });
      tip.appendChild(SolsticeUtils.el('div', { style:'padding-right:18px;' }, text));
      const close = SolsticeUtils.el('button', {
        class:'dismiss-btn', 'aria-label':'Dispensar',
        style:'position:absolute;top:4px;right:4px;background:none;border:none;color:#fff;cursor:pointer;font-size:14px;line-height:1;padding:2px 6px;'
      }, '✕');
      tip.appendChild(close);
      // Posiciona conforme position (bottom/top/right/left)
      let top, left;
      if (position === 'top'){
        top = rect.top - 12; left = rect.left + rect.width / 2;
        tip.style.transform = 'translate(-50%, -100%)';
      } else if (position === 'right'){
        top = rect.top + rect.height / 2; left = rect.right + 12;
        tip.style.transform = 'translate(0, -50%)';
      } else if (position === 'left'){
        top = rect.top + rect.height / 2; left = rect.left - 12;
        tip.style.transform = 'translate(-100%, -50%)';
      } else { // bottom default
        top = rect.bottom + 12; left = rect.left + rect.width / 2;
        tip.style.transform = 'translate(-50%, 0)';
      }
      tip.style.position = 'fixed';
      tip.style.top = top + 'px';
      tip.style.left = left + 'px';
      // Sprint 36c / EV-DOM-02: clamp pro viewport DEPOIS de inserir no DOM
      // Antes: transform translate(-50%) podia empurrar tooltip pra esquerda
      // do viewport quando anchor estava perto da borda esquerda. Texto
      // ficava cortado tipo "ara gerar um camente." (Sprint 35 evidência).
      // Agora: setTimeout(0) pra medir bounding após render, e se ultrapassa
      // viewport, troca transform por posição absoluta clamped.
      setTimeout(() => {
        try {
          const tr = tip.getBoundingClientRect();
          const vw = window.innerWidth;
          const margin = 8;
          if (tr.left < margin){
            // tooltip extravasou pela esquerda — reposiciona pra dentro
            tip.style.transform = 'translate(0, ' + (position === 'top' ? '-100%' : '0') + ')';
            tip.style.left = margin + 'px';
          } else if (tr.right > vw - margin){
            // extravasou pela direita
            tip.style.transform = 'translate(-100%, ' + (position === 'top' ? '-100%' : '0') + ')';
            tip.style.left = (vw - margin) + 'px';
          }
        } catch(_){}
      }, 0);
      return { tip, closeBtn: close };
    }

    function show(hintId){
      const hint = HINTS.find(h => h.id === hintId);
      if (!hint) return;
      const anchor = document.querySelector(hint.selector);
      if (!anchor) return;
      const { tip, closeBtn } = _createTooltip(hint.text, anchor, hint.position || 'bottom');
      document.body.appendChild(tip);
      let autoTimer;
      const dismiss = () => {
        clearTimeout(autoTimer);
        tip.remove();
        try { sessionStorage.setItem(_seenKey(hintId), '1'); } catch(e){}
      };
      closeBtn.addEventListener('click', dismiss);
      autoTimer = setTimeout(dismiss, 12000);
    }

    function checkAndShow(){
      try {
        if (localStorage.getItem(DISABLE_KEY) === 'true') return;
      } catch(e){}
      for (const h of HINTS){
        let seen = false;
        try { seen = !!sessionStorage.getItem(_seenKey(h.id)); } catch(e){}
        if (h.trigger() && !seen){
          setTimeout(() => show(h.id), h.delay || 500);
          return; // mostra UMA por vez
        }
      }
    }

    function dismissAll(){
      // Auditoria 2026 (AP-02): silent — flag de "não mostrar hints", baixo impacto.
      SolsticeStorage.safeSet(DISABLE_KEY, 'true', { silent: true });
    }
    function reset(){
      SolsticeStorage.safeRemove(DISABLE_KEY);
      try { HINTS.forEach(h => sessionStorage.removeItem(_seenKey(h.id))); } catch(e){}
    }

    return { show, checkAndShow, dismissAll, reset, HINTS };
  })();
