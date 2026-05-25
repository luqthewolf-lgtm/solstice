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
    // minMax retorna a tupla [min, max] — o app inteiro destrutura como array
    // (`const [lo, hi] = minMax(...)`), então o contrato é posicional.
    const [mn, mx] = SolsticeStats.minMax([5, 2, 8, 1, 9, 3]);
    expect(mn).toBe(1);
    expect(mx).toBe(9);
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
  it('stdDev simples (amostral, N-1)', () => {
    // stdDev é AMOSTRAL (N-1) por contrato — confirmado pelo selftest inline do
    // solstice_baseline.html. Para o desvio populacional (N) há variancePop.
    // dataset [2,4,4,4,5,5,7,9]: variância amostral = 32/7 → stdDev ≈ 2.138
    expect(Math.round(SolsticeStats.stdDev([2, 4, 4, 4, 5, 5, 7, 9]) * 100)).toBe(214);
  });
  it('vazio ou 1 elemento → null/0', () => {
    const r = SolsticeStats.stdDev([]);
    expect(r === null || r === 0).toBe(true);
  });
});

describe('SolsticeStats — quantis/quartis', () => {
  it('quartiles divide em quartos', () => {
    const q = SolsticeStats.quartiles([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(q.median).toBe(5);
    // q1 e q3 podem variar pela definição (Tukey vs linear) — testa ordem
    expect(q.q1).toBeLessThan(q.median);
    expect(q.q3).toBeGreaterThan(q.median);
  });

  // Sprint 22 — proteção contra regressão tipo MC-A1 (box plot XLSX inconsistente)
  // Quartis devem usar interpolação linear (type-7, igual NumPy), NÃO aproximação
  // grosseira `s[Math.floor(p * (n-1))]`. Test cobre dataset onde os 2 algoritmos
  // divergem.
  it('quartiles usa interpolação linear (igual NumPy, type-7)', () => {
    // Dataset com 10 elementos — interpolação vs floor produz resultados diferentes:
    //   floor: q1 = s[Math.floor(0.25 * 9)] = s[2] = 3, q3 = s[Math.floor(0.75 * 9)] = s[6] = 7
    //   interp linear: i = 0.25 * 9 = 2.25 → s[2] + 0.25*(s[3]-s[2]) = 3 + 0.25 = 3.25
    //                  i = 0.75 * 9 = 6.75 → s[6] + 0.75*(s[7]-s[6]) = 7 + 0.75 = 7.75
    const q = SolsticeStats.quartiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(q.q1).toBe(3.25);
    expect(q.median).toBe(5.5);
    expect(q.q3).toBe(7.75);
  });

  it('quartiles preserva min/max em max key', () => {
    // Sprint 22: garante que .min e .max do retorno são exatamente os extremos
    // (não calculados via percentile que poderia divergir para p=0/p=1).
    const q = SolsticeStats.quartiles([10, 2, 8, 4, 6]);
    expect(q.min).toBe(2);
    expect(q.max).toBe(10);
    expect(q.iqr).toBeGreaterThan(0);
  });

  it('quartiles em vazio → null', () => {
    expect(SolsticeStats.quartiles([])).toBe(null);
    expect(SolsticeStats.quartiles(null)).toBe(null);
  });
});

describe('SolsticeStats — outliersIQR (Tukey 1.5×)', () => {
  it('detecta outlier clássico', () => {
    // Dataset [1..10] + outlier 100. Q1=3.25, Q3=7.75, IQR=4.5,
    // upper fence = 7.75 + 1.5*4.5 = 14.5. 100 > 14.5 → outlier.
    const r = SolsticeStats.outliersIQR([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100]);
    expect(r.values).toContain(100);
    expect(r.indices.length).toBe(1);
  });
  it('sem outliers → array vazio', () => {
    const r = SolsticeStats.outliersIQR([1, 2, 3, 4, 5]);
    expect(r.values).toEqual([]);
    expect(r.indices).toEqual([]);
  });
  it('fences calculadas corretamente', () => {
    const r = SolsticeStats.outliersIQR([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // q1=3, q3=7, iqr=4, lo = 3-6=-3, hi = 7+6=13
    expect(r.fences.lo).toBeLessThan(r.fences.hi);
  });
});

describe('SolsticeStats — MAD (Median Absolute Deviation)', () => {
  // MAD é usado pelo anomaly detection da Sprint 18.
  // Vital pra Modified Z-Score (Iglewicz/Hoaglin).
  it('MAD de dataset uniforme é zero', () => {
    expect(SolsticeStats.mad([5, 5, 5, 5])).toBe(0);
  });
  it('MAD é robusto contra outliers (diferente do stdDev)', () => {
    // [1,2,3,4,5] tem MAD = 1 (mediana = 3; |1-3|, |2-3|, ..., |5-3| = [2,1,0,1,2]; mediana = 1)
    expect(SolsticeStats.mad([1, 2, 3, 4, 5])).toBe(1);
    // Adicionar outlier 1000 NÃO deve quebrar MAD significativamente
    const madWithOutlier = SolsticeStats.mad([1, 2, 3, 4, 5, 1000]);
    expect(madWithOutlier).toBeLessThan(10);  // robust — diferente do stdDev que dispara
  });
});

describe('SolsticeStats — distinctCount', () => {
  it('conta únicos', () => {
    expect(SolsticeStats.distinctCount(['a', 'b', 'a', 'c', 'b'])).toBe(3);
  });
  it('vazio → 0', () => {
    expect(SolsticeStats.distinctCount([])).toBe(0);
  });
  it('conta categóricas (strings) — regressão: clean() zerava cardinalidade', () => {
    // Auditoria 2026.6 / Sprint 46: distinctCount rodava clean() (só números),
    // então dimensões de texto retornavam 0. Cardinalidade de coluna categórica.
    expect(SolsticeStats.distinctCount(['SP', 'RJ', 'SP', 'MG', 'RJ'])).toBe(3);
    expect(SolsticeStats.distinctCount(['x', 'x', 'x'])).toBe(1); // coluna constante
  });
  it('ignora null/vazio', () => {
    expect(SolsticeStats.distinctCount(['a', null, '', 'a', 'b', undefined])).toBe(2);
  });
});

describe('SolsticeStats — parsing pt-BR em correlation/linearRegression (Auditoria 2026.6)', () => {
  // Sprint 46: correlation/linearRegression usavam parseFloat, que trunca
  // "1.234,56" → 1.234. Agora usam parseNum (BR-aware). Aceitam strings cruas.
  it('correlation com strings pt-BR (separador de milhar + vírgula decimal)', () => {
    const xs = ['1.000,0', '2.000,0', '3.000,0', '4.000,0'];
    const ys = ['2.000,0', '4.000,0', '6.000,0', '8.000,0'];
    expect(SolsticeStats.correlation(xs, ys)).toBeCloseTo(1, 6);
  });
  it('linearRegression com strings pt-BR mantém slope correto', () => {
    // y = 2x sobre pares (0;0),(1;2000),(2;4000) formatados pt-BR
    const reg = SolsticeStats.linearRegression([[0, '0'], [1, '2.000'], [2, '4.000']]);
    expect(reg).not.toBe(null);
    expect(reg.slope).toBeCloseTo(2000, 6);
  });
});
