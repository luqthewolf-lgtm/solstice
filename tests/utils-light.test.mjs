/**
 * B4-05 (v6-autonomous) — testes para SolsticeUtils (subset puro).
 *
 * debounce, throttle, rafThrottle, clamp são funções puras.
 * Não precisam de DOM nem requestAnimationFrame real.
 */
import { describe, it, expect, vi } from 'vitest';
import { SolsticeUtils } from './dist/utils-light.mjs';

describe('SolsticeUtils.clamp', () => {
  it('clampa dentro da faixa', () => {
    expect(SolsticeUtils.clamp(5, 0, 10)).toBe(5);
    expect(SolsticeUtils.clamp(-5, 0, 10)).toBe(0);
    expect(SolsticeUtils.clamp(15, 0, 10)).toBe(10);
  });
  it('borda inclusiva', () => {
    expect(SolsticeUtils.clamp(0, 0, 10)).toBe(0);
    expect(SolsticeUtils.clamp(10, 0, 10)).toBe(10);
  });
});

describe('SolsticeUtils.debounce', () => {
  it('chama 1x depois do delay', async () => {
    const spy = vi.fn();
    const d = SolsticeUtils.debounce(spy, 50);
    d(); d(); d();
    expect(spy).toHaveBeenCalledTimes(0);
    await new Promise(r => setTimeout(r, 80));
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('passa último argumento', async () => {
    const spy = vi.fn();
    const d = SolsticeUtils.debounce(spy, 50);
    d('a'); d('b'); d('c');
    await new Promise(r => setTimeout(r, 80));
    expect(spy).toHaveBeenCalledWith('c');
  });
});

describe('SolsticeUtils.throttle', () => {
  it('chama imediatamente na primeira', () => {
    const spy = vi.fn();
    const t = SolsticeUtils.throttle(spy, 100);
    t();
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('garante max 1 chamada por janela', async () => {
    const spy = vi.fn();
    const t = SolsticeUtils.throttle(spy, 50);
    t(); t(); t(); // 1 imediata, restantes agrupadas
    expect(spy).toHaveBeenCalledTimes(1);
    await new Promise(r => setTimeout(r, 80));
    // trailing call dispara após janela
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('SolsticeUtils.rafThrottle', () => {
  it('agrupa múltiplas chamadas síncronas em 1 só', async () => {
    const spy = vi.fn();
    const r = SolsticeUtils.rafThrottle(spy);
    r(); r(); r(); r();
    expect(spy).toHaveBeenCalledTimes(0); // ainda não disparou
    await new Promise(res => setTimeout(res, 20));
    expect(spy).toHaveBeenCalledTimes(1); // 1 só após o frame
  });
  it('passa último argumento', async () => {
    const spy = vi.fn();
    const r = SolsticeUtils.rafThrottle(spy);
    r('a'); r('b'); r('c');
    await new Promise(res => setTimeout(res, 20));
    expect(spy).toHaveBeenCalledWith('c');
  });
  it('reagenda depois do frame', async () => {
    const spy = vi.fn();
    const r = SolsticeUtils.rafThrottle(spy);
    r(1);
    await new Promise(res => setTimeout(res, 20));
    r(2);
    await new Promise(res => setTimeout(res, 20));
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
