
  /* ============================================================
     SolsticeModal — diálogos bloqueantes Promise-based
     Substitui alert/confirm/prompt nativos (proibidos no projeto).
     API: show / confirm / prompt / select  — todas retornam Promise.
     ============================================================ */
  const SolsticeModal = (function(){

    function _focusables(root){
      return SolsticeUtils.qsa(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
        root
      );
    }

    /**
     * Abre modal genérico. Retorna Promise que resolve com o valor
     * passado por close(value). Esc resolve com defaultClose.
     *
     * opts: { title, body, footer, size, danger, defaultClose, onOpen }
     *   - body / footer: Element ou função (close) => Element
     */
    function show(opts){
      opts = opts || {};
      const dismissOnBackdrop = opts.dismissOnBackdrop !== false; // default true
      return new Promise(resolve => {
        let resolved = false;
        let dragStartedInside = false;  // Patch B6-r1: proteção contra arraste de seleção
        const lastFocus = document.activeElement;

        // Auditoria 2026.4 (Sprint 13a / A11y-02): aria-labelledby + ID no título.
        // Antes o leitor de tela anunciava "diálogo, modal" mas sem nome.
        // Agora anuncia o título do modal ao abrir. WCAG 4.1.2.
        const titleId = 'solstice-modal-title-' + Math.random().toString(36).slice(2, 8);
        const backdropAttrs = {
          class: 'solstice__cmodal-backdrop',
          role: 'dialog',
          'aria-modal': 'true',
          onmousedown: e => {
            // Marca se o drag começou DENTRO do modal — evita fechar ao soltar fora
            dragStartedInside = !!(e.target.closest && e.target.closest('.solstice__cmodal'));
          },
          onclick: e => {
            if (e.target !== backdrop) return;
            if (!dismissOnBackdrop) return;          // dismissOnBackdrop: false ignora completamente
            if (dragStartedInside) { dragStartedInside = false; return; } // proteção drag
            close(opts.defaultClose);
          }
        };
        if (opts.title) backdropAttrs['aria-labelledby'] = titleId;
        else backdropAttrs['aria-label'] = 'Diálogo';
        const backdrop = SolsticeUtils.el('div', backdropAttrs);
        const modal = SolsticeUtils.el('div', {
          class: 'solstice__cmodal'
            + (opts.size === 'lg' ? ' solstice__cmodal--lg' : '')
            + (opts.size === 'xl' ? ' solstice__cmodal--xl' : '')
        });

        if (opts.title){
          modal.appendChild(SolsticeUtils.el('div', { class: 'solstice__cmodal-header', id: titleId }, opts.title));
        }

        const bodyEl = SolsticeUtils.el('div', { class: 'solstice__cmodal-body' });
        const bodyContent = typeof opts.body === 'function' ? opts.body(close) : opts.body;
        if (bodyContent) bodyEl.appendChild(bodyContent instanceof Node ? bodyContent : document.createTextNode(String(bodyContent)));
        modal.appendChild(bodyEl);

        if (opts.footer){
          const fEl = SolsticeUtils.el('div', { class: 'solstice__cmodal-footer' });
          const fc = typeof opts.footer === 'function' ? opts.footer(close) : opts.footer;
          (Array.isArray(fc) ? fc : [fc]).forEach(n => n && fEl.appendChild(n));
          modal.appendChild(fEl);
        }

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Focus trap — Auditoria 2026 (MC-01 / HV-02): trackListener com backdrop como host.
        function onKey(e){
          if (e.key === 'Escape'){ e.preventDefault(); close(opts.defaultClose); return; }
          if (e.key !== 'Tab') return;
          const f = _focusables(modal);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
        }
        SolsticeUtils.trackListener(backdrop, document, 'keydown', onKey);

        // Foco automático
        setTimeout(() => {
          const f = _focusables(modal);
          if (f.length){
            // Prefere input; senão primeiro botão não-cancel
            const input = modal.querySelector('input,textarea,select');
            (input || f[0]).focus();
            if (input && input.select) input.select();
          }
        }, 50);

        if (opts.onOpen) opts.onOpen({ modal, backdrop, close });

        function close(value){
          if (resolved) return;
          resolved = true;
          // Auditoria 2026 (MC-01 / HV-02): cleanupListeners libera o keydown
          // (e qualquer outro listener trackeado no backdrop).
          SolsticeUtils.cleanupListeners(backdrop);
          backdrop.remove();
          if (lastFocus && lastFocus.focus) lastFocus.focus();
          resolve(value);
        }
      });
    }

    /**
     * confirm({ title, message, confirmLabel, cancelLabel, danger, skipKey? })
     *   → Promise<boolean>
     *
     * Patch B5-r3 (ADR-043): se `skipKey` for fornecido E o usuário tiver
     * marcado "Não perguntar mais" previamente, retorna Promise.resolve(true)
     * imediatamente. Persistência por perfil em localStorage.
     */
    function _skipKeyStorage(skipKey){
      const pid = (SolsticeProfiles && SolsticeProfiles.current() && SolsticeProfiles.current().id) || 'anon';
      return 'solstice.' + pid + '.skipConfirm.' + skipKey;
    }
    function isSkipped(skipKey){
      if (!skipKey) return false;
      try { return localStorage.getItem(_skipKeyStorage(skipKey)) === 'true'; }
      catch(e){ return false; }
    }
    function listSkipped(){
      const pid = (SolsticeProfiles && SolsticeProfiles.current() && SolsticeProfiles.current().id) || 'anon';
      const prefix = 'solstice.' + pid + '.skipConfirm.';
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i++){
          const k = localStorage.key(i);
          if (k && k.indexOf(prefix) === 0 && localStorage.getItem(k) === 'true'){
            out.push(k.slice(prefix.length));
          }
        }
      } catch(e){}
      return out;
    }
    function unskip(skipKey){
      try { localStorage.removeItem(_skipKeyStorage(skipKey)); } catch(e){}
    }

    function confirm(opts){
      opts = opts || {};
      // Atalho: já silenciado
      if (opts.skipKey && isSkipped(opts.skipKey)){
        return Promise.resolve(true);
      }
      let skipChecked = false;
      const message = SolsticeUtils.el('div', null, opts.message || '');
      const skipRow = opts.skipKey ? (() => {
        const wrap = SolsticeUtils.el('label', { class: 'solstice__cmodal-skip' });
        const cb = SolsticeUtils.el('input', {
          type: 'checkbox',
          onchange: e => { skipChecked = !!e.target.checked; }
        });
        wrap.appendChild(cb);
        wrap.appendChild(SolsticeUtils.el('span', null, ' Não perguntar mais sobre isso'));
        return wrap;
      })() : null;

      const body = SolsticeUtils.el('div', null, message, skipRow);

      return show({
        title: opts.title || 'Confirmar',
        body,
        danger: opts.danger,
        defaultClose: false,
        footer: (close) => [
          SolsticeUtils.el('button', { class: 'solstice__btn', onclick: () => close(false) },
            opts.cancelLabel || 'Cancelar'),
          SolsticeUtils.el('button',
            { class: 'solstice__btn ' + (opts.danger ? 'solstice__btn--danger' : 'solstice__btn--primary'),
              onclick: () => {
                if (opts.skipKey && skipChecked){
                  // Auditoria 2026 (AP-02): silent — "não perguntar mais" é
                  // UX leve. Se falhar, o modal volta a perguntar.
                  SolsticeStorage.safeSet(_skipKeyStorage(opts.skipKey), 'true', { silent: true });
                }
                close(true);
              }},
            opts.confirmLabel || 'Confirmar')
        ]
      });
    }

    /** prompt({ title, message, placeholder, defaultValue, type, confirmLabel, cancelLabel }) → Promise<string|null> */
    function prompt(opts){
      opts = opts || {};
      const input = SolsticeUtils.el('input', {
        class: 'solstice__cmodal-input',
        type: opts.type || 'text',
        placeholder: opts.placeholder || '',
        value: opts.defaultValue != null ? String(opts.defaultValue) : ''
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter'){ e.preventDefault(); close(input.value); }
      });
      let close;
      const body = SolsticeUtils.el('div', null,
        opts.message ? SolsticeUtils.el('div', null, opts.message) : null,
        input
      );
      return show({
        title: opts.title || 'Informar valor',
        body,
        defaultClose: null,
        onOpen: ({ close: c }) => { close = c; },
        footer: (c) => { close = c; return [
          SolsticeUtils.el('button', { class: 'solstice__btn', onclick: () => c(null) },
            opts.cancelLabel || 'Cancelar'),
          SolsticeUtils.el('button', { class: 'solstice__btn solstice__btn--primary', onclick: () => c(input.value) },
            opts.confirmLabel || 'OK')
        ]; }
      });
    }

    /**
     * select({ title, message, options, defaultValue, size, searchable })
     *   options: [{ value, label, desc, icon, synonyms? }] ou ['a','b','c']
     *   searchable: 'auto' | true | false   (default 'auto' = mostra busca se options.length > 8)
     * → Promise<string|null>
     */
    function select(opts){
      opts = opts || {};
      const normalized = (opts.options || []).map(o =>
        typeof o === 'string' ? { value: o, label: o } : o
      );
      let chosen = opts.defaultValue != null ? String(opts.defaultValue) : (normalized[0] && normalized[0].value);
      const useSearch = opts.searchable === true
        || (opts.searchable !== false && normalized.length > 8);

      function _norm(s){
        return String(s||'').toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g,'')
          .trim();
      }

      // Renderiza label com highlight do trecho buscado
      function _renderLabel(text, term){
        const span = document.createElement('span');
        if (!term){ span.textContent = text; return span; }
        const idx = _norm(text).indexOf(_norm(term));
        if (idx < 0){ span.textContent = text; return span; }
        span.appendChild(document.createTextNode(text.slice(0, idx)));
        const mk = document.createElement('mark');
        mk.textContent = text.slice(idx, idx + term.length);
        span.appendChild(mk);
        span.appendChild(document.createTextNode(text.slice(idx + term.length)));
        return span;
      }

      const list = SolsticeUtils.el('div', { class: 'solstice__select-options', role: 'radiogroup' });
      const items = [];           // [{ el, value, haystack, labelEl, descEl, label, desc }]
      const empty = SolsticeUtils.el('div', { class: 'solstice__select-empty solstice__hidden' },
        'Nenhum item encontrado. Tente outro termo.');

      let focusedIdx = -1;        // índice no array `items` (visíveis), para navegação por setas
      function _visibleItems(){ return items.filter(it => !it.el.classList.contains('solstice__hidden')); }

      function _markChosen(){
        items.forEach(it => {
          const sel = String(it.value) === String(chosen);
          it.el.classList.toggle('is-selected', sel);
          it.el.setAttribute('aria-checked', sel ? 'true' : 'false');
        });
      }
      function _markFocus(idx){
        const vis = _visibleItems();
        items.forEach(it => it.el.classList.remove('is-focused'));
        if (idx < 0 || idx >= vis.length) return;
        focusedIdx = idx;
        vis[idx].el.classList.add('is-focused');
        vis[idx].el.scrollIntoView({ block: 'nearest' });
      }

      normalized.forEach(o => {
        // ADR-172 (Fix-4 v5.5): group headers (opts.isGroup) renderizam como
        // separador visual não-clicável. Não participam da busca, não recebem foco.
        if (o.isGroup){
          const head = SolsticeUtils.el('div', {
            class: 'solstice__select-option solstice__select-option--group',
            'aria-hidden': 'true',
            style: 'pointer-events:none;background:transparent;padding:8px 12px 4px;font-size:10px;font-weight:600;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid var(--c-border);margin-top:6px;'
          }, o.label || '');
          list.appendChild(head);
          return;  // não adiciona a `items` → não filtrável, não focável
        }

        // Haystack para busca: label + value técnico + desc + synonyms
        const haystack = _norm([
          o.label || '',
          o.value || '',
          o.desc  || '',
          (o.synonyms || []).join(' ')
        ].join(' '));

        const labelEl = _renderLabel(o.label || '', '');
        const descEl = o.desc ? _renderLabel(o.desc, '') : null;

        const el = SolsticeUtils.el('div', {
          class: 'solstice__select-option' + (String(o.value) === String(chosen) ? ' is-selected' : ''),
          role: 'radio',
          'aria-checked': String(o.value) === String(chosen) ? 'true' : 'false',
          tabindex: '-1',
          onclick: () => { chosen = o.value; _markChosen(); },
          ondblclick: () => { /* dblclick = confirma direto via runtime no footer */ }
        },
          SolsticeUtils.el('span', { class: 'solstice__select-option-radio', 'aria-hidden': 'true' }),
          o.icon ? SolsticeUtils.el('span', { class: 'solstice__select-option-icon' }, o.icon) : null,
          SolsticeUtils.el('div', { class: 'solstice__select-option-body' },
            (function(){ const w = SolsticeUtils.el('div', { class: 'solstice__select-option-label' }); w.appendChild(labelEl); return w; })(),
            descEl ? (function(){ const w = SolsticeUtils.el('div', { class: 'solstice__select-option-desc' }); w.appendChild(descEl); return w; })() : null
          )
        );
        items.push({ el, value: o.value, haystack, labelEl, descEl, label: o.label || '', desc: o.desc || '' });
        list.appendChild(el);
      });

      let onConfirmRef;  // setado dentro de show().footer

      // Aplica filtro + atualiza highlights + reset focus
      function _filter(term){
        const t = _norm(term);
        items.forEach(it => {
          const hit = !t || it.haystack.indexOf(t) >= 0;
          it.el.classList.toggle('solstice__hidden', !hit);
          // re-render highlight só para itens visíveis
          if (hit){
            const parentL = it.el.querySelector('.solstice__select-option-label');
            const parentD = it.el.querySelector('.solstice__select-option-desc');
            if (parentL){ parentL.innerHTML = ''; parentL.appendChild(_renderLabel(it.label, term)); }
            if (parentD){ parentD.innerHTML = ''; parentD.appendChild(_renderLabel(it.desc,  term)); }
          }
        });
        const vis = _visibleItems();
        empty.classList.toggle('solstice__hidden', vis.length > 0);
        // foca o primeiro resultado (ou o `chosen` se ainda visível)
        const chosenIdx = vis.findIndex(it => String(it.value) === String(chosen));
        _markFocus(chosenIdx >= 0 ? chosenIdx : (vis.length ? 0 : -1));
      }

      // Body do modal
      const bodyParts = [];
      if (opts.message) bodyParts.push(SolsticeUtils.el('div', null, opts.message));

      let searchInput, clearBtn;
      if (useSearch){
        searchInput = SolsticeUtils.el('input', {
          class: 'solstice__select-search-input',
          type: 'search', placeholder: 'Buscar…',
          'aria-label': 'Buscar nas opções'
        });
        clearBtn = SolsticeUtils.el('button', {
          class: 'solstice__select-search-clear',
          'aria-label': 'Limpar busca',
          type: 'button',
          onclick: () => { searchInput.value = ''; _filter(''); clearBtn.classList.remove('is-visible'); searchInput.focus(); }
        }, '✕');

        let tDeb;
        searchInput.addEventListener('input', e => {
          const v = e.target.value;
          clearBtn.classList.toggle('is-visible', !!v);
          clearTimeout(tDeb);
          tDeb = setTimeout(() => _filter(v), 100);
        });

        bodyParts.push(SolsticeUtils.el('div', { class: 'solstice__select-search' },
          SolsticeUtils.el('span', { class: 'solstice__select-search-icon', 'aria-hidden': 'true' }, '🔍'),
          searchInput,
          clearBtn
        ));
      }
      bodyParts.push(list, empty);
      const body = SolsticeUtils.el('div', null, ...bodyParts.filter(Boolean));

      // Foca o item selecionado inicialmente (sem busca)
      const initIdx = items.findIndex(it => String(it.value) === String(chosen));
      if (initIdx >= 0) _markFocus(initIdx);

      // Handler de teclado: setas + Enter
      // Captura na fase de bubble do modal — convive com o focus trap (que usa Tab/Shift+Tab).
      function _onKey(e){
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
          e.preventDefault();
          const vis = _visibleItems();
          if (!vis.length) return;
          const delta = e.key === 'ArrowDown' ? 1 : -1;
          let next = focusedIdx + delta;
          if (next < 0) next = vis.length - 1;
          if (next >= vis.length) next = 0;
          chosen = vis[next].value;
          _markChosen();
          _markFocus(next);
        } else if (e.key === 'Enter'){
          // Só confirma se o foco não está num botão (deixa o botão tratar)
          if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
          e.preventDefault();
          if (onConfirmRef) onConfirmRef();
        }
      }

      return show({
        title: opts.title || 'Selecionar',
        body,
        size: opts.size,
        defaultClose: null,
        onOpen: ({ modal, close }) => {
          modal.addEventListener('keydown', _onKey);
          if (searchInput) setTimeout(() => searchInput.focus(), 60);
        },
        footer: (c) => {
          onConfirmRef = () => c(chosen);
          return [
            SolsticeUtils.el('button', { class: 'solstice__btn', onclick: () => c(null) },
              opts.cancelLabel || 'Cancelar'),
            SolsticeUtils.el('button', { class: 'solstice__btn solstice__btn--primary', onclick: () => c(chosen) },
              opts.confirmLabel || 'Confirmar')
          ];
        }
      });
    }

    /**
     * B3-03 (v6-autonomous / UX-05 — Pedro/Nubank): atalho explicativo
     * para ações DESTRUTIVAS (não recuperáveis sem undo).
     * Exemplos: excluir coluna, limpar dashboard, deletar snapshot.
     *
     * Difere de confirm() porque:
     *   • Botão de confirmação em VERMELHO (--danger)
     *   • Title prefixado com ⚠️
     *   • Texto-padrão "Não pode ser desfeito" (ou opts.consequence custom)
     *   • Default-focus no Cancelar (acidente é dispendioso)
     *
     * Uso:
     *   const ok = await SolsticeModal.destructive({
     *     title: 'Excluir coluna "receita"?',
     *     consequence: '2 KPIs e 1 gráfico vão parar de funcionar.',
     *     confirmLabel: 'Sim, excluir'
     *   });
     */
    function destructive(opts){
      opts = opts || {};
      return confirm({
        title: '⚠️ ' + (opts.title || 'Confirmar ação destrutiva'),
        message: SolsticeUtils.el('div', null,
          opts.message ? SolsticeUtils.el('div', { style:'margin-bottom:8px;' }, opts.message) : null,
          SolsticeUtils.el('div', {
            style:'padding:8px 12px;background:color-mix(in srgb, var(--c-error) 10%, transparent);border-left:3px solid var(--c-error);border-radius:4px;font-size:12px;color:var(--c-text-2);line-height:1.5;margin-top:6px;'
          }, '🔴 ' + (opts.consequence || 'Esta ação não pode ser desfeita facilmente.'))
        ),
        danger: true,
        confirmLabel: opts.confirmLabel || 'Sim, continuar',
        cancelLabel: opts.cancelLabel || 'Cancelar'
      });
    }

    return { show, confirm, destructive, prompt, select, isSkipped, listSkipped, unskip };
  })();
