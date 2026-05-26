
  /* ============================================================
     SolsticeDatasetType — classifica o dataset em 1 dos 6 perfis
     (transactional / categorical / timeseries / snapshot / survey / scientific)
     ============================================================ */
  const SolsticeDatasetType = (function(){

    function classify(columns, types, rows){
      const groups = { numeric: 0, temporal: 0, id: 0, cat: 0, geo: 0, contact: 0, struct: 0, special: 0 };
      for (const col of columns){
        const t = types[col]; if (!t) continue;
        const def = SolsticeTypes.getType(t.type);
        if (def) groups[def.group] = (groups[def.group] || 0) + 1;
      }
      const n = columns.length;
      const hasTime = groups.temporal >= 1;
      const hasIds = groups.id >= 1;
      const hasNum = groups.numeric >= 1;
      const catRatio = groups.cat / n;
      const numRatio = groups.numeric / n;

      // Heurísticas — prioridade por especificidade
      if (hasTime && hasIds && hasNum)             return 'transactional';
      if (hasTime && groups.temporal === 1 && numRatio >= 0.5 && rows.length > 30) return 'timeseries';
      if (catRatio >= 0.6 && groups.cat >= 3)      return 'survey';
      if (catRatio >= 0.5)                          return 'categorical';
      if (numRatio >= 0.7 && rows.length < 500)    return 'scientific';
      return 'snapshot';
    }

    return { classify };
  })();
