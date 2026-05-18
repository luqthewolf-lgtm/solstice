# PORTABILIDADE — Bloco 1: Fundação + Design System + Locale + Erros + Dicionário

> Documento gerado automaticamente. Lista cada feature do bloco e
> como portá-la para outros projetos, especialmente o projeto Itaú via Eva.
>
> Linhas aproximadas referem-se ao `dashboard.html` v5.3.0-bloco1 (~1.800 linhas).

---

## 📋 ÍNDICE DE FEATURES PORTÁVEIS

| # | Feature | Complexidade | Tempo estimado | Dependências |
|---|---------|--------------|----------------|--------------|
| 1 | Toggle Dark/Light Mode | 🟢 Simples   | 30min–1h       | localStorage |
| 2 | Sistema multi-paleta (6) × dark/light × densidade | 🟡 Média | 3-4h | CSS `@layer` |
| 3 | Store reativo path-subscription | 🟡 Média | 2-3h | nenhuma |
| 4 | Locale dinâmico (Intl + dict de strings) | 🟡 Média | 2-4h | navegador moderno (Intl.*) |
| 5 | Sistema de erros humanizados (modal) | 🟢 Simples | 1-2h | Store (opcional) |
| 6 | Toast notifications | 🟢 Simples | 30min–1h | nenhuma |
| 7 | Perfis sem senha em localStorage | 🟢 Simples | 1-2h | UUID generator |
| 8 | CSV dummy procedural (seed determinística) | 🟢 Simples | 1h | nenhuma |
| 9 | Dicionário Semântico (detecção 3 camadas) | 🔴 Complexa | 8-12h | Estrutura de dados |
| 10 | Onboarding modal multi-slides | 🟢 Simples | 1-2h | localStorage |
| 11 | Debug overlay com Ctrl+Shift+D | 🟢 Simples | 1h | Store (opcional) |
| 12 | FOUC prevention via script inline | 🟢 Simples | 15min | nenhuma |

---

## 🟢 FEATURE 1: Toggle Dark/Light Mode

### 📖 O que faz no Solstice

Botão na toolbar alterna entre modo escuro e claro. Persiste preferência no `localStorage`. Aplicação imediata via atributo `data-mode` no `<html>`. Transição visual implícita pelos browsers ao trocar as CSS vars.

### 🎯 Por que vale portar

Modo escuro é esperado em qualquer ferramenta moderna. No Itaú, ajuda na fadiga visual em jornadas longas de análise. Implementação aqui é elegante: zero re-render JS, tudo via CSS vars no `:root`.

### 📍 Localização no código

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| HTML | `<button id="theme-toggle">` | 595-597 |
| CSS  | `:root[data-palette="ocean"][data-mode="dark"]` e `light` | 99-115 |
| JS (FOUC) | Script inline no `<head>` | 13-22 |
| JS (toggle) | `SolsticeTheme` módulo | 1098-1140 |

### 🔗 Dependências

**Obrigatórias:** `localStorage`, variáveis CSS no `:root`.
**Opcionais (degrada sem):** `SolsticeStore` para reatividade — pode substituir por evento custom; `SolsticeToast` para feedback visual.

### 📝 Código fonte autônomo

```html
<button id="theme-toggle" aria-label="Alternar tema">
  <span id="theme-icon">🌙</span>
</button>
```

```css
:root[data-mode="dark"]  { --c-bg: #0A1020; --c-text: #F0F4FF; --c-surface: #131B30; /* ... */ }
:root[data-mode="light"] { --c-bg: #F5F8FF; --c-text: #0A1020; --c-surface: #FFFFFF; /* ... */ }
body { background: var(--c-bg); color: var(--c-text); transition: background-color 250ms, color 250ms; }
```

```javascript
// Aplicação imediata no <head> (evita FOUC)
(function(){
  try {
    var saved = localStorage.getItem('app.mode');
    var prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-mode', saved || (prefers ? 'dark' : 'light'));
  } catch(e){}
})();

// Toggle (no script principal)
function toggleTheme(){
  var root = document.documentElement;
  var cur = root.getAttribute('data-mode') || 'dark';
  var next = cur === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-mode', next);
  try { localStorage.setItem('app.mode', next); } catch(e){}
  document.getElementById('theme-icon').textContent = next === 'dark' ? '🌙' : '☀️';
}
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
```

### 🤖 Prompt sugerido para Eva

```
Olá Eva, preciso implementar toggle dark/light no nosso projeto interno.
Já tenho código de referência abaixo, funciona vanilla.

[colar HTML/CSS/JS acima]

Adapte para nosso contexto:
- Já usamos prefixo de classes "itau-"
- Sistema de estado: <descrever>
- Cores atuais do tema dark e light: <listar>
- Persistência: queremos via cookie ou localStorage? <decidir>

Mantenha vanilla JS, sem libs. Implemente em 3 passos:
1. Adicionar CSS vars em :root[data-mode="dark"|"light"]
2. Script inline no <head> para aplicar tema antes da pintura (FOUC)
3. Função toggleTheme() bindada ao botão
```

### ⚠️ Pegadinhas

1. **FOUC** se o script de aplicação não estiver inline no `<head>`. Não pode estar num `<script src>` defer — precisa rodar ANTES da primeira pintura.
2. **localStorage indisponível** (modo anônimo, CSP estrita): sempre `try/catch`. Default para `prefers-color-scheme`.
3. **Transições suaves vs reduce-motion**: respeitar `@media (prefers-reduced-motion: reduce)`.

### ✅ Como testar

1. Carrega → tema correto sem flash.
2. Clica botão → muda. F5 → mantém. Limpa localStorage → volta ao default.
3. Em DevTools, simular `prefers-color-scheme: light` → primeira visita respeita.

### 🔄 Variações

- **Sistema de N temas**: trocar binário por `data-mode="light|dark|midnight|sepia"`.
- **Auto switch por horário**: `setInterval` que troca após 19h.

---

## 🟡 FEATURE 2: Sistema multi-paleta × dark/light × densidade

### 📖 O que faz no Solstice

Combina 3 dimensões de aparência:
- 6 paletas (Ocean / Sunset / Forest / Vineyard / Coffee / Slate)
- 2 modos (dark / light)
- 3 densidades (compact / comfortable / spacious)

Cada combinação é um conjunto coerente de tokens semânticos no `:root`. Trocar uma dimensão re-renderiza zero vezes — apenas re-bind das CSS vars.

### 🎯 Por que vale portar

Permite personalização forte sem custo de runtime. Itaú pode ter "paleta-corporativa", "paleta-laranja", "paleta-print" etc. e usuário escolhe.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| CSS  | `@layer theme { ... 6 paletas × 2 modos ... }` | 99-180 |
| CSS  | `:root[data-density="..."] { --row-h, --pad-y, --pad-x, --gap }` | 86-89 |
| JS   | `SolsticeTheme` | 1098-1140 |
| HTML | 3 selects nos `.solstice__pill` do header | 561-585 |

### 🔗 Dependências

**Obrigatórias:** CSS `@layer` (Chrome 99+, Firefox 97+, Safari 15.4+). Sem suporte, degrada — só perde controle de especificidade.

### 📝 Código fonte autônomo

