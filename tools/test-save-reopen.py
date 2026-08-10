# -*- coding: utf-8 -*-
"""回归验证：插入文本后保存 -> 重新打开保存的文件，确认内容完整、无崩溃。"""
import asyncio
import sys
from playwright.async_api import async_playwright

TXT = r'F:\JsWorkSpace\very-office\tools\insert-test.txt'

async def main():
    errors = []
    downloadas = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('request', lambda r: downloadas.append(r.url) if 'downloadas' in r.url else None)

        # 1. 新建文档
        await page.goto('http://localhost:8000/office.html', wait_until='load', timeout=60000)
        await page.click('.doc-card:has-text("文档")')
        frame = None
        for _ in range(120):
            frame = page.frame(name='frameEditor')
            if frame:
                break
            await page.wait_for_timeout(500)
        for _ in range(180):
            ready = await frame.evaluate("!!(window.Asc && window.Asc.editor && window.Asc.editor.WordControl && window.Asc.editor.WordControl.m_oLogicDocument && window.__ooRealBytesInjected)")
            if ready:
                break
            await page.wait_for_timeout(500)

        # 2. 插入 txt
        chooser_future = asyncio.get_event_loop().create_future()
        async def on_filechooser(c):
            chooser_future.set_result(c)
        page.on('filechooser', lambda c: asyncio.ensure_future(on_filechooser(c)))
        await frame.evaluate("() => { Asc.editor.asc_insertTextFromFile(); }")
        chooser = None
        for _ in range(30):
            if chooser_future.done():
                chooser = chooser_future.result()
                break
            await page.wait_for_timeout(300)
        if chooser:
            await chooser.set_files(TXT)
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
        print('[1] 插入文本:', 'OK' if text_ok else 'FAIL')

        # 3. 保存（office.html 的保存按钮 -> onlyoffice-save -> asc_nativeGetFile3 -> x2t 转 docx）
        saved = await page.evaluate("""() => new Promise((resolve) => {
            const btn = document.getElementById('saveBtn');
            const orig = btn.disabled;
            btn.click();
            // 监听保存结果：toast 或按钮状态恢复
            const t0 = Date.now();
            const iv = setInterval(() => {
                if (document.getElementById('saveBtn').disabled === false && Date.now() - t0 > 3000) {
                    clearInterval(iv);
                    resolve(true);
                }
                if (Date.now() - t0 > 60000) { clearInterval(iv); resolve(false); }
            }, 500);
        })""")
        print('[2] 保存:', 'OK' if saved else 'FAIL/超时')

        # 4. 关闭编辑器，从最近文件重新打开
        await page.evaluate("closeEditor(true)")
        await page.wait_for_timeout(800)
        await page.click('.file-item:has-text("新建Word文档")')
        frame2 = None
        for _ in range(120):
            frame2 = page.frame(name='frameEditor')
            if frame2:
                break
            await page.wait_for_timeout(500)
        for _ in range(180):
            ready = await frame2.evaluate("!!(window.Asc && window.Asc.editor && window.Asc.editor.WordControl && window.Asc.editor.WordControl.m_oLogicDocument && window.__ooRealBytesInjected)")
            if ready:
                break
            await page.wait_for_timeout(500)
        # 等待真实字节注入完成
        retext_ok = False
        for _ in range(60):
            retext_ok = await frame2.evaluate("""() => {
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
            if retext_ok:
                break
            await page.wait_for_timeout(1000)
        print('[3] 重新打开后内容完整:', 'OK' if retext_ok else 'FAIL')

        print('downloadas 请求:', len(downloadas))
        print('pageerrors:', errors[-5:] if errors else '无')
        print('结论:', 'PASS' if text_ok and saved and retext_ok and not errors and not downloadas else 'FAIL/需检查')
        await browser.close()

asyncio.run(main())
