
  /* ============================================================
     SolsticeDataset (Patch B6-r1) — summary classificado por grupo.
     Lê de Store.ingest; agrupa colunas por SolsticeTypes.group.
     ============================================================ */
  const SolsticeDataset = (function(){

    const GROUP_META = {
      numeric:     { label: 'Medidas',         icon: '📊', plural: 'Medidas',         singular: 'Medida' },
      categorical: { label: 'Dimensões',       icon: '🏷️', plural: 'Dimensões',       singular: 'Dimensão' },
      temporal:    { label: 'Temporais',       icon: '📅', plural: 'Temporais',       singular: 'Temporal' },
      id:          { label: 'Identificadores', icon: '🔑', plural: 'Identificadores', singular: 'Identificador' },
      contact:     { label: 'Contato',         icon: '📧', plural: 'Contato',         singular: 'Contato' },
      geo:         { label: 'Geográficas',     icon: '🗺️', plural: 'Geográficas',     singular: 'Geográfica' },
      struct:      { label: 'Estruturadas',    icon: '🧬', plural: 'Estruturadas',    singular: 'Estruturada' },
      special:     { label: 'Especiais',       icon: '⚪', plural: 'Especiais',       singular: 'Especial' },
      cat:         { label: 'Dimensões',       icon: '🏷️', plural: 'Dimensões',       singular: 'Dimensão' }
    };

    function summary(){
      const ingest = SolsticeStore.get('ingest');
      if (!ingest || !ingest.columns) return { totalRows: 0, totalColumns: 0, groups: {} };
      const dict = SolsticeStore.get('dictionary');
      const groups = {};
      for (const col of ingest.columns){
        const t = ingest.types && ingest.types[col];
        const typeId = t && t.type;
        // Usa SolsticeTypes.getType para descobrir o group bruto
        const def = SolsticeTypes.getType(typeId);
        let g = def ? def.group : 'special';
        // Mapeia 'cat' → 'categorical' para padronização
        if (g === 'cat') g = 'categorical';
        if (!groups[g]) groups[g] = [];
        groups[g].push({
          name: col,
          friendlyName: SolsticeHumanize.column(col, dict),
          type: typeId
        });
      }
      return {
        totalRows: (ingest.rows && ingest.rows.length) || 0,
        totalColumns: ingest.columns.length,
        groups
      };
    }

    function groupMeta(g){ return GROUP_META[g] || { label: 'Outras', icon: '➕', plural: 'Outras', singular: 'Outra' }; }

    return { summary, groupMeta, GROUP_META };
  })();
