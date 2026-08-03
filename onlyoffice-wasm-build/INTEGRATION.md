# 把编译产物嵌入 electron + ts + react + vite 客户端

> 目标：将 `build/www/`（web-apps/sdkjs 前端 + x2t.wasm 转换核心 + drawio 插件）
> 以 **iframe / webview** 的方式，嵌入到你用 Electron + TypeScript + React + Vite 构建的客户端中。
>
> 本文是集成指南 + 可直接套用的代码片段。代码均为示意，路径按你的项目结构微调。

---

## 0. 前提

- 已按 README 完成构建，得到静态目录 `build/www/`（内含 `apps/`、`sdkjs-plugins/drawio`、`wasm/x2t.wasm` 等）。
- 你的客户端已是一个 Electron 应用（主进程 + 渲染进程用 React/Vite）。
- drawio 已在 `build/www/sdkjs-plugins/drawio`，编辑器启动后会**自动发现**，无需额外改动即可出现在插件面板。

---

## 1. 为什么必须“走 HTTP 服务”，不能直接 file://

web-apps 编辑器会：加载 wasm（需流式编译）、起 Web Worker、fetch 配置/翻译/插件清单。
这些在 `file://` 下会因 CORS / Worker / fetch 限制大面积失败。
**所以：在 Electron 主进程里把 `build/www` 作为一个本地静态服务暴露出来（如 `http://127.0.0.1:PORT/`），
再用 iframe/webview 加载它。** 不要直接用 `file://` 路径。

---

## 2. Electron 主进程：起一个本地静态服务并开窗

`src/main.ts`（或 `electron/main.ts`，按你的入口命名）：

```ts
import { app, BrowserWindow } from 'electron';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { MIME } from './mime'; // 见下方 MIME 小表

const WWW_DIR = path.resolve(__dirname, '../../onlyoffice-wasm-build/build/www');
const PORT = 0; // 0 = 让系统分配空闲端口，后面从 server.address() 取

function startStaticServer(rootDir: string): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // 防目录穿越
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let filePath = path.join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA/编辑器子路由回退到编辑器宿主页（见第 4 节）
          fs.readFile(path.join(rootDir, 'editor-host.html'), (e2, d2) => {
            if (e2) { res.writeHead(404); res.end('not found'); }
            else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(d2); }
          });
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, '127.0.0.1', () => {
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
}

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(async () => {
  const port = await startStaticServer(WWW_DIR);
  // 把端口透给渲染进程（通过环境变量或 IPC）
  process.env.EDITOR_BASE_URL = `http://127.0.0.1:${port}`;

  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true, // 若用 <webview> 则需开启
    },
  });
  mainWindow.loadURL('http://localhost:5173'); // 你的 Vite 渲染进程地址（开发）/ 打包后的 index.html（生产）
});
```

> 生产打包时，把 `build/www` 一起打进 `extraResources`，运行时用 `process.resourcesPath` 拼出真实路径。
> MIME 小表：`{ '.html':'text/html', '.js':'text/javascript', '.wasm':'application/wasm', '.json':'application/json', '.css':'text/css', '.br':'application/octet-stream' }`

---

## 3. React 组件：用 iframe（或 webview）嵌入编辑器

推荐先试 **`<iframe>`**（最简单，内容受信任且同源到本地服务）。需要隔离再用 `<webview>`。

`src/Editor.tsx`：

```tsx
import { useMemo } from 'react';

// 端口由主进程通过 preload 暴露（见 preload.ts）
declare global {
  interface Window { editorBaseUrl?: string; }
}

type Props = {
  fileType?: 'docx' | 'xlsx' | 'pptx' | 'pdf';
  documentUrl?: string;   // 要打开的文档（也由本地静态服务托管，或你客户端生成的 blob URL）
  title?: string;
};

