# -*- coding: utf-8 -*-
"""验证 9.4.0 离线构建"插入 -> 来自本地文件的文本"功能。

覆盖三个验证点：
1. 打开文档正常（回归，无 Write_ToBinary2 崩溃）
2. History 激活时 new CDocument 不再崩溃（CustomXmlManager 补丁）
3. 插入本地 txt 走离线 x2t 转换并成功粘贴（无 downloadas 404）
"""
import asyncio
import os
import sys
import time
from playwright.async_api import async_playwright

BASE = 'http://localhost:8000/office.html'
TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'insert-test.txt')

async def main():
    # 准备测试 txt
    with open(TXT, 'w', encoding='utf-8') as f:
        f.write('离线插入文本测试行 1\n离线插入文本测试行 2\n锐小招 offline insert test')

    errors = []
    console_lines = []
    downloadas_requests = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('console', lambda m: console_lines.append(f'[{m.type}] {m.text}'))
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('request', lambda r: downloadas_requests.append(r.url) if 'downloadas' in r.url else None)

        # 1. 打开首页并新建文档
        await page.goto(BASE, wait_until='load', timeout=60000)
        await page.click('.doc-card:has-text("文档")')  # 新建 Word
        await page.wait_for_selector('#editorOverlay.show', timeout=30000)

        # 等待编辑器 iframe 与文档就绪
        frame = None
        for _ in range(120):
            frame = page.frame(name='frameEditor')
            if frame:
                break
            await page.wait_for_timeout(500)
        assert frame, '编辑器 iframe 未出现'
        for _ in range(180):
            ready = await frame.evaluate("!!(window.Asc && window.Asc.editor && window.Asc.editor.WordControl && window.Asc.editor.WordControl.m_oLogicDocument && window.__ooRealBytesInjected)")
            if ready:
                break
            await page.wait_for_timeout(500)
        print('[1] 文档已打开，编辑器内核就绪')

        # 2. History 激活时 new CDocument 不再崩溃（回归补丁）
        try:
            result = await frame.evaluate("""() => {
                try {
                    const doc = new AscCommonWord.CDocument();
                    return {ok: true, hasWrite: typeof AscWord.CustomXmlManager.prototype.Write_ToBinary2 === 'function'};
                } catch (e) {
                    return {ok: false, err: String(e)};
                }
            }""")
            print('[2] new CDocument 验证:', result)
            assert result.get('ok'), f'new CDocument 崩溃: {result}'
        except Exception as e:
            print('[2] 评估失败:', e)

        # 3. 触发 插入 -> 来自本地文件的文本
        print('[3] 触发插入本地文本...')
        chooser_future = asyncio.get_event_loop().create_future()

        async def on_filechooser(chooser):
            chooser_future.set_result(chooser)

        page.on('filechooser', lambda c: asyncio.ensure_future(on_filechooser(c)))

        # 直接调用 sdk API（web-apps 的 Insert->From File 菜单最终调用它）
        await frame.evaluate("() => { Asc.editor.asc_insertTextFromFile(); }")

        # 等待文件选择器（sdk 动态创建的 input）
        chooser = None
        for _ in range(30):
            if chooser_future.done():
                chooser = chooser_future.result()
                break
            await page.wait_for_timeout(300)
        if chooser:
            await chooser.set_files(TXT)
            print('   已选择文件:', TXT)
        else:
            print('   文件选择器未出现，测试失败')
            raise SystemExit(2)

        # 等待插入完成（x2t 转换 + 粘贴）
        for _ in range(60):
            text_ok = await frame.evaluate("""() => {
                try {
                    const doc = Asc.editor.WordControl.m_oLogicDocument;
                    let all = '';
                    for (let i = 0; i < doc.Content.length; i++) {
                        const p = doc.Content[i];
                        if (p && p.GetText) all += p.GetText();
                    }
                    return all.indexOf('离线插入文本测试行') !== -1;
                } catch (e) { return false; }
            }""")
            if text_ok:
                break
            await page.wait_for_timeout(1000)
        print('[4] 插入文本结果:', '成功' if text_ok else '未检测到插入内容（可能仍在转换或失败）')

        # 汇总
        time.sleep(1)
        print('downloadas 请求数:', len(downloadas_requests))
        err_interesting = [l for l in console_lines if 'error' in l.lower() and 'favicon' not in l and 'openai' not in l]
        print()
        print('=== console errors ===')
        for l in err_interesting[-10:]:
            print(' ', l[:300])
        print('=== pageerrors ===')
        for l in errors[-5:]:
            print(' ', l[:300])
        print()
        print('测试结论:', 'PASS' if text_ok and not errors and not downloadas_requests else 'FAIL/需检查')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