```css
@layer reset, tokens, theme, components, utilities;

@layer tokens {
  :root {
    --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 20px;
    --rad-md: 10px; --t-base: 250ms;
  }
  :root[data-density="compact"]    { --row-h: 32px; --pad-y: 8px;  --pad-x: 12px; }
  :root[data-density="comfortable"]{ --row-h: 40px; --pad-y: 12px; --pad-x: 16px; }
  :root[data-density="spacious"]   { --row-h: 52px; --pad-y: 16px; --pad-x: 20px; }
}

@layer theme {
  :root[data-palette="ocean"][data-mode="dark"]  { --c-bg:#0A1020; --c-text:#F0F4FF; --c-accent:#4D9FFF; }
  :root[data-palette="ocean"][data-mode="light"] { --c-bg:#F5F8FF; --c-text:#0A1020; --c-accent:#1A6FE0; }
  :root[data-palette="sunset"][data-mode="dark"] { --c-bg:#1A0F1F; --c-text:#FFF0F5; --c-accent:#FF6B9D; }
  /* ... repete para forest/vineyard/coffee/slate × dark/light ... */
}

@layer components {
  .app-btn { height: var(--row-h); padding: 0 var(--pad-x); background: var(--c-accent); color: #fff; border-radius: var(--rad-md); transition: background var(--t-base); }
}
```

```javascript
const Theme = {
  set(name, value){
    document.documentElement.setAttribute('data-'+name, value);
    try { var t = JSON.parse(localStorage.getItem('theme')||'{}'); t[name]=value; localStorage.setItem('theme', JSON.stringify(t)); } catch(e){}
  },
  get(name){ return document.documentElement.getAttribute('data-'+name); },
  cycle(name, list){
    var cur = this.get(name); var next = list[(list.indexOf(cur)+1) % list.length];
    this.set(name, next); return next;
  }
};
```

### 🤖 Prompt para Eva

```
Eva, preciso implementar um sistema de tematização com 3 dimensões: paleta × modo (dark/light) × densidade.

Tenho código de referência abaixo. Adapte para nosso projeto:

[colar CSS/JS]

Restrições:
- Stack atual: <descrever>
- Cores que devemos ter: <listar paletas desejadas>
- Já temos algum sistema de design tokens? <descrever>

Implemente em 4 passos:
1. Configurar @layer (verificar suporte do browser alvo)
2. Tokens primitivos no :root
3. Tokens semânticos por combinação data-palette × data-mode
4. Substituir cores hardcoded dos componentes por var(--c-*)
```

### ⚠️ Pegadinhas

1. **Ordem dos `@layer`** importa: a primeira declaração na regra `@layer x, y, z;` define ordem. `utilities` deve vir por último para sobrescrever.
2. **Browsers antigos sem `@layer`**: degradação silenciosa — todo CSS vira "unlayered" (mais alta especificidade) e quebra herança.
3. **Selectors com data-attribute combinados** (`[data-palette="x"][data-mode="y"]`) têm especificidade `0,2,0` — qualquer `.classe` cru vence. Cuidado.
4. **Density não pode mudar `font-size`** (causa reflow), só altura/padding.

### ✅ Como testar

1. Trocar paleta no select → cores mudam instantaneamente.
2. Trocar modo → fundos/textos invertem.
3. Trocar densidade → botões/inputs encolhem/aumentam.
4. Combinações: 6 × 2 × 3 = 36 estados todos coerentes.
5. F5 → preferências mantidas.

### 🔄 Variações

- **Editor de paleta visual** (Bloco 12): color picker que gera nova paleta on-the-fly.
- **Paleta corporativa única**: usar 1 só (a do Itaú) e remover seletor.

---

## 🟡 FEATURE 3: Store reativo com path-subscription

### 📖 O que faz no Solstice

Estado global único acessível via paths (`'dataset.rows'`, `'theme.palette'`). Subscribers ouvem caminhos específicos. Mudança em descendente notifica também ancestrais. Sem framework.

### 🎯 Por que vale portar

Resolve reatividade granular em vanilla. No Itaú, qualquer painel pode ouvir "filtro X mudou" e recalcular só ele, sem re-render geral.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| JS   | módulo `SolsticeStore` (IIFE) | 675-740 |
| Uso  | `SolsticeStore.set('dataset.rows', rows)` espalhado em todos módulos | — |

### 🔗 Dependências

**Nenhuma.** 100% vanilla.

### 📝 Código fonte autônomo

```javascript
const Store = (function(){
  const state = {};
  const subs = new Map();          // path → Set<callback>
  let muted = false;

  function _split(p){ return String(p).split('.'); }

  function get(path){
    if (!path) return state;
    return _split(path).reduce((acc, k) => acc == null ? acc : acc[k], state);
  }

  function set(path, value){
    const parts = _split(path);
    let cur = state;
    for (let i=0; i<parts.length-1; i++){
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    const last = parts[parts.length-1];
    const prev = cur[last];
    cur[last] = value;
    if (!muted) _notify(path, value, prev);
  }

  function _notify(path, val, prev){
    const parts = _split(path);
    for (let i = parts.length; i >= 1; i--){
      const ancestor = parts.slice(0, i).join('.');
      const s = subs.get(ancestor);
      if (s) s.forEach(cb => { try { cb(val, prev, path); } catch(e){ console.error(e); } });
    }
  }

  function subscribe(path, cb){
    if (!subs.has(path)) subs.set(path, new Set());
    subs.get(path).add(cb);
    return () => subs.get(path).delete(cb);
  }

  function batch(fn){ muted = true; try { fn(); } finally { muted = false; } }

  return { get, set, subscribe, batch, dump: () => JSON.parse(JSON.stringify(state)) };
})();

// === Uso ===
Store.subscribe('user.name', (next, prev) => console.log('User mudou de', prev, 'para', next));
Store.set('user.name', 'Lucas');                    // dispara subscriber acima
Store.set('user.age', 32);                          // não dispara o de cima
Store.subscribe('user', () => console.log('algo em user mudou'));  // ancestral
Store.set('user.email', 'a@b.com');                 // dispara o de 'user'
```

### 🤖 Prompt para Eva

```
Eva, quero um store reativo com path-subscription pro nosso projeto.
Tenho referência abaixo, funciona em vanilla:

[colar JS]

Adapte para nosso contexto:
- Stack: <descrever>
- Convenções de naming: <descrever>
- Já temos algum gerenciamento de estado (Redux/Zustand/etc.)? Se sim, NÃO substituir — adicionar como camada complementar para casos específicos onde reatividade granular ajuda.

Implemente. Adicione TS types se usarmos TypeScript.
Teste pelo menos 3 cenários: set simples, set aninhado, ancestral notification.
```

### ⚠️ Pegadinhas

1. **Loops infinitos**: subscriber de `'a'` que faz `set('a.b', ...)` que notifica `'a'` de novo → loop. Use `batch()` ou guardas.
2. **Renomear path é breaking change**: sem refatoração automática, todo `subscribe('foo.bar')` precisa ser atualizado manualmente.
3. **Mutação direta de objetos** retornados por `get()` NÃO dispara notificação. Para mutar, sempre `set('a.b', newValue)`.
4. **`get()` retorna referência viva**: cuidado em concorrência (não há, mas teoricamente).

### ✅ Como testar

