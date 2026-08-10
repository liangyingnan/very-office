# AGENTS.md — very-office（离线版 ONLYOFFICE 编辑器）

## 项目目的

把 ONLYOFFICE 编译成一个**纯浏览器、无后端、可离线运行**的文档编辑器，并内置插件能力。
编辑/打开/导出（docx / xlsx / pptx / odf / pdf / csv 等）全部在浏览器内完成，文件不离开本地。
最终成品形态对标参考项目 `F:\JsWorkSpace\OnlyofficePersonal`（一个已构建好的离线 ONLYOFFICE）。

核心机制：

- **实时编辑内核**：浏览器端运行 ONLYOFFICE 的 `web-apps`（UI）+ `sdkjs`（JS 内核），**不需要 Document Server 后端**。
- **离线格式转换**：文档导入/导出走 `sdkjs/common/wasm/x2t/` 里已打包的 `x2t.wasm`（Emscripten，约 42MB），
  通过 `x2t_helper.js` 在 wasm 的 MEMFS 里 `ccall('main1')` 完成转换，全程不发任何网络请求。
- **插件**：插件源码放在 `sdkjs-plugins/content/<plugin>/`，由 `assets/office-config.js` 的
  `pluginsData` 数组登记为默认启用插件（如 drawio / ai / translator 等）。
- **零后端、纯静态**：任意静态 HTTP 服务即可托管（`python -m http.server` / `http-server` / Nginx）。
  必须通过 http(s) 提供（`file://` 会导致 wasm/Worker/fetch 失败）。

## 代码来源（已迁移到本项目）

| 来源仓库 | 内容 | 在本项目的位置 |
|----------|------|----------------|
| `F:\JsWorkSpace\DocumentServer`（v9.4.0.131） | `sdkjs`（编辑器 JS 内核，含离线 x2t 引擎） | `9.4.0/vendor/sdkjs/` |
| `F:\JsWorkSpace\DocumentServer`（v9.4.0.131） | `web-apps`（编辑器前端 UI，源码） | `9.4.0/vendor/web-apps/` |
| `F:\JsWorkSpace\onlyoffice.github.io` | `sdkjs-plugins`（插件源码，50+ 插件） | `9.4.0/vendor/sdkjs-plugins/` |
| `F:\JsWorkSpace\onlyoffice.github.io` | `store`（插件市场 UI，已改名为 `plugins-store`） | `9.4.0/vendor/plugins-store/` |
| `F:\JsWorkSpace\OnlyofficePersonal` | **目标参考**：已构建好的离线编辑器（9.3 产物 + 9.4 x2t） | 只读参考，**不要修改其代码** |
| `F:\JsWorkSpace\DesktopEditors` | 桌面版 ONLYOFFICE（原生 C++ + web-apps），离线配置参考 | 只读参考 |
| `F:\C++WorkSpace\onlyoffice-x2t-wasm` | CryptPad 的 x2t wasm 编译工程（qmake+emscripten+Docker） | 参考/兜底，**当前主线构建不需要用它编译** |

> **关于 x2t.wasm 的重要说明**：本项目的 `9.4.0/vendor/sdkjs/common/wasm/x2t/` 已经内置了与
> `OnlyofficePersonal` **字节一致**的 `x2t.wasm`（42MB）/ `x2t.js` / `x2t_helper.js`（均为 9.4 版）。
> 因此本离线编辑器**不需要**再通过 `onlyoffice-x2t-wasm` 的 Docker 流程重新编译 x2t；
> 该仓库仅作为「内置 x2t 万一有格式问题」时的兜底来源。`onlyoffice-wasm-build/` 目录下的早期
> 脚本（假设要 Docker 编译 x2t）已不适用于当前主线方案，仅供历史参考。

## 当前目录结构

```
very-office/
├── 9.4.0/
│   └── vendor/
│       ├── sdkjs/            # 编辑器 JS 内核（含 common/wasm/x2t/ 离线转换引擎，已预编译 sdk-all-min.js）
│       ├── web-apps/         # 编辑器前端 UI（源码，需 grunt 构建）
│       ├── sdkjs-plugins/    # 插件源码（content/ 下 50+ 插件，含 drawio/ai/zhipu/...）
│       ├── plugins-store/    # 插件市场 UI（由 onlyoffice.github.io 的 store 改名，可选构建）
│       ├── fonts/            # 字体（~327M，按索引命名）
│       ├── dictionaries/     # 拼写词典
│       └── document_editor_service_worker.js  # 静态资源缓存 Service Worker
├── assets/                   # office-config.js（入口配置）、favicon.ico、empty.pdf
├── blank/                    # 新建文档的空白模板
├── docs/                     # 文档 / 截图
├── office.html               # 演示入口（外壳页：最近文件、IndexedDB、iframe 内嵌 onlyoffice.html）
├── onlyoffice.html           # 集成入口（加载 api.js，postMessage 协议，OO_FILE_STREAM_ONLY）
└── onlyoffice-wasm-build/    # 早期 wasm 方案脚本（历史参考，当前主线不使用）
```

