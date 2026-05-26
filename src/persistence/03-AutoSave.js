
  /* ============================================================
     B4-02 (v6-autonomous / RES-03 — Sofia/Auth0) — SolsticeAutoSave
     Auto-save de estado em localStorage pra recuperação após crash/
     refresh acidental. Diferente de SolsticeSnapshots:
       • Roda silenciosamente em intervalos
       • 1 slot único (sempre sobrescreve o anterior)
       • NÃO substitui snapshots manuais — é safety net
       • Restaura no boot SE último estado for de hoje
         (estado antigo é stale — usuário esquece)

     Salva:
       • canvas.sections (estrutura de componentes)
       • canvas.header (título)
       • filters globais
       • página ativa multi-page

     Não salva:
       • ingest (dataset bruto — pode ser MB)
       • dictionary (presets pré-carregados)
     ============================================================ */
  const SolsticeAutoSave = (function(){
    const STORAGE_KEY = 'solstice.autosave.v1';
    const INTERVAL_MS = (typeof SolsticeConfig !== 'undefined') ? SolsticeConfig.AUTOSAVE_INTERVAL_MS : 5000;
    const STALE_MS = 24 * 60 * 60 * 1000; // 24h — estado mais antigo é descartado
    let _timer = null;
    let _lastSnapshot = '';

    function _capture(){
      try {
        const snap = {
          ts: Date.now(),
          sections: SolsticeStore.get('canvas.sections') || [],
          header: SolsticeStore.get('canvas.header') || null,
          filters: SolsticeStore.get('filters') || {},
          pageId: (typeof SolsticePages !== 'undefined' && SolsticePages.activeId) ? SolsticePages.activeId() : null
        };
        return snap;
      } catch(_){ return null; }
    }

    function _tick(){
      const snap = _capture();
      if (!snap) return;
      // Só salva se tem algo (não persiste estado vazio)
      if (!snap.sections.length) return;
      const json = JSON.stringify(snap);
      // Evita escrita se nada mudou (poupa I/O)
      if (json === _lastSnapshot) return;
      _lastSnapshot = json;
      try {
        if (typeof SolsticeStorage !== 'undefined' && SolsticeStorage.safeSet){
          SolsticeStorage.safeSet(STORAGE_KEY, json, { silent: true });
        } else {
          localStorage.setItem(STORAGE_KEY, json);
        }
      } catch(_){}
    }

    function _read(){
      try {
        const raw = (typeof SolsticeStorage !== 'undefined' && SolsticeStorage.safeGet)
          ? SolsticeStorage.safeGet(STORAGE_KEY)
          : localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Descarta se velho demais
        if (parsed.ts && (Date.now() - parsed.ts) > STALE_MS) return null;
        return parsed;
      } catch(_){ return null; }
    }

    /**
     * Auditoria 2026.3 (BR-A5 / ADR-187): em vez de restaurar silenciosamente,
     * mostra banner não-modal no topo do canvas com "Restaurar / Começar do zero".
     * Sem ação em 10s = descarta (padrão = não restaura, segue welcome).
     * Reduz surpresa quando o usuário recarrega esperando estado fresco.
     */
    function tryRestore(){
      const snap = _read();
      if (!snap || !snap.sections || !snap.sections.length) return false;
      const current = SolsticeStore.get('canvas.sections') || [];
      if (current.length > 0) return false; // não sobrescreve trabalho ativo
      _showRestoreBanner(snap);
      return true;
    }

    /** Auditoria 2026.3 (BR-A6): formata tempo decorrido em copy humana. */
    function _humanAge(ms){
      if (typeof SolsticeHumanize !== 'undefined' && SolsticeHumanize.timeAgo){
        try { return SolsticeHumanize.timeAgo(ms); } catch(_){}
      }
      const s = Math.round(ms / 1000);
      if (s < 60) return s + 's atrás';
      const m = Math.round(s / 60);
      if (m < 60) return m + ' min atrás';
      const h = Math.round(m / 60);
      if (h < 24) return h + 'h atrás';
      return Math.round(h / 24) + ' dias atrás';
    }

    function _doRestore(snap){
      try {
        SolsticeStore.set('canvas.sections', snap.sections);
        if (snap.header) SolsticeStore.set('canvas.header', snap.header);
        if (snap.filters) SolsticeStore.set('filters', snap.filters);
        if (snap.pageId && typeof SolsticePages !== 'undefined' && SolsticePages.switchTo){
          try { SolsticePages.switchTo(snap.pageId); } catch(_){}
        }
        if (typeof SolsticeToast !== 'undefined'){
          SolsticeToast.success('💾 Auto-save restaurado',
            snap.sections.length + ' componente' + (snap.sections.length > 1 ? 's' : '') +
            ' de ' + _humanAge(Date.now() - snap.ts));
        }
      } catch(e){ SolsticeLog.warn('[AutoSave.restore]', e); }
    }

    function _showRestoreBanner(snap){
      // Espera o canvas/welcome aparecer (boot + 1ª render)
      const tryShow = (attempts) => {
        const canvas = document.querySelector('.solstice__canvas');
        if (!canvas){
          if (attempts > 0) setTimeout(() => tryShow(attempts - 1), 200);
          return;
        }
        // Não duplica banner se já existe
        if (canvas.querySelector('.solstice__autosave-banner')) return;
        const ageLabel = _humanAge(Date.now() - snap.ts);
        const count = snap.sections.length;
        const banner = SolsticeUtils.el('div', {
          class: 'solstice__autosave-banner',
          role: 'region',
          'aria-label': 'Auto-save disponível',
          style:
            'display:flex;align-items:center;justify-content:space-between;gap:12px;' +
            'padding:10px 16px;margin:12px 16px 0 16px;' +
            'background:color-mix(in srgb, var(--c-accent) 8%, var(--c-surface));' +
            'border:1px solid color-mix(in srgb, var(--c-accent) 30%, var(--c-border));' +
            'border-radius:var(--rad-md);font-size:13px;color:var(--c-text);'
        });
        const left = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:10px;flex:1;min-width:0;' });
        left.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true', style:'font-size:18px;flex-shrink:0;' }, '💾'));
        const txt = SolsticeUtils.el('div', { style:'flex:1;min-width:0;line-height:1.4;' });
        txt.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;color:var(--c-text);' },
          'Você tinha um trabalho em andamento'));
        txt.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-text-2);' },
          count + ' componente' + (count > 1 ? 's' : '') + ' · ' + ageLabel));
        left.appendChild(txt);
        banner.appendChild(left);
        const actions = SolsticeUtils.el('div', { style:'display:flex;gap:8px;flex-shrink:0;' });
        let timeoutId;
        const dismiss = () => {
          clearTimeout(timeoutId);
          banner.remove();
        };
        const btnRestore = SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--primary',
          type:'button',
          'aria-label':'Restaurar dashboard salvo automaticamente',
          onclick: () => { _doRestore(snap); dismiss(); }
        }, '↶ Restaurar');
        const btnDiscard = SolsticeUtils.el('button', {
          class:'solstice__btn',
          type:'button',
          'aria-label':'Descartar auto-save e começar do zero',
          onclick: () => {
            try { clear(); } catch(_){}
            dismiss();
          }
        }, 'Começar do zero');
        actions.append(btnRestore, btnDiscard);
        banner.appendChild(actions);
        // Auto-dismiss em 12s sem ação — não restaura, mas não apaga snapshot
        // (se o usuário recarregar, o banner volta a aparecer).
        timeoutId = setTimeout(dismiss, 12000);
        canvas.insertBefore(banner, canvas.firstChild);
      };
      // 800ms = boot + 1ª render do welcome state
      setTimeout(() => tryShow(5), 800);
    }

    function init(){
      if (_timer) return;
      _timer = setInterval(_tick, INTERVAL_MS);
      // Auditoria 2026.3 (MC-06): salva também quando a aba fica oculta.
      // visibilitychange é mais robusto que beforeunload — Chrome limita
      // beforeunload a ~250ms; visibilitychange dispara antes de o usuário
      // alt-tab, fechar aba, ou suspender o sistema. beforeunload mantido
      // como fallback adicional (best effort).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') _tick();
      });
      window.addEventListener('beforeunload', _tick);
    }

    function stop(){ if (_timer) { clearInterval(_timer); _timer = null; } }

    function clear(){
      try {
        if (typeof SolsticeStorage !== 'undefined' && SolsticeStorage.safeRemove){
          SolsticeStorage.safeRemove(STORAGE_KEY);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch(_){}
    }

    /**
     * SolsticeAutoSave — snapshot leve a cada 5s (safety net).
     * @returns {{
     *   init(): void,             // ativa timer + onbeforeunload
     *   stop(): void,              // desliga timer
     *   clear(): void,             // limpa snapshot persistido
     *   tryRestore(): boolean      // restaura se canvas vazio + snapshot fresco (<24h)
     * }}
     */
    return { init, stop, clear, tryRestore };
  })();
