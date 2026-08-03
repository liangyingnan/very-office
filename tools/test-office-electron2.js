// Electron 自动化 2：导入真实复杂 docx（模拟 office.html 打开本地文件）
'use strict'
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const URL = 'http://localhost:8000/office.html'
const results = { console: [], errors: [] }
let win = null

function log(...a) { console.log('[test2]', ...a) }

app.on('window-all-closed', () => app.quit())

app.whenReady().then(async () => {
    win = new BrowserWindow({
        width: 1400, height: 900,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    })
    win.webContents.on('console-message', (e, level, message, line, sourceId) => {
        if (level >= 2) results.console.push(`[L${level}] ${message} (${sourceId}:${line})`)
    })
    win.webContents.on('render-process-gone', (e, details) => {
        results.errors.push('render-process-gone: ' + JSON.stringify(details))
    })

    await win.loadURL(URL)
    log('loaded')

    // 通过 fetch 拿文档字节，构造 File 走 importFile 打开
    const opened = await win.webContents.executeJavaScript(`(async () => {
        const resp = await fetch('/blank/__real.docx')
        const buf = await resp.arrayBuffer()
        const file = new File([buf], '深信服用户手册_V3.0.10.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        const record = await importFile(file)
        openEditor(record)
        return record.name
    })()`)
    log('imported:', opened)

    await sleep(25000)

    const toast = await win.webContents.executeJavaScript(`document.getElementById('toast').textContent`)
    log('toast:', JSON.stringify(toast))

    // 编辑器 iframe（onlyoffice.html 的 frameEditor 内层）状态
    const info = await win.webContents.executeJavaScript(`(() => {
        const f = document.querySelector('#editorFrameBox iframe')
        if (!f) return 'no frame'
        let w = f.contentWindow
        try {
            const inner = w.document.querySelector('iframe[name="frameEditor"]') || w.document.querySelector('#editor iframe')
            if (!inner) return 'no inner frame; outer asc=' + (!!w.Asc)
            const iw = inner.contentWindow
            return JSON.stringify({
                innerSrc: inner.src,
                innerAsc: !!(iw.Asc && iw.Asc.editor),
                innerCanvas: !!iw.document.querySelector('canvas'),
                innerReadyMsg: !!iw.document.querySelector('#id_viewer')
            })
        } catch (e) { return 'err: ' + e.message }
    })()`)
    log('frame:', info)

    // 保存
    try {
        await win.webContents.executeJavaScript(`document.getElementById('saveBtn').click(); true`)
        await sleep(15000)
        const toast2 = await win.webContents.executeJavaScript(`document.getElementById('toast').textContent`)
        log('toast after save:', JSON.stringify(toast2))
    } catch (e) { log('save failed', e.message) }

    // 最近文件里的字节是否有效（PK 头）
    const bytesOk = await win.webContents.executeJavaScript(`(async () => {
        const recs = await idb.all()
        const r = recs.find(x => x.name.includes('深信服'))
        if (!r || !r.blob) return 'no record'
        const b = await r.blob.arrayBuffer()
        const head = new Uint8Array(b.slice(0, 8))
        return JSON.stringify({ size: b.byteLength, head: Array.from(head).map(x => x.toString(16).padStart(2,'0')).join(' ') })
    })()`)
    log('saved bytes:', bytesOk)

    log('=== console (level>=2) ===')
    results.console.slice(0, 40).forEach(l => log(l))
    log('=== errors ===')
    results.errors.forEach(l => log(l))

    try {
        const img = await win.webContents.capturePage()
        fs.writeFileSync(path.join(__dirname, 'test2-screenshot.png'), img.toPNG())
        log('screenshot saved')
    } catch (e) {}

    app.quit()
})

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
