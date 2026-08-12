// HTTP 传输入口：Streamable HTTP MCP，供远程/多客户端连接。
//   node src/http.js
// 环境变量：
//   OO_MCP_PORT   监听端口（默认 3000）
//   OO_MCP_HOST   绑定地址（默认 127.0.0.1；绑定非回环地址时必须同时设置 OO_MCP_TOKEN）
//   OO_MCP_TOKEN  Bearer 令牌；设置后所有请求需带 Authorization: Bearer <token>
// 注意：所有 HTTP 会话共享同一个无头编辑器实例（单活动文档），并发编辑会互相覆盖。
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { registerTools } from './tools.js'
import { shutdown } from './runtime.js'

const MCP_PORT = Number(process.env.OO_MCP_PORT || 3000)
const MCP_HOST = process.env.OO_MCP_HOST || '127.0.0.1'
const MCP_TOKEN = process.env.OO_MCP_TOKEN || ''

const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(MCP_HOST)
if (!isLoopback && !MCP_TOKEN) {
    console.error('[very-office-mcp] 拒绝启动：绑定非回环地址必须设置 OO_MCP_TOKEN（Bearer 鉴权），否则文档目录与 office_execute 将对整个网络开放')
    process.exit(1)
}

const transports = new Map()   // sessionId -> transport

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
            catch (e) { reject(new Error('请求体不是合法 JSON')) }
        })
        req.on('error', reject)
    })
}

const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname !== '/mcp') {
        res.writeHead(404).end('Not Found')
        return
    }
    if (MCP_TOKEN && req.headers.authorization !== `Bearer ${MCP_TOKEN}`) {
        res.writeHead(401).end('Unauthorized')
        return
    }
    try {
        if (req.method === 'POST') {
            const body = await readJsonBody(req)
            const sessionId = req.headers['mcp-session-id']
            let transport = sessionId ? transports.get(sessionId) : undefined
            if (!transport) {
                if (sessionId) {
                    // 有 sessionId 但不认识：会话已过期
                    res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({
                        jsonrpc: '2.0',
                        error: { code: -32000, message: '会话不存在或已过期，请重新 initialize' },
                        id: null
                    }))
                    return
                }
                // 新会话（initialize 请求）
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (sid) => transports.set(sid, transport),
                    onsessionclosed: (sid) => transports.delete(sid)
                })
                transport.onclose = () => {
                    if (transport.sessionId) transports.delete(transport.sessionId)
                }
                const mcpServer = new McpServer({ name: 'very-office', version: '1.0.0' })
                registerTools(mcpServer)
                await mcpServer.connect(transport)
            }
            await transport.handleRequest(req, res, body)
            return
        }
        if (req.method === 'GET' || req.method === 'DELETE') {
            const sessionId = req.headers['mcp-session-id']
            const transport = sessionId ? transports.get(sessionId) : undefined
            if (!transport) {
                res.writeHead(400).end('Bad Request: 无效或缺失 mcp-session-id')
                return
            }
            await transport.handleRequest(req, res)
            return
        }
        res.writeHead(405).end('Method Not Allowed')
    } catch (e) {
        console.error('[very-office-mcp] 请求处理失败:', (e && e.message) || e)
        if (!res.headersSent) res.writeHead(500).end('Internal Server Error')
    }
})

httpServer.listen(MCP_PORT, MCP_HOST, () => {
    console.error(`[very-office-mcp] HTTP MCP 已启动: http://${MCP_HOST}:${MCP_PORT}/mcp` +
        (MCP_TOKEN ? '（Bearer 鉴权）' : '（仅回环，无鉴权）'))
})

for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, async () => {
        httpServer.close()
        await shutdown()
        process.exit(0)
    })
}
