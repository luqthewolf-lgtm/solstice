
  /* ============================================================
     SolsticeApp — bootstrap
     ============================================================ */
  /* ============================================================
     Helpers de ingestão expostos para o boot + Canvas empty state
     (movidos para fora do boot para que SolsticeCanvas alcance)
     ============================================================ */
  /**
   * Camada 1 polish v6: modal pós-ingestão pra escolher colunas a importar
   * e opcionalmente limitar nº de linhas. Retorna:
   *   { columns: [...], rowLimit: N|null } | false (manter tudo) | null (cancelar)
   */
  async function _openIngestFilterModal(result, fileName){
    return new Promise(resolve => {
      const checkedSet = new Set(result.columns);
      let rowLimit = null;
      let encodingOverride = null; // Prompt 2: se usuário escolher outro encoding no dropdown

      function _build(close){
        const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:var(--sp-3);' });

        // Resumo do que foi detectado
        const summary = SolsticeUtils.el('div', {
          style:'padding:var(--sp-2) var(--sp-3);background:color-mix(in srgb,var(--c-accent) 8%, transparent);border-radius:var(--rad-sm);border-left:3px solid var(--c-accent);font-size:var(--fs-xs);line-height:1.6;'
        });
        summary.appendChild(SolsticeUtils.el('div', null, '📄 ', SolsticeUtils.el('strong', null, fileName)));
        summary.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-text-2);' },
          result.rows.length.toLocaleString('pt-BR') + ' linhas · ' + result.columns.length + ' colunas · qualidade detectada após parse'));
        // Prompt 2: mostra encoding detectado no resumo
        if (result.encoding){
          const enc = result.encoding;
          const confPct = Math.round(enc.confidence * 100);
          const encLabel = ({ 'utf-8':'UTF-8', 'windows-1252':'Latin-1 (Windows-1252)', 'utf-16le':'UTF-16 LE', 'utf-16be':'UTF-16 BE' })[enc.encoding] || enc.encoding;
          const encColor = enc.confidence >= 0.7 ? 'var(--c-text-2)' : 'var(--c-warn)';
          summary.appendChild(SolsticeUtils.el('div', { style:'color:' + encColor + ';margin-top:2px;' },
            '🔠 Encoding: ' + encLabel + (enc.hasBOM ? ' (BOM)' : '') + ' · confiança ' + confPct + '%' +
              (enc.mojibakeRate > 0.01 ? ' · ⚠️ ' + Math.round(enc.mojibakeRate * 100) + '% suspeita de mojibake' : '')));
        }
        summary.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);margin-top:4px;' },
          'Selecione abaixo o que importar. Você pode pular este passo e manter tudo.'));
        wrap.appendChild(summary);

        // Prompt 2: se confiança <70% ou mojibake detectado, mostra dropdown para usuário escolher encoding
        if (result.encoding && (result.encoding.confidence < 0.70 || result.encoding.mojibakeRate > 0.01)){
          const encRow = SolsticeUtils.el('div', { style:'padding:var(--sp-2) var(--sp-3);background:color-mix(in srgb, var(--c-warn) 14%, transparent);border-left:3px solid var(--c-warn);border-radius:var(--rad-sm);font-size:var(--fs-xs);line-height:1.5;display:flex;flex-direction:column;gap:6px;' });
          encRow.appendChild(SolsticeUtils.el('div', { style:'font-weight:var(--fw-semibold);color:var(--c-text);' },
            '⚠️ Encoding incerto — escolha manualmente se os caracteres estiverem corrompidos'));
          const encSelectRow = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:8px;' });
          encSelectRow.appendChild(SolsticeUtils.el('span', null, 'Reler como:'));
          const encSelect = SolsticeUtils.el('select', {
            style:'padding:4px 8px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:var(--fs-xs);'
          });
          [['', '(manter detecção: ' + result.encoding.encoding + ')'],
           ['utf-8', 'UTF-8'],
           ['windows-1252', 'Latin-1 (Windows-1252)'],
           ['utf-16le', 'UTF-16 LE'],
           ['utf-16be', 'UTF-16 BE'],
           ['iso-8859-1', 'ISO-8859-1 (alias de Latin-1)']
          ].forEach(([v, l]) => {
            const o = SolsticeUtils.el('option', { value: v }, l);
            encSelect.appendChild(o);
          });
          encSelect.addEventListener('change', e => { encodingOverride = e.target.value || null; });
          encSelectRow.appendChild(encSelect);
          encRow.appendChild(encSelectRow);
          encRow.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:10px;' },
            'Dica: se você vê "São Paulo" como "São Paulo", escolha Latin-1.'));
          wrap.appendChild(encRow);
        }

        // Toggle "selecionar tudo"
        const allRow = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-2);background:var(--c-surface-2);border-radius:var(--rad-sm);font-weight:var(--fw-semibold);' });
        const allCb = SolsticeUtils.el('input', { type:'checkbox', checked: true });
        allRow.appendChild(allCb);
        allRow.appendChild(SolsticeUtils.el('span', null, 'Selecionar todas as ' + result.columns.length + ' colunas'));
        const countEl = SolsticeUtils.el('span', { style:'margin-left:auto;font-size:var(--fs-xs);color:var(--c-muted);font-family:var(--font-mono);' },
          result.columns.length + ' / ' + result.columns.length);
        allRow.appendChild(countEl);
        wrap.appendChild(allRow);

        // Lista de colunas com checkbox
        const colList = SolsticeUtils.el('div', {
          style:'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;max-height:280px;overflow-y:auto;padding:var(--sp-2);background:var(--c-surface-2);border-radius:var(--rad-sm);'
        });
        const cbMap = new Map();
        result.columns.forEach(col => {
          const t = result.types && result.types[col];
          const typeLabel = t ? SolsticeTypes.label(t.type) : '—';
          const icon = t ? SolsticeTypes.icon(t.type) : '📄';
          const row = SolsticeUtils.el('label', {
            style:'display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--c-surface);border-radius:var(--rad-xs);font-size:var(--fs-xs);cursor:pointer;'
          });
          const cb = SolsticeUtils.el('input', { type:'checkbox', checked: true });
          cb.addEventListener('change', e => {
            if (e.target.checked) checkedSet.add(col); else checkedSet.delete(col);
            countEl.textContent = checkedSet.size + ' / ' + result.columns.length;
            allCb.checked = (checkedSet.size === result.columns.length);
          });
          cbMap.set(col, cb);
          row.appendChild(cb);
          row.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true' }, icon));
          row.appendChild(SolsticeUtils.el('span', { style:'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, col));
          row.appendChild(SolsticeUtils.el('span', { style:'font-size:9px;color:var(--c-muted);text-transform:lowercase;' }, typeLabel));
          colList.appendChild(row);
        });
        wrap.appendChild(colList);

        allCb.addEventListener('change', e => {
          const v = !!e.target.checked;
          cbMap.forEach((cb, col) => {
            cb.checked = v;
            if (v) checkedSet.add(col); else checkedSet.delete(col);
          });
          countEl.textContent = checkedSet.size + ' / ' + result.columns.length;
        });

        // Limite de linhas (opcional)
        const limitRow = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-xs);color:var(--c-text-2);' });
        limitRow.appendChild(SolsticeUtils.el('span', null, 'Limitar a primeiras'));
        const limitInput = SolsticeUtils.el('input', {
          type:'number', min:'0', placeholder:'todas',
          style:'width:100px;padding:4px 8px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--rad-xs);font-size:var(--fs-xs);',
          oninput: e => { const n = parseInt(e.target.value, 10); rowLimit = (!isNaN(n) && n > 0) ? n : null; }
        });
        limitRow.appendChild(limitInput);
        limitRow.appendChild(SolsticeUtils.el('span', null, ' linhas (em branco = todas as ' + result.rows.length.toLocaleString('pt-BR') + ')'));
        wrap.appendChild(limitRow);

        return wrap;
      }

      SolsticeModal.show({
        title: '🧹 Filtrar dados ao importar',
        body: _build,
        size: 'lg',
        defaultClose: null,
        footer: (close) => [
          SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--ghost',
            onclick: () => { resolve(null); close(null); }
          }, 'Cancelar'),
          SolsticeUtils.el('button', {
            class:'solstice__btn',
            onclick: () => { resolve(false); close(false); }
          }, 'Pular (importar tudo)'),
          SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--primary',
            onclick: () => {
              const cols = Array.from(checkedSet);
              if (!cols.length){
                SolsticeToast.warn('Selecione ao menos uma coluna');
                return;
              }
              resolve({ columns: cols, rowLimit: rowLimit, encodingOverride });
              close(true);
            }
          }, 'Importar selecionados')
        ]
      });
    });
  }

  /**
   * PM-01 (Sprint 1B / INVESTIGACAO_PROFUNDA): cria overlay de progresso visível
   * para feedback durante parse de CSVs grandes (>1MB pode levar 5-10s).
   *
   * Uso:
   *   const p = _createIngestProgress('arquivo.csv');
   *   p.update('encoding', 'running');  // mostra "Detectando codificação…"
   *   p.update('encoding', 'done');     // marca ✓
   *   p.close();                        // remove overlay
   *
   * Steps reconhecidos: encoding, detect, parse, infer, validate, enrich
   */
  function _createIngestProgress(fileName){
    const STEP_LABELS = {
      encoding: 'Detectando codificação',
      detect:   'Identificando separador',
      parse:    'Lendo linhas',
      infer:    'Inferindo tipos de coluna',
      validate: 'Validando dados',
      enrich:   'Enriquecendo dataset'
    };
    const STEPS = ['encoding','detect','parse','infer','validate','enrich'];
    let overlay = null;
    let listEl = null;
    const state = {}; // { stepKey: 'running'|'done'|'error' }
    // B6-04 (v6-autonomous / RES-02 — Sofia/Auth0): cancel
    let _onCancel = null;
    let _cancelled = false;

    function _render(){
      if (!listEl) return;
      listEl.textContent = '';
      STEPS.forEach(key => {
        const status = state[key];
        if (!status) return;
        const icon = status === 'done' ? '✓' :
                     status === 'error' ? '✗' :
                     '⏳';
        const colorClass = status === 'done' ? 'solstice__ingest-progress-item--done' :
                           status === 'error' ? 'solstice__ingest-progress-item--error' :
                           'solstice__ingest-progress-item--running';
        const item = SolsticeUtils.el('div',
          { class: 'solstice__ingest-progress-item ' + colorClass },
          SolsticeUtils.el('span', { class:'solstice__ingest-progress-icon', 'aria-hidden':'true' }, icon),
          SolsticeUtils.el('span', null, STEP_LABELS[key] || key)
        );
        listEl.appendChild(item);
      });
    }

    function _mount(){
      if (overlay) return;
      overlay = SolsticeUtils.el('div', {
        class: 'solstice__ingest-progress',
        role: 'status',
        'aria-live': 'polite',
        'aria-label': 'Progresso de importação de ' + (fileName || 'arquivo')
      });
      const header = SolsticeUtils.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;'
      });
      header.appendChild(SolsticeUtils.el('div',
        { class:'solstice__ingest-progress-title' },
        '📥 Importando ' + (fileName || 'arquivo')
      ));
      // B6-04: botão cancelar
      const cancelBtn = SolsticeUtils.el('button', {
        type: 'button',
        title: 'Cancelar importação',
        'aria-label': 'Cancelar importação',
        style: 'background:transparent;border:1px solid var(--c-border);color:var(--c-muted);padding:2px 10px;border-radius:4px;cursor:pointer;font-size:11px;',
        onclick: () => {
          _cancelled = true;
          if (typeof _onCancel === 'function') _onCancel();
          // Marca steps em-execução como erro visualmente
          STEPS.forEach(k => { if (state[k] === 'running') state[k] = 'error'; });
          state[STEPS[0]] = state[STEPS[0]] || 'error';
          _render();
          // Mostra mensagem de cancelado
          if (listEl){
            const cancelMsg = SolsticeUtils.el('div', {
              style: 'margin-top:8px;padding:6px 10px;background:color-mix(in srgb,var(--c-warn) 12%,transparent);border-left:3px solid var(--c-warn);font-size:11px;color:var(--c-text);border-radius:4px;'
            }, '⚠️ Importação cancelada');
            listEl.appendChild(cancelMsg);
          }
          setTimeout(() => { try { overlay.remove(); } catch(_){} }, 1200);
        }
      }, '✕ Cancelar');
      header.appendChild(cancelBtn);
      overlay.appendChild(header);
      listEl = SolsticeUtils.el('div', { class:'solstice__ingest-progress-list' });
      overlay.appendChild(listEl);
      document.body.appendChild(overlay);
    }

    return {
      update(step, status, _details){
        if (_cancelled) return;
        _mount();
        state[step] = status;
        _render();
      },
      close(){
        if (overlay && overlay.parentNode){
          // delay pequeno pra usuário ver "tudo ✓" antes de sumir
          setTimeout(() => { try { overlay.remove(); } catch(_){} }, 350);
        }
      },
      // B6-04: API pra registrar callback de cancelamento
      onCancel(fn){ _onCancel = fn; },
      isCancelled(){ return _cancelled; }
    };
  }

  async function _runIngestFile(file, opts){
    opts = opts || {};
    // ADR-180 (Fix-12 v5.5): limpar toasts antigos de "template sugerido" antes
    // de novo import. Lucas (re-auditoria P10): se trocar dataset sem fechar,
    // toast do CSV anterior fica visível. Filtra elementos com data-category.
    try {
      document.querySelectorAll('.solstice__toast[data-category="template-suggestion"]').forEach(el => el.remove());
    } catch(_){}

    // ADR-161 (Onda 1 / T3 Express Mode): se Express estiver on (Settings)
    // OU opts.expressMode for true (botão "Importar Express"), pula 3 frações:
    //  1) modal de filtro de colunas (importa tudo)
    //  2) modal de dicionário (usa detect automático)
    //  3) modal de Auto-Dashboard (silent autoDash se conf >= 40%)
    const expressMode = opts.expressMode === true ||
                        SolsticeStore.get('settings.expressMode') === true;
    SolsticeToast.info(expressMode ? '⚡ Importando (Express)…' : 'Importando…', file.name);

    // PM-01 (Sprint 1B): progress overlay para feedback visível em CSVs grandes.
    // Mostra etapa atual (encoding / detect / parse / infer / validate / enrich).
    const _progress = _createIngestProgress(file.name);
    const _onStep = (step, status, details) => {
      try { _progress.update(step, status, details); } catch(_){}
    };

    let result = await SolsticeIngest.run(file, { onStep: _onStep });
    _progress.close();
    if (!result) return;

    // Camada 1 polish v6: modal pós-ingestão pra escolher quais colunas importar.
    // Útil em CSVs grandes onde algumas colunas são lixo/desnecessárias.
    // ADR-161: Express pula esse modal.
    const filterResult = expressMode ? false : await _openIngestFilterModal(result, file.name);
    if (filterResult === null) {
      // Usuário cancelou — aborta a ingestão
      SolsticeToast.info('Importação cancelada', file.name);
      return;
    }
    // Prompt 2 v5.4: se usuário escolheu outro encoding no dropdown de override,
    // re-roda a pipeline inteira (sem ler o arquivo de novo — usa o buffer já lido).
    if (filterResult && filterResult.encodingOverride && filterResult.encodingOverride !== result.encoding.encoding){
      SolsticeToast.info('Re-decodificando…', filterResult.encodingOverride);
      // file.arrayBuffer() é stateless, então re-leitura é OK; alternativamente usaríamos result._buffer
      const _reprog = _createIngestProgress(file.name + ' (re-decode)');
      result = await SolsticeIngest.run(file, { onStep: (s, st, d) => _reprog.update(s, st, d), encoding: filterResult.encodingOverride });
      _reprog.close();
      if (!result) return;
    }
    // filterResult é { columns: [...], rowLimit: N | null } ou false (mantém tudo)
    if (filterResult && filterResult.columns && filterResult.columns.length < result.columns.length){
      const keepSet = new Set(filterResult.columns);
      const newCols = result.columns.filter(c => keepSet.has(c));
      const newTypes = {};
      newCols.forEach(c => { newTypes[c] = result.types[c]; });
      const newRows = result.rows.map(r => {
        const out = {};
        newCols.forEach(c => { out[c] = r[c]; });
        return out;
      });
      // Bug fix Camada 1 polish v7: dictDetection foi calculado ANTES do filtro
      // — usava TODAS as colunas originais. Re-roda detect() com colunas filtradas
      // pra manter consistência ao abrir o modal do Dicionário Semântico.
      const newDict = (typeof SolsticeDictionary !== 'undefined' && SolsticeDictionary.detect)
        ? SolsticeDictionary.detect(newCols)
        : result.dictDetection;
      // Também filtra issues.byColumn pra refletir só as colunas mantidas
      const newIssues = result.issues ? {
        ...result.issues,
        byColumn: Object.fromEntries(
          Object.entries(result.issues.byColumn || {}).filter(([col]) => keepSet.has(col))
        )
      } : result.issues;
      result = { ...result, columns: newCols, types: newTypes, rows: newRows, dictDetection: newDict, issues: newIssues };
    }
    if (filterResult && filterResult.rowLimit && filterResult.rowLimit > 0 && result.rows.length > filterResult.rowLimit){
      result = { ...result, rows: result.rows.slice(0, filterResult.rowLimit) };
    }

    // BUG-02 v3 + R-03 v3: 'ingest' fica DENTRO do batch mas no except.
    // batch({except:['ingest']}) garante que subscribers de ingest disparam.
    // Antes precisava setá-lo fora; agora código fica mais limpo.
    //
    // Sprint 40 / fix crítico (defesa em profundidade): limpa filtros que
    // referenciam colunas que NÃO existem na nova base. Antes: ao trocar de
    // CSV (ex: amostra → CSV real), um filtro com coluna "data_atendimento"
    // sobrava de smartDefault/preset anterior e o apply() zerava TODAS as
    // rows (Invalid Date). Resultado: KPIs/Série Temporal mostravam "Sem
    // dataset carregado" mesmo com base válida. SolsticeFilters.apply()
    // também ignora silenciosamente (validCols check), mas limpar aqui
    // garante que a UI do filtro não exiba referência morta.
    try {
      const _newCols = new Set(result.columns || []);
      const _curFilters = SolsticeStore.get('filters') || {};
      const _cleanFilters = {};
      let _dropped = 0;
      Object.keys(_curFilters).forEach(c => {
        if (_newCols.has(c)){ _cleanFilters[c] = _curFilters[c]; }
        else { _dropped++; }
      });
      if (_dropped > 0){
        SolsticeStore.set('filters', _cleanFilters);
        SolsticeLog && SolsticeLog.debug &&
          SolsticeLog.debug('[ingest] ' + _dropped + ' filtro(s) descartado(s) — colunas não existem na nova base');
      }
      // Também limpa smartDefaults / shown que referenciam colunas mortas
      const _sd = SolsticeStore.get('ui.filters.smartDefaults');
      if (Array.isArray(_sd)){
        const _sdClean = _sd.filter(s => s && _newCols.has(s.column));
        if (_sdClean.length !== _sd.length) SolsticeStore.set('ui.filters.smartDefaults', _sdClean);
      }
      const _shown = SolsticeStore.get('ui.filters.shown');
      if (Array.isArray(_shown)){
        const _shownClean = _shown.filter(c => _newCols.has(c));
        if (_shownClean.length !== _shown.length) SolsticeStore.set('ui.filters.shown', _shownClean);
      }
    } catch(_){}

    SolsticeStore.batch(() => {
      SolsticeStore.set('ingest', result);
      SolsticeStore.set('dataset.rows', result.rows);
      SolsticeStore.set('dataset.columns', result.columns);
      SolsticeStore.set('dataset.types', result.types);
      SolsticeStore.set('dataset.name', file.name);
      SolsticeStore.set('dataset.source', file.name === 'vendas_br_dummy.csv' ? 'dummy' : 'import');
    }, { except: ['ingest'] });
    SolsticeStore.set('dataset.ready', true);
    // Auditoria 2026.6 (INSIGHT-VOLTA): ao importar uma base, traz os insights de
    // volta. ANTES, esconder o painel (✕) setava ui.insights.hidden=true PERMANENTE
    // — o usuário reimportava a base e os insights não voltavam. Importar = nova
    // análise, então reabilita (a opção de esconder continua em Configurações).
    try { if (SolsticeStore.get('ui.insights.hidden') === true) SolsticeStore.set('ui.insights.hidden', false); } catch(_){}

    document.getElementById('status-rows').textContent = SolsticeLocale.integer(result.rows.length);
    // BUG-02 v3: força refresh do status bar (cols) — mesmo path do subscribe.
    try {
      const cEl = document.getElementById('status-cols');
      if (cEl) cEl.textContent = String((result.columns || []).length);
    } catch(_){}
    SolsticeEditor.showPanel();
    SolsticeEditor.renderPreview();
    SolsticeEditor.render();
    SolsticeEditor.updateQualityCard();
    SolsticeEditor.renderDatasetSummary();
    if (SolsticeEditor.renderMeasuresPanel) SolsticeEditor.renderMeasuresPanel();
    if (SolsticeEditor.renderDataActions) SolsticeEditor.renderDataActions();

    const q = SolsticeQuality.compute(result);
    SolsticeToast.success('CSV ingerido', result.rows.length + ' linhas · qualidade ' + q.score + '/100');

    // Prompt 9 v5.4: toast persistente quando há muitos erros de parse
    const parseErrors = (result.errors || []);
    const errorRate = parseErrors.length / (result.rows.length || 1);
    if (parseErrors.length > 5 || errorRate > 0.01){
      SolsticeToast.warn(
        '⚠️ Problemas no parse',
        parseErrors.length + ' linha(s) com erro (' + Math.round(errorRate * 100) + '%) — clique no card Qualidade para detalhes.'
      );
    }

    if (result.dialect.confidence < 0.5){
      SolsticeErrors.show('CSV_DELIMITER_AMBIGUOUS', {
        delimiter: result.dialect.delimiter === '\t' ? 'TAB' : result.dialect.delimiter
      });
    }

    if (expressMode) {
      // ADR-161 + Sprint 23 / UX-03: Express pula modal do dicionário (usa
      // detect() direto), mas NÃO dispara mais Auto-Dashboard automaticamente.
      // Usuário reportou que autorun do AutoDash ao importar era "agoniante" —
      // quebra fluxo de quem só quer ver os dados. Em vez de silent, mostramos
      // toast de oferta com botão "🪄 Gerar agora". Ainda é 1 clique pra usuário
      // que quer dashboard montado, mas respeita quem só quer explorar os dados.
      SolsticeStore.set('dictionary', result.dictDetection);
      SolsticeEditor.renderPreview();
      setTimeout(() => {
        try {
          SolsticeToast.action({
            title: '✅ Dataset pronto',
            msg: 'Quer que eu monte um dashboard automaticamente?',
            kind: 'success',
            actionLabel: '🪄 Gerar agora',
            actionFn: () => SolsticeAutoDashboard.run({ force: true }),
            duration: 12000
          });
        } catch (e) { SolsticeLog.debug('[Express] toast falhou:', e); }
      }, 200);
    } else {
      SolsticeDictionary.openConfigModal(result.dictDetection, result.columns, finalDict => {
        SolsticeStore.set('dictionary', finalDict);
        SolsticeEditor.renderPreview();
        // ADR-163 (Onda 2 / T2e): após dicionário, detecta domínio e sugere
        // template pronto se confiança >= 40% (briefing v5.4 Anexo A.6).
        setTimeout(() => _suggestDomainTemplate(result), 400);
      });
    }
  }

  /**
   * ADR-163 (Onda 2 / T2e) — Banner de template sugerido
   * Quando o detectDomain identifica um preset com confiança >= 40%,
   * mostra um toast com botões para aplicar diretamente um template do
   * domínio. Reduz o caminho "import → ver banner → aplicar template"
   * a 2 cliques (vs. fluxo manual via picker de templates).
   */
  function _suggestDomainTemplate(ingestResult){
    if (typeof SolsticeDomain === 'undefined') return;
    if (typeof SolsticeTemplates === 'undefined') return;
    const ctx = { columns: (ingestResult && ingestResult.columns) || [] };
    const detection = SolsticeDomain.detectDomain(ctx);
    if (!detection.domain || detection.confidence < 40) return;

    // Lista templates relevantes do domínio detectado
    const domainTemplates = (SolsticeTemplates.DOMAIN || []).filter(t => t.domain === detection.domain);
    if (!domainTemplates.length) return;

    const preset = (SolsticeDictionary.presets || {})[detection.domain];
    const presetName = preset ? preset.name : detection.domain;

    // Action menu com até 3 templates + "não aplicar"
    SolsticeToast.action({
      title: '🎯 Detectei dados de ' + presetName,
      msg: 'Confiança ' + detection.confidence + '% · ' + domainTemplates.length + ' template(s) disponível(is).',
      kind: 'info',
      actionLabel: 'Ver templates',
      actionFn: () => _openTemplateSuggestModal(detection, domainTemplates, preset),
      duration: 12000  // mais tempo pra ler que toast comum
    });
    // ADR-180 (Fix-12 v5.5): tagueia o toast pra _runIngestFile poder limpar
    // toasts antigos ao trocar dataset.
    setTimeout(() => {
      const toasts = document.querySelectorAll('.solstice__toast');
      const last = toasts[toasts.length - 1];
      if (last) last.setAttribute('data-category', 'template-suggestion');
    }, 10);
  }

  function _openTemplateSuggestModal(detection, templates, preset){
    SolsticeModal.show({
      title: '🎯 Template sugerido para ' + (preset ? preset.name : detection.domain),
      size: 'lg',
      body: (close) => {
        const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:12px;' });
        wrap.appendChild(SolsticeUtils.el('div', {
          style:'padding:10px;background:color-mix(in srgb, var(--c-info) 12%, var(--c-surface-2));border-radius:6px;font-size:13px;color:var(--c-text);'
        }, '📊 Confiança ' + detection.confidence + '% — ' +
            (detection.matchedColumns[detection.domain] || []).length +
            ' coluna(s) do seu CSV bateram com o dicionário de ' +
            (preset ? preset.name : detection.domain) + '.'));
        templates.forEach(t => {
          const card = SolsticeUtils.el('button', {
            class:'solstice__btn',
            style:'display:flex;align-items:flex-start;gap:12px;text-align:left;padding:12px;height:auto;width:100%;',
            onclick: () => {
              close(null);
              SolsticeTemplates.apply(t.id);
            }
          });
          card.appendChild(SolsticeUtils.el('span', { style:'font-size:24px;line-height:1;flex-shrink:0;' }, t.icon || '🧩'));
          const body = SolsticeUtils.el('div', { style:'flex:1;display:flex;flex-direction:column;gap:4px;' });
          body.appendChild(SolsticeUtils.el('div', { style:'font-weight:var(--fw-semibold);font-size:14px;color:var(--c-text);' }, t.name));
          body.appendChild(SolsticeUtils.el('div', { style:'font-size:12px;color:var(--c-muted);line-height:1.4;' }, t.description));
          card.appendChild(body);
          wrap.appendChild(card);
        });
        return wrap;
      },
      footer: (close) => [
        SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--ghost',
          onclick: () => close(null)
        }, 'Não, vou montar do zero')
      ]
    });
  }

  /**
   * Modal de Preferências do perfil (Patch B5-r3 / ADR-043).
   * Lista confirmações destrutivas silenciadas e permite reativar.
   */
  function _openProfilePreferences(){
    const profile = SolsticeProfiles.current();
    const skipped = SolsticeModal.listSkipped();
    const LABELS = {
      'remove-component': 'Remover componente',
      'remove-section':   'Remover seção',
      'remove-row':       'Remover linha'
    };
    const ALL_KEYS = ['remove-component', 'remove-section', 'remove-row'];

    function _build(close){
      const wrap = SolsticeUtils.el('div');

      // Perfil ativo
      wrap.appendChild(SolsticeUtils.el('div', { style:'margin-bottom:var(--sp-4);' },
        SolsticeUtils.el('div', { style:'font-size:var(--fs-xs);color:var(--c-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;' }, 'Perfil ativo'),
        SolsticeUtils.el('div', { style:'font-family:var(--font-display);font-size:var(--fs-md);font-weight:var(--fw-semibold);' },
          (profile && profile.name) || '—')
      ));

      // Seção Confirmações
      wrap.appendChild(SolsticeUtils.el('div', { style:'font-size:var(--fs-xs);color:var(--c-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--sp-2);' },
        'Confirmações destrutivas'));
      wrap.appendChild(SolsticeUtils.el('div', { style:'font-size:var(--fs-xs);color:var(--c-text-2);margin-bottom:var(--sp-3);' },
        'Marque para perguntar antes de remover. Desmarque para silenciar (continua mostrando toast com botão Desfazer).'));

      const list = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:6px;' });
      ALL_KEYS.forEach(key => {
        const row = SolsticeUtils.el('label', {
          style:'display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-2);background:var(--c-surface-2);border-radius:var(--rad-sm);cursor:pointer;'
        });
        const isSilenced = skipped.indexOf(key) >= 0;
        const cb = SolsticeUtils.el('input', {
          type:'checkbox',
          checked: !isSilenced,   // marcado = pergunta antes; desmarcado = silenciado
          onchange: (e) => {
            if (e.target.checked){
              SolsticeModal.unskip(key);
              SolsticeToast.info('Reativado', LABELS[key] + ' voltará a perguntar antes');
            } else {
              const pid = (SolsticeProfiles.current() && SolsticeProfiles.current().id) || 'anon';
              // Auditoria 2026 (AP-02): silent — flag UX "não perguntar mais".
              SolsticeStorage.safeSet('solstice.' + pid + '.skipConfirm.' + key, 'true', { silent: true });
              SolsticeToast.info('Silenciado', LABELS[key] + ' não pergunta mais (toast com Desfazer continua)');
            }
          }
        });
        row.appendChild(cb);
        row.appendChild(SolsticeUtils.el('span', { style:'flex:1;' }, LABELS[key] || key));
        row.appendChild(SolsticeUtils.el('span',
          { style:'font-size:10px;font-family:var(--font-mono);color:var(--c-muted);' },
          isSilenced ? 'silenciado' : 'pergunta antes'));
        list.appendChild(row);
      });
      wrap.appendChild(list);

      return wrap;
    }

    SolsticeModal.show({
      title: '⚙️ Preferências',
      body: _build,
      defaultClose: null,
      footer: (close) => [
        SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Fechar')
      ]
    });
  }

  async function _loadDummyDataset(){
    const rows = SolsticeDummy.gerar();
    const csv = SolsticeDummy.toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const file = new File([blob], 'vendas_br_dummy.csv', { type: 'text/csv' });
    await _runIngestFile(file);
    // B12-r1 (polish b): toast educativo de boas-vindas
    setTimeout(() => {
      SolsticeToast.action({
        title: '📊 Dados de exemplo carregados!',
        msg: '200 linhas de vendas BR. Clique para gerar dashboard automaticamente.',
        kind: 'info',
        duration: 8000,
        actionLabel: '🪄 Auto-Dashboard',
        actionFn: () => SolsticeAutoDashboard && SolsticeAutoDashboard.run({ force: true })
      });
    }, 600);
  }

  function boot(){
    // 1. Setup locale (já restaurado da localStorage no closure do módulo)
    const localeSelect = document.getElementById('locale-select');
    if (localeSelect){
      localeSelect.value = SolsticeLocale.get();
      localeSelect.addEventListener('change', e => {
        SolsticeLocale.set(e.target.value);
        document.getElementById('status-locale').textContent = SolsticeLocale.get();
        SolsticeToast.success(SolsticeLocale.t('toast.locale.changed'), SolsticeLocale.get());
      });
    }
    SolsticeStore.set('locale', SolsticeLocale.get());

    // 2. Theme controls
    const paletteSelect = document.getElementById('palette-select');
    const densitySelect = document.getElementById('density-select');
    const themeToggle   = document.getElementById('theme-toggle');
    const themeIcon     = document.getElementById('theme-icon');

    paletteSelect.value = SolsticeTheme.get('palette');
    densitySelect.value = SolsticeTheme.get('density');
    // Patch Corretivo (BUG B): botão mostra o que VAI ACONTECER ao clicar
    themeIcon.textContent = SolsticeTheme.get('mode') === 'dark' ? '☀️' : '🌙';

    // TEMA1 v4 (Auditoria 2026.4): paleta CUSTOM — user escolhe cor base, sistema gera
    // variações dark/light automaticamente. Aplica via CSS vars --c-accent/hi/lo.
    function _hexToHSL(hex){
      const m = /^#?([a-f0-9]{6})$/i.exec(hex);
      if (!m) return null;
      const n = parseInt(m[1], 16);
      const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
      let h = 0, s = 0; const l = (mx + mn) / 2;
      if (mx !== mn){
        const d = mx - mn;
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        switch(mx){
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return [h * 360, s * 100, l * 100];
    }
    function _hslToHex(h, s, l){
      h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
      const c = (1 - Math.abs(2*l - 1)) * s;
      const x = c * (1 - Math.abs(((h/60) % 2) - 1));
      const m = l - c/2;
      let r=0, g=0, b=0;
      if (h < 60){ r=c; g=x; b=0; }
      else if (h < 120){ r=x; g=c; b=0; }
      else if (h < 180){ r=0; g=c; b=x; }
      else if (h < 240){ r=0; g=x; b=c; }
      else if (h < 300){ r=x; g=0; b=c; }
      else { r=c; g=0; b=x; }
      const toHex = v => Math.round((v+m)*255).toString(16).padStart(2, '0');
      return '#' + toHex(r) + toHex(g) + toHex(b);
    }
    function _applyCustomPalette(baseHex){
      const hsl = _hexToHSL(baseHex);
      if (!hsl) return;
      const [h, s, l] = hsl;
      const root = document.documentElement.style;
      // Accent base = cor do user. Hi = +10% lightness. Lo = -15% lightness.
      root.setProperty('--c-accent',    baseHex);
      root.setProperty('--c-accent-hi', _hslToHex(h, s, Math.min(85, l + 10)));
      root.setProperty('--c-accent-lo', _hslToHex(h, s, Math.max(20, l - 15)));
      // Auditoria 2026 (AP-02): avisar — usuário customizou cor de destaque,
      // perder isso silenciosamente surpreende no próximo refresh.
      SolsticeStorage.safeSet('solstice.theme.customAccent', baseHex);
    }
    const customInput = document.getElementById('palette-custom-input');
    // CUSTOM1 v4: picker SEMPRE visível e ativo. Mudar cor → seta paleta 'custom'.
    try {
      const saved = localStorage.getItem('solstice.theme.customAccent');
      if (saved && customInput) customInput.value = saved;
    } catch(_){}
    if (customInput){
      const _onColor = (e) => {
        _applyCustomPalette(e.target.value);
        // Atualiza dropdown pra mostrar "Custom" como selecionado
        if (paletteSelect && paletteSelect.value !== 'custom') paletteSelect.value = 'custom';
      };
      customInput.addEventListener('input', _onColor);
      customInput.addEventListener('change', _onColor);
    }
    paletteSelect.addEventListener('change', e => {
      const v = e.target.value;
      if (v === 'custom'){
        if (customInput) _applyCustomPalette(customInput.value);
      } else {
        // Limpa override custom (CSS vars voltam pra paleta nominal)
        const root = document.documentElement.style;
        root.removeProperty('--c-accent');
        root.removeProperty('--c-accent-hi');
        root.removeProperty('--c-accent-lo');
        SolsticeTheme.set('palette', v);
      }
      SolsticeToast.success(SolsticeLocale.t('toast.theme.changed'), v);
    });
    // Restaura tema custom no boot se a paleta salva é 'custom'
    if ((SolsticeTheme.get('palette') === 'custom' || paletteSelect.value === 'custom') && customInput){
      _applyCustomPalette(customInput.value);
    }
    densitySelect.addEventListener('change', e => SolsticeTheme.set('density', e.target.value));
    themeToggle.addEventListener('click', () => {
      const next = SolsticeTheme.cycle('mode');
      themeIcon.textContent = next === 'dark' ? '☀️' : '🌙';
    });
    // C-01 v3: sincroniza dropdown quando palette muda via API.
    // BUG1 v4 (Auditoria 2026.4): charts existentes precisam RE-RENDERIZAR ao trocar paleta.
    // Antes: ao trocar Ocean→Forest, gráfico ficava com cor antiga porque Chart.js
    // não re-criava. Agora: força SolsticeCanvas.render() pra recriar charts com
    // a paleta nova.
    SolsticeStore.subscribe('theme.palette', (v) => {
      if (paletteSelect && v && paletteSelect.value !== v) paletteSelect.value = v;
      // Re-renderiza canvas (re-cria charts com nova paleta)
      try { if (typeof SolsticeCanvas !== 'undefined' && SolsticeCanvas.render) SolsticeCanvas.render(); } catch(_){}
    });
    SolsticeStore.subscribe('theme.density', (v) => {
      if (densitySelect && v && densitySelect.value !== v) densitySelect.value = v;
    });
    SolsticeStore.subscribe('theme.mode', (v) => {
      if (themeIcon) themeIcon.textContent = v === 'dark' ? '☀️' : '🌙';
      // Mode também afeta charts (cores de eixos, grid). Re-render.
      try { if (typeof SolsticeCanvas !== 'undefined' && SolsticeCanvas.render) SolsticeCanvas.render(); } catch(_){}
    });

    // 3. Profile
    const profile = SolsticeProfiles.ensureDefault();
    document.getElementById('profile-name').textContent = profile.name;
    document.getElementById('profile-avatar').style.background = profile.color;
    document.getElementById('status-profile').textContent = profile.name;

    // SOL-G1/G3: profile-btn vira o entry point único de Settings. O conteúdo
    // de _openProfilePreferences (Confirmações destrutivas) migrou pra Settings
    // → Preferências; a função fica dead-code intencional pra preservar git
    // history.
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) profileBtn.addEventListener('click', () => SolsticeSettings.open());

    // Ask Bar central — abre o modal de SolsticeAsk (mesmo handler do Ctrl+P)
    const btnHeaderAsk = document.getElementById('btn-header-ask');
    if (btnHeaderAsk){
      btnHeaderAsk.addEventListener('click', () => {
        try { SolsticeAsk.open(); }
        catch(e){ SolsticeLog.warn('[AskBar]', e); }
      });
    }
    // Auditoria 2026.2 (BR-A3): placeholder dinâmico — começa "Importe um CSV"
    // (welcome state), troca para "Pergunte sobre seus dados…" quando há
    // dataset. Reduz fricção de quem ainda não sabe o que o produto faz.
    (function _initAskBarPlaceholder(){
      const ph = document.getElementById('header-ask-placeholder');
      const btn = document.getElementById('btn-header-ask');
      if (!ph) return;
      const _apply = (ready) => {
        if (ready){
          ph.textContent = 'Pergunte sobre seus dados…';
          if (btn) btn.title = 'Pergunte sobre seus dados em português · Ctrl+P';
        } else {
          ph.textContent = 'Importe um CSV pra começar…';
          if (btn) btn.title = 'Importe um CSV → depois pergunte em português · Ctrl+P';
        }
      };
      _apply(!!SolsticeStore.get('dataset.ready'));
      SolsticeStore.subscribe('dataset.ready', _apply);
    })();

    // 4. Botões globais — 3 DROPDOWNS no header (Fix 2 da Camada 1):
    //    📁 Importar ▾ · 💾 Salvar ▾ · ⬇️ Exportar ▾
    const fileInput = document.getElementById('file-input');

    // 📁 Importar ▾
    const btnImportMenu = document.getElementById('btn-import-menu');
    if (btnImportMenu){
      btnImportMenu.addEventListener('click', async () => {
        const choice = await SolsticeModal.select({
          title: '📁 Importar',
          message: 'Escolha o formato:',
          options: [
            { value:'csv',     icon:'📄', label:'CSV',                 desc:'Comma/Semicolon Separated Values (.csv, .tsv, .txt)' },
            { value:'json',    icon:'🧬', label:'JSON',                desc:'Array de objetos · `[{...},{...}]`' },
            { value:'snap',    icon:'🗂️', label:'Snapshot do Solstice', desc:'Estado completo salvo via Ctrl+S ou Salvar ▾' },
            { value:'html',    icon:'📰', label:'HTML standalone',     desc:'Dashboard exportado com dados embutidos' }
          ],
          confirmLabel:'Importar',
          cancelLabel:'Cancelar'
        });
        if (!choice) return;
        if (choice === 'csv'){
          fileInput.accept = '.csv,.tsv,.txt';
          fileInput.click();
        } else if (choice === 'json'){
          fileInput.accept = '.json';
          fileInput.click();
        } else if (choice === 'snap'){
          SolsticeFileSystem && SolsticeFileSystem.openJSON && SolsticeFileSystem.openJSON();
        } else if (choice === 'html'){
          SolsticeToast.info('Abra o HTML standalone diretamente', 'Arquivos HTML do Solstice se auto-hidratam ao abrir.');
        }
      });
    }

    // LE-06 (Sprint 2) + S6-02 (Sprint 6) + B1-02 (v6-autonomous):
    // Refresh "manual mas reativo" — separado de Atrelar pasta.
    //   Click no 🔄 (refresh): se há pasta atrelada → re-lê arquivo; senão → file picker
    //   Click no 📎 (attach):  abre showDirectoryPicker e atrela
    // Sem mais Shift+Click oculto.
    const btnRefreshData = document.getElementById('btn-refresh-data');
    if (btnRefreshData){
      btnRefreshData.addEventListener('click', async () => {
        const dsReady = SolsticeStore.get('dataset.ready');
        if (!dsReady){
          SolsticeToast.info('Sem dados pra recarregar', 'Importe um arquivo primeiro.');
          return;
        }
        // Modo automático se há pasta atrelada
        if (typeof SolsticeFolderAttach !== 'undefined' && SolsticeFolderAttach.isAttached()){
          const refreshed = await SolsticeFolderAttach.refresh();
          if (refreshed) return; // sucesso — file reimportado
        }
        // Modo manual (sem pasta atrelada ou falha): file picker
        const ingest = SolsticeStore.get('ingest') || {};
        const lastName = ingest.sourceName || 'arquivo';
        const tip = (typeof window.showDirectoryPicker === 'function')
          ? '💡 Use 📎 (atrelar pasta) ao lado pra refresh automático no futuro.'
          : '';
        SolsticeToast.info('Re-selecione o arquivo', 'Por segurança o navegador não guarda "' + lastName + '". ' + tip);
        fileInput.accept = '.csv,.tsv,.txt,.json';
        fileInput.click();
      });
    }
    // B1-02: botão dedicado Atrelar pasta
    // Sprint 45 / feedback do usuário: "pasta atrelada está muito ruim".
    // Antes: clique sempre tentava atrelar; sem UI pra desatrelar; nome só
    // no tooltip (invisível em desktop). Agora:
    //   - Não atrelada: clique → showDirectoryPicker (atrelar)
    //   - Atrelada: clique → menu dropdown com [Trocar pasta · Desatrelar ·
    //     Ver detalhes], label inline com nome + caret ▾ visíveis
    const btnAttachFolder = document.getElementById('btn-attach-folder');
    if (btnAttachFolder){
      const labelEl = document.getElementById('attach-folder-label');
      const caretEl = document.getElementById('attach-folder-caret');

      // Sprint 45: atualiza UI inline conforme estado (atrelada ou não).
      function _syncAttachUI(){
        const attached = (typeof SolsticeFolderAttach !== 'undefined') && SolsticeFolderAttach.isAttached();
        if (attached){
          const name = SolsticeFolderAttach.getAttachedName() || 'pasta';
          const fileName = SolsticeFolderAttach.getAttachedSourceName();
          btnAttachFolder.classList.add('is-active');
          if (labelEl){
            labelEl.style.display = 'inline-block';
            labelEl.textContent = name;
            labelEl.title = name + (fileName ? ' · ' + fileName : '');
          }
          if (caretEl) caretEl.style.display = 'inline';
          btnAttachFolder.title = '📎 Pasta atrelada: ' + name + (fileName ? ' (arquivo: ' + fileName + ')' : '') + '. Clique para gerenciar.';
        } else {
          btnAttachFolder.classList.remove('is-active');
          if (labelEl){ labelEl.style.display = 'none'; labelEl.textContent = ''; }
          if (caretEl) caretEl.style.display = 'none';
          btnAttachFolder.title = 'Atrelar pasta do disco — refresh automático ao recarregar a página';
        }
      }

      // Sprint 45: menu popover quando já atrelada.
      function _openAttachMenu(anchor){
        // Fecha qualquer menu aberto antes
        document.querySelectorAll('.solstice__attach-menu').forEach(m => m.remove());
        const name = SolsticeFolderAttach.getAttachedName() || 'pasta';
        const fileName = SolsticeFolderAttach.getAttachedSourceName();
        const menu = SolsticeUtils.el('div', {
          class: 'solstice__attach-menu',
          role: 'menu',
          style: 'position:fixed;background:var(--c-surface);border:1px solid var(--c-border);' +
                 'border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.22);' +
                 'min-width:260px;max-width:340px;z-index:99999;padding:6px;font-size:12px;'
        });
        // Header (info, não clicável)
        const header = SolsticeUtils.el('div', {
          style: 'padding:8px 10px;border-bottom:1px solid var(--c-border);margin-bottom:4px;'
        });
        header.appendChild(SolsticeUtils.el('div', {
          style: 'font-size:10px;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:2px;'
        }, '📎 Pasta atrelada'));
        header.appendChild(SolsticeUtils.el('div', {
          style: 'font-weight:600;color:var(--c-text);word-break:break-all;'
        }, name));
        if (fileName){
          header.appendChild(SolsticeUtils.el('div', {
            style: 'font-size:10px;opacity:0.7;margin-top:2px;font-family:var(--font-mono);'
          }, '📄 ' + fileName));
        }
        menu.appendChild(header);

        function _menuBtn(icon, label, sub, onclick, danger){
          const btn = SolsticeUtils.el('button', {
            role: 'menuitem',
            style: 'display:flex;flex-direction:column;align-items:flex-start;' +
                   'width:100%;padding:8px 10px;background:transparent;border:none;border-radius:4px;' +
                   'cursor:pointer;text-align:left;color:' + (danger ? 'var(--c-error)' : 'var(--c-text)') + ';',
            onmouseenter: (e) => e.currentTarget.style.background = 'var(--c-surface-2)',
            onmouseleave: (e) => e.currentTarget.style.background = 'transparent',
            onclick: async () => { menu.remove(); await onclick(); }
          });
          btn.appendChild(SolsticeUtils.el('div', { style: 'font-weight:600;' }, icon + ' ' + label));
          if (sub) btn.appendChild(SolsticeUtils.el('div', { style: 'font-size:10px;opacity:0.65;margin-top:2px;' }, sub));
          return btn;
        }

        menu.appendChild(_menuBtn('🔄', 'Recarregar arquivo agora', 'Re-importa "' + (fileName || 'arquivo') + '" da pasta',
          async () => {
            if (!fileName){ SolsticeToast.info('Sem arquivo memorizado', 'Importe um arquivo primeiro.'); return; }
            const ok = await SolsticeFolderAttach.refresh();
            if (ok) SolsticeToast.success('Recarregado', fileName);
          }));
        menu.appendChild(_menuBtn('📁', 'Trocar pasta…', 'Escolher outra pasta do disco',
          async () => {
            const ok = await SolsticeFolderAttach.attach();
            if (ok){
              SolsticeToast.success('Pasta trocada', SolsticeFolderAttach.getAttachedName() || 'nova pasta');
              _syncAttachUI();
            }
          }));
        menu.appendChild(_menuBtn('❌', 'Desatrelar', 'Remove o vínculo · refresh volta a pedir o arquivo',
          async () => {
            const confirm = await SolsticeModal.confirm({
              title: 'Desatrelar pasta?',
              message: 'A pasta "' + name + '" deixa de estar atrelada. O dataset atual continua carregado — só perde o atalho de refresh automático.',
              confirmLabel: 'Desatrelar',
              cancelLabel: 'Cancelar'
            });
            if (confirm){
              SolsticeFolderAttach.detach();
              SolsticeToast.info('📎 Desatrelada', 'Refresh volta a pedir o arquivo manualmente.');
              _syncAttachUI();
            }
          }, true));

        document.body.appendChild(menu);
        // Posiciona abaixo do botão, alinhado à direita
        const rect = anchor.getBoundingClientRect();
        const menuW = 280;
        menu.style.top = (rect.bottom + 6) + 'px';
        menu.style.left = Math.max(8, Math.min(window.innerWidth - menuW - 8, rect.right - menuW)) + 'px';

        // Clique fora fecha
        const closeOnOutside = (e) => {
          if (!menu.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)){
            menu.remove();
            document.removeEventListener('click', closeOnOutside, true);
          }
        };
        setTimeout(() => document.addEventListener('click', closeOnOutside, true), 0);
      }

      btnAttachFolder.addEventListener('click', async (e) => {
        if (typeof SolsticeFolderAttach === 'undefined' || !SolsticeFolderAttach.isSupported()){
          SolsticeToast.warn('Não suportado', 'Atrelar pasta requer Chrome/Edge 86+. Continue importando manualmente.');
          return;
        }
        // Sprint 45: se JÁ atrelada, abre menu (trocar/desatrelar/recarregar).
        // Se não atrelada, fluxo direto de attach.
        if (SolsticeFolderAttach.isAttached()){
          _openAttachMenu(btnAttachFolder);
          return;
        }
        const dsReady = SolsticeStore.get('dataset.ready');
        if (!dsReady){
          SolsticeToast.info('Importe primeiro', 'Atrelar pasta funciona depois de carregar um arquivo — assim sabemos qual recarregar.');
          return;
        }
        const ok = await SolsticeFolderAttach.attach();
        if (ok){
          SolsticeToast.success('📎 Pasta atrelada', 'O ícone 🔄 agora recarrega automaticamente. Ao reabrir o navegador, o Solstice também atualiza.');
          _syncAttachUI();
        }
      });
      // Sync inicial + sync sempre que mudar via storage (cobre attach/detach
      // disparados por outros caminhos — restoreFromStorage no boot, etc).
      setTimeout(_syncAttachUI, 600);
      SolsticeStore.subscribe('ui.folder.attachedName', _syncAttachUI);
    }

    // 💾 Salvar ▾
    const btnSaveMenu = document.getElementById('btn-save-menu');
    if (btnSaveMenu){
      btnSaveMenu.addEventListener('click', async () => {
        const hasData = SolsticeStore.get('dataset.ready');
        if (!hasData){
          SolsticeToast.warn('Importe um dataset primeiro', 'Salvar só está disponível com dados carregados.');
          return;
        }
        const choice = await SolsticeModal.select({
          title: '💾 Salvar',
          message: 'O que você quer salvar?',
          options: [
            { value:'snap-quick', icon:'⚡', label:'Snapshot rápido',     desc:'Salva tudo agora · Ctrl+S' },
            { value:'snap-named', icon:'🏷️', label:'Snapshot com nome',   desc:'Salvar como… · escolha um nome' },
            { value:'view',       icon:'👁️', label:'Visão (View)',        desc:'Filtros + parâmetros nomeados' },
            { value:'snap-list',  icon:'📂', label:'Lista de snapshots', desc:'Ver/carregar/remover salvos · Ctrl+O' },
            { value:'history',    icon:'🕐', label:'Histórico da sessão', desc:'Versões automáticas (ring buffer 10)' }
          ],
          confirmLabel:'Abrir',
          cancelLabel:'Cancelar'
        });
        if (!choice) return;
        if (choice === 'snap-quick'){ SolsticeSnapshots.save(); SolsticeToast.success('Snapshot salvo'); }
        else if (choice === 'snap-named'){ SolsticeSnapshots.save({ promptName: true }); }
        else if (choice === 'view'){ SolsticeViews && SolsticeViews.openManager && SolsticeViews.openManager(); }
        else if (choice === 'snap-list'){ SolsticeSnapshots.openModal(); }
        else if (choice === 'history'){ SolsticeVersions.openModal(); }
      });
    }

    // ⬇️ Exportar ▾
    const btnExportMenu = document.getElementById('btn-export-menu');
    if (btnExportMenu){
      btnExportMenu.addEventListener('click', async () => {
        const hasData = SolsticeStore.get('dataset.ready');
        if (!hasData){
          SolsticeToast.warn('Importe um dataset primeiro', 'Exportar só está disponível com dados carregados.');
          return;
        }
        const choice = await SolsticeModal.select({
          title: '⬇️ Exportar',
          message: 'Escolha o formato de saída:',
          options: [
            { value:'html',  icon:'📰', label:'HTML standalone',  desc:'Dashboard completo · self-contained com dados' },
            { value:'csv',   icon:'📄', label:'CSV (dados)',       desc:'Linhas filtradas atualmente visíveis' },
            { value:'json',  icon:'🧬', label:'JSON (dados)',      desc:'Mesmo escopo do CSV, em JSON' },
            { value:'svg',   icon:'🖼️', label:'SVG do componente',  desc:'Gráfico vetorial editável (Illustrator/Inkscape)' },
            { value:'pdf',   icon:'📄', label:'PDF',               desc:'Via print do navegador (escolha "Salvar como PDF")' },
            { value:'embed', icon:'🌐', label:'Código de embed',    desc:'iframe pra incorporar dashboard em site externo' },
            { value:'link',  icon:'🔗', label:'Link compartilhável', desc:'URL com state codificado (cap 50KB)' }
          ],
          confirmLabel:'Exportar',
          cancelLabel:'Cancelar'
        });
        if (!choice) return;
        if (choice === 'html') SolsticeExport.openExportModal();
        else if (choice === 'csv' || choice === 'json') SolsticeExportData.openModal({ format: choice });
        else if (choice === 'svg') SolsticeExportSVG.open();  // JD-01 Sprint 3
        else if (choice === 'embed') SolsticeEmbed.open();    // JD-03 Sprint 3
        else if (choice === 'pdf') SolsticePDF.export();
        else if (choice === 'link') SolsticeShare.copy();
      });
    }

    fileInput.addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      // ADR-161: one-shot Express flag (lido + limpo) — vindo do botão Welcome
      const expressOnce = fileInput.getAttribute('data-express-once') === 'true';
      if (expressOnce) fileInput.removeAttribute('data-express-once');
      await _runIngestFile(f, { expressMode: expressOnce });
      fileInput.value = '';
    });

    // 5. Help button (reabre onboarding)
    document.getElementById('help-btn').addEventListener('click', () => SolsticeOnboarding.show());

    // Auditoria 2026.6 (HEADER-REDESIGN): menus popover do header (<details>)
    // fecham ao clicar fora, ao escolher um item, e com Esc — comportamento
    // esperado de menu. Sem libs; um único listener global.
    (function _initHeaderMenus(){
      const menus = () => document.querySelectorAll('details.solstice__menu[open]');
      document.addEventListener('click', (e) => {
        menus().forEach(d => {
          const insideTrigger = e.target.closest && e.target.closest('summary');
          const clickedItem = e.target.closest && e.target.closest('.solstice__menu-item');
          if (clickedItem) { d.removeAttribute('open'); return; }
          if (!d.contains(e.target) || (insideTrigger && insideTrigger.parentElement !== d)) {
            // clique fora deste details (ou no trigger de outro) → fecha
            if (!d.contains(e.target)) d.removeAttribute('open');
          }
        });
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') menus().forEach(d => d.removeAttribute('open'));
      });
      // abrir um menu fecha os outros
      document.querySelectorAll('details.solstice__menu > summary').forEach(s => {
        s.addEventListener('click', () => {
          const self = s.parentElement;
          document.querySelectorAll('details.solstice__menu[open]').forEach(d => { if (d !== self) d.removeAttribute('open'); });
        });
      });
    })();

    // B3-05 (v6-autonomous / OB-05 — Cláudia/Stone): FAB Ajuda flutuante
    // Botão "?" fixo bottom-right que abre menu rápido (atalhos · tour · sobre)
    (function _initHelpFAB(){
      const fab = document.getElementById('solstice-help-fab');
      if (!fab) return;
      let popover = null;

      function _closePopover(){
        if (popover) { popover.remove(); popover = null; }
      }

      function _openPopover(){
        if (popover) { _closePopover(); return; }
        popover = SolsticeUtils.el('div', { class:'solstice__help-popover', role:'menu' });
        popover.appendChild(SolsticeUtils.el('h4', null, '💡 Ajuda rápida'));

        const items = [
          { icon:'🧭', label:'Tour interativo (9 passos)', kbd:'',
            fn: () => { try { SolsticeTour.start(); } catch(_){} } },
          { icon:'🔍', label:'Pergunte ao Solstice',     kbd:'Ctrl+P',
            fn: () => { try { SolsticeAsk.open(); } catch(_){} } },
          { icon:'⌨️', label:'Atalhos de teclado',        kbd:'?',
            fn: () => { try { SolsticeOnboarding.show(); } catch(_){} } },
          { icon:'📚', label:'Comando · todos atalhos',   kbd:'Ctrl+K',
            fn: () => { try { SolsticeCommandPalette.open(); } catch(_){} } },
          { icon:'🐛', label:'Reportar bug · GitHub',     kbd:'',
            fn: () => { window.open('https://github.com/lucas/solstice/issues/new?template=bug.md', '_blank'); } },
          // B7-04 (v6-autonomous / RES-05): telemetria local opt-in.
          // Sem servidor — usuário baixa JSON dos erros e cola no issue.
          { icon:'📥', label:'Exportar log de erros',      kbd:'',
            fn: () => {
              try {
                const log = (typeof SolsticeErrorBoundary !== 'undefined')
                  ? SolsticeErrorBoundary.getLog()
                  : [];
                const audit = (typeof SolsticeAudit !== 'undefined')
                  ? SolsticeAudit.list().slice(-50) // últimas 50 ações
                  : [];
                const payload = {
                  exportedAt: new Date().toISOString(),
                  version: window.Solstice && window.Solstice.version,
                  userAgent: navigator.userAgent,
                  url: location.href,
                  errors: log,
                  recentActions: audit,
                  storeKeys: (typeof SolsticeStore !== 'undefined')
                    ? Object.keys(SolsticeStore.get('') || {})
                    : []
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'solstice-log-' + Date.now() + '.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 500);
                if (typeof SolsticeToast !== 'undefined'){
                  SolsticeToast.success('Log exportado', log.length + ' erro(s) + ' + audit.length + ' ação(ões) recentes');
                }
              } catch(e){
                if (typeof SolsticeToast !== 'undefined') SolsticeToast.warn('Falha ao exportar', e.message);
              }
            } }
        ];
        items.forEach(it => {
          const btn = SolsticeUtils.el('button', {
            type:'button', class:'solstice__help-popover-item', role:'menuitem',
            onclick: () => { _closePopover(); it.fn(); }
          });
          btn.appendChild(SolsticeUtils.el('span', { class:'solstice__help-popover-item-icon', 'aria-hidden':'true' }, it.icon));
          btn.appendChild(SolsticeUtils.el('span', null, it.label));
          if (it.kbd) btn.appendChild(SolsticeUtils.el('span', { class:'solstice__help-popover-item-kbd' }, it.kbd));
          popover.appendChild(btn);
        });
        document.body.appendChild(popover);
        // Fecha ao clicar fora
        setTimeout(() => {
          document.addEventListener('click', function _outside(e){
            if (popover && !popover.contains(e.target) && e.target !== fab){
              document.removeEventListener('click', _outside);
              _closePopover();
            }
          });
        }, 50);
      }

      fab.addEventListener('click', () => {
        // B5-05: primeira interação → para o pulse e marca como visitado
        if (fab.classList.contains('is-first-visit')){
          fab.classList.remove('is-first-visit');
          try {
            if (typeof SolsticeStorage !== 'undefined') SolsticeStorage.safeSet('solstice.help.firstSeen', '1');
            else localStorage.setItem('solstice.help.firstSeen', '1');
          } catch(_){}
        }
        _openPopover();
      });
      // B5-05: primeira visita → pulse no FAB (chama atenção pra ajuda)
      try {
        const seen = (typeof SolsticeStorage !== 'undefined')
          ? SolsticeStorage.safeGet('solstice.help.firstSeen')
          : localStorage.getItem('solstice.help.firstSeen');
        if (!seen) fab.classList.add('is-first-visit');
      } catch(_){}
      // Atalho "?" (Shift+/) abre o popover
      document.addEventListener('keydown', (e) => {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.target && e.target.isContentEditable) return;
        if (e.key === '?' && !e.ctrlKey && !e.metaKey){
          e.preventDefault();
          _openPopover();
        }
      });
    })();

    // v6-autonomous / B1-01: título do dashboard MOVIDO pro SolsticeDashHeader.
    // (Antes ficava no header global como #brand-doctitle — removido.)
    // O título é editável diretamente no banner visual do dashboard, via
    // SolsticeDashHeader.openConfig() OU pelo doubleclick no <h2> do banner.

    // SOL-B1 + SOL-A1: instala Modelo de Dados (relacionamentos) em idle, depois
    // do primeiro paint do welcome — não bloqueia main thread no boot.
    // Auditoria 2026.2 (JM-A3): fallbacks de boot ficam em SolsticeLog —
    // erros reais continuam visíveis (warn), debug em fallbacks silenciosos.
    const _installRels = () => { try { SolsticeRelationships.install(); } catch(e){ SolsticeLog.warn('[SolsticeRelationships] install falhou', e); } };
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(_installRels, { timeout: 1200 });
    else setTimeout(_installRels, 200);

    // 6. Debug shortcut
    SolsticeDebug.bindShortcut();

    // 6b. Canvas (Bloco 3) — render inicial + assina paths reativos
    SolsticeCanvas.init();

    // 7. Auditoria 2026.6 (FIRST-IMPRESSION): NÃO auto-abrimos mais o modal de
    // onboarding por cima da tela de boas-vindas. Era redundante — a própria
    // welcome já mostra os 3 caminhos (Importar · Express · Ver exemplo) + os
    // links "tour interativo (1 min)" e "ver onboarding" — e o modal competindo
    // com os toasts poluía os primeiros segundos. O onboarding/tour seguem a 1
    // clique (links da welcome, menu "?" do header, Ctrl+K). Primeira tela limpa.
    void SolsticeOnboarding.isFirstTime; // mantém referência (heurísticas futuras)

    // B8-04 (v6-autonomous / PM-06): aplica posição persistida dos toasts
    try {
      const tp = (typeof SolsticeStorage !== 'undefined')
        ? SolsticeStorage.safeGet('solstice.toast.position')
        : localStorage.getItem('solstice.toast.position');
      if (tp && ['bottom-right','top-right','bottom-center','top-center'].includes(tp)){
        document.documentElement.setAttribute('data-toast-position', tp);
      }
    } catch(_){}

    // B6-02 (v6-autonomous / PW-06): sync multi-tab via BroadcastChannel
    try { if (typeof SolsticeMultiTab !== 'undefined') SolsticeMultiTab.init(); }
    catch(e){ SolsticeLog.warn('[MultiTab init]', e); }

    // B4-02 (v6-autonomous / RES-03): auto-save de estado a cada 5s
    // + tenta restaurar se boot abrir com canvas vazio e há snapshot fresco
    try {
      if (typeof SolsticeAutoSave !== 'undefined'){
        SolsticeAutoSave.init();
        setTimeout(() => SolsticeAutoSave.tryRestore(), 600);
      }
    } catch(e){ SolsticeLog.warn('[AutoSave init]', e); }

    // B1-04 (v6-autonomous): tenta restaurar pasta atrelada + auto-refresh
    // se permissão ainda granted. Roda async no fundo, não bloqueia boot.
    // Sprint 45: a UI visual (botão, label, caret) é sincronizada pelo
    // subscriber 'ui.folder.attachedName' que registramos no click handler.
    // restoreFromStorage chama set('ui.folder.attachedName', name) — dispara.
    if (typeof SolsticeFolderAttach !== 'undefined' && SolsticeFolderAttach.restoreFromStorage){
      setTimeout(() => {
        SolsticeFolderAttach.restoreFromStorage().then(res => {
          if (res.restored && res.autoRefreshed){
            console.log('[Solstice] Pasta atrelada restaurada + arquivo recarregado automaticamente.');
          }
        });
      }, 400);
    }

    // 8. Console banner
    // Patch B5-r1 — footer dinâmico lendo de window.Solstice.version
    (function _setAppVersion(){
      const el = document.getElementById('app-version');
      if (!el || !window.Solstice) return;
      const m = (window.Solstice.version || '').match(/bloco(\d+)(?:-(r\d+))?/);
      const blocoNum = m ? m[1] : 'N';
      const revision = m && m[2] ? ' ' + m[2] : '';
      el.textContent = 'v5.3 · Bloco ' + blocoNum + revision;
    })();

    // B7-r2: inicializa Inspector lateral, Analysis drawer, binds globais
    SolsticeInspector.init();
    SolsticeAnalysis.init();
    // Esc: fecha o que estiver mais "na frente" (drawer Análise primeiro, depois Inspector)
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      // Não intercepta se um modal está aberto (modais têm seu próprio handler)
      if (document.querySelector('.solstice__modal-overlay')) return;
      if (SolsticeAnalysis.isOpen()){ SolsticeAnalysis.close(); e.preventDefault(); return; }
      if (SolsticeInspector.isOpen()){ SolsticeInspector.close(); e.preventDefault(); return; }
    });
    // Click em área vazia do canvas fecha inspector
    const canvasRoot = document.getElementById('canvas-root');
    if (canvasRoot){
      canvasRoot.addEventListener('click', (e) => {
        if (e.target.closest('.solstice__comp')) return;  // clicou no componente
        if (e.target.closest('.solstice__section-head')) return;
        if (e.target.closest('.solstice__row-tools')) return;
        if (e.target.closest('button')) return;
        if (e.target.closest('input, select, textarea')) return;
        if (SolsticeInspector.isOpen()) SolsticeInspector.close();
      });
    }

    // B8: inicializa Insights/Narrative/Agent/Inconsistencies/Ask
    SolsticeInsights.init();
    if (typeof SolsticeExecutiveInsights !== 'undefined') SolsticeExecutiveInsights.init();  // S6-01
    SolsticeAgent.init();
    SolsticeAsk.init();
    // B9: inicializa Filters/CrossFilter/Params
    SolsticeFilters.init();
    SolsticeCrossFilter.init();
    SolsticeParams.init();

    // B11: inicializa Snapshots/Versions/FileSystem/Export/TemplatesItau
    SolsticeSnapshots.init();
    SolsticeVersions.init();
    SolsticeFileSystem.init();
    SolsticeTemplatesItau.init();
    // B12: inicializa Modes/Slides/Presenter/CommandPalette/Tour
    SolsticeModes.init();
    SolsticeSlides.init();
    SolsticePresenter.init();
    SolsticeCommandPalette.init();
    SolsticeTour.init();

    // R-05 v3: subscribers de dataset.ready agora vão pelo SolsticeBoot (centralizado).
    // ADR-118.d: toast quando dataset não tem medidas.
    SolsticeBoot.onDatasetReady('warn-no-measures', () => {
      setTimeout(() => {
        const ingest = SolsticeStore.get('ingest') || {};
        const types = ingest.types || {};
        const cols = ingest.columns || [];
        const numCols = cols.filter(c => {
          const t = types[c] && types[c].type;
          return t && SolsticeTypes.group(t) === 'numeric';
        });
        if (!numCols.length){
          SolsticeToast.warn('Dataset sem medidas',
            'Apenas dimensões detectadas. KPIs, gauges e séries temporais ficarão ocultos.');
        }
      }, 600);
    });

    // Patch 1A (ADR-118.e): toast quando dicionário aplicado tem 0 matches
    SolsticeStore.subscribe('dictionary', (dict) => {
      if (!dict || !dict.columns) return;
      const ingest = SolsticeStore.get('ingest') || {};
      const cols = ingest.columns || [];
      const matches = cols.filter(c => dict.columns[c]).length;
      if (matches === 0 && cols.length > 0){
        SolsticeToast.warn('Dicionário sem aplicação',
          'Dicionário "' + (dict.name || 'sem nome') + '" não cobre nenhuma coluna do dataset atual.');
      }
    });

    // Patch Final (ADR-146): splash fade-out 1.5s
    setTimeout(() => {
      const s = document.getElementById('solstice-splash');
      if (s){ s.style.opacity = '0'; setTimeout(() => s.remove(), 600); }
    }, 1500);

    // Patch Final (ADR-140): SolsticeWorkspace init (selector no header + auto-save)
    try { SolsticeWorkspace.init(); } catch(e){ SolsticeLog.debug('[Workspace] init falhou', e); }

    // Patch Final (ADR-146): atalho vim-style g + key
    let gPending = false;
    let gTimer = null;
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'g'){
        e.preventDefault();
        gPending = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPending = false; }, 1200);
        return;
      }
      if (gPending){
        gPending = false; clearTimeout(gTimer);
        if (k === 'd'){ e.preventDefault(); SolsticeSidebarTabs && SolsticeSidebarTabs.activate('dados'); }
        else if (k === 'c'){ e.preventDefault(); SolsticeSidebarTabs && SolsticeSidebarTabs.activate('componentes'); }
        else if (k === 's'){ e.preventDefault(); SolsticeSidebarTabs && SolsticeSidebarTabs.activate('snapshots'); }
        // Sprint 29: atalho 'g m' → Modelo · 'g t' removido (templates não tem mais aba)
        else if (k === 'm'){ e.preventDefault(); SolsticeSidebarTabs && SolsticeSidebarTabs.activate('modelo'); }
        else if (k === 'i'){ e.preventDefault(); SolsticeStore.set('ui.insights.collapsed', false); SolsticeCanvas.render(); const el = document.querySelector('.solstice__insights'); if (el) el.scrollIntoView({behavior:'smooth'}); }
      }
    });

    // Patch Final (ADR-146): status bar — atualiza workspace + linhas/cols + saved indicator
    function _refreshStatusBar(){
      const ws = SolsticeWorkspace.active();
      const wsEl = document.getElementById('status-workspace');
      if (wsEl) wsEl.textContent = '📊 ' + (ws ? ws.name : '—');
      // Auditoria 2026.2 (MC-A3): mantém "—" enquanto não há linhas/colunas
      // reais. Mostrar "0" é semanticamente errado (sugere dataset vazio)
      // e confunde usuário novo no welcome state.
      const ingest = SolsticeStore.get('ingest') || {};
      const rows = ingest.rows || [];
      const cols = ingest.columns || [];
      const rEl = document.getElementById('status-rows');
      const cEl = document.getElementById('status-cols');
      if (rEl) rEl.textContent = rows.length ? rows.length.toLocaleString('pt-BR') : '—';
      if (cEl) cEl.textContent = cols.length ? String(cols.length) : '—';
    }
    _refreshStatusBar();
    SolsticeStore.subscribe('ingest', _refreshStatusBar);
    window.addEventListener('solstice:workspace:ready', _refreshStatusBar);
    // Pisca o "salvo" amarelo brevemente em mudanças
    const savedEl = document.getElementById('status-saved');
    let savedTimer = null;
    // Auditoria 2026.2 (BR-M5): subscriber ignora a 1ª invocação (re-hidratação
    // do boot/snapshot load). Antes, o "● Salvo automaticamente" verde aparecia
    // sempre, confundindo usuário no estado vazio ("salvo o quê?").
    // Auditoria 2026.4 (Sprint 15 / CA-03 — benchmark Notion/Google Docs):
    // status-saved persistente com timer relativo "Salvo há Xs".
    // Antes: piscava "Alterações não salvas" → "Salvo automaticamente" e congelava.
    // Agora: depois de salvar, mostra "Salvo há 5s", "Salvo há 1min", "Salvo há
    // 5min", atualizando a cada 15s. Comunica frescor sem ruído.
    //
    // Auditoria 2026.4 (Sprint 15 fix): _flashEnabled NÃO consumido pela 1ª
    // mudança real. Estratégia: setTimeout no boot pra ativar após o
    // rehydrate inicial (~600ms). Snapshot load também não dispara flash.
    let _flashEnabled = false;
    setTimeout(() => { _flashEnabled = true; }, 800);
    let _lastSavedTs = null;
    let _persistentTimer = null;
    function _humanSinceShort(ms){
      const s = Math.round(ms / 1000);
      if (s < 60) return s + 's';
      const m = Math.round(s / 60);
      if (m < 60) return m + 'min';
      const h = Math.round(m / 60);
      return h + 'h';
    }
    function _renderSavedPersistent(){
      if (!savedEl || _lastSavedTs == null) return;
      const age = Date.now() - _lastSavedTs;
      savedEl.style.color = 'var(--c-success)';
      savedEl.textContent = age < 3000 ? '● Salvo agora' : '● Salvo há ' + _humanSinceShort(age);
    }
    const flashSaved = () => {
      if (!savedEl) return;
      if (!_flashEnabled) return;  // ignora durante janela de boot (rehydrate)
      // Mostra "Alterações não salvas" enquanto debounce não terminou
      savedEl.style.color = 'var(--c-warn)';
      savedEl.textContent = '● Alterações não salvas';
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        _lastSavedTs = Date.now();
        _renderSavedPersistent();
      }, 1800);
    };
    SolsticeStore.subscribe('canvas.sections', flashSaved);
    // Timer persistente — atualiza o "Salvo há Xs" a cada 15s.
    // Não interfere quando status mostra "Alterações não salvas" (savedTimer pendente).
    if (_persistentTimer) clearInterval(_persistentTimer);
    _persistentTimer = setInterval(() => {
      if (_lastSavedTs != null && savedEl && !savedEl.textContent.includes('não salvas')){
        _renderSavedPersistent();
      }
    }, 15000);

    // Patch Final (ADR-143): SolsticeShare — verifica hash compartilhado
    setTimeout(() => { try { SolsticeShare.checkHash(); } catch(e){ SolsticeLog.debug('[Share] checkHash falhou', e); } }, 400);

    // Patch 1B (ADR-125): SolsticeHints check inicial + após import
    setTimeout(() => { try { SolsticeHints.checkAndShow(); } catch(e){} }, 1200);
    // R-05 v3: subscribers de dataset.ready agora via SolsticeBoot (centralizado).
    SolsticeBoot.onDatasetReady('hints-check', () => {
      setTimeout(() => { try { SolsticeHints.checkAndShow(); } catch(e){} }, 1200);
    });

    // SOL-H3 v2 (R-05 v3): pré-seleciona até 3 filtros relevantes ao importar.
    SolsticeBoot.onDatasetReady('smart-filter-defaults', () => {
      setTimeout(() => {
        try {
          if (typeof SolsticeFilters !== 'undefined' && SolsticeFilters.applySmartDefaults){
            const def = SolsticeFilters.applySmartDefaults();
            if (def && def.length){
              SolsticeLog.debug('[SOL-H3] filtros padrão sugeridos:', def.map(d => d.column).join(' · '));
            }
          }
        } catch(e){ SolsticeLog.warn('[SOL-H3]', e); }
      }, 400);
    });

    // ADR-122 (R-05 v3): Quick Insights toast pós-import.
    SolsticeBoot.onDatasetReady('quick-insights-toast', () => {
      setTimeout(() => {
        try {
          const insights = SolsticeInsights.compute() || [];
          const topScore = insights.length ? Math.max(...insights.map(i => i.score || 0)) : 0;
          if (topScore >= 80){
            const top = insights.filter(i => (i.score || 0) >= 80).length;
            SolsticeToast.action({
              title: '📊 ' + top + ' insight' + (top > 1 ? 's' : '') + ' interessante' + (top > 1 ? 's' : '') + ' detectado' + (top > 1 ? 's' : ''),
              msg: 'Nos seus dados.',
              kind: 'info',
              actionLabel: 'Ver agora',
              actionFn: () => {
                SolsticeStore.set('ui.insights.collapsed', false);
                const el = document.querySelector('.solstice__insights');
                if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
                else SolsticeCanvas.render();
              },
              timeout: 10000
            });
          }
        } catch(e){ SolsticeLog.warn('[QuickInsights]', e); }
      }, 800);
    });

    // Camada 1 (ADR-158): scroll-chain removido — sticky genuíno torna desnecessário.
    // Mantemos Home/End globais que agora atuam no canvas (único scroller vertical).
    (function initGlobalScrollKeys(){
      const canvas = document.getElementById('canvas-root');
      document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
        if (e.key === 'Home' && !e.ctrlKey && !e.metaKey){
          canvas && canvas.scrollTo({ top: 0, behavior: 'smooth' });
          e.preventDefault();
        } else if (e.key === 'End' && !e.ctrlKey && !e.metaKey){
          canvas && canvas.scrollTo({ top: canvas.scrollHeight, behavior: 'smooth' });
          e.preventDefault();
        }
      });
    })();

    // Auditoria 2026 (M-H-3 / A-106): boot logger consolidado em 1 linha
    // pública. O histórico completo de patches (Patch 1A, 1B, 2, Final,
    // Bloco 13, Camada 1, Camada Style, Auditoria 2026) é exposto via
    // SolsticeDebug.bootLog() — só dispara com flag ?debug=1 ou Settings.
    const _bootHistory = [
      'Patch Final UX (B12-r1) · 9 bugs · welcome refeita · 🔄 trocar componente · aba Dados sempre visível',
      'Patch 1A · bugs + performance + semântica + erros + polish · userGroup/Compat/CompCache/Migrations/Formula/Limits/StatsAsync',
      'Patch UX · inserter (+) lateral + resize livre (↘ canto)',
      'Patch 1B · inteligência sem servidor · SolsticeQuery (30 intents) + LLM (4 providers) + Hints + Settings + Resumo Executivo',
      'Patch 2 · Medidas Calculadas (DAX-like) + KPI meta + Forecast/Compound + distrib-time + Export dados + Sparklines + Demand-list',
      'Patch Final · Multi-CSV + Visões + Tags/Coleções + URL Share + PDF + Comentários + DuckDB-WASM (opt-in)',
      'Bloco 13 · Diferenciais #3 (Comentários completo) e #4 (Grafo de Métricas)',
      'Patch Corretivo · 10 bugs + 5 componentes novos (Pivot/Slider/EventTimeline/BigNum/Funnel) + edição inline + aba Estilo',
      'Camada 1 · Sticky v3 Twitter-like · Header 3 dropdowns · Toolbar enxuta · Busca catálogo · Atalhos Ctrl+/',
      'Camada Style · SolsticeStyle (7 presets + 7 paletas) · CSS vars universais · aba Estilo redesenhada',
      'Auditoria 2026 · B-01 a B-07 + R-01 a R-20 + M-* (cf. RELATORIO.md)',
      'v6-autonomous · BLOCO 1-8 (i18n + boot tests + datasets demo + toast pos + annotations + FAB ajuda + brand-doctitle no DashHeader)',
      'Auditoria 2026.2 · box plot XLSX consistente (MC-A1) · presenter sem doc.write (MC-A2) · status bar "—" pré-import (MC-A3) · placeholder Ask dinâmico (BR-A3) · welcome com exemplo default (BR-A1) · ExecutiveInsights fallback (BR-A2) · catálogo Ask expandido (H1) · console.warn gated · block-status compactado',
      'Auditoria 2026.3 (Sprint 7 · Disciplina e Estado Coerente) · MultiTab subscribers não silenciam erros (MC-04) · IDB resolve boolean em falha (MC-05/AP-04) · AutoSave restore com banner de confirmação (BR-A5) · visibilitychange + beforeunload (MC-06) · 4 console.warn residuais migrados (JM-04) · MultiTab fecha BroadcastChannel (MC-07) · _humanAge para tempo decorrido (BR-A6) · ADR-185/186/187 (hierarquia persistência, fallback canal, restore confirmado)'
    ];
    if (typeof SolsticeDebug !== 'undefined' && SolsticeDebug.registerBootLog){
      SolsticeDebug.registerBootLog(_bootHistory);
    }
    // Linha pública — uma só. Atalhos viraram tooltip do ?-help.
    const _isDebug = (location.search.indexOf('debug=1') >= 0)
                  || (localStorage.getItem('solstice.debug') === '1');
    // Auditoria 2026 (JM-02): banner público de boot via SolsticeLog.boot.
    // Banner principal SEMPRE visível (confirma que o app carregou).
    // Histórico de patches só em debug=1 (gated por _isDebug, mantém o gate).
    SolsticeLog.boot('🌗 SOLSTICE v5.6.0-patched · 13/13 blocos · Sprints 1-7 + v6-autonomous + Auditoria 2026 + 2026.2 + 2026.3 · pronto', '#4D9FFF');
    if (_isDebug){
      SolsticeLog.info('Histórico de patches (camadas que construíram esta versão):');
      _bootHistory.forEach(line => SolsticeLog.info('  • ' + line));
    }
    // Atualiza #app-version a partir da fonte única (window.Solstice
    // está definido nos últimos ~100 linhas do arquivo).
    setTimeout(() => {
      try {
        const v = (window.Solstice && window.Solstice.version) || '5.6';
        const el = document.getElementById('app-version');
        if (el) el.textContent = 'Solstice v' + v.replace(/-.*$/, '');
      } catch(_){}
    }, 0);

    // Prompt 11 v5.4: inicializa sync de páginas (canvas.sections ↔ canvas.pages[active])
    try { if (typeof SolsticePages !== 'undefined' && SolsticePages._initSync) SolsticePages._initSync(); } catch(_){}
    // E aplica migração inline pro estado atual (caso já carregado sem snapshot)
    try {
      const c = SolsticeStore.get('canvas') || {};
      if (!Array.isArray(c.pages) || !c.pages.length){
        if (typeof SolsticePages !== 'undefined') SolsticePages.list(); // dispara auto-criação
      }
    } catch(_){}
    // Renderiza tabbar inicial
    try { if (typeof SolsticePagesUI !== 'undefined') SolsticePagesUI.render(); } catch(_){}
    // B1-05 (v6-autonomous): atalhos teclado pra multi-página
    try { if (typeof SolsticePagesUI !== 'undefined' && SolsticePagesUI.initKeyboard) SolsticePagesUI.initKeyboard(); } catch(_){}

    // Sentinel de integridade — se este log não aparece no console, o boot foi
    // interrompido por erro silencioso em algum dos passos acima (ADR-024).
    // Ausência deste log = sinal de bug crítico, equivalente ao incidente do código
    // órfão removido após Bloco 3.
    // Auditoria 2026 (JM-02): SolsticeLog.boot é o helper público "sempre visível".
    SolsticeLog.boot('[Solstice] boot OK');
    // SOL self-audit v2: marca o boot completo. SolsticeSelfAudit espera por isso.
    try { SolsticeStore.set('app.booted', true); } catch(_){}

    // Auditoria 2026 (BR-02): prompt de nome NÃO acontece mais no boot.
    // Antes: 600ms após boot — primeira tela mobile já mostrava modal pedindo
    // dado pessoal antes de o usuário ver o que o produto faz (atrito de
    // adoção e modal quebrado no mobile, ver BR-01).
    // Agora: aguarda a primeira ação de valor (primeiro dataset pronto).
    // Aí sim — depois do "momento aha" — o app pergunta o nome.
    try {
      let _asked = false;
      const _askOnceAfterValue = () => {
        if (_asked) return;
        _asked = true;
        // Sprint 30 / BH-01: delay aumentado de 1200ms → 3500ms + verifica
        // se há outro modal aberto antes de promp-tar nome. Antes o modal
        // "Bem-vindo, como podemos te chamar?" sobrepunha picker de
        // templates / wizard / auto-dashboard sugerido. Agora espera a
        // tela "assentar" e só abre se nada mais está aberto.
        const _tryAsk = (retries) => {
          retries = retries || 0;
          if (retries > 5) return; // desiste após ~17s
          const hasOpenModal = !!document.querySelector('[role=dialog]');
          if (hasOpenModal){
            // Outro modal está aberto — re-tenta em 3s
            setTimeout(() => _tryAsk(retries + 1), 3000);
            return;
          }
          try { SolsticeProfiles.promptNameIfPlaceholder(); } catch(e){}
        };
        setTimeout(() => _tryAsk(0), 3500);
      };
      const unsub = SolsticeStore.subscribe('dataset.ready', (val) => {
        if (val) { _askOnceAfterValue(); unsub && unsub(); }
      });
      // Defesa: se já estava ready quando o subscribe rodou (boot tardio).
      if (SolsticeStore.get('dataset.ready')) _askOnceAfterValue();
    } catch(e){}
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ============================================================
     BLOCO 2 — INGESTÃO + TIPOS + VALIDADOR + EDITOR
     ============================================================ */

  /* ============================================================
     SolsticeBR — validadores brasileiros (CPF, CNPJ, CEP)
     Algoritmos completos de dígito verificador. Distingue um CPF
     real de uma string com 11 dígitos quaisquer.
     ============================================================ */
  const SolsticeBR = (function(){

    function _digits(s){ return String(s||'').replace(/\D/g, ''); }

    function isCPF(s){
      const c = _digits(s);
      if (c.length !== 11) return false;
      if (/^(\d)\1{10}$/.test(c)) return false;        // 11111111111 inválido
      let sum = 0;
      for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
      let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
      if (d1 !== parseInt(c[9])) return false;
      sum = 0;
      for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
      let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
      return d2 === parseInt(c[10]);
    }

    function isCNPJ(s){
      const c = _digits(s);
      if (c.length !== 14) return false;
      if (/^(\d)\1{13}$/.test(c)) return false;
      const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
      const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += parseInt(c[i]) * w1[i];
      let d1 = sum % 11; d1 = d1 < 2 ? 0 : 11 - d1;
      if (d1 !== parseInt(c[12])) return false;
      sum = 0;
      for (let i = 0; i < 13; i++) sum += parseInt(c[i]) * w2[i];
      let d2 = sum % 11; d2 = d2 < 2 ? 0 : 11 - d2;
      return d2 === parseInt(c[13]);
    }

    function isCEP(s){
      const c = _digits(s);
      return c.length === 8 && !/^0{8}$/.test(c);
    }

    function formatCPF(s){
      const c = _digits(s);
      return c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : s;
    }
    function formatCNPJ(s){
      const c = _digits(s);
      return c.length === 14 ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : s;
    }
    function formatCEP(s){
      const c = _digits(s);
      return c.length === 8 ? c.replace(/(\d{5})(\d{3})/, '$1-$2') : s;
    }

    function maskCPF(s){
      const c = _digits(s);
      if (c.length !== 11) return s;
      return c.slice(0,3) + '.***.***-' + c.slice(9);
    }

    // Auditoria 2026 (R-01 / A-301): conversor numérico locale-aware.
    // ANTES (espalhado pelo app): `parseFloat(String(v).replace(',', '.'))`
    // truncava `1.234,56` para `1.23456` em silêncio — soma vinha errada.
    // AGORA: detecta formato pelo padrão de pontos/vírgulas e strip-agrupador
    // antes do parseFloat. Use SolsticeBR.toNumber em todos os pontos
    // numéricos (Types/Ingest/Editor/Export/Formula/Inference).
    function toNumber(v){
      if (v == null || v === '') return NaN;
      if (typeof v === 'number') return v;
      const s = String(v).trim().replace(/[^\d.,\-]/g, '');
      if (!s || s === '-' || s === '.' || s === ',') return NaN;
      const lastComma = s.lastIndexOf(',');
      const lastDot   = s.lastIndexOf('.');
      let normalized;
      if (lastComma === -1 && lastDot === -1){
        normalized = s;
      } else if (lastComma > lastDot){
        // pt-BR: separador decimal é a vírgula; pontos são agrupadores.
        normalized = s.replace(/\./g, '').replace(',', '.');
      } else if (lastDot > lastComma){
        // US: separador decimal é o ponto; vírgulas são agrupadores.
        normalized = s.replace(/,/g, '');
      } else {
        normalized = s;
      }
      const n = parseFloat(normalized);
      return n;
    }

    return { isCPF, isCNPJ, isCEP, formatCPF, formatCNPJ, formatCEP, maskCPF, toNumber };
  })();
