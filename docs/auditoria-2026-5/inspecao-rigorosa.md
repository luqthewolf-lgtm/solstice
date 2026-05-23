# Auditoria 2026.5 — Inspeção Rigorosa (Sprint 33)

> Bug hunt com evidências concretas via preview real + DOM inspection.
> Cada bug tem comando reproduzível + estado observado.

## Bugs encontrados (8 evidências)

### 🔴 BUG-EV-01: Wizard sugere a MESMA coluna pra 4 KPIs

**Sintoma:** Template `kpi-trend` tem 4 KPIs. Wizard preenche todos com
`qt_vendas` → canvas mostra 4 cards idênticos (todos "QT VENDAS 5.357").

**Evidência DOM (captura via eval):**

```json
{
  "EV-wizard-selects": [
    { "idx": 0, "label": "Coluna:", "value": "qt_vendas" },
    { "idx": 1, "label": "Coluna:", "value": "qt_vendas" },
    { "idx": 2, "label": "Coluna:", "value": "qt_vendas" },
    { "idx": 3, "label": "Coluna:", "value": "qt_vendas" }
  ]
}
```

**Causa:** `_suggestForSlot(type)` chama `defaultConfig(ctx)` que retorna
`_firstColOfGroup(ctx, 'numeric')` — SEMPRE a primeira coluna numérica.
Pra slot 0 OK, pra slots 1-3 deveria pegar a SEGUNDA, TERCEIRA, QUARTA
coluna numérica.

**Impacto:** o usuário vê o produto com 4 KPIs duplicados (foi o
screenshot ORIGINAL que ele reportou).

**Sev:** 🔴 (regressão visual reproduzível)
**Esforço:** S — usar índice global no wizard

### 🔴 BUG-EV-02: Filtros NÃO filtram quando setados via string

**Sintoma:** `Filters.set('regiao', 'SP')` é aceito (Store salva
`{regiao: 'SP'}`), mas `Filters.apply(rows)` retorna 200/200 rows.

**Evidência:**
```json
{
  "filters_state": { "regiao": "SP" },
  "rows_before": 200,
  "rows_after_filter": 200
}
```

**Causa:** `apply()` linha 34404 só processa `Array.isArray(fv)` ou
objeto com `min/max/from/to`. String é silenciosamente ignorada.

**Impacto:** integradores ou scripts que chamam `Filters.set('col',
'value')` em vez de `['value']` ficam com filtros sem efeito, sem aviso.

**Sev:** 🔴 (API silenciosa que falha)
**Esforço:** S — adicionar `else if (typeof fv === 'string')` no apply

### 🔴 BUG-EV-03: Voz pessoal residual em 4 idiomas do welcome

**Sintoma:** Modal "Olá! Eu sou o Solstice" diz:
_"Construído com Lucas para ser agnóstico, portável e auditável."_

**Evidência DOM:**
```json
{
  "welcome_full_text": "🌗 Olá! Eu sou o Solstice Sua ferramenta de BI single-file. Construído com Lucas para ser agnóstico, portável e auditável. Pular Próximo",
  "welcome_has_lucas": true
}
```

**Causa:** Sprint 9 removeu de comentários, mas i18n textual ficou:
- linha 7709: `'onb.1.text': '...Construído com Lucas...'` (pt-BR)
- linha 7740: `'onb.1.text': '...Built with Lucas...'` (en-US)
- linha 7762: `'onb.1.text': '...Construida con Lucas...'` (es-ES)
- linha 7784: `'onb.1.text': '...Built with Lucas...'` (en-GB)

**Sev:** 🔴 (visível na 1ª tela, em 4 idiomas)
**Esforço:** S — find/replace nas 4 strings

### 🔴 BUG-EV-04: profile-name HTML default = "Lucas"

**Sintoma:** `<span id="profile-name">Lucas</span>` hardcoded no HTML.
Aparece como nome do usuário no header até o user trocar.

**Evidência grep:** linha 6683
```html
<span id="profile-name">Lucas</span>
```

**Causa:** placeholder hardcoded em vez de "Visitante" ou string vazia.

