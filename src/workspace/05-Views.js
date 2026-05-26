
  /* ============================================================
     Patch Final (ADR-141) — SolsticeViews
     Visões salvas: conjunto nomeado de filtros + parâmetros + slot
     selecionado + tags. Persiste por workspace via ingest.savedViews.
     ============================================================ */
  const SolsticeViews = (function(){
    function _path(){ return 'ingest.savedViews'; }

    function list(){
      const ingest = SolsticeStore.get('ingest') || {};
      return ingest.savedViews || [];
    }

    function _persist(views){
      const ingest = SolsticeStore.get('ingest') || {};
      SolsticeStore.set('ingest', Object.assign({}, ingest, { savedViews: views }));
    }

    function save(name, description, tags){
      const view = {
        id: 'view-' + SolsticeUtils.uuid().slice(0, 8),
        name: name || 'Visão ' + new Date().toLocaleString('pt-BR'),
        description: description || '',
        tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(s => s.trim()).filter(Boolean) : []),
        filters: SolsticeUtils.deepClone(SolsticeStore.get('filters') || {}),
        params: SolsticeUtils.deepClone(SolsticeStore.get('params') || {}),
        selectedSlot: SolsticeStore.get('ui.selectedSlot') || null,
        savedAt: new Date().toISOString()
      };
      const arr = list().slice();
      arr.unshift(view);
      _persist(arr);
      SolsticeAudit.record({ action:'view_save', target: view.id, details: { name } });
      return view;
    }

    function apply(id){
      const view = list().find(v => v.id === id);
      if (!view) return false;
      SolsticeStore.batch(() => {
        SolsticeStore.set('filters', SolsticeUtils.deepClone(view.filters || {}));
        SolsticeStore.set('params', SolsticeUtils.deepClone(view.params || {}));
      });
      if (view.selectedSlot && typeof SolsticeProps !== 'undefined') setTimeout(() => SolsticeProps.select(view.selectedSlot), 100);
      SolsticeToast.success('Visão aplicada', view.name);
      SolsticeAudit.record({ action:'view_apply', target: id });
      return true;
    }

    function remove(id){
      _persist(list().filter(v => v.id !== id));
      SolsticeAudit.record({ action:'view_remove', target: id });
    }

    async function openSaveModal(){
      const name = await SolsticeModal.prompt({ title:'💾 Salvar visão', message:'Nome desta visão:', placeholder:'Ex: Análise Inadimplência SP' });
      if (!name) return;
      const tags = await SolsticeModal.prompt({ title:'Tags (opcional)', message:'Separe por vírgula:', placeholder:'Q1, SP, cliente A' });
      const v = save(name, '', tags);
      SolsticeToast.success('Visão salva', v.name);
    }

    function openManager(){
      const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:6px;font-size:13px;' });
      const arr = list();
      if (!arr.length){
        wrap.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:12px;font-style:italic;' },
          'Nenhuma visão salva ainda. Configure filtros/parâmetros e clique "💾 Salvar visão" na toolbar.'));
      }
      // Filtro por tag
      const allTags = Array.from(new Set(arr.flatMap(v => v.tags || []))).sort();
      let activeTag = null;
      const tagBar = SolsticeUtils.el('div', { style:'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;' });
      function _renderTags(){
        tagBar.innerHTML = '';
        if (!allTags.length) return;
        tagBar.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--ghost', style:'font-size:10px;padding:2px 6px;' + (activeTag === null ? 'background:var(--c-accent);color:#fff;' : ''),
          onclick: () => { activeTag = null; _refresh(); }
        }, 'todos'));
        allTags.forEach(t => {
          tagBar.appendChild(SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--ghost', style:'font-size:10px;padding:2px 6px;' + (activeTag === t ? 'background:var(--c-accent);color:#fff;' : ''),
            onclick: () => { activeTag = t; _refresh(); }
          }, '#' + t));
        });
      }
      const listBox = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:6px;' });
      function _refresh(){
        _renderTags();
        listBox.innerHTML = '';
        const filtered = activeTag ? arr.filter(v => (v.tags || []).includes(activeTag)) : arr;
        filtered.forEach(v => {
          const card = SolsticeUtils.el('div', { style:'padding:8px 10px;background:var(--c-surface-2);border-radius:6px;' });
          const head = SolsticeUtils.el('div', { style:'display:flex;justify-content:space-between;align-items:center;' });
          head.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;font-size:12px;' }, v.name));
          const acts = SolsticeUtils.el('div', { style:'display:flex;gap:4px;' });
          acts.appendChild(SolsticeUtils.el('button', { class:'solstice__btn', style:'font-size:10px;padding:2px 8px;', onclick: () => apply(v.id) }, 'Aplicar'));
          acts.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', style:'font-size:10px;padding:2px 8px;color:var(--c-error);', onclick: async () => {
            if (await SolsticeModal.confirm({ title:'Remover visão?', danger:true, confirmLabel:'Remover' })){
              remove(v.id); openManager();
            }
          }}, '✕'));
          head.appendChild(acts);
          card.appendChild(head);
          if ((v.tags || []).length){
            const tagsRow = SolsticeUtils.el('div', { style:'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;' });
            v.tags.forEach(t => tagsRow.appendChild(SolsticeUtils.el('span', { style:'font-size:9px;background:var(--c-accent);color:#fff;padding:1px 6px;border-radius:4px;' }, '#' + t)));
            card.appendChild(tagsRow);
          }
          listBox.appendChild(card);
        });
      }
      wrap.appendChild(tagBar);
      wrap.appendChild(listBox);
      _refresh();
      SolsticeModal.show({
        title:'💾 Visões salvas',
        body: wrap,
        buttons: [
          { label:'+ Salvar atual como visão', kind:'ghost', onClick: () => { openSaveModal(); return true; }},
          { label:'Fechar', kind:'primary', onClick: () => true }
        ]
      });
    }

    return { list, save, apply, remove, openSaveModal, openManager };
  })();
