
  /* ============================================================
     B7-r2 — Helper createAccordion (ADR-064)
     Cria uma seção accordion reutilizável. Persiste estado aberto/
     fechado por `key` em Store.ui.accordion.<key>.
     Usado pelo Inspector e pelo Catálogo de Componentes.
     ============================================================ */
  function createAccordion(opts){
    opts = opts || {};
    const icon = opts.icon || '';
    const title = opts.title || '';
    const key = opts.key || ('acc-' + String(title).toLowerCase().replace(/\s+/g, '-'));
    const buildFn = opts.build;
    const count = opts.count;
    // Estado persistido: lê do Store; default = openByDefault (true)
    const stored = SolsticeStore.get('ui.accordion.' + key);
    const isOpen = (stored == null) ? (opts.openByDefault !== false) : !!stored;

    const section = SolsticeUtils.el('div', {
      class: 'solstice__accord' + (isOpen ? ' is-open' : ''),
      'data-accord-key': key
    });

    const head = SolsticeUtils.el('div', {
      class: 'solstice__accord-head',
      onclick: () => {
        const nowOpen = !section.classList.contains('is-open');
        section.classList.toggle('is-open', nowOpen);
        SolsticeStore.set('ui.accordion.' + key, nowOpen);
      }
    });
    const label = SolsticeUtils.el('div', { class:'solstice__accord-head-label' });
    if (icon) label.appendChild(SolsticeUtils.el('span', null, icon));
    label.appendChild(SolsticeUtils.el('span', null, title));
    if (count != null){
      label.appendChild(SolsticeUtils.el('span', { class:'solstice__accord-head-count' }, '(' + count + ')'));
    }
    head.appendChild(label);
    head.appendChild(SolsticeUtils.el('span', { class:'solstice__accord-chevron' }, '▶'));

    const body = SolsticeUtils.el('div', { class:'solstice__accord-body' });
    if (typeof buildFn === 'function'){
      try { buildFn(body); } catch (e){ console.error('[createAccordion] build error:', e); }
    }

    section.append(head, body);
    return section;
  }

  /* ============================================================
     B7-r2 — SolsticeInspector (ADR-063)
     Gerencia abertura/fechamento do painel lateral direito.
     Não conhece conteúdo: apenas controla a classe .has-inspector
     no app root, o título do header e a chamada para preencher body.
     Conteúdo é responsabilidade de SolsticeProps.renderInspector.
     ============================================================ */
  const SolsticeInspector = (function(){
    const app   = () => document.querySelector('.solstice__app');
    const title = () => document.getElementById('inspector-title');
    const body  = () => document.getElementById('inspector-body');
    const foot  = () => document.getElementById('inspector-footer');

    function open(){
      // ADR-160 (Onda 1 / T8a): "open-one-closes-other" — Inspector e Analysis
      // drawer não convivem espremendo o canvas. Analysis usa drawer absolute
      // sobre o canvas; fecha quando Inspector abre.
      if (typeof SolsticeAnalysis !== 'undefined' && SolsticeAnalysis.isOpen && SolsticeAnalysis.isOpen()){
        SolsticeAnalysis.close();
      }
      const a = app(); if (a) a.classList.add('has-inspector');
      // Fase 7A: ativa a aba "Inspector" da sidebar. O conteúdo (preenchido
      // por SolsticeProps.renderInspector) aparece DENTRO da sidebar, não
      // mais como coluna à direita.
      if (typeof SolsticeSidebarTabs !== 'undefined' && SolsticeSidebarTabs.activate){
        try { SolsticeSidebarTabs.activate('inspector'); } catch(_){}
      }
      // Polish 14: badge no tab Inspector ("●") indica que tem props pra ver,
      // mesmo se o user trocar de aba. Some quando o user deseleciona.
      const badge = document.getElementById('badge-inspector');
      if (badge){
        badge.textContent = '●';
        badge.classList.remove('solstice__hidden');
      }
      SolsticeStore.set('ui.inspector.open', true);
    }
    function close(){
      const a = app(); if (a) a.classList.remove('has-inspector');
      const b = body(); if (b) b.innerHTML = '';
      const f = foot(); if (f){ f.innerHTML = ''; f.hidden = true; }
      // Sinaliza ao Props para deselecionar (sem loop: Props.deselect chama close→este flag)
      if (SolsticeProps && SolsticeProps.deselect){
        SolsticeProps.deselect({ skipInspector: true });
      }
      // Fase 7A: ao fechar, volta pra aba "Dados" (default). User pode
      // estar olhando outras abas sem querer ter sido jogado em Inspector.
      if (typeof SolsticeSidebarTabs !== 'undefined' && SolsticeSidebarTabs.activate){
        try { SolsticeSidebarTabs.activate('dados'); } catch(_){}
      }
      // Polish 14: remove o badge de "●" do tab Inspector ao deselecionar
      const badge = document.getElementById('badge-inspector');
      if (badge){
        badge.textContent = '';
        badge.classList.add('solstice__hidden');
      }
      SolsticeStore.set('ui.inspector.open', false);
      SolsticeStore.set('ui.inspector.slotId', null);
    }
    function setTitle(iconText, label){
      const t = title();
      if (!t) return;
      t.innerHTML = '';
      t.appendChild(SolsticeUtils.el('span', { class:'solstice__inspector-title-icon' }, iconText || '⚙️'));
      t.appendChild(SolsticeUtils.el('span', null, label || 'Propriedades'));
    }
    function setFooter(buttonEl){
      const f = foot();
      if (!f) return;
      f.innerHTML = '';
      if (buttonEl){ f.appendChild(buttonEl); f.hidden = false; }
      else f.hidden = true;
    }
    function getBody(){ return body(); }
    function isOpen(){
      const a = app();
      return a ? a.classList.contains('has-inspector') : false;
    }
    function init(){
      const closeBtn = document.getElementById('inspector-close');
      if (closeBtn) closeBtn.addEventListener('click', close);
    }
    return { open, close, setTitle, setFooter, getBody, isOpen, init };
  })();
