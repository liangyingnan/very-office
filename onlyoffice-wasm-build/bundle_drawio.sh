#!/usr/bin/env bash
#
# bundle_drawio.sh — 把 drawio 插件复制进构建产物，并注册为“默认插件”。
#
# 做法：
#   1) 复制插件目录到 <www>/sdkjs-plugins/drawio（编辑器会扫描该目录自动发现）。
#   2) 把 drawio 的 guid 加入编辑器读取的“默认插件列表”（含 "plugins" 数组的 JSON 配置）。
#
# 运行环境：同 build.sh（需要 python3，用于安全地改写 JSON）。
#
set -euo pipefail

PLUGINS_REPO_ROOT="${PLUGINS_REPO_ROOT:-/mnt/f/JsWorkSpace/onlyoffice.github.io}"
# 抽取出的离线前端根目录（extract_frontend.sh 的默认输出位置）
VENDOR_DIR="${VENDOR_DIR:-$(cd "$(dirname "$0")" && pwd)/build/vendor}"
# 兼容旧调用：若显式指定了 WWW_DIR，则以其为准；否则落到 vendor 布局
WWW_DIR="${WWW_DIR:-$VENDOR_DIR}"
DRAWIO_SRC="${DRAWIO_SRC:-$PLUGINS_REPO_ROOT/sdkjs-plugins/content/drawio}"
WWW_PLUGINS_DIR="${WWW_PLUGINS_DIR:-$WWW_DIR/sdkjs-plugins}"

# drawio 插件清单里的 guid（config.json -> "guid"）
DRAWIO_GUID="asc.{DB38923B-A8C0-4DE9-8AEE-A61BB5C901A5}"

# 若你的版本把“默认插件列表”放在固定文件，可显式指定（只改这一个文件）；
# 留空则自动扫描 www 下含 "plugins" 数组的 JSON。
DEFAULT_PLUGINS_CONFIG="${DEFAULT_PLUGINS_CONFIG:-}"

if [ ! -d "$DRAWIO_SRC" ]; then
  echo "[error] 找不到 drawio 插件源：$DRAWIO_SRC" >&2
  exit 1
fi

# ---------- 1. 复制插件目录 ----------
echo "==> 复制 drawio 插件 -> $WWW_PLUGINS_DIR/drawio"
mkdir -p "$WWW_PLUGINS_DIR"
rm -rf "$WWW_PLUGINS_DIR/drawio"
cp -r "$DRAWIO_SRC" "$WWW_PLUGINS_DIR/drawio"
echo "    已复制：$(ls "$WWW_PLUGINS_DIR/drawio" | wc -l) 个条目"

# ---------- 2. 注册为默认插件 ----------
echo "==> 注册 drawio 为默认插件 (guid=$DRAWIO_GUID)"
python3 - "$WWW_DIR" "$DRAWIO_GUID" "$DEFAULT_PLUGINS_CONFIG" <<'PY'
import json, sys, os, glob

www_dir, guid, explicit = sys.argv[1], sys.argv[2], sys.argv[3] or None

def patch_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return False, f"跳过(非JSON/解析失败): {e}"
    changed = False
    if isinstance(data, dict) and 'plugins' in data and isinstance(data['plugins'], list):
        plugins = data['plugins']
        # 支持字符串列表 或 对象列表({"guid": ...})
        def has(g):
            return any((isinstance(x, str) and x == g) or
                       (isinstance(x, dict) and x.get('guid') == g) for x in plugins)
        if not has(guid):
            # 按元素类型插入
            if plugins and isinstance(plugins[0], dict):
                plugins.append({'guid': guid})
            else:
                plugins.append(guid)
            changed = True
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True, "已添加默认插件"
    return False, "已含该插件/无需改动"

targets = [explicit] if explicit else []
if not targets:
    for root, _, files in os.walk(www_dir):
        for fn in files:
            if fn.endswith('.json'):
                targets.append(os.path.join(root, fn))

hits = 0
for t in targets:
    if not os.path.isfile(t):
        continue
    ok, msg = patch_file(t)
    if ok:
        hits += 1
        print(f"    [改] {t}: {msg}")
    else:
        # 仅对确实含 plugins 的文件打印提示，避免刷屏
        pass

if hits == 0:
    print("    [提示] 未找到含 'plugins' 数组的 JSON 配置，drawio 已放入插件目录、会被自动发现；")
    print("           若需'默认启用'（免手动安装），请按你的 ONLYOFFICE 版本把 guid 加入默认插件列表，")
    print("           例如设置 DEFAULT_PLUGINS_CONFIG=/build/build/www/.../config.json 后重跑本脚本。")
else:
    print(f"    [完成] 已在 {hits} 个配置文件中注册 drawio 为默认插件。")
PY

echo "==> drawio 内置完成。"
