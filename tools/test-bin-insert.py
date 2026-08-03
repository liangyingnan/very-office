# -*- coding: utf-8 -*-
"""验证用户场景：打开 .bin(SER) 文档后，插入->来自本地文件的文本 功能可用。"""
import asyncio
import base64
import os
from playwright.async_api import async_playwright

TXT = r'F:\JsWorkSpace\very-office\tools\insert-test.txt'
BIN = r'F:\JsWorkSpace\very-office\tools\test-doc.bin'


async def wait_frame(page):
    frame = None
    for _ in range(120):
        frame = page.frame(name='frameEditor')
        if frame:
            break
        await page.wait_for_timeout(500)
    assert frame, '编辑器 iframe 未出现'
    for _ in range(180):
        ready = await frame.evaluate("!!(window.Asc && window.Asc.editor && window.Asc.editor.WordControl && window.Asc.editor.WordControl.m_oLogicDocument)")
        if ready:
            break
        await page.wait_for_timeout(500)
    return frame


async def doc_text(frame):
    return await frame.evaluate("""() => {
        try {
            const doc = Asc.editor.WordControl.m_oLogicDocument;
            let all = '';
            for (let i = 0; i < doc.Content.length; i++) {
                const p = doc.Content[i];
                if (p && p.GetText) all += p.GetText();
            }
            return all;
        } catch (e) { return ''; }
    }""") or ''


async def main():
    with open(TXT, 'w', encoding='utf-8') as f:
        f.write('投标文件插入测试：来自本地文件的文本\n第二行内容验证')

    errors = []
    downloadas = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('request', lambda r: downloadas.append(r.url) if 'downloadas' in r.url else None)

        # 第一步：新建文档并导出 SER bin（模拟用户手上的 .bin 文件）
        await page.goto('http://localhost:8000/office.html', wait_until='load', timeout=60000)
        await page.click('.doc-card:has-text("文档")')
        frame = await wait_frame(page)
        # 输入一点内容让文档非空
        await frame.evaluate("""() => {
            Asc.editor.asc_PasteData(AscCommon.c_oAscClipboardDataFormat.Text, '初始内容', null, null, true);
        }""")
        await page.wait_for_timeout(1500)
        bin_b64 = await frame.evaluate("() => { const f = Asc.editor.asc_nativeGetFile3(); return f && f.data ? f.data : null; }")
        assert bin_b64, '无法获取 SER bin'
        with open(BIN, 'wb') as f:
            f.write(base64.b64decode(bin_b64))
        print('[0] 已生成测试 bin 文件:', os.path.getsize(BIN), 'bytes')

        # 第二步：关闭，用 bin 文件打开（模拟用户打开 .bin 文档）
        await page.evaluate("closeEditor(true)")
        await page.wait_for_timeout(800)
        await page.set_input_files('#fileInput', BIN)
        await page.wait_for_timeout(500)
        frame = await wait_frame(page)
        await page.wait_for_timeout(2000)
        t0 = await doc_text(frame)
        print('[1] bin 文档已打开，内容包含"初始内容":', '初始内容' in t0)

        # 第三步：插入->来自本地文件的文本
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
        else:
            print('[2] 文件选择器未出现 -> FAIL')
            raise SystemExit(2)

        ok = False
        for _ in range(60):
            t = await doc_text(frame)
            if '投标文件插入测试' in t:
                ok = True
                break
            await page.wait_for_timeout(1000)
        print('[2] 插入文本结果:', '成功' if ok else 'FAIL')
        if ok:
            print('    文档全文:', (await doc_text(frame)).replace('\n', ' | ')[:200])

        # 第四步：保存回归
        saved = await page.evaluate("""() => new Promise((resolve) => {
            document.getElementById('saveBtn').click();
            const t0 = Date.now();
            const iv = setInterval(() => {
                if (!document.getElementById('saveBtn').disabled && Date.now() - t0 > 3000) { clearInterval(iv); resolve(true); }
                if (Date.now() - t0 > 60000) { clearInterval(iv); resolve(false); }
            }, 500);
        })""")
        print('[3] 保存:', 'OK' if saved else 'FAIL/超时')

        print('downloadas 请求:', len(downloadas))
        print('pageerrors:', errors[-3:] if errors else '无')
        print('结论:', 'PASS' if ok and saved and not errors and not downloadas else 'FAIL/需检查')
        await browser.close()

asyncio.run(main())
