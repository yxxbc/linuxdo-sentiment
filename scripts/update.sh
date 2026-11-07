#!/usr/bin/env bash
# 拉取最新代码（扩展未上架商店，浏览器不会自动更新）
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
echo
echo "已更新到 $(git describe --tags --always 2>/dev/null || git rev-parse --short HEAD)"
echo "下一步：chrome://extensions → 找到「L站舆情仪表」→ 点刷新"
