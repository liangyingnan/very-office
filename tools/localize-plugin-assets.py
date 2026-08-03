#!/usr/bin/env python3
"""localize-plugin-assets.py — 把插件 HTML 里的外网基础资源改为本地路径

onlyoffice.github.io/sdkjs-plugins/v1/ 的资源（plugins.js / plugins-ui.js / plugins.css）
在 very-office 本地已有（9.4.0/vendor/sdkjs-plugins/v1/），插件页面应直接引用本地副本，
避免外网依赖（离线/无外网时插件页报错）。

替换规则：https://onlyoffice.github.io/sdkjs-plugins/v1/  → 相对本文件的 ../../v1/... 路径
（从 content/<plugin>/[subdir/] 出发到 sdkjs-plugins/v1/）。

其余 CDN（jsrsasign / moment / mathjax 等）是插件功能依赖（AI 签名、图表渲染），
需要对应服务时仍需网络，不在此处理。
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, '9.4.0', 'vendor', 'sdkjs-plugins', 'content')

EXTERNAL = 'https://onlyoffice.github.io/sdkjs-plugins/v1/'
# 已本地化的引用（可能是错误级数）也一并修正
LOCALIZED = re.compile(r'(?:\.\./)+v1/(?:plugins|plugins-ui)\.js|(?:\.\./)+v1/plugins\.css')
PATTERN = re.compile(re.escape(EXTERNAL))


def rel_to_v1(html_path):
    """从 html 文件所在目录到 sdkjs-plugins/v1/ 的相对路径"""
    d = os.path.dirname(html_path)          # .../content/<plugin>[/subdir...]
    v1 = os.path.join(os.path.dirname(CONTENT), 'v1')   # .../sdkjs-plugins/v1
    rel = os.path.relpath(v1, d).replace(os.sep, '/')
    if not rel.endswith('/'):
        rel += '/'
    return rel


def main():
    targets = []
    for dirpath, _, files in os.walk(CONTENT):
        for f in files:
            if f.endswith('.html'):
                targets.append(os.path.join(dirpath, f))
    targets.sort()

    changed = 0
    total = 0
    for fp in targets:
        with open(fp, encoding='utf-8', errors='replace') as fh:
            content = fh.read()
        rel = rel_to_v1(fp)
        new_content = content
        n1 = 0
        if EXTERNAL in new_content:
            new_content = PATTERN.sub(rel, new_content)
            n1 = content.count(EXTERNAL)
        # 修正已本地化但级数不对的引用（第一次脚本算错，输出 '../../../v1/'）
        def _fix(m):
            return rel + m.group(0).split('v1/', 1)[1]
        n2 = len(LOCALIZED.findall(new_content))
        new_content = LOCALIZED.sub(_fix, new_content)
        if n1 or n2:
            with open(fp, 'w', encoding='utf-8') as fh:
                fh.write(new_content)
            changed += 1
            total += n1 + n2
            print(f'  {os.path.relpath(fp, ROOT)}: {n1 + n2} 处 → {rel}')

    print(f'完成：{changed} 个文件，{total} 处替换')


if __name__ == '__main__':
    main()
