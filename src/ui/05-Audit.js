
  /* ============================================================
     SolsticeFreeMode — REMOVIDO no Patch 1A (ADR-089).
     Resize horizontal entre slots já cobre o caso real de layouts
     irregulares. Migração de snapshots antigos: `row.mode === 'free'`
     vira `'grid'` em SolsticeMigrations.
     ============================================================ */

  /* ============================================================
     BLOCO 5 — AUDITORIA / COMPONENTES / PAINEL DE PROPRIEDADES
     ============================================================ */

  /* ============================================================
     SolsticeAudit — Diferencial #1: log auditável de decisões.
     Cada componente registra suas decisões via Audit.log().
     Modal global mostra timeline filtrável; export para markdown.
     ============================================================ */
  const SolsticeAudit = (function(){
    const MAX = 500;
    const log = [];          // [{ ts, action, target, details, componentId }, ...]
    const subs = new Set();

    function record(entry){
      entry.ts = entry.ts || new Date().toISOString();
      log.push(entry);
      if (log.length > MAX) log.shift();
      // Auditoria 2026.4 (MC-09 / HV-03): erros em subscribers de Audit logam
      // via SolsticeLog em vez de silenciar. Mesmo padrão MC-04 do MultiTab —
      // catch vazio em loop de callbacks invisibilizava bugs reais.
      subs.forEach(cb => {
        try { cb(entry); }
        catch(e){ SolsticeLog.warn('[SolsticeAudit] subscriber error · action=' + (entry && entry.action), e); }
      });
    }

    function clear(){
      log.length = 0;
      subs.forEach(cb => {
        try { cb(null); }
        catch(e){ SolsticeLog.warn('[SolsticeAudit] subscriber error · clear', e); }
      });
    }
    function list(filter){
      if (!filter) return log.slice();
      return log.filter(e => {
        if (filter.componentId && e.componentId !== filter.componentId) return false;
        if (filter.action && e.action !== filter.action) return false;
        return true;
      });
    }
    function subscribe(cb){ subs.add(cb); return () => subs.delete(cb); }

    function toMarkdown(filter){
      const lines = ['# Auditoria de Decisões — Solstice', '', '> Exportado em ' + new Date().toLocaleString('pt-BR'), ''];
      const entries = list(filter);
      if (!entries.length){ lines.push('_Nenhuma decisão registrada._'); }
      entries.forEach(e => {
        lines.push('## ' + e.action);
        lines.push('- **Quando:** `' + e.ts + '`');
        if (e.componentId) lines.push('- **Componente:** `' + e.componentId + '`');
        if (e.target) lines.push('- **Alvo:** `' + e.target + '`');
        if (e.details){
          lines.push('- **Detalhes:**');
          lines.push('  ```json');
          lines.push('  ' + JSON.stringify(e.details, null, 2).replace(/\n/g, '\n  '));
          lines.push('  ```');
        }
        lines.push('');
      });
      return lines.join('\n');
    }

    function exportMd(filter){
      const md = toMarkdown(filter);
      const blob = new Blob([md], { type:'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'solstice-audit-' + Date.now() + '.md';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 250);
    }

    /* RC-04 (Sprint 2): exports adicionais — CSV e JSON.
       Pesquisa científica e LGPD/audit exigem formatos parseáveis. */
    function _escapeCsv(v){
      if (v == null) return '';
      const s = String(v);
      if (s.indexOf(',') < 0 && s.indexOf('"') < 0 && s.indexOf('\n') < 0 && s.indexOf('\r') < 0) return s;
      return '"' + s.replace(/"/g, '""') + '"';
    }
    function toCSV(filter){
      const entries = list(filter);
      const header = ['ts','action','componentId','target','details'].map(_escapeCsv).join(',');
      const rows = entries.map(e => [
        e.ts,
        e.action,
        e.componentId || '',
        e.target || '',
        e.details ? (typeof e.details === 'string' ? e.details : JSON.stringify(e.details)) : ''
      ].map(_escapeCsv).join(','));
      return [header].concat(rows).join('\r\n');
    }
    function toJSON(filter){
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        source: 'solstice-audit',
        version: 1,
        filter: filter || {},
        entries: list(filter)
      }, null, 2);
    }
    function _download(blob, name){
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 250);
    }
    function exportCsv(filter){
      _download(new Blob([toCSV(filter)], { type:'text/csv;charset=utf-8' }),
        'solstice-audit-' + Date.now() + '.csv');
    }
    function exportJson(filter){
      _download(new Blob([toJSON(filter)], { type:'application/json' }),
        'solstice-audit-' + Date.now() + '.json');
    }

    async function openModal(filter){
      let activeFilter = filter || {};

      function _entryEl(e){
        const card = SolsticeUtils.el('div', { class:'solstice__audit-entry' });
        const head = SolsticeUtils.el('div', { class:'solstice__audit-entry-head' });
        head.appendChild(SolsticeUtils.el('div', { class:'solstice__audit-entry-action' }, e.action));
        head.appendChild(SolsticeUtils.el('div', { class:'solstice__audit-entry-meta' },
          new Date(e.ts).toLocaleTimeString('pt-BR') + (e.componentId ? ' · ' + e.componentId.slice(0,6) : '')
        ));
        card.appendChild(head);
        if (e.target){
          const tgt = SolsticeUtils.el('div', { class:'solstice__audit-entry-target' });
          tgt.appendChild(document.createTextNode('alvo: '));
          tgt.appendChild(SolsticeUtils.el('code', null, e.target));
          card.appendChild(tgt);
        }
        if (e.details){
          card.appendChild(SolsticeUtils.el('div', { class:'solstice__audit-entry-details' },
            typeof e.details === 'string' ? e.details : JSON.stringify(e.details, null, 2)));
        }
        return card;
      }

      function _build(close){
        const body = SolsticeUtils.el('div');
        const filterRow = SolsticeUtils.el('div', { class:'solstice__audit-filter' });
        filterRow.appendChild(SolsticeUtils.el('button',
          { class:'solstice__btn', onclick: () => { activeFilter = {}; close('refresh'); openModal(); } },
          'Todas decisões'));
        filterRow.appendChild(SolsticeUtils.el('button',
          { class:'solstice__btn', onclick: () => exportMd(activeFilter), title:'Formato legível humano' },
          '📥 Markdown'));
        // RC-04 (Sprint 2): formatos parseáveis para auditoria/LGPD/compliance
        filterRow.appendChild(SolsticeUtils.el('button',
          { class:'solstice__btn', onclick: () => exportCsv(activeFilter), title:'Abrir em Excel/planilha' },
          '📥 CSV'));
        filterRow.appendChild(SolsticeUtils.el('button',
          { class:'solstice__btn', onclick: () => exportJson(activeFilter), title:'Para integração com outros sistemas' },
          '📥 JSON'));
        body.appendChild(filterRow);

        const list = SolsticeUtils.el('div', { class:'solstice__audit-list' });
        const entries = SolsticeAudit.list(activeFilter);
        if (!entries.length){
          list.appendChild(SolsticeUtils.el('div', { class:'solstice__audit-empty' },
            '🔍 Nenhuma decisão registrada' + (activeFilter.componentId ? ' para este componente.' : ' ainda. Crie ou edite um componente para começar.')));
        } else {
          entries.slice().reverse().forEach(e => list.appendChild(_entryEl(e)));
        }
        body.appendChild(list);
        return body;
      }

      return SolsticeModal.show({
        title: '🔍 Auditoria de Decisões' + (activeFilter.componentId ? ' — ' + activeFilter.componentId.slice(0,6) : ''),
        size: 'lg',
        body: _build,
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Fechar')
        ]
      });
    }

    function openProvenance(componentId){
      const sec = SolsticeStore.get('canvas.sections') || [];
      // localiza slot pelo id em sec.rows.slots
      let slot, secMeta, rowMeta;
      for (const s of sec) for (const r of s.rows){
        const sl = r.slots.find(x => x.id === componentId);
        if (sl){ slot = sl; secMeta = s; rowMeta = r; break; }
      }
      if (!slot) return;
      const ingest = SolsticeStore.get('ingest');
      const dict = SolsticeStore.get('dictionary');
      const colCfg = slot.config && slot.config.column;
      const aggCfg = slot.config && slot.config.agg;

      const friendlyName = (dict && dict.columns && dict.columns[colCfg] && dict.columns[colCfg].friendlyName) || colCfg || '—';
      const rows = ingest ? ingest.rows : [];
      const filteredRows = rows.length;
      const values = colCfg ? rows.map(r => SolsticeStats.parseNum(r[colCfg])).filter(v => !isNaN(v)) : [];

      let result = '—';
      if (colCfg && aggCfg && values.length){
        if (aggCfg === 'sum')      result = SolsticeLocale.decimal(values.reduce((a,b)=>a+b,0), 2);
        else if (aggCfg === 'avg') result = SolsticeLocale.decimal(values.reduce((a,b)=>a+b,0)/values.length, 2);
        else if (aggCfg === 'min') result = SolsticeLocale.decimal(SolsticeStats.min(values), 2);
        else if (aggCfg === 'max') result = SolsticeLocale.decimal(SolsticeStats.max(values), 2);
        else if (aggCfg === 'count') result = SolsticeLocale.integer(values.length);
      }

      const body = SolsticeUtils.el('div', { class:'solstice__prov-chain' });
      function step(label, value){
        const el = SolsticeUtils.el('div', { class:'solstice__prov-step' });
        el.appendChild(SolsticeUtils.el('div', { class:'solstice__prov-step-label' }, label));
        el.appendChild(SolsticeUtils.el('div', { class:'solstice__prov-step-value' }, value));
        return el;
      }
      const arrow = () => SolsticeUtils.el('div', { class:'solstice__prov-step-arrow' }, '↓');

      body.appendChild(step('📄 Dataset', (ingest && ingest.sourceName) || 'sem dataset · ' + rows.length + ' linhas'));
      body.appendChild(arrow());
      body.appendChild(step('🎯 Coluna escolhida', colCfg ? colCfg + ' (' + friendlyName + ')' : '— sem coluna escolhida'));
      body.appendChild(arrow());
      // Auditoria 2026 (L-T-4 / A-104): Bloco 9 (Filtros Globais) já existe
      // em SolsticeFilters. Mensagem atualizada para refletir o presente.
      body.appendChild(step('🔍 Filtros aplicados', 'nenhum — use a barra de Filtros (canvas) para aplicar'));
      body.appendChild(arrow());
      body.appendChild(step('🧮 Agregação', aggCfg ? aggCfg.toUpperCase() + ' sobre ' + values.length + ' valores válidos' : '— sem agregação'));
      body.appendChild(arrow());
      body.appendChild(step('📊 Resultado', result));

      SolsticeModal.show({
        title: '🔬 De onde vem esse número?',
        size: 'lg',
        body,
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn', onclick: () => { close(null); openModal({ componentId }); } }, 'Ver decisões deste componente'),
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Fechar')
        ]
      });
    }

    return { record, log, list, subscribe, clear, toMarkdown, toCSV, toJSON, exportMd, exportCsv, exportJson, openModal, openProvenance };
  })();
