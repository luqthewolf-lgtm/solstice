
  /* ============================================================
     BLOCO 12 — SolsticeCommandPalette (ADR-087)
     Ctrl+K palette com fuzzy search. 30+ ações catalogadas.
     ============================================================ */
  const SolsticeCommandPalette = (function(){
    let overlay = null;
    let activeIndex = 0;
    let filtered = [];

    /** Catálogo de comandos. Cada comando: { id, label, category, icon, run, kbd?, syn? } */
    function _commands(){
      return [
        // Componentes
        { id:'add-kpi',          label:'Adicionar KPI Card',          icon:'📊', category:'Componente', syn:'numero indicador medida', run:() => SolsticeComponents.addByType('kpi') },
        { id:'add-time',         label:'Adicionar Série Temporal',    icon:'📈', category:'Componente', syn:'linha tempo evolucao', run:() => SolsticeComponents.addByType('time-series') },
        { id:'add-dist',         label:'Adicionar Distribuição',      icon:'📉', category:'Componente', syn:'histograma forma', run:() => SolsticeComponents.addByType('distribution') },
        { id:'add-table',        label:'Adicionar Tabela',            icon:'📋', category:'Componente', syn:'dados crus', run:() => SolsticeComponents.addByType('table') },
        { id:'add-scatter',      label:'Adicionar Scatter',           icon:'⚡', category:'Componente', syn:'dispersao correlacao', run:() => SolsticeComponents.addByType('scatter') },
        { id:'add-gauge',        label:'Adicionar Gauge',             icon:'⏲️', category:'Componente', syn:'velocimetro meta', run:() => SolsticeComponents.addByType('gauge') },
        { id:'add-boxplot',      label:'Adicionar Box Plot',          icon:'📦', category:'Componente', syn:'quartis outliers', run:() => SolsticeComponents.addByType('boxplot') },
        { id:'add-sankey',       label:'Adicionar Sankey',            icon:'🌊', category:'Componente', syn:'fluxo categorias', run:() => SolsticeComponents.addByType('sankey') },
        { id:'add-heatmap',      label:'Adicionar Heatmap Calendário',icon:'🗓️', category:'Componente', syn:'github calendar', run:() => SolsticeComponents.addByType('heatmap-cal') },
        { id:'add-md',           label:'Adicionar Markdown',          icon:'📝', category:'Componente', syn:'texto rich', run:() => SolsticeComponents.addByType('markdown') },
        // Ações principais
        { id:'auto-dash',        label:'Auto-Dashboard',              icon:'🪄', category:'Ação', syn:'automatico sugerido', run:() => SolsticeAutoDashboard.run({ force: true }) },
        { id:'wizard',           label:'Wizard',                      icon:'🧙', category:'Ação', syn:'guiado intencao', run:() => SolsticeWizard.open() },
        { id:'save-snap',        label:'Salvar snapshot',             icon:'💾', category:'Persistência', kbd:'Ctrl+S', syn:'guardar estado', run:() => { SolsticeSnapshots.save(); SolsticeToast.success('Snapshot rápido salvo'); } },
        { id:'open-snap',        label:'Abrir snapshots',             icon:'📂', category:'Persistência', kbd:'Ctrl+O', syn:'carregar', run:() => SolsticeSnapshots.openModal() },
        { id:'export-html',      label:'Exportar HTML standalone',    icon:'⬇️', category:'Persistência', syn:'baixar compartilhar', run:() => SolsticeExport.openExportModal() },
        { id:'history',          label:'Histórico de versões',        icon:'🕐', category:'Persistência', syn:'versions undo', run:() => SolsticeVersions.openModal() },
        // Templates
        { id:'templates',        label:'Aplicar template',            icon:'📋', category:'Template', syn:'pronto modelo', run:() => SolsticeTemplates.openPicker() },
        { id:'params',           label:'Editar parâmetros globais',   icon:'🎛️', category:'Config', syn:'variaveis', run:() => SolsticeParams.openModal() },
        { id:'header',           label:'Configurar cabeçalho',        icon:'📋', category:'Config', syn:'banner titulo', run:() => SolsticeDashHeader.openConfig() },
        // Auditoria 2026 (R-14 / A-503): features centrais antes só
        // acessíveis após selecionar um slot (P10 Beatriz não descobria).
        // Entradas explícitas no Cmd Palette tornam Medidas/Fórmula/Drill
        // descobríveis por busca textual.
        { id:'measures',         label:'Criar/editar medidas calculadas', icon:'🧮', category:'Dados', syn:'measure dax formula calculada', run:() => { if (typeof SolsticeMeasures !== 'undefined' && SolsticeMeasures.openManager) SolsticeMeasures.openManager(); else SolsticeToast.info('Medidas', 'Selecione um componente e abra a aba 🧮 Medidas no Inspector.'); } },
        { id:'formula',          label:'Editor de fórmula da coluna', icon:'ƒx', category:'Dados', syn:'formula coluna derivada calculada', run:() => { if (typeof SolsticeFormulaRow !== 'undefined' && SolsticeFormulaRow.openEditor) SolsticeFormulaRow.openEditor(); else SolsticeToast.info('Fórmula', 'Aba Dados → botão ƒx ao lado da coluna.'); } },
        { id:'drilldown',        label:'Configurar drill-down de tabela', icon:'🔽', category:'Dados', syn:'drill detalhe hierarquia', run:() => SolsticeToast.info('Drill-down', 'Selecione uma tabela → Inspector → aba Config → "Modo drill-down".') },
        // Modos
        { id:'mode-edit',        label:'Modo Edit',                   icon:'✏️', category:'Modo', run:() => SolsticeModes.set('edit') },
        { id:'mode-analyze',     label:'Modo Analyze',                icon:'🔬', category:'Modo', run:() => SolsticeModes.set('analyze') },
        { id:'mode-present',     label:'Modo Present',                icon:'🖥️', category:'Modo', syn:'apresentar limpo', run:() => SolsticeModes.set('present') },
        { id:'mode-slides',      label:'Modo Slides',                 icon:'🎬', category:'Modo', kbd:'F', syn:'apresentacao', run:() => SolsticeModes.set('slides') },
        // Tema
        { id:'theme-dark',       label:'Tema escuro',                 icon:'🌙', category:'Tema', syn:'dark mode', run:() => SolsticeTheme.set('mode', 'dark') },
        { id:'theme-light',      label:'Tema claro',                  icon:'☀️', category:'Tema', syn:'light mode', run:() => SolsticeTheme.set('mode', 'light') },
        { id:'palette-cycle',    label:'Próxima paleta',              icon:'🎨', category:'Tema', syn:'cor', run:() => SolsticeTheme.cycle('palette') },
        // Stats/Análise
        { id:'ask',              label:'Pergunte ao Solstice',        icon:'🔍', category:'Análise', kbd:'Ctrl+P', syn:'pergunta query', run:() => SolsticeAsk.open() },
        { id:'audit',            label:'Auditoria de decisões',       icon:'📋', category:'Análise', syn:'log historico', run:() => SolsticeAudit.openModal() },
        // Outros
        { id:'tour',             label:'Abrir tour interativo',       icon:'🧭', category:'Ajuda', syn:'guia passos', run:() => SolsticeTour.start() },
        { id:'help',             label:'Mostrar Onboarding',          icon:'❓', category:'Ajuda', run:() => SolsticeOnboarding.show() },
        // ADR-179 Fix-11: refazer tour (reseta o flag isFirstTime)
        { id:'tour-restart',     label:'🧭 Refazer tour interativo',  icon:'🧭', category:'Ajuda', syn:'tour onboarding inicio comecar', run:() => SolsticeOnboarding.reset() },
        { id:'debug',            label:'Debug overlay',               icon:'🐛', category:'Dev', kbd:'Ctrl+Shift+D', run:() => SolsticeDebug.toggle() },
        { id:'undo',             label:'Desfazer',                    icon:'↺', category:'Edição', kbd:'Ctrl+Z', run:() => SolsticeUndo.undo() },
        { id:'redo',             label:'Refazer',                     icon:'↻', category:'Edição', kbd:'Ctrl+Shift+Z', run:() => SolsticeUndo.redo() },
        { id:'add-section',      label:'Adicionar seção',             icon:'➕', category:'Edição', run:() => SolsticeCanvas.addSection() },
        { id:'load-dummy',       label:'Carregar CSV dummy',          icon:'📊', category:'Dados', syn:'exemplo teste', run:() => _loadDummyDataset() },
        { id:'import-csv',       label:'Importar CSV',                icon:'📁', category:'Dados', run:() => document.getElementById('file-input').click() }
      ];
    }

    /** Fuzzy match simples: cada char do query deve aparecer na ordem no haystack. */
    function _fuzzyScore(query, str){
      if (!query) return 1;
      const q = query.toLowerCase();
      const s = (str || '').toLowerCase();
      if (s.includes(q)) return 100;
      let qi = 0;
      for (let i = 0; i < s.length && qi < q.length; i++){
        if (s[i] === q[qi]) qi++;
      }
      return qi === q.length ? 50 - (s.length - q.length) * 0.1 : 0;
    }

    function _filter(query){
      const all = _commands();
      if (!query) return all;
      return all.map(c => {
        const haystack = c.label + ' ' + (c.syn || '') + ' ' + c.category;
        const score = _fuzzyScore(query, haystack);
        return { c, score };
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.c);
    }

    function open(){
      if (overlay) return;
      activeIndex = 0;
      // Auditoria 2026 (R-07 / A-607): semântica ARIA do modal de comandos.
      // Antes: NVDA anunciava "div" e o usuário não sabia que entrou num modal.
      overlay = SolsticeUtils.el('div', { class:'solstice__cmd-overlay',
        role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paleta de comandos',
        onclick: (e) => { if (e.target === overlay) close(); }
      });
      const panel = SolsticeUtils.el('div', { class:'solstice__cmd-panel' });
      const inputWrap = SolsticeUtils.el('div', { class:'solstice__cmd-input-wrap' });
      inputWrap.appendChild(SolsticeUtils.el('span', { style:'font-size:16px;' }, '⌘'));
      const input = SolsticeUtils.el('input', { class:'solstice__cmd-input', type:'text',
        placeholder:'O que você quer fazer? (ex: salvar, gauge, dark, exportar...)' });
      inputWrap.appendChild(input);
      inputWrap.appendChild(SolsticeUtils.el('span', { class:'solstice__cmd-item-kbd' }, 'Esc'));
      panel.appendChild(inputWrap);

      const list = SolsticeUtils.el('div', { class:'solstice__cmd-list' });
      panel.appendChild(list);

      function renderList(){
        list.innerHTML = '';
        if (!filtered.length){
          list.appendChild(SolsticeUtils.el('div', { class:'solstice__cmd-empty' },
            'Nada encontrado. Tente outro termo.'));
          return;
        }
        filtered.forEach((c, i) => {
          const item = SolsticeUtils.el('div', {
            class:'solstice__cmd-item' + (i === activeIndex ? ' is-active' : ''),
            onclick: () => { close(); try { c.run(); } catch(e){ console.error(e); } }
          });
          item.appendChild(SolsticeUtils.el('span', { class:'solstice__cmd-item-icon' }, c.icon || '•'));
          const labelEl = SolsticeUtils.el('div', { class:'solstice__cmd-item-label' });
          labelEl.appendChild(SolsticeUtils.el('span', null, c.label));
          if (c.category) labelEl.appendChild(SolsticeUtils.el('span', { class:'solstice__cmd-item-cat' }, '· ' + c.category));
          item.appendChild(labelEl);
          if (c.kbd) item.appendChild(SolsticeUtils.el('span', { class:'solstice__cmd-item-kbd' }, c.kbd));
          else item.appendChild(SolsticeUtils.el('span'));
          list.appendChild(item);
        });
      }
      filtered = _filter('');
      renderList();

      input.addEventListener('input', (e) => {
        filtered = _filter(e.target.value);
        activeIndex = 0;
        renderList();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown'){ e.preventDefault(); activeIndex = Math.min(filtered.length - 1, activeIndex + 1); renderList(); }
        else if (e.key === 'ArrowUp'){ e.preventDefault(); activeIndex = Math.max(0, activeIndex - 1); renderList(); }
        else if (e.key === 'Enter'){
          e.preventDefault();
          const cmd = filtered[activeIndex];
          if (cmd){ close(); try { cmd.run(); } catch(err){ console.error(err); } }
        }
        else if (e.key === 'Escape'){ e.preventDefault(); close(); }
      });

      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      setTimeout(() => input.focus(), 50);
    }

    function close(){
      if (overlay){ overlay.remove(); overlay = null; }
    }

    function init(){
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
          const tag = e.target && e.target.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA') return;
          e.preventDefault();
          if (overlay) close(); else open();
        }
      });
    }

    return { open, close, init, _commands };
  })();
