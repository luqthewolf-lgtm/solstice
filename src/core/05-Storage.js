
  /* ============================================================
     Auditoria 2026 (AP-02) — SolsticeStorage
     Wrapper único para escrita em localStorage.

     Motivação: ~30 chamadas de `localStorage.setItem` no arquivo, quase
     todas no padrão `try { setItem(...) } catch(e){}`. Em aba anônima
     ou cota cheia, o setItem lança, o erro some, e o app segue como se
     tivesse salvo — usuário recarrega e perde o trabalho sem aviso.

     SolsticeStorage.safeSet(key, value) faz a escrita, detecta falha,
     dispara SolsticeToast.warn UMA vez por sessão (não enche o usuário
     de avisos repetidos), e retorna boolean indicando sucesso.

     Quando NÃO usar: durante boot inicial (SolsticeToast pode não estar
     pronto). Para esses casos use o try/catch tradicional ou passe
     { silent: true }.
     ============================================================ */
  const SolsticeStorage = (function(){
    let _warned = false;
    function _warnOnce(key, err){
      if (_warned) return;
      _warned = true;
      // Atrasa o toast pra garantir que SolsticeToast já carregou
      // (boot ordering: SolsticeStorage é definido antes de SolsticeToast).
      setTimeout(() => {
        if (typeof SolsticeToast !== 'undefined' && SolsticeToast.warn){
          SolsticeToast.warn(
            'Não foi possível salvar',
            'Armazenamento cheio, indisponível ou modo anônimo. Suas alterações nesta sessão podem não persistir.'
          );
        } else {
          // Fallback se toast indisponível (boot precoce, frame de erro):
          // pelo menos loga no console pra não passar despercebido.
          console.warn('[SolsticeStorage] setItem falhou para "' + key + '":', err && err.message);
        }
      }, 0);
    }
    function safeSet(key, value, opts){
      try {
        localStorage.setItem(key, value);
        return true;
      } catch(e){
        if (!opts || !opts.silent) _warnOnce(key, e);
        return false;
      }
    }
    function safeGet(key){
      try { return localStorage.getItem(key); }
      catch(e){ return null; }
    }
    function safeRemove(key){
      try { localStorage.removeItem(key); return true; }
      catch(e){ return false; }
    }
    return { safeSet, safeGet, safeRemove };
  })();
