# PORTABILIDADE — Bloco 2: Ingestão + Validador + Editor + Tipos Expandidos

> Documento gerado automaticamente. Lista cada feature do bloco e
> como portá-la para outros projetos, especialmente o projeto Itaú via Eva.

---

## 📋 ÍNDICE DE FEATURES PORTÁVEIS

| # | Feature | Complexidade | Tempo estimado | Dependências |
|---|---------|--------------|----------------|--------------|
| 1 | Validação CPF / CNPJ / CEP com DV completo | 🟢 Simples | 1-2h | nenhuma |
| 2 | Detector automático de dialeto CSV | 🟡 Média | 2-3h | nenhuma |
| 3 | Inferidor de 30 tipos de coluna | 🔴 Complexa | 8-12h | (parcial) BR validators |
| 4 | Pipeline de ingestão em 5 etapas | 🟡 Média | 3-4h | parser CSV |
| 5 | Score de qualidade adaptativo por perfil | 🔴 Complexa | 4-6h | tipos inferidos |
| 6 | Classificador de tipo de dataset (6 perfis) | 🟢 Simples | 1-2h | tipos inferidos |
| 7 | Sparkline SVG inline (sem libs) | 🟢 Simples | 30min-1h | nenhuma |
| 8 | Tabela com formatação por tipo | 🟡 Média | 2-3h | Locale + Types |
| 9 | Editor de colunas (rename/drop/type/transform) | 🟡 Média | 4-6h | Store + Types |
| 10 | Catálogo de erros expansível via `register()` | 🟢 Simples | 30min | sistema de modal |

---

## 🟢 FEATURE 1: Validação CPF / CNPJ / CEP com algoritmo de DV

### 📖 O que faz no Solstice

`Solstice.BR.isCPF('111.444.777-35')` retorna `true` ou `false` rodando o algoritmo oficial dos dois dígitos verificadores. Rejeita também sequências repetidas (`11111111111`), que passam num regex de formato mas são inválidas oficialmente.

### 🎯 Por que vale portar

**Valor enorme para o Itaú.** Qualquer fluxo de KYC, onboarding, compliance ou cadastro de cliente PJ se beneficia. Vai de fora ("11.111.111/1111-11 parece OK") pra dentro ("CNPJ rejeitado pelo DV — recusar").

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | módulo `SolsticeBR` | 1690-1770 |
| Erros associados | `INVALID_CPF`, `INVALID_CNPJ` | 2520-2545 |

### 🔗 Dependências

**Nenhuma.** 100% vanilla.

### 📝 Código fonte autônomo

```javascript
const BR = (function(){
  function _digits(s){ return String(s||'').replace(/\D/g, ''); }

  function isCPF(s){
    const c = _digits(s);
    if (c.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(c)) return false;       // todos iguais → inválido
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
    let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(c[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
    let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
    return d2 === parseInt(c[10]);
  }

  function isCNPJ(s){
    const c = _digits(s);
    if (c.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(c)) return false;
    const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
    const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(c[i]) * w1[i];
    let d1 = sum % 11; d1 = d1 < 2 ? 0 : 11 - d1;
    if (d1 !== parseInt(c[12])) return false;
    sum = 0;
    for (let i = 0; i < 13; i++) sum += parseInt(c[i]) * w2[i];
    let d2 = sum % 11; d2 = d2 < 2 ? 0 : 11 - d2;
    return d2 === parseInt(c[13]);
  }

  function isCEP(s){
    const c = _digits(s);
    return c.length === 8 && !/^0{8}$/.test(c);
  }

  function formatCPF(s){ const c = _digits(s); return c.length===11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : s; }
  function formatCNPJ(s){ const c = _digits(s); return c.length===14 ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : s; }
  function formatCEP(s){ const c = _digits(s); return c.length===8 ? c.replace(/(\d{5})(\d{3})/, '$1-$2') : s; }

  function maskCPF(s){ const c = _digits(s); return c.length===11 ? c.slice(0,3)+'.***.***-'+c.slice(9) : s; }

  return { isCPF, isCNPJ, isCEP, formatCPF, formatCNPJ, formatCEP, maskCPF };
})();

// Uso:
BR.isCPF('111.444.777-35');         // true
BR.isCPF('11111111111');             // false (sequência igual)
BR.isCPF('111.444.777-36');         // false (DV errado)
BR.formatCPF('11144477735');        // "111.444.777-35"
BR.maskCPF('11144477735');          // "111.***.***-35"  ← útil em logs/UI pública
```

### 🤖 Prompt para Eva

```
Eva, preciso de validação real de CPF/CNPJ no projeto.
HOJE estamos usando só regex, o que aceita "11111111111" como CPF.

Tenho referência abaixo com algoritmo oficial:

[colar JS]

Onde aplicar:
1. Form de cadastro de cliente PJ: ao perder foco do input, validar e mostrar erro inline se inválido
2. Importação de arquivo de clientes: rejeitar linhas com CPF/CNPJ inválido (log em separado)
3. Mascaramento em logs/UI quando role do usuário não é admin (usar maskCPF)

Vanilla, sem libs. Adicionar testes unitários com pelo menos 5 CPFs válidos e 5 inválidos conhecidos.
```

### ⚠️ Pegadinhas

1. **Sequências iguais** (11111111111, 22222222222...) passam a fórmula matemática mas a Receita Federal não os emite. Sempre rejeitar.
2. **DV pode dar 10** — converter para 0 (regra oficial).
3. **CPF 000.000.000-00 é tecnicamente válido** pelos DVs (0×qualquer = 0). Geralmente rejeitamos como inválido na regra de negócio. Adicionar `if (/^0+$/.test(c)) return false`.
4. **Não confundir com "CPF na base"**: validação local diz se é matematicamente possível. Confirmação real exige Receita.
5. **Não armazenar** CPF/CNPJ em localStorage sem encriptar. LGPD.

### ✅ Como testar

```javascript
console.assert(BR.isCPF('111.444.777-35') === true);
console.assert(BR.isCPF('11144477735') === true);
console.assert(BR.isCPF('111.444.777-36') === false);
console.assert(BR.isCPF('11111111111') === false);
console.assert(BR.isCNPJ('11.444.777/0001-61') === true);
console.assert(BR.isCNPJ('11444777000162') === false);
console.assert(BR.isCEP('01310-100') === true);
console.assert(BR.isCEP('00000000') === false);
```

### 🔄 Variações

- **Validação no servidor** consultando Receita Federal API. Local primeiro (rápido, free), servidor só se passar.
- **Bloco de inputs guiados**: máscara aplicada conforme digita.

---

## 🟡 FEATURE 2: Detector automático de dialeto CSV

### 📖 O que faz no Solstice

Recebe texto cru de CSV e devolve `{ delimiter, quote, eol, hasHeader, confidence }`. Decide entre `,`, `;`, `\t`, `|` por análise estatística: avg de ocorrências por linha + variância (baixa variância = bom).

### 🎯 Por que vale portar

Internamente no Itaú, CSVs vêm de fontes diferentes (SAS, Excel BR `;`, sistemas legados com TAB). Detector evita o usuário ter que ficar adivinhando separador.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeIngest.detectDialect` | 2080-2105 |

### 🔗 Dependências

**Nenhuma.**

### 📝 Código fonte autônomo

```javascript
function detectDialect(text){
  const sample = text.slice(0, 16384);    // 16KB amostra
  const lines = sample.split(/\r?\n/).filter(l => l.length > 0);
  if (!lines.length) return null;
  const head = lines.slice(0, Math.min(50, lines.length));

  const candidates = [',', ';', '\t', '|'];
  let bestDelim = ','; let bestScore = -1;
  for (const d of candidates){
    const counts = head.map(l => (l.match(new RegExp('\\'+d, 'g')) || []).length);
    const avg = counts.reduce((a,b)=>a+b,0) / counts.length;
    if (avg < 1) continue;                  // <1 ocorrência média → não é separador
    const variance = counts.reduce((s,c) => s + (c - avg)**2, 0) / counts.length;
    const score = avg / (1 + variance);     // alto avg + baixa variância = bom
    if (score > bestScore){ bestScore = score; bestDelim = d; }
  }

  // has_header: primeira linha < 50% numérica?
  const RX_NUM = /^-?\d+([.,]\d+)?$/;
  const firstFields = head[0].split(bestDelim);
  const numInHead = firstFields.filter(f => RX_NUM.test(f.trim())).length;
  const hasHeader = numInHead / firstFields.length < 0.5;

  const eol = /\r\n/.test(sample) ? '\r\n' : '\n';

  return { delimiter: bestDelim, quote: '"', eol, hasHeader, confidence: Math.min(1, bestScore / 3) };
}

// Uso:
const csv1 = "a,b,c\n1,2,3\n4,5,6";
detectDialect(csv1);  // { delimiter: ',', confidence: ~1, hasHeader: true }

