
  /* ============================================================
     SolsticeDictionary — núcleo do agnosticismo (Seção 12)

     6 dicionários pré-feitos. Detecção em 3 camadas:
       1) Match exato em sinônimos
       2) Heurística de palavras-chave (PT/EN)
       3) Análise estatística (faixa, distribuição)

     v1 do Bloco 1 entrega 8-12 colunas core por dicionário. Vocabulário
     expandirá em blocos futuros conforme Lucas testar com CSVs reais.
     ============================================================ */
  const SolsticeDictionary = (function(){

    const presets = {
      banco_pj: {
        // ADR-163 (Onda 2 / T2a): preset renomeado pra refletir cobertura ampliada
        // (Carteira + Risco + Atendimento). Anexo A.4 do briefing v5.4.
        name: 'Banco PJ — Atendimento, Carteira e Risco',
        emoji: '🏦', domain: 'financeiro',
        columns: {
          // --- Carteira / Crédito (originais) ---
          'vlr_op_aprov_mensal': { friendlyName:'Receita Mensal', synonyms:['receita','faturamento','volume aprovado','vlr aprovado','op aprovado'], unit:'R$', higherIsBetter:true, description:'Valor de operações aprovadas no mês' },
          'vlr_op_subm_mensal':  { friendlyName:'Volume Submetido', synonyms:['submetido','solicitado','volume solicitado'], unit:'R$', higherIsBetter:true, description:'Valor de operações submetidas' },
          'taxa_aprov':          { friendlyName:'Taxa de Aprovação', synonyms:['aprov %','% aprovação','taxa aprov'], unit:'%', higherIsBetter:true, description:'Razão entre aprovado e submetido' },
          'ticket_medio':        { friendlyName:'Ticket Médio', synonyms:['ticket','valor médio','média op'], unit:'R$', higherIsBetter:true, description:'Valor médio por operação' },
          'spread':              { friendlyName:'Spread', synonyms:['margem financeira','spread bancário'], unit:'%', higherIsBetter:true, description:'Diferença entre taxa cobrada e custo' },
          // --- Risco / Inadimplência (originais) ---
          'dpd30':               { friendlyName:'Inadimplência 30d', synonyms:['dpd 30','atraso 30','mora 30'], unit:'%', higherIsBetter:false, description:'Carteira em atraso há 30+ dias' },
          'dpd60':               { friendlyName:'Inadimplência 60d', synonyms:['dpd 60','atraso 60'], unit:'%', higherIsBetter:false, description:'Carteira em atraso há 60+ dias' },
          'dpd90':               { friendlyName:'Inadimplência 90d', synonyms:['dpd 90','atraso 90','default'], unit:'%', higherIsBetter:false, description:'Carteira em atraso há 90+ dias' },
          'inadimplencia':       { friendlyName:'Inadimplência Total', synonyms:['inad','default rate'], unit:'%', higherIsBetter:false, description:'Percentual total inadimplente' },
          'recuperacao':         { friendlyName:'Taxa de Recuperação', synonyms:['recup','% recuperado'], unit:'%', higherIsBetter:true, description:'Valor recuperado de inadimplência' },
          // --- Identificadores (originais + alias cnpj_cliente) ---
          'cnpj':                { friendlyName:'CNPJ', synonyms:['documento','doc','cnpj_cliente','cliente','id cliente','id_cliente'], unit:'', higherIsBetter:null, description:'Identificador do cliente PJ' },
          'segmento':            { friendlyName:'Segmento', synonyms:['porte','tier','categoria','segmento_pj','porte_cliente'], unit:'', higherIsBetter:null, description:'Segmentação do cliente' },
          // --- Atendimento PJ (NOVO — Anexo A.4) ---
          'qtd_atendimentos':    { friendlyName:'Atendimentos', synonyms:['atendimentos','tickets','chamados','demandas','qtd_tickets','num_atendimentos','volume atendimento'], unit:'', higherIsBetter:null, description:'Quantidade de atendimentos no período' },
          'sla_atend_pct':       { friendlyName:'SLA de Atendimento (%)', synonyms:['sla','sla_pct','nivel_servico','nivel servico','atend_no_prazo','atend dentro prazo','sla atendimento'], unit:'%', higherIsBetter:true, description:'Percentual de atendimentos dentro do SLA' },
          'tempo_medio_atendimento': { friendlyName:'Tempo Médio de Atendimento', synonyms:['tma','tempo_atendimento','tempo atendimento','duracao','duração','tempo_medio','tempo medio'], unit:'min', higherIsBetter:false, description:'Tempo médio para resolver atendimento' },
          'canal_atendimento':   { friendlyName:'Canal', synonyms:['canal','via','origem','origem atendimento','meio_atendimento','meio atendimento'], unit:'', higherIsBetter:null, description:'Canal pelo qual o atendimento entrou' },
          'motivo_atendimento':  { friendlyName:'Motivo', synonyms:['motivo','assunto','tipo_demanda','tipo demanda','categoria atendimento'], unit:'', higherIsBetter:null, description:'Motivo/assunto do atendimento' },
          'status_atend':        { friendlyName:'Status do Atendimento', synonyms:['status','situacao','situação','estagio','estágio','status_atendimento'], unit:'', higherIsBetter:null, description:'Estágio atual do atendimento' },
          'qtd_escalonamentos':  { friendlyName:'Escalonamentos', synonyms:['escalonado','escalonamentos','reaberto','complaint','reclamacoes','reclamações','reabertura'], unit:'', higherIsBetter:false, description:'Quantidade de escalonamentos/reaberturas' },
          'nps':                 { friendlyName:'NPS', synonyms:['nps','satisfacao','satisfação','csat','score_cliente','net promoter'], unit:'', higherIsBetter:true, description:'Net Promoter Score do cliente' },
          'data_atendimento':    { friendlyName:'Data do Atendimento', synonyms:['data','dt','data abertura','data_abertura','dt_atendimento','data_atend'], unit:'', higherIsBetter:null, description:'Data em que o atendimento foi aberto' }
        }
      },
      vendas: {
        name: 'Vendas / Varejo',
        emoji: '💰', domain: 'comercial',
        columns: {
          'receita':       { friendlyName:'Receita', synonyms:['faturamento','vendas','revenue','total vendas'], unit:'R$', higherIsBetter:true },
          'custo_produto': { friendlyName:'Custo Produto', synonyms:['cmv','cogs','custo'], unit:'R$', higherIsBetter:false },
          'margem_bruta':  { friendlyName:'Margem Bruta', synonyms:['margin','gross margin','margem %'], unit:'%', higherIsBetter:true },
          'qt_vendas':     { friendlyName:'Qtd. Vendas', synonyms:['unidades','pedidos','transações','tx'], unit:'', higherIsBetter:true },
          'ticket_medio':  { friendlyName:'Ticket Médio', synonyms:['avg ticket','aov'], unit:'R$', higherIsBetter:true },
          'conversao':     { friendlyName:'Conversão', synonyms:['conv rate','% conversão','conversão %'], unit:'%', higherIsBetter:true },
          'devolucoes':    { friendlyName:'Devoluções', synonyms:['returns','trocas','% devolução'], unit:'%', higherIsBetter:false },
          'cac':           { friendlyName:'CAC', synonyms:['custo aquisição','customer acquisition cost'], unit:'R$', higherIsBetter:false },
          'ltv':           { friendlyName:'LTV', synonyms:['lifetime value','valor cliente'], unit:'R$', higherIsBetter:true },
          'churn':         { friendlyName:'Churn', synonyms:['cancelamento','atrito','% churn'], unit:'%', higherIsBetter:false },
          'mrr':           { friendlyName:'MRR', synonyms:['monthly recurring','receita recorrente'], unit:'R$', higherIsBetter:true },
          'categoria':     { friendlyName:'Categoria', synonyms:['linha','família','tipo'], unit:'', higherIsBetter:null }
        }
      },
      rh: {
        name: 'RH / People Analytics',
        emoji: '👥', domain: 'pessoas',
        columns: {
          'headcount':         { friendlyName:'Headcount', synonyms:['quadro','colaboradores','funcionários','total fte'], unit:'', higherIsBetter:null },
          'turnover':          { friendlyName:'Turnover', synonyms:['rotatividade','% turnover','attrition'], unit:'%', higherIsBetter:false },
          'contratacoes':      { friendlyName:'Contratações', synonyms:['hires','admissões','novas contratações'], unit:'', higherIsBetter:null },
          'desligamentos':     { friendlyName:'Desligamentos', synonyms:['saídas','exits','demissões'], unit:'', higherIsBetter:false },
          'salario_medio':     { friendlyName:'Salário Médio', synonyms:['média salarial','avg salary'], unit:'R$', higherIsBetter:true },
          'tempo_casa':        { friendlyName:'Tempo de Casa', synonyms:['tenure','meses casa','years'], unit:' meses', higherIsBetter:null },
          'absenteismo':       { friendlyName:'Absenteísmo', synonyms:['faltas','% ausência'], unit:'%', higherIsBetter:false },
          'engajamento_score': { friendlyName:'Engajamento', synonyms:['enps','engagement','satisfação'], unit:'', higherIsBetter:true },
          'horas_treinamento': { friendlyName:'Horas de Treinamento', synonyms:['training hours','capacitação'], unit:' h', higherIsBetter:true },
          'custo_folha':       { friendlyName:'Custo de Folha', synonyms:['payroll','folha pagamento'], unit:'R$', higherIsBetter:false },
          'area':              { friendlyName:'Área', synonyms:['departamento','setor','time'], unit:'', higherIsBetter:null }
        }
      },
      marketing: {
        name: 'Marketing / CRM',
        emoji: '📊', domain: 'marketing',
        columns: {
          'impressoes':      { friendlyName:'Impressões', synonyms:['impressions','views','visualizações'], unit:'', higherIsBetter:true },
          'cliques':         { friendlyName:'Cliques', synonyms:['clicks','clicks total'], unit:'', higherIsBetter:true },
          'ctr':             { friendlyName:'CTR', synonyms:['click rate','taxa clique','% ctr'], unit:'%', higherIsBetter:true },
          'cpm':             { friendlyName:'CPM', synonyms:['cost per mille','custo por mil'], unit:'R$', higherIsBetter:false },
          'cpc':             { friendlyName:'CPC', synonyms:['cost per click','custo por clique'], unit:'R$', higherIsBetter:false },
          'cpl':             { friendlyName:'CPL', synonyms:['cost per lead','custo lead'], unit:'R$', higherIsBetter:false },
          'conversoes':      { friendlyName:'Conversões', synonyms:['conversions','leads convertidos'], unit:'', higherIsBetter:true },
          'conversao_rate':  { friendlyName:'Taxa Conversão', synonyms:['cvr','% conv','conv rate'], unit:'%', higherIsBetter:true },
          'roas':            { friendlyName:'ROAS', synonyms:['return on ad spend','retorno ads'], unit:'x', higherIsBetter:true },
          'leads':           { friendlyName:'Leads', synonyms:['mql','sql','novos leads'], unit:'', higherIsBetter:true },
          'campanha':        { friendlyName:'Campanha', synonyms:['campaign','ação','iniciativa'], unit:'', higherIsBetter:null }
        }
      },
      operacional: {
        name: 'Operacional / Logística',
        emoji: '🏭', domain: 'operacional',
        columns: {
          'pedidos':     { friendlyName:'Pedidos', synonyms:['orders','requisições','ordens'], unit:'', higherIsBetter:true },
          'concluidos':  { friendlyName:'Concluídos', synonyms:['completed','finalizados','entregues'], unit:'', higherIsBetter:true },
          'em_processo': { friendlyName:'Em Processo', synonyms:['wip','andamento','open'], unit:'', higherIsBetter:null },
          'atrasados':   { friendlyName:'Atrasados', synonyms:['delayed','late','overdue'], unit:'', higherIsBetter:false },
          'lead_time':   { friendlyName:'Lead Time', synonyms:['tempo total','cycle time','tat'], unit:' dias', higherIsBetter:false },
          'sla':         { friendlyName:'SLA', synonyms:['% sla','service level','cumprimento'], unit:'%', higherIsBetter:true },
          'ocupacao':    { friendlyName:'Ocupação', synonyms:['utilização','% ocupação','utilization'], unit:'%', higherIsBetter:true },
          'capacidade':  { friendlyName:'Capacidade', synonyms:['capacity','limite','máximo'], unit:'', higherIsBetter:null },
          'fila':        { friendlyName:'Fila', synonyms:['queue','backlog','pendentes'], unit:'', higherIsBetter:false },
          'eficiencia':  { friendlyName:'Eficiência', synonyms:['oee','efficiency','rendimento'], unit:'%', higherIsBetter:true },
          'defeitos':    { friendlyName:'Defeitos', synonyms:['defects','falhas','% defeito'], unit:'%', higherIsBetter:false },
          'turno':       { friendlyName:'Turno', synonyms:['shift','período'], unit:'', higherIsBetter:null }
        }
      },
      cientifico: {
        name: 'Científico / Pesquisa',
        emoji: '🔬', domain: 'pesquisa',
        columns: {
          'amostra_n':      { friendlyName:'Tamanho da Amostra', synonyms:['n','amostras','sample size'], unit:'', higherIsBetter:true },
          'media':          { friendlyName:'Média', synonyms:['avg','mean','x̄','média aritmética'], unit:'', higherIsBetter:null },
          'mediana':        { friendlyName:'Mediana', synonyms:['median','p50'], unit:'', higherIsBetter:null },
          /* Auditoria 2026 (L-T-1 / A-205): rótulo explicita "(amostral)" — corresponde
             à fórmula usada em SolsticeStats (denom n-1, não n). */
          'desvio':         { friendlyName:'Desvio Padrão (amostral)', synonyms:['sd','stddev','σ','sigma','desvio padrão amostral'], unit:'', higherIsBetter:null },
          'intervalo_conf': { friendlyName:'Intervalo de Confiança', synonyms:['ic','ci','95% ci'], unit:'%', higherIsBetter:null },
          'pvalue':         { friendlyName:'p-valor', synonyms:['p-value','p','significância'], unit:'', higherIsBetter:false },
          'correlacao':     { friendlyName:'Correlação', synonyms:['pearson','r','correlation','rho'], unit:'', higherIsBetter:null },
          'r2':             { friendlyName:'R²', synonyms:['r squared','coef determinação','r2'], unit:'', higherIsBetter:true },
          'tratamento':     { friendlyName:'Grupo Tratamento', synonyms:['treated','group','condition'], unit:'', higherIsBetter:null },
          'controle':       { friendlyName:'Grupo Controle', synonyms:['control','baseline','placebo'], unit:'', higherIsBetter:null }
        }
      },
      generico: {
        name: 'Genérico (fallback)',
        emoji: '📄', domain: 'qualquer',
        columns: {}
      }
    };

    /** Heurística de palavras-chave para fallback de detecção. */
    const HEURISTICS = [
      { match: /^(id|cod|codigo|cnpj|cpf|cep|hash|uuid)$/i,  type:'identifier' },
      { match: /^(data|date|dt_|dia|mes|ano|year|month|day|timestamp)/i, type:'temporal' },
      { match: /^(vlr|valor|amount|total|receita|custo|preco|price|cost|revenue|faturamento)/i, type:'currency' },
      { match: /^(qt|qtd|qty|num|count|n_|cnt)/i, type:'integer' },
      { match: /^(pct|perc|taxa|rate|ratio|.*_pct$|.*\sx)/i, type:'percentage' },
      { match: /^(email|e_mail)/i, type:'email' },
      { match: /^(tel|phone|fone|celular)/i, type:'phone_br' },
      { match: /^(url|link|site)/i, type:'url' },
      { match: /^(uf|estado|state)$/i, type:'geo_uf' },
      { match: /^(pais|country)$/i, type:'geo_country' },
      { match: /^(lat|latitude)$/i, type:'geo_lat' },
      { match: /^(lng|lon|long|longitude)$/i, type:'geo_lng' },
      { match: /^(ativo|flag|bool|sim_nao|is_)/i, type:'flag' }
    ];

    function _norm(s){
      return String(s||'')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g,'') // remove acentos
        .replace(/[^a-z0-9]+/g,' ').trim();
    }

    /** Match em sinônimos: retorna o melhor candidato com score. */
    function matchSynonym(colName, dict){
      const target = _norm(colName);
      if (!target) return null;
      const cols = dict.columns;
      let best = null;

      for (const techKey in cols){
        const def = cols[techKey];
        const candidates = [techKey, def.friendlyName, ...(def.synonyms||[])];
        for (const c of candidates){
          const n = _norm(c);
          if (!n) continue;
          if (n === target) return { techKey, def, score: 1.0, matchType:'exact' };
          if (target.includes(n) || n.includes(target)){
            const score = Math.min(n.length, target.length) / Math.max(n.length, target.length);
            if (!best || score > best.score) best = { techKey, def, score, matchType:'partial' };
          }
        }
      }
      return best && best.score >= 0.5 ? best : null;
    }

    function applyHeuristic(colName){
      for (const h of HEURISTICS){
        if (h.match.test(colName)) return { type: h.type };
      }
      return null;
    }

    /**
     * Detecta qual dicionário se aplica a um conjunto de colunas.
     * Retorna { dictKey, confidence (0-1), matches: [{col, ...}], unmatched: [...] }
     *
     * Estratégia: para cada dicionário pré-feito, conta quantas colunas
     * casam via matchSynonym. O dicionário com maior cobertura ganha.
     * Confidence = (matches / total) * peso_qualidade.
     */
    function detect(columns){
      const results = [];
      for (const key in presets){
        if (key === 'generico') continue;
        const dict = presets[key];
        const matches = [];
        const unmatched = [];
        for (const col of columns){
          const m = matchSynonym(col, dict);
          if (m) matches.push({ col, ...m });
          else unmatched.push(col);
        }
        const cov = matches.length / columns.length;
        const avgScore = matches.length ? matches.reduce((s,m) => s + m.score, 0) / matches.length : 0;
        const confidence = cov * 0.7 + avgScore * 0.3;
        results.push({ dictKey: key, dict, confidence, matches, unmatched, coverage: cov });
      }
      results.sort((a,b) => b.confidence - a.confidence);
      const winner = results[0];

      // Auditoria 2026.6 (DICT-CONF): só aplica o vocabulário especializado de um
      // domínio pré-feito quando a confiança passa do limiar. ANTES, um match
      // fraco (CSV de vendas batendo 44% com "Banco PJ", cobrindo só 3/9 colunas)
      // empurrava nomes errados ("Data do Atendimento", "Segmento"). Abaixo do
      // limiar, cai pro genérico (Title Case neutro da própria coluna).
      const MIN_DICT_CONF = (typeof SolsticeConfig !== 'undefined' && SolsticeConfig.DICT_DETECT_MIN_CONF) || 0.55;
      if (!winner || winner.confidence < MIN_DICT_CONF){
        // Fallback: dicionário genérico, monta a partir de heurísticas
        const matches = [];
        for (const col of columns){
          const h = applyHeuristic(col);
          if (h){
            matches.push({
              col,
              techKey: col,
              def: {
                friendlyName: _toTitleCase(col),
                synonyms: [],
                unit: '',
                higherIsBetter: null,
                description: 'Inferido por heurística (tipo: '+h.type+')'
              },
              score: 0.5,
              matchType: 'heuristic'
            });
          } else {
            matches.push({
              col,
              techKey: col,
              def: { friendlyName: _toTitleCase(col), synonyms:[], unit:'', higherIsBetter:null },
              score: 0.3,
              matchType: 'fallback'
            });
          }
        }
        return {
          dictKey: 'generico',
          dict: presets.generico,
          domain: (presets.generico && presets.generico.domain) || 'generico',
          confidence: 0,
          matches,
          unmatched: [],
          coverage: 0,
          alternatives: results
        };
      }
      // SOL-H2 v2: domain exposto no topo do resultado, derivado das colunas
      // reais (via match em synonyms/heurística), não fixo em preset.
      return {
        ...winner,
        domain: (winner.dict && winner.dict.domain) || winner.dictKey,
        alternatives: results.slice(1, 4)
      };
    }

    function _toTitleCase(s){
      return String(s)
        .replace(/[_-]+/g,' ')
        .replace(/([a-z])([A-Z])/g,'$1 $2')
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
    }

    /** Constrói o dicionário FINAL aplicado ao dataset, baseado na detecção + overrides do usuário.
     *  v5.4 (Prompt 1 - LGPD): preserva `_presetKey` (ex: 'banco_pj') no dicionário final
     *  para que SolsticeLLM possa decidir bloquear envio a provider externo. Snapshots antigos
     *  sem `_presetKey` ficam livres (fail-open intencional para compat). */
    function build(detection, overrides){
      const dict = {
        domain: detection.dict.domain,
        _presetKey: detection.dictKey || null, // Prompt 1 LGPD: rastreia preset de origem
        audience:'executivo',
        columns: {}
      };
      detection.matches.forEach(m => {
        dict.columns[m.col] = {
          friendlyName: m.def.friendlyName,
          unit: m.def.unit || '',
          higherIsBetter: m.def.higherIsBetter,
          synonyms: m.def.synonyms || [],
          description: m.def.description || '',
          source: m.matchType
        };
      });
      if (overrides){
        for (const col in overrides){
          dict.columns[col] = { ...(dict.columns[col]||{}), ...overrides[col] };
        }
      }
      return dict;
    }

    /** Salva dicionário aplicado com um nome (Bloco 11 usará). */
    function save(name, dict){
      try {
        const all = JSON.parse(localStorage.getItem('solstice.dicts')||'{}');
        all[name] = { name, dict, savedAt: new Date().toISOString() };
        localStorage.setItem('solstice.dicts', JSON.stringify(all));
      } catch(e){ SolsticeErrors.show('STORAGE_QUOTA_EXCEEDED'); }
    }
    function load(name){
      try {
        const all = JSON.parse(localStorage.getItem('solstice.dicts')||'{}');
        return all[name] ? all[name].dict : null;
      } catch(e){ return null; }
    }
    function listSaved(){
      try { return Object.keys(JSON.parse(localStorage.getItem('solstice.dicts')||'{}')); }
      catch(e){ return []; }
    }

    /* ===== Modal de configuração ===== */
    function openConfigModal(detection, columns, onApply){
      // Patch B6-r1: backdrop não fecha (modal tem botão ✕ e inputs editáveis com seleção de texto)
      let _dragStartedInside = false;
      // Auditoria 2026.4 (Sprint 13a / A11y-02): role=dialog + aria-modal + aria-labelledby
      const titleId = 'solstice-dict-title-' + Math.random().toString(36).slice(2, 8);
      const overlay = SolsticeUtils.el('div', {
        class: 'solstice__modal-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        onmousedown: e => { _dragStartedInside = !!(e.target.closest && e.target.closest('.solstice__modal')); },
        onclick: e => { if (e.target !== overlay) return; if (_dragStartedInside){ _dragStartedInside = false; return; } /* não fecha por backdrop neste modal */ }
      });
      const modal   = SolsticeUtils.el('div', { class: 'solstice__modal solstice__modal--lg' });

      modal.appendChild(SolsticeUtils.el('div', { class: 'solstice__modal-header' },
        SolsticeUtils.el('div', { class: 'solstice__modal-title', id: titleId }, '🧠 ' + SolsticeLocale.t('dict.title')),
        SolsticeUtils.el('button', { class: 'solstice__modal-close', 'aria-label':'Fechar', title:'Fechar (Esc)', onclick: () => overlay.remove() }, '✕')
      ));

      const body = SolsticeUtils.el('div', { class: 'solstice__modal-body' });

      // Banner com detecção
      // Auditoria 2026 (M-X-1 / A-107): substitui innerHTML interpolado por
      // appendChild + textContent. detection.dict.name pode vir de dicionário
      // customizado — escape garantido pelo navegador (textContent).
      const banner = SolsticeUtils.el('div', { class: 'solstice__dict-banner' });
      const strong = SolsticeUtils.el('strong');
      if (detection.dictKey === 'generico'){
        banner.appendChild(document.createTextNode('🤔 ' + SolsticeLocale.t('dict.subtitle') + ' '));
        strong.textContent = (detection.dict.emoji || '') + ' ' + (detection.dict.name || '');
        banner.appendChild(strong);
        banner.appendChild(document.createTextNode('. Não bateu com nenhum domínio pré-feito — você pode customizar abaixo.'));
      } else {
        const pct = SolsticeLocale.percent(detection.confidence, 0);
        banner.appendChild(document.createTextNode((detection.dict.emoji || '') + ' ' + SolsticeLocale.t('dict.subtitle') + ' '));
        strong.textContent = detection.dict.name || '';
        banner.appendChild(strong);
        banner.appendChild(document.createTextNode(' · ' + SolsticeLocale.t('dict.conf') + ': ' + pct));
      }
      body.appendChild(banner);

      // Tabela
      const table = SolsticeUtils.el('table', { class: 'solstice__dict-table' });
      const thead = SolsticeUtils.el('thead', null,
        SolsticeUtils.el('tr', null,
          SolsticeUtils.el('th', null, SolsticeLocale.t('dict.col')),
          SolsticeUtils.el('th', null, SolsticeLocale.t('dict.friendly')),
          SolsticeUtils.el('th', null, SolsticeLocale.t('dict.unit')),
          SolsticeUtils.el('th', null, SolsticeLocale.t('dict.higher')),
          SolsticeUtils.el('th', null, SolsticeLocale.t('dict.conf'))
        )
      );
      table.appendChild(thead);

      const tbody = SolsticeUtils.el('tbody');
      const inputs = {}; // col -> {friendly, unit, higher}

      detection.matches.forEach(m => {
        const row = SolsticeUtils.el('tr');
        row.appendChild(SolsticeUtils.el('td', null, SolsticeUtils.el('code', null, m.col)));

        const friendly = SolsticeUtils.el('input', { class:'solstice__dict-input', type:'text', value: m.def.friendlyName });
        row.appendChild(SolsticeUtils.el('td', null, friendly));

        const unit = SolsticeUtils.el('input', { class:'solstice__dict-input', type:'text', value: m.def.unit || '', placeholder:'R$, %, kg…', style:{maxWidth:'90px'} });
        row.appendChild(SolsticeUtils.el('td', null, unit));

        const higher = SolsticeUtils.el('select', { class:'solstice__dict-select', style:{maxWidth:'110px'} });
        const opts = [['', 'N/A'], ['true','↑ Maior'], ['false','↓ Menor']];
        opts.forEach(([v,l]) => {
          const o = SolsticeUtils.el('option', { value: v }, l);
          if (String(m.def.higherIsBetter) === v) o.selected = true;
          higher.appendChild(o);
        });
        row.appendChild(SolsticeUtils.el('td', null, higher));

        let badgeKind = m.score >= 0.8 ? 'high' : m.score >= 0.5 ? 'med' : 'low';
        const badge = SolsticeUtils.el('span', { class:'solstice__dict-badge solstice__dict-badge--'+badgeKind },
          m.matchType === 'exact' ? '100%' :
          m.matchType === 'partial' ? SolsticeLocale.percent(m.score, 0) :
          m.matchType === 'heuristic' ? '~heur' : '—');
        row.appendChild(SolsticeUtils.el('td', null, badge));

        inputs[m.col] = { friendly, unit, higher };
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      body.appendChild(table);

      modal.appendChild(body);
      modal.appendChild(SolsticeUtils.el('div', { class: 'solstice__modal-footer' },
        SolsticeUtils.el('button', { class: 'solstice__btn', onclick: () => overlay.remove() }, SolsticeLocale.t('dict.skip')),
        SolsticeUtils.el('button', { class: 'solstice__btn solstice__btn--primary', onclick: () => {
          const overrides = {};
          for (const col in inputs){
            const { friendly, unit, higher } = inputs[col];
            const hVal = higher.value === '' ? null : higher.value === 'true';
            overrides[col] = { friendlyName: friendly.value, unit: unit.value, higherIsBetter: hVal };
          }
          const finalDict = build(detection, overrides);
          SolsticeStore.set('dictionary', finalDict);
          overlay.remove();
          if (onApply) onApply(finalDict);
          SolsticeToast.success('Dicionário aplicado', Object.keys(finalDict.columns).length + ' colunas configuradas');
        }}, SolsticeLocale.t('dict.apply'))
      ));

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    }

    /**
     * G2-07 v3 · Dicionário modo HEADLESS (Auditoria 2026.4).
     * Motivação: dicionário aprendido em runtime ("pensar na hora") é melhor
     * que casar com presets fixos quando o domínio do dataset não está nos 6
     * presets. A função detect() padrão tenta casar com os 6 presets fixos;
     * quando o CSV não bate (confidence < 0.3) cai pro genérico via heurística
     * — mas ainda CARREGA o _presetKey 'generico'.
     *
     * detectHeadless() infere o domínio APENAS a partir das colunas reais,
     * sem comparar com presets fixos. Retorna friendly names em Title Case,
     * unidade inferida do nome (R$/%/un.), e domain derivado dos campos
     * mais comuns (atendimento/vendas/financeiro/operacional/genérico).
     *
     * Uso: SolsticeDictionary.detectHeadless(['data_atend', 'qtd_chamados', 'nps']).
     * Retorna { domain, columns: { col: { friendlyName, unit, higherIsBetter } } }.
     */
    function detectHeadless(columns){
      const cols = Array.isArray(columns) ? columns : [];
      const out = { domain: 'inferido', _headless: true, columns: {} };
      const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      const KEYWORDS = {
        atendimento: /atend|ticket|chamado|sla|tma|nps|csat|reabertur|escalad/,
        vendas:      /vend|receita|fatur|ticket\b|conv|client|pedido|venda|compra|ltv|cac|mrr/,
        financeiro:  /vlr|valor|saldo|spread|taxa\b|inad|dpd|recupera|operac|opera|aprov/,
        operacional: /producao|estoque|fila|defeit|eficienci|oee|turno|throughput/,
        pesquisa:    /amostra|media|mediana|desvio|p[-_]?value|correla|r2|tratament|controle/
      };
      let votes = { atendimento:0, vendas:0, financeiro:0, operacional:0, pesquisa:0 };
      const _titleCase = s => norm(s).replace(/[_-]+/g,' ').replace(/\b\w/g, c => c.toUpperCase());
      for (const col of cols){
        const n = norm(col);
        for (const dom in KEYWORDS){ if (KEYWORDS[dom].test(n)) votes[dom]++; }
        // Inferência de unidade pelo nome
        let unit = '';
        let higherIsBetter = null;
        if (/vlr|valor|receita|fatur|preco|custo|saldo/.test(n)) { unit = 'R$'; higherIsBetter = /receita|fatur|aprov|recupera/.test(n) ? true : (/custo|inad|dpd/.test(n) ? false : null); }
        else if (/pct|perc|taxa|rate|_pct|sla/.test(n))           { unit = '%';   higherIsBetter = /aprov|sla|conv|satisf|recupera|eficienc/.test(n) ? true : (/churn|inad|defeit|turnover|dpd/.test(n) ? false : null); }
        else if (/dias|days|tempo|tma|duracao/.test(n))           { unit = '';    higherIsBetter = /tma|tempo|duracao/.test(n) ? false : null; }
        else if (/qt|qtd|qty|num|count|n_|cnt/.test(n))           { unit = '';    higherIsBetter = null; }
        out.columns[col] = {
          friendlyName: _titleCase(col),
          synonyms: [],
          unit,
          higherIsBetter,
          description: 'Inferido headless (sem preset)',
          source: 'headless'
        };
      }
      // Domínio = vote majority, com tiebreaker para 'inferido'
      let topDomain = 'inferido', topVotes = 0;
      for (const dom in votes){ if (votes[dom] > topVotes){ topDomain = dom; topVotes = votes[dom]; } }
      out.domain = topVotes >= 2 ? topDomain : 'inferido';
      return out;
    }

    return { presets, detect, detectHeadless, matchSynonym, applyHeuristic, build, save, load, listSaved, openConfigModal };
  })();
