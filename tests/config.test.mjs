/**
 * B4-05 (v6-autonomous) — testes para SolsticeConfig.
 *
 * SolsticeConfig é Object.freeze de constantes documentadas. Garantir que:
 *   - Está congelado (mutação é no-op em strict, lança erro em desenvolvimento)
 *   - Valores estão em faixas razoáveis
 *   - Chaves não somem entre versões (regressão)
 */
import { describe, it, expect } from 'vitest';
import { SolsticeConfig } from './dist/config.mjs';

describe('SolsticeConfig — imutabilidade', () => {
  it('é Object.freeze (frozen)', () => {
    expect(Object.isFrozen(SolsticeConfig)).toBe(true);
  });
  it('mutação não altera valor', () => {
    const before = SolsticeConfig.LARGE_CSV_BYTES;
    try { SolsticeConfig.LARGE_CSV_BYTES = 1; } catch(_){}
    expect(SolsticeConfig.LARGE_CSV_BYTES).toBe(before);
  });
});

describe('SolsticeConfig — chaves obrigatórias presentes', () => {
  const required = [
    'LARGE_CSV_BYTES',
    'LARGE_DATASET_ROWS',
    'INPUT_DEBOUNCE_MS',
    'RESIZE_THROTTLE_MS',
    'AUTOSAVE_INTERVAL_MS',
    'DICT_DETECT_MIN_CONF',
    'QUERY_MIN_CONFIDENCE',
    'QUALITY_INVALID_ERROR',
    'INSIGHTS_MAX_SHOW',
    'TREND_R2_MIN',
    'TREND_MAGNITUDE_MIN',
    'CACHE_TTL_MS',
    'CACHE_MAX_ENTRIES',
    'TOUR_AUTOSTART_DELAY_MS',
    'LZ_MIN_SIZE_TO_COMPRESS',
    'SNAPSHOT_MAX_SIZE_BYTES'
  ];
  required.forEach(k => {
    it('tem ' + k, () => {
      expect(SolsticeConfig[k]).toBeDefined();
      expect(typeof SolsticeConfig[k]).toBe('number');
    });
  });
});

describe('SolsticeConfig — faixas razoáveis', () => {
  it('LARGE_CSV_BYTES >= 1MB e <= 50MB', () => {
    expect(SolsticeConfig.LARGE_CSV_BYTES).toBeGreaterThanOrEqual(1 * 1024 * 1024);
    expect(SolsticeConfig.LARGE_CSV_BYTES).toBeLessThanOrEqual(50 * 1024 * 1024);
  });
  it('debounce/throttle entre 50 e 1000 ms', () => {
    expect(SolsticeConfig.INPUT_DEBOUNCE_MS).toBeGreaterThanOrEqual(50);
    expect(SolsticeConfig.INPUT_DEBOUNCE_MS).toBeLessThanOrEqual(1000);
    expect(SolsticeConfig.RESIZE_THROTTLE_MS).toBeGreaterThanOrEqual(50);
  });
  it('AUTOSAVE_INTERVAL_MS entre 1s e 60s', () => {
    expect(SolsticeConfig.AUTOSAVE_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
    expect(SolsticeConfig.AUTOSAVE_INTERVAL_MS).toBeLessThanOrEqual(60000);
  });
  it('confidences entre 0 e 1', () => {
    expect(SolsticeConfig.DICT_DETECT_MIN_CONF).toBeGreaterThanOrEqual(0);
    expect(SolsticeConfig.DICT_DETECT_MIN_CONF).toBeLessThanOrEqual(1);
    expect(SolsticeConfig.QUERY_MIN_CONFIDENCE).toBeGreaterThanOrEqual(0);
    expect(SolsticeConfig.QUERY_MIN_CONFIDENCE).toBeLessThanOrEqual(1);
    expect(SolsticeConfig.QUALITY_INVALID_ERROR).toBeGreaterThanOrEqual(0);
    expect(SolsticeConfig.QUALITY_INVALID_ERROR).toBeLessThanOrEqual(1);
  });
  it('INSIGHTS_MAX_SHOW entre 3 e 20', () => {
    expect(SolsticeConfig.INSIGHTS_MAX_SHOW).toBeGreaterThanOrEqual(3);
    expect(SolsticeConfig.INSIGHTS_MAX_SHOW).toBeLessThanOrEqual(20);
  });
  it('SNAPSHOT_MAX_SIZE_BYTES > LZ_MIN', () => {
    expect(SolsticeConfig.SNAPSHOT_MAX_SIZE_BYTES).toBeGreaterThan(SolsticeConfig.LZ_MIN_SIZE_TO_COMPRESS);
  });
});
