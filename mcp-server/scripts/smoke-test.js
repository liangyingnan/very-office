// 全链路冒烟测试（不走 MCP 协议，直接驱动 editor 层）：
// 新建 → insert_text → get_text 断言 → office_execute（建表+返回值）→ replace_text
// → save → adm-zip 校验 docx 内容 → 重开校验（x2t 往返）→ delete
// 用法：node scripts/smoke-test.js
import { promises as fs } from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { ensureRuntime, shutdown } from '../src/runtime.js'
import { DOCS_DIR, docPath } from '../src/editor.js'
import { REPO_ROOT } from '../src/static-server.js'

const NAME = 'mcp-smoke-测试文档'
const MARK1 = '冒烟测试第一段ABC123'
const MARK2 = 'XYZ替换后'
const TABLE_HEAD = '冒烟表头Q'

let failures = 0
function check(label, cond, extra = '') {
    if (cond) console.log(`  [OK] ${label}${extra ? '  ' + extra : ''}`)
    else { failures++; console.error(`  [FAIL] ${label}${extra ? '  ' + extra : ''}`) }
}

async function main() {
    console.log('[1] 启动运行时（静态服务 + 无头 Chrome + 编辑器）...')
    const { session } = await ensureRuntime()
    const status = await session.status()
    check('宿主页就绪', status.hostReady === true)
    console.log('     status =', JSON.stringify(status))

    console.log('[2] 新建文档（复制 blank.docx → documents/，打开）...')
    const target = docPath(NAME)
    await fs.rm(target, { force: true })
    await fs.copyFile(path.join(REPO_ROOT, 'blank', 'blank.docx'), target)
    const openInfo = await session.openFile(target)
    check('打开空白模板', openInfo.bytes > 0, `${openInfo.bytes} 字节`)

    console.log('[3] insert_text 插入文本...')
    await session.insertText(MARK1)
    await session.insertText('第二行\n第三行')

    console.log('[4] get_document_text 断言...')
    const md = await session.getText('markdown')
    const plain = await session.getText('text')
    check('markdown 含插入文本', typeof md === 'string' && md.includes(MARK1))
    check('text 含多行', typeof plain === 'string' && plain.includes('第二行') && plain.includes('第三行'))

    console.log('[5] office_execute：建 2x2 表并返回值...')
    const execResult = await session.execute(`
        var oDoc = Api.GetDocument();
        var oTable = Api.CreateTable(2, 2);
        oTable.GetCell(0, 0).GetContent().GetElement(0).AddText('${TABLE_HEAD}');
        oDoc.Push(oTable);
        return { rows: 2, text: ThisDocument.GetRange().GetText().length > 0 };
    `)
    check('exec 返回对象', execResult && execResult.rows === 2 && execResult.text === true, JSON.stringify(execResult))

    console.log('[6] replace_text...')
    const replaced = await session.replaceText(MARK1, MARK2)
    check('替换成功', replaced === true)
    const afterReplace = await session.getText('text')
    check('替换生效且旧文本消失', afterReplace.includes(MARK2) && !afterReplace.includes(MARK1))

    console.log('[7] save_document（docx）...')
    const saveInfo = await session.saveToFile(target, 'docx')
    check('保存写盘', saveInfo.bytes > 0, `${saveInfo.bytes} 字节`)

    console.log('[8] 用 adm-zip 独立校验 docx 内容...')
    const zip = new AdmZip(target)
    const docXml = zip.readAsText('word/document.xml')
    check('document.xml 含替换后文本', docXml.includes(MARK2))
    check('document.xml 含表头文本', docXml.includes(TABLE_HEAD))

    console.log('[9] 重新打开保存后的文件（x2t 往返）并校验...')
    await session.openFile(target)
    const reopened = await session.getText('text')
    check('重开后内容保留', reopened.includes(MARK2) && reopened.includes(TABLE_HEAD))

    console.log('[10] 删除文档...')
    await fs.unlink(target)
    let exists = true
    try { await fs.access(target) } catch { exists = false }
    check('文件已删除', !exists)

    await shutdown()
    if (failures) { console.error(`\nSMOKE FAIL: ${failures} 项未通过`); process.exit(1) }
    console.log('\nSMOKE PASS')
    process.exit(0)
}

main().catch(async (e) => {
    console.error('SMOKE ERROR:', e && e.stack || e)
    await shutdown()
    process.exit(1)
})
