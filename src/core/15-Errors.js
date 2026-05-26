
  /* ============================================================
     SolsticeErrors — catálogo humanizado
     10 erros iniciais. Cada erro: code, message, suggestion, severity.
     Bloco 2+ adicionarão mais via register().
     ============================================================ */
  const SolsticeErrors = (function(){
    const catalog = {
      'CSV_PARSE_FAIL': {
        sev: 'error', icon: '❌',
        message: 'Não consegui ler esse arquivo CSV.',
        suggestion: 'Verifique se o arquivo abre num editor de texto. Talvez o separador seja `;` ou o encoding seja diferente. Tente exportar de novo como UTF-8.'
      },
      'CSV_EMPTY': {
        sev: 'warn', icon: '📭',
        message: 'O CSV não tem linhas de dados.',
        suggestion: 'Verifique se o arquivo só tem o cabeçalho. Adicione pelo menos uma linha de dado para continuar.',
        // B3-02 (v6-autonomous / UX-01): action botão direto
        action: {
          label: '📊 Ver dataset exemplar',
          fn: () => { try { if (typeof _loadDummyDataset === 'function') _loadDummyDataset(); } catch(_){} }
        }
      },
      'CSV_NO_HEADER': {
        sev: 'warn', icon: '🏷️',
        message: 'Não encontrei cabeçalho no CSV.',
        suggestion: 'A primeira linha deve ter os nomes das colunas. Se seu arquivo já começa nos dados, adicione manualmente uma linha de cabeçalho.'
      },
      'CSV_INCONSISTENT_COLUMNS': {
        sev: 'warn', icon: '↔️',
        message: 'Algumas linhas têm número diferente de colunas que o cabeçalho.',
        suggestion: 'Pode ser um campo de texto com vírgula sem aspas. Verifique a linha {row} ou ajuste o delimitador.'
      },
      'PROFILE_NAME_EMPTY': {
        sev: 'warn', icon: '✍️',
        message: 'O nome do perfil não pode ficar vazio.',
        suggestion: 'Use seu nome ou um apelido. Você pode renomear depois.'
      },
      'PROFILE_NAME_DUPLICATE': {
        sev: 'warn', icon: '👥',
        message: 'Já existe um perfil com esse nome.',
        suggestion: 'Adicione um sufixo (ex: "Maria 2") ou exclua o perfil anterior.'
      },
      'LOCALSTORAGE_UNAVAILABLE': {
        sev: 'error', icon: '🔒',
        message: 'O navegador bloqueou o armazenamento local.',
        suggestion: 'Provavelmente você está em modo anônimo ou bloqueou cookies. Saia do modo anônimo ou autorize armazenamento.'
      },
      'STORAGE_QUOTA_EXCEEDED': {
        sev: 'error', icon: '💾',
        // Auditoria 2026 (R-04 / A-501): mensagem ao usuário não cita nome
        // interno ("Bloco 11") — usa o rótulo visível "Snapshots".
        message: 'Não há espaço para salvar suas configurações.',
        suggestion: 'Você tem muitos snapshots/perfis salvos. Abra a aba Snapshots na barra lateral e remova alguns antigos.',
        action: {
          label: '🗂️ Abrir Snapshots',
          fn: () => { try { if (typeof SolsticeSnapshot !== 'undefined' && SolsticeSnapshot.openPanel) SolsticeSnapshot.openPanel(); } catch(_){} }
        }
      },
      'DICTIONARY_NO_MATCH': {
        sev: 'info', icon: '🤔',
        message: 'Não reconheci esse CSV em nenhum dicionário pré-feito.',
        suggestion: 'Vou usar o dicionário Genérico (Title Case + heurística). Você pode customizar coluna por coluna no modal.'
      },
      'UNKNOWN_ERROR': {
        sev: 'error', icon: '⚠️',
        // Auditoria 2026 (R-04 / A-501): substitui referência ao arquivo
        // interno BUGS.md por instrução acionável pelo usuário final.
        message: 'Algo deu errado e não consegui identificar exatamente o quê.',
        suggestion: 'Pressione Ctrl+Shift+D para abrir o painel de debug e copie o estado do app. Envie esse texto para o seu time técnico.'
      }
    };

    function register(code, def){ catalog[code] = def; }

    function show(code, vars, extra){
      const def = catalog[code] || catalog['UNKNOWN_ERROR'];
      let message = def.message;
      let suggestion = def.suggestion;
      if (vars){
        for (const k in vars){
          message = message.replace(new RegExp('\\{'+k+'\\}','g'), vars[k]);
          suggestion = suggestion.replace(new RegExp('\\{'+k+'\\}','g'), vars[k]);
        }
      }
      _openModal({ code, def, message, suggestion, extra });
      console.warn('[Solstice]', code, message, extra || '');
    }

    function inline(targetEl, code, vars){
      const def = catalog[code] || catalog['UNKNOWN_ERROR'];
      let message = def.message;
      if (vars) for (const k in vars) message = message.replace(new RegExp('\\{'+k+'\\}','g'), vars[k]);
      targetEl.innerHTML = '';
      targetEl.appendChild(SolsticeUtils.el('div',
        { class: 'solstice__toast solstice__toast--'+(def.sev==='error'?'error':def.sev==='warn'?'warn':'') },
        SolsticeUtils.el('div', null, def.icon),
        SolsticeUtils.el('div', { class: 'solstice__toast-body' },
          SolsticeUtils.el('div', { class: 'solstice__toast-title' }, message))
      ));
    }

    function _openModal({ code, def, message, suggestion, extra }){
      // Auditoria 2026.4 (Sprint 13a / A11y-02): role=dialog + aria-modal + aria-labelledby
      const titleId = 'solstice-err-title-' + Math.random().toString(36).slice(2, 8);
      const overlay = SolsticeUtils.el('div', {
        class: 'solstice__modal-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        onclick: e => { if (e.target===overlay) close(); }
      });
      const modal = SolsticeUtils.el('div', { class: 'solstice__modal' });

      const closeBtn = SolsticeUtils.el('button', { class: 'solstice__modal-close', 'aria-label': SolsticeLocale.t('err.close'), onclick: close }, '✕');
      modal.appendChild(SolsticeUtils.el('div', { class: 'solstice__modal-header' },
        SolsticeUtils.el('div', { class: 'solstice__modal-title', id: titleId }, def.icon + ' ' + message.split('.')[0]),
        closeBtn
      ));

      const body = SolsticeUtils.el('div', { class: 'solstice__modal-body' });
      body.appendChild(SolsticeUtils.el('div', { class: 'solstice__err-code' }, 'Código: ' + code));
      body.appendChild(SolsticeUtils.el('div', { class: 'solstice__err-message' }, message));
      body.appendChild(SolsticeUtils.el('div', { class: 'solstice__err-suggestion' }, '💡 ' + suggestion));

      if (extra){
        const details = SolsticeUtils.el('details', { class: 'solstice__err-details' });
        details.appendChild(SolsticeUtils.el('summary', null, SolsticeLocale.t('err.details')));
        details.appendChild(SolsticeUtils.el('pre', null, typeof extra === 'string' ? extra : JSON.stringify(extra, null, 2)));
        body.appendChild(details);
      }
      modal.appendChild(body);

      // B3-02 (v6-autonomous / UX-01): action button opcional.
      // Se def.action = { label, fn }, adiciona botão primário que CLICKA fn (não só fecha).
      const footer = SolsticeUtils.el('div', { class: 'solstice__modal-footer' });
      if (def && def.action && typeof def.action.fn === 'function'){
        footer.appendChild(SolsticeUtils.el('button', {
          class: 'solstice__btn solstice__btn--primary',
          onclick: () => { try { def.action.fn(); } catch(e){ SolsticeLog.warn('[err.action]', e); } close(); }
        }, def.action.label || 'Resolver agora'));
        footer.appendChild(SolsticeUtils.el('button', { class: 'solstice__btn', onclick: close }, 'Fechar'));
      } else {
        footer.appendChild(SolsticeUtils.el('button', { class: 'solstice__btn solstice__btn--primary', onclick: close }, SolsticeLocale.t('err.close')));
      }
      modal.appendChild(footer);

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      closeBtn.focus();
      function close(){ overlay.remove(); }
      const onKey = e => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey, { once: true });
    }

    function list(){ return Object.keys(catalog); }

    return { show, inline, register, list, _catalog: catalog };
  })();
