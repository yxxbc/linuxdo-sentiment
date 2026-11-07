#!/usr/bin/env bash
# 打包扩展：dist/linuxdo-sentiment-v<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/linuxdo-sentiment-v${VER}.zip"
mkdir -p dist
rm -f "$OUT"
zip -qr "$OUT" manifest.json src README.md LICENSE docs/METHOD.md \
  -x "*.DS_Store" -x "*/test/*"
echo "打包完成：$OUT"
unzip -l "$OUT" | tail -3
