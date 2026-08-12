# 修复瘦身后 sdk-all.js 404 及预热页残留引用

- 时间：2026-08-11
- 项目路径：`F:\JsWorkSpace\very-office`

## 背景 / 问题

资源瘦身（`tools/trim-9.4.0-assets.py`，删除未压缩 `sdk-all.js`）执行后，浏览器控制台出现：

- `sdkjs/word/sdk-all.js` 404 ×3，且因 404 返回 HTML 触发严格 MIME 检查
  "Refused to execute script"。
- `document_editor_service_worker.js:430 SW fetch failed .../documenteditor/main/index.html
  — Failed to fetch`，页面拿到合成的 504。

## 根因

1. `web-apps/apps/api/documents/preload.html` 与 `cache-scripts.html`
   （api.js 用隐藏 iframe 加载做资源预热/缓存）仍引用已删除的
   `sdkjs/{word,cell,slide,visio}/sdk-all.js`：各 1 个可执行 `<script src>`（word）
   + 3 个 `<link rel="preload">`（cell/slide/visio）。编辑器实际运行只走
   `sdk-all-min.js`（`documenteditor/main/app.js:58`），属残留死引用。
2. SW 504 是 `document_editor_service_worker.js:427-433` 的兜底：网络 fetch 连接层失败
   （`Failed to fetch`，非 HTTP 错误码）且无缓存时合成。当时访问走 JetBrains IDE 内置服务器
   （`localhost:63342/very-office/`），非文档约定的 `python -m http.server 8000`；
   也可能是加载失败后刷新打断了进行中的 iframe 请求。属环境性问题。

## 修复

- 删除 `preload.html` / `cache-scripts.html` 中 8 行死引用（相邻行已有对应
  `sdk-all-min.js` 引用，纯重复）。`vendor/web-apps/` 即源码树，grunt 重建不会回退。
- SW 缓存版本 `_v16` → `_v17`（`document_editor_service_worker.js:44,62`，
  按 AGENTS.md 约束 vendor 静态资源变动必须 bump）。
- AGENTS.md 中 "当前为 `_v16`" 同步为 `_v17`。

## 结论与下一步

- 全仓库已无 `sdk-all.js`（未压缩版）引用；本地起服验证 preload/cache-scripts/
  四个 `sdk-all-min.js`/编辑器 index.html 均 200。
- 用户侧验证：`python -m http.server 8000` → Clear site data 后硬刷
  `http://localhost:8000/office.html`，控制台应无 404/MIME/504。
- 建议验证统一用约定的 8000 端口；IDE 内置服务器（63342）的连接层
  "Failed to fetch" 不作为项目缺陷。
- 教训：今后扩充 `tools/trim-9.4.0-assets.py` 删除项时，应先全仓 grep 引用方再删。

## 后续（同日）：修完仍报错的原因

用户改完后控制台仍有 `sdk-all.js` 404 与 SW 504。排查确认**磁盘侧已彻底干净**
（全仓 grep 无 `sdk-all.js` 引用；带完整查询串的 index.html 及关键资源全部 200；
python http.server 串行 10/10、并发 20/20 正常）。残留报错来自**浏览器端旧 SW 状态**：

- 旧 SW（`_v16` 缓存）仍存着修复前的 `preload.html`/`cache-scripts.html`，继续发起
  `sdk-all.js` 请求 → 404。版本 bump 后首个 reload 仍由旧 SW 控制页面，属预期；
  新 SW（skipWaiting + activate 删旧缓存 + clients.claim）生效后即消失。
- "SW fetch failed … — Failed to fetch"（504）是 SW 上下文日志，DevTools 里**跨刷新常驻**，
  多为刷新打断上一波 iframe 加载所致；新版 SW 的 navigate 分支本就有 800ms 重试 +
  缓存回退（见文件注释），不再输出该行。
- 处置：Clear site data → 硬刷；确认 Cache Storage 为 `_v17`。

## 第三轮（同日）：加 __ooSdkAllStub 兼容 stub，根治旧缓存场景

用户在 63342 origin（从未清过缓存）再次看到同样的 `sdk-all.js` 404 + "Refused to execute"。
旧 SW/HTTP 缓存里的修复前页面仍按 `<script src>` 引用 `sdk-all.js`。为避免依赖用户手工清缓存：

- 在 `sdkjs/{word,cell,slide,visio}/sdk-all.js` 原位写 **stub**（~1.2KB，标记 `__ooSdkAllStub`）：
  页面已引用 `sdk-all-min.js` 时空转（旧 preload/cache-scripts 的正常顺序）；否则用
  `document.currentScript.src` 推导 `-min` 路径并 `document.write` 同步注入，保证旧页面仍拿到 SDK。
- `tools/trim-9.4.0-assets.py` 第 [4] 段改为跳过含 `__ooSdkAllStub` 标记的文件（幂等保留 stub）。
- SW `_v17` → `_v18`；AGENTS.md 目录说明与版本号同步。
- 验证：trim dry-run 正确保留 4 个 stub；4 个 stub 经 http 服务均 200。
- 注意：Windows 控制台 GBK 下 trim 脚本中文输出为乱码，不影响功能。
