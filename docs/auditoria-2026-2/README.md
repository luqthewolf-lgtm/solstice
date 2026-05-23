# Auditoria 2026.2 — Product Audit Board

> 2026-05-23 · arquivo auditado: `solstice_baseline.html` (46.271 linhas, 2,24 MB)
> Segunda passada da auditoria pelo Product Audit Board — estende a Auditoria 2026 anterior.

## Resultado

- **Nota:** 80 → **86** /100
- **Veredito:** 🟢 Viável com ressalvas (subiu de 🟡)
- **Bloqueadores:** 0
- **Correções aplicadas:** 57 (10 Altos + ~24 Médios + ~8 Baixos + 16 substituições `console.warn` → `SolsticeLog`)

## Arquivos

| Arquivo | O que é |
|---|---|
| [solstice_auditoria.md](solstice_auditoria.md) | Relatório completo do comitê: veredito + síntese + achados detalhados + benchmark + mapa do arquivo |
| [solstice_auditoria.html](solstice_auditoria.html) | Dashboard visual interativo da auditoria (abrir no navegador) |
| [solstice_remediacao.md](solstice_remediacao.md) | Changelog numerado das 57 correções + log de validação smoke + pendências |

## Principais correções

🟠 **Altos:**
- Box plot XLSX usa `SolsticeStats.quartiles` (interpolação linear, igual NumPy) em vez de aproximação grosseira
- Último `document.write` do arquivo eliminado (presenter dual-window via DOM API)
- Status bar mostra `—` em vez de `0` pré-import
- Ask Bar placeholder dinâmico (welcome state vs. com dataset)
- Welcome com "Ver dataset de exemplo" visível por padrão
- ExecutiveInsights com fallback amigável quando vazio
- Div fantasma `solstice-sidebar-footer-btns-removed` removida
- 16 `console.warn` em fallbacks de boot migrados para `SolsticeLog`

🟡 **Médios + Baixos:**
- `window.Solstice._runIngestFile` exposto (fluxo "atrelar pasta" robusto)
- `block-status` dev compactado (40+ linhas → 2)
- `flashSaved` ignora 1ª invocação (sem mentir "salvo automaticamente" no welcome)
- Catálogo de perguntas do Ask Bar expandido (~12 → ~22 em 6 categorias)
- Tooltips de `help-btn` e `btn-show-shortcuts` mais informativos
- Banner version dev atualizado
- Comentários de procedência em cada bloco editado

## O que ficou em aberto (roadmap v5.7/v6.0)

- **Streaming de CSV** (datasets >100k linhas)
- **Quebrar `SolsticeV56`** (3.814 linhas históricas) em módulos próprios
- **DuckDB ativo por padrão** (hoje opt-in)
- **Anomaly detection inline** nos insights

Para detalhes completos veja [solstice_remediacao.md](solstice_remediacao.md) — seção "Pendências".