1. `Store.subscribe('x', cb); Store.set('x', 1)` → cb chamado com `(1, undefined, 'x')`.
2. `Store.set('x.y', 2); Store.set('x.y', 2)` → cb chamado 2x (mesmo valor).
3. Ancestral: subscribe `'a'`, set `'a.b.c'` → cb chamado.
4. `batch(() => { set('x', 1); set('y', 2); })` → subscribers de x e y chamados; subscribers globais (se `subscribe('')`) só veem o estado final.

### 🔄 Variações

- **Equality check**: pular notificação se `prev === val` (perda de poder, ganho de perf).
- **Selectors memoizados** (estilo Reselect): `Store.select(['a','b'], (a,b) => derived)`.
- **Histórico**: gravar últimas N mudanças em ring buffer — abre caminho para Undo/Redo (Solstice fará no Bloco 4).

---

## 🟡 FEATURE 4: Locale dinâmico (Intl + dict de strings)

### 📖 O que faz no Solstice

`SolsticeLocale.set('en-US')` muda idioma da UI. Strings traduzidas via dict; formatação numérica/data/moeda via `Intl.*` nativo. Re-tradução de elementos `[data-i18n]` automática.

### 🎯 Por que vale portar

Tradução é resolvida em < 200 LOC, zero biblioteca. Para o Itaú, especialmente útil em produtos que precisam atender BR + LATAM + corporate-EN.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| JS   | `SolsticeLocale` (dict + fmt funcs) | 755-895 |
| HTML | `data-i18n="canvas.title"` em elementos traduzíveis | 619-628 |
| HTML | Select de idioma no header | 561-568 |

### 🔗 Dependências

**Obrigatórias:** `Intl.NumberFormat`, `Intl.DateTimeFormat` (todo browser desde 2017).

### 📝 Código fonte autônomo

```javascript
const Locale = (function(){
  const SUPPORTED = ['pt-BR','en-US','es-ES','en-GB'];
  const CURRENCY = { 'pt-BR':'BRL','en-US':'USD','es-ES':'EUR','en-GB':'GBP' };
  const STRINGS = {
    'pt-BR': { 'hello':'Olá, {nome}!', 'save':'Salvar' },
    'en-US': { 'hello':'Hi, {nome}!',  'save':'Save'   },
    'es-ES': { 'hello':'¡Hola, {nome}!','save':'Guardar' }
  };

  let current = (function(){
    try { return localStorage.getItem('locale') || _detect(); }
    catch(e){ return _detect(); }
  })();

  function _detect(){
    const b = navigator.language || 'en-US';
    return SUPPORTED.indexOf(b) >= 0 ? b : (SUPPORTED.find(l => l.startsWith(b.slice(0,2))) || 'en-US');
  }

  function set(code){
    if (SUPPORTED.indexOf(code) < 0) return;
    current = code;
    try { localStorage.setItem('locale', code); } catch(e){}
    document.documentElement.lang = code;
    document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  }
  function get(){ return current; }
  function t(key, vars){
    let s = (STRINGS[current] && STRINGS[current][key]) || STRINGS['en-US'][key] || key;
    if (vars) for (const k in vars) s = s.replace(new RegExp('\\{'+k+'\\}','g'), vars[k]);
    return s;
  }
  function n(num, opts){ return new Intl.NumberFormat(current, opts).format(num); }
  function currency(num){ return n(num, { style:'currency', currency: CURRENCY[current] }); }
  function percent(num, digits){ return n(num, { style:'percent', maximumFractionDigits: digits||1 }); }
  function date(d, opts){ return new Intl.DateTimeFormat(current, opts || { dateStyle:'medium' }).format(d instanceof Date ? d : new Date(d)); }

  return { set, get, t, n, currency, percent, date, supported: () => SUPPORTED.slice() };
})();
```

```html
<select onchange="Locale.set(this.value)">
  <option value="pt-BR">PT-BR</option>
  <option value="en-US">EN-US</option>
</select>
<h1 data-i18n="hello">Olá!</h1>
<p>Valor: <span id="valor"></span></p>
<script>
  document.getElementById('valor').textContent = Locale.currency(1234.56);
</script>
```

### 🤖 Prompt para Eva

```
Eva, preciso de i18n simples no nosso projeto, sem trazer i18next ou similar.
Tenho referência abaixo:

[colar JS + HTML]

Adapte:
- Idiomas necessários: <listar>
- Strings já existentes no projeto que precisam virar chaves: <listar arquivos>
- Onde guardar o dict? Inline no JS, ou JSON separado? <decidir>

Mantenha vanilla. Use Intl.* para formatação. Se algum lugar usa moment.js, troque por Intl.DateTimeFormat.
```

### ⚠️ Pegadinhas

1. **`navigator.language` pode retornar variantes** (`pt`, `pt-BR`, `pt_BR`). Normalize.
2. **`Intl.NumberFormat` com `style:'percent'`** espera **fração** (0.12 vira "12%"). Não 12!
3. **Fallback de chave faltante**: retorne a `key` mesma, não `undefined` — facilita encontrar chaves não traduzidas em produção.
4. **Plurais**: `Intl.PluralRules` resolve, mas Solstice não usa ainda. Para Itaú com PT-BR é geralmente suficiente sem.

### ✅ Como testar

1. `Locale.set('en-US')` → todos `[data-i18n]` re-traduzem.
2. `Locale.currency(1234.56)` em pt-BR → "R$ 1.234,56".
3. `Locale.percent(0.123)` → "12%" (pt-BR usa vírgula).
4. F5 → idioma mantido.
5. Limpar localStorage e abrir num browser pt-BR → detecta automaticamente.

### 🔄 Variações

- **Chaves hierárquicas** (`form.save`, `form.cancel`): aceitar paths como no Store.
- **Lazy loading de dicts**: para apps grandes, carregar `pt-BR.json` sob demanda.

---

## 🟢 FEATURE 5: Sistema de erros humanizados (modal)

### 📖 O que faz no Solstice

Catálogo de erros com `code`, `message`, `suggestion`, `severity`, `icon`. `Errors.show('CSV_PARSE_FAIL', vars, extra)` abre modal amigável com sugestão acionável + details técnicos colapsáveis.

### 🎯 Por que vale portar

Mata de uma vez o `alert("Error")` técnico que ninguém entende. No Itaú, especialmente útil em fluxos críticos (envio, aprovação) onde o usuário precisa saber **o que fazer** quando algo dá errado.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| JS   | `SolsticeErrors` + catálogo | 903-995 |
| CSS  | `.solstice__err-*` | 393-422 |
| CSS  | `.solstice__modal-*` (compartilhado) | 271-330 |

### 🔗 Dependências

**Obrigatórias:** estilos de modal genérico.
**Opcionais:** `SolsticeLocale` para traduzir labels (close, details). Sem locale, hardcoda.

### 📝 Código fonte autônomo

