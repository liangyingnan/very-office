# very-office MCP 服务

把本仓库的离线 ONLYOFFICE 编辑器（9.4.0.131）封装成 **MCP 服务**，让大模型通过标准 MCP 协议
调用 **ONLYOFFICE 文本文档 API（Office API / Text Document API）**：新建、打开、读取、修改、
保存、删除 Word（docx）文档。全程本地离线，文件不离开本机。

## 原理

```
LLM (MCP client) ──stdio(JSON-RPC)──> mcp-server (Node)
   ├─ 内嵌静态服务器（node:http，仅 127.0.0.1，随机端口）服务仓库根目录
   ├─ playwright-core + 系统 Chrome（无头）加载 mcp-server/host.html
   │     └─ iframe /onlyoffice.html（真实编辑器，x2t.wasm 离线打开/保存）
   │           └─ frameEditor iframe：Asc.editor.native_callCommand(code, params)
   │              作用域内注入 Api / ThisDocument / Asc.scope —— 即 ONLYOFFICE Office API
   └─ documents/  文档工作目录（docx 落盘处）
```

- 打开/保存复用仓库现有离线链路：`localOpenFromBinary` + `x2t.wasm`（`convertToBin` / `convertFromBin`）。
- 执行复用编辑器内核的 `native_callCommand`（`safePluginEval`），与宏/插件同一套 `Api` 对象。
- **不改动** 仓库任何已有文件（编辑器、vendor、配置均原样复用）。

## 安装

```bash
cd mcp-server
npm install          # @modelcontextprotocol/sdk + playwright-core + zod（不下载 Chromium）
```

要求：Node ≥ 18；本机有 Chrome 或 Edge（默认自动探测，可用 `CHROME_PATH` 指定）。

## 客户端配置

在 MCP 客户端（Claude Desktop / Kimi CLI / 其他支持 stdio 的客户端）中登记：

```json
{
  "mcpServers": {
    "very-office": {
      "command": "node",
      "args": ["F:/JsWorkSpace/very-office/mcp-server/src/index.js"],
      "env": {
        "OO_DOCS_DIR": "F:/JsWorkSpace/very-office/mcp-server/documents"
      }
    }
  }
}
```

环境变量（均可选）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `OO_DOCS_DIR` | `mcp-server/documents/` | 文档工作目录 |
| `OO_PORT` | `0`（随机） | 内嵌静态服务端口 |
| `CHROME_PATH` | 自动探测 Chrome/Edge | 浏览器可执行文件路径 |
| `OO_HEADLESS` | `1` | 设为 `0` 显示浏览器窗口（调试用） |

## 工具清单

| 工具 | 说明 |
|------|------|
| `create_document(name)` | 以空白模板新建 docx 并打开 |
| `open_document(name)` | 打开工作目录中的 docx |
| `list_documents()` | 列出工作目录中的文档 |
| `delete_document(name)` | 删除文档 |
| `save_document(name?, format?)` | 保存当前文档；format 可导出 odt/txt/html 等 |
| `get_document_text(format?)` | 读取全文（markdown 默认 / text） |
| `insert_text(text, position?)` | 插入文本（文末新段落 / 光标处） |
| `replace_text(find, replace, matchCase?)` | 全文查找替换 |
| `office_execute(code, params?)` | **通用**：在编辑器内核执行 Office API JS 代码 |

### office_execute 用法

`code` 为 JS 函数体，作用域内可用：

- `Api` — Office API 根对象（`Api.GetDocument()`、`Api.CreateParagraph()`、`Api.CreateTable()` …）
- `ThisDocument` — 当前 ApiDocument
- `Asc.scope` — 传入的 `params` 对象

`return` 一个可 JSON 序列化的值即作为工具结果返回。示例（插入表格）：

```js
var oDoc = Api.GetDocument();
var oTable = Api.CreateTable(2, 2);
oTable.GetCell(0, 0).GetContent().GetElement(0).AddText('表头A');
oDoc.Push(oTable);
return true;
```

Office API 全量参考：https://api.onlyoffice.com/office-api/text-document-api/

## 验证

```bash
npm run smoke          # 全链路冒烟（直接驱动编辑器层，含 adm-zip 独立校验 docx）
npm run mcp-selftest   # 经 MCP stdio 协议的真实握手 + 全工具调用
```

## 限制

- **单活动文档**：同一时刻编辑器只打开一个文档；打开另一个前请先 `save_document`。
- 仅支持文本文档（word/docx）；xlsx/pptx/pdf 未暴露。
- 首次调用需加载编辑器与 wasm，约数秒到十几秒；后续调用为毫秒级。
- 浏览器为无头系统 Chrome，随 MCP 客户端退出自动回收。
