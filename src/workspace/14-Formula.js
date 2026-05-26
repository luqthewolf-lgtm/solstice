
  /* ============================================================
     Patch 2 (ADR-130) — SolsticeFormula (parser completo · Medidas Calculadas)
     DAX-like simplificado: ref de coluna {nome}, operadores aritméticos,
     parênteses, e funções SUM/AVG/MIN/MAX/COUNT/MEDIAN/IF/AND/OR/NOT.
     Tokenizer → Shunting Yard (RPN) → AST executor.
     Núcleo compartilhado: SolsticeFormulaCore (RT-01).
     ============================================================ */
  const SolsticeFormula = (function(){
    // ===== Tokenizer =====
    const TOKEN_TYPES = {
      NUM:'NUM', COL:'COL', OP:'OP', LP:'LP', RP:'RP', COMMA:'COMMA', FN:'FN'
    };
    const FUNCTIONS = {
      SUM:    { arity:'col',     apply: (vals) => vals.reduce((a,b)=>a+b,0) },
      AVG:    { arity:'col',     apply: (vals) => vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0 },
      MIN:    { arity:'col',     apply: (vals) => vals.length ? SolsticeStats.min(vals) : 0 },
      MAX:    { arity:'col',     apply: (vals) => vals.length ? SolsticeStats.max(vals) : 0 },
      COUNT:  { arity:'col',     apply: (vals) => vals.length },
      MEDIAN: { arity:'col',     apply: (vals) => {
        const s = vals.slice().sort((a,b)=>a-b);
        if (!s.length) return 0;
        const m = Math.floor(s.length/2);
        return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
      }},
      IF:  { arity:3, apply: (a,b,c) => a ? b : c },
      AND: { arity:2, apply: (a,b) => (a && b) ? 1 : 0 },
      OR:  { arity:2, apply: (a,b) => (a || b) ? 1 : 0 },
      NOT: { arity:1, apply: (a) => a ? 0 : 1 }
    };
    const OPS = {
      '+': { prec:2, assoc:'L', apply:(a,b)=>a+b },
      '-': { prec:2, assoc:'L', apply:(a,b)=>a-b },
      '*': { prec:3, assoc:'L', apply:(a,b)=>a*b },
      '/': { prec:3, assoc:'L', apply:(a,b)=> b === 0 ? null : a/b },
      '>': { prec:1, assoc:'L', apply:(a,b)=>a>b?1:0 },
      '<': { prec:1, assoc:'L', apply:(a,b)=>a<b?1:0 },
      '=': { prec:1, assoc:'L', apply:(a,b)=>a===b?1:0 }
    };

    /** Auditoria 2026 (RT-01): tokenize agora delega ao SolsticeFormulaCore.lex.
        Adapta IDENT(isFunction:true) → FN e LPAREN/RPAREN → LP/RP para manter
        a interface esperada pelo Shunting Yard local. */
    function tokenize(s){
      const raw = SolsticeFormulaCore.lex(s, {
        colBracket: 'curly',
        functions: FUNCTIONS,
        requireKnownFn: true,
        allowCompoundOps: false,  // SolsticeFormula só tem > < = (não >=, <=, ==)
        keywords: []              // SolsticeFormula não trata AND/OR/NOT como palavra-chave
      });
      return raw.map(t => {
        if (t.type === 'IDENT' && t.isFunction) return { type:'FN', value: t.value, pos: t.pos };
        if (t.type === 'LPAREN') return { type:'LP', value: '(', pos: t.pos };
        if (t.type === 'RPAREN') return { type:'RP', value: ')', pos: t.pos };
        return t;
      });
    }

    // Shunting Yard → RPN
    function toRPN(tokens){
      const out = []; const stack = [];
      for (const t of tokens){
        if (t.type === 'NUM' || t.type === 'COL') out.push(t);
        else if (t.type === 'FN') stack.push(t);
        else if (t.type === 'COMMA'){
          while (stack.length && stack[stack.length-1].type !== 'LP') out.push(stack.pop());
        }
        else if (t.type === 'OP'){
          const o1 = OPS[t.value];
          while (stack.length){
            const top = stack[stack.length-1];
            if (top.type === 'OP' && OPS[top.value] && (
              (o1.assoc === 'L' && o1.prec <= OPS[top.value].prec) ||
              (o1.assoc === 'R' && o1.prec <  OPS[top.value].prec)
            )) out.push(stack.pop());
            else if (top.type === 'FN') out.push(stack.pop());
            else break;
          }
          stack.push(t);
        }
        else if (t.type === 'LP') stack.push(t);
        else if (t.type === 'RP'){
          while (stack.length && stack[stack.length-1].type !== 'LP') out.push(stack.pop());
          if (!stack.length) throw new Error('Parêntese sem par em pos ' + t.pos);
          stack.pop(); // discard LP
          if (stack.length && stack[stack.length-1].type === 'FN') out.push(stack.pop());
        }
      }
      while (stack.length){
        const top = stack.pop();
        if (top.type === 'LP') throw new Error('Parêntese aberto sem fechar');
        out.push(top);
      }
      return out;
    }

    // Avalia RPN para UM row (operações ponto-a-ponto) ou para coluna inteira (funções de agregação)
    function _evalRPN(rpn, row, allRows){
      const st = [];
      for (const t of rpn){
        if (t.type === 'NUM') st.push(t.value);
        else if (t.type === 'COL'){
          // Quando dentro de função SUM/AVG/etc., a função come o token COL diretamente.
          // Quando solto, usa row[colname].
          const v = row ? parseFloat(row[t.value]) : NaN;
          st.push(isNaN(v) ? 0 : v);
        }
        else if (t.type === 'OP'){
          const b = st.pop(); const a = st.pop();
          if (a == null || b == null) st.push(null);
          else st.push(OPS[t.value].apply(a, b));
        }
        else if (t.type === 'FN'){
          const def = FUNCTIONS[t.value];
          if (def.arity === 'col'){
            // Última op deve ser COL (não suporta SUM(expr) ainda — para isso precisaria de evaluateColumn recursivo)
            // Implementação atual: pega o nome da última COL e calcula sobre allRows
            const lastIdx = st.length - 1;
            // Truque: para FN col, o COL já foi pushed como valor (parseFloat). Mas precisamos do nome — vou refazer.
            // SIMPLIFICAÇÃO: SUM/AVG/etc só aceitam {col} direto — RPN guarda referência diferente.
            const lastTok = _lastColTokenInRPN(rpn, t);
            if (!lastTok){ st.push(0); continue; }
            const vals = (allRows || []).map(r => SolsticeStats.parseNum(r[lastTok.value])).filter(v => !isNaN(v));
            st.pop(); // remove o valor escalar do row que foi pushed
            st.push(def.apply(vals));
          } else {
            const args = [];
            for (let i = 0; i < def.arity; i++) args.unshift(st.pop());
            st.push(def.apply.apply(null, args));
          }
        }
      }
      return st[0] != null ? st[0] : null;
    }

    function _lastColTokenInRPN(rpn, fnToken){
      // Encontra o COL imediatamente antes da FN no array
      const idx = rpn.indexOf(fnToken);
      for (let i = idx - 1; i >= 0; i--){
        if (rpn[i].type === 'COL') return rpn[i];
        if (rpn[i].type !== 'NUM') break;
      }
      return null;
    }

    /** parse(formula) → { rpn, deps: [colNames] } · lança em erro de sintaxe. */
    function parse(formula){
      const tokens = tokenize(String(formula || ''));
      const rpn = toRPN(tokens);
      const deps = Array.from(new Set(tokens.filter(t => t.type === 'COL').map(t => t.value)));
      return { rpn, deps };
    }

    /** validate(formula, ctx) → { ok, errors: [{token, message, position}] } */
    function validate(formula, ctx){
      const errors = [];
      const s = String(formula || '');
      if (!s.trim()) return { ok:false, errors:[{ token:'', message:'Fórmula vazia', position:0 }] };
      let parsed;
      try { parsed = parse(s); }
      catch(err){ return { ok:false, errors:[{ token:'', message: err.message, position: 0 }] }; }
      const cols = new Set(ctx && ctx.columns ? ctx.columns : []);
      // Também aceita medidas calculadas pré-existentes
      const measures = (ctx && ctx.calculatedMeasures) || {};
      Object.keys(measures).forEach(n => cols.add(n));
      for (const dep of parsed.deps){
        if (!cols.has(dep)){
          errors.push({ token: dep, message: 'Coluna não existe: ' + dep, position: 0 });
        }
      }
      if (/\/\s*0(\D|$)/.test(s)){
        errors.push({ token:'/ 0', message:'Divisão por zero literal', position: s.indexOf('/0') });
      }
      return { ok: errors.length === 0, errors, deps: parsed.deps };
    }

    /** evaluate(formula, row, ctx) → number|null */
    function evaluate(formula, row, ctx){
      try {
        const { rpn } = parse(formula);
        return _evalRPN(rpn, row, ctx && ctx.rows);
      } catch(err){ return null; }
    }

    /** evaluateColumn(formula, ctx) → Array<number|null> */
    function evaluateColumn(formula, ctx){
      const { rpn } = parse(formula);
      const rows = (ctx && ctx.rows) || [];
      return rows.map(r => _evalRPN(rpn, r, rows));
    }

    function dependencies(formula){
      try { return parse(formula).deps; } catch(e){ return []; }
    }

    /* ============================================================
       LE-01 (Sprint 2): API DAX-like — CALCULATE, FILTER, SUMIF, AVGIF, COUNTIF
       Não estende o tokenizer (precisaria refator grande); expõe helpers
       programáticos chamados por SolsticeMeasures e ad-hoc por dashboards.

       Exemplos:
         SolsticeFormula.calculate('SUM({receita})', allRows, { regiao: 'Sul' })
         SolsticeFormula.sumIf('receita', allRows, { regiao: 'Sul' })
         SolsticeFormula.filter(allRows, { regiao: 'Sul', ativo: true })
       ============================================================ */

    /** Aplica filtro em forma de objeto { col: value } | { col: { op, value } }.
        Operadores suportados: 'eq' (default), 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'contains'. */
    function _matchesFilter(row, filterObj){
      for (const col in filterObj){
        const spec = filterObj[col];
        const cell = row[col];
        if (spec == null || typeof spec !== 'object'){
          // Igualdade simples
          if (cell != spec) return false; // eslint-disable-line eqeqeq
          continue;
        }
        const op = spec.op || 'eq';
        const v = spec.value;
        switch (op){
          case 'eq':       if (cell != v) return false; break; // eslint-disable-line eqeqeq
          case 'neq':      if (cell == v) return false; break; // eslint-disable-line eqeqeq
          case 'gt':       if (!(parseFloat(cell) >  parseFloat(v))) return false; break;
          case 'lt':       if (!(parseFloat(cell) <  parseFloat(v))) return false; break;
          case 'gte':      if (!(parseFloat(cell) >= parseFloat(v))) return false; break;
          case 'lte':      if (!(parseFloat(cell) <= parseFloat(v))) return false; break;
          case 'in':       if (!Array.isArray(v) || v.indexOf(cell) < 0) return false; break;
          case 'contains': if (String(cell || '').toLowerCase().indexOf(String(v || '').toLowerCase()) < 0) return false; break;
          default: return false;
        }
      }
      return true;
    }
    /** filter(allRows, filterObj) → subset de rows que satisfazem o filtro. */
    function filterRows(allRows, filterObj){
      if (!filterObj || !Object.keys(filterObj).length) return allRows || [];
      return (allRows || []).filter(r => _matchesFilter(r, filterObj));
    }
    /** calculate(formula, allRows, filterObj) → reavalia formula sobre rows filtradas.
        Equivalente a CALCULATE(formula, FILTER(table, predicate)) do DAX. */
    function calculate(formula, allRows, filterObj){
      const subset = filterRows(allRows, filterObj);
      try {
        const { rpn } = parse(formula);
        // _evalRPN com row=null e allRows=subset usa as agregações sobre o subset
        return _evalRPN(rpn, null, subset);
      } catch(_){ return null; }
    }
    /** sumIf(targetCol, allRows, filterObj) → soma dos valores da coluna nas rows filtradas. */
    function sumIf(targetCol, allRows, filterObj){
      const subset = filterRows(allRows, filterObj);
      let sum = 0;
      for (const r of subset){
        const v = SolsticeStats.parseNum(r[targetCol]);
        if (!isNaN(v)) sum += v;
      }
      return sum;
    }
    function avgIf(targetCol, allRows, filterObj){
      const subset = filterRows(allRows, filterObj);
      let sum = 0, n = 0;
      for (const r of subset){
        const v = SolsticeStats.parseNum(r[targetCol]);
        if (!isNaN(v)){ sum += v; n++; }
      }
      return n ? sum / n : null;
    }
    function countIf(allRows, filterObj){
      return filterRows(allRows, filterObj).length;
    }

    return { parse, validate, evaluate, evaluateColumn, dependencies, FUNCTIONS, OPS,
             // LE-01 DAX-like API
             filter: filterRows, calculate, sumIf, avgIf, countIf };
  })();
