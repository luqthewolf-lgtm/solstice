
  /* ============================================================
     SolsticeTypes — 30 tipos de coluna (Seção 11)
     Cada tipo: detect(v) regex/test, validate(v), aggs[], format(v, locale), viz[]
     ============================================================ */
  const SolsticeTypes = (function(){

    // Regex e helpers compartilhados
    const RX = {
      INTEGER:    /^-?\d{1,3}(?:[\.,]?\d{3})*$|^-?\d+$/,
      DECIMAL:    /^-?\d+([.,]\d+)?$/,
      CURRENCY:   /^[R$€£US\$\s\-]*\s*-?\d+([.,]\d+)?(\s*[A-Z]{3})?$/i,
      PERCENT:    /^-?\d+([.,]\d+)?\s*%$/,
      ISO_DATE:   /^\d{4}-\d{2}-\d{2}$/,
      ISO_TIME:   /^\d{2}:\d{2}(:\d{2})?$/,
      ISO_DT:     /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/,
      BR_DATE:    /^\d{2}\/\d{2}\/\d{4}$/,
      EMAIL:      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
      URL:        /^https?:\/\/[^\s]+$/i,
      PHONE_BR:   /^(\+?55)?\s*\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}$/,
      PHONE_INTL: /^\+\d{1,3}\s?\d{4,14}$/,
      UF_BR:      /^(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)$/i,
      HEX_HASH:   /^[a-f0-9]{8,}$/i,
      UUID:       /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
      DURATION:   /^\d+\s*(s|seg|min|h|hora|d|dia|w|sem)$|^\d+:\d{2}(:\d{2})?$/i,
      JSON:       /^[\[\{][\s\S]*[\]\}]$/,
      BOOL:       /^(true|false|sim|n[aã]o|yes|no|1|0|t|f|y|n)$/i
    };

    function _isLat(v){ const n = parseFloat(v); return !isNaN(n) && n >= -90 && n <= 90; }
    function _isLng(v){ const n = parseFloat(v); return !isNaN(n) && n >= -180 && n <= 180; }

    // Auditoria 2026.6 (BR-NUM / SOL-T1): detecção numérica ciente de formato
    // BR/US agrupado. ANTES, "1.234,56" (milhar com ponto + decimal vírgula) e
    // "20.729,20" falhavam em TODAS as regexes numéricas (DECIMAL/INTEGER/
    // CURRENCY exigiam fim logo após o decimal), então colunas de dinheiro reais
    // de CSVs pt-BR caíam em 'dimension' e ficavam não-agregáveis — quebrando o
    // caso de uso central. AGORA o número é reconhecido em qualquer formato e o
    // valor é parseado por SolsticeBR.toNumber. Ver inferColumn() abaixo.
    const NUM = {
      BR_GROUPED: /^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/,  // 1.234 · 1.234,56 · 1.234.567,89
      // Auditoria 2026.6 (BR-AMBIG): US agrupado exige 2+ grupos OU decimal com
      // ponto. Antes, "0,123"/"1,000" (1 grupo, sem ponto) eram lidos como milhar
      // US (= inteiro), divergindo do SolsticeBR.toNumber que, no app pt-BR, lê
      // vírgula como decimal. Agora esses caem no PLAIN e viram decimal BR.
      US_GROUPED: /^-?\d{1,3}(?:,\d{3}){2,}(?:\.\d+)?$|^-?\d{1,3}(?:,\d{3})+\.\d+$/,  // 1,234,567 · 1,234.56
      PLAIN:      /^-?\d+(?:[.,]\d+)?$/                // 714 · 714,80 · 714.80 · -5
    };
    function _stripMoney(v){
      return String(v).trim()
        .replace(/^(R\$|US\$|\$|€|£)\s*/i, '')   // símbolo monetário no início
        .replace(/\s*(BRL|USD|EUR|GBP)$/i, '')   // código ISO no fim
        .trim();
    }
    function _numLike(v){
      if (typeof v === 'number') return isFinite(v);
      const s = _stripMoney(v);
      return s !== '' && (NUM.BR_GROUPED.test(s) || NUM.US_GROUPED.test(s) || NUM.PLAIN.test(s));
    }
    function _hasDecimals(v){
      const s = _stripMoney(v);
      if (NUM.BR_GROUPED.test(s)) return /,\d/.test(s);   // 1.234,56 → sim · 1.234 → não
      if (NUM.US_GROUPED.test(s)) return /\.\d/.test(s);  // 1,234.56 → sim · 1,234 → não
      return NUM.PLAIN.test(s) && /[.,]\d/.test(s);       // 714,80 → sim · 714 → não
    }
    function _hasCurrencySym(v){
      return /(^|\s)(R\$|US\$|\$|€|£)|\b(BRL|USD|EUR|GBP)\b/i.test(String(v));
    }

    // Auditoria 2026 (B-03 / A-302): JS interpreta `new Date("01/02/2024")` como
    // mm/dd (US). No Brasil é dd/mm. Esta família de helpers garante o parse
    // pt-BR correto e expõe `toDate` para todo o resto do app usar.
    function _parseBR(s){
      // Espera exatamente dd/mm/aaaa. Retorna Date inválida se valores forem absurdos.
      const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return null;
      const d = +m[1], mo = +m[2], y = +m[3];
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      const dt = new Date(y, mo - 1, d);
      // Sanity: new Date(2024, 1, 30) "normaliza" para 1 de março — rejeita.
      if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
      return dt;
    }
    function toDate(v){
      if (v instanceof Date) return v;
      const br = _parseBR(v);
      if (br) return br;
      return new Date(v);
    }
    /** Decide se uma amostra de strings dd/mm/aaaa deve ser tratada como pt-BR.
     *  Regra: se QUALQUER valor tem dia > 12 (impossível em mm/dd), fixa BR.
     *  Default seguro: na ausência de evidência contrária, assume BR (locale do app). */
    function isLikelyBRDateColumn(values){
      let hasBRMarker = false;
      for (const v of values){
        const m = String(v||'').trim().match(/^(\d{2})\/(\d{2})\/\d{4}$/);
        if (!m) continue;
        const a = +m[1], b = +m[2];
        if (a > 12) { hasBRMarker = true; break; }    // a é dia → BR confirmado
        if (b > 12) { return false; }                 // b é dia → mm/dd (US)
      }
      return hasBRMarker || true; // sem evidência: BR é o default do Solstice
    }

    /**
     * Catálogo dos 30 tipos. Cada tipo: detect(v) -> bool; validate(v) -> bool;
     * aggs -> array (sum/avg/min/max/count/uniqueCount/median/p95...); viz -> array (kpi/line/bar/...).
     */
    const TYPES = {
      // === NUMÉRICOS ===
      // Auditoria 2026.6 (BR-NUM): detect/validate via _numLike (BR/US agrupado)
      // e format/parse via SolsticeBR.toNumber. measure = numérico genérico.
      'measure':    { group:'numeric', detect: v => _numLike(v),  validate: v => _numLike(v),  aggs: ['sum','avg','min','max','median','p95','count'], format: (v,L) => L.decimal(SolsticeBR.toNumber(v),2), viz: ['kpi','line','bar','area','scatter'] },
      // Auditoria 2026 (R-01b / A-301) + 2026.6 (BR-NUM): currency exige símbolo
      // monetário (R$/$/€/£/ISO) para não confundir contagens (ex: qtd_vendas=29)
      // com dinheiro. Parse/format honram agrupador pt-BR via SolsticeBR.toNumber.
      'currency':   { group:'numeric', detect: v => _hasCurrencySym(v) && _numLike(v), validate: v => _numLike(v), aggs: ['sum','avg','min','max','median'], format: (v,L) => L.currency(typeof v==='number'?v:SolsticeBR.toNumber(v)), viz: ['kpi','bar','area','treemap'] },
      'percentage': { group:'numeric', detect: v => RX.PERCENT.test(String(v).trim()) || (typeof v==='number' && v >= 0 && v <= 1), validate: v => !isNaN(SolsticeBR.toNumber(String(v).replace('%',''))), aggs: ['avg','min','max','median'], format: (v,L) => { const n = typeof v==='number'? (v <= 1 ? v : v/100) : SolsticeBR.toNumber(String(v).replace('%',''))/100; return L.percent(n, 1); }, viz: ['kpi','line','bar','gauge'] },
      'integer':    { group:'numeric', detect: v => _numLike(v) && !_hasDecimals(v),  validate: v => _numLike(v) && !_hasDecimals(v), aggs: ['sum','avg','min','max','count','median'], format: (v,L) => L.integer(Math.round(SolsticeBR.toNumber(v))), viz: ['kpi','bar','histogram'] },
      'decimal':    { group:'numeric', detect: v => _numLike(v) && _hasDecimals(v), validate: v => _numLike(v), aggs: ['sum','avg','min','max','median','p95'], format: (v,L) => L.decimal(SolsticeBR.toNumber(v),2), viz: ['kpi','line','scatter'] },
      'duration':   { group:'numeric', detect: v => RX.DURATION.test(String(v).trim()), validate: v => true, aggs: ['sum','avg','min','max','median'], format: (v) => v, viz: ['kpi','bar','line'] },

      // === TEMPORAIS ===
      // Auditoria 2026 (B-03 / A-302): toDate substitui new Date para honrar dd/mm pt-BR.
      // Auditoria 2026.6 (DATE-LENIENT): o V8 parseia new Date("ACC-1234") de
      // forma leniente extraindo o ano → 1234-01-01, então códigos como "ACC-1234"
      // viravam 'temporal'. Datas reais começam com dígito ("2024-…", "01/02/…");
      // exigir /^\d/ barra identificadores alfanuméricos sem perder datas válidas.
      'temporal':   { group:'temporal', detect: v => { const s = String(v).trim(); return /^\d/.test(s) && /[-\/:T]/.test(s) && !isNaN(toDate(s).getTime()); }, validate: v => /^\d/.test(String(v).trim()) && !isNaN(toDate(v).getTime()), aggs: ['min','max','count'], format: (v,L) => L.datetime(toDate(v)), viz: ['line','area','calendar','timeline'] },
      'date_only':  { group:'temporal', detect: v => RX.ISO_DATE.test(String(v).trim()) || RX.BR_DATE.test(String(v).trim()), validate: v => !isNaN(toDate(v).getTime()), aggs: ['min','max','count'], format: (v,L) => L.date(toDate(v)), viz: ['line','calendar','timeline'] },
      'time_only':  { group:'temporal', detect: v => RX.ISO_TIME.test(String(v).trim()), validate: v => /^\d{2}:\d{2}/.test(String(v)), aggs: ['count'], format: v => v, viz: ['bar','clock'] },
      'timestamp':  { group:'temporal', detect: v => RX.ISO_DT.test(String(v).trim()), validate: v => !isNaN(new Date(v).getTime()), aggs: ['min','max','count'], format: (v,L) => L.datetime(new Date(v)), viz: ['line','area','timeline'] },

      // === IDENTIFICADORES ===
      'identifier': { group:'id', detect: v => /^[a-zA-Z0-9_-]{4,}$/.test(String(v).trim()) && !RX.EMAIL.test(String(v)), validate: v => String(v).length > 0, aggs: ['count','uniqueCount'], format: v => v, viz: ['table'] },
      'cpf':        { group:'id', detect: v => /^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(String(v).replace(/\s/g,'')), validate: v => SolsticeBR.isCPF(v), aggs: ['count','uniqueCount'], format: v => SolsticeBR.formatCPF(v), viz: ['table'] },
      'cnpj':       { group:'id', detect: v => /^\d{14}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(String(v).replace(/\s/g,'')), validate: v => SolsticeBR.isCNPJ(v), aggs: ['count','uniqueCount'], format: v => SolsticeBR.formatCNPJ(v), viz: ['table'] },
      'cep':        { group:'id', detect: v => /^\d{5}-?\d{3}$|^\d{8}$/.test(String(v).replace(/\s/g,'')), validate: v => SolsticeBR.isCEP(v), aggs: ['count','uniqueCount'], format: v => SolsticeBR.formatCEP(v), viz: ['table','map'] },
      'hash':       { group:'id', detect: v => RX.HEX_HASH.test(String(v).trim()) || RX.UUID.test(String(v).trim()), validate: v => true, aggs: ['count','uniqueCount'], format: v => String(v).slice(0,8)+'…', viz: ['table'] },

      // === CONTATO ===
      // S4-03 (Sprint 4): bug crítico — validate sem .trim() chamava emails
      // com espaços/quebras de "inválido" mesmo passando em detect. Falso positivo
      // queimava confiança do usuário. Sincronizado com detect (ambos .trim()).
      'email':      { group:'contact', detect: v => RX.EMAIL.test(String(v).trim()), validate: v => RX.EMAIL.test(String(v).trim()), aggs: ['count','uniqueCount'], format: v => v, viz: ['table'] },
      'phone_br':   { group:'contact', detect: v => RX.PHONE_BR.test(String(v).trim()), validate: v => RX.PHONE_BR.test(String(v).trim()), aggs: ['count'], format: v => v, viz: ['table'] },
      'phone_intl': { group:'contact', detect: v => RX.PHONE_INTL.test(String(v).trim()), validate: v => RX.PHONE_INTL.test(String(v).trim()), aggs: ['count'], format: v => v, viz: ['table'] },
      'url':        { group:'contact', detect: v => RX.URL.test(String(v).trim()), validate: v => RX.URL.test(String(v).trim()), aggs: ['count','uniqueCount'], format: v => v, viz: ['table'] },

      // === GEOGRÁFICOS ===
      // S4-03: o bug reportado pelo usuário ("regiao: 200 inválidos (tipo geo_uf)" — falso!) era exatamente aqui.
      'geo_uf':      { group:'geo', detect: v => RX.UF_BR.test(String(v).trim()), validate: v => RX.UF_BR.test(String(v).trim()), aggs: ['count','uniqueCount'], format: v => String(v).toUpperCase(), viz: ['map','bar'] },
      'geo_country': { group:'geo', detect: v => /^[A-Z]{2,3}$/.test(String(v).trim()) || /^(brasil|brazil|argentina|chile|mexico|estados unidos|usa|portugal)$/i.test(String(v).trim()), validate: v => true, aggs: ['count','uniqueCount'], format: v => v, viz: ['map','bar'] },
      // Auditoria 2026.6 (BR-NUM): guard contra vírgula — "1.403,70" (preço BR)
      // tinha parseFloat=1.403, caía na faixa de latitude e era detectado como
      // geo_lat. Coordenadas não usam vírgula decimal, então !/,/ as exclui.
      'geo_lat':     { group:'geo', detect: v => !/,/.test(String(v)) && /\./.test(String(v)) && _isLat(v), validate: v => _isLat(v), aggs: ['min','max'], format: (v,L) => L.decimal(parseFloat(v),5), viz: ['map','scatter'] },
      'geo_lng':     { group:'geo', detect: v => !/,/.test(String(v)) && /\./.test(String(v)) && _isLng(v), validate: v => _isLng(v), aggs: ['min','max'], format: (v,L) => L.decimal(parseFloat(v),5), viz: ['map','scatter'] },
      'address':     { group:'geo', detect: v => /\b(rua|av|avenida|alameda|travessa|praça|rod|rodovia)\b/i.test(String(v)) && String(v).length > 12, validate: v => true, aggs: ['count'], format: v => v, viz: ['table'] },

      // === ESTRUTURADOS ===
      'json_encoded':  { group:'struct', detect: v => RX.JSON.test(String(v).trim()) && (() => { try { JSON.parse(v); return true; } catch(e){ return false; } })(), validate: v => { try { JSON.parse(v); return true; } catch(e){ return false; } }, aggs: ['count'], format: v => String(v).slice(0,40)+'…', viz: ['table'] },
      'array_encoded': { group:'struct', detect: v => /^\[.*\]$/.test(String(v).trim()) && (() => { try { return Array.isArray(JSON.parse(v)); } catch(e){ return false; } })(), validate: v => { try { return Array.isArray(JSON.parse(v)); } catch(e){ return false; } }, aggs: ['count'], format: v => v, viz: ['table'] },
      'xml_encoded':   { group:'struct', detect: v => /^\s*<\?xml|^\s*<[a-zA-Z]/.test(String(v)) && /<\/[a-zA-Z]+>/.test(String(v)), validate: v => true, aggs: ['count'], format: v => String(v).slice(0,40)+'…', viz: ['table'] },

      // === CATEGÓRICOS ===
      // S4-03: sincronia detect/validate
      'flag':      { group:'cat', detect: v => RX.BOOL.test(String(v).trim()), validate: v => RX.BOOL.test(String(v).trim()), aggs: ['count','uniqueCount'], format: v => /^(true|sim|yes|1|t|y)$/i.test(String(v)) ? '✓' : '✗', viz: ['kpi','bar','donut'] },
      'dimension': { group:'cat', detect: v => typeof v === 'string' && v.length > 0 && v.length < 100, validate: v => true, aggs: ['count','uniqueCount','mode'], format: v => v, viz: ['bar','donut','treemap','table'] },
      'ordinal':   { group:'cat', detect: v => /^(baixo|m[eé]dio|alto|cr[ií]tico|p[eé]ssimo|ruim|bom|[oó]timo|excelente|low|med(ium)?|high|critical|small|large|xs|s|m|l|xl|xxl)$/i.test(String(v).trim()), validate: v => true, aggs: ['count','uniqueCount','mode','median'], format: v => v, viz: ['bar','heatmap'] },

      // === ESPECIAIS ===
      'sparse':   { group:'special', detect: () => false, validate: v => v == null || v === '', aggs: ['count'], format: () => '—', viz: [] },
      'constant': { group:'special', detect: () => false, validate: v => true, aggs: ['count'], format: v => v, viz: [] }
    };

    /**
     * Infere o tipo dominante de uma coluna a partir de uma amostra de valores.
     * Estratégia: testa cada tipo na amostra; tipo com maior "hit ratio" ganha.
     * Tipos especiais (sparse/constant) detectados primeiro por meta-análise.
     */
    function inferColumn(values, columnName, ctx){
      // Auditoria 2026.6 (BIG-DATA-PERF): passada ÚNICA. Antes:
      //   values.filter(...) alocava um array de TODOS os não-vazios (até 500k)
      //   por coluna × 50 colunas = churn de memória enorme em base grande.
      // Agora: 1 loop conta filledFull (contagem REAL, p/ o ratio de sparse) e
      // coleta só os 200 primeiros não-vazios pra amostra. Aloca um array de 200,
      // não de 500k. Semântica idêntica.
      const total = values.length || 1;
      const sample = [];
      let filledFull = 0;
      for (let i = 0; i < values.length; i++){
        const v = values[i];
        if (v == null || v === '') continue;
        filledFull++;
        if (sample.length < 200) sample.push(v);
      }
      const filled = sample.length;
      // Auditoria 2026.6 (BIG-DATA-SPARSE): filledFull é a contagem real de
      // não-vazios. ANTES, filled(≤200)/total fazia QUALQUER dataset >~4000
      // linhas ser classificado 'sparse' (vazio) → sem tipos, sem métricas.

      // 1) Especiais
      if (filledFull === 0) return { type: 'sparse', confidence: 1, ratio: { nulls: 1 } };
      if (filledFull / total < 0.05) return { type: 'sparse', confidence: 0.95, ratio: { nulls: 1 - filledFull/total } };
      const unique = new Set(sample.map(String));
      if (unique.size === 1) return { type: 'constant', confidence: 1, ratio: { uniques: 1 } };

      // 0-pre) Auditoria 2026.6 (DATE-WINS): se os valores são claramente datas
      // (BR dd/mm/aaaa ou ISO), o tipo é temporal — ponto. Não deixa a inferência
      // semântica por NOME sobrescrever (ex: "mes"→duration com conf 0.3 fazia uma
      // coluna de datas virar duração e o dashboard perdia a série temporal).
      const _dateHits = sample.filter(v => { const s = String(v).trim(); return RX.BR_DATE.test(s) || RX.ISO_DATE.test(s) || RX.ISO_DT.test(s); }).length;
      if (_dateHits / filled >= 0.7){
        const onlyDate = sample.every(v => { const s = String(v).trim(); return RX.BR_DATE.test(s) || RX.ISO_DATE.test(s); });
        return { type: onlyDate ? 'date_only' : 'temporal', confidence: _dateHits / filled, ratio: { nulls: 1 - filledFull/total, uniques: unique.size / filled } };
      }

      // 0) ADR-176 (Onda 0): se nome da coluna foi passado E SolsticeInference
      //    existe, tenta inferência semântica PRIMEIRO. Engine novo tem 92% acc
      //    no golden test contra ~50% da heurística antiga (regex por nome).
      //    Se Inference retorna com confidence >= 0.3 (não-fallback), usa.
      //    Senão cai pra detecção por valor (TYPES[t].detect) abaixo.
      if (columnName && typeof SolsticeInference !== 'undefined' && SolsticeInference.inferColumn){
        try {
          const infResult = SolsticeInference.inferColumn(columnName, sample, ctx || {});
          // Auditoria 2026.6 (NUMERIC-NOT-ORDINAL): a inferência por NOME às vezes
          // marca uma coluna NUMÉRICA como 'ordinal' (ex: "nota" 0-10 virava
          // categórica e deixava de ser MÉTRICA — quebrava KPI e o Ask "nota por
          // central"). Número é medida: se a amostra é majoritariamente numérica,
          // ignora o resultado ordinal e cai na detecção por valor (→ integer/measure).
          const _numRatio = sample.filter(v => _numLike(v)).length / filled;
          const _badOrdinal = infResult.type === 'ordinal' && _numRatio >= 0.8;
          if (!infResult.fallback_used && infResult.confidence >= 0.3 && !_badOrdinal){
            return {
              type: infResult.type,
              confidence: infResult.confidence,
              concept: infResult.winner,
              ratio: { nulls: 1 - filledFull/total, uniques: unique.size / filled },
              source: 'inference',
              audit: infResult
            };
          }
          // Se fallback ou conf baixa, continua pra detecção por valor mas
          // preserva o audit pra UI.
        } catch (e){ SolsticeLog.debug('[Types.inferColumn] Inference falhou, usando fallback:', e); }
      }

      // 2) Testa cada tipo
      const scores = {};
      const ORDER = [
        'cpf','cnpj','cep',                               // estritos antes
        'email','url','phone_br','phone_intl',
        'uuid','hash',
        'timestamp','temporal','date_only','time_only',
        'currency','percentage','duration','geo_lat','geo_lng','geo_uf','geo_country',
        'json_encoded','array_encoded','xml_encoded',
        'integer','decimal','measure',
        'flag','ordinal','address',
        'identifier','dimension'
      ];
      for (const t of ORDER){
        const def = TYPES[t]; if (!def || !def.detect) continue;
        let hits = 0;
        for (const v of sample){
          try { if (def.detect(v)) hits++; } catch(e){}
        }
        scores[t] = hits / sample.length;
      }

      // 3) Tipo dominante (threshold 0.7)
      let best = 'dimension', bestScore = 0;
      for (const t in scores){
        if (scores[t] > bestScore && scores[t] >= 0.7){
          best = t; bestScore = scores[t];
        }
      }

      // 4) Refinamento para numérico: se foi detectado como currency mas só 50%, cai pra measure
      if (best === 'dimension' && scores['integer'] >= 0.5) best = 'integer';
      if (best === 'dimension' && scores['decimal'] >= 0.5) best = 'decimal';

      // 4b) Auditoria 2026.6 (GEO-NAME + GEO-FALSEPOS): latitude/longitude colidem
      // por valor com qualquer decimal pequeno (0–1, -90..90) — ex: profit_margin
      // "0.50" virava geo_lat — e -73 é válido como lat e lng. Só aceita geo quando
      // o NOME confirma; senão rebaixa pro tipo numérico que casaria. Com nome geo,
      // desambigua lat × lng.
      if (best === 'geo_lat' || best === 'geo_lng'){
        const ln = String(columnName || '').toLowerCase();
        const geoName = /lat|lon|lng|longitude|coord|geo/.test(ln);
        if (!geoName){
          best = scores['decimal'] >= 0.5 ? 'decimal' : (scores['measure'] >= 0.5 ? 'measure' : 'dimension');
        } else if (/\blng\b|\blon\b|longitude/.test(ln)){ best = 'geo_lng'; }
        else { best = 'geo_lat'; }
      }

      // 4b2) Auditoria 2026.6 (NUM-ID): coluna NUMÉRICA com nome de identificador/
      // código (num_conta, agência, anomes, funcional, cpf, ddd…) NÃO é métrica.
      // Reclassifica como 'identifier' AQUI, na fonte — assim nenhum lugar (KPI,
      // sankey, boxplot, Ask, suggest* do Stats) a soma/grafica como medida. Em
      // base bancária/CRM real isso eliminava dashboards como kpi[num_agencia:sum].
      // (Se a cardinalidade for baixa, o passo 4c abaixo rebaixa pra dimensão.)
      if (['integer','decimal','measure'].includes(best)){
        const lc = String(columnName || '').toLowerCase();
        if (/^id$|_id$|^id_|id_|^c[oó]d|c[oó]digo|^seq|matr[ií]cula|protocolo|cpf|cnpj|cep|^num|_num|n[uú]mero|ag[eê]ncia|^conta$|_conta$|^pv$|_pv$|carteira|dicom|funcional|chpras|anomes|anomesdia|telefone|^ddd|cod_|_cod/.test(lc)){
          best = 'identifier';
        }
      }

      // 4c) Auditoria 2026.6 (ID-CARDINALITY): identificador é quase-único (CPF,
      // código). Texto curto repetido ("West", "Ativo", "Online") casava no detect
      // ganancioso de identifier (vinha antes de dimension na ordem). Se a coluna
      // repete muito (cardinalidade baixa), é dimensão, não identificador.
      if (best === 'identifier' && filled > 0 && (unique.size / filled) < 0.85){
        best = 'dimension';
      }

      // 4d) Auditoria 2026.6 (GEO-COUNTRY-FALSEPOS): geo_country casa qualquer
      // string de 2-3 letras maiúsculas — ex: "PF"/"PJ" (tipo_pessoa) virava País.
      // Só aceita país quando o NOME sugere (pais/country/nacion); senão dimensão.
      if (best === 'geo_country'){
        const ln = String(columnName || '').toLowerCase();
        if (!/pa[ií]s|country|nacion|na[cç][aã]o/.test(ln)) best = 'dimension';
      }

      return {
        type: best,
        confidence: bestScore || (best === 'dimension' ? 0.5 : 0),
        ratio: { nulls: 1 - filledFull/total, uniques: unique.size / filled },
        alternatives: Object.entries(scores).filter(([,s]) => s >= 0.3).sort((a,b)=>b[1]-a[1]).slice(0,3)
      };
    }

    function listTypes(){ return Object.keys(TYPES); }
    function getType(name){ return TYPES[name]; }

    /* ===== Apresentação pt-BR (Bloco 2 — correção pós-entrega) ===== */
    const TYPE_LABELS_PT = {
      measure:      'Medida',
      currency:     'Moeda',
      percentage:   'Percentual',
      integer:      'Inteiro',
      decimal:      'Decimal',
      duration:     'Duração',
      temporal:     'Data/Hora',
      date_only:    'Data',
      time_only:    'Hora',
      timestamp:    'Timestamp',
      identifier:   'Identificador',
      cpf:          'CPF',
      cnpj:         'CNPJ',
      cep:          'CEP',
      hash:         'Hash',
      email:        'E-mail',
      phone_br:     'Telefone',
      phone_intl:   'Telefone Internacional',
      url:          'URL',
      geo_uf:       'UF',
      geo_country:  'País',
      geo_lat:      'Latitude',
      geo_lng:      'Longitude',
      address:      'Endereço',
      json_encoded: 'JSON',
      array_encoded:'Lista',
      xml_encoded:  'XML',
      flag:         'Sim/Não',
      dimension:    'Dimensão',
      ordinal:      'Ordinal',
      sparse:       'Esparsa',
      constant:     'Constante'
    };

    const TYPE_ICONS = {
      measure: '📏', currency: '💰', percentage: '％', integer: '🔢', decimal: '🔣', duration: '⏱️',
      temporal: '📅', date_only: '📅', time_only: '🕐', timestamp: '🕓',
      identifier: '🔑', cpf: '🆔', cnpj: '🏢', cep: '📮', hash: '#️⃣',
      email: '✉️', phone_br: '📞', phone_intl: '🌐', url: '🔗',
      geo_uf: '🗺️', geo_country: '🌎', geo_lat: '↕️', geo_lng: '↔️', address: '🏠',
      json_encoded: '🧬', array_encoded: '📋', xml_encoded: '📄',
      flag: '✓', dimension: '🏷️', ordinal: '📊',
      sparse: '○', constant: '＝'
    };

    /** Mapeia tipo → grupo simplificado para uso visual (4 buckets). */
    function group(type){
      const def = TYPES[type];
      if (!def) return 'special';
      const g = def.group;
      if (g === 'numeric' || g === 'temporal') return g;
      if (g === 'special') return 'special';
      // id, contact, geo, struct, cat → todos viram "categorical" para alinhamento na tabela
      return 'categorical';
    }

    function label(type){ return TYPE_LABELS_PT[type] || type; }
    function icon(type){  return TYPE_ICONS[type]      || '·';  }

    /**
     * Patch 1A (ADR-110): userGroup — 7 grupos semânticos voltados ao usuário.
     * measure · dimension · ordinal · temporal · id · contact · geo.
     * Distingue ID-numérico de measure real via cardinalityRatio>0.95 do typeMeta.
     */
    const USER_GROUPS = {
      'measure':   { label:'Medida',        icon:'📊', color:'success',
                     desc:'Valor numérico para somar, calcular média, etc.',
                     axisX:false, axisY:true,  aggregate:true  },
      'dimension': { label:'Dimensão',      icon:'🏷️', color:'info',
                     desc:'Categoria para agrupar e fatiar os dados.',
                     axisX:true,  axisY:false, aggregate:false },
      'ordinal':   { label:'Classificação', icon:'🎚️', color:'info',
                     desc:'Categoria com ordem (P/M/G, baixo/médio/alto).',
                     axisX:true,  axisY:false, aggregate:false },
      'temporal':  { label:'Data/Hora',     icon:'📅', color:'accent',
                     desc:'Para análise temporal — vai no eixo X.',
                     axisX:true,  axisY:false, aggregate:false },
      'id':        { label:'Identificador', icon:'🔑', color:'muted',
                     desc:'CPF, CNPJ, código único — não agregar.',
                     axisX:false, axisY:false, aggregate:false },
      'contact':   { label:'Contato',       icon:'📧', color:'muted',
                     desc:'E-mail, telefone, URL.',
                     axisX:false, axisY:false, aggregate:false },
      'geo':       { label:'Geográfico',    icon:'🗺️', color:'warn',
                     desc:'Latitude, longitude, endereço.',
                     axisX:false, axisY:false, aggregate:false }
    };

    function userGroup(type, columnMeta){
      const def = TYPES[type];
      if (!def) return 'dimension';
      const g = def.group;
      if (g === 'numeric'){
        // ID-numérico via cardinalidade alta (proxy de identifier)
        if (type === 'integer' && columnMeta && columnMeta.cardinalityRatio != null && columnMeta.cardinalityRatio > 0.95) return 'id';
        return 'measure';
      }
      if (g === 'temporal') return 'temporal';
      if (g === 'id') return 'id';
      if (g === 'contact') return 'contact';
      if (g === 'geo') return 'geo';
      if (type === 'ordinal') return 'ordinal';
      return 'dimension';
    }

    // Auditoria 2026 (B-03 / A-302): toDate e isLikelyBRDateColumn expostos
    // para Insights/Analysis/Editor usarem em vez de `new Date(v)` direto.
    return { TYPES, inferColumn, listTypes, getType, label, icon, group, userGroup, USER_GROUPS, _RX: RX, toDate, isLikelyBRDateColumn };
  })();
