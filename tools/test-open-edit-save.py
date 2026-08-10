# -*- coding: utf-8 -*-
"""核心场景：导入本地 docx → 内容正确渲染 → 编辑 → 保存 → 内容保留"""
import asyncio
import base64
import os
import sys
import zipfile
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.async_api import async_playwright

DOCX = r'F:\JsWorkSpace\very-office\tools\.probe-content.docx'
MARK = '离线打开测试内容ABC123'
EDIT_MARK = 'XYZ追加'


def ensure_fixture():
    """夹具自包含：生成一个带 fontTable（Calibri/Times New Roman/宋体）的测试 docx。"""
    if os.path.exists(DOCX):
        return
    ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>'
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
          '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/></Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    docrels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
               '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
               '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/></Relationships>')
    fonts = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
             '<w:font w:name="Calibri"/><w:font w:name="Times New Roman"/><w:font w:name="宋体"/></w:fonts>')
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
           '<w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="宋体"/></w:rPr>'
           '<w:t>离线打开测试内容ABC123</w:t></w:r></w:p>'
           '<w:p><w:r><w:t xml:space="preserve">second line 中文混排 456</w:t></w:r></w:p>'
           '</w:body></w:document>')
    with zipfile.ZipFile(DOCX, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', ct)
        z.writestr('_rels/.rels', rels)
        z.writestr('word/_rels/document.xml.rels', docrels)
        z.writestr('word/fontTable.xml', fonts)
        z.writestr('word/document.xml', doc)

GETTEXT = """() => {
    try {
        const doc = Asc.editor.WordControl.m_oLogicDocument;
        let all = '';
        for (let i = 0; i < doc.Content.length; i++) { const p = doc.Content[i]; if (p && p.GetText) all += p.GetText() + '|'; }
        return 'len=' + doc.Content.length + ' text=' + all.slice(0, 120);
    } catch (e) { return 'ERR ' + e; }
}"""

async def main():
    ensure_fixture()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda e: print('PAGEERROR:', str(e)[:200]))

        await page.goto('http://localhost:8000/office.html', wait_until='load', timeout=60000)
        # 通过隐藏的文件 input 导入本地 docx
        input_el = await page.query_selector('input[type=file]')
        await input_el.set_input_files(DOCX)

        frame = None
        for _ in range(240):
            frame = page.frame(name='frameEditor')
            if frame: break
            await page.wait_for_timeout(500)
        ok = False
        for i in range(90):
            try:
                t = await frame.evaluate(GETTEXT)
            except Exception:
                t = 'detached'
            if MARK in t:
                ok = True
                print(f'[1] 打开本地 docx 内容渲染: OK ({t}) at ~{i}s')
                break
            await page.wait_for_timeout(1000)
        if not ok:
            print('[1] 打开本地 docx 内容渲染: FAIL, last=', t)

        # 编辑：末尾追加文本
        await frame.evaluate("""() => {
            const doc = Asc.editor.WordControl.m_oLogicDocument;
            doc.MoveCursorToEndPos();
            Asc.editor.asc_enterText('XYZ追加');
        }""")
        await page.wait_for_timeout(2000)
        t2 = await frame.evaluate(GETTEXT)
        print('[2] 编辑后:', t2)

        # 保存，取 IDB blob 验证文本
        await page.evaluate("() => { document.getElementById('saveBtn').click(); }")
        await page.wait_for_timeout(15000)
        b64 = await page.evaluate("""() => new Promise((resolve) => {
            const req = indexedDB.open('very-office');
            req.onsuccess = () => {
                const db = req.result;
                const names = Array.from(db.objectStoreNames);
                const all = db.transaction(names[0], 'readonly').objectStore(names[0]).getAll();
                all.onsuccess = () => {
                    const rec = all.result[all.result.length - 1];
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(rec.blob);
                };
            };
        })""")
        data = base64.b64decode(b64)
        with open(r'F:\JsWorkSpace\very-office\tools\.probe-resaved.docx', 'wb') as f:
            f.write(data)
        xml = zipfile.ZipFile(r'F:\JsWorkSpace\very-office\tools\.probe-resaved.docx').read('word/document.xml').decode('utf-8', errors='replace')
        print('[3] 保存文件含原文本:', MARK in xml, ' 含追加文本:', EDIT_MARK in xml, ' docx bytes:', len(data))
        await browser.close()

asyncio.run(main())
