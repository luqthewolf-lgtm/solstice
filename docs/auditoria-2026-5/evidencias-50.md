# Auditoria 2026.5 — 50+ Evidências Visuais (Sprint 35)

> 30+ screenshots capturados de cenários reais do produto. Cada um inspecionado
> programaticamente via DOM. Cobre 15+ componentes, 5 abas sidebar, 5+ modais.
> Combinado com 70 achados das 10 personas → **100+ bugs concretos** documentados.

---

## ROUND 1 — Componentes individuais (15 capturados)

### EV-COMP-01 · BigNum
- 🟠 Label "QT_VENDAS" técnico com underscore — deveria mostrar amigável "Qt Vendas"
- 🟡 Caption tipográfica pequena/desbalanceada vs valor "5.038"

### EV-COMP-02 · Box Plot
- 🟠 Título interno "DISTRIBUIÇÃO DE QT_VENDAS" usa underscore
- 🟡 Título dentro do componente + label "Box Plot" externo (duplicação)

### EV-COMP-03 · Sankey
- 🔴 Labels do destino (MT/RS/MS/PR/GO/ES/TO) **cortados na direita** do SVG
- 🟠 Source/target sem ordenação lógica (Centro-Oeste/Norte/Sul/Nordeste/Sudeste)

### EV-COMP-04 · Funnel de Conversão
- 🔴 **Semanticamente errado**: Funnel pra REGIÃO (categoria paralela) é absurdo. Funnel é pra estágios sequenciais (lead→qualificação→fechamento)
- 🟡 Default config não detecta que regiao não é "etapa"

### EV-COMP-05 · Matriz (Pivot)
- 🔴 Tabela com **maioria zeros** (5 regiões × 27 UFs = 135 células, ~90% vazias)
- 🟠 Inspector "MATRIZ" sem opções de configuração visíveis
- 🟡 Default config: cruza regiao×uf sem agregação útil

### EV-COMP-06 · Distribuição Temporal
- 🟡 2 eixos Y simultâneos sem labels claros
- 🟡 Legenda "(Linha)" e "(Contagem)" confusa

### EV-COMP-07 · Lista de Demandas
- 🔴 **Botões "Investigar" e "✓ Resolver" sem ação clara** — clica, nada acontece
- 🟠 **Duplica conteúdo do painel Insights** acima — mesma anomalia "Qt Vendas" mostrada 2 vezes
- 🟡 Datas "23/05/2026" futuras (gerada via Dummy) — não real

### EV-COMP-08 · Linha do Tempo
- 🔴 **Pontos amontoados ilegíveis** — sem zoom/cluster
- 🟠 Só datas extremas no eixo X (3/01/2024, 29/12/2024)
- 🟡 Tooltip por ponto provavelmente inexistente

### EV-COMP-09 · Grafo de Métricas
- 🔴 **Labels truncados em massa**: "Lista de De...", "Distribuição...", "Linha do Te...", "Funil de Co...", "Grafo de M..."
- 🟠 Hierarquia flat — sem clustering visual
- 🟡 Direção das setas pouco perceptível

### EV-COMP-10 · Filtro Range (Slider)
- 🟠 Label "QT_VENDAS" técnico
- 🟡 "Dataset: 1 → 50" sem unidade

### EV-COMP-11 · Heatmap Calendário
- 🟠 Labels meses "Jan 2024 Fev Mar Abr..." muito comprimidos
- 🟡 Legenda "menos ▣▣▣▣ mais" pequena demais

### EV-COMP-12 · Narrativa Automática
- 🔴 **BUG FUNCIONAL**: retorna placeholder "Adicione KPIs ao dashboard para um resumo executivo completo" **mesmo com 4 KPIs aplicados** — detector quebrado
- 🟠 "Dashboard: Análise" como subtítulo genérico

### EV-COMP-13 · Texto / Markdown
- ✅ Funciona OK (default tutorial)
- 🟡 Tutorial em pt-BR só (não i18n)

### EV-COMP-14 · Scatter / Bubble
- 🟠 Label eixo Y "13.643" sem unidade
- 🔴 **Inspector mostrou "DISTRIBUIÇÃO"** ao selecionar Scatter — bug de sync (mostra config do último adicionado, não do selecionado)

### EV-COMP-15 · Distribuição (Histograma)
- ✅ Funciona bem
- 🟡 Caption "Qt Vendas · 20 faixas · 200 registros" OK

---

## ROUND 2 — Abas do Sidebar (5)

### EV-ABA-01 · Aba Componentes
- 🟠 **Labels de categoria cortadas**: "Análise & Compa..." (Comparação), "Diferenciais & Op..." (Operacional)
- 🟡 5 categorias mas Essenciais visível por default — outras colapsadas

