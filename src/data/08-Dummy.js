
  const SolsticeDummy = (function(){
    const REGIOES = ['Sudeste','Sul','Nordeste','Norte','Centro-Oeste'];
    const UFS = { 'Sudeste':['SP','RJ','MG','ES'], 'Sul':['PR','SC','RS'], 'Nordeste':['BA','PE','CE','PB','RN','AL','SE','MA','PI'], 'Norte':['AM','PA','AC','RO','RR','AP','TO'], 'Centro-Oeste':['DF','GO','MT','MS'] };
    const CATEGORIAS = ['Alimentos','Bebidas','Higiene','Limpeza','Eletrônicos','Vestuário','Móveis'];
    const CANAIS = ['Loja Física','E-commerce','Marketplace','Atacado'];

    function gerar(seed, n){
      seed = seed || 42;
      n = n || 200;
      const rnd = SolsticeUtils.seededRandom(seed);
      const rows = [];
      const start = new Date(2024, 0, 1);
      const ms = 1000*60*60*24;
      for (let i = 0; i < n; i++){
        const dt = new Date(start.getTime() + Math.floor(rnd()*365)*ms);
        const regiao = REGIOES[Math.floor(rnd()*REGIOES.length)];
        const uf = UFS[regiao][Math.floor(rnd()*UFS[regiao].length)];
        const categoria = CATEGORIAS[Math.floor(rnd()*CATEGORIAS.length)];
        const canal = CANAIS[Math.floor(rnd()*CANAIS.length)];
        const qt_vendas = 1 + Math.floor(rnd()*50);
        const ticket_medio = 50 + rnd()*450;
        const receita = qt_vendas * ticket_medio * (0.9 + rnd()*0.2);
        const margem_bruta = 18 + rnd()*30;
        const conversao = 1 + rnd()*8;
        const devolucoes = rnd()*4;
        rows.push({
          data: dt.toISOString().slice(0,10),
          regiao, uf, categoria, canal,
          qt_vendas,
          ticket_medio: Number(ticket_medio.toFixed(2)),
          receita: Number(receita.toFixed(2)),
          margem_bruta: Number(margem_bruta.toFixed(2)),
          conversao: Number(conversao.toFixed(2)),
          devolucoes: Number(devolucoes.toFixed(2))
        });
      }
      return rows;
    }

    function toCSV(rows){
      if (!rows.length) return '';
      const cols = Object.keys(rows[0]);
      const head = cols.join(',');
      const body = rows.map(r => cols.map(c => {
        const v = r[c];
        if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) return '"'+v.replace(/"/g,'""')+'"';
        return v;
      }).join(',')).join('\n');
      return head + '\n' + body;
    }

    /* ============================================================
       B8-03 (v6-autonomous / PA-02 — Cláudia/Stone) — 2 dummies adicionais
       Power user precisa exemplos pra explorar; vendas só não cobre RH/Ops.
       ============================================================ */
    const CARGOS = ['Analista', 'Coordenador', 'Gerente', 'Diretor', 'Estagiário', 'Especialista'];
    const DEPARTAMENTOS = ['TI', 'Comercial', 'RH', 'Financeiro', 'Operações', 'Marketing', 'Jurídico'];
    const SENIORIDADES = ['Júnior','Pleno','Sênior','Lead'];

    function gerarRH(seed, n){
      seed = seed || 99;
      n = n || 150;
      const rnd = SolsticeUtils.seededRandom(seed);
      const startAdm = new Date(2018, 0, 1);
      const ms = 1000*60*60*24;
      const rows = [];
      for (let i = 0; i < n; i++){
        const dt = new Date(startAdm.getTime() + Math.floor(rnd()*2200)*ms);
        const dep = DEPARTAMENTOS[Math.floor(rnd()*DEPARTAMENTOS.length)];
        const cargo = CARGOS[Math.floor(rnd()*CARGOS.length)];
        const sen = SENIORIDADES[Math.floor(rnd()*SENIORIDADES.length)];
        const salario = 2500 + rnd()*22000;
        const idade = 22 + Math.floor(rnd()*38);
        const satisf = Math.round(60 + rnd()*40);
        const horas_mes = 140 + rnd()*60;
        const ativo = rnd() > 0.12 ? 'Sim' : 'Não';
        rows.push({
          colaborador_id: 'C' + (1000 + i),
          data_admissao: dt.toISOString().slice(0,10),
          departamento: dep,
          cargo, senioridade: sen,
          idade,
          salario: Number(salario.toFixed(2)),
          satisfacao_pct: satisf,
          horas_mes: Number(horas_mes.toFixed(1)),
          ativo
        });
      }
      return rows;
    }

    function gerarOps(seed, n){
      seed = seed || 77;
      n = n || 180;
      const rnd = SolsticeUtils.seededRandom(seed);
      const CANAIS_OPS = ['WhatsApp','Telefone','Email','Chat','Presencial'];
      const STATUS = ['Resolvido','Em andamento','Escalado','Pendente'];
      const PRIORIDADES = ['Baixa','Média','Alta','Crítica'];
      const startOp = new Date(2025, 0, 1);
      const ms = 1000*60*60*24;
      const rows = [];
      for (let i = 0; i < n; i++){
        const dt = new Date(startOp.getTime() + Math.floor(rnd()*120)*ms);
        const ch = CANAIS_OPS[Math.floor(rnd()*CANAIS_OPS.length)];
        const st = STATUS[Math.floor(rnd()*STATUS.length)];
        const pri = PRIORIDADES[Math.floor(rnd()*PRIORIDADES.length)];
        const tma_min = 2 + rnd()*120; // tempo médio atendimento
        const sla_min = 30 + Math.floor(rnd()*60);
        const dentro_sla = tma_min <= sla_min ? 'Sim' : 'Não';
        const csat = Math.round(1 + rnd()*4); // 1-5
        const tickets = 1 + Math.floor(rnd()*3);
        rows.push({
          data_atendimento: dt.toISOString().slice(0,10),
          canal: ch,
          prioridade: pri,
          status: st,
          tma_min: Number(tma_min.toFixed(1)),
          sla_min,
          dentro_sla,
          csat_score: csat,
          tickets_abertos: tickets
        });
      }
      return rows;
    }

    function load(opts){
      const rows = gerar(opts && opts.seed, opts && opts.n);
      const cols = Object.keys(rows[0]);
      // FIX solstice-modular-v1: infere types e popula `ingest.*` (não só
      // `dataset.*`). Antes só populava dataset → componentes (KPI, Bar, etc.)
      // que dependem de Store.get('ingest') ficavam em estado "Sem dataset
      // carregado" mesmo após Dummy.load(). Agora bate.
      const types = {};
      cols.forEach(c => {
        try {
          if (typeof SolsticeTypes !== 'undefined' && SolsticeTypes.inferColumn){
            const sample = rows.slice(0, 100).map(r => r[c]);
            types[c] = SolsticeTypes.inferColumn(sample);
          } else {
            // Fallback simples: olha o primeiro valor não-null
            const v = rows.find(r => r[c] != null)?.[c];
            const t = typeof v === 'number' ? 'number' : 'string';
            types[c] = { type: t };
          }
        } catch(_){
          types[c] = { type: 'string' };
        }
      });
      SolsticeStore.batch(() => {
        SolsticeStore.set('dataset.rows', rows);
        SolsticeStore.set('dataset.columns', cols);
        SolsticeStore.set('dataset.name', 'vendas_br_dummy.csv');
        SolsticeStore.set('dataset.source', 'dummy');
        // Espelha em `ingest.*` (que é o que Components/Quality/Inspector
        // realmente consultam pra renderizar).
        SolsticeStore.set('ingest', {
          rows: rows,
          columns: cols,
          types: types,
          name: 'vendas_br_dummy.csv',
          source: 'dummy',
        });
      });
      SolsticeStore.set('dataset.ready', true); // dispara subscribers de dataset.*
      SolsticeToast.success(SolsticeLocale.t('toast.dummy.loaded'), rows.length + ' linhas · ' + cols.length + ' colunas');

      // POLISH 12 (solstice-modular-v1): one-click experience — se o canvas
      // está vazio e o user acabou de pedir dataset de exemplo, monta um
      // dashboard automático na hora via AutoDashboard. Sem precisar clicar
      // "Auto" depois. Se quiser começar do zero, o user limpa as seções
      // (já tem botão "Começar do zero" no banner de autosave).
      // Skip silencioso se o user já tem trabalho em andamento.
      try {
        const opts2 = opts || {};
        if (opts2.autoBuild !== false){
          const currentSections = SolsticeStore.get('canvas.sections') || [];
          if (!currentSections.length && typeof SolsticeAutoDashboard !== 'undefined'
              && SolsticeAutoDashboard.run){
            // Pequeno delay pra deixar o boot de outros subscribers acontecer
            // antes (Inspector/Filters/etc. ouvem dataset.ready primeiro).
            setTimeout(() => {
              try { SolsticeAutoDashboard.run({ silent: true }); }
              catch(e){ SolsticeLog.debug('[Dummy] autoBuild falhou', e && e.message); }
            }, 400);
          }
        }
      } catch(_){ /* não bloqueia o load */ }

      return { rows, cols };
    }

    /**
     * SolsticeDummy — geradores de CSV de exemplo.
     * @returns {{
     *   gerar(seed?:number, n?:number): Array,        // Vendas BR (200 linhas default)
     *   gerarRH(seed?:number, n?:number): Array,      // People snapshot (150)
     *   gerarOps(seed?:number, n?:number): Array,     // Operacional atendimento (180)
     *   toCSV(rows:Array): string,
     *   load(): Promise<{rows, cols}>                 // carrega vendas default no Store
     * }}
     */
    return { gerar, gerarRH, gerarOps, toCSV, load };
  })();
