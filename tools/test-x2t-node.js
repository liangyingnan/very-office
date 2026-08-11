// Node 环境实测 x2t 转换（复现 index out of bounds）
// 用法: node tools/test-x2t-node.js [docx|xlsx|pptx]
'use strict'
const fs = require('fs')
const path = require('path')

const X2T_DIR = path.join(__dirname, '../9.4.0.131/vendor/sdkjs/common/wasm/x2t')
process.chdir(X2T_DIR) // wasm 按相对路径从 cwd 加载

// ---- 模拟浏览器环境 ----
const fakeScript = { getAttribute: () => '/9.4.0.131/vendor/sdkjs/common/wasm/x2t/x2t.js' }
global.document = {
    currentScript: fakeScript,
    baseURI: 'http://localhost:8000/9.4.0/vendor/web-apps/apps/word/main/index.html',
    createElement: () => {
        const el = {}
        // 立即触发 onload，模拟脚本加载完成
        Object.defineProperty(el, 'src', { set(v) { setTimeout(() => el.onload && el.onload(), 0) } })
        return el
    },
    head: { appendChild: () => {} }
}
global.window = global
// fetchFonts：Node 里没有 sdk 注入的 shim，这里模拟浏览器中 shim 的行为（拉真实字体文件）
const FONT_DIR = path.join(__dirname, '../9.4.0.131/vendor/fonts')
global.AscCommon = global.AscCommon || {}
global.AscCommon.fetchFonts = (cb) => {
    // 简化：只拉 DejaVu 系列（x2t 需要的核心字体），浏览器里 shim 会拉全部
    const wanted = fs.readdirSync(FONT_DIR).filter(f => /^DejaVuSans/.test(f)).slice(0, 6)
    const out = []
    for (const f of wanted) {
        const bin = fs.readFileSync(path.join(FONT_DIR, f))
        // 模拟 shim 的 XOR 解密（16 字节密钥循环）
        const key = [160, 102, 214, 32, 20, 150, 71, 250, 149, 105, 184, 80, 176, 65, 73, 72]
        const dec = Buffer.from(bin)
        for (let i = 0; i < dec.length; i++) dec[i] ^= key[i % 16]
        out.push({ fileName: f, binary: new Uint8Array(dec) })
    }
    cb(out)
}

// ---- 加载 x2t.js（Emscripten 产物，直接执行） ----
const x2tJs = fs.readFileSync(path.join(X2T_DIR, 'x2t.js'), 'utf8')
// 用 new Function 提供 require 上下文（x2t.js 的 Node 分支 require('fs')）
// 末尾把局部 Module 挂到 globalThis
// eslint-disable-next-line no-new-func
new Function('require', 'module', '__filename', '__dirname', x2tJs + '\n;globalThis.__x2tModule = Module;')(require, module, __filename, X2T_DIR)
if (!global.__x2tModule) { console.error('x2t.js 未产生 Module'); process.exit(1) }
global.Module = global.__x2tModule

// ---- 加载 x2t_helper.js ----
global.window.AscCommon = global.AscCommon
const helperJs = fs.readFileSync(path.join(X2T_DIR, 'x2t_helper.js'), 'utf8')
// eslint-disable-next-line no-new-func
new Function(helperJs)()

const x2t = global.AscCommon.x2t

// ---- 测试 ----
async function main() {
    const ext = (process.argv[2] || 'docx').replace(/^\./, '')
    const custom = process.env.TEST_FILE
const src = custom || path.join(__dirname, `../blank/blank.${ext}`)
    const bytes = new Uint8Array(fs.readFileSync(src))

    console.log(`[1] 加载 wasm...`)
    await x2t.initialize()
    console.log(`[1] wasm 初始化完成`)

    console.log(`[2] convertToBin: blank.${ext} (${bytes.length}B) -> bin`)
    const r1 = await x2t.convertToBin(bytes, 'test-doc', ext)
    const bin = r1.binary
    const sig = String.fromCharCode(bin[0], bin[1], bin[2], bin[3])
    console.log(`[2] OK bin=${bin.length}B sig=${sig} type=${r1.type} media=${Object.keys(r1.media).length}`)
    console.log('[2] bin-hex:', Buffer.from(bin).toString('hex').slice(0, 200))
    if (process.env.DUMP_BIN) require('fs').writeFileSync(process.env.DUMP_BIN, Buffer.from(bin))

    console.log(`[3] convertFromBin: bin -> ${ext}`)
    const r2 = await x2t.convertFromBin({ binary: bin, fileName: 'test-doc', fileExt: 'bin', targetExt: ext })
    const out = r2.binary
    const sig2 = String.fromCharCode(out[0], out[1], out[2])
    console.log(`[3] OK out=${out.length}B head=${sig2}`)

    console.log('ALL PASS')
    if (process.env.DUMP_OUT) require('fs').writeFileSync(process.env.DUMP_OUT, Buffer.from(out))
}
main().catch(e => {
    console.error('FAIL:', e && e.stack || e)
    process.exit(1)
})

// 附加：转完打印 bin 的 hex（前 64 字节）
