# PORTABILIDADE — Bloco 11: Snapshots + Versions + FileSystem + Export + Templates Itaú

> Persistência completa e compartilhamento. Features mais valiosas: Export HTML standalone (compartilhar sem servidor) e Snapshots com LZ-String (storage eficiente).

---

## 📋 ÍNDICE

| # | Feature | Complexidade | Tempo | Dependências |
|---|---------|--------------|-------|--------------|
| 1 | Snapshots em localStorage com LZ-String | 🟡 Média | 2-3h | LZ-String inline |
| 2 | Ring buffer de versões automáticas | 🟢 Simples | 1h | Store subscribe |
| 3 | File System Access API com fallback | 🟡 Média | 2h | nenhuma |
| 4 | Export HTML standalone com hidratação | 🔴 Complexa | 6-8h | Store + LZ + Canvas |
| 5 | Templates de domínio anexáveis | 🟢 Simples | 1-2h | sistema de Templates existente |
| 6 | UI de gerenciamento (aba sidebar) | 🟢 Simples | 2h | sidebar tabs do projeto |

---

## 🟡 FEATURE 1: Snapshots em localStorage com LZ-String

### 📝 Código autônomo

```javascript
// Requer LZ-String (inline ou via CDN — pieroxy/lz-string)
const Snapshots = {
  KEY_PREFIX: 'app.snapshots.',
  CAP: 30,

  _key(profileId) { return this.KEY_PREFIX + profileId; },

  list(profileId) {
    try { return JSON.parse(localStorage.getItem(this._key(profileId)) || '[]'); }
    catch(e) { return []; }
  },

  save(profileId, name, state) {
    const json = JSON.stringify(state);
    const compressed = LZString.compressToBase64(json);
    const entry = {
      id: crypto.randomUUID(),
      name: name || 'Snapshot ' + new Date().toLocaleString(),
      savedAt: new Date().toISOString(),
      size: compressed.length,
      data: compressed
    };
    const all = this.list(profileId);
    all.unshift(entry);
    while (all.length > this.CAP) all.pop();
    try {
      localStorage.setItem(this._key(profileId), JSON.stringify(all));
      return entry;
    } catch (e) {
      console.error('[Snapshots] QuotaExceeded:', e);
      return null;
    }
  },

  load(profileId, id) {
    const entry = this.list(profileId).find(e => e.id === id);
    if (!entry) return null;
    try {
      const raw = LZString.decompressFromBase64(entry.data);
      return JSON.parse(raw);
    } catch (e) { return null; }
  },

  remove(profileId, id) {
    const all = this.list(profileId).filter(e => e.id !== id);
    localStorage.setItem(this._key(profileId), JSON.stringify(all));
  }
};
```

### 🤖 Prompt para Eva

```
Eva, preciso de persistência de dashboards em localStorage do nosso app.
Não usar IndexedDB nesta versão — keep it simple.

Snapshots:
- localStorage com LZ-String comprimindo (5-10x)
- Cap 30 por perfil (FIFO)
- Salva state completo (canvas + filtros + dataset)

[colar código acima]

Validar:
- Snapshot de 5MB JSON cabe em ~500KB Base64
- Cap funciona: snapshot 31 descarta o 1
- QuotaExceededError tratado com mensagem amigável
```

### ⚠️ Pegadinhas

1. **localStorage tem limite por origem (~5-10 MB)** — datasets gigantes podem estourar mesmo comprimidos. Tratar `QuotaExceededError` com mensagem clara
2. **`crypto.randomUUID()` só HTTPS** — em `file://` pode falhar; fallback: `Math.random().toString(36)`
3. **LZ-String tem várias variantes** — `compressToBase64`/`compressToUTF16`/`compressToEncodedURIComponent`. Base64 é mais portável em localStorage

---

## 🟢 FEATURE 2: Ring buffer de versões automáticas

```javascript
const Versions = {
  MAX: 10,
  history: [],

  capture(state) {
    const json = JSON.stringify(state);
    if (this.history.length && this.history[0].snapshot === json) return; // dedup
    this.history.unshift({ ts: Date.now(), snapshot: json });
    while (this.history.length > this.MAX) this.history.pop();
  },

  restore(index) {
    const e = this.history[index];
    return e ? JSON.parse(e.snapshot) : null;
  },

  list() { return this.history.map((h, i) => ({ index: i, ts: h.ts })); }
};

// Hook em Store
Store.subscribe('canvas', () => Versions.capture(Store.get('canvas')));
```

### ⚠️ Pegadinhas

1. **Memória somente** — intencional. Se quiser persistir, vira "Snapshots"
2. **Dedup é importante** — sem ela, drag-resize gera 20 versões idênticas

---

## 🟡 FEATURE 3: File System Access API com fallback

```javascript
const FS = {
  supported: typeof window.showSaveFilePicker === 'function',

  async saveJSON(state, suggestedName) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    if (this.supported) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false; // user cancelled
      }
    }
    // Fallback download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  },

  async openJSON() {
    if (this.supported) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        const file = await handle.getFile();
        return JSON.parse(await file.text());
      } catch (e) {
        if (e.name === 'AbortError') return null;
      }
    }
    // Fallback input
    return new Promise(resolve => {
      const i = document.createElement('input');
      i.type = 'file';
      i.accept = '.json,application/json';
      i.onchange = async e => {
        const f = e.target.files[0];
        resolve(f ? JSON.parse(await f.text()) : null);
      };
      i.click();
    });
  }
};
```

