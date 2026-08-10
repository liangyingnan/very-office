# 修复 Service Worker putInCache 并发冲突与 respondWith 未捕获拒绝

- 时间：2026-08-10
- 项目路径：`F:\JsWorkSpace\very-office`

## 问题

用户在 63342 端口（WebStorm 服务器）测试时控制台刷出数百条
`putInCache failed after max retries`（`document_editor_service_worker.js:315`），
并伴随 `The FetchEvent for ".../documenteditor/main/index.html" resulted in a network error response:
the promise was rejected`（:368 未捕获）。

## 根因（两层）

1. **`Cache.put` 并发冲突**：编辑器 FontLoader（显示字体）与 x2t fetchFonts shim（wasm 字体）
   会同时拉取相同的 `vendor/fonts/0XX` URL；插件 iframe 也会并发重复拉取同一路径
   （日志里 fonts/072、ai/config.json 等均出现两次）。两条 fetch 都 cache miss → 都走网络 →
   都 `putInCache` 同一 key，Chromium 对同 key 的并发 put 拒绝：
   `Failed to execute 'put' on 'Cache': Entry already exists.`。
   重试（250ms/500ms）期间另一 put 仍在途（大字体 4MB），重试耗尽后刷屏报错。
   （功能上条目其实已被"先到的那个"写入，错误纯属噪音。）
2. **`cacheFirst` 非导航路径无 catch**：`cached || fetch(request)` 的 fetch 拒绝时
   （服务器重启/在途请求被中止），rejection 直接传给 `respondWith` → 浏览器报
   "FetchEvent resulted in a network error"，iframe 导航可能失败。
   导航路径的 catch 里 `caches.match` 未命中时 resolve undefined，同样导致 network error。

## 修复（`9.4.0/vendor/document_editor_service_worker.js`）

- `putInCache` 增加 in-flight 表（`method + url` → Promise）按 URL 去重：同 URL 的并发写
  直接复用在途写入（内容相同）；另对 `Entry already exists` 错误静默视为成功（防御）。
- `cacheFirst` 末尾补 `.catch`：无缓存且网络失败时返回显式 504 Response 并打日志，
  不再把 rejection 交给 respondWith。
- 导航路径 catch：缓存未命中时返回显式 503 离线提示页，不再 resolve undefined。
- 缓存版本 `_v13` → `_v14`。

## 验证

- 全新 profile 跑完整打开流程（覆盖字体/插件并发窗口）：
  `putInCache failed` / `FetchEvent network error` / `Failed to fetch` / pageerror 全部 0 条。
- 四项回归（save-reopen / insert-text / bin-insert / open-edit-save）全部 PASS。

## 追加（同日）：导航请求瞬时失败自愈

修复上线后观测到一次 `SW fetch failed: .../index.html — Failed to fetch` → 504：
localhost 开发服务器瞬时抖动（重启/瞬时并发）偶发抓取失败，缓存又没有该条目时
整个编辑器 iframe 直接挂掉。导航路径在回退缓存前增加**延迟 800ms 重试一次**，
缓存版本 `_v14` → `_v15`。

## 注意

- 用户浏览器里激活的 SW 可能仍是旧版本（日志里为 `_v11`）：SW 文件字节变化后浏览器会在
  下次导航时自动更新，但稳妥起见仍建议 Clear site data + 硬刷新一次。
- SW 缓存键的"版本段"取自 SW 自身 URL 的倒数第二段（恒为 `vendor`），
  真正的失效手段只有 `_vN` 后缀——每次改 vendor 下静态资源务必 bump。