const csv2 = "nome;idade;score\nAna;30;0,85\nLuis;25;0,72";
detectDialect(csv2);  // { delimiter: ';', confidence: ~0.9, hasHeader: true }
```

### 🤖 Prompt para Eva

```
Eva, no projeto importamos CSVs de várias fontes (SAS, Excel BR com ; , exports do TSYS).
Hoje o usuário escolhe o separador manualmente. Quero detecção automática.

Referência:

[colar JS]

Adapte:
- Considerar separadores específicos do nosso ecossistema (ex: pipe é comum em arquivo X)
- Detectar encoding também? Pode tentar via heurística (BOM, presença de caracteres não-ASCII)
- Se confidence < 0.6, AINDA OFERECER ao usuário confirmar (não decidir silenciosamente)

Mantenha vanilla. Não usar lib (csv-parse, papaparse) só para isso.
```

### ⚠️ Pegadinhas

1. **CSV pequeno** (< 50 linhas): a heurística degrada. Threshold mínimo seria 5 linhas.
2. **Coluna única**: nenhum delimitador detectado → confidence 0, fica `,` default.
3. **Conteúdo com vírgulas em campos não-aspeados**: aumenta variância e bagunça. Considere também testar parsing por modal de teste.
4. **Header detection**: heurística simples (< 50% numérico). Datasets de série temporal podem ter primeira linha numérica e isso confunde — fazer override manual.

### ✅ Como testar

1. CSV simples `a,b\n1,2` → `delimiter: ','`.
2. CSV BR `a;b\n1,5;2,3` → `delimiter: ';'`.
3. CSV TSV `a\tb\n1\t2` → `delimiter: '\t'`.
4. CSV malformado (linhas com colunas diferentes) → confidence baixo.

### 🔄 Variações

- **Múltiplos candidatos**: retornar top 3 e perguntar ao usuário se confidence próximo.
- **BOM detection**: prefixo `﻿` indica UTF-8 BOM (Excel comum em BR).

---

## 🔴 FEATURE 3: Inferidor de 30 tipos de coluna

### 📖 O que faz no Solstice

Para cada coluna de um dataset, decide o **tipo dominante** entre 30 candidatos (currency, cpf, geo_lat, json, ordinal, etc.) por amostragem (até 200 valores) e regex/funções de detecção específicas.

### 🎯 Por que vale portar

Núcleo da agnosticidade. Para o Itaú: ao receber CSV qualquer, saber que "vlr_op_aprov" é currency, "cnpj_cliente" é CNPJ válido, "dt_op" é date_only → o resto do produto (visualização, formatação, validação) fica automático.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeTypes.TYPES` (catálogo 30) | 1810-1900 |
| JS | `SolsticeTypes.inferColumn` | 1910-1950 |

### 🔗 Dependências

**Parcial:** `SolsticeBR` para os tipos `cpf`/`cnpj`/`cep`.

### 📝 Código fonte autônomo (versão reduzida — 10 tipos representativos)

```javascript
const Types = (function(){
  const RX = {
    INTEGER:  /^-?\d{1,3}([\.,]?\d{3})*$|^-?\d+$/,
    DECIMAL:  /^-?\d+([.,]\d+)?$/,
    CURRENCY: /^[R$€£US\$\s\-]*\s*-?\d+([.,]\d+)?(\s*[A-Z]{3})?$/i,
    PERCENT:  /^-?\d+([.,]\d+)?\s*%$/,
    ISO_DATE: /^\d{4}-\d{2}-\d{2}$/,
    EMAIL:    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    URL:      /^https?:\/\/[^\s]+$/i,
    UUID:     /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    UF_BR:    /^(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)$/i
  };

  function _isLat(v){ const n = parseFloat(v); return !isNaN(n) && n >= -90 && n <= 90; }
  function _isLng(v){ const n = parseFloat(v); return !isNaN(n) && n >= -180 && n <= 180; }

  const TYPES = {
    'measure':    { detect: v => RX.DECIMAL.test(String(v).trim()) },
    'currency':   { detect: v => RX.CURRENCY.test(String(v).trim()) },
    'percentage': { detect: v => RX.PERCENT.test(String(v).trim()) },
    'integer':    { detect: v => RX.INTEGER.test(String(v).trim()) },
    'date_only':  { detect: v => RX.ISO_DATE.test(String(v).trim()) },
    'email':      { detect: v => RX.EMAIL.test(String(v).trim()) },
    'url':        { detect: v => RX.URL.test(String(v).trim()) },
    'uuid':       { detect: v => RX.UUID.test(String(v).trim()) },
    'geo_uf':     { detect: v => RX.UF_BR.test(String(v).trim()) },
    'geo_lat':    { detect: v => _isLat(v) && /\./.test(String(v)) }
  };

  function inferColumn(values){
    const sample = values.filter(v => v != null && v !== '').slice(0, 200);
    if (sample.length === 0) return { type: 'sparse', confidence: 1 };
    const unique = new Set(sample.map(String));
    if (unique.size === 1) return { type: 'constant', confidence: 1 };

    const scores = {};
    for (const t in TYPES){
      let hits = 0;
      for (const v of sample) try { if (TYPES[t].detect(v)) hits++; } catch(e){}
      scores[t] = hits / sample.length;
    }
    let best = 'dimension', bestScore = 0;
    for (const t in scores){
      if (scores[t] > bestScore && scores[t] >= 0.7){ best = t; bestScore = scores[t]; }
    }
    return { type: best, confidence: bestScore || 0.5, scores };
  }

  return { TYPES, inferColumn };
})();

// Uso:
Types.inferColumn(['SP', 'RJ', 'MG', 'BA']);          // { type: 'geo_uf', confidence: 1 }
Types.inferColumn(['R$ 100,50', 'R$ 250,00']);        // { type: 'currency', confidence: 1 }
Types.inferColumn(['ana@x.com', 'b@y.com']);          // { type: 'email', confidence: 1 }
```

### 🤖 Prompt para Eva

```
Eva, quero um inferidor de tipos para datasets arbitrários.
30 tipos no projeto Solstice; pro nosso, reduzir/ajustar para os relevantes.

Referência (versão reduzida 10 tipos):

[colar JS]

Adapte:
1. Quais tipos fazem sentido no nosso contexto? Provavelmente:
   - currency, percentage, integer, decimal (numéricos)
   - cpf, cnpj, cep, agencia, conta (identificadores BR)
   - data_op, data_vencimento (temporais)
   - cidade, uf, pais (geo)
2. Adicionar regex específicas pro nosso domínio (ex: número de operação tem padrão XXXXX-Y)
3. Cada tipo deve ter: detect, validate, aggs permitidas, format default
4. Threshold de inferência: 0.7 ok? Conservador? Discutir.
5. Resultado deve persistir como metadata (Bloco futuro pode anexar info a colunas)

Vanilla. Sem libs.
```

### ⚠️ Pegadinhas

1. **Ordem importa**: tipos estritos (cpf, cnpj, email) ANTES de genéricos (integer, dimension). Senão, "11111111111" vira `integer` antes de chegar em `cpf`.
2. **Threshold 0.7** é meio agressivo. Em datasets sujos (CSV de banco com 5% lixo), pode classificar como `dimension`. Considere 0.5 + warn.
3. **`SCORES` exposto** é ótimo para debug — mostre ao usuário quando confidence < 0.7.
4. **Tipos especiais primeiro**: `sparse` (todos null) e `constant` (todos igual) ANTES de qualquer outro teste.
5. **Performance**: 30 tipos × 200 valores × N colunas = O(N×30×200). Para CSVs de 50 colunas, ~300K testes. OK em JS moderno, mas considerar amostragem menor para 100+ colunas.
6. **Memoização**: se chamar `inferColumn` 2x com mesma amostra, cache pelo hash.

### ✅ Como testar

```javascript
console.assert(Types.inferColumn(['SP','RJ','MG']).type === 'geo_uf');
console.assert(Types.inferColumn(['1','2','3','4','5']).type === 'integer');
console.assert(Types.inferColumn(['a@b.com','c@d.com']).type === 'email');
console.assert(Types.inferColumn(['2024-01-01','2024-02-15']).type === 'date_only');
console.assert(Types.inferColumn([]).type === 'sparse');
console.assert(Types.inferColumn(['x','x','x','x']).type === 'constant');
console.assert(Types.inferColumn(['SP','foo','bar','baz']).type !== 'geo_uf'); // < 0.7
```

### 🔄 Variações

- **Tipos hierárquicos**: `currency.BRL`, `currency.USD` — formatação automática por subtipo.
- **Tipos custom plugáveis**: API `Types.register(name, def)` para projeto adicionar tipo próprio sem mexer no core.
- **Amostragem inteligente**: pegar 100 primeiros + 100 do meio + 100 do fim ao invés de só primeiros — melhor cobertura.

---

## 🟡 FEATURE 4: Pipeline de ingestão em 5 etapas

### 📖 O que faz no Solstice

`Ingest.run(file, { onStep })` faz: **detect** (dialeto) → **parse** (CSV → rows) → **infer** (tipo por coluna) → **validate** (conta inválidos/nulos) → **enrich** (detecta dicionário, agrega meta). Cada etapa avisa via callback.

