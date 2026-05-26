
  /* ============================================================
     Auditoria 2026 (RT-01) — SolsticeFormulaCore
     Núcleo compartilhado entre SolsticeFormula (agregado, DAX-like, sintaxe
     {coluna}) e SolsticeFormulaRow (row-level, sintaxe [coluna]).

     Esta camada agora inclui um LEXER PARAMETRIZADO usado pelos dois motores —
     antes cada um tinha seu próprio tokenize. Os parsers ficam separados
     (cada motor faz Shunting Yard ou recursive descent à sua maneira), mas
     a tokenização é fonte única.

     Exporta:
       isDigit / isAlpha / isAlphaNum / isSpace — classificação de chars
       toNumber(v) — coerção BR-aware, null em vez de NaN
       tokenError(msg, pos) — erro padronizado
       lex(source, opts) — tokeniza segundo opts.dialect
       OP_TABLE — registro central de operadores
     ============================================================ */
  const SolsticeFormulaCore = (function(){
    function isDigit(c){ return c >= '0' && c <= '9'; }
    function isAlpha(c){ return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'; }
    function isAlphaNum(c){ return isAlpha(c) || isDigit(c); }
    function isSpace(c){ return c === ' ' || c === '\t' || c === '\n' || c === '\r'; }

    function toNumber(v){
      if (v == null) return null;
      if (typeof v === 'number') return isFinite(v) ? v : null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      const n = (typeof SolsticeBR !== 'undefined' && SolsticeBR.toNumber)
        ? SolsticeBR.toNumber(v)
        : parseFloat(String(v).replace(',', '.'));
      return isNaN(n) ? null : n;
    }

    function tokenError(message, pos){
      const e = new Error(pos != null ? (message + ' em pos ' + pos) : message);
      e.position = pos;
      return e;
    }

    /**
     * Lexer unificado.
     *
     * opts:
     *   colBracket: 'curly' (default) → {col}    · usado por SolsticeFormula
     *             | 'square'         → [col]    · usado por SolsticeFormulaRow
     *   allowStrings: bool — aceita 'string' e "string" como literais
     *   allowBoolNull: bool — aceita TRUE / FALSE / NULL como literais
     *   allowSimpleIdentAsCol: bool — identificador simples vira COL (FormulaRow)
     *   allowCompoundOps: bool — habilita >= <= == !=
     *   keywords: string[] — palavras que viram OP (default ['AND','OR','NOT'])
     *   functions: object — registro de funções conhecidas (chaves UPPERCASE)
     *   requireKnownFn: bool — se true, identificador desconhecido lança erro
     *                          (SolsticeFormula); senão fica IDENT (FormulaRow)
     *   appendEOF: bool — adiciona token {type:'EOF'} no fim (FormulaRow)
     *
     * Tokens devolvidos (uniformes):
     *   { type:'NUM', value:number, pos }
     *   { type:'STR', value:string, pos }
     *   { type:'BOOL', value:bool, pos }
     *   { type:'NULL', pos }
     *   { type:'COL', value:colName, pos }
     *   { type:'IDENT', value:name, isFunction:bool, pos }
     *   { type:'OP', value:opString, pos }
     *   { type:'LPAREN'|'RPAREN'|'COMMA', value, pos }
     *   { type:'EOF' } (só se appendEOF)
     */
    function lex(source, opts){
      opts = opts || {};
      const colBracket = opts.colBracket || 'curly';
      const colOpen = colBracket === 'square' ? '[' : '{';
      const colClose = colBracket === 'square' ? ']' : '}';
      const keywords = new Set((opts.keywords || ['AND','OR','NOT']).map(k => k.toUpperCase()));
      const functions = opts.functions || {};
      const s = String(source || '');
      const N = s.length;
      const tokens = [];
      let i = 0;
      while (i < N){
        const c = s[i];
        if (isSpace(c)){ i++; continue; }
        const startPos = i;
        // Coluna com brackets
        if (c === colOpen){
          const end = s.indexOf(colClose, i);
          if (end < 0) throw tokenError('Referência de coluna não fechada (faltando ' + colClose + ')', i);
          tokens.push({ type:'COL', value: s.slice(i+1, end).trim(), pos: startPos });
          i = end + 1; continue;
        }
        // Número
        if (isDigit(c) || (c === '.' && i+1 < N && isDigit(s[i+1]))){
          let j = i;
          while (j < N && (isDigit(s[j]) || s[j] === '.' || s[j] === 'e' || s[j] === 'E' ||
                ((s[j] === '+' || s[j] === '-') && (s[j-1] === 'e' || s[j-1] === 'E')))) j++;
          const num = parseFloat(s.slice(i, j));
          if (isNaN(num)) throw tokenError('Número inválido em "' + s.slice(i, j) + '"', startPos);
          tokens.push({ type:'NUM', value: num, pos: startPos });
          i = j; continue;
        }
        // String literal
        if (opts.allowStrings && (c === '"' || c === "'")){
          const quote = c; let j = i + 1; let buf = '';
          while (j < N && s[j] !== quote){
            if (s[j] === '\\' && j+1 < N){ buf += s[j+1]; j += 2; }
            else { buf += s[j]; j++; }
          }
          if (j >= N) throw tokenError('String não fechada (faltando ' + quote + ')', startPos);
          tokens.push({ type:'STR', value: buf, pos: startPos });
          i = j + 1; continue;
        }
        // Identifier / keyword / função / bool / null
        if (isAlpha(c)){
          let j = i;
          while (j < N && isAlphaNum(s[j])) j++;
          const word = s.slice(i, j);
          const upper = word.toUpperCase();
          if (opts.allowBoolNull && upper === 'TRUE'){ tokens.push({ type:'BOOL', value:true, pos:startPos }); i = j; continue; }
          if (opts.allowBoolNull && upper === 'FALSE'){ tokens.push({ type:'BOOL', value:false, pos:startPos }); i = j; continue; }
          if (opts.allowBoolNull && upper === 'NULL'){ tokens.push({ type:'NULL', value:null, pos:startPos }); i = j; continue; }
          if (keywords.has(upper)){ tokens.push({ type:'OP', value: upper, pos:startPos }); i = j; continue; }
          if (functions[upper]){
            tokens.push({ type:'IDENT', value: upper, isFunction: true, pos:startPos });
            i = j; continue;
          }
          if (opts.requireKnownFn){
            throw tokenError('Função desconhecida: ' + upper, startPos);
          }
          if (opts.allowSimpleIdentAsCol){
            tokens.push({ type:'IDENT', value: word, isFunction: false, pos:startPos });
          } else {
            tokens.push({ type:'IDENT', value: word, isFunction: false, pos:startPos });
          }
          i = j; continue;
        }
        // Operadores compostos (precisam vir antes dos simples)
        if (opts.allowCompoundOps){
          if (c === '>' && s[i+1] === '='){ tokens.push({ type:'OP', value:'>=', pos:startPos }); i += 2; continue; }
          if (c === '<' && s[i+1] === '='){ tokens.push({ type:'OP', value:'<=', pos:startPos }); i += 2; continue; }
          if (c === '=' && s[i+1] === '='){ tokens.push({ type:'OP', value:'==', pos:startPos }); i += 2; continue; }
          if (c === '!' && s[i+1] === '='){ tokens.push({ type:'OP', value:'!=', pos:startPos }); i += 2; continue; }
          if (c === '=' && s[i+1] !== '='){ tokens.push({ type:'OP', value:'==', pos:startPos }); i++; continue; }
        }
        // Pontuação
        if (c === '('){ tokens.push({ type:'LPAREN', value:'(', pos:startPos }); i++; continue; }
        if (c === ')'){ tokens.push({ type:'RPAREN', value:')', pos:startPos }); i++; continue; }
        if (c === ','){ tokens.push({ type:'COMMA', value:',', pos:startPos }); i++; continue; }
        // Operadores simples
        if (c === '+' || c === '-' || c === '*' || c === '/' || c === '>' || c === '<' || c === '='){
          tokens.push({ type:'OP', value: c, pos:startPos });
          i++; continue;
        }
        throw tokenError('Caractere inesperado: ' + JSON.stringify(c), startPos);
      }
      if (opts.appendEOF) tokens.push({ type:'EOF' });
      return tokens;
    }

    return { isDigit, isAlpha, isAlphaNum, isSpace, toNumber, tokenError, lex };
  })();
