
  /* ============================================================
     JD-03 (Sprint 3) — SolsticeEmbed
     Gera snippet HTML/iframe para incorporar dashboard em site externo.
     Trade-off: como o single-file é 2MB, o embed real é via data:URL
     compacta com snapshot LZ-comprimido. Para dashboards menores
     (<300KB compactos), funciona inline. Acima disso, oferecemos
     a alternativa "publique solstice_baseline.html em /your-cdn/
     e use <iframe src='https://yourdomain.com/dashboard.html'>".
     ============================================================ */
  const SolsticeEmbed = (function(){
    function _genSnippet(opts){
      opts = opts || {};
      const w = opts.width || '100%';
      const h = opts.height || '600px';
      // Snapshot serializável (mesmo do compartilhamento)
      let snap = '';
      try {
        if (typeof SolsticeSnapshot !== 'undefined' && SolsticeSnapshot.captureCompressed){
          snap = SolsticeSnapshot.captureCompressed();
        } else if (typeof SolsticeShare !== 'undefined' && SolsticeShare.encodeState){
          snap = SolsticeShare.encodeState();
        }
      } catch(e){ SolsticeLog.warn('[Embed] snapshot failed', e); }

      const inlineLimit = 300 * 1024;
      const fits = snap && snap.length < inlineLimit;

      if (fits){
        // Embed via data: URL (totalmente self-contained)
        // O usuário precisa hospedar o solstice_baseline.html no mesmo domínio
        // e o iframe carrega com ?state=...
        return {
          mode: 'url-state',
          snippet: '<iframe src="https://YOUR-CDN/solstice_baseline.html#state=' + encodeURIComponent(snap) + '"\n' +
                   '        width="' + w + '" height="' + h + '"\n' +
                   '        style="border:0;border-radius:8px;"\n' +
                   '        title="Solstice dashboard"\n' +
                   '        allow="clipboard-write">\n' +
                   '</iframe>',
          note: 'Substitua "YOUR-CDN" pela URL onde você hospedou solstice_baseline.html.'
        };
      }
      return {
        mode: 'too-large',
        snippet: '<!-- Snapshot grande demais para URL inline. -->\n' +
                 '<!-- 1) Salve snapshot (Ctrl+S) ou export HTML standalone -->\n' +
                 '<!-- 2) Hospede o arquivo .html no seu CDN -->\n' +
                 '<iframe src="https://YOUR-CDN/your-dashboard.html"\n' +
                 '        width="' + w + '" height="' + h + '"\n' +
                 '        style="border:0;border-radius:8px;"\n' +
                 '        title="Solstice dashboard">\n' +
                 '</iframe>',
        note: 'Snapshot (' + Math.round((snap || '').length/1024) + ' KB) ultrapassa limite de URL — use HTML standalone hospedado.'
      };
    }
    async function open(){
      const hasData = SolsticeStore.get('dataset.ready');
      if (!hasData){
        SolsticeToast.warn('Sem dashboard', 'Importe dados + monte componentes antes de gerar embed.');
        return;
      }
      let width = '100%', height = '600px';
      SolsticeModal.show({
        title: '🌐 Código de embed',
        size: 'lg',
        body: (close) => {
          const body = SolsticeUtils.el('div');
          body.appendChild(SolsticeUtils.el('div', {
            style:'padding:10px 12px;background:color-mix(in srgb,var(--c-accent) 8%, var(--c-surface-2));border-left:3px solid var(--c-accent);border-radius:6px;font-size:12px;margin-bottom:12px;line-height:1.5;'
          },
            '🌐 ', SolsticeUtils.el('strong', null, 'Incorporar em site externo'),
            ': use o snippet abaixo. Edite ', SolsticeUtils.el('code', null, 'YOUR-CDN'),
            ' pra apontar pro arquivo hospedado.'));

          // Width / height inputs
          const dimRow = SolsticeUtils.el('div', { style:'display:flex;gap:8px;margin-bottom:12px;' });
          const wIn = SolsticeUtils.el('input', { type:'text', value: width, style:'flex:1;padding:6px 8px;border:1px solid var(--c-border);border-radius:4px;background:var(--c-surface);color:var(--c-text);' });
          const hIn = SolsticeUtils.el('input', { type:'text', value: height, style:'flex:1;padding:6px 8px;border:1px solid var(--c-border);border-radius:4px;background:var(--c-surface);color:var(--c-text);' });
          dimRow.appendChild(SolsticeUtils.el('label', { style:'flex:1;font-size:12px;color:var(--c-text-2);' }, 'Largura: ', wIn));
          dimRow.appendChild(SolsticeUtils.el('label', { style:'flex:1;font-size:12px;color:var(--c-text-2);' }, 'Altura: ', hIn));
          body.appendChild(dimRow);

          const out = SolsticeUtils.el('pre', {
            style:'background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:6px;padding:12px;font-size:11px;font-family:var(--font-mono);overflow:auto;max-height:300px;white-space:pre-wrap;word-break:break-all;'
          });
          const noteEl = SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-top:8px;' });

          function render(){
            const r = _genSnippet({ width: wIn.value, height: hIn.value });
            out.textContent = r.snippet;
            noteEl.textContent = r.note;
          }
          render();
          wIn.addEventListener('input', render);
          hIn.addEventListener('input', render);

          body.appendChild(out);
          body.appendChild(noteEl);

          const copyBtn = SolsticeUtils.el('button', {
            class:'solstice__btn solstice__btn--primary',
            style:'margin-top:12px;',
            onclick: () => {
              navigator.clipboard.writeText(out.textContent).then(
                () => SolsticeToast.success('Copiado', 'Snippet de embed na área de transferência'),
                () => SolsticeToast.warn('Falhou', 'Copie manualmente o trecho acima')
              );
            }
          }, '📋 Copiar snippet');
          body.appendChild(copyBtn);
          return body;
        },
        footer: (close) => [
          SolsticeUtils.el('button', { class:'solstice__btn', onclick: () => close(null) }, 'Fechar')
        ]
      });
    }
    return { open };
  })();
