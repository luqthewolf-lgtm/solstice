  // Inicializa IMEDIATAMENTE (antes de outros módulos) pra capturar erros do próprio boot
  try { SolsticeErrorBoundary.init(); } catch(e){ console.warn('[ErrorBoundary] init falhou', e); }

  /* ============================================================
     SolsticeUtils — helpers gerais
     Por que existe: evitar reimplementar uuid/debounce/el em todo módulo.
     ============================================================ */
  const SolsticeUtils = (function(){
    function uuid(){
      // RFC4122 v4 simplificado — suficiente para IDs de componente em-memória.
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
        const r = Math.random()*16|0, v = c==='x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    }

    function debounce(fn, ms){
      let t;
      return function(){
        const ctx = this, args = arguments;
        clearTimeout(t);
        t = setTimeout(()=> fn.apply(ctx, args), ms);
      };
    }

    function throttle(fn, ms){
      let last = 0, t;
      return function(){
        const now = Date.now(), ctx = this, args = arguments;
        if (now - last >= ms){
          last = now; fn.apply(ctx, args);
        } else {
          clearTimeout(t);
          t = setTimeout(()=>{ last = Date.now(); fn.apply(ctx, args); }, ms - (now - last));
        }
      };
    }

    /**
     * B3-01 (v6-autonomous / RT-03 — Roberto/perf): throttle baseado em rAF.
     * Garante no máximo 1 chamada por frame (~16ms a 60fps), nunca empilha.
     * Ideal para scroll/resize/mousemove handlers — substitui debounce/throttle
     * por algo afinado ao tempo de paint do browser.
     *
     * Uso:
     *   const onScroll = SolsticeUtils.rafThrottle(() => {...});
     *   window.addEventListener('scroll', onScroll);
     */
    function rafThrottle(fn){
      let scheduled = false;
      let lastArgs = null, lastCtx = null;
      return function(){
        lastArgs = arguments;
        lastCtx = this;
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          try { fn.apply(lastCtx, lastArgs); } catch(e){ console.warn('[rafThrottle]', e); }
        });
      };
    }

    function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

    function deepClone(o){
      if (o === null || typeof o !== 'object') return o;
      if (o instanceof Date) return new Date(o);
      if (Array.isArray(o)) return o.map(deepClone);
      const out = {};
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = deepClone(o[k]);
      return out;
    }

    function hash(str){
      // FNV-1a 32-bit — rápido e determinístico, suficiente para cache key.
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++){
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return (h >>> 0).toString(16);
    }

    /** Seeded PRNG (Mulberry32) — usado pelo SolsticeDummy para gerar CSVs determinísticos. */
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

    function qs(sel, root){ return (root||document).querySelector(sel); }
    function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }

    /** Cria elemento com atributos e filhos — substituto vanilla mínimo de JSX. */
    function el(tag, attrs, ...kids){
      const node = document.createElement(tag);
      if (attrs){
        for (const k in attrs){
          const v = attrs[k];
          if (v == null || v === false) continue;
          if (k === 'class' || k === 'className') node.className = v;
          else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
          else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
          else if (k === 'dataset') for (const d in v) node.dataset[d] = v[d];
          else node.setAttribute(k, v === true ? '' : v);
        }
      }
      kids.flat().forEach(k => {
        if (k == null || k === false) return;
        node.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
      });
      return node;
    }

    function on(target, ev, fn, opts){
      target.addEventListener(ev, fn, opts);
      return () => target.removeEventListener(ev, fn, opts);
    }

    function fire(name, detail){
      window.dispatchEvent(new CustomEvent('solstice:'+name, { detail }));
    }

    // Auditoria 2026 (HV-02): decisão = ADOTAR. escapeHtml é o helper de
    // referência para qualquer ponto que precise manter innerHTML mas tenha
    // dado dinâmico. O caminho preferido continua sendo textContent/el() —
    // ver política de DOM seguro no topo do arquivo.
    function escapeHtml(s){
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    /* attachScrollChain removido na Camada 1 (ADR-158).
       Substituído por sticky genuíno do shell: sidebar/inspector têm overflow
       próprio, canvas é o único scroller. Não há mais "scroll trap" possível
       porque cada painel rola independente. Home/End globais foram preservados. */

    // Auditoria 2026 (R-13 / A-403 / HV-02 / MC-01): helpers de cleanup de listeners.
    // Antes: 165 addEventListener vs 18 removeEventListener (razão 9:1).
    // Quando slot saía do DOM, listeners no document/window ficavam órfãos.
    // Decisão da auditoria 2026 = ADOTAR como convenção. cleanupListeners(host)
    // é chamado antes de cada `host.innerHTML = ''` nas funções render() do
    // app (rede de segurança); listeners em document/window devem ser
    // registrados via trackListener para que o cleanup seja automático.
    // Uso:
    //   trackListener(host, document, 'scroll', onScroll);
    //   ...
    //   cleanupListeners(host);  // remove tudo de uma vez antes de re-render
    function trackListener(host, target, evt, fn, opts){
      target.addEventListener(evt, fn, opts);
      if (!host._solsticeListeners) host._solsticeListeners = [];
      host._solsticeListeners.push({ target, evt, fn, opts });
      return fn;
    }
    function cleanupListeners(host){
      const list = host && host._solsticeListeners;
      if (!list || !list.length) return 0;
      let n = 0;
      for (const r of list){
        try { r.target.removeEventListener(r.evt, r.fn, r.opts); n++; } catch(_){}
      }
      host._solsticeListeners = [];
      return n;
    }

    /* ========================================================
       Auditoria 2026 (cleanliness) — helpers de botões padronizados
       Antes: `class:'solstice__btn solstice__btn--primary'` repetido 36×
       e `class:'solstice__btn solstice__btn--ghost'` repetido 26× no arquivo.
       Agora: helpers de fábrica para reduzir ruído e padronizar.

       Uso:
         primaryBtn('Salvar', { onclick, title, style })
         ghostBtn('Cancelar', { onclick })
         destructiveBtn('Apagar', { onclick })

       Aceita o mesmo `attrs` que el(), exceto que `class` é mesclado:
       qualquer classe extra passada vira appendage da classe base.
       ======================================================== */
    function _btnFactory(baseClass){
      return function(label, attrs){
        attrs = attrs || {};
        const extraClass = attrs.class || attrs.className || '';
        const merged = baseClass + (extraClass ? ' ' + extraClass : '');
        const finalAttrs = Object.assign({}, attrs, { class: merged });
        delete finalAttrs.className;
        return el('button', finalAttrs, label);
      };
    }
    const primaryBtn = _btnFactory('solstice__btn solstice__btn--primary');
    const ghostBtn = _btnFactory('solstice__btn solstice__btn--ghost');
    const destructiveBtn = _btnFactory('solstice__btn solstice__btn--destructive');
    const baseBtn = _btnFactory('solstice__btn');

    /* ========================================================
       Design System 2026 (DS-2) — helpers de tokens em JS inline.
       Antes: 696 'XXpx' e 289 hex hardcoded em style:'...' das chamadas
       de el(). Esses NÃO usam os tokens declarados em CSS.
       Agora: sp(n)/col(name)/rad(name) retornam var(--TOKEN) prontos
       pra concatenar em style strings.

       Uso:
         el('div', { style:`padding:${sp(2)} ${sp(3)};color:${col('accent')};` })
         el('span', { style:`border-radius:${rad('sm')};` })
       ======================================================== */
    const sp  = (n) => 'var(--sp-' + n + ')';
    const col = (name) => 'var(--c-' + name + ')';
    const rad = (size) => 'var(--rad-' + size + ')';
    const fs  = (size) => 'var(--fs-' + size + ')';
    const fw  = (weight) => 'var(--fw-' + weight + ')';

    return { uuid, debounce, throttle, rafThrottle, clamp, deepClone, hash, seededRandom, qs, qsa, el, on, fire, escapeHtml, trackListener, cleanupListeners, primaryBtn, ghostBtn, destructiveBtn, baseBtn, sp, col, rad, fs, fw };
  })();
