
  /* ============================================================
     B5-04 (v6-autonomous / I18N-02 — Yuki/Mercado Pago) — SolsticeFmt
     Helper único com nomes idiomáticos pra formatação. Wrappers + extras
     que SolsticeLocale não tinha:
       • formatBRL(n) → "R$ 1.250"
       • formatPct(n, digits) → "12,5%"
       • formatInteger(n) → "1.234"
       • formatDecimal(n, digits)
       • formatDate(d, format) → "12 mai 2026"
       • formatCompact(n) → "1,2 mi" / "3,5 mil" / "850" (NOVO)
       • formatBytes(n) → "5,2 MB" (NOVO)
       • formatDuration(ms) → "2 h 15 min" (NOVO)

     Por que existe: hardcoded `R$ ` ou `(n*100).toFixed(2)+'%'` em
     múltiplos lugares quebra na hora de trocar locale. SolsticeFmt
     delega tudo pra Intl + SolsticeLocale.
     ============================================================ */
  const SolsticeFmt = (function(){
    function formatBRL(n){
      return SolsticeLocale.currency(n, 'BRL');
    }
    function formatPct(n, digits){
      // n é fração 0..1 (Intl.NumberFormat style:'percent' espera assim)
      return SolsticeLocale.percent(n, digits);
    }
    function formatInteger(n){ return SolsticeLocale.integer(n); }
    function formatDecimal(n, digits){ return SolsticeLocale.decimal(n, digits); }
    function formatDate(d, format){
      const opts = format === 'long'   ? { dateStyle:'long' }
                 : format === 'short'  ? { dateStyle:'short' }
                 : format === 'full'   ? { dateStyle:'full' }
                 : format === 'time'   ? { timeStyle:'short' }
                 : format === 'datetime' ? { dateStyle:'medium', timeStyle:'short' }
                 : { dateStyle:'medium' };
      return SolsticeLocale.date(d, opts);
    }

    /** formatCompact(1234567) → "1,2 mi" · formatCompact(8500) → "8,5 mil" */
    function formatCompact(num){
      if (num == null || isNaN(num)) return '—';
      try {
        const loc = SolsticeLocale.get();
        return new Intl.NumberFormat(loc, {
          notation: 'compact',
          maximumFractionDigits: 1
        }).format(num);
      } catch(_){
        // Fallback manual
        const abs = Math.abs(num);
        if (abs >= 1e9) return (num/1e9).toFixed(1).replace('.', ',') + ' bi';
        if (abs >= 1e6) return (num/1e6).toFixed(1).replace('.', ',') + ' mi';
        if (abs >= 1e3) return (num/1e3).toFixed(1).replace('.', ',') + ' mil';
        return String(Math.round(num));
      }
    }

    /** formatBytes(5242880) → "5,0 MB" */
    function formatBytes(bytes){
      if (bytes == null || isNaN(bytes)) return '—';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let i = 0;
      let v = bytes;
      while (v >= 1024 && i < units.length - 1){
        v /= 1024;
        i++;
      }
      // 1 decimal pra MB+, 0 pra B/KB
      const decimals = i >= 2 ? 1 : 0;
      return v.toFixed(decimals).replace('.', ',') + ' ' + units[i];
    }

    /** formatDuration(123456) → "2 min 3 s" · formatDuration(7200000) → "2 h" */
    function formatDuration(ms){
      if (ms == null || isNaN(ms)) return '—';
      const s = Math.round(ms / 1000);
      if (s < 60) return s + ' s';
      const m = Math.round(s / 60);
      if (m < 60) return m + ' min';
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return h + ' h' + (mm ? ' ' + mm + ' min' : '');
    }

    /**
     * SolsticeFmt — formatação locale-aware via Intl.
     * Wrappers idiomáticos + helpers extras (compact, bytes, duration).
     * @returns {{
     *   formatBRL(n:number): string,                        // "R$ 1.250"
     *   formatPct(n:number, digits?:number): string,        // "12,5%" (n = fração 0..1)
     *   formatInteger(n:number): string,                    // "1.234"
     *   formatDecimal(n:number, digits?:number): string,
     *   formatDate(d:Date|string, format?:string): string,  // format: 'short'|'long'|'full'|'time'|'datetime'
     *   formatCompact(n:number): string,                    // "1,2 mi" / "8,5 mil"
     *   formatBytes(bytes:number): string,                  // "5,2 MB"
     *   formatDuration(ms:number): string                   // "2 h 15 min"
     * }}
     */
    return { formatBRL, formatPct, formatInteger, formatDecimal, formatDate, formatCompact, formatBytes, formatDuration };
  })();
