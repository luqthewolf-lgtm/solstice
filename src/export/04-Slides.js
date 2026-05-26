
  /* ============================================================
     BLOCO 12 — SolsticeSlides (ADR-085)
     Modo Slides: cada section vira slide full-viewport com setas.
     Tecla F entra/sai. Esc sai. ← → navegam.
     ============================================================ */
  const SolsticeSlides = (function(){
    let overlay = null;
    let currentIndex = 0;

    function _sections(){ return SolsticeStore.get('canvas.sections') || []; }

    function enter(){
      if (overlay) return;
      currentIndex = 0;
      _render();
    }
    function exit(){
      if (overlay){ overlay.remove(); overlay = null; }
      // Garante voltar ao modo edit se vier daqui
      const app = document.querySelector('.solstice__app');
      if (app && app.getAttribute('data-mode') === 'slides'){
        SolsticeStore.set('ui.mode', 'edit');
        app.setAttribute('data-mode', 'edit');
      }
    }
    function next(){
      const secs = _sections();
      if (currentIndex < secs.length - 1){ currentIndex++; _render(); }
    }
    function prev(){
      if (currentIndex > 0){ currentIndex--; _render(); }
    }
    function goTo(i){
      const secs = _sections();
      currentIndex = Math.max(0, Math.min(secs.length - 1, i));
      _render();
    }

    function _render(){
      const secs = _sections();
      if (!secs.length){
        SolsticeToast.warn('Modo Slides', 'Crie ao menos uma seção no canvas primeiro.');
        SolsticeModes.set('edit');
        return;
      }
      if (overlay) overlay.remove();
      overlay = SolsticeUtils.el('div', { class:'solstice__slides-overlay' });

      const stage = SolsticeUtils.el('div', { class:'solstice__slides-stage' });
      const slide = SolsticeUtils.el('div', { class:'solstice__slide' });
      const sec = secs[currentIndex];

      slide.appendChild(SolsticeUtils.el('h1', { class:'solstice__slide-title' }, sec.title || ('Slide ' + (currentIndex + 1))));

      // Re-renderiza as rows do section dentro do slide
      // Reuso simplificado — copia o DOM gerado pelo Canvas
      sec.rows.forEach(row => {
        const rowEl = SolsticeUtils.el('div', {
          class: 'solstice__row',
          'data-layout': row.layout || '1col',
          style: row.widths ? ('grid-template-columns: ' + row.widths.map(w => w + 'fr').join(' ')) : ''
        });
        // Aplica o grid-template-columns inline via stylesheet
        const layoutMap = {
          '1col': '1fr',
          '2col-equal': '1fr 1fr',
          '2col-2-1': '2fr 1fr',
          '2col-1-2': '1fr 2fr',
          '3col-equal': '1fr 1fr 1fr',
          '3col-1-2-1': '1fr 2fr 1fr',
          '4col-equal': 'repeat(4, 1fr)'
        };
        rowEl.style.display = 'grid';
        rowEl.style.gridTemplateColumns = layoutMap[row.layout] || '1fr';
        rowEl.style.gap = 'var(--sp-4)';

        row.slots.forEach(slot => {
          if (!slot.type || slot.type === 'empty'){
            const ph = SolsticeUtils.el('div', { style:'background:var(--c-surface-2);border-radius:var(--rad-md);min-height:200px;display:flex;align-items:center;justify-content:center;color:var(--c-muted);font-size:var(--fs-sm);' }, '— vazio —');
            rowEl.appendChild(ph); return;
          }
          const host = SolsticeUtils.el('div', { class:'solstice__comp', 'data-comp-id': slot.id, 'data-comp-type': slot.type });
          const head = SolsticeUtils.el('div', { class:'solstice__comp-head' });
          const def = SolsticeComponents.get(slot.type);
          const ctx = (function(){
            const ingest = SolsticeStore.get('ingest');
            const allRows = (ingest && ingest.rows) || [];
            const rows = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.apply(allRows) : allRows;
            return { rows, rowsAll: allRows, columns: (ingest && ingest.columns) || [], types: (ingest && ingest.types) || {}, dictionary: SolsticeStore.get('dictionary'), L: SolsticeLocale };
          })();
          const dyn = def && typeof def.getTitle === 'function' ? def.getTitle(slot, ctx) : (def ? def.name : 'Componente');
          head.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-title' },
            (def ? def.icon : '🧩') + '  ' + dyn));
          host.appendChild(head);
          try { def && def.render(slot, host, ctx); } catch(e){ console.error('[Slides render]', e); }
          rowEl.appendChild(host);
        });
        slide.appendChild(rowEl);
      });

      stage.appendChild(slide);
      overlay.appendChild(stage);

      // Barra inferior
      const bar = SolsticeUtils.el('div', { class:'solstice__slides-bar' });
      const nav = SolsticeUtils.el('div', { class:'solstice__slides-nav' });
      nav.appendChild(SolsticeUtils.el('button', { class:'solstice__btn', 'aria-label':'Slide anterior', title:'Anterior (←)', onclick: prev, disabled: currentIndex === 0 ? '' : null }, '←'));
      nav.appendChild(SolsticeUtils.el('span', { class:'solstice__slides-counter' }, (currentIndex + 1) + ' / ' + secs.length));
      nav.appendChild(SolsticeUtils.el('button', { class:'solstice__btn', 'aria-label':'Próximo slide', title:'Próximo (→)', onclick: next, disabled: currentIndex === secs.length - 1 ? '' : null }, '→'));
      bar.appendChild(nav);

      const progress = SolsticeUtils.el('div', { class:'solstice__slides-progress' });
      const fill = SolsticeUtils.el('div', { class:'solstice__slides-progress-fill',
        style: 'width:' + (((currentIndex + 1) / secs.length) * 100) + '%' });
      progress.appendChild(fill);
      bar.appendChild(progress);

      const right = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:var(--sp-3);' });
      right.appendChild(SolsticeUtils.el('button', { class:'solstice__btn',
        title:'Modo Apresentador (notas + timer)',
        onclick: () => SolsticePresenter.open(currentIndex)
      }, '🎤 Apresentador'));
      right.appendChild(SolsticeUtils.el('span', { class:'solstice__slides-help' },
        '← → navegar · Esc sair · A apresentador'));
      right.appendChild(SolsticeUtils.el('button', { class:'solstice__btn',
        title:'Sair (Esc)',
        onclick: () => SolsticeModes.set('edit')
      }, '✕'));
      bar.appendChild(right);

      overlay.appendChild(bar);
      document.body.appendChild(overlay);
    }

    function init(){
      document.addEventListener('keydown', (e) => {
        // F entra em slides quando estiver em edit/analyze
        if (e.key === 'f' || e.key === 'F'){
          const tag = e.target && e.target.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA') return;
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (document.querySelector('.solstice__modal-overlay')) return;
          if (SolsticeModes.current() !== 'slides'){
            e.preventDefault();
            SolsticeModes.set('slides');
          }
        }
        if (SolsticeModes.current() !== 'slides') return;
        if (e.key === 'ArrowRight' || e.key === ' '){ e.preventDefault(); next(); }
        else if (e.key === 'ArrowLeft'){ e.preventDefault(); prev(); }
        else if (e.key === 'Escape'){ e.preventDefault(); SolsticeModes.set('edit'); }
        else if (e.key === 'a' || e.key === 'A'){ e.preventDefault(); SolsticePresenter.open(currentIndex); }
      });
    }

    return { enter, exit, next, prev, goTo, init, _render };
  })();