### 🎯 Por que vale portar

Ingestão de qualquer tipo de arquivo (CSV, Excel, JSON, Parquet via worker) ganha estrutura testável. Itaú: pode adicionar etapa "verificar token de origem" ou "rodar regra de PII masking" sem reescrever.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeIngest.run` + helpers | 2060-2225 |

### 🔗 Dependências

**Obrigatórias:** parser CSV (PapaParse ou fallback interno). Inferidor de tipos.

### 📝 Código fonte autônomo

```javascript
const Ingest = (function(){
  async function run(file, opts){
    opts = opts || {};
    const onStep = opts.onStep || (() => {});

    const text = await file.text();
    onStep('detect','running');
    const dialect = detectDialect(text);           // FEATURE 2
    if (!dialect){ onStep('detect','error'); return null; }
    onStep('detect','done',dialect);

    onStep('parse','running');
    const { rows, columns } = parseText(text, dialect);
    if (!rows.length){ onStep('parse','error'); return null; }
    onStep('parse','done',{rows: rows.length, columns: columns.length});

    onStep('infer','running');
    const types = {};
    columns.forEach(c => { types[c] = Types.inferColumn(rows.map(r => r[c])); });   // FEATURE 3
    onStep('infer','done');

    onStep('validate','running');
    const issues = { byColumn: {}, total: 0 };
    for (const col of columns){
      const def = Types.TYPES[types[col].type];
      let invalid = 0, nulls = 0;
      for (const r of rows){
        const v = r[col];
        if (v == null || v === ''){ nulls++; continue; }
        if (def.validate && !def.validate(v)) invalid++;
      }
      issues.byColumn[col] = { invalid, nulls, total: rows.length };
      issues.total += invalid;
    }
    onStep('validate','done',{invalid: issues.total});

    onStep('enrich','running');
    const result = { rows, columns, types, issues, dialect, sourceName: file.name };
    onStep('enrich','done');

    return result;
  }
  return { run };
})();

// Uso:
const result = await Ingest.run(file, {
  onStep: (step, status, info) => console.log(`${step}: ${status}`, info)
});
console.log(result);
// → { rows: [...], columns: ['a','b'], types: { a: {type:'integer',...} }, issues: {...}, dialect: {...} }
```

### 🤖 Prompt para Eva

```
Eva, implementar pipeline de ingestão de arquivos no projeto.

5 etapas: detect → parse → infer → validate → enrich.
Callbacks por etapa para mostrar progresso ao usuário.

Referência:

[colar JS]

Adapte para nosso contexto:
1. Quais tipos de arquivo aceitar? CSV, XLSX, JSON, Parquet (este via WASM/worker)
2. Adicionar etapa entre validate e enrich: "compliance check" (mascarar PII, etc.)
3. Permitir cancelar a meio caminho (AbortSignal)
4. Limite de arquivos grandes: > 100MB roda em worker, com paginação

Resultado deve ser serializável (sem closures/refs) para enviar pro backend se necessário.
```

### ⚠️ Pegadinhas

1. **`file.text()` carrega tudo na memória**. Para 500MB+ vira problema. Considere Stream API.
2. **Encoding**: `file.text()` usa default do browser (UTF-8). CSVs do Excel BR vêm em Windows-1252. Detectar BOM e usar `TextDecoder('windows-1252')` se necessário.
3. **PapaParse pode rodar em worker** (config `worker: true`) — habilitar para > 100K linhas.
4. **Não modifique `result.rows`** depois — Editor usa `Store.set('ingest', { ...ingest, rows: newRows })` para criar novo objeto.
5. **AbortSignal**: pipeline atual não suporta cancelamento. Adicionar `if (signal.aborted) throw ...` entre etapas.

### ✅ Como testar

1. Importar CSV pequeno → 5 callbacks `done` no console.
2. Importar arquivo vazio → callback `error` em `detect` ou `parse`.
3. Importar arquivo só com header (sem linhas de dado) → erro em `parse`.

### 🔄 Variações

- **Etapa preview-first**: parse só 100 linhas, mostra preview, pede confirmação, então parse tudo.
- **Multi-arquivo**: receber array de Files, processar em paralelo, mesclar.

---

## 🔴 FEATURE 5: Score de qualidade adaptativo por perfil

### 📖 O que faz no Solstice

`Quality.compute(ingest)` calcula 5 métricas (completeness, validity, uniqueness, consistency, distribution), pondera por perfil do dataset (`transactional`, `categorical`, `timeseries`...) e produz score 0-100 + flags acionáveis.

### 🎯 Por que vale portar

CSV bom em um contexto pode ser ruim em outro. Itaú: relatório transacional precisa de timestamps completos; survey precisa de balanceamento de respostas. Score adaptativo dá feedback realista.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeQuality.compute` + helpers + WEIGHTS | 2330-2440 |
| JS | `SolsticeDatasetType.classify` (suporta) | 2280-2310 |

### 🔗 Dependências

**Obrigatórias:** tipos inferidos. Issues por coluna.

### 📝 Código fonte autônomo

```javascript
const Quality = (function(){
  const WEIGHTS = {
    transactional: { completeness:.3, validity:.25, uniqueness:.15, consistency:.2, distribution:.1 },
    categorical:   { completeness:.3, validity:.15, uniqueness:.1,  consistency:.25, distribution:.2 },
    timeseries:    { completeness:.4, validity:.15, uniqueness:.05, consistency:.3, distribution:.1 },
    snapshot:      { completeness:.4, validity:.25, uniqueness:.15, consistency:.15, distribution:.05 },
    survey:        { completeness:.35, validity:.15, uniqueness:.05, consistency:.25, distribution:.2 },
    scientific:    { completeness:.2, validity:.3,  uniqueness:.1,  consistency:.15, distribution:.25 }
  };

  function compute(ingest){
    const { rows, columns, types, issues } = ingest;
    const profile = classifyDataset(columns, types, rows);    // outra feature
    const w = WEIGHTS[profile] || WEIGHTS.snapshot;
    const totalCells = rows.length * columns.length;

    const totalNulls = Object.values(issues.byColumn).reduce((s,i) => s + i.nulls, 0);

    const metrics = {
      completeness: totalCells ? 1 - (totalNulls / totalCells) : 0,
      validity:     totalCells ? 1 - (issues.total / totalCells) : 1,
      uniqueness:   _uniqueness(rows, columns, types),
      consistency:  _consistency(rows, columns, types),
      distribution: _distribution(rows, columns, types)
    };

    const score = Math.round(100 * (
      metrics.completeness * w.completeness +
      metrics.validity     * w.validity +
      metrics.uniqueness   * w.uniqueness +
      metrics.consistency  * w.consistency +
      metrics.distribution * w.distribution
    ));

    const flags = [];
    for (const c of columns){
      const issue = issues.byColumn[c];
      const nullRatio = issue.nulls / rows.length;
      if (nullRatio > 0.5) flags.push({ col: c, level: 'warn', msg: `${Math.round(nullRatio*100)}% nulos` });
      if (issue.invalid > 0) flags.push({ col: c, level: 'error', msg: `${issue.invalid} inválidos` });
    }
    return { score, profile, weights: w, metrics, flags };
  }

  function _uniqueness(rows, columns, types){
    const idCols = columns.filter(c => ['identifier','cpf','cnpj'].indexOf(types[c].type) >= 0);
    if (!idCols.length) return 1;
    let s = 0;
    for (const c of idCols) s += new Set(rows.map(r => r[c])).size / rows.length;
    return s / idCols.length;
  }
  function _consistency(rows, columns, types){
    // ... ver implementação completa em dashboard.html linha 2380
    return 1;
  }
  function _distribution(rows, columns, types){
    let issues = 0;
    for (const c of columns){
      const counts = {};
      for (const r of rows){ const v = String(r[c]); counts[v] = (counts[v]||0) + 1; }
      const max = Math.max(...Object.values(counts));
      if (max / rows.length > 0.95 && Object.keys(counts).length > 1) issues++;
    }
    return columns.length ? 1 - (issues / columns.length) : 1;
  }
  return { compute, WEIGHTS };
})();
```

### 🤖 Prompt para Eva

```
Eva, score de qualidade de dados adaptativo no projeto.

Hoje calculamos só "% completude". Quero score 0-100 ponderado por perfil do dataset.

Referência:

[colar JS]

Adapte:
1. Perfis relevantes no nosso contexto: transactional, snapshot, timeseries... ajustar
2. Tunar pesos com nosso time de dados. Hoje os pesos do Solstice são chute educado.
3. Adicionar métrica "freshness" (data mais recente vs. hoje) para datasets de produção
4. Flags devem virar tickets automaticamente? Ou só warnings na UI?
5. Salvar score em log para detectar deriva ao longo do tempo

Vanilla. Não usar libs.
```

### ⚠️ Pegadinhas

