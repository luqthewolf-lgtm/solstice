
  /* ============================================================
     Patch 1B (ADR-123) — SolsticeLLM (BYO-LLM)
     4 providers: OpenAI · Anthropic · Google · Ollama (local).
     Chamadas diretas do navegador (CORS por conta do usuário).
     Chave em localStorage; aviso no modal de Configurações.
     ============================================================ */
  const SolsticeLLM = (function(){
    const STORAGE_KEY = 'solstice.llm.config';
    let config = {
      enabled: false, provider: null, apiKey: null, model: null, includeSample: true
    };

    // === Prompt 1 LGPD — bloqueio BYO-LLM externo para dados banco_pj ===
    // Domínios sensíveis: presetKey listado em SENSITIVE_PRESETS dispara bloqueio.
    // Por enquanto só 'banco_pj' (CNPJ, DPD, ticket — política de dados Itaú).
    // Para adicionar outro domínio: incluir aqui (ex: 'rh' se for adotado).
    const SENSITIVE_PRESETS = ['banco_pj'];
    const EXTERNAL_PROVIDERS = ['openai', 'anthropic', 'google'];
    let _sessionDisabled = false;  // "Desativar LLM nesta sessão" — não persiste
    let _overrideTrap = false;     // "Confirmar envio assumindo o risco" — 1 chamada
    let _modalOpen = false;        // evita duplo modal em chamadas paralelas

    function _activePresetKey(){
      try {
        const d = SolsticeStore.get('dictionary');
        return (d && d._presetKey) || null;
      } catch(_){ return null; }
    }
    function _isProviderExternal(){
      return EXTERNAL_PROVIDERS.indexOf(config.provider) >= 0;
    }
    function _isPjBlocked(){
      if (_overrideTrap) return false; // override liberado para esta chamada
      const k = _activePresetKey();
      if (!k || SENSITIVE_PRESETS.indexOf(k) < 0) return false;
      return _isProviderExternal();
    }

    function _load(){
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw){ config = Object.assign(config, JSON.parse(raw)); }
      } catch(e){}
    }
    function _persist(){
      // Auditoria 2026 (AP-02): config de LLM (provider, modelo, API key) —
      // avisar se não persistir, pra usuário não pensar que salvou.
      SolsticeStorage.safeSet(STORAGE_KEY, JSON.stringify(config));
    }
    _load();

    const PROVIDERS = {
      openai: {
        url: () => 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
        buildPayload: (system, user, model) => ({
          model, messages: [{ role:'system', content: system }, { role:'user', content: user }],
          temperature: 0.3, max_tokens: 800
        }),
        headers: (key) => ({ 'Content-Type':'application/json', 'Authorization':'Bearer ' + key }),
        parseResponse: (data) => data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
      },
      anthropic: {
        url: () => 'https://api.anthropic.com/v1/messages',
        models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'],
        buildPayload: (system, user, model) => ({
          model, system, messages: [{ role:'user', content: user }], max_tokens: 800
        }),
        headers: (key) => ({
          'Content-Type':'application/json', 'x-api-key': key,
          'anthropic-version':'2023-06-01',
          'anthropic-dangerous-direct-browser-access':'true'
        }),
        parseResponse: (data) => data.content && data.content[0] && data.content[0].text
      },
      google: {
        url: (model, key) => 'https://generativelanguage.googleapis.com/v1/models/' + model + ':generateContent?key=' + encodeURIComponent(key),
        models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
        buildPayload: (system, user) => ({
          contents: [{ parts: [{ text: system + '\n\nUsuário: ' + user }] }]
        }),
        headers: () => ({ 'Content-Type':'application/json' }),
        parseResponse: (data) => data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text
      },
      ollama: {
        url: () => 'http://localhost:11434/api/chat',
        models: ['llama3.2', 'mistral', 'phi3'],
        buildPayload: (system, user, model) => ({
          model, messages: [{ role:'system', content: system }, { role:'user', content: user }],
          stream: false
        }),
        headers: () => ({ 'Content-Type':'application/json' }),
        parseResponse: (data) => data.message && data.message.content
      }
    };

    /**
     * HC-02 (Sprint 3) — RAG sobre o dataset.
     * Antes: só nome+tipo das colunas + 5 sample rows.
     * Agora: enriquece com aggregations + distinct counts + min/max + nulls
     * por coluna. Isso é "RAG estilo BI" — sem embeddings, mas com sumário
     * que dá ao LLM contexto real sobre o shape dos dados.
     *
     * Custo: ~1KB extra por coluna no prompt. Para 20 colunas, ~20KB —
     * cabe folgado em qualquer LLM (Claude=200K, GPT4o=128K).
     */
    function _buildSystemPrompt(ctx, includeSample){
      const rows = ctx.rows || [];
      const N = rows.length;
      const cols = (ctx.columns || []).map(c => {
        const t = (ctx.types && ctx.types[c]) || {};
        const group = (typeof SolsticeTypes !== 'undefined' && SolsticeTypes.group) ? SolsticeTypes.group(t.type) : null;
        const colInfo = {
          name: c,
          type: t.type || 'string',
          group,
          friendlyName: (ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[c] && ctx.dictionary.columns[c].friendlyName) || null,
          unit: (ctx.dictionary && ctx.dictionary.columns && ctx.dictionary.columns[c] && ctx.dictionary.columns[c].unit) || null
        };
        // HC-02: estatística leve por coluna (RAG context)
        try {
          if (group === 'numeric' && typeof SolsticeStats !== 'undefined'){
            const vals = rows.map(r => SolsticeStats.parseNum(r[c])).filter(v => !isNaN(v));
            if (vals.length){
              colInfo.stats = {
                count: vals.length,
                min: SolsticeStats.min(vals),
                max: SolsticeStats.max(vals),
                mean: Math.round(SolsticeStats.mean(vals) * 100) / 100,
                median: SolsticeStats.median(vals),
                nulls: N - vals.length
              };
            }
          } else if (group === 'categorical' || group === 'id'){
            const freq = new Map();
            rows.forEach(r => {
              const v = r[c];
              if (v == null || v === '') return;
              const k = String(v);
              freq.set(k, (freq.get(k) || 0) + 1);
            });
            colInfo.stats = {
              distinct: freq.size,
              nulls: N - Array.from(freq.values()).reduce((a, b) => a + b, 0)
            };
            // Top 3 valores mais frequentes (insight valioso pro LLM)
            const top = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
            if (top.length) colInfo.stats.top3 = top.map(([k, n]) => k + ' (' + n + ')');
          } else if (group === 'temporal'){
            const dates = rows.map(r => new Date(r[c])).filter(d => !isNaN(d));
            if (dates.length){
              colInfo.stats = {
                count: dates.length,
                minDate: new Date(Math.min.apply(null, dates.map(d => d.getTime()))).toISOString().slice(0, 10),
                maxDate: new Date(Math.max.apply(null, dates.map(d => d.getTime()))).toISOString().slice(0, 10),
                nulls: N - dates.length
              };
            }
          }
        } catch(_){ /* não bloqueia se stats falhar pra uma coluna */ }
        return colInfo;
      });

      let prompt = `Você é assistente analítico do Solstice (dashboard BI single-file).

Dataset: ${N} linhas, ${cols.length} colunas.

Schema enriquecido (RAG):
${JSON.stringify(cols, null, 2)}

Responda em PT-BR conciso (máx 4 parágrafos).
Use os números do schema enriquecido como evidência (min/max/mean/distinct).
Se faz sentido visualizar, sugira componente Solstice em bloco \`\`\`json\`\`\` no final, com formato:
{ "componentType": "kpi|time-series|scatter|boxplot|sankey|distribution|table",
  "config": { /* campos específicos */ } }`;

      if (includeSample && rows.length > 0){
        // HC-02: sample expandida — 5 primeiras + 3 do meio + 2 últimas
        const samp = [];
        samp.push(...rows.slice(0, 5));
        if (N > 10) samp.push(...rows.slice(Math.floor(N / 2), Math.floor(N / 2) + 3));
        if (N > 8) samp.push(...rows.slice(-2));
        prompt += '\n\nAmostra estratégica (' + samp.length + ' linhas):\n' + JSON.stringify(samp, null, 2);
      }
      return prompt;
    }

    function _parseStructured(text){
      const jsonMatch = String(text || '').match(/```json\s*([\s\S]*?)\s*```/);
      let action = null;
      if (jsonMatch){
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.componentType){
            action = { type:'create_component', componentType: parsed.componentType, config: parsed.config || {} };
          }
        } catch(e){}
      }
      const answer = String(text || '').replace(/```json[\s\S]*?```/g, '').trim();
      return { answer, action, confidence: 1.0, source:'llm' };
    }

    /** Prompt 1 LGPD — modal de override quando dataset banco_pj + provider externo.
     *  3 opções + cancel. Retorna 'switch_ollama' | 'disable_session' | 'override_once' | null. */
    async function _promptPjOverride(){
      if (_modalOpen) return null; // evita duplo modal
      _modalOpen = true;
      const providerLabel = ({ openai:'OpenAI', anthropic:'Anthropic', google:'Google' })[config.provider] || config.provider;
      try {
        return await SolsticeModal.show({
          title: '⚠️ Dados de carteira PJ detectados',
          size: 'md',
          body: () => {
            const wrap = SolsticeUtils.el('div', { style:'font-size:13px;line-height:1.6;color:var(--c-text);' });
            wrap.appendChild(SolsticeUtils.el('p', { style:'margin:0 0 12px 0;' },
              'O dicionário ativo é "Banco PJ — Carteira de Crédito" e contém colunas sensíveis (CNPJ, DPD, ticket médio, spread).'));
            wrap.appendChild(SolsticeUtils.el('p', { style:'margin:0 0 12px 0;' },
              'Envio para provider externo (' + providerLabel + ') está bloqueado por política de dados do Itaú e LGPD.'));
            wrap.appendChild(SolsticeUtils.el('div', {
              style:'padding:10px 12px;background:color-mix(in srgb, var(--c-warn) 12%, transparent);border-left:3px solid var(--c-warn);border-radius:var(--rad-xs);font-size:12px;'
            }, '💡 Recomendado: use Ollama local — nenhum dado sai da sua máquina.'));
            return wrap;
          },
          footer: (close) => [
            SolsticeUtils.el('button', {
              class:'solstice__btn solstice__btn--primary',
              onclick: () => close('switch_ollama')
            }, '🔒 Usar Ollama local'),
            SolsticeUtils.el('button', {
              class:'solstice__btn',
              onclick: () => close('disable_session')
            }, '🚫 Desativar LLM nesta sessão'),
            SolsticeUtils.el('button', {
              class:'solstice__btn solstice__btn--ghost',
              style:'color:var(--c-error);',
              title:'Permite UMA chamada ignorando o bloqueio. Registrado em auditoria.',
              onclick: () => close('override_once')
            }, '⚠️ Confirmar envio · risco assumido'),
            SolsticeUtils.el('button', {
              class:'solstice__btn solstice__btn--ghost',
              onclick: () => close(null)
            }, 'Cancelar')
          ]
        });
      } finally {
        _modalOpen = false;
      }
    }

    /** Prompt 1 LGPD — abre painel de Settings do LLM para usuário trocar pra Ollama. */
    function _openSettingsLLM(){
      try {
        // Tenta acionar a aba de LLM na Command Palette ou Settings
        if (typeof SolsticeCommandPalette !== 'undefined' && SolsticeCommandPalette.run){
          SolsticeCommandPalette.run('settings.llm');
          return;
        }
        SolsticeToast.info('Configure Ollama', 'Abra Configurações → LLM e troque para Ollama (localhost).');
      } catch(_) {
        SolsticeToast.info('Configure Ollama', 'Abra Configurações → LLM e troque para Ollama (localhost).');
      }
    }

    async function ask(question, ctx){
      if (!isEnabled()) return null;

      // === Prompt 1 LGPD GATE ===
      if (_isPjBlocked()){
        // Audita SEMPRE a tentativa, antes do modal
        try {
          SolsticeAudit.record({
            action: 'llm_block_pj',
            target: 'attempted',
            details: { provider: config.provider, model: config.model, presetKey: _activePresetKey() }
          });
        } catch(_) {}
        const choice = await _promptPjOverride();
        // Audita desfecho
        try {
          SolsticeAudit.record({
            action: 'llm_block_pj',
            target: choice || 'cancel',
            details: { provider: config.provider, model: config.model, presetKey: _activePresetKey() }
          });
        } catch(_) {}
        if (!choice || choice === 'cancel') return null;
        if (choice === 'switch_ollama'){ _openSettingsLLM(); return null; }
        if (choice === 'disable_session'){
          _sessionDisabled = true;
          try { refreshBlockBadge(); } catch(_) {}
          SolsticeToast.info('LLM desativado', 'Recarregue a página para reativar.');
          return null;
        }
        if (choice === 'override_once'){
          _overrideTrap = true;
          // continua para o fluxo normal abaixo; o finally reseta o trap
        }
      }

      const p = PROVIDERS[config.provider];
      if (!p) return null;
      ctx = ctx || {};
      const system = _buildSystemPrompt(ctx, config.includeSample);
      const url = p.url(config.model, config.apiKey);
      const payload = p.buildPayload(system, question, config.model);
      const headers = p.headers(config.apiKey);
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok){
          if (res.status === 401) throw new Error('Chave de API inválida');
          if (res.status === 429) throw new Error('Limite de requisições atingido');
          if (res.status >= 500) throw new Error('Erro no provedor (' + res.status + ')');
          throw new Error('Erro HTTP ' + res.status);
        }
        const data = await res.json();
        const text = p.parseResponse(data);
        if (!text) throw new Error('Resposta vazia do provedor');
        return _parseStructured(text);
      } catch(err){
        clearTimeout(tid);
        if (err.name === 'AbortError') throw new Error('Timeout — provedor demorou demais (30s)');
        throw err;
      } finally {
        // Prompt 1 LGPD: override é SEMPRE single-shot. Próxima chamada cai no bloqueio de novo.
        _overrideTrap = false;
      }
    }

    async function test(){
      try {
        const r = await ask('Diga "ok" em PT-BR.', { columns: [], rows: [], types: {}, dictionary: null });
        return { ok: true, answer: (r && r.answer) || 'sem resposta' };
      } catch(err){
        return { ok: false, error: err.message };
      }
    }

    function isEnabled(){
      // Prompt 1 LGPD: respeita "Desativar nesta sessão" (não persiste; recarregar libera)
      if (_sessionDisabled) return false;
      return !!(config.enabled && config.apiKey && config.provider && config.model);
    }
    function getConfig(){ return Object.assign({}, config); }
    function setConfig(newConfig){
      config = Object.assign(config, newConfig || {});
      _persist();
      // Prompt 1 LGPD: revalida badge ao mudar provider/enabled
      try { refreshBlockBadge(); } catch(_) {}
    }

    /** Prompt 1 LGPD — mount/refresh do badge "⚠️ LLM externo bloqueado" no header.
     *  Idempotente: chama de qualquer ponto. Aparece quando há risco real
     *  (preset sensível + provider externo + LLM habilitado). */
    function refreshBlockBadge(){
      try {
        let badge = document.getElementById('solstice__llm-block-badge');
        const shouldShow = isEnabled() && _isProviderExternal()
          && SENSITIVE_PRESETS.indexOf(_activePresetKey()) >= 0;
        if (!shouldShow){
          if (badge) badge.remove();
          return;
        }
        if (!badge){
          // Acha ponto de mount no header (ao lado do tema/atalhos)
          const host = document.querySelector('.solstice__header-actions, .solstice__topbar, .solstice__header')
            || document.querySelector('header')
            || document.body;
          if (!host) return;
          badge = document.createElement('button');
          badge.id = 'solstice__llm-block-badge';
          badge.type = 'button';
          badge.className = 'solstice__llm-block-badge';
          badge.title = 'Provider externo bloqueado para dados de carteira PJ (LGPD).\nClique para ver opções.';
          badge.setAttribute('aria-label', 'Aviso LGPD: LLM externo bloqueado para banco PJ');
          badge.textContent = '⚠️ LLM externo bloqueado';
          badge.onclick = () => _promptPjOverride();
          host.insertBefore(badge, host.firstChild);
        }
      } catch(err){ /* silencioso — UI nice-to-have */ }
    }

    // Prompt 1 LGPD: revalida badge quando o dicionário muda
    try {
      if (typeof SolsticeStore !== 'undefined' && SolsticeStore.subscribe){
        SolsticeStore.subscribe('dictionary', () => { try { refreshBlockBadge(); } catch(_) {} });
      }
    } catch(_) {}
    // Prompt 1 LGPD: revalidação inicial pós-boot (dicionário pode já estar no Store
    // via snapshot, e o subscribe não dispara retroativamente).
    if (typeof document !== 'undefined'){
      if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', () => setTimeout(refreshBlockBadge, 500));
      } else {
        setTimeout(refreshBlockBadge, 500);
      }
    }

    return { ask, test, isEnabled, getConfig, setConfig, PROVIDERS, refreshBlockBadge };
  })();
