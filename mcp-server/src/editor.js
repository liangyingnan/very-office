// 编辑器会话封装：Node 侧对 host.html window.__oo 的调用 + 文档工作目录管理。
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from './static-server.js'

const BLANK_DOCX = path.join(REPO_ROOT, 'blank', 'blank.docx')

// 文档工作目录（OO_DOCS_DIR 可覆盖）
export const DOCS_DIR = process.env.OO_DOCS_DIR
    ? path.resolve(process.env.OO_DOCS_DIR)
    : path.join(REPO_ROOT, 'mcp-server', 'documents')

// 文件名净化：只允许 <name>.docx，杜绝路径穿越
export function sanitizeDocName(name) {
    const base = String(name || '').trim().replace(/\.docx$/i, '')
    if (!base || !/^[\w一-龥（）()\- ]+$/u.test(base)) {
        throw new Error(`非法文档名: ${name}（只允许中英文、数字、_ - 空格 和括号）`)
    }
    return base + '.docx'
}

// 解析目标目录：调用者传了 dir（绝对/相对路径均可）就用它，否则用默认工作目录
export function resolveDocsDir(dir) {
    if (dir === undefined || dir === null || String(dir).trim() === '') return DOCS_DIR
    return path.resolve(String(dir))
}

export function docPath(name, dir) {
    return path.join(resolveDocsDir(dir), sanitizeDocName(name))
}

export class EditorSession {
    constructor(page) {
        this.page = page
        this.current = null   // 当前打开文档的绝对路径
    }

    async status() {
        return this.page.evaluate(() => window.__oo.status())
    }

    // 打开磁盘上的 docx（bytes → host → x2t → 编辑器）
    async openFile(absPath) {
        const bytes = await fs.readFile(absPath)
        await this.page.evaluate(
            ({ b64, title }) => window.__oo.open(b64, title, 'docx'),
            { b64: bytes.toString('base64'), title: path.basename(absPath) })
        this.current = absPath
        return { path: absPath, bytes: bytes.length }
    }

    // 以空白模板新建（不落盘；create_document 工具会先复制模板再 openFile）
    async openBlank(title) {
        const bytes = await fs.readFile(BLANK_DOCX)
        await this.page.evaluate(
            ({ b64, title: t }) => window.__oo.open(b64, t, 'docx'),
            { b64: bytes.toString('base64'), title })
        this.current = null
    }

    // 保存当前编辑内容到 absPath（默认 docx；format 可指定 odt/txt/pdf 等 x2t 支持的输出）
    async saveToFile(absPath, format = 'docx') {
        const result = await this.page.evaluate((fmt) => window.__oo.save(fmt), format)
        const bytes = Buffer.from(result.base64, 'base64')
        await fs.mkdir(path.dirname(absPath), { recursive: true })
        await fs.writeFile(absPath, bytes)
        this.current = absPath
        return { path: absPath, bytes: bytes.length, fileName: result.fileName }
    }

    // 通用 Office API 执行：code 为函数体，作用域内有 Api / ThisDocument / Asc.scope(=params)
    async execute(code, params) {
        const fnText = `(function(){ ${code} })`
        return this.page.evaluate(
            ({ fn, p }) => window.__oo.exec(fn, p),
            { fn: fnText, p: params === undefined ? {} : params })
    }

    // 读取全文：format = 'markdown'（默认，保留结构）| 'text'（纯文本）
    async getText(format = 'markdown') {
        if (format === 'text') {
            return this.execute(`
                var oRange = Api.GetDocument().GetRange();
                return oRange ? String(oRange.GetText()) : '';
            `)
        }
        return this.execute(`return String(Api.GetDocument().ToMarkdown());`)
    }

    // 插入文本：position = 'end'（默认，新段落追加到文末）| 'cursor'（光标处）
    async insertText(text, position = 'end') {
        return this.execute(`
            var oDoc = Api.GetDocument();
            var text = Asc.scope.text;
            if (Asc.scope.position === 'cursor') {
                oDoc.EnterText(text);
                return true;
            }
            var lines = String(text).split(/\\r?\\n/);
            for (var i = 0; i < lines.length; i++) {
                var oP = Api.CreateParagraph();
                oP.AddText(lines[i]);
                oDoc.Push(oP);
            }
            return true;
        `, { text: String(text), position })
    }

    // 全文查找替换；返回是否找到并替换
    async replaceText(find, replace, matchCase = true) {
        return this.execute(`
            return Api.GetDocument().SearchAndReplace({
                searchString: Asc.scope.find,
                replaceString: Asc.scope.replace,
                matchCase: Asc.scope.matchCase
            });
        `, { find: String(find), replace: String(replace), matchCase: !!matchCase })
    }
}
