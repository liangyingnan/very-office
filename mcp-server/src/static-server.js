// 内嵌静态服务器：服务 very-office 仓库根（仅 127.0.0.1）。
// wasm/Worker/fetch 要求 http(s)，file:// 不可用，因此 MCP 服务自带一个零依赖静态服务。
import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.bin': 'application/octet-stream',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.map': 'application/json; charset=utf-8'
}

// 启动静态服务；port=0 时随机端口。返回 { server, port, url }
export async function startStaticServer(port = 0) {
    const server = http.createServer(async (req, res) => {
        try {
            let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
            if (urlPath.endsWith('/')) urlPath += 'index.html'
            const filePath = path.resolve(REPO_ROOT, '.' + urlPath)
            // 防路径穿越
            if (filePath !== REPO_ROOT && !filePath.startsWith(REPO_ROOT + path.sep)) {
                res.writeHead(403).end('Forbidden')
                return
            }
            const data = await fs.readFile(filePath)
            res.writeHead(200, {
                'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
                'Cache-Control': 'no-cache'
            })
            res.end(data)
        } catch (e) {
            res.writeHead(e && e.code === 'ENOENT' ? 404 : 500).end('Not Found')
        }
    })
    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '127.0.0.1', resolve)
    })
    const actualPort = server.address().port
    return { server, port: actualPort, url: `http://127.0.0.1:${actualPort}` }
}

export { REPO_ROOT }
