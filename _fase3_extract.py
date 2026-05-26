#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Helper parametrizado da Fase 3.

WAVE aceita 4 formas de delimitar:
  - start_anchor: string literal apos a qual o chunk comeca
  - start_const: nome de modulo (usa find_module_start; aceita
                 placeholder de slot ja extraido como fronteira)
  - end_anchor: string literal ANTES da qual o chunk termina
  - next_const: nome de modulo onde o chunk termina (= fronteira do
                proximo modulo)

Quando ha placeholder no caminho, prefira anchors explicitos pra
evitar engolir placeholders vizinhos.
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASELINE = ROOT / "solstice_baseline.html"
MODULE_END_PATTERNS = ("  })();", "  })()", "  };")
PLACEHOLDER_CLOSE_RE = re.compile(r"^  /\*/@SOLSTICE_BUILD:slot=[\w\-./]+\*/$")

WAVE = {
    "name": "Onda 3.G - Features 2 (Filters -> Annotations)",
    "start_anchor": "  /*/@SOLSTICE_BUILD:slot=features-1-modules*/\n",
    "next_const": "SolsticeMultiTab",
    "expected": [
        "SolsticeFilters", "SolsticeCrossFilter", "SolsticeParams",
        "SolsticeColumnScore", "SolsticeRecommender", "SolsticeAutoDashboard",
        "SolsticeWizard", "SolsticeAnnotations",
    ],
    "out_dir": "src/features",
    "slot_name": "features-2-modules",
    "file_index_start": 10,
}


def find_module_start(text, const_pos):
    """Sobe linha por linha procurando linha de fim de unidade:
       - `  })();` ou `  };` (fim de modulo IIFE/objeto)
       - close de placeholder de slot ja extraido"""
    line_start = const_pos
    while line_start > 0:
        prev_nl = text.rfind("\n", 0, line_start - 1)
        prev_line_start = 0 if prev_nl < 0 else prev_nl + 1
        prev_line = text[prev_line_start:line_start - 1].rstrip()
        if prev_line in MODULE_END_PATTERNS:
            return line_start
        if PLACEHOLDER_CLOSE_RE.match(prev_line):
            return line_start
        line_start = prev_line_start
    return 0


def main():
    text = BASELINE.read_text(encoding="utf-8")

    # chunk_start
    if "start_anchor" in WAVE:
        sidx = text.find(WAVE["start_anchor"])
        if sidx < 0:
            print(f"ERRO: start_anchor nao encontrado: {WAVE['start_anchor']!r}",
                  file=sys.stderr); return 1
        chunk_start = sidx + len(WAVE["start_anchor"])
    elif "start_const" in WAVE:
        sc = f"  const {WAVE['start_const']} = "
        sc_idx = text.find(sc)
        if sc_idx < 0:
            print(f"ERRO: nao achei `{sc}`", file=sys.stderr); return 1
        chunk_start = find_module_start(text, sc_idx)
    else:
        print("ERRO: WAVE precisa de start_anchor OU start_const", file=sys.stderr)
        return 1

    # chunk_end
    if "end_anchor" in WAVE:
        eidx = text.find(WAVE["end_anchor"], chunk_start)
        if eidx < 0:
            print(f"ERRO: end_anchor nao encontrado: {WAVE['end_anchor']!r}",
                  file=sys.stderr); return 1
        chunk_end = eidx
    elif "next_const" in WAVE:
        next_pat = f"  const {WAVE['next_const']} = "
        next_idx = text.find(next_pat, chunk_start)
        if next_idx < 0:
            print(f"ERRO: nao achei `{next_pat}`", file=sys.stderr); return 1
        chunk_end = find_module_start(text, next_idx)
    else:
        print("ERRO: WAVE precisa de end_anchor OU next_const", file=sys.stderr)
        return 1

    chunk = text[chunk_start:chunk_end]
    print(f"=== {WAVE['name']} ===")
    print(f"chunk: bytes {chunk_start}..{chunk_end} ({len(chunk)}b, "
          f"{chunk.count(chr(10))+1}L)")

    matches = list(re.finditer(r"^  const (Solstice\w+)\s*=", chunk, re.MULTILINE))
    names = [m.group(1) for m in matches]
    if names != WAVE["expected"]:
        print(f"ERRO esperado {WAVE['expected']}", file=sys.stderr)
        print(f"      obtido   {names}", file=sys.stderr)
        return 1

    boundaries = [find_module_start(chunk, m.start()) for m in matches]
    boundaries.append(len(chunk))

    blocks = {}; rebuilt = ""
    idx_start = WAVE.get("file_index_start", 1)
    for i, name in enumerate(names):
        body = chunk[boundaries[i]:boundaries[i+1]]
        short = re.sub(r"^Solstice", "", name)
        fname = f"{idx_start + i:02d}-{short}.js"
        has_end = any(L.rstrip() in MODULE_END_PATTERNS for L in body.split("\n"))
        if not has_end:
            print(f"ERRO sem fechamento: {fname}", file=sys.stderr); return 1
        print(f"  {fname:30s}  {len(body):>6}b  {body.count(chr(10)):>4}L  OK")
        blocks[fname] = body; rebuilt += body

    if rebuilt != chunk:
        print("ERRO byte-mismatch", file=sys.stderr); return 1
    print("OK byte-perfect")

    out_dir = ROOT / WAVE["out_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    for fn, body in blocks.items():
        (out_dir / fn).write_text(body, encoding="utf-8", newline="\n")

    ph = (f"  /*@SOLSTICE_BUILD:slot={WAVE['slot_name']}*/\n"
          f"  /*/@SOLSTICE_BUILD:slot={WAVE['slot_name']}*/\n")
    new_text = text[:chunk_start] + ph + text[chunk_end:]
    BASELINE.write_text(new_text, encoding="utf-8", newline="\n")
    print(f"baseline: {len(text)} -> {len(new_text)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
