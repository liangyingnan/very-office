# 修复新版 x2t 替换后 wasm 实例化报 Import #0 "a" 错误

- **时间**：2026-08-10
- **项目路径**：`F:\JsWorkSpace\very-office`

## 背景/问题

用 `F:\C++WorkSpace\onlyoffice-x2t-wasm` 本地编译的最新 9.4.0 产物，替换了
`9.4.0\vendor\sdkjs\common\wasm\x2t\` 下的 `x2t.js` 和 `x2t.wasm`（编译产物在
`F:\C++WorkSpace\onlyoffice-x2t-wasm\build\`，含 `x2t.zip`）。替换后打开
`office.html` 加载本地 word 报错：

```
WebAssembly.instantiate(): Import #0 "a": module is not an object or function
```

x2t 初始化失败，文档无法打开。

## 根因

1. **新文件对本身是自洽的**。用 python 解析 wasm import section 对比：
   - 旧 `x2t.wasm`（42MB）：import 模块为 `env`（96 个）+ `wasi_snapshot_preview1`（8 个）；
   - 新 `x2t.wasm`（36MB）：编译启用了 import 名压缩，全部 173 个 import 并入模块 `"a"`（字段名也被压缩为 a/b/c/...）。
   - 新 `x2t.js` 的 `getWasmImports()` 返回 `{"a": wasmImports}`，与新 wasm 匹配；
     且 vendor 下两个文件与 `build\x2t.zip` 内文件 `cmp` 字节一致。
2. **实际运行的是"旧 JS + 新 wasm"混搭**。`9.4.0\vendor\document_editor_service_worker.js`
   把 `sdkjs/` 前缀静态资源缓存进 Cache Storage，缓存名 =
   `document_editor_static_` + URL 中 `vendor` 前一段（即 `9.4.0`）+ 硬编码后缀 `_v6`。
   本次原地替换文件、URL 路径不变 → 缓存键不变 → SW 继续返回**缓存中的旧 `x2t.js`**
   （只提供 `env`/`wasi` 导入）；而 36MB 的 `x2t.wasm` 超过 SW 单条缓存上限
   （缓存约 10% 配额、单条上限 1/8）从未入缓存，走网络拿到**新 wasm**（要求模块 `"a"`）。
   旧 JS 的 imports 对象没有 `"a"` 键 → `Import #0 "a": module is not an object or function`。

## 修复

1. `9.4.0\vendor\document_editor_service_worker.js`：
   - `g_cacheName` 后缀 `_v6` → `_v7`（第 44 行）
   - `g_fifoCacheName` 后缀 `_v6` → `_v7`（第 62 行）
2. `AGENTS.md` 约束一节新增约定：**替换 `9.4.0/vendor/` 下任何静态资源后必须 bump 该 `_vN` 后缀**。
3. 客户端一次性操作：DevTools → Application → Storage → **Clear site data**，再硬刷新
   （旧 SW 仍在控制页面，需等新版 SW 激活后才会使用 `_v7` 新缓存）。

## 追加排查（2026-08-10，bump _v7 后用户反馈仍报错）

- **实锤浏览器跑的是旧 x2t.js**：新版 `x2t.js` 总共只有 527 行，而报错堆栈引用
  `x2t.js:5483` / `x2t.js:637` / `x2t.js:571` —— 行号超出新文件长度，执行的只能是旧文件（6000+ 行）。
- **另一层缓存：HTTP 磁盘缓存 304**。新 `x2t.js` 复制时保留了构建机的 mtime（7-31 12:51），
  若浏览器早前缓存旧 JS 时的 Last-Modified ≥ 该值，If-Modified-Since 再验证会返回 304，继续用旧文件；
  而 `x2t.wasm` mtime 为 8-05 → 200 拿到新文件。同样造成"旧 JS + 新 wasm"混搭。
  （SW 的 Cache Storage 则会完全绕开再验证，两条路径都能导致此问题。）
