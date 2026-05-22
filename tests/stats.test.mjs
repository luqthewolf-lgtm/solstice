/**
 * BS-01 (Sprint 2) — cobertura de testes para SolsticeStats.
 *
 * SolsticeStats é o núcleo numérico do app: usado por KPI, BigNum, Distribution,
 * Boxplot, Heatmap, Forecast. Falha aqui = silentemente wrong em todo dashboard.
 *
 * Testes seguem a convenção: 1 describe por função, ~3-5 cases por função
 * cobrindo: caso feliz, edge case, input vazio, NaN/null, número.
 */
import { describe, it, expect } from 'vitest';
import { SolsticeStats } from './dist/stats.mjs';

describe('SolsticeStats.clean — limpeza de inputs', () => {
  it('remove NaN, null, undefined', () => {
    expect(SolsticeStats.clean([1, NaN, 2, null, 3, undefined])).toEqual([1, 2, 3]);
  });
  it('parseFloat strings', () => {
    expect(SolsticeStats.clean(['1', '2.5', 'abc'])).toEqual([1, 2.5]);
  });
  it('input vazio/null → []', () => {
    expect(SolsticeStats.clean([])).toEqual([]);
    expect(SolsticeStats.clean(null)).toEqual([]);
    expect(SolsticeStats.clean(undefined)).toEqual([]);
  });
  it('Infinity é descartado', () => {
    expect(SolsticeStats.clean([1, Infinity, -Infinity, 2])).toEqual([1, 2]);
  });
});

describe('SolsticeStats.sum', () => {
  it('soma simples', () => {
    expect(SolsticeStats.sum([1, 2, 3, 4])).toBe(10);
  });
  it('ignora NaN/null', () => {
    expect(SolsticeStats.sum([1, NaN, 2, null])).toBe(3);
  });
  it('vazio → 0', () => {
    expect(SolsticeStats.sum([])).toBe(0);
  });
  it('strings numéricas', () => {
    expect(SolsticeStats.sum(['1', '2', '3'])).toBe(6);
  });
});

describe('SolsticeStats.count / countNulls', () => {
  it('count = válidos', () => {
    expect(SolsticeStats.count([1, 2, null, 3, NaN])).toBe(3);
  });
  it('countNulls = inválidos', () => {
    expect(SolsticeStats.countNulls([1, 2, null, 3, NaN, undefined])).toBe(3);
  });
  it('vazio', () => {
    expect(SolsticeStats.count([])).toBe(0);
    expect(SolsticeStats.countNulls([])).toBe(0);
    expect(SolsticeStats.countNulls(null)).toBe(0);
  });
});

describe('SolsticeStats.mean', () => {
  it('média aritmética', () => {
    expect(SolsticeStats.mean([2, 4, 6])).toBe(4);
  });
  it('vazio → null', () => {
    expect(SolsticeStats.mean([])).toBe(null);
  });
  it('ignora NaN', () => {
    expect(SolsticeStats.mean([1, 2, NaN, 3])).toBe(2);
  });
});

describe('SolsticeStats.median', () => {
  it('ímpar — valor do meio', () => {
    expect(SolsticeStats.median([3, 1, 2])).toBe(2);
  });
  it('par — média dos dois centrais', () => {
    expect(SolsticeStats.median([1, 2, 3, 4])).toBe(2.5);
  });
  it('com outliers — não distorce', () => {
    expect(SolsticeStats.median([1, 2, 3, 100])).toBe(2.5);
  });
  it('vazio → null', () => {
    expect(SolsticeStats.median([])).toBe(null);
  });
});

describe('SolsticeStats.mode', () => {
  it('valor mais frequente', () => {
    expect(SolsticeStats.mode([1, 2, 2, 3])).toEqual([2]);
  });
  it('empate — array com múltiplos', () => {
    const m = SolsticeStats.mode([1, 1, 2, 2, 3]);
    expect(m.sort()).toEqual([1, 2]);
  });
  it('sem moda real (todos distintos) → []', () => {
    expect(SolsticeStats.mode([1, 2, 3])).toEqual([]);
  });
});

describe('SolsticeStats.min / max / minMax', () => {
  it('min / max simples', () => {
    expect(SolsticeStats.min([3, 1, 2])).toBe(1);
    expect(SolsticeStats.max([3, 1, 2])).toBe(3);
  });
  it('minMax (1 pass) bate min+max separados', () => {
    const mm = SolsticeStats.minMax([5, 2, 8, 1, 9, 3]);
    expect(mm.min).toBe(1);
    expect(mm.max).toBe(9);
  });
  it('input grande não estoura stack', () => {
    // Math.min(...arr) com arr>~100k estoura RangeError.
    // O helper SolsticeStats.min DEVE evitar isso usando reduce.
    const big = new Array(200000).fill(0).map((_, i) => i);
    expect(() => SolsticeStats.min(big)).not.toThrow();
    expect(SolsticeStats.min(big)).toBe(0);
    expect(SolsticeStats.max(big)).toBe(199999);
  });
  it('vazio → null', () => {
    expect(SolsticeStats.min([])).toBe(null);
    expect(SolsticeStats.max([])).toBe(null);
  });
});

describe('SolsticeStats — desvio padrão', () => {
  it('stdDev simples (população)', () => {
    // dataset [2,4,4,4,5,5,7,9] tem stdDev populacional = 2
    expect(Math.round(SolsticeStats.stdDev([2, 4, 4, 4, 5, 5, 7, 9]) * 100)).toBe(200);
  });
  it('vazio ou 1 elemento → null/0', () => {
    const r = SolsticeStats.stdDev([]);
    expect(r === null || r === 0).toBe(true);
  });
});

describe('SolsticeStats — quantis/quartis', () => {
  it('quartiles divide em quartos', () => {
    const q = SolsticeStats.quartiles([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(q.q2).toBe(5);
    // q1 e q3 podem variar pela definição (Tukey vs linear) — testa ordem
    expect(q.q1).toBeLessThan(q.q2);
    expect(q.q3).toBeGreaterThan(q.q2);
  });
});

describe('SolsticeStats — distinctCount', () => {
  it('conta únicos', () => {
    expect(SolsticeStats.distinctCount(['a', 'b', 'a', 'c', 'b'])).toBe(3);
  });
  it('vazio → 0', () => {
    expect(SolsticeStats.distinctCount([])).toBe(0);
  });
});
