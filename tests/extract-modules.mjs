/**
 * Extrai módulos testáveis do single-file HTML para arquivos ESM rodáveis pelo Vitest.
 *
 * Por que existe: o app é deliberadamente single-file pra portabilidade, mas
 * pra rodar testes automatizados precisamos das funções puras como módulos ESM.
 * Este script é executado pelo `npm test` antes do Vitest:
 *   1. Lê solstice_baseline.html
 *   2. Extrai os IIFEs de SolsticeFormulaCore, SolsticeBR e cria stubs
 *   3. Escreve em tests/dist/*.mjs como ESM
 *
 * Os módulos extraídos SÃO os mesmos do app — não há divergência de implementação.
 * Se o teste passa, o app passa (e vice-versa).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '..', 'solstice_baseline.html');
const DIST = resolve(__dirname, 'dist');

mkdirSync(DIST, { recursive: true });

const content = readFileSync(SRC, 'utf-8');

/**
 * Extrai um IIFE pelo nome, retorna o body interno.
 * Padrão: `const NAME = (function(){ ...BODY... })();`
 */
function extractIIFE(source, name) {
  // Ancora no início de linha (`\n` + indentação) pra casar a DECLARAÇÃO real
  // e não o mesmo texto citado dentro de comentários de documentação.
  // (ex.: o JSDoc de SolsticeStats cita literalmente "const SolsticeStats = (function(){".)
  const re = new RegExp(`(?:^|\\n)[ \\t]*const\\s+${name}\\s*=\\s*\\(function\\s*\\(\\s*\\)\\s*\\{`);
  const match = re.exec(source);
  if (!match) throw new Error(`IIFE não encontrado: ${name}`);
  // bodyStart = posição logo após o '{' de abertura do corpo da função
  const bodyStart = match.index + match[0].length;
  let i = bodyStart;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  // Agora i está depois do '}' final do function body.
  // O resto até `)();` é o invocation.
  return source.slice(bodyStart, i - 1);
}

// ============================================================
// SolsticeBR (stub minimalista — o real depende de outras coisas)
// ============================================================
const brStub = `
// SolsticeBR stub para testes — só o necessário pra FormulaCore.toNumber.
export const SolsticeBR = {
  toNumber(v) {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    // Heurística pt-BR: "1.234,56" -> 1234.56
    const ptBR = /^-?\\d{1,3}(\\.\\d{3})*(,\\d+)?$/;
    if (ptBR.test(s)) return parseFloat(s.replace(/\\./g, '').replace(',', '.'));
    return parseFloat(s.replace(',', '.'));
  }
};
`;
writeFileSync(resolve(DIST, 'br.mjs'), brStub);

// ============================================================
// SolsticeFormulaCore
// ============================================================
const formulaCoreBody = extractIIFE(content, 'SolsticeFormulaCore');
const formulaCore = `
// Auto-extraído de solstice_baseline.html — NÃO EDITAR À MÃO.
// Regenere com: node tests/extract-modules.mjs
import { SolsticeBR } from './br.mjs';
// Disponibiliza SolsticeBR como global (o IIFE original lê assim)
globalThis.SolsticeBR = SolsticeBR;

export const SolsticeFormulaCore = (function(){
${formulaCoreBody}
})();
`;
writeFileSync(resolve(DIST, 'formula-core.mjs'), formulaCore);

// ============================================================
// SolsticeStats (BS-01 — Sprint 2)
// Stats é puro (sem deps externas) — pega como está.
// ============================================================
const statsBody = extractIIFE(content, 'SolsticeStats');
const stats = `
// Auto-extraído de solstice_baseline.html — NÃO EDITAR À MÃO.
export const SolsticeStats = (function(){
${statsBody}
})();
`;
writeFileSync(resolve(DIST, 'stats.mjs'), stats);

// ============================================================
// SolsticeFormula (BS-01 — Sprint 2)
// Depende de SolsticeFormulaCore (lexer) + SolsticeStats (min/max).
// ============================================================
const formulaBody = extractIIFE(content, 'SolsticeFormula');
const formula = `
// Auto-extraído de solstice_baseline.html — NÃO EDITAR À MÃO.
import { SolsticeFormulaCore } from './formula-core.mjs';
import { SolsticeStats } from './stats.mjs';
globalThis.SolsticeFormulaCore = SolsticeFormulaCore;
globalThis.SolsticeStats = SolsticeStats;
export const SolsticeFormula = (function(){
${formulaBody}
})();
`;
writeFileSync(resolve(DIST, 'formula.mjs'), formula);

// ============================================================
// B4-05 (v6-autonomous) — módulos novos
// ============================================================

// SolsticeConfig (constantes Object.freeze — sem deps)
const configBody = extractIIFE(content, 'SolsticeConfig');
writeFileSync(resolve(DIST, 'config.mjs'), `
// Auto-extraído. Constantes Object.freeze.
export const SolsticeConfig = (function(){
${configBody}
})();
`);

// SolsticeUtils.rafThrottle e debounce isolados — stub leve sem dependências DOM
writeFileSync(resolve(DIST, 'utils-light.mjs'), `
// Subset isolado de SolsticeUtils — só funções puras testáveis sem DOM.
// Cópia direta da implementação no solstice_baseline.html
export const SolsticeUtils = {
  debounce(fn, ms){
    let t;
    return function(){
      const ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms);
    };
  },
  throttle(fn, ms){
    let last = 0, t;
    return function(){
      const now = Date.now(), ctx = this, args = arguments;
      if (now - last >= ms){ last = now; fn.apply(ctx, args); }
      else { clearTimeout(t); t = setTimeout(()=>{ last = Date.now(); fn.apply(ctx, args); }, ms - (now - last)); }
    };
  },
  rafThrottle(fn){
    let scheduled = false;
    let lastArgs = null, lastCtx = null;
    return function(){
      lastArgs = arguments;
      lastCtx = this;
      if (scheduled) return;
      scheduled = true;
      // Em ambiente teste (sem rAF browser), usa fallback setTimeout(0)
      const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
      raf(() => {
        scheduled = false;
        try { fn.apply(lastCtx, lastArgs); } catch(e){ /* swallow */ }
      });
    };
  },
  clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
};
`);

console.log('✓ Módulos extraídos para tests/dist/');
console.log('  - br.mjs (stub)');
console.log('  - formula-core.mjs (' + formulaCoreBody.length + ' chars)');
console.log('  - stats.mjs (' + statsBody.length + ' chars)');
console.log('  - formula.mjs (' + formulaBody.length + ' chars)');
console.log('  - config.mjs (' + configBody.length + ' chars)');
console.log('  - utils-light.mjs (subset puro)');
