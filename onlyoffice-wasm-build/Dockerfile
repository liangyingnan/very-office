# ONLYOFFICE wasm 构建环境
# 基于官方 emsdk 镜像（已含 emcc / emscripten / python3 / cmake 等），再补 Node 与前端子构建依赖。
#
# 用法：
#   docker build -t oows-build -f Dockerfile .
#   docker run --rm -it -v "F:/JsWorkSpace/DocumentServer":/src/DocumentServer \
#                          -v "F:/JsWorkSpace/onlyoffice.github.io":/src/onlyoffice.github.io \
#                          -v "$PWD":/build oows-build bash
#
# 容器内工作目录 /build，脚本均假设源码挂载在 /src 下。

FROM emscripten/emsdk:latest

# 基础工具（emsdk 镜像通常已含 python3 / cmake / git，这里确保齐全）
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        make \
        git \
        ca-certificates \
        curl \
        jq \
    && rm -rf /var/lib/apt/lists/*

# 安装 Node.js（用于 sdkjs / web-apps 前端构建）
# 用官方 Node 22（含 npm）
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# 确认工具可用
RUN node --version && npm --version && emcc --version | head -1 && cmake --version | head -1

WORKDIR /build

# 默认进入交互；真正执行用 build.sh
CMD ["bash"]