export function Editor({ fileType = 'docx', documentUrl, title = 'document' }: Props) {
  const base = window.editorBaseUrl ?? 'http://127.0.0.1:0';
  // 加载第 4 节的宿主页，由宿主页用 DocsAPI 实例化编辑器
  const src = useMemo(() => {
    const u = new URL(`${base}/editor-host.html`);
    u.searchParams.set('fileType', fileType);
    if (documentUrl) u.searchParams.set('documentUrl', documentUrl);
    u.searchParams.set('title', title);
    return u.toString();
  }, [base, fileType, documentUrl, title]);

  return (
    <iframe
      src={src}
      style={{ width: '100%', height: '100%', border: 'none' }}
      allow="autoplay; fullscreen"
    />
  );
}
```

`src/preload.ts`（把端口安全传给渲染进程）：

```ts
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('editorBaseUrl', process.env.EDITOR_BASE_URL);
// 或用 ipcRenderer.invoke('get-editor-base-url')
```

> 若改用 `<webview>`：在组件里用 `<webview src={src} nodeintegration={false} />`，
> 主进程需 `webviewTag: true`。`<webview>` 运行在独立进程，隔离更好但调试稍麻烦。

---

## 4. 编辑器宿主页：用 DocsAPI 实例化（并启用 drawio）

在 `build/www/` 里放一个 `editor-host.html`（构建时由你的流程拷贝进去，或放 Vite public 里）：

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Editor</title></head>
<body>
  <div id="editor"></div>
  <!-- ONLYOFFICE 编辑器 API（路径按你构建出的 web-apps 实际位置调整） -->
  <script src="/apps/api/documents/current/api.js"></script>
  <script>
    const q = new URLSearchParams(location.search);
    const fileType = q.get('fileType') || 'docx';
    const documentUrl = q.get('documentUrl') || '';
    const title = q.get('title') || 'document';

    const config = {
      document: {
        fileType,
        title: title + '.' + fileType,
        url: documentUrl,            // 本地静态服务托管的文档；或在客户端里生成后传 blob URL
      },
      editorConfig: {
        mode: 'edit',
        lang: 'zh-CN',
        // 插件目录：drawio 已在 sdkjs-plugins/drawio，编辑器会自动扫描
        plugins: { url: '/sdkjs-plugins' },
        customization: { autosave: false },
      },
      // 注意：x2t.wasm 负责“转换”；若要让编辑器在浏览器内做格式转换，
      // 需在此把转换请求指向 /wasm/x2t.wasm（自定义集成，见 README “浏览器内调用 x2t.wasm”）。
    };

    // 实例化文档/表格/幻灯片编辑器（按 fileType 选择）
    const ctor = (fileType === 'xlsx') ? DocsAPI.DocEditor
               : (fileType === 'pptx') ? DocsAPI.DocEditor
               : DocsAPI.DocEditor;
    new ctor('editor', config);
  </script>
</body></html>
```

> 实际选择器：文档=`documenteditor`、表格=`spreadsheeteditor`、幻灯片=`presentationeditor`，
> 但 `DocsAPI.DocEditor` 这同一个构造器配合 `document.fileType` 即可区分，无需手动换类。

---

## 5. drawio 会自动出现

`build/www/sdkjs-plugins/drawio` 已就位，且 `bundle_drawio.sh` 已把它注册为默认插件。
宿主页里的 `plugins: { url: '/sdkjs-plugins' }` 指向该目录，编辑器启动后会列出 drawio，
插件面板中它默认启用，无需额外代码。

---

## 6. 必须知道的“还差一块”

把前端 + x2t.wasm + drawio 嵌进 Electron，**能跑通的是：编辑器 UI 加载、插件（drawio）显示、文档查看/基础交互**。
但 ONLYOFFICE 标准架构里，**实时协同编辑 + 文档转换**依赖一个 Document Server 后端：

- **转换（x2t）**：你已有 `x2t.wasm`，可在浏览器内做格式转换（自定义调用 `ccall _main1` + `FS`，见 README）。
- **实时编辑引擎**：标准 web 编辑器的“编辑核心”仍跑在服务端。要让编辑也完全在客户端，
  需要**编辑引擎的 wasm 化**（更大的独立工程，公开无现成方案）。在补齐之前，
  纯浏览器/Electron 内通常仍需要接一个 Document Server（本地或远程）来支撑编辑与协同。

> 结论：本集成让你“在自有客户端里呈现 ONLYOFFICE 编辑器并内置 drawio”；若要做到完全离线编辑，
> 还需补齐编辑引擎 wasm，或让客户端连接一个 Document Server 后端。

---

## 7. 快速核对清单

- [ ] `build/www/` 已生成，且含 `apps/`、`sdkjs-plugins/drawio`、`wasm/x2t.wasm`。
- [ ] Electron 主进程把 `build/www` 以 HTTP 暴露到 `127.0.0.1:PORT`。
- [ ] 渲染进程 `Editor.tsx` 通过 `iframe`/`webview` 加载 `/editor-host.html`。
- [ ] `editor-host.html` 里 `api.js` 路径与构建产物一致；`plugins.url` 指向 `/sdkjs-plugins`。
- [ ] 打开编辑器后，插件面板能看到并默认启用 drawio。
- [ ] （可选）需要离线转换时，再接 `x2t.wasm` 的浏览器内调用。
