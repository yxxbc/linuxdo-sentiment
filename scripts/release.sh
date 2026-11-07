#!/usr/bin/env bash
# 用法：GITHUB_TOKEN=xxx ./scripts/release.sh 0.2.1 "更新说明"
# 做四件事：改版本号 → 提交 → 打 tag → 建 Release 并上传 zip
set -euo pipefail
cd "$(dirname "$0")/.."

VER="${1:?用法: release.sh <version> [notes]}"
NOTES="${2:-Release v${VER}}"
REPO="yxxbc/linuxdo-sentiment"

python3 - "$VER" <<'PY'
import json,sys
p='manifest.json'; m=json.load(open(p))
m['version']=sys.argv[1]
json.dump(m,open(p,'w'),ensure_ascii=False,indent=2)
open(p,'a').write('\n')
PY

bash scripts/build.sh
git add -A
git commit -m "chore(release): v${VER}"
git tag -a "v${VER}" -m "v${VER}"
git push origin HEAD --tags

ZIP="dist/linuxdo-sentiment-v${VER}.zip"
: "${GITHUB_TOKEN:?需要 GITHUB_TOKEN}"
REL=$(curl -sS -X POST \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO}/releases" \
  -d "{\"tag_name\":\"v${VER}\",\"name\":\"v${VER}\",\"body\":\"${NOTES}\"}")

UPLOAD=$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['upload_url'])" "$REL")
UPLOAD="${UPLOAD%%\{*}"
curl -sS -X POST -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Content-Type: application/zip" \
  --data-binary @"${ZIP}" "${UPLOAD}?name=$(basename "${ZIP}")" >/dev/null
echo "已发布 v${VER}：https://github.com/${REPO}/releases/tag/v${VER}"
