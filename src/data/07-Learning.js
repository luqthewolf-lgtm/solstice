
  /* ============================================================
     ADR-177 (Onda 0 / Etapa 3) — SolsticeLearning
     Camada 4 — Aprendizado local por correção do usuário.

     Quando usuário corrige tipo/conceito de uma coluna no Inspector,
     o sistema salva: tokens(coluna) → conceito_correto.
     Próxima coluna com tokens semelhantes ganha bonus +20 a +40
     no scoring da Camada 3.

     Persistência: localStorage por profileId.
     NÃO compartilhado entre profiles (cada usuário tem seu aprendizado).
     LGPD: delete profile → delete learning automaticamente.
     ============================================================ */
  const SolsticeLearning = (function(){

    const STORAGE_KEY_PREFIX = 'solstice.learning.';
    const MAX_BONUS = 40;
    const BONUS_PER_CORRECTION = 20;

    function _profileId(){
      try {
        const p = SolsticeProfiles && SolsticeProfiles.current && SolsticeProfiles.current();
        return (p && p.id) || 'default';
      } catch(_){ return 'default'; }
    }

    function _key(profileId){ return STORAGE_KEY_PREFIX + (profileId || _profileId()); }

    function _load(profileId){
      try {
        const raw = localStorage.getItem(_key(profileId));
        return raw ? JSON.parse(raw) : { corrections: {} };
      } catch(e){ return { corrections: {} }; }
    }

    function _save(profileId, data){
      // Auditoria 2026 (AP-02): aprendizado é dado do usuário (correções
      // semânticas de colunas) — avisar se não persistir.
      SolsticeStorage.safeSet(_key(profileId), JSON.stringify(data));
    }

    function _tokenKey(columnName){
      // Chave canônica: tokens ordenados + joined. Dois nomes diferentes mas
      // com mesmos tokens normalizados batem no mesmo registro.
      if (typeof SolsticeTokenizer === 'undefined') return String(columnName);
      const r = SolsticeTokenizer.tokenize(columnName);
      return r.tokens.slice().sort().join(',');
    }

    /**
     * Registra correção. Ex: usuário viu 'vlr_tempo' classificado como
     * valor_monetario, corrigiu pra tempo_duracao.
     * @param {string} columnName
     * @param {string} oldType — type anterior (audit)
     * @param {string} newType — type novo
     * @param {string} newConcept — concept_id novo
     */
    function recordCorrection(columnName, oldType, newType, newConcept){
      const pid = _profileId();
      const data = _load(pid);
      const tk = _tokenKey(columnName);
      data.corrections[tk] = {
        newType, newConcept,
        originalColumn: columnName,
        timestamp: Date.now(),
        count: ((data.corrections[tk] && data.corrections[tk].count) || 0) + 1
      };
      _save(pid, data);
      try {
        SolsticeAudit.record({
          action: 'learning_correction',
          target: columnName,
          details: { oldType, newType, newConcept, token_key: tk,
                     count: data.corrections[tk].count, profile: pid }
        });
      } catch(_){}
    }

    /**
     * Retorna bonus de aprendizado pra um conceito numa coluna específica.
     * +20 (1ª correção) até +40 (2+ correções).
     * @returns {number} 0 se não há correção registrada pra esse token key
     *                   apontando pra esse concept_id.
     */
    function getBonusForConcept(columnName, conceptId){
      const pid = _profileId();
      const data = _load(pid);
      const tk = _tokenKey(columnName);
      const corr = data.corrections[tk];
      if (!corr || corr.newConcept !== conceptId) return 0;
      return Math.min(MAX_BONUS, BONUS_PER_CORRECTION * corr.count);
    }

    /** Lista todas correções do profile atual (UI / debug). */
    function list(profileId){
      return _load(profileId || _profileId()).corrections;
    }

    /** Remove TODAS as correções de um profile (Settings → "Limpar aprendizado"). */
    function clearForProfile(profileId){
      try {
        localStorage.removeItem(_key(profileId || _profileId()));
        SolsticeAudit.record({ action: 'learning_clear',
          details: { profile: profileId || _profileId() } });
      } catch(_){}
    }

    /** Remove uma correção específica por token key (UI por linha). */
    function removeByTokenKey(tokenKey, profileId){
      const pid = profileId || _profileId();
      const data = _load(pid);
      if (data.corrections[tokenKey]){
        delete data.corrections[tokenKey];
        _save(pid, data);
        try { SolsticeAudit.record({ action: 'learning_remove', details:{ token_key: tokenKey, profile: pid } }); } catch(_){}
        return true;
      }
      return false;
    }

    function count(profileId){
      return Object.keys(_load(profileId || _profileId()).corrections).length;
    }

    // Auditoria 2026 (M-Q-3 / A-706): sinônimos aprendíveis em runtime.
    // Usuário pode ensinar "receita_liq" ao app sem deploy. SolsticeQuery
    // consulta esta lista após o match estático em SolsticePresets.
    // Estrutura: data.synonyms = { '<colName>': ['termo1','termo2',...] }
    function addSynonym(columnName, term){
      const pid = _profileId();
      const data = _load(pid);
      if (!data.synonyms) data.synonyms = {};
      const norm = String(term || '').trim().toLowerCase();
      if (!norm) return false;
      const arr = data.synonyms[columnName] = data.synonyms[columnName] || [];
      if (!arr.includes(norm)){
        arr.push(norm);
        _save(pid, data);
        try { SolsticeAudit.record({ action:'learning_synonym_add', target: columnName, details:{ term: norm, profile: pid } }); } catch(_){}
        return true;
      }
      return false;
    }
    function removeSynonym(columnName, term){
      const pid = _profileId();
      const data = _load(pid);
      if (!data.synonyms || !data.synonyms[columnName]) return false;
      const norm = String(term || '').trim().toLowerCase();
      const i = data.synonyms[columnName].indexOf(norm);
      if (i < 0) return false;
      data.synonyms[columnName].splice(i, 1);
      _save(pid, data);
      return true;
    }
    function getSynonyms(columnName){
      const data = _load(_profileId());
      return (data.synonyms && data.synonyms[columnName]) ? data.synonyms[columnName].slice() : [];
    }
    function findColumnBySynonym(term){
      const data = _load(_profileId());
      const norm = String(term || '').trim().toLowerCase();
      if (!data.synonyms) return null;
      for (const [col, syns] of Object.entries(data.synonyms)){
        if (syns.includes(norm)) return col;
      }
      return null;
    }

    return { recordCorrection, getBonusForConcept, list, clearForProfile, removeByTokenKey, count,
             addSynonym, removeSynonym, getSynonyms, findColumnBySynonym,
             MAX_BONUS, BONUS_PER_CORRECTION };
  })();