- **补充修复**：`touch x2t.js x2t.wasm x2t_helper.js` 把 mtime 刷到当前时间，使 304 失效。
- SW 本身有 `skipWaiting()` + `clients.claim()`（第 445/400 行），新 SW 激活很快，
  但前提是浏览器先拿到新 SW 脚本（`document_editor_service_worker.js` 本次被编辑过，mtime 已更新）。

## 追加排查 2（2026-08-10，wasm 错误消失后出现"许可证过期"弹窗）

- **现象**：清缓存 + 换 python http.server :8000 后，wasm 实例化成功，但弹"许可证过期"
  （`Main.js onEditorPermissions`，`warnLicenseExp`）。
- **根因**：**四个产品的 `sdk-all-min.js` 里离线 shim 全部丢失**
  （`__ooOfflineLicensePatched` / `__ooFetchFontsPatched` / `getEmpty=function` 三个 marker 均为 0，
  git HEAD 版本同样没有；文件 mtime 7-30 11:49，早于文档记录的 7-31 shim 注入时间，
  推测 sdkjs 目录后来被未打 shim 的原始文件覆盖过）。
  离线 dummy 流程 `onLicense(null)` → `licenseResult=null` → `asc_CAscEditorPermissions`
  默认 `licenseType = Error(1)` → 命中 `Main.js:1675` 的 Error 分支 → 弹"许可证过期"。
  与新编译的 x2t.wasm **无关**（许可判定不走 wasm）。
- **修复**：重跑 `python tools/inject-9.4.0-offline-shim.py`（幂等），4 个产品全部重新注入
  getEmpty + fetchFonts + license/compareVersions shim 并重建 `.br/.gz`（visio 无 getEmpty 来源，
  按脚本设计跳过）。SW 缓存版本 `_v7` → `_v8`。
- **教训**：`sdkjs/**/sdk-all-min.js` 是**打过离线 shim 的产物**，任何"从源码目录重新拷贝 sdkjs"
  的操作都会把 shim 冲掉；覆盖后必须重跑 `tools/inject-9.4.0-offline-shim.py` 并 bump SW 版本。

## 追加排查 3（2026-08-10，许可弹窗消失后：getEmpty 报错 + x2t.js URL 异常）

- **`AscCommon.getEmpty is not a function`**（`_openEmptyDocument`）：当前 `word/sdk-all-min.js`
  尾部 shim 已确认存在，报错说明浏览器跑的是**注入前的旧文件**——同一个 InPrivate 会话里
  旧 SW（`_v7` 缓存）仍在服务旧 `sdk-all-min.js`。需要**关掉旧 InPrivate 窗口、开全新
  InPrivate 窗口**测试（InPrivate 会话内的 SW 和缓存不会跨会话保留，但同一会话内有效）。
- **`x2t.js:24 Failed to construct 'URL': Invalid URL`**：这是新编译 `x2t.js` 的**真实 bug**，
  与缓存无关。编译工程 `onlyoffice-x2t-wasm/pre-js.js:8` 里
  `new URL(myScript.getAttribute('src'))` —— `getAttribute` 返回的是 HTML 里的原始相对路径
  （`../../../../sdkjs/.../x2t.js`），`new URL()` 不带 base 直接抛异常，且 throw 发生在
  脚本顶层 IIFE → x2t.js 后续代码全部不执行 → x2t 静默失效（helper 的 onload 照常触发，具有迷惑性）。
- **修复**：三处同步改为 `new URL(mySrc, document.baseURI).search`：
  ① `9.4.0/vendor/sdkjs/common/wasm/x2t/x2t.js`（部署文件）；
  ② `onlyoffice-x2t-wasm/pre-js.js`（编译源头，防止下次编译复发）；
  ③ `onlyoffice-x2t-wasm/build/x2t.js`（已有构建产物，防止再次拷贝时带回 bug）。
- SW 缓存版本 `_v8` → `_v9`。

## 追加排查 4（2026-08-10，x2t 跑通后暴露 sdkjs 离线修复整体丢失）

- **背景**：x2t 初始化成功后，打开 docx 在 `InitEditor` 崩于
  `this.NewClass.Write_ToBinary2 is not a function`（`new CDocProtect ← DocumentSettings ← new CDocument`）。