```javascript
const Errors = (function(){
  const catalog = {
    'CSV_PARSE_FAIL': { sev:'error', icon:'❌', message:'Não consegui ler esse CSV.', suggestion:'Verifique encoding (UTF-8) e separador.' },
    'PROFILE_NAME_EMPTY': { sev:'warn', icon:'✍️', message:'Nome do perfil não pode ficar vazio.', suggestion:'Use seu nome ou um apelido.' },
    'UNKNOWN_ERROR': { sev:'error', icon:'⚠️', message:'Algo deu errado.', suggestion:'Tente novamente.' }
  };
  function register(code, def){ catalog[code] = def; }
  function show(code, vars, extra){
    const def = catalog[code] || catalog['UNKNOWN_ERROR'];
    let msg = def.message, sug = def.suggestion;
    if (vars) for (const k in vars){ msg = msg.replace('{'+k+'}', vars[k]); sug = sug.replace('{'+k+'}', vars[k]); }

    const ov = document.createElement('div');
    ov.className = 'err-overlay';
    ov.innerHTML = `
      <div class="err-modal">
        <div class="err-header"><strong>${def.icon} ${msg.split('.')[0]}</strong>
          <button class="err-close" aria-label="Fechar">✕</button></div>
        <div class="err-body">
          <small style="color:#888">Código: ${code}</small>
          <h3>${msg}</h3>
          <div class="err-suggestion">💡 ${sug}</div>
          ${extra ? '<details><summary>Detalhes técnicos</summary><pre>'+escapeHtml(typeof extra==='string'?extra:JSON.stringify(extra,null,2))+'</pre></details>' : ''}
        </div>
        <div class="err-footer"><button class="btn-primary">OK</button></div>
      </div>`;
    function close(){ ov.remove(); }
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('.err-close').addEventListener('click', close);
    ov.querySelector('.btn-primary').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });
    document.body.appendChild(ov);
    console.warn('[Errors]', code, msg, extra || '');
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  return { show, register };
})();

// Uso:
Errors.show('CSV_PARSE_FAIL', null, { stack: e.stack });
Errors.register('PAYMENT_DECLINED', { sev:'error', icon:'💳', message:'Pagamento recusado.', suggestion:'Verifique limite ou tente outro cartão.' });
```

```css
.err-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); backdrop-filter:blur(6px); z-index:200; display:flex; align-items:center; justify-content:center; }
.err-modal { background:#fff; color:#222; border-radius:12px; max-width:560px; width:90%; box-shadow:0 16px 48px rgba(0,0,0,.3); }
.err-header { padding:16px 20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; }
.err-body { padding:20px; }
.err-suggestion { background:#f0f7ff; border-left:3px solid #2563EB; padding:12px; border-radius:6px; margin-top:12px; }
.err-footer { padding:12px 20px; border-top:1px solid #eee; text-align:right; }
.err-close, .btn-primary { background:transparent; border:0; cursor:pointer; }
.btn-primary { background:#2563EB; color:#fff; padding:8px 16px; border-radius:6px; }
```

### 🤖 Prompt para Eva

```
Eva, no projeto temos erros sendo mostrados crus pro usuário (stack traces, mensagens técnicas).
Quero um sistema de erros humanizados — catálogo central com código + mensagem amigável + sugestão acionável.

Tenho referência abaixo:

[colar JS + CSS]

Mapeie erros que aparecem hoje pra códigos amigáveis. Liste os 10 erros mais frequentes que aparecem em produção (puxar de log ou perguntar pra mim) e criar entrada no catálogo pra cada.

Não substituir try/catch existente — apenas mudar o que mostramos pro usuário.
```

### ⚠️ Pegadinhas

1. **`extra` com objeto circular** quebra `JSON.stringify`. Wrappear com try/catch ou usar `safe-stringify`.
2. **Escape HTML em `extra`** essencial — pode ter dado do usuário.
3. **Modal sobre modal**: se erro acontece dentro de outro modal, garantir que o `z-index` do erro é maior.
4. **Foco**: ao abrir, mover foco para o botão de close (acessibilidade).

### ✅ Como testar

1. `Errors.show('CSV_PARSE_FAIL')` → modal aparece.
2. Esc fecha. Clique fora fecha. ✕ fecha. OK fecha.
3. `Errors.show('FOO_BAR')` (não cadastrado) → cai em UNKNOWN_ERROR.
4. Console deve ter `[Errors] CSV_PARSE_FAIL ...`.

### 🔄 Variações

- **Variante inline** (em formulários): mostrar erro sem modal.
- **Severidade `info`**: usar cor azul, ícone diferente.
- **Auto-dismiss**: erros de severity `info` somem em 5s.

---

## 🟢 FEATURE 6: Toast notifications

### 📖 O que faz no Solstice

Notificações leves em canto inferior-direito. 4 tipos (success/warn/error/info). Auto-dismiss em ~3.5s. Borda colorida por kind. Animação slide.

### 🎯 Por que vale portar

Substituto óbvio do `alert()`. Onipresente em UIs modernas. Itaú: confirmação de "Pagamento agendado", "Limite atualizado", "Sessão expirou", etc.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| HTML | `<div class="solstice__toasts">` | 642 |
| CSS  | `.solstice__toast*` | 425-445 |
| JS   | `SolsticeToast` | 1003-1025 |

### 🔗 Dependências

**Nenhuma.** Pure vanilla.

### 📝 Código fonte autônomo

```html
<div id="toasts" aria-live="polite" style="position:fixed; bottom:20px; right:20px; display:flex; flex-direction:column; gap:8px; z-index:300;"></div>
```

```css
.toast { background:#fff; border-left:3px solid #2563EB; padding:12px 16px; border-radius:8px; box-shadow:0 12px 28px rgba(0,0,0,.15); animation:t-in .25s ease; max-width:360px; }
.toast--success { border-left-color:#16A34A; }
.toast--warn    { border-left-color:#D97706; }
.toast--error   { border-left-color:#DC2626; }
.toast strong { display:block; font-size:13px; }
.toast small  { color:#666; font-size:12px; }
@keyframes t-in { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
```

```javascript
const Toast = (function(){
  const c = () => document.getElementById('toasts');
  function show(title, msg, kind, duration){
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' toast--'+kind : '');
    t.innerHTML = '<strong>'+title+'</strong>' + (msg ? '<small>'+msg+'</small>' : '');
    c().appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .25s, transform .25s';
      t.style.opacity = '0'; t.style.transform = 'translateX(20px)';
      setTimeout(() => t.remove(), 250);
    }, duration || 3500);
  }
  return {
    success: (t,m) => show(t,m,'success'),
    warn:    (t,m) => show(t,m,'warn'),
    error:   (t,m) => show(t,m,'error'),
    info:    (t,m) => show(t,m)
  };
})();
```

### 🤖 Prompt para Eva

```
Eva, adicionar sistema de toast no projeto. Referência:

[colar HTML/CSS/JS]

Adapte ao design system (cores, fonte). Substituir alert() existentes por Toast.* equivalente.
Não usar bibliotecas (Notify, Toastify, etc.).
```

### ⚠️ Pegadinhas

1. **Toasts empilhando**: limitar a 5 simultâneos (deletar o mais antigo).
2. **Acessibilidade**: `aria-live="polite"` no container — screenreaders anunciam.
3. **Mobile**: posicionar bottom-center, não bottom-right.

### ✅ Como testar

1. `Toast.success('OK','Tudo certo')` → toast aparece, some em 3.5s.
2. Empilhar 3 chamadas → 3 toasts simultâneos.
3. Mobile (375px) → toast adapta largura.

