#!/usr/bin/env bash
# Build the installable BeamNG.drive mod zip.
#
#   ./build.sh
#
# Produces dist/BelsecoDOT.zip, whose contents sit at the zip root exactly the
# way BeamNG expects (vehicles/, lua/, ui/, art/, info.json).

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/dist/BelsecoDOT.zip"

cd "$HERE"

echo "regenerating art and data..."
python3 tools/generate_skins.py --guide
python3 tools/generate_materials.py
python3 tools/generate_configs.py
python3 tools/generate_sounds.py

rm -f "$OUT"
mkdir -p "$HERE/dist"

cd "$HERE/mod"
zip -r -q "$OUT" . \
  -x '*.template' \
  -x '.DS_Store' \
  -x '__MACOSX/*'

cd "$HERE"
echo
echo "built $OUT"
unzip -l "$OUT" | tail -n 1
