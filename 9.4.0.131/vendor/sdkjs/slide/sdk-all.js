/* __ooSdkAllStub — slide/sdk-all.js（未压缩版）已于 2026-08-11 瘦身删除。
 * 运行时只加载同目录 sdk-all-min.js。本 stub 仅用于兼容浏览器端旧 Service Worker / HTTP 缓存中
 * 残留页面（旧 preload.html / cache-scripts.html / index.html）对 sdk-all.js 的引用，
 * 避免 404 与 "Refused to execute script" 报错：
 *   - 若页面已引用 sdk-all-min.js（正常顺序），本 stub 空转；
 *   - 否则按当前脚本 URL 推导 sdk-all-min.js 并同步注入，保证旧页面仍能拿到 SDK。
 * 从 DocumentServer 重建 sdkjs 后，可用真实 sdk-all.js 覆盖本文件（本文件亦可直接删除）。 */
(function () {
    try {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            if ((scripts[i].src || '').indexOf('sdk-all-min.js') !== -1) { return; }
        }
        var cur = document.currentScript;
        if (!cur || !cur.src) { return; }
        document.write('<script src="' + cur.src.replace(/sdk-all\.js/, 'sdk-all-min.js') + '"><\/script>');
    } catch (e) { /* 兼容 shim：失败不影响主流程 */ }
})();
