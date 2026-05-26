
  /* ============================================================
     S6-02 (Sprint 6) — SolsticeFolderAttach
     Atrelamento de pasta via File System Access API (Chrome 86+).
     Permite "refresh automático" — re-lê o arquivo do nome SourceName
     diretamente da pasta atrelada, sem file picker.

     Limitação: handle não persiste entre sessões (FS API ainda exige
     re-attach a cada page load). Para persistência futura, IndexedDB
     com handle (suporte limitado por browser).

     Uso:
       SolsticeFolderAttach.attach()   // showDirectoryPicker
       SolsticeFolderAttach.refresh()  // re-lê arquivo do source name
       SolsticeFolderAttach.detach()   // limpa handle
     ============================================================ */
  const SolsticeFolderAttach = (function(){
    const supported = typeof window.showDirectoryPicker === 'function';
    let dirHandle = null;
    let attachedSourceName = null;
    const IDB_HANDLE_KEY = 'folder.handle';
    const IDB_SOURCENAME_KEY = 'folder.sourceName';

    function isSupported(){ return supported; }
    function isAttached(){ return !!dirHandle; }
    function getAttachedName(){ return dirHandle ? (dirHandle.name || 'pasta') : null; }
    function getAttachedSourceName(){ return attachedSourceName; }

    async function attach(){
      if (!supported){
        SolsticeToast.warn('Não suportado', 'Seu navegador não suporta atrelar pasta. Use Chrome/Edge 86+.');
        return false;
      }
      try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        if (!handle) return false;
        dirHandle = handle;
        // Memoriza o nome do arquivo atual pra refresh saber qual recarregar
        const ingest = SolsticeStore.get('ingest') || {};
        attachedSourceName = ingest.sourceName || null;
        SolsticeStore.set('ui.folder.attachedName', handle.name);
        // B1-04 (v6-autonomous): persiste handle + sourceName em IndexedDB
        // pra auto-refresh ao re-abrir o navegador.
        // Estruturedo clone do FileSystemDirectoryHandle É suportado em IDB
        // a partir de Chrome 86 / Edge 86. Safari não suporta — set falha
        // silenciosamente, ok.
        if (typeof SolsticeIDB !== 'undefined' && SolsticeIDB.isSupported()){
          try {
            await SolsticeIDB.set(IDB_HANDLE_KEY, handle);
            if (attachedSourceName) await SolsticeIDB.set(IDB_SOURCENAME_KEY, attachedSourceName);
          } catch(e){ SolsticeLog.warn('[FolderAttach.persist]', e); }
        }
        if (typeof SolsticeAudit !== 'undefined' && SolsticeAudit.record){
          SolsticeAudit.record({ action:'folder_attach', target: handle.name });
        }
        return true;
      } catch(e){
        if (e && e.name === 'AbortError') return false;
        SolsticeLog.warn('[FolderAttach]', e);
        SolsticeToast.warn('Falha ao atrelar', e.message || 'Erro desconhecido');
        return false;
      }
    }

    function detach(){
      dirHandle = null;
      attachedSourceName = null;
      SolsticeStore.set('ui.folder.attachedName', null);
      // B1-04: limpa persistência
      if (typeof SolsticeIDB !== 'undefined' && SolsticeIDB.isSupported()){
        try {
          SolsticeIDB.del(IDB_HANDLE_KEY);
          SolsticeIDB.del(IDB_SOURCENAME_KEY);
        } catch(_){}
      }
    }

    /**
     * B1-04 (v6-autonomous): tenta restaurar handle do IDB ao boot.
     * Se permissão ainda granted, faz auto-refresh do arquivo.
     * Se permissão revogada (esperado), só restaura o estado visual
     * e usuário precisa clicar refresh pra re-grant.
     * Retorna { restored: bool, autoRefreshed: bool }.
     */
    async function restoreFromStorage(){
      if (!supported) return { restored: false, autoRefreshed: false };
      if (typeof SolsticeIDB === 'undefined' || !SolsticeIDB.isSupported()){
        return { restored: false, autoRefreshed: false };
      }
      try {
        const handle = await SolsticeIDB.get(IDB_HANDLE_KEY);
        if (!handle) return { restored: false, autoRefreshed: false };
        const sourceName = await SolsticeIDB.get(IDB_SOURCENAME_KEY);
        dirHandle = handle;
        attachedSourceName = sourceName || null;
        SolsticeStore.set('ui.folder.attachedName', handle.name || 'pasta');

        // Verifica permissão. Após reload, geralmente está 'prompt' (precisa user gesture).
        const perm = await handle.queryPermission({ mode: 'read' });
        if (perm === 'granted'){
          // Auto-refresh imediato!
          if (sourceName){
            // Pequeno delay pra UI estabilizar antes do toast
            setTimeout(async () => {
              const ok = await refresh({ silent: false });
              if (ok && typeof SolsticeAudit !== 'undefined') {
                SolsticeAudit.record({ action: 'folder_auto_refresh', target: sourceName });
              }
            }, 800);
            return { restored: true, autoRefreshed: true };
          }
        } else {
          // Permissão precisa de re-grant via gesto do usuário.
          // Mostra toast convidando a clicar no 🔄
          setTimeout(() => {
            SolsticeToast.info(
              '📎 Pasta atrelada (' + (handle.name || 'pasta') + ')',
              'Clique no 🔄 pra autorizar e recarregar "' + (sourceName || 'arquivo') + '" automaticamente.'
            );
          }, 1200);
        }
        return { restored: true, autoRefreshed: false };
      } catch(e){
        SolsticeLog.warn('[FolderAttach.restoreFromStorage]', e);
        return { restored: false, autoRefreshed: false };
      }
    }

    /** refresh(opts) — tenta re-ler o arquivo do nome SourceName da pasta atrelada.
        opts.silent (default false) — não mostra toast "Recarregando…".
        Retorna true se conseguiu reimportar, false se precisar fallback manual. */
    async function refresh(opts){
      opts = opts || {};
      if (!dirHandle) return false;
      const ingest = SolsticeStore.get('ingest') || {};
      const fileName = attachedSourceName || ingest.sourceName;
      if (!fileName){
        if (!opts.silent) SolsticeToast.warn('Sem arquivo de origem', 'Importe um arquivo primeiro.');
        return false;
      }
      try {
        // Verifica permissão (pode pedir re-grant)
        const perm = await dirHandle.queryPermission({ mode:'read' });
        if (perm !== 'granted'){
          const req = await dirHandle.requestPermission({ mode:'read' });
          if (req !== 'granted'){
            if (!opts.silent) SolsticeToast.warn('Permissão negada', 'Re-atrelar pasta pra continuar.');
            return false;
          }
        }
        const fileHandle = await dirHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        if (!opts.silent) SolsticeToast.info('Recarregando…', fileName + ' (' + Math.round(file.size/1024) + ' KB)');
        // Chama o pipeline de ingest com o File obtido (mesma rota do file picker)
        if (typeof _runIngestFile === 'function'){
          await _runIngestFile(file, {});
        } else if (window.Solstice && window.Solstice._runIngestFile){
          await window.Solstice._runIngestFile(file, {});
        }
        if (typeof SolsticeAudit !== 'undefined' && SolsticeAudit.record){
          SolsticeAudit.record({ action:'folder_refresh', target: fileName });
        }
        return true;
      } catch(e){
        SolsticeLog.warn('[FolderAttach.refresh]', e);
        if (!opts.silent){
          if (e && e.name === 'NotFoundError'){
            SolsticeToast.warn('Arquivo não encontrado', '"' + fileName + '" não está na pasta atrelada. Re-atrelar ou re-importar manualmente.');
          } else {
            SolsticeToast.warn('Falha no refresh', e.message || 'Erro desconhecido');
          }
        }
        return false;
      }
    }

    /**
     * SolsticeFolderAttach — File System Access API (Chrome/Edge 86+).
     * Atrela 1 pasta do disco e refresh automático ao reabrir o navegador.
     * @returns {{
     *   isSupported(): boolean,                              // showDirectoryPicker disponível
     *   isAttached(): boolean,                               // há handle em memória
     *   getAttachedName(): string|null,                      // nome da pasta atrelada
     *   getAttachedSourceName(): string|null,                // nome do arquivo memorizado
     *   attach(): Promise<boolean>,                          // showDirectoryPicker + persiste em IDB
     *   detach(): void,                                      // limpa handle + IDB
     *   refresh(opts?: {silent?:boolean}): Promise<boolean>, // re-lê arquivo da pasta
     *   restoreFromStorage(): Promise<{restored:boolean, autoRefreshed:boolean}>
     * }}
     */
    return { isSupported, isAttached, getAttachedName, getAttachedSourceName, attach, detach, refresh, restoreFromStorage };
  })();
