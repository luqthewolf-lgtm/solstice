
  /** Prompt 11 v5.4 — UI da tab bar de páginas. */
  const SolsticePagesUI = (function(){
    function render(){
      const host = document.getElementById('pages-tabbar');
      if (!host) return;
      const pages = SolsticePages.list();
      const activeId = SolsticePages.activeId();
      // Audit Fix 9: tab bar SEMPRE visível (affordance de multi-página).
      // Antes, ficava oculta se havia 1 página vazia — Júlia/Marcos/Camila
      // não descobriam que era multi-página. Agora aparece sempre com pelo menos
      // a página atual + botão "+".
      // Exceção: ao abrir o app SEM dataset (canvas vazio total), continua oculto
      // pra não confundir no welcome screen.
      const dsReady = !!SolsticeStore.get('dataset.ready');
      if (!dsReady){
        host.style.display = 'none';
        return;
      }
      host.style.display = '';
      // Auditoria 2026 (MC-01): cleanup defensivo. Tab bar é repintada em cada
      // mudança de página; sem cleanup, qualquer listener trackeado vazaria.
      SolsticeUtils.cleanupListeners(host);
      host.innerHTML = '';

      pages.forEach((p, idx) => {
        const tab = SolsticeUtils.el('button', {
          type:'button',
          class:'solstice__page-tab' + (p.id === activeId ? ' is-active' : ''),
          title:'Clique pra ir · Right-click pra opções',
          'data-page-id': p.id,
          onclick: () => SolsticePages.switchTo(p.id),
          oncontextmenu: (e) => {
            e.preventDefault();
            _openPageMenu(p.id, e.clientX, e.clientY);
          }
        });
        tab.appendChild(SolsticeUtils.el('span', { class:'solstice__page-tab-icon' }, p.icon || '📄'));
        tab.appendChild(SolsticeUtils.el('span', { class:'solstice__page-tab-name' }, p.name));
        if (p.id === activeId){
          tab.appendChild(SolsticeUtils.el('span', {
            class:'solstice__page-tab-menu',
            title:'Opções da página',
            onclick: (e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              _openPageMenu(p.id, rect.left, rect.bottom);
            }
          }, '⋯'));
        }
        host.appendChild(tab);
      });

      // Botão "+" pra criar nova página
      // B1-05 (v6-autonomous): label "+ Nova página" mais convidativo + tooltip com atalho
      const plusBtn = SolsticeUtils.el('button', {
        type:'button',
        class:'solstice__page-tab-add',
        title:'Criar nova página (Ctrl+Shift+T)',
        'aria-label':'Nova página',
        onclick: async () => _createPagePrompt()
      });
      plusBtn.appendChild(SolsticeUtils.el('span', { style:'font-size:14px;margin-right:4px;' }, '+'));
      plusBtn.appendChild(SolsticeUtils.el('span', { style:'font-size:11px;font-weight:400;' }, 'Nova página'));
      host.appendChild(plusBtn);
    }

    async function _createPagePrompt(){
      const name = await SolsticeModal.prompt({
        title:'Nova página',
        message:'Nome da página:',
        placeholder:'Ex: Outliers, Detalhe, Anomalias',
        defaultValue:'Página ' + (SolsticePages.list().length + 1)
      });
      if (!name) return;
      SolsticePages.create({ name: name.trim() });
      SolsticeToast.success('Página criada', name);
      render();
    }

    function _openPageMenu(pageId, x, y){
      // Fecha menus anteriores
      document.querySelectorAll('.solstice__page-menu-popup').forEach(el => el.remove());
      const pop = SolsticeUtils.el('div', {
        class:'solstice__page-menu-popup',
        style:'position:fixed;left:' + Math.max(8, x) + 'px;top:' + Math.max(8, y) + 'px;z-index:9999;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--rad-sm);box-shadow:var(--solstice-shadow-lg);padding:4px;min-width:180px;'
      });
      function item(label, icon, fn, danger){
        const b = SolsticeUtils.el('button', {
          type:'button',
          style:'display:flex;align-items:center;gap:8px;padding:6px 10px;width:100%;background:transparent;border:none;cursor:pointer;font-size:12px;color:' + (danger ? 'var(--c-error)' : 'var(--c-text)') + ';text-align:left;',
          onclick: () => { pop.remove(); fn(); }
        });
        b.appendChild(SolsticeUtils.el('span', null, icon));
        b.appendChild(SolsticeUtils.el('span', null, label));
        b.addEventListener('mouseenter', () => { b.style.background = 'var(--c-surface-2)'; });
        b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
        return b;
      }
      pop.appendChild(item('Renomear', '✏️', async () => {
        const cur = SolsticePages.list().find(p => p.id === pageId);
        const newName = await SolsticeModal.prompt({
          title:'Renomear página',
          message:'Novo nome:',
          defaultValue: cur ? cur.name : ''
        });
        if (!newName) return;
        SolsticePages.rename(pageId, newName.trim());
        SolsticeToast.success('Renomeada', newName);
        render();
      }));
      pop.appendChild(item('Duplicar', '📋', () => {
        SolsticePages.duplicate(pageId);
        SolsticeToast.success('Página duplicada');
        render();
      }));
      const pages = SolsticePages.list();
      const idx = pages.findIndex(p => p.id === pageId);
      if (idx > 0){
        pop.appendChild(item('Mover esquerda', '←', () => {
          SolsticePages.reorder(pageId, idx - 1);
          render();
        }));
      }
      if (idx < pages.length - 1){
        pop.appendChild(item('Mover direita', '→', () => {
          SolsticePages.reorder(pageId, idx + 1);
          render();
        }));
      }
      if (pages.length > 1){
        pop.appendChild(item('Excluir', '🗑️', async () => {
          const cur = pages.find(p => p.id === pageId);
          const ok = await SolsticeModal.confirm({
            title:'Excluir página',
            message:'Excluir "' + (cur ? cur.name : 'página') + '"? Esta ação não pode ser desfeita.',
            confirmLabel:'Excluir',
            danger: true
          });
          if (!ok) return;
          SolsticePages.remove(pageId);
          render();
        }, true));
      }

      document.body.appendChild(pop);
      // Fecha ao clicar fora — Auditoria 2026 (MC-01 / HV-02): trackListener.
      setTimeout(() => {
        const handler = (e) => {
          if (!pop.contains(e.target)){
            SolsticeUtils.cleanupListeners(pop);
            pop.remove();
          }
        };
        SolsticeUtils.trackListener(pop, document, 'click', handler);
      }, 10);
    }

    // Re-render quando canvas muda (sincroniza após switch/create/remove)
    try {
      SolsticeStore.subscribe('canvas', () => { try { render(); } catch(_){} });
    } catch(_){}

    /** B1-05 (v6-autonomous): atalhos de teclado pra navegação multi-página.
        Ctrl+Shift+T → nova página
        Ctrl+Alt+→ / ← → próxima / anterior página
        Ctrl+1..9 → vai pra Nésima página */
    function initKeyboard(){
      document.addEventListener('keydown', (e) => {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.target && e.target.isContentEditable) return;
        // Sem dataset, não faz sentido
        if (!SolsticeStore.get('dataset.ready')) return;
        // Sem modais abertos
        if (document.querySelector('.solstice__modal-overlay')) return;

        // Ctrl+Shift+T → nova página
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'T' || e.key === 't')){
          e.preventDefault();
          _createPagePrompt();
          return;
        }
        // Ctrl+Alt+→ / Ctrl+Alt+← → próxima / anterior
        if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')){
          e.preventDefault();
          const pages = SolsticePages.list();
          const cur = SolsticePages.activeId();
          const idx = pages.findIndex(p => p.id === cur);
          if (idx < 0) return;
          const next = e.key === 'ArrowRight'
            ? pages[(idx + 1) % pages.length]
            : pages[(idx - 1 + pages.length) % pages.length];
          if (next) { SolsticePages.switchTo(next.id); render(); }
          return;
        }
        // Ctrl+1..9 → ir pra Nésima página
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)){
          const pages = SolsticePages.list();
          const idx = parseInt(e.key, 10) - 1;
          if (pages[idx]) { e.preventDefault(); SolsticePages.switchTo(pages[idx].id); render(); }
        }
      });
    }

    return { render, _openPageMenu, initKeyboard, createPagePrompt: _createPagePrompt };
  })();
