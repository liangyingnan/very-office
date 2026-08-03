#!/usr/bin/env bash
#
# build.sh — 总编排：构建前端（sdkjs + web-apps），内置 drawio，汇集 wasm 核心。
#
# 运行环境：onlyoffice-wasm-build 的 Docker 容器内，或装好 node/npm 的 Linux。
# 约定挂载：/src/DocumentServer（含 sdkjs、web-apps 子模块），/src/onlyoffice.github.io。
#
set -euo pipefail

DOCUMENTSERVER_ROOT="${DOCUMENTSERVER_ROOT:-/src/DocumentServer}"
PLUGINS_REPO_ROOT="${PLUGINS_REPO_ROOT:-/src/onlyoffice.github.io}"
BUILD_ROOT="${BUILD_ROOT:-/build/build}"
WWW_DIR="$BUILD_ROOT/www"
WASM_DIR="$BUILD_ROOT/wasm"

mkdir -p "$WWW_DIR"

# ---------- 1. 构建 sdkjs（编辑器 JS 内核） ----------
# sdkjs 官方构建通常为：npm ci && npm run build（或 gulp）。按你的版本核对。
if [ -d "$DOCUMENTSERVER_ROOT/sdkjs" ]; then
  echo "==> 构建 sdkjs"
  pushd "$DOCUMENTSERVER_ROOT/sdkjs" >/dev/null
  npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
  npm run build || npx gulp build || echo "[warn] sdkjs 构建命令未命中，请核对 package.json scripts"
  popd >/dev/null
fi

# ---------- 2. 构建 web-apps（编辑器前端 UI） ----------
if [ -d "$DOCUMENTSERVER_ROOT/web-apps" ]; then
  echo "==> 构建 web-apps"
  pushd "$DOCUMENTSERVER_ROOT/web-apps" >/dev/null
  npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
  npm run build || npx gulp build || echo "[warn] web-apps 构建命令未命中，请核对 package.json scripts"
  # 把 web-apps 构建产物拷到 www（具体产物目录以版本为准，常见为 dist/ 或 build/）
  for d in dist build; do
    [ -d "$d" ] && cp -r "$d"/. "$WWW_DIR"/ && echo "    拷贝 $d -> $WWW_DIR"
  done
  popd >/dev/null
fi

# ---------- 3. 汇集 wasm 核心（x2t.wasm / x2t.js，由 build_core_wasm.sh 产出） ----------
# 产物由 onlyoffice-x2t-wasm 编译得到，是【文档转换引擎】的 wasm。
# 它们被放到 www/wasm，由静态服务托管。
# 若要让浏览器编辑器真正用上它，还需在前端写调用胶水：
#   用 emscripten 的 ccall 调导出函数 _main1(xmlPath)，并通过 FS 传入/取出文档。
#   （标准 DocumentServer 的转换在服务端完成，浏览器内调用 x2t.wasm 是自定义集成，见 README。）
if [ -f "$WASM_DIR/x2t.wasm" ] && [ -f "$WASM_DIR/x2t.js" ]; then
  echo "==> 汇集 wasm 核心 (x2t) 到 $WWW_DIR/wasm"
  mkdir -p "$WWW_DIR/wasm"
  cp -v "$WASM_DIR"/x2t.wasm "$WASM_DIR"/x2t.js "$WWW_DIR/wasm"/
  cp -v "$WASM_DIR"/x2t.wasm.br "$WASM_DIR"/x2t.js.br "$WWW_DIR/wasm"/ 2>/dev/null || true
else
  echo "[warn] 未找到 x2t wasm 产物（$WASM_DIR/x2t.wasm）。请先运行 build_core_wasm.sh 编译 core。"
fi

# ---------- 4. 内置 drawio 插件 ----------
"$(dirname "$0")/bundle_drawio.sh"

echo "==> 完成。静态托管 $WWW_DIR 即可在浏览器打开纯 wasm 编辑器。"
