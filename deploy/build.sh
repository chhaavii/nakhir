#!/usr/bin/env bash
# Assemble the deployable bundle from the authored sources.
# The engine stays single-sourced in engine/water-core.js; this copies it next
# to the Worker and into the public assets so the browser imports the same code.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

echo "nakhir build"
cp engine/water-core.js deploy/water-core.js
cp engine/water-core.js deploy/public/water-core.js
mkdir -p deploy/public/data
cp data/sources.json deploy/public/data/sources.json
[ -f data/backtest.json ] && cp data/backtest.json deploy/public/data/backtest.json || true

echo "  worker      deploy/worker.js"
echo "  engine      deploy/water-core.js  ($(wc -l < deploy/water-core.js) lines)"
echo "  assets      deploy/public/"
echo "  sources     $(python3 -c "import json;print(len(json.load(open('data/sources.json'))['sources']))") in data/sources.json"
echo "ok"
