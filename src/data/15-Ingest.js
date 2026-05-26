
  /* ============================================================
     SolsticeIngest — pipeline de 5 etapas
        detect → parse → infer → validate → enrich
     ============================================================ */
  const SolsticeIngest = (function(){

    // Polish v7: caracteres invisiveis montados via fromCharCode para evitar
    // que o source-code do dashboard contenha BOM/NBSP/ZWSP literais (que confundem
    // editores e tooling). U+FEFF U+00A0 U+200B-200D U+2060 U+FFFD.
    const INVISIBLE_CHARS_RX = new RegExp(
      '[' + String.fromCharCode(0xFEFF,0x00A0,0x200B,0x200C,0x200D,0x2060,0xFFFD) + ']',
      'g'
    );
    function _stripInvisible(s){ return String(s == null ? '' : s).replace(INVISIBLE_CHARS_RX, ''); }
    function _hasInvisible(s){
      // RegExp /g e stateful - reset antes de testar para evitar falso negativo entre chamadas
      INVISIBLE_CHARS_RX.lastIndex = 0;
      return INVISIBLE_CHARS_RX.test(String(s == null ? '' : s));
    }

    /** Detecta dialeto (separador, quote, line ending, has header) por análise estatística.
     *  Prompt 3 v5.4: normaliza BOM no início do texto ANTES de qualquer split para
     *  evitar contaminar o nome da primeira coluna (caso BOM+"cnpj" → "cnpj"). */
    function detectDialect(text){
      text = String(text || '').replace(/^\uFEFF/, '');
      const sample = text.slice(0, 16384);   // 16KB amostra
      const lines = sample.split(/\r?\n/).filter(l => l.length > 0);
      if (!lines.length) return null;
      const head = lines.slice(0, Math.min(50, lines.length));

      // Conta ocorrências dos delimitadores comuns por linha
      const candidates = [',', ';', '\t', '|'];
      let bestDelim = ','; let bestScore = -1;
      for (const d of candidates){
        const counts = head.map(l => (l.match(new RegExp('\\'+d, 'g')) || []).length);
        const avg = counts.reduce((a,b)=>a+b,0) / counts.length;
        if (avg < 1) continue;
        // Variância baixa = bom (todas linhas têm mesma quantidade de delim)
        const variance = counts.reduce((s,c) => s + (c - avg)**2, 0) / counts.length;
        const score = avg / (1 + variance);
        if (score > bestScore){ bestScore = score; bestDelim = d; }
      }

      // Heurística has_header: primeira linha tem >50% de campos não-numéricos?
      const firstFields = head[0].split(bestDelim);
      const numericInHead = firstFields.filter(f => SolsticeTypes._RX.DECIMAL.test(f.trim())).length;
      const hasHeader = numericInHead / firstFields.length < 0.5;

      // Detecta line ending
      const eol = /\r\n/.test(sample) ? '\r\n' : '\n';

      return { delimiter: bestDelim, quote: '"', eol, hasHeader, confidence: Math.min(1, bestScore / 3) };
    }

    /** Parse usando PapaParse se disponível, fallback manual.
     *  Prompt 3 v5.4: pós-processa column names para limpar BOM e outros
     *  caracteres invisíveis que escaparam do detectDialect (PapaParse pode
     *  preservar BOM em ambientes onde detectDialect só leu primeiros 16KB
     *  e o BOM estava num bloco diferente). Também rastreia quais nomes
     *  tinham caracteres invisíveis para que o Quality card mostre warning. */
    function _cleanColumnNames(columns){
      const dirty = [];
      const cleaned = (columns || []).map(c => {
        const orig = String(c == null ? '' : c);
        if (_hasInvisible(orig)){
          dirty.push(orig);
          return _stripInvisible(orig).trim();
        }
        return orig;
      });
      // Auditoria 2026 (M-I-1 / A-303): detecta duplicados e vazios.
      // Antes: CSV com headers "id,id,total" ou "id,,valor" passava sem
      // aviso e o Editor mostrava 2× "id" indistinguíveis. Agora:
      // - Coluna vazia vira "col_N" (índice 1-based).
      // - Duplicada vira "<nome> (2)", "<nome> (3)", … na ordem.
      const duplicated = [];
      const empties = [];
      const seen = new Map();
      for (let i = 0; i < cleaned.length; i++){
        const trimmed = (cleaned[i] || '').trim();
        if (trimmed === ''){
          cleaned[i] = 'col_' + (i + 1);
          empties.push(i + 1);
          continue;
        }
        const count = seen.get(trimmed) || 0;
        if (count === 0){
          seen.set(trimmed, 1);
        } else {
          duplicated.push(trimmed);
          cleaned[i] = trimmed + ' (' + (count + 1) + ')';
          seen.set(trimmed, count + 1);
        }
      }
      return { cleaned, dirty, duplicated, empties };
    }

    // Auditoria 2026 (B-02 / A-402): parseText agora retorna Promise para
    // permitir `worker: true` em Papa.parse — CSVs grandes não bloqueiam mais
    // a thread principal. Chamadores devem usar `await parseText(...)`.
    //
    // PL-01 (Sprint 2): parseText agora aceita opts.onProgress(rowsParsed) para
    // streaming. CSVs > 5MB usam Papa.parse com chunk callback (Worker mode
    // não suporta chunk; usa main thread mas com chunkSize razoável).
    // Arquivos pequenos continuam no Worker (mais rápido, sem overhead).
    function parseText(text, dialect, opts){
      opts = opts || {};
      const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
      const LARGE_THRESHOLD = 5 * 1024 * 1024; // 5MB

      if (typeof Papa !== 'undefined'){
        return new Promise((resolve, reject) => {
          const isLarge = text.length >= LARGE_THRESHOLD;
          // Worker mode não suporta chunk. Se quero progresso E é grande,
          // desliga worker e habilita chunk. Arquivo pequeno: worker mode.
          const useStreaming = isLarge && !!onProgress;
          const cfg = {
            delimiter: dialect.delimiter,
            header: dialect.hasHeader,
            skipEmptyLines: true,
            dynamicTyping: false,
            worker: !useStreaming,
            complete: (res) => {
              const rawColumns = dialect.hasHeader ? res.meta.fields : (res.data[0] && Object.keys(res.data[0]));
              const { cleaned, dirty } = _cleanColumnNames(rawColumns);
              let rows = res.data;
              if (dirty.length && dialect.hasHeader && rawColumns){
                const map = {};
                rawColumns.forEach((c, i) => { map[c] = cleaned[i]; });
                rows = res.data.map(r => {
                  const out = {};
                  for (const k in r) out[map[k] || k] = r[k];
                  return out;
                });
              }
              resolve({ rows, columns: cleaned, errors: res.errors, dirtyColumnNames: dirty });
            },
            error: (err) => reject(err)
          };
          if (useStreaming){
            // Streaming: ~1MB chunks, callback de progresso por chunk parseado.
            let accRows = 0;
            const accAll = [];
            let errAll = [];
            cfg.chunkSize = 1024 * 1024;
            cfg.chunk = (results) => {
              accRows += results.data.length;
              if (results.data && results.data.length) accAll.push(...results.data);
              if (results.errors && results.errors.length) errAll.push(...results.errors);
              try { onProgress(accRows); } catch(_){}
            };
            cfg.complete = () => {
              // No chunk mode, res.data está vazio — usamos accAll
              const firstRow = accAll[0];
              const rawColumns = dialect.hasHeader
                ? (firstRow ? Object.keys(firstRow) : [])
                : (firstRow ? Object.keys(firstRow) : []);
              const { cleaned, dirty } = _cleanColumnNames(rawColumns);
              let rows = accAll;
              if (dirty.length && dialect.hasHeader && rawColumns){
                const map = {};
                rawColumns.forEach((c, i) => { map[c] = cleaned[i]; });
                rows = accAll.map(r => {
                  const out = {};
                  for (const k in r) out[map[k] || k] = r[k];
                  return out;
                });
              }
              resolve({ rows, columns: cleaned, errors: errAll, dirtyColumnNames: dirty });
            };
          }
          Papa.parse(text, cfg);
        });
      }
      // Fallback manual mínimo (CSV simples sem aspas escapadas em multi-linha)
      // Mantido síncrono mas envolto em Promise.resolve para uniformidade.
      const lines = text.split(/\r?\n/).filter(l => l.length > 0);
      const splitLine = (l) => {
        const out = []; let cur = ''; let inQ = false;
        for (let i = 0; i < l.length; i++){
          const c = l[i];
          if (c === '"' && l[i+1] === '"'){ cur += '"'; i++; }
          else if (c === '"') inQ = !inQ;
          else if (c === dialect.delimiter && !inQ){ out.push(cur); cur = ''; }
          else cur += c;
        }
        out.push(cur);
        return out;
      };
      let rawColumns; let dataLines;
      if (dialect.hasHeader){ rawColumns = splitLine(lines[0]); dataLines = lines.slice(1); }
      else { rawColumns = splitLine(lines[0]).map((_,i) => 'col_'+(i+1)); dataLines = lines; }
      // Prompt 3: limpa nomes de coluna no fallback manual também
      const { cleaned: columns, dirty } = _cleanColumnNames(rawColumns);
      const rows = dataLines.map(l => {
        const fields = splitLine(l);
        const obj = {};
        columns.forEach((c, i) => obj[c] = fields[i] != null ? fields[i] : '');
        return obj;
      });
      return Promise.resolve({ rows, columns, errors: [], dirtyColumnNames: dirty });
    }

    /** Infere tipo de cada coluna.
        ADR-176 (Onda 0): passa NOME da coluna + ctx pra ativar SolsticeInference. */
    function inferColumns(rows, columns){
      const out = {};
      const ctx = { columns: columns, domain: null };
      // Detecta domínio uma vez (custo: 1 chamada por dataset, não por coluna)
      try {
        if (typeof SolsticeDomain !== 'undefined' && SolsticeDomain.detectDomain){
          const det = SolsticeDomain.detectDomain({ columns });
          if (det.confidence >= 40) ctx.domain = det.domain;
        }
      } catch(_){}
      for (const col of columns){
        const values = rows.map(r => r[col]);
        out[col] = SolsticeTypes.inferColumn(values, col, ctx);
      }
      return out;
    }

    /** Valida cada célula contra o tipo inferido. */
    function validate(rows, columns, types){
      const issues = { byColumn: {}, total: 0 };
      const N = rows.length;
      // Auditoria 2026.6 (BIG-DATA-PERF): validade é uma % estatística. Em base
      // grande, validar TODAS as células (N×colunas; 500k×50 = 25M chamadas de
      // regex) trava por segundos. Amostra uniforme de até 50k linhas e reescala
      // as contagens pro total — erro desprezível (<0.5pp) e ~10× mais rápido.
      // Base pequena (≤50k) continua exata (step=1, scale=1).
      const CAP = 50000;
      const sampledN = N > CAP ? CAP : N;
      const step = N > CAP ? N / CAP : 1;
      const scale = sampledN > 0 ? N / sampledN : 1;
      for (const col of columns){
        const def = SolsticeTypes.getType(types[col].type);
        if (!def || !def.validate) continue;
        let invalid = 0; let nulls = 0;
        for (let s = 0; s < sampledN; s++){
          const v = rows[step === 1 ? s : Math.floor(s * step)][col];
          if (v == null || v === ''){ nulls++; continue; }
          try { if (!def.validate(v)) invalid++; } catch(e){ invalid++; }
        }
        if (step !== 1){ invalid = Math.round(invalid * scale); nulls = Math.round(nulls * scale); }
        issues.byColumn[col] = { invalid, nulls, total: N };
        issues.total += invalid;
      }
      return issues;
    }

    /** Enriquecimento final: aplica dicionário detectado + agrega metadados. */
    function enrich(rows, columns, types, issues){
      const detection = SolsticeDictionary.detect(columns);
      return {
        rows, columns, types, issues,
        dictDetection: detection,
        meta: { rowsCount: rows.length, columnsCount: columns.length }
      };
    }

    /** Prompt 2 v5.4 — Detecção de encoding sobre primeiros 64KB do ArrayBuffer.
     *  Estratégia:
     *    1. Detecta BOM (UTF-8/UTF-16LE/UTF-16BE) — alta confiança (>= 0.95)
     *    2. Sem BOM: tenta TextDecoder('utf-8', { fatal: true })
     *       - Se passa: utf-8 (confiança 0.85+, ajustada por densidade de não-ASCII)
     *       - Se falha: assume windows-1252 (Latin-1 superset; confiança 0.7)
     *    3. Adicional: se UTF-8 passou mas detecta padrões típicos de mojibake
     *       (Ã£, Ã©, Ã§, Ã¡, Ãª, Ã³, Ã§, etc) >1% das ocorrências → confiança cai pra <0.7
     *       e sugere latin-1
     *  Retorna { encoding, confidence, hasBOM, sourceBytes, mojibakeRate }.
     *  Performance: roda em <50ms pra 64KB, escala O(n) com tamanho da amostra. */
    function detectEncoding(arrayBuffer){
      const bytes = new Uint8Array(arrayBuffer);
      const sampleSize = Math.min(bytes.length, 65536);
      const sample = bytes.subarray(0, sampleSize);

      // 1. BOM detection
      if (sample.length >= 3 && sample[0] === 0xEF && sample[1] === 0xBB && sample[2] === 0xBF){
        return { encoding: 'utf-8', confidence: 0.99, hasBOM: true, sourceBytes: bytes.length, mojibakeRate: 0 };
      }
      if (sample.length >= 2 && sample[0] === 0xFF && sample[1] === 0xFE){
        return { encoding: 'utf-16le', confidence: 0.99, hasBOM: true, sourceBytes: bytes.length, mojibakeRate: 0 };
      }
      if (sample.length >= 2 && sample[0] === 0xFE && sample[1] === 0xFF){
        return { encoding: 'utf-16be', confidence: 0.99, hasBOM: true, sourceBytes: bytes.length, mojibakeRate: 0 };
      }

      // 2. Tentativa UTF-8 fatal
      let utf8Ok = false;
      let utf8Text = '';
      try {
        utf8Text = new TextDecoder('utf-8', { fatal: true }).decode(sample);
        utf8Ok = true;
      } catch(_) { utf8Ok = false; }

      if (utf8Ok){
        // 3. Verifica mojibake mesmo em UTF-8 "válido"
        // Padrões típicos quando Latin-1 é interpretado como UTF-8:
        //   Ã£ → ã, Ã© → é, Ã§ → ç, Ãª → ê, Ã¡ → á, Ã³ → ó, Ã­ → í, Ãº → ú, Ã  → à
        const mojibakeRegex = /Ã[£©§ª¡³­º ²¢¬®¼½]/g;
        const matches = (utf8Text.match(mojibakeRegex) || []).length;
        const sampleChars = utf8Text.length || 1;
        const mojibakeRate = matches / sampleChars;
        if (mojibakeRate > 0.01){
          // >1% de padrões de mojibake → quase certamente é latin-1 lido como utf-8
          return {
            encoding: 'windows-1252', confidence: 0.65, hasBOM: false,
            sourceBytes: bytes.length, mojibakeRate, _utf8WasValid: true
          };
        }
        // Confiança baseada em densidade de chars não-ASCII (mais não-ASCII = mais certeza)
        let nonAscii = 0;
        for (let i = 0; i < sampleChars; i++){
          if (utf8Text.charCodeAt(i) > 127) nonAscii++;
        }
        const nonAsciiRate = nonAscii / sampleChars;
        // Tudo ASCII: pode ser qualquer encoding compat-ASCII, mas utf-8 é seguro (confiança alta)
        // Algum não-ASCII válido: muito provável utf-8 real
        const confidence = nonAsciiRate < 0.001 ? 0.90 : (nonAsciiRate > 0.02 ? 0.95 : 0.88);
        return {
          encoding: 'utf-8', confidence, hasBOM: false,
          sourceBytes: bytes.length, mojibakeRate: 0
        };
      }

      // 4. UTF-8 falhou → windows-1252 (Latin-1 superset, dominante em sistemas legacy)
      return {
        encoding: 'windows-1252', confidence: 0.75, hasBOM: false,
        sourceBytes: bytes.length, mojibakeRate: 0
      };
    }

    /** Prompt 2: decodifica ArrayBuffer com o encoding dado (ou auto).
     *  Remove BOM final do texto (BOM já é "consumido" pelo encoding mas pode sobrar). */
    function decodeBytes(arrayBuffer, encoding){
      try {
        const td = new TextDecoder(encoding || 'utf-8', { fatal: false });
        let text = td.decode(arrayBuffer);
        // Remove BOM trailing (TextDecoder geralmente já remove, mas dupla checagem)
        text = text.replace(/^\uFEFF/, '');
        return text;
      } catch(err){
        // Encoding inválido → fallback utf-8
        const td = new TextDecoder('utf-8', { fatal: false });
        return td.decode(arrayBuffer).replace(/^\uFEFF/, '');
      }
    }

    /** Auditoria 2026.6 (JSON-IMPORT): o menu Importar→JSON e o README prometem
     *  JSON, mas run() só fazia CSV — um .json caía em "CSV_EMPTY". Parseia um
     *  array de objetos (ou {chave:[...]}) → { rows, columns } no mesmo formato do
     *  CSV (header:true), pra seguir o mesmo pipeline de infer/validate/enrich. */
    function _parseJSON(text){
      try {
        let data = JSON.parse(text);
        if (!Array.isArray(data)){
          const arr = data && typeof data === 'object' ? Object.values(data).find(v => Array.isArray(v)) : null;
          if (arr) data = arr;
          else if (data && typeof data === 'object') data = [data];
          else return null;
        }
        if (!data.length || typeof data[0] !== 'object' || data[0] == null) return null;
        const cols = []; const seen = new Set();
        data.forEach(o => { if (o && typeof o === 'object') Object.keys(o).forEach(k => { if (!seen.has(k)){ seen.add(k); cols.push(k); } }); });
        if (!cols.length) return null;
        const rows = data.map(o => {
          const r = {};
          cols.forEach(k => {
            let v = (o && o[k] != null) ? o[k] : '';
            if (v && typeof v === 'object') v = JSON.stringify(v);  // objetos/arrays aninhados → texto
            r[k] = v;
          });
          return r;
        });
        return { rows, columns: cols };
      } catch(e){ return null; }
    }

    /** Pipeline de PARSE de CSV (Auditoria 2026.4 / RT-09).
     *
     *  ⚠️ ATENÇÃO: `SolsticeIngest.run` ≠ `window.Solstice._runIngestFile`.
     *
     *   • `SolsticeIngest.run(file)` — só faz PARSE (PapaParse + encoding +
     *     dialect detection + inferência de tipos + validação). Retorna
     *     { rows, columns, types, ... } mas NÃO popula `Store.set('ingest')`.
     *     Use quando precisar do resultado bruto sem efeitos colaterais (ex.:
     *     testes, multi-CSV preview).
     *
     *   • `window.Solstice._runIngestFile(file)` — pipeline COMPLETA: parse
     *     + filter modal + dictionary detection + populates `Store.set('ingest')`
     *     + `dataset.ready=true` + abre Editor. Use quando o usuário faz "Importar
     *     CSV" pela UI (welcome state, sidebar "Importar", drag-drop no canvas).
     *
     *  Não unificamos os dois porque têm escopos legítimos diferentes — o parse
     *  isolado é útil em testes e em fluxos multi-CSV onde se faz preview antes
     *  de commitar pro Store. A confusão histórica era que ambos se chamavam
     *  "ingest"; agora o comentário deixa explícito.
     *
     *  Prompt 2 v5.4: agora lê o arquivo como ArrayBuffer e detecta encoding.
     *  opts.encoding (string opcional) permite override manual ('utf-8'|'windows-1252'|'utf-16le'|'utf-16be'). */
    async function run(file, opts){
      opts = opts || {};
      const onStep = opts.onStep || (() => {});

      // Auditoria 2026 (M-I-2 / A-304): pré-check de tamanho. Limite em
      // SolsticeLimits.MAX_INGEST_BYTES (default 200 MB). Pode ser sobrescrito
      // pelo usuário em Settings ou via opts.maxBytes.
      const MAX_BYTES = (typeof opts.maxBytes === 'number' && opts.maxBytes > 0)
        ? opts.maxBytes
        : ((typeof SolsticeLimits !== 'undefined' && SolsticeLimits.MAX_INGEST_BYTES) || 200 * 1024 * 1024);
      if (file && typeof file.size === 'number' && file.size > MAX_BYTES){
        const mb = (file.size / (1024 * 1024)).toFixed(0);
        const maxMb = (MAX_BYTES / (1024 * 1024)).toFixed(0);
        SolsticeToast.error(
          'Arquivo muito grande',
          'Tamanho: ' + mb + ' MB · Limite: ' + maxMb + ' MB. Aumente em ⚙️ Configurações se sua máquina suporta.'
        );
        onStep('encoding', 'error');
        return null;
      }

      // Prompt 2: lê como ArrayBuffer e detecta encoding ANTES de qualquer parse
      onStep('encoding', 'running');
      // Auditoria 2026 (R-10 / A-1004): marca dirty enquanto ingest roda
      // para o beforeunload pedir confirmação se o usuário tenta fechar.
      try { _ingestRunning = true; } catch(_){}
      const buffer = await file.arrayBuffer();
      const encDetection = opts.encoding
        ? { encoding: opts.encoding, confidence: 1.0, hasBOM: false, sourceBytes: buffer.byteLength, mojibakeRate: 0, _userOverride: true }
        : detectEncoding(buffer);
      const text = decodeBytes(buffer, encDetection.encoding);
      onStep('encoding', 'done', encDetection);

      // Auditoria 2026.6 (JSON-IMPORT): se é JSON (por extensão ou conteúdo),
      // parseia como array de objetos e segue o pipeline. Se falhar, cai no CSV.
      if (/\.json$/i.test(file.name || '') || /^\s*[\[{]/.test(text)){
        const jr = _parseJSON(text);
        if (jr){
          onStep('detect', 'done', { delimiter: 'json', confidence: 1 });
          onStep('parse', 'done', { rows: jr.rows.length, columns: jr.columns.length, errors: 0 });
          onStep('infer', 'running');
          const jtypes = inferColumns(jr.rows, jr.columns);
          onStep('infer', 'done', { types: Object.keys(jtypes).length });
          onStep('validate', 'running');
          const jissues = validate(jr.rows, jr.columns, jtypes);
          onStep('validate', 'done', { invalid: jissues.total });
          onStep('enrich', 'running');
          const jresult = enrich(jr.rows, jr.columns, jtypes, jissues);
          onStep('enrich', 'done');
          try { _ingestRunning = false; } catch(_){}
          return {
            ...jresult,
            dialect: { delimiter: 'json', confidence: 1 },
            sourceName: file.name, encoding: encDetection,
            errors: [], dirtyColumnNames: [], _buffer: buffer
          };
        }
        // _parseJSON falhou (JSON inválido) — segue tentando como CSV abaixo.
      }

      onStep('detect', 'running');
      const dialect = detectDialect(text);
      if (!dialect){
        onStep('detect', 'error');
        SolsticeErrors.show('CSV_EMPTY');
        return null;
      }
      onStep('detect', 'done', dialect);

      onStep('parse', 'running');
      // Auditoria 2026 (B-02 / A-402): parseText agora retorna Promise para
      // suportar Papa.parse worker:true. CSVs grandes não bloqueiam mais a UI.
      // PL-01 (Sprint 2): emite progresso por chunk em arquivos >= 5MB.
      const { rows, columns, errors, dirtyColumnNames } = await parseText(text, dialect, {
        onProgress: (rowsSoFar) => {
          onStep('parse', 'running', { rowsSoFar });
        }
      });
      if (!rows.length){
        onStep('parse', 'error');
        SolsticeErrors.show('CSV_EMPTY');
        return null;
      }
      if (errors && errors.length){
        // Warn no console mas não bloqueia
        console.warn('[Solstice] Parse warnings:', errors.slice(0,5));
      }
      onStep('parse', 'done', { rows: rows.length, columns: columns.length, errors: errors ? errors.length : 0 });

      onStep('infer', 'running');
      const types = inferColumns(rows, columns);
      onStep('infer', 'done', { types: Object.keys(types).length });

      onStep('validate', 'running');
      const issues = validate(rows, columns, types);
      onStep('validate', 'done', { invalid: issues.total });

      onStep('enrich', 'running');
      const result = enrich(rows, columns, types, issues);
      onStep('enrich', 'done');

      // Prompt 2: expõe encoding detectado + buffer pra eventual re-decode
      // se o usuário escolher outro encoding manualmente no modal de filtro.
      // Prompt 9: expõe errors + dirtyColumnNames para Quality card.
      // Auditoria 2026 (M-I-2 / R-10): ingest terminou — libera flag dirty.
      try { _ingestRunning = false; } catch(_){}
      return {
        ...result,
        dialect,
        sourceName: file.name,
        encoding: encDetection,
        errors: errors || [],
        dirtyColumnNames: dirtyColumnNames || [],
        _buffer: buffer // mantido pra permitir re-decode com encoding diferente sem ler arquivo de novo
      };
    }

    // Auditoria 2026 (M-I-2 / A-304 + R-10 / A-1004): isRunning() informa
    // o beforeunload no SolsticeWorkspace que há ingest em curso.
    let _ingestRunning = false;
    function isRunning(){ return _ingestRunning; }

    return { detectDialect, parseText, inferColumns, validate, enrich, run, detectEncoding, decodeBytes, isRunning };
  })();
