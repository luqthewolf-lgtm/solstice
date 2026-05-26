
  /* ============================================================
     Patch Final (ADR-143) — SolsticeShare
     URL Hash share — serializa estado estrutural (sem dataset) em hash
     base64 URL-safe via LZ-String. Permite compartilhar layout sem
     compartilhar dados sensíveis.
     ============================================================ */
  const SolsticeShare = (function(){
    const HASH_PREFIX = '#st=';

    function _b64UrlEncode(s){
      return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function _b64UrlDecode(s){
      // Repõe padding/chars
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return s;
    }

    function _captureStructural(){
      const ingest = SolsticeStore.get('ingest') || {};
      return {
        v: 1,
        canvas: {
          sections: SolsticeStore.get('canvas.sections') || [],
          header: SolsticeStore.get('canvas.header') || {}
        },
        filters: SolsticeStore.get('filters') || {},
        params: SolsticeStore.get('params') || {},
        dictionary: SolsticeStore.get('dictionary') || null,
        // Sem rows; só schema mínimo para validar compatibilidade
        schema: {
          columns: ingest.columns || [],
          types: ingest.types ? Object.fromEntries(Object.entries(ingest.types).map(([k,v]) => [k, { type: v.type }])) : {}
        },
        calculatedMeasures: ingest.calculatedMeasures || {}
      };
    }

    function toUrl(){
      const state = _captureStructural();
      const json = JSON.stringify(state);
      const compressed = SolsticeLZ.compressToBase64(json);
      const encoded = _b64UrlEncode(compressed);
      const url = location.origin + location.pathname + HASH_PREFIX + encoded;
      return url;
    }

    async function copy(){
      const url = toUrl();
      // Patch Corretivo (ADR-157): cap 50KB — sugere snapshot se exceder
      const SIZE_CAP = 50 * 1024;
      if (url.length > SIZE_CAP){
        const ok = await SolsticeModal.confirm({
          title:'🔗 Link muito grande (' + (url.length/1024).toFixed(1) + ' KB)',
          message:'O dashboard atual gera um link maior que 50KB — alguns navegadores/clientes podem truncar.\n\nPrefere salvar como snapshot? Depois você pode compartilhar o nome do snapshot.',
          confirmLabel:'Salvar snapshot',
          cancelLabel:'Copiar mesmo assim'
        });
        if (ok){
          const name = await SolsticeModal.prompt({ title:'💾 Salvar como snapshot', message:'Nome do snapshot:', placeholder:'Compartilhar via ID' });
          if (name){
            SolsticeSnapshots.save(name);
            SolsticeToast.success('Snapshot salvo', 'Compartilhe o nome: "' + name + '"');
          }
          return false;
        }
        // Senão segue copiando
      }
      try {
        await navigator.clipboard.writeText(url);
        SolsticeToast.success('Link copiado (' + (url.length/1024).toFixed(1) + ' KB)', 'Receptor precisa ter CSV compatível.');
        return true;
      } catch(e){
        // Fallback: mostra modal com URL
        const ta = SolsticeUtils.el('textarea', { rows:'4', style:'width:100%;font-family:var(--font-mono);font-size:10px;' }, url);
        SolsticeModal.show({
          title:'🔗 Link de compartilhamento',
          body: ta,
          buttons:[{ label:'OK', kind:'primary', onClick: () => true }]
        });
        return false;
      }
    }

    /** Verifica hash ao boot e oferece carregar. */
    async function checkHash(){
      const hash = location.hash || '';
      if (!hash.startsWith(HASH_PREFIX)) return false;
      const encoded = hash.slice(HASH_PREFIX.length);
      if (!encoded) return false;
      let state;
      try {
        const compressed = _b64UrlDecode(encoded);
        const json = SolsticeLZ.decompressFromBase64(compressed);
        state = JSON.parse(json);
      } catch(err){
        SolsticeToast.error('Link inválido', err.message);
        history.replaceState(null, '', location.pathname);
        return false;
      }
      const ok = await SolsticeModal.confirm({
        title:'🔗 Carregar dashboard compartilhado?',
        message: 'O link traz a estrutura do dashboard (sem dados). Vai ser aplicado sobre o workspace atual. Requer CSV com colunas: ' +
                 ((state.schema && state.schema.columns) || []).slice(0,5).join(', ') + (((state.schema && state.schema.columns) || []).length > 5 ? '…' : ''),
        confirmLabel:'Carregar', cancelLabel:'Cancelar'
      });
      if (!ok){ history.replaceState(null, '', location.pathname); return false; }
      _hydrate(state);
      history.replaceState(null, '', location.pathname);
      SolsticeToast.success('Dashboard carregado');
      return true;
    }

    function _hydrate(state){
      const ingest = SolsticeStore.get('ingest') || {};
      SolsticeStore.batch(() => {
        SolsticeStore.set('canvas.sections', (state.canvas && state.canvas.sections) || []);
        SolsticeStore.set('canvas.header', (state.canvas && state.canvas.header) || {});
        SolsticeStore.set('filters', state.filters || {});
        SolsticeStore.set('params', state.params || {});
        if (state.dictionary) SolsticeStore.set('dictionary', state.dictionary);
        if (state.calculatedMeasures){
          SolsticeStore.set('ingest', Object.assign({}, ingest, { calculatedMeasures: state.calculatedMeasures }));
        }
      });
      if (SolsticeCanvas && SolsticeCanvas.render) SolsticeCanvas.render();
    }

    return { toUrl, copy, checkHash };
  })();
