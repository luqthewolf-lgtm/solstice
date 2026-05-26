#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Solstice — Build pipeline (Fase 1, refactor-modular-v1)
=======================================================

OBJETIVO
--------
Concatenar fontes modulares em `src/` num único artefato `dist/solstice.html`
que mantém a portabilidade do projeto: 1 arquivo, abre no navegador, funciona.

ESTRATÉGIA — "extração incremental por placeholders"
---------------------------------------------------
1. A fonte da verdade INICIAL é `solstice_baseline.html` na raiz (47k linhas).
2. À medida que extraímos blocos (CSS, módulos JS, markup), o local de onde
   o bloco saiu é trocado por um marcador HTML no formato:

       <!--@SOLSTICE_BUILD:slot=NOME-->
       <!--/@SOLSTICE_BUILD:slot=NOME-->

   Tudo entre essas duas linhas é substituído pelo conteúdo concatenado dos
   arquivos listados no `manifest.json` sob a chave `slots.NOME`.
3. Enquanto NÃO houver placeholders no baseline (estado da Fase 1), o build
   é um passthrough — `dist/solstice.html` é byte-idêntico ao baseline.
4. O smoke test confirma o invariante: hash SHA-256 da saída == hash do
   baseline quando o manifest está vazio.

POR QUE PLACEHOLDERS E NÃO CONCATENAÇÃO LINEAR?
----------------------------------------------
Porque a ordem de aparição no HTML importa (CSS antes do body, módulos
fundamentais antes dos que dependem deles, markup do header antes do canvas).
Placeholders preservam a estrutura original do baseline enquanto deixamos
os blocos virem de arquivos separados. Reordenar o HTML inteiro de uma vez
é arriscado; placeholders permitem extrair um bloco por vez com diff mínimo.

DEPENDÊNCIAS
------------
Nenhuma além da biblioteca padrão do Python 3.8+. Roda em qualquer máquina
com Python, sem npm, sem Node, sem CDN. Isso é proposital — o Itaú e
qualquer ambiente corporativo restrito conseguem rodar.

COMO RODAR
----------
    python src/build/build.py

Ou, do diretório src/build:

    python build.py

VARIÁVEIS DE AMBIENTE
---------------------
SOLSTICE_BUILD_VERBOSE=1   Imprime cada arquivo concatenado.
SOLSTICE_BUILD_CHECK=1     Sai com código 1 se a saída não bater com hash
                           esperado em manifest.json (campo "expected_sha256").
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Localização: build.py vive em <repo>/src/build/, então a raiz é dois acima.
# Usar Path resolvido garante que dá pra rodar de qualquer cwd.
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
SRC_DIR = REPO_ROOT / "src"
DIST_DIR = REPO_ROOT / "dist"
BASELINE = REPO_ROOT / "solstice_baseline.html"
MANIFEST = SCRIPT_DIR / "manifest.json"
OUTPUT = DIST_DIR / "solstice.html"

VERBOSE = os.environ.get("SOLSTICE_BUILD_VERBOSE", "0") == "1"
CHECK_HASH = os.environ.get("SOLSTICE_BUILD_CHECK", "0") == "1"

# Regex do placeholder. Aceita DOIS formatos de comentário:
#
#   HTML (default, fora de <style>/<script>):
#       <!--@SOLSTICE_BUILD:slot=NAME-->...<!--/@SOLSTICE_BUILD:slot=NAME-->
#
#   CSS (dentro de <style>): usar comentário CSS, porque o token @NAME dentro
#   de HTML comment vira at-rule desconhecida e o parser come a próxima {...}:
#       /*@SOLSTICE_BUILD:slot=NAME*/.../*/@SOLSTICE_BUILD:slot=NAME*/
#
# A regex usa backreferences nomeadas pra exigir que abertura e fechamento
# usem o MESMO formato (não mistura <!-- com */). Isso pega typos como
# `<!--...*/` cedo. re.DOTALL pra que `.` cubra newlines no corpo.
PLACEHOLDER_RE = re.compile(
    r"(?P<open><!--|/\*)"
    r"@SOLSTICE_BUILD:slot=(?P<name>[A-Za-z0-9_\-./]+)"
    r"(?P<close>-->|\*/)"
    r"(?P<body>.*?)"
    r"(?P=open)/@SOLSTICE_BUILD:slot=(?P=name)(?P=close)",
    re.DOTALL,
)


# ---------------------------------------------------------------------------
# Logging mínimo — sem dependências, sem cor por padrão (terminais corporativos
# muitas vezes não rendem ANSI). Pra debug, SOLSTICE_BUILD_VERBOSE=1.
# ---------------------------------------------------------------------------
def log(msg: str) -> None:
    print(f"[build] {msg}")


def vlog(msg: str) -> None:
    if VERBOSE:
        print(f"[build:v] {msg}")


def die(msg: str, code: int = 1) -> None:
    print(f"[build:ERRO] {msg}", file=sys.stderr)
    sys.exit(code)


