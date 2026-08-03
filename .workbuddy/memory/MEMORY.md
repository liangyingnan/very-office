# 项目长期记忆（ONLYOFFICE wasm 编辑器 + 桌面客户端）

## 目标
把 ONLYOFFICE 编译成可在浏览器/客户端运行的 wasm 编辑器，并内置 drawio 插件，最终嵌入到
用户自建的 **Electron + TypeScript + React + Vite** 桌面客户端中。

## 本地相关仓库（均在 F:\JsWorkSpace\ 下）
- `DocumentServer` —— ONLYOFFICE 聚合仓库（子模块 core/sdkjs/server/web-apps）；前端构建源、core=v9.4.0.131。
- `onlyoffice.github.io` —— 插件市场仓库；drawio 插件在 `sdkjs-plugins/content/drawio`（guid: asc.{DB38923B-A8C0-4DE9-8AEE-A61BB5C901A5}）。
- `onlyoffice-x2t-wasm` —— CryptPad 出品（C++WorkSpace 下），core=v9.3.0.140；用 qmake+emscripten(Docker) 把
  X2tConverter 编成 wasm，产出 x2t.wasm/x2t.js（【转换引擎】，非实时编辑引擎）。用户在 WSL+Docker 直接编。
- `DesktopEditors` —— ONLYOFFICE 官方桌面版（子模块 core/sdkjs/web-apps/desktop-apps）；非 React/Vite，原生 C++ 核心；
  仅作 Electron 嵌入方式参考，实际嵌入对象是被构建的 wasm 版前端+核心。

## 已形成的构建/集成方案（F:\JsWorkSpace\very-office\onlyoffice-wasm-build\）
- `README.md` —— 总方案：两阶段（阶段一 WSL+Docker 编 x2t；阶段二 Node 编前端+drawio+收集），版本对齐提醒(9.3 vs 9.4)。
- `build.sh` —— 前端(sdkjs/web-apps)构建 + 收集 x2t 产物 + 调 bundle_drawio.sh。
- `build_core_wasm.sh` —— 仅收集已编好的 x2t.wasm/x2t.js（不编译）。
- `bundle_drawio.sh` —— 复制 drawio 插件到 build/www/sdkjs-plugins 并注册为默认插件。
- `Dockerfile` —— emsdk+Node 环境（给前端构建用）。
- `INTEGRATION.md` —— 把 build/www 嵌入 electron+react+vite 客户端的做法与代码片段。

## 关键事实 / 约定
- ONLYOFFICE 标准架构：浏览器编辑器实时编辑核心跑在服务端；x2t 仅服务端 FileConverter。
  x2t.wasm 只能让“转换”在客户端跑；完整浏览器端【编辑引擎】wasm 化是更大的独立工程（公开无现成方案）。
- 嵌入编辑器必须走 HTTP 服务（不能 file://），否则 wasm/Worker/fetch 失败。
- 版本需对齐：x2t-wasm(9.3.0.140) 与 DocumentServer 前端(9.4.0.131) 不一致会导致格式/序列化不匹配。
- 本机（Windows 开发机）无 Docker；x2t 编译交给用户 WSL+Docker。