1. **`_consistency` é heurística simples** — comparar tipo inferido com cada célula. Para datasets grandes, custa O(N×M). Considere amostragem.
2. **Pesos somando ≠ 1**: bug silencioso. Adicionar assertion.
3. **Score 100 não significa dados perfeitos** — apenas que as 5 métricas estão maxed. Ainda podem ter problemas de negócio (ex: "todos os clientes ativos com saldo zero" — score alto, problema sério).
4. **Perfil "snapshot" é default**: se classificação errar, cai aqui. Pode esconder problemas reais.

### ✅ Como testar

1. Dataset com 100% nulos → completeness 0 → score baixo.
2. Dataset perfeito → score próximo de 100.
3. Mesmo dataset, classificado como "transactional" vs "scientific" → scores diferentes (porque pesos diferentes).

### 🔄 Variações

- **Score por coluna** (não só global): user prioriza colunas críticas.
- **Histórico**: salvar `(timestamp, score)` no localStorage e gráfico de tendência (alerta se score caiu 10+ pontos numa semana).

---

## 🟢 FEATURE 6: Classificador de tipo de dataset (6 perfis)

### 📖 O que faz no Solstice

`DatasetType.classify(columns, types, rows)` decide se é `transactional`, `timeseries`, `categorical`, `survey`, `scientific`, ou `snapshot` por heurísticas sobre **proporção de grupos de tipos**.

### 🎯 Por que vale portar

Ajuda escolher visualização default, formato de relatório, expectativas de QA. Itaú: relatório "estilo transacional" precisa de timeline; "snapshot" precisa de drill-down.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeDatasetType.classify` | 2280-2310 |

### 🔗 Dependências

Tipos inferidos (Feature 3).

### 📝 Código fonte autônomo

```javascript
function classifyDataset(columns, types, rows){
  const groups = { numeric:0, temporal:0, id:0, cat:0, geo:0, contact:0, struct:0, special:0 };
  for (const c of columns){
    const t = types[c]; if (!t) continue;
    const def = Types.TYPES[t.type];
    if (def) groups[def.group] = (groups[def.group] || 0) + 1;
  }
  const n = columns.length;
  const hasTime = groups.temporal >= 1;
  const hasIds  = groups.id >= 1;
  const hasNum  = groups.numeric >= 1;
  const catRatio = groups.cat / n;
  const numRatio = groups.numeric / n;

  if (hasTime && hasIds && hasNum)                            return 'transactional';
  if (hasTime && groups.temporal === 1 && numRatio >= 0.5
              && rows.length > 30)                            return 'timeseries';
  if (catRatio >= 0.6 && groups.cat >= 3)                     return 'survey';
  if (catRatio >= 0.5)                                         return 'categorical';
  if (numRatio >= 0.7 && rows.length < 500)                   return 'scientific';
  return 'snapshot';
}
```

### 🤖 Prompt para Eva

```
Eva, classificador de tipo de dataset.

[colar JS]

Adapte aos nossos perfis: o Solstice tem 6 genéricos; pro Itaú talvez:
- carteira (snapshot atual)
- evolução (timeseries)
- transacoes (transactional)
- portfolio (categorical com hierarquia)
- estudo (scientific)
- pesquisa_cliente (survey)

Ajustar heurísticas com nosso time.
```

### ⚠️ Pegadinhas

1. **Ordem das regras**: a primeira que casa ganha. Cuide para não pegar "transactional" sempre.
2. **`scientific` requer < 500 linhas** — heurística que pode falhar para datasets de calibração com 1000+ medições.
3. **Datasets híbridos** caem em algo errado. Sempre permitir override manual.

### ✅ Como testar

```javascript
classify(['data','cnpj','valor'], { data:{type:'date_only'}, cnpj:{type:'cnpj'}, valor:{type:'currency'} }, rows);
// → 'transactional'

classify(['mes','vendas'], { mes:{type:'date_only'}, vendas:{type:'integer'} }, Array(100));
// → 'timeseries'
```

### 🔄 Variações

- **ML-based**: usar features estatísticas + classificador (kNN com mini-dataset rotulado). Custa mais, ganho marginal vs heurística para domínio conhecido.

---

## 🟢 FEATURE 7: Sparkline SVG inline (sem libs)

### 📖 O que faz no Solstice

SVG inline 240×18 px no card de cada coluna numérica, mostrando padrão visual dos primeiros 60 valores. Zero dependência.

### 🎯 Por que vale portar

Painéis de qualidade ou listagens densas ganham contexto visual sem custo. Itaú: tabela de carteira poderia ter sparkline de saldo por cliente sem precisar Chart.js.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeEditor._sparkline` | 2480-2500 |
| CSS | `.solstice__sparkline` | 700-705 |

### 🔗 Dependências

**Nenhuma.** Pure SVG.

### 📝 Código fonte autônomo

```javascript
function sparkline(values, w=240, h=18, color='currentColor'){
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 '+w+' '+h);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.width = '100%'; svg.style.height = h+'px';
  if (!values.length) return svg;

  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const step = w / Math.max(1, values.length - 1);
  let d = '';
  values.forEach((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
  });
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', '1.5');
  svg.appendChild(path);
  return svg;
}

// Uso:
const el = sparkline([10, 25, 18, 30, 45, 35, 50], 200, 24, '#4D9FFF');
document.body.appendChild(el);
```

### 🤖 Prompt para Eva

```
Eva, sparklines inline em SVG, sem libs (Chart.js, D3, etc.).

Referência:

[colar JS]

Adapte:
- Cor segue var(--color-*) atual do tema
- Permitir variante 'bar' (barras) além de 'line'
- Adicionar tooltip ao hover mostrando valor

Vanilla JS. Não usar libs.
```

### ⚠️ Pegadinhas

1. **`preserveAspectRatio="none"`** estica horizontalmente. Sem isso, scale uniforme distorce.
2. **Valores extremos**: 1 outlier achata o resto. Considere clamp ao p1-p99.
3. **Performance**: 1000+ pontos numa sparkline 240px = path muito denso. Amostre (LTTB no Bloco 12).

### ✅ Como testar

1. `sparkline([1,2,3,4,5])` → linha ascendente diagonal.
2. `sparkline([])` → SVG vazio (não quebra).
3. `sparkline([5,5,5,5])` → linha reta no meio.

### 🔄 Variações

- **Sparkbar** (barras): `<rect>` em vez de `<path>`.
- **Sparkarea**: `<path>` com fill, baseline em y=h.

---

## 🟡 FEATURE 8: Tabela com formatação por tipo

### 📖 O que faz no Solstice

Renderiza tabela HTML cujo `<td>` tem classe e formatação conforme o tipo inferido da coluna: `is-num` (tabular-nums + right), `is-null` (italic + gray), `is-invalid` (red bg). Conteúdo passa por `type.format(v, locale)`.

### 🎯 Por que vale portar

