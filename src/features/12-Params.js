
  /* ============================================================
     BLOCO 9 — SolsticeParams
     Parâmetros globais como K/V tipados. Persistido em Store.params.
     Substituíveis via {{param.NOME}} em narrativas e markdown.
     ============================================================ */
  const SolsticeParams = (function(){

    function _all(){ return SolsticeStore.get('params') || {}; }

    function get(name){ const p = _all()[name]; return p ? p.value : undefined; }
    function getAll(){ return _all(); }
    function set(name, def){
      const p = SolsticeUtils.deepClone(_all());
      // def: { type, value } ou só value (mantém type existente)
      if (def && typeof def === 'object' && ('type' in def || 'value' in def)){
        p[name] = { ...(p[name] || {}), ...def };
      } else {
        p[name] = { type: (p[name] && p[name].type) || 'string', value: def };
      }
      SolsticeStore.set('params', p);
    }
    function remove(name){
      const p = SolsticeUtils.deepClone(_all());
      delete p[name];
      SolsticeStore.set('params', p);
    }

    /** Substitui {{param.NOME}} em string. */
    function resolveText(text){
      if (!text) return '';
      const p = _all();
      return String(text).replace(/\{\{\s*param\.(\w+)\s*\}\}/g, (_, k) => {
        const e = p[k];
        return e ? String(e.value) : '{{param.' + k + '}}';
      });
    }

    /** Modal de edição CRUD de parâmetros. */
    async function openModal(){
      let local = SolsticeUtils.deepClone(_all());
      function refresh(listEl){
        listEl.innerHTML = '';
        const keys = Object.keys(local);
        if (!keys.length){
          listEl.appendChild(SolsticeUtils.el('div', { class:'solstice__params-empty' },
            'Nenhum parâmetro definido. Use o botão "+ Adicionar" abaixo.'));
        }
        keys.forEach(k => {
          const entry = local[k] || { type: 'string', value: '' };
          const row = SolsticeUtils.el('div', { class:'solstice__params-row' });
          const inName = SolsticeUtils.el('input', { type:'text', value: k });
          const selType = SolsticeUtils.el('select');
          ['string', 'number', 'date'].forEach(t => {
            const opt = SolsticeUtils.el('option', { value: t }, t);
            if (entry.type === t) opt.selected = true;
            selType.appendChild(opt);
          });
          const inValue = SolsticeUtils.el('input', { type: entry.type === 'number' ? 'number' : entry.type === 'date' ? 'date' : 'text', value: entry.value == null ? '' : String(entry.value) });
          const delBtn = SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--icon',
            title:'Remover', onclick: () => { delete local[k]; refresh(listEl); } }, '🗑️');
          inName.addEventListener('change', (e) => {
            const newKey = (e.target.value || '').trim();
            if (!newKey || newKey === k) return;
            if (local[newKey]) { SolsticeToast.warn('Nome em uso', newKey); inName.value = k; return; }
            local[newKey] = local[k]; delete local[k]; refresh(listEl);
          });
          selType.addEventListener('change', (e) => {
            local[k].type = e.target.value;
            inValue.type = e.target.value === 'number' ? 'number' : e.target.value === 'date' ? 'date' : 'text';
          });
          inValue.addEventListener('change', (e) => {
            const v = e.target.value;
            local[k].value = selType.value === 'number' ? parseFloat(v) : v;
          });
          row.append(inName, selType, inValue, delBtn);
          listEl.appendChild(row);
        });
      }

      await SolsticeModal.show({
        title: '🎛️ Parâmetros globais',
        body: (close) => {
          const wrap = SolsticeUtils.el('div');
          wrap.appendChild(SolsticeUtils.el('p', { style:'color:var(--c-muted);font-size:var(--fs-xs);margin-bottom:var(--sp-3);line-height:1.5;' },
            'Parâmetros viram variáveis que você pode referenciar em texto Markdown e narrativas usando ' +
            '{{param.NOME}}. Ex: meta=1000000 vira "{{param.meta}}" no texto.'));
          const list = SolsticeUtils.el('div', { class:'solstice__params-list' });
          refresh(list);
          wrap.appendChild(list);
          const addBtn = SolsticeUtils.el('button', { class:'solstice__btn',
            style:'margin-top:var(--sp-3);',
            onclick: () => {
              let i = 1; let name = 'novo_param';
              while (local[name]) { i++; name = 'novo_param_' + i; }
              local[name] = { type: 'string', value: '' };
              refresh(list);
            } }, '+ Adicionar parâmetro');
          wrap.appendChild(addBtn);
          return wrap;
        },
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn', onclick: () => close(null) }, 'Cancelar'),
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary',
            onclick: () => { SolsticeStore.set('params', local); SolsticeToast.success('Parâmetros salvos', Object.keys(local).length + ' definido(s)'); close(null); }
          }, 'Salvar')
        ]
      });
    }

    function init(){
      // nada por enquanto — Store-based
    }

    // Auditoria 2026 (RT-03): adapter pra cumprir SolsticeStoreContract.
    function subscribe(path, cb){
      const full = path ? 'params.' + path : 'params';
      return SolsticeStore.subscribe(full, cb);
    }
    return { get, getAll, set, subscribe, remove, resolveText, openModal, init };
  })();
