/**
 * B8-02 (v6-autonomous / BS-02) — Boot test.
 *
 * Replica em CI o teste que pegou o hotfix do SolsticeViews duplicado.
 * Sem Playwright (zero deps novas) — só lê o HTML, extrai o <script>
 * principal e tenta parsear com `new Function(src)`.
 *
 * Pega: SyntaxError, identificadores duplicados, IIFE mal-formada.
 * NÃO pega: erros de runtime (precisaria de jsdom + execução real).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, '..', 'solstice_baseline.html');

let html;
try {
  html = readFileSync(HTML_PATH, 'utf-8');
} catch (e) {
  // Mensagem útil caso o test rode fora do repo
  throw new Error('solstice_baseline.html não encontrado em ' + HTML_PATH);
}

function extractScripts() {
  const re = /<script(?:\s[^>]*(?<!src="[^"]*"))?\s*>([\s\S]*?)<\/script>/g;
  const scripts = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    scripts.push(m[1]);
  }
  return scripts;
}

describe('Boot integrity — HTML structure', () => {
  it('termina com </html>', () => {
    expect(html.trim().endsWith('</html>')).toBe(true);
  });
  it('tem boot sentinel "[Solstice] boot OK"', () => {
    expect(html.includes('[Solstice] boot OK')).toBe(true);
  });
  it('tem ao menos 1 script inline', () => {
    const scripts = extractScripts();
    expect(scripts.length).toBeGreaterThan(0);
  });
});

describe('Boot integrity — script parse-check', () => {
  it('cada <script> inline parseia sem SyntaxError', () => {
    const scripts = extractScripts();
    const failures = [];
    scripts.forEach((src, i) => {
      if (src.length < 50) return; // ignora script vazio
      try {
        new Function(src);
      } catch (e) {
        failures.push({ index: i, length: src.length, error: e.message });
      }
    });
    if (failures.length) {
      console.error('Parse failures:', failures);
    }
    expect(failures).toHaveLength(0);
  });

  it('script principal (maior) parseia sem erro', () => {
    const scripts = extractScripts();
    const main = scripts.reduce((a, b) => (a.length > b.length ? a : b), '');
    expect(main.length).toBeGreaterThan(100000); // sanity: o main é grande
    let error = null;
    try { new Function(main); } catch (e) { error = e.message; }
    expect(error).toBeNull();
  });
});

describe('Boot integrity — anti-duplicação Solstice* IIFE', () => {
  it('nenhum const SolsticeXxx = (function declarado 2x', () => {
    // Remove comentários /* ... */ antes de matchar
    const stripped = html.replace(/\/\*[\s\S]*?\*\//g, '');
    const matches = [...stripped.matchAll(/const\s+(Solstice[A-Za-z0-9]+)\s*=\s*\(function/g)];
    const counts = {};
    matches.forEach(m => { counts[m[1]] = (counts[m[1]] || 0) + 1; });
    const dups = Object.entries(counts).filter(([_, n]) => n > 1);
    if (dups.length) {
      console.error('IIFE duplicadas:', dups);
    }
    expect(dups).toHaveLength(0);
  });
});

describe('Boot integrity — módulos críticos presentes', () => {
  // Esses módulos são base; se sumirem, regressão grave.
  const required = [
    'SolsticeStore', 'SolsticeUtils', 'SolsticeCanvas', 'SolsticeIngest',
    'SolsticeStats', 'SolsticeFormula', 'SolsticeKPI', 'SolsticeComponents',
    // Módulos v6-autonomous críticos
    'SolsticeErrorBoundary', 'SolsticeConfig', 'SolsticeIDB',
    'SolsticeFolderAttach', 'SolsticeMultiTab', 'SolsticeFmt'
  ];
  required.forEach(mod => {
    it('declara const ' + mod + ' = (function', () => {
      const re = new RegExp('const ' + mod + '\\s*=\\s*\\(function');
      expect(re.test(html)).toBe(true);
    });
  });
});
