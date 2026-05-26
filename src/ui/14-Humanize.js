
  /* ============================================================
     SolsticeHumanize (Patch B5-r2) — toda string visível ao usuário
     passa por aqui. Strings técnicas em código JS; strings humanas na UI.
     ============================================================ */
  const SolsticeHumanize = (function(){

    const AGG_LABELS = {
      sum:    'Soma',
      avg:    'Média',
      mean:   'Média',
      count:  'Quantidade',
      min:    'Mínimo',
      max:    'Máximo',
      median: 'Mediana',
      stddev: 'Desvio padrão',
      std:    'Desvio padrão',
      p95:    'Percentil 95',
      p99:    'Percentil 99'
    };

    function aggregation(op){
      return AGG_LABELS[String(op || '').toLowerCase()] || String(op || '');
    }

    /**
     * Recebe variação % e direção desejada. Retorna { text, color }.
     * color é uma chave semântica: 'success' | 'error' | 'muted'.
     *
     * baselineLabel (Patch B5-r3): rótulo livre da baseline. Default "período anterior".
     * Ex: "meta", "média histórica", "primeiro registro", "Meta trimestre".
     */
    function delta(pct, higherIsBetter, baselineLabel){
      const label = baselineLabel || 'período anterior';
      if (pct == null || isNaN(pct)) return { text: 'Sem dados de comparação', color: 'muted', direction: 'none', ariaLabel: 'Sem dados de comparação' };
      const abs = Math.abs(pct);
      if (abs < 1){
        return { text: '≈ Estável vs ' + label, color: 'muted', direction: 'flat', ariaLabel: 'Estável em relação ' + _articleFor(label) + label };
      }
      const up = pct > 0;
      const arrow = up ? '▲ +' : '▼ ';
      const dir = up ? 'acima' : 'abaixo';
      const formatted = SolsticeLocale.decimal(abs, 1).replace('.', ',');
      const text = arrow + formatted + '% ' + dir + ' ' + _articleFor(label) + label;
      // aria-label legível por leitores de tela (substitui símbolos por palavras)
      const ariaLabel = (up ? 'Subida de ' : 'Queda de ') + formatted + ' por cento ' + dir + ' ' + _articleFor(label) + label;
      let color = 'muted';
      if (higherIsBetter === true)  color = up ? 'success' : 'error';
      else if (higherIsBetter === false) color = up ? 'error' : 'success';
      return { text, color, direction: up ? 'up' : 'down', ariaLabel };
    }

    /** Heurística mínima de artigo definido pt-BR: "da meta", "do período anterior", "da média histórica". */
    function _articleFor(label){
      if (!label) return '';
      const l = label.toLowerCase();
      if (l.startsWith('período') || l.startsWith('primeiro') || l.startsWith('último') || l.startsWith('mesmo'))
        return 'do ';
      return 'da ';
    }

    function recordCount(n){
      if (n == null || isNaN(n)) return '— registros';
      n = Math.round(n);
      if (n >= 1_000_000){
        const m = n / 1_000_000;
        const fmt = (m % 1 === 0 ? m.toString() : SolsticeLocale.decimal(m, 1).replace('.', ','));
        return fmt + (m === 1 ? ' milhão de registros' : ' milhões de registros');
      }
      if (n >= 1000) return SolsticeLocale.integer(n) + ' registros';
      if (n === 1) return '1 registro';
      return n + ' registros';
    }

    /** Converte milissegundos em string humana ("30 dias", "3 meses", "1 ano"). */
    function timeRange(rangeMs){
      if (!rangeMs || isNaN(rangeMs)) return '—';
      const days = rangeMs / (1000 * 60 * 60 * 24);
      if (days < 1) return Math.round(rangeMs / (1000 * 60 * 60)) + ' horas';
      if (days < 31) return Math.round(days) + (Math.round(days) === 1 ? ' dia' : ' dias');
      const months = days / 30.44;
      if (months < 12) return Math.round(months) + (Math.round(months) === 1 ? ' mês' : ' meses');
      const years = days / 365.25;
      return SolsticeLocale.decimal(years, 1).replace('.', ',') + (years === 1 ? ' ano' : ' anos');
    }

    /** Nome amigável da coluna: dicionário > Title Case do snake_case. */
    // Sprint 36 / EV-MODAL-04: dicionário BR de termos comuns com acento.
    // Como CSV.gerar (Dummy) e CSVs reais costumam vir com headers sem
    // acentuação (ASCII-safe), aplicamos um mapping pós-Title-Case que
    // restaura acentos comuns: "regiao" → "Região", "uf" → "UF",
    // "ticket_medio" → "Ticket Médio", etc.
    const _BR_HUMANIZE_ACCENTS = {
      'regiao': 'Região',
      'regioes': 'Regiões',
      'uf': 'UF',
      'cpf': 'CPF',
      'cnpj': 'CNPJ',
      'cep': 'CEP',
      'medio': 'Médio',
      'media': 'Média',
      'minimo': 'Mínimo',
      'maximo': 'Máximo',
      'numero': 'Número',
      'periodo': 'Período',
      'comissao': 'Comissão',
      'devolucao': 'Devolução',
      'devolucoes': 'Devoluções',
      'transacao': 'Transação',
      'transacoes': 'Transações',
      'sessao': 'Sessão',
      'sessoes': 'Sessões',
      'liquido': 'Líquido',
      'liquida': 'Líquida',
      'unitario': 'Unitário',
      'unitaria': 'Unitária',
      'voluntario': 'Voluntário',
      'mes': 'Mês',
      'meses': 'Meses',
      'pais': 'País',
      'paises': 'Países',
      'producao': 'Produção',
      'duracao': 'Duração',
      'cliente': 'Cliente',
      'clientes': 'Clientes',
      'situacao': 'Situação',
      'situacoes': 'Situações',
      'numeracao': 'Numeração'
    };
    function column(columnName, dictionary){
      if (!columnName) return '—';
      const dictCol = dictionary && dictionary.columns && dictionary.columns[columnName];
      if (dictCol && dictCol.friendlyName) return dictCol.friendlyName;
      const titled = String(columnName)
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
      // Sprint 36: aplica acentos BR comum. Tokeniza por espaço pra
      // preservar palavras compostas ("Ticket Medio" → "Ticket Médio").
      return titled.split(' ').map(tok => {
        const lower = tok.toLowerCase();
        if (_BR_HUMANIZE_ACCENTS[lower]) return _BR_HUMANIZE_ACCENTS[lower];
        return tok;
      }).join(' ');
    }

    return { aggregation, delta, recordCount, timeRange, column };
  })();
