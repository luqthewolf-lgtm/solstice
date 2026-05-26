
  /* ============================================================
     BLOCO 11 — SolsticeFileSystem (ADR-081)
     File System Access API + fallback download/upload.
     `.solstice.json` para estado puro; `.solstice.html` chamado via Export.
     ============================================================ */
  const SolsticeFileSystem = (function(){
    const supported = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
    let lastHandle = null;

    async function saveJSON(state, suggestedName){
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      if (supported){
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: suggestedName || 'solstice-state.json',
            types: [{ description: 'Solstice JSON', accept: { 'application/json': ['.json', '.solstice.json'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          lastHandle = handle;
          SolsticeAudit.record({ action:'fs_save', details:{ name: handle.name, size: blob.size } });
          return true;
        } catch(e){
          if (e && e.name === 'AbortError') return false;
          SolsticeLog.warn('[FS saveJSON]', e);
          // cai no fallback abaixo
        }
      }
      // Fallback download
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = suggestedName || 'solstice-state.json';
      a.click();
      URL.revokeObjectURL(a.href);
      return true;
    }

    async function openJSON(){
      if (supported){
        try {
          const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'Solstice JSON', accept: { 'application/json': ['.json', '.solstice.json'] } }]
          });
          lastHandle = handle;
          const file = await handle.getFile();
          const text = await file.text();
          return JSON.parse(text);
        } catch(e){
          if (e && e.name === 'AbortError') return null;
          SolsticeLog.warn('[FS openJSON]', e);
        }
      }
      // Fallback input file
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.solstice.json,application/json';
        input.onchange = async (e) => {
          const f = e.target.files[0];
          if (!f){ resolve(null); return; }
          try { resolve(JSON.parse(await f.text())); }
          catch(err){ resolve(null); }
        };
        input.click();
      });
    }

    async function saveBlob(blob, suggestedName){
      if (supported){
        try {
          const handle = await window.showSaveFilePicker({ suggestedName });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return true;
        } catch(e){
          if (e && e.name === 'AbortError') return false;
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = suggestedName;
      a.click();
      URL.revokeObjectURL(a.href);
      return true;
    }

    function isSupported(){ return supported; }

    function init(){
      // Patch 1A (ADR-092): atalhos de arquivo separados
      //   Ctrl+S        — salvar snapshot rápido
      //   Ctrl+Shift+S  — salvar como (modal com nome)
      //   Ctrl+O        — abrir Snapshots
      //   Ctrl+I        — importar CSV (file picker)
      document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const tag = e.target && e.target.tagName;
        const editing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
        if (editing) return;
        const k = e.key.toLowerCase();
        if (k === 's' && e.shiftKey){
          e.preventDefault();
          (async () => {
            const name = await SolsticeModal.prompt({
              title: '💾 Salvar como',
              message: 'Nome do snapshot:',
              placeholder: 'meu-dashboard',
              defaultValue: 'Snapshot ' + new Date().toLocaleString('pt-BR')
            });
            if (!name) return;
            SolsticeSnapshots.save(name);
            SolsticeToast.success('Snapshot salvo', name);
          })();
        } else if (k === 's'){
          e.preventDefault();
          SolsticeSnapshots.save();
          SolsticeToast.success('Snapshot rápido salvo', 'Ctrl+S · veja em "📂 Snapshots"');
        } else if (k === 'o'){
          e.preventDefault();
          SolsticeSnapshots.openModal();
        } else if (k === 'i'){
          e.preventDefault();
          const fi = document.getElementById('file-input');
          if (fi) fi.click();
        }
      });
    }

    return { saveJSON, openJSON, saveBlob, isSupported, init };
  })();