Substitui `table` cru de qualquer relatório por algo legível. Itaú: extrato fica com valores em currency BR, datas em formato BR, IDs em monospace.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeEditor.renderPreview` | 2510-2560 |
| CSS | `.solstice__data-table*` | 710-735 |

### 🔗 Dependências

Locale + Types.

### 📝 Código fonte autônomo

```javascript
function renderTable(rows, columns, types, locale){
  const table = document.createElement('table');
  table.className = 'data-table';

  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  columns.forEach(c => {
    const th = document.createElement('th');
    th.innerHTML = c + '<br><small>'+types[c].type+'</small>';
    trh.appendChild(th);
  });
  thead.appendChild(trh); table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.slice(0, 50).forEach(r => {
    const tr = document.createElement('tr');
    columns.forEach(c => {
      const td = document.createElement('td');
      const v = r[c];
      const def = Types.TYPES[types[c].type];
      const isNum = def && def.group === 'numeric';
      const isNull = v == null || v === '';
      const isInvalid = !isNull && def && def.validate && !def.validate(v);
      td.className = (isNum ? 'is-num ' : '') + (isNull ? 'is-null ' : '') + (isInvalid ? 'is-invalid' : '');
      td.textContent = isNull ? '—' : (def && def.format ? def.format(v, locale) : v);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}
```

```css
.data-table th { background: #f1f5f9; position: sticky; top: 0; }
.data-table th small { color: #94a3b8; font-family: monospace; font-size: 10px; }
.data-table td.is-num { text-align: right; font-variant-numeric: tabular-nums; }
.data-table td.is-null { color: #94a3b8; font-style: italic; }
.data-table td.is-invalid { color: #dc2626; background: #fef2f2; }
```

### 🤖 Prompt para Eva

```
Eva, tabela de dados com formatação semântica.
Hoje renderizamos cru — quero números à direita, nulls gray, inválidos vermelhos.

Referência:

[colar JS + CSS]

Adapte:
- Usar classes do nosso design system
- Substituir def.format pelo nosso formatter
- Para tabelas grandes: virtualização (renderizar só linhas visíveis)
```

### ⚠️ Pegadinhas

1. **Render de 10K+ linhas trava UI**. O Solstice limita a 50 no preview. Para tabelas reais, virtual scrolling (Bloco 12).
2. **`is-invalid` é honesto** — facilita debug, mas em UI pública pode parecer "tela cheia de erros". Filtrar opcionalmente.
3. **`tabular-nums`** é essencial para números alinharem. Sem isso, "123" e "999" têm widths diferentes.

### ✅ Como testar

1. Render tabela com mix de tipos → numéricos à direita, datas formatadas.
2. Inserir null → célula com "—" em itálico cinza.
3. Inserir valor inválido → fundo vermelho.

### 🔄 Variações

- **Sort por clique no header**: adicionar listener + sort + re-render.
- **Filter inline**: input por coluna no header.

---

## 🟡 FEATURE 9: Editor de colunas (rename / drop / type / transform)

### 📖 O que faz no Solstice

Sidebar mostra card por coluna. Hover → 3 botões aparecem: 🏷️ mudar tipo · ⚡ aplicar transformação · 🗑️ remover. Nome editável via `contenteditable` (clique → digita → blur ou Enter).

### 🎯 Por que vale portar

Reduz fricção de "preparar dado". No Itaú, analista pode limpar CSV antes de gerar relatório sem precisar abrir Excel.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeEditor.render` | 2410-2480 |
| CSS | `.solstice__editor-col*` | 670-700 |

### 🔗 Dependências

Store (para imutabilidade) + Types (para mudar tipo) + Locale.

### 📝 Código fonte autônomo (esqueleto)

```javascript
function renderEditor(rows, columns, types, onChange){
  const panel = document.getElementById('editor-panel');
  panel.innerHTML = '';

  columns.forEach(col => {
    const card = document.createElement('div');
    card.className = 'editor-col';

    const name = document.createElement('span');
    name.className = 'editor-col-name';
    name.textContent = col;
    name.onclick = () => { name.contentEditable = 'true'; name.focus(); };
    name.onblur = () => {
      name.contentEditable = 'false';
      const nv = name.textContent.trim();
      if (nv && nv !== col) onChange({ action:'rename', col, newName: nv });
    };
    name.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); name.blur(); } };

    const type = document.createElement('span');
    type.className = 'editor-col-type';
    type.textContent = types[col].type;

    const actions = document.createElement('span');
    actions.className = 'editor-col-actions';

    const typeBtn = document.createElement('button');
    typeBtn.textContent = '🏷️';
    typeBtn.onclick = () => {
      const newType = prompt('Tipo de "'+col+'":', types[col].type);
      if (newType) onChange({ action:'changeType', col, newType });
    };

    const transformBtn = document.createElement('button');
    transformBtn.textContent = '⚡';
    transformBtn.onclick = () => {
      const transforms = ['trim','upper','lower','fillna'];
      const choice = prompt('Transformações:\n'+transforms.map((t,i)=>(i+1)+'. '+t).join('\n'));
      const idx = parseInt(choice) - 1;
      if (idx >= 0 && idx < transforms.length) onChange({ action:'transform', col, transform: transforms[idx] });
    };

    const dropBtn = document.createElement('button');
    dropBtn.textContent = '🗑️';
    dropBtn.onclick = () => {
      if (confirm('Remover coluna "'+col+'"?')) onChange({ action:'drop', col });
    };

    actions.append(typeBtn, transformBtn, dropBtn);
    card.append(name, type, actions);
    panel.appendChild(card);
  });
}
```

### 🤖 Prompt para Eva

```
Eva, editor de colunas inline para preparação de dados pré-relatório.

Ações: renomear (inline), mudar tipo, aplicar transformação, remover.

Referência:

[colar JS]

Adapte:
- Modal customizado em vez de prompt() — feio
- Modal de transformações deve ter preview ("vai virar isso aqui...")
- Undo após cada ação (Bloco 4 do Solstice tem Undo/Redo global)
- Persistir histórico de transformações (poder reaplicar em CSV similar)
```

### ⚠️ Pegadinhas

1. **`contenteditable` injeta HTML** se usuário colar de outro site. Sempre usar `textContent` ao ler, NUNCA `innerHTML`.
2. **`prompt()`/`confirm()` nativos** são feios mas vanilla. Para portar com UX de qualidade, substituir por modal customizado.
3. **Sequência de transformações pode ser destrutiva**: trim + parseNum em coluna de texto vira null silenciosamente. Sempre confirmar.
4. **Rename para nome duplicado**: a função `_renameColumn` no Solstice NÃO valida. Adicionar checagem.
5. **`drop` sem confirmação** é destrutivo. Sempre prompt.

### ✅ Como testar

1. Renomear "col_1" → "Receita" → todas referências atualizam.
2. Drop "col_x" → coluna desaparece da preview + sidebar.
3. Mudar tipo de "col_n" de "dimension" para "integer" → formatação muda.
4. Aplicar transformação "upper" em coluna de texto → tudo em CAIXA ALTA.

### 🔄 Variações

- **Macros**: gravar sequência de transformações e aplicar em novo CSV.
- **Pipeline visível**: cada ação vira chip removível ("trim → upper → fillna"); usuário desfaz clicando no chip.

---

## 🟢 FEATURE 10: Catálogo de erros expansível via `register()`

### 📖 O que faz no Solstice

Bloco 1 entregou o sistema. Bloco 2 demonstra **expansão**: novos erros (`INVALID_CPF`, `COLUMN_HIGH_NULL_RATIO`...) são registrados via `Errors.register(code, def)` no fim do módulo.

### 🎯 Por que vale portar

Padrão "open-closed": fechado para modificação do core, aberto para extensão. Cada feature nova adiciona seus erros sem mexer no catálogo principal.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | Bloco de `SolsticeErrors.register(...)` no fim do Bloco 2 | 2520-2545 |

### 🔗 Dependências

Sistema de erros do Bloco 1 (Feature 5 daquele).

### 📝 Código fonte autônomo

```javascript
// Sistema core do Bloco 1 já tem register().
// Bloco 2 simplesmente USA:

Errors.register('INVALID_CPF', {
  sev: 'error', icon: '🆔',
  message: 'CPF inválido: "{value}".',
  suggestion: 'Verifique se os 11 dígitos estão corretos. Sequências repetidas (ex: 111.111.111-11) não são válidas.'
});

Errors.register('COLUMN_HIGH_NULL_RATIO', {
  sev: 'warn', icon: '🕳️',
  message: 'A coluna "{col}" tem {pct}% de valores nulos.',
  suggestion: 'Considere remover a coluna ou preencher com transformação `fillna`.'
});

// Uso:
Errors.show('INVALID_CPF', { value: '11111111111' });
Errors.show('COLUMN_HIGH_NULL_RATIO', { col: 'email', pct: 67 });
```

### 🤖 Prompt para Eva

```
Eva, sistema de erros aberto para extensão.

Cada módulo novo registra seus próprios códigos via Errors.register(code, def). 
Núcleo do sistema fica intocado.

Modelo de uso:

[colar JS]

No projeto, cada arquivo de feature deve ter um bloco no fim:
"// === ERROS DESTA FEATURE ===
 Errors.register(...);
 Errors.register(...);"

Listar todos os códigos atuais no projeto e converter para esse padrão.
```

### ⚠️ Pegadinhas

1. **Códigos duplicados** sobrescrevem silenciosamente. Validar primeiro com `Errors.list().includes(code)`.
2. **Mensagens com placeholders** (`{value}`): se esquecer de passar `vars`, fica `"{value}"` literal na UI. Adicionar warn no console.

### ✅ Como testar

1. `Errors.list().length` antes do register: 10. Depois: 15.
2. `Errors.show('INVALID_CPF', { value: '111' })` → modal com mensagem interpolada.

### 🔄 Variações

- **Categorias**: agrupar erros por módulo (`csv.*`, `auth.*`).
- **i18n**: registrar variantes em locales diferentes.

---

## 🟥 RESUMO DO BLOCO

### Features mais valiosas para portar primeiro

1. **🥇 Validação CPF/CNPJ/CEP (Feature 1)** — alto valor imediato pro Itaú. 1-2h. **Faça agora.**
2. **🥈 Inferidor de 30 tipos (Feature 3)** — complexo, mas multiplica valor de tudo que vier depois. Investir 1-2 dias.
3. **🥉 Pipeline de ingestão 5 etapas (Feature 4)** — base para receber qualquer arquivo de forma estruturada.
4. **Score de qualidade adaptativo (Feature 5)** — fala diretamente com governança de dados / steward.

### Features que NÃO vale portar isoladamente

- **Sparkline (Feature 7)** — só vale se for usar em vários lugares. Para uma única tela, não economiza.
- **Tabela formatada (Feature 8)** — depende de Locale + Types. Se for adotar Types, vem junto. Senão, esquece.
- **Editor (Feature 9)** — só vale se o usuário-fim precisa preparar dado. Para tela de visualização pura, não.

### Recomendação específica para projeto Itaú

**Stack mínimo para o Itaú adotar:**

1. Validação BR (Feature 1) → aplicar em todo input/import imediatamente.
2. Inferidor de tipos (Feature 3) → com dicionários customizados Itaú (do Bloco 1 portado).
3. Pipeline de ingestão (Feature 4) → estruturar imports atuais.
4. Score adaptativo (Feature 5) → habilitar steward de dados.

**Considerações específicas:**

- **LGPD**: maskCPF/maskCNPJ devem ser default em logs e UI pública. Adicionar regra ESLint que proíbe console.log de fields com nomes `cpf`/`cnpj`/`email` sem mask.
- **Volumes**: Itaú processa CSVs grandes. Pipeline atual (`file.text()`) precisa upgrade para streaming antes de virar produção.
- **Histórico de scores**: anexar a metadata da carga (que feature dataset estamos consumindo) e expor em dashboard de governança. Score caindo = alerta.
- **Tipos custom**: criar 5-10 tipos próprios do Itaú (`agencia`, `conta`, `op_id`, `cliente_id`, etc.). API de `Types.register()` (Bloco 2 não expõe ainda — implementar trivialmente).

---

## ➕ FEATURES ADICIONAIS (Bloco 2 — correções pós-entrega)

> Estas 4 features foram adicionadas após validação inicial do Lucas. Endereçam UX/qualidade.

---

## 🟡 FEATURE 11: SolsticeModal — diálogos bloqueantes Promise-based

### 📖 O que faz no Solstice

API `show / confirm / prompt / select`, todas retornando `Promise`. Substitui completamente `alert/confirm/prompt` nativos do navegador. `select` usa radio buttons visuais (não `<select>` nativo). Variante `danger` para destrutivos (botão vermelho). Esc + click backdrop fecham. Focus trap. `role="dialog"` + `aria-modal`.

### 🎯 Por que vale portar

`alert/confirm/prompt` nativos quebram tema, têm prefixo "Esta página diz:", não são i18n, não são acessíveis, não são testáveis. Em produto Itaú visíveis para cliente, ficam constrangedores. Substituir é UX win imediato.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | módulo `SolsticeModal` | 2530-2700 |
| CSS | `.solstice__cmodal*`, `.solstice__select-option*`, `.solstice__btn--danger` | 770-870 |
| Z-index | `--z-modal-prompt: 350` | tokens |

### 🔗 Dependências

`SolsticeUtils.el` (helper de DOM). Sem isso, substituir por `document.createElement` + setAttribute.

### 📝 Código fonte autônomo (esqueleto reduzido)

```javascript
const Modal = (function(){
  function show(opts){
    return new Promise(resolve => {
      let resolved = false;
      const lastFocus = document.activeElement;
      const bd = document.createElement('div');
      bd.className = 'cmodal-backdrop'; bd.setAttribute('role','dialog'); bd.setAttribute('aria-modal','true');
      bd.onclick = e => { if (e.target === bd) close(opts.defaultClose); };
      const m = document.createElement('div'); m.className = 'cmodal';

      if (opts.title){ const h = document.createElement('div'); h.className='cmodal-header'; h.textContent=opts.title; m.appendChild(h); }
      const body = document.createElement('div'); body.className='cmodal-body';
      const bc = typeof opts.body === 'function' ? opts.body(close) : opts.body;
      if (bc) body.appendChild(bc instanceof Node ? bc : document.createTextNode(String(bc)));
      m.appendChild(body);
      if (opts.footer){
        const f = document.createElement('div'); f.className='cmodal-footer';
        const fc = typeof opts.footer === 'function' ? opts.footer(close) : opts.footer;
        (Array.isArray(fc)?fc:[fc]).forEach(n => n && f.appendChild(n));
        m.appendChild(f);
      }
      bd.appendChild(m); document.body.appendChild(bd);

      function onKey(e){
        if (e.key === 'Escape'){ e.preventDefault(); close(opts.defaultClose); return; }
        if (e.key !== 'Tab') return;
        const focus = m.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!focus.length) return;
        const first = focus[0], last = focus[focus.length-1];
        if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
      document.addEventListener('keydown', onKey);
      setTimeout(() => { const input = m.querySelector('input,textarea,select'); (input || m.querySelector('button'))?.focus(); }, 50);

      function close(v){ if (resolved) return; resolved = true; document.removeEventListener('keydown', onKey); bd.remove(); lastFocus?.focus(); resolve(v); }
    });
  }

  function confirm({ title, message, confirmLabel='Confirmar', cancelLabel='Cancelar', danger }){
    const body = document.createElement('div'); body.textContent = message;
    return show({
      title, body, defaultClose: false,
      footer: close => {
        const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent=cancelLabel; cancel.onclick=()=>close(false);
        const ok = document.createElement('button'); ok.className='btn '+(danger?'btn--danger':'btn--primary'); ok.textContent=confirmLabel; ok.onclick=()=>close(true);
        return [cancel, ok];
      }
    });
  }
  // prompt() e select() análogos. Ver dashboard.html linhas 2630-2700.
  return { show, confirm /*, prompt, select */ };
})();

// Uso:
const ok = await Modal.confirm({ title:'Apagar?', message:'Sem undo.', danger:true });
if (ok) doIt();
```

### 🤖 Prompt para Eva

```
Eva, hoje usamos confirm()/prompt()/alert() no projeto. Quero substituir TUDO por modal customizado.

Requisitos:
1. Retornar Promise (não bloquear thread, async/await funciona)
2. 4 variantes: show (genérico), confirm (boolean), prompt (string), select (lista de opções)
3. select: NÃO usar <select> nativo. Lista vertical de radio buttons visuais.
4. Variante danger: botão de confirmar vermelho
5. Esc fecha, click backdrop fecha, focus trap, role=dialog aria-modal
6. Animação: fade-in backdrop 200ms + scale modal 0.96→1
7. Restaurar foco no elemento anterior ao fechar

Referência completa em:

[colar dashboard.html linhas 2530-2700]

Adapte ao nosso design system (cores, fonts, espaçamento).
Substituir TODAS as chamadas de alert/confirm/prompt do projeto.
Adicionar regra ESLint: no-alert, no-restricted-globals (confirm, prompt).
```

### ⚠️ Pegadinhas

1. **Modal aninhado**: se `confirm` dentro de `confirm` → 2 backdrops empilhados. CSS `position: fixed; inset: 0;` cobre tudo, ainda funciona, mas Esc fecha só o de cima (correto). Cuidado com `lastFocus` — restaura para botão do modal anterior.
2. **`async` viraliza**: chamada de `await Modal.confirm` exige função pai `async`. Caller dela também. Aceitar.
3. **Focus trap quebra com `iframe`** dentro do modal: a query não pega elementos dentro de iframe. Para 99% dos casos, OK.
4. **Click no backdrop quando usuário arrasta texto** e solta no backdrop também fecha. Use `mousedown`/`mouseup` em vez de `click` se incomodar.
5. **Mobile**: backdrop com `position: fixed` precisa de `-webkit-overflow-scrolling: touch` se houver scroll dentro do modal grande.

### ✅ Como testar

1. `await Modal.confirm({ message: 'X?' })` → modal aparece. Botão OK resolve true; Cancel resolve false; Esc resolve false.
2. `await Modal.prompt({ defaultValue: 'abc' })` → input com 'abc' pré-selecionado.
3. `await Modal.select({ options: ['a','b','c'] })` → 3 radios visuais.
4. Modal `danger` → botão vermelho.
5. Tab dentro: navegação cicla entre botões e inputs do modal.
6. Foco anterior é restaurado ao fechar (testar abrindo via clique em botão, fechando, confirmando que botão volta a ter foco).

### 🔄 Variações

- **Toast inline (não bloqueante)**: já existe `SolsticeToast` para isso (Bloco 1).
- **Modal com formulário multi-campo**: passar `body` customizado com form completo, montar handler de submit no `footer`.
- **Modal de loading**: variante que não tem `Esc` (default close `null` mas `Esc` bloqueado) — útil para "aguarde".

---

## 🟢 FEATURE 12: Mapeamento de tipos técnicos para PT-BR (label/icon/group)

### 📖 O que faz no Solstice

`Solstice.Types.label('currency')` → `'Moeda'`. `Solstice.Types.icon('currency')` → `'💰'`. `Solstice.Types.group('currency')` → `'numeric'`. UI sempre usa essas funções; código interno usa o slug técnico (`'currency'`).

### 🎯 Por que vale portar

Tipos técnicos em inglês (currency, percentage, identifier) na UI quebram a experiência. Para Itaú, tudo deve ser pt-BR. Mapeamento direto, custo trivial.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `TYPE_LABELS_PT`, `TYPE_ICONS` + funções | 1960-2020 |

### 🔗 Dependências

Nenhuma.

### 📝 Código fonte autônomo

```javascript
const TYPE_LABELS_PT = {
  measure:'Medida', currency:'Moeda', percentage:'Percentual',
  integer:'Inteiro', decimal:'Decimal', duration:'Duração',
  temporal:'Data/Hora', date_only:'Data', time_only:'Hora', timestamp:'Timestamp',
  identifier:'Identificador', cpf:'CPF', cnpj:'CNPJ', cep:'CEP', hash:'Hash',
  email:'E-mail', phone_br:'Telefone', phone_intl:'Telefone Internacional', url:'URL',
  geo_uf:'UF', geo_country:'País', geo_lat:'Latitude', geo_lng:'Longitude', address:'Endereço',
  json_encoded:'JSON', array_encoded:'Lista', xml_encoded:'XML',
  flag:'Sim/Não', dimension:'Dimensão', ordinal:'Ordinal',
  sparse:'Esparsa', constant:'Constante'
};
const TYPE_ICONS = {
  measure:'📏', currency:'💰', percentage:'％', integer:'🔢', decimal:'🔣', duration:'⏱️',
  temporal:'📅', date_only:'📅', time_only:'🕐', timestamp:'🕓',
  identifier:'🔑', cpf:'🆔', cnpj:'🏢', cep:'📮', hash:'#️⃣',
  email:'✉️', phone_br:'📞', phone_intl:'🌐', url:'🔗',
  geo_uf:'🗺️', geo_country:'🌎', geo_lat:'↕️', geo_lng:'↔️', address:'🏠',
  json_encoded:'🧬', array_encoded:'📋', xml_encoded:'📄',
  flag:'✓', dimension:'🏷️', ordinal:'📊',
  sparse:'○', constant:'＝'
};

function label(t){ return TYPE_LABELS_PT[t] || t; }
function icon(t) { return TYPE_ICONS[t]      || '·'; }
function group(t){
  // 4 buckets para alinhamento visual
  const g = TYPES[t]?.group;
  if (g === 'numeric' || g === 'temporal') return g;
  if (g === 'special') return 'special';
  return 'categorical';
}
```

### 🤖 Prompt para Eva

```
Eva, padronizar exibição de tipos de dado em pt-BR no projeto.

Hoje algumas telas mostram "currency", "percentage" cru. Trocar por mapeamento centralizado.

Mapa pt-BR de referência:

[colar TYPE_LABELS_PT + TYPE_ICONS]

Adicione função `Types.label(type)` e `Types.icon(type)`. Buscar/grep todas ocorrências de tipo cru na UI e substituir. Adicionar lint custom (regex em JSX/templates) para detectar tipo técnico hardcoded.
```

### ⚠️ Pegadinhas

1. **Tipo sem entrada** no mapa → fallback retorna o slug. Adicionar console.warn ajuda a pegar omissões.
2. **Locale dinâmico**: se for adicionar en-US/es-ES, replicar `TYPE_LABELS_EN`, `TYPE_LABELS_ES`. Função `label(t, locale)` aceita opcional, default `current`.

### ✅ Como testar

```javascript
console.assert(Types.label('currency') === 'Moeda');
console.assert(Types.icon('cpf') === '🆔');
console.assert(Types.group('currency') === 'numeric');
console.assert(Types.group('email') === 'categorical');
```

### 🔄 Variações

- **Multi-locale**: extrair para `i18n/types.{lang}.json`.
- **Descrição expandida**: `description(t)` retorna 1 frase explicando ("Valor monetário com símbolo de moeda local").

---

## 🟢 FEATURE 13: Barra de preenchimento SVG gradiente

### 📖 O que faz no Solstice

SVG 240×6 com fundo cinza + barra colorida proporcional ao % preenchido. Cor varia por faixa: ≥95% verde, ≥80% accent, ≥60%/40% warn, <40% error. Tooltip nativo `"X de Y preenchidos (Z%)"`. `role="progressbar"` + aria.

### 🎯 Por que vale portar

Indicador visual instantâneo para qualquer métrica 0-100. Mais legível que número cru em listas densas. Itaú: meta de cobrança, % de aprovação, SLA.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeEditor._fillBar` + `_fillColor` | 2495-2530 |
| CSS | `.solstice__fill-bar rect { transition: width 400ms; }` | 660-665 |

### 🔗 Dependências

Nenhuma.

### 📝 Código fonte autônomo

```javascript
function fillBar(pct, filledCount, totalCount){
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 240 6');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'display:block;width:100%;height:6px;';
  svg.setAttribute('role','progressbar');
  svg.setAttribute('aria-valuenow', pct);
  svg.setAttribute('aria-valuemin','0');
  svg.setAttribute('aria-valuemax','100');

  const title = document.createElementNS(NS, 'title');
  title.textContent = filledCount + ' de ' + totalCount + ' preenchidos (' + pct + '%)';
  svg.appendChild(title);

  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x','0'); bg.setAttribute('y','0');
  bg.setAttribute('width','240'); bg.setAttribute('height','6');
  bg.setAttribute('rx','3'); bg.setAttribute('fill','#E5E7EB');
  svg.appendChild(bg);

  const fill = document.createElementNS(NS, 'rect');
  fill.setAttribute('x','0'); fill.setAttribute('y','0');
  fill.setAttribute('width', (240 * pct / 100).toFixed(1));
  fill.setAttribute('height','6'); fill.setAttribute('rx','3');
  fill.setAttribute('fill', fillColor(pct));
  fill.style.transition = 'width 400ms ease-out';
  svg.appendChild(fill);
  return svg;
}

function fillColor(pct){
  if (pct >= 95) return '#16A34A';
  if (pct >= 80) return '#2563EB';
  if (pct >= 60) return '#D97706';
  if (pct >= 40) return '#D97706';
  return '#DC2626';
}
```

### 🤖 Prompt para Eva

```
Eva, indicador visual de % via barra colorida gradiente, SVG inline, sem libs.

Referência:

[colar JS]

Adapte:
- Cores via CSS vars do nosso design system (não hex hardcoded)
- Faixas: discutir thresholds com time de produto. Hoje: 95/80/60/40.
- Animação de width ao mudar valor (transition CSS)
- Aria-* para acessibilidade

Aplicar onde aparece % hoje: dashboards de cobrança, SLA, cobertura.
```

### ⚠️ Pegadinhas

1. **`preserveAspectRatio="none"`** estica horizontalmente — se quiser proporção uniforme, remova (mas perde flexibilidade de width auto).
2. **Cor por threshold**: usuários podem querer paleta diferente (acessibilidade daltonismo). Aceitar `colorFn` como parâmetro.
3. **Transição CSS em SVG attribute `width`**: funciona em todos browsers modernos. Para IE11 (não suportado), usar JS para animar.

### ✅ Como testar

1. `fillBar(95, 95, 100)` → barra quase cheia, verde.
2. `fillBar(35, 35, 100)` → barra curta, vermelha.
3. `fillBar(0, 0, 100)` → barra invisível, tooltip "0 de 100 (0%)".
4. Hover no SVG mostra tooltip nativo.

### 🔄 Variações

- **Barra segmentada**: para mostrar múltiplas categorias (válido/inválido/null como 3 cores stacked).
- **Texto interno**: % desenhado dentro da barra se houver espaço.

---

## 🟡 FEATURE 14: Padrão de header de coluna rica (3 linhas)

### 📖 O que faz no Solstice

Card de cada coluna no editor segue layout fixo:
1. `[ícone] [nome editável] [actions on hover]`
2. `tipo · unidade · N únicos`
3. `[barra de preenchimento] [%]`

### 🎯 Por que vale portar

Padrão visual reutilizável para qualquer listagem densa de items "com metadata + sinal de progresso". Itaú: listagem de clientes PJ, contratos, posições.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeEditor.render` (loop por coluna) | 2405-2475 |
| CSS | `.solstice__editor-col*` | 670-700 |

### 🔗 Dependências

`SolsticeTypes.label/icon` + (opcional) dicionário para unidade.

### 📝 Código fonte autônomo (esqueleto)

```javascript
function renderRichCard(item){
  const card = document.createElement('div'); card.className = 'rich-card';

  // Linha 1: ícone + título + actions
  const head = document.createElement('div'); head.className = 'rich-card-head';
  head.innerHTML = `
    <span class="rich-card-icon" aria-hidden="true">${item.icon}</span>
    <span class="rich-card-title" contenteditable="false">${item.title}</span>
    <span class="rich-card-actions">
      <button title="Editar">✏️</button>
      <button title="Remover">🗑️</button>
    </span>`;

  // Linha 2: meta inline
  const info = document.createElement('div'); info.className = 'rich-card-info';
  info.innerHTML = item.metaParts.join(' <span class="sep">·</span> ');

  // Linha 3: barra de progresso + %
  const fill = document.createElement('div'); fill.className = 'rich-card-fill';
  fill.appendChild(fillBar(item.pct, item.filled, item.total));   // FEATURE 13
  const pct = document.createElement('span'); pct.className = 'rich-card-pct'; pct.textContent = item.pct + '%';
  fill.appendChild(pct);

  card.append(head, info, fill);
  return card;
}
```

```css
.rich-card { padding: 8px; background: var(--bg2); border-radius: 6px; margin-bottom: 4px; }
.rich-card-head { display: flex; align-items: center; gap: 8px; }
.rich-card-title { flex: 1; font-weight: 500; cursor: text; }
.rich-card-actions { opacity: 0; transition: opacity 150ms; }
.rich-card:hover .rich-card-actions { opacity: 1; }
.rich-card-info { font-size: 10px; color: var(--muted); margin-top: 4px; font-family: monospace; }
.rich-card-info .sep { opacity: 0.4; margin: 0 4px; }
.rich-card-fill { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.rich-card-pct { font-size: 10px; font-family: monospace; color: var(--muted); min-width: 32px; text-align: right; }
```

### 🤖 Prompt para Eva

```
Eva, padrão visual reutilizável de "card rico" para listagens densas.

3 linhas: ícone+título+actions / metadata inline / progresso visual.

Referência:

[colar HTML + CSS]

Aplicar em:
- Listagem de clientes (ícone segmento + nome + ações / score · LTV · ticket / cobertura% )
- Listagem de contratos (ícone tipo + número + ações / produto · vencimento · valor / risco%)
- Listagem de posições (ícone moeda + ativo + ações / quantidade · preço · variação / exposição%)

Adaptar ao design system. Manter actions invisíveis até hover (reduz ruído visual).
```

### ⚠️ Pegadinhas

1. **`contenteditable` é fonte de XSS** se for ler como HTML. SEMPRE `textContent`.
2. **Actions on hover** = invisível em mobile/touch. Considerar tap-to-reveal ou sempre visível em touch devices.
3. **3 linhas vs 1 linha**: para densidade extrema (1000+ items), considerar variante colapsada (1 linha + expand on click).

### ✅ Como testar

1. Hover mostra actions.
2. Click no título habilita edição inline (contenteditable=true).
3. Blur salva. Enter salva.
4. Mobile: actions sempre visíveis OU long-press revela.

### 🔄 Variações

- **Card colapsável**: clicar card expande para mostrar gráfico/detalhes.
- **Drag-and-drop**: reordenar cards arrastando ícone.

---

> Atualização r2 (refinamentos visuais e UX): +2 features abaixo.

---

## 🟡 FEATURE 15: Modal `select` com busca textual integrada

### 📖 O que faz no Solstice

`SolsticeModal.select({ searchable: 'auto', options })` — quando há mais de 8 opções, mostra automaticamente input de busca acima da lista. Match em label + value técnico + desc + sinônimos opcionais por opção. Destaque do trecho buscado com `<mark>`. Navegação por ↑↓. Enter confirma. Esc fecha. Empty state.

### 🎯 Por que vale portar

Combobox custom sem libs (`react-select`, `downshift`, etc.). Para o Itaú: listas de produtos, segmentos, agências, contas — sempre 50+ items. Busca embutida muda a experiência.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeModal.select` (versão r2) | 2630-2790 |
| CSS | `.solstice__select-search*`, `.solstice__select-empty`, `mark` | 940-985 |

### 🔗 Dependências

`SolsticeModal.show` (mesmo arquivo).

### 📝 Código fonte autônomo (esqueleto)

```javascript
function select({ options, defaultValue, searchable='auto' }){
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  const useSearch = searchable === true || (searchable !== false && options.length > 8);
  let chosen = defaultValue;

  // ... cria items com haystack: norm(label + value + desc + synonyms.join(' '))

  function filter(term){
    const t = norm(term);
    items.forEach(it => it.el.classList.toggle('hidden', t && !it.haystack.includes(t)));
    // re-render highlight com <mark> nos visíveis
    // mostra empty state se vis.length === 0
    // foca primeiro visível
  }

  // input com debounce 100ms + botão ✕ + ícone lupa
  // keydown handler no modal: ArrowUp/ArrowDown navega; Enter confirma
}
```

### 🤖 Prompt para Eva

```
Eva, combobox custom no projeto — sem libs (NÃO usar react-select, ant-design Select).

Requisitos:
1. Lista de opções com radio button visual
2. Busca textual quando >8 opções (auto) ou forçado
3. Busca em: label visível + chave técnica + sinônimos
4. Sinônimos definidos por opção (campo opcional `synonyms: string[]`)
5. Match parcial, case-insensitive, sem acentos
6. Destaque do trecho buscado com <mark>
7. ↑↓ navega, Enter confirma, Esc fecha
8. Empty state com mensagem amigável

Referência:

[colar JS + CSS]

Adicionar sinônimos pt-BR para cada tipo de opção do nosso domínio (produto, segmento, etc.).
```

### ⚠️ Pegadinhas

1. **Sinônimos hardcoded** em pt-BR. Para multi-locale, migrar para arquivo de tradução.
2. **Debounce 100ms** funciona para listas até ~500 opções. Acima disso, virtual scroll.
3. **`<mark>` herda cor** do tema. Em tema escuro, garanta que o `background` tem contraste suficiente.
4. **`normalize('NFD')` exige ES2015+** — browsers modernos OK.
5. **Auto-focus pode roubar foco** do usuário em apps com transição animada. Solstice usa `setTimeout(60ms)` para esperar a animação.

### ✅ Como testar

1. Modal com 32 tipos → busca aparece automaticamente.
2. Modal com 5 opções → busca não aparece.
3. Digitar "moeda" → só "Moeda" aparece, com "moeda" destacado.
4. Digitar "cur" → "Moeda" aparece (via desc técnico "currency").
5. Digitar "xpto" → empty state.
6. ↑↓ move outline pelas opções visíveis. Enter confirma.

### 🔄 Variações

- **Multi-select**: aceitar `multiple: true` em `select`, retornar array.
- **Async loading**: `loadOptions: async (term) => [...]` para datasets grandes.

---

## 🟢 FEATURE 16: Densidade global controlando UIs específicas (tokens `--ed-*`)

### 📖 O que faz no Solstice

Toggle global de densidade (`compact / comfortable / spacious`) no header expõe variáveis CSS dedicadas que cada feature consome para seu próprio padrão de espaçamento. O editor de coluna usa `--ed-pad-y/x`, `--ed-gap`, `--ed-row2-mt`, etc., diferentes dos tokens globais `--pad-y/x`.

### 🎯 Por que vale portar

Permite que cada feature controle sua densidade visual sem botões locais. Comfortable cabe 8 cards em 1080p; compact 12+; spacious 5-6.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| CSS | `:root[data-density="..."]` com tokens `--ed-*` | 88-110 |
| CSS | uso nos `.solstice__editor-col*` | 680-735 |

### 🔗 Dependências

Sistema de tematização (`data-density` no `<html>`).

### 📝 Código fonte autônomo

```css
:root[data-density="compact"] {
  --ed-pad-y: 6px; --ed-pad-x: 8px; --ed-gap: 2px;
  --ed-row2-mt: 1px; --ed-fill-mt: 2px;
  --ed-info-size: 10px; --ed-action-size: 14px;
}
:root[data-density="comfortable"] {
  --ed-pad-y: 8px; --ed-pad-x: 10px; --ed-gap: 4px;
  --ed-row2-mt: 2px; --ed-fill-mt: 4px;
  --ed-info-size: 11px; --ed-action-size: 16px;
}
:root[data-density="spacious"] {
  --ed-pad-y: 12px; --ed-pad-x: 15px; --ed-gap: 6px;
  --ed-row2-mt: 3px; --ed-fill-mt: 6px;
  --ed-info-size: 12px; --ed-action-size: 20px;
}

.editor-col {
  padding: var(--ed-pad-y) var(--ed-pad-x);
  margin-bottom: var(--ed-gap);
}
.editor-col-info { margin-top: var(--ed-row2-mt); font-size: var(--ed-info-size); }
.editor-col-fillrow { margin-top: var(--ed-fill-mt); }
.editor-col-btn { width: var(--ed-action-size); height: var(--ed-action-size); }
```

### 🤖 Prompt para Eva

```
Eva, controlar densidade de UIs densas (listas, tabelas, cards) pelo toggle global do projeto.

Padrão: cada feature define seu próprio conjunto de tokens (--X-pad, --X-gap, --X-size), distintos dos globais. Tokens definidos por densidade no :root[data-density="X"].

Referência:

[colar CSS]

Aplicar em:
- Listagens densas de clientes/contas/contratos
- Tabelas de detalhe
- Painéis laterais

Não duplicar valores: se uma feature precisa do mesmo tamanho do global, usar o token global direto.
```

### ⚠️ Pegadinhas

1. **Acoplamento tema/densidade**: se densidade mudar, todas features consumidoras re-flow. Sem JS, mas custo de layout.
2. **Variantes locais**: features sem densidade-sensibilidade não precisam de tokens próprios — só consumir global.
3. **Acessibilidade**: tamanhos compact (botão 14px) podem violar WCAG 44×44px target. Aceitar como trade-off conhecido, com fallback de hover area maior.

### ✅ Como testar

1. Mudar densidade no header → editor encolhe/cresce em todas dimensões coerentemente.
2. Spacious + 11 colunas: 5-6 cards visíveis.
3. Compact + 11 colunas: 12+ cards visíveis.

### 🔄 Variações

- **Densidade granular por feature**: toggle dedicado "Densidade do editor" override do global.
- **Auto-densidade**: detectar resolução de tela e ajustar (1920×1080 → comfortable; 1366×768 → compact).

---

> Documento gerado no Bloco 2 (refinamentos r2). Linhas aproximadas. Comando: `PORTABILIDADE BLOCO 2` regenera com linhas atuais.
