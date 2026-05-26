# Deploy do Solstice no Itaú (intranet/SharePoint)

> Esta doc descreve como publicar o Solstice como ferramenta web interna
> pros analistas. Resumo: o artefato é um único arquivo `dist/solstice.html`
> de ~2,4 MB que abre direto no navegador. **Não precisa de servidor.**

## TL;DR

1. Pega o `solstice.html` do release mais recente (ou do artifact da CI).
2. Sobe pra um lugar onde os analistas conseguem abrir (SharePoint, intranet, OneDrive corp, pasta de rede).
3. Cada analista abre o arquivo no navegador — funciona offline depois do primeiro carregamento (CDNs em cache).

## Onde pegar o artefato

### Da release (recomendado pra produção)

A cada tag `v*.*.*` (ex.: `v1.0.0`), a CI publica automaticamente uma release no GitHub com `solstice.html` anexado:

```
https://github.com/<org>/<repo>/releases/latest
```

Baixa o `solstice.html` da seção "Assets".

### Do artifact (pra preview/dev)

Cada push gera um artifact temporário (90 dias) chamado `solstice-html`. Pra baixar:

1. `Actions` → escolhe o workflow run recente → seção `Artifacts` → `solstice-html`.
2. Vai vir como `solstice-html.zip` — descompacta pra obter `solstice.html`.

### Build local (alternativa)

Se o ambiente Itaú bloqueia GitHub Actions:

```bash
git clone <repo>
cd solstice
python src/build/build.py
# Saída: dist/solstice.html
```

Sem npm, sem node, sem CDN — só Python 3.8+. Funciona em qualquer máquina que rode VS Code básico.

## Onde hospedar — 3 opções comuns

### Opção A — SharePoint (mais simples pro analista)

1. Cria uma biblioteca de documentos: ex.: `Sites/Analytics/Solstice/`.
2. Upload do `solstice.html`.
3. Compartilha o link interno com a equipe.
4. Cada analista abre o link no navegador. SharePoint serve o HTML direto.

**Pegadinha do SharePoint clássico**: às vezes baixa o arquivo em vez de abrir. Solução: usar a biblioteca em modo "moderno" e marcar o arquivo como "Abrir no navegador" (ou pedir pro time de TI fazer a configuração).

**Pasta por usuário**: criar subpastas (`Sites/Analytics/Solstice/lucas/`, `.../joao/`, etc.). Cada um sobe seu próprio `solstice.html` lá. Como o app guarda estado em `localStorage`, cada navegador (e cada perfil) tem seus snapshots/dashboards próprios.

### Opção B — Intranet estática (controle total)

Se o time de TI mantém um servidor interno de páginas estáticas (IIS/Apache/nginx), basta:

1. Subir `solstice.html` em `/internal/solstice/index.html`.
2. URL fica `https://intranet.itau/solstice/`.
3. Acesso controlado por VPN/SSO da intranet, como qualquer página interna.

Vantagem: URL bonita, integra com SSO sem esforço extra.

### Opção C — OneDrive/Teams (rápido pra MVP)

1. Sobe `solstice.html` numa pasta compartilhada do Teams.
2. Botão "Abrir no navegador" do Teams baixa rápido.
3. Funciona pra prova de conceito com 2-3 analistas, mas não escala bem.

## Integração com Eva (IA do Itaú)

O Solstice tem um adapter de LLM pluggable. Pra plugar a Eva:

1. Pega o endpoint interno da Eva (ex.: `https://eva.intranet.itau/v1/chat`).
2. Verifica como ela autentica: SSO via cookie da intranet, header `Authorization: Bearer ...`, header customizado, etc.
3. Cada analista, abre o Solstice, abre o console do navegador (F12), e cola:

```javascript
Solstice.LLMAdapter.configure({
  provider: 'fetch',
  endpoint: 'https://eva.intranet.itau/v1/chat',
  credentials: 'include',                  // SSO via cookie da intranet
  headers: { 'X-Workspace': 'analytics' }  // opcional, conforme a Eva exige
});
```

Pronto. A partir daí, `Solstice.LLMAdapter.complete("Resuma esse dataset")` chama a Eva e retorna a resposta.

A configuração persiste em `localStorage` do browser do analista — só precisa configurar uma vez por máquina/perfil.

Pra testar a conexão:

```javascript
await Solstice.LLMAdapter.test();
// { ok: true, provider: 'fetch', ms: 234, response: "ok" }
```

## Pasta por pessoa — onde fica o estado de cada um

O Solstice é **100% local** no navegador. Cada usuário tem:

- `localStorage.solstice.*` — preferências, paleta, layout, configuração LLM
- `IndexedDB` (banco `solstice`) — snapshots históricos do dashboard
- `localStorage.solstice.theme` — `mode`, `palette`, `density`, `layout`

Isso significa: **se o analista trocar de máquina/perfil, ele PERDE o estado local**. Não há sync de dados entre máquinas — o que é proposital (privacidade do dataset CSV).

Pra contornar:

- **Snapshots**: o app gera arquivos `.json` exportáveis (Ctrl+S → Salvar). O analista guarda no OneDrive dele, abre na próxima máquina via Importar.
- **Pasta atrelada**: feature `Atrelar pasta 📎` salva o handle de pasta no FS (Chrome/Edge). Quando o CSV daquela pasta muda, o dashboard recarrega sozinho.

## Como atualizar a versão pros analistas

A cada release nova:

1. Baixa o novo `solstice.html` da release.
2. Substitui o arquivo na biblioteca SharePoint / pasta da intranet.
3. Avisa o time pra dar `Ctrl+F5` (hard refresh) pra pegar a versão nova.

O `localStorage` deles continua intacto, então não perdem snapshots/preferências.

## Checklist pré-release pro Itaú

- [ ] Build atual passa `python src/build/build.py` sem erro.
- [ ] `dist/solstice.html` abre direto no navegador (file:// OU servido) e boota sem erros no console.
- [ ] CDNs externos (Chart.js, PapaParse, XLSX) estão acessíveis da intranet do Itaú. Se NÃO estiverem, considerar inline das libs no build (PR futuro).
- [ ] Testou import de um CSV real representativo dos analistas (faturamento, churn, atendimento).
- [ ] Testou `Solstice.LLMAdapter.test()` com o endpoint da Eva (se já tem).
- [ ] Privacy-check com o time de Segurança: o app NÃO faz upload de dados — confirma via Network do DevTools que nenhuma requisição POST sai do navegador exceto pro endpoint da Eva quando configurado.
- [ ] Documentação curta pros analistas (1 página) sobre como abrir e o básico.
