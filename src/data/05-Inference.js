
  /* ============================================================
     ADR-176 (Onda 0 / Etapa 2) — SolsticeInference
     Camada 3 — Engine de scoring + reconciliação com valores.
     Fórmula: +40 anchor +30 unit +25 vpat +20 vrange +15 domain -50 exclude
     Threshold default 30. Fallback pra detector de valores se < threshold.
     ============================================================ */
  const SolsticeInference = (function(){

    const CONFIDENCE_THRESHOLD = 30;
    const _lastAudit = new Map();

    function _anchorMatchRatio(tokens, anchors){
      if (!anchors || !anchors.length) return 0;
      const tokenSet = new Set(tokens);
      let hits = 0;
      for (const a of anchors){
        if (tokenSet.has(a)){ hits++; continue; }
        // Substring SÓ pra plurais pt-BR (s/es no fim) + variações simples.
        // ANTES: indexOf===0 cego (count em country, etc) — FALSO POSITIVO.
        if (a.length >= 5){
          for (const t of tokens){
            if (t.length < 5) continue;
            // Plural pt-BR/EN: token = anchor + ('s'|'es')
            if (t === a + 's' || t === a + 'es'){ hits += 0.9; break; }
            // Inverso: anchor = token + plural
            if (a === t + 's' || a === t + 'es'){ hits += 0.9; break; }
            // Underscore composto: token contém anchor como palavra inteira separada
            // (raro pq tokens já são separados, mas casos compostos podem aparecer)
          }
        }
      }
      if (hits === 0) return 0;
      return Math.min(1, 0.6 + 0.4 * (hits - 1) / Math.max(1, anchors.length - 1));
    }

    function _unitHintMatchRatio(unitHints, conceptUnits){
      if (!conceptUnits || !conceptUnits.length) return 0;
      if (!unitHints.length) return 0;
      const set = new Set(unitHints);
      for (const u of conceptUnits) if (set.has(u)) return 1;
      return 0;
    }

    function _excludeTokenPenalty(tokens, excludeTokens){
      if (!excludeTokens || !excludeTokens.length) return 0;
      const tokenSet = new Set(tokens);
      for (const ex of excludeTokens) if (tokenSet.has(ex)) return 1;
      return 0;
    }

    function _valuePatternMatchRatio(values, patterns){
      if (!patterns || !patterns.length) return 0;
      if (!values || !values.length) return 0;
      const sample = values.slice(0, 50).filter(v => v != null && v !== '');
      if (!sample.length) return 0;
      let hits = 0;
      for (const v of sample){
        const s = String(v).trim();
        for (const p of patterns) if (p.test(s)){ hits++; break; }
      }
      return hits / sample.length;
    }

    function _valueRangeMatch(values, range){
      if (!range || range.length !== 2) return 0;
      if (!values || !values.length) return 0;
      // Auditoria 2026 (R-01b / A-301): SolsticeBR.toNumber honra
      // agrupador pt-BR. Antes, valores como "1.234,56" eram truncados
      // a "1.23456", desviando o _valueRangeMatch silenciosamente.
      const nums = values.slice(0, 100).map(v => {
        const n = (typeof v === 'number') ? v : SolsticeBR.toNumber(v);
        return isFinite(n) ? n : null;
      }).filter(n => n != null);
      if (!nums.length) return 0;
      let in_range = 0;
      for (const n of nums) if (n >= range[0] && n <= range[1]) in_range++;
      return in_range / nums.length >= 0.8 ? 1 : 0;
    }

    function _domainActiveBonus(concept, activeDomain){
      if (!activeDomain) return 0;
      return (concept.domains && concept.domains.indexOf(activeDomain) !== -1) ? 1 : 0;
    }

    function _scoreConcept(tokenized, values, concept, activeDomain){
      const a = _anchorMatchRatio(tokenized.tokens, concept.anchors);
      const u = _unitHintMatchRatio(tokenized.unit_hints, concept.unit_hints);
      const vp = _valuePatternMatchRatio(values, concept.value_patterns);
      const vr = _valueRangeMatch(values, concept.value_range_hint);
      const dom = _domainActiveBonus(concept, activeDomain);
      const ex = _excludeTokenPenalty(tokenized.tokens, concept.exclude_tokens);

      let learningBonus = 0;
      try {
        if (typeof SolsticeLearning !== 'undefined' && SolsticeLearning.getBonusForConcept){
          learningBonus = SolsticeLearning.getBonusForConcept(tokenized.original, concept.id) || 0;
        }
      } catch(_){}

      // Fórmula final (Etapa 2 / Onda 0):
      //   +40 anchor +30 unit +25 vpat +20 vrange* +15 domain -45/(-22)** exclude
      //   *vrange SÓ conta se há pelo menos 1 anchor casado.
      //   **Exclude penalty é REDUZIDO PELA METADE quando há evidência forte
      //   de valor (vrange OU vpattern + anchor casado). Permite que "vlr_tempo"
      //   (tem exclude 'valor' MAS valores estão no range de duração)
      //   ainda ganhe pelo conceito correto. Caso crítico do briefing Anexo.
      const vrEffective = (a > 0) ? vr : 0;
      const valueEvidence = vrEffective > 0 || vp > 0.5;  // sinal forte de valor
      const excludePenalty = (a > 0 && valueEvidence) ? 22 : 45;
      const score = 40 * a + 30 * u + 25 * vp + 20 * vrEffective + 15 * dom - excludePenalty * ex + learningBonus;

      return {
        concept_id: concept.id,
        score: Math.round(score * 100) / 100,
        breakdown: {
          anchor:   Math.round(40 * a * 100) / 100,
          unit:     Math.round(30 * u * 100) / 100,
          vpat:     Math.round(25 * vp * 100) / 100,
          vrange:   Math.round(20 * vrEffective * 100) / 100,
          domain:   Math.round(15 * dom * 100) / 100,
          exclude:  Math.round(-excludePenalty * ex * 100) / 100,
          learning: Math.round(learningBonus * 100) / 100
        }
      };
    }

    function inferColumn(columnName, values, ctx){
      ctx = ctx || {};
      const tokenized = SolsticeTokenizer.tokenize(columnName);
      const concepts = SolsticeConcepts.list();
      const activeDomain = ctx.domain || null;

      const candidates = concepts.map(c => _scoreConcept(tokenized, values || [], c, activeDomain))
                                 .sort((x, y) => y.score - x.score);

      const best = candidates[0];
      let winner = null, type = null, fallback_used = false, confidence = 0;

      if (best && best.score >= CONFIDENCE_THRESHOLD){
        winner = best.concept_id;
        const c = SolsticeConcepts.get(winner);
        type = c.type;
        confidence = Math.min(1, best.score / 100);
      } else {
        fallback_used = true;
        // Fallback: detector de valores existente (SolsticeTypes.inferType)
        if (typeof SolsticeTypes !== 'undefined' && SolsticeTypes.inferType){
          try {
            const t = SolsticeTypes.inferType(columnName, values || []);
            type = (t && t.type) || 'dimension';
            confidence = (t && t.confidence) || 0.3;
          } catch(_){ type = 'dimension'; confidence = 0.2; }
        } else { type = 'dimension'; confidence = 0.2; }
      }

      const audit = {
        column: columnName,
        tokens: tokenized.tokens,
        unit_hints: tokenized.unit_hints,
        candidates: candidates.slice(0, 5),
        winner, type, confidence, fallback_used,
        timestamp: Date.now()
      };
      _lastAudit.set(columnName, audit);
      return audit;
    }

    function inferColumns(columns, dataRows, ctx){
      ctx = ctx || {};
      const out = {};
      for (const col of columns){
        const sample = (dataRows || []).slice(0, 100).map(r => r[col]);
        out[col] = inferColumn(col, sample, ctx);
      }
      return out;
    }

    function lastAuditFor(columnName){ return _lastAudit.get(columnName) || null; }
    function clearAudit(){ _lastAudit.clear(); }

    return { CONFIDENCE_THRESHOLD, inferColumn, inferColumns, lastAuditFor, clearAudit };
  })();
