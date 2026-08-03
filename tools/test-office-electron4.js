// 测 xlsx 和 pptx 新建+保存
'use strict'
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
let win = null
function log(...a) { console.log('[test4]', ...a) }
app.on('window-all-closed', () => app.quit())
app.whenReady().then(async () => {
    win = new BrowserWindow({ width: 1400, height: 900, webPreferences: { nodeIntegration: false, contextIsolation: true } })
    const errs = []
    win.webContents.on('console-message', (e, level, message) => { if (level >= 3) errs.push(message) })
    await win.loadURL('http://localhost:8000/office.html')
    for (const [idx, ext] of ['xlsx', 'pptx'].entries()) {
        await win.webContents.executeJavaScript(`document.querySelectorAll('.doc-card')[${idx + 1}].click(); true`)
        await sleep(18000)
        const toast1 = await win.webContents.executeJavaScript(`document.getElementById('toast').textContent`)
        await win.webContents.executeJavaScript(`document.getElementById('saveBtn').click(); true`)
        await sleep(12000)
        const toast2 = await win.webContents.executeJavaScript(`document.getElementById('toast').textContent`)
        const rec = await win.webContents.executeJavaScript(`(async () => { const r = (await idb.all()).find(x => x.fileType === '${ext}'); if (!r || !r.blob) return 'no'; const b = await r.blob.arrayBuffer(); return JSON.stringify({ size: b.byteLength, head: Array.from(new Uint8Array(b.slice(0,4))).map(x => String.fromCharCode(x)).join('') }) })()`)
        log(`${ext}: toast1=${JSON.stringify(toast1)} toast2=${JSON.stringify(toast2)} saved=${rec}`)
        await win.webContents.executeJavaScript(`closeEditor(true); true`)
        await sleep(1500)
    }
    log('errors:', errs.slice(0, 10))
    app.quit()
})
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
