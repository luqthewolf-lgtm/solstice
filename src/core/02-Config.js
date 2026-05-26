
  /* ============================================================
     B2-05 (v6-autonomous / MNT-03 — Renata/Spotify) — SolsticeConfig
     Constantes globais documentadas. Antes esses valores ficavam espalhados
     como magic numbers (`if (score >= 40)`, `setTimeout(_, 350)`,
     `if (rows > 50000)`). Centralizar facilita ajuste fino + entendimento.

     Cada chave tem unidade no comment + faixa razoável.
     ============================================================ */
  const SolsticeConfig = (function(){
    return Object.freeze({
      // Performance thresholds
      LARGE_CSV_BYTES:        5 * 1024 * 1024, // 5MB — acima usa streaming parser
      LARGE_DATASET_ROWS:     50000,           // acima ativa virtualização da tabela
      MAX_DOM_NODES_WARNING:  5000,            // sinal de "talvez virtualize"
      // Debounce/throttle (ms)
      INPUT_DEBOUNCE_MS:      300,             // input → search/filter
      RESIZE_THROTTLE_MS:     150,             // window resize → redraw
      AUTOSAVE_INTERVAL_MS:   5000,            // estado → localStorage
      // Confidences
      DICT_DETECT_MIN_CONF:   0.55,            // aplica vocabulário de domínio só se >=55% (Auditoria 2026.6 / DICT-CONF: 40% empurrava nomes errados em CSVs ambíguos)
      QUERY_MIN_CONFIDENCE:   0.40,            // pergunta NL aceita se confiança >=
      QUALITY_INVALID_ERROR:  0.25,            // >25% inválidos → vermelho
      // Insights
      INSIGHTS_MAX_SHOW:      8,
      INSIGHTS_OVERVIEW_SCORE: 20,             // score baixo do overview ("o que dá pra construir")
      TREND_R2_MIN:           0.20,            // R² mínimo pra reportar tendência
      TREND_MAGNITUDE_MIN:    0.05,            // 5% de variação mínima
      // Cache
      CACHE_TTL_MS:           5 * 60 * 1000,   // 5 min — slot-level cache
      CACHE_MAX_ENTRIES:      120,
      // Tour / hints
      TOUR_AUTOSTART_DELAY_MS: 1500,
      HINT_DEFAULT_DELAY_MS:   1500,
      // Storage
      LZ_MIN_SIZE_TO_COMPRESS: 2048,           // só comprime se >2KB
      SNAPSHOT_MAX_SIZE_BYTES: 4 * 1024 * 1024 // 4MB — limite de URL share
    });
  })();
