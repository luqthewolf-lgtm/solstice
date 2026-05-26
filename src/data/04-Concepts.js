
  /* ============================================================
     ADR-175 (Onda 0 / Etapa 1) — SolsticeConcepts
     Camada 2 — Catálogo dos 30 conceitos-base + anchors enriquecidos.
     Cada conceito = { id, anchors, unit_hints, exclude_tokens,
                       value_patterns, value_range_hint, type, agg,
                       higherIsBetter, domains }
     ============================================================ */
  const SolsticeConcepts = (function(){

    const CONCEPTS = [
      // ─────────────── Temporais (3) ───────────────
      { id:'data_evento', anchors:['data','dt','date','dia','fecha','quando'],
        unit_hints:[], exclude_tokens:['hora','timestamp','abertura','fechamento','minuto','segundo'],
        type:'date_only', agg:'min', higherIsBetter:null,
        domains:['generico','vendas','atendimento','banco_pj'] },

      { id:'data_hora_evento',
        anchors:['timestamp','datahora','abertura','fechamento','criacao','atualizacao',
                 'created','updated','modified','createdat','updatedat','createdon'],
        unit_hints:[], exclude_tokens:[],
        type:'timestamp', agg:'min', higherIsBetter:null,
        domains:['generico','atendimento','banco_pj'] },

      { id:'periodo_mes',
        anchors:['mes','mesref','mesreferencia','competencia','anomes','yearmonth','periodo'],
        unit_hints:[], exclude_tokens:[],
        type:'temporal', agg:'min', higherIsBetter:null,
        domains:['banco_pj','vendas','generico'] },

      // ─────────────── Monetários (3) ───────────────
      { id:'valor_monetario',
        anchors:['valor','vlr','receita','faturamento','venda','preco','amount','revenue',
                 'pdd','provisao','ead','exposicao','compromisso','limite','garantia','garant',
                 'recuperacao','recuperado','saldo','devedor','liquido','bruto'],
        unit_hints:['currency_brl','currency_usd','currency_eur'],
        exclude_tokens:['tempo','duracao','quantidade','minuto','hora','segundo','dias','meses','pct','percentual','taxa','satisfacao','score','nota','nps','csat'],
        type:'currency', agg:'sum', higherIsBetter:true,
        domains:['vendas','banco_pj','atendimento','generico'] },

      { id:'custo_despesa',
        anchors:['custo','despesa','cmv','cogs','expense','gasto'],
        unit_hints:['currency_brl','currency_usd','currency_eur'],
        exclude_tokens:['tempo','duracao','quantidade'],
        type:'currency', agg:'sum', higherIsBetter:false,
        domains:['vendas','banco_pj','generico'] },

      { id:'ticket_medio',
        anchors:['ticket','aov','tkm','ticketmedio'],
        unit_hints:['currency_brl','currency_usd'],
        exclude_tokens:[],
        type:'currency', agg:'avg', higherIsBetter:true,
        domains:['vendas','banco_pj','atendimento'] },

      // ─────────────── Contagens (3) ───────────────
      { id:'quantidade',
        // Removido 'clientes' (plural matchea 'cliente' via regra plural → FP em "clienteCnpj").
        anchors:['quantidade','qtd','qty','num','numero','cnt','count','contagem','interacoes','itens','comentarios'],
        unit_hints:[],
        exclude_tokens:['valor','vlr','receita','tempo','duracao','minuto','hora','pct','taxa','percentual','satisfacao','score','nota','sla','protocolo','chamado','ticket','tickets','country','cliente'],
        type:'integer', agg:'sum', higherIsBetter:null,
        domains:['generico','vendas','atendimento','banco_pj'] },

      { id:'total_volume',
        anchors:['total'],
        unit_hints:[],
        // Excludes pra evitar "total" varrer monetário/percentual:
        exclude_tokens:['valor','vlr','receita','venda','vendas','pct','taxa','percentual'],
        type:'integer', agg:'sum', higherIsBetter:null,
        domains:['generico','atendimento','banco_pj','vendas'] },  // todos os domínios

      { id:'indice_sequencial',
        anchors:['ordem','sequencia','seq','rank','posicao','ranking','indice'],
        unit_hints:[], exclude_tokens:['valor','tempo'],
        type:'integer', agg:'max', higherIsBetter:null,
        domains:['generico'] },

      // ─────────────── Taxas / Percentuais (3) ───────────────
      { id:'percentual_taxa',
        anchors:['pct','perc','percentual','taxa','rate','ratio','razao','percent','conversao','spread','margem','desconto'],
        unit_hints:['percentage'],
        // Fix calibração: "razao_social" não é taxa — é razão social (empresa).
        exclude_tokens:['social','cliente','empresa','razaosocial'],
        type:'percentage', agg:'avg', higherIsBetter:null,
        domains:['generico','vendas','banco_pj','atendimento'] },

      { id:'sla_cumprimento',
        anchors:['sla','slas','nivelservico','atendprazo','noprazo'],
        unit_hints:['percentage'],
        exclude_tokens:[],
        type:'percentage', agg:'avg', higherIsBetter:true,
        domains:['atendimento','banco_pj'] },

      { id:'inadimplencia_dpd',
        anchors:['dpd','dpd30','dpd60','dpd90','inad','inadimplencia','atraso','default','mora'],
        unit_hints:['percentage'],
        exclude_tokens:['recuperacao','recuperado','valor','vlr'],
        type:'percentage', agg:'avg', higherIsBetter:false,
        domains:['banco_pj'] },

      // ─────────────── Durações (2) ───────────────
      { id:'tempo_duracao',
        anchors:['tempo','tempos','duracao','duracoes','tma','tmr','duration','lead','demorou','espera','resposta','atraso'],
        unit_hints:['duration_min','duration_sec','duration_h','duration_day'],
        // Removido 'cliente' (conflita com idade_tenure que usa cliente).
        // 'valor'/'vlr' continuam excludes mas value_range agora puxa de volta.
        exclude_tokens:['valor','vlr','preco','custo','receita','taxa','satisfacao','score','nps'],
        // value_range_hint cobre durações típicas em minutos/segundos/horas
        // → bonus +30 (peso aumentado) compensa exclude quando valores batem.
        // Resolve o trap "vlr_tempo_atendimento" (valores 0-500 minutos).
        value_range_hint:[0, 10000],
        type:'duration', agg:'avg', higherIsBetter:false,
        domains:['atendimento','banco_pj','generico'] },

      { id:'idade_tenure',
        // 'cliente' removido — gera overfit (total_clientes, segmento_cliente etc).
        // "tempo_como_cliente" vai cair em tempo_duracao (type=duration igual).
        anchors:['idade','tenure','tempocasa','casa','age','antiguidade'],
        unit_hints:['duration_year','duration_month'],
        exclude_tokens:['atendimento','resposta','espera','protocolo','chamado','valor','vlr','receita'],
        type:'duration', agg:'avg', higherIsBetter:null,
        domains:['generico','atendimento'] },

      // ─────────────── Identificadores (4) ───────────────
      { id:'id_generico',
        anchors:['id','codigo','cod','hash','uuid','guid','identificador','pk','fk','registro'],
        unit_hints:[],
        // Fix calibração: id_atendimento/id_atend/chamado_id deve cair em
        // id_ticket_atendimento, não id_generico. Penalty quando há contexto.
        exclude_tokens:['cnpj','cpf','email','telefone','atendimento','ticket','chamado','protocolo','tickets'],
        type:'identifier', agg:'count_distinct', higherIsBetter:null,
        domains:['generico','vendas','atendimento','banco_pj'] },

      { id:'id_cliente_pj', anchors:['cnpj'],
        unit_hints:[], exclude_tokens:[],
        type:'cnpj', agg:'count_distinct', higherIsBetter:null,
        domains:['banco_pj'] },

      { id:'id_cliente_pf', anchors:['cpf'],
        unit_hints:[], exclude_tokens:[],
        type:'cpf', agg:'count_distinct', higherIsBetter:null,
        domains:['banco_pj','vendas','atendimento'] },

      { id:'id_ticket_atendimento',
        // Removido 'tickets' (plural matchea 'ticket' singular → conflito com ticket_medio).
        anchors:['chamado','ticket','atendimento','demanda','solicitacao','protocolo','idatendimento','idatend','idtickets','idticket'],
        unit_hints:[],
        exclude_tokens:['tempo','duracao','valor','status','situacao','estagio','motivo','canal','operador','agente','responsavel','medio','aov'],
        type:'identifier', agg:'count_distinct', higherIsBetter:null,
        domains:['atendimento','banco_pj'] },

      // ─────────────── Categorias/Dimensões (4) ───────────────
      { id:'canal_origem',
        anchors:['canal','canais','via','origem','meio','midia','channel','source'],
        unit_hints:[], exclude_tokens:[],
        type:'dimension', agg:'count', higherIsBetter:null,
        domains:['vendas','atendimento','banco_pj','generico'] },  // +generico (Channel em 14_caotico)

      { id:'segmento_categoria',
        // + country/pais pra capturar "country" (golden 05) sem precisar criar conceito novo
        anchors:['segmento','categoria','tipo','type','classe','grupo','porte','tier','category','kind','plan','perfil','country','pais'],
        unit_hints:[], exclude_tokens:[],
        type:'dimension', agg:'count', higherIsBetter:null,
        domains:['generico','vendas','banco_pj','atendimento'] },

      { id:'status_estagio',
        anchors:['status','situacao','situacoes','estagio','fase','etapa','stage','state'],
        unit_hints:[], exclude_tokens:[],
        type:'dimension', agg:'count', higherIsBetter:null,
        domains:['generico','atendimento','vendas','banco_pj'] },

      { id:'motivo_assunto',
        anchors:['motivo','assunto','razao','causa','reason'],
        unit_hints:[], exclude_tokens:[],
        type:'dimension', agg:'count', higherIsBetter:null,
        domains:['atendimento','banco_pj','generico'] },  // expandido (golden 01)

      // ─────────────── Pessoas (2) ───────────────
      { id:'agente_responsavel',
        anchors:['analista','agente','vendedor','consultor','operador','atendente','responsavel','responsaveis','owner','quem'],
        unit_hints:[], exclude_tokens:[],
        type:'dimension', agg:'count', higherIsBetter:null,
        domains:['vendas','atendimento','banco_pj','generico'] },  // expandido (golden 01)

      { id:'cliente_nome',
        anchors:['cliente','razaosocial','nomecliente','company','empresa'],
        unit_hints:[],
        // identificador também (PK/FK expandem pra "identificador" via aliases).
        // total/clientes adicionados pra evitar match em "total_clientes" (count).
        exclude_tokens:['id','cod','cnpj','cpf','pk','fk','identificador','contagem','quantidade','total','clientes'],
        type:'dimension', agg:'count_distinct', higherIsBetter:null,
        domains:['vendas','banco_pj','atendimento'] },

      // ─────────────── Ordinais/Escalas (2) ───────────────
      { id:'prioridade_ordinal',
        anchors:['prioridade','prioridades','priority','urgencia','criticidade','severidade'],
        unit_hints:[], exclude_tokens:[],
        value_patterns:[/^(baixa|media|alta|critica|low|medium|high|critical)$/i],
        type:'ordinal', agg:'count', higherIsBetter:null,
        domains:['atendimento','banco_pj'] },

      { id:'satisfacao_escala',
        anchors:['satisfacao','satisfacoes','csat','score','nota','avaliacao','rating','nps','satisfacaocliente'],
        unit_hints:[], exclude_tokens:[],
        value_range_hint:[0, 10],
        type:'ordinal', agg:'avg', higherIsBetter:true,
        domains:['atendimento','vendas'] },

      // ─────────────── Flags (1) ───────────────
      { id:'flag_booleana',
        anchors:['flag','ativo','cumprido','resolvido','aprovado','atendido','concluido','active','escalonado','recomendaria','sim','nao','tudook'],
        unit_hints:[],
        exclude_tokens:[],
        value_patterns:[/^(sim|nao|s|n|yes|no|true|false|0|1)$/i],
        type:'flag', agg:'count_true', higherIsBetter:null,
        domains:['generico','atendimento','banco_pj','vendas'] },

      // ─────────────── Geografia (2) ───────────────
      { id:'uf_estado_br',
        anchors:['uf','estado','regiao','regioes','state','region','onde'],
        unit_hints:[], exclude_tokens:[],
        value_patterns:[/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i],
        type:'geo_uf', agg:'count', higherIsBetter:null,
        domains:['generico','vendas','atendimento','banco_pj'] },

      { id:'cidade_municipio',
        anchors:['cidade','municipio','city','town'],
        unit_hints:[], exclude_tokens:[],
        type:'dimension', agg:'count', higherIsBetter:null,
        domains:['generico'] },

      // ─────────────── Contato (1) ───────────────
      { id:'contato_email_tel',
        anchors:['email','emailcontato','tel','telefone','celular','phone'],
        unit_hints:[], exclude_tokens:[],
        type:'identifier', agg:'count_distinct', higherIsBetter:null,
        domains:['generico','vendas','atendimento','banco_pj'] }  // +banco_pj (golden 09)
    ];

    function list(){ return CONCEPTS.slice(); }
    function get(id){ return CONCEPTS.find(c => c.id === id) || null; }
    function getByType(type){ return CONCEPTS.filter(c => c.type === type); }
    function getByDomain(domain){
      return CONCEPTS.filter(c => c.domains && c.domains.indexOf(domain) !== -1);
    }

    /**
     * Permite Lucas/curador adicionar anchor extra a um conceito existente
     * SEM editar código (via Settings → custom anchors, ou console).
     * Persiste em Store pra ficar entre boots. Audit trail registrado.
     */
    function addCustomAnchor(conceptId, anchor){
      const c = get(conceptId);
      if (!c) return false;
      const norm = String(anchor || '').toLowerCase().trim();
      if (!norm) return false;
      if (c.anchors.indexOf(norm) === -1){
        c.anchors.push(norm);
        try {
          SolsticeAudit.record({ action:'concept_anchor_added',
            target: conceptId, details:{ anchor: norm } });
        } catch(_){}
        return true;
      }
      return false;
    }

    return { list, get, getByType, getByDomain, addCustomAnchor, CONCEPTS };
  })();
