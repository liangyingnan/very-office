# 修复"插入→来自本地文件的文本"报错与 Write_ToBinary2 崩溃

**时间**: 2026-08-03
**项目路径**: `F:\JsWorkSpace\very-office`

## 背景问题

用户反馈：Word 编辑器中 **插入 → 来自本地文件的文本 → 选择本地文件** 功能不可用，提示"未知的错误"。
控制台日志出现两类问题：

1. `GET /9.4.0/vendor/downloadas/f-xxx?cmd={"c":"save",...}` → **404 Not Found**
2. `TypeError: this.NewClass.Write_ToBinary2 is not a function`
   堆栈：`CChangesTableIdAdd.WriteToBinary ← CHistory.Add ← CTableId.Add ← new CustomXmlManager ← new CDocument ← asc_docs_api.InitEditor ← OpenDocumentFromBin ← onEndLoadFile`

## 根因（两个独立问题）

### 根因一：sdk 的 CustomXmlManager 缺 Write_ToBinary2（崩溃）

- `CDocument` 构造函数总会创建 `AscWord.CustomXmlManager`，其构造函数执行
  `AscCommon.g_oTableId.Add(this, this.Id)`，把自身注册进全局 History（`CChangesTableIdAdd` 变更）。
- 当 History 处于**激活态**（`TurnOffHistory===0 && Index>=0`，即文档打开后、用户编辑过或再次创建 CDocument 时），
  `CHistory.Add` 会立即调用 `CChangesTableIdAdd.WriteToBinary` → `this.NewClass.Write_ToBinary2(Writer)`。
- **官方 9.4 的 `CustomXmlManager` 没有 `Write_ToBinary2` 方法**（9.3/9.4 均如此，属官方潜在缺陷；
  官方流程只在 History 未激活时 new CDocument，所以正常打开文档不触发）。
- 本项目在"插入文本"报错后（或任何文档已激活 History 的场景）重新创建 CDocument → 崩溃。
- 参考对比：`CDocumentMacros`（同类注册方式）有 Write_ToBinary2/Read_FromBinary2，所以不崩。

### 根因二：插入文本功能依赖 Document Server 的 downloadas 端点（404）

- web-apps 菜单 → `asc_insertTextFromFile`（`word/Editor/InsertDocumentFile.js` 的 `CInsertDocumentManager`）。
- 非本地模式走 `_ConvertDocuments`（`word/api.js`）→ `downloadAs` → 请求
  `Document Server 的 downloadas 端点`（先保存当前文档，再转换所选文件）。
- **离线构建没有该端点 → 404** → 报"未知的错误"。保存链路（office.html 的保存按钮）
  走的是 `asc_nativeGetFile3` + x2t 直转（不经 downloadas），所以保存正常、只有插入文本失败。

## 修复方案

### 1. `word/Editor/custom-xml/custom-xml-manager.js`：补 Write_ToBinary2 / Read_FromBinary2

- `Write_ToBinary2` 仅写自身类型 Long（`AscDFH.historyitem_type_CustomXmlManager`）作占位，
  与 `CChangesTableIdAdd.ReadFromBinary` 中 `private_ReadClassFromBinary` 的 `Reader.GetLong()` **读写对称**。
- factory 未注册该类型 → 读回时 `GetClassFromFactory` 返回 null，不会调用 Read_FromBinary2，Load 时空引用安全。
- CustomXmlManager 本身无需持久化（customXml 内容经 CDocument 序列化与 `CChangesCustomXmlManagerAdd` 保存）。

### 2. `word/Editor/InsertDocumentFile.js`：insertTextFromFile 增加离线分支

- 检测 `AscCommon.x2t && typeof AscCommon.x2t.convertToBin === 'function'`（离线构建已注入 x2t_helper）时：
  - 自建 `<input type="file">`（accept 含 txt/docx/doc/odt/rtf 等，注意 `ShowDocumentFileDialog` 的
    document prop **不含 txt**，故离线分支不用它）
  - 读字节 → `AscCommon.x2t.convertToBin(bytes, name, ext)` → SER bin 流
  - 复用 `insertDocuments(streamInfos)`（`{stream, imageMap: result.media}`）→ 粘贴链
  - **完全不触发 downloadas 请求**
- 服务器模式原逻辑保留（`AscCommon.x2t` 不存在时兜底）。

### 3. 构建与同步

