
  /* ============================================================
     SolsticeDashHeader (Patch B5-r4) — banner visual customizável no
     topo do canvas, com gradiente, título, subtítulo, data dinâmica e
     altura configurável. (ADR-046, ADR-047)
     ============================================================ */
  const SolsticeDashHeader = (function(){

    const DEFAULT = {
      // v6-autonomous / B1-01: cabeçalho ATIVADO por padrão.
      // Antes era opt-in (enabled:false) — usuário tinha que descobrir openConfig.
      // Agora aparece desde o boot como "Dashboard sem título" clicável.
      enabled: true,
      title: 'Dashboard sem título',
      subtitle: '',
      // SOL-C2: logo do dashboard. data URL ou URL externa. Aparece overlay top-right.
      logo: null,
      showDate: true,
      dateMode: 'today',
      dateFixed: null,
      dateColumn: null,
      dateFunction: 'max',
      // Sprint 41: default era laranja Itaú gritante (#EC7000→#B85800).
      // Solstice-modular-v1 / 7D: default mais sutil que segue a paleta ativa.
      // O laranja Itaú vira opção (preset) pra quem quiser identidade Itaú —
      // não domina mais a tela pra todos os users por padrão.
      // Usa CSS vars: o gradient muda automaticamente quando o user troca de
      // paleta (Ocean/Sunset/Forest/etc).
      gradient: { from: 'var(--c-surface-2)', to: 'var(--c-accent)', direction: 'to right' },
      textColor: 'auto-white',
      height: 'compact'
    };

    const DIRECTIONS = [
      { value: 'to right',           label: 'Esquerda → Direita' },
      { value: 'to left',            label: 'Direita → Esquerda' },
      { value: 'to bottom',          label: 'Cima → Baixo' },
      { value: 'to top',             label: 'Baixo → Cima' },
      { value: 'to bottom right',    label: 'Diagonal ↘' },
      { value: 'to bottom left',     label: 'Diagonal ↙' },
      { value: 'to top right',       label: 'Diagonal ↗' },
      { value: 'radial',             label: 'Radial (centro)' }
    ];

    function get(){
      const stored = SolsticeStore.get('canvas.header');
      // Audit 2026.6: REMOVIDA a migração legacy que revertia gradient
      // #EC7000/#B85800 pro default. Ela conflitava com Polish 50 ("Modo
      // Itaú" preset) — todo set explícito de gradient Itaú era anulado.
      // Quem tem o legacy salvo pode trocar manualmente via Tema.
      return { ...DEFAULT, ...(stored || {}) };
    }
    function set(patch){
      const next = { ...get(), ...patch };
      SolsticeStore.set('canvas.header', next);
    }

    /**
     * Calcula cor do texto (#FFFFFF ou #000000) por luminância média
     * (ADR-047). Algoritmo sRGB linearizado WCAG.
     */
    function autoTextColor(fromHex, toHex){
      function lum(hex){
        const h = String(hex || '').replace('#','');
        const safe = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
        const m = safe.match(/.{2}/g);
        if (!m || m.length < 3) return 0.5;
        const [r, g, b] = m.map(x => {
          let v = parseInt(x, 16) / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      const avg = (lum(fromHex) + lum(toHex)) / 2;
      return avg < 0.5 ? '#FFFFFF' : '#000000';
    }

    function _resolveTextColor(cfg){
      if (cfg.textColor === 'auto-white' || cfg.textColor === 'auto-black' || !cfg.textColor){
        return autoTextColor(cfg.gradient.from, cfg.gradient.to);
      }
      return cfg.textColor;
    }

    function _resolveDate(cfg){
      if (!cfg.showDate) return '';
      if (cfg.dateMode === 'today'){
        return SolsticeLocale.date(new Date());
      }
      if (cfg.dateMode === 'fixed' && cfg.dateFixed){
        return SolsticeLocale.date(new Date(cfg.dateFixed));
      }
      if (cfg.dateMode === 'column' && cfg.dateColumn){
        const ingest = SolsticeStore.get('ingest');
        if (!ingest || !ingest.rows || !ingest.rows.length) return '';
        const dates = ingest.rows
          .map(r => new Date(r[cfg.dateColumn]))
          .filter(d => !isNaN(d));
        if (!dates.length) return '';
        let chosen;
        if (cfg.dateFunction === 'min') chosen = new Date(SolsticeStats.min(dates));
        else chosen = new Date(SolsticeStats.max(dates));
        return SolsticeLocale.date(chosen);
      }
      return '';
    }

    function _buildSubtitleText(cfg){
      const date = _resolveDate(cfg);
      const sub = (cfg.subtitle || '').trim();
      if (sub && date) return sub + ' · atualizado em ' + date;
      if (sub) return sub;
      if (date) return 'atualizado em ' + date;
      return '';
    }

    /** Cria elemento DOM do header conforme cfg. */
    function _buildEl(cfg){
      const cls = 'solstice__dash-header solstice__dash-header--' + (cfg.height || 'compact');
      const textColor = _resolveTextColor(cfg);
      const gradient = cfg.gradient && cfg.gradient.direction === 'radial'
        ? 'radial-gradient(circle, ' + cfg.gradient.from + ', ' + cfg.gradient.to + ')'
        : 'linear-gradient(' + (cfg.gradient && cfg.gradient.direction || 'to right') +
          ', ' + (cfg.gradient && cfg.gradient.from || 'var(--c-surface-2)') +
          ', ' + (cfg.gradient && cfg.gradient.to || 'var(--c-accent)') + ')';
      const el = SolsticeUtils.el('div', {
        class: cls,
        style: 'background:' + gradient + ';color:' + textColor + ';'
      });
      // v6-autonomous / B1-01 + Sprint 23 / UX-04: título inline-editable.
      // Antes: click sempre seleciona o conteúdo inteiro → impede que o usuário
      // clique no meio da palavra pra cursor naquela posição, e ainda quebrava
      // quando o usuário arrastava pra selecionar texto. Agora:
      //   - mousedown promove a contentEditable (não dispara select-all
      //     automático), preservando a posição do clique do usuário.
      //   - dblclick → seleciona tudo (intuitivo pra renomear rápido).
      //   - blur com seleção ativa fora do elemento NÃO reverte (mantém edit).
      // Sprint 29 / UX-02 v2: quando título é default ("Dashboard sem título"),
      // renderiza placeholder visual em opacity baixa com texto convidativo.
      // Quando user edita e salva nome diferente do default, opacity volta a 1.
      const titleIsDefault = !cfg.title || cfg.title === DEFAULT.title;
      const titleText = titleIsDefault ? 'Clique aqui pra nomear o dashboard' : cfg.title;
      const titleEl = SolsticeUtils.el('h2', {
        class:'solstice__dash-header-title' + (titleIsDefault ? ' solstice__dash-header-title--placeholder' : ''),
        title: 'Clique pra renomear o dashboard (duplo clique seleciona tudo)',
        style: 'cursor:text;outline:none;border-radius:4px;padding:2px 6px;margin:-2px -6px;' +
               (titleIsDefault ? 'opacity:0.5;font-weight:400;font-style:italic;' : '')
      }, titleText);
      titleEl.addEventListener('mousedown', () => {
        if (titleEl.contentEditable !== 'true'){
          titleEl.contentEditable = 'true';
          // não força focus/select-all aqui — mousedown nativo posiciona caret.
        }
      });
      titleEl.addEventListener('dblclick', () => {
        titleEl.contentEditable = 'true';
        titleEl.focus();
        const r = document.createRange(); r.selectNodeContents(titleEl);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      });
      titleEl.addEventListener('focus', () => {
        // Sprint 29 / UX-02 v2: se é placeholder, limpa texto pro user digitar
        // direto sem precisar apagar primeiro.
        if (titleEl.classList.contains('solstice__dash-header-title--placeholder')){
          titleEl.textContent = '';
          titleEl.classList.remove('solstice__dash-header-title--placeholder');
          titleEl.style.opacity = '';
          titleEl.style.fontWeight = '';
          titleEl.style.fontStyle = '';
        }
      });
      titleEl.addEventListener('blur', () => {
        // Sprint 23 / UX-04: se há seleção ativa em qualquer lugar do documento,
        // o usuário ainda está arrastando — não confirma o blur.
        try {
          const sel = window.getSelection && window.getSelection();
          if (sel && sel.toString().length > 0 && sel.anchorNode && titleEl.contains(sel.anchorNode)){
            // Ainda há seleção dentro do título — reabre.
            setTimeout(() => { try { titleEl.contentEditable = 'true'; titleEl.focus(); } catch(_){} }, 0);
            return;
          }
        } catch(_){}
        titleEl.contentEditable = 'false';
        // Sprint 29 / UX-02 v2: se voltou pra vazio, restaura placeholder
        let v = (titleEl.textContent || '').trim();
        if (!v){
          titleEl.textContent = 'Clique aqui pra nomear o dashboard';
          titleEl.classList.add('solstice__dash-header-title--placeholder');
          titleEl.style.opacity = '0.5';
          titleEl.style.fontStyle = 'italic';
          v = 'Dashboard sem título'; // mantém valor lógico default no Store
        }
        titleEl.textContent = v;
        try { set({ title: v }); } catch(_){}
        try { document.title = (v && v !== 'Dashboard sem título' ? v + ' — Solstice' : 'Solstice'); } catch(_){}
      });
      titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter'){ e.preventDefault(); titleEl.blur(); }
        if (e.key === 'Escape'){ e.preventDefault(); titleEl.textContent = cfg.title || 'Dashboard sem título'; titleEl.blur(); }
      });
      el.appendChild(titleEl);
      const subText = _buildSubtitleText(cfg);
      if (subText) el.appendChild(SolsticeUtils.el('div', { class:'solstice__dash-header-sub' }, subText));
      // SOL-C2: logo do dashboard (data URL ou URL). Overlay top-right via CSS.
      if (cfg.logo){
        const img = document.createElement('img');
        img.src = cfg.logo;
        img.alt = '';
        img.className = 'solstice__dash-header-logo';
        el.appendChild(img);
      }
      return el;
    }

    /**
     * Renderiza o header dentro do canvas (como primeiro filho). Chamado por Canvas.render.
     *
     * Sprint 23 / UX-02: o welcome page (canvas vazio, dataset não carregado)
     * mostrava "Dashboard sem título" no header — feedback do usuário foi de
     * que era confuso ("Dashboard sem título não deve aparecer na tela inicial").
     * Decisão: só renderiza o header se há canvas com sections OU se o usuário
     * customizou o título (≠ default). Welcome puro fica sem header.
     */
    function renderInto(canvasEl, opts){
      const cfg = get();
      if (!cfg.enabled) return;
      const isEmpty = !!(opts && opts.isEmpty);
      const titleIsDefault = !cfg.title || cfg.title === DEFAULT.title;
      if (isEmpty && titleIsDefault) return;
      const el = _buildEl(cfg);
      canvasEl.appendChild(el);
    }

    /** Auto-sugestão baseada no nome do CSV importado. */
    function _maybeAutoSuggest(){
      const cfg = get();
      if (cfg.enabled || cfg._suggestionShown) return;
      const ingest = SolsticeStore.get('ingest');
      if (!ingest || !ingest.sourceName) return;
      const titled = ingest.sourceName
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      set({ _suggestionShown: true });
      SolsticeToast.action({
        title: 'Cabeçalho de dashboard?',
        msg: 'Sugestão: "' + titled + '"',
        actionLabel: 'Configurar',
        actionFn: () => openConfig({ title: titled })
      });
    }

    /** Modal de configuração com preview ao vivo. */
    function openConfig(overrides){
      const initial = { ...get(), ...(overrides || {}) };
      // Ativa o header automaticamente se chamado com overrides (vindo da sugestão)
      if (overrides && Object.keys(overrides).length){
        initial.enabled = true;
      }
      let local = JSON.parse(JSON.stringify(initial));

      function patch(p){ local = { ...local, ...p }; refreshPreview(); }
      function patchGradient(p){ local.gradient = { ...local.gradient, ...p }; refreshPreview(); }

      const ingest = SolsticeStore.get('ingest');
      const temporalCols = (ingest && ingest.columns || []).filter(c => {
        const t = ingest.types && ingest.types[c];
        return t && SolsticeTypes.group(t.type) === 'temporal';
      });

      let previewHost;
      function refreshPreview(){
        if (!previewHost) return;
        previewHost.innerHTML = '';
        previewHost.appendChild(_buildEl(local));
      }

      function _label(text){
        return SolsticeUtils.el('div', { class:'solstice__props-label' }, text);
      }

      function _build(close){
        const wrap = SolsticeUtils.el('div', { class:'solstice__dash-config-modal' });

        // Helper: cabeçalho de seção visual dentro do modal
        function sectionHeader(icon, text){
          return SolsticeUtils.el('h4', { class:'solstice__dash-config-section-title' },
            SolsticeUtils.el('span', { 'aria-hidden':'true' }, icon),
            SolsticeUtils.el('span', null, text));
        }

        // Toggle "Exibir" (controle mestre — destacado)
        const enabledRow = SolsticeUtils.el('label', { class:'solstice__dash-config-toggle' });
        const enabledCb = SolsticeUtils.el('input', { type:'checkbox', onchange: e => patch({ enabled: !!e.target.checked }) });
        if (local.enabled) enabledCb.checked = true;
        enabledRow.appendChild(enabledCb);
        enabledRow.appendChild(SolsticeUtils.el('span', null, ' Exibir cabeçalho no topo do canvas'));
        wrap.appendChild(enabledRow);

        // === SEÇÃO: CONTEÚDO ===
        wrap.appendChild(sectionHeader('📝', 'Conteúdo'));

        // Título e Subtítulo
        const titleField = SolsticeUtils.el('div', { class:'solstice__props-field' });
        titleField.appendChild(_label('Título'));
        titleField.appendChild(SolsticeUtils.el('input', {
          class:'solstice__props-input', type:'text', value: local.title || '',
          oninput: e => patch({ title: e.target.value })
        }));
        wrap.appendChild(titleField);

        const subField = SolsticeUtils.el('div', { class:'solstice__props-field' });
        subField.appendChild(_label('Subtítulo (opcional)'));
        subField.appendChild(SolsticeUtils.el('input', {
          class:'solstice__props-input', type:'text', value: local.subtitle || '',
          oninput: e => patch({ subtitle: e.target.value })
        }));
        wrap.appendChild(subField);

        // SOL-C2: Logo do dashboard (file upload + preview no header live)
        const logoField = SolsticeUtils.el('div', { class:'solstice__props-field' });
        logoField.appendChild(_label('Logo (opcional)'));
        const logoRow = SolsticeUtils.el('div', { style:'display:flex;gap:8px;align-items:center;flex-wrap:wrap;' });
        const logoFileInput = SolsticeUtils.el('input', {
          type:'file', accept:'image/*',
          style:'flex:1;min-width:160px;font-size:12px;',
          onchange: (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            if (f.size > 300 * 1024){
              SolsticeToast.warn('Logo grande', 'Imagens acima de 300KB ficam pesadas no snapshot. Considere reduzir.');
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
              patch({ logo: ev.target.result });
              // atualiza preview tile e botão remover
              if (logoPreviewImg){ logoPreviewImg.src = ev.target.result; logoPreviewImg.style.display = ''; }
              if (logoClearBtn) logoClearBtn.style.display = '';
            };
            reader.readAsDataURL(f);
          }
        });
        const logoPreviewImg = SolsticeUtils.el('img', {
          src: local.logo || '',
          alt: 'Logo atual',
          style: 'height:32px;width:32px;object-fit:contain;border-radius:4px;border:1px solid var(--c-border);background:var(--c-surface);' + (local.logo ? '' : 'display:none;')
        });
        const logoClearBtn = SolsticeUtils.el('button', {
          type:'button', class:'solstice__btn solstice__btn--ghost',
          style: 'font-size:11px;padding:4px 8px;' + (local.logo ? '' : 'display:none;'),
          onclick: () => {
            patch({ logo: null });
            logoFileInput.value = '';
            logoPreviewImg.style.display = 'none';
            logoClearBtn.style.display = 'none';
          }
        }, '✕ Remover');
        logoRow.appendChild(logoFileInput);
        logoRow.appendChild(logoPreviewImg);
        logoRow.appendChild(logoClearBtn);
        logoField.appendChild(logoRow);
        logoField.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-top:4px;' },
          'PNG/JPG/SVG. Aparece no canto superior direito do cabeçalho do dashboard.'));
        wrap.appendChild(logoField);

        // Data
        const dateField = SolsticeUtils.el('div', { class:'solstice__props-field' });
        const showDateLabel = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-sm);' });
        const showDateCb = SolsticeUtils.el('input', { type:'checkbox', onchange: e => patch({ showDate: !!e.target.checked }) });
        if (local.showDate) showDateCb.checked = true;
        showDateLabel.appendChild(showDateCb);
        showDateLabel.appendChild(SolsticeUtils.el('span', null, ' Mostrar data'));
        dateField.appendChild(showDateLabel);

        const dateRadios = SolsticeUtils.el('div', { class:'solstice__dash-radio-group', style:'margin-top:var(--sp-2);' });
        const modes = [
          { v:'today',  l:'Data de hoje (automática)' },
          { v:'fixed',  l:'Data fixa' },
          { v:'column', l:'Valor de uma coluna' }
        ];
        modes.forEach(m => {
          const r = SolsticeUtils.el('label');
          const rb = SolsticeUtils.el('input', { type:'radio', name:'dash-date-mode', value: m.v,
            onchange: e => patch({ dateMode: e.target.value }) });
          if (local.dateMode === m.v) rb.checked = true;
          r.appendChild(rb);
          r.appendChild(SolsticeUtils.el('span', null, ' ' + m.l));
          if (m.v === 'fixed' && local.dateMode === 'fixed'){
            r.appendChild(SolsticeUtils.el('input', { type:'date',
              value: local.dateFixed ? String(local.dateFixed).slice(0,10) : '',
              onchange: e => patch({ dateFixed: e.target.value || null }) }));
          }
          if (m.v === 'column' && local.dateMode === 'column'){
            const sel = SolsticeUtils.el('select', { onchange: e => patch({ dateColumn: e.target.value || null }) });
            sel.appendChild(SolsticeUtils.el('option', { value:'' }, '— escolher —'));
            temporalCols.forEach(c => {
              const o = SolsticeUtils.el('option', { value: c }, c);
              if (c === local.dateColumn) o.selected = true;
              sel.appendChild(o);
            });
            r.appendChild(sel);
            if (!temporalCols.length){
              r.appendChild(SolsticeUtils.el('span', { style:'color:var(--c-warn);font-size:10px;margin-left:var(--sp-2);' }, '(sem colunas temporais)'));
            }
          }
          dateRadios.appendChild(r);
        });
        dateField.appendChild(dateRadios);

        if (local.dateMode === 'column' && temporalCols.length){
          const fnRow = SolsticeUtils.el('div', { style:'display:flex;gap:var(--sp-3);margin-top:var(--sp-2);font-size:var(--fs-xs);' });
          [['max','Máximo'],['min','Mínimo'],['recent','Mais recente']].forEach(([v,l]) => {
            const r = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:4px;' });
            const rb = SolsticeUtils.el('input', { type:'radio', name:'dash-date-fn', value: v,
              onchange: e => patch({ dateFunction: e.target.value }) });
            if ((local.dateFunction || 'max') === v) rb.checked = true;
            r.appendChild(rb);
            r.appendChild(SolsticeUtils.el('span', null, ' ' + l));
            fnRow.appendChild(r);
          });
          dateField.appendChild(fnRow);
        }

        wrap.appendChild(dateField);

        // === SEÇÃO: VISUAL ===
        wrap.appendChild(sectionHeader('🎨', 'Visual'));

        // Gradient cores
        function _colorInput(label, initialColor, onChange){
          const f = SolsticeUtils.el('div', { class:'solstice__props-field' });
          f.appendChild(_label(label));
          const ci = SolsticeUtils.el('div', { class:'solstice__dash-color-input' });
          const picker = SolsticeUtils.el('input', { type:'color', value: initialColor || '#000000',
            oninput: e => { onChange(e.target.value); txt.value = e.target.value; } });
          const txt = SolsticeUtils.el('input', { type:'text', value: initialColor || '',
            onchange: e => { const v = e.target.value.trim();
              if (/^#[0-9a-fA-F]{6}$/.test(v)){ onChange(v); picker.value = v; }
            }});
          ci.appendChild(picker); ci.appendChild(txt);
          f.appendChild(ci);
          return f;
        }

        const colorsRow = SolsticeUtils.el('div', { class:'solstice__dash-form-row' });
        colorsRow.appendChild(_colorInput('Cor inicial', local.gradient.from, v => patchGradient({ from: v })));
        colorsRow.appendChild(_colorInput('Cor final',   local.gradient.to,   v => patchGradient({ to: v })));
        wrap.appendChild(colorsRow);

        // Direção do gradiente
        const dirField = SolsticeUtils.el('div', { class:'solstice__props-field' });
        dirField.appendChild(_label('Direção do gradiente'));
        const dirSel = SolsticeUtils.el('select', { class:'solstice__props-select',
          onchange: e => patchGradient({ direction: e.target.value }) });
        DIRECTIONS.forEach(d => {
          const o = SolsticeUtils.el('option', { value: d.value }, d.label);
          if (local.gradient.direction === d.value) o.selected = true;
          dirSel.appendChild(o);
        });
        dirField.appendChild(dirSel);
        wrap.appendChild(dirField);

        // Cor texto
        const tcField = SolsticeUtils.el('div', { class:'solstice__props-field' });
        tcField.appendChild(_label('Cor do texto'));
        const tcGroup = SolsticeUtils.el('div', { class:'solstice__dash-radio-group' });
        const tcOpts = [
          ['auto-white', 'Automático (claro)'],
          ['auto-black', 'Automático (escuro)']
        ];
        tcOpts.forEach(([v,l]) => {
          const r = SolsticeUtils.el('label');
          const rb = SolsticeUtils.el('input', { type:'radio', name:'dash-text-color', value: v,
            onchange: e => patch({ textColor: e.target.value }) });
          if (local.textColor === v) rb.checked = true;
          r.appendChild(rb);
          r.appendChild(SolsticeUtils.el('span', null, ' ' + l));
          tcGroup.appendChild(r);
        });
        // Custom
        const customLabel = SolsticeUtils.el('label');
        const customRb = SolsticeUtils.el('input', { type:'radio', name:'dash-text-color', value:'custom',
          onchange: e => { if (e.target.checked) patch({ textColor: customColorPicker.value || '#FFFFFF' }); } });
        const isCustom = local.textColor && local.textColor.startsWith('#');
        if (isCustom) customRb.checked = true;
        const customColorPicker = SolsticeUtils.el('input', { type:'color',
          value: isCustom ? local.textColor : '#FFFFFF',
          oninput: e => { customRb.checked = true; patch({ textColor: e.target.value }); }
        });
        customLabel.appendChild(customRb);
        customLabel.appendChild(SolsticeUtils.el('span', null, ' Cor custom'));
        customLabel.appendChild(customColorPicker);
        tcGroup.appendChild(customLabel);
        tcField.appendChild(tcGroup);
        wrap.appendChild(tcField);

        // Altura
        const heightField = SolsticeUtils.el('div', { class:'solstice__props-field' });
        heightField.appendChild(_label('Altura'));
        const heightGroup = SolsticeUtils.el('div', { class:'solstice__dash-radio-group' });
        [['compact','Compacto (80px)'],['standard','Padrão (120px)'],['tall','Alto (180px)']].forEach(([v,l]) => {
          const r = SolsticeUtils.el('label');
          const rb = SolsticeUtils.el('input', { type:'radio', name:'dash-height', value: v,
            onchange: e => patch({ height: e.target.value }) });
          if ((local.height || 'compact') === v) rb.checked = true;
          r.appendChild(rb);
          r.appendChild(SolsticeUtils.el('span', null, ' ' + l));
          heightGroup.appendChild(r);
        });
        heightField.appendChild(heightGroup);
        wrap.appendChild(heightField);

        // Preview ao vivo
        wrap.appendChild(_label('Visualização ao vivo'));
        previewHost = SolsticeUtils.el('div', { class:'solstice__dash-header-preview' });
        previewHost.appendChild(_buildEl(local));
        wrap.appendChild(previewHost);

        return wrap;
      }

      SolsticeModal.show({
        title: '📋 Cabeçalho do dashboard',
        size: 'lg',
        body: _build,
        defaultClose: 'cancel',
        // Sprint 41 / feedback do usuário: backdrop fechava só com botão
        // Cancelar — padrão diferente de outros modais (relatório/inspector).
        // Volta pro default true. A proteção contra "dragStartedInside" no
        // SolsticeModal.show já evita fechar ao selecionar texto dentro do
        // form, então o motivo original (Patch B6-r1) está coberto.
        dismissOnBackdrop: true,
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn', onclick: () => close('cancel') }, 'Cancelar'),
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary',
            onclick: () => { set(local); SolsticeToast.success('Cabeçalho atualizado', local.title); close('ok'); } },
            'Aplicar')
        ]
      });
    }

    function init(){
      // Render reativo (Canvas chama renderInto, mas estes triggers garantem re-render
      // quando o header propriamente muda sem precisar re-renderizar todo o canvas)
      SolsticeStore.subscribe('canvas.header', () => SolsticeCanvas.render());
      SolsticeStore.subscribe('ingest', () => {
        // Re-render porque a data-coluna pode ter mudado
        SolsticeCanvas.render();
        _maybeAutoSuggest();
      });
    }

    // Auditoria 2026 (RT-03): adapter pra cumprir SolsticeStoreContract.
    function subscribe(_path, cb){ return SolsticeStore.subscribe('canvas.header', cb); }
    return { get, set, subscribe, autoTextColor, renderInto, openConfig, init, DIRECTIONS, DEFAULT };
  })();
