# 全品牌替换：ONLYOFFICE → 锐小招

**时间**：2026-08-03
**项目路径**：`F:\JsWorkSpace\very-office`

## 背景

离线版 ONLYOFFICE 编辑器（外壳页 + web-apps 编辑器 UI + 插件市场）需要整体更换产品品牌为「锐小招」，
替换所有**用户可见**的 ONLYOFFICE 品牌字样与图标。

## 改动清单（全部为 UI 可见层）

### 1. 入口页面（外壳 + 编辑器宿主）
| 文件 | 改动 |
|------|------|
| `office.html` | `<title>`、`<h1>`：`ONLYOFFICE Personal` → `锐小招` |
| `onlyoffice.html` | `<title>`：`OnlyOffice` → `锐小招`；alert 文案 `OnlyOffice API 未加载` → `锐小招 API 未加载` |

### 2. web-apps 编辑器页面标题（27 个文件，含 .deploy / index_loader 副本）
- `ONLYOFFICE Document Editor` → `锐小招 文档编辑器`
- `ONLYOFFICE Presentation Editor` → `锐小招 演示文稿编辑器`
- `ONLYOFFICE PDF Editor` → `锐小招 PDF 编辑器`
- `ONLYOFFICE Visio Editor` → `锐小招 Visio 编辑器`
- `ONLYOFFICE Documents` → `锐小招`
- 涉及：`apps/{documenteditor,spreadsheeteditor,presentationeditor,pdfeditor,visioeditor}/main/index*.html*`、
  `apps/api/documents/{cache-scripts,preload}.html`、`apps/common/index.html(.deploy)`、wopi ejs

### 3. embed 浏览器兼容提示（17 个文件）
`Sorry, ONLYOFFICE Document is currently only supported...` → `Sorry, 锐小招 ...`（各编辑器 embed/index*.html*）

### 4. Logo SVG（4 个，保留四色图形，文字路径改为 `<text>锐小招</text>`）
| 文件 | 用途 | 文字颜色 |
|------|------|----------|
| `apps/common/main/resources/img/about/logo_s.svg` | 关于对话框（浅色主题） | #333333 |
| `apps/common/main/resources/img/about/logo-white_s.svg` | 关于对话框（深色主题） | #ffffff |
| `apps/common/main/resources/img/header/header-logo_s.svg` | 编辑器顶部 logo | #fff |
| `apps/common/main/resources/img/header/dark-logo_s.svg` | 编辑器顶部 logo（浅色主题） | #444 |

> SVG 作为 CSS background 使用，`<text>` 元素可用系统字体（Microsoft YaHei / PingFang SC）渲染。

### 5. favicon
`assets/favicon.ico`：用 PIL 重新生成（蓝底渐变圆角 + 白色「锐」字，微软雅黑粗体），
尺寸 16/24/32/48/64/128/256，蓝色 `#245bdb` 与外壳页 `--accent` 一致。

### 6. 插件市场 plugins-store
- `index.html` / `plugin-card.html`：分类标签 `By ONLYOFFICE` → `By 锐小招`
- `translations/*.json`（15 种语言）：key `"By ONLYOFFICE"` → `"By 锐小招"`，翻译值同步替换

### 7. Service Worker 缓存版本
`../9.4.0.131/vendor/document_editor_service_worker.js`：`g_cacheName` / `g_fifoCacheName` 版本 `_v5` → `_v6`，
强制已注册用户重新缓存更新后的资源。

## 明确不动的部分（重要）

- **`ONLYOFFICEFORM`**：PDF 格式签名，`apps/common/index.html`、各 embed/index.html 中保留原样，改了会破坏格式识别
- **sdkjs 内核**：API 名（`asc_putOnlyOfficeTime` 等）、注释、文档链接均不动（无 UI 可见性）
- **插件内 ONLYOFFICE**：均为注释 / 上游 GitHub 链接（`github.com/ONLYOFFICE/...`），属功能性引用，保留
- **项目文档**（AGENTS.md / .record / docs）与 `.record/backup-sdkall/*.bak`：保留
- `plugins-store/scripts/code.js` 中 GitHub 仓库 URL：功能链接，保留

## 验证结果

- web-apps 全部 HTML 中用户可见 ONLYOFFICE 残留：**0**
- 4 个 SVG 通过 XML 解析校验，HTTP 200 且含「锐小招」
- favicon 正常返回（28.6KB）
- 全局审计确认剩余 ONLYOFFICE 均为文档 / 内核 API / 上游链接 / 备份

## 结论与下一步

- 品牌替换完成，编辑器标题栏、关于对话框、加载页、错误提示、favicon、插件市场分类全部为「锐小招」。
- 验证方式：`python -m http.server 8000` 后打开 `office.html`；
  老用户需强刷（Ctrl+F5）或等 SW `_v6` 自动更新后重新缓存。
- 后续如需改 About 对话框产品名（当前显示本地化编辑器名如「文档编辑器」），可在 `office-config.js`
  的 `editorConfig` 中传 `customization` / `appName` 配置。
