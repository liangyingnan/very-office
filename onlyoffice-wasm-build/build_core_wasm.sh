#!/usr/bin/env bash
#
# build_core_wasm.sh — 仅【收集】已由 WSL+Docker 编译好的 x2t wasm 产物。
#
# 说明：x2t 转换核心的编译不在本脚本里做。请直接在 WSL 中进入
#       /mnt/f/C++WorkSpace/onlyoffice-x2t-wasm，
#       运行其自带的 ./build.sh（内部 docker build --target output），
#       它会在该目录的 build/ 下产出 x2t.wasm + x2t.js（+ .br/.zip 变体）。
# 本脚本只把这些产物复制到统一汇总目录（$OUT_DIR），供 build.sh 收集进前端部署。
#
# 用法（在 WSL 中，普通用户即可）：
#   ./build_core_wasm.sh
#   # 或自定义源/目标：
#   X2T_WASM_DIR=/mnt/f/C++WorkSpace/onlyoffice-x2t-wasm OUT_DIR=./build/wasm ./build_core_wasm.sh
#
set -euo pipefail

# ---------- 定位脚本目录（兼容 sh / bash）----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ---------- 配置 ----------
# x2t 编译产物所在（WSL 主机真实路径；可用环境变量覆盖）
X2T_WASM_DIR="${X2T_WASM_DIR:-/mnt/f/C++WorkSpace/onlyoffice-x2t-wasm}"
# 汇总产物目录（相对脚本目录，普通用户可写；可用环境变量覆盖）
OUT_DIR="${OUT_DIR:-$SCRIPT_DIR/build/wasm}"

mkdir -p "$OUT_DIR"

SRC_WASM="$X2T_WASM_DIR/build/x2t.wasm"
SRC_JS="$X2T_WASM_DIR/build/x2t.js"

if [ ! -f "$SRC_WASM" ] || [ ! -f "$SRC_JS" ]; then
  echo "[warn] 在 $X2T_WASM_DIR/build 未找到 x2t.wasm / x2t.js。" >&2
  echo "       请先到 WSL 中运行 onlyoffice-x2t-wasm 自带的 ./build.sh 完成编译，再执行本脚本。" >&2
  echo "       （本脚本只负责收集，不负责编译。）" >&2
  echo "       当前 X2T_WASM_DIR=$X2T_WASM_DIR" >&2
  exit 1
fi

cp -v "$SRC_WASM" "$OUT_DIR"/
cp -v "$SRC_JS"   "$OUT_DIR"/
cp -v "$X2T_WASM_DIR"/build/x2t.wasm.br "$OUT_DIR"/ 2>/dev/null || true
cp -v "$X2T_WASM_DIR"/build/x2t.js.br   "$OUT_DIR"/ 2>/dev/null || true
echo "==> 已收集 x2t wasm 核心产物到 $OUT_DIR"
ls -lh "$OUT_DIR"
