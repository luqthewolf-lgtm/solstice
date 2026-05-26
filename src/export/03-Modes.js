
  /* ============================================================
     BLOCO 12 — SolsticeModes (ADR-084)
     5 modos: edit · analyze · review · present · slides.
     Controla via data-mode no .solstice__app.
     ============================================================ */
  const SolsticeModes = (function(){

    // Auditoria 2026 (M-O-1 / A-504): descrições reescritas para que
    // alguém de fora entenda o que cada modo faz sem precisar testar.
    // Antes: "Modo padrão de edição" / "Comentários (B13)" — abstrato.
    const MODES = [
      { id: 'edit',    icon: '✏️', name: 'Edit',      desc: 'Criar e ajustar componentes — modo padrão para montar o dashboard', kbd: '' },
      { id: 'analyze', icon: '🔬', name: 'Analyze',   desc: 'Explorar os dados sem alterar o layout — drill-down e estatísticas em foco', kbd: '' },
      { id: 'review',  icon: '💬', name: 'Review',    desc: 'Conferir e comentar — threads de comentários ativos, edição congelada', kbd: '' },
      { id: 'present', icon: '🖥️', name: 'Present',   desc: 'Tela limpa para apresentação local — sem painéis nem botões de edição', kbd: '' },
      { id: 'slides',  icon: '🎬', name: 'Slides',    desc: 'Apresentação em telas grandes — cada seção vira um slide; F entra', kbd: 'F' }
    ];

    function current(){ return SolsticeStore.get('ui.mode') || 'edit'; }

    function set(mode){
      const valid = MODES.find(m => m.id === mode);
      if (!valid){ SolsticeLog.warn('[Modes] modo inválido:', mode); return; }
      // Saindo de slides ou present → restaura UI
      const prev = current();
      if (prev === 'slides') SolsticeSlides.exit();
      const app = document.querySelector('.solstice__app');
      if (app) app.setAttribute('data-mode', mode);
      SolsticeStore.set('ui.mode', mode);
      if (mode === 'slides') SolsticeSlides.enter();
      SolsticeAudit.record({ action:'mode_change', details:{ from: prev, to: mode } });
    }

    function cycle(){
      const ids = MODES.map(m => m.id);
      const i = ids.indexOf(current());
      set(ids[(i + 1) % ids.length]);
    }

    function list(){ return MODES.slice(); }

    /** Cria o dropdown "Modo" no header. */
    function _renderDropdown(){
      const wrap = SolsticeUtils.el('div', { class:'solstice__mode-dropdown' });
      const trigger = SolsticeUtils.el('button', {
        class:'solstice__mode-trigger',
        'aria-label': 'Modo atual — clique para trocar',
        title: 'Modo atual — clique para trocar'
      });
      // ADR-160 (Onda 1 / T8b): mapeamento modo→cor (lê do CSS var atual)
      // resolvido via JS pra evitar problemas de cascade de [data-mode] em
      // descendentes (não fazia override consistente em headless/embed).
      const MODE_TOKEN = {
        edit:    '--c-text-2',
        analyze: '--c-info',
        review:  '--c-warn',
        present: '--c-success',
        slides:  '--c-accent'
      };
      function refreshTrigger(){
        const m = MODES.find(x => x.id === current()) || MODES[0];
        trigger.innerHTML = '';
        trigger.appendChild(SolsticeUtils.el('span', null, m.icon));
        trigger.appendChild(SolsticeUtils.el('span', null, m.name));
        trigger.appendChild(SolsticeUtils.el('span', { style:'font-size:10px;color:var(--c-muted);' }, '▼'));
        // Aplica cor do modo via inline style (border lateral + bg sutil)
        const tokenName = MODE_TOKEN[m.id] || '--c-text-2';
        const root = document.documentElement;
        const color = getComputedStyle(root).getPropertyValue(tokenName).trim();
        if (color){
          trigger.style.borderLeftColor = color;
          // bg sutil 12% — usa color-mix se disponível, senão deixa o base
          trigger.style.background = 'color-mix(in srgb, ' + color + ' 12%, var(--c-surface-2))';
        }
        trigger.setAttribute('data-active-mode', m.id);
      }
      refreshTrigger();
      // ADR-160: refresh quando modo muda via API/atalho (não só via dropdown)
      SolsticeStore.subscribe('ui.mode', refreshTrigger);
      let panel = null;
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panel){ panel.remove(); panel = null; return; }
        panel = SolsticeUtils.el('div', { class:'solstice__mode-panel' });
        MODES.forEach(m => {
          const opt = SolsticeUtils.el('div', {
            class:'solstice__mode-option' + (current() === m.id ? ' is-active' : ''),
            onclick: () => { set(m.id); panel.remove(); panel = null; refreshTrigger(); }
          });
          opt.appendChild(SolsticeUtils.el('span', { class:'solstice__mode-option-icon' }, m.icon));
          const body = SolsticeUtils.el('div', { class:'solstice__mode-option-body' });
          body.appendChild(SolsticeUtils.el('div', { class:'solstice__mode-option-name' }, m.name));
          body.appendChild(SolsticeUtils.el('div', { class:'solstice__mode-option-desc' }, m.desc));
          opt.appendChild(body);
          if (m.kbd) opt.appendChild(SolsticeUtils.el('span', { class:'solstice__mode-option-kbd' }, m.kbd));
          panel.appendChild(opt);
        });
        wrap.appendChild(panel);
        // Fecha ao clicar fora — Auditoria 2026 (MC-01 / HV-02): trackListener
        // com o painel como host. Limpeza via cleanupListeners no fechar.
        setTimeout(() => {
          if (!panel) return;
          SolsticeUtils.trackListener(panel, document, 'click', function close(ev){
            if (panel && !wrap.contains(ev.target)){
              SolsticeUtils.cleanupListeners(panel);
              panel.remove();
              panel = null;
            }
          });
        }, 0);
      });
      wrap.appendChild(trigger);
      return wrap;
    }

    function init(){
      const app = document.querySelector('.solstice__app');
      if (app) app.setAttribute('data-mode', current());
      // Insere dropdown no header antes do botão de tema.
      // Camada 1 D2 (ADR-159): theme-toggle agora vive dentro de um
      // .solstice__toolbar-group (grupo "Aparência") — não é mais child direto
      // de .solstice__header-actions. Usar themeToggle.parentNode garante
      // que o insertBefore funcione independentemente da estrutura HTML.
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle && themeToggle.parentNode){
        const dd = _renderDropdown();
        themeToggle.parentNode.insertBefore(dd, themeToggle);
      }
    }

    // Auditoria 2026 (RT-03): adapter pra cumprir SolsticeStoreContract.
    // get() devolve modo atual; current() é o nome legado preservado.
    function get(){ return current(); }
    function subscribe(_path, cb){ return SolsticeStore.subscribe('ui.mode', cb); }
    return { set, get, current, cycle, subscribe, list, init, MODES };
  })();
