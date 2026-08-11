#!/usr/bin/env bash
#
# extract_frontend.sh — 从官方 onlyoffice/documentserver 镜像抽取【已构建好的 9.4 前端】
#                       (web-apps + sdkjs + sdkjs-plugins)。
#
# 为什么这么做（而不是从源码 build_tools 全量编译）：
#   官方 build_tools 仓库只提供 `automate.py server` 整包编译（含 C++ 核心 / Qt / Node 后端，
#   需要完整 Linux 构建机、数小时），没有「只构建 web-apps/sdkjs 前端」的文档化命令。
#   而官方 DS 镜像里【已经包含编译好的 9.4 前端】，docker cp 抽出来得到与源码编译完全一致的
#   静态产物，几分钟搞定，不必扛那套重构建。
#
# 用法（在 WSL 里执行）：
#   ./extract_frontend.sh                 # 默认 latest(≈9.4)，输出到 ./build/vendor
#   DS_TAG=9.4.0.131 ./extract_frontend.sh    # 指定镜像 tag（建议与你的意图对齐）
#   OUT_DIR=/path/to/vendor ./extract_frontend.sh
#
# 注意：容器 Web 根路径若与你的镜像版本不符，改下面 CONTAINER_WEB_ROOT 即可
#       （9.x 官方镜像标准是 /var/www/onlyoffice/documentserver）。
#
set -euo pipefail

DS_TAG="${DS_TAG:-latest}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${OUT_DIR:-$SCRIPT_DIR/build/vendor}"
CONTAINER_WEB_ROOT="${CONTAINER_WEB_ROOT:-/var/www/onlyoffice/documentserver}"

IMAGE="onlyoffice/documentserver:${DS_TAG}"
CTR="oofs-extract-$$"

echo "==> 拉取镜像 ${IMAGE}（本地已有则跳过）"
docker pull "$IMAGE"

echo "==> 创建临时容器 ${CTR}"
docker create --name "$CTR" "$IMAGE" >/dev/null

# 容器退出后清理，避免残留
cleanup() { docker rm -f "$CTR" >/dev/null 2>&1 || true; }
trap cleanup EXIT

mkdir -p "$OUT_DIR"

echo "==> 抽取 web-apps  -> $OUT_DIR/web-apps"
docker cp "${CTR}:${CONTAINER_WEB_ROOT}/web-apps" "$OUT_DIR/web-apps"

echo "==> 抽取 sdkjs    -> $OUT_DIR/sdkjs"
docker cp "${CTR}:${CONTAINER_WEB_ROOT}/sdkjs" "$OUT_DIR/sdkjs"

echo "==> 抽取 sdkjs-plugins（官方默认插件目录；drawio 将默认内置于此）"
if docker cp "${CTR}:${CONTAINER_WEB_ROOT}/sdkjs-plugins" "$OUT_DIR/sdkjs-plugins" 2>/dev/null; then
  echo "    已抽取 sdkjs-plugins（$(ls "$OUT_DIR/sdkjs-plugins" 2>/dev/null | wc -l) 个条目）"
else
  echo "    [warn] 该镜像版本无 sdkjs-plugins 目录，稍后需手动新建并放入 drawio"
fi

echo
echo "==> 完成。前端产物位于: $OUT_DIR"
echo "    web-apps/       编辑器 UI（含 apps/api/documents/api.js = DocsAPI）"
echo "    sdkjs/          编辑引擎"
echo "    sdkjs-plugins/  官方插件目录（drawio 将默认内置于此）"
echo
echo "后续步骤："
echo "  1) 把 x2t.wasm 放到 $OUT_DIR/sdkjs/common/wasm/x2t/  （替换/新增转换核心）"
echo "  2) ./bundle_drawio.sh                      把 drawio 默认内置到 $OUT_DIR/sdkjs-plugins/drawio"
echo "  3) 用 onlyoffice.html + office.html 的 postMessage 协议在 electron 中 iframe 嵌入"
echo
echo "⚠️ 版本对齐提醒：抽取的前端是 ${DS_TAG}（≈9.4），而你已编译的 x2t.wasm 是 9.3.0.140。"
echo "   混用 9.3 转换核心 + 9.4 前端存在格式/序列化不匹配风险。可选："
echo "     - 重新用 9.4.x 的 core 编译 x2t（对齐前端），或"
echo "     - 改用 OnlyofficePersonal 已构建好的 9.3.0.136 vendor（与 9.3.0.140 x2t 同线、已验证）。"
