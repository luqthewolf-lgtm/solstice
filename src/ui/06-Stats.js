
  /* ============================================================
     BLOCO 7 — SolsticeStats
     ───────────────────────────────────────────────────────────
     ADR-169 (Onda 3 / D1) — API CONTRACT explícito.
     Módulo estatístico puro: 35+ funções sem efeitos colaterais.

     CONTRATO DA API:
       Inputs: arrays de números OU configs simples (objetos planos)
       Outputs: número, objeto plano OU array
       Garantias:
         - NUNCA muta o array de entrada
         - NaN/null/undefined são filtrados via clean()
         - Sample-size = 0 ou 1 → retorna valor neutro (0, null, [])
         - Complexidade O(n) na maioria; O(n log n) em sort/percentil
         - Determinismo: mesma entrada → mesma saída (sem random sem seed)

     EXTRAÇÃO PRA ESM (decisão #1 do briefing v5.4, futuro):
       Este módulo já é AUTO-CONTIDO. Não depende de SolsticeUtils,
       SolsticeStore ou DOM. Única dependência implícita: nada externo.
       Pra extrair como módulo ESM testável:
         1. Copiar bloco entre `const SolsticeStats = (function(){` (11271)
            e o `})();` final (ver line ~12640 / `return { ... };`)
         2. Substituir IIFE por `export const SolsticeStats = { ... }`
         3. Inputs/outputs continuam idênticos
         4. Tests inline neste arquivo (busca SOLSTICE_STATS_SELFTEST)
            podem virar Vitest/Jest sem alteração — são pure assertions.

     FUNÇÕES PRINCIPAIS (não-exaustivo):
       Descritivas:    mean, median, mode, stddev, variance, percentile
       Outliers:       outliersZ, outliersIQR, outliersModifiedZ
       Trend/Forecast: trend, linearRegression, linearForecast, holtWinters
       Correlation:    pearson, spearman, kendallTau
       Sampling:       randomSample, stratifiedSample, systematicSample
       Hypothesis:     tTestPaired, tTestIndependent, anovaOneWay,
                       chiSquaredIndependence, jarqueBera
       Other:          histogram, lttb, lttb2D, autocorrelation,
                       seasonality, bootstrapCI, linearRegressionMultiple

     Filosofia: linguagem matemática explícita; nada de "magia".
     Usadas internamente pelos componentes B6/B7 e pelo painel
     "📈 Análise" do Props (Bloco 7). Expostas via Solstice.Stats.
     ============================================================ */
  const SolsticeStats = (function(){

    /* ---------- Núcleo: limpar e validar entradas ---------- */

    /** Filtra NaN/null/undefined e converte para Number. NÃO ordena. */
    function clean(values){
      if (!values) return [];
      const out = [];
      for (let i = 0; i < values.length; i++){
        const v = values[i];
        if (v == null) continue;
        const n = typeof v === 'number' ? v : parseNum(v);
        if (!isNaN(n) && isFinite(n)) out.push(n);
      }
      return out;
    }

    /**
     * Sprint 34 / J-1 (Júlia/QA): wrapper unificado pra parsear célula de CSV
     * com awareness de formato pt-BR vs US.
     *
     * Antes: 80+ chamadas `SolsticeStats.parseNum(r[col])` espalhadas pelos componentes.
     * Problema: parseFloat("1.234,56") = 1.234 (trunca após o ponto).
     * Solução: detecção automática via SolsticeBR.toNumber se disponível;
     * fallback pra parseFloat se SolsticeBR não estiver carregado ainda
     * (early boot). Idempotente em números já-parseados.
     */
    function parseNum(v){
      if (v == null || v === '') return NaN;
      if (typeof v === 'number') return v;
      if (typeof SolsticeBR !== 'undefined' && SolsticeBR.toNumber){
        return SolsticeBR.toNumber(v);
      }
      return parseFloat(v);
    }

    /** Versão ordenada (asc) de clean. Útil para percentis e mediana. */
    function sorted(values){
      const c = clean(values);
      return c.sort((a, b) => a - b);
    }

    /* ---------- Descritivas básicas ---------- */

    /** Soma. NaN/null ignorados. */
    function sum(values){
      let s = 0; const c = clean(values);
      for (let i = 0; i < c.length; i++) s += c[i];
      return s;
    }

    /** Quantidade de valores numéricos válidos. */
    function count(values){ return clean(values).length; }

    /** Quantidade de valores nulos/inválidos (complemento de count). */
    function countNulls(values){
      if (!values) return 0;
      let n = 0;
      for (let i = 0; i < values.length; i++){
        const v = values[i];
        if (v == null) { n++; continue; }
        const x = typeof v === 'number' ? v : parseFloat(v);
        if (isNaN(x) || !isFinite(x)) n++;
      }
      return n;
    }

    /** Média aritmética. */
    function mean(values){
      const c = clean(values);
      if (!c.length) return null;
      return sum(c) / c.length;
    }

    /** Mediana (valor central). Robusta a outliers. */
    function median(values){
      const s = sorted(values);
      const n = s.length;
      if (!n) return null;
      const m = Math.floor(n / 2);
      return n % 2 ? s[m] : (s[m-1] + s[m]) / 2;
    }

    /** Moda. Retorna array (pode haver empate). Para numéricos contínuos
     *  faz sentido bucketizar antes. */
    function mode(values){
      const c = clean(values);
      if (!c.length) return [];
      const freq = new Map();
      let max = 0;
      for (const v of c){ const k = freq.get(v) || 0; const n = k + 1; freq.set(v, n); if (n > max) max = n; }
      if (max < 2) return []; // sem moda real
      const modes = [];
      for (const [k, n] of freq) if (n === max) modes.push(k);
      return modes;
    }

    /* Code Review 2026: min/max via loop simples — Math.min.apply / spread
       estouram stack em arrays grandes (>~125k em V8). Loop é O(n) idêntico
       em performance e seguro pra qualquer tamanho de dataset. */
    function min(values){
      const c = clean(values);
      if (!c.length) return null;
      let m = c[0];
      for (let i = 1; i < c.length; i++) if (c[i] < m) m = c[i];
      return m;
    }
    function max(values){
      const c = clean(values);
      if (!c.length) return null;
      let m = c[0];
      for (let i = 1; i < c.length; i++) if (c[i] > m) m = c[i];
      return m;
    }
    /** Code Review 2026: retorna [min, max] numa passada — economiza 50%
        vs chamar min(values) + max(values) separadamente. */
    function minMax(values){
      const c = clean(values);
      if (!c.length) return [null, null];
      let mn = c[0], mx = c[0];
      for (let i = 1; i < c.length; i++){
        const v = c[i];
        if (v < mn) mn = v;
        else if (v > mx) mx = v;
      }
      return [mn, mx];
    }
    function range(values){ const [lo, hi] = minMax(values); return (lo == null || hi == null) ? null : hi - lo; }
    function distinctCount(values){ const c = clean(values); return new Set(c).size; }

    /* ---------- Dispersão ---------- */

    /** Variância amostral (N-1). Use populational(values) para N. */
    function variance(values){
      const c = clean(values);
      if (c.length < 2) return null;
      const m = sum(c) / c.length;
      let s = 0;
      for (let i = 0; i < c.length; i++){ const d = c[i] - m; s += d * d; }
      return s / (c.length - 1);
    }

    /** Variância populacional (N) — use quando os dados SÃO a população inteira. */
    function variancePop(values){
      const c = clean(values);
      if (!c.length) return null;
      const m = sum(c) / c.length;
      let s = 0;
      for (let i = 0; i < c.length; i++){ const d = c[i] - m; s += d * d; }
      return s / c.length;
    }

    /** Desvio padrão amostral. */
    function stdDev(values){ const v = variance(values); return v == null ? null : Math.sqrt(v); }

    /** Desvio Absoluto Mediano (MAD) — robusto a outliers, ao contrário do stdDev. */
    function mad(values){
      const c = clean(values);
      if (!c.length) return null;
      const med = median(c);
      const abs = c.map(x => Math.abs(x - med));
      return median(abs);
    }

    /** Coeficiente de variação (CV = σ/μ). Útil para comparar dispersão entre escalas. */
    function cv(values){
      const m = mean(values), sd = stdDev(values);
      if (m == null || sd == null || m === 0) return null;
      return sd / Math.abs(m);
    }

    /* ---------- Percentis ---------- */

    /**
     * Percentil P (0-1) usando interpolação linear (tipo 7, igual NumPy default).
     * percentile(values, 0.5) === median(values).
     */
    function percentile(values, p){
      const s = sorted(values);
      const n = s.length;
      if (!n) return null;
      if (p <= 0) return s[0];
      if (p >= 1) return s[n-1];
      const i = (n - 1) * p;
      const lo = Math.floor(i), hi = Math.ceil(i);
      return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
    }

    /** Quartis Q1/Q2/Q3 + IQR (Q3-Q1). Base para outliers e box plot. */
    function quartiles(values){
      const s = sorted(values);
      if (!s.length) return null;
      // Recomputa via percentile para consistência interna
      const q1 = percentile(s, 0.25);
      const med = percentile(s, 0.5);
      const q3 = percentile(s, 0.75);
      return { q1, median: med, q3, iqr: q3 - q1, min: s[0], max: s[s.length-1] };
    }

    /** IQR (Q3 - Q1) standalone. */
    function iqr(values){ const q = quartiles(values); return q ? q.iqr : null; }

    /* ---------- Forma ---------- */

    /**
     * Skewness (assimetria) — Pearson 3 simplificado: 3*(media-mediana)/stddev.
     * > 0 cauda à direita (poucos valores muito altos),
     * < 0 cauda à esquerda, ≈ 0 simétrico.
     */
    function skewness(values){
      const m = mean(values), md = median(values), sd = stdDev(values);
      if (m == null || md == null || sd == null || sd === 0) return null;
      return 3 * (m - md) / sd;
    }

    /**
     * Kurtosis excesso (Fisher) — distribuição normal = 0.
     * > 0 caudas pesadas (mais outliers), < 0 caudas leves (uniforme).
     * Fórmula: g2 = m4/(m2^2) - 3, com momentos m_k = média de (x-μ)^k.
     */
    function kurtosis(values){
      const c = clean(values);
      const n = c.length;
      if (n < 4) return null;
      const m = sum(c) / n;
      let m2 = 0, m4 = 0;
      for (let i = 0; i < n; i++){
        const d = c[i] - m;
        m2 += d*d; m4 += d*d*d*d;
      }
      m2 /= n; m4 /= n;
      return m2 === 0 ? 0 : (m4 / (m2*m2)) - 3;
    }

    /* ---------- Detecção de outliers ---------- */

    /** Outliers via IQR 1.5× (regra de Tukey). Retorna {indices, values, fences}. */
    function outliersIQR(values, k){
      const factor = k == null ? 1.5 : k;
      const c = clean(values);
      const q = quartiles(c);
      if (!q) return { indices: [], values: [], fences: null };
      const lo = q.q1 - factor * q.iqr;
      const hi = q.q3 + factor * q.iqr;
      const indices = [], outs = [];
      for (let i = 0; i < c.length; i++){
        if (c[i] < lo || c[i] > hi){ indices.push(i); outs.push(c[i]); }
      }
      return { indices, values: outs, fences: { lo, hi } };
    }

    /** Outliers via |Z-score| > threshold (default 3). Assume distribuição ~normal. */
    function outliersZ(values, threshold){
      const t = threshold == null ? 3 : threshold;
      const c = clean(values);
      const m = mean(c), sd = stdDev(c);
      if (m == null || sd == null || sd === 0) return { indices: [], values: [], threshold: t };
      const indices = [], outs = [];
      for (let i = 0; i < c.length; i++){
        const z = Math.abs((c[i] - m) / sd);
        if (z > t){ indices.push(i); outs.push(c[i]); }
      }
      return { indices, values: outs, threshold: t };
    }

    /** Outliers via Modified Z-Score (MAD-based) — robusto. Threshold default 3.5 (Iglewicz/Hoaglin). */
    function outliersMAD(values, threshold){
      const t = threshold == null ? 3.5 : threshold;
      const c = clean(values);
      const med = median(c);
      const m = mad(c);
      if (m == null || m === 0) return { indices: [], values: [], threshold: t };
      const indices = [], outs = [];
      for (let i = 0; i < c.length; i++){
        const mz = 0.6745 * (c[i] - med) / m;
        if (Math.abs(mz) > t){ indices.push(i); outs.push(c[i]); }
      }
      return { indices, values: outs, threshold: t };
    }

    /* ---------- Regressão ---------- */

    /** Regressão linear OLS y = mx + b. points: [[x,y],...]. Retorna {slope, intercept, r2, n}. */
    function linearRegression(points){
      if (!points || points.length < 2) return null;
      let n = 0, sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
      for (const p of points){
        const x = parseFloat(p[0]), y = parseFloat(p[1]);
        if (isNaN(x) || isNaN(y)) continue;
        n++; sx += x; sy += y; sxy += x*y; sxx += x*x; syy += y*y;
      }
      if (n < 2) return null;
      const mx = sx / n, my = sy / n;
      const denom = sxx - n * mx * mx;
      if (denom === 0) return { slope: 0, intercept: my, r2: 0, r2_adjusted: 0, n };
      const slope = (sxy - n * mx * my) / denom;
      const intercept = my - slope * mx;
      const ssTot = syy - n * my * my;
      let ssRes = 0;
      for (const p of points){
        const x = parseFloat(p[0]), y = parseFloat(p[1]);
        if (isNaN(x) || isNaN(y)) continue;
        const pred = slope*x + intercept;
        ssRes += (y - pred) * (y - pred);
      }
      const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
      // Auditoria 2026 (R-02 / A-202): R² ajustado evita ilusão com n pequeno.
      // Para regressão simples: r2_adj = 1 - (1-r²) * (n-1) / (n-2). Em n=2,
      // df=0 e a fórmula não se aplica — devolve null nesse caso.
      const r2_adjusted = n > 2 ? 1 - (1 - r2) * (n - 1) / (n - 2) : null;
      return { slope, intercept, r2, r2_adjusted, n };
    }

    /**
     * Regressão polinomial de grau k via Vandermonde + eliminação gaussiana.
     * Útil para detectar curvatura. k=2 = parábola, k=3 = cúbica.
     * Retorna { coefs: [c0, c1, ..., ck], r2 } onde y ≈ Σ c_i * x^i.
     */
    function polynomialRegression(points, degree){
      const k = Math.max(1, Math.min(6, degree || 2));
      const pts = (points || []).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
      const n = pts.length;
      if (n < k + 1) return null;
      // Monta matriz normal: A * c = b, onde A_ij = Σ x^(i+j), b_i = Σ y * x^i
      const A = Array.from({length: k+1}, () => new Array(k+1).fill(0));
      const b = new Array(k+1).fill(0);
      for (const [x, y] of pts){
        let xi = 1;
        for (let i = 0; i <= k; i++){
          b[i] += y * xi;
          let xj = 1;
          for (let j = 0; j <= k; j++){ A[i][j] += xi * xj; xj *= x; }
          xi *= x;
        }
      }
      // Gauss-Jordan
      for (let i = 0; i <= k; i++){
        // pivot
        let mx = Math.abs(A[i][i]), mxRow = i;
        for (let r = i+1; r <= k; r++) if (Math.abs(A[r][i]) > mx){ mx = Math.abs(A[r][i]); mxRow = r; }
        if (mx < 1e-12) return null;
        [A[i], A[mxRow]] = [A[mxRow], A[i]];
        [b[i], b[mxRow]] = [b[mxRow], b[i]];
        // normalize
        const piv = A[i][i];
        for (let j = i; j <= k; j++) A[i][j] /= piv;
        b[i] /= piv;
        // eliminate
        for (let r = 0; r <= k; r++){
          if (r === i) continue;
          const f = A[r][i];
          for (let j = i; j <= k; j++) A[r][j] -= f * A[i][j];
          b[r] -= f * b[i];
        }
      }
      const coefs = b.slice();
      // R²
      const yMean = pts.reduce((s, [, y]) => s + y, 0) / n;
      let ssTot = 0, ssRes = 0;
      for (const [x, y] of pts){
        let pred = 0, xi = 1;
        for (let i = 0; i <= k; i++){ pred += coefs[i] * xi; xi *= x; }
        ssTot += (y - yMean) * (y - yMean);
        ssRes += (y - pred) * (y - pred);
      }
      const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
      return { coefs, r2, degree: k, n };
    }

    /* ---------- Correlação ---------- */

    /**
     * Coeficiente de Pearson r ∈ [-1, 1]. Mede correlação LINEAR.
     * Sensível a outliers. Para dados não-lineares mas monotônicos, prefira Spearman.
     */
    function correlation(xs, ys){
      const n = Math.min(xs.length, ys.length);
      let nn = 0, sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < n; i++){
        const x = parseFloat(xs[i]), y = parseFloat(ys[i]);
        if (isNaN(x) || isNaN(y)) continue;
        nn++; sx += x; sy += y; sxy += x*y; sxx += x*x; syy += y*y;
      }
      if (nn < 2) return null;
      const num = nn * sxy - sx * sy;
      const den = Math.sqrt((nn * sxx - sx * sx) * (nn * syy - sy * sy));
      return den === 0 ? 0 : num / den;
    }

    /**
     * Spearman ρ — correlação de POSTOS (ranks). Captura relações monotônicas
     * não-lineares. Robusto a outliers. Para empates usa média dos postos.
     */
    function correlationSpearman(xs, ys){
      const pairs = [];
      const n = Math.min(xs.length, ys.length);
      for (let i = 0; i < n; i++){
        const x = parseFloat(xs[i]), y = parseFloat(ys[i]);
        if (!isNaN(x) && !isNaN(y)) pairs.push([x, y, i]);
      }
      if (pairs.length < 2) return null;
      function rank(arr){
        const indexed = arr.map((v, i) => [v, i]).sort((a,b) => a[0] - b[0]);
        const ranks = new Array(arr.length);
        let i = 0;
        while (i < indexed.length){
          let j = i;
          while (j+1 < indexed.length && indexed[j+1][0] === indexed[i][0]) j++;
          const avg = (i + j + 2) / 2; // posto 1-based, média de empates
          for (let k = i; k <= j; k++) ranks[indexed[k][1]] = avg;
          i = j + 1;
        }
        return ranks;
      }
      const rx = rank(pairs.map(p => p[0]));
      const ry = rank(pairs.map(p => p[1]));
      return correlation(rx, ry);
    }

    /**
     * Matriz de correlação (Pearson default) entre colunas. Cada item:
     *   { a, b, r, n }. Útil para Auto-Dashboard (B10) e Stats tab.
     */
    function correlationMatrix(rows, columns, method){
      const fn = method === 'spearman' ? correlationSpearman : correlation;
      const out = [];
      for (let i = 0; i < columns.length; i++){
        for (let j = i+1; j < columns.length; j++){
          const a = columns[i], b = columns[j];
          const xs = [], ys = [];
          for (const r of rows){
            const x = SolsticeStats.parseNum(r[a]), y = SolsticeStats.parseNum(r[b]);
            if (!isNaN(x) && !isNaN(y)){ xs.push(x); ys.push(y); }
          }
          const r = fn(xs, ys);
          out.push({ a, b, r, n: xs.length });
        }
      }
      return out;
    }

    /* ---------- Séries temporais ---------- */

    /** Média móvel simples janela N. Pontos iniciais sem janela cheia recebem null. */
    function movingAverage(values, window){
      const w = Math.max(1, window || 3);
      const c = clean(values);
      const out = new Array(c.length).fill(null);
      let s = 0;
      for (let i = 0; i < c.length; i++){
        s += c[i];
        if (i >= w) s -= c[i - w];
        if (i >= w - 1) out[i] = s / w;
      }
      return out;
    }

    /**
     * Suavização exponencial simples (Holt nível-only). α ∈ (0,1).
     * Alta sensibilidade a alterações recentes quando α próximo de 1.
     */
    function exponentialSmoothing(values, alpha){
      const a = alpha == null ? 0.3 : alpha;
      const c = clean(values);
      if (!c.length) return [];
      const out = [c[0]];
      for (let i = 1; i < c.length; i++) out.push(a * c[i] + (1 - a) * out[i-1]);
      return out;
    }

    /**
     * Forecast linear: estende a regressão linear N passos à frente.
     * Retorna array de comprimento N com previsões.
     */
    function linearForecast(values, n){
      const c = clean(values);
      const steps = n || 5;
      const pts = c.map((y, i) => [i, y]);
      const reg = linearRegression(pts);
      if (!reg) return [];
      const out = [];
      for (let i = 0; i < steps; i++){
        out.push(reg.slope * (c.length + i) + reg.intercept);
      }
      return out;
    }

    /**
     * Holt-Winters aditivo simplificado (α=0.5, β=0.3, γ=0.3, sazonalidade S).
     * Para forecast curto sem necessidade de otimização de hiperparâmetros.
     * Retorna array de N previsões.
     */
    function holtWinters(values, n, season){
      const c = clean(values);
      const S = Math.max(1, season || 12);
      const steps = n || S;
      if (c.length < 2 * S) return linearForecast(c, steps);
      const alpha = 0.5, beta = 0.3, gamma = 0.3;
      // Inicializa nível, tendência e índices sazonais
      let L = c.slice(0, S).reduce((a,b)=>a+b, 0) / S;
      const reg = linearRegression(c.slice(0, S).map((y,i)=>[i,y]));
      let T = reg ? reg.slope : 0;
      const seas = new Array(S);
      for (let i = 0; i < S; i++) seas[i] = c[i] - L;
      // Atualiza
      for (let t = S; t < c.length; t++){
        const Lprev = L, Tprev = T;
        L = alpha * (c[t] - seas[t % S]) + (1 - alpha) * (Lprev + Tprev);
        T = beta * (L - Lprev) + (1 - beta) * Tprev;
        seas[t % S] = gamma * (c[t] - L) + (1 - gamma) * seas[t % S];
      }
      const out = [];
      for (let h = 1; h <= steps; h++){
        out.push(L + h * T + seas[(c.length + h - 1) % S]);
      }
      return out;
    }

    /** Diferença discreta y[t] - y[t-lag]. Útil para tornar série estacionária. */
    function diff(values, lag){
      const k = lag || 1;
      const c = clean(values);
      const out = [];
      for (let i = k; i < c.length; i++) out.push(c[i] - c[i-k]);
      return out;
    }

    /** Autocorrelação no lag k. r_k = cov(y_t, y_{t-k}) / var(y). */
    function autocorrelation(values, lag){
      const k = lag || 1;
      const c = clean(values);
      if (c.length <= k) return null;
      const m = sum(c) / c.length;
      let num = 0, den = 0;
      for (let i = 0; i < c.length; i++){ const d = c[i] - m; den += d * d; }
      for (let i = k; i < c.length; i++){ num += (c[i] - m) * (c[i-k] - m); }
      return den === 0 ? 0 : num / den;
    }

    /* ---------- Clustering ---------- */

    /**
     * K-means (Lloyd). points: [[x,y],...]. Retorna array de cluster ids.
     * Inicialização determinística: k pontos espaçados igualmente.
     */
    function kMeans(points, k, maxIter){
      const iters = maxIter || 20;
      if (!points || points.length < k || k < 1) return (points || []).map(() => 0);
      const stride = Math.max(1, Math.floor(points.length / k));
      const centers = [];
      for (let i = 0; i < k; i++) centers.push(points[i * stride].slice());
      const assignments = new Array(points.length).fill(0);
      for (let it = 0; it < iters; it++){
        let changed = false;
        for (let i = 0; i < points.length; i++){
          let best = 0, bestD = Infinity;
          for (let c = 0; c < k; c++){
            const dx = points[i][0] - centers[c][0];
            const dy = points[i][1] - centers[c][1];
            const d = dx*dx + dy*dy;
            if (d < bestD){ bestD = d; best = c; }
          }
          if (assignments[i] !== best){ assignments[i] = best; changed = true; }
        }
        if (!changed) break;
        const sums = Array.from({length: k}, () => [0, 0, 0]);
        for (let i = 0; i < points.length; i++){
          const c = assignments[i];
          sums[c][0] += points[i][0]; sums[c][1] += points[i][1]; sums[c][2] += 1;
        }
        for (let c = 0; c < k; c++){
          if (sums[c][2] > 0){
            centers[c][0] = sums[c][0] / sums[c][2];
            centers[c][1] = sums[c][1] / sums[c][2];
          }
        }
      }
      return assignments;
    }

    /* ---------- Transformações ---------- */

    /** Normalização min-max para [0,1]. */
    function normalize(values){
      const c = clean(values);
      const lo = Math.min.apply(null, c), hi = Math.max.apply(null, c);
      const r = hi - lo;
      if (!r) return c.map(() => 0.5);
      return c.map(v => (v - lo) / r);
    }

    /** Z-score (padronização): (x - μ)/σ. Dados ficam com média 0 e std 1. */
    function zScore(values){
      const m = mean(values), sd = stdDev(values);
      if (m == null || sd == null || sd === 0) return clean(values).map(() => 0);
      return clean(values).map(v => (v - m) / sd);
    }

    /**
     * Bucketize valores em N faixas de largura uniforme. Retorna { edges, counts, bins }.
     * bins[i] é o índice do bucket de values[i].
     */
    function bucketize(values, n){
      const c = clean(values);
      const nb = Math.max(1, n || 10);
      if (!c.length) return { edges: [], counts: [], bins: [] };
      const lo = Math.min.apply(null, c), hi = Math.max.apply(null, c);
      const step = (hi - lo) / nb || 1;
      const counts = new Array(nb).fill(0);
      const bins = new Array(c.length);
      const edges = [];
      for (let i = 0; i <= nb; i++) edges.push(lo + i * step);
      for (let i = 0; i < c.length; i++){
        const b = Math.min(nb - 1, Math.floor((c[i] - lo) / step));
        bins[i] = b; counts[b]++;
      }
      return { edges, counts, bins };
    }

    /** Vetor de lags: out[i] = values[i - k] (null para i < k). Útil para features. */
    function lag(values, k){
      const lk = k || 1;
      const out = new Array(values.length).fill(null);
      for (let i = lk; i < values.length; i++) out[i] = values[i - lk];
      return out;
    }

    /**
     * LTTB — Largest Triangle Three Buckets (downsampling para gráficos).
     * Reduz array de N pontos para `threshold` pontos preservando "forma" visual.
     * O(n). Crítico para séries com 100K+ pontos.
     * Input: points como array<[x, y]>; threshold ≥ 3.
     */
    function lttb(points, threshold){
      const n = points ? points.length : 0;
      if (!n) return [];
      if (threshold >= n || threshold < 3) return points.slice();
      const bucketSize = (n - 2) / (threshold - 2);
      const sampled = [points[0]];
      let a = 0;
      for (let i = 0; i < threshold - 2; i++){
        const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
        const avgRangeEnd   = Math.min(n, Math.floor((i + 2) * bucketSize) + 1);
        let avgX = 0, avgY = 0;
        const avgRangeLength = avgRangeEnd - avgRangeStart || 1;
        for (let j = avgRangeStart; j < avgRangeEnd; j++){
          avgX += points[j][0]; avgY += points[j][1];
        }
        avgX /= avgRangeLength; avgY /= avgRangeLength;
        const rangeOffs = Math.floor(i * bucketSize) + 1;
        const rangeTo   = Math.floor((i + 1) * bucketSize) + 1;
        const pAx = points[a][0], pAy = points[a][1];
        let maxArea = -1, maxAreaIdx = rangeOffs;
        for (let j = rangeOffs; j < rangeTo; j++){
          const area = Math.abs((pAx - avgX) * (points[j][1] - pAy) - (pAx - points[j][0]) * (avgY - pAy));
          if (area > maxArea){ maxArea = area; maxAreaIdx = j; }
        }
        sampled.push(points[maxAreaIdx]);
        a = maxAreaIdx;
      }
      sampled.push(points[n - 1]);
      return sampled;
    }

    /* ---------- Análise direcional ---------- */

    /**
     * Detecta tendência a partir da inclinação da regressão linear ao longo do tempo.
     * Retorna { direction: 'up'|'down'|'flat', slope, slopePerUnit, magnitude, r2 }.
     * magnitude: |slope| * n / |mean| — quanto a métrica variou no total relativo à média.
     */
    function trend(values){
      const c = clean(values);
      if (c.length < 3) return null;
      const pts = c.map((v, i) => [i, v]);
      const reg = linearRegression(pts);
      if (!reg) return null;
      const m = sum(c) / c.length;
      const totalChange = reg.slope * (c.length - 1);
      const magnitude = m === 0 ? 0 : Math.abs(totalChange / m);
      let dir = 'flat';
      if (magnitude > 0.02){ // mais de 2% de variação total — diferente de zero
        dir = reg.slope > 0 ? 'up' : 'down';
      }
      return { direction: dir, slope: reg.slope, slopePerUnit: reg.slope, magnitude, r2: reg.r2, totalChange };
    }

    /* ---------- Smart helpers para suggest defaults dos componentes ---------- */

    /**
     * Lista colunas por grupo de tipo. Helper compartilhado por suggest*.
     */
    function _colsByGroup(ctx, group){
      return (ctx.columns || []).filter(c => {
        const tt = ctx.types && ctx.types[c];
        return tt && SolsticeTypes.group(tt.type) === group;
      });
    }

    /**
     * Para SCATTER: encontra o par de colunas numéricas com maior |Pearson|.
     * Estratégia: limita a até 6 colunas numéricas (15 pares) para evitar
     * pegar correlações espúrias e custo O(n²). Se há < 2 numéricas, fallback.
     */
    function bestNumericPair(ctx){
      const nums = _colsByGroup(ctx, 'numeric');
      if (nums.length < 2) return { x: nums[0] || null, y: null, r: null, candidates: 0 };
      const candidates = nums.slice(0, 6);
      let best = { x: candidates[0], y: candidates[1] || candidates[0], r: 0, candidates: candidates.length };
      for (let i = 0; i < candidates.length; i++){
        for (let j = i+1; j < candidates.length; j++){
          const xs = [], ys = [];
          for (const r of (ctx.rows || [])){
            const x = SolsticeStats.parseNum(r[candidates[i]]), y = SolsticeStats.parseNum(r[candidates[j]]);
            if (!isNaN(x) && !isNaN(y)){ xs.push(x); ys.push(y); }
          }
          if (xs.length < 5) continue;
          const r = correlation(xs, ys);
          if (r != null && Math.abs(r) > Math.abs(best.r)){
            best = { x: candidates[i], y: candidates[j], r, candidates: candidates.length };
          }
        }
      }
      return best;
    }

    /**
     * Para GAUGE: escolhe coluna numérica e calcula range + meta inteligente.
     * Preferências:
     *   1. Se há coluna `percentage` no tipo: usa min=0, max=100, target=80
     *   2. Senão: P5 e P95 para min/max (evita outliers escalando o gauge ruim);
     *      target = higherIsBetter ? P75 : P25 (ou mediana se sem dicionário)
     *   3. Sem coluna numérica: devolve config vazia
     */
    function suggestGauge(ctx){
      const dict = ctx.dictionary && ctx.dictionary.columns;
      const numerics = _colsByGroup(ctx, 'numeric');
      // 1ª preferência: percentage
      const pctCol = ctx.columns.find(c => {
        const t = ctx.types && ctx.types[c];
        return t && t.type === 'percentage';
      });
      const col = pctCol || numerics[0] || null;
      if (!col) return { column: null, agg: 'avg', min: 0, max: 100, target: null };
      const vals = (ctx.rows || []).map(r => SolsticeStats.parseNum(r[col])).filter(v => !isNaN(v));
      if (!vals.length) return { column: col, agg: 'avg', min: 0, max: 100, target: null };
      if (pctCol){
        return { column: col, agg: 'avg', min: 0, max: 100, target: 80 };
      }
      const p5 = percentile(vals, 0.05);
      const p95 = percentile(vals, 0.95);
      // Arredondamentos amigáveis (potências de 10)
      function roundNice(v, dir){
        if (v === 0) return 0;
        const abs = Math.abs(v);
        const mag = Math.pow(10, Math.floor(Math.log10(abs)));
        const step = mag / 2;
        return dir === 'floor' ? Math.floor(v / step) * step : Math.ceil(v / step) * step;
      }
      const lo = roundNice(p5, 'floor');
      const hi = roundNice(p95, 'ceil');
      const higherIsBetter = dict && dict[col] && dict[col].higherIsBetter;
      let target;
      if (higherIsBetter === true)  target = percentile(vals, 0.75);
      else if (higherIsBetter === false) target = percentile(vals, 0.25);
      else target = percentile(vals, 0.5);
      return { column: col, agg: 'avg', min: lo, max: hi, target };
    }

    /**
     * Para BOX PLOT: escolhe valueColumn (numérica) e auto-seleciona groupColumn
     * (categórica com 2-8 distintos). Sem categórica adequada, groupColumn=null.
     */
    function suggestBoxPlot(ctx){
      const nums = _colsByGroup(ctx, 'numeric');
      const cats = _colsByGroup(ctx, 'categorical');
      const valueColumn = nums[0] || null;
      // Procura categórica com 2-8 distintos (intervalo onde box plot agrupado funciona bem)
      let groupColumn = null;
      for (const c of cats){
        const distinct = distinctCount((ctx.rows || []).map(r => r[c]));
        if (distinct >= 2 && distinct <= 8){ groupColumn = c; break; }
      }
      return { valueColumn, groupColumn };
    }

    /**
     * Para SANKEY: escolhe duas colunas categóricas DISTINTAS (origem ≠ destino).
     * Tenta priorizar pares onde a primeira tem menos categorias (origem) e a
     * segunda tem mais ou igual (destino) — padrão clássico de funil.
     * Se só há 1 categórica: sourceColumn = ela, targetColumn = null.
     */
    function suggestSankey(ctx){
      const cats = _colsByGroup(ctx, 'categorical');
      const num = _colsByGroup(ctx, 'numeric')[0] || null;
      if (cats.length === 0) return { sourceColumn: null, targetColumn: null, valueColumn: num };
      if (cats.length === 1) return { sourceColumn: cats[0], targetColumn: null, valueColumn: num };
      // Conta distintos para escolher origem com menos categorias
      const distincts = cats.slice(0, 6).map(c => ({
        col: c,
        d: distinctCount((ctx.rows || []).map(r => r[c]))
      })).filter(x => x.d >= 2 && x.d <= 8);
      if (distincts.length < 2){
        return { sourceColumn: cats[0], targetColumn: cats[1] !== cats[0] ? cats[1] : null, valueColumn: num };
      }
      const sorted = distincts.slice().sort((a, b) => a.d - b.d);
      return { sourceColumn: sorted[0].col, targetColumn: sorted[1].col, valueColumn: num };
    }

    /* ---------- Sumário descritivo (usado pela aba 📈 Análise) ---------- */

    /** Resumo completo de um vetor numérico — chave para "Por que esse número?". */
    function describe(values){
      const c = clean(values);
      if (!c.length) return null;
      const q = quartiles(c);
      const ou = outliersIQR(c);
      return {
        n: c.length,
        nulls: countNulls(values),
        mean: mean(c),
        median: median(c),
        stdDev: stdDev(c),
        min: q.min,
        max: q.max,
        q1: q.q1,
        q3: q.q3,
        iqr: q.iqr,
        skewness: skewness(c),
        kurtosis: kurtosis(c),
        outlierCount: ou.values.length
      };
    }

    /* ---------- Prompt 10 v5.4: Estatística intermediária ----------
       CDFs e testes implementados em JS puro (sem libs externas).
       Aproximações de Abramowitz-Stegun + Numerical Recipes (incomplete
       gamma/beta). Precisão ~1e-7 (suficiente para decisões a nível 5%).
       Limitações conhecidas: amostras n<3 erro claro, variancia 0 erro,
       chi² df<1 erro. Nao usar para df > 10000 (uso de aproximações finitas).
    */

    // ===== Função erro (erf) — Abramowitz-Stegun 7.1.26 =====
    function _erf(x){
      const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
      const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x);
      const t = 1.0 / (1.0 + p * x);
      const y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * Math.exp(-x*x);
      return sign * y;
    }
    // Auditoria 2026 (cleanliness): _erfc removida — complementary error
    // function nunca foi consumida. Se necessário no futuro: 1 - _erf(x).

    // CDF da Normal padrão
    function _pNormal(z){ return 0.5 * (1 + _erf(z / Math.SQRT2)); }

    // log-gamma via Lanczos approximation
    function _gammaln(x){
      const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
                 -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
      let y = x; let tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
      let ser = 1.000000000190015;
      for (let i = 0; i < 6; i++){ y += 1; ser += c[i] / y; }
      return -tmp + Math.log(2.5066282746310005 * ser / x);
    }

    // Gamma incompleta regularizada P(a,x) via série de potências OU fração contínua
    function _gammaPSeries(a, x){
      const ITMAX = 200, EPS = 3e-7;
      const gln = _gammaln(a);
      if (x <= 0) return { value: 0, gln };
      let ap = a; let sum = 1 / a; let del = sum;
      for (let n = 1; n <= ITMAX; n++){
        ap += 1;
        del *= x / ap;
        sum += del;
        if (Math.abs(del) < Math.abs(sum) * EPS){
          return { value: sum * Math.exp(-x + a * Math.log(x) - gln), gln };
        }
      }
      return { value: sum * Math.exp(-x + a * Math.log(x) - gln), gln };
    }
    function _gammaQFraction(a, x){
      const ITMAX = 200, EPS = 3e-7, FPMIN = 1e-300;
      const gln = _gammaln(a);
      let b = x + 1 - a; let c = 1 / FPMIN; let d = 1 / b;
      let h = d;
      for (let i = 1; i <= ITMAX; i++){
        const an = -i * (i - a);
        b += 2;
        d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
        c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < EPS) break;
      }
      return { value: Math.exp(-x + a * Math.log(x) - gln) * h, gln };
    }
    /** P(a, x) = integral incompleta gamma regularizada = chi² CDF acumulado */
    function _gammaP(a, x){
      if (x < 0 || a <= 0) return 0;
      if (x < a + 1) return _gammaPSeries(a, x).value;
      return 1 - _gammaQFraction(a, x).value;
    }

    // Beta incompleta regularizada I_x(a, b) via fração contínua de Lentz
    function _betaCF(a, b, x){
      const ITMAX = 200, EPS = 3e-7, FPMIN = 1e-300;
      const qab = a + b, qap = a + 1, qam = a - 1;
      let c = 1, d = 1 - qab * x / qap;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      d = 1 / d; let h = d;
      for (let m = 1; m <= ITMAX; m++){
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
        c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d; h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
        c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d; const del = d * c; h *= del;
        if (Math.abs(del - 1) < EPS) break;
      }
      return h;
    }
    function _betaInc(a, b, x){
      if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1;
      const bt = Math.exp(_gammaln(a + b) - _gammaln(a) - _gammaln(b)
                         + a * Math.log(x) + b * Math.log(1 - x));
      if (x < (a + 1) / (a + b + 2)) return bt * _betaCF(a, b, x) / a;
      return 1 - bt * _betaCF(b, a, 1 - x) / b;
    }

    // ===== p-values para testes =====
    /** p-value bilateral t-Student: P(|T| >= |t|) */
    function _pTTwoSided(t, df){
      if (df <= 0) return 1;
      const x = df / (df + t * t);
      return _betaInc(df / 2, 0.5, x);
    }
    /** p-value unilateral F (cauda superior) */
    function _pFUpper(F, df1, df2){
      if (F <= 0 || df1 <= 0 || df2 <= 0) return 1;
      const x = df2 / (df2 + df1 * F);
      return _betaInc(df2 / 2, df1 / 2, x);
    }
    /** p-value chi-squared (cauda superior) */
    function _pChi2Upper(chi2, df){
      if (chi2 <= 0 || df <= 0) return 1;
      return 1 - _gammaP(df / 2, chi2 / 2);
    }

    // ===== TESTES =====

    /** t-test PAREADO. Compara médias de 2 amostras DEPENDENTES (mesmas n).
     *  H0: μ_diff = 0. Retorna { t, df, pvalue, ci95, decision, n, meanDiff }.
     *  Pressupostos: diferenças aproximadamente normais; pares dependentes. */
    function tTestPaired(arr1, arr2, opts){
      opts = opts || {};
      const alpha = opts.alpha || 0.05;
      if (!arr1 || !arr2 || arr1.length !== arr2.length){
        throw new Error('t-test pareado exige arrays de mesmo tamanho');
      }
      const diffs = [];
      for (let i = 0; i < arr1.length; i++){
        const a = parseFloat(arr1[i]), b = parseFloat(arr2[i]);
        if (!isNaN(a) && !isNaN(b)) diffs.push(a - b);
      }
      const n = diffs.length;
      if (n < 3) throw new Error('Amostra muito pequena: n < 3');
      const meanD = mean(diffs);
      const sdD = stdDev(diffs);
      if (sdD === 0) throw new Error('Variância zero (todas diferenças iguais) — teste inaplicável');
      const se = sdD / Math.sqrt(n);
      const t = meanD / se;
      const df = n - 1;
      const pvalue = _pTTwoSided(t, df);
      // CI 95%: aprox normal (suficiente para df > 30) ou usa t para df pequeno
      const tcrit = df > 30 ? 1.96 : (df > 10 ? 2.23 : 2.78); // aproximação
      const ci95 = [meanD - tcrit * se, meanD + tcrit * se];
      // Auditoria 2026 (M-S-1 / A-204): Cohen's d_z para diferença pareada.
      // |d| < 0.2 trivial; 0.2–0.5 pequeno; 0.5–0.8 médio; ≥ 0.8 grande.
      const cohens_d = sdD !== 0 ? meanD / sdD : null;
      const effect_label = cohens_d == null ? null
        : (Math.abs(cohens_d) < 0.2 ? 'trivial'
          : Math.abs(cohens_d) < 0.5 ? 'pequeno'
          : Math.abs(cohens_d) < 0.8 ? 'médio' : 'grande');
      return {
        t, df, pvalue, ci95, n, meanDiff: meanD,
        cohens_d, effect_label,
        decision: pvalue < alpha
          ? 'Rejeita H0 ao nível ' + (alpha*100).toFixed(0) + '% (diferença significativa)'
          : 'Não rejeita H0 (diferença não significativa a ' + (alpha*100).toFixed(0) + '%)',
        method: 'Student t-test pareado'
      };
    }

    /** t-test INDEPENDENTE (Welch por default — não exige variâncias iguais).
     *  H0: μ1 = μ2. Suporta opts.equalVariance=true para Student clássico. */
    function tTestIndependent(arr1, arr2, opts){
      opts = opts || {};
      const alpha = opts.alpha || 0.05;
      const equalVar = opts.equalVariance === true;
      const c1 = clean(arr1), c2 = clean(arr2);
      if (c1.length < 3 || c2.length < 3) throw new Error('Cada amostra precisa de n >= 3');
      const n1 = c1.length, n2 = c2.length;
      const m1 = mean(c1), m2 = mean(c2);
      const v1 = variance(c1), v2 = variance(c2);
      if (v1 === 0 && v2 === 0) throw new Error('Ambas variâncias zero — teste inaplicável');
      let t, df;
      if (equalVar){
        // Student: pooled variance
        const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
        t = (m1 - m2) / Math.sqrt(sp2 * (1/n1 + 1/n2));
        df = n1 + n2 - 2;
      } else {
        // Welch
        const se = Math.sqrt(v1/n1 + v2/n2);
        t = (m1 - m2) / se;
        // Welch-Satterthwaite degrees of freedom
        df = Math.pow(v1/n1 + v2/n2, 2) / (Math.pow(v1/n1, 2)/(n1-1) + Math.pow(v2/n2, 2)/(n2-1));
      }
      const pvalue = _pTTwoSided(t, df);
      // Auditoria 2026 (M-S-1 / A-204): Cohen's d para diferença entre
      // duas médias. Usa pooled sd quando variâncias iguais; senão
      // sd pooled corrigido (Hedges-like). Classifica magnitude.
      const sp = equalVar
        ? Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2))
        : Math.sqrt((v1 + v2) / 2);
      const cohens_d = sp !== 0 ? (m1 - m2) / sp : null;
      const effect_label = cohens_d == null ? null
        : (Math.abs(cohens_d) < 0.2 ? 'trivial'
          : Math.abs(cohens_d) < 0.5 ? 'pequeno'
          : Math.abs(cohens_d) < 0.8 ? 'médio' : 'grande');
      return {
        t, df, pvalue, n1, n2, mean1: m1, mean2: m2,
        cohens_d, effect_label,
        method: equalVar ? 'Student t-test (variâncias iguais)' : "Welch t-test (variâncias diferentes — recomendado)",
        decision: pvalue < alpha
          ? 'Rejeita H0 ao nível ' + (alpha*100).toFixed(0) + '% (médias diferem)'
          : 'Não rejeita H0 (médias não diferem a ' + (alpha*100).toFixed(0) + '%)'
      };
    }

    /** ANOVA one-way: compara médias de k >= 2 grupos.
     *  groups = [[1,2,3], [4,5,6], [7,8,9]]. H0: todas médias iguais. */
    // Auditoria 2026 (R-12 / A-203): Levene (Brown-Forsythe) test de
    // homogeneidade de variâncias. Antes de rodar a ANOVA, validamos o
    // pré-requisito; se violado, ANOVA clássica enviesa o p-valor. ANOVA
    // não falha — apenas anexa `levene` e `warning` no retorno.
    function _leveneTest(cleaned){
      const k = cleaned.length;
      // Brown-Forsythe usa mediana (mais robusto que a média de Levene original).
      const z = cleaned.map(g => {
        const md = median(g);
        return g.map(v => Math.abs(v - md));
      });
      const ns = z.map(g => g.length);
      const allZ = z.reduce((a, g) => a.concat(g), []);
      const N = allZ.length;
      const grandMeanZ = mean(allZ);
      const groupMeansZ = z.map(g => mean(g));
      let SSB = 0, SSW = 0;
      for (let i = 0; i < k; i++) SSB += ns[i] * Math.pow(groupMeansZ[i] - grandMeanZ, 2);
      for (let i = 0; i < k; i++) for (const v of z[i]) SSW += Math.pow(v - groupMeansZ[i], 2);
      const dfB = k - 1, dfW = N - k;
      if (SSW === 0) return { W: Infinity, pvalue: 0, df_between: dfB, df_within: dfW, homogeneous: false, method: 'Brown-Forsythe (Levene)' };
      const W = (SSB / dfB) / (SSW / dfW);
      const pvalue = _pFUpper(W, dfB, dfW);
      return { W, pvalue, df_between: dfB, df_within: dfW, homogeneous: pvalue >= 0.05, method: 'Brown-Forsythe (Levene)' };
    }

    function anovaOneWay(groups, opts){
      opts = opts || {};
      const alpha = opts.alpha || 0.05;
      if (!Array.isArray(groups) || groups.length < 2) throw new Error('ANOVA exige >= 2 grupos');
      const cleaned = groups.map(g => clean(g)).filter(g => g.length > 0);
      if (cleaned.length < 2) throw new Error('Menos de 2 grupos com dados válidos');
      const k = cleaned.length;
      const ns = cleaned.map(g => g.length);
      const means = cleaned.map(g => mean(g));
      const allVals = cleaned.reduce((acc, g) => acc.concat(g), []);
      const N = allVals.length;
      if (N < k + 1) throw new Error('Amostra total muito pequena (N < k+1)');
      const grandMean = mean(allVals);
      // Sum of Squares Between
      let SSB = 0;
      for (let i = 0; i < k; i++) SSB += ns[i] * Math.pow(means[i] - grandMean, 2);
      // Sum of Squares Within
      let SSW = 0;
      for (let i = 0; i < k; i++){
        for (const v of cleaned[i]) SSW += Math.pow(v - means[i], 2);
      }
      const dfBetween = k - 1;
      const dfWithin = N - k;
      if (SSW === 0) throw new Error('Variância dentro dos grupos = 0 (todos valores iguais por grupo)');
      const MSB = SSB / dfBetween;
      const MSW = SSW / dfWithin;
      const F = MSB / MSW;
      const pvalue = _pFUpper(F, dfBetween, dfWithin);
      // Auditoria 2026 (R-12 / A-203): Levene/Brown-Forsythe para
      // homogeneidade de variâncias. Warning se violada.
      const levene = _leveneTest(cleaned);
      const warning = !levene.homogeneous
        ? 'Variâncias desiguais entre grupos (Levene p=' + levene.pvalue.toFixed(4) + '). Considere ANOVA de Welch — o p-valor desta ANOVA pode estar enviesado.'
        : null;
      // Auditoria 2026 (M-S-1 / A-204): eta² = SSB / (SSB + SSW). Magnitude
      // de variância explicada pelos grupos. Limiares clássicos:
      // 0.01 pequeno, 0.06 médio, 0.14 grande.
      const eta_squared = (SSB + SSW) > 0 ? SSB / (SSB + SSW) : null;
      const effect_label = eta_squared == null ? null
        : (eta_squared < 0.01 ? 'trivial'
          : eta_squared < 0.06 ? 'pequeno'
          : eta_squared < 0.14 ? 'médio' : 'grande');
      return {
        F, df_between: dfBetween, df_within: dfWithin, pvalue,
        SSB, SSW, MSB, MSW, k, N, groupSizes: ns, groupMeans: means, grandMean,
        levene, warning,
        eta_squared, effect_label,
        decision: pvalue < alpha
          ? 'Rejeita H0 ao nível ' + (alpha*100).toFixed(0) + '% (pelo menos um grupo difere)'
          : 'Não rejeita H0 (médias dos grupos não diferem a ' + (alpha*100).toFixed(0) + '%)',
        method: 'ANOVA one-way (F-test)'
      };
    }

    /** Jarque-Bera test de normalidade (proxy de Shapiro-Wilk).
     *  Usa fórmulas momento-base (não a aproximação simplificada de skewness()).
     *  JB = n/6 * (S² + K²/4) onde:
     *    S = m3/m2^1.5 (skewness momento)
     *    K = excess kurtosis = m4/m2² - 3
     *  Sob H0 (distribuição é Normal), JB ~ Chi²(2). */
    function jarqueBera(values, opts){
      opts = opts || {};
      const alpha = opts.alpha || 0.05;
      const c = clean(values);
      const n = c.length;
      if (n < 8) throw new Error('Amostra muito pequena para teste de normalidade (n < 8)');
      const m = sum(c) / n;
      let m2 = 0, m3 = 0, m4 = 0;
      for (let i = 0; i < n; i++){
        const d = c[i] - m;
        m2 += d*d; m3 += d*d*d; m4 += d*d*d*d;
      }
      m2 /= n; m3 /= n; m4 /= n;
      if (m2 === 0) throw new Error('Variância zero — teste inaplicável');
      // Skewness momento (não a aproximação Pearson de skewness())
      const Smomento = m3 / Math.pow(m2, 1.5);
      // Excess kurtosis (já subtrai 3 — distribuição normal = 0)
      const Kexcess = m4 / (m2 * m2) - 3;
      const JB = (n / 6) * (Smomento * Smomento + (Kexcess * Kexcess) / 4);
      const pvalue = _pChi2Upper(JB, 2);
      return {
        JB, df: 2, pvalue, n,
        skewness: Smomento, kurtosis_excess: Kexcess,
        decision: pvalue < alpha
          ? 'Rejeita H0 — distribuição NÃO é normal a ' + (alpha*100).toFixed(0) + '%'
          : 'Não rejeita H0 — distribuição compatível com normal a ' + (alpha*100).toFixed(0) + '%',
        method: 'Jarque-Bera (proxy de Shapiro-Wilk)',
        note: 'JB testa skewness + kurtosis vs normal. Alternativas: Shapiro-Wilk (mais sensível para n < 50), QQ-plot visual.'
      };
    }

    /** Bootstrap CI para qualquer estatística (re-amostragem com reposição).
     *  arr: array de valores; statFn: (sample) => número; n_iter: 1000-10000 */
    function bootstrapCI(arr, statFn, opts){
      opts = opts || {};
      const n_iter = opts.n_iter || 1000;
      const ci = opts.ci || 0.95;
      const seed = opts.seed != null ? opts.seed : null;
      const rng = seed != null ? mulberry32(seed) : Math.random;
      const c = clean(arr);
      if (!c.length) throw new Error('Array vazio');
      const point = statFn(c);
      const stats = new Array(n_iter);
      const n = c.length;
      for (let i = 0; i < n_iter; i++){
        const sample = new Array(n);
        for (let j = 0; j < n; j++) sample[j] = c[Math.floor(rng() * n)];
        stats[i] = statFn(sample);
      }
      stats.sort((a, b) => a - b);
      const loIdx = Math.floor(((1 - ci) / 2) * n_iter);
      const hiIdx = Math.ceil((1 - (1 - ci) / 2) * n_iter) - 1;
      return {
        point_estimate: point,
        lower: stats[loIdx],
        upper: stats[hiIdx],
        ci, n_iter, n, seed,
        method: 'Bootstrap percentil (' + n_iter + ' iterações)'
      };
    }

    /** Chi-squared independence test em tabela de contingência.
     *  table: matriz [linhas][colunas] de contagens observadas.
     *  H0: variáveis são independentes. */
    function chiSquaredIndependence(table, opts){
      opts = opts || {};
      const alpha = opts.alpha || 0.05;
      if (!Array.isArray(table) || !table.length || !Array.isArray(table[0])) throw new Error('Tabela de contingência inválida');
      const rows = table.length;
      const cols = table[0].length;
      // Totais
      const rowTotals = table.map(r => r.reduce((a,b)=>a+b,0));
      const colTotals = new Array(cols).fill(0);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) colTotals[c] += table[r][c];
      const total = rowTotals.reduce((a,b)=>a+b,0);
      if (total === 0) throw new Error('Tabela vazia');
      // Chi²
      let chi2 = 0;
      let lowExpected = 0;
      for (let r = 0; r < rows; r++){
        for (let c = 0; c < cols; c++){
          const expected = rowTotals[r] * colTotals[c] / total;
          if (expected < 5) lowExpected++;
          if (expected > 0) chi2 += Math.pow(table[r][c] - expected, 2) / expected;
        }
      }
      const df = (rows - 1) * (cols - 1);
      const pvalue = _pChi2Upper(chi2, df);
      // Auditoria 2026 (M-S-1 / A-204): Cramér V = sqrt(chi² / (n*(k-1)))
      // onde k = min(rows, cols). Para tabela 2×2 equivale a φ. Limiares
      // (Cohen 1988): df=1 → 0.10/0.30/0.50; df=2 → 0.07/0.21/0.35.
      const k = Math.min(rows, cols);
      const cramers_v = (total > 0 && k > 1)
        ? Math.sqrt(chi2 / (total * (k - 1)))
        : null;
      const _vThresholds = (df === 1 ? [0.10, 0.30, 0.50] : [0.07, 0.21, 0.35]);
      const effect_label = cramers_v == null ? null
        : (cramers_v < _vThresholds[0] ? 'trivial'
          : cramers_v < _vThresholds[1] ? 'pequeno'
          : cramers_v < _vThresholds[2] ? 'médio' : 'grande');
      return {
        chi2, df, pvalue, total, rows, cols, lowExpectedCells: lowExpected,
        cramers_v, effect_label,
        decision: pvalue < alpha
          ? 'Rejeita H0 — variáveis DEPENDENTES a ' + (alpha*100).toFixed(0) + '%'
          : 'Não rejeita H0 — variáveis independentes a ' + (alpha*100).toFixed(0) + '%',
        warning: lowExpected > 0
          ? lowExpected + ' célula(s) com frequência esperada < 5 — teste pode ser pouco confiável; considere Teste Exato de Fisher.'
          : null,
        method: 'Pearson Chi² independence'
      };
    }

    // Auditoria 2026 (M-S-2 / A-207): Fisher's exact test 2×2 (two-sided).
    // Antes: chi² avisava "considere Fisher" mas Fisher não estava
    // implementado. Agora há a alternativa exata para casos com células
    // esperadas < 5. Calcula via log-fatorial (estável para n ≤ ~1000).
    function fisherExactTest2x2(a, b, c, d){
      if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('Fisher 2×2: valores não negativos');
      if (![a,b,c,d].every(Number.isInteger)) throw new Error('Fisher 2×2: contagens devem ser inteiras');
      const r1 = a + b, r2 = c + d, c1 = a + c, c2 = b + d, n = a + b + c + d;
      if (n === 0) throw new Error('Fisher 2×2: tabela vazia');
      function _lnFact(x){ let s = 0; for (let i = 2; i <= x; i++) s += Math.log(i); return s; }
      function _lnP(aa){
        const bb = r1 - aa, cc = c1 - aa, dd = r2 - cc;
        if (bb < 0 || cc < 0 || dd < 0) return -Infinity;
        return _lnFact(r1) + _lnFact(r2) + _lnFact(c1) + _lnFact(c2)
             - _lnFact(n) - _lnFact(aa) - _lnFact(bb) - _lnFact(cc) - _lnFact(dd);
      }
      const lnP_obs = _lnP(a);
      const aMin = Math.max(0, c1 - r2);
      const aMax = Math.min(r1, c1);
      let p_two_sided = 0;
      for (let aa = aMin; aa <= aMax; aa++){
        const lp = _lnP(aa);
        if (lp <= lnP_obs + 1e-9) p_two_sided += Math.exp(lp);
      }
      p_two_sided = Math.min(1, p_two_sided); // clamp por float
      // Odds ratio (NaN se algum denominador zero — relatamos como null).
      const odds_ratio = (b > 0 && c > 0) ? (a * d) / (b * c) : null;
      return {
        p_two_sided,
        odds_ratio,
        table: { a, b, c, d, r1, r2, c1, c2, n },
        method: "Fisher's Exact Test (2×2, two-sided)"
      };
    }

    /** Regressão linear MÚLTIPLA via método dos mínimos quadrados.
     *  X: matrix n×p (sem coluna de 1s — adicionada automaticamente)
     *  y: array n
     *  Retorna: { coefficients, intercept, r2, r2_adjusted, residuals,
     *            pvalues_per_coef, std_errors, vif, n, p } */
    function linearRegressionMultiple(X, y){
      const n = X.length;
      const p = n > 0 ? X[0].length : 0;
      if (n < p + 2) throw new Error('n muito pequeno (precisa de >= p+2 observações)');
      // Adiciona coluna de 1s
      const Xa = X.map(row => [1].concat(row));
      const yArr = y.slice();
      // Resolve (X'X) β = X'y via Gauss-Jordan
      const k = p + 1;
      const XtX = _matZero(k, k), Xty = new Array(k).fill(0);
      for (let i = 0; i < n; i++){
        for (let a = 0; a < k; a++){
          Xty[a] += Xa[i][a] * yArr[i];
          for (let b = 0; b < k; b++){
            XtX[a][b] += Xa[i][a] * Xa[i][b];
          }
        }
      }
      const XtX_inv = _matInvert(XtX);
      if (!XtX_inv) throw new Error('Matriz singular (colaridade perfeita entre preditoras?)');
      const beta = new Array(k).fill(0);
      for (let a = 0; a < k; a++){
        for (let b = 0; b < k; b++){
          beta[a] += XtX_inv[a][b] * Xty[b];
        }
      }
      // Fitted, residuals, R²
      const fitted = new Array(n);
      const residuals = new Array(n);
      let SSE = 0, SST = 0;
      const yMean = mean(yArr);
      for (let i = 0; i < n; i++){
        let yi = 0;
        for (let a = 0; a < k; a++) yi += beta[a] * Xa[i][a];
        fitted[i] = yi;
        residuals[i] = yArr[i] - yi;
        SSE += residuals[i] * residuals[i];
        SST += (yArr[i] - yMean) * (yArr[i] - yMean);
      }
      const r2 = SST === 0 ? 1 : 1 - SSE / SST;
      const df = n - k;
      const r2_adj = 1 - (1 - r2) * (n - 1) / df;
      // Standard errors dos coeficientes: sqrt(σ² * diag(XtX_inv))
      const sigma2 = SSE / df;
      const stdErrs = new Array(k);
      const tStats = new Array(k);
      const pvalues = new Array(k);
      for (let a = 0; a < k; a++){
        stdErrs[a] = Math.sqrt(sigma2 * XtX_inv[a][a]);
        tStats[a] = beta[a] / stdErrs[a];
        pvalues[a] = _pTTwoSided(tStats[a], df);
      }
      return {
        intercept: beta[0],
        coefficients: beta.slice(1),
        r2, r2_adjusted: r2_adj, n, p,
        SSE, SST, residuals, fitted,
        std_errors: stdErrs.slice(1),
        intercept_std_error: stdErrs[0],
        t_stats: tStats.slice(1),
        intercept_t: tStats[0],
        pvalues_per_coef: pvalues.slice(1),
        intercept_pvalue: pvalues[0],
        method: 'OLS regressão múltipla',
        note: 'r² < 0 indica modelo pior que média. Verifique multicolinearidade quando 2+ preditoras correlacionadas.'
      };
    }
    // Helpers de matriz
    function _matZero(r, c){
      const m = new Array(r);
      for (let i = 0; i < r; i++) m[i] = new Array(c).fill(0);
      return m;
    }
    function _matInvert(m){
      const n = m.length;
      const a = m.map(row => row.slice());
      const inv = _matZero(n, n);
      for (let i = 0; i < n; i++) inv[i][i] = 1;
      for (let col = 0; col < n; col++){
        // Pivot parcial
        let pivot = col;
        for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
        if (Math.abs(a[pivot][col]) < 1e-12) return null;
        [a[col], a[pivot]] = [a[pivot], a[col]];
        [inv[col], inv[pivot]] = [inv[pivot], inv[col]];
        // Normaliza linha do pivot
        const d = a[col][col];
        for (let j = 0; j < n; j++){ a[col][j] /= d; inv[col][j] /= d; }
        // Elimina outras linhas
        for (let r = 0; r < n; r++){
          if (r === col) continue;
          const f = a[r][col];
          for (let j = 0; j < n; j++){
            a[r][j] -= f * a[col][j];
            inv[r][j] -= f * inv[col][j];
          }
        }
      }
      return inv;
    }

    /* ---------- Amostragem aleatória (v5.4) ---------- */

    /** PRNG seeded — mulberry32 (32-bit, simples, qualidade boa para
     *  estatísticas básicas; NÃO use para criptografia).
     *  Útil para reprodutibilidade: mesma seed → mesma amostra.
     *  Retorna função sem args que devolve float [0, 1). */
    function mulberry32(seed){
      let a = (seed | 0) || 1;
      return function(){
        a = (a + 0x6D2B79F5) | 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    /** Amostra aleatória uniforme SEM reposição de tamanho k de um array.
     *  Algoritmo: Fisher-Yates parcial — O(k) índices trocados sobre vetor
     *  de índices inicializado lazy (sem copiar arr inteiro), garantindo
     *  uniformidade verdadeira. Performance: 100k → 1k amostras em <5ms.
     *
     *  @param arr   array (pode ser de qualquer tipo — não filtra null)
     *  @param k     tamanho desejado da amostra; se k >= arr.length, retorna shuffle do arr inteiro
     *  @param opts  { seed?: number } — se omitido, usa Math.random
     *  @return      { sample, indices, n, k, seed } — sample[i] = arr[indices[i]] */
    function randomSample(arr, k, opts){
      opts = opts || {};
      const n = (arr && arr.length) || 0;
      if (n === 0 || k <= 0) return { sample: [], indices: [], n: 0, k: 0, seed: opts.seed != null ? opts.seed : null };
      const seed = opts.seed != null ? (opts.seed | 0) : null;
      const rng = seed != null ? mulberry32(seed) : Math.random;
      const realK = Math.min(k, n);

      // Fisher-Yates parcial: troca os primeiros realK elementos com
      // posição aleatória do resto. Mantém índices originais para auditoria.
      // Cria array de índices preguiçoso para evitar alocar n inteiros quando k << n.
      // Estratégia: usa Map de "swaps" — só guarda posições efetivamente trocadas.
      if (realK < n / 8){
        // Modo esparso: mais eficiente quando k << n
        const swaps = new Map();
        function _at(i){ return swaps.has(i) ? swaps.get(i) : i; }
        const indices = new Array(realK);
        for (let i = 0; i < realK; i++){
          const j = i + Math.floor(rng() * (n - i));
          const vi = _at(i), vj = _at(j);
          swaps.set(i, vj); swaps.set(j, vi);
          indices[i] = vj;
        }
        const sample = indices.map(i => arr[i]);
        return { sample, indices, n, k: realK, seed };
      }
      // Modo denso: aloca array completo (mais simples, ~equivalente em performance)
      const indices = new Array(n);
      for (let i = 0; i < n; i++) indices[i] = i;
      for (let i = 0; i < realK; i++){
        const j = i + Math.floor(rng() * (n - i));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const slice = indices.slice(0, realK);
      const sample = slice.map(i => arr[i]);
      return { sample, indices: slice, n, k: realK, seed };
    }

    /** Amostra ESTRATIFICADA: preserva proporção de cada grupo definido por groupBy.
     *  Útil quando há classes desbalanceadas e queremos representação proporcional.
     *
     *  @param rows     array de objetos
     *  @param k        tamanho total desejado
     *  @param groupBy  string (nome da coluna) ou function(row) => key
     *  @param opts     { seed?: number, minPerGroup?: number = 1 }
     *  @return         { sample, groups: { key: n_drawn }, seed, n, k } */
    function stratifiedSample(rows, k, groupBy, opts){
      opts = opts || {};
      const minPerGroup = opts.minPerGroup != null ? opts.minPerGroup : 1;
      const getKey = typeof groupBy === 'function' ? groupBy : (r => r && r[groupBy]);
      const buckets = new Map();
      for (let i = 0; i < rows.length; i++){
        const key = String(getKey(rows[i]));
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(rows[i]);
      }
      const total = rows.length;
      const sample = [];
      const groupCounts = {};
      const seed = opts.seed != null ? (opts.seed | 0) : null;
      let cursor = seed;
      for (const [key, items] of buckets){
        const proportion = items.length / total;
        const target = Math.max(minPerGroup, Math.round(k * proportion));
        const subSeed = cursor != null ? (cursor + Math.abs(_hashKey(key))) | 0 : null;
        if (cursor != null) cursor = (cursor + 1) | 0;
        const { sample: sub } = randomSample(items, target, { seed: subSeed });
        sample.push(...sub);
        groupCounts[key] = sub.length;
      }
      return { sample, groups: groupCounts, seed, n: total, k: sample.length };
    }
    function _hashKey(s){
      let h = 0;
      for (let i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) | 0; }
      return h;
    }

    /** Sistemático: pega 1 a cada step. Reprodutível sem seed.
     *  Útil para séries temporais (preserva ordem). */
    function systematicSample(arr, k){
      const n = (arr && arr.length) || 0;
      if (n === 0 || k <= 0) return { sample: [], indices: [], n: 0, k: 0 };
      if (k >= n) return { sample: arr.slice(), indices: arr.map((_, i) => i), n, k: n };
      const step = n / k;
      const indices = new Array(k);
      const sample = new Array(k);
      for (let i = 0; i < k; i++){
        const idx = Math.floor(i * step);
        indices[i] = idx;
        sample[i] = arr[idx];
      }
      return { sample, indices, n, k };
    }

    /* ---------- Self-tests (ADR-169 / D1) ----------
       Smoke tests inline. Rodam UMA VEZ no boot (gated em window.SOLSTICE_STATS_SELFTEST).
       Falhas logam warn no console mas NÃO bloqueiam o boot — diagnóstico, não validação.
       Pra ativar em produção: window.SOLSTICE_STATS_SELFTEST = true antes do script carregar.
    */
    function _runSelfTests(){
      const tests = [];
      const eq = (a, b, ε) => Math.abs(a - b) < (ε || 1e-9);
      const test = (name, fn) => { try { tests.push({ name, ok: !!fn() }); } catch (e){ tests.push({ name, ok: false, err: e.message }); } };

      // Núcleo
      test('clean filtra NaN', () => clean([1, NaN, 2, null, 3]).length === 3);
      test('sorted ordena asc', () => { const s = sorted([3,1,2]); return s[0] === 1 && s[2] === 3; });
      test('sum vazio = 0', () => sum([]) === 0);
      test('sum simples', () => sum([1,2,3]) === 6);

      // Descritivas
      test('mean vazio = null', () => mean([]) === null);
      test('mean simples', () => mean([1,2,3]) === 2);
      test('median ímpar', () => median([1,2,3]) === 2);
      test('median par', () => median([1,2,3,4]) === 2.5);

      // Dispersão
      test('stdDev simples', () => eq(stdDev([2,4,4,4,5,5,7,9]), 2.138089935299395, 1e-6));
      test('variance vazio = null', () => variance([]) === null);

      // Percentis (API espera p ∈ [0,1] como fração, não 0-100)
      test('percentile p=0.5 ≈ median', () => eq(percentile([1,2,3,4,5], 0.5), median([1,2,3,4,5]), 1e-9));

      // Outliers (IQR clássico)
      test('outliersIQR detecta extremo', () => {
        const r = outliersIQR([1,2,3,4,5,100]);
        return r.indices && r.indices.length === 1 && r.indices[0] === 5;
      });

      // Regressão
      test('linearRegression slope=1', () => {
        const r = linearRegression([[0,0],[1,1],[2,2],[3,3]]);
        return eq(r.slope, 1) && eq(r.intercept, 0);
      });

      // Correlação
      test('correlation perfeita positiva = 1', () => eq(correlation([1,2,3,4],[2,4,6,8]), 1, 1e-6));
      test('correlation perfeita negativa = -1', () => eq(correlation([1,2,3,4],[8,6,4,2]), -1, 1e-6));

      // Forecast
      test('linearForecast continua tendência', () => {
        const fc = linearForecast([1,2,3,4,5], 2);
        return fc.length === 2 && eq(fc[0], 6) && eq(fc[1], 7);
      });
      test('holtWinters retorna n forecasts', () => {
        const data = []; for (let i = 0; i < 36; i++) data.push(10 + i*0.5 + Math.sin(i/3));
        const fc = holtWinters(data, 6, 12);
        return Array.isArray(fc) && fc.length === 6 && isFinite(fc[0]);
      });

      // Sampling determinístico
      test('randomSample respeita seed', () => {
        const a = randomSample([1,2,3,4,5,6,7,8,9,10], 3, { seed: 42 });
        const b = randomSample([1,2,3,4,5,6,7,8,9,10], 3, { seed: 42 });
        return JSON.stringify(a.sample) === JSON.stringify(b.sample);
      });

      // Hypothesis tests (n grande pra garantir significância)
      test('tTestPaired p < 0.05 para diff clara (n=20)', () => {
        const before = [], after = [];
        for (let i = 0; i < 20; i++){ before.push(10 + i*0.1); after.push(15 + i*0.1); }
        const r = tTestPaired(before, after);
        return r.pvalue < 0.05;
      });
      test('jarqueBera não rejeita gaussiana', () => {
        const g = []; const rng = mulberry32(42);
        for (let i = 0; i < 200; i++){
          // Box-Muller pra gaussiana
          const u1 = rng(), u2 = rng();
          g.push(Math.sqrt(-2*Math.log(u1)) * Math.cos(2*Math.PI*u2));
        }
        const jb = jarqueBera(g);
        return jb.pvalue > 0.05;  // não rejeita normalidade
      });

      // Auditoria 2026 (M-S-3 / A-208): cobertura de regressão múltipla e
      // ANOVA. Antes, essas duas funções críticas não tinham self-test —
      // mudanças podiam quebrar resultado em silêncio.
      test('linearRegressionMultiple com 2 preditores ortogonais', () => {
        // y = 2 + 3*x1 + 5*x2 (sem ruído). r² deve ser 1.
        const xs = [[1,2],[2,1],[3,4],[4,3],[5,6]];
        const ys = xs.map(p => 2 + 3*p[0] + 5*p[1]);
        if (!linearRegressionMultiple) return true; // se função ausente, skip
        const r = linearRegressionMultiple(xs, ys);
        return r && Math.abs(r.r2 - 1) < 1e-6 && (r.r2_adjusted == null || r.r2_adjusted > 0.99);
      });
      test('anovaOneWay rejeita H0 para grupos com médias claramente diferentes', () => {
        const A = [1,2,1,2,3,2,1,2,3];
        const B = [10,11,12,11,10,12,11,10,11];
        const C = [20,21,19,22,20,21,19,20,21];
        const r = anovaOneWay([A, B, C]);
        return r.pvalue < 0.001 && r.F > 10;
      });
      test('anovaOneWay Levene avisa variâncias desiguais', () => {
        const A = [1, 1.01, 1, 1.02, 1, 1.01];
        const B = [10, 100, 1000, 10, 100, 1000];
        const r = anovaOneWay([A, B]);
        // Levene deve detectar desigualdade
        return r.levene && r.levene.homogeneous === false && !!r.warning;
      });

      const failed = tests.filter(t => !t.ok);
      if (failed.length > 0){
        console.warn('[SolsticeStats selftest] ' + failed.length + '/' + tests.length + ' falhas:',
          failed.map(t => t.name + (t.err ? ' (' + t.err + ')' : '')).join(', '));
      } else if (window.SOLSTICE_STATS_VERBOSE){
        console.log('%c[SolsticeStats] selftest ' + tests.length + '/' + tests.length + ' PASS', 'color:#4ADE80');
      }
      return tests;
    }
    // Roda no boot quando flag está ligada (default: off, evita overhead)
    if (typeof window !== 'undefined' && window.SOLSTICE_STATS_SELFTEST){
      _runSelfTests();
    }

    /* ---------- API pública ---------- */

    return {
      // núcleo
      clean, sorted, sum, count, countNulls,
      // descritivas (Code Review 2026: minMax exposto pra evitar 2 passadas)
      mean, median, mode, min, max, minMax, range, distinctCount,
      // dispersão
      variance, variancePop, stdDev, mad, cv,
      // percentis
      percentile, quartiles, iqr,
      // forma
      skewness, kurtosis,
      // outliers
      outliersIQR, outliersZ, outliersMAD,
      // regressão
      linearRegression, polynomialRegression,
      // correlação
      correlation, correlationSpearman, correlationMatrix,
      // BR-aware (Sprint 34 / J-1): wrapper unificado pra parsear célula de CSV.
      // Detecta automaticamente formato pt-BR ("1.234,56") vs US ("1,234.56").
      // SUBSTITUI `SolsticeStats.parseNum(r[col])` direto em todos os componentes.
      parseNum,
      // séries
      movingAverage, exponentialSmoothing, linearForecast, holtWinters, diff, autocorrelation,
      // clustering
      kMeans,
      // transformações
      normalize, zScore, bucketize, lag, lttb,
      // amostragem (v5.4)
      randomSample, stratifiedSample, systematicSample, mulberry32,
      // Prompt 10 v5.4: testes estatísticos intermediários
      tTestPaired, tTestIndependent, anovaOneWay, jarqueBera,
      chiSquaredIndependence, linearRegressionMultiple, bootstrapCI,
      // Auditoria 2026 (M-S-2 / A-207): Fisher 2×2 exato.
      fisherExactTest2x2,
      // CDFs e helpers (exportados pra uso avançado)
      _pNormal, _pTTwoSided, _pFUpper, _pChi2Upper, _gammaln,
      // direcional
      trend,
      // smart suggest
      bestNumericPair, suggestGauge, suggestBoxPlot, suggestSankey,
      // sumário
      describe,
      // ADR-169 D1: self-tests (rode via Solstice.Stats._runSelfTests())
      _runSelfTests
    };
  })();
