import { describe, it, expect, beforeAll } from 'vitest';
import { SolsticeFormulaCore } from './dist/formula-core.mjs';

describe('SolsticeFormulaCore — helpers básicos', () => {
  it('isDigit / isAlpha / isAlphaNum / isSpace', () => {
    expect(SolsticeFormulaCore.isDigit('5')).toBe(true);
    expect(SolsticeFormulaCore.isDigit('a')).toBe(false);
    expect(SolsticeFormulaCore.isAlpha('A')).toBe(true);
    expect(SolsticeFormulaCore.isAlpha('z')).toBe(true);
    expect(SolsticeFormulaCore.isAlpha('_')).toBe(true);
    expect(SolsticeFormulaCore.isAlpha('5')).toBe(false);
    expect(SolsticeFormulaCore.isAlphaNum('a')).toBe(true);
    expect(SolsticeFormulaCore.isAlphaNum('5')).toBe(true);
    expect(SolsticeFormulaCore.isAlphaNum('-')).toBe(false);
    expect(SolsticeFormulaCore.isSpace(' ')).toBe(true);
    expect(SolsticeFormulaCore.isSpace('\t')).toBe(true);
    expect(SolsticeFormulaCore.isSpace('\n')).toBe(true);
    expect(SolsticeFormulaCore.isSpace('a')).toBe(false);
  });
});

describe('SolsticeFormulaCore.toNumber — coerção BR-aware', () => {
  it('null/undefined -> null', () => {
    expect(SolsticeFormulaCore.toNumber(null)).toBe(null);
    expect(SolsticeFormulaCore.toNumber(undefined)).toBe(null);
  });

  it('número direto', () => {
    expect(SolsticeFormulaCore.toNumber(42)).toBe(42);
    expect(SolsticeFormulaCore.toNumber(-1.5)).toBe(-1.5);
    expect(SolsticeFormulaCore.toNumber(0)).toBe(0);
  });

  it('boolean vira 0/1', () => {
    expect(SolsticeFormulaCore.toNumber(true)).toBe(1);
    expect(SolsticeFormulaCore.toNumber(false)).toBe(0);
  });

  it('infinity/NaN -> null (uniformiza)', () => {
    expect(SolsticeFormulaCore.toNumber(Infinity)).toBe(null);
    expect(SolsticeFormulaCore.toNumber(NaN)).toBe(null);
  });

  it('string com agrupador pt-BR ("1.234,56")', () => {
    expect(SolsticeFormulaCore.toNumber('1.234,56')).toBeCloseTo(1234.56);
    expect(SolsticeFormulaCore.toNumber('10.000,00')).toBeCloseTo(10000);
  });

  it('string com ponto decimal ("3.14")', () => {
    expect(SolsticeFormulaCore.toNumber('3.14')).toBeCloseTo(3.14);
  });

  it('string inválida -> null', () => {
    expect(SolsticeFormulaCore.toNumber('abc')).toBe(null);
    expect(SolsticeFormulaCore.toNumber('')).toBe(null);
  });
});

describe('SolsticeFormulaCore.tokenError — formato consistente', () => {
  it('inclui mensagem e posição', () => {
    const err = SolsticeFormulaCore.tokenError('Caractere inesperado', 42);
    expect(err.message).toContain('Caractere inesperado');
    expect(err.message).toContain('42');
    expect(err.position).toBe(42);
    expect(err instanceof Error).toBe(true);
  });

  it('aceita pos undefined', () => {
    const err = SolsticeFormulaCore.tokenError('Erro genérico');
    expect(err.message).toBe('Erro genérico');
    expect(err.position).toBeUndefined();
  });
});

describe('SolsticeFormulaCore.lex — sintaxe DAX-like (curly braces)', () => {
  const opts = {
    colBracket: 'curly',
    functions: { SUM: {}, AVG: {}, MIN: {}, MAX: {}, COUNT: {}, MEDIAN: {}, IF: {} },
    requireKnownFn: true,
  };

  it('tokeniza expressão simples', () => {
    const tokens = SolsticeFormulaCore.lex('SUM({vendas})', opts);
    expect(tokens.length).toBe(4);
    expect(tokens[0]).toMatchObject({ type: 'IDENT', value: 'SUM', isFunction: true });
    expect(tokens[1]).toMatchObject({ type: 'LPAREN' });
    expect(tokens[2]).toMatchObject({ type: 'COL', value: 'vendas' });
    expect(tokens[3]).toMatchObject({ type: 'RPAREN' });
  });

  it('aceita aritmética', () => {
    const tokens = SolsticeFormulaCore.lex('SUM({vendas}) - SUM({custo})', opts);
    const types = tokens.map(t => t.type);
    expect(types).toEqual(['IDENT', 'LPAREN', 'COL', 'RPAREN', 'OP', 'IDENT', 'LPAREN', 'COL', 'RPAREN']);
  });

  it('rejeita coluna não fechada', () => {
    expect(() => SolsticeFormulaCore.lex('SUM({vendas)', opts)).toThrow(/não fechada/);
  });

  it('rejeita função desconhecida quando requireKnownFn', () => {
    expect(() => SolsticeFormulaCore.lex('UNKNOWN({x})', opts)).toThrow(/Função desconhecida/);
  });

  it('parse de números com decimal', () => {
    const tokens = SolsticeFormulaCore.lex('1.5 + 2', opts);
    expect(tokens[0]).toMatchObject({ type: 'NUM', value: 1.5 });
    expect(tokens[2]).toMatchObject({ type: 'NUM', value: 2 });
  });
});

