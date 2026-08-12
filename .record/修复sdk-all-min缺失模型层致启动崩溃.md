# 修复 sdk-all-min.js 缺失模型层致启动崩溃（AscCommon.History undefined）

- **时间**：2026-08-11
- **项目路径**：`F:\JsWorkSpace\very-office`（涉及源码仓 `F:\JsWorkSpace\DocumentServer\sdkjs`）

## 背景 / 问题

打开 `office.html` 后编辑器起不来，控制台首个错误：

```
CTableId.Add (sdk-all-min.js:47686) — Cannot read properties of undefined (reading 'Add')
  ← CTableId.init ← baseEditorsApi._onEndLoadSdk
```

随后级联报错：`AscCommon.setCurrentCultureInfo is not a function`、`Cannot read properties of null (reading 'm_bIsRuler' / 'm_oDrawingDocument')`、`InitEditor` 失败等。

## 根因

`sdk-all-min.js:47686` 是 `AscCommon.History.Add(...)` —— `AscCommon.History` 为 **undefined**。
证据链：

1. `AscCommon.History` 实例化于 `sdkjs/word/Editor/History.js:1971`（`window['AscCommon'].History = new CHistory()`），
   `setCurrentCultureInfo` 定义于 `sdkjs/common/NumFormat.js`。两者在 vendor 的 `word/sdk-all-min.js` 中 0 命中（只有调用点）。
2. 构建脚本 `DocumentServer\sdkjs\build\build.py` 旧版 `build_sdk()` 把 `sdk-all-min.js` 只拼 configs 里
   `sdk.min` 的 **42 个 api 层文件**（word/api.js、apiBase.js、TableId.js…）；`sdk.common` 的 **~390 个模型层文件**
   （History.js、NumFormat.js、Editor/*、Drawings/*…）只拼进 `sdk-all.js`。两列表互不重叠。
3. 本项目 9.4 web-apps 运行时**只加载 `sdk-all-min.js`**：`apps/documenteditor/main/app.js` requirejs
   `sdk: '../../sdkjs/word/sdk-all-min'`；`apps/api/documents/cache-scripts.html` 同样只引 `-min`。
   全 vendor/web-apps 无任何 `sdk-all.js`（非 min）引用 → 模型层从未被加载 → 启动即崩。
4. vendor 的 4 个 sdk-all-min.js 于 2026-08-10 16:39 被该残缺 deploy（同日 11:22 构建）覆盖。
5. 对照参考项目 `OnlyofficePersonal`：其 cache-scripts.html **同时**加载 `sdk-all-min.js` + `sdk-all.js`
   （min 在前，common 束为 IIFE 包裹的独立文件），所以它的"分离"产物能跑。本项目 web-apps 不走两文件加载。

> 注意：2026-08-11 瘦身删除 `sdk-all.js`（111MB）**不是**本次崩溃的原因（运行时本就不加载它），瘦身体省仍然成立。

## 修复 / 方案

让 `sdk-all-min.js` 成为完整 bundle，顺序/作用域与参考项目两文件加载等价（min 全局直拼在前，common IIFE 包裹在后）：

1. `DocumentServer\sdkjs\build\build.py`：`concat_files` 新增 `iife_files` 参数；`build_sdk` 改为
   `sdk-all-min.js = license header + concat(min_files) + (function(window,undefined){ concat(common_files) })(window);`。
   `sdk-all.js`（common-only IIFE）输出不变。
2. 重建：`cd F:\JsWorkSpace\DocumentServer\sdkjs\build && python build.py`
   （word sdk-all-min.js 3.6MB → 33.1MB；`new CHistory` / `setCurrentCultureInfo` 定义均在；4 个产品 `node --check` 通过）。
3. 拷贝 deploy 的 4 个 `sdk-all-min.js` 覆盖 `9.4.0.131/vendor/sdkjs/{word,cell,slide,visio}/`。
4. 修正 `tools/inject-9.4.0-offline-shim.py` 的 `SDKJS` 常量：`9.4.0` → `9.4.0.131`
   （当天 vendor 目录改名后脚本全部 `[skip] 不存在`，shim 实际未注入），然后重跑
   `python tools/inject-9.4.0-offline-shim.py`：4 个产品 getEmpty/fetchFonts/license/history-reset/offline-save
   shim 全部注入（visio 无 getEmpty 来源属正常），.br/.gz 预压缩产物同步重建。
5. SW 缓存版本 `9.4.0.131/vendor/document_editor_service_worker.js` 第 44、62 行 `_v18` → `_v19`。

## 结论与下一步

- vendor 4 个 `sdk-all-min.js` 现为完整 bundle + 全部离线 shim；AGENTS.md 已同步更新
  （目录结构、构建方式、同步规则、SW 版本号）。
- **待用户在浏览器验证**：`python -m http.server 8000` → DevTools Clear site data 后硬刷新
  `http://localhost:8000/office.html`；新建/打开/导出 docx，xlsx、pptx 冒烟，控制台不应再有
  `CTableId.Add` / `setCurrentCultureInfo` 报错。
- 教训：以后重建 sdkjs 后若编辑器启动报 `AscCommon.<X> undefined / is not a function`，
  先怀疑 sdk-all-min.js 拼接不完整或 shim 未重注（inject 脚本路径指向是否正确）。