```bash
cd 9.4.0.131/vendor/sdkjs/build && python build.py        # 构建全部四个产品
# 同步 sdk-all.js（内核层；min.js 是 api 层 + 离线 shim，保持不变！）
cp deploy/sdkjs/{word,cell,slide,visio}/sdk-all.js 对应 vendor 目录
# 重建 .br/.gz 预压缩
brotli -q 11 -f -o sdk-all.js.br sdk-all.js && gzip -9 -c sdk-all.js > sdk-all.js.gz
```

- cell/slide 与 word **共享** `word/Editor/custom-xml/custom-xml-manager.js`，本次修改同时修复三者。
- **不要覆盖 vendor 的 `sdk-all-min.js`**：它 = 构建原件 + 离线 shim（getEmpty/license 补丁，
  见 tools/inject-9.4.0-offline-shim.py）；本次改动全部在 common 列表（sdk-all.js），min.js 无需更新。

## 验证结果（Playwright headless 实测，脚本：tools/test-insert-text.py / test-save-reopen.py）

1. 打开文档正常，无控制台错误。
2. History 激活时 `new AscCommonWord.CDocument()` 不再崩溃（`CustomXmlManager.Write_ToBinary2` 存在）。
3. 插入→来自本地文件的文本 → 选择 txt → **内容成功插入文档**；**downloadas 请求 0 次**（无 404）。
4. 回归：插入后保存（asc_nativeGetFile3 + x2t 转 docx）→ 关闭重开 → 内容完整。
5. cell/slide/visio 的 sdk-all.js 已同步含修复，.br/.gz 已重建。

## 结论与下一步

- 两个问题均已根治：离线插入文本不再依赖服务器端点，History 激活态 new CDocument 不再崩溃。
- 遗留（不在本次范围）：`insertTextFromUrl`（从 URL 插入文本）仍走服务器模式，离线不可用；
  web-apps 其他内部 downloadAs 调用（打印、邮件合并等）离线仍会 404，如需可后续逐一本地化。

---

## 追加修复（2026-08-03 第二轮：用户复测仍 404）

用户复测（WebStorm 63342 端口）仍出现 downloadas 404 + 未知错误，排查出三个额外问题：

### 1. Service Worker 缓存旧 sdk（404 的直接原因）
- `document_editor_service_worker.js` 对 `sdkjs/`、`web-apps/` 等做 cache-first 缓存，缓存名后缀固定 `_v4`。
- 更新 sdk 后浏览器仍从旧缓存读代码 → 插入文本仍走服务器分支 → 404。
- 修复：缓存版本后缀 `_v4` → `_v5`（`g_cacheName`、`g_fifoCacheName` 两处），
  新 SW 激活时自动删除旧缓存。**用户需 Ctrl+Shift+R 硬刷新（必要时两次）**。

### 2. api.js 的 fileType 白名单拒绝 .bin 文档
- 用户打开的是 `.bin`（SER 原生格式）文档，api.js `_checkConfigParams` 对 `document.fileType`
  有白名单正则（doc/docx/xls/…），`bin` 不在其中 → alert + 中断（编辑器 iframe 不创建）。
- 修复：`onlyoffice.html` `normalizeConfig` 把 `fileType='bin'` 映射为 `docx` 过校验，
  真实字节转换扩展名记入 `__originalFileType`（仍按 bin 直通）。
- 顺手移除 `office.html` `handleFileInput` 中残留的 `debugger` 语句（DevTools 打开时会暂停页面）。

### 3. x2t 转换 txt 的产物不兼容粘贴链路（插入后内容为空）
- txt/rtf 直接转 bin 产出 **v5 旧版 SER 格式**，9.4 内核 copyPaste 解析读不出内容 → 粘贴被拒。
- 修复：`x2t_helper.js` `convertDocument` 的 convertMap 增加 txt/rtf/odt/epub/fodt/ott/wps → docx
  （先转 v10 docx 再转 bin）。
- **txt 编码坑**：无 BOM 的 UTF-8 纯汉字 txt 被 x2t 误判编码 → 内容丢失（bin 与空文档同尺寸）。
  修复：`_convertDocument` 对 `.txt` 输入强制加 UTF-8 BOM（EF BB BF）。

### 验证（Playwright 实测，全部 PASS）
- `tools/test-insert-text.py`：docx 文档插入 txt ✅（无 downloadas 请求、无崩溃）
- `tools/test-save-reopen.py`：插入 → 保存 → 重开内容完整 ✅
- `tools/test-bin-insert.py`：bin 文档打开 → 插入 txt → 保存 ✅
- 手动粘贴对照实验确认：纯汉字/空 txt 转出的 bin（765B）粘贴被拒；BOM 修复后（1007B）成功。
