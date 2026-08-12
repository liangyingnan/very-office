// very-office MCP 服务入口（stdio 传输）。
// 由 MCP 客户端（Claude Desktop / Kimi 等）以子进程方式拉起：
//   node F:/JsWorkSpace/very-office/mcp-server/src/index.js
// 环境变量：OO_PORT（静态服务端口，默认 0=随机）、OO_DOCS_DIR（文档工作目录）、
//           CHROME_PATH（浏览器路径）、OO_HEADLESS=0（调试时显示浏览器窗口）。
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools.js'
import { shutdown } from './runtime.js'

const server = new McpServer({
    name: 'very-office',
    version: '1.0.0'
})

registerTools(server)

await server.connect(new StdioServerTransport())
console.error('[very-office-mcp] MCP stdio 服务已启动（编辑器惰性初始化）')

for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, async () => {
        await shutdown()
        process.exit(0)
    })
}
process.on('exit', () => { /* 同步清理由浏览器子进程随父退出兜底 */ })
