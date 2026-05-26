
  /* ============================================================
     ADR-175 (Onda 0 / Etapa 1) — SolsticeTokenizer
     Camada 1 do sistema de inferência semântica.
     Pega nome de coluna → devolve tokens normalizados + unit hints +
     prefix function detectado. Pra alimentar SolsticeConcepts (Camada 2)
     e SolsticeInference (Camada 3).
     ============================================================ */
  const SolsticeTokenizer = (function(){

    // Aliases — abreviações expandem em palavras inteiras.
    // Cobertura: ~80 entradas (pt-BR + EN básico + jargão bancário PJ).
    const ALIASES = {
      // Tempo / duração
      'tma':    ['tempo','medio','atendimento'],
      'tmr':    ['tempo','medio','resposta'],
      'lt':     ['lead','time'],
      'min':    ['minuto'],
      'seg':    ['segundo'],
      'hr':     ['hora'],
      'h':      ['hora'],
      'dt':     ['data'],
      'dts':    ['data'],
      'ts':     ['timestamp'],
      // Quantidade / contagem
      'qtd':    ['quantidade'],
      'qty':    ['quantidade'],
      'qt':     ['quantidade'],
      'qtdade': ['quantidade'],
      'num':    ['numero'],
      'cnt':    ['contagem'],
      'cont':   ['contagem'],
      // Valor / monetário
      'vlr':    ['valor'],
      'val':    ['valor'],
      'rec':    ['receita'],
      // Banco / risco PJ (anchors deliberados pra atender Itaú)
      'dpd':    ['dias','pendente','inadimplencia','atraso'],
      'pdd':    ['provisao','inadimplencia'],
      'ead':    ['exposicao','risco'],
      'lgd':    ['loss','default'],
      'inad':   ['inadimplencia'],
      'recup':  ['recuperacao'],
      'pj':     ['pessoa','juridica'],
      'pf':     ['pessoa','fisica'],
      'op':     ['operacao'],
      'subm':   ['submetido'],
      'aprov':  ['aprovado'],
      'cb':     ['carteira'],
      'cap':    ['capital'],
      'compromisso': ['exposicao','limite'],
      // Identificadores
      'cnpj':   ['cnpj','identificador','empresa'],
      'cpf':    ['cpf','identificador','pessoa'],
      'pk':     ['identificador'],
      'fk':     ['identificador'],
      // Scores / qualidade
      'nps':    ['nps','satisfacao','score'],
      'csat':   ['csat','satisfacao','score'],
      'sla':    ['sla','nivel','servico'],
      'aov':    ['ticket','medio'],
      'mrr':    ['receita','recorrente','mensal'],
      'arr':    ['receita','recorrente','anual'],
      'cmv':    ['custo','mercadoria'],
      'cogs':   ['custo'],
      'cac':    ['custo','aquisicao'],
      'ltv':    ['lifetime','valor'],
      'atend':  ['atendimento'],
      // Percentuais
      'pct':    ['percentual'],
      'perc':   ['percentual'],
      'tx':     ['taxa'],
      // Atalhos descritivos
      'avg':    ['media'],
      'med':    ['mediana'],
      'std':    ['desvio'],
      'var':    ['variacao'],
      'desc':   ['desconto'],
      'liq':    ['liquido'],
      'brt':    ['bruto']
    };

    // Unit hints — sufixos que indicam unidade canonicalizada.
    const UNIT_HINTS = {
      'min': 'duration_min', 'minuto': 'duration_min', 'minutos': 'duration_min',
      'seg': 'duration_sec', 'segundo': 'duration_sec', 'segundos': 'duration_sec',
      'h':   'duration_h',   'hr': 'duration_h',  'hora': 'duration_h', 'horas': 'duration_h',
      'dia': 'duration_day', 'dias': 'duration_day',
      'mes': 'duration_month', 'meses': 'duration_month',
      'ano': 'duration_year', 'anos': 'duration_year',
      'brl': 'currency_brl', 'rs': 'currency_brl', 'reais': 'currency_brl', 'real': 'currency_brl',
      'usd': 'currency_usd', 'dollar': 'currency_usd', 'dolares': 'currency_usd',
      'eur': 'currency_eur',
      'pct': 'percentage', 'percent': 'percentage', 'perc': 'percentage', 'percentual': 'percentage'
    };

    // Prefixos de função — alteram interpretação dos tokens seguintes.
    const FUNCTION_PREFIXES = ['total_', 'qtd_', 'vlr_', 'pct_', 'is_', 'tem_', 'has_', 'flag_'];

    function _normalize(s){
      // CRÍTICO: ordem importa! camelCase split DEVE vir ANTES de toLowerCase,
      // senão vlrBruto → vlrbruto (não detecta limite case). Bug detectado
      // no golden test (dataset 02_vendas_camelcase com acc 30%).
      return String(s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')  // acentos primeiro
        .replace(/([a-z])([A-Z])/g, '$1_$2')      // camelCase → snake ANTES de lowercase
        .toLowerCase()
        .replace(/[\-\.\s]+/g, '_')
        .replace(/[^\w_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    }

    /**
     * tokenize(columnName) → { tokens, unit_hints, prefix_function, original, normalized }
     * - tokens: array deduplicado, ordem preservada, ALIASES expandidos
     * - unit_hints: array de unit_ids canonicalizados (duration_min, currency_brl, etc)
     * - prefix_function: string do prefixo detectado ou null
     */
    function tokenize(columnName){
      const norm = _normalize(columnName);
      const rawTokens = norm.split('_').filter(t => t.length > 0);

      // Prefix function
      let prefix_function = null;
      for (const pfx of FUNCTION_PREFIXES){
        const pfxNoUnderscore = pfx.replace('_', '');
        if (rawTokens[0] === pfxNoUnderscore){
          prefix_function = pfx;
          break;
        }
      }

      // Expande aliases + coleta unit hints
      const tokens = [];
      const unit_hints = [];
      for (const t of rawTokens){
        if (ALIASES[t]){ for (const a of ALIASES[t]) tokens.push(a); }
        else { tokens.push(t); }
        if (UNIT_HINTS[t]){ unit_hints.push(UNIT_HINTS[t]); }
      }

      return {
        tokens: Array.from(new Set(tokens)),
        unit_hints: Array.from(new Set(unit_hints)),
        prefix_function,
        original: columnName,
        normalized: norm
      };
    }

    /** Expor pra debug/curadoria via console (read-only refs). */
    return { tokenize, ALIASES, UNIT_HINTS, FUNCTION_PREFIXES };
  })();
