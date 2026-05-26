
  /* ============================================================
     SolsticeOnboarding — 3 slides
     ============================================================ */
  const SolsticeOnboarding = (function(){
    const KEY = 'solstice.onboarding.done';

    function isFirstTime(){
      try { return !localStorage.getItem(KEY); } catch(e){ return true; }
    }
    function markDone(){
      // Auditoria 2026 (AP-02): flag binária de "já fez onboarding" — silent,
      // se falhar o pior que acontece é repetir o onboarding na próxima visita.
      SolsticeStorage.safeSet(KEY, '1', { silent: true });
    }
    /** ADR-179 (Fix-11 v5.5): reset pra usuário "refazer o tour".
     *  Lucas (re-auditoria P5 Camila): "pra reabrir, não há entrada óbvia". */
    function reset(){
      try { localStorage.removeItem(KEY); } catch(e){}
      show();
    }

    function show(){
      const slides = [
        { key:'onb.1' },
        { key:'onb.2' },
        { key:'onb.3' }
      ];
      let idx = 0;

      // Auditoria 2026.4 (Sprint 13a / A11y-02): role=dialog para onboarding
      const titleId = 'solstice-onb-title-' + Math.random().toString(36).slice(2, 8);
      const overlay = SolsticeUtils.el('div', {
        class: 'solstice__modal-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId
      });
      const modal   = SolsticeUtils.el('div', { class: 'solstice__modal' });

      const body = SolsticeUtils.el('div', { class: 'solstice__modal-body' });
      const content = SolsticeUtils.el('div', { class: 'solstice__onb' });
      const icon = SolsticeUtils.el('div', { class: 'solstice__onb-icon' }, '🌗');
      const title = SolsticeUtils.el('div', { class: 'solstice__onb-title', id: titleId });
      const text = SolsticeUtils.el('div', { class: 'solstice__onb-text' });
      content.append(icon, title, text);

      const dots = SolsticeUtils.el('div', { class: 'solstice__onb-dots' });
      slides.forEach((_, i) => dots.appendChild(SolsticeUtils.el('div', { class: 'solstice__onb-dot' + (i===idx?' is-active':'') })));
      content.appendChild(dots);
      body.appendChild(content);

      function render(){
        const s = slides[idx];
        title.textContent = SolsticeLocale.t(s.key + '.title');
        text.textContent  = SolsticeLocale.t(s.key + '.text');
        SolsticeUtils.qsa('.solstice__onb-dot', dots).forEach((d,i) => d.classList.toggle('is-active', i===idx));
        next.textContent = idx === slides.length-1 ? SolsticeLocale.t('onb.start') : SolsticeLocale.t('onb.next');
      }

      const skip = SolsticeUtils.el('button', { class: 'solstice__btn', onclick: close }, SolsticeLocale.t('onb.skip'));
      const next = SolsticeUtils.el('button', { class: 'solstice__btn solstice__btn--primary', onclick: () => {
        if (idx === slides.length - 1) close();
        else { idx++; render(); }
      }});

      modal.appendChild(body);
      modal.appendChild(SolsticeUtils.el('div', { class: 'solstice__modal-footer' }, skip, next));
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      function close(){ markDone(); overlay.remove(); }
      render();
    }

    return { show, isFirstTime, markDone, reset };
  })();
