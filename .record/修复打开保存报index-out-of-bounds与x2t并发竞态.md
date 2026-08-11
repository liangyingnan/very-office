# 修复打开/保存报 Document conversion failed: RuntimeError: index out of bounds

时间：2026-08-02
项目路径：`F:\JsWorkSpace\very-office`

## 背景/问题

用户反馈：`office.html` 打开 Word 文档报 `Document conversion failed: RuntimeError: index out of bounds`，且保存功能也有问题。

报错文案精确匹配 `x2t_helper.js` 的 `_convertDocument` catch：
`reject(new Error('Document conversion failed: ' + error))`，其中 `error` 是 Emscripten wasm 内存越界（`RuntimeError: index out of bounds`），发生在 `ccall('main1')` 转换期间。

## 调研过程（重要结论）

### 1. 参考基线 OnlyofficePersonal 对比

| 文件 | OnlyofficePersonal (9.3) | very-office (9.4) | 结论 |
|------|--------------------------|-------------------|------|
| x2t.js / x2t.wasm | md5 相同 | md5 相同 | ✅ 字节一致，无版本错配 |
| x2t_helper.js | 每次转换都 fetchFonts | 仅 PDF 时 fetchFonts（性能优化） | 差异非根因 |
| 打开链路 | 9.3 sdk 内补丁：直接 `openDocument({buffer})` 原始字节 | 9.4：x2t `convertToBin(docx→SER bin)` 再注入 | 9.4 正确姿势 |
| 保存链路 | `downloadAs()` → x2t.downloadFile 劫持 | `asc_nativeGetFile3()` + `convertFromBin` | 9.4 正确姿势 |

### 2. Node 实测（`tools/test-x2t-node.js`，新写）

模拟浏览器环境直接跑 x2t.wasm，覆盖以下输入全部通过：
- blank.docx(983B) → DOCY bin(759B) → docx(PK 头) ✅
- 真实 10MB docx（117 个媒体）→ 577KB bin → 9.2MB docx ✅
- 中文/特殊字符文件名 ✅
- 并发 3 路转换 ✅
- 损坏输入（双层 DOCY 头/截断 bin）→ 报 code 88（正常失败码），**不越界**

### 3. Electron 实测（`tools/test-office-electron*.js`，新写）

干净环境下**无法复现**用户报错：新建 docx/xlsx/pptx、导入 10MB 真实文档、保存（产物 PK 头合法、zip 完整性 OK）、关闭重开、再保存，全部正常。

### 4. 根因判定

代码在当前干净环境下正确，但存在**两个真实隐患**（用户环境可触发）：

1. **旧版本残留**（最可能）：用户浏览器 SW/HTTP 缓存了修复前版本（第五轮双层 DOCY 头 bug 之前的代码），或 IndexedDB 里存有旧 bug 保存的**损坏文件**。打开损坏字节 → convertToBin 解析 → wasm 越界。双层头/截断 bin 实测报 code 88，但更复杂的损坏组合（长度字段与内容不符、格式错位）可触发越界。
2. **x2t 并发竞态**（实测偶发）：x2t 是单例（`AscCommon.x2t`），所有转换共用同一 MEMFS（/working）。快速连续打开/保存时，转换在 await 微任务间交错，互相覆盖同名输入文件、读到半成品 → 越界。Electron 实测偶现 `pptx 保存失败：asc_nativeGetFile3 不可用`（编辑器重建竞态）。
3. **转换失败读到残留输出**：`_convertDocument` 不清理输出文件，转换失败但 main1 返回 0 时读到上次残留 → 假成功/损坏产物。

## 修复内容

### 1. `../9.4.0.131/vendor/sdkjs/common/wasm/x2t/x2t_helper.js`（核心）
- **转换串行队列 `_enqueue`**：`convertToBin`/`convertFromBin` 全部串行执行（原逻辑改名 `_convertToBin`/`_convertFromBin`），杜绝 MEMFS 并发踩踏 → 越界。
- **转换前 `FS.unlink(outputPath)`**：清理上次残留的同名输出文件，失败时不再读到残留假成功。

### 2. `onlyoffice.html`
- **保存签名校验**：`asc_nativeGetFile3` 的 base64 解码后校验 `DOCY/XLSY/PPTY/VSDY` 签名，非法时提前报错「文档数据签名无效，文档可能已损坏，请重新打开后再保存」，坏字节不再进 x2t。
- **打开结果校验**：`convertToBin` 产物（非 pdf）必须是合法 SER bin 签名，否则提示「源文件可能已损坏，请重新导入」。
- **保存竞态加固**：新增 `waitForEditorApi()`（轮询等待 `Asc.editor.asc_nativeGetFile3` 就绪，最长 10s）；`getEditorFrame()` 改为取**最后一个** `frameEditor`（重建时旧 iframe 残留取最新）。

### 3. `office.html`
- 打开失败 toast 附加提示「若为最近文件，可能是旧版本保存的损坏文件，可删除后重新导入」。
- 保存超时 30s → 60s（首次转换含 wasm 加载）。

### 4. `../9.4.0.131/vendor/document_editor_service_worker.js`
- SW 缓存版本 `_v3 → _v4`：强制用户浏览器丢弃旧缓存（可能含损坏/旧版 sdk 与 x2t 文件）。

## 验证

- `node tools/test-x2t-node.js docx`：blank.docx 转换回归 ✅（759B bin / 8410B docx）
- Electron 全流程：新建 docx/xlsx/pptx、导入 10MB 真实文档、保存、重开、再保存 ✅（含修复后多轮）
- xlsx 保存 9112B PK 头、pptx 保存成功 ✅
- `onlyoffice.html` / `x2t_helper.js` 语法检查 ✅

## 结论与下一步

1. 用户需**硬刷新**（Ctrl+F5）或 DevTools → Clear storage 清除旧缓存（SW 已升 _v4 会自动清理）。
2. 若最近文件列表里有旧版本保存的损坏文件，打开时会明确提示，删除后重新导入即可。
3. 遗留：`docs/构建计划-9.4.0离线版.md` 的执行记录已追加第六轮；`tools/test-x2t-node.js` 与 `tools/test-office-electron*.js` 保留为回归测试脚本。
