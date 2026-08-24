# 替换 x2t 以支持 HTML, FB2 和 OFD 的导入

- **时间**：2026-08-21
- **项目路径**：`F:\JsWorkSpace\very-office`

## 背景

为了在 `very-office` 项目中支持 HTML, FB2 和 OFD 格式的本地导入转换，我们在 `onlyoffice-x2t-wasm` 工程中重新编译了包含这些格式处理能力的 `x2t.wasm` 和 `x2t.js`，并消除了编译过程中的 OOB 和内存泄漏等构建卡点。

## 修改步骤

1. **替换 x2t 二进制**
   从 `F:\C++WorkSpace\onlyoffice-x2t-wasm\build\` (WSL 内部) 拷贝最新编译生成的 `x2t.wasm` 和 `x2t.js` 到 `9.4.0.131\vendor\sdkjs\common\wasm\x2t\`，替换原有的同名文件。

2. **更新缓存版本**
   在 `9.4.0.131\vendor\document_editor_service_worker.js` 中将缓存后缀 `_v21` 变更为 `_v22`，并同步更新了 `AGENTS.md` 中的说明记录。
   防止旧版本 Service Worker 的 JS 缓存与新加载的 wasm 文件出现不同步引发的加载报错。

## 客户端操作

需注意：由于浏览器缓存和 Service Worker 的控制机制，更新完静态资源和 SW 后，开发人员或客户端需要手动硬刷新或者在 DevTools 中执行 `Clear site data` 确保清理缓存，从而激活新的 SW 并拉取新版 `x2t` 文件以验证新格式支持情况。

