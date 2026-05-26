
  /* ============================================================
     Patch Final (ADR-142) — SolsticeCollections
     Coleções (agrupamento manual de snapshots/visões/dashboards).
     Persiste por workspace em ingest.collections.
     ============================================================ */
  const SolsticeCollections = (function(){
    function list(){
      const ingest = SolsticeStore.get('ingest') || {};
      return ingest.collections || [];
    }
    function _persist(cols){
      const ingest = SolsticeStore.get('ingest') || {};
      SolsticeStore.set('ingest', Object.assign({}, ingest, { collections: cols }));
    }
    function create(name){
      const c = { id: 'col-' + SolsticeUtils.uuid().slice(0,8), name, items: [], createdAt: new Date().toISOString() };
      const arr = list().slice(); arr.push(c); _persist(arr);
      return c;
    }
    function remove(id){ _persist(list().filter(c => c.id !== id)); }
    function rename(id, newName){
      const arr = list().slice();
      const c = arr.find(x => x.id === id); if (c){ c.name = newName; _persist(arr); }
    }
    function addItem(colId, item){
      // item: { type: 'snapshot'|'view'|'dashboard', id, name }
      const arr = list().slice();
      const c = arr.find(x => x.id === colId);
      if (!c) return false;
      if (!c.items.some(i => i.id === item.id && i.type === item.type)) c.items.push(item);
      _persist(arr); return true;
    }
    function removeItem(colId, itemId, itemType){
      const arr = list().slice();
      const c = arr.find(x => x.id === colId);
      if (!c) return false;
      c.items = c.items.filter(i => !(i.id === itemId && i.type === itemType));
      _persist(arr); return true;
    }
    function openManager(){
      const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:8px;font-size:13px;' });
      const arr = list();
      if (!arr.length){
        wrap.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:12px;font-style:italic;' },
          'Nenhuma coleção. Crie uma para agrupar snapshots/visões relacionadas.'));
      }
      arr.forEach(c => {
        const card = SolsticeUtils.el('div', { style:'padding:8px 10px;background:var(--c-surface-2);border-radius:6px;' });
        const head = SolsticeUtils.el('div', { style:'display:flex;justify-content:space-between;align-items:center;' });
        head.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;font-size:12px;' }, '📁 ' + c.name + ' (' + (c.items || []).length + ')'));
        const acts = SolsticeUtils.el('div', { style:'display:flex;gap:4px;' });
        acts.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', style:'font-size:10px;padding:2px 8px;', onclick: async () => {
          const newName = await SolsticeModal.prompt({ title:'Renomear coleção', defaultValue: c.name });
          if (newName){ rename(c.id, newName); openManager(); }
        }}, 'Renomear'));
        acts.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', style:'font-size:10px;padding:2px 8px;color:var(--c-error);', onclick: async () => {
          if (await SolsticeModal.confirm({ title:'Remover coleção?', danger:true, confirmLabel:'Remover' })){ remove(c.id); openManager(); }
        }}, '✕'));
        head.appendChild(acts);
        card.appendChild(head);
        if ((c.items || []).length){
          const itemsList = SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-top:4px;' });
          c.items.forEach(it => itemsList.appendChild(SolsticeUtils.el('div', null, '• ' + (it.type === 'snapshot' ? '📂' : it.type === 'view' ? '💾' : '📊') + ' ' + (it.name || it.id))));
          card.appendChild(itemsList);
        }
        wrap.appendChild(card);
      });
      wrap.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: async () => {
        const name = await SolsticeModal.prompt({ title:'Nova coleção', message:'Nome da coleção:', placeholder:'Ex: Análises Q1 2026' });
        if (!name) return;
        create(name); openManager();
      }}, '+ Nova coleção'));
      SolsticeModal.show({
        title:'📁 Coleções',
        body: wrap,
        buttons:[{ label:'Fechar', kind:'primary', onClick: () => true }]
      });
    }
    return { list, create, remove, rename, addItem, removeItem, openManager };
  })();
