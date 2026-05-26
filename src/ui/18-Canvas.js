
  /* ============================================================
     SolsticeCanvas — Section/Row/Slot CRUD + render reativo

     Estado: Store.canvas.sections = [
       { id, title, rows: [
         { id, layout, slots: [{ id, type:'empty' }, ...] }
       ]}
     ]
     ============================================================ */
  const SolsticeCanvas = (function(){

    const PATH = 'canvas.sections';

    function _get(){ return SolsticeStore.get(PATH) || []; }
    function _set(arr){ SolsticeStore.set(PATH, arr); }

    /* Code Review 2026 (#2/#4): helpers para o padrão repetido em 76+ sites:
       const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
       for (const s of sections) for (const r of s.rows){
         const sl = r.slots.find(x => x.id === slotId);
         if (sl){ ...; SolsticeStore.set('canvas.sections', sections); }
       }

       Centralizar tem 3 benefícios:
       - elimina duplicação massiva
       - facilita otimizar (ex: cache slotId -> {sec, row} se virar gargalo)
       - obriga padrão "clone + mutate + commit" (vs mutar referência viva)
    */

    /** Edita o array de sections em um lugar só: clona, deixa o mutator
        mexer, e persiste no Store. Se mutator retorna false, NÃO persiste
        (útil pra abortar). Retorna o que o mutator retornou (ou o array). */
    function _editSections(mutator){
      const sections = SolsticeUtils.deepClone(_get());
      const r = mutator(sections);
      if (r === false) return false;
      _set(sections);
      return r === undefined ? sections : r;
    }

    /** Acha um slot pelo id e roda mutator(slot, row, section). Persiste se
        encontrou (e mutator não retornou false). Retorna true se achou. */
    function withSlot(slotId, mutator){
      let found = false;
      const r = _editSections(sections => {
        for (const s of sections){
          for (const row of s.rows){
            const sl = row.slots.find(x => x.id === slotId);
            if (sl){
              found = true;
              return mutator(sl, row, s);  // false aborta
            }
          }
        }
        return false; // não achou — não persiste
      });
      return found && r !== false;
    }

    /** Versão read-only: acha o slot e roda inspector. Sem clone, sem set. */
    function findSlot(slotId){
      const sections = _get();
      for (const s of sections){
        for (const row of s.rows){
          const sl = row.slots.find(x => x.id === slotId);
          if (sl) return { slot: sl, row, section: s };
        }
      }
      return null;
    }

    function _newSection(title){
      return {
        id: SolsticeUtils.uuid(),
        title: title || 'Nova seção',
        rows: [_newRow('1col')]
      };
    }
    function _newRow(layout){
      layout = layout || '1col';
      const count = SolsticeLayouts.slotCount(layout);
      return {
        id: SolsticeUtils.uuid(),
        layout,
        slots: Array.from({ length: count }, () => ({ id: SolsticeUtils.uuid(), type: 'empty' }))
      };
    }

    function addSection(title){
      const all = _get().slice();
      all.push(_newSection(title));
      _set(all);
    }

    function removeSection(secId){
      _set(_get().filter(s => s.id !== secId));
    }

    function duplicateSection(secId){
      const all = _get();
      const idx = all.findIndex(s => s.id === secId);
      if (idx < 0) return;
      const clone = SolsticeUtils.deepClone(all[idx]);
      clone.id = SolsticeUtils.uuid();
      clone.title = clone.title + ' (cópia)';
      clone.rows.forEach(r => {
        r.id = SolsticeUtils.uuid();
        r.slots.forEach(s => s.id = SolsticeUtils.uuid());
      });
      const next = all.slice();
      next.splice(idx + 1, 0, clone);
      _set(next);
    }

    function moveSection(secId, delta){
      const all = _get().slice();
      const idx = all.findIndex(s => s.id === secId);
      if (idx < 0) return;
      const next = idx + delta;
      if (next < 0 || next >= all.length) return;
      [all[idx], all[next]] = [all[next], all[idx]];
      _set(all);
    }

    function setSectionTitle(secId, title){
      const all = _get().slice();
      const sec = all.find(s => s.id === secId);
      if (!sec) return;
      sec.title = title;
      _set(all);
    }

    function addRow(secId, layout, afterRowId){
      const all = _get().slice();
      const sec = all.find(s => s.id === secId);
      if (!sec) return;
      const row = _newRow(layout);
      if (afterRowId){
        const idx = sec.rows.findIndex(r => r.id === afterRowId);
        sec.rows.splice(idx + 1, 0, row);
      } else {
        sec.rows.push(row);
      }
      _set(all);
    }

    function removeRow(secId, rowId){
      const all = _get().slice();
      const sec = all.find(s => s.id === secId);
      if (!sec) return;
      sec.rows = sec.rows.filter(r => r.id !== rowId);
      if (sec.rows.length === 0) sec.rows.push(_newRow('1col'));
      _set(all);
    }

    function duplicateRow(secId, rowId){
      const all = _get().slice();
      const sec = all.find(s => s.id === secId);
      if (!sec) return;
      const idx = sec.rows.findIndex(r => r.id === rowId);
      if (idx < 0) return;
      const clone = SolsticeUtils.deepClone(sec.rows[idx]);
      clone.id = SolsticeUtils.uuid();
      clone.slots.forEach(s => s.id = SolsticeUtils.uuid());
      sec.rows.splice(idx + 1, 0, clone);
      _set(all);
    }

    /** ADR-174 (Fix-6 v5.5 · Auditoria 2026.4): moveRow ↑↓ dentro da seção.
     *  Reordenação de linha (mover linha pro topo da seção) era anteriormente
     *  apenas drag-drop — agora também tem ações explícitas ↑↓ no header da row.
     *  Mesmo padrão de moveSection. delta: -1 sobe, +1 desce. */
    function moveRow(secId, rowId, delta){
      const all = _get().slice();
      const sec = all.find(s => s.id === secId);
      if (!sec) return;
      const idx = sec.rows.findIndex(r => r.id === rowId);
      if (idx < 0) return;
      const target = idx + delta;
      if (target < 0 || target >= sec.rows.length) return;
      // swap
      const tmp = sec.rows[target];
      sec.rows[target] = sec.rows[idx];
      sec.rows[idx] = tmp;
      _set(all);
      try { SolsticeAudit.record({ action:'move_row', target: rowId, details:{ secId, delta, from: idx, to: target } }); } catch(_){}
    }

    /**
     * Patch 1A (ADR-093): wrapper que preserva o modo atual após operações
     * estruturais que disparam re-render (template, layout, dicionário).
     */
    function _preserveMode(fn){
      const prev = (typeof SolsticeModes !== 'undefined') ? SolsticeModes.current() : null;
      const r = fn();
      if (prev && typeof SolsticeModes !== 'undefined' && SolsticeModes.current() !== prev){
        SolsticeModes.set(prev);
      }
      return r;
    }

    function changeRowLayout(secId, rowId, newLayout){
      return _preserveMode(() => {
        const all = _get().slice();
        const sec = all.find(s => s.id === secId);
        if (!sec) return;
        const row = sec.rows.find(r => r.id === rowId);
        if (!row) return;
        SolsticeLayouts.reslot(row, newLayout);
        _set(all);
      });
    }

    /** Insere estrutura completa vinda de um template (lista de sections). */
    function applyTemplate(templateSections){
      return _preserveMode(() => {
        const all = _get().slice();
        templateSections.forEach(s => {
          const sec = SolsticeUtils.deepClone(s);
          sec.id = SolsticeUtils.uuid();
          sec.rows.forEach(r => {
            r.id = SolsticeUtils.uuid();
            r.slots.forEach(sl => sl.id = SolsticeUtils.uuid());
          });
          all.push(sec);
        });
        _set(all);
      });
    }

    function clear(){ _set([]); }

    /* ===== RENDER ===== */

    // Auditoria 2026.6 (SMOOTH-UPDATE): quando só a CONFIG de 1 componente muda
    // (via inspector), _updateConfig marca o slot aqui — o render re-pinta SÓ
    // aquele componente in place, sem o "mini refresh" (wipe+rebuild) do canvas
    // inteiro. Estrutura (seções/linhas/slots/tipos/layout) não muda em config-only.
    let _configOnlySlot = null;
    function noteConfigOnly(slotId){ _configOnlySlot = slotId; }

    function render(){
      const canvas = document.querySelector('.solstice__canvas');
      if (!canvas) return;
      const sections = _get();
      // Auditoria 2026.6 (SCROLL-ANCHOR): preserva a posição de scroll do canvas
      // através do re-render. ANTES, a cada mudança o conteúdo "subia de pouco em
      // pouco" — porque os gráficos renderizam async (rAF) e o scroll era
      // clampado ANTES da altura total existir, escorregando pra cima e acumulando.
      // Restaura o scrollTop DEPOIS dos gráficos assentarem (rAF + timeout).
      const _savedScroll = canvas.scrollTop;
      const _restoreScroll = () => { if (canvas && _savedScroll > 0 && Math.abs(canvas.scrollTop - _savedScroll) > 1) { try { canvas.scrollTop = _savedScroll; } catch(_){} } };
      const _restoreSoon = () => {
        _restoreScroll();
        requestAnimationFrame(() => { _restoreScroll(); requestAnimationFrame(_restoreScroll); });
        setTimeout(_restoreScroll, 90);
        setTimeout(_restoreScroll, 220);
      };
      // Re-render cirúrgico de 1 slot (sem repintar toolbar/filtros/insights/outras seções)
      if (_configOnlySlot){
        const id = _configOnlySlot; _configOnlySlot = null;
        const slotEl = canvas.querySelector('.solstice__slot[data-id="' + id + '"]');
        if (slotEl){
          let slot = null;
          sections.forEach(s => (s.rows || []).forEach(r => (r.slots || []).forEach(sl => { if (sl.id === id) slot = sl; })));
          if (slot && slot.type && slot.type !== 'empty'){
            try {
              slotEl.style.display = 'block'; slotEl.style.padding = '0';
              slotEl.style.background = 'transparent'; slotEl.style.border = '0'; slotEl.style.cursor = 'default';
              // Auditoria 2026.6 (NO-FLASH): DOUBLE-BUFFER. Em vez de innerHTML=''
              // (frame em branco → o canvas "pisca"), renderiza o novo componente
              // POR CIMA (absolute, ocupando o mesmo box) e só remove o antigo no
              // próximo frame, quando o novo já desenhou. Sem piscada no olho.
              const _prev = Array.from(slotEl.childNodes);
              slotEl.style.position = 'relative';
              const _buf = document.createElement('div');
              _buf.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;';
              slotEl.appendChild(_buf);
              SolsticeComponents.render(slot, _buf);
              requestAnimationFrame(() => requestAnimationFrame(() => {
                try { _prev.forEach(n => { try { SolsticeUtils.cleanupListeners(n); } catch(_){} if (n.remove) n.remove(); }); } catch(_){}
                _buf.style.position = ''; _buf.style.top = _buf.style.left = _buf.style.right = _buf.style.bottom = '';
                _restoreScroll();
              }));
              return; // pronto — resto do canvas intacto, sem flash
            } catch(e){ /* erro → cai pro full render abaixo */ }
          }
        }
        // não achou o slot no DOM → full render (ex: componente recém-adicionado)
      }
      const dsReady = SolsticeStore.get('dataset.ready');
      // Auditoria 2026 (MC-01): cleanup defensivo antes de repintar canvas.
      // O canvas é o host mais repintado do app; sem cleanup, qualquer listener
      // trackeado vazaria a cada drag/drop de componente.
      SolsticeUtils.cleanupListeners(canvas);
      canvas.innerHTML = '';

      // B12-r1 (ADR-092) + Patch 1A (ADR-090): marca canvas como empty / body como blank
      const isEmpty = sections.length === 0;
      canvas.classList.toggle('solstice__canvas--empty', isEmpty);
      document.body.classList.toggle('solstice-blank', isEmpty);

      // Patch B5-r4 / ADR-046 + Sprint 23 / UX-02: cabeçalho customizável acima
      // da toolbar. Recebe isEmpty pra ocultar "Dashboard sem título" no welcome.
      if (typeof SolsticeDashHeader !== 'undefined') SolsticeDashHeader.renderInto(canvas, { isEmpty });

      // Toolbar do canvas (sempre presente no DOM; CSS esconde quando empty)
      canvas.appendChild(_renderToolbar(sections.length));

      // B12-r1: Cross-filter / Filtros / Insights só renderizam se há sections E dataset
      if (!isEmpty && dsReady){
        if (typeof SolsticeCrossFilter !== 'undefined') SolsticeCrossFilter.renderInto(canvas);
        if (typeof SolsticeFilters !== 'undefined') SolsticeFilters.renderInto(canvas);
        // S6-01 (Sprint 6): Insights Executivo renderiza ACIMA dos insights regulares
        if (typeof SolsticeExecutiveInsights !== 'undefined') SolsticeExecutiveInsights.renderInto(canvas);
        if (typeof SolsticeInsights !== 'undefined') SolsticeInsights.renderInto(canvas);
        // Sprint 26 / F-23: Resumo executivo agora aparece INLINE no canvas
        // (não só em modal). User reportou que ficava escondido em modal —
        // queria ver direto. Painel colapsável.
        if (typeof SolsticeNarrative !== 'undefined' && SolsticeNarrative.renderSummaryInto){
          SolsticeNarrative.renderSummaryInto(canvas);
        }
      }

      if (isEmpty){
        canvas.appendChild(_renderEmptyState());
        return;
      }

      sections.forEach((sec, secIdx) => canvas.appendChild(_renderSection(sec, secIdx, sections.length)));
      // Auditoria 2026.6 (SCROLL-ANCHOR): restaura o scroll DEPOIS dos componentes
      // (charts assíncronos) terem altura — impede o "subir de pouco em pouco".
      _restoreSoon();
    }

    function _renderToolbar(count){
      const hasDataset = SolsticeStore.get('dataset.ready');
      const undoBtn = SolsticeUtils.el('button', {
        id:'btn-undo', class:'solstice__btn solstice__btn--icon', title:'Desfazer · Ctrl+Z',
        'aria-label':'Desfazer última ação',
        onclick: () => SolsticeUndo.undo()
      }, '↺');
      const redoBtn = SolsticeUtils.el('button', {
        id:'btn-redo', class:'solstice__btn solstice__btn--icon', title:'Refazer · Ctrl+Shift+Z',
        'aria-label':'Refazer ação desfeita',
        onclick: () => SolsticeUndo.redo()
      }, '↻');
      if (!SolsticeUndo.canUndo()) undoBtn.disabled = true;
      if (!SolsticeUndo.canRedo()) redoBtn.disabled = true;
      // Fix 3 (Camada 1 polish): toolbar ENXUTA — só ações de CONSTRUÇÃO do dashboard.
      // Arquivo/Salvar/Exportar foram movidos pro header global como dropdowns (Fix 2).
      // Linha única, sem distinção macro/micro inventada. Tudo o que você usa
      // ENQUANTO constrói o dashboard fica aqui acessível.
      const btn = (opts, label) => SolsticeUtils.el('button', Object.assign({ class:'solstice__btn' }, opts), label);
      const group = (children) => {
        const g = SolsticeUtils.el('div', { class:'solstice__toolbar-group' });
        children.filter(Boolean).forEach(c => g.appendChild(c));
        return g;
      };

      const cntComments = hasDataset ? SolsticeComments.totalCount() : 0;

      // Grupo 1: Estrutura (+ Seção / Templates)
      const grpEstrutura = group([
        btn({ class:'solstice__btn solstice__btn--primary', title:'Adicionar nova seção', 'aria-label':'Adicionar nova seção', onclick: () => addSection() }, '+ Seção'),
        btn({ title:'Aplicar template pronto', 'aria-label':'Escolher template', onclick: () => SolsticeTemplates.openPicker() }, '🗂️ Templates')
      ]);

      // Grupo 2: Inteligência (Auto / Wizard / Resumo / Comentários)
      const grpIA = group([
        hasDataset ? btn({ class:'solstice__btn solstice__btn--primary', title:'Auto-Dashboard — analisa o dataset e sugere componentes', 'aria-label':'Gerar dashboard automaticamente', onclick: () => SolsticeAutoDashboard.run({ force: true }) }, '🪄 Auto') : null,
        hasDataset ? btn({ title:'Wizard guiado — escolha uma intenção', 'aria-label':'Abrir wizard', onclick: () => SolsticeWizard.open() }, '🧙 Wizard') : null,
        hasDataset ? btn({ title:'Resumo executivo do dashboard (markdown)', 'aria-label':'Resumo executivo', onclick: () => SolsticeNarrative.openDashboardSummary() }, '📖 Resumo') : null,
        hasDataset ? btn({ title:'Comentários do dashboard (threads + filtros + export)', 'aria-label':'Comentários', onclick: () => SolsticeComments.openGlobalPanel() }, cntComments ? '💬 ' + cntComments : '💬') : null
      ]);

      // Grupo 3: Personalização (Cabeçalho / Parâmetros)
      // Preview removido: agora vive na aba Dados (sidebar) como botão "📋 Abrir Tabela completa"
      const grpPersonalizar = group([
        btn({ title:'Configurar cabeçalho visual do dashboard', 'aria-label':'Configurar cabeçalho', onclick: () => SolsticeDashHeader.openConfig() }, '📋 Cabeçalho'),
        btn({ title:'Parâmetros globais ({{param.X}})', 'aria-label':'Parâmetros', onclick: () => SolsticeParams.openModal() }, '🎛️ Parâmetros')
      ]);

      // Grupo 4: Edição (Undo/Redo)
      const grpEdicao = group([undoBtn, redoBtn]);

      const actionsRow = SolsticeUtils.el('div',
        { class:'solstice__canvas-toolbar-actions',
          role:'toolbar', 'aria-label':'Ações de construção do dashboard' },
        grpEstrutura, grpIA, grpPersonalizar, grpEdicao
      );

      return SolsticeUtils.el('div', { class:'solstice__canvas-toolbar' },
        actionsRow,
        SolsticeUtils.el('div', { class:'solstice__canvas-toolbar-meta' },
          count + (count === 1 ? ' seção' : ' seções'))
      );
    }

    /**
     * Welcome screen B12-r1 (ADR-092):
     * Layout compacto — brand grande + 2 botões primários + divisor + templates inline.
     * Nunca causa scroll na tela (max-height calc(100vh - 160px) + overflow hidden).
     */
    function _renderEmptyState(){
      const wrap = SolsticeUtils.el('div', { class:'solstice__canvas-empty solstice__welcome' });
      const ds = SolsticeStore.get('dataset.ready');
      // Auditoria 2026.2 (BR-A1): "Carregar exemplo" agora visível por padrão.
      // O super prompt e a Fase C mostraram que ofuscar o exemplo prejudica a
      // primeira impressão — usuários sem CSV à mão (Camila, Wesley, Henrique
      // avaliando) abandonam. Pra desabilitar, use settings.hideExampleButton.
      const showExample = SolsticeStore.get('settings.hideExampleButton') !== true;
      if (!ds){
        // S4-05 (Sprint 4 / Lucas + Vanessa/Airbnb · VC-01): welcome sem dataset
        // tem AGORA UMA hierarquia clara: 1 CTA gigante "Importar". Chat de perguntas
        // foi removido daqui — sem dado, "perguntar" não faz sentido (resposta seria
        // sempre "importe primeiro"). Chat volta quando dataset.ready vira true.
        wrap.appendChild(SolsticeUtils.el('div', { style:'font-size:42px;line-height:1;margin-bottom:var(--sp-2);' }, '🌗'));
        wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-brand' }, 'Solstice'));
        wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-sub' },
          'Importe seu CSV pra começar. Tudo roda local no seu navegador.'));

        // B7-03 (v6-autonomous / OB-04 — Cláudia/Stone): link discreto pra tutorial.
        // Sem video embeddado (CSP bloqueia iframes externos por design) — link
        // pro YouTube + alternativa "Tour interativo" pra usuário que prefere
        // aprender clicando.
        const tutorialRow = SolsticeUtils.el('div', {
          style:'display:flex;align-items:center;gap:var(--sp-3);margin-top:var(--sp-2);font-size:var(--fs-xs);color:var(--c-muted);justify-content:center;flex-wrap:wrap;'
        });
        tutorialRow.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true' }, '🎬'));
        tutorialRow.appendChild(SolsticeUtils.el('span', null, 'Nunca usou? '));
        const tourLink = SolsticeUtils.el('button', {
          type:'button',
          style:'background:transparent;border:none;color:var(--c-accent);cursor:pointer;text-decoration:underline;font-size:inherit;padding:0;',
          onclick: () => { try { SolsticeTour.start(); } catch(_){} }
        }, 'tour interativo (1 min)');
        tutorialRow.appendChild(tourLink);
        tutorialRow.appendChild(SolsticeUtils.el('span', null, '·'));
        const helpLink = SolsticeUtils.el('button', {
          type:'button',
          style:'background:transparent;border:none;color:var(--c-accent);cursor:pointer;text-decoration:underline;font-size:inherit;padding:0;',
          onclick: () => { try { SolsticeOnboarding.show(); } catch(_){} }
        }, 'ver onboarding');
        tutorialRow.appendChild(helpLink);
        wrap.appendChild(tutorialRow);

        // ===== Cards de import (2 padrão · 3 com exemplo se showExample) =====
        const paths = SolsticeUtils.el('div', { class:'solstice__welcome-paths' });

        // (a) IMPORTAR NORMAL (com modais de filtro/dicionário) — primary
        const pathA = SolsticeUtils.el('button', {
          class:'solstice__welcome-path solstice__welcome-path--primary',
          type:'button',
          'aria-label':'Importar CSV com fluxo padrão (filtro + dicionário)',
          onclick: () => {
            const fileInput = document.getElementById('file-input');
            fileInput.removeAttribute('data-express-once');  // garante fluxo normal
            fileInput.click();
          }
        });
        pathA.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-icon' }, '📁'));
        pathA.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-title' }, 'Importar CSV'));
        pathA.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-desc' },
          'Você revisa colunas e dicionário antes do dashboard. Mais controle.'));
        pathA.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-cta' }, '📁 Importar →'));
        paths.appendChild(pathA);

        // (b) IMPORTAR EXPRESS (pula etapas) — agora OPCIONAL
        const pathExp = SolsticeUtils.el('button', {
          class:'solstice__welcome-path',
          type:'button',
          'aria-label':'Importar CSV em modo Express (pula etapas)',
          onclick: () => {
            const fileInput = document.getElementById('file-input');
            fileInput.setAttribute('data-express-once', 'true');
            fileInput.click();
          }
        });
        pathExp.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-icon' }, '⚡'));
        pathExp.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-title' }, 'Importar Express'));
        pathExp.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-desc' },
          'Importa e monta dashboard sozinho. Pula os modais. Mais rápido.'));
        pathExp.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-cta' }, '⚡ Importar Express →'));
        paths.appendChild(pathExp);

        // (c) Exemplo — Auditoria 2026.2 (BR-A1): default ativo. Permite que
        // usuário veja o produto funcionando antes de buscar CSV próprio.
        // Dados sintéticos, marcados claramente como "exemplo".
        if (showExample){
          const pathB = SolsticeUtils.el('button', {
            class:'solstice__welcome-path',
            type:'button',
            'aria-label':'Carregar dataset de exemplo (vendas sintéticas) e ver Auto-Dashboard',
            title:'Carrega um CSV sintético de vendas + AutoDash automático — pra você ver o produto sem precisar de dados próprios',
            onclick: () => {
              _loadDummyDataset();
              setTimeout(() => {
                try { SolsticeAutoDashboard.run({ silent: true }); }
                catch (e) { /* silencioso */ }
              }, 700);
            }
          });
          pathB.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-icon' }, '✨'));
          pathB.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-title' }, 'Ver com dataset de exemplo'));
          pathB.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-desc' },
            'Vendas BR sintéticas + Auto-Dashboard em 1 clique. Pra explorar sem precisar de CSV próprio.'));
          pathB.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-path-cta' }, '✨ Explorar →'));
          paths.appendChild(pathB);
        }
        wrap.appendChild(paths);

        // Presets de domínio (secondary — colapsado por <details>)
        const presets = SolsticeDictionary.presets || {};
        const presetEntries = Object.entries(presets).filter(([k]) => k !== 'generico').slice(0, 6);
        if (presetEntries.length && showExample){
          // só mostra presets de domínio em dev-mode (carregam dummy)
          const collapse = SolsticeUtils.el('details', { class:'solstice__welcome-presets-collapse' });
          collapse.appendChild(SolsticeUtils.el('summary', { class:'solstice__welcome-presets-summary' },
            'Ou comece com um domínio (carrega exemplo + dicionário · dev)'));
          const grid = SolsticeUtils.el('div', { class:'solstice__welcome-templates' });
          presetEntries.forEach(([key, p]) => {
            const card = SolsticeUtils.el('button', {
              class:'solstice__welcome-template', type:'button',
              title:'Carrega exemplo + aplica dicionário ' + (p.name || key),
              onclick: () => {
                _loadDummyDataset();
                setTimeout(() => {
                  SolsticeStore.set('dictionary', { ...p, name: p.name, _presetKey: key });
                  SolsticeToast.info('Dicionário aplicado', p.name);
                }, 300);
              }
            });
            card.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-template-icon' }, p.emoji || '🧠'));
            card.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-template-name' }, (p.name || key).split('—')[0].trim()));
            grid.appendChild(card);
          });
          collapse.appendChild(grid);
          wrap.appendChild(collapse);
        }
        return wrap;
      }
      // HOTFIX v5.5 (Auditoria 2026.4): consolidação do welcome — antes havia 2 telas
      // Dataset carregado + sem sections → enxuto: chat compacto + templates direto.
      // SEM hero gigante repetido. Pessoa já passou pelo welcome, agora quer
      // construir. Foco em ação, não decoração.
      const datasetName = SolsticeStore.get('dataset.name') || 'dataset';
      const ingestSummary = SolsticeStore.get('ingest');
      const nRows = ingestSummary ? (ingestSummary.rows || []).length : 0;
      const nCols = ingestSummary ? (ingestSummary.columns || []).length : 0;
      // Mini-header indicando que dataset já está pronto
      wrap.appendChild(SolsticeUtils.el('div', {
        style:'display:flex;align-items:center;gap:8px;margin-bottom:var(--sp-3);font-size:var(--fs-sm);color:var(--c-muted);'
      },
        SolsticeUtils.el('span', { style:'font-size:18px;' }, '✓'),
        SolsticeUtils.el('span', null, datasetName + ' carregado — ' +
          SolsticeLocale.integer(nRows) + ' linhas · ' + nCols + ' colunas')
      ));
      wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-brand', style:'font-size:24px;margin-bottom:8px;' },
        'Monte automaticamente, escolha um template ou pergunte'));

      // Auditoria 2026.6 — opção "Auto" em 1 clique já no começo (empty-state),
      // espelhando o topo do picker de Templates. Pedido do usuário: pegar o
      // Auto direto, sem criar template e apagar depois. Mais proeminente que
      // os cards de template porque é o caminho mais rápido pro "wow".
      const autoCta = SolsticeUtils.el('button', {
        type:'button',
        class:'solstice__auto-cta',
        style:'max-width:640px;margin:0 auto var(--sp-3);',
        title:'A IA analisa a base e monta o dashboard inteiro automaticamente',
        onclick: () => {
          try { if (typeof SolsticeAutoDashboard !== 'undefined') SolsticeAutoDashboard.run({ force: true }); }
          catch(e){ SolsticeLog.warn('[empty-state] auto falhou', e); }
        }
      });
      autoCta.appendChild(SolsticeUtils.el('span', { class:'solstice__auto-cta-icon', 'aria-hidden':'true' }, '🪄'));
      const _autoTxt = SolsticeUtils.el('div', { style:'flex:1;min-width:0;' });
      _autoTxt.appendChild(SolsticeUtils.el('div', { class:'solstice__auto-cta-title' }, 'Montar pra mim (Auto)'));
      _autoTxt.appendChild(SolsticeUtils.el('div', { class:'solstice__auto-cta-desc' },
        'A IA escolhe as melhores colunas e cria o dashboard inteiro. Você ajusta depois.'));
      autoCta.appendChild(_autoTxt);
      autoCta.appendChild(SolsticeUtils.el('span', { class:'solstice__auto-cta-arrow', 'aria-hidden':'true' }, '→'));
      wrap.appendChild(autoCta);

      wrap.appendChild(_renderQueryChat());
      wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__welcome-divider' },
        SolsticeUtils.el('span', null, 'ou escolha um template de dashboard')));

      // Audit Fix 11 (Auditoria 2026.4): separar AGNÓSTICOS (sempre 9 = grid 3x3
      // perfeito) de DOMÍNIO (aparecem em grid separado abaixo, quando dictionary
      // detected). Hierarquia clara: usuário escolhe entre genérico × específico.
      // Auditoria 2026.4: grid agnóstico travado em 9 (3×3) — antes 10 quebrava simetria.
      const allTemplates = SolsticeTemplates.list();
      const agnostic = allTemplates.filter(t => !t.domain).slice(0, 9); // máx 9 pra grid 3x3
      const domain   = allTemplates.filter(t =>  t.domain);

      const gridAgnostic = SolsticeUtils.el('div', { class:'solstice__empty-templates' });
      agnostic.forEach(t => gridAgnostic.appendChild(_renderTemplateCard(t)));
      wrap.appendChild(gridAgnostic);

      // Grid separado de domínio (se houver). Header pequeno acima.
      if (domain.length){
        wrap.appendChild(SolsticeUtils.el('div', {
          class:'solstice__empty-templates-domain-label'
        }, '🎯 Sugeridos para seu dataset'));
        const gridDomain = SolsticeUtils.el('div', { class:'solstice__empty-templates solstice__empty-templates--domain' });
        domain.forEach(t => gridDomain.appendChild(_renderTemplateCard(t)));
        wrap.appendChild(gridDomain);
      }

      wrap.appendChild(SolsticeUtils.el('p', { style:'margin-top:var(--sp-4);font-size:var(--fs-sm);color:var(--c-muted);' },
        'Ou clique em + Seção acima para começar do zero.'));
      return wrap;
    }

    /**
     * Patch 1B (ADR-121): chat integrado de Smart Query no welcome.
     * Input + chips de exemplos contextualizados + autocomplete + área de resposta.
     */
    function _renderQueryChat(){
      const root = SolsticeUtils.el('div', { class:'solstice__welcome-chat-wrap', style:'width:100%;max-width:640px;margin:var(--sp-4) auto;' });

      // Chat input
      const chat = SolsticeUtils.el('div', { class:'solstice__welcome-chat', style:'display:flex;gap:8px;align-items:center;background:var(--c-surface-2);border:1.5px solid var(--c-border);border-radius:24px;padding:6px 8px 6px 16px;transition:border-color 150ms;' });
      const input = SolsticeUtils.el('input', {
        class:'solstice__welcome-input',
        type:'text', autocomplete:'off', spellcheck:'false',
        placeholder:"Ex: 'qual a tendência de receita?'",
        style:'flex:1;border:none;background:transparent;outline:none;font-size:14px;color:var(--c-text);padding:6px 0;'
      });
      const sendBtn = SolsticeUtils.el('button', {
        class:'solstice__welcome-send',
        'aria-label':'Enviar',
        style:'width:32px;height:32px;border-radius:50%;background:var(--c-accent);color:#fff;border:none;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;'
      }, '→');
      chat.appendChild(input);
      chat.appendChild(sendBtn);
      root.appendChild(chat);

      // Autocomplete dropdown
      const acDrop = SolsticeUtils.el('div', { class:'solstice__welcome-ac', style:'position:relative;display:none;background:var(--c-surface);border:1px solid var(--c-border);border-radius:8px;margin-top:4px;box-shadow:var(--sh-2);max-height:240px;overflow-y:auto;' });
      root.appendChild(acDrop);
      let acActive = -1;
      let acItems = [];

      function _renderAC(items){
        acDrop.innerHTML = '';
        acItems = items;
        acActive = -1;
        if (!items.length){ acDrop.style.display = 'none'; return; }
        items.forEach((it, i) => {
          const item = SolsticeUtils.el('div', {
            class:'solstice__welcome-ac-item',
            'data-idx': String(i),
            style:'padding:8px 14px;cursor:pointer;font-size:13px;color:var(--c-text);',
            onclick: () => { input.value = it; _renderAC([]); _submit(); }
          }, it);
          item.addEventListener('mouseenter', () => _highlightAC(i));
          acDrop.appendChild(item);
        });
        acDrop.style.display = 'block';
      }
      function _highlightAC(idx){
        const items = SolsticeUtils.qsa('.solstice__welcome-ac-item', acDrop);
        items.forEach((el, i) => el.style.background = i === idx ? 'var(--c-surface-2)' : 'transparent');
        acActive = idx;
      }

      // Resposta area
      const respArea = SolsticeUtils.el('div', { class:'solstice__welcome-resp', style:'display:none;margin-top:var(--sp-3);padding:var(--sp-3);background:var(--c-surface-2);border-radius:8px;border-left:3px solid var(--c-accent);text-align:left;font-size:13px;line-height:1.5;color:var(--c-text);' });
      root.appendChild(respArea);

      // Chips contextuais
      const chips = SolsticeUtils.el('div', { class:'solstice__welcome-chips', style:'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:var(--sp-3);' });
      const examples = SolsticeQuery.examples();
      examples.forEach(ex => {
        const chip = SolsticeUtils.el('button', {
          class:'solstice__welcome-chip',
          type:'button',
          style:'padding:5px 12px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:16px;font-size:11px;color:var(--c-text-2);cursor:pointer;transition:all 150ms;',
          onclick: () => { input.value = ex; _submit(); }
        }, ex);
        chip.addEventListener('mouseenter', () => { chip.style.borderColor='var(--c-accent)'; chip.style.color='var(--c-accent)'; });
        chip.addEventListener('mouseleave', () => { chip.style.borderColor='var(--c-border)'; chip.style.color='var(--c-text-2)'; });
        chips.appendChild(chip);
      });
      root.appendChild(chips);

      // BR-04 + CA-02 (Sprint 1C): linha de descoberta — Tour interativo
      // + Showcase de dashboard exemplar. Beatriz (P9, INVESTIGACAO_PROFUNDA):
      // "Primeiro contato perde 80% das features escondidas". Estratégia:
      // botões visíveis no welcome (não enterrados no Ctrl+K).
      const discoverRow = SolsticeUtils.el('div', {
        class: 'solstice__welcome-discover',
        style: 'display:flex;gap:8px;justify-content:center;margin-top:var(--sp-4);padding-top:var(--sp-3);border-top:1px solid var(--c-border);flex-wrap:wrap;'
      });

      // Tour interativo
      const tourBtn = SolsticeUtils.el('button', {
        type: 'button',
        class: 'solstice__welcome-discover-btn',
        style: 'display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:transparent;border:1px solid var(--c-border);border-radius:6px;font-size:12px;color:var(--c-text-2);cursor:pointer;transition:all 150ms;',
        onclick: () => {
          try { if (typeof SolsticeTour !== 'undefined') SolsticeTour.start(); }
          catch(e){ SolsticeLog.warn('[Tour]', e); }
        }
      });
      tourBtn.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true' }, '🧭'));
      tourBtn.appendChild(SolsticeUtils.el('span', null, 'Tour interativo (9 passos)'));
      tourBtn.addEventListener('mouseenter', () => { tourBtn.style.borderColor='var(--c-accent)'; tourBtn.style.color='var(--c-accent)'; });
      tourBtn.addEventListener('mouseleave', () => { tourBtn.style.borderColor='var(--c-border)'; tourBtn.style.color='var(--c-text-2)'; });
      discoverRow.appendChild(tourBtn);

      // Showcase: dashboard exemplar (CA-02)
      const showcaseBtn = SolsticeUtils.el('button', {
        type: 'button',
        class: 'solstice__welcome-discover-btn',
        style: 'display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:transparent;border:1px solid var(--c-border);border-radius:6px;font-size:12px;color:var(--c-text-2);cursor:pointer;transition:all 150ms;',
        onclick: () => {
          try {
            _loadDummyDataset();
            setTimeout(() => {
              if (typeof SolsticeAutoDashboard !== 'undefined') SolsticeAutoDashboard.run({ force: true });
            }, 600);
          } catch(e){ SolsticeLog.warn('[Showcase]', e); }
        }
      });
      showcaseBtn.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true' }, '✨'));
      showcaseBtn.appendChild(SolsticeUtils.el('span', null, 'Ver dashboard exemplar'));
      showcaseBtn.addEventListener('mouseenter', () => { showcaseBtn.style.borderColor='var(--c-accent)'; showcaseBtn.style.color='var(--c-accent)'; });
      showcaseBtn.addEventListener('mouseleave', () => { showcaseBtn.style.borderColor='var(--c-border)'; showcaseBtn.style.color='var(--c-text-2)'; });
      discoverRow.appendChild(showcaseBtn);

      root.appendChild(discoverRow);

      // Motor info
      root.appendChild(SolsticeUtils.el('div', {
        style:'margin-top:var(--sp-2);font-size:10px;color:var(--c-muted);text-align:center;'
      }, '⚙️ Motor: Solstice Query · sem servidor · privacidade total'));

      function _submit(){
        const text = input.value.trim();
        if (!text) return;
        respArea.style.display = 'block';
        respArea.innerHTML = '⏳ Pensando…';

        // Camada 1 polish v6: sem dataset, o chat sugere COMPONENTES a partir
        // das palavras-chave da pergunta (em vez de só dizer "importe um CSV").
        // O usuário escolhe um exemplo + carrega dummy + dashboard sai pronto.
        const dsReady = SolsticeStore.get('dataset.ready');
        if (!dsReady){
          respArea.innerHTML = '';
          const q = (text || '').toLowerCase();
          // Mapeamento intent → componente sugerido
          const INTENTS = [
            { match: /(m[eé]dia|m[áa]ximo|m[íi]nimo|soma|total|quanto|valor de|receita|faturamento|lucro|margem|ticket)/, label:'KPI · número único com tendência', type:'kpi', icon:'📊' },
            { match: /(big number|destaque|n[uú]mero grande)/, label:'Big Number · valor em destaque', type:'bignum', icon:'🔢' },
            { match: /(tend[êe]ncia|evolu[çc][ãa]o|m[êe]s a m[êe]s|temporal|cresceu|caiu|hist[óo]rico|série|serie)/, label:'Série Temporal · linha do tempo', type:'time-series', icon:'📈' },
            { match: /(distribui[çc][ãa]o|histograma|faixa|outlier|quartil)/, label:'Distribuição · histograma', type:'distribution', icon:'📉' },
            { match: /(box plot|boxplot|caixa|quartis|outliers)/, label:'Box Plot · quartis + outliers', type:'boxplot', icon:'📦' },
            { match: /(top|ranking|melhor|maior|menor|melhores|piores)/, label:'Tabela · ranking ordenado', type:'table', icon:'📋' },
            { match: /(correla[çc][ãa]o|rela[çc][ãa]o|dispers[ãa]o|scatter)/, label:'Scatter · correlação X×Y', type:'scatter', icon:'⚡' },
            { match: /(funil|funnel|convers[ãa]o|etapas|pipeline)/, label:'Funil · conversão por etapas', type:'funnel', icon:'🔻' },
            { match: /(fluxo|sankey|origem|destino|origem-destino|de-para)/, label:'Sankey · fluxo entre categorias', type:'sankey', icon:'🌊' },
            { match: /(matriz|tabela din[âa]mica|pivot|cross|cruzamento)/, label:'Pivot · matriz cruzada', type:'pivot', icon:'🔢' },
            { match: /(meta|gauge|veloc[íi]metro|alvo|atingiu)/, label:'Gauge · indicador com meta', type:'gauge', icon:'⏲️' },
            { match: /(calend[áa]rio|por dia|atividade|gith?ub)/, label:'Heatmap calendário · atividade diária', type:'heatmap-cal', icon:'🗓️' },
            { match: /(narrativa|resumo|relat[óo]rio|texto)/, label:'Narrativa Auto · texto explicativo', type:'narrative-auto', icon:'📜' },
            { match: /(linha do tempo|cronograma|evento|marco)/, label:'Linha do Tempo · eventos', type:'event-timeline', icon:'📅' }
          ];
          const suggestions = INTENTS.filter(i => i.match.test(q)).slice(0, 6);

          respArea.appendChild(SolsticeUtils.el('div', { style:'font-size:13px;color:var(--c-text);margin-bottom:8px;' },
            suggestions.length
              ? '💡 Sem dados ainda. Com base no que você quer ver, sugiro estes componentes:'
              : '💡 Sem dados ainda. Importe um CSV para que eu calcule respostas — ou veja os exemplos abaixo:'));

          if (suggestions.length){
            const suggBox = SolsticeUtils.el('div', { style:'display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px;' });
            suggestions.forEach(s => {
              const card = SolsticeUtils.el('div', {
                style:'display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:6px;font-size:12px;color:var(--c-text);'
              });
              card.appendChild(SolsticeUtils.el('span', { style:'font-size:16px;' }, s.icon));
              card.appendChild(SolsticeUtils.el('span', { style:'flex:1;' }, s.label));
              suggBox.appendChild(card);
            });
            respArea.appendChild(suggBox);
          }

          // Botões: carregar exemplo OU importar
          const actions = SolsticeUtils.el('div', { style:'display:flex;gap:8px;margin-top:12px;' });
          actions.appendChild(SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--primary',
            onclick: () => {
              _loadDummyDataset();
              // Após carregar dummy, dispara Auto-Dashboard pra montar tudo
              setTimeout(() => {
                try { if (typeof SolsticeAutoDashboard !== 'undefined') SolsticeAutoDashboard.run({ force: true }); }
                catch(e){ SolsticeLog.warn('[AutoDashboard]', e); }
              }, 600);
            }
          }, '📊 Exemplo + Auto-Dashboard'));
          actions.appendChild(SolsticeUtils.el('button', {
            class:'solstice__btn',
            onclick: () => { const fi = document.getElementById('file-input'); if (fi) fi.click(); }
          }, '📁 Importar meu CSV'));
          respArea.appendChild(actions);
          return;
        }

        // Patch 1B: usa SolsticeQuery (sync) + fallback LLM async (Patch 1B.3)
        const handle = (result) => {
          respArea.innerHTML = '';
          // Markdown simples: **bold** → <strong>, \n → <br>.
          // Auditoria 2026 (JM-01 / HV-01): delega o escape ao SolsticeUtils.escapeHtml
          // — fonte única de verdade para HTML-safe, mesmo padrão usado em 31157.
          const html = SolsticeUtils.escapeHtml(String(result.answer || 'Sem resposta.'))
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
          const text = SolsticeUtils.el('div'); text.innerHTML = html;
          respArea.appendChild(text);
          if (result.action && result.action.type === 'create_component'){
            const btn = SolsticeUtils.el('button', {
              class:'solstice__btn solstice__btn--primary',
              style:'margin-top:var(--sp-2);',
              onclick: () => {
                const def = SolsticeComponents.get(result.action.componentType);
                if (!def){ SolsticeToast.error('Tipo desconhecido'); return; }
                // Garante que existe section/row
                let sections = SolsticeStore.get('canvas.sections') || [];
                if (!sections.length){ SolsticeCanvas.addSection(); sections = SolsticeStore.get('canvas.sections'); }
                const newSlotId = SolsticeUtils.uuid();
                const cloned = SolsticeUtils.deepClone(sections);
                const sec = cloned[0]; const row = sec.rows[0];
                row.slots[0] = { id: newSlotId, type: result.action.componentType, config: result.action.config || {} };
                SolsticeStore.set('canvas.sections', cloned);
                setTimeout(() => SolsticeProps.select(newSlotId), 100);
              }
            }, '📊 Criar visualização');
            respArea.appendChild(btn);
          }
          const conf = SolsticeUtils.el('div', {
            style:'margin-top:8px;font-size:10px;color:var(--c-muted);font-family:var(--font-mono);'
          }, 'confidence: ' + ((result.confidence || 0) * 100).toFixed(0) + '%' +
             (result.source ? ' · ' + result.source : ''));
          respArea.appendChild(conf);
        };
        try {
          const r = SolsticeQuery.ask(text);
          // Se SolsticeLLM existe e está habilitada e confidence baixa, faz fallback
          if (r && r.confidence < 0.4 && typeof SolsticeLLM !== 'undefined' && SolsticeLLM.isEnabled && SolsticeLLM.isEnabled()){
            respArea.innerHTML = '⏳ Consultando IA externa…';
            const ctx = (function(){
              const ingest = SolsticeStore.get('ingest') || {};
              return { rows: ingest.rows || [], columns: ingest.columns || [], types: ingest.types || {}, dictionary: SolsticeStore.get('dictionary') };
            })();
            Promise.resolve(SolsticeLLM.ask(text, ctx)).then(llmR => {
              handle(llmR || r);
            }).catch(err => {
              SolsticeToast.error('IA externa falhou', err.message);
              handle(r);
            });
          } else {
            handle(r);
          }
        } catch(err){
          // Auditoria 2026 (AP-03 / HV-01): err.message pode conter HTML
          // hostil em raros casos (exceções de bibliotecas externas que
          // ecoam input). textContent escapa por padrão. Mesmo anti-padrão
          // de AP-01 — fechado aqui.
          respArea.innerHTML = '';
          const span = SolsticeUtils.el('span', { style:'color:var(--c-error);' });
          span.textContent = 'Erro: ' + (err && err.message ? err.message : String(err));
          respArea.appendChild(span);
        }
      }

      input.addEventListener('input', () => {
        const v = input.value.trim();
        if (v.length < 2){ _renderAC([]); return; }
        _renderAC(SolsticeQuery.suggest(v).slice(0, 6));
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter'){
          if (acActive >= 0 && acItems[acActive]){
            input.value = acItems[acActive];
            _renderAC([]);
          }
          _submit();
        } else if (e.key === 'ArrowDown' && acItems.length){
          e.preventDefault();
          _highlightAC(Math.min(acItems.length - 1, acActive + 1));
        } else if (e.key === 'ArrowUp' && acItems.length){
          e.preventDefault();
          _highlightAC(Math.max(0, acActive - 1));
        } else if (e.key === 'Escape'){
          _renderAC([]);
        }
      });
      sendBtn.addEventListener('click', _submit);

      // Foco automático após DOM montado
      requestAnimationFrame(() => input.focus());

      return root;
    }

    function _renderTemplateCard(t){
      // ENXUGAR3 v4 (Auditoria 2026.4): tag "Agnóstico/Banco PJ" removida do card
      // (era ruído visual). Description já comunica o conteúdo. Domínio
      // continua sendo usado pra agrupar (Sugeridos vs Gerais) mas não polui o card.
      // Sprint 28 + 29: clicar no card de template do empty-state abre o
      // Wizard. setTimeout 50ms pra evitar race condition se vier de outro
      // modal (welcome banner etc).
      const card = SolsticeUtils.el('button', {
        class:'solstice__empty-template-card',
        title: (t.description || '') + (t.domain ? ' · ' + (t.domainLabel || t.domain) : ''),
        onclick: () => {
          const id = t.id;
          setTimeout(() => {
            try {
              if (SolsticeTemplates.openWizard) SolsticeTemplates.openWizard(id);
              else SolsticeTemplates.apply(id);
            } catch(e){ SolsticeLog.warn('[empty-state] template open falhou', e); }
          }, 50);
        }
      });
      const titleEl = SolsticeUtils.el('div', { class:'solstice__empty-template-title' });
      titleEl.appendChild(SolsticeUtils.el('span', { class:'solstice__empty-template-icon', 'aria-hidden':'true' }, t.icon || '🧩'));
      titleEl.appendChild(SolsticeUtils.el('span', null, t.name));
      card.appendChild(titleEl);
      card.appendChild(SolsticeUtils.el('div', { class:'solstice__empty-template-desc' }, t.description));
      return card;
    }

    function _renderSection(sec, idx, total){
      const el = SolsticeUtils.el('div', { class:'solstice__section', 'data-id': sec.id });
      const head = SolsticeUtils.el('div', { class:'solstice__section-head' });

      // HOTFIX v5.5 #114: bloco titulo+subtitle agrupado pra suportar
      // sec.subtitle (descrição da IA explicando por que a seção existe)
      const titleBlock = SolsticeUtils.el('div', { style:'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;' });
      const titleRow = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:8px;' });
      const title = SolsticeUtils.el('div', {
        class:'solstice__section-title',
        title:'Clique para renomear',
        onclick: function(){ this.contentEditable = 'true'; this.focus(); document.execCommand('selectAll', false, null); }
      }, sec.title);
      title.addEventListener('blur', function(){
        this.contentEditable = 'false';
        const v = this.textContent.trim() || 'Sem título';
        if (v !== sec.title){ setSectionTitle(sec.id, v); }
      });
      title.addEventListener('keydown', function(e){
        if (e.key === 'Enter'){ e.preventDefault(); this.blur(); }
      });
      titleRow.appendChild(title);
      // HOTFIX v5.5 #114: badge "✨ IA" pra secoes geradas pelo AutoDash
      if (sec.aiGenerated){
        const aiBadge = SolsticeUtils.el('span', {
          class:'solstice__section-ai-badge',
          title:'Seção gerada pelo Auto-Dashboard (IA) — você pode editar tudo'
        }, '✨ IA');
        titleRow.appendChild(aiBadge);
      }
      titleBlock.appendChild(titleRow);
      // HOTFIX v5.5 #114: subtitle/descrição da IA (por que essa seção existe)
      if (sec.subtitle){
        titleBlock.appendChild(SolsticeUtils.el('div', {
          class:'solstice__section-subtitle'
        }, sec.subtitle));
      }
      head.appendChild(titleBlock);

      const acts = SolsticeUtils.el('div', { class:'solstice__section-actions' });
      // Lucas Fix 16: actions reorganizadas
      //   Cluster management (esquerda): ↑ ↓ ⎘  (disabled state claro nos move btns)
      //   Divisor sutil
      //   Primária (centro/direita): ➕ Linha (destacado)
      //   Danger (direita): ✕
      const isFirst = idx === 0, isLast = idx === total - 1;
      const moveUpBtn = SolsticeUtils.el('button', {
        class:'solstice__section-btn' + (isFirst ? ' is-disabled' : ''),
        title: isFirst ? 'Já está no topo' : 'Mover seção para cima',
        'aria-label':'Mover seção para cima',
        'aria-disabled': isFirst ? 'true' : 'false',
        onclick: () => { if (!isFirst) moveSection(sec.id, -1); }
      }, '↑');
      const moveDownBtn = SolsticeUtils.el('button', {
        class:'solstice__section-btn' + (isLast ? ' is-disabled' : ''),
        title: isLast ? 'Já está no fim' : 'Mover seção para baixo',
        'aria-label':'Mover seção para baixo',
        'aria-disabled': isLast ? 'true' : 'false',
        onclick: () => { if (!isLast) moveSection(sec.id, +1); }
      }, '↓');
      const dupBtn = SolsticeUtils.el('button', {
        class:'solstice__section-btn', title:'Duplicar seção',
        onclick: () => duplicateSection(sec.id)
      }, '⎘');

      const sep = SolsticeUtils.el('span', { class:'solstice__section-actions-sep', 'aria-hidden':'true' });

      const addLineBtn = SolsticeUtils.el('button', {
        class:'solstice__section-btn solstice__section-btn--add',
        title:'➕ Adicionar nova linha nesta seção',
        'aria-label':'Adicionar nova linha',
        onclick: () => addRow(sec.id, '1col')
      });
      addLineBtn.appendChild(SolsticeUtils.el('span', null, '➕'));
      addLineBtn.appendChild(SolsticeUtils.el('span', { style:'font-size:11px;font-weight:var(--fw-semibold);' }, 'Linha'));

      const removeBtn = SolsticeUtils.el('button', {
        class:'solstice__section-btn', title:'Remover seção',
        onclick: () => _confirmRemoveSection(sec)
      }, '✕');

      acts.append(moveUpBtn, moveDownBtn, dupBtn, sep, addLineBtn, removeBtn);
      head.appendChild(acts);
      el.appendChild(head);

      const body = SolsticeUtils.el('div', { class:'solstice__section-body' });
      // Audit Fix 14 (Auditoria 2026.4): row-inserters REMOVIDOS por completo.
      // Os "+" entre rows (acima/abaixo) eram ruído visual quando havia muitas rows.
      // Adição de nova linha agora está APENAS no header da seção (botão "➕ Linha"
      // — veja _renderSection acima).
      // Personas ja tinham reclamado de inserters intrusivos; row-inserters eram
      // a versão horizontal do mesmo problema.
      sec.rows.forEach(r => {
        body.appendChild(_renderRow(sec.id, r));
      });
      el.appendChild(body);

      return el;
    }

    async function _confirmRemoveSection(sec){
      const ok = await SolsticeModal.confirm({
        title: 'Remover seção',
        message: 'A seção "' + sec.title + '" e todas suas linhas serão removidas. Tem certeza?',
        confirmLabel: 'Remover',
        danger: true,
        skipKey: 'remove-section'
      });
      if (!ok) return;
      removeSection(sec.id);
      SolsticeToast.action({
        title: 'Seção removida',
        msg: '"' + sec.title + '"',
        kind: 'warn',
        actionLabel: 'Desfazer',
        actionFn: () => SolsticeUndo.undo()
      });
    }

    function _renderRow(secId, row){
      // Patch 1A (ADR-089): Modo Livre removido — sempre grid.
      const el = SolsticeUtils.el('div', {
        class:'solstice__row',
        'data-layout': row.layout,
        'data-mode': 'grid',
        'data-id': row.id,
        'data-sec-id': secId,
        'data-align': row.align || 'stretch'  // Audit Fix 15: alinhamento vertical
      });

      // Aplica widths customizadas (Bloco 4)
      if (Array.isArray(row.widths) && row.widths.length === row.slots.length){
        el.style.gridTemplateColumns = row.widths.map(p => p.toFixed(2) + 'fr').join(' ');
      }
      // HOTFIX v5.5 #112: aplica altura mínima customizada (manto resizable)
      if (typeof row.minHeight === 'number' && row.minHeight > 80){
        el.style.minHeight = row.minHeight + 'px';
      }
      // SOL-E2: gap per-row. Se row.gap definido, sobrescreve o gap CSS padrão
      // (var(--sp-3) = 12px). Persiste em canvas.sections → snapshots.
      if (typeof row.gap === 'number' && row.gap >= 0){
        el.style.gap = row.gap + 'px';
      }

      // Audit Fix 14+15: row-toolbar com alinhamento + adicionar à direita
      const tb = SolsticeUtils.el('div', { class:'solstice__row-toolbar' });
      const addRightBtn = SolsticeUtils.el('button', {
        class:'solstice__row-btn solstice__row-btn--add',
        title:'➕ Adicionar componente à direita (expande linha)',
        'aria-label':'Adicionar componente à direita',
        onclick: (e) => {
          e.stopPropagation();
          const lastSlot = row.slots[row.slots.length - 1];
          if (lastSlot && lastSlot.id && typeof _addNextComponent === 'function'){
            _addNextComponent(lastSlot.id);
          } else {
            _handleInsertSlot(secId, row.id, row.slots.length);
          }
        }
      }, '➕');

      // Audit Fix 15 (Auditoria 2026.4): botão de ALINHAMENTO (vertical) — alinha todos
      // indicadores da linha pelo máximo, distribuir vertical, horizontal,
      // alinhar acima"
      const alignBtn = SolsticeUtils.el('button', {
        class:'solstice__row-btn',
        title:'Alinhamento vertical dos componentes na linha',
        onclick: async (e) => {
          e.stopPropagation();
          const choice = await SolsticeModal.select({
            title: '↕️ Alinhamento vertical',
            message: 'Como os componentes ficam alinhados verticalmente quando têm alturas diferentes?',
            options: [
              { value: 'stretch', icon: '▭', label: 'Esticar (ocupa máximo)', desc: 'Default — todos crescem até a altura da linha' },
              { value: 'start',   icon: '⬆️', label: 'Alinhar acima',          desc: 'Componentes ficam no topo' },
              { value: 'center',  icon: '━',  label: 'Alinhar no centro',      desc: 'Componentes ficam no meio' },
              { value: 'end',     icon: '⬇️', label: 'Alinhar embaixo',        desc: 'Componentes ficam na base' }
            ],
            defaultValue: row.align || 'stretch',
            confirmLabel: 'Aplicar'
          });
          if (!choice) return;
          const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
          const sec2 = sections.find(s => s.id === secId);
          const r2 = sec2 && sec2.rows.find(r => r.id === row.id);
          if (r2){
            r2.align = choice;
            SolsticeStore.set('canvas.sections', sections);
            try { SolsticeAudit.record({ action:'row_align', target: row.id, details:{ align: choice } }); } catch(_){}
          }
        }
      }, '↕️');

      // ADR-174 (Fix-6 v5.5): botões ↑↓ pra mover row dentro da section.
      // Auditoria 2026.4: reordenação de linha (mover row pro topo da seção) agora explícita via ↑↓.
      // Calcula index/total na seção atual pra disabled em first/last.
      const _sec = (SolsticeStore.get('canvas.sections') || []).find(s => s.id === secId);
      const _rowIdx = _sec ? _sec.rows.findIndex(r => r.id === row.id) : -1;
      const _rowTotal = _sec ? _sec.rows.length : 0;
      const isFirst = _rowIdx === 0;
      const isLast = _rowIdx === _rowTotal - 1;

      const moveUpBtn = SolsticeUtils.el('button', {
        class:'solstice__row-btn' + (isFirst ? ' is-disabled' : ''),
        title: isFirst ? 'Já está no topo' : 'Mover linha para cima',
        'aria-disabled': isFirst ? 'true' : 'false',
        onclick: () => { if (!isFirst) moveRow(secId, row.id, -1); }
      }, '↑');
      const moveDownBtn = SolsticeUtils.el('button', {
        class:'solstice__row-btn' + (isLast ? ' is-disabled' : ''),
        title: isLast ? 'Já está no fim' : 'Mover linha para baixo',
        'aria-disabled': isLast ? 'true' : 'false',
        onclick: () => { if (!isLast) moveRow(secId, row.id, +1); }
      }, '↓');

      // Sprint 41 / feedback do usuário: era cycle-button (8 → 16 → 24 → 0 → 8…),
      // exigia múltiplos cliques pra chegar no valor desejado. Agora abre dropdown
      // com 4 presets nomeados (Compacto/Padrão/Confortável/Aerado) visíveis de uma
      // vez. Clique aplica direto. Persiste em row.gap → canvas.sections.
      // SOL-E2 (legado): persistência mantida.
      const GAP_PRESETS = [
        { v: 0,  label: '🟦 Compacto',    sub: '0px — sem espaço' },
        { v: 8,  label: '🟦 Padrão',      sub: '8px — discreto' },
        { v: 16, label: '🟦 Confortável', sub: '16px — respiração' },
        { v: 24, label: '🟦 Aerado',      sub: '24px — máximo' }
      ];
      function _openGapMenu(anchor){
        // Fecha qualquer menu aberto antes
        document.querySelectorAll('.solstice__row-gap-menu').forEach(m => m.remove());
        const menu = SolsticeUtils.el('div', {
          class: 'solstice__row-gap-menu',
          role: 'menu',
          style: 'position:fixed;background:var(--c-surface);border:1px solid var(--c-border);' +
                 'border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.18);' +
                 'min-width:180px;z-index:99999;padding:4px;font-size:12px;'
        });
        const cur = (() => {
          const secs = SolsticeStore.get('canvas.sections') || [];
          const s = secs.find(sx => sx.id === secId);
          const r2 = s && s.rows.find(rw => rw.id === row.id);
          return r2 && typeof r2.gap === 'number' ? r2.gap : 12;
        })();
        GAP_PRESETS.forEach(p => {
          const isActive = p.v === cur;
          const opt = SolsticeUtils.el('button', {
            role: 'menuitem',
            class: 'solstice__row-gap-opt',
            style: 'display:flex;justify-content:space-between;align-items:center;' +
                   'width:100%;padding:6px 10px;background:' + (isActive ? 'var(--c-accent-soft,rgba(236,112,0,.12))' : 'transparent') + ';' +
                   'border:none;border-radius:4px;cursor:pointer;text-align:left;color:var(--c-text);',
            onclick: () => {
              const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
              const sec2 = sections.find(s => s.id === secId);
              const r2 = sec2 && sec2.rows.find(rw => rw.id === row.id);
              if (!r2){ menu.remove(); return; }
              r2.gap = p.v;
              SolsticeStore.set('canvas.sections', sections);
              try { SolsticeAudit.record({ action:'row_gap', target: row.id, details:{ gap: p.v } }); } catch(_){}
              menu.remove();
            }
          });
          opt.appendChild(SolsticeUtils.el('span', null, p.label + (isActive ? ' ✓' : '')));
          opt.appendChild(SolsticeUtils.el('span', { style: 'opacity:.6;font-size:10px;' }, p.sub));
          menu.appendChild(opt);
        });
        document.body.appendChild(menu);
        // Posiciona abaixo do botão
        const rect = anchor.getBoundingClientRect();
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.style.left = Math.max(8, Math.min(window.innerWidth - 200, rect.left)) + 'px';
        // Clique fora fecha
        const closeOnOutside = (e) => {
          if (!menu.contains(e.target) && e.target !== anchor){
            menu.remove();
            document.removeEventListener('click', closeOnOutside, true);
          }
        };
        setTimeout(() => document.addEventListener('click', closeOnOutside, true), 0);
      }
      const gapBtn = SolsticeUtils.el('button', {
        class:'solstice__row-btn',
        title:'Espaçamento entre blocos (escolher preset)',
        'aria-label':'Escolher espaçamento entre blocos',
        'aria-haspopup':'menu',
        onclick: (e) => _openGapMenu(e.currentTarget)
      }, '↔️');

      // SOL-E1: botão dedicado "Distribuir igualmente" — 1 clique zera widths
      // customizadas e força layout Ncol-equal correspondente à quantidade de
      // slots. Antes só dava via 📐 (2 cliques) ou arrastar manualmente.
      const distributeBtn = SolsticeUtils.el('button', {
        class:'solstice__row-btn',
        title:'Distribuir blocos igualmente (zerar larguras customizadas)',
        'aria-label':'Distribuir blocos igualmente nesta linha',
        onclick: () => {
          const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
          const sec = sections.find(s => s.id === secId);
          const r = sec && sec.rows.find(rw => rw.id === row.id);
          if (!r) return;
          const n = (r.slots || []).length;
          if (n < 2){ SolsticeToast.info('Nada a distribuir', 'A linha precisa de pelo menos 2 blocos.'); return; }
          r.layout = n + 'col-equal';
          r.widths = null;
          SolsticeStore.set('canvas.sections', sections);
          try { SolsticeAudit.record({ action:'row_distribute_equal', target: row.id, details:{ count: n } }); } catch(_){}
        }
      }, '⚖️');

      tb.append(
        SolsticeUtils.el('button', { class:'solstice__row-btn', title:'Trocar layout', onclick: () => _openLayoutPicker(secId, row.id, row.layout) }, '📐'),
        distributeBtn,
        gapBtn,
        alignBtn,
        moveUpBtn,
        moveDownBtn,
        SolsticeUtils.el('button', { class:'solstice__row-btn', title:'Duplicar linha', 'aria-label':'Duplicar linha', onclick: () => duplicateRow(secId, row.id) }, '⎘'),
        addRightBtn,
        SolsticeUtils.el('button', { class:'solstice__row-btn', title:'Remover linha', 'aria-label':'Remover linha', onclick: () => _confirmRemoveRow(secId, row) }, '✕')
      );
      el.appendChild(tb);

      // Slots
      // Audit Fix 18 (Auditoria 2026.4): REMOVIDO os handles verticais de
      // resize ENTRE colunas (linha 21192-21198 antigos). Resize agora vive
      // só na aba do componente. A barra/linha não recebe mais resize-handle —
      // o ↘ no canto inferior direito de CADA componente já faz resize livre
      // (width + height via _onCornerResizeStart). Uma única affordance,
      // tied ao componente, sem clutter na row.
      row.slots.forEach((slot, i) => {
        el.appendChild(_renderSlot(slot, row, i));
      });

      // Audit Fix 13: slot-inserters EM CADA POSIÇÃO eram intrusivos (interceptavam
      // resize-handle, clique em slot, etc). Auditoria 2026.4: edição inline da linha
      // porque o adicionar atrapalha". Personas confirmaram: TODAS as 6 reclamaram
      // de algo bater com o slot-inserter.
      // Solução: slot-inserters AGORA SÃO OPT-IN. Ativam só se o usuário liga em
      // Settings → "Modo expert: + entre componentes". Default = OFF.
      // Fluxo principal de adição: botão + na row-toolbar (que dá menu claro).
      const showSlotInserter = !!SolsticeStore.get('ui.canvas.showSlotInserters');
      if (showSlotInserter){
        for (let pos = 0; pos <= row.slots.length; pos++){
          const inserter = SolsticeUtils.el('div', {
            class:'solstice__slot-inserter',
            'data-position': pos,
            title:'Adicionar componente nesta posição (modo expert)'
          }, SolsticeUtils.el('button', { class:'solstice__inserter-btn', tabindex:'-1', 'aria-label':'Inserir componente aqui', title:'Inserir componente' }, '+'));
          inserter.onclick = (e) => {
            e.stopPropagation();
            inserter.classList.add('is-pulsing');
            setTimeout(() => {
              try { _handleInsertSlot(secId, row.id, pos); } catch(err){ console.error('[Inserter]', err); }
              setTimeout(() => { try { inserter.classList.remove('is-pulsing'); } catch(_){} }, 200);
            }, 180);
          };
          el.appendChild(inserter);
        }
        requestAnimationFrame(() => _positionSlotInserters(el));
      }

      // HOTFIX v5.5 #112: handle pra puxar manto da linha (altura).
      // Auditoria 2026.4: handle de resize vertical no manto da linha permite ajustar altura.
      const resizeBottom = SolsticeUtils.el('div', {
        class: 'solstice__row-resize-bottom',
        role: 'separator',
        'aria-orientation': 'horizontal',
        'aria-label': 'Redimensionar altura da linha',
        title: 'Arraste pra cima/baixo pra mudar altura. Duplo-clique reseta.',
        tabindex: '0'
      });
      resizeBottom.addEventListener('mousedown', e => {
        e.preventDefault(); e.stopPropagation();
        resizeBottom.classList.add('is-active');
        const startY = e.clientY;
        const startH = el.getBoundingClientRect().height;
        // Badge flutuante (reusa estilo do resize-badge)
        const badge = SolsticeUtils.el('div', { class:'solstice__resize-badge' }, startH + 'px');
        document.body.appendChild(badge);
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';

        function onMove(ev){
          const dy = ev.clientY - startY;
          const newH = Math.max(80, Math.round(startH + dy));
          el.style.minHeight = newH + 'px';
          badge.textContent = newH + 'px';
          badge.style.left = ev.clientX + 'px';
          badge.style.top = ev.clientY + 'px';
        }
        function onUp(){
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          resizeBottom.classList.remove('is-active');
          badge.remove();
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          // Persiste no modelo
          const finalH = parseInt(el.style.minHeight, 10);
          if (!isFinite(finalH) || finalH <= 80){
            // Reset (≤ default): remove minHeight do modelo
            const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
            const sec2 = sections.find(s => s.id === secId);
            const r2 = sec2 && sec2.rows.find(r => r.id === row.id);
            if (r2 && r2.minHeight){ delete r2.minHeight; SolsticeStore.set('canvas.sections', sections); }
            return;
          }
          const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
          const sec2 = sections.find(s => s.id === secId);
          const r2 = sec2 && sec2.rows.find(r => r.id === row.id);
          if (r2){
            r2.minHeight = finalH;
            SolsticeStore.set('canvas.sections', sections);
            try { SolsticeAudit.record({ action:'row_resize_height', target: row.id, details:{ minHeight: finalH } }); } catch(_){}
          }
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      // Duplo-clique: reseta altura
      resizeBottom.addEventListener('dblclick', e => {
        e.preventDefault(); e.stopPropagation();
        el.style.minHeight = '';
        const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
        const sec2 = sections.find(s => s.id === secId);
        const r2 = sec2 && sec2.rows.find(r => r.id === row.id);
        if (r2 && r2.minHeight){
          delete r2.minHeight;
          SolsticeStore.set('canvas.sections', sections);
          SolsticeToast.info('Altura resetada', 'Linha voltou ao tamanho automático.');
        }
      });
      // Teclado: Setas ↑↓ ajustam altura em passos de 24px
      resizeBottom.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const step = e.shiftKey ? 64 : 24;
        const curH = el.getBoundingClientRect().height;
        const newH = Math.max(80, Math.round(curH + (e.key === 'ArrowDown' ? step : -step)));
        el.style.minHeight = newH + 'px';
        const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
        const sec2 = sections.find(s => s.id === secId);
        const r2 = sec2 && sec2.rows.find(r => r.id === row.id);
        if (r2){ r2.minHeight = newH; SolsticeStore.set('canvas.sections', sections); }
      });
      el.appendChild(resizeBottom);

      return el;
    }

    /**
     * Patch UX (ADR-104): posiciona slot-inserters em cima das junções entre slots
     * via getBoundingClientRect. Recalcula em ResizeObserver (resize horizontal entre slots).
     */
    function _positionSlotInserters(rowEl){
      if (!rowEl || !rowEl.isConnected) return;
      const rowRect = rowEl.getBoundingClientRect();
      const slots = SolsticeUtils.qsa('.solstice__slot', rowEl);
      const inserters = SolsticeUtils.qsa('.solstice__slot-inserter', rowEl);
      if (!slots.length || !inserters.length) return;
      inserters.forEach((ins, idx) => {
        let leftPx;
        if (idx === 0){
          // Antes do primeiro slot
          leftPx = slots[0].getBoundingClientRect().left - rowRect.left;
        } else if (idx >= slots.length){
          // Depois do último slot
          const lastRect = slots[slots.length - 1].getBoundingClientRect();
          leftPx = lastRect.right - rowRect.left;
        } else {
          // Entre slot[idx-1] e slot[idx]
          const a = slots[idx - 1].getBoundingClientRect().right - rowRect.left;
          const b = slots[idx].getBoundingClientRect().left - rowRect.left;
          leftPx = (a + b) / 2;
        }
        ins.style.left = leftPx + 'px';
      });
      // Observa mudanças (resize horizontal) — instalado uma vez por row
      if (!rowEl._solsticeInserterObs && typeof ResizeObserver !== 'undefined'){
        const obs = new ResizeObserver(() => _positionSlotInserters(rowEl));
        obs.observe(rowEl);
        rowEl._solsticeInserterObs = obs;
      }
    }

    async function _confirmRemoveRow(secId, row){
      const sec = _get().find(s => s.id === secId);
      if (sec && sec.rows.length === 1){
        SolsticeToast.warn('Não posso remover', 'A seção precisa ter ao menos 1 linha.');
        return;
      }
      const ok = await SolsticeModal.confirm({
        title: 'Remover linha',
        message: 'A linha será removida com todos os slots. Tem certeza?',
        confirmLabel: 'Remover',
        danger: true,
        skipKey: 'remove-row'
      });
      if (!ok) return;
      removeRow(secId, row.id);
      SolsticeToast.action({
        title: 'Linha removida',
        kind: 'warn',
        actionLabel: 'Desfazer',
        actionFn: () => SolsticeUndo.undo()
      });
    }

    async function _openLayoutPicker(secId, rowId, current){
      // Sprint 42 / feedback do usuário ("layouts chatos, muitas opções em lista"):
      // Antes era SolsticeModal.select (lista flat de 19 layouts). Agora: modal
      // visual com preview SVG de cada layout em grid 4×N. Click no preview
      // = aplicar. Bem mais rápido de escolher visualmente.
      //
      // Cada layout vira um "card" com mini SVG mostrando como os slots se
      // distribuem (proporcional ao widths real do layout).
      const NS = 'http://www.w3.org/2000/svg';
      const LAYOUT_SHAPES = {
        '1col':         [[100]],
        '2col-equal':   [[50, 50]],
        '2col-2-1':     [[66.67, 33.33]],
        '2col-1-2':     [[33.33, 66.67]],
        '3col-equal':   [[33.33, 33.33, 33.33]],
        '3col-1-2-1':   [[25, 50, 25]],
        '4col-equal':   [[25, 25, 25, 25]],
        '5col-equal':   [[20, 20, 20, 20, 20]],
        '6col-equal':   [[16.67, 16.67, 16.67, 16.67, 16.67, 16.67]],
        '8col-equal':   [Array(8).fill(12.5)],
        '4col-2-1-1':   [[50, 25, 25, 0]], // 0 ignored
        '5col-2-1-1-1': [[40, 20, 20, 20]],
        '10col-equal':  [Array(10).fill(10)],
        '12col-equal':  [Array(12).fill(8.33)],
        'auto-fit':     [[20, 20, 20, 20, 20]], // approximation
        'hero-bottom':  [[100], [50, 50]],     // 2 linhas internas
        'sidebar-main': [[25, 75]],
        'custom':       [[100]]
      };
      function _previewSVG(id){
        const shape = LAYOUT_SHAPES[id] || [[100]];
        const W = 100, H = shape.length === 1 ? 40 : 60;
        const rowH = (H - (shape.length - 1) * 3) / shape.length;
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('width', '100%');
        svg.style.maxHeight = '60px';
        shape.forEach((row, ri) => {
          let x = 0;
          const y = ri * (rowH + 3);
          row.forEach(w => {
            if (w <= 0) return;
            const realW = (w / 100) * W;
            const r = document.createElementNS(NS, 'rect');
            r.setAttribute('x', x.toFixed(1));
            r.setAttribute('y', y.toFixed(1));
            r.setAttribute('width', Math.max(2, realW - 2).toFixed(1));
            r.setAttribute('height', rowH.toFixed(1));
            r.setAttribute('rx', '2');
            r.setAttribute('fill', 'var(--c-accent, #EC7000)');
            r.style.opacity = '0.7';
            svg.appendChild(r);
            x += realW;
          });
        });
        return svg;
      }
      return new Promise(resolve => {
        SolsticeModal.show({
          title: '📐 Layout da linha',
          size: 'lg',
          body: (close) => {
            const wrap = SolsticeUtils.el('div', { style: 'display:flex;flex-direction:column;gap:12px;' });
            wrap.appendChild(SolsticeUtils.el('div', { style: 'font-size:12px;color:var(--c-muted);' },
              'Escolha como dividir o espaço horizontal. Slots existentes são preservados; faltantes preenchidos com vazios.'));
            const grid = SolsticeUtils.el('div', {
              style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;max-height:60vh;overflow-y:auto;padding:4px;'
            });
            SolsticeLayouts.list().forEach(id => {
              const meta = SolsticeLayouts.get(id);
              const isActive = id === current;
              const card = SolsticeUtils.el('button', {
                type: 'button',
                style: 'display:flex;flex-direction:column;align-items:center;gap:6px;' +
                       'padding:10px 8px;border:2px solid ' + (isActive ? 'var(--c-accent, #EC7000)' : 'var(--c-border)') + ';' +
                       'background:' + (isActive ? 'color-mix(in srgb, var(--c-accent, #EC7000) 8%, transparent)' : 'var(--c-surface)') + ';' +
                       'border-radius:8px;cursor:pointer;transition:all .15s;font-size:11px;color:var(--c-text);text-align:center;',
                onmouseenter: (e) => { if (!isActive) e.currentTarget.style.borderColor = 'var(--c-accent, #EC7000)'; },
                onmouseleave: (e) => { if (!isActive) e.currentTarget.style.borderColor = 'var(--c-border)'; },
                onclick: () => { close('ok'); changeRowLayout(secId, rowId, id); resolve(id); }
              });
              const svgWrap = SolsticeUtils.el('div', { style: 'width:100%;display:flex;align-items:center;justify-content:center;min-height:60px;' });
              svgWrap.appendChild(_previewSVG(id));
              card.appendChild(svgWrap);
              card.appendChild(SolsticeUtils.el('div', { style: 'font-weight:600;' }, meta.name));
              card.appendChild(SolsticeUtils.el('div', { style: 'font-size:10px;opacity:.65;' },
                SolsticeLayouts.slotCount(id) + ' slot(s)' + (isActive ? ' · atual' : '')));
              grid.appendChild(card);
            });
            wrap.appendChild(grid);
            return wrap;
          },
          defaultClose: 'cancel',
          footer: (close) => [
            SolsticeUtils.el('button', { class:'solstice__btn', onclick: () => { close('cancel'); resolve(null); } }, 'Cancelar')
          ]
        });
      });
    }

    /**
     * Patch UX (ADR-104): catálogo compartilhado para inserter de slot e row.
     */
    function _catalogOptions(){
      return SolsticeComponents.list().map(c => ({
        value: c.id, label: c.name, icon: c.icon,
        desc: c.description || c.id,
        synonyms: [c.id, c.name]
      }));
    }

    function _ctxNow(){
      const ingest = SolsticeStore.get('ingest');
      const allRows = (ingest && ingest.rows) || [];
      const filteredRows = (typeof SolsticeFilters !== 'undefined')
        ? SolsticeFilters.apply(allRows) : allRows;
      return {
        rows: filteredRows, rowsAll: allRows,
        columns: (ingest && ingest.columns) || [],
        types: (ingest && ingest.types) || {},
        dictionary: SolsticeStore.get('dictionary'),
        L: SolsticeLocale
      };
    }

    /**
     * Patch UX (ADR-104): inserção em posição arbitrária da row.
     */
    /** Polish v8a-fix4: adiciona componente IMEDIATAMENTE depois do slot atual.
     *  Estratégia:
     *    1. Se a row do slot tem capacidade pra +1 (layout permite), insere
     *       slot vizinho à direita e re-equaliza widths
     *    2. Senão, cria nova row 1col logo abaixo da row atual (mesma seção)
     *    3. Em ambos os casos, abre o picker pra escolher tipo do componente
     *  Auditoria 2026.4: comportamento "adicionar" agora sempre cria slot adjacente
     *  tenha linha ou componente adicional"
     */
    async function _addNextComponent(slotId){
      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      let foundSec = null, foundRow = null, slotIdx = -1;
      for (const sec of sections){
        for (const row of sec.rows){
          const idx = row.slots.findIndex(s => s.id === slotId);
          if (idx >= 0){ foundSec = sec; foundRow = row; slotIdx = idx; break; }
        }
        if (foundSec) break;
      }
      if (!foundSec) return;

      const choice = await SolsticeModal.select({
        title: 'Adicionar próximo componente',
        message: 'Adiciona logo depois do atual. Se a linha estiver cheia, cria nova linha abaixo.',
        options: _catalogOptions(),
        searchable: 'auto',
        confirmLabel: 'Adicionar'
      });
      if (!choice) return;
      const def = SolsticeComponents.get(choice);
      const newSlot = {
        id: SolsticeUtils.uuid(),
        type: choice,
        config: (def && def.defaultConfig) ? def.defaultConfig(_ctxNow()) : {}
      };

      // Tenta expandir a row atual: alguns layouts comportam slots adicionais.
      // Estratégia: se layout é "Xcol-equal" e tem upgrade pra "X+1col-equal", usa.
      const upgradeMap = {
        '1col': '2col-equal',
        '2col-equal': '3col-equal',
        '3col-equal': '4col-equal',
        '4col-equal': '5col-equal',
        '5col-equal': '6col-equal',
        '6col-equal': '8col-equal',
        '8col-equal': '10col-equal',
        '10col-equal': '12col-equal'
      };
      const upgradeTo = upgradeMap[foundRow.layout];

      let insertedAs = '';
      if (upgradeTo){
        foundRow.layout = upgradeTo;
        foundRow.slots.splice(slotIdx + 1, 0, newSlot);
        // Mantém o resto dos slots existentes; se faltar pra atingir slotCount, adiciona empty
        const target = SolsticeLayouts.slotCount(upgradeTo);
        while (foundRow.slots.length < target) foundRow.slots.push({ id: SolsticeUtils.uuid(), type:'empty' });
        // Re-equaliza widths se tinha custom
        if (Array.isArray(foundRow.widths)){
          const equal = 100 / target;
          foundRow.widths = Array(target).fill(equal);
        }
        insertedAs = 'na mesma linha (' + foundRow.layout + ')';
      } else {
        // Layout não tem upgrade simples (ex: já é 8col, ou é hero-bottom, ou custom)
        // → cria nova row 1col logo após
        const rowIdx = foundSec.rows.findIndex(r => r.id === foundRow.id);
        const newRow = {
          id: SolsticeUtils.uuid(),
          layout: '1col',
          slots: [newSlot]
        };
        foundSec.rows.splice(rowIdx + 1, 0, newRow);
        insertedAs = 'em nova linha abaixo';
      }

      SolsticeStore.set('canvas.sections', sections);
      try {
        SolsticeAudit.record({
          action: 'add_next_component', target: newSlot.id,
          details: { fromSlotId: slotId, componentType: choice, insertedAs }
        });
      } catch(_){}
      SolsticeToast.info('Componente adicionado', (def ? def.name : choice) + ' · ' + insertedAs);
      setTimeout(() => SolsticeProps.select(newSlot.id), 80);
    }

    async function _handleInsertSlot(secId, rowId, position){
      const choice = await SolsticeModal.select({
        title: 'Adicionar componente',
        message: 'Escolha o tipo de visualização para a posição ' + (position + 1) + ' desta linha.',
        options: _catalogOptions(),
        searchable: 'auto',
        confirmLabel: 'Adicionar'
      });
      if (!choice) return;
      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      const sec = sections.find(s => s.id === secId);
      const row = sec && sec.rows.find(r => r.id === rowId);
      if (!row) return;
      const def = SolsticeComponents.get(choice);
      const newSlot = {
        id: SolsticeUtils.uuid(),
        type: choice,
        config: (def && def.defaultConfig) ? def.defaultConfig(_ctxNow()) : {}
      };
      const safePos = Math.max(0, Math.min(position, row.slots.length));
      row.slots.splice(safePos, 0, newSlot);
      // Re-equaliza widths se já tinha widths customizadas
      if (Array.isArray(row.widths) && row.widths.length === row.slots.length - 1){
        const equal = 100 / row.slots.length;
        row.widths = Array(row.slots.length).fill(equal);
      }
      SolsticeStore.set('canvas.sections', sections);
      SolsticeAudit.record({
        action: 'insert_slot', target: newSlot.id, componentId: newSlot.id,
        details: { secId, rowId, position: safePos, componentType: choice }
      });
      SolsticeToast.info('Componente adicionado',
        (def ? def.name : choice) + ' inserido na posição ' + (safePos + 1));
      setTimeout(() => SolsticeProps.select(newSlot.id), 80);
    }

    // Auditoria 2026 (cleanliness): _handleInsertRow removida — ADR-104 patch UX
    // de inserir row em posição arbitrária ficou sem trigger (CTA correspondente
    // não foi mantido no canvas atual). Para reintroduzir: adicionar botão
    // "+ linha aqui" na _buildSectionToolbar e ligar.

    function _renderSlot(slot, row, idx){
      // Patch 1A (ADR-089): Modo Livre removido — slots sempre em grid.
      const isEmpty = !slot.type || slot.type === 'empty';
      const attrs = {
        class:'solstice__slot',
        'data-id': slot.id,
        draggable: 'true',
        title: isEmpty ? 'Click para escolher um componente' : 'Click para selecionar'
      };
      const el = SolsticeUtils.el('div', attrs);

      if (isEmpty){
        // Lucas Fix 17: SEM resize-corner em slot vazio.
        // Auditoria 2026.4: resize-handle removido daqui — vive só no canto do componente.
        // Faz sentido: não há o que redimensionar num placeholder. Resize só
        // em .solstice__comp (componente com conteúdo).
        el.appendChild(SolsticeUtils.el('div', { class:'solstice__slot-icon', 'aria-hidden':'true' }, '➕'));
        el.appendChild(SolsticeUtils.el('div', { class:'solstice__slot-label' }, 'Adicionar componente'));
        el.appendChild(SolsticeUtils.el('div', { class:'solstice__slot-hint' }, 'KPI · Série · Distribuição · Tabela'));
        el.addEventListener('click', e => _openComponentPicker(slot.id));
        return el;
      }

      // Componente real — dispatch para Components.render (envolve em .solstice__comp)
      try { SolsticeComponents.render(slot, el); }
      catch(err){
        el.appendChild(SolsticeUtils.el('div', { class:'solstice__comp-empty' },
          '⚠️ ' + (err.message || err)));
      }
      // .solstice__slot original tem flex centering — neutralizar para componente preencher
      el.style.display = 'block';
      el.style.padding = '0';
      el.style.background = 'transparent';
      el.style.border = '0';
      el.style.cursor = 'default';
      return el;
    }

    async function _openComponentPicker(slotId){
      const options = SolsticeComponents.list().map(c => ({
        value: c.id, label: c.name, icon: c.icon,
        desc: c.id, synonyms: [c.id, c.name]
      }));
      const choice = await SolsticeModal.select({
        title: 'Escolher componente',
        message: 'Selecione o tipo de visualização para este slot. Você pode trocar depois pelas propriedades (⚙️).',
        options,
        confirmLabel: 'Adicionar'
      });
      if (!choice) return;
      // Atualiza slot.type + config default
      const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
      for (const s of sections) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === slotId);
        if (sl){
          sl.type = choice;
          const def = SolsticeComponents.get(choice);
          const ingest = SolsticeStore.get('ingest');
          const ctx = {
            rows: (ingest && ingest.rows) || [],
            columns: (ingest && ingest.columns) || [],
            types: (ingest && ingest.types) || {},
            dictionary: SolsticeStore.get('dictionary')
          };
          sl.config = def && def.defaultConfig ? def.defaultConfig(ctx) : {};
          SolsticeStore.set('canvas.sections', sections);
          SolsticeAudit.record({
            action:'add_component', target: slotId, componentId: slotId,
            details: { type: choice, config: sl.config }
          });
          SolsticeToast.success('Componente adicionado', SolsticeComponents.get(choice).name);
          // Seleciona automaticamente para o usuário configurar
          setTimeout(() => SolsticeProps.select(slotId), 50);
          return;
        }
      }
    }

    function init(){
      // Render inicial + re-render reativo
      render();
      // Auditoria 2026.4 (RT-08 considerado e REVERTIDO): tentei rAF throttle
      // aqui pra coalescer múltiplas mudanças em canvas.sections numa frame.
      // Problema: requestAnimationFrame pausa em aba inativa — subscribers
      // disparados em background (multi-tab sync, auto-save restore) ficariam
      // sem render até o usuário voltar à aba. Risco > ganho marginal.
      // Roadmap: detecção de diff (mudou só 1 slot? só re-renderiza ele).
      SolsticeStore.subscribe(PATH, render);
      // Também re-renderiza ao carregar dataset (libera empty state para mostrar templates)
      SolsticeStore.subscribe('dataset.ready', render);
      SolsticeStore.subscribe('dictionary', render);  // muda quais templates de domínio aparecem

      // Bloco 4 — inicializa módulos que dependem do canvas existir no DOM
      SolsticeUndo.init();
      SolsticeResize.init();
      SolsticeDnD.init();
      SolsticeMinimap.init();
      // SolsticeFreeMode.init();  // REMOVIDO no Patch 1A (ADR-089)

      // Bloco 5 — Props subscribe re-render quando seleção/sections mudam
      SolsticeProps.init();

      // Patch B5-r1 — tabs da sidebar (Dados ↔ Componentes)
      SolsticeSidebarTabs.init();

      // Patch B5-r4 — Dashboard Header (banner customizável + auto-sugestão)
      SolsticeDashHeader.init();

      // Patch B6-r1 — Resumo do Dataset reativo a mudanças de tipo/coluna
      SolsticeStore.subscribe('ingest', () => {
        SolsticeEditor.renderDatasetSummary();
        if (SolsticeEditor.renderMeasuresPanel) SolsticeEditor.renderMeasuresPanel();
        if (SolsticeEditor.renderDataActions) SolsticeEditor.renderDataActions();
      });
      SolsticeStore.subscribe('dictionary', () => SolsticeEditor.renderDatasetSummary());
    }

    return {
      addSection, removeSection, duplicateSection, moveSection, setSectionTitle,
      addRow, removeRow, duplicateRow, moveRow, changeRowLayout,
      applyTemplate, clear,
      render, init, noteConfigOnly,
      _get: () => _get(),
      // Code Review 2026 (#2/#4): helpers expostos pra centralizar mutação de slot.
      withSlot, findSlot, editSections: _editSections
    };
  })();