### 🔄 Variações

- **Toast com ação**: incluir botão "Desfazer" no toast (com callback).
- **Toast persistente**: `duration: 0` mantém até clique no ✕.

---

## 🟢 FEATURE 7: Perfis sem senha em localStorage

### 📖 O que faz no Solstice

Múltiplos perfis (Lucas, "Lucas Itaú", "Cliente X") sem login. Cada perfil tem nome, cor, dashboards próprios. Troca por clique.

### 🎯 Por que vale portar

Útil em ferramentas internas onde não há autenticação real mas faz sentido separar "modos" (analista vs gerente vs aprovador). Itaú: pode permitir analista alternar entre "visão produção" e "visão sandbox".

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| JS   | `SolsticeProfiles` | 1030-1090 |
| HTML | `#profile-btn` com avatar | 598-601 |

### 🔗 Dependências

**Obrigatórias:** `localStorage`, UUID generator.

### 📝 Código fonte autônomo

```javascript
const Profiles = (function(){
  const KEY = 'profiles';
  const KEY_CUR = 'profile.current';
  const COLORS = ['#4D9FFF','#FF6B9D','#2DD4BF','#A78BFA','#D97757','#94A3B8'];

  function uuid(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16);
    });
  }
  function _load(){ try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch(e){ return []; } }
  function _save(a){ try { localStorage.setItem(KEY, JSON.stringify(a)); } catch(e){} }

  function list(){ return _load(); }
  function create(name, color){
    const n = String(name||'').trim();
    if (!n) throw new Error('Nome vazio');
    const all = _load();
    if (all.some(p => p.name.toLowerCase() === n.toLowerCase())) throw new Error('Nome duplicado');
    const p = { id: uuid(), name: n, color: color || COLORS[all.length % COLORS.length], createdAt: new Date().toISOString(), dashboards: [] };
    all.push(p); _save(all);
    try { localStorage.setItem(KEY_CUR, p.id); } catch(e){}
    return p;
  }
  function switchTo(id){
    if (!_load().find(p => p.id === id)) return false;
    try { localStorage.setItem(KEY_CUR, id); } catch(e){}
    return true;
  }
  function current(){
    try { const id = localStorage.getItem(KEY_CUR); return _load().find(p => p.id === id) || null; }
    catch(e){ return null; }
  }
  function ensureDefault(){
    let c = current(); if (c) return c;
    const all = _load();
    return all.length ? (switchTo(all[0].id), all[0]) : create('User');
  }
  return { list, create, switchTo, current, ensureDefault, COLORS };
})();
```

### 🤖 Prompt para Eva

```
Eva, quero múltiplos perfis sem login no projeto. Cada perfil mantém seu próprio histórico/preferências em localStorage.

Referência:

[colar JS]

Adapte:
- Naming: <descrever>
- Quais dados ficam por perfil? Listar.
- Há requirement de segurança (não devemos armazenar X em localStorage)? <verificar>

Atenção: NÃO substitui auth real. Isso é só separação de contextos.
```

### ⚠️ Pegadinhas

1. **localStorage quota** ~5-10MB. Se cada perfil tem muitos dashboards, atingível.
2. **Sync entre tabs**: se Lucas abre 2 abas e troca perfil numa, a outra não percebe. Usar `storage` event para sincronizar.
3. **Limpeza de perfil**: ao deletar perfil, decidir se apaga também os dashboards/dados (cascade) ou só remove ponteiro.

### ✅ Como testar

1. `Profiles.create('Lucas')` → cria. `Profiles.list()` → array.
2. `Profiles.create('Lucas')` de novo → throw "Nome duplicado".
3. Reload → perfil atual mantido.
4. Modo anônimo: não trava, mas perfil some no reload.

### 🔄 Variações

- **Avatares por imagem**: aceitar upload base64 em vez de cor.
- **Compartilhamento de perfil**: export JSON do perfil para import em outra máquina.

---

## 🟢 FEATURE 8: CSV dummy procedural

### 📖 O que faz no Solstice

Gera dataset realista de vendas BR sem precisar de arquivo. Seed reativa: mesmo seed = mesmos dados. 200 linhas × 10 colunas misturando tipos (data, dimensão geo/categórica, integer, currency, percentage).

### 🎯 Por que vale portar

Demos, testes e onboarding ficam triviais. No Itaú: gerador dummy de transações, clientes-fake, score, etc. para demos sem expor dado real.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| JS   | `SolsticeUtils.seededRandom` (Mulberry32) | 605-615 |
| JS   | `SolsticeDummy.gerar()` | 1378-1430 |

### 🔗 Dependências

**Nenhuma.**

### 📝 Código fonte autônomo

```javascript
function seededRandom(seed){
  let s = seed >>> 0;
  return function(){
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gerarVendas(seed=42, n=200){
  const rnd = seededRandom(seed);
  const REGIOES = ['Sudeste','Sul','Nordeste','Norte','Centro-Oeste'];
  const UFS = { 'Sudeste':['SP','RJ','MG','ES'], 'Sul':['PR','SC','RS'], 'Nordeste':['BA','PE','CE'], 'Norte':['AM','PA'], 'Centro-Oeste':['DF','GO','MT','MS'] };
  const CATS = ['Alimentos','Bebidas','Higiene','Limpeza','Eletrônicos','Vestuário'];
  const CANAIS = ['Loja Física','E-commerce','Marketplace','Atacado'];
  const start = new Date(2024,0,1); const ms = 86400000;
  const rows = [];
  for (let i=0; i<n; i++){
    const reg = REGIOES[Math.floor(rnd()*REGIOES.length)];
    const uf  = UFS[reg][Math.floor(rnd()*UFS[reg].length)];
    const qt  = 1 + Math.floor(rnd()*50);
    const tkt = 50 + rnd()*450;
    rows.push({
      data: new Date(start.getTime() + Math.floor(rnd()*365)*ms).toISOString().slice(0,10),
      regiao: reg, uf,
      categoria: CATS[Math.floor(rnd()*CATS.length)],
      canal: CANAIS[Math.floor(rnd()*CANAIS.length)],
      qt_vendas: qt,
      ticket_medio: +(tkt).toFixed(2),
      receita: +(qt * tkt * (0.9 + rnd()*0.2)).toFixed(2),
      margem_bruta: +(18 + rnd()*30).toFixed(2),
      conversao: +(1 + rnd()*8).toFixed(2)
    });
  }
  return rows;
}

function toCSV(rows){
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return cols.join(',') + '\n' + rows.map(r => cols.map(c => {
    const v = r[c];
    if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) return '"'+v.replace(/"/g,'""')+'"';
    return v;
  }).join(',')).join('\n');
}

console.log(toCSV(gerarVendas(42, 5)));
// Sempre o mesmo output com seed=42!
```

### 🤖 Prompt para Eva

```
Eva, preciso de gerador procedural de dados para demos.

Estrutura desejada: <listar colunas e tipos>
Quantidade default: ~200 linhas
Determinístico (seed): SIM — mesmo seed = mesmo CSV.

Referência:

[colar JS]

Adapte os domínios (regiões, categorias) para nosso contexto:
- Substitua REGIOES/UFS por <listar valores reais>
- Substitua CATEGORIAS por <listar>
- Adicione/remova colunas conforme nosso schema

Saída: array de objetos + função toCSV(). NÃO usar Faker.js ou similar.
```

