
  /* ============================================================
     BLOCO 11 — SolsticeVersions (ADR-080)
     Histórico AUTOMÁTICO. Cada mudança em canvas.sections cria entrada
     no ring buffer (cap 10). NÃO persiste em localStorage — sessão-only.
     Diferente de Snapshots (manuais + nominados + persistidos).
     ============================================================ */
  const SolsticeVersions = (function(){
    const MAX = 10;
    const history = []; // array de { ts, snapshot: stringified canvas.sections }
    let suppress = false;

    function _capture(){
      if (suppress) return;
      const json = JSON.stringify(SolsticeStore.get('canvas.sections') || []);
      // Não duplica entradas idênticas seguidas
      if (history.length && history[0].snapshot === json) return;
      history.unshift({ ts: Date.now(), snapshot: json });
      while (history.length > MAX) history.pop();
    }

    function list(){
      return history.map((h, i) => ({ index: i, ts: h.ts }));
    }

    function restore(index){
      const entry = history[index];
      if (!entry) return false;
      try {
        const sections = JSON.parse(entry.snapshot);
        suppress = true;
        SolsticeStore.set('canvas.sections', sections);
        setTimeout(() => { suppress = false; }, 0);
        SolsticeAudit.record({ action:'version_restore', details:{ index, ts: entry.ts } });
        return true;
      } catch(e){ console.error('[Versions restore]', e); return false; }
    }

    async function openModal(){
      await SolsticeModal.show({
        title: '🕐 Histórico de versões — esta sessão',
        body: () => {
          const wrap = SolsticeUtils.el('div');
          wrap.appendChild(SolsticeUtils.el('p',
            { style:'color:var(--c-muted);font-size:var(--fs-xs);margin-bottom:var(--sp-3);line-height:1.5;' },
            'Histórico automático em memória (não persiste entre sessões). Cap ' + MAX + ' versões. ' +
            'Use Snapshots (📂) para persistência. Restaurar substitui canvas atual (Undo continua disponível).'));
          if (!history.length){
            wrap.appendChild(SolsticeUtils.el('div', { class:'solstice__snap-empty' },
              'Sem versões ainda. O histórico começa após a primeira mudança em sections.'));
            return wrap;
          }
          const list = SolsticeUtils.el('div', { class:'solstice__snaps-list' });
          history.forEach((h, i) => {
            const item = SolsticeUtils.el('div', { class:'solstice__snap-item' });
            item.appendChild(SolsticeUtils.el('div', { class:'solstice__snap-thumb' }, i === 0 ? '🟢' : '🕐'));
            const body = SolsticeUtils.el('div', { class:'solstice__snap-body' });
            body.appendChild(SolsticeUtils.el('div', { class:'solstice__snap-name' },
              i === 0 ? 'Versão atual' : 'Versão #' + (history.length - i)));
            body.appendChild(SolsticeUtils.el('div', { class:'solstice__snap-meta' },
              new Date(h.ts).toLocaleTimeString('pt-BR') + ' · ' + Math.round(h.snapshot.length / 1024) + ' KB'));
            item.appendChild(body);
            const acts = SolsticeUtils.el('div', { class:'solstice__snap-actions' });
            if (i > 0){
              acts.appendChild(SolsticeUtils.el('button', { title:'Restaurar', onclick: () => {
                restore(i); SolsticeToast.success('Versão restaurada', '#' + (history.length - i));
              }}, '↶'));
            }
            item.appendChild(acts);
            list.appendChild(item);
          });
          wrap.appendChild(list);
          return wrap;
        },
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Fechar')
        ]
      });
    }

    function init(){
      // captura inicial
      _capture();
      SolsticeStore.subscribe('canvas.sections', () => _capture());
    }

    return { list, restore, openModal, init, _capture };
  })();
