// HTTP 传输自测：拉起 src/http.js（带 Bearer 令牌），走 Streamable HTTP 调用工具。
// 用法：node scripts/http-selftest.js
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 39393
const TOKEN = 'selftest-token-123'
const BASE = `http://127.0.0.1:${PORT}/mcp`
const NAME = 'http-selftest-验证'

let failures = 0
function check(label, cond, extra = '') {
    if (cond) console.log(`  [OK] ${label}${extra ? '  ' + extra : ''}`)
    else { failures++; console.error(`  [FAIL] ${label}${extra ? '  ' + extra : ''}`) }
}

function textOf(result) {
    return (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n')
}

async function main() {
    console.log('[1] 启动 HTTP MCP 服务子进程...')
    const child = spawn(process.execPath, [path.join(ROOT, 'src', 'http.js')], {
        env: { ...process.env, OO_MCP_PORT: String(PORT), OO_MCP_TOKEN: TOKEN },
        stdio: ['ignore', 'pipe', 'pipe']
    })
    child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`))
    // 等端口就绪
    let up = false
    for (let i = 0; i < 60 && !up; i++) {
        try { await fetch(BASE, { method: 'GET' }); up = true } catch { await new Promise(r => setTimeout(r, 500)) }
    }
    if (!up) throw new Error('HTTP 服务未在预期时间内就绪')

    console.log('[2] 无令牌请求应被拒绝...')
    const noAuth = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    check('无令牌返回 401', noAuth.status === 401, `status=${noAuth.status}`)

    console.log('[3] 带令牌初始化并调用工具...')
    const transport = new StreamableHTTPClientTransport(new URL(BASE), {
        requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } }
    })
    const client = new Client({ name: 'http-selftest', version: '1.0.0' })
    await client.connect(transport)
    const tools = await client.listTools()
    check('握手 + 工具列表', tools.tools.length === 9, tools.tools.map(t => t.name).join(','))

    let r = await client.callTool({ name: 'create_document', arguments: { name: NAME } })
    check('create_document', !r.isError, textOf(r).slice(0, 60))
    r = await client.callTool({ name: 'insert_text', arguments: { text: 'HTTP通道验证文本HTTP789' } })
    check('insert_text', !r.isError)
    r = await client.callTool({ name: 'get_document_text', arguments: { format: 'text' } })
    check('get_document_text 含插入文本', !r.isError && textOf(r).includes('HTTP通道验证文本HTTP789'))
    r = await client.callTool({ name: 'office_execute', arguments: { code: 'return Api.GetDocument().GetRange().GetText().length > 0;' } })
    check('office_execute 返回 true', !r.isError && textOf(r).includes('true'))
    r = await client.callTool({ name: 'save_document', arguments: {} })
    check('save_document', !r.isError, textOf(r).slice(0, 60))
    r = await client.callTool({ name: 'delete_document', arguments: { name: NAME } })
    check('delete_document', !r.isError, textOf(r).slice(0, 60))

    await client.close()
    child.kill('SIGTERM')
    if (failures) { console.error(`\nHTTP SELFTEST FAIL: ${failures} 项未通过`); process.exit(1) }
    console.log('\nHTTP SELFTEST PASS')
    process.exit(0)
}

main().catch((e) => {
    console.error('HTTP SELFTEST ERROR:', e && e.stack || e)
    process.exit(1)
})