### ⚠️ Pegadinhas

1. **`Math.random()` não é seedável** — daí Mulberry32. Não substituir por `Math.random` ou demos viram não-reprodutíveis.
2. **`>>> 0`** força unsigned 32-bit. Sem isso, o algoritmo quebra para seeds grandes.
3. **Datas próximas ao boundary do ano** podem virar `2025-01-01` por causa do `Math.floor`. Geralmente OK.
4. **Encoding CSV**: campo com vírgula vira `"..."` com escape duplo `""`. Testar com texto contendo aspas.

### ✅ Como testar

1. `gerarVendas(42, 5)` chamado 2x retorna idêntico.
2. `gerarVendas(43, 5)` retorna diferente.
3. `toCSV(...)` parsea de volta sem perda (testar com PapaParse).
4. Linhas têm exatamente o mesmo número de colunas.

### 🔄 Variações

- **Distribuições realistas**: usar `rnd()²` para skew, ou Box-Muller para normal.
- **Sazonalidade**: oscilar receita por mês do ano.
- **Outliers proposital**: 1-2% das linhas com valores 10× a média (testar detecção do Bloco 8).

---

## 🔴 FEATURE 9: Dicionário Semântico (detecção 3 camadas)

### 📖 O que faz no Solstice

Recebe lista de nomes de colunas (e opcionalmente amostra de linhas) e devolve um "dicionário aplicado" que diz, para cada coluna: friendly name, sinônimos, unidade, se "maior é melhor", domínio. Detecta automaticamente qual de 6 dicionários pré-feitos (Banco PJ, Vendas, RH, Marketing, Operacional, Científico) se aplica.

### 🎯 Por que vale portar

Esse é **o coração do agnosticismo**. Permite o resto do produto (insights, narrativa, cores direcionais) tratar dados arbitrários. Para o Itaú: poderia auto-reconhecer "esse CSV é de carteira de crédito" e ajustar dashboards default.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| JS   | `SolsticeDictionary.presets` (6 dicts) | 1156-1310 |
| JS   | `SolsticeDictionary.matchSynonym()` | 1330-1350 |
| JS   | `SolsticeDictionary.applyHeuristic()` | 1313-1328 (HEURISTICS) |
| JS   | `SolsticeDictionary.detect()` | 1352-1395 |
| JS   | `SolsticeDictionary.openConfigModal()` | 1410-1480 |
| CSS  | `.solstice__dict-*` | 348-389 |

### 🔗 Dependências

**Obrigatórias:** estrutura JS pura.
**Opcionais:** Locale (UI do modal), Store (persistir resultado).

### 📝 Código fonte autônomo

```javascript
const presets = {
  vendas: {
    name: 'Vendas / Varejo', domain: 'comercial',
    columns: {
      'receita': { friendlyName:'Receita', synonyms:['faturamento','revenue','sales'], unit:'R$', higherIsBetter:true },
      'custo_produto': { friendlyName:'Custo', synonyms:['cmv','cogs'], unit:'R$', higherIsBetter:false },
      'margem_bruta': { friendlyName:'Margem', synonyms:['margin','gross margin'], unit:'%', higherIsBetter:true }
      // ... mais colunas
    }
  },
  banco_pj: {
    name: 'Banco PJ', domain: 'financeiro',
    columns: {
      'dpd30': { friendlyName:'Inadimplência 30d', synonyms:['atraso 30','dpd 30'], unit:'%', higherIsBetter:false },
      'taxa_aprov': { friendlyName:'Taxa Aprovação', synonyms:['aprov %'], unit:'%', higherIsBetter:true }
      // ...
    }
  }
};

const HEURISTICS = [
  { match: /^(vlr|valor|amount|receita)/i, type:'currency' },
  { match: /^(qt|qtd|num|count)/i, type:'integer' },
  { match: /^(pct|perc|taxa|rate|.*_pct$)/i, type:'percentage' },
  { match: /^(data|date|dt_|mes|ano)/i, type:'temporal' }
];

function _norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }

function matchSynonym(colName, dict){
  const target = _norm(colName);
  if (!target) return null;
  let best = null;
  for (const techKey in dict.columns){
    const def = dict.columns[techKey];
    const candidates = [techKey, def.friendlyName, ...(def.synonyms||[])];
    for (const c of candidates){
      const n = _norm(c); if (!n) continue;
      if (n === target) return { techKey, def, score: 1.0, matchType:'exact' };
      if (target.includes(n) || n.includes(target)){
        const sc = Math.min(n.length, target.length) / Math.max(n.length, target.length);
        if (!best || sc > best.score) best = { techKey, def, score: sc, matchType:'partial' };
      }
    }
  }
  return best && best.score >= 0.5 ? best : null;
}

function detect(columns){
  const results = [];
  for (const key in presets){
    const dict = presets[key];
    const matches = []; const unmatched = [];
    columns.forEach(c => { const m = matchSynonym(c, dict); m ? matches.push({col:c, ...m}) : unmatched.push(c); });
    const cov = matches.length / columns.length;
    const avg = matches.length ? matches.reduce((s,m)=>s+m.score,0)/matches.length : 0;
    results.push({ dictKey: key, dict, confidence: cov*0.7 + avg*0.3, matches, unmatched, coverage: cov });
  }
  results.sort((a,b) => b.confidence - a.confidence);
  return results[0].confidence >= 0.3 ? results[0] : null;
}

// Uso:
const cols = ['receita','custo_produto','margem_bruta','data','regiao'];
const r = detect(cols);
console.log(r.dictKey, r.confidence, r.matches);
// → 'vendas' 0.65 [{col:'receita',techKey:'receita',score:1,matchType:'exact'}, ...]
```

### 🤖 Prompt para Eva

```
Eva, preciso implementar um sistema de "Dicionário Semântico" que reconhece automaticamente o significado de colunas em datasets arbitrários.

Tenho referência abaixo (vanilla JS):

[colar JS completo + estrutura dos presets]

Adapte ao nosso contexto:
1. Trocar os 6 domínios genéricos por domínios relevantes pro Itaú:
   - Carteira de Crédito PJ
   - Operações de Mesa
   - Risco / Compliance
   - <outros que façam sentido>

2. Para cada domínio, preencher 20-30 colunas reais que aparecem nos nossos CSVs/exports. Posso te passar amostras se necessário.

3. Heurísticas adicionais para sufixos/prefixos comuns aqui (ex: "_mensal", "_anual", "saldo_", "limite_").

4. Adicionar uma 3ª camada de detecção estatística:
   - Coluna com valores ∈ [0,1] → provavelmente percentual
   - Coluna com 50%+ valores únicos → provavelmente identificador
   - Coluna com média >> mediana → distribuição skewed (financeira)

5. Resultado deve poder ser salvo (localStorage ou backend) e reaplicado em CSVs similares.

Não usar libs externas. Vanilla JS.
```

### ⚠️ Pegadinhas

