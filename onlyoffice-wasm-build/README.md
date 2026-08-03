# ONLYOFFICE DocumentServer → WebAssembly 构建方案（含 drawio 默认插件）

> 目标：把 `F:\JsWorkSpace\DocumentServer` 编译为可在**纯浏览器**运行的 WebAssembly 编辑器，
> 并把 `F:\JsWorkSpace\onlyoffice.github.io` 仓库中的 **drawio** 插件默认内置。
>
> 本目录提供的是**构建方案 + 脚本脚手架**（基于 Docker/emsdk），需在具备完整工具链的
> Linux 构建机上运行。当前 Windows 开发机缺少 `emcc`/`emsdk`、`docker`、`cmake`、`make`，
> 无法在本机完成真实编译，因此这里给出可在构建机上“一键式”执行的脚本与说明。

---

## 0. 先讲清楚的现实

`DocumentServer` 是一个**聚合仓库（meta-repo）**，真正的代码在子模块里：

| 子模块 | 作用 | 是否需编译为 wasm |
|--------|------|-------------------|
| `core` | C++ 文档引擎（解析/渲染/转换） | **是**，这是 wasm 的核心产物 |
| `sdkjs` | 编辑器 JS 内核（与 wasm 核心通信） | 否（纯 JS，需构建） |
| `web-apps` | 编辑器前端 UI | 否（纯 JS/HTML/CSS，需构建） |
| `server` | Node.js 服务端（原生核心在此跑） | 纯浏览器方案里**不需要** |

要点：

1. **标准自托管 Document Server 的服务端核心是原生库**，不是在浏览器里跑 wasm。
   你选了“纯浏览器 wasm 编辑器”，意味着要把 `core` 这个 C++ 引擎编译成 wasm，
   让文档解析/渲染/转换直接在浏览器侧完成。
2. 你本地已经有社区已验证的基线项目 **`F:\C++WorkSpace\onlyoffice-x2t-wasm`**
   （CryptPad 出品，core 版本 **v9.3.0.140**）。它把 ONLYOFFICE 的 **文档转换引擎 X2tConverter**
   编译成 wasm，产出 **`x2t.wasm` + `x2t.js`**（及 `.br`/`.zip` 变体）。
   这负责 docx/xlsx/pptx/odf/pdf/rtf/epub… 等格式的**转换/渲染**，是“可在浏览器跑的 wasm 核心”里
   **已验证可做**的那一块。它的构建是 **qmake + emscripten**（不是 CMake），由 `embuild.sh`
   驱动，用 Docker 跑整套（`build.sh` 内部是 `docker build --target output`）。
3. **它【不是】在线编辑引擎。** 标准 DocumentServer 里，浏览器编辑器（sdkjs/web-apps）的实时编辑
   核心运行在**服务端**；`x2t` 只是服务端的 FileConverter。把 *x2t.wasm* 放进浏览器，只能让**转换**
   在客户端跑（这正是 CryptPad 的需求）。若你要的是“完整浏览器端编辑器”（编辑也在浏览器），
   编辑引擎的 wasm 化是**另一项更大的工作**，公开仓库没有现成一键方案。
   本方案以 “x2t 转换核心 wasm 化 + 前端构建 + drawio 内置” 为可落地基线，并预留扩展到编辑引擎的接口。
4. **版本对齐（重要）**：x2t-wasm 的 `core` 是 **v9.3.0.140**，而你 `DocumentServer/core` 是
   **v9.4.0.131**。wasm 核心与前端(sdkjs/web-apps)版本不一致可能导致格式/序列化不匹配。
   建议二选一统一版本：把 x2t-wasm 的 core 用
   `git subtree pull --prefix core https://github.com/ONLYOFFICE/core.git v9.4.0.131 --squash`
   升到 9.4，或让前端也用 9.3 的对应版本。
3. 本机无法验证编译结果，请按 `build.sh` 在 Linux 构建机（或本机装好 Docker 后）执行。

---

## 1. 目录结构

```
onlyoffice-wasm-build/
├── README.md                # 本文件
├── Dockerfile               # emsdk + Node 构建环境
├── build.sh                 # 总编排：core(wasm) + sdkjs + web-apps + bundle drawio
├── build_core_wasm.sh       # 仅【收集】你已在 WSL+Docker 编好的 x2t.wasm/x2t.js（不负责编译）
└── bundle_drawio.sh         # 把 drawio 插件复制进产物并注册为默认插件
```

外部依赖（脚本里用绝对路径引用，按需修改）：

- `DOCUMENTSERVER_ROOT = F:/JsWorkSpace/DocumentServer`  （含 core/sdkjs/web-apps 子模块，已检出，core=v9.4.0.131）
- `PLUGINS_REPO_ROOT    = F:/JsWorkSpace/onlyoffice.github.io` （插件市场仓库）
- `X2T_WASM_DIR         = F:/C++WorkSpace/onlyoffice-x2t-wasm` （本地已验证的 wasm 转换核心构建，core=v9.3.0.140）
- `DRAWIO_SRC           = $PLUGINS_REPO_ROOT/sdkjs-plugins/content/drawio`

---

## 2. 前提条件（构建机）

- Linux x86_64（推荐 Ubuntu 22.04+），或本机装好 Docker Desktop 的 Windows/WSL2。
- **Docker（必需）**：x2t 转换核心的编译由 `onlyoffice-x2t-wasm` 的 Docker 构建完成
  （其内部已自带 emsdk 4.0.11 + Qt6 + boost + openssl 等全套依赖）。构建机必须有可用的 Docker daemon。
