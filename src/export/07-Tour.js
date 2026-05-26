
  /* ============================================================
     BLOCO 12 — SolsticeTour (ADR-088)
     Tour interativo passo-a-passo. Spotlight (clip-path) + tooltip.
     ============================================================ */
  const SolsticeTour = (function(){
    let overlay = null;
    let stepIndex = 0;

    // Auditoria 2026 (M-O-2 / A-1103): tour reescrito como jornada de tarefa.
    // Antes: 9 passos DESCREVIAM a UI ("Sidebar tem isto e aquilo") — Beatriz
    // saía sem ter feito nada. Agora: 9 passos guiam o usuário a CONSTRUIR
    // um dashboard real. STEP 5 também corrigido — 19 componentes, não 10.
    const STEPS = [
      { selector: '.solstice__brand', title:'Bem-vindo ao Solstice 👋',
        text:'Vamos juntos construir seu primeiro dashboard em 9 passos. Cada passo é uma ação concreta — não só uma descrição.' },
      { selector: '#btn-import-menu', title:'1. Importe seu primeiro CSV 📁',
        text:'Clique em "Importar" e selecione um CSV. Tem um pequeno à mão? Sirva-se. Sem CSV agora? Use "Dataset de exemplo".' },
      { selector: '#tab-dados', title:'2. Confira as colunas 📊',
        text:'A aba "Dados" mostra o que veio. Veja se cada coluna foi reconhecida certo — numérica, texto, data. Erro? Clique na coluna para reclassificar.' },
      { selector: '#tab-componentes', title:'3. Adicione seu primeiro componente 🧩',
        text:'Mude para a aba "Componentes": 19 tipos em 3 grupos (Básicos · Avançados · Texto). Arraste um KPI ou clique para inserir no canvas.' },
      { selector: '.solstice__canvas', title:'4. Veja o resultado no canvas 🎨',
        text:'Cada componente vai num slot. Mexa, redimensione (canto ↘), troque tipo no Inspector. Tudo aqui é editável.' },
      { selector: '#help-btn', title:'5. Pergunte ao Solstice 🔍',
        text:'Ctrl+P abre o "Pergunte". Digite em português: "média de receita", "tendência das vendas", "se ticket subir 10%". Resposta local, sem mandar dado para fora.' },
      { selector: '.solstice__header-actions', title:'6. Apresente 🖥️',
        text:'Os 5 modos servem para etapas diferentes do trabalho. Tente "Present" para visualizar sem ruído, ou pressione F para o modo Slides.' },
      { selector: '.solstice__status', title:'7. Salve seu trabalho 💾',
        text:'Ctrl+S salva um snapshot no navegador. O ícone "Salvo automaticamente" também trabalha em silêncio. Em PC compartilhado, lembre de limpar ao sair (Settings).' },
      { selector: '.solstice__brand', title:'Pronto — você fez um dashboard! 🚀',
        text:'Próximos passos sugeridos: experimentar Auto-Dashboard (🪄 na toolbar), exportar PDF/XLSX, ou criar Medidas Calculadas (Ctrl+K → "medidas").' }
    ];

    function start(){
      if (overlay) return;
      stepIndex = 0;
      _render();
    }
    function close(){
      if (overlay){ overlay.remove(); overlay = null; }
    }
    function next(){
      if (stepIndex < STEPS.length - 1){ stepIndex++; _render(); }
      else close();
    }
    function prev(){
      if (stepIndex > 0){ stepIndex--; _render(); }
    }

    function _render(){
      if (overlay) overlay.remove();
      const step = STEPS[stepIndex];
      const target = document.querySelector(step.selector);
      const rect = target ? target.getBoundingClientRect() : { left: window.innerWidth/2 - 100, top: window.innerHeight/2 - 50, width: 200, height: 100 };
      const pad = 8;

      overlay = SolsticeUtils.el('div', { class:'solstice__tour-overlay' });

      // Máscara com clip-path "buraco" no target
      const mask = SolsticeUtils.el('div', { class:'solstice__tour-mask' });
      const clip = 'polygon(' +
        '0 0, 100% 0, 100% 100%, 0 100%, 0 0, ' +
        (rect.left - pad) + 'px ' + (rect.top - pad) + 'px, ' +
        (rect.left - pad) + 'px ' + (rect.bottom + pad) + 'px, ' +
        (rect.right + pad) + 'px ' + (rect.bottom + pad) + 'px, ' +
        (rect.right + pad) + 'px ' + (rect.top - pad) + 'px, ' +
        (rect.left - pad) + 'px ' + (rect.top - pad) + 'px' +
      ')';
      mask.style.clipPath = clip;
      mask.style.webkitClipPath = clip;
      overlay.appendChild(mask);

      // Tooltip
      const tooltip = SolsticeUtils.el('div', { class:'solstice__tour-tooltip' });
      // Posiciona embaixo do target, ou em cima se não houver espaço
      let top = rect.bottom + pad + 8;
      if (top + 200 > window.innerHeight){ top = rect.top - 200 - pad; }
      let left = rect.left;
      if (left + 320 > window.innerWidth) left = window.innerWidth - 320 - 16;
      if (left < 16) left = 16;
      tooltip.style.top = top + 'px';
      tooltip.style.left = left + 'px';

      tooltip.appendChild(SolsticeUtils.el('span', { class:'solstice__tour-step-num' }, (stepIndex + 1) + ' / ' + STEPS.length));
      tooltip.appendChild(SolsticeUtils.el('div', { class:'solstice__tour-title' }, step.title));
      tooltip.appendChild(SolsticeUtils.el('div', { class:'solstice__tour-text' }, step.text));

      const acts = SolsticeUtils.el('div', { class:'solstice__tour-actions' });
      acts.appendChild(SolsticeUtils.el('span', { class:'solstice__tour-progress' }, 'Passo ' + (stepIndex + 1) + ' de ' + STEPS.length));
      const btns = SolsticeUtils.el('div', { style:'display:flex;gap:6px;' });
      if (stepIndex > 0) btns.appendChild(SolsticeUtils.el('button', { class:'solstice__btn',
        style:'font-size:10px;padding:4px 10px;height:24px;', onclick: prev }, '← Anterior'));
      btns.appendChild(SolsticeUtils.el('button', { class:'solstice__btn',
        style:'font-size:10px;padding:4px 10px;height:24px;', onclick: close }, 'Pular'));
      btns.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary',
        style:'font-size:10px;padding:4px 10px;height:24px;', onclick: next },
        stepIndex === STEPS.length - 1 ? '✓ Finalizar' : 'Próximo →'));
      acts.appendChild(btns);
      tooltip.appendChild(acts);

      overlay.appendChild(tooltip);
      document.body.appendChild(overlay);
    }

    function init(){
      document.addEventListener('keydown', (e) => {
        if (!overlay) return;
        if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') prev();
        else if (e.key === 'Escape') close();
      });

      // Auditoria 2026.6 (FIRST-IMPRESSION): NÃO auto-iniciamos mais o tour de 9
      // passos por cima da tela de boas-vindas. Forçar um tour de coachmarks no
      // primeiro segundo é intrusivo (produtos modernos OFERECEM, não forçam) e
      // redundante — a welcome já tem o botão "🧭 Tour interativo (9 passos)" e o
      // link "ver onboarding" bem visíveis. Primeira impressão limpa; o tour
      // segue a 1 clique (welcome, menu "?" do header, Ctrl+K).
    }

    return { start, close, next, prev, init, STEPS };
  })();