1. **Normalização de strings**: acentos, separadores (`-` `_` espaço), caixa. A função `_norm` resolve. NÃO esquecer NFD.
2. **Match partial muito agressivo**: "id" matchando "idade" ou "identificador". Threshold 0.5 ajuda mas tem falsos positivos. Para Itaú, considerar threshold 0.7.
3. **Dicionários com colunas com nomes muito similares**: "receita" (vendas) vs "receita_op" (banco PJ). A heurística atual pega o mais específico, mas teste com seus CSVs.
4. **higherIsBetter `null`** ≠ `false`. `null` = "depende do contexto" (ex: tempo médio de espera — pode ser bom ou ruim).
5. **Detecção falha (confidence < 0.3)**: fallback genérico (Title Case) é fraco. Idealmente, em Itaú, ter um dicionário "default-itau" amplo.

### ✅ Como testar

1. `detect(['receita','custo','margem'])` → `'vendas'` com alta confiança.
2. `detect(['dpd30','taxa_aprov','spread'])` → `'banco_pj'`.
3. `detect(['xpto','foo','bar'])` → `null` ou fallback genérico.
4. CSV bilíngue (`['revenue','cost','margin']`) → match via sinônimos.
5. Salvar resultado, reaplicar em CSV similar → mesma estrutura.

### 🔄 Variações

- **Modo confirmação obrigatória**: para dados financeiros sensíveis, NUNCA aplicar dicionário automaticamente; sempre pedir confirmação humana.
- **Treinamento ativo**: cada vez que Lucas corrige uma detecção, salvar a correção e usar como reforço futuro.
- **Multi-detect**: combinar 2 dicionários (ex: CSV que tem cols de Vendas + RH simultaneamente).

---

## 🟢 FEATURE 10: Onboarding modal multi-slides

### 📖 O que faz no Solstice

Modal com slides paginados (3 no Bloco 1). Indicador de progresso (dots). Botões Pular/Próximo/Começar. Aparece só na primeira visita. Reabre via botão "?".

### 🎯 Por que vale portar

Padrão clássico de primeira experiência. Itaú: explicar features novas após release sem precisar email/treinamento.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| JS   | `SolsticeOnboarding` | 1438-1490 |
| CSS  | `.solstice__onb*` | 332-347 |

### 🔗 Dependências

**Obrigatórias:** modal genérico.
**Opcionais:** Locale para strings traduzidas.

### 📝 Código fonte autônomo

```javascript
function showOnboarding(slides){
  let idx = 0;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-body">
        <div class="onb">
          <div class="onb-icon">☀️</div>
          <h2 class="onb-title"></h2>
          <p class="onb-text"></p>
          <div class="onb-dots">${slides.map(() => '<div class="onb-dot"></div>').join('')}</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-skip">Pular</button>
        <button class="btn-next">Próximo</button>
      </div>
    </div>`;

  const title = overlay.querySelector('.onb-title');
  const text = overlay.querySelector('.onb-text');
  const next = overlay.querySelector('.btn-next');
  const dots = overlay.querySelectorAll('.onb-dot');

  function render(){
    title.textContent = slides[idx].title;
    text.textContent = slides[idx].text;
    dots.forEach((d,i) => d.classList.toggle('active', i===idx));
    next.textContent = idx === slides.length-1 ? 'Começar' : 'Próximo';
  }

  function close(){
    try { localStorage.setItem('onb.done', '1'); } catch(e){}
    overlay.remove();
  }

  overlay.querySelector('.btn-skip').addEventListener('click', close);
  next.addEventListener('click', () => idx === slides.length-1 ? close() : (idx++, render()));
  document.body.appendChild(overlay);
  render();
}

function isFirstTime(){ try { return !localStorage.getItem('onb.done'); } catch(e){ return true; } }

// Uso:
if (isFirstTime()) showOnboarding([
  { title: 'Bem-vindo', text: 'Sua nova ferramenta.' },
  { title: 'Recursos', text: 'X, Y, Z.' },
  { title: 'Vamos lá', text: 'Comece clicando em ...' }
]);
```

### 🤖 Prompt para Eva

```
Eva, quero onboarding para primeira visita no projeto.

Referência:

[colar JS]

Adapte:
- Conteúdo dos 3-5 slides: <listar conteúdos>
- Acionar não só na primeira visita, mas também após cada release maior (verificando versão em localStorage).
- Adicionar ilustração/SVG por slide se possível.

