
  /* ============================================================
     BLOCO 10 — SolsticeColumnScore (ADR-075)
     scoreImportance(col, ctx) → 0-100 via 8 critérios compostos.
     Usado por Auto-Dashboard para priorizar quais colunas merecem
     visualização. Cada critério retorna 0-1; pesos calibrados na intuição.
     ============================================================ */
  const SolsticeColumnScore = (function(){

    /** 8 critérios + pesos. Ajuste com cuidado. */
    const WEIGHTS = {
      coverage:        0.18,  // % de valores não-nulos
      variation:       0.16,  // IQR > 0 (numérica) ou cardinalidade balanceada (cat)
      cardinality:     0.12,  // distintos no range bom (cat: 2-30, num: >10)
      higherIsBetter:  0.14,  // tem direcionalidade no dicionário (= KPI)
      dictMatch:       0.12,  // matched no dicionário pré-feito
      typeImportance:  0.10,  // numeric/temporal > categorical > id/contact
      position:        0.08,  // primeiras colunas pesam mais
      synonymBonus:    0.10   // friendlyName não é técnico (= relevante semanticamente)
    };

    /** Calcula score para 1 coluna. Retorna 0-100. */
    function scoreImportance(col, ctx){
      const rows = (ctx.rows || ctx.rowsAll) || [];
      if (!rows.length) return 0;
      const types = ctx.types || {};
      const dict  = ctx.dictionary;
      const cols  = ctx.columns || [];
      const t = (types[col] || {}).type;
      const group = SolsticeTypes.group(t);

      let s = 0;

      // 1. Cobertura
      const nulls = SolsticeStats.countNulls(rows.map(r => r[col]));
      const cov = 1 - (nulls / rows.length);
      s += WEIGHTS.coverage * cov;

      // 2. Variação
      if (group === 'numeric'){
        const vals = rows.map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
        const iqr = vals.length > 1 ? SolsticeStats.iqr(vals) : 0;
        s += WEIGHTS.variation * (iqr > 0 ? 1 : 0);
      } else if (group === 'categorical'){
        const d = SolsticeStats.distinctCount(rows.map(r => r[col]));
        const balanced = d >= 2 && d <= 30 ? 1 : (d > 30 ? 0.3 : 0.5);
        s += WEIGHTS.variation * balanced;
      } else {
        s += WEIGHTS.variation * 0.5; // neutro pra outros tipos
      }

      // 3. Cardinalidade boa
      const distinct = SolsticeStats.distinctCount(rows.map(r => r[col]));
      let cardScore = 0;
      if (group === 'categorical') cardScore = (distinct >= 2 && distinct <= 30) ? 1 : 0.3;
      else if (group === 'numeric') cardScore = distinct > 10 ? 1 : (distinct > 3 ? 0.6 : 0.2);
      else if (group === 'temporal') cardScore = distinct > 5 ? 1 : 0.4;
      else cardScore = 0.5;
      s += WEIGHTS.cardinality * cardScore;

      // 4. higherIsBetter no dicionário (= é métrica de KPI)
      const dictCol = dict && dict.columns && dict.columns[col];
      const hib = dictCol && (dictCol.higherIsBetter === true || dictCol.higherIsBetter === false);
      s += WEIGHTS.higherIsBetter * (hib ? 1 : 0);

      // 5. Match com dicionário pré-feito
      s += WEIGHTS.dictMatch * (dictCol ? 1 : 0);

      // 6. Tipo importante
      const typeImp = group === 'numeric' ? 1 :
                      group === 'temporal' ? 0.9 :
                      group === 'categorical' ? 0.7 :
                      group === 'id' ? 0.3 :
                      group === 'contact' ? 0.2 : 0.5;
      s += WEIGHTS.typeImportance * typeImp;

      // 7. Posição (primeiras colunas pesam mais)
      const idx = cols.indexOf(col);
      const posScore = idx < 0 ? 0.5 : Math.max(0, 1 - (idx / Math.max(1, cols.length - 1)) * 0.5);
      s += WEIGHTS.position * posScore;

      // 8. Sinônimo bônus (friendlyName ≠ nome técnico = relevante)
      const friendly = SolsticeHumanize.column(col, dict);
      const isTechnical = friendly === col || /^[a-z_]+$/.test(friendly);
      s += WEIGHTS.synonymBonus * (isTechnical ? 0 : 1);

      // 9. Bônus de métrica de negócio (Auditoria 2026.6 / METRIC-RANK).
      // ANTES, o KPI-título de um CSV de vendas saía como soma de "qtd_vendas"
      // (1ª coluna numérica, vencia por posição) em vez de "receita_total" — a
      // métrica que o usuário realmente quer ver. Colunas numéricas de VALOR
      // (receita, faturamento, lucro, GMV…) ganham um bônus aditivo para virarem
      // a headline; preço/custo (per-unit) ganham um bônus menor; nomes de
      // contagem (qtd/quantidade/count) são explicitamente excluídos.
      if (group === 'numeric'){
        const hay = (col + ' ' + friendly).toLowerCase();
        const isCount = /\b(qtd|qtde|quant|quantidade|contagem|n[uú]mero|num_|_num|count|qty|nro|n_)\b|qtd|quant/.test(hay);
        if (!isCount){
          if (/receita|faturament|fatura|revenue|gmv|lucro|montante|arrecad|ganho|valor|^vlr|_vlr|billing|turnover/.test(hay)){
            s += 0.14;   // métrica-valor primária → forte candidata a KPI-título
          } else if (/pre[çc]o|custo|despesa|gasto|ticket|sal[áa]rio|saldo|amount|pre[çc]o_unit/.test(hay)){
            s += 0.05;   // monetária per-unit/secundária
          }
        }
      }

      // 10. Despromoção de identificadores (Auditoria 2026.6 / ID-NOT-METRIC).
      // "id"/"código"/"num_conta"/"agência"/"anomes"/"telefone"/"funcional" são
      // CHAVES/CÓDIGOS, não métricas — somar/graficar não faz sentido (em dado
      // corporativo real o auto-dashboard fazia kpi[num_agencia:sum]). Despromove
      // por NOME (lista ampliada com padrões de base bancária/CRM) e também
      // inteiros de cardinalidade quase-única (id sequencial) — mas só inteiros,
      // pra não penalizar medidas contínuas (receita/tempo) que têm muitos valores.
      if (group === 'numeric'){
        const low = col.toLowerCase();
        const idName = /^id$|_id$|^id_|id_|^c[oó]d|c[oó]digo|^seq|^chave$|^key$|matr[ií]cula|protocolo|cpf|cnpj|cep|^num|_num|n[uú]mero|ag[eê]ncia|^conta$|_conta$|^pv$|_pv$|carteira|dicom|funcional|chpras|anomes|anomesdia|telefone|^ddd|cod_|_cod/.test(low);
        const t0 = (types[col] || {}).type;
        const cardRatio = rows.length ? (distinct / rows.length) : 0;
        const seqIdInteger = (t0 === 'integer') && cardRatio > 0.92; // inteiro quase-único = id
        if (idName || seqIdInteger){
          s *= 0.15;
        }
      }

      return Math.round(s * 100);
    }

    /** Ranking de colunas — devolve array { col, score } ordenado desc. */
    function rank(ctx){
      const cols = ctx.columns || [];
      const out = cols.map(c => ({ col: c, score: scoreImportance(c, ctx) }));
      out.sort((a, b) => b.score - a.score);
      return out;
    }

    /** Top N colunas mais importantes (default 8). */
    function top(ctx, n){
      return rank(ctx).slice(0, n || 8);
    }

    return { scoreImportance, rank, top, WEIGHTS };
  })();
