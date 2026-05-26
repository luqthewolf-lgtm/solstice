
  /* ============================================================
     ADR-180 (Onda 0 / Etapa 1.5 + 6) — SolsticeGoldenTest
     Runner do golden-test.json. Carrega 15 CSVs, roda inference em
     cada coluna, compara com expected_type/expected_concept, reporta.
     Etapa 1.5: relata sem assertions. Etapa 6: strict mode = pass/fail.
     ============================================================ */
  const SolsticeGoldenTest = (function(){

    async function _loadJson(url){
      const res = await fetch(url);
      if (!res.ok) throw new Error('Falha ao carregar ' + url + ': ' + res.status);
      return res.json();
    }

    async function _loadCsv(url){
      const res = await fetch(url);
      if (!res.ok) return { columns: [], rows: [] };
      const text = await res.text();
      const lines = text.split(/\r?\n/).filter(l => l.length > 0);
      if (!lines.length) return { columns: [], rows: [] };
      const columns = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const rows = [];
      for (let i = 1; i < Math.min(lines.length, 101); i++){
        const vals = lines[i].split(',');
        const row = {};
        columns.forEach((c, j) => { row[c] = vals[j]; });
        rows.push(row);
      }
      return { columns, rows };
    }

    async function run(opts){
      opts = opts || {};
      const goldenUrl = opts.goldenUrl || './golden-test.json';
      const strict = !!opts.strict;
      const golden = await _loadJson(goldenUrl);
      const baseDir = goldenUrl.substring(0, goldenUrl.lastIndexOf('/') + 1);

      const perDataset = [];
      const failures = [];
      let totalCols = 0, hitsType = 0, hitsConcept = 0;

      for (const ds of golden.datasets){
        const csvUrl = baseDir + ds.csv_path;
        const csv = await _loadCsv(csvUrl);
        let dsHitsType = 0, dsHitsConcept = 0;
        const dsFailures = [];

        for (const col of ds.columns){
          totalCols++;
          const sample = csv.rows.map(r => r[col.name]).filter(v => v != null && v !== '');
          const result = SolsticeInference.inferColumn(col.name, sample, { domain: ds.domain });
          const okType = result.type === col.expected_type;
          const okConcept = col.expected_concept == null
            ? (result.winner == null || result.fallback_used)
            : result.winner === col.expected_concept;
          if (okType){ hitsType++; dsHitsType++; }
          if (okConcept){ hitsConcept++; dsHitsConcept++; }
          if (!okType || !okConcept){
            dsFailures.push({
              column: col.name,
              expected: col.expected_concept + '/' + col.expected_type,
              got: (result.winner || '∅') + '/' + result.type,
              winner_score: result.candidates[0] && result.candidates[0].score,
              tokens: result.tokens.slice(0, 5)
            });
          }
        }

        const accType = dsHitsType / Math.max(1, ds.columns.length);
        const accConcept = dsHitsConcept / Math.max(1, ds.columns.length);
        const passes = !strict || (accType >= ds.expected_acc_type && accConcept >= ds.expected_acc_concept);

        perDataset.push({
          id: ds.id, name: ds.name, n_cols: ds.columns.length,
          acc_type: Math.round(accType * 1000) / 1000,
          acc_concept: Math.round(accConcept * 1000) / 1000,
          target_type: ds.expected_acc_type,
          target_concept: ds.expected_acc_concept,
          passes, failures_count: dsFailures.length
        });
        if (dsFailures.length) failures.push({ dataset: ds.id, failures: dsFailures });
      }

      const overall = {
        n_datasets: golden.datasets.length,
        n_columns: totalCols,
        acc_type: Math.round((hitsType / totalCols) * 1000) / 1000,
        acc_concept: Math.round((hitsConcept / totalCols) * 1000) / 1000,
        target_acc_type: golden.summary.target_acc_type,
        target_acc_concept: golden.summary.target_acc_concept,
        passes: !strict || (
          (hitsType / totalCols) >= golden.summary.target_acc_type &&
          (hitsConcept / totalCols) >= golden.summary.target_acc_concept
        )
      };

      return { overall, per_dataset: perDataset, failures };
    }

    return { run };
  })();
