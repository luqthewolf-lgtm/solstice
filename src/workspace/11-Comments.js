
  /* ============================================================
     Patch Final (ADR-145) — SolsticeComments
     Comentários simples por slot. Persistem em slot.comments[].
     Visíveis em qualquer modo; modal de input acessível pelo ícone 💬.
     ============================================================ */
  const SolsticeComments = (function(){
    function list(slot){ return (slot && slot.comments) || []; }

    function _commitComments(slotId, newComments){
      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      for (const s of sections) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slotId);
        if (sl){
          sl.comments = newComments;
          SolsticeStore.set('canvas.sections', sections);
          return;
        }
      }
    }

    async function add(slotId){
      const profile = SolsticeProfiles.current();
      const text = await SolsticeModal.prompt({
        title:'💬 Novo comentário',
        message:'Anote uma observação para este componente:',
        placeholder:'Ex: Pico atípico em maio precisa investigar.'
      });
      if (!text) return;
      // Encontra slot atual + adiciona
      const sections = SolsticeStore.get('canvas.sections') || [];
      for (const s of sections) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slotId);
        if (sl){
          const existing = list(sl).slice();
          existing.push({
            id: 'cmt-' + SolsticeUtils.uuid().slice(0, 8),
            author: (profile && profile.name) || 'Visitante',
            timestamp: new Date().toISOString(),
            text,
            resolved: false
          });
          _commitComments(slotId, existing);
          SolsticeAudit.record({ action:'comment_add', target: slotId, details: { len: text.length }});
          SolsticeToast.success('Comentário adicionado');
          return;
        }
      }
    }

    function toggleResolved(slotId, commentId){
      const sections = SolsticeStore.get('canvas.sections') || [];
      for (const s of sections) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slotId);
        if (sl && sl.comments){
          const c = sl.comments.find(x => x.id === commentId);
          if (c){
            const newC = sl.comments.map(x => x.id === commentId ? Object.assign({}, x, { resolved: !x.resolved }) : x);
            _commitComments(slotId, newC);
          }
          return;
        }
      }
    }

    function remove(slotId, commentId){
      const sections = SolsticeStore.get('canvas.sections') || [];
      for (const s of sections) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slotId);
        if (sl && sl.comments){
          _commitComments(slotId, sl.comments.filter(x => x.id !== commentId));
          return;
        }
      }
    }

    function openPanel(slotId){
      // Encontra slot
      const sections = SolsticeStore.get('canvas.sections') || [];
      let slot = null;
      for (const s of sections) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slotId);
        if (sl){ slot = sl; break; }
      }
      if (!slot) return;
      const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:8px;font-size:13px;max-height:400px;overflow-y:auto;' });
      const comments = list(slot);
      if (!comments.length){
        wrap.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:12px;font-style:italic;' },
          'Nenhum comentário neste componente ainda.'));
      }
      comments.forEach(c => {
        const card = SolsticeUtils.el('div', {
          style:'padding:8px 10px;background:var(--c-surface-2);border-radius:6px;' + (c.resolved ? 'opacity:0.6;' : '')
        });
        const head = SolsticeUtils.el('div', { style:'display:flex;justify-content:space-between;font-size:11px;color:var(--c-muted);margin-bottom:4px;' });
        head.appendChild(SolsticeUtils.el('div', null, '👤 ' + c.author + ' · ' + new Date(c.timestamp).toLocaleString('pt-BR')));
        const acts = SolsticeUtils.el('div', { style:'display:flex;gap:4px;' });
        acts.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', style:'font-size:10px;padding:1px 6px;', onclick: () => { toggleResolved(slotId, c.id); openPanel(slotId); }}, c.resolved ? '↩ Reabrir' : '✓ Resolver'));
        acts.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', style:'font-size:10px;padding:1px 6px;color:var(--c-error);', onclick: () => { remove(slotId, c.id); openPanel(slotId); }}, '✕'));
        head.appendChild(acts);
        card.appendChild(head);
        card.appendChild(SolsticeUtils.el('div', { style:'font-size:12px;color:var(--c-text);line-height:1.5;' }, c.text));
        wrap.appendChild(card);
      });
      SolsticeModal.show({
        title:'💬 Comentários',
        body: wrap,
        buttons:[
          { label:'+ Novo comentário', kind:'primary', onClick: () => { add(slotId); return true; }},
          { label:'Fechar', kind:'ghost', onClick: () => true }
        ]
      });
    }

    /**
     * Bloco 13 — Diferencial #3 (ADR-148): reply em comentário (thread).
     */
    function addReply(slotId, parentId){
      return (async () => {
        const profile = SolsticeProfiles.current();
        const text = await SolsticeModal.prompt({
          title:'💬 Responder',
          message:'Sua resposta:',
          placeholder:'Escreva aqui…'
        });
        if (!text) return;
        const sections = SolsticeStore.get('canvas.sections') || [];
        for (const s of sections) for (const r of s.rows){
          const sl = r.slots.find(x => x.id === slotId);
          if (sl && sl.comments){
            const existing = sl.comments.slice();
            const parent = existing.find(c => c.id === parentId);
            if (!parent) return;
            parent.replies = (parent.replies || []).concat({
              id: 'rpl-' + SolsticeUtils.uuid().slice(0, 8),
              author: (profile && profile.name) || 'Visitante',
              timestamp: new Date().toISOString(),
              text
            });
            _commitComments(slotId, existing);
            SolsticeAudit.record({ action:'comment_reply', target: slotId, details: { parentId } });
            return;
          }
        }
      })();
    }

    /**
     * Bloco 13 — Diferencial #3 (ADR-148): listAll varre TODO o canvas
     * e retorna todos os comentários com referência ao slot/section.
     */
    function listAll(){
      const sections = SolsticeStore.get('canvas.sections') || [];
      const out = [];
      for (const sec of sections) for (const r of sec.rows) for (const sl of r.slots){
        if (sl.comments && sl.comments.length){
          sl.comments.forEach(c => {
            out.push(Object.assign({}, c, {
              slotId: sl.id,
              slotType: sl.type,
              sectionTitle: sec.title || 'Sem título'
            }));
          });
        }
      }
      return out.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    }

    function totalCount(){
      return listAll().reduce((acc, c) => acc + (c.resolved ? 0 : 1) + ((c.replies || []).length), 0);
    }

    /**
     * Bloco 13 — Diferencial #3 (ADR-148): painel global com threads + filtros.
     * Mostra TODOS os comentários do dashboard. Click leva ao componente.
     */
    function openGlobalPanel(){
      let filterAuthor = 'all';
      let filterResolved = 'open';   // 'open' | 'resolved' | 'all'
      let filterSlot = 'all';

      const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--c-text);max-height:60vh;overflow:hidden;' });

      // Barra de filtros
      const filterBar = SolsticeUtils.el('div', { style:'display:flex;gap:6px;flex-wrap:wrap;padding-bottom:6px;border-bottom:1px solid var(--c-border);' });

      function _renderFilters(){
        filterBar.innerHTML = '';
        const all = listAll();
        const authors = Array.from(new Set(all.map(c => c.author))).sort();
        const slots = Array.from(new Set(all.map(c => c.slotId)));

        // Status
        const statusSel = SolsticeUtils.el('select', { class:'solstice__props-select', style:'font-size:11px;max-width:120px;', onchange: e => { filterResolved = e.target.value; _renderList(); } });
        [['open','Abertos'],['resolved','Resolvidos'],['all','Todos']].forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value:v }, l);
          if (v === filterResolved) o.selected = true;
          statusSel.appendChild(o);
        });
        filterBar.appendChild(statusSel);

        // Autor
        if (authors.length > 1){
          const aSel = SolsticeUtils.el('select', { class:'solstice__props-select', style:'font-size:11px;max-width:130px;', onchange: e => { filterAuthor = e.target.value; _renderList(); } });
          aSel.appendChild(SolsticeUtils.el('option', { value:'all' }, 'Todos autores'));
          authors.forEach(a => {
            const o = SolsticeUtils.el('option', { value:a }, '👤 ' + a);
            if (a === filterAuthor) o.selected = true;
            aSel.appendChild(o);
          });
          filterBar.appendChild(aSel);
        }

        // Slot
        if (slots.length > 1){
          const sSel = SolsticeUtils.el('select', { class:'solstice__props-select', style:'font-size:11px;max-width:160px;', onchange: e => { filterSlot = e.target.value; _renderList(); } });
          sSel.appendChild(SolsticeUtils.el('option', { value:'all' }, 'Todos componentes'));
          slots.forEach(sid => {
            const c = all.find(x => x.slotId === sid);
            const o = SolsticeUtils.el('option', { value:sid }, (c && c.slotType ? c.slotType : '') + ' · ' + (sid || '').slice(0, 8));
            if (sid === filterSlot) o.selected = true;
            sSel.appendChild(o);
          });
          filterBar.appendChild(sSel);
        }
      }

      const listBox = SolsticeUtils.el('div', { style:'flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-top:6px;' });

      function _renderList(){
        _renderFilters();
        // Auditoria 2026 (MC-01 / HV-01): cleanup defensivo antes de repintar.
        // Hoje o render usa onclick em props, que morre com o nó; o cleanup
        // protege contra futuras adições de trackListener neste host.
        SolsticeUtils.cleanupListeners(listBox);
        listBox.innerHTML = '';
        let comments = listAll();
        if (filterResolved === 'open')     comments = comments.filter(c => !c.resolved);
        else if (filterResolved === 'resolved') comments = comments.filter(c => c.resolved);
        if (filterAuthor !== 'all') comments = comments.filter(c => c.author === filterAuthor);
        if (filterSlot !== 'all')   comments = comments.filter(c => c.slotId === filterSlot);

        if (!comments.length){
          listBox.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-style:italic;font-size:12px;padding:12px;text-align:center;' },
            'Nenhum comentário para este filtro.'));
          return;
        }

        comments.forEach(c => {
          const card = SolsticeUtils.el('div', {
            style:'padding:8px 10px;background:var(--c-surface-2);border-radius:6px;' +
                  'border-left:3px solid ' + (c.resolved ? 'var(--c-muted)' : 'var(--c-accent)') + ';' +
                  (c.resolved ? 'opacity:0.7;' : '')
          });

          // Cabeçalho: autor + timestamp + slot + ações
          const head = SolsticeUtils.el('div', { style:'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;font-size:11px;color:var(--c-muted);margin-bottom:4px;' });
          const left = SolsticeUtils.el('div', null,
            '👤 ' + c.author + ' · ' + new Date(c.timestamp).toLocaleString('pt-BR') + ' · ' +
            SolsticeUtils.el('button', {
              style:'background:none;border:none;color:var(--c-accent);font-size:11px;cursor:pointer;padding:0;text-decoration:underline;',
              onclick: () => { SolsticeProps.select(c.slotId); SolsticeToast.info('Componente selecionado', '📍 ' + c.sectionTitle); }
            }, '📍 ' + (c.sectionTitle || 'componente')).outerHTML
          );
          // Auditoria 2026 (AP-01 / HV-01): textContent escapa c.author (XSS).
          // O link é nó separado, anexado logo abaixo via appendChild.
          left.textContent = '👤 ' + c.author + ' · ' + new Date(c.timestamp).toLocaleString('pt-BR') + ' · ';
          const link = SolsticeUtils.el('button', {
            style:'background:none;border:none;color:var(--c-accent);font-size:11px;cursor:pointer;padding:0;text-decoration:underline;',
            onclick: () => { SolsticeProps.select(c.slotId); SolsticeToast.info('Componente selecionado', '📍 ' + c.sectionTitle); }
          }, '📍 ' + (c.sectionTitle || 'componente'));
          left.appendChild(link);
          head.appendChild(left);

          const acts = SolsticeUtils.el('div', { style:'display:flex;gap:3px;' });
          acts.appendChild(SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--ghost',
            style:'font-size:10px;padding:1px 6px;',
            onclick: () => { addReply(c.slotId, c.id).then(() => _renderList()); }
          }, '↩ Responder'));
          acts.appendChild(SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--ghost',
            style:'font-size:10px;padding:1px 6px;',
            onclick: () => { toggleResolved(c.slotId, c.id); _renderList(); }
          }, c.resolved ? 'Reabrir' : '✓ Resolver'));
          acts.appendChild(SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--ghost',
            style:'font-size:10px;padding:1px 6px;color:var(--c-error);',
            onclick: () => { remove(c.slotId, c.id); _renderList(); }
          }, '✕'));
          head.appendChild(acts);
          card.appendChild(head);

          // Texto principal
          card.appendChild(SolsticeUtils.el('div', { style:'font-size:12px;color:var(--c-text);line-height:1.5;margin-bottom:4px;' }, c.text));

          // Threads (replies)
          if ((c.replies || []).length){
            const thread = SolsticeUtils.el('div', { style:'margin-left:12px;padding-left:8px;border-left:2px solid var(--c-border);display:flex;flex-direction:column;gap:4px;margin-top:6px;' });
            c.replies.forEach(rp => {
              const rEl = SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-text-2);' });
              rEl.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:10px;margin-bottom:2px;' },
                '↩ 👤 ' + rp.author + ' · ' + new Date(rp.timestamp).toLocaleString('pt-BR')));
              rEl.appendChild(SolsticeUtils.el('div', { style:'line-height:1.4;' }, rp.text));
              thread.appendChild(rEl);
            });
            card.appendChild(thread);
          }

          listBox.appendChild(card);
        });
      }

      wrap.appendChild(filterBar);
      wrap.appendChild(listBox);
      _renderList();

      SolsticeModal.show({
        title:'💬 Comentários do dashboard (' + totalCount() + ')',
        body: wrap,
        buttons:[
          { label:'Exportar threads (markdown)', kind:'ghost', onClick: () => {
            const md = listAll().map(c => {
              let s = '## ' + (c.sectionTitle || 'componente') + ' · ' + c.author + '\n';
              s += '_' + new Date(c.timestamp).toLocaleString('pt-BR') + (c.resolved ? ' · ✓ resolvido' : '') + '_\n\n';
              s += c.text + '\n';
              (c.replies || []).forEach(rp => {
                s += '\n> **' + rp.author + '** (' + new Date(rp.timestamp).toLocaleString('pt-BR') + '): ' + rp.text;
              });
              return s;
            }).join('\n\n---\n\n');
            const blob = new Blob([md], { type:'text/markdown' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'comentarios-' + Date.now() + '.md';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 200);
            SolsticeToast.success('Threads exportados');
            return false;
          }},
          { label:'Fechar', kind:'primary', onClick: () => true }
        ]
      });
    }

    return { list, add, addReply, toggleResolved, remove, openPanel, openGlobalPanel, listAll, totalCount };
  })();
