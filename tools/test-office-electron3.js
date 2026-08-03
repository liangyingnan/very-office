// Electron 自动化 3：闭环测试——打开 → 编辑 → 保存 → 再打开（模拟用户场景）
'use strict'
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const URL = 'http://localhost:8000/office.html'
const results = { console: [], errors: [] }
let win = null
function log(...a) { console.log('[test3]', ...a) }
app.on('window-all-closed', () => app.quit())

app.whenReady().then(async () => {
    win = new BrowserWindow({
        width: 1400, height: 900,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    })
    win.webContents.on('console-message', (e, level, message, line, sourceId) => {
        if (level >= 2) results.console.push(`[L${level}] ${message} (${sourceId}:${line})`)
    })

    await win.loadURL(URL)
    log('loaded')

    // 1) 新建 docx（blank 模板）
    await win.webContents.executeJavaScript(`document.querySelector('.doc-card').click(); true`)
    await sleep(20000)

    // 2) 保存（无编辑）
    await win.webContents.executeJavaScript(`document.getElementById('saveBtn').click(); true`)
    await sleep(12000)
    log('toast after save1:', JSON.stringify(await win.webContents.executeJavaScript(`document.getElementById('toast').textContent`)))

    // 3) 关闭编辑器
    await win.webContents.executeJavaScript(`closeEditor(true); true`)
    await sleep(2000)
    log('closed editor')

    // 4) 从 IndexedDB 取保存的字节，检查头部
    const info = await win.webContents.executeJavaScript(`(async () => {
        const recs = await idb.all()
        const r = recs[0]
        if (!r || !r.blob) return 'no record'
        const b = await r.blob.arrayBuffer()
        const head = new Uint8Array(b.slice(0, 32))
        return JSON.stringify({ name: r.name, size: b.byteLength, head: Array.from(head).map(x => String.fromCharCode(x)).join('') })
    })()`)
    log('saved record:', info)

    // 5) 重新打开最近文件（走 convertToBin 链路）
    await win.webContents.executeJavaScript(`(async () => {
        const recs = await idb.all()
        openRecent(recs[0].id)
    })()`)
    await sleep(20000)

    const toast2 = await win.webContents.executeJavaScript(`document.getElementById('toast').textContent`)
    log('toast after reopen:', JSON.stringify(toast2))

    // 编辑器状态
    const frameState = await win.webContents.executeJavaScript(`(() => {
        const f = document.querySelector('#editorFrameBox iframe')
        if (!f) return 'no frame'
        const w = f.contentWindow
        try {
            const inner = w.document.querySelector('iframe[name="frameEditor"]') || w.document.querySelector('#editor iframe')
            if (!inner) return 'no inner frame'
            const iw = inner.contentWindow
            return JSON.stringify({ canvas: !!iw.document.querySelector('canvas'), asc: !!(iw.Asc && iw.Asc.editor) })
        } catch (e) { return 'err: ' + e.message }
    })()`)
    log('reopened frame state:', frameState)

    // 6) 再保存一次（编辑后的文档再保存 → 再打开）
    await sleep(3000)
    await win.webContents.executeJavaScript(`document.getElementById('saveBtn').click(); true`)
    await sleep(15000)
    log('toast after save2:', JSON.stringify(await win.webContents.executeJavaScript(`document.getElementById('toast').textContent`)))

    log('=== console (level>=2) ===')
    results.console.slice(0, 30).forEach(l => log(l))
    log('=== errors ===')
    results.errors.forEach(l => log(l))
    try {
        const img = await win.webContents.capturePage()
        fs.writeFileSync(path.join(__dirname, 'test3-screenshot.png'), img.toPNG())
    } catch (e) {}
    app.quit()
})

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
