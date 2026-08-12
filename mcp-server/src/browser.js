// 无头浏览器管理：playwright-core + 系统 Chrome（不下载 Chromium）。
// 环境变量：CHROME_PATH（覆盖浏览器路径）、OO_HEADLESS=0（调试时显示窗口）。
import { existsSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean)

function findBrowser() {
    for (const p of CHROME_CANDIDATES) {
        if (existsSync(p)) return p
    }
    throw new Error('未找到系统 Chrome/Edge，请设置环境变量 CHROME_PATH 指向浏览器可执行文件')
}

// 启动浏览器并打开宿主页，等 window.__oo 就绪。返回 { browser, page }
export async function startBrowser(hostUrl) {
    const executablePath = findBrowser()
    const headless = process.env.OO_HEADLESS !== '0'
    const browser = await chromium.launch({
        executablePath,
        headless,
        args: ['--disable-dev-shm-usage', '--no-first-run', '--disable-extensions']
    })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.on('pageerror', (e) => console.error('[host pageerror]', String(e).slice(0, 300)))
    await page.goto(hostUrl, { waitUntil: 'load', timeout: 60000 })
    await page.waitForFunction(() => window.__oo && window.__oo.status().hostReady, null, { timeout: 60000 })
    return { browser, page }
}