**Impacto:** novo usuário vê "Lucas" como nome em vez do próprio ou
"Visitante" — confuso e impessoal.

**Sev:** 🔴 (UX quebrada)
**Esforço:** S — trocar pra "Visitante"

### 🟠 BUG-EV-05: Onboarding modal ainda aparece (BH-01 parcial)

**Sintoma:** Sprint 30 BH-01 tentou gatear com `setTimeout 3500ms +
verifica modal aberto`. Mas no fluxo de inspeção, depois de import +
wizard apply (≈ 6s), o modal "Bem-vindo, como podemos te chamar?"
ainda apareceu.

**Evidência:**
```json
{
  "EV-dialogs-zombis": {
    "count": 1,
    "modal_zumbi_text": "🌗 Bem-vindo ao Solstice\nComo podemos te chamar? (você pode trocar depois em Configurações)\nCancelar"
  }
}
```

**Causa:** o gating de 3500ms + 5 retries de 3s cobre até ~17s.
Fluxos que terminam em ≈ 4-6s caem entre os dois — modal abre exatamente
quando user achou que tinha terminado.

**Solução proposta:** trocar modal por **toast** opcional (não-bloqueante)
ou abrir só quando user clicar no botão de perfil pela primeira vez.

**Sev:** 🟠
**Esforço:** S — substituir SolsticeModal.prompt por SolsticeToast.action

### 🟠 BUG-EV-06: 46 ocorrências "Lucas" no source

**Evidência:** `grep -ic lucas solstice_baseline.html` → 46 ocorrências.

Categorias:
- 4 strings i18n visíveis (BUG-EV-03)
- 1 HTML hardcoded (BUG-EV-04)
- ~38 comentários/refs internos (sem impacto visível)
- 1 URL github (intencional?)
- 2 "diretor"

**Sev:** 🟠 (a maioria comentários, mas user pediu remover)
**Esforço:** M — find/replace cuidadoso por categoria

### 🟡 BUG-EV-07: Pages module sem UI visível

**Sintoma:** `Solstice.Pages.list().length === 1` (módulo ativo), mas
não há UI no DOM pra trocar/criar páginas. Multi-page existe no estado
mas é "invisível" pro user.

**Evidência:**
```json
{
  "EV-pages-ui": { "has_pages_ui": false, "pages_count": 1 }
}
```

**Sev:** 🟡 (feature presente mas inacessível)
**Esforço:** M — adicionar PagesUI no header ou footer

### 🟡 BUG-EV-08: Console logs duplicados (suspeito)

**Sintoma:** Cada log do boot aparece 10× no console:
```
[info] [SolsticeErrorBoundary] handler global ativo × 10
[log] 🌗 SOLSTICE v5.6.0-patched ... pronto × 10
[log] [Solstice] boot OK × 10
```

**Análise:** pode ser:
1. Preview tool acumulando logs de navegações anteriores
2. Bug real de inicialização múltipla (improvável — `iframes: 0`,
   `multipleSolsticeApps: 1`)

**Sev:** 🟡 (suspeito, não confirmado)
**Esforço:** investigação primeiro

## Priorização para Sprint 33

| ID | Sev | Esforço | Ação |
|----|:--:|:--:|------|
| BUG-EV-01 | 🔴 | S | Fix wizard rotacionar coluna sugerida (próxima ação) |
| BUG-EV-02 | 🔴 | S | Fix Filters.apply aceitar string (próxima ação) |
| BUG-EV-03 | 🔴 | S | Fix 4 strings i18n welcome (próxima ação) |
| BUG-EV-04 | 🔴 | S | Fix profile-name = Visitante (próxima ação) |
| BUG-EV-05 | 🟠 | S | Trocar onboarding modal por toast (Sprint 34) |
| BUG-EV-06 | 🟠 | M | Limpar comentários Lucas internos (Sprint 34) |
| BUG-EV-07 | 🟡 | M | Pages UI visível (Sprint 35) |
| BUG-EV-08 | 🟡 | – | Investigar quando preview estabilizar |
