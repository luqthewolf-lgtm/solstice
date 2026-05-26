
  /* ============================================================
     JD-01 (Sprint 3) — SolsticeExportSVG
     Exporta componentes como SVG vetorial editável. Chart.js render
     em <canvas>; convertemos via duas estratégias:
       1) Chart.toBase64Image('image/svg+xml') quando disponível
       2) Snapshot do canvas → embed em <svg><image href=dataurl>
          (rasterizado mas dentro de SVG container — abre em Inkscape)
     Componentes não-Chart (KPI/BigNum/Tabela) viram <svg> simples
     com texto.
     ============================================================ */
  const SolsticeExportSVG = (function(){

    function _allSlots(){
      const sections = SolsticeStore.get('canvas.sections') || [];
      const out = [];
      sections.forEach(sec => (sec.rows || []).forEach(row => (row.slots || []).forEach(slot => out.push(slot))));
      return out;
    }

    function _slotToSvg(slot){
      const el = document.querySelector('[data-slot-id="' + slot.id + '"]');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const w = Math.max(200, Math.round(rect.width));
      const h = Math.max(120, Math.round(rect.height));

      // Tenta achar canvas de Chart.js dentro do slot
      // Auditoria 2026.4 (MC-08 / AP-06): título do slot vem do usuário —
      // precisa ser escapado antes de entrar em <title> ou <desc> do SVG.
      // Antes: `slot.config.title` direto na string concatenada — se o usuário
      // colocasse um '<' no título do componente, o SVG gerado quebrava
      // (XML inválido) ou abria vetor com markup injetado. Política HV-01
      // ("dado dinâmico SEMPRE via escapeHtml") se aplica aqui também.
      const safeTitle = SolsticeUtils.escapeHtml(slot.config && slot.config.title || slot.type);

      const canvas = el.querySelector('canvas');
      if (canvas){
        try {
          const dataUrl = canvas.toDataURL('image/png');
          return [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">',
            '  <title>' + safeTitle + '</title>',
            '  <desc>Exportado de Solstice — ' + new Date().toISOString() + '</desc>',
            '  <image x="0" y="0" width="' + w + '" height="' + h + '" xlink:href="' + dataUrl + '"/>',
            '</svg>'
          ].join('\n');
        } catch(_){}
      }

      // Sem canvas: gera SVG com texto (KPI/BigNum/Tabela)
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500);
      const safe = SolsticeUtils.escapeHtml(text);
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">',
        '  <title>' + safeTitle + '</title>',
        '  <rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#fff" stroke="#ccc"/>',
        '  <foreignObject x="8" y="8" width="' + (w-16) + '" height="' + (h-16) + '">',
        '    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:system-ui,sans-serif;font-size:13px;color:#333;">',
        '      ' + safe,
        '    </div>',
        '  </foreignObject>',
        '</svg>'
      ].join('\n');
    }

    async function open(){
      const slots = _allSlots();
      if (!slots.length){
        SolsticeToast.warn('Canvas vazio', 'Adicione componentes antes de exportar SVG.');
        return;
      }
      // Modal de seleção de componente
      const options = slots.map(s => ({
        value: s.id,
        icon: '📊',
        label: (s.config && s.config.title) || s.type,
        desc: 'Slot ' + s.id.slice(0,6) + ' · tipo ' + s.type
      }));
      options.unshift({ value: '__all__', icon:'📦', label:'Todos os componentes', desc: slots.length + ' SVGs em um .zip… (1 por slot, baixados em sequência)' });

      const choice = await SolsticeModal.select({
        title:'🖼️ Exportar SVG',
        message:'Escolha o componente:',
        options,
        confirmLabel:'Exportar'
      });
      if (!choice) return;

      const targets = choice === '__all__' ? slots : slots.filter(s => s.id === choice);
      let n = 0;
      for (const s of targets){
        const svg = _slotToSvg(s);
        if (!svg) continue;
        const blob = new Blob([svg], { type:'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'solstice-' + s.type + '-' + s.id.slice(0,6) + '.svg';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        n++;
        // Pequeno delay entre downloads pra não confundir o navegador
        if (targets.length > 1) await new Promise(r => setTimeout(r, 200));
      }
      if (typeof SolsticeAudit !== 'undefined' && SolsticeAudit.record){
        SolsticeAudit.record({ action:'export_svg', details:{ count: n } });
      }
      SolsticeToast.success('SVG exportado', n + ' arquivo(s) baixado(s)');
    }

    return { open };
  })();
