#!/usr/bin/env python3
"""inline-deploy-html.py — 模拟官方 grunt-inline 构建步骤，把 *.html.deploy 处理为正式 HTML

官方 web-apps 构建流程：index.html.deploy（模板）→ grunt inline（把 ?__inline=true
的 script / <inline src> 资源内联进 HTML）→ index.html。仓库里保留的是模板，
直接部署会 404（themeinit.js / desktopinit.js / htmlutils.js / docserviceworker.js /
device_scale.js 等全部是待内联资源）。

处理规则（与 build/plugins/grunt-inline/tasks/inline.js 一致）：
  <script src="path?__inline=true"></script>  → <script>文件内容</script>
  <inline src="path" />                       → 文件内容（SVG 等）
  <link href="path?__inline=true">            → <style>文件内容</style>

用法：
  python tools/inline-deploy-html.py            # 处理 9.4.0/vendor/web-apps 下全部 .deploy
"""
import os
import re
import sys
import base64

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPS = os.path.join(ROOT, '9.4.0', 'vendor', 'web-apps', 'apps')

SCRIPT_INLINE = re.compile(
    r'<script(?P<attrs>[^>]*?)src=["\'](?P<src>[^"\']+\?__inline=true)["\'][^>]*?>\s*</script>',
    re.IGNORECASE | re.DOTALL)
LINK_INLINE = re.compile(
    r'<link(?P<attrs>[^>]*?)href=["\'](?P<href>[^"\']+\?__inline=true)["\'][^>]*?/?>',
    re.IGNORECASE | re.DOTALL)
INLINE_TAG = re.compile(r'<inline\s+src=["\'](?P<src>[^"\']+)["\']\s*/?>', re.IGNORECASE)
IMG_INLINE = re.compile(
    r'<img(?P<attrs>[^>]*?)src=["\'](?P<src>[^"\']+\?__inline=true)["\'][^>]*?/?>',
    re.IGNORECASE | re.DOTALL)


def read_text(path):
    with open(path, 'rb') as f:
        return f.read().decode('utf-8')


def resolve(base_dir, src):
    """解析 inline 引用路径。

    官方构建在 deploy/web-apps/apps/<app>/main/ 下执行 inline（比我们的源码树
    深 2 级），模板里的 5~6 级 ../ 引用在 very-office 布局下需减 2 级。
    策略：先按原路径解析，文件不存在则去掉前两个 ../ 重试（2 级引用如
    ../../common/... 原路径即可命中）。
    """
    clean = src.split('?', 1)[0]
    candidates = [os.path.normpath(os.path.join(base_dir, clean))]
    if clean.startswith('../'):
        reduced = clean
        for _ in range(2):
            if reduced.startswith('../'):
                reduced = reduced[3:]
        candidates.append(os.path.normpath(os.path.join(base_dir, reduced)))
    for fp in candidates:
        if os.path.exists(fp):
            return fp
    return candidates[0]


def inline_file(html_path, content):
    base_dir = os.path.dirname(html_path)

    # 记录 HTML 注释区间，注释内的 <inline> 不处理
    comments = [(m.start(), m.end()) for m in re.finditer(r'<!--.*?-->', content, re.DOTALL)]

    def _in_comment(pos):
        return any(s <= pos < e for s, e in comments)

    def _load(src):
        fp = resolve(base_dir, src)
        if not os.path.exists(fp):
            print(f'  [warn] 内联文件不存在: {fp}')
            return None
        return fp

    def _replace_script(m):
        attrs, src = m.group('attrs'), m.group('src')
        fp = _load(src)
        if not fp:
            return m.group(0)
        body = read_text(fp)
        return f'<script{attrs}>\n{body}\n</script>'

    def _replace_inline_tag(m):
        src = m.group('src')
        fp = _load(src)
        if not fp:
            return m.group(0)
        return read_text(fp)

    def _replace_link(m):
        attrs, href = m.group('attrs'), m.group('href')
        fp = _load(href)
        if not fp:
            return m.group(0)
        return f'<style{attrs}>\n{read_text(fp)}\n</style>'

    def _replace_img(m):
        attrs, src = m.group('attrs'), m.group('src')
        fp = _load(src)
        if not fp:
            return m.group(0)
        ext = os.path.splitext(fp)[1].lstrip('.').lower()
        mime = {'svg': 'image/svg+xml', 'png': 'image/png', 'jpg': 'image/jpeg',
                'gif': 'image/gif', 'webp': 'image/webp'}.get(ext, 'application/octet-stream')
        with open(fp, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('ascii')
        return f'<img{attrs}src="data:{mime};base64,{b64}" />'

    # 先处理 <inline> 标签（此时 content 未变，注释位置有效）
    def _replace_inline_tag_safe(m):
        if _in_comment(m.start()):
            return m.group(0)
        return _replace_inline_tag(m)

    content = INLINE_TAG.sub(_replace_inline_tag_safe, content)
    content = SCRIPT_INLINE.sub(_replace_script, content)
    content = LINK_INLINE.sub(_replace_link, content)
    content = IMG_INLINE.sub(_replace_img, content)
    return content


def main():
    deploy_files = []
    for dirpath, _, files in os.walk(APPS):
        for f in files:
            if f.endswith('.deploy'):
                deploy_files.append(os.path.join(dirpath, f))
    deploy_files.sort()

    print(f'共 {len(deploy_files)} 个 .deploy 文件')
    for fp in deploy_files:
        dest = fp[:-len('.deploy')]  # index.html.deploy -> index.html
        content = read_text(fp)
        processed = inline_file(fp, content)
        with open(dest, 'w', encoding='utf-8') as f:
            f.write(processed)
        print(f'✅ {os.path.relpath(dest, ROOT)} ({len(processed)} B)')

    # api.js 引用的 cache/preload 页面（官方构建也对其做 inline）
    for extra in ['api/documents/cache-scripts.html', 'api/documents/preload.html']:
        fp = os.path.join(APPS, extra)
        if not os.path.exists(fp):
            continue
        content = read_text(fp)
        processed = inline_file(fp, content)
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(processed)
        print(f'✅ {os.path.relpath(fp, ROOT)} ({len(processed)} B)')

    print('完成。')


if __name__ == '__main__':
    main()
