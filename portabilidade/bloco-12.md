# PORTABILIDADE — Bloco 12: 5 Modos + Slides + Apresentador + Command Palette + Tour + Polish

> Features power user. Joias do bloco: Command Palette (Ctrl+K) e Tour interativo. Modo Slides/Apresentador secundários.

---

## 📋 ÍNDICE

| # | Feature | Complexidade | Tempo | Dependências |
|---|---------|--------------|-------|--------------|
| 1 | Sistema de 5 modos via data-mode | 🟢 Simples | 2h | nenhuma |
| 2 | Modo Slides (section = slide) | 🟡 Média | 4h | Components/Canvas |
| 3 | Modo Apresentador dual-pane | 🟡 Média | 4-6h | section.notes (futuro) |
| 4 | Command Palette Ctrl+K com fuzzy match | 🟡 Média | 4-5h | catálogo de ações |
| 5 | Tour interativo spotlight + tooltip | 🟡 Média | 4-5h | clip-path CSS |
| 6 | LTTB downsampling | 🟢 Simples | 1h | nenhuma |
| 7 | Polish a11y (focus-visible) | 🟢 Simples | 30min | CSS |

---

## 🟡 FEATURE 4: Command Palette Ctrl+K com fuzzy match

### 📖 O que faz

Modal estilo Spotlight/Linear/Slack. Lista comandos categorizados, fuzzy search, ↑↓ navega, Enter executa.

### 🎯 Por que vale portar

**Padrão obrigatório em apps modernos.** Power users economizam segundos por ação; iniciantes descobrem features.

### 📝 Padrão essencial

```javascript
const COMMANDS = [
  { id:'save', label:'Salvar projeto', icon:'💾', category:'Arquivo', kbd:'Ctrl+S',
    syn:'guardar persistir', run: () => save() },
  { id:'theme-dark', label:'Tema escuro', icon:'🌙', category:'Tema',
    syn:'dark mode', run: () => setTheme('dark') },
  // ... 30+
];

function fuzzyScore(query, str) {
  const q = query.toLowerCase();
  const s = (str || '').toLowerCase();
  if (s.includes(q)) return 100;  // substring = boost
  let qi = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) qi++;
  }
  return qi === q.length ? 50 - (s.length - q.length) * 0.1 : 0;
}

function filterCommands(query) {
  if (!query) return COMMANDS;
  return COMMANDS
    .map(c => ({ c, score: fuzzyScore(query, c.label + ' ' + (c.syn || '')) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.c);
}

// Modal: input + lista + setas + Enter
// Ctrl+K abre/fecha (toggle)
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
  }
});
```

### 🤖 Prompt para Eva

```
Eva, preciso de Command Palette (Ctrl+K) padrão Linear/Notion no nosso dashboard.

Catálogo:
- 30+ comandos: salvar, exportar, mudar tema, criar componente, abrir filtros, etc.
- Cada comando: {id, label, category, icon, run, kbd?, syn?}

Fuzzy match:
- Substring (label inclui query) = score 100
- Char-order match = score 50 - penalty
- Sinônimos via syn field

UI:
- Overlay com backdrop blur
- Input focado automaticamente
- Lista com ↑↓ navegação, Enter executa
- Mostra kbd hint à direita (Ctrl+S, etc.)

[colar código acima]

Adapta para nosso stack: React/Vue/<descrever>. Catálogo deve ser declarativo.
```

### ⚠️ Pegadinhas

1. **Preventdefault em Ctrl+K** — browser pode ter shortcut próprio
2. **Não interceptar em inputs** — usuário não consegue digitar 'k' em campos
3. **Sinônimos pt-BR + en** — "dark mode" e "tema escuro" devem encontrar a mesma coisa
4. **Performance:** para 200+ comandos, debounce do input + memoize do filter

---

## 🟡 FEATURE 5: Tour interativo spotlight + tooltip

### 📝 Padrão essencial (CSS clip-path)

```css
.tour-mask {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.65);
  transition: clip-path 300ms ease;
}
```

```javascript
function renderTourStep(step) {
  const target = document.querySelector(step.selector);
  const rect = target.getBoundingClientRect();
  const pad = 8;

  // "Buraco" no overlay via clip-path polygon
  const clip = `polygon(
    0 0, 100% 0, 100% 100%, 0 100%, 0 0,
    ${rect.left - pad}px ${rect.top - pad}px,
    ${rect.left - pad}px ${rect.bottom + pad}px,
    ${rect.right + pad}px ${rect.bottom + pad}px,
    ${rect.right + pad}px ${rect.top - pad}px,
    ${rect.left - pad}px ${rect.top - pad}px
  )`;
  mask.style.clipPath = clip;

  // Tooltip dinâmico (abaixo, ou em cima se sem espaço)
  let top = rect.bottom + pad + 8;
  if (top + 200 > window.innerHeight) top = rect.top - 200 - pad;
  let left = Math.max(16, Math.min(window.innerWidth - 336, rect.left));
  tooltip.style.top = top + 'px';
  tooltip.style.left = left + 'px';
}
```

### ⚠️ Pegadinhas

1. **Target não visível** → scroll programaticamente antes do step
2. **clip-path long polygon** pode pesar mobile fraco — alternativa: SVG mask
3. **Resize do viewport** — re-calcular posições

---

## 🟢 FEATURE 6: LTTB downsampling

```javascript
function lttb(points, threshold) {
  const n = points.length;
  if (threshold >= n || threshold < 3) return points.slice();
  const bucketSize = (n - 2) / (threshold - 2);
  const sampled = [points[0]];
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(n, Math.floor((i + 2) * bucketSize) + 1);
    let avgX = 0, avgY = 0;
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += points[j][0]; avgY += points[j][1];
    }
    avgX /= (avgRangeEnd - avgRangeStart);
    avgY /= (avgRangeEnd - avgRangeStart);

    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;
    let maxArea = -1, maxAreaIdx = rangeOffs;
    for (let j = rangeOffs; j < rangeTo; j++) {
      const area = Math.abs(
        (points[a][0] - avgX) * (points[j][1] - points[a][1]) -
        (points[a][0] - points[j][0]) * (avgY - points[a][1])
      );
      if (area > maxArea) { maxArea = area; maxAreaIdx = j; }
    }
    sampled.push(points[maxAreaIdx]);
    a = maxAreaIdx;
  }
  sampled.push(points[n - 1]);
  return sampled;
}
```

**Uso:** `chart.render(lttb(rawPoints, 500))` em vez de `chart.render(rawPoints)` quando rawPoints > 1000.

---

## 🟥 RESUMO DO BLOCO

### Mais valiosas para Itaú via Eva

1. **🟡 Command Palette** (Feature 4) — produtividade absurda em uso diário
2. **🟡 Tour interativo** (Feature 5) — onboarding de usuários novos
3. **🟡 Modo Slides + Apresentador** (Features 2-3) — apresentar dashboards em reuniões

### Sequência sugerida (3 sprints)

1. Sprint 1: Command Palette (Feature 4) + LTTB (Feature 6)
2. Sprint 2: Tour interativo (Feature 5)
3. Sprint 3: Modos Slides + Apresentador (Features 2-3)

**ROI estimado:** 15-19h. Em troca: dashboard com UX padrão SaaS moderno (Linear/Notion/Figma).
