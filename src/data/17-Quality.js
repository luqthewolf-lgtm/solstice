
  /* ============================================================
     SolsticeQuality — score adaptativo por perfil de dataset
     ============================================================ */
  const SolsticeQuality = (function(){

    /** Pesos por perfil — soma deve dar 1.0. (Correção v5.2 #3) */
    const WEIGHTS = {
      transactional: { completeness: 0.3, validity: 0.25, uniqueness: 0.15, consistency: 0.2, distribution: 0.1 },
      categorical:   { completeness: 0.3, validity: 0.15, uniqueness: 0.1,  consistency: 0.25, distribution: 0.2 },
      timeseries:    { completeness: 0.4, validity: 0.15, uniqueness: 0.05, consistency: 0.3, distribution: 0.1 },
      snapshot:      { completeness: 0.4, validity: 0.25, uniqueness: 0.15, consistency: 0.15, distribution: 0.05 },
      survey:        { completeness: 0.35, validity: 0.15, uniqueness: 0.05, consistency: 0.25, distribution: 0.2 },
      scientific:    { completeness: 0.2, validity: 0.3,  uniqueness: 0.1,  consistency: 0.15, distribution: 0.25 }
    };

    function _completeness(issues, totalCells){
      const totalNulls = Object.values(issues.byColumn).reduce((s,i) => s + i.nulls, 0);
      return totalCells > 0 ? 1 - (totalNulls / totalCells) : 0;
    }
    function _validity(issues, totalCells, rows){
      // Sprint 26 / F-08 + Sprint 37: classificação MACRO importa mais que micro.
      // Se >95% inválidos pra micro tipo MAS macro está OK (dimension/geo/id),
      // não conta como problema — sistema funciona com a classificação macro.
      // Se macro também não bate (ex: tentaram inferir number mas é dimension),
      // aí sim conta.
      if (totalCells === 0) return 1;
      const rowCount = (rows && rows.length) || 1;
      let realInvalid = 0;
      for (const c of Object.keys(issues.byColumn || {})){
        const colIssue = issues.byColumn[c];
        const invalidRatio = colIssue.invalid / rowCount;
        // Ignora quando >95% inválidos — tipo errado, não dados ruins
        if (invalidRatio < 0.95) realInvalid += colIssue.invalid;
      }
      return 1 - (realInvalid / totalCells);
    }
    function _uniqueness(rows, columns, types){
      // Apenas identificadores devem ser únicos
      const idCols = columns.filter(c => ['identifier','cpf','cnpj','hash'].indexOf(types[c].type) >= 0);
      if (!idCols.length) return 1;
      // Auditoria 2026.6 (BIG-DATA-PERF): razão de unicidade estimada por amostra
      // (Set de 500k por id-col estourava memória). 50k é preciso pro score.
      const N = rows.length;
      const CAP = 50000;
      const sampledN = N > CAP ? CAP : N;
      const step = N > CAP ? N / CAP : 1;
      let score = 0;
      for (const c of idCols){
        const seen = new Set();
        for (let s = 0; s < sampledN; s++){ seen.add(rows[step === 1 ? s : Math.floor(s * step)][c]); }
        score += sampledN > 0 ? seen.size / sampledN : 0;
      }
      return score / idCols.length;
    }
    function _consistency(rows, columns, types){
      // Razão entre amostra dominante e total (heurística simples)
      let issues = 0; const samples = Math.min(rows.length, 100);
      for (const c of columns){
        const def = SolsticeTypes.getType(types[c].type);
        if (!def || !def.detect) continue;
        let drift = 0;
        for (let i = 0; i < samples; i++){
          const v = rows[i][c];
          if (v != null && v !== '' && !def.detect(v)) drift++;
        }
        if (drift / samples > 0.1) issues++;
      }
      return columns.length > 0 ? 1 - (issues / columns.length) : 1;
    }
    function _distribution(rows, columns, types){
      // Penaliza colunas com 1 valor dominante > 95%
      // Auditoria 2026.6 (BIG-DATA-PERF): amostra uniforme de até 50k. A razão de
      // dominância (max/n) é precisa por amostra, e o mapa de contagem fica
      // limitado a ≤50k chaves (antes uma id-col criava mapa de 500k chaves).
      const N = rows.length;
      const CAP = 50000;
      const sampledN = N > CAP ? CAP : N;
      const step = N > CAP ? N / CAP : 1;
      let issues = 0;
      for (const c of columns){
        const counts = {};
        for (let s = 0; s < sampledN; s++){
          const v = String(rows[step === 1 ? s : Math.floor(s * step)][c]);
          counts[v] = (counts[v] || 0) + 1;
        }
        // Math.max(...array) estourava a pilha em alta cardinalidade → loop O(n).
        let max = 0;
        for (const k in counts){ if (counts[k] > max) max = counts[k]; }
        if (max / sampledN > 0.95 && Object.keys(counts).length > 1) issues++;
      }
      return columns.length > 0 ? 1 - (issues / columns.length) : 1;
    }

    let _memo = null;

    /** Calcula score 0-100 + breakdown + flags. */
    function compute(ingest){
      const { rows, columns, types, issues } = ingest;
      // Auditoria 2026.6 (BIG-DATA-PERF): memoiza por ingestão. O card de
      // qualidade chama compute() a CADA render — sem cache refazia toda a
      // varredura (validade/distribuição/unicidade) de novo. Chave: referência
      // do ingest + dimensões (nova base ou coluna calculada → objeto novo ou
      // contagem diferente → invalida automaticamente).
      if (_memo && _memo.ingest === ingest &&
          _memo.nRows === rows.length && _memo.nCols === columns.length){
        return _memo.result;
      }
      const profile = SolsticeDatasetType.classify(columns, types, rows);
      const w = WEIGHTS[profile] || WEIGHTS.snapshot;
      const totalCells = rows.length * columns.length;

      const metrics = {
        completeness: _completeness(issues, totalCells),
        validity:     _validity(issues, totalCells, rows),
        uniqueness:   _uniqueness(rows, columns, types),
        consistency:  _consistency(rows, columns, types),
        distribution: _distribution(rows, columns, types)
      };

      const score = Math.round(
        100 * (metrics.completeness * w.completeness +
               metrics.validity     * w.validity +
               metrics.uniqueness   * w.uniqueness +
               metrics.consistency  * w.consistency +
               metrics.distribution * w.distribution)
      );

      // Flags acionáveis
      // S4-04 (Sprint 4 / Otto/Vercel · OF-02): macro > micro. Se uma coluna
      // é semanticamente uma dimensão (variabilidade alta, baixo % de nulos),
      // não chamar de "inválido" só porque o tipo inferido foi específico demais.
      // Threshold: só flaga como ERROR se invalid > 25% (antes era qualquer >0).
      // Abaixo disso, é INFO (suave) com sugestão de reclassificar.
      const flags = [];
      for (const c of columns){
        // Auditoria 2026.6 (EDIT-CRASH): ao renomear/transformar coluna, o ingest
        // ganha o nome novo mas issues.byColumn ainda tem a chave antiga →
        // issues.byColumn[novoNome] === undefined → "Cannot read 'nulls'" crashava
        // o card de qualidade no fluxo de edição. Fallback neutro.
        const colIssue = issues.byColumn[c] || { nulls: 0, invalid: 0, total: rows.length };
        const nullRatio = colIssue.nulls / rows.length;
        if (nullRatio > 0.5) flags.push({ col: c, level: 'warn', msg: `${Math.round(nullRatio*100)}% nulos` });
        else if (nullRatio > 0.2) flags.push({ col: c, level: 'info', msg: `${Math.round(nullRatio*100)}% nulos` });
        if (colIssue.invalid > 0){
          const invalidRatio = colIssue.invalid / rows.length;
          const typeName = (types[c] && types[c].type) || 'desconhecido';
          // Heurística macro: se >75% dos valores são válidos pra esse tipo
          // (e o tipo é específico tipo geo_uf/email/cpf), é "tipo OK mas
          // alguns outliers" — não erro de qualidade, é INFO com sugestão.
          // Sprint 26 / F-08: 3 níveis agora — pequeno desvio (info), tipo
          // possivelmente errado (warn), ou problema real (error).
          // Sprint 37: classificação MACRO primeiro. Quando micro tipo
          // (geo_uf/email/cpf) não bate, o sistema sabe que pelo macro
          // (Dimensão) está OK. Não alarmamos como "errado" — informamos
          // discretamente como "info", e o macro tipo é o que importa pra
          // montar dashboard. User pode reclassificar se quiser refinar.
          const macroGroup = SolsticeTypes.userGroup ? SolsticeTypes.userGroup(types[c] && types[c].type, types[c]) : null;
          const isDimensionByMacro = macroGroup === 'dimension' || macroGroup === 'geo' ||
                                     macroGroup === 'ordinal' || macroGroup === 'id' ||
                                     macroGroup === 'contact';
          if (invalidRatio < 0.25){
            flags.push({
              col: c, level: 'info',
              msg: `${colIssue.invalid} valores fora do padrão (${typeName}) — pode ser dimensão livre`,
              actionable: { reclassifyTo: 'dimension' }
            });
          } else if (invalidRatio >= 0.95){
            // Sprint 37: micro tipo errado mas macro OK = level=info (era warn).
            // Mensagem positiva: macro já está classificado, micro é refinamento.
            if (isDimensionByMacro){
              flags.push({
                col: c, level: 'info',
                msg: `Classificado como Dimensão · subtipo "${typeName}" não casa. Funciona pra dashboard mesmo assim — clique pra refinar.`,
                actionable: { reclassifyTo: 'dimension' }
              });
            } else {
              flags.push({
                col: c, level: 'warn',
                msg: `Tipo "${typeName}" provavelmente errado — valores não casam. Reclassifique pra dimensão.`,
                actionable: { reclassifyTo: 'dimension' }
              });
            }
          } else {
            flags.push({ col: c, level: 'error', msg: `${colIssue.invalid} inválidos (tipo ${typeName})` });
          }
        }
      }

      const result = { score, profile, weights: w, metrics, flags };
      _memo = { ingest, nRows: rows.length, nCols: columns.length, result };
      return result;
    }

    return { compute, WEIGHTS };
  })();