- **根因**：**整个 vendor 树被回滚到了 7-30/31 的未修复状态**，8-02/03 的工作全部丢失：
  ① sdk-all-min.js 离线 shim（前面已重注入）；② sdk-all.js 的 Aug-3 修复
  （`CustomXmlManager.Write_ToBinary2` 占位 + `InsertDocumentFile.js` 离线分支）；
  ③ `x2t_helper.js` 的 convertMap 扩展（txt/rtf/odt→docx）与 txt BOM 修复。
  且 git 初始提交（8-03 20:25）本身就没包含这些修复，无法从 git 恢复。
  - `CDocProtect` 崩因：`word/Editor/DocumentProtection.js` 里 `Write_ToBinary2/Read_FromBinary2`
    被官方注释掉；其构造函数 `g_oTableId.Add` 注册进 History，History 激活态时
    `CChangesTableIdAdd.WriteToBinary → NewClass.Write_ToBinary2` 即崩。
    官方流程只在 History 未激活（Index=-1）时创建 CDocument，故官方不触发。
- **修复（DocumentServer 源码侧，已验证 pristine 源码 build.py 产物与 vendor 现版 md5 一致）**：
  1. `common/HistoryCommon.js`：新增 `historyitem_type_DocumentProtection = 74 << 16`（原注释引用的常量未定义）；
  2. `word/Editor/DocumentProtection.js`：取消注释恢复 `CDocProtect.Write/Read_ToBinary2`；
  3. `word/Editor/custom-xml/custom-xml-manager.js`：补 `Write_ToBinary2`（写类型 Long 占位）+ 空 `Read_FromBinary2`；
  4. `word/Editor/InsertDocumentFile.js`：`insertTextFromFile` 加离线分支
     （`AscCommon.x2t.convertToBin` 存在时自建 file input → 转 bin → insertDocuments，不走 downloadas）；
  5. `build.py` 全量重建四产品 → 仅同步 `sdk-all.js` 到 vendor（**绝不动 sdk-all-min.js**，它带 shim）；
  6. `x2t_helper.js`：convertMap 增加 txt/rtf/odt/epub/fodt/ott/wps→docx；`_convertDocument` 对 `.txt` 强制补 UTF-8 BOM。
- **系统性加固（新增第 4 个 shim：`__ooHistoryResetPatched`）**：离线"先开空文档再注入真实字节"会在
  同一 api 实例二次 openDocument，此时 History 已激活，重建 CDocument 会把默认样式/文档保护的注册变更
  序列化进历史（上游假定此时 Index=-1），触发一整类潜在崩溃（CDocProtect/CustomXmlManager/
  CDocumentBorder.Color undefined…）。shim 包装共用入口 `baseEditorsApi.asc_openDocumentFromBytes`，
  重开前把 History 重置为全新状态（Index/RecIndex=-1、Points=[] 等）。已固化进
  `tools/inject-9.4.0-offline-shim.py`（幂等，四产品已注入）。
- **测试基建**：`onlyoffice.html` 注入真实字节后置 `iframeWindow.__ooRealBytesInjected = true`；
  三个回归脚本就绪条件改为等待该标记（消除"注入前编辑被重建冲掉"的竞态）。
  新增 `tools/test-open-edit-save.py`（导入本地 docx→渲染→编辑→保存全链路）。
- **Playwright 实测（headless Chrome）**：
  `test-save-reopen.py` / `test-insert-text.py` / `test-bin-insert.py` 全部 PASS，downloadas 请求 0、无 pageerror；
  打开本地 docx 渲染、编辑、保存（含追加文本）均正确。

## 结论与下一步

- 问题不在编译产物，不需要重新编译 x2t；也不需改 `x2t_helper.js` / `office.html` / `onlyoffice.html`。
- 以后每次更新 vendor 静态资源（尤其是 `sdkjs/common/wasm/x2t/`）都要同步 bump SW 缓存版本号。
- 排查技巧：用 python 解析 wasm 第 2 区段（import section）即可快速判断 JS glue 与 wasm 是否同一次编译产物
  （模块名 `env` vs 压缩后的 `a` 一眼可辨）。
