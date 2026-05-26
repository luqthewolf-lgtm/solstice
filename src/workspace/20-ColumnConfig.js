
  /* ============================================================
     Patch 1A (ADR-127) — SolsticeColumnConfig
     Modal único de configuração de coluna em 4 abas:
     Tipo · Formato · Significado · Transformar.
     ============================================================ */
  const SolsticeColumnConfig = (function(){
    function open(col){
      const ingest = SolsticeStore.get('ingest') || {};
      const types = ingest.types || {};
      const dict = SolsticeStore.get('dictionary') || { columns:{} };
      const colMeta = (dict.columns && dict.columns[col]) || {};
      const tMeta = types[col] || {};
      const currentType = tMeta.type || 'string';

      let activeTab = 'tipo';
      const wrap = SolsticeUtils.el('div', { style:'font-size:13px;color:var(--c-text);' });

      // Tabs
      const tabsBar = SolsticeUtils.el('div', { style:'display:flex;gap:4px;border-bottom:1px solid var(--c-border);margin-bottom:12px;' });
      const tabs = [
        { id:'tipo',   label:'🎚️ Tipo' },
        { id:'formato', label:'🔢 Formato' },
        { id:'signif', label:'📝 Significado' },
        { id:'transf', label:'⚡ Transformar' }
      ];
      tabs.forEach(t => {
        const b = SolsticeUtils.el('button', {
          'data-tab': t.id,
          style:'background:none;border:none;padding:8px 12px;cursor:pointer;font-size:12px;color:var(--c-text-2);border-bottom:2px solid transparent;',
          onclick: () => { activeTab = t.id; _render(); }
        }, t.label);
        tabsBar.appendChild(b);
      });
      wrap.appendChild(tabsBar);

      const content = SolsticeUtils.el('div', { style:'min-height:200px;' });
      wrap.appendChild(content);

      function _render(){
        // Highlight tab ativa
        SolsticeUtils.qsa('button[data-tab]', tabsBar).forEach(b => {
          const active = b.dataset.tab === activeTab;
          b.style.color = active ? 'var(--c-accent)' : 'var(--c-text-2)';
          b.style.borderBottomColor = active ? 'var(--c-accent)' : 'transparent';
        });
        content.innerHTML = '';
        if (activeTab === 'tipo'){
          content.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-bottom:8px;' },
            'Tipo atual: ' + SolsticeTypes.label(currentType) + ' · userGroup: ' + SolsticeTypes.userGroup(currentType)));
          ['integer','decimal','currency','percentage','ordinal','categorical','date','datetime','cpf','cnpj','email','phone','url','latitude','longitude'].forEach(t => {
            const lbl = SolsticeUtils.el('label', {
              style:'display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;border-radius:4px;'
            });
            const radio = SolsticeUtils.el('input', { type:'radio', name:'col-type', value:t });
            if (t === currentType) radio.checked = true;
            lbl.appendChild(radio);
            lbl.appendChild(SolsticeUtils.el('span', null, SolsticeTypes.icon(t) + ' ' + SolsticeTypes.label(t)));
            content.appendChild(lbl);
          });
          const apply = SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--primary',
            style:'margin-top:8px;',
            onclick: () => {
              const chosen = content.querySelector('input[name="col-type"]:checked');
              if (!chosen) return;
              const newTypes = SolsticeUtils.deepClone(types);
              newTypes[col] = Object.assign({}, newTypes[col] || {}, { type: chosen.value });
              SolsticeStore.set('ingest.types', newTypes);
              SolsticeToast.success('Tipo alterado', col + ' → ' + SolsticeTypes.label(chosen.value));
            }
          }, 'Aplicar tipo');
          content.appendChild(apply);
        } else if (activeTab === 'formato'){
          content.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-bottom:8px;' },
            'Formato de exibição. Aplica-se ao mostrar valores no canvas e narrativas.'));
          const fields = [
            { label:'Casas decimais', key:'decimals', value: colMeta.decimals != null ? String(colMeta.decimals) : '2', type:'number' },
            { label:'Prefixo (ex: R$, US$)', key:'prefix', value: colMeta.prefix || '', type:'text' },
            { label:'Sufixo (ex: %, kg)',    key:'suffix', value: colMeta.suffix || '', type:'text' },
            { label:'Unidade (BRL, pct, etc)', key:'unit',   value: colMeta.unit   || '', type:'text' }
          ];
          const inputs = {};
          fields.forEach(f => {
            const row = SolsticeUtils.el('div', { style:'margin-bottom:8px;' });
            row.appendChild(SolsticeUtils.el('label', { style:'display:block;font-size:11px;color:var(--c-muted);margin-bottom:2px;' }, f.label));
            const inp = SolsticeUtils.el('input', { class:'solstice__props-input', type:f.type, value: f.value });
            inputs[f.key] = inp;
            row.appendChild(inp);
            content.appendChild(row);
          });
          const apply = SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--primary',
            onclick: () => {
              const newDict = SolsticeUtils.deepClone(dict);
              newDict.columns = newDict.columns || {};
              newDict.columns[col] = newDict.columns[col] || {};
              Object.keys(inputs).forEach(k => {
                const v = inputs[k].value.trim();
                if (v) newDict.columns[col][k] = (k === 'decimals') ? parseInt(v, 10) : v;
                else delete newDict.columns[col][k];
              });
              SolsticeStore.set('dictionary', newDict);
              SolsticeToast.success('Formato salvo');
            }
          }, 'Aplicar formato');
          content.appendChild(apply);
        } else if (activeTab === 'signif'){
          content.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-bottom:8px;' },
            'O que esta coluna representa? Define como o Solstice fala dela.'));
          const fName = SolsticeUtils.el('input', { class:'solstice__props-input', type:'text', value: colMeta.friendlyName || '', placeholder:'Ex: Receita Total' });
          const desc = SolsticeUtils.el('textarea', { class:'solstice__props-input', rows:'3', placeholder:'Descrição opcional…' }, colMeta.description || '');
          const syn = SolsticeUtils.el('input', { class:'solstice__props-input', type:'text', value: (colMeta.synonyms || []).join(', '), placeholder:'sinônimos separados por vírgula' });
          const hibLabel = SolsticeUtils.el('label', { style:'display:flex;gap:6px;align-items:center;font-size:12px;margin-top:8px;' });
          const hibSel = SolsticeUtils.el('select', { class:'solstice__props-select' });
          [['', '—'], ['true','✅ Maior é melhor'], ['false','⚠️ Menor é melhor']].forEach(([v,l]) => {
            const o = SolsticeUtils.el('option', { value:v }, l);
            if (String(colMeta.higherIsBetter) === v) o.selected = true;
            hibSel.appendChild(o);
          });
          hibLabel.appendChild(SolsticeUtils.el('span', { style:'min-width:100px;' }, 'Direção:'));
          hibLabel.appendChild(hibSel);
          ['Nome amigável','Descrição','Sinônimos'].forEach((lab, i) => {
            const row = SolsticeUtils.el('div', { style:'margin-bottom:8px;' });
            row.appendChild(SolsticeUtils.el('label', { style:'display:block;font-size:11px;color:var(--c-muted);margin-bottom:2px;' }, lab));
            row.appendChild([fName, desc, syn][i]);
            content.appendChild(row);
          });
          content.appendChild(hibLabel);
          const apply = SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--primary',
            style:'margin-top:12px;',
            onclick: () => {
              const newDict = SolsticeUtils.deepClone(dict);
              newDict.columns = newDict.columns || {};
              newDict.columns[col] = newDict.columns[col] || {};
              newDict.columns[col].friendlyName = fName.value.trim();
              newDict.columns[col].description  = desc.value.trim();
              newDict.columns[col].synonyms     = syn.value.split(',').map(s => s.trim()).filter(Boolean);
              if (hibSel.value === '') delete newDict.columns[col].higherIsBetter;
              else newDict.columns[col].higherIsBetter = hibSel.value === 'true';
              SolsticeStore.set('dictionary', newDict);
              SolsticeToast.success('Significado salvo');
            }
          }, 'Aplicar significado');
          content.appendChild(apply);
        } else if (activeTab === 'transf'){
          content.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-bottom:8px;' },
            'Transformações reusam o editor do Bloco 2. Acesse pelo botão ⚡ Transformar na sidebar (aba Dados).'));
          content.appendChild(SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--primary',
            onclick: () => { close(true); SolsticeToast.info('Abra Editor de colunas na aba Dados', 'Use o botão ⚡ Transformar do card da coluna ' + col); }
          }, 'Ir para Editor de colunas'));
        }
      }

      let close;
      SolsticeModal.show({
        title:'⚙️ Configurar coluna · ' + col,
        body: wrap,
        buttons: [{ label:'Fechar', kind:'primary', onClick: () => true }]
      });
      _render();
    }

    return { open };
  })();
