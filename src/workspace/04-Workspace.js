
  /* ============================================================
     Patch Final (ADR-140) — SolsticeWorkspace
     Multi-CSV: cada workspace tem ingest + canvas + dictionary + views.
     Persistência: localStorage com LZ-String. UI: selector no header
     + modal de gerenciamento.
     ============================================================ */
  const SolsticeWorkspace = (function(){
    const LIST_KEY = 'solstice.workspaces.list';
    const ACTIVE_KEY = 'solstice.workspaces.active';
    const PREFIX = 'solstice.workspace.';

    function _list(){
      try { return JSON.parse(localStorage.getItem(LIST_KEY) || '[]'); }
      catch(e){ return []; }
    }
    function _saveList(arr){
      // Auditoria 2026 (AP-02): workspaces (visões salvas) — avisar se perder,
      // é trabalho do usuário.
      SolsticeStorage.safeSet(LIST_KEY, JSON.stringify(arr));
    }
    function _activeId(){ try { return localStorage.getItem(ACTIVE_KEY) || null; } catch(e){ return null; } }
    function _setActiveId(id){
      // Auditoria 2026 (AP-02): silent — ponteiro do workspace ativo (recupera).
      if (id) SolsticeStorage.safeSet(ACTIVE_KEY, id, { silent: true });
      else SolsticeStorage.safeRemove(ACTIVE_KEY);
    }

    function _captureState(){
      return {
        ingest: SolsticeStore.get('ingest') || null,
        dictionary: SolsticeStore.get('dictionary') || null,
        canvas: {
          sections: SolsticeStore.get('canvas.sections') || [],
          header: SolsticeStore.get('canvas.header') || {}
        },
        filters: SolsticeStore.get('filters') || {},
        params: SolsticeStore.get('params') || {},
        datasetReady: !!SolsticeStore.get('dataset.ready'),
        datasetName: SolsticeStore.get('dataset.name') || ''
      };
    }

    function _persistState(id, state){
      // Auditoria 2026 (AP-02): workspace state é o trabalho do usuário —
      // avisar se a persistência falhar (quota cheia, modo anônimo).
      try {
        const json = JSON.stringify(state);
        const compressed = SolsticeLZ.compressToBase64(json);
        const ok = SolsticeStorage.safeSet(PREFIX + id, compressed);
        if (!ok) SolsticeLog.warn('[Workspace] falha ao persistir', id);
        return ok;
      } catch(e){
        SolsticeLog.warn('[Workspace] falha ao serializar workspace', id, e);
        return false;
      }
    }

    function _loadState(id){
      try {
        const raw = localStorage.getItem(PREFIX + id);
        if (!raw) return null;
        return JSON.parse(SolsticeLZ.decompressFromBase64(raw));
      } catch(e){ SolsticeLog.warn('[Workspace] falha ao carregar', id, e); return null; }
    }

    function _hydrate(state){
      SolsticeStore.batch(() => {
        SolsticeStore.set('canvas.sections', (state.canvas && state.canvas.sections) || []);
        SolsticeStore.set('canvas.header', (state.canvas && state.canvas.header) || {});
        SolsticeStore.set('filters', state.filters || {});
        SolsticeStore.set('params', state.params || {});
        SolsticeStore.set('dictionary', state.dictionary || null);
        if (state.ingest){
          SolsticeStore.set('ingest', state.ingest);
          SolsticeStore.set('dataset.ready', !!state.datasetReady);
          SolsticeStore.set('dataset.name', state.datasetName || '');
          SolsticeStore.set('dataset.rows', state.ingest.rows);
          SolsticeStore.set('dataset.columns', state.ingest.columns);
        } else {
          SolsticeStore.set('ingest', null);
          SolsticeStore.set('dataset.ready', false);
        }
      });
      if (SolsticeCanvas && SolsticeCanvas.render) SolsticeCanvas.render();
    }

    function list(){
      return _list().map(meta => Object.assign({}, meta, { active: meta.id === _activeId() }));
    }

    function active(){
      const id = _activeId();
      return list().find(w => w.id === id) || null;
    }

    function create(name){
      const id = 'ws-' + SolsticeUtils.uuid().slice(0, 8);
      const meta = { id, name: name || 'Workspace ' + (list().length + 1), createdAt: new Date().toISOString() };
      const arr = _list(); arr.push(meta); _saveList(arr);
      // Salva snapshot vazio
      _persistState(id, _captureState());
      return id;
    }

    function rename(id, newName){
      const arr = _list();
      const m = arr.find(w => w.id === id);
      if (m){ m.name = newName; _saveList(arr); }
    }

    function remove(id){
      if (list().length <= 1){ SolsticeToast.warn('Não posso remover', 'Deve existir ao menos 1 workspace.'); return false; }
      const arr = _list().filter(w => w.id !== id);
      _saveList(arr);
      try { localStorage.removeItem(PREFIX + id); } catch(e){}
      if (_activeId() === id) switchTo(arr[0].id);
      return true;
    }

    /** Switch: captura estado corrente do workspace ativo + carrega o destino. */
    function switchTo(id){
      const cur = _activeId();
      if (cur === id) return;
      // Persiste o atual
      if (cur){ _persistState(cur, _captureState()); }
      // Carrega o novo
      const state = _loadState(id) || _captureState();
      _hydrate(state);
      _setActiveId(id);
      const meta = list().find(w => w.id === id);
      SolsticeToast.info('Workspace ativo', meta ? meta.name : id);
      // Fecha inspector — slot pode não existir mais
      if (typeof SolsticeInspector !== 'undefined' && SolsticeInspector.isOpen()) SolsticeInspector.close();
      // Atualiza UI do selector
      _updateSelector();
    }

    /** Inicializa: cria workspace padrão se vazio + monta selector. */
    function init(){
      const arr = _list();
      if (!arr.length){
        // Migra estado atual (se houver) para workspace "Principal"
        const id = create('Principal');
        _setActiveId(id);
        _persistState(id, _captureState());
      } else if (!_activeId()){
        _setActiveId(arr[0].id);
      }
      _renderSelector();
      // Persiste mudanças do workspace ativo periodicamente
      SolsticeUtils.fire('workspace:ready', { id: _activeId() });
      let pendingSave = null;
      const saveDebounced = SolsticeUtils.debounce(() => {
        const aid = _activeId();
        if (!aid) return;
        const ok = _persistState(aid, _captureState());
        // Auditoria 2026 (R-10 / A-1004): só marca clean se persistiu.
        if (ok) _dirty = false;
      }, 1500);
      SolsticeStore.subscribe('canvas.sections', saveDebounced);
      SolsticeStore.subscribe('ingest', saveDebounced);
      SolsticeStore.subscribe('dictionary', saveDebounced);
      SolsticeStore.subscribe('filters', saveDebounced);
      // Auditoria 2026 (R-09 / A-1002): params (parâmetros globais) também
      // entram no auto-save. Antes ficavam fora — status-saved mentia para
      // o usuário que aplicava filtro/parâmetro e perdia ao recarregar.
      SolsticeStore.subscribe('params', saveDebounced);

      // Auditoria 2026 (R-10 / A-1004): beforeunload. Cada mudança em path
      // observado marca dirty; o debounce salva e marca clean. Se o usuário
      // tentar fechar a aba enquanto dirty=true (ou enquanto há ingest em
      // curso), o navegador pede confirmação.
      const markDirtyCb = () => { _dirty = true; };
      SolsticeStore.subscribe('canvas.sections', markDirtyCb);
      SolsticeStore.subscribe('ingest', markDirtyCb);
      SolsticeStore.subscribe('dictionary', markDirtyCb);
      SolsticeStore.subscribe('filters', markDirtyCb);
      SolsticeStore.subscribe('params', markDirtyCb);
      window.addEventListener('beforeunload', (e) => {
        const ingestRunning = (typeof SolsticeIngest !== 'undefined' && SolsticeIngest.isRunning && SolsticeIngest.isRunning());
        if (_dirty || ingestRunning){
          e.preventDefault();
          e.returnValue = ''; // exige string vazia em browsers modernos
          return '';
        }
      });
    }
    // dirty flag — true quando há mudança não persistida; false após save.
    let _dirty = false;

    function _renderSelector(){
      let host = document.getElementById('workspace-selector');
      if (!host){
        // Insere no header antes da brand
        const headerSpot = document.querySelector('.solstice__header-brand');
        if (!headerSpot) return;
        host = SolsticeUtils.el('div', { id:'workspace-selector', style:'display:inline-flex;align-items:center;gap:6px;margin-right:var(--sp-3);' });
        headerSpot.parentNode.insertBefore(host, headerSpot);
      }
      _updateSelector();
    }

    function _updateSelector(){
      const host = document.getElementById('workspace-selector');
      if (!host) return;
      host.innerHTML = '';
      const cur = active();
      const btn = SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--ghost',
        style:'font-size:12px;padding:4px 10px;',
        title:'Trocar workspace',
        onclick: () => openManager()
      }, '📊 ' + (cur ? cur.name : '—') + ' ▼');
      host.appendChild(btn);
    }

    function openManager(){
      const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:8px;font-size:13px;' });
      const cur = _activeId();
      list().forEach(w => {
        const state = _loadState(w.id);
        const stats = state && state.ingest ? {
          rows: (state.ingest.rows || []).length,
          cols: (state.ingest.columns || []).length,
          comps: (state.canvas && state.canvas.sections || []).reduce((a,s) => a + s.rows.reduce((b,r) => b + r.slots.filter(sl => sl.type && sl.type !== 'empty').length, 0), 0)
        } : { rows:0, cols:0, comps:0 };
        const card = SolsticeUtils.el('div', {
          style:'padding:10px;background:var(--c-surface-2);border-radius:6px;border:' + (w.id === cur ? '2px solid var(--c-accent)' : '1px solid var(--c-border)') + ';'
        });
        const head = SolsticeUtils.el('div', { style:'display:flex;justify-content:space-between;align-items:center;' });
        const nameEl = SolsticeUtils.el('button', {
          style:'background:none;border:none;color:var(--c-text);font-weight:600;cursor:pointer;font-size:13px;padding:0;text-align:left;',
          onclick: () => { switchTo(w.id); SolsticeToast.success('Workspace ativo', w.name); }
        }, '📊 ' + w.name + (w.id === cur ? ' (ativo)' : ''));
        head.appendChild(nameEl);
        const acts = SolsticeUtils.el('div', { style:'display:flex;gap:4px;' });
        acts.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', style:'font-size:10px;padding:2px 8px;', onclick: async () => {
          const newName = await SolsticeModal.prompt({ title:'Renomear workspace', message:'Novo nome:', defaultValue: w.name });
          if (newName){ rename(w.id, newName); _updateSelector(); SolsticeToast.success('Renomeado'); openManager(); }
        }}, 'Renomear'));
        acts.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', style:'font-size:10px;padding:2px 8px;color:var(--c-error);', onclick: async () => {
          const ok = await SolsticeModal.confirm({ title:'Remover workspace?', message:'O workspace "' + w.name + '" será removido (incluindo seu dataset salvo).', danger:true, confirmLabel:'Remover' });
          if (ok){ remove(w.id); SolsticeToast.warn('Workspace removido', w.name); openManager(); }
        }}, '✕'));
        head.appendChild(acts);
        card.appendChild(head);
        card.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-top:4px;font-family:var(--font-mono);' },
          stats.rows.toLocaleString('pt-BR') + ' linhas · ' + stats.cols + ' colunas · ' + stats.comps + ' componente' + (stats.comps === 1 ? '' : 's')));
        wrap.appendChild(card);
      });
      // Botão criar
      wrap.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--primary',
        style:'margin-top:6px;',
        onclick: async () => {
          const name = await SolsticeModal.prompt({ title:'Novo workspace', message:'Como vai se chamar?', placeholder:'Ex: Carteira PJ Mai' });
          if (!name) return;
          const id = create(name);
          switchTo(id);
          SolsticeToast.success('Workspace criado', name);
          openManager();
        }
      }, '+ Novo workspace'));
      SolsticeModal.show({
        title:'📊 Workspaces',
        body: wrap,
        buttons:[{ label:'Fechar', kind:'primary', onClick: () => true }]
      });
    }

    return { list, active, create, rename, remove, switchTo, init, openManager };
  })();
