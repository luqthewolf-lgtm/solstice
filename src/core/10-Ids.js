
  /* ============================================================
     SolsticeIds (R-07 v3) — single source of truth para datasetId
     ------------------------------------------------------------
     Antes: 3 jeitos de armazenar a referência de base —
       1) slot.config.datasetId (preferido, U-13)
       2) Store.get('datasets.activeId') (global)
       3) Store.get('dataset.name') (legado, snapshots antigos)
     Agora: SolsticeIds.resolveDataset(slot) devolve o ID correto
     com fallback determinístico. Helpers separados pra cada
     papel. Bug-detection: isStale(id) avisa se aponta pra base
     que não existe mais (sessão anterior).
     ============================================================ */
  const SolsticeIds = (function(){
    function _datasets(){ return SolsticeStore.get('datasets') || []; }
    function activeDataset(){
      return SolsticeStore.get('datasets.activeId') || null;
    }
    function isValid(id){
      if (!id) return false;
      return !!_datasets().find(d => d.id === id);
    }
    function isStale(id){
      return !!(id && !isValid(id));
    }
    /**
     * Resolve o dataset que um slot deve usar.
     * Ordem: slot.config.datasetId (se válido) → datasets.activeId → null.
     */
    function resolveDataset(slot){
      const cfgId = slot && slot.config && slot.config.datasetId;
      if (cfgId && isValid(cfgId)) return cfgId;
      return activeDataset();
    }
    /**
     * resolveDatasetByName: fallback pra snapshots legados que usaram
     * dataset.name como ID. Retorna o id atual ou null.
     */
    function resolveDatasetByName(name){
      if (!name) return null;
      const d = _datasets().find(x => x.name === name);
      return d ? d.id : null;
    }
    return { activeDataset, isValid, isStale, resolveDataset, resolveDatasetByName };
  })();
