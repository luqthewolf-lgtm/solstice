# PORTABILIDADE — Bloco 5: 4 Componentes Base + Auditoria + Provenance Trail

> Documento gerado automaticamente. Como portar cada feature para outros projetos, especialmente o projeto Itaú via Eva.

---

## 📋 ÍNDICE DE FEATURES PORTÁVEIS

| # | Feature | Complexidade | Tempo estimado | Dependências |
|---|---------|--------------|----------------|--------------|
| 1 | Auditoria de Decisões (log + modal + export Markdown) | 🔴 Complexa | 4-6h | Store, Modal |
| 2 | Provenance Trail (cadeia de derivação de um número) | 🟡 Média | 2-3h | Audit, Dicionário |
| 3 | Registry plugável de componentes visuais | 🟡 Média | 3-4h | Store |
| 4 | KPI Card com delta direcional (higherIsBetter) | 🟡 Média | 2-3h | Dicionário, Locale |
| 5 | Painel de Propriedades com abas (sidebar) | 🟡 Média | 3-5h | registry |
| 6 | Heatmap CSS em coluna numérica via `--heat-intensity` | 🟢 Simples | 1h | CSS vars |
| 7 | Picker de componente com defaultConfig contextual | 🟢 Simples | 1-2h | Modal.select |

---

## 🔴 FEATURE 1: Auditoria de Decisões (log + modal + export Markdown)

### 📖 O que faz no Solstice

Diferencial #1 do produto. Cada ação importante (`add_component`, `update_config`, `select_component`, etc.) chama `Audit.record({action, target, componentId, details})`. Ring buffer de 500 entradas. Modal global com timeline filtrável. Export para Markdown que vira evidência de compliance.

### 🎯 Por que vale portar