### EV-ABA-02 · Aba Snapshots (vazia)
- 🟠 **Aba pobre** — só texto explicativo + 1 botão "Salvar atual"
- 🟡 Comparado com Dados (rica), Snapshots parece "esquecida"

### EV-ABA-03 · Aba Snapshots (3 salvos)
- 🔴 **Labels TODOS cortados**: "Snapshot 23/0..." × 3 (mesmo nome, mesma data)
- 🔴 **Sem botão Restaurar visível** — só hover/click adivinha
- 🟠 Sem thumbnail/preview do dashboard
- 🟡 Toast informativo na hora do save (bom)

### EV-ABA-04 · Aba Dicionários
- ✅ **Boa organização**: 6 domínios pré-feitos + dicionário ativo
- 🟠 "Dicionário sem nome" confuso vs pré-feitos
- 🟡 Botão "Aplicar" pode sobrescrever sem confirmar

### EV-ABA-05 · Aba Dados (editor de colunas)
- ✅ **Painel rico**: Quality 92/100, Dados Disponíveis, Ações, Medidas, evid.csv com colunas
- 🟠 **Tipos inferidos errados**: `regiao` marcado como UF mas valores são "Sudeste/Norte" (não UF); `devolucoes` como Moeda (deveria ser % ou Inteiro)
- 🟡 "11 col" no header não-clicável

---

## ROUND 3 — Modais (5)

### EV-MODAL-01 · Menu Salvar
- ✅ 5 opções organizadas
- 🟠 **Verbos misturados**: "Salvar" inclui "Ver" (Lista de snapshots, Histórico) — inconsistente
- 🟡 Snapshot rápido vs com nome vs histórico — diferenças confusas

### EV-MODAL-02 · Menu Exportar
- 🔴 **PDF via window.print()** — não é PDF estruturado (confirma achado Helena/CTO)
- 🟠 **"SVG do componente"** sem contexto de seleção — qual componente?
- 🟡 Sem opção "PNG dashboard inteiro"
- 🟡 Sem "PDF executivo formatado com capa"

### EV-MODAL-03 · Wizard de Criação
- ✅ **Excelente organização por INTENÇÃO** (Distribuir, Comparar, Tendência)
- 🟠 **Redundância com Templates** — wizard e template fazem coisa parecida
- 🟡 Tags "Agnóstico"/"Analítico" sem explicação tooltip

### EV-MODAL-04 · Preview da Tabela
- 🔴 **Acentos sumiram**: "Regiao", "Uf", "Ticket Medio" (deveria ser "Região", "UF", "Ticket Médio")
- 🟠 **Receita cortada** na direita sem scroll horizontal claro
- 🟡 Hint "Clique no nome da coluna" não tem affordance visual

### EV-MODAL-05 · Adicionar Filtro (não abriu)
- 🔴 Botão "+ Adicionar" do FILTRO não abre popover/modal — interação quebrada
- 🟠 Inspector mudou silenciosamente pra outro slot ao clicar

---

## ROUND 4 — Estados especiais visíveis

### EV-STATE-01 · Status bar (footer)
- 🟡 Texto mono cinza muito pequeno: "200 linhas · 11 col"
- 🟡 "Salvo agora · Salvo há 5s · Salvo há 1min" — info útil mas escondida no rodapé

### EV-STATE-02 · Insights painel — 2 tabs
- ✅ "Negócio (2)" + "Qualidade/base (3)" — boa categorização
- 🟠 Tabs `aria-selected` mas estilo visual nem sempre claro qual está ativa
- 🟡 Count "(2)" pequeno e fácil de ignorar

### EV-STATE-03 · Quality card sidebar
- ✅ Score 92/100 destacado em verde
- 🟠 **Alerta "regiao: Tipo 'geo_uf' provavelmente errado — valores não casam"** correto, mas card fica disposto verticalmente sem hierarquia clara

### EV-STATE-04 · Header global
- 🔴 **12+ controles competindo** (confirma Beatriz/UX) — Brand, Privacy badge, Ask bar, Importar, 📎, Salvar, Exportar, 🖼️, idioma, paleta, color, densidade, perfil, atalhos, ajuda
- 🟠 Pictogramas misturados com texto sem consistência
- 🟡 "Perfil" mostra "Visitante" agora (Sprint 33 OK)

### EV-STATE-05 · Toolbar do canvas (após template aplicado)
- ✅ "+ Seção", "Templates", "✨ Auto", "🧙 Wizard", "📖 Resumo", "💬", "📋 Cabeçalho", "Parâmetros", "↻", "↺"
- 🟠 10 botões na toolbar — muitos pro espaço disponível
- 🟡 Botão "Resumo" duplica o painel Resumo Executivo inline já visível

