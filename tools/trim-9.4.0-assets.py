#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/trim-9.4.0-assets.py — 精简 9.4.0.131/vendor 静态资源,缩小离线分发包。

裁剪内容(字体不动):
  1. dictionaries/  只保留 7 种常用语言(en_US/en_GB/de_DE/fr_FR/es_ES/ru_RU/pt_BR)
  2. web-apps/apps/<editor>/main/resources/help/  5 个编辑器的离线帮助全部删除(Help 菜单将 404)
  3. sdkjs-plugins/content/  只保留 office-config.js 启用的 10 个插件 + v1 公共库;
     保留插件内的 deploy/(*.plugin 打包产物,运行时无引用)一并删除
  4. sdkjs/<word|cell|slide|visio>/sdk-all.js  未压缩版(运行时只加载 sdk-all-min.js)

用法:
  python tools/trim-9.4.0-assets.py            # dry-run,只打印将删除的内容
  python tools/trim-9.4.0-assets.py --apply    # 真正删除

幂等:重复运行只处理仍存在的目标。删除后必须按 AGENTS.md 约定把
9.4.0.131/vendor/document_editor_service_worker.js 的缓存版本 _vN +1。

恢复来源:
  dictionaries → F:/JsWorkSpace/DocumentServer/dictionaries
  plugins      → F:/JsWorkSpace/onlyoffice.github.io/sdkjs-plugins
  help / sdk-all.js → 重建 F:/JsWorkSpace/DocumentServer/web-apps (grunt deploy)
"""

import os
import shutil
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(REPO_ROOT, "9.4.0.131", "vendor")

# office-config.js pluginsData 启用的插件 + 插件公共运行库 v1
KEEP_PLUGINS = {
    "ai", "zhipu", "drawio", "highlightcode", "ocr",
    "photoeditor", "translator", "zoom", "languagetool", "mathpix",
    "v1",
}

KEEP_DICTS = {"en_US", "en_GB", "de_DE", "fr_FR", "es_ES", "ru_RU", "pt_BR"}

EDITORS = ["documenteditor", "spreadsheeteditor", "presentationeditor",
           "pdfeditor", "visioeditor"]

SDKJS_DIRS = ["word", "cell", "slide", "visio"]


def dir_size(path):
    total = 0
    for base, _dirs, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(base, f))
            except OSError:
                pass
    return total


def mb(n):
    return "%.1f MB" % (n / 1024.0 / 1024.0)


def remove(path, apply, stats):
    """删除文件或目录(幂等),返回是否命中目标。"""
    if not os.path.exists(path):
        return False
    size = dir_size(path) if os.path.isdir(path) else os.path.getsize(path)
    stats[0] += 1
    stats[1] += size
    print(("  DEL " if apply else "  [dry] ") + os.path.relpath(path, VENDOR)
          + "  (" + mb(size) + ")")
    if apply:
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
    return True


def main():
    apply = "--apply" in sys.argv
    if not os.path.isdir(VENDOR):
        print("vendor 目录不存在: " + VENDOR)
        return 1

    print(("=== APPLY 模式,真正删除 ===" if apply
           else "=== DRY-RUN 预览(加 --apply 才会删除) ==="))
    stats = [0, 0]  # 目标数, 字节数

    # 1. 词典:白名单
    print("\n[1] dictionaries/ (保留 " + ", ".join(sorted(KEEP_DICTS)) + ")")
    droot = os.path.join(VENDOR, "dictionaries")
    if os.path.isdir(droot):
        for name in sorted(os.listdir(droot)):
            p = os.path.join(droot, name)
            if os.path.isdir(p) and name not in KEEP_DICTS:
                remove(p, apply, stats)

    # 2. 离线帮助:5 个编辑器全删
    print("\n[2] web-apps 离线帮助 help/ (全部删除)")
    for editor in EDITORS:
        remove(os.path.join(VENDOR, "web-apps", "apps", editor,
                            "main", "resources", "help"), apply, stats)

    # 3. 插件:只留启用的 10 个 + v1;保留插件内的 deploy/ 也删
    print("\n[3] sdkjs-plugins/content/ (保留 " + ", ".join(sorted(KEEP_PLUGINS)) + ")")
    proot = os.path.join(VENDOR, "sdkjs-plugins", "content")
    if os.path.isdir(proot):
        for name in sorted(os.listdir(proot)):
            p = os.path.join(proot, name)
            if not os.path.isdir(p):
                continue
            if name not in KEEP_PLUGINS:
                remove(p, apply, stats)
            else:
                remove(os.path.join(p, "deploy"), apply, stats)

    # 4. 未压缩 sdk-all.js(运行时只加载 sdk-all-min.js);
    #    含 __ooSdkAllStub 标记的兼容 stub 保留(吸收旧浏览器缓存残留页面的 sdk-all.js 引用)
    print("\n[4] sdkjs 未压缩 sdk-all.js")
    for d in SDKJS_DIRS:
        p = os.path.join(VENDOR, "sdkjs", d, "sdk-all.js")
        if os.path.isfile(p):
            with open(p, 'rb') as f:
                if b'__ooSdkAllStub' in f.read(2048):
                    print("  保留 stub: " + p)
                    continue
        remove(p, apply, stats)

    print("\n=== 合计: %d 个目标, %s ===" % (stats[0], mb(stats[1])))
    if not apply:
        print("以上为预览,确认后运行: python tools/trim-9.4.0-assets.py --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
