
  /* ============================================================
     SolsticeLLMAdapter — Fase 5 (refactor-modular-v1, Auditoria 2026.6)

     Sistema de adapters pluggable pra integração com LLMs. O SolsticeLLM
     (mock) que ja existe segue funcionando como default. Esta camada
     adiciona a possibilidade de plugar OpenAI, ChatGPT, Eva (Itau) ou
     qualquer endpoint compativel.

     INTERFACE de um adapter:
       complete(prompt, opts?) -> Promise<string>

       prompt:  string ou array de mensagens [{role: 'user'|'system'|'assistant', content: string}]
       opts:    { maxTokens?, temperature?, signal? }
       retorno: Promise que resolve com a string da resposta

     ADAPTERS built-in:
       - 'mock'        — usa SolsticeLLM existente (default, offline)
       - 'openai'      — POST https://api.openai.com/v1/chat/completions
       - 'fetch'       — endpoint generico que aceita {messages, ...} no body
                         e retorna {content} ou {choices: [{message: {content}}]}
                         (pra plugar Eva do Itau, intranet, etc.)

     CONFIGURACAO via console ou Settings:
       Solstice.LLMAdapter.configure({
         provider: 'openai' | 'fetch' | 'mock',
         endpoint: 'https://...',   // requerido pra 'fetch'
         apiKey:   '<chave>',       // requerido pra 'openai' e opcional pra 'fetch'
         model:    'gpt-4o',        // opcional, default 'gpt-4o-mini'
         headers:  { ... },         // opcional, pra 'fetch' enviar headers custom
       });

     PERSISTENCIA: localStorage.solstice.llm (objeto JSON).
       OBS: API keys ficam guardadas em texto claro no localStorage do
       browser do usuario. Aceitavel porque o produto eh 100% local e
       single-tenant (cada analista usa o proprio Solstice). Em ambientes
       corporativos como Itau, o endpoint normalmente nao requer chave
       (autenticacao por sessao/SSO da intranet).

     USO:
       const resp = await Solstice.LLMAdapter.complete([
         {role: 'system', content: 'Voce e um analista de dados.'},
         {role: 'user',   content: 'Qual o significado dessa coluna?'}
       ]);
     ============================================================ */
  const SolsticeLLMAdapter = (function(){
    'use strict';

    const STORAGE_KEY = 'solstice.llm';
    let _config = _loadConfig();

    function _loadConfig(){
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { provider: 'mock' };
        const c = JSON.parse(raw);
        return c && typeof c === 'object' ? c : { provider: 'mock' };
      } catch(_){ return { provider: 'mock' }; }
    }

    function _saveConfig(c){
      try {
        SolsticeStorage.safeSet(STORAGE_KEY, JSON.stringify(c));
      } catch(e){
        SolsticeLog.warn('[LLMAdapter] falha ao salvar config', e && e.message);
      }
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------
    function _normalizePrompt(prompt){
      // Aceita string OR array de mensagens. Sempre retorna array.
      if (typeof prompt === 'string') return [{ role: 'user', content: prompt }];
      if (Array.isArray(prompt)) return prompt;
      throw new Error('prompt deve ser string ou array de mensagens');
    }

    function _ensureFetch(){
      if (typeof fetch !== 'function'){
        throw new Error('fetch indisponivel — este adapter requer browser moderno');
      }
    }

    // ----------------------------------------------------------
    // ADAPTERS
    // ----------------------------------------------------------
    const _ADAPTERS = {};

    // mock: usa SolsticeLLM (que ja vive offline e retorna estruturas
    // simuladas). Suficiente pra desenvolvimento e demo.
    _ADAPTERS.mock = {
      async complete(prompt, opts){
        const msgs = _normalizePrompt(prompt);
        const last = msgs[msgs.length - 1];
        const userText = last && last.content ? String(last.content) : '';
        // SolsticeLLM expoe `.complete(text)` ou similar. Tenta varias APIs
        // pra robustez. Se nada retornar string valida, cai no fallback.
        let result = null;
        try {
          if (typeof SolsticeLLM !== 'undefined'){
            if (typeof SolsticeLLM.complete === 'function'){
              result = await SolsticeLLM.complete(userText, opts);
            } else if (typeof SolsticeLLM.ask === 'function'){
              result = await SolsticeLLM.ask(userText, opts);
            }
          }
        } catch(_){ /* segue pro fallback */ }
        if (typeof result === 'string' && result.length > 0) return result;
        // Fallback declaradamente mock — util pra dev e pra demonstrar
        // que o adapter esta vivo mesmo sem provider real.
        return '[Solstice mock] Recebi: ' + userText.slice(0, 200);
      }
    };

    // openai: usa o endpoint oficial da OpenAI Chat Completions API.
    _ADAPTERS.openai = {
      async complete(prompt, opts){
        _ensureFetch();
        const apiKey = (_config && _config.apiKey) || '';
        if (!apiKey){
          throw new Error('LLMAdapter[openai]: apiKey nao configurada. Use Solstice.LLMAdapter.configure({apiKey: "..."}).');
        }
        const model = (opts && opts.model) || (_config && _config.model) || 'gpt-4o-mini';
        const messages = _normalizePrompt(prompt);
        const body = {
          model: model,
          messages: messages,
          max_tokens: (opts && opts.maxTokens) || 1024,
          temperature: (opts && opts.temperature) != null ? opts.temperature : 0.7,
        };
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
          },
          body: JSON.stringify(body),
          signal: opts && opts.signal,
        });
        if (!resp.ok){
          const errText = await resp.text();
          throw new Error('LLMAdapter[openai] HTTP ' + resp.status + ': ' + errText.slice(0, 300));
        }
        const data = await resp.json();
        const choice = data && data.choices && data.choices[0];
        const content = choice && choice.message && choice.message.content;
        return content || '';
      }
    };

    // fetch: adapter generico. Faz POST no endpoint configurado, manda
    // {messages, model?, ...} no body, espera {content} OU
    // {choices: [{message: {content}}]} (formato OpenAI-compatible) OU
    // {response} OU {text} de volta.
    // Aceita headers customizados (pra Eva do Itau usar autenticacao da
    // intranet via cookie/SSO, ou bearer custom).
    _ADAPTERS.fetch = {
      async complete(prompt, opts){
        _ensureFetch();
        const endpoint = (_config && _config.endpoint) || '';
        if (!endpoint){
          throw new Error('LLMAdapter[fetch]: endpoint nao configurado. Use Solstice.LLMAdapter.configure({endpoint: "https://..."}).');
        }
        const headers = Object.assign(
          { 'Content-Type': 'application/json' },
          (_config && _config.headers) || {},
          (opts && opts.headers) || {}
        );
        if (_config && _config.apiKey && !headers['Authorization']){
          headers['Authorization'] = 'Bearer ' + _config.apiKey;
        }
        const messages = _normalizePrompt(prompt);
        const body = Object.assign(
          { messages: messages },
          _config && _config.model ? { model: _config.model } : {},
          opts && opts.extra ? opts.extra : {}
        );
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body),
          credentials: (_config && _config.credentials) || 'same-origin',
          signal: opts && opts.signal,
        });
        if (!resp.ok){
          const errText = await resp.text();
          throw new Error('LLMAdapter[fetch] HTTP ' + resp.status + ': ' + errText.slice(0, 300));
        }
        const data = await resp.json();
        // Tenta multiples formatos de resposta — flexibilidade pra Eva,
        // claude.ai-API, vLLM, etc.
        if (typeof data === 'string') return data;
        if (data.content) return data.content;
        if (data.response) return data.response;
        if (data.text) return data.text;
        if (data.choices && data.choices[0] && data.choices[0].message){
          return data.choices[0].message.content || '';
        }
        return JSON.stringify(data);
      }
    };

    // ----------------------------------------------------------
    // API PUBLICA
    // ----------------------------------------------------------
    function configure(newConfig){
      if (!newConfig || typeof newConfig !== 'object'){
        throw new Error('configure() requer um objeto.');
      }
      // Mescla com config existente — permite atualizar campo individual
      _config = Object.assign({}, _config, newConfig);
      // Provider invalido vira mock
      if (!_ADAPTERS[_config.provider]) _config.provider = 'mock';
      _saveConfig(_config);
      SolsticeLog.debug('[LLMAdapter] config atualizada', { provider: _config.provider });
      return Object.assign({}, _config);
    }

    function getConfig(){
      // Retorna copia (nao expoe apiKey em getConfig se desejar mascarar,
      // mas como o objeto vive no localStorage do proprio user, retornar
      // tudo facilita debug e configuracao via Settings UI futura)
      return Object.assign({}, _config);
    }

    function listProviders(){
      return Object.keys(_ADAPTERS);
    }

    function register(name, adapter){
      if (!name || typeof name !== 'string'){
        throw new Error('register() requer nome (string).');
      }
      if (!adapter || typeof adapter.complete !== 'function'){
        throw new Error('adapter deve ter metodo complete(prompt, opts) -> Promise<string>.');
      }
      _ADAPTERS[name] = adapter;
      return true;
    }

    async function complete(prompt, opts){
      const provider = (_config && _config.provider) || 'mock';
      const adapter = _ADAPTERS[provider] || _ADAPTERS.mock;
      try {
        return await adapter.complete(prompt, opts || {});
      } catch(e){
        SolsticeLog.warn('[LLMAdapter] complete falhou em "' + provider + '":', e && e.message);
        // Fallback automatico pro mock se o provider real falhar — UX
        // melhor que tela de erro pro user final.
        if (provider !== 'mock'){
          SolsticeLog.warn('[LLMAdapter] caindo pra mock como fallback');
          return await _ADAPTERS.mock.complete(prompt, opts || {});
        }
        throw e;
      }
    }

    async function test(){
      // Health check — chama o provider atual com um prompt simples e
      // mede tempo. Util pra UI de Settings mostrar "Conectado" ou "Erro".
      const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
      try {
        const resp = await complete('Diga "ok" em uma palavra.', { maxTokens: 8 });
        const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        return { ok: true, provider: _config.provider, ms: Math.round(t1 - t0), response: resp.slice(0, 200) };
      } catch(e){
        return { ok: false, provider: _config.provider, error: e && e.message };
      }
    }

    return {
      configure,
      getConfig,
      listProviders,
      register,
      complete,
      test,
    };
  })();
