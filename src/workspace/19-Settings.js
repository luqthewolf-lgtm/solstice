
  /* ============================================================
     Patch 1B (ADR-126) — SolsticeSettings
     Modal de Configurações completo: BYO-LLM · Hints reset · Limites · Reset preferências.
     ============================================================ */
  const SolsticeSettings = (function(){
    // Auditoria 2026 (U-12): aplica a identidade visual customizada no
    // header do app. Lê de localStorage e injeta nos slots dedicados.
    function _applyBrand(){
      // SOL-C4: identidade visual do app está travada. Branding customizado
      // foi removido da UI (era a seção "Identidade visual" do Settings).
      // _applyBrand vira no-op — nome/logo/subtítulo do app voltam aos defaults
      // do HTML ("Solstice" / "Dashboard Studio" / ícone padrão). Resíduos
      // anteriores em localStorage são removidos pra não confundir.
      try {
        localStorage.removeItem('solstice.settings.brand.logoUrl');
        localStorage.removeItem('solstice.settings.brand.name');
        localStorage.removeItem('solstice.settings.brand.sub');
      } catch(_){}
    }
    // Aplica no boot — espera o DOM existir.
    if (document.readyState === 'complete' || document.readyState === 'interactive'){
      setTimeout(_applyBrand, 50);
    } else {
      document.addEventListener('DOMContentLoaded', () => setTimeout(_applyBrand, 50));
    }

    function open(){
      const cfg = SolsticeLLM.getConfig();
      const wrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:16px;font-size:13px;color:var(--c-text);' });

      // --- Perfil ---
      const profSec = SolsticeUtils.el('div', { style:'padding:10px;background:var(--c-surface-2);border-radius:6px;' });
      profSec.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;margin-bottom:8px;' }, '👤 Perfil'));
      const profInput = SolsticeUtils.el('input', {
        class:'solstice__props-input', type:'text',
        value: (SolsticeProfiles.current() && SolsticeProfiles.current().name) || '',
        placeholder:'Seu nome'
      });
      profSec.appendChild(profInput);
      const profSaveBtn = SolsticeUtils.el('button', {
        class:'solstice__btn',
        style:'margin-top:6px;',
        onclick: () => { SolsticeProfiles.rename(profInput.value); SolsticeToast.success('Nome atualizado'); }
      }, 'Salvar nome');
      profSec.appendChild(profSaveBtn);
      wrap.appendChild(profSec);

      // --- 🎚️ Preferências (SOL-G2/G3: Modo Iniciante + Modo Amigável + Confirmações) ---
      // Antes: Modo Iniciante e Modo Amigável viviam no rodapé da sidebar;
      // Confirmações destrutivas viviam em _openProfilePreferences (modal
      // separado abrindo a partir do mesmo botão de perfil). Agora tudo aqui,
      // num só lugar.
      const prefSec = SolsticeUtils.el('div', { style:'padding:10px;background:var(--c-surface-2);border-radius:6px;display:flex;flex-direction:column;gap:8px;' });
      prefSec.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;margin-bottom:4px;' }, '🎚️ Preferências'));

      // Modo Iniciante
      const beginnerLbl = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;' });
      const beginnerCb = SolsticeUtils.el('input', { type:'checkbox' });
      try { if (localStorage.getItem('solstice.beginnerMode') === '1') beginnerCb.checked = true; } catch(_){}
      beginnerCb.addEventListener('change', () => {
        const app = document.getElementById('app');
        // Auditoria 2026 (AP-02): wrapper único, avisa em falha.
        SolsticeStorage.safeSet('solstice.beginnerMode', beginnerCb.checked ? '1' : '0');
        if (app){
          if (beginnerCb.checked) app.setAttribute('data-v56-beginner', '1');
          else app.removeAttribute('data-v56-beginner');
        }
        SolsticeToast.info(beginnerCb.checked ? '🌱 Modo iniciante ativo' : 'Modo completo',
          beginnerCb.checked ? 'Inspector mostra só Dados e Avisos.' : 'Todas as seções do inspector voltaram.');
      });
      beginnerLbl.appendChild(beginnerCb);
      beginnerLbl.appendChild(SolsticeUtils.el('span', null, ' 🌱 Modo iniciante — esconde Estilo/Análise/Métodos do inspector'));
      prefSec.appendChild(beginnerLbl);

      // Modo Amigável
      const friendlyLbl = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;' });
      const friendlyCb = SolsticeUtils.el('input', { type:'checkbox' });
      try { if (localStorage.getItem('solstice.friendlyMode') === '1') friendlyCb.checked = true; } catch(_){}
      friendlyCb.addEventListener('change', () => {
        const FM = (window.Solstice && window.Solstice.V56 && window.Solstice.V56.FriendlyMode) || null;
        if (FM && FM.toggle){
          FM.toggle(friendlyCb.checked);
        } else {
          // Fallback: só localStorage + attribute (translation depende de re-render)
          document.documentElement.setAttribute('data-friendly', friendlyCb.checked ? '1' : '0');
          // Auditoria 2026 (AP-02): wrapper único, avisa em falha.
          SolsticeStorage.safeSet('solstice.friendlyMode', friendlyCb.checked ? '1' : '0');
          SolsticeToast.info(friendlyCb.checked ? '🧑‍🤝‍🧑 Modo amigável ativo' : 'Modo padrão', 'Pode precisar trocar de aba pra ver o texto traduzido em todos os lugares.');
        }
      });
      friendlyLbl.appendChild(friendlyCb);
      friendlyLbl.appendChild(SolsticeUtils.el('span', null, ' 🧑‍🤝‍🧑 Modo amigável — substitui jargão por linguagem do dia-a-dia'));
      prefSec.appendChild(friendlyLbl);

      // Confirmações destrutivas (migrado de _openProfilePreferences)
      prefSec.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-top:6px;text-transform:uppercase;letter-spacing:0.05em;' }, 'Confirmações destrutivas'));
      prefSec.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-text-2);margin-bottom:4px;line-height:1.4;' },
        'Marque para perguntar antes de remover. Desmarque para silenciar (toast com Desfazer continua).'));
      const _CONFIRM_KEYS = [
        ['remove-component', 'Remover componente'],
        ['remove-section',   'Remover seção'],
        ['remove-row',       'Remover linha']
      ];
      const _skippedList = (typeof SolsticeModal !== 'undefined' && SolsticeModal.listSkipped) ? SolsticeModal.listSkipped() : [];
      _CONFIRM_KEYS.forEach(([key, label]) => {
        const r = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;padding:4px 6px;background:var(--c-surface);border-radius:4px;' });
        const cb = SolsticeUtils.el('input', { type:'checkbox' });
        cb.checked = !(_skippedList.indexOf(key) >= 0);
        cb.addEventListener('change', () => {
          if (cb.checked){
            if (SolsticeModal.unskip) SolsticeModal.unskip(key);
            SolsticeToast.info('Reativado', label + ' voltará a perguntar antes');
          } else {
            const pid = (SolsticeProfiles.current() && SolsticeProfiles.current().id) || 'anon';
            // Auditoria 2026 (AP-02): silent — flag UX (mesma fix da L10073).
            SolsticeStorage.safeSet('solstice.' + pid + '.skipConfirm.' + key, 'true', { silent: true });
            SolsticeToast.info('Silenciado', label + ' não pergunta mais (toast com Desfazer continua)');
          }
        });
        r.appendChild(cb);
        r.appendChild(SolsticeUtils.el('span', { style:'flex:1;' }, label));
        prefSec.appendChild(r);
      });

      wrap.appendChild(prefSec);

      // --- ⚡ Modo Express (ADR-161 / Onda 1 T3) ---
      const expressSec = SolsticeUtils.el('div', { style:'padding:10px;background:var(--c-surface-2);border-radius:6px;' });
      // ADR-178 (Fix-10 v5.5): título com botão (?) que mostra explicação visual.
      // Lucas (re-auditoria P1 Marta): "não há help inline".
      const expressHead = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:6px;margin-bottom:4px;' });
      expressHead.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;flex:1;' }, '⚡ Modo Express'));
      const helpBtn = SolsticeUtils.el('button', {
        type:'button',
        title:'O que muda no Express?',
        'aria-label':'Explicação do Modo Express',
        style:'width:22px;height:22px;border-radius:50%;background:color-mix(in srgb, var(--c-accent) 18%, var(--c-surface));color:var(--c-accent);border:1px solid var(--c-accent);font-size:11px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;',
        onclick: () => {
          SolsticeModal.show({
            title: '⚡ O que o Modo Express muda?',
            size: 'md',
            body: SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--c-text);line-height:1.5;' },
              SolsticeUtils.el('div', { style:'padding:10px;background:var(--c-surface-2);border-radius:6px;' },
                SolsticeUtils.el('div', { style:'font-weight:600;margin-bottom:4px;color:var(--c-muted);font-size:11px;text-transform:uppercase;' }, 'Antes (fluxo normal)'),
                SolsticeUtils.el('div', { style:'font-family:var(--font-mono);font-size:12px;' },
                  '1. Importar CSV →  2. Modal de filtro de colunas →  3. Modal de dicionário →  4. Auto-Dashboard (com confirmação)')
              ),
              SolsticeUtils.el('div', { style:'padding:10px;background:color-mix(in srgb, var(--c-accent) 10%, var(--c-surface-2));border:1px solid color-mix(in srgb, var(--c-accent) 30%, transparent);border-radius:6px;' },
                SolsticeUtils.el('div', { style:'font-weight:600;margin-bottom:4px;color:var(--c-accent);font-size:11px;text-transform:uppercase;' }, '⚡ Depois (Express)'),
                SolsticeUtils.el('div', { style:'font-family:var(--font-mono);font-size:12px;' },
                  '1. Importar CSV →  Dashboard pronto')
              ),
              SolsticeUtils.el('div', { style:'font-size:12px;color:var(--c-muted);' },
                '🛡️ Safety floor: se a confiança das recomendações for menor que 40%, o modal de Auto-Dashboard aparece mesmo em Express — pra você não acabar com um dashboard ruim sem perceber.')
            ),
            footer: (close) => [
              SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => close(null) }, 'Entendi')
            ]
          });
        }
      }, '?');
      expressHead.appendChild(helpBtn);
      expressSec.appendChild(expressHead);
      expressSec.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-bottom:8px;line-height:1.4;' },
        'Importou → dashboard pronto, zero clique. Pula modais de filtro de colunas e dicionário; roda Auto-Dashboard em silêncio. Modal só aparece se confiança média < 40% (proteção contra recomendações ruins).'));
      const expressLbl = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;cursor:pointer;' });
      const expressChk = SolsticeUtils.el('input', { type:'checkbox' });
      if (SolsticeStore.get('settings.expressMode') === true) expressChk.checked = true;
      expressLbl.appendChild(expressChk);
      expressLbl.appendChild(document.createTextNode(' Ativar Modo Express para todos os imports'));
      expressSec.appendChild(expressLbl);
      expressChk.addEventListener('change', () => {
        SolsticeStore.set('settings.expressMode', expressChk.checked);
        try { SolsticeAudit.record({ action:'toggle_express_mode', details:{ enabled: expressChk.checked } }); } catch(_){}
        SolsticeToast.success(expressChk.checked ? '⚡ Modo Express ativo' : 'Modo Express desativado',
          expressChk.checked ? 'Próximos imports vão direto pra dashboard.' : 'Imports voltam ao fluxo padrão com modais.');
      });
      wrap.appendChild(expressSec);

      // --- BYO-LLM ---
      const llmSec = SolsticeUtils.el('div', { style:'padding:10px;background:var(--c-surface-2);border-radius:6px;' });
      llmSec.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;margin-bottom:4px;' }, '🤖 Conectar IA Externa (opcional)'));
      llmSec.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-bottom:8px;line-height:1.4;' },
        'Para perguntas além do Smart Query, conecte SUA chave de OpenAI, Anthropic ou Google.'));

      const enabledLabel = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;margin-bottom:8px;cursor:pointer;' });
      const enabledChk = SolsticeUtils.el('input', { type:'checkbox' });
      if (cfg.enabled) enabledChk.checked = true;
      enabledLabel.appendChild(enabledChk);
      enabledLabel.appendChild(document.createTextNode(' Ativar IA externa'));
      llmSec.appendChild(enabledLabel);

      // Provider radio
      const provWrap = SolsticeUtils.el('div', { style:'display:flex;flex-direction:column;gap:4px;margin-bottom:8px;' });
      provWrap.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);' }, 'Provedor:'));
      const PROV_LABELS = {
        openai:    '◯ OpenAI (GPT-4o-mini, ~$0.001/pergunta)',
        anthropic: '◯ Anthropic (Claude Haiku, ~$0.001)',
        google:    '◯ Google (Gemini Flash, ~$0.0005)',
        ollama:    '◯ Local (Ollama em localhost:11434)'
      };
      const modelSel = SolsticeUtils.el('select', { class:'solstice__props-select' });
      function _refreshModels(provId){
        modelSel.innerHTML = '';
        const p = SolsticeLLM.PROVIDERS[provId];
        if (!p) return;
        p.models.forEach(m => modelSel.appendChild(SolsticeUtils.el('option', { value:m }, m)));
        if (cfg.model && p.models.includes(cfg.model)) modelSel.value = cfg.model;
      }
      Object.keys(PROV_LABELS).forEach(id => {
        const lab = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;cursor:pointer;' });
        const radio = SolsticeUtils.el('input', { type:'radio', name:'llm-provider', value:id });
        if (cfg.provider === id) radio.checked = true;
        radio.addEventListener('change', () => _refreshModels(id));
        lab.appendChild(radio);
        lab.appendChild(document.createTextNode(' ' + PROV_LABELS[id].slice(2)));
        provWrap.appendChild(lab);
      });
      llmSec.appendChild(provWrap);

      // API Key
      llmSec.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-top:8px;' }, 'Chave de API:'));
      const keyInput = SolsticeUtils.el('input', {
        class:'solstice__props-input', type:'password',
        value: cfg.apiKey || '',
        placeholder:'sk-... (deixe vazio para Ollama local)'
      });
      llmSec.appendChild(keyInput);
      // Auditoria 2026 (L-T-3 / A-803): aviso reforçado sobre risco da
      // chave em texto plano no localStorage + sugestão de Ollama local.
      llmSec.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-warn);margin-top:2px;line-height:1.4;' },
        '⚠️ A chave fica em texto plano no localStorage do navegador. ' +
        'Em PC corporativo ou compartilhado, prefira Ollama local (sem chave). ' +
        'Se a máquina for comprometida, a chave pode ser usada para fazer chamadas em sua conta.'));

      // Modelo
      llmSec.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-top:8px;' }, 'Modelo:'));
      llmSec.appendChild(modelSel);
      if (cfg.provider) _refreshModels(cfg.provider);

      // Sample toggle
      const sampleLabel = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer;font-size:12px;' });
      const sampleChk = SolsticeUtils.el('input', { type:'checkbox' });
      if (cfg.includeSample !== false) sampleChk.checked = true;
      sampleLabel.appendChild(sampleChk);
      sampleLabel.appendChild(document.createTextNode(' Enviar amostra (5 linhas) com a pergunta'));
      llmSec.appendChild(sampleLabel);

      // Botões testar/salvar
      const btnRow = SolsticeUtils.el('div', { style:'display:flex;gap:6px;margin-top:8px;' });
      const testBtn = SolsticeUtils.el('button', { class:'solstice__btn', onclick: async () => {
        const prov = (provWrap.querySelector('input:checked') || {}).value || cfg.provider;
        SolsticeLLM.setConfig({
          provider: prov, apiKey: keyInput.value, model: modelSel.value,
          includeSample: sampleChk.checked, enabled: true
        });
        testBtn.textContent = '⏳ Testando…';
        const r = await SolsticeLLM.test();
        testBtn.textContent = 'Testar conexão';
        if (r.ok) SolsticeToast.success('Conexão OK', r.answer.slice(0, 60));
        else SolsticeToast.error('Falha: ' + r.error);
      }}, 'Testar conexão');
      const saveBtn = SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--primary', onclick: () => {
        const prov = (provWrap.querySelector('input:checked') || {}).value || cfg.provider;
        SolsticeLLM.setConfig({
          enabled: enabledChk.checked, provider: prov, apiKey: keyInput.value,
          model: modelSel.value, includeSample: sampleChk.checked
        });
        SolsticeToast.success('Configurações salvas');
      }}, 'Salvar');
      btnRow.appendChild(testBtn); btnRow.appendChild(saveBtn);
      llmSec.appendChild(btnRow);
      llmSec.appendChild(SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);margin-top:8px;line-height:1.4;' },
        '💡 Quando ativo, Smart Query tenta primeiro o motor local (instantâneo). Se confidence < 40%, usa sua IA externa.'));
      wrap.appendChild(llmSec);

      // --- 🦆 DuckDB-WASM (Patch 2 · F9 · ADR-139) ---
      const duckSec = SolsticeUtils.el('div', { style:'padding:10px;background:var(--c-surface-2);border-radius:6px;' });
      duckSec.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;margin-bottom:4px;' }, '🦆 DuckDB-WASM (acelerador para 100k+ linhas)'));
      duckSec.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-bottom:8px;line-height:1.4;' },
        'Carrega DuckDB no navegador (~5MB primeira vez) e expõe queries SQL via Solstice.Duck.query(). 10-100× mais rápido em agregações complexas de datasets grandes.'));
      const duckLbl = SolsticeUtils.el('label', { style:'display:flex;align-items:center;gap:6px;cursor:pointer;' });
      const duckChk = SolsticeUtils.el('input', { type:'checkbox' });
      if (SolsticeDuck.isEnabled()) duckChk.checked = true;
      duckLbl.appendChild(duckChk);
      duckLbl.appendChild(document.createTextNode(' Ativar DuckDB-WASM'));
      duckSec.appendChild(duckLbl);
      const duckStatus = SolsticeUtils.el('div', { style:'font-size:10px;color:var(--c-muted);margin-top:4px;font-family:var(--font-mono);' });
      function _refreshDuckStatus(){
        if (SolsticeDuck.isLoading()) duckStatus.textContent = '⏳ Carregando…';
        else if (SolsticeDuck.isReady()) duckStatus.textContent = '✓ Carregado e pronto (Solstice.Duck.query)';
        else if (SolsticeDuck.getError()) duckStatus.textContent = '⚠ ' + SolsticeDuck.getError();
        else duckStatus.textContent = SolsticeDuck.isEnabled() ? '(será carregado ao usar)' : 'desativado';
      }
      _refreshDuckStatus();
      duckSec.appendChild(duckStatus);
      const duckBtns = SolsticeUtils.el('div', { style:'display:flex;gap:6px;margin-top:8px;' });
      duckBtns.appendChild(SolsticeUtils.el('button', { class:'solstice__btn', onclick: async () => {
        SolsticeDuck.setEnabled(true); duckChk.checked = true;
        _refreshDuckStatus();
        const r = await SolsticeDuck.load();
        if (r.ok){
          await SolsticeDuck.registerDataset();
          SolsticeToast.success('DuckDB pronto', 'Tabela `data` registrada — use Solstice.Duck.query("SELECT * FROM data LIMIT 10")');
        } else {
          SolsticeToast.error('Falha ao carregar DuckDB', r.error);
        }
        _refreshDuckStatus();
      }}, '⚡ Carregar agora'));
      duckBtns.appendChild(SolsticeUtils.el('button', { class:'solstice__btn solstice__btn--ghost', onclick: async () => {
        if (!SolsticeDuck.isReady()){ SolsticeToast.warn('Carregue primeiro'); return; }
        const sql = await SolsticeModal.prompt({ title:'🦆 Query SQL', message:'Escreva SQL contra a tabela `data`:', placeholder:'SELECT * FROM data LIMIT 10', defaultValue:'SELECT COUNT(*) AS n FROM data;' });
        if (!sql) return;
        const r = await SolsticeDuck.query(sql);
        // Auditoria 2026 (JM-02): gated por SolsticeLog.debug. Antes era
        // console.log direto — ruído no console em produção.
        if (r.ok){
          SolsticeLog.debug('[Duck] result', r.rows);
          SolsticeToast.success('Query OK', r.rows.length + ' linha(s) — veja no console (debug=1).');
        }
        else SolsticeToast.error('Erro SQL', r.error);
      }}, 'Testar SQL'));
      duckSec.appendChild(duckBtns);
      duckChk.addEventListener('change', () => { SolsticeDuck.setEnabled(duckChk.checked); _refreshDuckStatus(); });
      wrap.appendChild(duckSec);

      // --- Hints + Limites ---
      const utilSec = SolsticeUtils.el('div', { style:'padding:10px;background:var(--c-surface-2);border-radius:6px;display:flex;flex-wrap:wrap;gap:6px;' });
      utilSec.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn',
        onclick: () => { SolsticeHints.reset(); SolsticeToast.success('Dicas resetadas — vão aparecer de novo'); }
      }, '🔁 Resetar dicas'));
      utilSec.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn',
        onclick: () => { SolsticeHints.dismissAll(); SolsticeToast.info('Dicas desativadas permanentemente'); }
      }, '🚫 Desativar dicas'));
      utilSec.appendChild(SolsticeUtils.el('button', {
        class:'solstice__btn',
        onclick: () => SolsticeLimits.open()
      }, '📏 Limites do sistema'));
      wrap.appendChild(utilSec);

      // SOL-C4: a seção "Identidade visual (header do app)" foi REMOVIDA.
      // Critério do checklist: "Nenhum caminho na UI edita nome/logo do app".
      // Logo, nome e subtítulo do app voltam ao valor fixo (Solstice / Dashboard
      // Studio / ícone padrão). A identidade do *dashboard* (canvas DashHeader,
      // 📋 Cabeçalho) permanece editável — é onde o usuário customiza o seu
      // próprio dashboard. Compromisso com a U-12 original: o app não suporta
      // mais branding customizado; quem quiser logo no relatório usa o
      // DashHeader do canvas. _applyBrand() ignora os valores em localStorage.

      // --- 🗺️ Mapa visual (minimap) — Auditoria 2026 (U-9) ---
      // Toggle opt-in. Antes abria toda vez (1 vez por sessão sem permissão
      // do usuário). Agora controlado aqui; persiste em localStorage.
      const mapSec = SolsticeUtils.el('div', { style:'padding:10px;background:var(--c-surface-2);border-radius:6px;' });
      const mapHead = SolsticeUtils.el('div', { style:'display:flex;align-items:center;gap:10px;' });
      mapHead.appendChild(SolsticeUtils.el('div', { style:'font-weight:600;flex:1;' },
        '🗺️ Mapa visual do canvas (minimap)'));
      const mapToggle = SolsticeUtils.el('input', {
        type:'checkbox', id:'settings-minimap-enabled',
        checked: (typeof SolsticeMinimap !== 'undefined' && SolsticeMinimap.isEnabled && SolsticeMinimap.isEnabled()) ? 'checked' : null
      });
      mapToggle.addEventListener('change', (e) => {
        if (typeof SolsticeMinimap !== 'undefined' && SolsticeMinimap.setEnabled){
          SolsticeMinimap.setEnabled(!!e.target.checked);
          SolsticeToast.info(e.target.checked ? '🗺️ Minimap ativado' : '🗺️ Minimap desativado',
            'Preferência salva — não muda mais a cada sessão.');
        }
      });
      const mapLabel = SolsticeUtils.el('label', { for:'settings-minimap-enabled', style:'cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--c-text-2);' });
      mapLabel.appendChild(mapToggle);
      mapLabel.appendChild(SolsticeUtils.el('span', null, 'Mostrar'));
      mapHead.appendChild(mapLabel);
      mapSec.appendChild(mapHead);
      mapSec.appendChild(SolsticeUtils.el('div', { style:'font-size:11px;color:var(--c-muted);margin-top:4px;line-height:1.4;' },
        'Visão miniatura do canvas no canto inferior direito, útil em dashboards grandes. Default desligado — sua preferência fica salva.'));
      wrap.appendChild(mapSec);

      SolsticeModal.show({
        title:'⚙️ Configurações',
        body: wrap,
        buttons: [{ label:'Fechar', kind:'primary', onClick: () => true }]
      });
    }

    return { open };
  })();