Vanilla, sem framework. Reutilizar componente de modal já existente.
```

### ⚠️ Pegadinhas

1. **Acessibilidade**: `aria-modal="true"`, foco preso no modal (focus trap virá no Bloco 12).
2. **Keyboard nav**: setas esquerda/direita pra navegar slides. Esc pra pular.
3. **Reabrir manualmente**: se Lucas quer rever, precisa de um botão "Ajuda" que dispare `show()` ignorando `isFirstTime`.

### ✅ Como testar

1. Limpar localStorage → recarregar → aparece após 400ms.
2. Clicar Pular → fecha e marca como visto. F5 → não reaparece.
3. Clicar Próximo até último slide → texto vira "Começar".
4. Botão "?" reabre.

### 🔄 Variações

- **Versão por release**: armazenar `onb.version` e mostrar onboarding se versão atual > versão salva.
- **Tour interativo** (Bloco 12): destaca elementos da UI em vez de slides estáticos.

---

## 🟢 FEATURE 11: Debug overlay (Ctrl+Shift+D)

### 📖 O que faz no Solstice

Atalho `Ctrl+Shift+D` abre overlay flutuante com 3 abas (STATE / LOCALE / PERF) mostrando estado atual da aplicação. Auto-refresh.

### 🎯 Por que vale portar

Acelera muito o debug. No Itaú, especialmente útil para suporte: "abra o debug, manda screenshot do STATE pra mim".

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| JS   | `SolsticeDebug` | 1498-1580 |
| CSS  | `.solstice__debug*` | 448-485 |

### 🔗 Dependências

**Opcionais:** Store (aba STATE). Sem, mostra `window.app` ou similar.

### 📝 Código fonte autônomo

```javascript
const Debug = (function(){
  let overlay = null, timer = null, tab = 'state';

  function toggle(){ overlay ? close() : open(); }

  function open(){
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;bottom:24px;right:24px;width:480px;max-height:70vh;background:rgba(15,20,30,.96);color:#C8D0E0;border:1px solid #444;border-radius:14px;z-index:9999;display:flex;flex-direction:column;font-family:monospace;font-size:12px;backdrop-filter:blur(8px);';
    overlay.innerHTML = `
      <div style="padding:8px 12px;border-bottom:1px solid #333;display:flex;justify-content:space-between;">
        <strong style="color:#8AB4F8">🐛 Debug · Ctrl+Shift+D</strong>
        <button style="background:transparent;border:0;color:#888;cursor:pointer;" id="dbg-close">✕</button>
      </div>
      <div style="display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid #333;">
        ${['state','locale','perf'].map(t => `<span style="padding:2px 8px;border-radius:4px;cursor:pointer;background:${t===tab?'rgba(138,180,248,.15)':'transparent'};color:${t===tab?'#8AB4F8':'#888'};" data-tab="${t}">${t.toUpperCase()}</span>`).join('')}
      </div>
      <div id="dbg-body" style="padding:12px;overflow:auto;flex:1;"></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#dbg-close').onclick = close;
    overlay.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => { tab = el.dataset.tab; open_(); });
    render();
    timer = setInterval(render, 800);
  }

  function open_(){ close(); open(); }   // re-render simples ao trocar aba

  function render(){
    if (!overlay) return;
    const body = overlay.querySelector('#dbg-body');
    if (tab === 'state'){
      const s = window.appState || {};
      body.innerHTML = '<pre style="white-space:pre-wrap;">'+JSON.stringify(s,null,2)+'</pre>';
    } else if (tab === 'perf'){
      const m = performance.memory || {};
      body.innerHTML = `
        UA: ${navigator.userAgent.slice(0,60)}<br>
        Viewport: ${innerWidth} × ${innerHeight}<br>
        DPR: ${devicePixelRatio}<br>
        Heap: ${m.usedJSHeapSize ? (m.usedJSHeapSize/1048576).toFixed(1)+' MB' : 'N/A'}<br>
        Uptime: ${(performance.now()/1000).toFixed(1)}s`;
    } else {
      body.innerHTML = 'Locale: '+document.documentElement.lang;
    }
  }

  function close(){ if (timer) clearInterval(timer); timer = null; if (overlay){ overlay.remove(); overlay = null; } }

  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')){ e.preventDefault(); toggle(); }
  });

  return { toggle, open, close };
})();
```

### 🤖 Prompt para Eva

```
Eva, adicionar overlay de debug acessível por Ctrl+Shift+D.

Referência:

[colar JS]

Adapte:
- Quais informações expor (state global, configs, identificadores de sessão, version, last error)?
- Em produção, esconder atrás de feature flag? <decidir>
- Permitir export do debug como JSON (para attach em ticket)?
```

### ⚠️ Pegadinhas

1. **NUNCA logar dados sensíveis** (PII, tokens, senhas). Filtrar.
2. **Em produção**, atrás de flag ou parâmetro `?debug=1`. Não deixar atalho global ativo.
3. **`performance.memory`** só funciona no Chrome/Edge. Wrappear.
4. **Atalho conflitando** com extensão (Vimium, AdBlock). Considerar Ctrl+Shift+Y como alt.

### ✅ Como testar

1. `Ctrl+Shift+D` → overlay aparece. Repetir → fecha.
2. Trocar aba → conteúdo muda.
3. Conteúdo refresh ~a cada 1s.
4. `Esc` fecha (se implementado).

### 🔄 Variações

- **Aba NETWORK**: lista últimas N requests fetch.
- **Aba ERRORS**: catch global de window.onerror, lista últimas falhas.
- **Aba EVAL**: console mini para testar `Store.get()` etc.

---

## 🟢 FEATURE 12: FOUC prevention via script inline

### 📖 O que faz no Solstice

Script minúsculo no `<head>` que aplica tema (dark/light/palette) lendo localStorage ANTES de qualquer pintura, evitando flash de tema errado.

### 🎯 Por que vale portar

Bug visual cosmético, mas notável. Itaú: percepção de qualidade. Custo: 10 linhas. Ganho: zero flash.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|------|-------------|--------------|
| HTML | `<script>` no `<head>` antes do CSS | 13-22 |

### 🔗 Dependências

**Nenhuma.**

### 📝 Código fonte autônomo

```html
<!DOCTYPE html>
<html>
<head>
  <script>
    (function(){
      try {
        var root = document.documentElement;
        var ls = window.localStorage;
        var saved = ls && ls.getItem('theme');
        var t = saved ? JSON.parse(saved) : {};
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-mode',    t.mode    || (prefersDark ? 'dark' : 'light'));
        root.setAttribute('data-palette', t.palette || 'default');
      } catch(e){}
    })();
  </script>
  <link rel="stylesheet" href="...">
</head>
```

### 🤖 Prompt para Eva

```
Eva, evitar FOUC (Flash of Unstyled Content) ao trocar tema no nosso projeto.

Referência:

[colar HTML]

Adicione o script INLINE no <head>, ANTES de qualquer <link>/CSS.
Verifique se o framework (se React/Vue/etc.) não está re-renderizando o <html> e perdendo os atributos. Se sim, isolar com getServerSideProps ou equivalente.
```

### ⚠️ Pegadinhas

1. **NÃO usar `defer` nem `src=...`** — precisa rodar síncrono inline.
2. **try/catch obrigatório** — modo anônimo joga `SecurityError`.
3. **Se o CSS aplica `transition` em cores no body**, na primeira pintura a transição roda do "default" para o tema. Solução: aplicar `transition` só depois do load (`body { transition: none; } body.ready { transition: ... }`).

### ✅ Como testar

1. localStorage com `theme: dark` → recarrega → fundo escuro do primeiro frame.
2. F12 → Network → throttle slow 3G → recarrega → ainda assim sem flash.

### 🔄 Variações

- **Cookie em vez de localStorage**: se backend renderiza, ler cookie e setar atributo no servidor.

---

## 🟥 RESUMO DO BLOCO

### Features mais valiosas para portar primeiro

1. **🥇 Locale dinâmico (Feature 4)** — alta utilidade, complexidade média. Resolve problema real, vanilla, sem lib pesada.
2. **🥈 Sistema de erros humanizados (Feature 5)** — baixíssimo custo, alto retorno em UX. Eva pode aplicar em 1 tarde.
3. **🥉 Store reativo path-subscription (Feature 3)** — base para qualquer outra feature reativa que vier depois.
4. **Toggle Dark/Light + FOUC (Features 1 + 12)** — 30min pra portar, percepção imediata de qualidade.
5. **Dicionário Semântico (Feature 9)** — alto valor agnóstico, mas requer planejamento. Vale começar a discutir agora pra ter dicionários Itaú no roadmap.

### Features que NÃO vale portar isoladamente

- **Sistema multi-paleta (Feature 2)** — só faz sentido se o projeto vai oferecer customização visual. Para uma página interna fixa, exagero.
- **Toast notifications (Feature 6)** — só se ainda usar `alert()`. Senão, provavelmente já tem.
- **CSV dummy procedural (Feature 8)** — só para projetos que precisam de demos/sandbox. Operacional em prod não precisa.

### Recomendação específica para projeto Itaú via Eva

Considerando contexto Itaú/PJ:

1. **Prioridade 1**: portar **Dicionário Semântico (Feature 9)** com dicionários customizados Itaú (Carteira PJ, Operações de Mesa, Risco). Isso multiplica o valor de qualquer feature analítica que vier depois.

2. **Prioridade 2**: portar **Erros humanizados (Feature 5)** — UX win imediato em todos fluxos críticos.

3. **Prioridade 3**: portar **Store reativo (Feature 3)** se ainda não houver gestão de estado madura. Se já houver Redux/Zustand/etc., NÃO substituir — usar como complemento para casos pontuais.

4. **Pular por enquanto**: multi-paleta (over-engineering pra ambiente corporativo fixo), onboarding (Itaú já deve ter sistema próprio), CSV dummy (Itaú usa dados reais).

5. **Atenção especial**: garantir que NENHUMA das features use dados sensíveis em `localStorage`. Auditar antes de portar para Eva. Para PII/financeiro, considerar `sessionStorage` ou backend.

---

> Documento gerado no Bloco 1. Linhas aproximadas — para precisão pixel-perfect rode `PORTABILIDADE BLOCO 1` após mudanças.
