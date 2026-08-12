// MCP 工具注册：文本文档（word/docx）的新建/打开/读取/修改/保存/删除 + 通用 Office API 执行。
import { z } from 'zod'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ensureRuntime } from './runtime.js'
import { DOCS_DIR, docPath, sanitizeDocName } from './editor.js'
import { REPO_ROOT } from './static-server.js'

const BLANK_DOCX = path.join(REPO_ROOT, 'blank', 'blank.docx')

function ok(data) {
    return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] }
}

function fail(error) {
    return { content: [{ type: 'text', text: `错误: ${(error && error.message) || error}` }], isError: true }
}

async function currentTarget(session, name) {
    if (name) return docPath(name)
    if (session.current) return session.current
    throw new Error('未指定文档名，且当前没有已打开的磁盘文档（请先 save_document 指定名称保存一次）')
}

export function registerTools(server) {
    server.registerTool('create_document', {
        description: '新建一个空白 Word 文档（docx）并在编辑器中打开。name 不含扩展名；同名文件已存在则报错。',
        inputSchema: { name: z.string().describe('文档名（不含 .docx 扩展名）') }
    }, async ({ name }) => {
        try {
            const { session } = await ensureRuntime()
            const target = docPath(name)
            try { await fs.access(target); throw new Error(`文档已存在: ${sanitizeDocName(name)}`) } catch (e) {
                if (!e || e.code !== 'ENOENT') throw e
            }
            await fs.mkdir(DOCS_DIR, { recursive: true })
            await fs.copyFile(BLANK_DOCX, target)
            const info = await session.openFile(target)
            return ok(`已创建并打开 ${path.basename(target)}（${info.bytes} 字节）`)
        } catch (e) { return fail(e) }
    })

    server.registerTool('open_document', {
        description: '打开文档工作目录中已存在的 docx 文档进行编辑。',
        inputSchema: { name: z.string().describe('文档名（可带或不带 .docx）') }
    }, async ({ name }) => {
        try {
            const { session } = await ensureRuntime()
            const target = docPath(name)
            const info = await session.openFile(target)
            return ok(`已打开 ${path.basename(target)}（${info.bytes} 字节）`)
        } catch (e) { return fail(e) }
    })

    server.registerTool('list_documents', {
        description: '列出文档工作目录中的所有 docx 文档（名称、大小、修改时间）。',
        inputSchema: {}
    }, async () => {
        try {
            await ensureRuntime()
            const files = (await fs.readdir(DOCS_DIR)).filter(f => f.toLowerCase().endsWith('.docx'))
            const rows = []
            for (const f of files) {
                const st = await fs.stat(path.join(DOCS_DIR, f))
                rows.push({ name: f, bytes: st.size, modified: st.mtime.toISOString() })
            }
            return ok(rows.length ? rows : '（工作目录为空）')
        } catch (e) { return fail(e) }
    })

    server.registerTool('delete_document', {
        description: '删除文档工作目录中的 docx 文档。若该文档正在编辑器中打开，编辑器内的未保存内容将丢失。',
        inputSchema: { name: z.string().describe('文档名') }
    }, async ({ name }) => {
        try {
            const { session } = await ensureRuntime()
            const target = docPath(name)
            await fs.unlink(target)
            const wasOpen = session.current === target
            if (wasOpen) session.current = null
            return ok(`已删除 ${path.basename(target)}` + (wasOpen ? '（删除时它正处于打开状态）' : ''))
        } catch (e) { return fail(e) }
    })

    server.registerTool('save_document', {
        description: '把当前编辑器中的文档保存到文档工作目录。不传 name 时保存回当前文件；format 默认 docx，也可指定 odt/txt/html 等 x2t 支持的格式（此时按对应扩展名另存，且不改变当前编辑的文档）。',
        inputSchema: {
            name: z.string().optional().describe('目标文档名（不含扩展名）；省略则保存回当前文件'),
            format: z.string().optional().describe('输出格式，默认 docx')
        }
    }, async ({ name, format }) => {
        try {
            const { session } = await ensureRuntime()
            const fmt = (format || 'docx').toLowerCase()
            let target
            if (fmt === 'docx') {
                target = await currentTarget(session, name)
            } else {
                // 导出为其他格式：文件名按目标格式扩展名，且不改变当前文档指向
                if (!name && !session.current) throw new Error('未指定文档名，且当前没有已打开的磁盘文档')
                const base = name ? sanitizeDocName(name) : path.basename(session.current)
                target = path.join(DOCS_DIR, base.replace(/\.docx$/i, '.' + fmt))
            }
            const prevCurrent = session.current
            const info = await session.saveToFile(target, fmt)
            if (fmt !== 'docx') session.current = prevCurrent
            return ok(`已保存 ${path.basename(target)}（${info.bytes} 字节，格式 ${fmt}）`)
        } catch (e) { return fail(e) }
    })

    server.registerTool('get_document_text', {
        description: '读取当前打开文档的全部内容。format=markdown（默认，保留标题/表格等结构）或 text（纯文本）。',
        inputSchema: { format: z.enum(['markdown', 'text']).optional().describe('输出格式，默认 markdown') }
    }, async ({ format }) => {
        try {
            const { session } = await ensureRuntime()
            const text = await session.getText(format || 'markdown')
            return ok(text || '（文档为空）')
        } catch (e) { return fail(e) }
    })

    server.registerTool('insert_text', {
        description: '向当前文档插入文本。position=end（默认，作为新段落追加到文末，\\n 分段）或 cursor（光标处插入）。复杂排版请用 office_execute。',
        inputSchema: {
            text: z.string().describe('要插入的文本'),
            position: z.enum(['end', 'cursor']).optional().describe('插入位置，默认 end')
        }
    }, async ({ text, position }) => {
        try {
            const { session } = await ensureRuntime()
            await session.insertText(text, position || 'end')
            return ok('已插入')
        } catch (e) { return fail(e) }
    })

    server.registerTool('replace_text', {
        description: '在当前文档中全文查找并替换文本，返回是否成功替换。',
        inputSchema: {
            find: z.string().describe('要查找的文本'),
            replace: z.string().describe('替换为的文本'),
            matchCase: z.boolean().optional().describe('是否区分大小写，默认 true')
        }
    }, async ({ find, replace, matchCase }) => {
        try {
            const { session } = await ensureRuntime()
            const replaced = await session.replaceText(find, replace, matchCase !== false)
            return ok(replaced ? '已替换' : '未找到匹配文本')
        } catch (e) { return fail(e) }
    })

    server.registerTool('office_execute', {
        description: `在 ONLYOFFICE 编辑器内核中执行 Office API（文档构建 API）JavaScript 代码，可对当前文档做任意读写操作。
code 是一个 JS 函数体，运行作用域内可直接使用：
- Api：Office API 根对象（Api.GetDocument() / Api.CreateParagraph() / Api.CreateTable() 等）
- ThisDocument：当前 ApiDocument
- Asc.scope：等于传入的 params 对象
可用 return 返回一个可 JSON 序列化的值（原始类型/数组/普通对象）作为工具结果。
示例（插入一个 2x2 表格）：
  var oDoc = Api.GetDocument();
  var oTable = Api.CreateTable(2, 2);
  oTable.GetCell(0, 0).GetContent().GetElement(0).AddText('表头A');
  oDoc.Push(oTable);
  return true;
完整 API 参考：https://api.onlyoffice.com/office-api/text-document-api/`,
        inputSchema: {
            code: z.string().describe('JS 函数体（可使用 Api / ThisDocument / Asc.scope）'),
            params: z.record(z.any()).optional().describe('传给代码的参数对象，代码内通过 Asc.scope 访问')
        }
    }, async ({ code, params }) => {
        try {
            const { session } = await ensureRuntime()
            const result = await session.execute(code, params)
            return ok(result === null || result === undefined ? '（无返回值）' : result)
        } catch (e) { return fail(e) }
    })
}
