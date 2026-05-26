
  /* ============================================================
     BLOCO 11 — SolsticeSnapshots (ADR-079)
     Persistência completa do estado do dashboard em localStorage,
     comprimida com LZ-String. CRUD por nome, escopado por perfil.
     Estado salvo:
       canvas.sections + filters + params + canvas.header + dictionary
     ============================================================ */
  /* ============================================================
     B8-05 (v6-autonomous / JD-02 — Pedro Vasconcellos UX) — SolsticeAnnotations
     Anotações editoriais (linha vertical "marco aqui" em time-series).
     Comum em jornalismo de dados: "12/03 — anúncio do produto X" etc.

     Modelo de dados:
       annotation = { id, slotId, x: dateOrCategory, label, color?, kind? }
       kinds: 'vertical' (default) | 'point' | 'range'

     Persistido em SolsticeStore('canvas.annotations'), bound a slotId.
     Render visual fica como TODO pro próximo bloco (precisa Chart.js
     plugin); por enquanto exposição API + storage + helpers.

     API:
       SolsticeAnnotations.list(slotId?)            → todas, ou de 1 slot
       SolsticeAnnotations.add({slotId, x, label})  → cria, retorna id
       SolsticeAnnotations.remove(id)
       SolsticeAnnotations.update(id, patch)
     ============================================================ */
  const SolsticeAnnotations = (function(){

    function _all(){
      return SolsticeStore.get('canvas.annotations') || [];
    }

    function _save(arr){
      SolsticeStore.set('canvas.annotations', arr);
    }

    function list(slotId){
      const arr = _all();
      return slotId ? arr.filter(a => a.slotId === slotId) : arr.slice();
    }

    function add(opts){
      opts = opts || {};
      if (!opts.slotId || opts.x === undefined) return null;
      const note = {
        id: 'ann_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        slotId: opts.slotId,
        x: opts.x,
        label: String(opts.label || ''),
        color: opts.color || null,
        kind: opts.kind || 'vertical',
        createdAt: new Date().toISOString()
      };
      const arr = _all();
      arr.push(note);
      _save(arr);
      if (typeof SolsticeAudit !== 'undefined' && SolsticeAudit.record){
        SolsticeAudit.record({ action:'annotation_add', target: opts.slotId, details:{ id: note.id, label: note.label } });
      }
      return note.id;
    }

    function remove(id){
      const arr = _all().filter(a => a.id !== id);
      _save(arr);
    }

    function update(id, patch){
      const arr = _all();
      const note = arr.find(a => a.id === id);
      if (!note) return false;
      Object.assign(note, patch, { id: note.id, slotId: note.slotId }); // não permite mudar id/slotId
      _save(arr);
      return true;
    }

    /**
     * @returns {{
     *   list(slotId?:string): Array,
     *   add(opts:{slotId,x,label,color?,kind?}): string|null,
     *   remove(id:string): void,
     *   update(id:string, patch:Object): boolean
     * }}
     */
    return { list, add, remove, update };
  })();