**Compliance, suporte e debugging.** Itaú: rastrear quem mudou um parâmetro de produto, ordenar análises por usuário, exportar para anexar em ticket de auditoria. Custo único, retorno permanente.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeAudit` módulo | 3210-3390 |
| CSS | `.solstice__audit-*` | ~885-925 |

### 🔗 Dependências

Store (para timestamps fonte), Modal (para UI).

### 📝 Código fonte autônomo

```javascript
const Audit = (function(){
  const MAX = 500;
  const log = [];
  const subs = new Set();

  function record(entry){
    entry.ts = entry.ts || new Date().toISOString();
    log.push(entry);
    if (log.length > MAX) log.shift();
    subs.forEach(cb => { try { cb(entry); } catch(e){} });
  }

  function list(filter){
    if (!filter) return log.slice();
    return log.filter(e => {
      if (filter.componentId && e.componentId !== filter.componentId) return false;
      if (filter.action && e.action !== filter.action) return false;
      return true;
    });
  }

  function toMarkdown(filter){
    const lines = ['# Auditoria de Decisões', '', '> Exportado ' + new Date().toLocaleString(), ''];
    list(filter).forEach(e => {
      lines.push('## ' + e.action);
      lines.push('- **Quando:** `' + e.ts + '`');
      if (e.componentId) lines.push('- **Componente:** `' + e.componentId + '`');
      if (e.details) {
        lines.push('- **Detalhes:**');
        lines.push('  ```json');
        lines.push('  ' + JSON.stringify(e.details, null, 2).replace(/\n/g, '\n  '));
        lines.push('  ```');
      }
      lines.push('');
    });
    return lines.join('\n');
  }

  function exportMd(filter){
    const blob = new Blob([toMarkdown(filter)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'audit-' + Date.now() + '.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }

  return { record, list, log, toMarkdown, exportMd, subscribe: cb => subs.add(cb) };
})();

// Uso:
Audit.record({ action: 'approve_transaction', componentId: 'txn-123', details: { value: 1000, currency: 'BRL' } });
Audit.record({ action: 'change_limit', componentId: 'limit-edit', details: { from: 5000, to: 10000 } });
Audit.exportMd();   // baixa arquivo .md
```

### 🤖 Prompt para Eva

```
Eva, implementar sistema de auditoria de decisões no projeto.

Requisitos:
1. Ring buffer em memória (500-1000 entradas)
2. Cada entrada: { ts, action, target, userId, details }
3. Captura via record() chamado por features (não hook automático — mais controle)
4. Modal com timeline cronológica + filtros por componente/ação/userId
5. Export para Markdown (compliance) e CSV (analytics)
6. Subscribe a mudanças (para UI reativa)

Referência:

[colar JS completo]

Adicionar:
- userId no entry shape (puxar do nosso sistema de auth)
- Persistência em backend para compliance (não só em memória)
- Retenção configurável (90 dias / 1 ano)
- Integração com SIEM se aplicável

Quais ações auditar inicialmente: discutir com time de compliance.
Garantir LGPD: não logar dados pessoais sem anonimização.
```

### ⚠️ Pegadinhas

1. **NÃO logar dados pessoais sem anonimização** — `details` pode conter PII. Sanitizar antes de gravar (mascarar CPF/email).
2. **Ring buffer perde histórico antigo** silenciosamente — para compliance, persistir em backend e usar memória só como cache.
3. **Export sem filtro** baixa 500 entradas — pode ser grande. Filtrar por data ou componente sempre.
4. **`Blob` + revokeObjectURL** é importante para não vazar memória.
5. **`subs.forEach` com try/catch** — um subscriber quebrado não derruba os outros.

### ✅ Como testar

1. `Audit.record({ action: 'test' })` → `Audit.log.length === 1`.
2. `Audit.list({ action: 'test' })` → 1 entrada.
3. `Audit.exportMd()` → baixa `audit-<ts>.md` com conteúdo Markdown válido.
4. 501 records → primeiro é descartado.

### 🔄 Variações

- **Backend-backed**: `record` envia POST para `/api/audit`; UI lê de cache local + backend.
- **Diff semântico**: entradas guardam `before` + `after` para reconstrução.

---

## 🟡 FEATURE 2: Provenance Trail (cadeia de derivação de um número)

### 📖 O que faz no Solstice

Botão 🔬 em cada componente abre modal com cadeia visual:
**Dataset → Coluna → Filtros → Agregação → Resultado**

Cada passo tem ícone + label + valor. Setas conectam. Inovação Própria #2 do projeto.

### 🎯 Por que vale portar

Reduz a frequência da pergunta clássica de analista: "esse número está errado, de onde ele veio?". Para Itaú: traceability de qualquer KPI exibido — receita, exposição, conformidade.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeAudit.openProvenance` | 3345-3390 |
| CSS | `.solstice__prov-*` | ~930-955 |

### 🔗 Dependências

Modal (para UI). Dicionário (para friendlyName). Locale (para formatação).

### 📝 Código fonte autônomo

```javascript
function openProvenance({ datasetName, totalRows, column, friendlyName, filters, aggregation, validCount, result }){
  const body = document.createElement('div');
  body.className = 'prov-chain';

  function step(label, value){
    const el = document.createElement('div');
    el.className = 'prov-step';
    el.innerHTML = `<div class="prov-step-label">${label}</div><div class="prov-step-value">${value}</div>`;
    return el;
  }
  function arrow(){
    const el = document.createElement('div');
    el.className = 'prov-step-arrow';
    el.textContent = '↓';
    return el;
  }

  body.appendChild(step('📄 Dataset', datasetName + ' · ' + totalRows + ' linhas'));
  body.appendChild(arrow());
  body.appendChild(step('🎯 Coluna escolhida', column + ' (' + friendlyName + ')'));
  body.appendChild(arrow());
  body.appendChild(step('🔍 Filtros aplicados', filters || 'nenhum'));
  body.appendChild(arrow());
  body.appendChild(step('🧮 Agregação', aggregation + ' sobre ' + validCount + ' valores'));
  body.appendChild(arrow());
  body.appendChild(step('📊 Resultado', result));

  Modal.show({ title: '🔬 De onde vem esse número?', size: 'lg', body });
}
```

```css
.prov-chain { display: flex; flex-direction: column; gap: 8px; font-family: monospace; }
.prov-step { padding: 12px; border-radius: 6px; background: #f1f5f9; border-left: 3px solid #2563EB; }
.prov-step-label { font-weight: 600; margin-bottom: 2px; }
.prov-step-value { color: #475569; font-size: 12px; }
.prov-step-arrow { text-align: center; color: #94a3b8; font-size: 16px; }
```

### 🤖 Prompt para Eva

```
Eva, "De onde vem esse número?" para cada KPI/métrica exibida no projeto.

Cada KPI tem botão 🔬 que abre cadeia visual:
Dataset → Filtros → Coluna → Agregação → Resultado

Referência:

[colar JS + CSS]

Adapte os passos para nosso domínio:
- Pode ter passos extras (Joins entre tabelas, Transformações intermediárias, Limites de regulamentação)
- Permitir clicar em cada passo para drill-down (próxima feature?)
- Export para PDF como evidência

Cobrir todas as métricas críticas: receita, inadimplência, RWA, capital.
```

### ⚠️ Pegadinhas

1. **Cadeia hardcoded é frágil** — se a métrica depende de 7 passos e o modal mostra 5, fica errado. Aceitar arrays de steps.
2. **PII nos valores**: passos podem mostrar valores de linhas individuais. Mascarar quando necessário.
3. **Performance**: calcular cadeia ao vivo cada vez é OK para 1 KPI; para 50 KPIs simultâneos, cachear.

### ✅ Como testar

1. KPI mostra "R$ 1.234,56" → 🔬 abre modal.
2. Cadeia mostra Dataset name + 200 linhas → coluna escolhida → SUM sobre 198 valores válidos → R$ 1.234,56.
3. Trocar agregação para AVG → modal reflete.

### 🔄 Variações

- **Steps clicáveis**: cada passo expande para mostrar linhas/filtros detalhados.
- **PDF Export**: para anexar em auditoria.

---

## 🟡 FEATURE 3: Registry plugável de componentes visuais

### 📖 O que faz no Solstice

`Components.register({ id, name, icon, defaultConfig(ctx), render(slot, host, ctx) })`. 4 componentes registrados no Bloco 5 (KPI, Série Temporal, Distribuição, Tabela). Blocos futuros (B6) adicionam mais sem tocar no core.

### 🎯 Por que vale portar

Padrão "open-closed". Plugins de componente customizado para diferentes squads/produtos do Itaú sem alterar código base.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeComponents` | 3395-3640 |

### 🔗 Dependências

Store (para contexto), Modal (para erros).

### 📝 Código fonte autônomo

```javascript
const Components = (function(){
  const registry = {};

  function register(def){ registry[def.id] = def; }
  function get(id){ return registry[id]; }
  function list(){ return Object.values(registry); }

  function render(slot, host, ctx){
    const def = registry[slot.type];
    if (!def){
      host.innerHTML = `<div class="error">Componente "${slot.type}" não registrado.</div>`;
      return;
    }
    try { def.render(slot, host, ctx); }
    catch(err){
      host.innerHTML = `<div class="error">⚠️ ${err.message}</div>`;
      console.error('[Components]', def.id, err);
    }
  }

  return { register, get, list, render };
})();

// Componente exemplo:
Components.register({
  id: 'kpi',
  name: 'KPI Card',
  icon: '📊',
  defaultConfig: (ctx) => ({
    column: ctx.columns.find(c => ctx.types[c]?.group === 'numeric'),
    agg: 'sum'
  }),
  render: (slot, host, ctx) => {
    const cfg = slot.config || {};
    if (!cfg.column){ host.innerHTML = '<div>Configure a coluna</div>'; return; }
    const values = ctx.rows.map(r => parseFloat(r[cfg.column])).filter(v => !isNaN(v));
    const value = values.reduce((a,b) => a+b, 0);
    host.innerHTML = `<div class="kpi-value">${value.toLocaleString()}</div>`;
  }
});

// Registrar componente customizado de outro arquivo:
Components.register({
  id: 'risk-gauge',
  name: 'Medidor de Risco',
  icon: '⚠️',
  defaultConfig: () => ({ threshold: 0.7 }),
  render: (slot, host, ctx) => { /* SVG do medidor */ }
});
```

### 🤖 Prompt para Eva

```
Eva, registry de componentes plugáveis no projeto.

Cada componente:
- id único
- name (PT-BR)
- icon (emoji)
- defaultConfig(ctx) — gera config inicial inteligente
- render(slot, host, ctx) — renderiza no DOM

ctx contém { rows, columns, types, dictionary, locale }.

Referência:

[colar JS]

Adapte:
- TypeScript: tipar ComponentDef + Context
- Versionamento: cada def tem versão, snapshots antigos podem precisar migration
- Lazy load: componentes pesados podem importar Chart.js/D3 sob demanda
- Permissões: alguns componentes só aparecem para roles específicos

Componentes prioritários pro Itaú:
- KPI básico (já no Solstice)
- Série temporal (Chart.js)
- Mapa de calor por agência
- Heatmap risco/retorno
- Tabela com sparkline
- Funnel de aprovação
```

### ⚠️ Pegadinhas

1. **Erros no `render` derrubam canvas** se não há try/catch. Sempre wrappear.
2. **`defaultConfig` deve ser idempotente** — chamadas múltiplas com mesmo ctx → mesmo resultado.
3. **Sem versionamento** = breaking changes quebram snapshots. Adicionar `def.version` desde o início.
4. **Componentes pesados**: cuidado com renderização síncrona de 50+ componentes; usar `requestIdleCallback`.

### ✅ Como testar

1. `Components.register({...})` → `Components.list().length` aumenta.
2. `Components.render(slot, host)` → DOM populado.
3. Componente com erro → mensagem inline, canvas intacto.

### 🔄 Variações

- **Marketplace**: cada componente é um arquivo .js separado carregável por URL.
- **Customização visual**: cada componente declara seu próprio schema de config.

---

## 🟡 FEATURE 4: KPI Card com delta direcional (`higherIsBetter`)

### 📖 O que faz no Solstice

KPI lê `higherIsBetter` do dicionário semântico. Tendência sobe + `higherIsBetter: true` → delta verde com ▲. Sobe + `higherIsBetter: false` (ex: inadimplência) → delta vermelho. `null` → cinza neutro.

### 🎯 Por que vale portar

Comunicação visual direta sem necessidade de legenda. Itaú: inadimplência subindo é VERMELHO (não verde como "subiu = bom"). Receita subindo é VERDE. Tudo automático via dicionário.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `Components.register({ id: 'kpi', ... })` | 3495-3540 |

### 🔗 Dependências

Dicionário Semântico (com `higherIsBetter` por coluna). Locale para formatação.

### 📝 Código fonte autônomo

```javascript
function renderKpi(host, { column, agg, values, dictionary, locale }){
  const dictCol = dictionary?.columns?.[column];
  const friendlyName = dictCol?.friendlyName || column;
  const higherIsBetter = dictCol?.higherIsBetter;
  const unit = dictCol?.unit || '';

  let value;
  if (agg === 'sum')      value = values.reduce((a,b) => a+b, 0);
  else if (agg === 'avg') value = values.reduce((a,b) => a+b, 0) / values.length;
  else if (agg === 'min') value = Math.min(...values);
  else if (agg === 'max') value = Math.max(...values);

  // Delta: 1ª metade vs 2ª metade como proxy de tendência
  const half = Math.floor(values.length / 2);
  const v1 = values.slice(0, half).reduce((a,b)=>a+b,0) / (half || 1);
  const v2 = values.slice(half).reduce((a,b)=>a+b,0) / ((values.length - half) || 1);
  const deltaPct = v1 ? ((v2 - v1) / Math.abs(v1)) * 100 : 0;

  const isUp = deltaPct > 0.1;
  const isDown = deltaPct < -0.1;
  // Verde se "bom" — sobe quando higherIsBetter, desce quando lowerIsBetter
  const goodDir = higherIsBetter === true ? isUp
                : higherIsBetter === false ? isDown
                : null;
  const cls = goodDir === true ? 'delta-up' : goodDir === false ? 'delta-down' : 'delta-neutral';
  const arrow = isUp ? '▲' : isDown ? '▼' : '→';

  host.innerHTML = `
    <div class="label">${friendlyName} ${unit ? '(' + unit + ')' : ''}</div>
    <div class="value">${locale.currency(value)}</div>
    <span class="delta ${cls}">${arrow} ${Math.abs(deltaPct).toFixed(1)}%</span>`;
}
```

```css
.delta-up      { color: #16A34A; background: rgba(74,222,128,.12); }
.delta-down    { color: #DC2626; background: rgba(248,113,113,.12); }
.delta-neutral { color: #94a3b8; background: #f1f5f9; }
```

### 🤖 Prompt para Eva

```
Eva, KPI cards com delta colorido respeitando higherIsBetter do dicionário.

Sem isso, "inadimplência +5%" aparece verde (subiu — mas é ruim!). Errado.

Com dicionário:
- higherIsBetter: true (receita, ROI) → subir = verde
- higherIsBetter: false (inadimplência, churn) → subir = vermelho
- null (média de espera — depende) → cinza

Referência:

[colar JS + CSS]

Adapte para nosso domínio. Certificar que cada coluna do nosso dicionário Itaú tem higherIsBetter declarado (puxar do Bloco 1 portabilidade).
```

### ⚠️ Pegadinhas

1. **`higherIsBetter: null`** ≠ `false`. Null = "depende de contexto" (ex: tempo médio de chamado — bom se baixo geralmente, mas alto pode indicar engajamento).
2. **Delta por proxy (1ª/2ª metade)** é heurística — substituir por período real quando filtros chegarem.
3. **Daltonismo**: verde/vermelho isolados são ruim para 5% da população. Adicionar ícone ▲/▼ resolve.

### ✅ Como testar

1. Coluna "receita" (higherIsBetter true), tendência sobe → verde ▲.
2. Coluna "dpd30" (higherIsBetter false), tendência sobe → vermelho ▲.
3. Coluna sem higherIsBetter → cinza →.

### 🔄 Variações

- **Período configurável**: input "comparar com últimos 30 dias" em vez de proxy.
- **Sparkline dentro da delta** mostrando os últimos 12 pontos.

---

## 🟡 FEATURE 5: Painel de Propriedades com abas (sidebar)

### 📖 O que faz no Solstice

Quando componente é selecionado, sidebar mostra painel com 4 abas (Dados / Visual / Decisões / Provenance). Cada aba renderiza campos específicos do tipo de componente. Mudanças disparam `Audit.record`.

### 🎯 Por que vale portar

Padrão clássico de editor visual. Itaú: configurador de qualquer widget complexo (alocação de carteira, regras de aprovação).

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeProps` | 3645-3815 |
| CSS | `.solstice__props-*` | ~970-1015 |

### 🔗 Dependências

Components registry, Audit (registrar mudanças), Modal (para diálogos).

### 📝 Código fonte autônomo (esqueleto)

```javascript
const Props = (function(){
  let selectedId = null;
  let activeTab = 'data';

  function select(slotId){
    selectedId = slotId;
    render();
  }
  function deselect(){
    selectedId = null;
    render();
  }

  function render(){
    const host = document.getElementById('props-panel');
    host.innerHTML = '';
    if (!selectedId){ host.classList.add('hidden'); return; }
    host.classList.remove('hidden');

    const slot = findSlot(selectedId);
    const def = Components.get(slot.type);

    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    ['data', 'visual', 'decisions', 'provenance'].forEach(id => {
      const t = document.createElement('div');
      t.className = 'tab' + (activeTab === id ? ' active' : '');
      t.textContent = id;
      t.onclick = () => { activeTab = id; render(); };
      tabs.appendChild(t);
    });
    host.appendChild(tabs);

    const content = document.createElement('div');
    if (activeTab === 'data') renderDataTab(content, slot, def);
    else if (activeTab === 'decisions') renderDecisionsTab(content, slot);
    // ...
    host.appendChild(content);
  }

  return { select, deselect };
})();
```

### 🤖 Prompt para Eva

```
Eva, painel lateral de propriedades para componentes selecionados.

Padrão: sidebar tem painel que muda conforme item selecionado.
Abas: Dados (config), Visual (cor/escala), Validação, Auditoria.

[colar JS + CSS]

Adicionar:
- Auto-save após N ms ou ao mudar de aba
- Validação inline (alertas se config inválida)
- Reset to default por aba
```

### ⚠️ Pegadinhas

1. **Subscribe a `canvas.sections`** — se slot removido, deselecionar automaticamente.
2. **Sidebar densa**: cuidado com espaço; em telas pequenas, virar drawer.
3. **Cada aba renderiza só quando ativa** — lazy render economiza performance.

### ✅ Como testar

1. Click em componente → painel aparece.
2. Trocar aba → conteúdo muda.
3. Mudar campo → componente re-renderiza com novo config.
4. Remover componente → painel desaparece.

### 🔄 Variações

- **Tabs verticais** em telas largas (sidebar mais larga).
- **Pin/unpin do painel** para mantê-lo aberto entre seleções.

---

## 🟢 FEATURE 6: Heatmap CSS em coluna numérica via `--heat-intensity`

### 📖 O que faz no Solstice

Cada `<td>` numérico tem `--heat-intensity: 0.0..0.4` via inline style baseado no valor normalizado. CSS `::before` projeta a cor accent com aquela opacidade sobre a célula. Zero JS de renderização.

### 🎯 Por que vale portar

Tabelas densas ganham contexto visual sem perder leitura. Itaú: tabelas de cobrança/inadimplência com mapa de calor por agência ou cliente.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `Components.register({ id: 'table' })` heat calc | 3600-3640 |
| CSS | `.is-heat::before` | ~875-885 |

### 🔗 Dependências

Nenhuma.

### 📝 Código fonte autônomo

```javascript
function renderHeatTable(host, rows, columns, types){
  const heats = {};
  for (const c of columns){
    if (types[c]?.group === 'numeric'){
      const vs = rows.map(r => parseFloat(r[c])).filter(v => !isNaN(v));
      if (vs.length) heats[c] = { min: Math.min(...vs), max: Math.max(...vs) };
    }
  }

  const html = `<table class="data-table">${columns.map(c => `<th>${c}</th>`).join('')}` +
    rows.map(r => '<tr>' + columns.map(c => {
      const v = r[c];
      const isNum = types[c]?.group === 'numeric';
      if (!isNum) return `<td>${v}</td>`;
      const heat = heats[c];
      const intensity = heat ? ((parseFloat(v) - heat.min) / (heat.max - heat.min || 1)) * 0.4 : 0;
      return `<td class="is-heat" style="--heat-intensity:${intensity.toFixed(2)}">${v}</td>`;
    }).join('') + '</tr>').join('') + '</table>';
  host.innerHTML = html;
}
```

```css
.data-table td.is-heat { position: relative; }
.data-table td.is-heat::before {
  content: ''; position: absolute; inset: 0;
  background: #2563EB; opacity: var(--heat-intensity, 0);
  pointer-events: none; z-index: 0;
}
.data-table td.is-heat > * { position: relative; z-index: 1; }
```

### 🤖 Prompt para Eva

```
Eva, heatmap CSS em tabelas numéricas — zero JS de renderização.

[colar JS + CSS]

Adapte:
- Paleta configurável por coluna (verde-vermelho para alguns, sequencial para outros)
- Normalização cross-table (todos os valores em todas as colunas) ou per-column
- Toggle on/off por coluna
```

### ⚠️ Pegadinhas

1. **Opacity acima de 0.5 dificulta leitura** — cap em 0.4.
2. **Filhos do td precisam de `position: relative; z-index: 1`** senão ficam embaixo do `::before`.
3. **Em tema dark**, `opacity * accent` pode ficar invisível se accent já é escuro. Ajustar paleta.

### ✅ Como testar

1. Tabela com coluna "receita" → maior valor mais escuro.
2. Coluna sem dados → sem heatmap.

### 🔄 Variações

- **Sequencial vs divergente**: vermelho-cinza-azul para colunas com 0 como pivô.

---

## 🟢 FEATURE 7: Picker de componente com `defaultConfig` contextual

### 📖 O que faz no Solstice

Slot vazio + click → Modal.select com lista de componentes. Após escolher, `defaultConfig(ctx)` é chamado com `{rows, columns, types, dictionary}` e gera config inicial inteligente (ex: KPI escolhe a primeira coluna numérica).

### 🎯 Por que vale portar

Reduz fricção. Usuário não precisa configurar manualmente após inserir. Itaú: adicionar widget já vem pré-configurado com dados disponíveis no contexto.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `Canvas._openComponentPicker` | 4980-5025 |

### 🔗 Dependências

Modal.select, Components registry.

### 📝 Código fonte autônomo

```javascript
async function openComponentPicker(slotId){
  const options = Components.list().map(c => ({
    value: c.id, label: c.name, icon: c.icon,
    desc: c.id, synonyms: [c.name]
  }));
  const choice = await Modal.select({
    title: 'Escolher componente',
    options,
    searchable: 'auto'
  });
  if (!choice) return;

  const def = Components.get(choice);
  const ctx = buildCtx();  // { rows, columns, types, dictionary }
  const config = def.defaultConfig ? def.defaultConfig(ctx) : {};

  updateSlot(slotId, { type: choice, config });
}
```

### 🤖 Prompt para Eva

```
Eva, picker de componente com config inicial contextual.

[colar JS]

Para cada componente, defaultConfig(ctx) deve gerar valor inicial sensato — não vazio.
Exemplo: KPI escolhe a primeira coluna numérica do dataset; série temporal escolhe a primeira temporal+numérica.

Adaptar para nosso conjunto de componentes.
```

### ⚠️ Pegadinhas

1. **`defaultConfig` precisa lidar com ctx incompleto** (dataset não carregado, sem colunas numéricas). Retornar `{}` é OK; render mostra mensagem.
2. **Modal.select searchable** já lida com 4+ opções.

### ✅ Como testar

1. Click slot vazio → modal aparece.
2. Escolher "KPI" → slot vira KPI com coluna padrão escolhida.

### 🔄 Variações

- **Recomendação inteligente**: ML sugere o componente mais provável para o dataset.

---

## 🟥 RESUMO DO BLOCO

### Features mais valiosas para portar primeiro

1. **🥇 Auditoria de Decisões (F1)** — compliance + debugging + suporte. Diferencial #1 do Solstice. Investir aqui é ROI claro.
2. **🥈 Registry plugável de componentes (F3)** — base extensível pra qualquer dashboard que precise crescer com novos tipos.
3. **🥉 KPI Card com `higherIsBetter` (F4)** — UX win imediato. Cor "certa" automaticamente.
4. **Provenance Trail (F2)** — fala diretamente com analista cético. "Esse número está correto, eis a cadeia".

### Features que NÃO vale portar isoladamente

- **Painel de Propriedades (F5)** — só vale com registry de componentes (F3).
- **Heatmap CSS (F6)** — só vale com tabela densa em uso ativo.
- **Picker (F7)** — só vale com registry (F3).

### Recomendação específica para projeto Itaú

**Para Eva/Itaú:**

1. **Adotar Audit como base de compliance** — todo MVP futuro do Itaú deveria registrar decisões importantes. Persistir em backend, integrar com SIEM.
2. **Registry de componentes** — começar com 3 componentes (KPI, Tabela, Série) e crescer conforme demanda. Permite que squads contribuam componentes próprios.
3. **`higherIsBetter` direcional** — auditar todas as métricas atuais e classificar (uma vez). Daí pra frente, todo KPI ganha cor "certa" automaticamente.
4. **Provenance Trail** — aplicar em métricas regulatórias primeiro (capital, RWA, inadimplência por safra). Auditor pode "ver de onde veio".

**Considerações específicas:**
- **LGPD**: `Audit.details` pode conter dados pessoais. Sanitizar em `record()` ou via interceptor.
- **Performance**: Audit em memória OK; backend POST para persistir.
- **Customização visual** dos componentes precisa de design system Itaú; mapear CSS vars adequadamente.

---

> Atualização r2: +2 features (SolsticeHumanize, Catálogo de Componentes).

---

## 🟢 FEATURE 8: SolsticeHumanize — strings técnicas → texto humano

### 📖 O que faz no Solstice

Módulo isolado que converte termos técnicos (`'sum'`, `'count'`, `'12.3'`, `'vlr_op_aprov'`) em texto pt-BR natural (`'Soma'`, `'Quantidade'`, `'▲ +12,3% acima do período anterior'`, `'Receita Mensal'`). **Regra firmada como ADR-039:** strings técnicas em JS; strings humanas SEMPRE via Humanize na UI.

### 🎯 Por que vale portar

Alto valor pro Itaú. Hoje a UI mostra `n=200`, `sum_revenue`, `0.05 (avg)` cru — quem não é dev fica perdido. Humanize centraliza tradução técnica→humano, ponto único de localização futura.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeHumanize` módulo | 5380-5440 |

### 🔗 Dependências

`SolsticeLocale` (para formatação numérica via Intl).

### 📝 Código fonte autônomo

```javascript
const Humanize = (function(){
  const AGG_LABELS = {
    sum:'Soma', avg:'Média', mean:'Média', count:'Quantidade',
    min:'Mínimo', max:'Máximo', median:'Mediana', stddev:'Desvio padrão'
  };

  function aggregation(op){
    return AGG_LABELS[String(op||'').toLowerCase()] || String(op||'');
  }

  function delta(pct, higherIsBetter){
    if (pct == null || isNaN(pct)) return { text:'Sem dados de comparação', color:'muted' };
    const abs = Math.abs(pct);
    if (abs < 1) return { text:'≈ Estável vs período anterior', color:'muted' };
    const up = pct > 0;
    const formatted = abs.toFixed(1).replace('.', ',');
    const text = (up ? '▲ +' : '▼ ') + formatted + '% ' + (up ? 'acima' : 'abaixo') + ' do período anterior';
    let color = 'muted';
    if (higherIsBetter === true)  color = up ? 'success' : 'error';
    else if (higherIsBetter === false) color = up ? 'error' : 'success';
    return { text, color };
  }

  function recordCount(n){
    if (n == null || isNaN(n)) return '— registros';
    n = Math.round(n);
    if (n >= 1_000_000){
      const m = n / 1_000_000;
      const fmt = (m % 1 === 0 ? m.toString() : m.toFixed(1).replace('.', ','));
      return fmt + (m === 1 ? ' milhão de registros' : ' milhões de registros');
    }
    if (n >= 1000) return n.toLocaleString('pt-BR') + ' registros';
    if (n === 1) return '1 registro';
    return n + ' registros';
  }

  function timeRange(rangeMs){
    if (!rangeMs || isNaN(rangeMs)) return '—';
    const days = rangeMs / 86_400_000;
    if (days < 1) return Math.round(rangeMs / 3_600_000) + ' horas';
    if (days < 31) return Math.round(days) + (Math.round(days) === 1 ? ' dia' : ' dias');
    const months = days / 30.44;
    if (months < 12) return Math.round(months) + (Math.round(months) === 1 ? ' mês' : ' meses');
    const years = days / 365.25;
    return years.toFixed(1).replace('.', ',') + (years === 1 ? ' ano' : ' anos');
  }

  function column(name, dict){
    if (!name) return '—';
    const c = dict?.columns?.[name];
    if (c?.friendlyName) return c.friendlyName;
    return String(name).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  return { aggregation, delta, recordCount, timeRange, column };
})();

// Uso:
Humanize.aggregation('sum');               // 'Soma'
Humanize.delta(12.3, true);                // { text: '▲ +12,3% acima do período anterior', color: 'success' }
Humanize.delta(-5.4, true);                // { text: '▼ -5,4% abaixo do período anterior', color: 'error' }
Humanize.recordCount(1_500_000);           // '1,5 milhões de registros'
Humanize.column('vlr_op_aprov', dict);     // 'Receita Mensal' (do dicionário)
```

### 🤖 Prompt para Eva

```
Eva, criar módulo de humanização de strings no projeto.

Hoje a UI mostra coisas técnicas: 'n=200', 'sum', 'avg_score', 'cliente_id'.
Quero centralizar tradução técnica → humana em pt-BR.

Referência:

[colar JS]

Adapte:
- Adicionar termos específicos do nosso domínio:
  - aggregation: incluir 'safra', 'cohort'
  - column: usar nosso dicionário (que já tem friendlyName Itaú)
  - novo método: account(number) → mascarado para LGPD
  - novo método: currency(value, currency) → "R$ 1,2 milhão", "US$ 3 mi"
- Localização futura (en-US, es-ES): mover labels para arquivo JSON

Aplicar em TODO lugar que mostra string técnica:
- Headers de tabela
- Tooltips
- Mensagens de log do usuário
- Exports CSV/PDF
- Toasts

Regra: strings técnicas em JS, strings humanas SEMPRE via Humanize na UI.
```

### ⚠️ Pegadinhas

1. **Esquecer Humanize em UI nova vira regressão silenciosa.** Adicionar lint regex contra `n=`, `=\d` e nomes de coluna sem `Humanize.column`.
2. **`recordCount` pluralização** é específica pt-BR. Outros locales precisam de versão própria (ou usar Intl.PluralRules).
3. **`delta` retorna chave semântica de cor**, não cor CSS hexa. CSS faz o mapeamento `--success` / `--error` / `--muted` via classe (ex: `.delta--success`).
4. **`column` com `dict.columns?.[name]`** depende do shape do dicionário ser estável.

### ✅ Como testar

```javascript
console.assert(Humanize.aggregation('sum') === 'Soma');
console.assert(Humanize.delta(0.3).color === 'muted');
console.assert(Humanize.delta(15, true).color === 'success');
console.assert(Humanize.delta(-15, true).color === 'error');
console.assert(Humanize.recordCount(1) === '1 registro');
console.assert(Humanize.recordCount(1_000_000) === '1 milhão de registros');
```

### 🔄 Variações

- **Localização**: `aggregation(op, locale='pt-BR')` aceitando 'en-US', 'es-ES'.
- **Customização por dicionário**: cada coluna pode declarar `humanize.delta` personalizado (ex: para taxa Selic, "alta de 0,25 ponto percentual").

---

## 🟢 FEATURE 9: Catálogo de Componentes dinâmico (sidebar)

### 📖 O que faz no Solstice

Aba "🧩 Componentes" da sidebar mostra um grid de cards, um por componente registrado em `Components.list()`. Click no card insere o componente no primeiro slot vazio do canvas — se não houver, cria nova seção. Lista cresce automaticamente conforme novos componentes são registrados.

### 🎯 Por que vale portar

Quando o produto vai escalar para 8+ componentes (B6 do Solstice), o picker via modal fica desconfortável. Catálogo na sidebar = sempre visível, scan rápido, click direto. Para o Itaú: squads que adicionarem componentes próprios via plugin terão visibilidade automática no catálogo.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeSidebarTabs._renderComponentsPanel` | 5450-5510 |
| JS | `SolsticeComponents.addByType` | 4760-4810 |
| CSS | `.solstice__cat-grid`, `.solstice__cat-card*` | 1100-1160 |

### 🔗 Dependências

Components registry, Modal/Toast, Store reativo, Audit (registrar adição).

### 📝 Código fonte autônomo

```javascript
function renderCatalog(host, components, dsReady){
  host.innerHTML = '';
  if (!dsReady){
    host.innerHTML = '<p>Importe um CSV primeiro para habilitar os componentes.</p>';
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'cat-grid';
  components.forEach(def => {
    const card = document.createElement('button');
    card.className = 'cat-card';
    card.onclick = () => addByType(def.id);
    card.innerHTML = `
      <div class="cat-card-icon">${def.icon}</div>
      <div class="cat-card-name">${def.name}</div>
      <div class="cat-card-desc">${def.description}</div>
      <div class="cat-card-add">+ Adicionar</div>`;
    grid.appendChild(card);
  });
  host.appendChild(grid);
}

function addByType(typeId){
  const def = Components.get(typeId);
  const ctx = buildCtx();
  const config = def.defaultConfig ? def.defaultConfig(ctx) : {};

  const sections = deepClone(Store.get('canvas.sections') || []);
  // Procura slot vazio
  for (const s of sections) for (const r of s.rows){
    const idx = r.slots.findIndex(sl => !sl.type || sl.type === 'empty');
    if (idx >= 0){
      r.slots[idx] = { ...r.slots[idx], type: typeId, config };
      Store.set('canvas.sections', sections);
      Toast.success(def.name + ' adicionado', 'Inserido em slot existente');
      return r.slots[idx].id;
    }
  }
  // Cria nova seção
  const newSlotId = uuid();
  sections.push({
    id: uuid(),
    title: def.name,
    rows: [{ id: uuid(), layout: '1col', slots: [{ id: newSlotId, type: typeId, config }] }]
  });
  Store.set('canvas.sections', sections);
  Toast.success(def.name + ' adicionado', 'Nova seção criada');
  return newSlotId;
}
```

```css
.cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cat-card { display: flex; flex-direction: column; padding: 12px; text-align: center;
  background: #fff; border: 1px solid #ddd; border-radius: 8px;
  cursor: pointer; transition: all 150ms; }
.cat-card:hover { border-color: #2563EB; box-shadow: 0 4px 12px rgba(0,0,0,.08); transform: translateY(-1px); }
.cat-card-icon { font-size: 24px; margin-bottom: 8px; }
.cat-card-name { font-weight: 600; margin-bottom: 4px; }
.cat-card-desc { font-size: 11px; color: #666; flex: 1; margin-bottom: 8px; }
.cat-card-add { padding: 4px 8px; background: #f5f5f5; border-radius: 4px; color: #2563EB; font-size: 11px; }
```

### 🤖 Prompt para Eva

```
Eva, catálogo de componentes/widgets na sidebar do projeto.

Antes: usuário escolhia widget via menu/dropdown.
Agora: catálogo SEMPRE visível, grid de cards na sidebar.

Click no card → adiciona ao primeiro slot vazio do dashboard.

Referência:

[colar JS + CSS]

Adapte:
- Categorias (se há 20+ widgets): agrupar por seção (KPIs / Tabelas / Gráficos / Análise)
- Pesquisar por nome se >15 items
- Drag-to-canvas como alternativa a click (B12 do Solstice)
- Estado desabilitado quando pré-requisito não está atendido (sem dataset, sem permissão, etc.)
```

### ⚠️ Pegadinhas

1. **Sem dataset, cards devem ficar disabled** (não tirar do DOM — mantém visibilidade do que existe).
2. **Re-render reativo**: subscribe a `dataset.ready` (habilita/desabilita) E a `Components.list()` mudanças (B6 adiciona componentes em runtime).
3. **Sidebar estreita** (<320px): grid colapsa para 1 coluna via media query.
4. **`addByType` cria nova seção** quando não há slot vazio — pode surpreender. Toast informa.
5. **Auto-scroll + auto-select** após inserir: timeout 80ms é necessário pra esperar Canvas re-renderizar antes de procurar o elemento.

### ✅ Como testar

1. Sem dataset: 4 cards aparecem cinza, click não faz nada (tooltip diz "Importe um CSV primeiro").
2. Carregar dummy: cards viram clicáveis.
3. Click em "KPI Card": insere no primeiro slot vazio. Toast confirma.
4. Sem slot vazio: nova seção é criada com o componente. Toast confirma.
5. Após inserir: canvas rola até o componente e abre o painel de propriedades.

### 🔄 Variações

- **Drag-to-canvas**: arrastar card sobre canvas — drop em slot vazio insere; drop em vazio cria seção.
- **Favoritos**: usuário marca componentes mais usados; sobem no catálogo.
- **Plugins externos**: outros squads adicionam componentes via `Components.register(...)` em scripts próprios — catálogo cresce.

---

> Atualização r4: +3 features (Compatibilidade estatística agregação↔baseline, Banner de dashboard com gradiente, Cor de texto automática por luminância WCAG).

---

## 🟡 FEATURE 14: Compatibilidade estatística agregação ↔ baseline

### 📖 O que faz no Solstice

`SolsticeKPI.AGG_COMPARISON_COMPAT` define quais baselines fazem sentido para cada agregação. UI mostra só compatíveis na lista principal; botão "+ Mais opções" expande incompatíveis com aviso + tooltip por opção via `incompatReason(agg, baselineType)`. Trocar agregação que invalide baseline atual dispara auto-switch para `previous-period` + toast + entrada no Audit.

### 🎯 Por que vale portar

Evita análise enganosa. Itaú: "Soma de exposição vs Média histórica" gera crescimento artificial (soma cresce com mais clientes; média histórica fica estática). Filtrar combinações ruins por default protege analistas júnior.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeKPI.AGG_COMPARISON_COMPAT`, `isCompatible`, `incompatReason` | ~3245-3300 |
| JS | `_renderComparisonTab` filtra + botão "+ Mais opções" | ~4060-4120 |
| JS | `_updateConfig` auto-switch | ~3825 |

### 🔗 Dependências

Toast (auto-switch info). Audit (registro).

### 📝 Código fonte autônomo

```javascript
const AGG_COMPARISON_COMPAT = {
  sum:    ['previous-period', 'fixed-target', 'first-value', 'last-value', 'none'],
  avg:    ['previous-period', 'fixed-target', 'historical-mean', 'first-value', 'last-value', 'none'],
  median: ['previous-period', 'fixed-target', 'historical-median', 'first-value', 'last-value', 'none'],
  count:  ['previous-period', 'fixed-target', 'none'],
  min:    ['previous-period', 'fixed-target', 'historical-mean', 'none'],
  max:    ['previous-period', 'fixed-target', 'historical-mean', 'none'],
  stddev: ['previous-period', 'fixed-target', 'historical-mean', 'none']
};

const INCOMPAT_REASON = {
  'sum:historical-mean': 'Soma cresce com mais dados; média histórica como baseline gera crescimento artificial.',
  'count:first-value':   'Comparar contagem total com o primeiro registro é geralmente irrelevante.',
  // ... outras combinações
};

function isCompatible(agg, baselineType){
  const ok = AGG_COMPARISON_COMPAT[agg.toLowerCase()];
  return !ok || ok.includes(baselineType);
}

// No render da tab Comparação:
const compatible   = listTypes().filter(t => isCompatible(currentAgg, t.value));
const incompatible = listTypes().filter(t => !isCompatible(currentAgg, t.value));
compatible.forEach(t => renderRadio(t, false));
if (incompatible.length){
  const moreBtn = button('+ Mais opções (' + incompatible.length + ')');
  moreBtn.onclick = () => expandIncompatible(incompatible);
}
```

### 🤖 Prompt para Eva

```
Eva, validar combinações estatísticas em dashboards de KPI.

Implementar mapa de compatibilidade + UI que filtre opções inválidas.
Permitir "modo avançado" para combinações específicas com aviso.

Referência:

[colar JS]

Adapte para nossas agregações:
- Adicionar: 'cumulative', 'weighted-avg' (peso por exposição)
- Mapa específico Itaú: discutir com time de risco
- Tooltips em pt-BR técnico para analistas de risco
- Auditoria: registrar quando usuário força incompatível (compliance)
```

### ⚠️ Pegadinhas

1. **Mapa é opinião estatística** — discutir antes de finalizar
2. **Auto-switch transparente** ao trocar agregação: toast informativo evita sensação de bug
3. **Casos de borda**: alguns analistas têm justificativa legítima para forçar incompatível (`stddev vs same-period-last-year` pode ser válido em estudos de volatilidade ano-sobre-ano)

### ✅ Como testar

1. Agregação "Soma" → "Média histórica" some da lista principal
2. Clicar "+ Mais opções" → aparece com ⚠️
3. Hover → tooltip explica motivo
4. Trocar agregação para "Média" → opção volta para lista principal

### 🔄 Variações

- **Mapa configurável**: analista sênior adiciona exceções aprovadas
- **Aprendizado**: se usuário força combinação 10x sem reverter, sugerir adicionar ao mapa

---

## 🟡 FEATURE 15: Banner de dashboard com gradiente customizável

### 📖 O que faz no Solstice

Banner no topo do canvas com título + subtítulo + data dinâmica. Configurável via modal (gradient cor inicial + final + 8 direções; data hoje/fixa/coluna; altura compact/standard/tall; cor texto auto ou hex). Preview ao vivo. Persiste em `Store.canvas.header`. Auto-sugestão de título ao importar CSV.

### 🎯 Por que vale portar

Dashboards profissionais abrem com banner contextual. Itaú: relatórios executivos podem ter "Carteira PJ · atualizado em 17/05/2026" com gradiente cor-da-marca, sem CSS custom por dashboard.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeDashHeader` módulo | ~3200-3500 |
| CSS | `.solstice__dash-header*` | ~770-900 |

### 🔗 Dependências

Modal, Locale (data), Store (persistência), Toast (auto-sugestão).

### 📝 Código fonte autônomo

```javascript
const DashHeader = (function(){
  const DEFAULT = {
    enabled: false,
    title: 'Dashboard sem título',
    subtitle: '',
    showDate: true,
    dateMode: 'today',         // 'today' | 'fixed' | 'column'
    gradient: { from: '#003D7A', to: '#FF6B00', direction: 'to right' },
    textColor: 'auto-white',
    height: 'compact'
  };

  function get(){ return { ...DEFAULT, ...(Store.get('canvas.header') || {}) }; }
  function set(patch){ Store.set('canvas.header', { ...get(), ...patch }); }

  function buildEl(cfg){
    const textColor = cfg.textColor.startsWith('#') ? cfg.textColor : autoTextColor(cfg.gradient.from, cfg.gradient.to);
    const gradient = cfg.gradient.direction === 'radial'
      ? `radial-gradient(circle, ${cfg.gradient.from}, ${cfg.gradient.to})`
      : `linear-gradient(${cfg.gradient.direction}, ${cfg.gradient.from}, ${cfg.gradient.to})`;
    const el = document.createElement('div');
    el.className = `dash-header dash-header--${cfg.height}`;
    el.style.cssText = `background:${gradient};color:${textColor};padding:24px;border-radius:12px;margin-bottom:16px;`;
    el.innerHTML = `<h2 style="margin:0">${escapeHtml(cfg.title)}</h2>${cfg.subtitle ? `<div style="opacity:.85;margin-top:4px;">${escapeHtml(buildSubtitleText(cfg))}</div>` : ''}`;
    return el;
  }

  function renderInto(canvasEl){
    const cfg = get();
    if (!cfg.enabled) return;
    canvasEl.appendChild(buildEl(cfg));
  }

  return { get, set, buildEl, renderInto };
})();
```

### 🤖 Prompt para Eva

```
Eva, banner de cabeçalho customizável no topo do dashboard.

Configurável: título, subtítulo, data dinâmica (hoje / fixa / coluna),
gradiente (cor inicial + final + 8 direções), altura, cor texto auto/custom.

Referência:

[colar JS + CSS]

Adapte:
- Cores Itaú: input "preset" com paletas Itaú (PF, PJ, Premium)
- Logo: input opcional de URL ou upload
- Tagline: campo adicional abaixo do subtítulo
- Tipografia: opção Itaú Sans Display
```

### ⚠️ Pegadinhas

1. **`radial-gradient` ignora direção**: tratar como caso separado
2. **Texto longo com gradient** pode ficar ilegível em faixas de transição — testar contraste
3. **Mobile**: banner 180px ocupa muito espaço — collapse em <768px
4. **Snapshots futuros** precisam serializar `canvas.header` inteiro

### ✅ Como testar

1. Gradient azul→laranja → texto branco automático
2. Gradient verde-claro→amarelo → texto preto automático
3. Forçar custom ciano → mantém ciano
4. dateMode='column' + coluna `data_op` → mostra "atualizado em {max data}"

### 🔄 Variações

- **Multi-banner**: header por seção do dashboard
- **Logo embutido**: SVG no canto via `background-image` adicional
- **Animado**: ondas SVG no fundo

---

## 🟢 FEATURE 16: Cor de texto automática por luminância WCAG

### 📖 O que faz no Solstice

`autoTextColor(fromHex, toHex)` calcula luminância sRGB linearizada (WCAG 2.1) das duas cores, faz média, retorna `'#FFFFFF'` se média < 0.5, `'#000000'` caso contrário. Garante contraste mínimo sem o usuário pensar.

### 🎯 Por que vale portar

Qualquer feature com texto sobre fundo colorido precisa disso. Itaú: badges de status, headers customizáveis, gráficos com fundo colorido — sempre legíveis sem decisão manual.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeDashHeader.autoTextColor` | ~3260-3275 |

### 🔗 Dependências

Nenhuma.

### 📝 Código fonte autônomo

```javascript
function autoTextColor(fromHex, toHex){
  function luminance(hex){
    const h = String(hex || '').replace('#', '');
    const safe = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const m = safe.match(/.{2}/g);
    if (!m || m.length < 3) return 0.5;
    const [r, g, b] = m.map(x => {
      let v = parseInt(x, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const avg = (luminance(fromHex) + luminance(toHex)) / 2;
  return avg < 0.5 ? '#FFFFFF' : '#000000';
}

// Uso:
autoTextColor('#003D7A', '#FF6B00');  // gradient escuro → claro → '#FFFFFF'
autoTextColor('#FFFFFF', '#F0F0F0');  // gradient claro/claro → '#000000'
autoTextColor('#fff', '#000');        // boundary → calcula corretamente
```

### 🤖 Prompt para Eva

```
Eva, função utilitária: cor de texto automática por luminância WCAG.

Para qualquer feature com texto sobre fundo colorido.

Referência:

[colar JS]

Aplicar em:
- Badges de status (verde/amarelo/vermelho) — texto auto
- Headers customizáveis
- Tags de categoria coloridas
- Botões de cor variável

Adicionar testes unitários: cores extremas (preto/branco), cinza médio
(boundary), formatos curtos #fff.
```

### ⚠️ Pegadinhas

1. **WCAG 2.1 vs APCA**: WCAG é mais antigo mas universalmente aceito; APCA é mais preciso mas ainda em draft. Usar WCAG por compatibilidade
2. **Hex de 3 dígitos** (`#fff`) precisa expansão para 6 antes do match
3. **Threshold 0.5 é heurístico**: WCAG recomenda contrast ratio 4.5:1 (texto normal). 0.5 simplifica para preto/branco mas não garante 4.5:1
4. **Não substitui validação real**: para garantir contraste mínimo, calcular ratio explícito

### ✅ Como testar

```javascript
console.assert(autoTextColor('#000000', '#000000') === '#FFFFFF');
console.assert(autoTextColor('#FFFFFF', '#FFFFFF') === '#000000');
console.assert(autoTextColor('#003D7A', '#FF6B00') === '#FFFFFF');
console.assert(autoTextColor('#fff', '#f0f0f0') === '#000000');
```

### 🔄 Variações

- **3 níveis**: claro / médio / escuro
- **Design system pareado**: retorna `--color-text-on-dark` / `--color-text-on-light` em vez de preto/branco puros
- **Contrast ratio explícito**: retorna tupla `(texto, ratio)` para validação

---

## 🟢 FEATURE 10: Sistema de tabs com isolamento total entre painéis

### 📖 O que faz no Solstice

Sidebar tem 2 abas (`Dados`, `Componentes`). Cada aba controla **quais painéis ficam visíveis**, sem mistura: aba Dados → só editor de colunas; aba Componentes → catálogo + propriedades. Estado da aba ativa persiste em `Store.ui.activeTab`.

### 🎯 Por que vale portar

Padrão de "área de trabalho contextual": cada modo expõe ferramentas próprias sem poluição visual. Itaú: aba "Carteira" mostra exposição/risco; aba "Operações" mostra fluxo transacional — sem confusão entre modos.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeSidebarTabs.activate` | ~5570 |
| HTML | tabs + 3 painéis na sidebar | ~1560 |

### 🔗 Dependências

Store reativo (para persistir `ui.activeTab`).

### 📝 Código fonte autônomo

```javascript
const Tabs = (function(){
  let active = 'a';
  function activate(which){
    active = which;
    Store.set('ui.activeTab', which);
    document.querySelectorAll('[data-tab]').forEach(el => {
      el.classList.toggle('is-active', el.dataset.tab === which);
    });
    document.querySelectorAll('[data-panel]').forEach(el => {
      const condition = el.dataset.panelFor === which;
      el.classList.toggle('hidden', !condition);
    });
  }
  function init(){
    document.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', () => activate(el.dataset.tab));
    });
    activate(Store.get('ui.activeTab') || 'a');
  }
  return { activate, init, current: () => active };
})();
```

### 🤖 Prompt para Eva

```
Eva, sistema de abas com painéis mutuamente exclusivos no sidebar.

Regra: cada aba mostra UM conjunto de painéis. Sem mistura entre abas.

Aplicar em:
- Painel lateral do dashboard
- Sidebar de detalhes de cliente (visão financeira / visão risco / visão histórico)
- Wizard multi-step

Persistir aba ativa em store reativo.

Referência:

[colar JS]
```

### ⚠️ Pegadinhas

1. **Auto-switch on action**: alguns fluxos exigem trocar aba ao executar ação (ex: clicar componente → aba Componentes). Decidir caso a caso.
2. **Painéis condicionalmente visíveis** dentro de uma aba (ex: props só se há seleção): combinar isolamento com regras extras.

### ✅ Como testar

1. Click em cada aba → painéis trocam visibilidade
2. F5 → aba ativa persiste

### 🔄 Variações

- **Mais de 2 abas**: lidar com overflow horizontal
- **Lazy-load**: renderizar aba só na primeira ativação

---

## 🟡 FEATURE 11: Comparação configurável de KPI (8 tipos)

### 📖 O que faz no Solstice

`SolsticeKPI.calculateDelta(values, config)` retorna `{ pct, baseline, baselineLabel, direction }` para 8 tipos de comparação: período anterior, mesmo período do ano passado, meta fixa, média histórica, mediana histórica, primeiro valor, último valor, sem comparação. UI: aba "Comparação" no Props com radio buttons + sub-campos condicionais.

### 🎯 Por que vale portar

Itaú: cada KPI tem narrativa diferente — receita compara contra meta orçamentária; inadimplência compara contra histórico; capital compara contra meta regulatória. Solução configurável evita hardcode.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `SolsticeKPI` módulo | ~3210 |
| JS | `Props._renderComparisonTab` | ~3830 |

### 🔗 Dependências

`Humanize.delta(pct, higherIsBetter, baselineLabel)` — com label livre.

### 📝 Código fonte autônomo

```javascript
const KPI = (function(){
  const TYPES = [
    'previous-period', 'same-period-last-year', 'fixed-target',
    'historical-mean', 'historical-median', 'first-value', 'last-value', 'none'
  ];

  function aggregate(values, op){
    if (op === 'sum')    return values.reduce((a,b)=>a+b, 0);
    if (op === 'avg')    return values.reduce((a,b)=>a+b, 0) / values.length;
    if (op === 'median') { const s = values.slice().sort((a,b)=>a-b); const m = Math.floor(s.length/2);
                           return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2; }
    return values.reduce((a,b)=>a+b, 0);
  }

  function calculateDelta(values, config){
    if (!values.length) return null;
    const comp = config.comparison || { type:'previous-period' };
    const current = aggregate(values, config.agg || 'sum');
    let baseline, label;
    switch (comp.type){
      case 'none': return null;
      case 'previous-period':
        if (values.length < 4) return null;
        const half = Math.floor(values.length / 2);
        baseline = aggregate(values.slice(0, half), config.agg);
        label = 'período anterior';
        break;
      case 'fixed-target':
        baseline = parseFloat(comp.targetValue);
        label = comp.targetLabel || 'meta';
        break;
      case 'historical-mean':
        baseline = aggregate(values, 'avg');
        label = 'média histórica';
        break;
      // ... outros tipos
    }
    if (baseline == null || isNaN(baseline)) return null;
    const pct = baseline !== 0 ? ((current - baseline) / Math.abs(baseline)) * 100 : 0;
    return { pct, baseline, baselineLabel: label, direction: pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat' };
  }

  return { calculateDelta, TYPES };
})();
```

### 🤖 Prompt para Eva

```
Eva, comparação configurável em KPIs (Solstice tem 8 tipos).

Cada KPI tem narrativa própria. Hardcode "vs período anterior" não serve:
- Receita → meta orçamentária do trimestre
- Inadimplência → mesmo mês do ano passado (sazonalidade)
- Capital → meta regulatória (BACEN)
- NPS → média histórica

Referência:

[colar JS]

Adapte:
- Adicionar tipos específicos do Itaú: "meta regulatória" (busca em API interna), "compromisso ANEFAC", "média setorial"
- Filtros de período (B9 do Solstice) integrar com 'previous-period'
- Aba dedicada no editor de propriedades de KPI
```

### ⚠️ Pegadinhas

1. **`baseline === 0` causa divisão por zero** — sempre verificar.
2. **`baselineLabel` vai literalmente para a UI** — usar substantivos (meta, média, ano passado), não chaves técnicas.
3. **`same-period-last-year` é aproximação** sem coluna temporal real — documentar.

### ✅ Como testar

```javascript
const values = [100, 110, 120, 130];
calculateDelta(values, { agg:'avg', comparison:{ type:'previous-period' }});
// → { pct: ~24, baseline: 105, baselineLabel: 'período anterior', direction: 'up' }

calculateDelta(values, { agg:'sum', comparison:{ type:'fixed-target', targetValue: 400, targetLabel: 'meta trimestre' }});
// → { pct: 15, baseline: 400, baselineLabel: 'meta trimestre', direction: 'up' }
```

### 🔄 Variações

- **Multi-baseline**: comparar contra 2 baselines simultaneamente (vs meta E vs ano passado).
- **Threshold alerta**: configurar limite que vira badge ⚠️.

---

## 🟢 FEATURE 12: Modal.confirm com skipKey (silenciamento por perfil)

### 📖 O que foi no Solstice

`Modal.confirm({ skipKey: 'remove-component' })`. Quando `skipKey` está silenciada em `localStorage` por perfil, retorna `true` direto. Senão, modal mostra checkbox "Não perguntar mais". Modal de Preferências (botão 👤 do header) lista chaves silenciadas e permite reativar.

### 🎯 Por que vale portar

Ações destrutivas exigem confirmação por segurança, mas confirmação repetida vira fricção. Solução: usuário decide quando silenciar, sempre tem como reverter.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `Modal.confirm` com `skipKey` | ~2810 |
| JS | `_openProfilePreferences` | ~2620 |

### 🔗 Dependências

`localStorage`. Conceito de perfil ativo.

### 📝 Código fonte autônomo

```javascript
function confirm({ title, message, danger, skipKey }){
  const storageKey = `app.${currentProfileId()}.skipConfirm.${skipKey}`;

  if (skipKey && localStorage.getItem(storageKey) === 'true'){
    return Promise.resolve(true);
  }

  return new Promise(resolve => {
    let skipChecked = false;
    const modal = renderModal({
      title, message, danger,
      extra: skipKey ? checkbox('Não perguntar mais sobre isso', (v) => skipChecked = v) : null,
      onConfirm: () => {
        if (skipKey && skipChecked) localStorage.setItem(storageKey, 'true');
        resolve(true);
      },
      onCancel: () => resolve(false)
    });
  });
}
```

### 🤖 Prompt para Eva

```
Eva, confirmações destrutivas silenciáveis por perfil/usuário.

Padrão: ação destrutiva → modal com checkbox "Não perguntar mais".
Modal de preferências reativa.

Persistência por perfil/usuário em backend (não localStorage, pra compliance).

Referência:

[colar JS]

Aplicar em:
- Remover cliente
- Cancelar operação
- Limpar histórico

Auditoria intacta: action.record continua mesmo com modal silenciado.
```

### ⚠️ Pegadinhas

1. **Backend de produção, não localStorage**: pra compliance Itaú, preferência precisa persistir cross-device + LGPD.
2. **`Audit.record` continua disparando** mesmo quando modal é pulado — segurança forense intacta.
3. **Sem reversão fácil = desastre**: sempre dar caminho para "voltar a perguntar" (Menu de Preferências).

### ✅ Como testar

1. Modal aparece → marcar checkbox → confirmar → próxima vez não aparece
2. Menu de Preferências → reativar → modal volta a aparecer

### 🔄 Variações

- **Timeout do silêncio**: "Não perguntar pelas próximas 24h" (vs permanente)
- **Por categoria**: silenciar grupo "operações financeiras" inteiro

---

## 🟢 FEATURE 13: Toast com botão de ação (Desfazer inline)

### 📖 O que faz no Solstice

`Toast.action({ actionLabel: 'Desfazer', actionFn: () => Undo.undo() })`. Toast com botão clicável inline. Pareado com Undo/Redo do Bloco 4. Compensa redução de fricção quando confirmações estão silenciadas.

### 🎯 Por que vale portar

Padrão "soft delete" sem precisar de modal de confirmação. Itaú: cancelar transação → toast "Cancelada · Desfazer" por 5s.

### 📍 Localização

| Tipo | Localização | Linhas aprox |
|---|---|---|
| JS | `Toast.action` | ~2270 |
| CSS | `.solstice__toast-action` | ~470 |

### 🔗 Dependências

Sistema de Undo (para callback significativo).

### 📝 Código fonte autônomo

```javascript
function toastAction({ title, msg, actionLabel, actionFn, duration = 5000 }){
  const t = document.createElement('div');
  t.className = 'toast toast--warn';
  t.innerHTML = `<div class="toast-body"><strong>${title}</strong>${msg ? `<small>${msg}</small>` : ''}</div>`;
  const btn = document.createElement('button');
  btn.className = 'toast-action';
  btn.textContent = actionLabel;
  btn.onclick = () => { try { actionFn(); } finally { dismiss(); } };
  t.appendChild(btn);
  document.getElementById('toasts').appendChild(t);

  let dismissed = false;
  function dismiss(){ if (!dismissed){ dismissed = true; t.style.opacity = 0; setTimeout(() => t.remove(), 250); } }
  setTimeout(dismiss, duration);
}
```

### 🤖 Prompt para Eva

```
Eva, toast com botão de ação inline.

Padrão: ação destrutiva → toast com botão "Desfazer" por 5s.

Aplicar em:
- Cancelar transação → "Cancelada · Reverter"
- Excluir cliente → "Excluído · Restaurar"
- Limpar filtros → "Filtros limpos · Restaurar"

Importante: actionFn deve realmente desfazer (não só esconder toast).
Pareado com Ctrl+Z global se houver.

Referência:

[colar JS]
```

### ⚠️ Pegadinhas

1. **Duration muito curto** = usuário não vê. 5s mínimo.
2. **actionFn nunca null** — pelo menos `() => console.log('no-op')`.
3. **Toast empilhado**: 5 toasts simultâneos vira ruído. Limitar a 3.

### ✅ Como testar

1. Remover componente → toast com botão Desfazer aparece
2. Clicar Desfazer dentro de 5s → componente volta

### 🔄 Variações

- **Toast com múltiplas ações**: 2 botões (Desfazer + Detalhes).
- **Toast persistente** (sem auto-dismiss): para ações críticas que exigem reconhecimento.

---

> Documento atualizado no Patch B5-r4. Linhas aproximadas. Comando: `PORTABILIDADE BLOCO 5` regenera com linhas atuais.
