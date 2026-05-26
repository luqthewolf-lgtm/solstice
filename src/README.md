# src/ — fontes modulares do Solstice

Este diretório é o ponto de trabalho. À medida que extraímos blocos do
`solstice_baseline.html`, eles vivem aqui em arquivos pequenos com
responsabilidade única.

| Pasta | Conteúdo (planejado) | Estado |
|---|---|---|
| `build/` | Script de build, manifest, docs | ✅ Fase 1 |
| `styles/` | CSS dividido em 6 arquivos por `@layer` (shell, reset, tokens, theme, components, v56patch) | ✅ Fase 2 |
| `core/` | Utilitários, Log, Storage, Store, BR, Fmt, Locale, Theme, Errors, Toast, Boot | ⏳ Fase 3 onda A |
| `ui/` | Header, Sidebar, Canvas, Inspector, Modal — shell visual | ⏳ Fase 3 onda C |
| `features/` | Filtros, Params, AutoDashboard, Insights, Ask, Export, Ingest, etc. | ⏳ Fase 3 ondas B/D/E/F |

A ordem de extração e os slots correspondentes estão em
[`build/manifest.json`](build/manifest.json).

Pra rodar o build:

```bash
python src/build/build.py
```

Saída em `dist/solstice.html` — esse é o artefato distribuível.
