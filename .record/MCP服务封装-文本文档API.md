# MCP 服务封装：把离线 ONLYOFFICE 文本文档 API 暴露给大模型

- 时间：2026-08-12
- 项目路径：`F:\JsWorkSpace\very-office\mcp-server\`

## 背景 / 需求

把本仓库的离线版 ONLYOFFICE 编辑器封装成一个 **MCP 服务**（stdio），对外暴露
新建文档、修改文档、删除文档等能力，核心是把 ONLYOFFICE 的**文本文档 API（Office API）**
开放给大模型调用。全程本地离线，不改编辑器本体。

## 关键技术调研结论（可复用）

1. **命令执行通道 = `Asc.editor.native_callCommand(funcText, params)`**
   （源码 `DocumentServer/sdkjs/common/apiBase.js`，导出键带引号 `["native_callCommand"]`，
   压缩后的 `9.4.0.131/vendor/sdkjs/word/sdk-all-min.js` 中确认存活）。
   - 内部把 funcText 包成 `(function(){let Asc={};Asc.scope=<params>;return (<funcText>)(Asc.scope);})()`，
     经 `AscCommon.safePluginEval`（`common/macros.js`）执行。
   - 执行作用域注入 **`Api`（= `g_asc_plugins.api.getJsApi()`，完整 Office API）、
     `ThisDocument`、`Asc.scope`**——与宏/插件同一套环境。
   - **同步返回**，返回值需过 `Asc.checkReturnCommand`（原始类型/数组/普通对象，递归 ≤10 层）。
   - 自动 `_afterEvalCommand` + `onEndBuilderScript` 触发重排，改完即渲染。
   - 前置条件 `canRunBuilderScript()`（= `asc_canPaste()`）：文档加载完成且为编辑模式即可。
   - 9.4 的 `api.js` **没有** `createConnector`，不能走 connector，必须进 iframe 调内核。
2. **打开/保存完全复用 `onlyoffice.html` 的现有 postMessage 协议**（父侧参考 `office.html`）：
   - 打开：`onlyoffice-config` + `openBuffer`（transfer），docConfig 带 `localOpenFromBinary:true`；
     完成标记 = 编辑器 iframe 的 `__ooRealBytesInjected === true`（重开时 iframe 重建，需等 iframe 换新再查标记）。
   - 保存：`onlyoffice-save`{requestId, format} → `onlyoffice-saved`{requestId, ok, buffer}（transfer 回传）。
3. **无头可行**：`tools/test-open-edit-save.py` 已证明 Playwright + 系统 Chrome headless 能跑通
   打开→编辑→保存全链路；x2t 打开按需抓字体（<2s），docx 输出完全跳过字体。

## 方案（最终落地）

```
mcp-server/
├── host.html            # 无头宿主页：iframe /onlyoffice.html，暴露 window.__oo={open,save,exec,status}
├── src/
│   ├── index.js         # MCP stdio 入口（@modelcontextprotocol/sdk McpServer）
│   ├── tools.js         # 9 个工具注册（zod 参数）
│   ├── runtime.js       # 惰性启动单例：静态服务+浏览器+会话；shutdown 清理
│   ├── static-server.js # node:http 服务仓库根（仅 127.0.0.1，随机端口，防路径穿越）
│   ├── browser.js       # playwright-core + 系统 Chrome/Edge（CHROME_PATH 可覆盖）
│   └── editor.js        # EditorSession：openFile/saveToFile/execute/getText/insertText/replaceText
├── scripts/smoke-test.js    # 编辑器层全链路（含 adm-zip 独立校验 docx）
├── scripts/mcp-selftest.js  # 真实 stdio 握手 + 9 工具全调用
└── documents/               # 文档工作目录（OO_DOCS_DIR 可覆盖，已 gitignore）
```

工具：create_document / open_document / list_documents / delete_document / save_document(name?,format?) /
get_document_text(markdown|text) / insert_text / replace_text / **office_execute(code, params?)**（核心通用工具）。

- `office_execute` 的 `code` 是 JS 函数体，直接用 `Api`/`ThisDocument`/`Asc.scope`，
  `return` 可 JSON 序列化值。建表、图片、样式、查找等全部 Office API 由此覆盖。
- `get_document_text` 默认走 `Api.GetDocument().ToMarkdown()`（保留结构，适合 LLM）。
- 单活动文档模型：编辑器同时只开一个文档。

## 验证结果（2026-08-12，均全绿）

- `npm run smoke`：新建→插入→markdown/text 读取→exec 建 2x2 表并返回对象→替换→保存
  →adm-zip 独立解析 document.xml 校验→重开（x2t 往返）内容保留→删除。**PASS**
- `npm run mcp-selftest`：stdio 握手、9 工具注册齐全、create/insert/get/exec/save/list/open/delete 全链路。**PASS**
- `npm run http-selftest`：HTTP 传输（`src/http.js`，Streamable HTTP）——无令牌 401、
  带 Bearer 令牌握手 + 全工具调用。**PASS**

## HTTP 传输（同日追加）

- `src/http.js`：`StreamableHTTPServerTransport`，每 HTTP 会话一个 transport（`mcp-session-id` 路由），
  但**共享同一个编辑器运行时**（单活动文档，跨客户端并发会互相覆盖，需隔离就多起进程）。
- 默认 `127.0.0.1:3000/mcp`；`OO_MCP_HOST` 绑定非回环地址时**强制 `OO_MCP_TOKEN`**（Bearer），否则拒绝启动。
- 客户端配置：`{"url": "http://<host>:3000/mcp", "headers": {"Authorization": "Bearer <token>"}}`。

## 调用者可指定文档目录（同日追加）

- 所有文件类工具（create/open/list/delete/save）增加可选 `dir` 参数（绝对路径），
  由调用者决定文档落点；省略时回落 `OO_DOCS_DIR` → `mcp-server/documents/`。
- 实现：`editor.js` 的 `resolveDocsDir(dir)` + `docPath(name, dir)`；`save_document` 不传 name 时
  仍保存回当前文件原路径（`session.current` 记绝对路径，自定义目录打开的文档可正确回存）。
- `mcp-selftest` 已加 dir 全链路用例（临时目录创建/保存回原路径/列目录/删除），stdio + HTTP 两侧自测均全绿。

## 注意 / 下一步

- 首次调用需加载编辑器+wasm（数秒），工具超时放宽；后续调用毫秒级。
- 未改 vendor 任何静态资源 → 无需 bump Service Worker `_v19`。
- 若以后重建 sdkjs 覆盖了 `sdk-all-min.js`（重跑 inject shim），用 `npm run smoke` 回归验证
  `native_callCommand` 仍可用。
- 仅暴露 word/docx；如需 cell/slide，架构相同（host.html 的 documentType 参数化 + blank 模板分支）即可扩展。
