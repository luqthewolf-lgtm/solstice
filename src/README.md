# src/ — fontes modulares do Solstice

Este diretório é o ponto de trabalho. À medida que extraímos blocos do
`solstice_baseline.html`, eles vivem aqui em arquivos pequenos com
responsabilidade única.

| Pasta | Conteúdo (planejado) | Estado |
|---|---|---|
| `build/` | Script de build, manifest, docs | ✅ Fase 1 |
| `styles/` | CSS dividido em 6 arquivos por `@layer` (shell, reset, tokens, theme, components, v56patch) | ✅ Fase 2 |
| `core/` | 18 módulos: LZ, Config, ErrorBoundary, Utils, Storage, Store, StoreContract, Log, IngestState, Ids, Boot, Locale, I18n, Fmt, Errors, Toast, Profiles, Theme | ✅ Fase 3 onda A |
| `data/` | 18 módulos de dados: Dictionary, Domain, Tokenizer, Concepts, Inference, GoldenTest, Learning, Dummy, Onboarding, Debug, BR, Types, Compat, CompCache, Ingest, DatasetType, Quality, Editor | ✅ Fase 3 onda B |
| `ui/` | 18 módulos: 9 shell+análise (Undo, Resize, DnD, Minimap, Audit, Stats, Inspector, Analysis, Relationships) + 9 structure (DashHeader, Dataset, Style, KPI, Humanize, SidebarTabs, Modal, Layouts, Canvas) | ✅ Fases 3 C+D |
| `components/` | 2 módulos gigantes: Components (20 tipos de viz) + Props (painel direito) | ✅ Fase 3 onda E |
| `features/` | 17 módulos: Templates, Insights, Query, LLM, Narrative, Agent, Ask, Filters, Params, Recommender, AutoDashboard, Wizard, etc. | ✅ Fases 3 F+G |
| `persistence/` | 8 módulos: MultiTab, SavedViews, AutoSave, Snapshots, Versions, IDB, FolderAttach, FileSystem | ✅ Fase 3 H |
| `export/` | 8 módulos: Export, TemplatesItau, Modes, Slides, Presenter, CommandPalette, Tour, Hints | ✅ Fase 3 I |
| `workspace/` | 23 módulos: Migrations, Pages, Workspace, Views, Share, PDF, ExportSVG, Embed, Comments, Duck, Formula\*, Measures, ExportData, Limits, Settings, ColumnConfig, StatsAsync, V56, SelfAudit, etc. | ✅ Fase 3 J |

A ordem de extração e os slots correspondentes estão em
[`build/manifest.json`](build/manifest.json).

Pra rodar o build:

```bash
python src/build/build.py
```

Saída em `dist/solstice.html` — esse é o artefato distribuível.
