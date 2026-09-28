#!/usr/bin/env bash
# Recopie design/tokens.css (bloc ==TOKENS==) dans les deux apps.
# Outil de développement seulement : les apps restent des fichiers HTML autonomes, sans build.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import re,pathlib
src=pathlib.Path('design/tokens.css').read_text()
block=src[src.index('/* ==TOKENS== */'):src.index('/* ==/TOKENS== */')+len('/* ==/TOKENS== */')]
for app in ['sa-terrain/index.html','sa-admin/index.html']:
    p=pathlib.Path(app)
    if not p.exists(): continue
    t=p.read_text()
    if '/*@TOKENS@*/' in t: t=t.replace('/*@TOKENS@*/',block)
    else: t=re.sub(r'/\* ==TOKENS== \*/.*?/\* ==/TOKENS== \*/',lambda m:block,t,flags=re.S)
    p.write_text(t); print('tokens →',app)
PY
