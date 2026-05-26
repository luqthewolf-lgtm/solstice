
  /* ============================================================
     BLOCO 8 — SolsticeAgent
     Agente proativo. Observa mudanças e dispara TOAST contextual quando
     detecta padrão interessante. Cap de 3 toasts por sessão (evita spam).
     Lista de gatilhos:
       1. CSV importado → 1º insight de tendência ou outlier
       2. Componente adicionado → smart-hint do B7 (já existe, não duplica)
       3. Outlier extremo no dataset → sugere Box Plot
       4. Correlação forte → sugere Scatter
       5. Variável temporal + sazonal → sugere Série Temporal mensal
       6. Dataset com >50% nulos numa coluna → sugere remover
     ============================================================ */
  const SolsticeAgent = (function(){
    let toastsFired = 0;
    const CAP_PER_SESSION = 3;
    const firedKeys = new Set(); // evita disparar mesmo toast 2x

    function _fire(key, opts){
      if (toastsFired >= CAP_PER_SESSION) return false;
      if (firedKeys.has(key)) return false;
      firedKeys.add(key);
      toastsFired++;
      SolsticeToast.action(opts);
      return true;
    }

    function _analyzeDataset(){
      const ingest = SolsticeStore.get('ingest');
      const dict = SolsticeStore.get('dictionary');
      if (!ingest || !ingest.rows || !ingest.rows.length) return;
      const insights = SolsticeInsights.compute();
      const top = insights[0];
      if (!top) return;

      // Gatilho 1: maior insight do dataset
      if (top.kind === 'trend'){
        _fire('trend-' + top.meta.column, {
          title: '📈 Tendência detectada',
          msg: top.text,
          kind: 'info', duration: 6000,
          actionLabel: 'Ver insights',
          actionFn: () => {
            const wrap = document.querySelector('.solstice__insights');
            if (wrap && wrap.classList.contains('is-collapsed')) wrap.classList.remove('is-collapsed');
            if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
        return;
      }
      if (top.kind === 'outliers' && top.severity !== 'info'){
        _fire('outliers-' + top.meta.column, {
          title: '⚠️ Outliers detectados',
          msg: top.text,
          kind: 'warn', duration: 6000,
          actionLabel: 'Criar Box Plot',
          actionFn: () => SolsticeComponents.addByType('boxplot')
        });
        return;
      }
      if (top.kind === 'pareto'){
        _fire('pareto-' + top.meta.catColumn, {
          title: '🎯 Concentração de Pareto',
          msg: top.text,
          kind: 'info', duration: 6000,
          actionLabel: 'Ver insights',
          actionFn: () => {
            const wrap = document.querySelector('.solstice__insights');
            if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
        return;
      }
    }

    function init(){
      // Quando o dataset muda (import novo ou re-import), reseta cap
      SolsticeStore.subscribe('ingest', () => {
        toastsFired = 0; firedKeys.clear();
        // Delay para deixar UI renderizar primeiro
        setTimeout(_analyzeDataset, 1200);
      });
    }

    function _reset(){ toastsFired = 0; firedKeys.clear(); }
    function status(){ return { fired: toastsFired, cap: CAP_PER_SESSION, keys: Array.from(firedKeys) }; }

    return { init, _reset, status };
  })();
