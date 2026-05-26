
  /* ============================================================
     BLOCO 9 — SolsticeFilters
     Engine + UI de filtros globais. Filtros vivem em Store.filters
     como mapa { columnName: filterValue }. filterValue varia por tipo:
       - categorical: array<string> (valores selecionados; vazio = sem filtro)
       - numeric:     { min, max }
       - temporal:    { from, to } (ISO strings)
     Função pública getActiveRows() devolve subset filtrado de ingest.rows.
     Componentes consomem isso quando aplicável.
     ============================================================ */
  const SolsticeFilters = (function(){

    function _ingest(){ return SolsticeStore.get('ingest') || { rows:[], columns:[], types:{} }; }
    function _filters(){ return SolsticeStore.get('filters') || {}; }
    function _types(){ return _ingest().types || {}; }

    /** Conta filtros ativos (não vazios). */
    function activeCount(){
      const f = _filters();
      // Sprint 44 / fix UX: conta SÓ filtros que estão em colunas que existem
      // na base ativa. Antes contava também "fantasmas" — filtros em colunas
      // que sumiram (ex: trocou de CSV). Resultado era counter mostrando
      // "1 ATIVOS" enquanto apply() já ignorava → confundia usuário.
      const validCols = new Set((_ingest().columns || []));
      let n = 0;
      for (const k of Object.keys(f)){
        const v = f[k];
        if (v == null) continue;
        if (Array.isArray(v) && v.length === 0) continue;
        if (typeof v === 'string' && v === '') continue;  // Sprint 33 / BUG-EV-02: string vazia não conta
        if (v && typeof v === 'object' && v.min == null && v.max == null && v.from == null && v.to == null) continue;
        if (!validCols.has(k)) continue; // Sprint 44: filtro órfão (coluna sumiu) não conta
        n++;
      }
      return n;
    }

    /** Aplica filtros a um array de rows e retorna subset. */
    function apply(rows){
      const f = _filters();
      const types = _types();
      const ingest = _ingest();
      const validCols = new Set((ingest.columns || []));
      const cross = SolsticeStore.get('crossfilter');
      let out = rows || [];

      // Filtros globais por coluna
      for (const col of Object.keys(f)){
        const fv = f[col];
        if (fv == null) continue;
        // Sprint 40 / fix crítico: ignora filtro silenciosamente quando a coluna
        // NÃO EXISTE na base ativa. Antes: filtro em coluna inexistente
        // (ex: "data_atendimento" quando base só tem "data_abertura") zerava
        // TODAS as rows (new Date(undefined) é Invalid Date → isNaN(d) true →
        // descartado). Resultado: KPIs mostravam "Sem dataset carregado" mesmo
        // com CSV importado. Causa raiz reportada pelo usuário em screenshot.
        if (!validCols.has(col)){
          SolsticeLog && SolsticeLog.debug &&
            SolsticeLog.debug('[Filters.apply] coluna inexistente ignorada:', col);
          continue;
        }
        const t = (types[col] || {}).type;
        const group = SolsticeTypes.group(t);

        if (Array.isArray(fv) && fv.length){
          out = out.filter(r => fv.includes(String(r[col])));
        } else if (typeof fv === 'string' && fv){
          // Sprint 33 / BUG-EV-02: API era silenciosa quando recebia string.
          // Filters.set('regiao', 'SP') aceitava mas apply ignorava (só Array).
          // Agora trata string como filtro de igualdade — comportamento esperado
          // por integradores e scripts que não normalizam pra Array.
          out = out.filter(r => String(r[col]) === fv);
        } else if (group === 'numeric' && fv && (fv.min != null || fv.max != null)){
          out = out.filter(r => {
            const v = SolsticeStats.parseNum(r[col]); if (isNaN(v)) return false;
            if (fv.min != null && v < fv.min) return false;
            if (fv.max != null && v > fv.max) return false;
            return true;
          });
        } else if (group === 'temporal' && fv && (fv.from || fv.to)){
          const from = fv.from ? new Date(fv.from) : null;
          const to   = fv.to   ? new Date(fv.to)   : null;
          out = out.filter(r => {
            const d = SolsticeTypes.toDate(r[col]); if (!d || isNaN(d)) return false; // DATA-1978: parser pt-BR
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
          });
        }
      }

      // Cross-filter (B9): destaque temporário { column, value } — filtra também
      if (cross && cross.column && cross.value != null){
        if (cross.bin){
          // Auditoria 2026.6 (XFILTER-BIN): casa por período (mesma granularidade
          // do bin clicado) em vez de match exato da data crua.
          const _binKey = (d, bin) => {
            if (!d || isNaN(d)) return null;
            if (bin === 'month') return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
            if (bin === 'year')  return String(d.getFullYear());
            if (bin === 'week'){ const oj = new Date(d.getFullYear(),0,1); const wk = Math.ceil(((( d - oj)/86400000) + oj.getDay()+1)/7); return d.getFullYear()+'-W'+String(wk).padStart(2,'0'); }
            return d.toISOString().slice(0,10); // day
          };
          const target = String(cross.value);
          out = out.filter(r => _binKey(SolsticeTypes.toDate(r[cross.column]), cross.bin) === target);
        } else {
          out = out.filter(r => String(r[cross.column]) === String(cross.value));
        }
      }

      return out;
    }

    /**
     * Patch 1A (ADR-115): applyList — aplica lista de filtros locais (slot.config.localFilters).
     * Formato: [{ column, op: 'in'|'between'|'eq'|'neq', values: [...] }]
     */
    function applyList(rows, filterList){
      if (!Array.isArray(filterList) || !filterList.length) return rows;
      let out = rows || [];
      for (const f of filterList){
        if (!f || !f.column) continue;
        const op = f.op || 'in';
        const vals = f.values || [];
        if (op === 'in'){
          const set = new Set(vals.map(String));
          out = out.filter(r => set.has(String(r[f.column])));
        } else if (op === 'eq'){
          out = out.filter(r => String(r[f.column]) === String(vals[0]));
        } else if (op === 'neq'){
          out = out.filter(r => String(r[f.column]) !== String(vals[0]));
        } else if (op === 'between' && vals.length >= 2){
          const lo = parseFloat(vals[0]); const hi = parseFloat(vals[1]);
          out = out.filter(r => { const v = SolsticeStats.parseNum(r[f.column]); return !isNaN(v) && v >= lo && v <= hi; });
        }
      }
      return out;
    }

    /** Retorna rows ativos (ingest.rows filtrados). */
    function getActiveRows(){
      const ing = _ingest();
      return apply(ing.rows || []);
    }

    /** Sobrescreve filtro de uma coluna. Passe null para limpar. */
    function set(col, value){
      const f = SolsticeUtils.deepClone(_filters());
      if (value == null || (Array.isArray(value) && value.length === 0)){
        delete f[col];
      } else {
        f[col] = value;
      }
      SolsticeStore.set('filters', f);
    }

    function clear(){ SolsticeStore.set('filters', {}); SolsticeStore.set('crossfilter', null); }

    /**
     * Sprint 44: limpa filtros + smartDefaults + shown que apontam pra colunas
     * que não existem na base ativa. Retorna o número de itens descartados.
     * Idempotente — chamar várias vezes não faz mal.
     */
    function cleanStale(){
      const ingest = _ingest();
      const validCols = new Set((ingest.columns || []));
      let dropped = 0;
      const cur = _filters();
      const cleaned = {};
      Object.keys(cur).forEach(k => {
        if (validCols.has(k)){ cleaned[k] = cur[k]; }
        else { dropped++; }
      });
      if (dropped > 0) SolsticeStore.set('filters', cleaned);
      // Crossfilter
      const cross = SolsticeStore.get('crossfilter');
      if (cross && cross.column && !validCols.has(cross.column)){
        SolsticeStore.set('crossfilter', null);
        dropped++;
      }
      // smartDefaults / shown
      const sd = SolsticeStore.get('ui.filters.smartDefaults');
      if (Array.isArray(sd)){
        const sdc = sd.filter(s => s && validCols.has(s.column));
        if (sdc.length !== sd.length) SolsticeStore.set('ui.filters.smartDefaults', sdc);
      }
      const sh = SolsticeStore.get('ui.filters.shown');
      if (Array.isArray(sh)){
        const shc = sh.filter(c => validCols.has(c));
        if (shc.length !== sh.length) SolsticeStore.set('ui.filters.shown', shc);
      }
      return dropped;
    }

    function get(col){ return _filters()[col]; }

    /**
     * SOL-H3 v2 (Auditoria 2026.4) · Filtros padrão inteligentes.
     * Pré-seleciona até 3 colunas relevantes (1 data + 2 categóricas mais
     * preenchidas) SEM aplicar narrowing automático — só destaca o que
     * provavelmente o analista vai filtrar primeiro (data é onipresente em
     * relatórios; categoria mais preenchida = maior chance de ser relevante).
     */
    function applySmartDefaults(){
      const ing = _ingest();
      const rows = ing.rows || [];
      const cols = ing.columns || [];
      const types = ing.types || {};
      if (!rows.length || !cols.length){
        // BUG-01 v4 fix · NÃO usar 'filters.smartDefaults' — SolsticeFilters.apply()
        // itera todas as keys em filters.* como filtros ativos. Meu array de hints
        // sem from/to estava DESCARTANDO TODAS as linhas. Mover pra ui.filters.*.
        SolsticeStore.set('ui.filters.smartDefaults', []);
        return [];
      }
      const total = rows.length;
      const _fillRate = (col) => {
        let nn = 0;
        for (let i = 0; i < rows.length; i++){
          const v = rows[i][col];
          if (v != null && v !== '' && !(typeof v === 'number' && isNaN(v))) nn++;
        }
        return total ? nn / total : 0;
      };
      let bestDate = null;
      cols.forEach(c => {
        const g = SolsticeTypes.group((types[c] || {}).type);
        if (g !== 'temporal') return;
        const valid = rows.reduce((acc, r) => acc + (isNaN(new Date(r[c])) ? 0 : 1), 0);
        if (!bestDate || valid > bestDate.valid) bestDate = { column: c, kind: 'temporal', valid };
      });
      const catCandidates = [];
      cols.forEach(c => {
        const g = SolsticeTypes.group((types[c] || {}).type);
        if (g !== 'categorical') return;
        const d = SolsticeStats.distinctCount(rows.map(r => r[c]));
        if (d < 2 || d > 30) return;
        const fill = _fillRate(c);
        catCandidates.push({ column: c, kind: 'categorical', distinct: d, fill });
      });
      catCandidates.sort((a, b) => (b.fill - a.fill) || (a.distinct - b.distinct));
      const defaults = [];
      if (bestDate) defaults.push(bestDate);
      if (catCandidates[0]) defaults.push(catCandidates[0]);
      if (catCandidates[1] && defaults.length < 3) defaults.push(catCandidates[1]);
      SolsticeStore.set('ui.filters.smartDefaults', defaults);
      return defaults;
    }

    /**
     * Sugere colunas para filtrar (boas candidatas):
     * - categóricas com 2-30 distintos
     * - temporais com 30+ valores válidos
     * - numéricas com IQR > 0 (variância real)
     */
    function suggested(){
      const ing = _ingest();
      const rows = ing.rows || [];
      const cols = ing.columns || [];
      const types = ing.types || {};
      const out = [];
      cols.forEach(c => {
        const t = types[c] && types[c].type;
        const g = SolsticeTypes.group(t);
        if (g === 'categorical'){
          const d = SolsticeStats.distinctCount(rows.map(r => r[c]));
          if (d >= 2 && d <= 30) out.push({ column: c, kind: 'categorical', distinct: d });
        } else if (g === 'temporal'){
          const valid = rows.filter(r => !isNaN(new Date(r[c]))).length;
          if (valid >= 30) out.push({ column: c, kind: 'temporal', valid });
        } else if (g === 'numeric'){
          const vals = rows.map(r => SolsticeStats.parseNum(r[c])).filter(v => !isNaN(v));
          if (vals.length > 5){
            const iqr = SolsticeStats.iqr(vals);
            if (iqr != null && iqr > 0) out.push({ column: c, kind: 'numeric', n: vals.length });
          }
        }
      });
      return out;
    }

    /* ---------- UI: BARRA DE FILTROS ---------- */

    /** Cria um multi-select com busca para coluna categórica. */
    function _renderMultiSelect(col){
      const ing = _ingest();
      const dict = SolsticeStore.get('dictionary');
      const rows = ing.rows || [];
      const counts = new Map();
      for (const r of rows){
        const k = String(r[col] == null ? '' : r[col]);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      const all = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      const selected = _filters()[col] || [];

      const wrap = SolsticeUtils.el('div', { class:'solstice__filter' });
      const labelRow = SolsticeUtils.el('div', { class:'solstice__filter-label' });
      labelRow.appendChild(SolsticeUtils.el('span', null, SolsticeHumanize.column(col, dict)));
      const clearBtn = SolsticeUtils.el('span',
        { class:'solstice__filter-clear' + (selected.length ? '' : ' is-hidden'),
          onclick: (e) => { e.stopPropagation(); set(col, null); }
        }, '✕ limpar');
      labelRow.appendChild(clearBtn);
      wrap.appendChild(labelRow);

      const ms = SolsticeUtils.el('div', { class:'solstice__ms' });
      const trigger = SolsticeUtils.el('button', { class:'solstice__ms-trigger', type:'button' });
      function refreshTrigger(){
        trigger.innerHTML = '';
        const sel = _filters()[col] || [];
        if (!sel.length){
          trigger.appendChild(SolsticeUtils.el('span', { class:'solstice__ms-trigger-placeholder' },
            'Selecione…  (' + all.length + ')'));
        } else {
          sel.slice(0, 3).forEach(v => {
            trigger.appendChild(SolsticeUtils.el('span', { class:'solstice__ms-chip' }, v));
          });
          if (sel.length > 3){
            trigger.appendChild(SolsticeUtils.el('span', { class:'solstice__ms-chip-more' }, '+' + (sel.length - 3)));
          }
        }
      }
      refreshTrigger();
      ms.appendChild(trigger);

      // Camada 1 polish v6 fix: panel vive em document.body (portal) com position:fixed.
      // Antes vivia dentro de `ms` que era filho da filterbar — quando set() disparava
      // Canvas.render(), filterbar era apagada junto com o panel. Agora o panel sobrevive.
      let panel = null;
      // Auditoria 2026 (MC-01 / HV-02): closePanel agora usa cleanupListeners(panel)
      // em vez de chamar removeEventListener 3x. Listeners são adicionados via
      // trackListener(panel, ...) no abrir.
      function closePanel(){
        if (panel){
          SolsticeUtils.cleanupListeners(panel);
          panel.remove(); panel = null;
        }
      }
      function outside(e){
        if (panel && !panel.contains(e.target) && !trigger.contains(e.target)) closePanel();
      }
      function positionPanel(){
        if (!panel) return;
        const rect = trigger.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.top = (rect.bottom + 4) + 'px';
        panel.style.left = rect.left + 'px';
        panel.style.minWidth = Math.max(220, rect.width) + 'px';
        panel.style.maxHeight = (window.innerHeight - rect.bottom - 16) + 'px';
        panel.style.zIndex = '500';
      }
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panel){ closePanel(); return; }
        panel = SolsticeUtils.el('div', { class:'solstice__ms-panel solstice__ms-panel--portal' });
        const search = SolsticeUtils.el('input', {
          class:'solstice__ms-search', type:'text', placeholder:'Buscar…',
          oninput: (e) => { renderOptions(e.target.value); }
        });
        panel.appendChild(search);
        const listEl = SolsticeUtils.el('div', { style:'overflow-y:auto;flex:1;min-height:0;' });
        panel.appendChild(listEl);
        function renderOptions(q){
          listEl.innerHTML = '';
          const norm = (s) => String(s).toLowerCase();
          const term = norm(q || '');
          const filtered = all.filter(([k]) => !term || norm(k).includes(term));
          if (!filtered.length){
            listEl.appendChild(SolsticeUtils.el('div', { class:'solstice__ms-empty' }, 'Nenhum item encontrado.'));
            return;
          }
          filtered.forEach(([value, n]) => {
            const opt = SolsticeUtils.el('label', { class:'solstice__ms-option' });
            const cb = SolsticeUtils.el('input', {
              type:'checkbox',
              onchange: (e) => {
                const sel = (_filters()[col] || []).slice();
                if (e.target.checked){ if (!sel.includes(value)) sel.push(value); }
                else { const i = sel.indexOf(value); if (i >= 0) sel.splice(i, 1); }
                set(col, sel);
                // refreshTrigger e clearBtn vivem na filterbar antiga — se ela foi re-renderizada,
                // não importa: a próxima render usa o estado correto. Não tentar tocar nesses elementos.
              }
            });
            if ((_filters()[col] || []).includes(value)) cb.checked = true;
            opt.appendChild(cb);
            opt.appendChild(SolsticeUtils.el('span', null, value));
            opt.appendChild(SolsticeUtils.el('span', { class:'solstice__ms-option-count' }, String(n)));
            listEl.appendChild(opt);
          });
        }
        renderOptions('');
        document.body.appendChild(panel);
        positionPanel();
        // Auditoria 2026 (MC-01 / HV-02): trackListener com panel como host.
        // O setTimeout original evitava capturar o próprio click que abriu o trigger.
        setTimeout(() => SolsticeUtils.trackListener(panel, document, 'click', outside, true), 0);
        SolsticeUtils.trackListener(panel, window, 'resize', closePanel);
        SolsticeUtils.trackListener(panel, window, 'scroll', closePanel, true);
        search.focus();
      });
      wrap.appendChild(ms);
      return wrap;
    }

    /** Cria range slider duplo para coluna numérica. */
    function _renderRange(col){
      const ing = _ingest();
      const dict = SolsticeStore.get('dictionary');
      const rows = ing.rows || [];
      const vals = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
      if (!vals.length) return null;
      const [min, max] = SolsticeStats.minMax(vals); /* code review 2026: minMax safe */
      const f = _filters()[col] || { min, max };
      const curMin = f.min != null ? f.min : min;
      const curMax = f.max != null ? f.max : max;

      const wrap = SolsticeUtils.el('div', { class:'solstice__filter' });
      const labelRow = SolsticeUtils.el('div', { class:'solstice__filter-label' });
      labelRow.appendChild(SolsticeUtils.el('span', null, SolsticeHumanize.column(col, dict)));
      const hasFilter = f.min != null || f.max != null;
      const clearBtn = SolsticeUtils.el('span',
        { class:'solstice__filter-clear' + (hasFilter ? '' : ' is-hidden'),
          onclick: () => set(col, null)
        }, '✕ limpar');
      labelRow.appendChild(clearBtn);
      wrap.appendChild(labelRow);

      const range = SolsticeUtils.el('div', { class:'solstice__range' });
      const track = SolsticeUtils.el('div', { class:'solstice__range-track' });
      const fill  = SolsticeUtils.el('div', { class:'solstice__range-fill' });
      track.appendChild(fill);
      range.appendChild(track);
      const step = (max - min) > 100 ? Math.max(1, Math.round((max - min) / 100)) : (max - min) / 100;
      const inputLo = SolsticeUtils.el('input', { type:'range', class:'solstice__range-input',
        min: String(min), max: String(max), step: String(step), value: String(curMin) });
      const inputHi = SolsticeUtils.el('input', { type:'range', class:'solstice__range-input',
        min: String(min), max: String(max), step: String(step), value: String(curMax) });
      range.appendChild(inputLo); range.appendChild(inputHi);

      const valsRow = SolsticeUtils.el('div', { class:'solstice__range-values' });
      const numLo = SolsticeUtils.el('input', { type:'number', step: 'any', value: String(curMin) });
      const numHi = SolsticeUtils.el('input', { type:'number', step: 'any', value: String(curMax) });
      valsRow.appendChild(numLo); valsRow.appendChild(numHi);

      function updateFill(){
        const lo = parseFloat(inputLo.value), hi = parseFloat(inputHi.value);
        const a = ((lo - min) / (max - min || 1)) * 100;
        const b = ((hi - min) / (max - min || 1)) * 100;
        fill.style.left = a + '%';
        fill.style.width = Math.max(0, b - a) + '%';
      }
      function commit(){
        const lo = parseFloat(inputLo.value), hi = parseFloat(inputHi.value);
        const realLo = Math.min(lo, hi), realHi = Math.max(lo, hi);
        if (realLo === min && realHi === max){ set(col, null); clearBtn.classList.add('is-hidden'); }
        else { set(col, { min: realLo, max: realHi }); clearBtn.classList.remove('is-hidden'); }
      }
      inputLo.addEventListener('input', () => { numLo.value = inputLo.value; updateFill(); });
      inputHi.addEventListener('input', () => { numHi.value = inputHi.value; updateFill(); });
      inputLo.addEventListener('change', commit);
      inputHi.addEventListener('change', commit);
      numLo.addEventListener('change', () => { inputLo.value = numLo.value; updateFill(); commit(); });
      numHi.addEventListener('change', () => { inputHi.value = numHi.value; updateFill(); commit(); });

      updateFill();
      wrap.appendChild(range);
      wrap.appendChild(valsRow);
      return wrap;
    }

    /** Cria date picker com presets para coluna temporal. */
    function _renderDate(col){
      const ing = _ingest();
      const dict = SolsticeStore.get('dictionary');
      const rows = ing.rows || [];
      // Auditoria 2026.6 (DATA-1978): usa o parser pt-BR canônico (toDate) em vez
      // de new Date cru (que misparseia dd/mm e mapeia ano de 2 dígitos pra 19xx),
      // e calcula o range default por PERCENTIL (0,5%–99,5%) pra ignorar outliers
      // de parse — uma linha malformada não puxa mais o "de" pra 1978. O usuário
      // quer o min/max REAL da base, não o artefato.
      const _ts = rows.map(r => SolsticeTypes.toDate(r[col]))
        .map(d => d && d.getTime ? d.getTime() : NaN)
        .filter(t => !isNaN(t))
        .sort((a, b) => a - b);
      if (!_ts.length) return null;
      // Cerca de Tukey (3×IQR) pra ignorar datas-outlier de parse (ex: 1978 vindo
      // de 1 linha malformada). Em base toda em 2024 o IQR≈0 → o 1978 cai fora e
      // o range vira o real; em base espalhada (1990–2024) nada é cortado.
      const _q = (p) => _ts[Math.min(_ts.length - 1, Math.max(0, Math.round(p * (_ts.length - 1))))];
      const _iqr = _q(0.75) - _q(0.25);
      const _lo = _q(0.25) - 3 * _iqr, _hi = _q(0.75) + 3 * _iqr;
      const _trim = _ts.filter(t => t >= _lo && t <= _hi);
      const dMin = new Date(_trim.length ? _trim[0] : _ts[0]);
      const dMax = new Date(_trim.length ? _trim[_trim.length - 1] : _ts[_ts.length - 1]);
      const f = _filters()[col] || {};

      const wrap = SolsticeUtils.el('div', { class:'solstice__filter' });
      const labelRow = SolsticeUtils.el('div', { class:'solstice__filter-label' });
      labelRow.appendChild(SolsticeUtils.el('span', null, SolsticeHumanize.column(col, dict)));
      const hasFilter = !!(f.from || f.to);
      const clearBtn = SolsticeUtils.el('span',
        { class:'solstice__filter-clear' + (hasFilter ? '' : ' is-hidden'),
          onclick: () => set(col, null)
        }, '✕ limpar');
      labelRow.appendChild(clearBtn);
      wrap.appendChild(labelRow);

      const presets = SolsticeUtils.el('div', { class:'solstice__datefilter-presets' });
      function presetBtn(label, fn){
        return SolsticeUtils.el('span', {
          class:'solstice__datefilter-preset',
          onclick: () => {
            const [from, to] = fn();
            set(col, { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
          }
        }, label);
      }
      // Presets relativos ao MAX da série (não "hoje" — dados podem ser históricos)
      presets.appendChild(presetBtn('Últimos 7d', () => [new Date(dMax.getTime() - 6 * 86400000), dMax]));
      presets.appendChild(presetBtn('30d', () => [new Date(dMax.getTime() - 29 * 86400000), dMax]));
      presets.appendChild(presetBtn('3m', () => { const d = new Date(dMax); d.setMonth(d.getMonth() - 3); return [d, dMax]; }));
      presets.appendChild(presetBtn('12m', () => { const d = new Date(dMax); d.setFullYear(d.getFullYear() - 1); return [d, dMax]; }));
      presets.appendChild(presetBtn('Tudo', () => [dMin, dMax]));
      wrap.appendChild(presets);

      const rangeRow = SolsticeUtils.el('div', { class:'solstice__datefilter-range' });
      const inFrom = SolsticeUtils.el('input', { type:'date',
        value: f.from || dMin.toISOString().slice(0, 10),
        min: dMin.toISOString().slice(0, 10), max: dMax.toISOString().slice(0, 10),
        onchange: (e) => set(col, { from: e.target.value, to: inTo.value })
      });
      const inTo = SolsticeUtils.el('input', { type:'date',
        value: f.to || dMax.toISOString().slice(0, 10),
        min: dMin.toISOString().slice(0, 10), max: dMax.toISOString().slice(0, 10),
        onchange: (e) => set(col, { from: inFrom.value, to: e.target.value })
      });
      rangeRow.appendChild(inFrom);
      rangeRow.appendChild(SolsticeUtils.el('span', { style:'font-size:10px;color:var(--c-muted);' }, '→'));
      rangeRow.appendChild(inTo);
      wrap.appendChild(rangeRow);
      return wrap;
    }

    /** Resolve a lista de filtros a renderizar:
        - Se Store.ui.filters.shown existir e for array: usa essa lista personalizada do usuário.
        - Senão: usa suggested() (auto-detecção · top 8). */
    function _resolveShown(){
      const stored = SolsticeStore.get('ui.filters.shown');
      const sug = suggested();
      const byCol = new Map(sug.map(s => [s.column, s]));
      if (Array.isArray(stored)){
        const ing = _ingest();
        const types = ing.types || {};
        return stored.map(col => {
          if (byCol.has(col)) return byCol.get(col);
          const t = types[col] && types[col].type;
          const g = SolsticeTypes.group(t);
          if (g === 'categorical') return { column: col, kind: 'categorical' };
          if (g === 'numeric')     return { column: col, kind: 'numeric' };
          if (g === 'temporal')    return { column: col, kind: 'temporal' };
          return null;
        }).filter(Boolean);
      }
      // BUG-03 v3 / SOL-H3 v2: era sug.slice(0, 8) → 6-8 filtros despejados.
      // Agora: ≤3 (1 temporal + 2 categóricas mais preenchidas) via smartDefaults.
      // BUG-01 v4 fix: lê de 'ui.filters.smartDefaults' (FORA de 'filters.*')
      // pra não vazar como filtro ativo no SolsticeFilters.apply().
      const sd = SolsticeStore.get('ui.filters.smartDefaults');
      if (Array.isArray(sd) && sd.length){
        return sd.slice(0, 3).map(s => byCol.get(s.column) || s);
      }
      return sug.slice(0, 3);
    }

    /** Todas as colunas filtráveis (não só sugeridas) — pra menu "+ Adicionar". */
    function _allFilterable(){
      const ing = _ingest();
      const cols = ing.columns || [];
      const types = ing.types || {};
      const out = [];
      cols.forEach(c => {
        const t = types[c] && types[c].type;
        const g = SolsticeTypes.group(t);
        if (g === 'categorical' || g === 'numeric' || g === 'temporal'){
          out.push({ column: c, kind: g });
        }
      });
      return out;
    }

    function _addColumnToBar(col){
      const shown = _resolveShown().map(s => s.column);
      if (shown.includes(col)) return;
      SolsticeStore.set('ui.filters.shown', [...shown, col]);
    }
    function _removeColumnFromBar(col){
      const shown = _resolveShown().map(s => s.column);
      const next = shown.filter(c => c !== col);
      SolsticeStore.set('ui.filters.shown', next);
      set(col, null); // limpa valor ativo dessa coluna
    }

    /** Renderiza barra de filtros no topo do canvas. */
    function renderInto(parentEl){
      if (!parentEl) return;
      const ing = _ingest();
      if (!ing.rows || !ing.rows.length) return;
      const shown = _resolveShown();
      const allAvail = _allFilterable();
      if (!allAvail.length) return; // sem colunas filtráveis no dataset

      // S4-06 (Sprint 4 / Yuki Notion · YT-01): filtros começam COLAPSADOS por padrão
      // se nunca configurado. Antes ocupavam barra inteira ao boot, criando ruído visual.
      // Usuário expande quando precisa; estado persiste em ui.filters.collapsed.
      const storedCollapsed = SolsticeStore.get('ui.filters.collapsed');
      const isCollapsed = storedCollapsed === undefined || storedCollapsed === null
        ? true // default: colapsado
        : !!storedCollapsed;
      const wrap = SolsticeUtils.el('div', {
        class: 'solstice__filterbar' + (isCollapsed ? ' is-collapsed' : '')
      });
      const head = SolsticeUtils.el('div', {
        class:'solstice__filterbar-head',
        onclick: () => {
          wrap.classList.toggle('is-collapsed');
          SolsticeStore.set('ui.filters.collapsed', wrap.classList.contains('is-collapsed'));
        }
      });
      const titleEl = SolsticeUtils.el('div', { class:'solstice__filterbar-title' });
      titleEl.appendChild(SolsticeUtils.el('span', { 'aria-hidden':'true' }, '🔍'));
      titleEl.appendChild(SolsticeUtils.el('span', null, 'Filtros'));
      const n = activeCount();
      titleEl.appendChild(SolsticeUtils.el('span', { class:'solstice__filterbar-count' + (n ? ' has-active' : '') },
        n ? n + ' ativos' : (shown.length ? shown.length + ' configurados' : 'nenhum')));
      head.appendChild(titleEl);
      const acts = SolsticeUtils.el('div', { class:'solstice__filterbar-actions' });

      // + Adicionar filtro — abre Modal.select com todas colunas filtráveis ainda não na barra
      const addBtn = SolsticeUtils.el('button', {
        class:'solstice__btn solstice__btn--ghost',
        style:'font-size:10px;padding:2px 8px;height:24px;',
        title:'Adicionar coluna como filtro',
        'aria-label':'Adicionar coluna como filtro',
        onclick: async (e) => {
          e.stopPropagation();
          const dict = SolsticeStore.get('dictionary');
          const shownCols = shown.map(s => s.column);
          const options = allAvail
            .filter(a => !shownCols.includes(a.column))
            .map(a => ({
              value: a.column,
              icon: a.kind === 'numeric' ? '🔢' : a.kind === 'temporal' ? '📅' : '🏷️',
              label: SolsticeHumanize.column(a.column, dict),
              desc: a.kind === 'numeric' ? 'Numérico · range'
                  : a.kind === 'temporal' ? 'Temporal · datas'
                  : 'Categórico · multi-select'
            }));
          if (!options.length){
            SolsticeToast.info('Sem colunas pra adicionar', 'Todas as colunas filtráveis já estão na barra.');
            return;
          }
          const chosen = await SolsticeModal.select({
            title: '+ Adicionar filtro',
            message: 'Escolha a coluna que será filtrável:',
            options,
            searchable: true,
            confirmLabel: 'Adicionar',
            cancelLabel: 'Cancelar'
          });
          if (chosen) _addColumnToBar(chosen);
        }
      }, '+ Adicionar');
      acts.appendChild(addBtn);

      if (n){
        acts.appendChild(SolsticeUtils.el('button', {
          class:'solstice__btn solstice__btn--ghost',
          style:'font-size:10px;padding:2px 8px;height:24px;',
          title:'Limpar valores de todos os filtros (mantém a barra configurada)',
          onclick: (e) => { e.stopPropagation(); clear(); }
        }, '✕ Limpar valores'));
      }
      acts.appendChild(SolsticeUtils.el('span', { class:'solstice__filterbar-toggle' }, '▼'));
      head.appendChild(acts);
      wrap.appendChild(head);

      const body = SolsticeUtils.el('div', { class:'solstice__filterbar-body' });
      if (!shown.length){
        body.appendChild(SolsticeUtils.el('div',
          { class:'solstice__filterbar-empty' },
          'Nenhum filtro configurado. Clique em "+ Adicionar" para escolher uma coluna.'));
      } else {
        shown.forEach(s => {
          let ctrl = null;
          if (s.kind === 'categorical') ctrl = _renderMultiSelect(s.column);
          else if (s.kind === 'numeric') ctrl = _renderRange(s.column);
          else if (s.kind === 'temporal') ctrl = _renderDate(s.column);
          if (!ctrl) return;
          // Wrap com botão × para remover este filtro DA BARRA
          const filterWrap = SolsticeUtils.el('div', { class:'solstice__filter-wrap' });
          const removeBtn = SolsticeUtils.el('button', {
            class:'solstice__filter-remove',
            type:'button',
            title:'Remover este filtro da barra',
            'aria-label':'Remover filtro ' + s.column + ' da barra',
            onclick: (e) => { e.stopPropagation(); _removeColumnFromBar(s.column); }
          }, '×');
          filterWrap.appendChild(removeBtn);
          filterWrap.appendChild(ctrl);
          body.appendChild(filterWrap);
        });
      }
      wrap.appendChild(body);
      parentEl.appendChild(wrap);
    }

    function init(){
      // Re-render canvas quando filtros mudam (componentes pegam novos rows)
      SolsticeStore.subscribe('filters', () => SolsticeCanvas && SolsticeCanvas.render && SolsticeCanvas.render());
      SolsticeStore.subscribe('crossfilter', () => SolsticeCanvas && SolsticeCanvas.render && SolsticeCanvas.render());
      // Polish v8a-fix2: BUG FIX — adicionar/remover filtro mudava ui.filters.shown
      // no Store mas a barra não re-renderizava. Auditoria 2026.4: filtros novos
      // no global, ele não reajusta e não aumenta e não faz nada. fica estático
      // muito feio."
      SolsticeStore.subscribe('ui.filters.shown', () => {
        if (SolsticeCanvas && SolsticeCanvas.render) SolsticeCanvas.render();
      });

      // B2-03 (v6-autonomous / PW-02 — Augusto power user): persiste filtros
      // entre sessões em localStorage. Sai dali um analista que vive 5h/dia
      // no produto e não precisa reconfigurar tudo toda manhã.
      // Key vinculada ao sourceName do dataset (cada dataset tem seus filtros).
      const STORAGE_PREFIX = 'solstice.filters.';

      function _storageKey(){
        const ingest = SolsticeStore.get('ingest') || {};
        return STORAGE_PREFIX + (ingest.sourceName || '_default_');
      }

      function _persist(){
        try {
          const f = SolsticeStore.get('filters');
          if (!f || !Object.keys(f).length){
            // limpa se ficou vazio (não polui localStorage)
            if (typeof SolsticeStorage !== 'undefined' && SolsticeStorage.safeRemove){
              SolsticeStorage.safeRemove(_storageKey());
            }
            return;
          }
          if (typeof SolsticeStorage !== 'undefined' && SolsticeStorage.safeSet){
            SolsticeStorage.safeSet(_storageKey(), JSON.stringify(f), { silent: true });
          }
        } catch(_){}
      }

      function _restore(){
        try {
          const raw = (typeof SolsticeStorage !== 'undefined' && SolsticeStorage.safeGet)
            ? SolsticeStorage.safeGet(_storageKey())
            : localStorage.getItem(_storageKey());
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object'){
            // Só restaura se NÃO há filtro ativo (não sobrescreve estado vindo de snapshot)
            const cur = SolsticeStore.get('filters');
            if (!cur || !Object.keys(cur).length){
              // Sprint 44 / fix UX: ao restaurar filtros do localStorage, DESCARTA
              // os que referenciam colunas que não existem na base atual. Antes:
              // se localStorage tinha filtro stale de uma base anterior, o restore
              // re-injetava → KPI/Série Temporal mostravam "Sem dataset" mesmo
              // com base nova válida. Causa raiz do bug reportado no screenshot.
              const ingest = _ingest();
              const validCols = new Set((ingest.columns || []));
              const cleaned = {};
              let dropped = 0;
              Object.keys(parsed).forEach(k => {
                if (validCols.has(k)){ cleaned[k] = parsed[k]; }
                else { dropped++; }
              });
              if (dropped > 0 && SolsticeLog && SolsticeLog.debug){
                SolsticeLog.debug('[Filters._restore] ' + dropped + ' filtro(s) órfão(s) descartado(s) do localStorage');
              }
              SolsticeStore.set('filters', cleaned);
            }
          }
        } catch(_){}
      }

      // Persiste em mudanças (debounced — evita spammar localStorage)
      let _persistTimer = null;
      SolsticeStore.subscribe('filters', () => {
        clearTimeout(_persistTimer);
        _persistTimer = setTimeout(_persist, 500);
      });

      // Restaura quando dataset estiver pronto
      SolsticeStore.subscribe('dataset.ready', (ready) => { if (ready) _restore(); });
      // E imediatamente se já estiver pronto (re-init pós-load)
      if (SolsticeStore.get('dataset.ready')) _restore();

      // Sprint 44: subscriber universal — sempre que columns muda (qualquer
      // caminho: import, snapshot restore, multi-dataset switch, edit colunas),
      // limpa filtros órfãos automaticamente. Defesa em profundidade: mesmo
      // que algum caminho de set('ingest') esqueça de limpar, este cobre.
      let _lastColsSig = null;
      SolsticeStore.subscribe('ingest', () => {
        try {
          const cols = ((_ingest().columns) || []).slice().sort().join(',');
          if (cols !== _lastColsSig){
            _lastColsSig = cols;
            cleanStale();
          }
        } catch(_){}
      });
    }

    // Auditoria 2026 (RT-03): adapter pra cumprir SolsticeStoreContract.
    function subscribe(path, cb){
      const full = path ? 'filters.' + path : 'filters';
      return SolsticeStore.subscribe(full, cb);
    }
    return { apply, applyList, getActiveRows, set, get, subscribe, clear, cleanStale, activeCount, suggested, applySmartDefaults, renderInto, init };
  })();