- **Node ≥ 22（必需）**：用于构建 sdkjs / web-apps 前端。可用本目录 `Dockerfile`（emsdk+Node）统一环境，
  也可直接在装好 Node 的 Linux 上跑阶段二。
- 磁盘 ≥ 30 GB、内存 ≥ 8 GB（wasm 链接阶段很吃内存，建议 16 GB）。
- 已 `git submodule update --init --recursive` 拉全 `DocumentServer` 的子模块
  （你本地已经检出了 `core`/`sdkjs`/`server`/`web-apps`，构建机上请同样确认）。

---

## 3. 构建步骤总览（分两阶段）

> 构建机需同时具备 **Docker**（给 x2t 核心编译）与 **Node ≥ 22**（给前端构建）。

**阶段一 · 编译 wasm 转换核心（在 WSL 里直接用项目自带脚本，无需本目录脚本）**
```bash
# 在 WSL 中（路径按 WSL 挂载，例如 /mnt/f/C++WorkSpace/onlyoffice-x2t-wasm）
cd /mnt/f/C++WorkSpace/onlyoffice-x2t-wasm
./build.sh          # 内部 docker build --target output，产出 build/x2t.wasm + build/x2t.js
```
> 这一步由你直接在 WSL+Docker 里跑 x2t-wasm 自带的 `./build.sh`，本目录的脚本不参与编译。

**阶段二 · 收集 x2t 产物 + 构建前端 + 内置 drawio（需要 Node）**
```bash
cd F:\JsWorkSpace\very-office\onlyoffice-wasm-build
./build_core_wasm.sh   # 仅把阶段一产出的 x2t.wasm/x2t.js 复制到 build/wasm/
# 可选：用自带 Dockerfile 提供 Node 环境（含 emsdk，便于统一）；或直接在本机装好 Node 后运行：
./build.sh             # 构建 sdkjs/web-apps -> build/www；收集 x2t 产物；调 bundle_drawio.sh
```

**产出**：`build/www/` 即可静态托管，用任意 HTTP 服务（`python3 -m http.server`）打开即可。
drawio 插件位于 `build/www/sdkjs-plugins/drawio`，并被注册为默认插件。

---

## 4. drawio 默认内置的原理

ONLYOFFICE 插件的识别靠每个插件目录下的 `config.json`（含 `name` / `guid` / `variations.url` 等）。
drawio 的清单关键字段：

```json
{
  "name": "draw.io",
  "guid": "asc.{DB38923B-A8C0-4DE9-8AEE-A61BB5C901A5}",
  "version": "1.0.5",
  "variations": [ { "url": "index.html", "icons": ["resources/light/icon.png", ...] } ]
}
```

“默认内置 / 默认启用”做两件事：

1. **把插件目录放进构建产物的插件目录**（如 `build/www/sdkjs-plugins/drawio`），
   编辑器启动时会扫描该目录自动发现插件。
2. **注册为默认已安装**：把 drawio 的 `guid` 加入编辑器读取的“默认插件列表”
   （通常是 `web-apps` 的编辑器配置 `config.json` 里的 `plugins` 项，或 sdkjs 的默认插件常量），
   这样插件面板里 drawio 一开始就是启用状态，无需用户手动安装。

> 注：具体“默认插件列表”的字段名/位置会随 ONLYOFFICE 版本变化，`bundle_drawio.sh`
> 里用变量 `DEFAULT_PLUGINS_CONFIG` 标注了常见位置，请按你的版本核对后微调。

---

## 5. 已知坑 & 下一步

- **x2t 编译在 WSL+Docker 中直接进行**：阶段一由你在本机 WSL 里运行 `onlyoffice-x2t-wasm` 自带的 `./build.sh`
  （内部 `docker build --target output`），本目录脚本不调用 Docker。
  本目录的 `build_core_wasm.sh` 只负责把已编好的 `x2t.wasm`/`x2t.js` 收集到 `build/wasm/`。
- **版本对齐（必做）**：x2t-wasm 的 core 是 v9.3.0.140，DocumentServer 前端是 v9.4.0.131。
  先统一版本再构建，否则 wasm 核心与前端可能出现格式/序列化不匹配。
- **wasm 链接内存**：x2t 链接阶段较吃内存；x2t-wasm 的 Dockerfile 已用 `-Os` 并在必要时可加 `-sINITIAL_MEMORY`。
- **core 补丁**：x2t-wasm 已自带 `patches/harfbuzz.patch` 与对 core 的小改动（git diff 可见），直接复用即可。
- **编辑引擎 vs 转换引擎**：本方案产出的是**转换**核心（x2t.wasm）。若你要浏览器内**实时编辑**的
  wasm 引擎，那是另一项更大的工作，公开无现成一键方案，建议持续跟踪 CryptPad / ONLYOFFICE 社区。
- **浏览器内调用 x2t.wasm**：标准 DocumentServer 的转换在服务端完成；要在浏览器用 x2t.wasm 需自定义集成——
  通过 emscripten 的 `ccall` 调导出函数 `_main1(xmlPath)`，并用 `FS` 传入/取出文档（见 `pre-js.js` 与 `wrap-main.cpp`）。
- **验证**：阶段二完成后用 `python3 -m http.server` 起静态服务，浏览器打开编辑器，
  确认文档能加载、drawio 出现在插件面板且默认启用。

---

## 6. 参考

- CryptPad 的 wasm 构建基线：https://github.com/cryptpad/onlyoffice-x2t-wasm
- Emscripten 官方：https://emscripten.org/docs/getting_started/downloads.html
- ONLYOFFICE 官方文档：https://helpcenter.onlyoffice.com/
- 插件开发文档（config.json 字段含义）：https://api.onlyoffice.com/plugin/concepts