### ⚠️ Pegadinhas

1. **AbortError silencioso** — usuário cancelar não é erro
2. **MIME type** — alguns browsers só aceitam `application/json`, outros aceitam `*/*` com extensão

---

## 🔴 FEATURE 4: Export HTML standalone com hidratação

A joia da coroa. Permite compartilhar dashboard via e-mail sem servidor.

### 📝 Padrão essencial

```javascript
function buildStandaloneHTML(state) {
  const json = JSON.stringify(state);
  const compressed = LZString.compressToBase64(json);

  // 1. Pega HTML atual
  const html = document.documentElement.outerHTML;

  // 2. Injeta meta + script com state no <head>
  const injection = `
    <meta name="app-embedded" content="1">
    <script id="app-embedded-state" type="application/octet-stream">${compressed}</script>
  `;
  let out = html.replace(/<head([^>]*)>/i, '<head$1>' + injection);

  // 3. Injeta hidratação no fim do <body>
  const hydration = `
    <script>
      (function() {
        function rehydrate() {
          if (!window.App || !window.LZString) return setTimeout(rehydrate, 100);
          const meta = document.querySelector('meta[name="app-embedded"]');
          if (!meta) return;
          const script = document.getElementById('app-embedded-state');
          if (!script) return;
          try {
            const raw = LZString.decompressFromBase64(script.textContent.trim());
            const state = JSON.parse(raw);
            App.Store.batch(() => {
              App.Store.set('canvas', state.canvas);
              App.Store.set('filters', state.filters);
              App.Store.set('dataset', state.dataset);
            });
            App.Canvas.render();
            console.log('%c[App] Estado embedded rehidratado', 'color:#4ADE80;font-weight:bold;');
          } catch(e) { console.error('[App] Rehidratação falhou:', e); }
        }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => setTimeout(rehydrate, 200));
        } else setTimeout(rehydrate, 200);
      })();
    </script>
  `;
  out = out.replace(/<\/body>/i, hydration + '</body>');
  return out;
}
```

### 🤖 Prompt para Eva

```
Eva, preciso exportar nosso dashboard como HTML standalone. Permite compartilhar
por e-mail sem servidor — quem abre vê dashboard idêntico.

Estratégia:
1. Pega document.documentElement.outerHTML
2. Injeta state comprimido (LZ-String) como <script type="application/octet-stream">
3. Adiciona snippet de hidratação que descomprime e popula Store no boot

[colar código]

Validar:
- Arquivo gerado abre em browser limpo
- Dashboard idêntico aparece
- Console mostra "[App] Estado embedded rehidratado" em verde
- Tamanho: ~500KB base + dataset comprimido
```

### ⚠️ Pegadinhas (sérias)

1. **Versão do HTML é "congelada"** — se App evolui, exports antigos podem ter incompatibilidades. Estabilizar Store API
2. **CSP `'unsafe-inline'`** necessário — host receptor precisa permitir script inline
3. **`document.documentElement.outerHTML` em iframes ou shadow DOM** pode dar resultado parcial; testar
4. **setTimeout 200ms** para rehidratação — guarda contra módulos não totalmente inicializados; pode precisar ajuste

---

## 🟢 FEATURE 5: Templates de domínio anexáveis

```javascript
const DomainTemplates = {
  TEMPLATES: [
    {
      id: 'finance-monthly',
      name: 'Visão Financeira Mensal',
      icon: '💰',
      domain: 'finance',
      build: () => [
        { title: 'KPIs', rows: [{ layout: '3col-equal', slots: [
          { type: 'kpi', config: { column: 'revenue', agg: 'sum' } },
          { type: 'kpi', config: { column: 'cost',    agg: 'sum' } },
          { type: 'kpi', config: { column: 'margin',  agg: 'avg' } }
        ]}] }
      ]
    }
  ],

  init(TemplatesModule) {
    this.TEMPLATES.forEach(t => {
      if (!TemplatesModule.DOMAIN.find(x => x.id === t.id)) {
        TemplatesModule.DOMAIN.push(t);
      }
    });
  }
};
```

### ⚠️ Pegadinhas

1. **Templates assumem nomes de coluna específicos** — só funcionam se dataset tem essas colunas. Documente requisitos
2. **Dedup por id** evita push duplicado se init chamado 2×

---

## 🟥 RESUMO DO BLOCO

### Mais valiosas para Itaú via Eva

1. **🔴 Export HTML standalone** (Feature 4) — dashboard compartilhável sem servidor (gestores recebem por e-mail)
2. **🟡 Snapshots com LZ-String** (Feature 1) — restauração instantânea de configurações salvas
3. **🟢 Templates Itaú** (Feature 5) — 3 dashboards prontos para cenários PJ comuns

### Sequência sugerida

1. Sprint 1: Snapshots + Versions (storage)
2. Sprint 2: FileSystem (open/save)
3. Sprint 3: Export HTML standalone (alta complexidade)
4. Sprint 4: Templates específicos do domínio

**ROI estimado:** 14-18h. Em troca: dashboards persistem entre sessões, são compartilháveis via e-mail, e templates domínio-específicos reduzem time-to-value para gestores Itaú.