describe('SolsticeFormulaCore.lex — sintaxe row-level (square brackets + extras)', () => {
  const opts = {
    colBracket: 'square',
    allowStrings: true,
    allowBoolNull: true,
    allowSimpleIdentAsCol: true,
    allowCompoundOps: true,
    keywords: ['AND', 'OR', 'NOT'],
    functions: { IF: {}, COALESCE: {}, UPPER: {} },
    appendEOF: true,
  };

  it('aceita coluna entre colchetes', () => {
    const tokens = SolsticeFormulaCore.lex('[vendas] + 10', opts);
    expect(tokens[0]).toMatchObject({ type: 'COL', value: 'vendas' });
    expect(tokens[1]).toMatchObject({ type: 'OP', value: '+' });
    expect(tokens[2]).toMatchObject({ type: 'NUM', value: 10 });
    expect(tokens[3]).toMatchObject({ type: 'EOF' });
  });

  it('aceita string literal', () => {
    const tokens = SolsticeFormulaCore.lex('"hello"', opts);
    expect(tokens[0]).toMatchObject({ type: 'STR', value: 'hello' });
  });

  it('aceita string com aspas simples', () => {
    const tokens = SolsticeFormulaCore.lex("'world'", opts);
    expect(tokens[0]).toMatchObject({ type: 'STR', value: 'world' });
  });

  it('aceita TRUE/FALSE/NULL', () => {
    const tokens = SolsticeFormulaCore.lex('TRUE AND FALSE OR NULL', opts);
    expect(tokens[0]).toMatchObject({ type: 'BOOL', value: true });
    expect(tokens[2]).toMatchObject({ type: 'BOOL', value: false });
    expect(tokens[4]).toMatchObject({ type: 'NULL' });
  });

  it('reconhece AND/OR/NOT como keywords (não funções)', () => {
    const tokens = SolsticeFormulaCore.lex('[a] AND [b]', opts);
    expect(tokens[1]).toMatchObject({ type: 'OP', value: 'AND' });
  });

  it('operadores compostos: >= <= == !=', () => {
    const tokens = SolsticeFormulaCore.lex('[a] >= 5 AND [b] != 0', opts);
    const ops = tokens.filter(t => t.type === 'OP').map(t => t.value);
    expect(ops).toContain('>=');
    expect(ops).toContain('!=');
    expect(ops).toContain('AND');
  });

  it('= é alias de == quando allowCompoundOps', () => {
    const tokens = SolsticeFormulaCore.lex('[a] = 5', opts);
    expect(tokens[1]).toMatchObject({ type: 'OP', value: '==' });
  });

  it('IDENT simples vira COL quando allowSimpleIdentAsCol', () => {
    const tokens = SolsticeFormulaCore.lex('vendas + 10', opts);
    // Identificador desconhecido (não função, não keyword) vira IDENT sem isFunction
    expect(tokens[0]).toMatchObject({ type: 'IDENT', value: 'vendas', isFunction: false });
  });

  it('função conhecida vira IDENT com isFunction:true', () => {
    const tokens = SolsticeFormulaCore.lex('UPPER([nome])', opts);
    expect(tokens[0]).toMatchObject({ type: 'IDENT', value: 'UPPER', isFunction: true });
  });

  it('rejeita string não fechada', () => {
    expect(() => SolsticeFormulaCore.lex('"abc', opts)).toThrow(/não fechada/);
  });

  it('rejeita caractere inesperado', () => {
    expect(() => SolsticeFormulaCore.lex('@invalid', opts)).toThrow(/inesperado/);
  });
});

describe('SolsticeFormulaCore.lex — robustez', () => {
  const optsBasic = { colBracket: 'curly', functions: { SUM: {} }, requireKnownFn: true };

  it('aceita whitespace variado', () => {
    const tokens = SolsticeFormulaCore.lex('  SUM(\n  {vendas}\t)  ', optsBasic);
    expect(tokens.length).toBe(4);
  });

  it('número científico: 1.5e3', () => {
    const tokens = SolsticeFormulaCore.lex('1.5e3', optsBasic);
    expect(tokens[0]).toMatchObject({ type: 'NUM', value: 1500 });
  });

  it('número negativo na expressão (gerenciado pelo parser, lex devolve OP + NUM)', () => {
    const tokens = SolsticeFormulaCore.lex('-5', optsBasic);
    expect(tokens[0]).toMatchObject({ type: 'OP', value: '-' });
    expect(tokens[1]).toMatchObject({ type: 'NUM', value: 5 });
  });

  it('string vazia produz lista vazia', () => {
    const tokens = SolsticeFormulaCore.lex('', optsBasic);
    expect(tokens.length).toBe(0);
  });

  it('appendEOF adiciona EOF no fim', () => {
    const tokens = SolsticeFormulaCore.lex('1', { ...optsBasic, appendEOF: true });
    expect(tokens[tokens.length - 1]).toMatchObject({ type: 'EOF' });
  });
});
