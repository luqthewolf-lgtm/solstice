
  /* ============================================================
     SolsticeProfiles — perfis sem senha
     Estrutura: { id, name, color, createdAt, dashboards: [] }
     Persistência: localStorage chave 'solstice.profiles'
     ============================================================ */
  const SolsticeProfiles = (function(){
    const KEY = 'solstice.profiles';
    const KEY_CUR = 'solstice.profile.current';
    const COLORS = ['#4D9FFF','#FF6B9D','#2DD4BF','#A78BFA','#D97757','#94A3B8'];

    function _load(){
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : [];
      } catch(e){
        SolsticeErrors.show('LOCALSTORAGE_UNAVAILABLE');
        return [];
      }
    }
    function _save(arr){
      try { localStorage.setItem(KEY, JSON.stringify(arr)); }
      catch(e){ SolsticeErrors.show('STORAGE_QUOTA_EXCEEDED'); }
    }

    function list(){ return _load(); }

    function create(name, color, opts){
      const n = String(name||'').trim();
      if (!n) { SolsticeErrors.show('PROFILE_NAME_EMPTY'); return null; }
      const all = _load();
      if (all.some(p => p.name.toLowerCase() === n.toLowerCase())){
        SolsticeErrors.show('PROFILE_NAME_DUPLICATE');
        return null;
      }
      const profile = {
        id: SolsticeUtils.uuid(),
        name: n,
        color: color || COLORS[all.length % COLORS.length],
        createdAt: new Date().toISOString(),
        dashboards: []
      };
      all.push(profile);
      _save(all);
      SolsticeStore.set('profile', profile);
      // Auditoria 2026 (AP-02): KEY_CUR é apontador — _save (acima) já avisa
      // se a escrita do array falhou; aqui silent pra não duplicar toast.
      SolsticeStorage.safeSet(KEY_CUR, profile.id, { silent: true });
      // Auditoria 2026.6 (FIRST-IMPRESSION): o perfil "Visitante" auto-criado no
      // boot não precisa de toast (era ruído na primeira impressão). Só avisa
      // quando o usuário cria um perfil de propósito.
      if (!(opts && opts.silent)) SolsticeToast.success(SolsticeLocale.t('toast.profile.created'), profile.name);
      return profile;
    }

    function switchTo(id){
      const p = _load().find(x => x.id === id);
      if (!p) return false;
      SolsticeStore.set('profile', p);
      // Auditoria 2026 (AP-02): silent — apontador, idem create().
      SolsticeStorage.safeSet(KEY_CUR, id, { silent: true });
      return true;
    }

    function remove(id){
      const all = _load().filter(p => p.id !== id);
      _save(all);
      if (SolsticeStore.get('profile.id') === id) SolsticeStore.set('profile', all[0] || null);
    }

    function current(){
      try {
        const id = localStorage.getItem(KEY_CUR);
        if (!id) return null;
        return _load().find(p => p.id === id) || null;
      } catch(e){ return null; }
    }

    function ensureDefault(){
      // Patch 1A (ADR-094): perfil placeholder "Visitante" para não bloquear boot;
      // prompt assíncrono opcional via promptName() chamado após boot.
      let cur = current();
      if (cur) return cur;
      let all = _load();
      if (all.length === 0){
        cur = create('Visitante', null, { silent: true });
        cur._isPlaceholder = true;
        // Persiste o flag
        const stored = _load();
        const stIdx = stored.findIndex(p => p.id === cur.id);
        if (stIdx >= 0){
          stored[stIdx]._isPlaceholder = true;
          // Auditoria 2026 (AP-02): silent — flag interna de placeholder.
          SolsticeStorage.safeSet(KEY, JSON.stringify(stored), { silent: true });
        }
      } else {
        cur = all[0];
        switchTo(cur.id);
      }
      return cur;
    }

    /**
     * Patch 1A: prompt opcional para personalizar nome quando perfil ainda é "Visitante".
     * Chamado após boot OK; não bloqueia inicialização.
     */
    async function promptNameIfPlaceholder(){
      const cur = current();
      if (!cur) return;
      if (!cur._isPlaceholder) return;
      const all = _load();
      const idx = all.findIndex(p => p.id === cur.id);
      if (idx < 0) return;
      // Marca como já-perguntado para não repetir mesmo se cancelar
      all[idx]._isPlaceholder = false;
      // Auditoria 2026 (AP-02): silent=true porque é flag interna; usuário não
      // precisa ver toast por isso. O save do nome (logo abaixo) sim avisa.
      SolsticeStorage.safeSet(KEY, JSON.stringify(all), { silent: true });
      const name = await SolsticeModal.prompt({
        title: '🌗 Bem-vindo ao Solstice',
        message: 'Como podemos te chamar? (você pode trocar depois em Configurações)',
        placeholder: 'Seu nome',
        confirmLabel: 'Começar'
      });
      if (name && String(name).trim()){
        all[idx].name = String(name).trim();
        // Auditoria 2026 (AP-02): aqui o usuário PRECISA saber se falhou.
        SolsticeStorage.safeSet(KEY, JSON.stringify(all));
        // Atualiza UI
        const pn = document.getElementById('profile-name');
        const sp = document.getElementById('status-profile');
        if (pn) pn.textContent = all[idx].name;
        if (sp) sp.textContent = all[idx].name;
      }
    }

    function rename(newName){
      const cur = current();
      if (!cur) return false;
      const all = _load();
      const idx = all.findIndex(p => p.id === cur.id);
      if (idx < 0) return false;
      all[idx].name = String(newName || '').trim() || 'Visitante';
      // Auditoria 2026 (AP-02): safeSet dispara toast e devolve false em falha.
      if (!SolsticeStorage.safeSet(KEY, JSON.stringify(all))) return false;
      const pn = document.getElementById('profile-name');
      const sp = document.getElementById('status-profile');
      if (pn) pn.textContent = all[idx].name;
      if (sp) sp.textContent = all[idx].name;
      return true;
    }

    return { list, create, switchTo, remove, current, ensureDefault, promptNameIfPlaceholder, rename, COLORS };
  })();
