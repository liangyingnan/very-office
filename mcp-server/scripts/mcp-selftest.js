// MCP 协议层自测：以 stdio 拉起真实 MCP 服务进程，走 JSON-RPC 调用全部工具。
// 用法：node scripts/mcp-selftest.js
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NAME = 'mcp-selftest-协议验证'

let failures = 0
function check(label, cond, extra = '') {
    if (cond) console.log(`  [OK] ${label}${extra ? '  ' + extra : ''}`)
    else { failures++; console.error(`  [FAIL] ${label}${extra ? '  ' + extra : ''}`) }
}

function textOf(result) {
    return (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n')
}

async function main() {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [path.join(ROOT, 'src', 'index.js')],
        env: { ...process.env },
        stderr: 'pipe'
    })
    transport.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`))

    const client = new Client({ name: 'mcp-selftest', version: '1.0.0' })
    await client.connect(transport)
    console.log('[1] MCP 握手成功')

    const tools = await client.listTools()
    const names = tools.tools.map(t => t.name)
    console.log('     工具列表:', names.join(', '))
    for (const t of ['create_document', 'open_document', 'list_documents', 'delete_document',
        'save_document', 'get_document_text', 'insert_text', 'replace_text', 'office_execute']) {
        check(`工具 ${t} 已注册`, names.includes(t))
    }

    console.log('[2] create_document...')
    let r = await client.callTool({ name: 'create_document', arguments: { name: NAME } })
    check('创建成功', !r.isError && textOf(r).includes('已创建'), textOf(r).slice(0, 80))

    console.log('[3] insert_text + get_document_text...')
    r = await client.callTool({ name: 'insert_text', arguments: { text: '协议层验证文本QWE789' } })
    check('插入成功', !r.isError, textOf(r).slice(0, 60))
    r = await client.callTool({ name: 'get_document_text', arguments: { format: 'text' } })
    check('读取含插入文本', !r.isError && textOf(r).includes('协议层验证文本QWE789'))

    console.log('[4] office_execute（经协议）...')
    r = await client.callTool({
        name: 'office_execute',
        arguments: {
            code: 'var oP = Api.CreateParagraph(); oP.AddText(Asc.scope.tail); Api.GetDocument().Push(oP); return ThisDocument.GetRange().GetText().length > 0;',
            params: { tail: '协议追加段落' }
        }
    })
    check('exec 返回 true', !r.isError && textOf(r).includes('true'), textOf(r).slice(0, 60))

    console.log('[5] save_document + list_documents...')
    r = await client.callTool({ name: 'save_document', arguments: {} })
    check('保存成功', !r.isError && textOf(r).includes('已保存'), textOf(r).slice(0, 80))
    r = await client.callTool({ name: 'list_documents', arguments: {} })
    check('列表包含新文档', !r.isError && textOf(r).includes(NAME))

    console.log('[6] open_document（重开）+ delete_document...')
    r = await client.callTool({ name: 'open_document', arguments: { name: NAME } })
    check('重开成功', !r.isError, textOf(r).slice(0, 60))
    r = await client.callTool({ name: 'get_document_text', arguments: { format: 'text' } })
    check('重开后内容保留', !r.isError && textOf(r).includes('协议层验证文本QWE789'))
    r = await client.callTool({ name: 'delete_document', arguments: { name: NAME } })
    check('删除成功', !r.isError && textOf(r).includes('已删除'), textOf(r).slice(0, 80))

    await client.close()
    if (failures) { console.error(`\nSELFTEST FAIL: ${failures} 项未通过`); process.exit(1) }
    console.log('\nSELFTEST PASS')
    process.exit(0)
}

main().catch((e) => {
    console.error('SELFTEST ERROR:', e && e.stack || e)
    process.exit(1)
})
