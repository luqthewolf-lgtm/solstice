
  /* ============================================================
     BLOCO 10 — SolsticeWizard (ADR-078)
     Wizard multi-step com 11 intenções:
       1. Step 1 — escolher intenção (grid de cards)
       2. Step 2 — preview das recomendações (lista checkmarcável)
       3. Step 3 — confirmar e aplicar
     ============================================================ */
  const SolsticeWizard = (function(){

    // Audit Fix 8: intents agrupados em 3 MACRO-categorias (Julia/Rafaela).
    // ANTES: 12 intents misturados, com termos técnicos (Pareto, Holt-Winters,
    // IQR) que confundiam não-técnicos. AGORA: 3 grupos amigáveis +
    // "Análises avançadas" collapse pra os técnicos.
    //   macro 'ver'      → Ver/explorar: distribuir, ranking, composicao, tabular
    //   macro 'comparar' → Comparar: comparar, correlacao, periodos
    //   macro 'prever'   → Tendência/predição: tendencia, forecast
    //   macro 'avancado' → outlier, pareto (atrás de "Análises avançadas")
    const INTENTS = [
      // === Ver / Explorar ===
      { id: 'distribuir', icon: '📉', title: 'Distribuir', desc: 'Ver forma de uma variável (histograma, box plot)', kind: 'agnostico', macro: 'ver' },
      { id: 'ranking',    icon: '🏆', title: 'Ranking', desc: 'Top N por métrica', kind: 'agnostico', macro: 'ver' },
      { id: 'composicao', icon: '🧩', title: 'Composição', desc: 'Como categorias se distribuem (Sankey)', kind: 'agnostico', macro: 'ver' },
      { id: 'tabular',    icon: '📋', title: 'Tabular', desc: 'Dados crus em tabela', kind: 'agnostico', macro: 'ver' },
      // === Comparar ===
      { id: 'comparar',   icon: '📊', title: 'Comparar', desc: 'Valores entre categorias (KPIs, box plot agrupado)', kind: 'agnostico', macro: 'comparar' },
      { id: 'correlacao', icon: '🔗', title: 'Correlação', desc: 'Relação entre 2 variáveis (scatter)', kind: 'agnostico', macro: 'comparar' },
      { id: 'periodos',   icon: '🔄', title: 'Comparar períodos', desc: 'Mesmo indicador em janelas temporais', kind: 'analitico', macro: 'comparar' },
      // === Prever / Tendência ===
      { id: 'tendencia',  icon: '📈', title: 'Tendência', desc: 'Evolução no tempo (série temporal, heatmap calendário)', kind: 'agnostico', macro: 'prever' },
      { id: 'forecast',   icon: '🔮', title: 'Forecast', desc: 'Projeção futura via tendência ou Holt-Winters', kind: 'analitico', macro: 'prever' },
      // === Análises avançadas (colapsado) ===
      { id: 'outlier',    icon: '⚠️', title: 'Caça outliers', desc: 'Identificar valores fora do padrão (IQR 1.5×)', kind: 'analitico', macro: 'avancado' },
      { id: 'pareto',     icon: '🎯', title: 'Pareto 80/20', desc: 'Concentração em poucas categorias', kind: 'analitico', macro: 'avancado' },
      // === Custom ===
      { id: 'custom',     icon: '🛠️', title: 'Personalizado', desc: 'Eu escolho. Ver todas as recomendações sem filtro.', kind: 'custom', macro: 'avancado' }
    ];

    let currentStep = 1;
    let selectedIntent = null;
    let recs = [];
    let selected = []; // bool array

    function _ctxFor(){
      const ingest = SolsticeStore.get('ingest') || {};
      return {
        rows: ingest.rows || [],
        rowsAll: ingest.rows || [],
        columns: ingest.columns || [],
        types: ingest.types || {},
        dictionary: SolsticeStore.get('dictionary'),
        L: SolsticeLocale
      };
    }

    function _renderStepIndicator(host){
      const steps = SolsticeUtils.el('div', { class:'solstice__wizard-steps' });
      const labels = [
        { n: 1, label: 'Intenção' },
        { n: 2, label: 'Revisar' },
        { n: 3, label: 'Aplicar' }
      ];
      labels.forEach(s => {
        const cls = 'solstice__wizard-step' +
          (s.n === currentStep ? ' is-current' : '') +
          (s.n < currentStep ? ' is-done' : '');
        const item = SolsticeUtils.el('div', { class: cls });
        item.appendChild(SolsticeUtils.el('div', { class:'solstice__wizard-step-num' },
          s.n < currentStep ? '✓' : String(s.n)));
        item.appendChild(SolsticeUtils.el('span', null, s.label));
        steps.appendChild(item);
      });
      host.appendChild(steps);
    }

    // Audit Fix 8: render agrupado em 3 macro-categorias + collapse "Avançadas"
    function _renderStep1(host, onSelect){
      host.appendChild(SolsticeUtils.el('p',
        { style:'color:var(--c-muted);font-size:var(--fs-sm);text-align:center;margin-bottom:var(--sp-3);' },
        'O que você quer descobrir? Escolha uma intenção e o Solstice recomenda componentes.'));

      const macroGroups = [
        { id: 'ver',      title: '👁️ Ver / Explorar',  desc: 'Visualizar os dados' },
        { id: 'comparar', title: '⚖️ Comparar',         desc: 'Contrastar valores' },
        { id: 'prever',   title: '📈 Tendência / Prever', desc: 'Ver evolução no tempo' }
      ];

      function _makeCard(intent){
        const card = SolsticeUtils.el('button', {
          class:'solstice__intent-card' + (selectedIntent === intent.id ? ' is-selected' : ''),
          type: 'button',
          onclick: () => onSelect(intent.id)
        });
        card.appendChild(SolsticeUtils.el('div', { class:'solstice__intent-icon' }, intent.icon));
        card.appendChild(SolsticeUtils.el('div', { class:'solstice__intent-title' }, intent.title));
        card.appendChild(SolsticeUtils.el('div', { class:'solstice__intent-desc' }, intent.desc));
        const badgeCls = 'solstice__intent-badge' + (intent.kind === 'analitico' ? ' solstice__intent-badge--analytic' : '');
        card.appendChild(SolsticeUtils.el('span', { class: badgeCls },
          intent.kind === 'analitico' ? '🔬 Analítico' : intent.kind === 'custom' ? '🛠️ Custom' : '📊 Agnóstico'));
        return card;
      }

      // Renderiza 3 macros principais
      for (const macro of macroGroups){
        const intentsInMacro = INTENTS.filter(i => i.macro === macro.id);
        if (!intentsInMacro.length) continue;
        const macroSection = SolsticeUtils.el('div', { style:'margin-bottom:var(--sp-3);' });
        macroSection.appendChild(SolsticeUtils.el('div', {
          style:'font-size:11px;font-weight:var(--fw-semibold);color:var(--c-text-2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--sp-2);'
        }, macro.title));
        const grid = SolsticeUtils.el('div', { class:'solstice__intents-grid' });
        intentsInMacro.forEach(i => grid.appendChild(_makeCard(i)));
        macroSection.appendChild(grid);
        host.appendChild(macroSection);
      }

      // Análises avançadas — <details> colapsado por default
      const advanced = INTENTS.filter(i => i.macro === 'avancado');
      if (advanced.length){
        const adv = SolsticeUtils.el('details', {
          style:'margin-top:var(--sp-3);border:1px dashed var(--c-border);border-radius:var(--rad-sm);padding:0;background:var(--c-surface-2);'
        });
        const advSum = SolsticeUtils.el('summary', {
          style:'cursor:pointer;padding:8px 12px;font-size:11px;font-weight:var(--fw-semibold);color:var(--c-text-2);text-transform:uppercase;letter-spacing:0.06em;user-select:none;list-style:none;'
        }, '🔬 Análises avançadas (' + advanced.length + ')');
        adv.appendChild(advSum);
        const advBody = SolsticeUtils.el('div', { style:'padding:8px 12px 12px;' });
        const advGrid = SolsticeUtils.el('div', { class:'solstice__intents-grid' });
        advanced.forEach(i => advGrid.appendChild(_makeCard(i)));
        advBody.appendChild(advGrid);
        adv.appendChild(advBody);
        host.appendChild(adv);
      }
    }

    function _renderStep2(host, onChange){
      const intent = INTENTS.find(i => i.id === selectedIntent);
      host.appendChild(SolsticeUtils.el('p',
        { style:'color:var(--c-muted);font-size:var(--fs-sm);text-align:center;margin-bottom:var(--sp-3);' },
        'Intenção: ' + (intent ? intent.icon + ' ' + intent.title : '—') + '. Revise os componentes que vou criar.'));
      if (!recs.length){
        host.appendChild(SolsticeUtils.el('div', { class:'solstice__params-empty' },
          'Nenhuma recomendação aplicável para essa intenção. Volte e escolha outra.'));
        return;
      }
      // Render lista checkmarcável
      const wrap = SolsticeUtils.el('div', { class:'solstice__recs-list' });
      recs.forEach((r, i) => {
        const def = SolsticeComponents.get(r.componentType);
        const tier = r.confidence >= 75 ? 'high' : r.confidence >= 60 ? 'med' : 'low';
        const item = SolsticeUtils.el('div', { class:'solstice__rec-item' });
        const cb = SolsticeUtils.el('input', { type:'checkbox',
          onchange: (e) => { selected[i] = e.target.checked; if (onChange) onChange(); } });
        cb.checked = selected[i];
        item.appendChild(cb);
        const body = SolsticeUtils.el('div', { class:'solstice__rec-item-body' });
        const title = SolsticeUtils.el('div', { class:'solstice__rec-item-title' });
        title.appendChild(SolsticeUtils.el('span', { class:'solstice__rec-item-icon' }, def ? def.icon : '🧩'));
        title.appendChild(SolsticeUtils.el('span', null, def ? def.name : r.componentType));
        body.appendChild(title);
        body.appendChild(SolsticeUtils.el('div', { class:'solstice__rec-item-reason' }, r.reasoning));
        item.appendChild(body);
        item.appendChild(SolsticeUtils.el('div', { class:'solstice__rec-item-confidence solstice__rec-item-confidence--' + tier },
          r.confidence + '%'));
        wrap.appendChild(item);
      });
      host.appendChild(wrap);
    }

    function _renderStep3(host){
      const finalRecs = recs.filter((_, i) => selected[i]);
      host.appendChild(SolsticeUtils.el('p',
        { style:'color:var(--c-muted);font-size:var(--fs-sm);text-align:center;margin-bottom:var(--sp-3);' },
        'Pronto para aplicar ' + finalRecs.length + ' componente(s). Eles serão adicionados ao canvas.'));
      const list = SolsticeUtils.el('div', { class:'solstice__recs-list' });
      finalRecs.forEach(r => {
        const def = SolsticeComponents.get(r.componentType);
        const item = SolsticeUtils.el('div', { class:'solstice__rec-item' });
        const checked = SolsticeUtils.el('span', { style:'width:28px;font-size:14px;color:var(--c-success);' }, '✓');
        item.appendChild(checked);
        const body = SolsticeUtils.el('div', { class:'solstice__rec-item-body' });
        body.appendChild(SolsticeUtils.el('div', { class:'solstice__rec-item-title' },
          (def ? def.icon + ' ' : '') + (def ? def.name : r.componentType)));
        body.appendChild(SolsticeUtils.el('div', { class:'solstice__rec-item-reason' }, r.reasoning));
        item.appendChild(body);
        item.appendChild(SolsticeUtils.el('div', { class:'solstice__rec-item-confidence solstice__rec-item-confidence--high' },
          r.confidence + '%'));
        list.appendChild(item);
      });
      host.appendChild(list);
    }

    async function open(){
      if (!SolsticeStore.get('ingest') || !(SolsticeStore.get('ingest').rows || []).length){
        SolsticeToast.warn('Wizard', 'Importe um CSV primeiro.');
        return;
      }
      currentStep = 1; selectedIntent = null; recs = []; selected = [];

      // Camada Polish v6: ao aplicar, perguntar em qual seção (com fallback automático).
      // Antes: SEMPRE criava sections novas. Agora: detecta sections existentes
      // e oferece adicionar à atual (preenchendo slots vazios primeiro).
      async function _applyFinal(close){
        const finalRecs = recs.filter((_, i) => selected[i]);
        if (!finalRecs.length){ SolsticeToast.warn('Nada selecionado', 'Marque ao menos 1 componente.'); return; }
        const current = SolsticeStore.get('canvas.sections') || [];

        // Se canvas vazio → cria nova section direto (sem perguntar)
        if (!current.length){
          const sections = SolsticeAutoDashboard._buildSections(finalRecs);
          SolsticeStore.set('canvas.sections', sections);
          SolsticeAudit.record({
            action: 'wizard_apply',
            details: { intent: selectedIntent, count: finalRecs.length, recIds: finalRecs.map(r => r.ruleId), target: 'new-section' }
          });
          SolsticeToast.success('Wizard concluído',
            finalRecs.length + ' componente(s) adicionado(s) com intenção "' + selectedIntent + '"');
          close(null);
          return;
        }

        // Há sections existentes → pergunta onde aplicar.
        // Fallback inteligente: sugere a primeira section com slots vazios suficientes.
        function _emptySlotsOf(sec){
          let n = 0;
          for (const r of sec.rows) for (const sl of r.slots) {
            if (!sl.type || sl.type === 'empty') n++;
          }
          return n;
        }
        const sectionsWithEmpty = current.map((s, i) => ({ ...s, _idx: i, _empty: _emptySlotsOf(s) }));
        const bestFallback = sectionsWithEmpty
          .filter(s => s._empty >= 1)
          .sort((a, b) => b._empty - a._empty)[0];

        const options = [
          {
            value: '__new__',
            icon: '🆕',
            label: 'Criar nova seção',
            desc: 'Cria 1+ seções novas no final do canvas'
          }
        ];
        current.forEach((sec, idx) => {
          const empty = sectionsWithEmpty[idx]._empty;
          options.push({
            value: 'sec-' + idx,
            icon: '📌',
            label: sec.title || 'Seção ' + (idx + 1),
            desc: empty > 0
              ? empty + ' slot(s) vazio(s) · vou preencher e adicionar rows se sobrar'
              : 'Sem slots vazios · adiciona ' + finalRecs.length + ' nova(s) row(s)'
          });
        });

        const defaultValue = bestFallback ? ('sec-' + bestFallback._idx) : '__new__';

        const choice = await SolsticeModal.select({
          title: 'Onde aplicar os ' + finalRecs.length + ' componente(s)?',
          message: 'Você tem ' + current.length + ' seção/seções existente(s). Escolha onde adicionar.',
          options,
          defaultValue,
          searchable: false,
          confirmLabel: 'Aplicar',
          cancelLabel: 'Cancelar'
        });
        if (!choice) return; // Cancelou

        let updatedSections;
        let target;
        if (choice === '__new__'){
          // Cria nova section igual ao comportamento antigo
          const newSecs = SolsticeAutoDashboard._buildSections(finalRecs);
          updatedSections = current.concat(newSecs);
          target = 'new-section';
        } else {
          // Adiciona à section escolhida: preenche slots vazios, depois cria rows novas
          const secIdx = parseInt(choice.replace('sec-', ''), 10);
          updatedSections = SolsticeUtils.deepClone(current);
          const targetSec = updatedSections[secIdx];
          const remaining = [...finalRecs];

          // 1) Preenche slots vazios existentes
          for (const row of targetSec.rows){
            for (const sl of row.slots){
              if (!remaining.length) break;
              if (!sl.type || sl.type === 'empty'){
                const rec = remaining.shift();
                const def = SolsticeComponents.get(rec.componentType);
                if (!def) continue;
                sl.type = rec.componentType;
                sl.config = rec.config || (def.defaultConfig ? def.defaultConfig(_ctxFor()) : {});
              }
            }
            if (!remaining.length) break;
          }

          // 2) Sobrou? Cria novas rows na mesma section (1 slot por row · layout 1col)
          while (remaining.length){
            const rec = remaining.shift();
            const def = SolsticeComponents.get(rec.componentType);
            if (!def) continue;
            const ctx = _ctxFor();
            targetSec.rows.push({
              id: SolsticeUtils.uuid(),
              layout: '1col',
              slots: [{
                id: SolsticeUtils.uuid(),
                type: rec.componentType,
                config: rec.config || (def.defaultConfig ? def.defaultConfig(ctx) : {})
              }]
            });
          }
          target = 'existing-section:' + (targetSec.title || 'Seção ' + (secIdx + 1));
        }

        SolsticeStore.set('canvas.sections', updatedSections);
        SolsticeAudit.record({
          action: 'wizard_apply',
          details: { intent: selectedIntent, count: finalRecs.length, recIds: finalRecs.map(r => r.ruleId), target }
        });
        SolsticeToast.success('Wizard concluído',
          finalRecs.length + ' componente(s) adicionado(s) em "' + (target.startsWith('existing-section:') ? target.slice(18) : 'nova seção') + '"');
        close(null);
      }

      await SolsticeModal.show({
        title: '🧙 Wizard de criação',
        size: 'lg',
        body: (close) => {
          const wrap = SolsticeUtils.el('div', { class:'solstice__wizard' });

          function render(){
            wrap.innerHTML = '';
            _renderStepIndicator(wrap);
            const content = SolsticeUtils.el('div', { class:'solstice__wizard-content' });
            if (currentStep === 1){
              _renderStep1(content, (id) => {
                selectedIntent = id;
                const ctx = _ctxFor();
                recs = SolsticeRecommender.recommend(ctx, { intent: id })
                  .filter(r => r.confidence >= 55)
                  .slice(0, 8);
                selected = recs.map(() => true);
                currentStep = 2;
                render();
              });
            } else if (currentStep === 2){
              _renderStep2(content);
            } else {
              _renderStep3(content);
            }
            wrap.appendChild(content);
          }
          render();
          // Re-render botões do footer ao mudar de step
          wrap._render = render;
          return wrap;
        },
        footer: (close) => {
          const back = SolsticeUtils.el('button', { class:'solstice__btn',
            onclick: () => {
              if (currentStep > 1){
                currentStep--;
                const w = document.querySelector('.solstice__wizard');
                if (w && w._render) w._render();
              } else close(null);
            }
          }, currentStep > 1 ? '← Voltar' : 'Cancelar');
          const next = SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary',
            onclick: () => {
              if (currentStep === 1){
                if (!selectedIntent){ SolsticeToast.warn('Escolha uma intenção'); return; }
                currentStep = 2;
              } else if (currentStep === 2){
                if (!recs.length){ SolsticeToast.warn('Sem recomendações', 'Volte e tente outra intenção.'); return; }
                if (selected.every(s => !s)){ SolsticeToast.warn('Marque ao menos 1 componente'); return; }
                currentStep = 3;
              } else {
                _applyFinal(close);
                return;
              }
              const w = document.querySelector('.solstice__wizard');
              if (w && w._render) w._render();
            }
          }, currentStep < 3 ? 'Próximo →' : '✓ Aplicar');
          return [back, next];
        }
      });
    }

    function listIntents(){ return INTENTS.slice(); }

    return { open, listIntents, INTENTS };
  })();
