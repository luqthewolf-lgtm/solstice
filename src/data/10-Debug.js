
  /* ============================================================
     SolsticeDebug — Ctrl+Shift+D
     Inspector visual com 3 abas: state · locale · perf
     ============================================================ */
  const SolsticeDebug = (function(){
    let overlay = null;
    let activeTab = 'state';
    let timer = null;

    function toggle(){
      if (overlay) close();
      else open();
    }

    function open(){
      overlay = SolsticeUtils.el('div', { class: 'solstice__debug' });
      const head = SolsticeUtils.el('div', { class: 'solstice__debug-head' },
        SolsticeUtils.el('div', { class: 'solstice__debug-title' }, '🐛 Solstice Debug · Ctrl+Shift+D'),
        SolsticeUtils.el('button', { class: 'solstice__modal-close', onclick: close, style:{color:'#8C99B8'} }, '✕')
      );
      const tabs = SolsticeUtils.el('div', { class: 'solstice__debug-tabs' });
      ['state','locale','perf'].forEach(t => {
        tabs.appendChild(SolsticeUtils.el('div',
          { class: 'solstice__debug-tab' + (t===activeTab ? ' is-active' : ''), onclick: () => { activeTab = t; render(); } },
          t.toUpperCase()
        ));
      });
      const body = SolsticeUtils.el('div', { class: 'solstice__debug-body' });
      overlay.append(head, tabs, body);
      document.body.appendChild(overlay);
      render();
      // Auditoria 2026 (MC-02): defesa em profundidade — close() já limpa,
      // mas se open() for chamado em duplicado por algum caminho de erro,
      // o intervalo anterior ficaria órfão.
      if (timer) clearInterval(timer);
      timer = setInterval(render, 800);
    }

    function close(){
      if (timer) clearInterval(timer);
      timer = null;
      if (overlay) { overlay.remove(); overlay = null; }
    }

    function render(){
      if (!overlay) return;
      const body = overlay.querySelector('.solstice__debug-body');
      const tabs = overlay.querySelector('.solstice__debug-tabs');
      SolsticeUtils.qsa('.solstice__debug-tab', tabs).forEach((el,i) => {
        el.classList.toggle('is-active', ['state','locale','perf'][i] === activeTab);
      });
      // Auditoria 2026 (MC-01): cleanup defensivo — render() é chamado a cada 800ms
      // pelo setInterval do open(); listeners trackeados no body seriam o cenário
      // clássico de acúmulo em sessão longa.
      SolsticeUtils.cleanupListeners(body);
      body.innerHTML = '';
      if (activeTab === 'state'){
        const state = SolsticeStore.dump();
        const pre = SolsticeUtils.el('pre', null, JSON.stringify(state, null, 2));
        body.appendChild(pre);
      } else if (activeTab === 'locale'){
        const kv = SolsticeUtils.el('div', { class: 'solstice__debug-kv' });
        const cur = SolsticeLocale.get();
        const pairs = [
          ['locale.current', cur],
          ['locale.supported', SolsticeLocale.listSupported().join(', ')],
          ['fmt.integer(1234567)', SolsticeLocale.integer(1234567)],
          ['fmt.decimal(1234.567, 2)', SolsticeLocale.decimal(1234.567, 2)],
          ['fmt.currency(1234.56)', SolsticeLocale.currency(1234.56)],
          ['fmt.percent(0.1234)', SolsticeLocale.percent(0.1234)],
          ['fmt.date(now)', SolsticeLocale.date(new Date())],
          ['fmt.datetime(now)', SolsticeLocale.datetime(new Date())]
        ];
        pairs.forEach(([k,v]) => {
          kv.appendChild(SolsticeUtils.el('span', null, k));
          kv.appendChild(SolsticeUtils.el('span', null, v));
        });
        body.appendChild(kv);
      } else if (activeTab === 'perf'){
        const kv = SolsticeUtils.el('div', { class: 'solstice__debug-kv' });
        const m = (performance.memory) || { usedJSHeapSize: NaN, totalJSHeapSize: NaN };
        const pairs = [
          ['user-agent', navigator.userAgent.slice(0, 60) + '…'],
          ['viewport', innerWidth + ' × ' + innerHeight],
          ['pixel-ratio', window.devicePixelRatio],
          ['profile.active', (SolsticeProfiles.current()||{}).name || '—'],
          ['profile.count', SolsticeProfiles.list().length],
          ['theme.mode', SolsticeTheme.get('mode')],
          ['theme.palette', SolsticeTheme.get('palette')],
          ['theme.density', SolsticeTheme.get('density')],
          ['store.subs', SolsticeStore._subs.size],
          ['dataset.rows', (SolsticeStore.get('dataset.rows')||[]).length],
          ['memory.usedJSHeap', m.usedJSHeapSize ? (m.usedJSHeapSize/1048576).toFixed(1)+' MB' : 'N/A'],
          ['uptime', ((performance.now()/1000).toFixed(1))+' s']
        ];
        pairs.forEach(([k,v]) => {
          kv.appendChild(SolsticeUtils.el('span', null, k));
          kv.appendChild(SolsticeUtils.el('span', null, String(v)));
        });
        body.appendChild(kv);
      }
    }

    function bindShortcut(){
      window.addEventListener('keydown', e => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')){
          e.preventDefault();
          toggle();
        }
      });
    }

    return { toggle, open, close, bindShortcut };
  })();