> 版本化目录约定：参考项目用 `<version>-<hash>/vendor/...`；本项目对应为 `9.4.0/vendor/...`。
> Service Worker 的缓存版本键是从 URL 路径自动取 `vendor` 段，因此 `9.4.0/vendor/` 布局天然兼容，无需改版本号。

## 集成入口文件（关键`)

- `office.html`：外壳页。先加载 `assets/office-config.js`（暴露全局 `OfficeConfig`），
  通过 `postMessage({type:'onlyoffice-config', ...})` 把文档配置注入内嵌的 `onlyoffice.html` iframe。
- `onlyoffice.html`：编辑器宿主。加载 `9.4.0/vendor/web-apps/apps/api/documents/api.js`（定义 `DocsAPI`），
  设置 `window.OO_FILE_STREAM_ONLY = true`，收到配置后用 `new DocsAPI.DocEditor('editor', config)` 启动。
- `assets/office-config.js`：拼装 `DocEditor` 的 `document` / `documentType` / `editorConfig`，
  并通过 `editorConfig.plugins.pluginsData` 登记默认插件；离线打开走 `localOpenFromBinary` + x2t 转换。

## 当前需要修正的路径（迁移后还未对齐）

> ✅ 以下三项已于 2026-07-31 全部完成（见 `docs/构建计划-9.4.0离线版.md` 执行记录）：

| 文件 | 处理结果 |
|------|----------|
| `onlyoffice.html` | 已改为 `9.4.0/vendor/web-apps/apps/api/documents/api.js`，并移植离线流程（`_offline_` + x2t 注入 + `asc_nativeGetFile3` 保存） |
| `assets/office-config.js` 的 `pluginsData` | 已改为相对编辑器 iframe 的 `../../../../sdkjs-plugins/content/<name>/config.json` |
| Service Worker | 9.4 web-apps 自身经 `docserviceworker.js` 注册（路径 `../../../../document_editor_service_worker.js`），无需手动注册 |

## 构建方式

