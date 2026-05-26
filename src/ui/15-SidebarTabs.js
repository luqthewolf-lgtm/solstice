
  /* ============================================================
     SolsticeSidebarTabs (Patch B5-r1) — alterna painéis na sidebar
     entre "Dados" (editor + qualidade) e "Componentes" (lista do canvas).
     ============================================================ */
  const SolsticeSidebarTabs = (function(){
    let active = 'dados';

    /**
     * Catálogo de componentes (B7-r2 + Camada 1 D3 / ADR-160):
     * - Agrupa por categoria em accordions (Básicos / Avançados / Filtros / Texto / Demandas / Diferenciais)
     * - Busca textual no topo: NFD-normalized contains em name + description + synonyms
     *   (forças todos os accordions abertos, esconde cards não-match, highlight com <mark>)
     */

    // ADR-160: dicionário de sinônimos para busca no catálogo. Não toca nos defs.
    const CATALOG_SYNONYMS = {
      'kpi':            ['cartao', 'cartão', 'indicador', 'numero', 'número', 'metric', 'card', 'big number pequeno'],
      'time-series':    ['linha', 'tendência', 'tendencia', 'temporal', 'serie', 'série', 'evolução', 'evolucao', 'trend'],
      'distribution':   ['histograma', 'distribuicao', 'frequência', 'frequencia', 'bins', 'barras'],
      'table':          ['tabela', 'dados', 'grid', 'lista', 'planilha'],
      'scatter':        ['dispersão', 'dispersao', 'bubble', 'correlação', 'correlacao', 'xy', 'pontos'],
      'heatmap-cal':    ['calendário', 'calendario', 'github', 'atividade', 'mapa de calor', 'frequência diária'],
      'gauge':          ['velocímetro', 'velocimetro', 'meta', 'target', 'arco', 'kpi visual'],
      'markdown':       ['texto', 'markdown', 'md', 'rich text', 'nota', 'observação', 'observacao'],
      'narrative-auto': ['narrativa', 'auto', 'resumo automático', 'executivo', 'storytelling', 'texto adaptativo', 'comentário', 'comentario'],
      'boxplot':        ['caixa', 'quartil', 'whisker', 'mediana', 'outliers', 'box plot'],
      'sankey':         ['fluxo', 'flow', 'rio', 'origem-destino', 'source-target'],
      'distrib-time':   ['distribuição temporal', 'distribuicao temporal', 'dual axis', 'duplo eixo'],
      'demand-list':    ['demandas', 'lista acionável', 'pendências', 'pendencias', 'tarefas', 'top items'],
      'pivot':          ['matriz', 'tabela dinâmica', 'tabela dinamica', 'pivot table', 'cruzamento', 'cross tab'],
      'slider':         ['filtro range', 'filtro de intervalo', 'range', 'min max', 'duplo handle'],
      'bignum':         ['big number', 'número grande', 'numero grande', 'destaque', 'foco', 'kpi minimalista'],
      'funnel':         ['funil', 'conversão', 'conversao', 'pipeline', 'etapas', 'aquisição'],
      'event-timeline': ['linha do tempo', 'eventos', 'timeline', 'cronograma', 'marcos'],
      'metric-graph':   ['grafo', 'dag', 'dependência', 'dependencia', 'rede de métricas', 'metric graph', 'linhagem']
    };

    /** Normaliza string para busca: NFD, lowercase, sem acentos. */
    function _normSearch(s){
      return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    /** Verifica se def matcha a query (em name, description ou synonyms). */
    function _matchCatalogQuery(def, normQuery){
      if (!normQuery) return true;
      if (_normSearch(def.name).includes(normQuery)) return true;
      if (_normSearch(def.description || '').includes(normQuery)) return true;
      const syns = CATALOG_SYNONYMS[def.id] || [];
      return syns.some(syn => _normSearch(syn).includes(normQuery));
    }

    /** Aplica <mark> ao trecho matched de `text` (usa originalText para preservar acentos no display). */
    function _highlightMatch(originalText, normQuery){
      if (!normQuery) return document.createTextNode(originalText);
      const normText = _normSearch(originalText);
      const idx = normText.indexOf(normQuery);
      if (idx === -1) return document.createTextNode(originalText);
      const span = document.createElement('span');
      span.appendChild(document.createTextNode(originalText.slice(0, idx)));
      const mark = document.createElement('mark');
      mark.textContent = originalText.slice(idx, idx + normQuery.length);
      span.appendChild(mark);
      span.appendChild(document.createTextNode(originalText.slice(idx + normQuery.length)));
      return span;
    }

    function _renderComponentsPanel(){
      const host = document.getElementById('components-panel');
      if (!host) return;
      host.innerHTML = '';
      const dsReady = SolsticeStore.get('dataset.ready');

      // Header da seção (não-accordion)
      const titleEl = SolsticeUtils.el('div', { class:'solstice__editor-title' },
        '🧩 Adicionar componente');
      host.appendChild(titleEl);
      host.appendChild(SolsticeUtils.el('div', { class:'solstice__cat-hint' },
        dsReady
          ? 'Clique em um cartão para inserir num slot vazio ou criar nova seção.'
          : 'Importe um CSV primeiro para habilitar os componentes.'));

      // ADR-160 (Camada 1 D3): busca textual no catálogo
      const searchWrap = SolsticeUtils.el('div', { class:'solstice__cat-search' });
      const searchInput = SolsticeUtils.el('input', {
        type: 'search',
        class: 'solstice__cat-search-input',
        placeholder: 'Buscar (kpi, matriz, funil, série...)',
        'aria-label': 'Buscar componente no catálogo',
        autocomplete: 'off'
      });
      searchWrap.appendChild(searchInput);
      host.appendChild(searchWrap);

      const emptyEl = SolsticeUtils.el('div',
        { class:'solstice__cat-empty solstice__hidden' },
        'Nenhum componente encontrado. Tente: kpi, série, matriz, funil, scatter, sankey...');
      host.appendChild(emptyEl);

      // SOL-feedback: taxonomia ÚNICA do catálogo de componentes (era duplicada
      // com OLD aqui + NEW em V56.Reorg.GROUPS que reescrevia via timeout — gerava
      // flash visível trocando "Básicos/Avançados/Filtros/Texto/Demandas/Diferenciais"
      // por "Essenciais/Análise/Fluxo/Mapas/Filtros/Diferenciais"). Agora só esta
      // existe. V56.Reorg._rebuildPanel virou no-op (a mesma estrutura).
      const groups = [
        { key: 'essenciais',  title: 'Essenciais',        icon: '⭐',
          openByDefault: true,
          // Sprint 42 / feedback do usuário: distrib-time promovido pra
          // Essenciais. User: "é o que mais é usado aqui na área. Está escondida".
          // Antes vivia em 'analise' com openByDefault:false → invisível na 1ª tela.
          // Auditoria 2026.6: distrib-time ANTES de time-series — usuário: "a
          // distribuição temporal é mais usada que série temporal".
          ids: ['kpi', 'bignum', 'distrib-time', 'time-series', 'table', 'bar', 'donut', 'distribution', 'area'] },
        { key: 'analise',     title: 'Análise & Comparação', icon: '🔬',
          openByDefault: false,
          ids: ['scatter', 'boxplot', 'gauge', 'heatmap-cal', 'heatmap', 'radar'] },
        { key: 'fluxo',       title: 'Fluxo & Estrutura', icon: '🌊',
          openByDefault: false,
          ids: ['sankey', 'funnel', 'waterfall', 'pivot', 'treemap'] },
        { key: 'mapas',       title: 'Mapas & Geo',       icon: '🗺️',
          openByDefault: false,
          ids: ['choropleth-br'] },
        { key: 'filtros',     title: 'Filtros & Texto',   icon: '🎚️',
          openByDefault: false,
          ids: ['slider', 'markdown', 'narrative-auto'] },
        { key: 'diferenciais', title: 'Diferenciais & Operacional', icon: '✨',
          openByDefault: false,
          ids: ['event-timeline', 'demand-list', 'metric-graph'] }
      ];

      // B12-r1 (ADR-095): se há slot selecionado, cards viram "🔄 Substituir selecionado"
      const selectedSlotId = SolsticeStore.get('ui.inspector.slotId') || SolsticeStore.get('ui.selectedSlot');
      const selectedSlot = (function(){
        if (!selectedSlotId) return null;
        const secs = SolsticeStore.get('canvas.sections') || [];
        for (const s of secs) for (const r of s.rows){
          const sl = r.slots.find(x => x.id === selectedSlotId);
          if (sl) return sl;
        }
        return null;
      })();
      const inReplaceMode = !!selectedSlot && selectedSlot.type && selectedSlot.type !== 'empty';

      if (inReplaceMode){
        // Banner explicativo no topo do catálogo
        const banner = SolsticeUtils.el('div', {
          style: 'background:color-mix(in srgb, var(--c-accent) 14%, transparent);' +
                 'border:1px solid var(--c-accent);border-radius:var(--rad-sm);padding:var(--sp-2) var(--sp-3);' +
                 'margin-bottom:var(--sp-3);font-size:var(--fs-xs);color:var(--c-text);line-height:1.5;'
        });
        const def = SolsticeComponents.get(selectedSlot.type);
        banner.appendChild(SolsticeUtils.el('strong', null, '🔄 Modo Substituir'));
        banner.appendChild(document.createTextNode(' — componente selecionado: ' + (def ? def.icon + ' ' + def.name : selectedSlot.type) + '. Clique em outro para trocar.'));
        host.appendChild(banner);
      }

      groups.forEach(g => {
        const defs = g.ids.map(id => SolsticeComponents.get(id)).filter(Boolean);
        if (!defs.length) return;
        const section = createAccordion({
          icon: g.icon, title: g.title, key: 'catalog.' + g.key,
          openByDefault: g.openByDefault,
          count: defs.length,
          build: (body) => {
            body.classList.add('solstice__catalog-group');
            const grid = SolsticeUtils.el('div', { class:'solstice__cat-grid' });
            defs.forEach(def => {
              const isSelf = inReplaceMode && selectedSlot.type === def.id;
              const card = SolsticeUtils.el('button', {
                class: 'solstice__cat-card' + (dsReady ? '' : ' is-disabled') + (isSelf ? ' is-selected' : ''),
                type: 'button',
                draggable: dsReady ? 'true' : 'false',  // Lucas Fix 16: drag direto do catálogo
                'aria-disabled': dsReady ? 'false' : 'true',
                title: !dsReady ? 'Importe um CSV primeiro'
                     : inReplaceMode ? (isSelf ? 'Já é este tipo' : 'Substituir selecionado por ' + def.name)
                     : ('Click para adicionar OU arraste para o canvas'),
                ondragstart: (e) => {
                  if (!dsReady) return;
                  e.dataTransfer.effectAllowed = 'copy';
                  // Payload "catalog:<type>" — identifica que vem do catálogo
                  e.dataTransfer.setData('text/plain', JSON.stringify({
                    fromCatalog: true,
                    componentType: def.id
                  }));
                  card.classList.add('is-dragging');
                },
                ondragend: () => card.classList.remove('is-dragging'),
                onclick: async () => {
                  if (!dsReady) return;
                  if (inReplaceMode){
                    if (isSelf) return;
                    // Reusa o fluxo de troca do botão 🔄
                    const sections = SolsticeUtils.deepClone(SolsticeStore.get('canvas.sections') || []);
                    for (const s of sections) for (const r of s.rows){
                      const sl = r.slots.find(x => x.id === selectedSlotId);
                      if (sl){
                        const fromType = sl.type;
                        sl.type = def.id;
                        const ingest = SolsticeStore.get('ingest');
                        const allRows = (ingest && ingest.rows) || [];
                        const filteredRows = (typeof SolsticeFilters !== 'undefined') ? SolsticeFilters.apply(allRows) : allRows;
                        const ctx = { rows: filteredRows, rowsAll: allRows, columns: (ingest && ingest.columns) || [], types: (ingest && ingest.types) || {}, dictionary: SolsticeStore.get('dictionary'), L: SolsticeLocale };
                        sl.config = def.defaultConfig ? def.defaultConfig(ctx) : {};
                        SolsticeStore.set('canvas.sections', sections);
                        SolsticeAudit.record({ action:'change_component_type', target: selectedSlotId, details: { from: fromType, to: def.id, source: 'catalog-replace' } });
                        SolsticeToast.info('Componente trocado', fromType + ' → ' + def.name);
                        setTimeout(() => SolsticeProps.select(selectedSlotId), 80);
                        return;
                      }
                    }
                  } else {
                    SolsticeComponents.addByType(def.id);
                  }
                }
              });
              card.appendChild(SolsticeUtils.el('div', { class:'solstice__cat-card-icon', 'aria-hidden':'true' }, def.icon));
              // ADR-160: card-name guarda originalText em data-name; conteúdo pode ser highlight
              const nameEl = SolsticeUtils.el('div', { class:'solstice__cat-card-name', 'data-name': def.name }, def.name);
              card.appendChild(nameEl);
              card.appendChild(SolsticeUtils.el('div', { class:'solstice__cat-card-desc' },
                def.description || ''));
              card.appendChild(SolsticeUtils.el('div', { class:'solstice__cat-card-add' },
                inReplaceMode ? (isSelf ? '✓ Atual' : '🔄 Substituir') : '+ Adicionar'));
              card.setAttribute('data-comp-id', def.id);
              grid.appendChild(card);
            });
            body.appendChild(grid);
          }
        });
        host.appendChild(section);
      });

      // Footer com helper
      host.appendChild(SolsticeUtils.el('div', { class:'solstice__catalog-helper' },
        inReplaceMode
          ? '💡 Clique fora ou em ✕ do Inspector para sair do modo substituir.'
          : '💡 Selecione um componente no canvas para editar suas propriedades no painel da direita →'));

      // ADR-160 (D3): wiring da busca textual no catálogo
      // Quando há query: força todos os accordions abertos, esconde cards/grupos não-matched, mostra empty se 0.
      // Quando query vazia: restaura visibilidade dos cards e o estado de abertura persistido dos accordions.
      const accordionEls = host.querySelectorAll('.solstice__accord');
      const cardEls = host.querySelectorAll('.solstice__cat-card[data-comp-id]');
      const savedOpenStates = new Map();
      accordionEls.forEach(acc => {
        savedOpenStates.set(acc, acc.classList.contains('is-open'));
      });

      function applyFilter(rawQuery){
        const q = _normSearch((rawQuery || '').trim());
        if (!q){
          // Restaura estado persistido
          cardEls.forEach(card => {
            card.classList.remove('solstice__hidden');
            const nameEl = card.querySelector('.solstice__cat-card-name');
            if (nameEl) nameEl.textContent = nameEl.getAttribute('data-name') || nameEl.textContent;
          });
          accordionEls.forEach(acc => {
            const wasOpen = savedOpenStates.get(acc);
            acc.classList.toggle('is-open', !!wasOpen);
            acc.classList.remove('solstice__hidden');
          });
          emptyEl.classList.add('solstice__hidden');
          return;
        }
        // Filtra cards
        let totalMatched = 0;
        cardEls.forEach(card => {
          const id = card.getAttribute('data-comp-id');
          const def = SolsticeComponents.get(id);
          if (!def){ card.classList.add('solstice__hidden'); return; }
          const isMatch = _matchCatalogQuery(def, q);
          card.classList.toggle('solstice__hidden', !isMatch);
          if (isMatch){
            totalMatched++;
            const nameEl = card.querySelector('.solstice__cat-card-name');
            if (nameEl){
              nameEl.innerHTML = '';
              nameEl.appendChild(_highlightMatch(nameEl.getAttribute('data-name') || def.name, q));
            }
          }
        });
        // Esconde accordions sem matches; abre os que têm
        accordionEls.forEach(acc => {
          const visibleCards = acc.querySelectorAll('.solstice__cat-card[data-comp-id]:not(.solstice__hidden)');
          const hasMatch = visibleCards.length > 0;
          acc.classList.toggle('solstice__hidden', !hasMatch);
          if (hasMatch) acc.classList.add('is-open');
        });
        emptyEl.classList.toggle('solstice__hidden', totalMatched > 0);
      }

      const debounced = SolsticeUtils.debounce(applyFilter, 100);
      searchInput.addEventListener('input', e => debounced(e.target.value));
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Escape'){
          searchInput.value = '';
          applyFilter('');
          e.stopPropagation();
        }
      });
    }

    /**
     * activate(which) — B7-r2 + B11: alterna entre Dados/Componentes/Dicionários/Snapshots.
     */
    /**
     * activate(which) — Patch B12-r1 (ADR-089):
     * Aba "Dados" agora SEMPRE mostra conteúdo. Antes de CSV mostra estado
     * vazio com botões "Importar CSV" e "Dados de exemplo".
     */
    function activate(which){
      active = which;
      SolsticeStore.set('ui.activeTab', which);
      // Fase 7A (refactor-modular-v1): aba "inspector" adicionada — o painel
      // de propriedades vive aqui agora (era um <aside> à direita).
      const tabs = {
        dados:        document.getElementById('tab-dados'),
        modelo:       document.getElementById('tab-modelo'),
        componentes:  document.getElementById('tab-componentes'),
        snapshots:    document.getElementById('tab-snapshots'),
        dicionarios:  document.getElementById('tab-dicionarios'),
        inspector:    document.getElementById('tab-inspector')
      };
      Object.keys(tabs).forEach(id => {
        const el = tabs[id];
        if (!el) return;
        const isActive = which === id;
        el.classList.toggle('is-active', isActive);
        el.setAttribute('tabindex', isActive ? '0' : '-1');
        el.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      const panels = {
        dados:       document.getElementById('data-panel'),
        modelo:      document.getElementById('modelo-panel'),
        componentes: document.getElementById('components-panel'),
        snapshots:   document.getElementById('snapshots-panel'),
        dicionarios: document.getElementById('dicionarios-panel'),
        inspector:   document.getElementById('inspector-panel')
      };
      Object.values(panels).forEach(p => p && p.classList.add('solstice__hidden'));
      const renderers = {
        dados:       _renderDataPanel,
        modelo:      _renderModeloPanel,
        componentes: _renderComponentsPanel,
        snapshots:   _renderSnapsPanel,
        dicionarios: _renderDictsPanel,
        inspector:   _renderInspectorPanel
      };
      const p = panels[which];
      const r = renderers[which];
      if (p && r){
        p.classList.remove('solstice__hidden');
        try { r(); } catch(e){ SolsticeLog.warn('[SidebarTabs] render', which, e); }
      }
    }

    /** Fase 7A: garante que o <aside id="inspector"> está dentro do
     *  inspector-panel (reparent idempotente) e mostra placeholder se
     *  nenhum tile foi selecionado ainda. */
    function _renderInspectorPanel(){
      const aside = document.getElementById('inspector');
      const panel = document.getElementById('inspector-panel');
      if (aside && panel && aside.parentElement !== panel){
        panel.appendChild(aside);
      }
      if (aside) aside.style.display = '';
      const body = document.getElementById('inspector-body');
      // children.length === 0 distingue body sem tile selecionado (só
      // tem comentários HTML / texto) do body com props renderizadas.
      if (body && body.children.length === 0){
        body.innerHTML = '';
        const empty = SolsticeUtils.el('div',
          { class: 'solstice__inspector-empty', style:
            'padding:var(--sp-5) var(--sp-3);color:var(--c-muted);'+
            'font-size:var(--fs-sm);text-align:center;line-height:1.6;' },
          SolsticeUtils.el('div',
            { style: 'font-size:40px;margin-bottom:var(--sp-3);opacity:0.5;' },
            '⚙️'),
          SolsticeUtils.el('div',
            { style: 'font-weight:var(--fw-medium);margin-bottom:var(--sp-2);color:var(--c-text);' },
            'Inspector vazio'),
          SolsticeUtils.el('div', null,
            'Clique num componente do canvas pra ver e editar suas propriedades aqui.')
        );
        body.appendChild(empty);
      }
    }

    /**
     * Camada 1 polish v5: voltou ao layout simples sem sub-abas.
     * Botão "📋 Tabela" no topo abre modal full-screen com tabela viva
     * (header clicável → mudar tipo · ⚡ → transformar). Reusa openPreview.
     */
    /** Prompt 6 v5.4 — aplica todas as colunas calculadas em ingest.derivedColumns
     *  às rows. Idempotente: re-cálcula tudo do zero a partir das colunas base.
     *  Persiste em ingest.rows + atualiza types. */
    function _applyDerivedColumns(){
      const ingest = SolsticeStore.get('ingest');
      if (!ingest || !ingest.derivedColumns) return;
      const derived = ingest.derivedColumns; // { name: { formula, type } }
      const derivedNames = Object.keys(derived);
      if (!derivedNames.length) return;
      // Calcula valores e atualiza rows
      const newRows = ingest.rows.map(r => ({ ...r }));
      const newTypes = { ...ingest.types };
      for (const name of derivedNames){
        const def = derived[name];
        try {
          const values = SolsticeFormulaRow.evaluate(def.formula, newRows);
          newRows.forEach((r, i) => { r[name] = values[i]; });
          // Re-infere tipo
          newTypes[name] = SolsticeTypes.inferColumn(values);
          newTypes[name]._derived = true; // marca pra UI
        } catch(err){
          SolsticeLog.warn('[FormulaRow] erro ao calcular ' + name + ':', err.message);
          newRows.forEach(r => { r[name] = null; });
          newTypes[name] = { type: 'string', _derived: true, _error: err.message };
        }
      }
      // Adiciona names à lista de columns se ausentes
      const newColumns = ingest.columns.slice();
      for (const name of derivedNames){
        if (!newColumns.includes(name)) newColumns.push(name);
      }
      SolsticeStore.set('ingest', { ...ingest, rows: newRows, columns: newColumns, types: newTypes });
    }

    /** Modal de criação/edição de coluna calculada. */
    async function _openCalculatedColumnModal(editName){
      const ingest = SolsticeStore.get('ingest');
      if (!ingest){ SolsticeToast.warn('Sem dataset', 'Carregue um CSV antes de criar coluna calculada.'); return; }
      const existing = (ingest.derivedColumns || {})[editName] || null;
      const baseCols = ingest.columns.filter(c => !(ingest.derivedColumns || {})[c]); // exclui derivadas para evitar circular
      const allCols = ingest.columns;

      // Estado do modal
      let formula = existing ? existing.formula : '';
      let colName = editName || '';
      let outputType = existing ? existing.outputType : 'auto';
      let lastPreview = null;

      await SolsticeModal.show({
        title: (editName ? '✏️ Editar' : '➕ Criar') + ' coluna calculada',
        size: 'lg',
        body: () => {
          const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:12px;font-size:13px;' });

          // Nome da coluna
          const nameRow = SolsticeUtils.el('label', { style:'display:flex;flex-direction:column;gap:4px;' });
          nameRow.appendChild(SolsticeUtils.el('span', { style:'font-weight:var(--fw-semibold);color:var(--c-text);' }, 'Nome da nova coluna:'));
          const nameInp = SolsticeUtils.el('input', {
            type:'text', value: colName, placeholder:'ex: margem, lucro_pct, alerta',
            style:'padding:6px 10px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:13px;font-family:var(--font-mono);'
          });
          if (editName) nameInp.disabled = true; // não permite renomear
          nameInp.addEventListener('input', e => { colName = e.target.value.trim(); });
          nameRow.appendChild(nameInp);
          wrap.appendChild(nameRow);

          // Fórmula
          const fRow = SolsticeUtils.el('label', { style:'display:flex;flex-direction:column;gap:4px;' });
          fRow.appendChild(SolsticeUtils.el('span', { style:'font-weight:var(--fw-semibold);color:var(--c-text);' }, 'Fórmula:'));
          const fInp = SolsticeUtils.el('textarea', {
            rows:'3', placeholder:"ex: ([receita] - [custo]) / [receita] * 100\nou IF([dpd90] > 30, 'alto risco', 'ok')",
            style:'padding:8px 10px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:13px;font-family:var(--font-mono);resize:vertical;min-height:60px;'
          });
          fInp.value = formula;
          fRow.appendChild(fInp);
          wrap.appendChild(fRow);

          // Lista de colunas e funções disponíveis (autocomplete básico)
          const helpers = SolsticeUtils.el('div', { style:'display:grid;grid-template-columns:1fr 1fr;gap:12px;' });

          // Coluna helpers
          const colHelp = SolsticeUtils.el('div', { style:'padding:8px;background:var(--c-surface-2);border-radius:var(--rad-xs);font-size:11px;' });
          colHelp.appendChild(SolsticeUtils.el('div', { style:'font-weight:var(--fw-semibold);margin-bottom:4px;color:var(--c-text);' }, 'Colunas disponíveis (clique para inserir):'));
          const colList = SolsticeUtils.el('div', { style:'max-height:120px;overflow-y:auto;display:flex;flex-wrap:wrap;gap:3px;' });
          allCols.forEach(c => {
            const chip = SolsticeUtils.el('button', {
              type:'button',
              style:'padding:2px 6px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:10px;cursor:pointer;font-family:var(--font-mono);',
              title:'Inserir [' + c + '] na fórmula',
              onclick: () => {
                const insert = c.includes(' ') || /[^a-zA-Z0-9_]/.test(c) ? '[' + c + ']' : c;
                const cursor = fInp.selectionStart;
                fInp.value = fInp.value.slice(0, cursor) + insert + fInp.value.slice(fInp.selectionEnd);
                formula = fInp.value;
                fInp.focus();
                fInp.setSelectionRange(cursor + insert.length, cursor + insert.length);
                _updatePreview();
              }
            }, c);
            colList.appendChild(chip);
          });
          colHelp.appendChild(colList);
          helpers.appendChild(colHelp);

          // Funções helpers
          const fnHelp = SolsticeUtils.el('div', { style:'padding:8px;background:var(--c-surface-2);border-radius:var(--rad-xs);font-size:11px;' });
          fnHelp.appendChild(SolsticeUtils.el('div', { style:'font-weight:var(--fw-semibold);margin-bottom:4px;color:var(--c-text);' }, 'Funções:'));
          const fnList = SolsticeUtils.el('div', { style:'display:flex;flex-wrap:wrap;gap:3px;' });
          Object.keys(SolsticeFormulaRow.FUNCTIONS).forEach(fn => {
            const chip = SolsticeUtils.el('button', {
              type:'button',
              style:'padding:2px 6px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:10px;cursor:pointer;font-family:var(--font-mono);color:var(--c-accent);',
              title: 'Inserir ' + fn + '() na fórmula',
              onclick: () => {
                const insert = fn + '(';
                const cursor = fInp.selectionStart;
                fInp.value = fInp.value.slice(0, cursor) + insert + fInp.value.slice(fInp.selectionEnd);
                formula = fInp.value;
                fInp.focus();
                fInp.setSelectionRange(cursor + insert.length, cursor + insert.length);
                _updatePreview();
              }
            }, fn);
            fnList.appendChild(chip);
          });
          fnHelp.appendChild(fnList);
          fnHelp.appendChild(SolsticeUtils.el('div', { style:'margin-top:6px;font-size:10px;color:var(--c-muted);line-height:1.4;' },
            'Operadores: + - * / > < >= <= == != AND OR NOT'));
          helpers.appendChild(fnHelp);
          wrap.appendChild(helpers);

          // Preview live
          const previewBox = SolsticeUtils.el('div', { style:'padding:8px 10px;background:var(--c-surface-2);border-left:3px solid var(--c-accent);border-radius:var(--rad-sm);font-size:11px;' });
          const previewTitle = SolsticeUtils.el('div', { style:'font-weight:var(--fw-semibold);margin-bottom:4px;color:var(--c-text);' }, '👁️ Preview (primeiras 5 linhas):');
          previewBox.appendChild(previewTitle);
          const previewBody = SolsticeUtils.el('div', { style:'font-family:var(--font-mono);' });
          previewBox.appendChild(previewBody);
          wrap.appendChild(previewBox);

          function _updatePreview(){
            const f = fInp.value.trim();
            if (!f){ previewBody.textContent = 'Digite uma fórmula acima.'; previewBody.style.color = 'var(--c-muted)'; return; }
            // Valida primeiro
            const val = SolsticeFormulaRow.validate(f, allCols);
            if (!val.ok){
              previewBody.textContent = '❌ ' + val.error;
              previewBody.style.color = 'var(--c-error)';
              lastPreview = null;
              return;
            }
            const prev = SolsticeFormulaRow.preview(f, ingest.rows, 5);
            if (prev.error){
              previewBody.textContent = '❌ ' + prev.error;
              previewBody.style.color = 'var(--c-error)';
              lastPreview = null;
              return;
            }
            previewBody.innerHTML = '';
            previewBody.style.color = 'var(--c-text)';
            prev.results.forEach((v, i) => {
              const row = SolsticeUtils.el('div', { style:'padding:2px 0;display:flex;gap:8px;' });
              row.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-muted);min-width:50px;' }, 'L' + (i+1) + ':'));
              const value = v == null ? '∅ null' : (typeof v === 'boolean' ? String(v) : (typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) : '"' + String(v).slice(0, 80) + '"'));
              row.appendChild(SolsticeUtils.el('span', { style: v == null ? 'color:var(--c-muted);' : '' }, value));
              previewBody.appendChild(row);
            });
            lastPreview = prev.results;
            formula = f;
          }

          fInp.addEventListener('input', _updatePreview);
          _updatePreview();
          return wrap;
        },
        footer: (close) => {
          const btns = [];
          // Botão Remover (só em edit)
          if (editName){
            btns.push(SolsticeUtils.el('button', {
              class:'solstice__btn',
              style:'color:var(--c-error);',
              onclick: async () => {
                const ok = await SolsticeModal.confirm({
                  title:'Remover coluna calculada',
                  message:'Remover "' + editName + '"? Componentes que a usam vão ficar inválidos.',
                  confirmLabel:'Remover',
                  danger: true
                });
                if (!ok) return;
                const ing = SolsticeStore.get('ingest');
                const dc = { ...(ing.derivedColumns || {}) };
                delete dc[editName];
                const newCols = ing.columns.filter(c => c !== editName);
                const newTypes = { ...ing.types };
                delete newTypes[editName];
                const newRows = ing.rows.map(r => { const o = { ...r }; delete o[editName]; return o; });
                SolsticeStore.set('ingest', { ...ing, derivedColumns: dc, columns: newCols, types: newTypes, rows: newRows });
                try { SolsticeAudit.record({ action: 'calc_column_remove', target: editName, details: {} }); } catch(_){}
                SolsticeToast.success('Coluna removida', editName);
                _renderDataPanel(); SolsticeEditor.renderPreview(); SolsticeEditor.updateQualityCard();
                close(null);
              }
            }, '🗑️ Remover'));
          }
          btns.push(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', onclick: () => close(null) }, 'Cancelar'));
          btns.push(SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--primary',
            onclick: () => {
              if (!colName){ SolsticeToast.warn('Nome obrigatório', 'Dê um nome à coluna.'); return; }
              if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(colName)){
                SolsticeToast.warn('Nome inválido', 'Use apenas letras, números e _ (sem espaços ou símbolos).');
                return;
              }
              if (!editName && ingest.columns.includes(colName)){
                SolsticeToast.warn('Nome em uso', 'Já existe uma coluna chamada "' + colName + '".');
                return;
              }
              if (!formula){ SolsticeToast.warn('Fórmula vazia'); return; }
              const val = SolsticeFormulaRow.validate(formula, allCols);
              if (!val.ok){ SolsticeToast.error('Fórmula inválida', val.error); return; }
              // Persiste
              const ing = SolsticeStore.get('ingest');
              const dc = { ...(ing.derivedColumns || {}) };
              dc[colName] = { formula, outputType, deps: val.deps, createdAt: Date.now() };
              SolsticeStore.set('ingest', { ...ing, derivedColumns: dc });
              // Aplica re-cálculo
              _applyDerivedColumns();
              try {
                SolsticeAudit.record({
                  action: editName ? 'calc_column_edit' : 'calc_column_create',
                  target: colName,
                  details: { formula, deps: val.deps }
                });
              } catch(_){}
              SolsticeToast.success(editName ? 'Coluna atualizada' : 'Coluna criada', colName + ' = ' + formula);
              _renderDataPanel(); SolsticeEditor.renderPreview(); SolsticeEditor.updateQualityCard();
              close(null);
            }
          }, editName ? '💾 Salvar' : '➕ Criar coluna'));
          return btns;
        }
      });
    }

    // Auditoria 2026 (cleanliness): _renderCalculatedColumnsPanel removida —
    // listagem de colunas calculadas migrou para SolsticeMeasures. Função
    // antiga nunca era chamada no fluxo atual.

    function _renderDataPanel(){
      const host = document.getElementById('data-panel');
      if (!host) return;
      const dsReady = SolsticeStore.get('dataset.ready');
      // Estado vazio (sem CSV)
      const existingEmpty = host.querySelector('.solstice__data-empty');
      if (!dsReady){
        const summary = host.querySelector('#dataset-summary');
        const quality = host.querySelector('#quality-card');
        const editor = host.querySelector('#editor-panel');
        const tableBtnWrap = host.querySelector('.solstice__data-table-btn-wrap');
        [summary, quality, editor, tableBtnWrap].forEach(el => el && el.classList.add('solstice__hidden'));
        if (existingEmpty) return;
        const empty = SolsticeUtils.el('div', { class:'solstice__data-empty' });
        empty.appendChild(SolsticeUtils.el('div', { class:'solstice__data-empty-icon' }, '📊'));
        empty.appendChild(SolsticeUtils.el('div', { style:'font-weight:var(--fw-semibold);color:var(--c-text);margin-bottom:4px;' },
          'Nenhum dataset carregado'));
        empty.appendChild(SolsticeUtils.el('div', null,
          'Importe um CSV ou carregue dados de exemplo para começar.'));
        const acts = SolsticeUtils.el('div', { class:'solstice__data-empty-actions' });
        acts.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--primary',
          onclick: () => document.getElementById('file-input').click()
        }, '📁 Importar CSV'));
        acts.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn',
          onclick: () => _loadDummyDataset()
        }, '📊 Carregar exemplo (vendas BR)'));
        empty.appendChild(acts);
        host.appendChild(empty);
        return;
      }
      if (existingEmpty) existingEmpty.remove();

      // Polish v8a: ações migraram para #data-actions (entre resumo e quality-card).
      // O antigo .solstice__data-table-btn-wrap injetado no TOPO foi removido.
      // Mantém compat: se existir do snapshot antigo, esconde.
      const oldWrap = host.querySelector('.solstice__data-table-btn-wrap');
      if (oldWrap) oldWrap.remove();
      const oldDerived = host.querySelector('.solstice__calc-columns-panel');
      if (oldDerived) oldDerived.remove();
      // Render novos blocos (Medidas + Ações)
      if (typeof renderMeasuresPanel === 'function') renderMeasuresPanel();
      if (typeof renderDataActions === 'function') renderDataActions();

      // Garante visibilidade dos sub-painéis (cards de colunas + medidas)
      const summary = host.querySelector('#dataset-summary');
      const quality = host.querySelector('#quality-card');
      const editor = host.querySelector('#editor-panel');
      [summary, quality, editor].forEach(el => el && el.classList.remove('solstice__hidden'));
    }

    /**
     * B12-r1 (ADR-093): painel de Dicionários refeito.
     * Os 6 pré-feitos SEMPRE visíveis como cards grandes. Antes era escondido
     * em lista pequena depois dos salvos.
     */
    function _renderDictsPanel(){
      const host = document.getElementById('dicionarios-panel');
      if (!host) return;
      host.innerHTML = '';
      const wrap = SolsticeUtils.el('div', { class:'solstice__dicts-panel' });
      wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__editor-title' },
        '🧠 Dicionários semânticos'));

      // Dicionário ativo (card destacado)
      const active = SolsticeStore.get('dictionary');
      if (active){
        const card = SolsticeUtils.el('div',
          { style:'background:color-mix(in srgb,var(--c-accent) 12%, transparent);border:2px solid var(--c-accent);border-radius:var(--rad-md);padding:var(--sp-3);margin-bottom:var(--sp-3);' });
        card.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-accent);font-weight:var(--fw-bold);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;' },
          '🟢 ATIVO'));
        card.appendChild(SolsticeUtils.el('div', { style:'font-size:var(--fs-sm);font-weight:var(--fw-semibold);color:var(--c-text);' },
          active.name || 'Dicionário sem nome'));
        if (active.coverage != null){
          card.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-text-2);margin-top:2px;font-family:var(--font-mono);' },
            'Cobertura ' + Math.round(active.coverage * 100) + '%'));
        }
        const exportBtn = SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost',
          style:'font-size:10px;padding:4px 10px;height:24px;margin-top:8px;width:100%;',
          onclick: () => {
            const blob = new Blob([JSON.stringify(active, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'dicionario-' + (active.name || 'solstice').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json';
            a.click();
            URL.revokeObjectURL(a.href);
            SolsticeToast.success('Dicionário exportado');
          }
        }, '⬇️ Exportar JSON');
        card.appendChild(exportBtn);
        wrap.appendChild(card);
      }

      // Dicionários salvos (se houver)
      const saved = SolsticeDictionary.listSaved();
      if (saved.length){
        wrap.appendChild(SolsticeUtils.el('div', { style:'margin-top:var(--sp-3);font-size:var(--fs-xs);color:var(--c-muted);font-weight:var(--fw-semibold);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--sp-2);' },
          '💾 Meus salvos (' + saved.length + ')'));
        saved.forEach(name => {
          const item = SolsticeUtils.el('div', { class:'solstice__dict-item' });
          item.appendChild(SolsticeUtils.el('span', { class:'solstice__dict-item-icon' }, '💾'));
          const body = SolsticeUtils.el('div', { class:'solstice__dict-item-body' });
          body.appendChild(SolsticeUtils.el('div', { class:'solstice__dict-item-name' }, name));
          body.appendChild(SolsticeUtils.el('div', { class:'solstice__dict-item-meta' }, 'localStorage'));
          item.appendChild(body);
          const acts = SolsticeUtils.el('div', { class:'solstice__dict-item-actions' });
          acts.appendChild(SolsticeUtils.el('button', { title:'Aplicar', 'aria-label':'Aplicar dicionário ' + name, onclick: () => {
            const d = SolsticeDictionary.load(name);
            // Prompt 1 LGPD: preserva _presetKey se já estiver salvo (dict salvo de banco_pj)
            if (d){ SolsticeStore.set('dictionary', d); SolsticeToast.success('Dicionário aplicado', name); _renderDictsPanel(); }
          }}, '✓'));
          item.appendChild(acts);
          wrap.appendChild(item);
        });
      }

      // 6 PRÉ-FEITOS como cards grandes — SEMPRE visíveis (ADR-093)
      wrap.appendChild(SolsticeUtils.el('div', { style:'margin-top:var(--sp-3);font-size:var(--fs-xs);color:var(--c-muted);font-weight:var(--fw-semibold);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--sp-2);' },
        '✨ Pré-feitos (6 domínios)'));
      wrap.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);margin-bottom:var(--sp-2);line-height:1.4;' },
        'Aplicar ajuda a detectar automaticamente friendlyName + higherIsBetter ao importar CSV.'));

      const presets = SolsticeDictionary.presets || {};
      Object.entries(presets).forEach(([key, p]) => {
        if (key === 'generico') return;
        const card = SolsticeUtils.el('div', { class:'solstice__dict-preset-card' });
        card.appendChild(SolsticeUtils.el('div', { class:'solstice__dict-preset-icon' }, p.emoji || '🧠'));
        const body = SolsticeUtils.el('div', { class:'solstice__dict-preset-body' });
        body.appendChild(SolsticeUtils.el('div', { class:'solstice__dict-preset-name' }, p.name || key));
        body.appendChild(SolsticeUtils.el('div', { class:'solstice__dict-preset-meta' },
          (Object.keys(p.columns || {}).length) + ' colunas mapeadas' + (p.domain ? ' · ' + p.domain : '')));
        card.appendChild(body);
        const acts = SolsticeUtils.el('div', { class:'solstice__dict-preset-actions' });
        acts.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--primary', title:'Aplicar ao dataset',
          onclick: () => {
            // Prompt 1 LGPD: registra preset de origem para bloqueio inteligente do LLM externo
            SolsticeStore.set('dictionary', { ...p, name: p.name, _presetKey: key });
            SolsticeToast.success('Dicionário aplicado', p.name);
            _renderDictsPanel();
          }
        }, 'Aplicar'));
        acts.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--ghost', title:'Ver colunas mapeadas',
          onclick: () => _openDictPreview(p, key) // Prompt 1 LGPD: passa key pro preview também aplicar com _presetKey
        }, 'Ver'));
        card.appendChild(acts);
        wrap.appendChild(card);
      });

      host.appendChild(wrap);
    }

    /** B12-r1 (ADR-093): modal preview das colunas de um dicionário.
     *  v5.4 (Prompt 1 LGPD): aceita `presetKey` opcional para preservar origem ao aplicar. */
    async function _openDictPreview(p, presetKey){
      await SolsticeModal.show({
        title: (p.emoji || '🧠') + ' ' + (p.name || 'Dicionário'),
        size: 'lg',
        body: () => {
          const wrap = SolsticeUtils.el('div');
          wrap.appendChild(SolsticeUtils.el('p', { style:'color:var(--c-muted);font-size:var(--fs-xs);margin-bottom:var(--sp-3);' },
            'Colunas mapeadas — quando o CSV importado tiver essas colunas (por nome técnico ou sinônimo), o friendlyName/unit/higherIsBetter são aplicados automaticamente.'));
          const list = SolsticeUtils.el('div', { style:'max-height:380px;overflow-y:auto;' });
          Object.entries(p.columns || {}).forEach(([techKey, def]) => {
            const row = SolsticeUtils.el('div', { style:'display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:6px 0;border-bottom:1px dashed var(--c-border);font-size:var(--fs-xs);' });
            const tech = SolsticeUtils.el('div');
            tech.appendChild(SolsticeUtils.el('span', { style:'font-family:var(--font-mono);color:var(--c-muted);' }, techKey));
            const friendly = SolsticeUtils.el('div');
            friendly.appendChild(SolsticeUtils.el('strong', null, def.friendlyName || techKey));
            const meta = [];
            if (def.unit) meta.push(def.unit);
            if (def.higherIsBetter === true) meta.push('↑ melhor');
            if (def.higherIsBetter === false) meta.push('↓ melhor');
            if (meta.length){
              friendly.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-muted);margin-left:6px;' }, '· ' + meta.join(' · ')));
            }
            row.append(tech, friendly);
            list.appendChild(row);
          });
          wrap.appendChild(list);
          return wrap;
        },
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn',
            onclick: () => {
              // Prompt 1 LGPD: preserva _presetKey ao aplicar do modal de preview
              SolsticeStore.set('dictionary', { ...p, name: p.name, _presetKey: presetKey || null });
              SolsticeToast.success('Aplicado', p.name); close(null); _renderDictsPanel();
            }
          }, '✓ Aplicar este'),
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Fechar')
        ]
      });
    }

    /** B11: render painel de Snapshots. */
    function _renderSnapsPanel(){
      const host = document.getElementById('snapshots-panel');
      if (!host) return;
      host.innerHTML = '';
      const wrap = SolsticeUtils.el('div');
      wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__editor-title' },
        '📸 Snapshots'));
      wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__cat-hint' },
        'Snapshots do perfil atual. Salvos em localStorage com compressão.'));

      const dsReady = SolsticeStore.get('dataset.ready');
      if (dsReady){
        wrap.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--primary',
          style:'width:100%;margin-top:var(--sp-2);',
          onclick: async () => {
            const nm = await SolsticeModal.prompt({
              title:'Salvar snapshot',
              defaultValue:'Snapshot ' + new Date().toLocaleString('pt-BR')
            });
            if (nm){ SolsticeSnapshots.save(nm); _renderSnapsPanel(); SolsticeToast.success('Snapshot salvo', nm); }
          }
        }, '💾 Salvar atual'));
      }

      const snaps = SolsticeSnapshots.list();
      wrap.appendChild(SolsticeUtils.el('div', { style:'margin-top:var(--sp-3);font-size:var(--fs-xs);color:var(--c-muted);text-transform:uppercase;letter-spacing:0.04em;' },
        snaps.length + ' salvo(s)'));
      const list = SolsticeUtils.el('div', { class:'solstice__dicts-list' });
      if (!snaps.length){
        list.appendChild(SolsticeUtils.el('div', { class:'solstice__snap-empty' },
          'Nenhum snapshot ainda. Salve o estado atual para reabrir depois.'));
      }
      snaps.forEach(snap => {
        // Sprint 36 / EV-ABA-03: melhorias na lista de snapshots:
        //   - Tooltip com nome completo (já que aba lateral é estreita)
        //   - Botões "Restaurar" (texto + emoji) em vez de só 📂 (não-óbvio)
        //   - Nome usa só hora se for "Snapshot DD/MM/YYYY, HH:MM:SS" auto
        const item = SolsticeUtils.el('div', {
          class:'solstice__dict-item',
          title: snap.name + ' · ' + new Date(snap.savedAt).toLocaleString('pt-BR')
        });
        item.appendChild(SolsticeUtils.el('span', { class:'solstice__dict-item-icon' }, '📸'));
        const body = SolsticeUtils.el('div', { class:'solstice__dict-item-body' });
        // Se nome auto-gerado começa com "Snapshot DD/MM..." abrevia pra "HH:MM"
        let displayName = snap.name;
        const autoMatch = /^Snapshot\s+\d{1,2}\/\d{1,2}\/\d{2,4}/.test(snap.name);
        if (autoMatch){
          const d = new Date(snap.savedAt);
          displayName = 'Snapshot ' + d.toLocaleString('pt-BR', { hour:'2-digit', minute:'2-digit' });
        }
        body.appendChild(SolsticeUtils.el('div', { class:'solstice__dict-item-name' }, displayName));
        body.appendChild(SolsticeUtils.el('div', { class:'solstice__dict-item-meta' },
          new Date(snap.savedAt).toLocaleDateString('pt-BR') + ' · ' + Math.round(snap.size/1024) + ' KB'));
        item.appendChild(body);
        const acts = SolsticeUtils.el('div', { class:'solstice__dict-item-actions' });
        // Sprint 36 / EV-ABA-03: botão "Restaurar" mais óbvio — ↻ Restaurar
        acts.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--ghost',
          style: 'font-size:11px;padding:3px 8px;',
          title:'Restaurar este snapshot (substitui o dashboard atual)',
          'aria-label':'Restaurar snapshot ' + snap.name,
          onclick: () => SolsticeSnapshots.load(snap.id)
        }, '↻ Restaurar'));
        acts.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--ghost',
          style: 'font-size:11px;padding:3px 8px;',
          title:'Remover snapshot',
          'aria-label':'Remover snapshot ' + snap.name,
          onclick: async () => {
            const ok = await SolsticeModal.confirm({ title:'Remover snapshot?', danger:true, message:snap.name, confirmLabel:'Remover' });
            if (ok){ SolsticeSnapshots.remove(snap.id); _renderSnapsPanel(); }
          }
        }, '🗑️'));
        item.appendChild(acts);
        list.appendChild(item);
      });
      wrap.appendChild(list);
      host.appendChild(wrap);
    }

    /**
     * MODELO1 v4 (Auditoria 2026.4): View dedicada de Modelo no estilo Power BI.
     * Overlay fullscreen sobrepõe o dashboard e mostra só os cards das bases +
     * linhas SVG de relação entre elas. Drag-and-drop futuro. Botão "← Voltar"
     * retorna pro dashboard. Padrão de UX consistente com Power BI Model View.
     */
    function _openModeloFullscreen(){
      // Remove overlay anterior se houver
      const old = document.getElementById('modelo-fullscreen-overlay');
      if (old) old.remove();
      const datasets = SolsticeStore.get('datasets') || [];
      const rels = (typeof SolsticeRelationships !== 'undefined' && SolsticeRelationships.list)
        ? SolsticeRelationships.list() : [];
      const overlay = SolsticeUtils.el('div', {
        id:'modelo-fullscreen-overlay',
        style:'position:fixed;inset:0;background:var(--c-bg);z-index:9999;display:flex;flex-direction:column;'
      });
      // Header com título + ações
      const header = SolsticeUtils.el('div', {
        style:'display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--c-border);background:var(--c-surface);'
      });
      const closeBtn = SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--ghost',
        title:'Voltar pro dashboard (ESC)',
        onclick: () => overlay.remove()
      }, '← Voltar');
      header.appendChild(closeBtn);
      // Sprint 24 / F-22: título agora explica que é interativo (drag).
      const titleWrap = SolsticeUtils.el('div', {
        style:'flex:1;display:flex;flex-direction:column;gap:2px;'
      });
      titleWrap.appendChild(SolsticeUtils.el('div', {
        style:'font-size:16px;font-weight:600;'
      }, '🗂️ Modelo de Dados — Visão Geral'));
      titleWrap.appendChild(SolsticeUtils.el('div', {
        style:'font-size:11px;color:var(--c-muted);'
      }, '💡 Arraste as bases pra reorganizar. As posições são salvas automaticamente.'));
      header.appendChild(titleWrap);
      // Botão Reset posições (Sprint 24 / F-22)
      header.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--ghost',
        style:'font-size:12px;',
        title:'Volta cards pro layout em grade',
        onclick: () => {
          SolsticeStore.set('ui.modelo.positions', {});
          overlay.remove();
          _openModeloFullscreen();
        }
      }, '↺ Reset layout'));
      header.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn',
        style:'font-size:12px;',
        onclick: () => {
          if (SolsticeRelationships && SolsticeRelationships._openCreateModal) SolsticeRelationships._openCreateModal();
        }
      }, '+ Relação'));
      overlay.appendChild(header);

      // Canvas SVG com bases + linhas
      const canvas = SolsticeUtils.el('div', {
        style:'flex:1;position:relative;overflow:auto;padding:40px;background:var(--c-bg);'
      });
      if (!datasets.length){
        canvas.appendChild(SolsticeUtils.el('div', {
          style:'padding:40px;text-align:center;color:var(--c-muted);'
        },
          SolsticeUtils.el('div', { style:'font-size:48px;margin-bottom:12px;' }, '📭'),
          SolsticeUtils.el('div', { style:'font-size:16px;font-weight:600;margin-bottom:8px;' }, 'Sem bases carregadas'),
          SolsticeUtils.el('div', { style:'font-size:13px;' }, 'Importe pelo menos 1 CSV pelo header → Importar.')));
        overlay.appendChild(canvas);
        document.body.appendChild(overlay);
        return;
      }

      // Layout em grade — cards posicionados absolute pra permitir linhas SVG.
      // Sprint 24 / F-22 + F-04: agora com drag-and-drop pra reposicionar cards
      // (estilo Power BI Model View). Posições persistem em Store via
      // ui.modelo.positions[baseId] = { x, y }. Default = layout em grid se
      // não houver posição salva.
      const CARD_W = 240, CARD_H = 180, GAP = 60;
      const cols = Math.min(3, datasets.length);
      const positions = {};
      const savedPositions = SolsticeStore.get('ui.modelo.positions') || {};
      const cardsWrap = SolsticeUtils.el('div', {
        class: 'solstice__modelo-canvas',
        style:'position:relative;width:' + Math.max(900, cols * (CARD_W + GAP)) + 'px;min-height:600px;'
      });
      datasets.forEach((d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // Usa posição salva se houver, caso contrário cai no grid default.
        const saved = savedPositions[d.id];
        const x = (saved && typeof saved.x === 'number') ? saved.x : col * (CARD_W + GAP);
        const y = (saved && typeof saved.y === 'number') ? saved.y : row * (CARD_H + GAP);
        positions[d.id] = { x: x + CARD_W/2, y: y + CARD_H/2, w: CARD_W, h: CARD_H };
        const card = SolsticeUtils.el('div', {
          'data-base-id': d.id,
          class: 'solstice__modelo-card',
          style:'position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + CARD_W + 'px;min-height:' + CARD_H + 'px;background:var(--c-surface);border:2px solid var(--c-border);border-radius:8px;padding:12px;box-shadow:var(--sh-2);z-index:2;cursor:grab;user-select:none;'
        });
        // F-04 / Sprint 24: drag pra reposicionar. mousedown captura posição
        // inicial, mousemove atualiza style.left/top, mouseup persiste e
        // re-renderiza linhas SVG.
        card.addEventListener('mousedown', (ev) => {
          // Ignora drag em scroll interno (colsList)
          if (ev.target.closest('[data-no-drag]')) return;
          ev.preventDefault();
          card.style.cursor = 'grabbing';
          card.style.zIndex = '5';
          const startX = ev.clientX, startY = ev.clientY;
          const origX = parseInt(card.style.left, 10) || 0;
          const origY = parseInt(card.style.top, 10) || 0;
          const onMove = (mv) => {
            const nx = Math.max(0, origX + (mv.clientX - startX));
            const ny = Math.max(0, origY + (mv.clientY - startY));
            card.style.left = nx + 'px';
            card.style.top = ny + 'px';
            positions[d.id].x = nx + CARD_W/2;
            positions[d.id].y = ny + CARD_H/2;
            // Atualiza linhas SVG em tempo real
            const svgEl = cardsWrap.querySelector('svg');
            if (svgEl){
              svgEl.querySelectorAll('line[data-rel-from][data-rel-to]').forEach(lineEl => {
                const from = positions[lineEl.getAttribute('data-rel-from')];
                const to   = positions[lineEl.getAttribute('data-rel-to')];
                if (from && to){
                  lineEl.setAttribute('x1', from.x); lineEl.setAttribute('y1', from.y);
                  lineEl.setAttribute('x2', to.x);   lineEl.setAttribute('y2', to.y);
                }
              });
              svgEl.querySelectorAll('text[data-rel-from][data-rel-to]').forEach(textEl => {
                const from = positions[textEl.getAttribute('data-rel-from')];
                const to   = positions[textEl.getAttribute('data-rel-to')];
                if (from && to){
                  textEl.setAttribute('x', (from.x + to.x) / 2);
                  textEl.setAttribute('y', (from.y + to.y) / 2 - 8);
                }
              });
            }
          };
          const onUp = () => {
            card.style.cursor = 'grab';
            card.style.zIndex = '2';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            // Persiste posição
            const newPositions = { ...(SolsticeStore.get('ui.modelo.positions') || {}) };
            newPositions[d.id] = { x: parseInt(card.style.left, 10), y: parseInt(card.style.top, 10) };
            SolsticeStore.set('ui.modelo.positions', newPositions);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
        card.appendChild(SolsticeUtils.el('div', {
          style:'font-weight:600;font-size:13px;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
        }, '📁 ' + d.name));
        card.appendChild(SolsticeUtils.el('div', {
          style:'font-family:var(--font-mono);font-size:10px;color:var(--c-muted);margin-bottom:8px;'
        }, (d.rows||[]).length.toLocaleString('pt-BR') + ' linhas · ' + (d.columns||[]).length + ' colunas'));
        // 'data-no-drag' impede o handler de drag do card de capturar
        // mousedown no scroll interno (caso o usuário queira scrollar a lista
        // de colunas sem mover o card).
        const colsList = SolsticeUtils.el('div', { 'data-no-drag': '1', style:'font-family:var(--font-mono);font-size:10px;line-height:1.5;color:var(--c-text-2);max-height:96px;overflow-y:auto;' });
        (d.columns || []).slice(0, 8).forEach(c => {
          const t = (d.types && d.types[c] && d.types[c].type) || '?';
          const icon = (typeof SolsticeTypes !== 'undefined' && SolsticeTypes.icon) ? (SolsticeTypes.icon(t) || '·') : '·';
          colsList.appendChild(SolsticeUtils.el('div', { style:'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, icon + ' ' + c));
        });
        if ((d.columns||[]).length > 8){
          colsList.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:9px;' }, '+ ' + ((d.columns||[]).length - 8) + ' colunas'));
        }
        card.appendChild(colsList);
        cardsWrap.appendChild(card);
      });

      // SVG com linhas de relação
      const numRows = Math.ceil(datasets.length / cols);
      const svgW = cols * (CARD_W + GAP);
      const svgH = numRows * (CARD_H + GAP);
      cardsWrap.style.height = svgH + 'px';
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', svgW);
      svg.setAttribute('height', svgH);
      svg.style.position = 'absolute';
      svg.style.left = '0'; svg.style.top = '0';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = '1';
      rels.forEach(rel => {
        const a = positions[rel.fromDatasetId];
        const b = positions[rel.toDatasetId];
        if (!a || !b) return;
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        line.setAttribute('stroke', 'var(--c-accent)');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('opacity', '0.7');
        // Sprint 24 / F-04: tag from/to pra drag handler atualizar em tempo real.
        line.setAttribute('data-rel-from', rel.fromDatasetId);
        line.setAttribute('data-rel-to', rel.toDatasetId);
        svg.appendChild(line);
        // Label cardinalidade no meio
        const mid = document.createElementNS(svgNS, 'text');
        mid.setAttribute('x', (a.x + b.x) / 2);
        mid.setAttribute('y', (a.y + b.y) / 2 - 8);
        mid.setAttribute('text-anchor', 'middle');
        mid.setAttribute('fill', 'var(--c-accent)');
        mid.setAttribute('font-size', '11');
        mid.setAttribute('font-weight', 'bold');
        mid.setAttribute('data-rel-from', rel.fromDatasetId);
        mid.setAttribute('data-rel-to', rel.toDatasetId);
        mid.textContent = rel.cardinality || '1:N';
        svg.appendChild(mid);
      });
      cardsWrap.appendChild(svg);
      canvas.appendChild(cardsWrap);
      overlay.appendChild(canvas);

      // ESC fecha — Auditoria 2026 (MC-01 / HV-02): trackListener com overlay como host.
      const onEsc = (e) => {
        if (e.key === 'Escape'){
          SolsticeUtils.cleanupListeners(overlay);
          overlay.remove();
        }
      };
      SolsticeUtils.trackListener(overlay, document, 'keydown', onEsc);

      document.body.appendChild(overlay);
    }

    /**
     * v5+MODELO1 v4 (Auditoria 2026.4): aba Modelo da sidebar mostra atalho
     * compacto + BOTÃO "🔍 Abrir Modelo em Tela Cheia" — abre overlay tipo
     * Power BI. Sidebar mantém Bases + Relacionamentos (injetados por
     * MultiCSV/Relationships). O fullscreen mostra a view DEDICADA.
     */
    function _renderModeloPanel(){
      const host = document.getElementById('modelo-panel');
      if (!host) return;
      // CTA pra abrir fullscreen no topo do painel modelo
      let cta = document.getElementById('modelo-open-fullscreen-cta');
      if (!cta){
        cta = SolsticeUtils.el('button', {
          id:'modelo-open-fullscreen-cta',
          class:'solstice__btn solstice__btn--primary',
          style:'width:100%;margin-bottom:8px;font-size:12px;padding:8px;',
          title:'Abrir Modelo de Dados em tela cheia (estilo Power BI)',
          onclick: () => _openModeloFullscreen()
        }, '🔍 Abrir Modelo em Tela Cheia');
        host.insertBefore(cta, host.firstChild);
      }
      try { if (typeof MultiCSV !== 'undefined' && MultiCSV._mountUI) MultiCSV._mountUI(); } catch(_){}
      try { if (typeof MultiCSV !== 'undefined' && MultiCSV.renderPanel) MultiCSV.renderPanel(); } catch(_){}
      try { if (typeof SolsticeRelationships !== 'undefined' && SolsticeRelationships._renderPanel) SolsticeRelationships._renderPanel(); } catch(_){}
      return;
      // === LEGACY (não executado) ===
      host.innerHTML = '';
      const datasets = SolsticeStore.get('datasets') || [];
      const activeId = SolsticeStore.get('datasets.activeId');
      const rels = (typeof SolsticeRelationships !== 'undefined' && SolsticeRelationships.list)
        ? SolsticeRelationships.list() : [];

      const wrap = SolsticeUtils.el('div');
      // Header com ações
      const header = SolsticeUtils.el('div', {
        style:'display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);'
      });
      header.appendChild(SolsticeUtils.el('div', { class:'solstice__editor-title' },
        '🗂️ Modelo de Dados'));
      const acts = SolsticeUtils.el('div', { style:'display:flex;gap:6px;' });
      acts.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--ghost',
        style:'font-size:11px;padding:3px 8px;',
        title:'Importar mais um CSV',
        onclick: () => { const fi = document.getElementById('file-input'); if (fi) fi.click(); }
      }, '+ CSV'));
      if (datasets.length >= 2){
        acts.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--primary',
          style:'font-size:11px;padding:3px 8px;',
          title:'Criar relacionamento entre 2 bases por chave',
          onclick: () => {
            if (SolsticeRelationships && SolsticeRelationships._openCreateModal){
              SolsticeRelationships._openCreateModal();
            }
          }
        }, '🔗 Conectar'));
      }
      header.appendChild(acts);
      wrap.appendChild(header);

      if (!datasets.length){
        wrap.appendChild(SolsticeUtils.el('div', {
          style:'padding:24px;text-align:center;color:var(--c-muted);background:var(--c-surface-2);border-radius:var(--rad-md);border:1px dashed var(--c-border);'
        },
          SolsticeUtils.el('div', { style:'font-size:32px;margin-bottom:8px;opacity:.5;' }, '📭'),
          SolsticeUtils.el('div', { style:'font-weight:600;margin-bottom:4px;' }, 'Nenhuma base carregada'),
          SolsticeUtils.el('div', { style:'font-size:12px;line-height:1.5;' }, 'Use 📁 Importar (header) ou + CSV (acima) para começar.')));
        host.appendChild(wrap);
        return;
      }

      // === Visão Power BI v2 (ENXUGAR2 fix): grid CSS responsivo em vez de
      // absolute positioning (que estava sobrepondo a seção de relacionamentos). ===
      const canvas = SolsticeUtils.el('div', {
        class:'solstice__model-canvas',
        style:'display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:10px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--rad-md);padding:12px;margin-bottom:var(--sp-3);'
      });

      const cards = [];
      datasets.forEach((d, i) => {
        const card = SolsticeUtils.el('div', {
          class:'solstice__model-base' + (d.id === activeId ? ' is-active' : ''),
          'data-base-id': d.id,
          title: 'Clique para ativar · ' + (d.rows||[]).length + ' linhas',
          style:'background:var(--c-surface);border:2px solid ' + (d.id === activeId ? 'var(--c-accent)' : 'var(--c-border)') +
                ';border-radius:8px;padding:10px;cursor:pointer;transition:all 120ms;position:relative;',
          onclick: () => {
            if (typeof MultiCSV !== 'undefined' && MultiCSV.activate) MultiCSV.activate(d.id);
            else if (window.Solstice && window.Solstice.V56 && window.Solstice.V56.MultiCSV) window.Solstice.V56.MultiCSV.activate(d.id);
            _renderModeloPanel();
          }
        });
        // Header da base
        const head = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:6px;margin-bottom:6px;' });
        head.appendChild(SolsticeUtils.el('span', null, d.id === activeId ? '●' : '○'));
        head.appendChild(SolsticeUtils.el('strong', { style:'font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, d.name));
        card.appendChild(head);
        card.appendChild(SolsticeUtils.el('div', {
          style:'font-family:var(--font-mono);font-size:10px;color:var(--c-muted);margin-bottom:6px;'
        }, (d.rows||[]).length.toLocaleString('pt-BR') + ' linhas · ' + (d.columns||[]).length + ' colunas'));
        // Lista compacta das primeiras 4 colunas
        const colsBox = SolsticeUtils.el('div', { style:'font-family:var(--font-mono);font-size:10px;line-height:1.5;color:var(--c-text-2);' });
        (d.columns || []).slice(0, 4).forEach(c => {
          const t = (d.types && d.types[c] && d.types[c].type) || '?';
          const icon = SolsticeTypes && SolsticeTypes.icon ? (SolsticeTypes.icon(t) || '·') : '·';
          colsBox.appendChild(SolsticeUtils.el('div', { style:'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, icon + ' ' + c));
        });
        if ((d.columns||[]).length > 4){
          colsBox.appendChild(SolsticeUtils.el('div', {
            style:'color:var(--c-muted);font-size:9px;margin-top:2px;'
          }, '+' + ((d.columns||[]).length - 4) + ' colunas'));
        }
        card.appendChild(colsBox);
        // Botão remover
        const rm = SolsticeUtils.el('button', {
          style:'position:absolute;top:4px;right:4px;background:transparent;border:0;color:var(--c-muted);cursor:pointer;font-size:14px;padding:0 4px;',
          title:'Remover esta base',
          onclick: (e) => {
            e.stopPropagation();
            if (typeof MultiCSV !== 'undefined' && MultiCSV.remove) MultiCSV.remove(d.id);
            _renderModeloPanel();
          }
        }, '×');
        card.appendChild(rm);
        canvas.appendChild(card);
        cards.push({ id: d.id });
      });
      // ENXUGAR2 v4: grid CSS gerencia altura automaticamente — sem min-height fantasma.
      wrap.appendChild(canvas);

      // === Lista de relacionamentos ===
      const relsWrap = SolsticeUtils.el('div', {
        style:'background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--rad-md);padding:10px;'
      });
      relsWrap.appendChild(SolsticeUtils.el('div', {
        style:'font-size:11px;font-weight:600;color:var(--c-text-2);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;'
      }, '🔗 Relacionamentos (' + rels.length + ')'));
      if (!rels.length){
        relsWrap.appendChild(SolsticeUtils.el('div', {
          style:'font-size:11px;color:var(--c-muted);line-height:1.5;padding:6px;text-align:center;'
        }, datasets.length < 2
          ? 'Carregue 2+ bases para conectar por chave (1:N · 1:1 · N:N)'
          : 'Sem relacionamentos. Clique em 🔗 Conectar para vincular bases por coluna chave.'));
      } else {
        rels.forEach(rel => {
          const fromName = (datasets.find(d => d.id === rel.fromDatasetId) || {}).name || rel.fromDatasetId;
          const toName   = (datasets.find(d => d.id === rel.toDatasetId)   || {}).name || rel.toDatasetId;
          const it = SolsticeUtils.el('div', {
            style:'display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--c-surface);border-radius:var(--rad-sm);margin-bottom:4px;font-size:11px;'
          });
          it.appendChild(SolsticeUtils.el('span', { style:'font-family:var(--font-mono);' },
            fromName + '.' + rel.fromColumn + ' '));
          it.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-accent);font-weight:600;' }, rel.cardinality || '1:N'));
          it.appendChild(SolsticeUtils.el('span', { style:'font-family:var(--font-mono);flex:1;' },
            ' ' + toName + '.' + rel.toColumn));
          relsWrap.appendChild(it);
        });
      }
      wrap.appendChild(relsWrap);

      host.appendChild(wrap);
    }

    // Auditoria 2026 (cleanliness): _renderTemplatesPanel removida — explicitamente
    // marcada LEGACY no fonte (G1-04 v3). v4 moveu Templates para o topo com
    // sub-abas; este painel da sidebar nunca era chamado.

    /** B12-r1: atualiza badges das tabs com contagens dinâmicas. */
    function _updateBadges(){
      const ingest = SolsticeStore.get('ingest');
      const bd = document.getElementById('badge-dados');
      const bc = document.getElementById('badge-componentes');
      const bdi = document.getElementById('badge-dicionarios');
      const bsn = document.getElementById('badge-snapshots');
      if (bd){
        if (ingest && ingest.columns && ingest.columns.length){
          bd.textContent = ingest.columns.length;
          bd.classList.remove('solstice__hidden');
        } else { bd.classList.add('solstice__hidden'); }
      }
      if (bc) bc.textContent = SolsticeComponents.list().length;
      if (bdi){
        // 6 pré-feitos + salvos
        const presets = Object.keys(SolsticeDictionary.presets || {}).filter(k => k !== 'generico').length;
        const saved = SolsticeDictionary.listSaved().length;
        bdi.textContent = (presets + saved);
      }
      if (bsn){
        const snaps = (SolsticeSnapshots && SolsticeSnapshots.list) ? SolsticeSnapshots.list().length : 0;
        if (snaps > 0){
          bsn.textContent = snaps;
          bsn.classList.remove('solstice__hidden');
        } else { bsn.classList.add('solstice__hidden'); }
      }
    }

    function init(){
      // v4 (Auditoria 2026.4): ordem nova das abas — Dados, Modelo, Componentes, Snapshots, Dicionários.
      const tD  = document.getElementById('tab-dados');
      const tM  = document.getElementById('tab-modelo');
      const tC  = document.getElementById('tab-componentes');
      const tSn = document.getElementById('tab-snapshots');
      const tDi = document.getElementById('tab-dicionarios');
      const tIn = document.getElementById('tab-inspector');
      if (tD)  tD.addEventListener('click',  () => activate('dados'));
      if (tM)  tM.addEventListener('click',  () => activate('modelo'));
      if (tC)  tC.addEventListener('click',  () => activate('componentes'));
      if (tSn) tSn.addEventListener('click', () => activate('snapshots'));
      if (tDi) tDi.addEventListener('click', () => activate('dicionarios'));
      if (tIn) tIn.addEventListener('click', () => activate('inspector'));

      // Fase 7A: reparenta o <aside id="inspector"> pra dentro do
      // inspector-panel da sidebar (logo no boot). O painel à direita
      // não existe mais como coluna; vira filho da sidebar.
      const aside = document.getElementById('inspector');
      const insPanel = document.getElementById('inspector-panel');
      if (aside && insPanel && aside.parentElement !== insPanel){
        insPanel.appendChild(aside);
      }
      const tabList = [
        { el: tD,  id: 'dados' },
        { el: tM,  id: 'modelo' },
        { el: tC,  id: 'componentes' },
        { el: tSn, id: 'snapshots' },
        { el: tDi, id: 'dicionarios' }
      ];
      tabList.forEach((t, i) => {
        if (!t.el) return;
        t.el.addEventListener('keydown', (e) => {
          let nextIdx = null;
          if (e.key === 'ArrowRight') nextIdx = (i + 1) % tabList.length;
          else if (e.key === 'ArrowLeft') nextIdx = (i - 1 + tabList.length) % tabList.length;
          else if (e.key === 'Home') nextIdx = 0;
          else if (e.key === 'End') nextIdx = tabList.length - 1;
          else if (e.key === 'Enter' || e.key === ' '){
            e.preventDefault();
            activate(t.id);
            return;
          }
          if (nextIdx != null){
            e.preventDefault();
            activate(tabList[nextIdx].id);
            const nxt = tabList[nextIdx].el;
            if (nxt) nxt.focus();
          }
        });
      });
      // Patch Corretivo (BUG C): re-renderiza painel snapshots em saves/removes
      window.addEventListener('solstice:snapshots:changed', () => {
        if (active === 'snapshots') _renderSnapsPanel();
      });
      // B12-r1 + v4: subscribers reativos (inclui modelo agora)
      SolsticeStore.subscribe('dataset.ready', () => {
        if (active === 'componentes') _renderComponentsPanel();
        if (active === 'dados') _renderDataPanel();
        if (active === 'modelo') _renderModeloPanel();
        _updateBadges();
      });
      // v4: re-renderiza modelo quando datasets muda (add/remove base) ou relacionamentos
      SolsticeStore.subscribe('datasets', () => {
        if (active === 'modelo') _renderModeloPanel();
      });
      SolsticeStore.subscribe('datasets.activeId', () => {
        if (active === 'modelo') _renderModeloPanel();
      });
      SolsticeStore.subscribe('dictionary', () => {
        if (active === 'dicionarios') _renderDictsPanel();
        _updateBadges();
      });
      SolsticeStore.subscribe('ingest', _updateBadges);
      // B12-r1 (ADR-095): re-render catálogo quando seleção muda — para Modo Substituir
      SolsticeStore.subscribe('ui.inspector.slotId', () => {
        if (active === 'componentes') _renderComponentsPanel();
      });
      // Render inicial do data panel (estado vazio aparece na primeira pintura)
      _renderDataPanel();
      _updateBadges();

      // B12-r1: botões no rodapé da sidebar
      const btnShortcuts = document.getElementById('btn-show-shortcuts');
      if (btnShortcuts) btnShortcuts.addEventListener('click', _openShortcutsModal);
      // SOL-G4: #btn-show-tour removido do sidebar; tour acessível via Ctrl+K.

      // ADR-161 (Camada 1 D4): bind global Ctrl+/ (e Ctrl+?) para abrir modal de atalhos.
      // Padrão de mercado (Linear, Notion, VS Code). Não conflita com nada hoje.
      document.addEventListener('keydown', (e) => {
        if (e.target && e.target.matches && e.target.matches('input, textarea, [contenteditable="true"]')) return;
        if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
          e.preventDefault();
          _openShortcutsModal();
        }
        // Polish 13 (solstice-modular-v1): Alt + letra pra trocar de aba.
        // Alt evita conflito com typing comum mas é rápido de pressionar.
        // Mapeamento: D=Dados, M=Modelo, C=Componentes, S=Snapshots,
        // X=Dicionários (D já está ocupado), I=Inspector.
        if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey){
          const map = {
            'd': 'dados',     'D': 'dados',
            'm': 'modelo',    'M': 'modelo',
            'c': 'componentes','C': 'componentes',
            's': 'snapshots', 'S': 'snapshots',
            'x': 'dicionarios','X': 'dicionarios',
            'i': 'inspector', 'I': 'inspector',
          };
          const which = map[e.key];
          if (which){
            e.preventDefault();
            activate(which);
          }
        }
        // Polish 36: Esc fecha Inspector + deseleciona tile + volta pra Dados.
        if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey){
          const insOpen = SolsticeStore.get('ui.inspector.open');
          if (insOpen && typeof SolsticeInspector !== 'undefined'){
            e.preventDefault();
            SolsticeInspector.close();
          }
        }
        // Polish 36: Ctrl+E (Express) — Auto-Dashboard rápido.
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && !e.shiftKey && !e.altKey){
          const ingest = SolsticeStore.get('ingest');
          if (ingest && ingest.rows && ingest.rows.length && typeof SolsticeAutoDashboard !== 'undefined'){
            e.preventDefault();
            SolsticeAutoDashboard.run({ silent: false });
          }
        }
        // Polish 45 (solstice-modular-v1): Ctrl+Shift+N — nova seção.
        // Usa SolsticeCanvas.addSection se disponível.
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n'){
          if (typeof SolsticeCanvas !== 'undefined' && SolsticeCanvas.addSection){
            e.preventDefault();
            SolsticeCanvas.addSection('Nova seção');
            SolsticeToast.success('Seção adicionada', 'Pronta pra receber tiles');
          }
        }
        // Polish 45: Ctrl+D — duplica tile selecionado (se há).
        // Não conflita com bookmark (browser intercepta antes, mas só fora
        // de inputs onde já filtramos).
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd'){
          const selSlotId = SolsticeStore.get('ui.inspector.slotId');
          if (selSlotId && typeof SolsticeCanvas !== 'undefined' && SolsticeCanvas.duplicateSlot){
            e.preventDefault();
            try {
              SolsticeCanvas.duplicateSlot(selSlotId);
              SolsticeToast.success('Componente duplicado');
            } catch(err){
              SolsticeLog.warn('[duplicate]', err && err.message);
            }
          }
        }
      });
    }

    /** ADR-161 (Camada 1 D4): modal de atalhos categorizado + busca interna.
        5 categorias (Geral · Navegação · Edição · Análise · Modos) · busca live
        filtra entradas por nome do atalho OU descrição (NFD normalized contains).
        Atalho global Ctrl+/ (ou Ctrl+?) abre o modal. */
    async function _openShortcutsModal(){
      // Estrutura: cada categoria tem entries [tecla, descrição].
      const CATEGORIES = [
        { id:'geral',     icon:'⚙️', title:'Geral', entries: [
          ['Ctrl + K',         'Command Palette (busca de ações)'],
          ['Ctrl + /',         'Abrir este modal de atalhos'],
          ['Ctrl + Shift + ?', 'Abrir este modal de atalhos (alternativa)'],
          ['?',                'Ajuda / Onboarding'],
          ['Ctrl + Shift + D', 'Inspector de debug'],
          ['Ctrl + E',         'Auto-Dashboard (Express)'],
          ['Ctrl + Shift + N', 'Nova seção no canvas'],
          ['Ctrl + D',         'Duplicar componente selecionado'],
          ['Esc',              'Fechar Inspector / deselecionar componente'],
        ]},
        { id:'abas',      icon:'🗂️', title:'Trocar de aba (Sidebar)', entries: [
          ['Alt + D', 'Dados'],
          ['Alt + M', 'Modelo'],
          ['Alt + C', 'Componentes'],
          ['Alt + S', 'Snapshots'],
          ['Alt + X', 'Dicionários'],
          ['Alt + I', 'Inspector (propriedades do componente)'],
        ]},
        { id:'navegacao', icon:'🧭', title:'Navegação', entries: [
          ['Esc',              'Fechar painel / modal / modo atual'],
          ['↑ ↓',              'Navegar listas (palette, modais, autocomplete)'],
          ['Enter',            'Selecionar item focado'],
          ['Home',             'Rolar canvas para o topo'],
          ['End',              'Rolar canvas até o fim'],
          ['Tab',              'Navegar entre controles (acessibilidade)']
        ]},
        { id:'edicao',    icon:'✏️', title:'Edição', entries: [
          ['Ctrl + Z',         'Desfazer última ação'],
          ['Ctrl + Shift + Z', 'Refazer ação desfeita'],
          ['Ctrl + S',         'Salvar snapshot rápido'],
          ['Ctrl + Shift + S', 'Salvar como… (escolher nome)'],
          ['Ctrl + O',         'Abrir snapshots'],
          ['Ctrl + I',         'Importar CSV']
        ]},
        { id:'analise',   icon:'📈', title:'Análise', entries: [
          ['Ctrl + P',         'Smart Query — pergunte em português'],
          ['📈 (na casca)',    'Abrir drawer de análise estatística do componente']
        ]},
        { id:'modos',     icon:'🎬', title:'Modos', entries: [
          ['F',                'Entrar/sair do modo Slides'],
          ['← →',              'Navegar slides ou passos do Tour'],
          ['Espaço',           'Próximo slide']
        ]}
      ];

      // Reusa a normalização do catálogo (escopo do mesmo módulo).
      function _norm(s){
        return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      }

      await SolsticeModal.show({
        title: '⌨️ Atalhos do Solstice',
        size: 'lg',
        body: () => {
          const wrap = SolsticeUtils.el('div', { class:'solstice__shortcuts-modal' });

          // Input de busca
          const searchWrap = SolsticeUtils.el('div', { class:'solstice__shortcuts-search' });
          const searchInput = SolsticeUtils.el('input', {
            type:'search',
            class:'solstice__cat-search-input',
            placeholder:'Buscar atalho (ex: salvar, slide, undo)…',
            'aria-label':'Buscar atalho',
            autocomplete:'off'
          });
          searchWrap.appendChild(searchInput);
          wrap.appendChild(searchWrap);

          // Renderiza categorias
          const sectionEls = [];
          CATEGORIES.forEach(cat => {
            const sec = SolsticeUtils.el('section', { class:'solstice__shortcuts-cat', 'data-cat-id': cat.id });
            const h = SolsticeUtils.el('h3', { class:'solstice__shortcuts-cat-title' },
              SolsticeUtils.el('span', { 'aria-hidden':'true' }, cat.icon + ' '),
              SolsticeUtils.el('span', null, cat.title));
            sec.appendChild(h);
            cat.entries.forEach(([k, desc]) => {
              const row = SolsticeUtils.el('div', { class:'solstice__shortcuts-row', 'data-search': _norm(k + ' ' + desc) });
              row.appendChild(SolsticeUtils.el('kbd', { class:'solstice__shortcuts-kbd' }, k));
              row.appendChild(SolsticeUtils.el('span', { class:'solstice__shortcuts-desc' }, desc));
              sec.appendChild(row);
            });
            sectionEls.push(sec);
            wrap.appendChild(sec);
          });

          // Empty state
          const empty = SolsticeUtils.el('div',
            { class:'solstice__cat-empty solstice__hidden' },
            'Nenhum atalho encontrado. Tente: salvar, slide, undo, palette...');
          wrap.appendChild(empty);

          // Wiring da busca
          function applyFilter(rawQuery){
            const q = _norm((rawQuery || '').trim());
            let totalVisible = 0;
            sectionEls.forEach(sec => {
              const rows = sec.querySelectorAll('.solstice__shortcuts-row');
              let secVisible = 0;
              rows.forEach(row => {
                const match = !q || row.getAttribute('data-search').includes(q);
                row.classList.toggle('solstice__hidden', !match);
                if (match) secVisible++;
              });
              sec.classList.toggle('solstice__hidden', secVisible === 0);
              totalVisible += secVisible;
            });
            empty.classList.toggle('solstice__hidden', totalVisible > 0);
          }

          const debounced = SolsticeUtils.debounce(applyFilter, 80);
          searchInput.addEventListener('input', e => debounced(e.target.value));
          searchInput.addEventListener('keydown', e => {
            if (e.key === 'Escape' && searchInput.value){
              searchInput.value = '';
              applyFilter('');
              e.stopPropagation();
            }
          });
          // Foco no input quando modal abre
          setTimeout(() => { try { searchInput.focus(); } catch(_){} }, 50);

          return wrap;
        },
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Fechar')
        ]
      });
    }

    function current(){ return active; }

    // R-06 v3: registry para painéis extensíveis. Os 5 painéis core (Dados,
    // Componentes, Dicionários, Snapshots, Templates) continuam hardcoded
    // por compatibilidade; novos painéis se registram aqui.
    // Uso: SolsticeSidebarTabs.registerPanel({ id:'meu', tabHtml:'...', renderInto:host => {...} })
    const _extPanels = [];
    function registerPanel(spec){
      if (!spec || !spec.id) return false;
      if (_extPanels.find(p => p.id === spec.id)) return false; // já existe
      _extPanels.push({
        id: spec.id,
        label: spec.label || spec.id,
        icon: spec.icon || '🧩',
        renderInto: typeof spec.renderInto === 'function' ? spec.renderInto : null,
        tabElId: spec.tabElId || ('tab-ext-' + spec.id),
        panelElId: spec.panelElId || ('panel-ext-' + spec.id)
      });
      return true;
    }
    function listExtPanels(){ return _extPanels.slice(); }

    return { activate, init, current, _renderComponentsPanel, openShortcuts: _openShortcutsModal,
      // Polish v8a fix: expoe para SolsticeEditor.renderDataActions chamar (escopo diferente)
      openCalculatedColumnModal: _openCalculatedColumnModal,
      // R-06 v3: registry de painéis extensíveis (não interfere nos 5 core)
      registerPanel, listExtPanels
    };
  })();
