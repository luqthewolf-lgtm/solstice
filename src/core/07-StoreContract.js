
  /* ============================================================
     Auditoria 2026 (RT-03) — SolsticeStoreContract
     Interface mínima que TODO módulo com `set()` próprio deve cumprir.

     Motivação: 7 módulos definem `set()` à sua maneira (Theme, Ingest,
     Locale, ProfileFavorites, Filters, Cross-filter local stores). Sem
     convenção comum, fica difícil rastrear de onde vem uma mudança e
     testar. Esta interface é o ponto de aterragem para a migração
     incremental: módulos passam a expor a mesma forma e podem ser
     reagrupados num único store central no futuro.

     Contrato:
       interface SolsticeStoreLike<T> {
         get(path?: string): any;
         set(path: string, value: any, opts?: { silent?: boolean }): void;
         subscribe(path: string, cb: (val, prev, fullPath) => void): () => void;
       }

     Quando NÃO usar: módulos que só fazem cache puro (sem subscribers e
     sem persistência) podem manter `set()` interno simples.

     `wrap(target, basePath)` cria um adapter que delega para o SolsticeStore
     central. Use-o para migrar um módulo sem reescrever todas as chamadas:

       const _store = SolsticeStoreContract.wrap(SolsticeStore, 'theme');
       _store.set('mode', 'dark');   // = SolsticeStore.set('theme.mode', 'dark')
     ============================================================ */
  const SolsticeStoreContract = (function(){
    function wrap(target, basePath){
      const prefix = basePath ? basePath + '.' : '';
      return {
        get(path){
          return target.get(path ? prefix + path : (basePath || ''));
        },
        set(path, value, opts){
          // opts.silent: pula notify (equivalente ao batch do SolsticeStore).
          if (opts && opts.silent && target.batch){
            target.batch(() => target.set(prefix + path, value));
          } else {
            target.set(prefix + path, value);
          }
        },
        subscribe(path, cb){
          return target.subscribe(prefix + path, cb);
        }
      };
    }

    /** Verifica em runtime se um módulo cumpre o contrato. Útil em testes. */
    function isStoreLike(obj){
      return obj
        && typeof obj.get === 'function'
        && typeof obj.set === 'function'
        && typeof obj.subscribe === 'function';
    }

    return { wrap, isStoreLike };
  })();
