/**
 * BS-01 (Sprint 2) — cobertura para SolsticeFormula.
 *
 * SolsticeFormula é o motor de medidas calculadas (SUM/AVG/MIN/MAX + IF/AND/OR/NOT).
 * Inclui também a nova API DAX-like adicionada em LE-01 (calculate/sumIf/filter).
 */
import { describe, it, expect } from 'vitest';
import { SolsticeFormula } from './dist/formula.mjs';

const sampleRows = [
  { receita: 100, custo: 60, regiao: 'Sul',    ativo: true  },
  { receita: 200, custo: 90, regiao: 'Sul',    ativo: true  },
  { receita: 150, custo: 80, regiao: 'Norte',  ativo: false },
  { receita: 300, custo:120, regiao: 'Norte',  ativo: true  },
  { receita: 50,  custo: 25, regiao: 'Centro', ativo: true  }
];

describe('SolsticeFormula.parse — sintaxe', () => {
  it('número literal', () => {
    const p = SolsticeFormula.parse('42');
    expect(p.rpn).toBeDefined();
    expect(p.deps).toEqual([]);
  });
  it('coluna em {curly}', () => {
    const p = SolsticeFormula.parse('{receita}');
    expect(p.deps).toContain('receita');
  });
  it('expressão aritmética', () => {
    const p = SolsticeFormula.parse('{receita} - {custo}');
    expect(p.deps.sort()).toEqual(['custo', 'receita']);
  });
  it('função SUM', () => {
    const p = SolsticeFormula.parse('SUM({receita})');
    expect(p.deps).toEqual(['receita']);
  });
  it('parêntese desbalanceado lança', () => {
    expect(() => SolsticeFormula.parse('SUM({receita}')).toThrow();
  });
});

describe('SolsticeFormula.validate', () => {
  it('coluna existente → ok', () => {
    const r = SolsticeFormula.validate('SUM({receita})', { columns: ['receita', 'custo'] });
    expect(r.ok).toBe(true);
  });
  it('coluna inexistente → erro', () => {
    const r = SolsticeFormula.validate('SUM({inexistente})', { columns: ['receita'] });
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/não existe|inexistente/);
  });
  it('fórmula vazia → erro', () => {
    const r = SolsticeFormula.validate('', { columns: ['receita'] });
    expect(r.ok).toBe(false);
  });
});

describe('SolsticeFormula.evaluate — agregações sobre rows', () => {
  it('SUM({receita}) = 800', () => {
    const v = SolsticeFormula.evaluate('SUM({receita})', null, { rows: sampleRows });
    expect(v).toBe(800);
  });
  it('AVG({receita}) = 160', () => {
    const v = SolsticeFormula.evaluate('AVG({receita})', null, { rows: sampleRows });
    expect(v).toBe(160);
  });
  it('MIN({receita}) = 50', () => {
    expect(SolsticeFormula.evaluate('MIN({receita})', null, { rows: sampleRows })).toBe(50);
  });
  it('MAX({receita}) = 300', () => {
    expect(SolsticeFormula.evaluate('MAX({receita})', null, { rows: sampleRows })).toBe(300);
  });
  it('COUNT({receita}) = 5', () => {
    expect(SolsticeFormula.evaluate('COUNT({receita})', null, { rows: sampleRows })).toBe(5);
  });
});

describe('SolsticeFormula.dependencies', () => {
  it('lista colunas referenciadas', () => {
    expect(SolsticeFormula.dependencies('SUM({a}) + AVG({b})').sort()).toEqual(['a', 'b']);
  });
  it('fórmula inválida → []', () => {
    expect(SolsticeFormula.dependencies('SUM({a}')).toEqual([]);
  });
});

// ============================================================
// LE-01 (Sprint 2) — API DAX-like
// ============================================================

describe('SolsticeFormula.filter — predicado por objeto', () => {
  it('filtro igualdade simples', () => {
    const r = SolsticeFormula.filter(sampleRows, { regiao: 'Sul' });
    expect(r).toHaveLength(2);
    expect(r.every(x => x.regiao === 'Sul')).toBe(true);
  });
  it('filtro com operador { op, value }', () => {
    const r = SolsticeFormula.filter(sampleRows, { receita: { op: 'gte', value: 150 } });
    expect(r.map(x => x.receita).sort((a, b) => a - b)).toEqual([150, 200, 300]);
  });
  it('filtro vazio → todos', () => {
    expect(SolsticeFormula.filter(sampleRows, {})).toHaveLength(5);
    expect(SolsticeFormula.filter(sampleRows, null)).toHaveLength(5);
  });
  it('filtro "in"', () => {
    const r = SolsticeFormula.filter(sampleRows, { regiao: { op: 'in', value: ['Sul', 'Centro'] } });
    expect(r).toHaveLength(3);
  });
  it('filtro "contains"', () => {
    const r = SolsticeFormula.filter(sampleRows, { regiao: { op: 'contains', value: 'or' } });
    expect(r.every(x => x.regiao === 'Norte')).toBe(true);
  });
});

describe('SolsticeFormula.calculate — CALCULATE DAX-like', () => {
  it('SUM filtrado por região', () => {
    const v = SolsticeFormula.calculate('SUM({receita})', sampleRows, { regiao: 'Sul' });
    expect(v).toBe(300);
  });
  it('AVG filtrado', () => {
    const v = SolsticeFormula.calculate('AVG({custo})', sampleRows, { regiao: 'Norte' });
    expect(v).toBe(100); // (80+120)/2
  });
  it('filtro vazio = sem filtro', () => {
    const v = SolsticeFormula.calculate('SUM({receita})', sampleRows, {});
    expect(v).toBe(800);
  });
});

describe('SolsticeFormula.sumIf / avgIf / countIf', () => {
  it('sumIf coluna + filtro objeto', () => {
    expect(SolsticeFormula.sumIf('receita', sampleRows, { regiao: 'Sul' })).toBe(300);
    expect(SolsticeFormula.sumIf('receita', sampleRows, { ativo: true })).toBe(650);
  });
  it('avgIf média condicional', () => {
    expect(SolsticeFormula.avgIf('custo', sampleRows, { regiao: 'Sul' })).toBe(75); // (60+90)/2
  });
  it('countIf — quantas linhas matcham', () => {
    expect(SolsticeFormula.countIf(sampleRows, { ativo: true })).toBe(4);
    expect(SolsticeFormula.countIf(sampleRows, { regiao: 'Centro' })).toBe(1);
  });
  it('countIf operador gte', () => {
    expect(SolsticeFormula.countIf(sampleRows, { receita: { op: 'gte', value: 200 } })).toBe(2);
  });
});
