
  /* ============================================================
     ADR-163 (Onda 2 / T2b) — SolsticeDomain
     Detecta o domínio de um dataset comparando suas colunas com os
     synonyms de cada preset do dicionário. Retorna match com score.
     Briefing v5.4 Anexo A.5 — usado pelo banner "Detectei dados de X".
     ============================================================ */
  const SolsticeDomain = (function(){

    function _normalize(s){
      return String(s || '').toLowerCase().trim()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove acentos
        .replace(/[_\-\s]+/g, ' ').trim();
    }

    /**
     * detectDomain(ctx) — calcula match-score por preset.
     * @param {{columns: string[]}} ctx — colunas do dataset atual.
     * @returns {{ domain: string|null, confidence: number, scores: Object<string, number>, matchedColumns: Object<string, string[]> }}
     *   domain: id do preset vencedor (>= 40% match) ou null
     *   confidence: 0-100
     *   scores: id → percentual (0-1)
     *   matchedColumns: id → array de colunas do CSV que casaram (debug)
     */
    function detectDomain(ctx){
      const presets = SolsticeDictionary.presets || {};
      const csvCols = (ctx.columns || []).map(_normalize);
      const scores = {};
      const matchedColumns = {};

      for (const [presetId, preset] of Object.entries(presets)){
        if (presetId === 'generico') continue;
        const presetCols = preset.columns || {};
        const keys = Object.keys(presetCols);
        if (!keys.length){ scores[presetId] = 0; continue; }
        let matches = 0;
        const matched = [];
        for (const techCol of keys){
          const def = presetCols[techCol];
          const candidates = [techCol].concat(def.synonyms || []).map(_normalize);
          // Hit: alguma coluna do CSV bate (exato OU substring em qualquer direção)
          const hitCol = csvCols.find(c =>
            candidates.includes(c) ||
            candidates.some(cand => cand.length > 2 && (c.includes(cand) || cand.includes(c)))
          );
          if (hitCol){
            matches++;
            matched.push(hitCol);
          }
        }
        scores[presetId] = matches / keys.length;
        matchedColumns[presetId] = matched;
      }

      // Vencedor: maior score >= 0.4 (40% das colunas-alvo encontradas)
      const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const best = ordered[0];
      if (best && best[1] >= 0.4){
        return {
          domain: best[0],
          confidence: Math.round(best[1] * 100),
          scores,
          matchedColumns
        };
      }
      return { domain: null, confidence: 0, scores, matchedColumns };
    }

    /**
     * resolveColumn(targetKey, ctx) — dado um nome técnico do template
     * (ex: 'qtd_atendimentos'), encontra o nome REAL da coluna no CSV
     * usando synonyms do dicionário ativo. Usado no remap (T2d).
     * @returns {string|null} nome da coluna no CSV, ou null se não bate
     */
    function resolveColumn(targetKey, ctx){
      if (!targetKey || !ctx || !ctx.columns) return null;
      const dict = ctx.dictionary || SolsticeStore.get('dictionary');
      if (!dict || !dict.columns) return _shallowMatch(targetKey, ctx.columns);

      const def = dict.columns[targetKey];
      if (!def) return _shallowMatch(targetKey, ctx.columns);

      const candidates = [targetKey].concat(def.synonyms || []).map(_normalize);
      const csvCols = ctx.columns;
      // 1. Match exato (case-insensitive)
      const exact = csvCols.find(c => candidates.includes(_normalize(c)));
      if (exact) return exact;
      // 2. Substring match (ambas direções, candidato com 3+ chars)
      const sub = csvCols.find(c => {
        const n = _normalize(c);
        return candidates.some(cand => cand.length > 2 && (n.includes(cand) || cand.includes(n)));
      });
      return sub || null;
    }

    function _shallowMatch(targetKey, cols){
      // Fallback quando dict não tem o key: tenta match direto pelo nome técnico
      const t = _normalize(targetKey);
      return cols.find(c => _normalize(c) === t) ||
             cols.find(c => _normalize(c).includes(t) || t.includes(_normalize(c))) ||
             null;
    }

    /* ============================================================
       HC-04 (Sprint 3) — Recommendations via TF-IDF + cosine similarity
       Resolve o problema "receita" vs "vendas" sem embeddings reais:
         - Tokeniza nome de coluna + sinônimos em bag of unigrams + bigrams
         - Calcula vetor TF-IDF para cada (presetId, columnTargetKey)
         - Para um nome de coluna desconhecido, calcula sim cosseno
           contra TODOS os targets e retorna top match (se score > threshold)

       Não substitui resolveColumn — é um fallback usado quando exact+
       substring falham. Custo: O(N_tokens × N_dict_entries) por coluna.
       ============================================================ */
    function _tokenize(s){
      const norm = _normalize(s).replace(/[^a-z0-9]+/g, ' ').trim();
      if (!norm) return [];
      const words = norm.split(/\s+/).filter(w => w.length >= 2);
      // Sinônimos pt-BR/EN comuns expandidos
      const SYN = {
        venda: ['vendas','vendido','revenue','sale','sales'],
        receita: ['vendas','revenue','sale','sales','faturamento','faturado'],
        cliente: ['clientes','customer','user','usuario','consumidor'],
        produto: ['produtos','product','item','sku'],
        valor: ['preco','price','custo','cost','amount','total'],
        data: ['date','dt','timestamp','ts','periodo','dia'],
        regiao: ['region','area','zona','filial','local','localizacao'],
        canal: ['channel','origem','source','meio']
      };
      const out = [];
      words.forEach(w => {
        out.push(w);
        if (SYN[w]) SYN[w].forEach(s2 => out.push(s2));
      });
      // Bigrams (capturam compostos: 'data_venda' vira 'data' 'venda' 'data_venda')
      for (let i = 0; i < words.length - 1; i++){
        out.push(words[i] + '_' + words[i+1]);
      }
      return out;
    }

    function _tfVector(tokens){
      const v = {};
      tokens.forEach(t => { v[t] = (v[t] || 0) + 1; });
      // Normaliza por sqrt(soma) — variante do TF
      const norm = Math.sqrt(Object.values(v).reduce((s, c) => s + c * c, 0)) || 1;
      for (const k in v) v[k] = v[k] / norm;
      return v;
    }

    function _cosine(a, b){
      let dot = 0;
      for (const k in a){
        if (b[k]) dot += a[k] * b[k];
      }
      // a e b já normalizados — dot é cosseno
      return dot;
    }

    /** matchByEmbedding(unknownName, dictionary, opts) — fuzzy match semântico
        @returns { key, score, label } | null */
    function matchByEmbedding(unknownName, dictionary, opts){
      opts = opts || {};
      const threshold = opts.threshold != null ? opts.threshold : 0.35;
      if (!unknownName || !dictionary || !dictionary.columns) return null;
      const queryVec = _tfVector(_tokenize(unknownName));
      if (!Object.keys(queryVec).length) return null;

      let best = null;
      for (const key in dictionary.columns){
        const def = dictionary.columns[key];
        // Concatena key + synonyms + friendlyName + description em uma string
        const text = [key]
          .concat(def.synonyms || [])
          .concat(def.friendlyName || [])
          .concat(def.description || [])
          .join(' ');
        const targetVec = _tfVector(_tokenize(text));
        if (!Object.keys(targetVec).length) continue;
        const score = _cosine(queryVec, targetVec);
        if (score >= threshold && (!best || score > best.score)){
          best = { key, score, label: def.friendlyName || key };
        }
      }
      return best;
    }

    /** Versão batch: resolve colunas desconhecidas em lote para 1 dataset. */
    function matchColumnsBatch(csvCols, dictionary, opts){
      opts = opts || {};
      const out = [];
      csvCols.forEach(c => {
        // Pula se já tem match direto
        const exact = dictionary.columns && dictionary.columns[_normalize(c)];
        if (exact) return;
        const m = matchByEmbedding(c, dictionary, opts);
        if (m) out.push({ csvCol: c, dictKey: m.key, score: m.score, friendlyName: m.label });
      });
      return out;
    }

    return { detectDomain, resolveColumn, matchByEmbedding, matchColumnsBatch };
  })();
