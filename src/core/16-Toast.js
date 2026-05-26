
  /* ============================================================
     SolsticeToast — notificações leves (não-modal)
     ============================================================ */
  const SolsticeToast = (function(){
    const container = () => document.getElementById('toasts');

    // Auditoria 2026.6 (TOAST-CAP): limita toasts simultâneos. Antes empilhavam
    // sem teto, cobrindo a tela e o botão de ajuda no mesmo canto. Mantém os N
    // mais recentes, removendo os mais antigos.
    const MAX_TOASTS = 3;
    function _capStack(c){
      const all = c.querySelectorAll('.solstice__toast');
      for (let i = 0; i <= all.length - MAX_TOASTS; i++) all[i].remove();
    }

    function show({ title, msg, kind='', duration=3500 }){
      const c = container();
      if (!c) return;
      _capStack(c);
      // Auditoria 2026 (R-06 / A-606): cada toast tem role="status" e
      // aria-atomic="true" (WCAG 4.1.3). Erros usam aria-live="assertive"
      // para anúncio imediato; restante herda do container ("polite").
      const t = SolsticeUtils.el('div',
        { class: 'solstice__toast' + (kind ? ' solstice__toast--'+kind : ''),
          role: 'status', 'aria-atomic': 'true',
          'aria-live': (kind === 'error' ? 'assertive' : 'polite') },
        SolsticeUtils.el('div', null, kind==='success'?'✓':kind==='warn'?'⚠️':kind==='error'?'❌':'ℹ️'),
        SolsticeUtils.el('div', { class: 'solstice__toast-body' },
          SolsticeUtils.el('div', { class: 'solstice__toast-title' }, title),
          msg && SolsticeUtils.el('div', { class: 'solstice__toast-msg' }, msg)
        )
      );
      c.appendChild(t);
      setTimeout(() => {
        t.style.transition = 'opacity .25s ease, transform .25s ease';
        t.style.opacity = '0'; t.style.transform = 'translateX(20px)';
        setTimeout(() => t.remove(), 250);
      }, duration);
    }

    /**
     * Toast com botão de ação inline (Patch B5-r3).
     * action({ title, msg?, actionLabel, actionFn, kind?, duration? })
     */
    function action(opts){
      const c = container();
      if (!c) return;
      _capStack(c);
      // Auditoria 2026 (R-06 / A-606): mesmas regras a11y de show().
      const t = SolsticeUtils.el('div',
        { class: 'solstice__toast' + (opts.kind ? ' solstice__toast--' + opts.kind : ''),
          role: 'status', 'aria-atomic': 'true',
          'aria-live': (opts.kind === 'error' ? 'assertive' : 'polite') },
        SolsticeUtils.el('div', null, opts.kind === 'success' ? '✓' : opts.kind === 'warn' ? '⚠️' : opts.kind === 'error' ? '❌' : 'ℹ️'),
        SolsticeUtils.el('div', { class:'solstice__toast-body' },
          SolsticeUtils.el('div', { class:'solstice__toast-title' }, opts.title),
          opts.msg ? SolsticeUtils.el('div', { class:'solstice__toast-msg' }, opts.msg) : null
        )
      );
      const btn = SolsticeUtils.el('button', {
        class: 'solstice__toast-action',
        onclick: () => { try { opts.actionFn && opts.actionFn(); } catch(e){ console.error(e); } finally { dismiss(); } }
      }, opts.actionLabel || 'Desfazer');
      t.appendChild(btn);
      c.appendChild(t);

      const dur = opts.duration != null ? opts.duration : 5000;
      let dismissed = false;
      function dismiss(){
        if (dismissed) return; dismissed = true;
        t.style.transition = 'opacity .25s ease, transform .25s ease';
        t.style.opacity = '0'; t.style.transform = 'translateX(20px)';
        setTimeout(() => t.remove(), 250);
      }
      setTimeout(dismiss, dur);
    }

    return {
      show,
      success: (t,m) => show({title:t,msg:m,kind:'success'}),
      warn:    (t,m) => show({title:t,msg:m,kind:'warn'}),
      error:   (t,m) => show({title:t,msg:m,kind:'error'}),
      info:    (t,m) => show({title:t,msg:m}),
      action
    };
  })();
