// 运行时单例：静态服务器 + 无头浏览器 + 编辑器会话，首个工具调用时惰性启动。
import { startStaticServer } from './static-server.js'
import { startBrowser } from './browser.js'
import { EditorSession, DOCS_DIR } from './editor.js'
import { promises as fs } from 'node:fs'

let runtimePromise = null

export function ensureRuntime() {
    if (!runtimePromise) runtimePromise = initRuntime()
    return runtimePromise
}

async function initRuntime() {
    await fs.mkdir(DOCS_DIR, { recursive: true })
    const port = Number(process.env.OO_PORT || 0)   // 0 = 随机端口
    const staticServer = await startStaticServer(port)
    const { browser, page } = await startBrowser(`${staticServer.url}/mcp-server/host.html`)
    const session = new EditorSession(page)
    console.error(`[very-office-mcp] 静态服务 ${staticServer.url}，浏览器已就绪`)
    return { staticServer, browser, page, session }
}

export async function shutdown() {
    if (!runtimePromise) return
    try {
        const rt = await runtimePromise
        await rt.browser.close()
        rt.staticServer.server.close()
    } catch (e) { /* 忽略退出清理错误 */ }
    runtimePromise = null
}
