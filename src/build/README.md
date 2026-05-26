# Solstice — Build pipeline

> Fase 1 (refactor-modular-v1) — fundação. Sem mudança de comportamento; só
> infraestrutura pra extrair blocos em arquivos separados nas próximas fases.

## TL;DR

```bash
python src/build/build.py
```

Lê `solstice_baseline.html` na raiz, aplica os slots declarados em
`manifest.json`, e escreve `dist/solstice.html`. Esse é o artefato que vai
pro Itaú: 1 arquivo HTML, abre no navegador, funciona.

Enquanto o manifest estiver vazio (estado atual), o build é passthrough — a
saída é **byte-idêntica** ao baseline. Isso é validado por SHA-256 a cada
build; quebrou o hash, o pipeline aborta.

## Por que existe esse build

O Solstice é distribuído como **arquivo único**. Esse é o diferencial pro
ambiente do Itaú: sem servidor, sem npm, sem CDN bloqueada, sem instalar
nada. Mas manter um arquivo de 47 mil linhas no editor é insustentável — pro
humano que vai mexer e pro modelo que vai assistir.

A saída: **dev modular, deploy single-file**. O repositório tem pastas
(`src/styles`, `src/core`, `src/ui`, `src/features`); o build concatena tudo
em `dist/solstice.html`. Quem desenvolve trabalha com arquivos pequenos e
nomeáveis; quem usa recebe o HTML inteiro.

## Como funciona — placeholders por slot

Cada bloco extraído deixa no baseline um par de marcadores HTML:

```html
<!--@SOLSTICE_BUILD:slot=NOME-->
<!--/@SOLSTICE_BUILD:slot=NOME-->
```

E o manifest declara o que entra naquele slot:

```json
{
  "version": 1,
  "slots": {
    "NOME": ["core/utils.js", "core/log.js"]
  }
}
```

Caminhos em `slots` são relativos a `src/`. O build lê cada arquivo na
ordem, separa por `\n`, e injeta entre os marcadores. **Os marcadores são
preservados na saída** — isso torna o build idempotente (rodar duas vezes
não duplica nada) e facilita debug visual no HTML final.

## Invariantes

1. **Manifest vazio ⇒ saída == baseline.** Validado por hash SHA-256 a cada
   build. Se quebrar, é bug do pipeline.
2. **Slot no manifest sem marcador no baseline ⇒ erro fatal.** Normalmente é
   typo no nome do slot, ou esquecimento de criar o marcador.
3. **Marcador no baseline sem entrada no manifest ⇒ aviso, não fatal.**
   Permite criar marcador antes de migrar o conteúdo.
4. **Sem dependência externa.** Só biblioteca padrão do Python 3.8+. Roda
   em qualquer máquina, incluindo ambientes corporativos restritos.

## Estrutura do repositório

```
solstice/
├── solstice_baseline.html       # Fonte da verdade ENQUANTO houver código
│                                  ainda não extraído. Encolhe a cada fase.
├── src/
│   ├── build/
│   │   ├── build.py             # Pipeline (este script)
│   │   ├── manifest.json        # Slots e ordem de concatenação
│   │   └── README.md            # Este arquivo
│   ├── styles/                  # CSS extraído (Fase 2)
│   ├── core/                    # Utilitários, Log, Storage, Store, BR, etc.
│   ├── ui/                      # Header, Sidebar, Canvas, Inspector, Modal
│   └── features/                # Filtros, Params, AutoDashboard, Ask, etc.
└── dist/
    └── solstice.html            # Artefato final — único arquivo distribuído
```

## Como adicionar um novo slot

1. No baseline, escolha o trecho a extrair e troque por:

   ```html
   <!--@SOLSTICE_BUILD:slot=meu-slot-->
   <!--/@SOLSTICE_BUILD:slot=meu-slot-->
   ```

2. Mova o conteúdo extraído pra `src/<categoria>/<nome>.css|js|html`.

3. Adicione no manifest:

   ```json
   "slots": {
     "meu-slot": ["categoria/nome.ext"]
   }
   ```

4. Rode `python src/build/build.py`. Confira o diff de `dist/solstice.html`
   — deve ser zero (a não ser por whitespace controlado pelo build, que é
   determinístico).

5. Smoke-test o `dist/solstice.html` no navegador. Boot OK = extração OK.

## Variáveis de ambiente

| Variável | Efeito |
|---|---|
| `SOLSTICE_BUILD_VERBOSE=1` | Imprime cada arquivo concatenado |
| `SOLSTICE_BUILD_CHECK=1`   | Sai com erro se a saída não bater com `expected_sha256` do manifest |

`expected_sha256` é opcional; usar em CI pra travar regressão silenciosa.

## CI (Fase 6, ainda não implementado)

Plano: GitHub Action `build.yml` que roda este script a cada push, anexa
`dist/solstice.html` como artifact, e (opcional) publica em release tag. O
ambiente do Itaú nunca executa Python — só recebe o HTML pronto.
