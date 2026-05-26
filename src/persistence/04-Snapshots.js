
  const SolsticeSnapshots = (function(){

    const LS_KEY_PREFIX = 'solstice.snapshots.';

    function _profileId(){
      const p = SolsticeProfiles.current();
      return p ? p.id : 'default';
    }
    function _storageKey(){ return LS_KEY_PREFIX + _profileId(); }

    function _safeWrite(key, value){
      // Auditoria 2026 (AP-02): mantém SolsticeErrors.show (modal específico
      // para quota cheia no contexto de snapshots) em vez de SolsticeStorage
      // (toast genérico). Modal é mais apropriado aqui porque snapshot é uma
      // ação explícita do usuário — ele clicou em "Salvar" e merece resposta forte.
      try { localStorage.setItem(key, value); return true; }
      catch (e){
        SolsticeErrors.show('STORAGE_QUOTA_EXCEEDED', {}, { detail: String(e) });
        return false;
      }
    }
    function _safeRead(key){
      try { return localStorage.getItem(key); } catch(e){ return null; }
    }

    /** Lista snapshots do perfil atual. Retorna array<{id, name, savedAt, size}>.
     *  Auditoria 2026 (B-05 / A-1003): se o JSON está corrompido, NÃO retorna
     *  []. Devolve uma entrada `{corrupted:true}` para a UI mostrar ⚠ em vez
     *  de fazer o snapshot sumir silenciosamente. Use getCorruptionStatus()
     *  no boot para um toast educativo. */
    function list(){
      const raw = _safeRead(_storageKey());
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        return [_corruptedEntry(raw, new Error('formato esperado: array'))];
      } catch(e){
        return [_corruptedEntry(raw, e)];
      }
    }

    function _corruptedEntry(raw, err){
      return {
        id: 'corrupted-' + (raw ? String(raw.length) : '0'),
        name: '⚠ Snapshot corrompido — recuperação manual',
        savedAt: new Date().toISOString(),
        corrupted: true,
        rawSample: (raw || '').slice(0, 2000),
        error: err ? String(err && err.message || err) : null,
        size: (raw || '').length,
        rowsCount: 0
      };
    }

    /** Para o boot dispar toast caso o localStorage do perfil esteja corrompido.
     *  Retorna { hasCorruption, kind, error } sem efeitos colaterais. */
    function getCorruptionStatus(){
      const raw = _safeRead(_storageKey());
      if (!raw) return { hasCorruption: false };
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return { hasCorruption: true, kind:'not-array' };
        return { hasCorruption: false, count: parsed.length };
      } catch(e){
        return { hasCorruption: true, kind:'parse-error', error: String(e && e.message || e) };
      }
    }

    /** Captura estado atual (puro, sem comprimir ainda). */
    function _captureState(){
      return {
        canvas: { sections: SolsticeStore.get('canvas.sections') || [], header: SolsticeStore.get('canvas.header') || {} },
        filters: SolsticeStore.get('filters') || {},
        params: SolsticeStore.get('params') || {},
        dictionary: SolsticeStore.get('dictionary') || null,
        ingest: (function(){
          const i = SolsticeStore.get('ingest');
          if (!i) return null;
          // Salva metadata + linhas para reidratação
          return {
            sourceName: i.sourceName,
            columns: i.columns,
            types: i.types,
            rows: i.rows  // pode ser grande — LZ-String comprime
          };
        })()
      };
    }

    // Auditoria 2026 (M-L-2 / A-802): flag de sessão para o toast educativo
    // sobre transparência (snapshots em localStorage, sem encriptação) só
    // disparar uma vez por sessão. Reseta ao fechar a aba.
    let _firstSnapshotToastShown = false;

    /** Salva snapshot com `name` opcional. Retorna o objeto criado ou null. */
    function save(name){
      const state = _captureState();
      const json = JSON.stringify(state);
      const compressed = SolsticeLZ.compressToBase64(json);
      const id = SolsticeUtils.uuid();
      const entry = {
        id, name: name || 'Snapshot ' + new Date().toLocaleString('pt-BR'),
        savedAt: new Date().toISOString(),
        size: compressed.length,
        rowsCount: (state.ingest && state.ingest.rows) ? state.ingest.rows.length : 0,
        data: compressed
      };
      const all = list();
      all.unshift(entry);
      // Limita a 30 snapshots por perfil (cap)
      while (all.length > 30) all.pop();
      const ok = _safeWrite(_storageKey(), JSON.stringify(all));
      if (!ok) return null;
      SolsticeAudit.record({ action:'snapshot_save', details: { id, name: entry.name, size: entry.size } });
      // Patch Corretivo (BUG C): notifica para que o painel atualize automaticamente
      SolsticeUtils.fire('snapshots:changed', { kind:'save', id });
      // Auditoria 2026 (M-L-2 / A-802): primeiro snapshot da sessão dispara
      // toast educativo. Tom: informativo, sem alarme, mas honesto.
      if (!_firstSnapshotToastShown){
        _firstSnapshotToastShown = true;
        SolsticeToast.show({
          title: '📌 Snapshot salvo no navegador',
          msg: 'Fica no localStorage deste perfil, não encriptado. Em PC compartilhado, prefira limpar ao sair (Settings → Snapshots).',
          kind: 'info',
          duration: 7000
        });
      }
      return entry;
    }

    /** Carrega snapshot por id. Aplica em Store. */
    function load(id){
      const all = list();
      const entry = all.find(e => e.id === id);
      if (!entry){ SolsticeToast.error('Snapshot não encontrado', id); return false; }
      try {
        const raw = SolsticeLZ.decompressFromBase64(entry.data);
        let state = JSON.parse(raw);
        // Patch 1A (ADR-116): aplica migrations antes de hidratar
        if (typeof SolsticeMigrations !== 'undefined'){
          try { state = SolsticeMigrations.applyAll(state); }
          catch(err){ SolsticeLog.warn('[Snapshot.load] migrations falhou', err); }
        }
        // ADR-166 (Onda 3 / T5): REBIND RESILIENTE.
        // Antes: se o CSV semana seguinte mudou nome de coluna, slots
        // quebravam silenciosamente. Briefing v5.4 (personas P6 Eduardo,
        // P8 Paulo): "snapshots resilientes". Agora: walk slots, tenta
        // resolver via dicionário (friendlyName → synonyms), marca rebind
        // necessário onde não acha.
        const rebindReport = _rebindSnapshotSlots(state);
        SolsticeStore.batch(() => {
          SolsticeStore.set('canvas.sections', state.canvas && state.canvas.sections || []);
          SolsticeStore.set('canvas.header', state.canvas && state.canvas.header || {});
          SolsticeStore.set('filters', state.filters || {});
          SolsticeStore.set('params', state.params || {});
          SolsticeStore.set('dictionary', state.dictionary || null);
          if (state.ingest){
            SolsticeStore.set('ingest', state.ingest);
            SolsticeStore.set('dataset.ready', true);
            SolsticeStore.set('dataset.name', state.ingest.sourceName || 'snapshot');
            SolsticeStore.set('dataset.source', 'snapshot');
            SolsticeStore.set('dataset.rows', state.ingest.rows);
            SolsticeStore.set('dataset.columns', state.ingest.columns);
          }
        });
        // Força re-render
        if (SolsticeCanvas && SolsticeCanvas.render) SolsticeCanvas.render();
        SolsticeAudit.record({
          action:'snapshot_load',
          details:{ id, name: entry.name, rebinds: rebindReport.remapped, unbound: rebindReport.unbound }
        });
        // Mensagem diferenciada por resultado do rebind
        if (rebindReport.unbound > 0){
          SolsticeToast.warn(
            'Snapshot carregado · ' + rebindReport.unbound + ' coluna(s) sem match',
            'Configure manualmente os componentes marcados em ⚙️ — colunas do CSV antigo não foram encontradas no atual.'
          );
        } else if (rebindReport.remapped > 0){
          SolsticeToast.success(
            'Snapshot carregado · ' + rebindReport.remapped + ' coluna(s) re-mapeada(s)',
            entry.name + ' (nomes mudaram entre versões, mas o dicionário resolveu)'
          );
        } else {
          SolsticeToast.success('Snapshot carregado', entry.name);
        }
        return true;
      } catch(e){
        SolsticeToast.error('Falha ao carregar snapshot', String(e));
        console.error('[Snapshot load]', e);
        return false;
      }
    }

    /**
     * ADR-166 (Onda 3 / T5) — Rebind resiliente de slots no snapshot.load.
     * Walk recursivo em state.canvas.sections[].rows[].slots[].config.
     * Pra cada chave de coluna (column/xColumn/yColumn/etc):
     *   1) Já existe nas colunas atuais? Mantém.
     *   2) Tenta resolver via SolsticeDomain.resolveColumn (synonyms).
     *   3) Se acha — substitui e conta como "remapped".
     *   4) Se não acha — marca slot._unboundColumns e conta como "unbound".
     * NÃO MUTA o slot original se nada precisa mudar.
     * @returns {{ remapped: number, unbound: number }}
     */
    function _rebindSnapshotSlots(state){
      const report = { remapped: 0, unbound: 0 };
      const sections = state.canvas && state.canvas.sections;
      if (!Array.isArray(sections)) return report;

      // Usa as colunas do ingest do PRÓPRIO snapshot por padrão (caso o snapshot
      // tenha CSV embutido) OU as do store atual se não tiver.
      const ingestCols = (state.ingest && state.ingest.columns) ||
                         (SolsticeStore.get('ingest') || {}).columns || [];
      const dict = state.dictionary || SolsticeStore.get('dictionary');
      const ctx = { columns: ingestCols, dictionary: dict };

      const COL_KEYS = [
        'column','xColumn','yColumn','valueColumn',
        'sourceColumn','targetColumn','groupColumn','sizeColumn',
        'dateColumn','groupBy'
      ];

      sections.forEach(sec => {
        (sec.rows || []).forEach(row => {
          (row.slots || []).forEach(slot => {
            if (!slot || !slot.config || slot.type === 'empty') return;
            const cfg = slot.config;
            const unbound = [];
            for (const key of COL_KEYS){
              const v = cfg[key];
              if (typeof v !== 'string' || !v) continue;
              if (ingestCols.indexOf(v) !== -1) continue;  // já casa
              // Tenta resolver via dicionário
              const resolved = (typeof SolsticeDomain !== 'undefined' && SolsticeDomain.resolveColumn)
                ? SolsticeDomain.resolveColumn(v, ctx) : null;
              if (resolved && resolved !== v){
                cfg[key] = resolved;
                report.remapped++;
              } else if (!resolved){
                unbound.push({ key, target: v });
                report.unbound++;
              }
            }
            // localFilters[].column também
            if (Array.isArray(cfg.localFilters)){
              cfg.localFilters.forEach(f => {
                if (f && typeof f.column === 'string' && ingestCols.indexOf(f.column) === -1){
                  const r = (typeof SolsticeDomain !== 'undefined' && SolsticeDomain.resolveColumn)
                    ? SolsticeDomain.resolveColumn(f.column, ctx) : null;
                  if (r && r !== f.column){ f.column = r; report.remapped++; }
                  else if (!r){ unbound.push({ key: 'localFilters.column', target: f.column }); report.unbound++; }
                }
              });
            }
            if (unbound.length){ slot._unboundColumns = unbound; }
          });
        });
      });
      return report;
    }

    /** Remove snapshot. */
    function remove(id){
      const all = list().filter(e => e.id !== id);
      _safeWrite(_storageKey(), JSON.stringify(all));
      SolsticeAudit.record({ action:'snapshot_remove', details:{ id } });
      SolsticeUtils.fire('snapshots:changed', { kind:'remove', id });
    }

    /** Renomeia. */
    function rename(id, newName){
      const all = list();
      const e = all.find(x => x.id === id);
      if (e){ e.name = newName; _safeWrite(_storageKey(), JSON.stringify(all)); }
    }

    /** Modal CRUD de snapshots. */
    async function openModal(){
      let snaps = list();
      function refresh(listEl){
        listEl.innerHTML = '';
        if (!snaps.length){
          listEl.appendChild(SolsticeUtils.el('div', { class:'solstice__snap-empty' },
            'Nenhum snapshot salvo neste perfil ainda. Use o botão "💾 Salvar" da toolbar para criar um.'));
          return;
        }
        snaps.forEach(snap => {
          const item = SolsticeUtils.el('div', { class:'solstice__snap-item' });
          const thumb = SolsticeUtils.el('div', { class:'solstice__snap-thumb' }, '📸');
          item.appendChild(thumb);
          const body = SolsticeUtils.el('div', { class:'solstice__snap-body' });
          body.appendChild(SolsticeUtils.el('div', { class:'solstice__snap-name' }, snap.name));
          body.appendChild(SolsticeUtils.el('div', { class:'solstice__snap-meta' },
            new Date(snap.savedAt).toLocaleString('pt-BR') + ' · ' +
            Math.round(snap.size / 1024) + ' KB · ' +
            SolsticeHumanize.recordCount(snap.rowsCount)));
          item.appendChild(body);
          const acts = SolsticeUtils.el('div', { class:'solstice__snap-actions' });
          // Auditoria 2026 (B-05 / A-1003): entradas corrompidas mostram só
          // ações de recuperação manual; não permitem load() direto.
          if (snap.corrupted){
            acts.appendChild(SolsticeUtils.el('button', { title:'Exportar bruto (JSON)', 'aria-label':'Exportar snapshot corrompido como JSON',
              onclick: () => {
                const blob = new Blob([snap.rawSample || ''], { type:'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'snapshot-corrompido.json';
                a.click();
                URL.revokeObjectURL(a.href);
              }}, '⬇️'));
            acts.appendChild(SolsticeUtils.el('button', { title:'Remover entrada corrompida', 'aria-label':'Remover entrada de snapshot corrompida',
              onclick: () => {
                // Limpa toda a chave (a entrada corrompida é a chave inteira do perfil).
                try { localStorage.removeItem(_storageKey()); } catch(e){}
                SolsticeToast.warn('Snapshots do perfil limpos', 'A chave estava corrompida.');
                SolsticeUtils.fire('snapshots:changed', { kind:'remove-corrupted' });
              }}, '🗑️'));
            item.appendChild(acts);
            listEl.appendChild(item);
            return;  // pula o resto (Carregar/Renomear) para esta entrada
          }
          acts.appendChild(SolsticeUtils.el('button', { title:'Carregar', 'aria-label':'Carregar snapshot ' + snap.name,
            onclick: () => load(snap.id) }, '📂'));
          acts.appendChild(SolsticeUtils.el('button', { title:'Renomear', 'aria-label':'Renomear snapshot ' + snap.name, onclick: async () => {
            const nv = await SolsticeModal.prompt({ title:'Renomear snapshot', defaultValue: snap.name });
            if (nv){ rename(snap.id, nv); snaps = list(); refresh(listEl); }
          }}, '✏️'));
          acts.appendChild(SolsticeUtils.el('button', { class:'is-danger', title:'Remover', 'aria-label':'Remover snapshot ' + snap.name,
            onclick: async () => {
              const ok = await SolsticeModal.confirm({ title:'Remover snapshot?', message:'Esta ação não pode ser desfeita.', danger: true, confirmLabel:'Remover' });
              if (ok){ remove(snap.id); snaps = list(); refresh(listEl); }
            }
          }, '🗑️'));
          item.appendChild(acts);
          listEl.appendChild(item);
        });
      }
      await SolsticeModal.show({
        title: '📂 Snapshots — ' + (SolsticeProfiles.current() ? SolsticeProfiles.current().name : 'Default'),
        size: 'lg',
        body: () => {
          const wrap = SolsticeUtils.el('div');
          wrap.appendChild(SolsticeUtils.el('p',
            { style:'color:var(--c-muted);font-size:var(--fs-xs);margin-bottom:var(--sp-3);line-height:1.5;' },
            'Snapshots salvam o estado completo: canvas, filtros, parâmetros, dicionário e dataset. ' +
            'Comprimidos com LZ-String. Até 30 por perfil. Use 📂 para restaurar, ✏️ renomear, 🗑️ remover.'));
          const listEl = SolsticeUtils.el('div', { class:'solstice__snaps-list' });
          refresh(listEl);
          wrap.appendChild(listEl);
          return wrap;
        },
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary',
            onclick: async () => {
              const nm = await SolsticeModal.prompt({
                title:'Salvar snapshot',
                message:'Dê um nome para identificar.',
                defaultValue:'Snapshot ' + new Date().toLocaleString('pt-BR')
              });
              if (nm){ save(nm); snaps = list();
                const listEl = document.querySelector('.solstice__snaps-list');
                if (listEl) refresh(listEl);
              }
            }
          }, '💾 Salvar atual'),
          SolsticeUtils.el('button', { class:'solstice__btn', onclick: () => close(null) }, 'Fechar')
        ]
      });
    }

    function init(){ /* nada — Store-based */ }

    // Auditoria 2026 (B-05 / A-1003): getCorruptionStatus exposto para que o
    // boot possa disparar um toast educativo quando o localStorage do perfil
    // estiver corrompido (antes a entrada sumia silenciosa de list()).
    return { list, save, load, remove, rename, openModal, init, _captureState, getCorruptionStatus };
  })();
