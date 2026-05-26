
  /* ============================================================
     BLOCO 11 — SolsticeTemplatesItau (ADR-083)
     3 templates pré-instalados para domínio bancário PJ.
     Aparecem no picker do Templates (B3) quando dicionário detectado
     for "banco_pj" OU explicitamente listados.
     ============================================================ */
  const SolsticeTemplatesItau = (function(){

    /** Helper: cria slot configurado. */
    function _slot(type, config){
      return { id: SolsticeUtils.uuid(), type, config: config || {} };
    }

    /** 3 templates de domínio Itaú. */
    const TEMPLATES = [
      {
        id: 'itau-carteira-pj-mensal',
        name: 'Carteira PJ — Visão Mensal',
        icon: '🏦',
        description: 'Volume aprovado · evolução temporal · concentração por segmento · DPD30.',
        domain: 'banco_pj',
        domainLabel: 'Banco PJ',
        build: () => [
          {
            title: 'KPIs principais',
            rows: [{ layout: '3col-equal', slots: [
              _slot('kpi',   { column: 'vlr_op_aprov_mensal', agg: 'sum' }),
              _slot('kpi',   { column: 'DPD30', agg: 'avg' }),
              _slot('gauge', { column: 'DPD30', agg: 'avg', min: 0, max: 100, target: 5 })
            ]}]
          },
          {
            title: 'Evolução e composição',
            rows: [{ layout: '2col-equal', slots: [
              _slot('time-series', { xColumn: 'mes_ref', yColumn: 'vlr_op_aprov_mensal', bin: 'month', kind: 'line' }),
              _slot('sankey', { sourceColumn: 'regiao', targetColumn: 'segmento', valueColumn: 'vlr_op_aprov_mensal' })
            ]}]
          }
        ]
      },
      {
        id: 'itau-inadimplencia',
        name: 'Acompanhamento de Inadimplência',
        icon: '⚠️',
        description: 'DPD30/60/90 · outliers · tendência · distribuição por segmento.',
        domain: 'banco_pj',
        domainLabel: 'Banco PJ',
        build: () => [
          {
            title: 'Indicadores de risco',
            rows: [{ layout: '3col-equal', slots: [
              _slot('kpi',     { column: 'DPD30', agg: 'avg', comparison: { type: 'previous-period' } }),
              _slot('kpi',     { column: 'DPD60', agg: 'avg', comparison: { type: 'previous-period' } }),
              _slot('kpi',     { column: 'DPD90', agg: 'avg', comparison: { type: 'previous-period' } })
            ]}]
          },
          {
            title: 'Distribuição e outliers',
            rows: [{ layout: '2col-equal', slots: [
              _slot('boxplot',      { valueColumn: 'DPD30', groupColumn: 'segmento' }),
              _slot('distribution', { column: 'DPD30', bins: 25 })
            ]}]
          },
          {
            title: 'Evolução',
            rows: [{ layout: '1col', slots: [
              _slot('time-series', { xColumn: 'mes_ref', yColumn: 'DPD30', bin: 'month', kind: 'line' })
            ]}]
          }
        ]
      },
      {
        id: 'itau-pipeline-comercial',
        name: 'Pipeline Comercial PJ',
        icon: '📈',
        description: 'Funil canal → segmento → produto · top performers · ticket médio.',
        domain: 'banco_pj',
        domainLabel: 'Banco PJ',
        build: () => [
          {
            title: 'Funil de aprovação',
            rows: [{ layout: '1col', slots: [
              _slot('sankey', { sourceColumn: 'canal', targetColumn: 'produto', valueColumn: 'vlr_op_aprov_mensal' })
            ]}]
          },
          {
            title: 'Comparação por canal',
            rows: [{ layout: '2col-equal', slots: [
              _slot('boxplot', { valueColumn: 'ticket_medio', groupColumn: 'canal' }),
              _slot('table',   { rowLimit: 50 })
            ]}]
          }
        ]
      },
      // ============================================================
      // ADR-164 (Onda 2 / T2c) — 3 templates novos de Atendimento PJ
      // Spec: Anexo A do briefing v5.4.
      // Colunas usam NOMES TÉCNICOS do preset (qtd_atendimentos, sla_atend_pct,
      // etc.). O SolsticeTemplates.apply faz remap automático via synonyms (T2d).
      // ============================================================
      {
        id: 'itau-atendimento-volumes',
        name: 'Volumes de Atendimento PJ',
        icon: '📞',
        description: 'Volume de atendimentos · SLA · canal · evolução temporal.',
        domain: 'banco_pj',
        domainLabel: 'Banco PJ — Atendimento',
        build: () => [
          {
            title: 'KPIs principais',
            rows: [{ layout: '3col-equal', slots: [
              _slot('kpi', { column: 'qtd_atendimentos', agg: 'sum', comparison: { type: 'previous-period' } }),
              _slot('kpi', { column: 'sla_atend_pct', agg: 'avg', comparison: { type: 'previous-period' } }),
              _slot('gauge', { column: 'sla_atend_pct', agg: 'avg', min: 0, max: 100, target: 95 })
            ]}]
          },
          {
            title: 'Distribuição por canal',
            rows: [{ layout: '2col-equal', slots: [
              _slot('distribution', { column: 'qtd_atendimentos', groupBy: 'canal_atendimento' }),
              _slot('sankey', { sourceColumn: 'canal_atendimento', targetColumn: 'segmento', valueColumn: 'qtd_atendimentos' })
            ]}]
          },
          {
            title: 'Evolução',
            rows: [{ layout: '1col', slots: [
              _slot('time-series', { xColumn: 'data_atendimento', yColumn: 'qtd_atendimentos', bin: 'day', kind: 'line' })
            ]}]
          }
        ]
      },
      {
        id: 'itau-atendimento-sla-detalhe',
        name: 'SLA Detalhado e Gargalos',
        icon: '⏱️',
        description: 'Performance de SLA · outliers de TMA · top motivos · backlog.',
        domain: 'banco_pj',
        domainLabel: 'Banco PJ — Atendimento',
        build: () => [
          {
            title: 'Performance SLA',
            rows: [{ layout: '3col-equal', slots: [
              _slot('kpi', { column: 'sla_atend_pct', agg: 'avg', comparison: { type: 'previous-period' } }),
              _slot('kpi', { column: 'tempo_medio_atendimento', agg: 'avg', comparison: { type: 'previous-period' } }),
              // Backlog: count de atendimentos com status='aberto' — usa filtro local
              _slot('kpi', { column: 'qtd_atendimentos', agg: 'count', localFilters: [{ column: 'status_atend', op: 'eq', value: 'aberto' }] })
            ]}]
          },
          {
            title: 'Onde está o tempo',
            rows: [{ layout: '2col-equal', slots: [
              _slot('boxplot', { valueColumn: 'tempo_medio_atendimento', groupColumn: 'motivo_atendimento' }),
              _slot('distribution', { column: 'tempo_medio_atendimento', bins: 30 })
            ]}]
          },
          {
            title: 'Top motivos',
            rows: [{ layout: '1col', slots: [
              _slot('table', { groupBy: 'motivo_atendimento', valueColumn: 'qtd_atendimentos', agg: 'sum', rowLimit: 20, sortDesc: true })
            ]}]
          }
        ]
      },
      {
        id: 'itau-atendimento-clientes-foco',
        name: 'Clientes em Foco',
        icon: '🎯',
        description: 'Concentração · pareto 80/20 · escalonamentos · NPS por segmento.',
        domain: 'banco_pj',
        domainLabel: 'Banco PJ — Atendimento',
        build: () => [
          {
            title: 'Concentração',
            rows: [{ layout: '3col-equal', slots: [
              _slot('kpi', { column: 'cnpj', agg: 'count-distinct' }),
              // Média de atendimentos por cliente — fórmula no defaultConfig
              _slot('kpi', { column: 'qtd_atendimentos', agg: 'avg' }),
              _slot('kpi', { column: 'nps', agg: 'avg', comparison: { type: 'previous-period' } })
            ]}]
          },
          {
            title: 'Pareto 80/20 — clientes com mais atendimentos',
            rows: [{ layout: '1col', slots: [
              _slot('table', { groupBy: 'cnpj', valueColumn: 'qtd_atendimentos', agg: 'sum', rowLimit: 30, sortDesc: true })
            ]}]
          },
          {
            title: 'Risco',
            rows: [{ layout: '2col-equal', slots: [
              _slot('boxplot', { valueColumn: 'qtd_escalonamentos', groupColumn: 'segmento' }),
              _slot('scatter', { xColumn: 'qtd_atendimentos', yColumn: 'nps', sizeColumn: 'qtd_escalonamentos' })
            ]}]
          }
        ]
      }
    ];

    function list(){ return TEMPLATES.slice(); }

    /**
     * Hook em SolsticeTemplates: estende getAll/list/apply para incluir
     * estes templates quando o dicionário for banco_pj OU sempre se opts.includeItau.
     * Como SolsticeTemplates já tem AGNOSTIC/DOMAIN arrays, vamos ADICIONAR
     * aos templates DOMAIN existentes no init().
     */
    function init(){
      // Sprint 29: init() agora é no-op. User pediu pra enxugar templates
      // (eram 25+, agora 7 essenciais). Templates Itaú específicos ficaram
      // como TEMPLATES privados desse módulo — não vazam pro picker global.
      // Caso queira reativar no futuro, é só remover este early return.
      return;
      /* eslint-disable no-unreachable */
      if (typeof SolsticeTemplates !== 'undefined' && SolsticeTemplates.DOMAIN){
        TEMPLATES.forEach(t => {
          if (!SolsticeTemplates.DOMAIN.find(x => x.id === t.id)){
            SolsticeTemplates.DOMAIN.push(t);
          }
        });
      }
      /* eslint-enable no-unreachable */
    }

    return { list, init, TEMPLATES };
  })();
