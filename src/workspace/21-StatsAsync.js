
  /* ============================================================
     Patch 1A (ADR-120) — SolsticeStatsAsync
     Web Worker real via Blob URL com cópia inline das funções puras
     de SolsticeStats. UI não trava em 50k+ linhas.
     API: call(fn, ...args) → Promise · smart(fn, rows, ...args) → routes by size.
     ============================================================ */
  const SolsticeStatsAsync = (function(){
    // Código do worker — funções puras inlined (subset do SolsticeStats: as mais usadas)
    const WORKER_SRC = `
      const fns = {
        clean: (vs) => (vs || []).map(v => typeof v === 'number' ? v : parseFloat(v)).filter(v => !isNaN(v) && isFinite(v)),
        sum: (vs) => { const c = fns.clean(vs); return c.reduce((a,b) => a+b, 0); },
        mean: (vs) => { const c = fns.clean(vs); return c.length ? fns.sum(c)/c.length : null; },
        median: (vs) => {
          const s = fns.clean(vs).slice().sort((a,b)=>a-b);
          if (!s.length) return null;
          const m = Math.floor(s.length/2);
          return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
        },
        min: (vs) => { const c = fns.clean(vs); return c.length ? SolsticeStats.min(c) : null; },
        max: (vs) => { const c = fns.clean(vs); return c.length ? SolsticeStats.max(c) : null; },
        count: (vs) => fns.clean(vs).length,
        stddev: (vs) => {
          const c = fns.clean(vs); if (c.length < 2) return null;
          const m = fns.mean(c);
          return Math.sqrt(c.reduce((a,v)=>a+(v-m)*(v-m),0)/(c.length-1));
        },
        outliersIQR: (vs, k) => {
          const s = fns.clean(vs).slice().sort((a,b)=>a-b);
          if (s.length < 4) return [];
          const q1 = s[Math.floor(s.length*0.25)];
          const q3 = s[Math.floor(s.length*0.75)];
          const iqr = q3 - q1; const kk = k || 1.5;
          const lo = q1 - kk*iqr, hi = q3 + kk*iqr;
          return s.filter(v => v < lo || v > hi);
        },
        linearRegression: (pts) => {
          const n = pts.length; if (n < 2) return null;
          let sx=0, sy=0, sxx=0, sxy=0;
          for (const [x,y] of pts){ sx+=x; sy+=y; sxx+=x*x; sxy+=x*y; }
          const denom = (n*sxx - sx*sx);
          if (denom === 0) return null;
          const slope = (n*sxy - sx*sy) / denom;
          const intercept = (sy - slope*sx)/n;
          let ssTot=0, ssRes=0; const ym=sy/n;
          for (const [x,y] of pts){ ssTot += (y-ym)*(y-ym); const yp = slope*x+intercept; ssRes += (y-yp)*(y-yp); }
          return { slope, intercept, r2: ssTot ? 1 - ssRes/ssTot : 0 };
        },
        trend: (vs) => {
          const c = fns.clean(vs); if (c.length < 3) return null;
          const pts = c.map((v,i) => [i,v]);
          const reg = fns.linearRegression(pts); if (!reg) return null;
          const m = fns.mean(c);
          const totalChange = reg.slope * (c.length - 1);
          const magnitude = m === 0 ? 0 : Math.abs(totalChange / m);
          let dir = 'flat';
          if (magnitude > 0.02) dir = reg.slope > 0 ? 'up' : 'down';
          return { direction: dir, slope: reg.slope, magnitude, r2: reg.r2, totalChange };
        },
        describe: (vs) => {
          const c = fns.clean(vs); if (!c.length) return null;
          return {
            n: c.length, mean: fns.mean(c), median: fns.median(c),
            min: fns.min(c), max: fns.max(c), stddev: fns.stddev(c)
          };
        },
        correlation: (xs, ys) => {
          const n = Math.min(xs.length, ys.length);
          if (n < 2) return 0;
          let sx=0, sy=0;
          for (let i = 0; i < n; i++){ sx += xs[i]; sy += ys[i]; }
          const mx = sx/n, my = sy/n;
          let num=0, dx=0, dy=0;
          for (let i = 0; i < n; i++){
            const a = xs[i] - mx, b = ys[i] - my;
            num += a*b; dx += a*a; dy += b*b;
          }
          return (dx === 0 || dy === 0) ? 0 : num / Math.sqrt(dx*dy);
        },
        lttb: (data, threshold) => {
          if (threshold >= data.length || threshold === 0) return data.slice();
          const sampled = [];
          const bucketSize = (data.length - 2) / (threshold - 2);
          sampled.push(data[0]);
          let a = 0;
          for (let i = 0; i < threshold - 2; i++){
            const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
            const rangeEnd = Math.floor((i + 2) * bucketSize) + 1;
            const rangeLen = rangeEnd - rangeStart;
            let avgX = 0, avgY = 0, count = 0;
            for (let j = rangeStart; j < rangeEnd && j < data.length; j++){ avgX += data[j][0]; avgY += data[j][1]; count++; }
            avgX /= count; avgY /= count;
            const rs = Math.floor(i * bucketSize) + 1;
            const re = Math.floor((i + 1) * bucketSize) + 1;
            let maxA = -1; let nextA = a;
            const pax = data[a][0], pay = data[a][1];
            for (let j = rs; j < re && j < data.length; j++){
              const area = Math.abs((pax - avgX) * (data[j][1] - pay) - (pax - data[j][0]) * (avgY - pay)) * 0.5;
              if (area > maxA){ maxA = area; nextA = j; }
            }
            sampled.push(data[nextA]); a = nextA;
          }
          sampled.push(data[data.length - 1]);
          return sampled;
        }
      };
      self.onmessage = function(e){
        const { id, fn, args } = e.data;
        try {
          if (typeof fns[fn] !== 'function') throw new Error('Função não disponível no worker: ' + fn);
          const result = fns[fn].apply(null, args);
          self.postMessage({ id, ok: true, result });
        } catch(err){
          self.postMessage({ id, ok: false, error: err && err.message || String(err) });
        }
      };
    `;

    let worker = null;
    let workerOk = false;
    let nextId = 0;
    const pending = new Map();

    function _initWorker(){
      try {
        const blob = new Blob([WORKER_SRC], { type:'application/javascript' });
        const url = URL.createObjectURL(blob);
        worker = new Worker(url);
        worker.onmessage = (e) => {
          const { id, ok, result, error } = e.data;
          const p = pending.get(id);
          if (!p) return;
          pending.delete(id);
          ok ? p.resolve(result) : p.reject(new Error(error));
        };
        worker.onerror = (err) => {
          SolsticeLog.warn('[StatsAsync] worker error', err);
          workerOk = false;
        };
        workerOk = true;
      } catch(err){
        SolsticeLog.debug('[StatsAsync] Worker indisponível, fallback síncrono', err);
        workerOk = false;
      }
    }
    _initWorker();

    function call(fn, ...args){
      if (!workerOk){
        // Fallback: chama síncrono (não trava UI em datasets pequenos)
        return Promise.resolve().then(() => {
          if (typeof SolsticeStats[fn] !== 'function') throw new Error('Função desconhecida: ' + fn);
          return SolsticeStats[fn].apply(null, args);
        });
      }
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, fn, args });
      });
    }

    function smart(fn, rows, ...args){
      if (Array.isArray(rows) && rows.length < 1000){
        return SolsticeStats[fn].apply(null, [rows, ...args]);
      }
      return call(fn, rows, ...args);
    }

    return { call, smart, isReady: () => workerOk };
  })();