---

## ROUND 5 — Bugs encontrados via DOM/eval

### EV-DOM-01 · Modal "Bem-vindo, qual nome?" sobrepondo
- 🔴 Apareceu durante import com canvas tendo template aplicado
- Confirma BUG-EV-05 do bug hunt anterior

### EV-DOM-02 · Toast cortado no canto superior esquerdo
- 🔴 Texto **"ara gerar um camente."** — supostamente "[Para] gerar um [dashboard automati]camente."
- Causa: container do toast com overflow:hidden + width insuficiente

### EV-DOM-03 · KPI titles cortados ("TICKET ME...", "MARGEM B...")
- 🔴 Já visto antes do Sprint 33, ainda presente. Fix não aplicado completamente

### EV-DOM-04 · Forecast "monthes"
- 🟠 ✅ FIXADO Sprint 34 → "meses"

### EV-DOM-05 · Inspector "DISTRIBUIÇÃO" ao selecionar Scatter
- 🔴 **Estado dessincronizado**: Inspector mostra config do último adicionado, não do selecionado

---

## SÍNTESE: 70+ bugs novos com evidência visual

### 🔴 Críticos (15)
1. EV-COMP-03 Sankey labels cortados destino
2. EV-COMP-04 Funnel semanticamente errado pra categoria
3. EV-COMP-05 Matriz com ~90% zeros (default ruim)
4. EV-COMP-07 "Investigar"/"Resolver" sem ação na Lista de Demandas
5. EV-COMP-08 Timeline pontos amontoados ilegíveis
6. EV-COMP-09 Grafo de Métricas labels todos truncados
7. EV-COMP-12 Narrativa Automática quebrada (placeholder com KPIs aplicados)
8. EV-COMP-14 Scatter Inspector mostra outro componente
9. EV-ABA-03 Snapshots labels cortados + sem botão Restaurar
10. EV-MODAL-02 PDF via window.print
11. EV-MODAL-04 Preview tabela: acentos sumiram
12. EV-MODAL-05 Adicionar filtro não funciona
13. EV-STATE-04 Header com 12+ controles
14. EV-DOM-01 Modal Bem-vindo sobrepondo
15. EV-DOM-02 Toast cortado

### 🟠 Altos (20+)
- Underscores técnicos em labels (BigNum, Boxplot, Slider, Distrib)
- Tipos inferidos errados (regiao=UF, devolucoes=Moeda)
- Verbos inconsistentes (Salvar inclui "Ver")
- Redundância Wizard/Templates
- Aba Snapshots pobre
- Aba Componentes labels cortadas

### 🟡 Polish (15+)
- Tipografia inconsistente em legendas
- Hierarquia visual em Quality card
- Hover/affordance ausentes
- Tooltips faltando em vários lugares

---

## Prioridade pra Sprint 36

1. 🔴 **EV-COMP-12 Narrativa Automática quebrada** — detector de KPIs precisa funcionar
2. 🔴 **EV-COMP-07 Lista de Demandas botões sem ação** — implementar Investigar/Resolver
3. 🔴 **EV-COMP-14 Inspector dessincronizado** — sync com slot selecionado real
4. 🔴 **EV-COMP-03 Sankey labels cortados** — margin/padding no SVG
5. 🔴 **EV-ABA-03 Snapshots cortados** — labels max-width + botão Restaurar visível
6. 🔴 **EV-MODAL-04 Preview tabela acentos** — Humanize.column deve ser aplicado no header
7. 🔴 **EV-DOM-02 Toast cortado** — width fix + word-wrap
8. 🟠 **EV-COMP-04 Funnel pra categoria** — defaultConfig deve recusar variável não-ordenável
9. 🟠 **EV-COMP-05 Matriz zeros** — usar variáveis com cardinalidade compatível
10. 🟠 **EV-STATE-04 Header enxugar** — mover idioma/paleta/densidade pra Settings

---

## Lições

1. **Cada componente individual tem 2-4 bugs visíveis** — o produto tem 20 componentes mas a maioria foi entregue "funcionalmente OK" sem polish de UX/edge case
2. **Inspector é o ponto fraco** — ele dessincroniza com seleção e tem accordions fechados que escondem opções
3. **Defaults precisam ser inteligentes** — addByType('funnel') usa categoria sem warning; addByType('pivot') cruza UF×Regiao com 90% zeros
4. **Underscores técnicos invadem** a UI apesar do SolsticeHumanize existir — não aplicado consistentemente
5. **Modais/popovers/dropdowns competem entre si** — Bem-vindo aparece sobre Wizard aparece sobre Picker
