
  /* ============================================================
     Patch 2 (ADR-131) — SolsticeMeasures
     UI de construção visual de Medidas Calculadas. Persiste em
     ingest.calculatedMeasures = { name: { formula, description, resultType, format } }
     ============================================================ */
  const SolsticeMeasures = (function(){
    function list(){
      const ingest = SolsticeStore.get('ingest') || {};
      return ingest.calculatedMeasures || {};
    }

    function save(name, def){
      const ingest = SolsticeStore.get('ingest') || {};
      const measures = Object.assign({}, ingest.calculatedMeasures || {});
      measures[name] = def;
      SolsticeStore.set('ingest', Object.assign({}, ingest, { calculatedMeasures: measures }));
      SolsticeAudit.record({ action:'measure_save', target: name, details: { formula: def.formula } });
    }

    function remove(name){
      const ingest = SolsticeStore.get('ingest') || {};
      const measures = Object.assign({}, ingest.calculatedMeasures || {});
      delete measures[name];
      SolsticeStore.set('ingest', Object.assign({}, ingest, { calculatedMeasures: measures }));
      SolsticeAudit.record({ action:'measure_remove', target: name });
    }

    /** Camada Polish v3: sugestão de fórmula em linguagem natural.
        Detecta palavras-chave + colunas disponíveis e propõe fórmula. */
    function _suggestFormula(question, cols, dict){
      const q = String(question || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (!q.trim()) return null;
      const dictCols = (dict && dict.columns) || {};
      // Helper: encontra coluna que matcha palavra-chave (no nome técnico OU no friendlyName)
      function findCol(...keywords){
        for (const kw of keywords){
          for (const c of cols){
            const tech = c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            const friendly = ((dictCols[c] && dictCols[c].friendlyName) || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            if (tech.includes(kw) || friendly.includes(kw)) return c;
          }
        }
        return null;
      }

      // === Padrões de intent ===

      // Margem em %
      if (/margem.*(%|percent|porcent)|margem.*relativ/.test(q)){
        const rec = findCol('receita','vendas','revenue','faturamento','total');
        const cus = findCol('custo','cost','despesa','gasto');
        if (rec && cus) return {
          name: 'Margem (%)',
          description: 'Margem percentual sobre a receita',
          formula: '({' + rec + '} - {' + cus + '}) / {' + rec + '} * 100',
          resultType: 'percentage'
        };
      }
      // Margem absoluta
      if (/margem|lucro|profit/.test(q)){
        const rec = findCol('receita','vendas','revenue','faturamento','total');
        const cus = findCol('custo','cost','despesa','gasto');
        if (rec && cus) return {
          name: 'Margem',
          description: 'Receita menos custo (margem em valor absoluto)',
          formula: '{' + rec + '} - {' + cus + '}',
          resultType: 'currency'
        };
      }
      // Ticket médio
      if (/ticket\s*med|valor\s*med|media\s*por\s*pedido|arpu/.test(q)){
        const rec = findCol('receita','vendas','revenue','faturamento','valor');
        const ped = findCol('pedido','quantidade','count','order','venda','transacao');
        if (rec && ped) return {
          name: 'Ticket médio',
          description: 'Receita dividida pela quantidade de pedidos',
          formula: '{' + rec + '} / {' + ped + '}',
          resultType: 'currency'
        };
      }
      // Taxa de conversão
      if (/taxa.*conversao|conversao.*taxa|conversion/.test(q)){
        const conv = findCol('conversao','venda','converted','closed','won');
        const lead = findCol('lead','visitante','total','visit','prospect');
        if (conv && lead) return {
          name: 'Taxa de conversão (%)',
          description: 'Percentual de leads que converteram',
          formula: '{' + conv + '} / {' + lead + '} * 100',
          resultType: 'percentage'
        };
      }
      // ROI / Retorno
      if (/roi|retorno.*investimento/.test(q)){
        const rec = findCol('receita','retorno','revenue','gain');
        const inv = findCol('investimento','custo','cost','spent');
        if (rec && inv) return {
          name: 'ROI (%)',
          description: '(Retorno - Investimento) / Investimento × 100',
          formula: '({' + rec + '} - {' + inv + '}) / {' + inv + '} * 100',
          resultType: 'percentage'
        };
      }
      // Crescimento (% delta)
      if (/crescimento|variacao|delta|diferenca/.test(q)){
        const a = findCol('atual','current','novo','depois');
        const b = findCol('anterior','previous','antigo','antes','passado');
        if (a && b) return {
          name: 'Crescimento (%)',
          description: 'Variação percentual entre os dois períodos',
          formula: '({' + a + '} - {' + b + '}) / {' + b + '} * 100',
          resultType: 'percentage'
        };
      }
      // Média de X
      const avgMatch = q.match(/media\s+(?:de|do|da)\s+(.+)/);
      if (avgMatch){
        const c = findCol(avgMatch[1].trim());
        if (c) return {
          name: 'Média de ' + ((dictCols[c] && dictCols[c].friendlyName) || c),
          formula: 'AVG({' + c + '})',
          resultType: 'decimal'
        };
      }
      // Soma / total de X
      const sumMatch = q.match(/(?:soma|total)\s+(?:de|do|da)\s+(.+)/);
      if (sumMatch){
        const c = findCol(sumMatch[1].trim());
        if (c) return {
          name: 'Total de ' + ((dictCols[c] && dictCols[c].friendlyName) || c),
          formula: 'SUM({' + c + '})',
          resultType: 'decimal'
        };
      }
      // Diferença entre X e Y
      const diffMatch = q.match(/diferen[çc]a\s+entre\s+(.+?)\s+e\s+(.+)/);
      if (diffMatch){
        const a = findCol(diffMatch[1].trim());
        const b = findCol(diffMatch[2].trim());
        if (a && b) return {
          name: ((dictCols[a] && dictCols[a].friendlyName) || a) + ' - ' + ((dictCols[b] && dictCols[b].friendlyName) || b),
          formula: '{' + a + '} - {' + b + '}',
          resultType: 'decimal'
        };
      }

      return null;
    }

    function openBuilder(existingName){
      const ingest = SolsticeStore.get('ingest') || {};
      const dict = SolsticeStore.get('dictionary');
      const cols = (ingest.columns || []).filter(c => {
        const t = ingest.types && ingest.types[c];
        return t && SolsticeTypes.group(t.type) === 'numeric';
      });
      const existing = existingName ? (list()[existingName] || null) : null;

      const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:10px;font-size:13px;color:var(--c-text);' });

      // === Audit Fix 5: NL-FIRST. Modo expert virou <details> colapsado.
      // Antes: bloquinho NL pequeno + form expert sempre aberto -> Rafaela
      // intimidada por "DAX-like". Agora: NL grande no topo, form em
      // "▸ Modo avançado" colapsado.
      // Em EDIT (existingName): abre direto no expert (já há formula
      // estruturada para o usuário ler/editar).
      if (!existingName){
        const nlWrap = SolsticeUtils.el('div', {
          style:'padding:16px;background:color-mix(in srgb, var(--c-accent) 10%, transparent);border:1.5px solid color-mix(in srgb, var(--c-accent) 40%, var(--c-border));border-radius:var(--rad-md);margin-bottom:4px;'
        });
        nlWrap.appendChild(SolsticeUtils.el('div', { style:'font-size:14px;color:var(--c-text);font-weight:var(--fw-bold);margin-bottom:4px;' },
          '💬 O que você quer calcular?'));
        nlWrap.appendChild(SolsticeUtils.el('div', { style:'font-size:12px;color:var(--c-text-2);line-height:1.5;margin-bottom:12px;' },
          'Descreva em português. Eu monto a fórmula automaticamente — você revisa e salva.'));

        const nlInput = SolsticeUtils.el('input', {
          class:'solstice__props-input', type:'text',
          placeholder:'Ex: margem em %',
          style:'font-size:14px;padding:10px 12px;'
        });
        const nlRow = SolsticeUtils.el('div', { style:'display:flex;gap:8px;' });
        nlRow.appendChild(nlInput);
        nlRow.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--primary',
          style:'font-size:13px;padding:10px 18px;flex-shrink:0;font-weight:var(--fw-semibold);',
          onclick: () => {
            const sug = _suggestFormula(nlInput.value, cols, dict);
            if (!sug){
              SolsticeToast.warn('Não consegui montar', 'Tente outro dos exemplos abaixo.');
              return;
            }
            nameInput.value = sug.name;
            descInput.value = sug.description || '';
            formulaInput.value = sug.formula;
            if (sug.resultType){
              for (const opt of fmtSelect.options){
                if (opt.value === sug.resultType) { opt.selected = true; break; }
              }
            }
            _renderPreview();
            // Audit Fix 5: ao sugerir, ABRE o modo expert pra revisar/editar
            const expertDetails = wrap.querySelector('details.solstice__measures-expert');
            if (expertDetails) expertDetails.setAttribute('open', '');
            SolsticeToast.success('Fórmula montada', 'Revise no Modo avançado abaixo se quiser ajustar.');
          }
        }, '✨ Sugerir fórmula'));
        nlInput.addEventListener('keydown', e => {
          if (e.key === 'Enter'){ e.preventDefault(); nlRow.querySelector('button').click(); }
        });
        nlWrap.appendChild(nlRow);

        // Exemplos clicáveis maiores
        const examplesLabel = SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-text-2);margin-top:10px;margin-bottom:6px;' },
          'Exemplos prontos (clique para preencher):');
        nlWrap.appendChild(examplesLabel);
        const examplesRow = SolsticeUtils.el('div', { style:'display:flex;flex-wrap:wrap;gap:6px;' });
        ['margem em %', 'ticket médio', 'taxa de conversão', 'crescimento', 'média de receita', 'total de pedidos'].forEach(ex => {
          examplesRow.appendChild(SolsticeUtils.el('button', {
            class:'solstice__btn',
            style:'font-size:12px;padding:6px 12px;background:var(--c-surface);border:1px solid var(--c-border);',
            onclick: () => { nlInput.value = ex; nlRow.querySelector('button').click(); }
          }, ex));
        });
        nlWrap.appendChild(examplesRow);

        wrap.appendChild(nlWrap);
      }

      // Audit Fix 5: form expert num <details> (colapsado por default em NEW,
      // aberto em EDIT). Visualmente claro que é "Modo avançado".
      const expertDetails = SolsticeUtils.el('details', {
        class:'solstice__measures-expert',
        style:'border:1px solid var(--c-border);border-radius:var(--rad-sm);padding:0;background:var(--c-surface);'
      });
      if (existingName) expertDetails.setAttribute('open', '');
      const expertSummary = SolsticeUtils.el('summary', {
        style:'cursor:pointer;padding:10px 14px;font-size:12px;font-weight:var(--fw-semibold);color:var(--c-text-2);user-select:none;list-style:none;display:flex;align-items:center;gap:8px;'
      });
      expertSummary.appendChild(SolsticeUtils.el('span', null, '⚙️'));
      expertSummary.appendChild(SolsticeUtils.el('span', null, existingName ? 'Editar fórmula' : 'Modo avançado (escrever fórmula manualmente)'));
      expertDetails.appendChild(expertSummary);
      const expertBody = SolsticeUtils.el('div', { style:'padding:8px 14px 14px;display:flex;flex-direction:column;gap:8px;' });
      expertDetails.appendChild(expertBody);
      wrap.appendChild(expertDetails);

      // Nome
      const nameInput = SolsticeUtils.el('input', {
        class:'solstice__props-input', type:'text',
        value: existingName || '', placeholder:'Ex: Margem Bruta'
      });
      const descInput = SolsticeUtils.el('textarea', {
        class:'solstice__props-input', rows:'2',
        placeholder:'Descrição opcional…'
      }, existing ? (existing.description || '') : '');
      const formulaInput = SolsticeUtils.el('textarea', {
        class:'solstice__props-input',
        rows:'2',
        style:'font-family:var(--font-mono);',
        placeholder:'{receita_total} - {custo_total}'
      }, existing ? existing.formula : '');

      // Audit Fix 5: addField agora aponta para expertBody (dentro do <details>)
      function addField(label, ctrl){
        expertBody.appendChild(SolsticeUtils.el('label', { style:'font-size:11px;color:var(--c-muted);' }, label));
        expertBody.appendChild(ctrl);
      }
      addField('Nome', nameInput);
      addField('Descrição', descInput);
      addField('Fórmula', formulaInput);

      // Operadores + funções clicáveis
      const opBar = SolsticeUtils.el('div', { style:'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;' });
      ['+','-','*','/','(',')','>','<','=',',','SUM(','AVG(','MIN(','MAX(','COUNT(','MEDIAN(','IF(','AND(','OR(','NOT('].forEach(op => {
        const b = SolsticeUtils.el('button', {
          type:'button',
          class:'solstice__btn solstice__btn--ghost',
          style:'font-family:var(--font-mono);font-size:11px;padding:2px 8px;',
          onclick: () => { formulaInput.value += op; formulaInput.focus(); }
        }, op);
        opBar.appendChild(b);
      });
      expertBody.appendChild(opBar);

      // Colunas disponíveis (click insere {nome})
      expertBody.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-top:4px;' }, 'Colunas numéricas (click para inserir):'));
      const colBar = SolsticeUtils.el('div', { style:'display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;' });
      if (!cols.length){
        colBar.appendChild(SolsticeUtils.el('div', { style:'color:var(--c-muted);font-size:11px;font-style:italic;' },
          'Nenhuma coluna numérica neste dataset.'));
      }
      cols.forEach(c => {
        colBar.appendChild(SolsticeUtils.el('button', {
          type:'button',
          class:'solstice__btn solstice__btn--ghost',
          style:'font-size:11px;padding:2px 8px;',
          onclick: () => { formulaInput.value += '{' + c + '}'; formulaInput.focus(); }
        }, c));
      });
      expertBody.appendChild(colBar);

      // Formato
      const fmtRow = SolsticeUtils.el('div', { style:'display:flex;gap:6px;margin-top:8px;' });
      const fmtSelect = SolsticeUtils.el('select', { class:'solstice__props-select', style:'flex:1;' });
      [['decimal','Número'],['currency','Moeda (R$)'],['percentage','Percentual'],['integer','Inteiro']].forEach(([v,l]) => {
        const o = SolsticeUtils.el('option', { value:v }, l);
        if (existing && existing.resultType === v) o.selected = true;
        fmtSelect.appendChild(o);
      });
      const decInput = SolsticeUtils.el('input', { class:'solstice__props-input', type:'number', min:'0', max:'6', value: existing ? (existing.decimals != null ? String(existing.decimals) : '2') : '2', style:'max-width:80px;' });
      fmtRow.appendChild(fmtSelect); fmtRow.appendChild(decInput);
      addField('Formato · decimais', fmtRow);

      // Preview
      const preview = SolsticeUtils.el('div', { style:'font-family:var(--font-mono);font-size:11px;background:var(--c-surface-2);border-radius:4px;padding:8px;min-height:40px;line-height:1.5;color:var(--c-text);max-height:120px;overflow-y:auto;' });
      function _renderPreview(){
        preview.innerHTML = '';
        const f = formulaInput.value.trim();
        if (!f){ preview.textContent = 'Preview aparece aqui ao digitar a fórmula.'; return; }
        const v = SolsticeFormula.validate(f, { columns: ingest.columns || [], calculatedMeasures: list() });
        if (!v.ok){
          preview.style.color = 'var(--c-error)';
          preview.textContent = '⚠ ' + v.errors.map(e => e.message).join(' · ');
          return;
        }
        preview.style.color = 'var(--c-text)';
        // Avalia em 5 primeiras rows
        try {
          const sample = (ingest.rows || []).slice(0, 5);
          if (!sample.length){ preview.textContent = 'OK · sem dados para preview'; return; }
          sample.forEach((r, i) => {
            const val = SolsticeFormula.evaluate(f, r, { rows: sample });
            const line = SolsticeUtils.el('div', null, '#' + (i+1) + ' → ' + (val == null ? 'null' : Number(val).toLocaleString('pt-BR', { maximumFractionDigits: parseInt(decInput.value)||2 })));
            preview.appendChild(line);
          });
        } catch(err){
          preview.style.color = 'var(--c-error)';
          preview.textContent = '⚠ ' + err.message;
        }
      }
      formulaInput.addEventListener('input', _renderPreview);
      decInput.addEventListener('input', _renderPreview);
      _renderPreview();
      addField('Preview · 5 primeiras linhas', preview);

      SolsticeModal.show({
        title: existingName ? '🧮 Editar medida calculada' : '🧮 Nova medida calculada',
        body: wrap,
        buttons: [
          existingName ? { label:'🗑️ Remover', kind:'ghost', onClick: () => {
            remove(existingName);
            SolsticeToast.warn('Medida removida', existingName);
            return true;
          }} : null,
          { label:'Cancelar', kind:'ghost', onClick: () => true },
          { label:'Salvar', kind:'primary', onClick: () => {
            const name = nameInput.value.trim();
            if (!name){ SolsticeToast.error('Nome obrigatório'); return false; }
            if (/[^A-Za-z0-9_]/.test(name)){ SolsticeToast.error('Nome inválido', 'Apenas letras, números e _'); return false; }
            const v = SolsticeFormula.validate(formulaInput.value, { columns: ingest.columns || [], calculatedMeasures: list() });
            if (!v.ok){ SolsticeToast.error('Fórmula inválida', v.errors.map(e => e.message).join(' · ')); return false; }
            // Auditoria 2026 (M-O-3 / A-1104): detecção de ciclo profundo
            // via DFS sobre o grafo de dependências. Antes só pegava
            // auto-referência (A→A). Agora detecta A→B→A, A→B→C→A etc.
            if (v.deps.includes(name)){
              SolsticeToast.error('Dependência circular', name + ' não pode usar a si mesma');
              return false;
            }
            const cycle = _findCycle(name, v.deps);
            if (cycle){
              SolsticeToast.error('Dependência circular detectada', cycle.join(' → '));
              return false;
            }
            save(name, {
              formula: formulaInput.value.trim(),
              description: descInput.value.trim(),
              resultType: fmtSelect.value,
              decimals: parseInt(decInput.value) || 2
            });
            SolsticeToast.success('Medida salva', name);
            return true;
          }}
        ].filter(Boolean)
      });
    }

    // Auditoria 2026 (M-O-3 / A-1104): DFS para detectar ciclo profundo
    // no grafo de dependências entre medidas. Retorna o caminho do ciclo
    // (array de nomes) ou null se não há ciclo.
    function _findCycle(newName, newDeps){
      const all = list();
      // monta mapa nome → deps[]; inclui a medida nova sendo validada.
      const graph = {};
      for (const m of all){
        if (m.name === newName) continue;
        graph[m.name] = (m.formula
          ? (SolsticeFormula.validate(m.formula, { columns: [], calculatedMeasures: all }).deps || [])
          : []);
      }
      graph[newName] = newDeps || [];
      // DFS detectando back-edge a partir de cada filho de newName.
      function dfs(node, path, visiting){
        if (visiting.has(node)){
          // ciclo — devolve trecho do path que fecha o ciclo.
          const idx = path.indexOf(node);
          return path.slice(idx).concat(node);
        }
        if (!graph[node]) return null;
        visiting.add(node);
        path.push(node);
        for (const dep of graph[node]){
          const c = dfs(dep, path, visiting);
          if (c) return c;
        }
        visiting.delete(node);
        path.pop();
        return null;
      }
      for (const dep of (newDeps || [])){
        const c = dfs(dep, [newName], new Set([newName]));
        if (c) return c;
      }
      return null;
    }

    return { list, save, remove, openBuilder, _findCycle };
  })();
