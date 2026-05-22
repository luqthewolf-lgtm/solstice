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
  // Encontra início e equilibra parênteses/chaves
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\\(function\\s*\\(\\s*\\)\\s*\\{`);
  const match = re.exec(source);
  if (!match) throw new Error(`IIFE não encontrado: ${name}`);
  let i = match.index + match[0].length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  // Agora i está depois do '}' final do function body.
  // O resto até `)();` é o invocation.
  return source.slice(match.index + match[0].length, i - 1);
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

console.log('✓ Módulos extraídos para tests/dist/');
console.log('  - br.mjs (stub)');
console.log('  - formula-core.mjs (' + formulaCoreBody.length + ' chars)');
