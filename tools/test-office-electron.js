// Electron 自动化：复现 office.html 打开 word 的报错
// 用法: electron test-office-electron.js
'use strict'
const { app, BrowserWindow } = require('electron')
const path = require('path')

const URL = 'http://localhost:8000/office.html'
const results = { console: [], errors: [], frames: {} }
let win = null

function log(...a) { console.log('[test]', ...a) }

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
    log('office.html loaded')

    // 1) 新建 Word 文档
    await win.webContents.executeJavaScript(`document.querySelector('.doc-card').click(); true`)
    log('clicked create docx')

    // 2) 等待编辑器 iframe 出现
    await waitFor(() => win.webContents.executeJavaScript(
        `!!document.querySelector('#editorFrameBox iframe') && !!document.querySelector('#editorOverlay.show')`), 30000)
    log('editor iframe attached')

    // 3) 等待 onlyoffice.html 就绪并收到 config（等编辑器内容出现）
    await sleep(15000)

    // 4) 检查编辑器 iframe 状态
    const frameInfo = await win.webContents.executeJavaScript(`(() => {
        const f = document.querySelector('#editorFrameBox iframe')
        if (!f) return 'no frame'
        const w = f.contentWindow
        let editorState = 'unknown'
        try {
            editorState = w.Asc ? (w.Asc.editor ? 'Asc.editor ready' : 'Asc loaded no editor') : 'no Asc'
        } catch(e) { editorState = 'err: ' + e.message }
        return JSON.stringify({ src: f.src, editorState, ready: !!w.document.querySelector('canvas') })
    })()`)
    log('frame info:', frameInfo)

    // 5) 页面上的 toast（可能包含报错）
    const toast = await win.webContents.executeJavaScript(`document.getElementById('toast').textContent`)
    log('toast:', JSON.stringify(toast))

    // 6) 尝试保存
    try {
        await win.webContents.executeJavaScript(`document.getElementById('saveBtn').click(); true`)
        await sleep(8000)
        const toast2 = await win.webContents.executeJavaScript(`document.getElementById('toast').textContent`)
        log('toast after save:', JSON.stringify(toast2))
    } catch (e) { log('save click failed', e.message) }

    log('=== console (level>=2) ===')
    results.console.slice(0, 40).forEach(l => log(l))
    log('=== errors ===')
    results.errors.forEach(l => log(l))

    // 截图
    try {
        const img = await win.webContents.capturePage()
        require('fs').writeFileSync(path.join(__dirname, 'test-screenshot.png'), img.toPNG())
        log('screenshot saved')
    } catch (e) { log('screenshot failed', e.message) }

    app.quit()
})

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function waitFor(fn, timeout) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
        try { if (await fn()) return true } catch (e) {}
        await sleep(500)
    }
    throw new Error('waitFor timeout')
}
