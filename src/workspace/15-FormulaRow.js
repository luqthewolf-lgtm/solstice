
  /* ============================================================
     Prompt 6 v5.4 — SolsticeFormulaRow
     DSL ROW-LEVEL para coluna calculada (vs SolsticeFormula que e agregada).
     Recursive-descent parser proprio (SEM eval/Function). Suporta:
       - Aritmetica: + - * / ( )
       - Comparacao: > < >= <= == != =
       - Logica: AND OR NOT
       - Funcoes: ABS ROUND MIN MAX IF AND OR NOT ISNULL COALESCE LEN UPPER LOWER
       - Literais: numero (123, 1.5, -.5), string ('foo'), true/false, null
       - Refs: [coluna com espacos] OU identificador simples
     Nulo propaga: NaN/null em qualquer operando aritmetico = null no resultado.
     Divisao por zero = null.
     ============================================================ */
  const SolsticeFormulaRow = (function(){
    // ===== LEXER =====
    const TK = {
      NUM: 'NUM', STR: 'STR', BOOL: 'BOOL', NULL: 'NULL',
      IDENT: 'IDENT', COL: 'COL',  // [coluna]
      LPAREN: 'LPAREN', RPAREN: 'RPAREN', COMMA: 'COMMA',
      OP: 'OP'  // operadores
    };
    // Reserved keywords (case-insensitive)
    const KEYWORDS = new Set(['AND','OR','NOT','TRUE','FALSE','NULL']);
    const FUNCTIONS = {
      ABS:      { arity: 1, fn: (a) => a == null ? null : Math.abs(a) },
      ROUND:    { arity: [1, 2], fn: (a, b) => a == null ? null : (b != null ? +a.toFixed(b|0) : Math.round(a)) },
      FLOOR:    { arity: 1, fn: (a) => a == null ? null : Math.floor(a) },
      CEIL:     { arity: 1, fn: (a) => a == null ? null : Math.ceil(a) },
      MIN:      { arity: [1, Infinity], fn: (...args) => { const f = args.filter(v => v != null); return f.length ? SolsticeStats.min(f) : null; } },
      MAX:      { arity: [1, Infinity], fn: (...args) => { const f = args.filter(v => v != null); return f.length ? SolsticeStats.max(f) : null; } },
      IF:       { arity: 3, fn: (cond, a, b) => cond ? a : b },
      AND:      { arity: [1, Infinity], fn: (...args) => args.every(Boolean) },
      OR:       { arity: [1, Infinity], fn: (...args) => args.some(Boolean) },
      NOT:      { arity: 1, fn: (a) => !a },
      ISNULL:   { arity: 1, fn: (a) => a == null || (typeof a === 'number' && isNaN(a)) },
      COALESCE: { arity: [1, Infinity], fn: (...args) => { for (const a of args) if (a != null && !(typeof a === 'number' && isNaN(a))) return a; return null; } },
      LEN:      { arity: 1, fn: (a) => a == null ? null : String(a).length },
      UPPER:    { arity: 1, fn: (a) => a == null ? null : String(a).toUpperCase() },
      LOWER:    { arity: 1, fn: (a) => a == null ? null : String(a).toLowerCase() }
    };

    /** Auditoria 2026 (RT-01): tokenize agora delega ao SolsticeFormulaCore.lex.
        TK.NUM/STR/etc são strings idênticas aos types do lexer central — não
        precisa de adapter. Único ajuste: o parser local usa TK.LPAREN (string)
        e o lex devolve type:'LPAREN' (mesma string).
        Mantém a função pra preservar o ponto de extensão local (TK alias). */
    function tokenize(src){
      return SolsticeFormulaCore.lex(src, {
        colBracket: 'square',
        allowStrings: true,
        allowBoolNull: true,
        allowSimpleIdentAsCol: true,
        allowCompoundOps: true,
        keywords: Array.from(KEYWORDS),
        functions: FUNCTIONS,
        requireKnownFn: false,
        appendEOF: true
      });
    }

    // ===== PARSER (recursive descent) =====
    function parse(src){
      const tokens = tokenize(src);
      let pos = 0;
      const deps = new Set(); // colunas referenciadas

      function peek(){ return tokens[pos]; }
      function consume(type, value){
        const t = tokens[pos];
        if (t.type !== type || (value !== undefined && t.value !== value)){
          throw new Error('Esperado ' + (value || type) + ' mas veio ' + (t.value || t.type));
        }
        pos++; return t;
      }

      // orExpr → andExpr ('OR' andExpr)*
      function parseOr(){
        let left = parseAnd();
        while (peek().type === TK.OP && peek().value === 'OR'){
          pos++;
          const right = parseAnd();
          left = { type: 'binop', op: 'OR', left, right };
        }
        return left;
      }
      function parseAnd(){
        let left = parseNot();
        while (peek().type === TK.OP && peek().value === 'AND'){
          pos++;
          const right = parseNot();
          left = { type: 'binop', op: 'AND', left, right };
        }
        return left;
      }
      function parseNot(){
        if (peek().type === TK.OP && peek().value === 'NOT'){
          pos++;
          return { type: 'unop', op: 'NOT', operand: parseNot() };
        }
        return parseComp();
      }
      function parseComp(){
        let left = parseAdd();
        const t = peek();
        if (t.type === TK.OP && ['>','<','>=','<=','==','!='].includes(t.value)){
          pos++;
          const right = parseAdd();
          left = { type: 'binop', op: t.value, left, right };
        }
        return left;
      }
      function parseAdd(){
        let left = parseMul();
        while (peek().type === TK.OP && (peek().value === '+' || peek().value === '-')){
          const op = peek().value; pos++;
          const right = parseMul();
          left = { type: 'binop', op, left, right };
        }
        return left;
      }
      function parseMul(){
        let left = parseUnary();
        while (peek().type === TK.OP && (peek().value === '*' || peek().value === '/')){
          const op = peek().value; pos++;
          const right = parseUnary();
          left = { type: 'binop', op, left, right };
        }
        return left;
      }
      function parseUnary(){
        if (peek().type === TK.OP && peek().value === '-'){
          pos++;
          return { type: 'unop', op: '-', operand: parseUnary() };
        }
        if (peek().type === TK.OP && peek().value === '+'){
          pos++;
          return parseUnary();
        }
        return parseAtom();
      }
      function parseAtom(){
        const t = peek();
        if (t.type === TK.NUM){ pos++; return { type: 'num', value: t.value }; }
        if (t.type === TK.STR){ pos++; return { type: 'str', value: t.value }; }
        if (t.type === TK.BOOL){ pos++; return { type: 'bool', value: t.value }; }
        if (t.type === TK.NULL){ pos++; return { type: 'null' }; }
        if (t.type === TK.COL){
          pos++;
          deps.add(t.value);
          return { type: 'col', name: t.value };
        }
        if (t.type === TK.IDENT && t.isFunction){
          pos++;
          consume(TK.LPAREN);
          const args = [];
          if (peek().type !== TK.RPAREN){
            args.push(parseOr());
            while (peek().type === TK.COMMA){ pos++; args.push(parseOr()); }
          }
          consume(TK.RPAREN);
          return { type: 'fn', name: t.value, args };
        }
        // Prompt 6: AND/OR/NOT podem ser usadas como FUNÇÃO também (não só operador).
        // Ex: IF(AND([a]>0, [b]<5), x, y). Detecta seguido de '(' → função.
        if (t.type === TK.OP && (t.value === 'AND' || t.value === 'OR' || t.value === 'NOT')
            && tokens[pos+1] && tokens[pos+1].type === TK.LPAREN){
          const name = t.value;
          pos++; // consome OP
          consume(TK.LPAREN);
          const args = [];
          if (peek().type !== TK.RPAREN){
            args.push(parseOr());
            while (peek().type === TK.COMMA){ pos++; args.push(parseOr()); }
          }
          consume(TK.RPAREN);
          return { type: 'fn', name, args };
        }
        if (t.type === TK.IDENT){
          // identificador simples = referencia a coluna
          pos++;
          deps.add(t.value);
          return { type: 'col', name: t.value };
        }
        if (t.type === TK.LPAREN){
          pos++;
          const e = parseOr();
          consume(TK.RPAREN);
          return e;
        }
        throw new Error('Token inesperado: ' + (t.value || t.type));
      }

      const ast = parseOr();
      if (peek().type !== 'EOF') throw new Error('Tokens extras após o final da fórmula');
      return { ast, deps: Array.from(deps) };
    }

    // ===== EVALUATOR =====
    // Auditoria 2026 (RT-01): delega para SolsticeFormulaCore.toNumber.
    // Mantém o mesmo contrato (null em vez de NaN, BR-aware).
    const _toNum = SolsticeFormulaCore.toNumber;
    function evalNode(node, row){
      switch (node.type){
        case 'num': return node.value;
        case 'str': return node.value;
        case 'bool': return node.value;
        case 'null': return null;
        case 'col': {
          const v = row[node.name];
          return v === undefined ? null : v;
        }
        case 'fn': {
          const def = FUNCTIONS[node.name];
          if (!def) throw new Error('Função desconhecida: ' + node.name);
          const args = node.args.map(a => evalNode(a, row));
          // IF: avalia args mas trata cond como bool
          if (node.name === 'IF'){
            return args[0] ? args[1] : args[2];
          }
          // AND/OR/NOT/ISNULL/COALESCE: tratam null direto
          if (node.name === 'AND' || node.name === 'OR' || node.name === 'NOT' || node.name === 'ISNULL' || node.name === 'COALESCE'){
            return def.fn(...args);
          }
          // String functions: passam direto
          if (node.name === 'LEN' || node.name === 'UPPER' || node.name === 'LOWER'){
            return def.fn(...args);
          }
          // Demais: convertem args pra número
          const nums = args.map(_toNum);
          if (nums.some(n => n == null)) return null;
          return def.fn(...nums);
        }
        case 'unop': {
          const v = evalNode(node.operand, row);
          if (node.op === '-'){ const n = _toNum(v); return n == null ? null : -n; }
          if (node.op === 'NOT') return !v;
          throw new Error('Unop desconhecido: ' + node.op);
        }
        case 'binop': {
          const l = evalNode(node.left, row);
          const r = evalNode(node.right, row);
          const op = node.op;
          // Lógicos
          if (op === 'AND') return Boolean(l) && Boolean(r);
          if (op === 'OR')  return Boolean(l) || Boolean(r);
          // Comparações
          if (op === '==' || op === '!='){
            // Loose equality permitindo string vs number.
            // Auditoria 2026 (JM-03): este `l == r` é PROPOSITAL — o op `==`
            // da DSL Solstice (não do JS) precisa equiparar "3" e 3 quando
            // o usuário compara coluna texto vs literal numérico. Convenção
            // do código JS continua === / !==; este é o único loose equality
            // intencional do arquivo (e está documentado no fonte da DSL).
            const eq = (l == r) || (_toNum(l) != null && _toNum(l) === _toNum(r));
            return op === '==' ? eq : !eq;
          }
          if (op === '>' || op === '<' || op === '>=' || op === '<='){
            const ln = _toNum(l), rn = _toNum(r);
            if (ln == null || rn == null) return null;
            if (op === '>') return ln > rn;
            if (op === '<') return ln < rn;
            if (op === '>=') return ln >= rn;
            if (op === '<=') return ln <= rn;
          }
          // Aritmética
          const ln = _toNum(l), rn = _toNum(r);
          if (ln == null || rn == null) return null;
          if (op === '+') return ln + rn;
          if (op === '-') return ln - rn;
          if (op === '*') return ln * rn;
          if (op === '/') return rn === 0 ? null : ln / rn;
          throw new Error('Binop desconhecido: ' + op);
        }
      }
      throw new Error('Nó AST desconhecido: ' + node.type);
    }

    /** Compila e retorna { ast, deps, error } sem lançar */
    function compile(formula){
      try {
        const { ast, deps } = parse(formula);
        return { ast, deps, error: null };
      } catch(e){
        return { ast: null, deps: [], error: e.message };
      }
    }

    /** Aplica fórmula a um array de rows. Retorna array de valores. */
    function evaluate(formula, rows){
      const { ast, error } = compile(formula);
      if (error) throw new Error(error);
      return rows.map(r => evalNode(ast, r));
    }

    /** Valida fórmula contra lista de colunas conhecidas. Retorna { ok, error, deps, unknownCols } */
    function validate(formula, knownColumns){
      const { ast, deps, error } = compile(formula);
      if (error) return { ok: false, error, deps: [], unknownCols: [] };
      const known = new Set(knownColumns || []);
      const unknownCols = deps.filter(d => !known.has(d));
      if (unknownCols.length) return {
        ok: false,
        error: 'Coluna(s) não encontrada(s): ' + unknownCols.join(', '),
        deps, unknownCols
      };
      return { ok: true, error: null, deps, unknownCols: [] };
    }

    /** Preview: aplica fórmula às N primeiras linhas. Retorna { results, error }. */
    function preview(formula, rows, n){
      const limit = Math.min(n || 5, rows.length);
      const slice = rows.slice(0, limit);
      try {
        const results = evaluate(formula, slice);
        return { results, error: null };
      } catch(err){
        return { results: [], error: err.message };
      }
    }

    return { parse, compile, evaluate, validate, preview, FUNCTIONS };
  })();