# ---------------------------------------------------------------------------
# Leitura do manifesto. Schema mínimo:
#   {
#     "version": 1,
#     "slots": { "<nome>": ["caminho/relativo/a/src.ext", ...], ... },
#     "expected_sha256": "<hex>"   // opcional, usado com SOLSTICE_BUILD_CHECK=1
#   }
# Slots vazios são permitidos; o build resolve "" (string vazia) pra eles.
# ---------------------------------------------------------------------------
def load_manifest() -> dict:
    if not MANIFEST.exists():
        die(f"manifesto não encontrado: {MANIFEST}")
    try:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        die(f"manifesto inválido (JSON): {e}")
    if not isinstance(data, dict):
        die("manifesto deve ser um objeto JSON")
    data.setdefault("slots", {})
    if not isinstance(data["slots"], dict):
        die("manifest.slots deve ser um objeto")
    return data


# ---------------------------------------------------------------------------
# Resolve o conteúdo de um slot lendo e concatenando os arquivos listados.
# Cada arquivo é separado por uma linha em branco. Falha cedo se algum não
# existe — silenciar isso esconderia bugs.
# ---------------------------------------------------------------------------
def resolve_slot(name: str, files: list) -> str:
    if not isinstance(files, list):
        die(f"slot '{name}' deve ser uma lista de caminhos")
    if not files:
        vlog(f"slot '{name}' vazio (sem arquivos no manifest)")
        return ""
    parts = []
    for rel in files:
        path = SRC_DIR / rel
        if not path.exists():
            die(f"slot '{name}': arquivo não encontrado: {path}")
        vlog(f"  + {rel}")
        parts.append(path.read_text(encoding="utf-8"))
    # Newline entre arquivos pra evitar colagem acidental (ex.: linhas sem \n
    # final colando com o início do próximo).
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Aplica todos os placeholders encontrados no baseline. Slots referenciados
# no baseline mas ausentes no manifest viram vazios (com aviso). Slots no
# manifest que NÃO aparecem no baseline disparam erro — provavelmente é typo.
# ---------------------------------------------------------------------------
def apply_placeholders(html: str, manifest: dict) -> str:
    slots_in_manifest = set(manifest["slots"].keys())
    slots_seen = set()
    missing_in_manifest = []

    def replace(match: re.Match) -> str:
        name = match.group("name")
        open_tok = match.group("open")    # <!--  ou  /*
        close_tok = match.group("close")  # -->   ou  */
        slots_seen.add(name)
        if name not in slots_in_manifest:
            missing_in_manifest.append(name)
            return match.group(0)  # mantém placeholder intacto (não-fatal)
        content = resolve_slot(name, manifest["slots"][name])
        # Preserva os marcadores no output (mesmo formato que veio) pra debug
        # e pra próximo build idempotente — rodar build duas vezes seguidas
        # não duplica conteúdo nem troca de formato.
        return (
            f"{open_tok}@SOLSTICE_BUILD:slot={name}{close_tok}\n"
            f"{content}\n"
            f"{open_tok}/@SOLSTICE_BUILD:slot={name}{close_tok}"
        )

    result = PLACEHOLDER_RE.sub(replace, html)

    # Slot no manifest mas não no baseline: provavelmente esqueceu de criar
    # o marcador. Fatal porque o conteúdo seria descartado silenciosamente.
    unused = slots_in_manifest - slots_seen
    if unused:
        die(
            "slots no manifest sem marcador correspondente no baseline: "
            + ", ".join(sorted(unused))
        )

    # Slot no baseline mas não no manifest: aviso (não fatal — permite
    # adicionar marcadores antes de extrair o conteúdo).
    for name in missing_in_manifest:
        log(f"AVISO: slot '{name}' no baseline mas sem entrada no manifest "
            f"(placeholder mantido intacto)")

    return result


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> int:
    if not BASELINE.exists():
        die(f"baseline não encontrado: {BASELINE}")

    log(f"lendo baseline: {BASELINE.relative_to(REPO_ROOT)}")
    baseline_bytes = BASELINE.read_bytes()
    baseline_hash = sha256(baseline_bytes)
    baseline_html = baseline_bytes.decode("utf-8")
    log(f"  tamanho: {len(baseline_bytes):,} bytes")
    log(f"  sha256:  {baseline_hash}")

    manifest = load_manifest()
    slot_count = len(manifest["slots"])
    log(f"manifest: {slot_count} slot(s) declarado(s)")

    result = apply_placeholders(baseline_html, manifest)
    result_bytes = result.encode("utf-8")
    result_hash = sha256(result_bytes)

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(result_bytes)
    log(f"escreveu: {OUTPUT.relative_to(REPO_ROOT)}")
    log(f"  tamanho: {len(result_bytes):,} bytes")
    log(f"  sha256:  {result_hash}")

    # Invariante Fase 1: sem placeholders no baseline → saída == baseline.
    if slot_count == 0 and result_hash != baseline_hash:
        die(
            "INVARIANTE QUEBRADO: manifest vazio, mas saída diferente do "
            "baseline. Isso significa que o pipeline introduziu alteração "
            "espúria. Investigue antes de prosseguir."
        )
    if slot_count == 0 and result_hash == baseline_hash:
        log("OK: byte-idêntico ao baseline (passthrough esperado)")

    expected = manifest.get("expected_sha256")
    if CHECK_HASH:
        if not expected:
            die("SOLSTICE_BUILD_CHECK=1 mas manifest.expected_sha256 ausente")
        if result_hash != expected:
            die(
                f"hash da saída não bate com expected_sha256:\n"
                f"  esperado: {expected}\n"
                f"  obtido:   {result_hash}"
            )
        log("OK: hash bate com expected_sha256")

    return 0


if __name__ == "__main__":
    sys.exit(main())