### 1. sdkjs（可选重建）
- 已随仓库携带预编译 `sdkjs/word/sdk-all-min.js` 等，离线转换引擎 `common/wasm/x2t/` 已就位，**通常无需重建**。
- vendor 下的 `sdkjs/` 只含构建产物（无源码树）；源码与构建脚本在 `F:\JsWorkSpace\DocumentServer\sdkjs\`
  （v9.4.0.131 + 本项目离线修复）。重建：`cd F:\JsWorkSpace\DocumentServer\sdkjs\build && python build.py`
  （仅文件拼接，需 Python 3），产物在 `DocumentServer/sdkjs/deploy/sdkjs/`。
- **`sdk-all.js` 同步规则**：只允许同步 `sdk-all.js`（内核层）。DocumentServer 源码上叠了本项目的离线修复
  （`DocumentProtection.js` 恢复 CDocProtect.Write/Read_ToBinary2 + `HistoryCommon.js` 新增
  `historyitem_type_DocumentProtection = 74<<16`、`custom-xml-manager.js` 补 Write_ToBinary2 占位、
  `InsertDocumentFile.js` 插入文本离线分支），从官方干净源码重建会丢这些修复。
- **重要**：`vendor/sdkjs/<word|cell|slide|visio>/sdk-all-min.js` 尾部追加了离线 shim
  （getEmpty 空文档 bin + fetchFonts 字体喂给 wasm〔支持按需过滤，见下〕+ 本地许可/compareVersions 包装 +
  asc_openDocumentFromBytes 的 History 重置 + isDocumentLoadComplete 复位 + saveChanges 离线假完成）。
  任何时候用"干净"的 sdk-all-min.js 覆盖它们（如同步 deploy 产物、从 DocumentServer 重拷贝），
  都必须重跑 `python tools/inject-9.4.0-offline-shim.py`（幂等）恢复 shim，
  否则会出现"许可证过期"弹窗、新建文档失败、转换缺字体、重开文档崩溃、注入后不重排（空白）、
  状态栏"正在保存文档..."常驻。
- **重开重排修复（2026-08-10）**：离线"先开空文档、后注入真实字节"在同一 api 实例二次
  openDocument；首开后 `isDocumentLoadComplete=true`，`_openDocumentEndCallback` 开头 guard
  直接 return → 注入的文档不做 RecalculateFromStart、不发 asc_onDocumentContentReady，
  画面空白直到用户输入触发重排。shim 在 asc_openDocumentFromBytes 前复位该标志（标记
  `__ooReopenRecalcPatched`）。
- **按需字体（2026-08-10）**：x2t 转换的全量字体约 400MB/273 个文件，首次打开文档要全抓一遍
  （本地 16s+，表现为"打开后长时间空白"）。现改为：打开（→bin）时 `x2t_helper.js` 从源 zip
  （docx fontTable/theme/styles/document、xlsx styles、pptx typeface）解析文档实际引用的字体名，
  并集常用兜底字体后经 `AscCommon.fetchFonts(cb, filter)` 只抓这几个（典型 <30MB/<2s）；
  bin→docx/xlsx/pptx 等文本类输出不引用字体二进制，**完全跳过**字体加载；
  PDF 输入/输出仍全量（渲染字形需要）。解析失败自动降级为全量。

### 2. web-apps（必须构建）
- 纯源码，需 Grunt 构建：
  ```bash
  cd 9.4.0/vendor/web-apps/build
  npm install                # grunt 1.6.1 + babel/terser/less/requirejs
  npx grunt deploy-documenteditor deploy-spreadsheeteditor \
              deploy-presentationeditor deploy-pdfeditor deploy-visioeditor deploy-common-component
  ```
- 产物在 `web-apps/deploy/web-apps/`，同步回 `9.4.0/vendor/web-apps/`
  （`cp -r deploy/web-apps/* ../web-apps/`）。确保 `apps/api/documents/api.js` 与各编辑器 `main.js` 存在。

### 3. 插件（静态，无需构建）
- `9.4.0/vendor/sdkjs-plugins/content/<plugin>/` 直接作为静态资源服务即可。
- 在 `assets/office-config.js` 的 `pluginsData` 里登记 `9.4.0/vendor/sdkjs-plugins/content/<plugin>/config.json`
  即默认启用。drawio 的 guid 为 `asc.{DB38923B-A8C0-4DE9-8AEE-A61BB5C901A5}`。

### 4. plugins-store（可选）
- 插件市场 UI，用 `9.4.0/vendor/plugins-store/build.bat`（closure compiler）构建 `code_min.js`。
- 离线编辑不依赖它，仅在需要应用内浏览/安装插件市场时才构建。

### 5. x2t.wasm（已内置，无需编译）
- 位于 `9.4.0/vendor/sdkjs/common/wasm/x2t/`，9.4 版，与参考项目字节一致。
- 仅当离线转换出现格式问题时，才考虑用 `onlyoffice-x2t-wasm` 重新编译并替换。

## 运行与验证

```bash
cd F:\JsWorkSpace\very-office
python -m http.server 8000     # 必须用 http 服务，禁止 file://
# 浏览器打开 http://localhost:8000/office.html
```

验证清单：
1. 打开 `office.html`，新建/打开一个 docx，确认编辑器加载且可编辑。
2. 插件面板出现 drawio / ai / translator 等已启用插件。
3. 导出/下载一个文件，确认走 x2t 离线转换（可在 DevTools Network 里确认无后端请求）。
4. （可选）确认 Service Worker 注册成功，刷新后可离线打开。

## 重点记录（`.record/` 文件夹）

本项目用仓库根目录下的 `.record/` 文件夹沉淀**重点内容**：每次完成重要调研、修复、迁移、架构决策或
阶段性进展，都把关键结论（根因、文件路径、修复步骤、下一步）总结成一篇独立 Markdown 写进 `.record/`，
便于长期追溯，且不污染主代码。

约定：
- **位置**：`.record/<简明主题>.md`（如 `修复9.4.0加载卡死与原生离线模式全链路打通.md`）。
- **触发**：完成实质性工作（构建 / 修复 / 迁移 / 重大调研 / 定方案）后**立即**补一篇，不要等。
- **必备字段**：标题、`时间`、`项目路径`、背景/问题、根因、修复/方案、结论与下一步。
- **内容**：聚焦可复用的结论与绝对路径、关键命令；避免流水账。
- **已有示例**：`.record/修复9.4.0前端卡住及集成原生AI插件全过程.md`、`.record/修复9.4.0加载卡死与原生离线模式全链路打通.md`、`.record/离线版构建方案与路径修正计划.md`。

## 约束

- **不要修改 `F:\JsWorkSpace\OnlyofficePersonal` 中的代码**——它仅作为只读参考/已知可用的成品基线。
- 版本对齐：`sdkjs` / `web-apps` 为 9.4.0.131；内置 `x2t.wasm` 已是 9.4，无需强行对齐到 CryptPad 的 9.3.0.140。
- **替换 `9.4.0/vendor/` 下任何静态资源（尤其是 `sdkjs/common/wasm/x2t/`）后，必须同步把
  `9.4.0/vendor/document_editor_service_worker.js` 中 `g_cacheName` / `g_fifoCacheName` 的 `_vN`
  后缀 +1**（当前为 `_v15`）。否则 Service Worker 会继续服务旧缓存，可能出现新旧文件混搭
  （如旧 `x2t.js` + 新 `x2t.wasm` 导致的 `Import #0 "a"` wasm 实例化错误）。客户端首次仍需
  在 DevTools → Application → Storage → Clear site data 后硬刷新一次。

## 参考

- 目标成品：`F:\JsWorkSpace\OnlyofficePersonal`（README 见其 `README.md` / `docs/使用文档.md`）
- ONLYOFFICE 插件 config 字段：https://api.onlyoffice.com/plugin/concepts
- DesktopEditors（离线配置参考）：`F:\JsWorkSpace\DesktopEditors`
