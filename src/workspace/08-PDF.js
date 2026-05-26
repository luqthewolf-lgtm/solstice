
  /* ============================================================
     Patch Final (ADR-144) — SolsticePDF
     Export PDF via window.print() com CSS print-friendly. Sem libs externas.
     ============================================================ */
  const SolsticePDF = (function(){
    async function exportPDF(){
      const orientation = await SolsticeModal.select({
        title:'📄 Exportar PDF',
        message:'Orientação:',
        options: [
          { value:'landscape', label:'Paisagem (recomendado para dashboards)' },
          { value:'portrait',  label:'Retrato' }
        ],
        defaultValue:'landscape',
        confirmLabel:'Imprimir'
      });
      if (!orientation) return;
      document.documentElement.setAttribute('data-print-orientation', orientation);
      document.body.classList.add('solstice-print-mode');
      // Hint ao usuário sobre como ajustar no diálogo de impressão
      SolsticeToast.info('Diálogo de impressão abrirá', 'Escolha "Salvar como PDF" e marque "Layout: ' + (orientation === 'landscape' ? 'Paisagem' : 'Retrato') + '".');
      // Patch Corretivo (BUG G): aguarda 500ms para Chart.js terminar resize de canvases
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('solstice-print-mode');
          document.documentElement.removeAttribute('data-print-orientation');
        }, 1000);
      }, 500);
    }
    return { export: exportPDF };
  })();
