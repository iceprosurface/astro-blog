---
title: TapMaker 本地 Web 预览：不上传资源的快速调试工作流
date: 2026-08-31T15:44:00+08:00
updated: 2026-08-31T16:10:00+08:00
permalink: /2026/tapmaker-local-web-preview/
tags:
  - TapMaker
  - 游戏开发
  - 工程化
ai:
  collected: false
  reviewed: false
  note: 本文由 GPT-5.6-sol 根据 tapmaker_workspace 源码与仓库操作规范整理，尚未经人工复核。
  tools:
    - name: GPT-5.6-sol
      usage: 源码梳理、文章写作与 Skill 创建
ccby: true
draft: false
comments: true
no-rss: false
---

TapMaker 项目的传统预览链路通常需要测试、物化源码、同步独立部署缓存，再调用 Maker 构建。这条链路适合验收真实平台行为，但如果只是改了一行 Lua、一张图或一个材质，等待完整远程构建就太重了。

`tapmaker_workspace.local_web` 解决的就是这个问题：它在 localhost 上临时生成 UrhoX Web Player 可读取的 manifest，直接把当前 worktree 里的脚本和资源暴露给官方 Player。整个过程不会上传项目文件，不会修改 Maker 部署缓存，也不会递增发布版本。

<!-- more -->

## 交给 Agent 一键操作

这套流程已经整理为独立的 [`tapmaker-local-web` Agent Skill](https://github.com/iceprosurface/tapmaker-local-web-skill)。它会指导 Codex 检查工作区、准备 Runtime、启动本地服务、完成浏览器验收，并在不需要保持运行时停止服务器。

用户级一键安装：

```bash
npx skills add iceprosurface/tapmaker-local-web-skill -g -a codex -y
```

安装后重启 Codex，然后直接请求：

```text
使用 $tapmaker-local-web 启动并验证当前 TapMaker 项目的本地 Web 预览。
```

下面的内容则详细解释这个 Skill 最终会执行的命令、背后原理和安全边界。

## 先看最短操作流程

进入 `tapmaker-workspace` 仓库根目录。这个仓库的 SDK 由 `mise` 锁定，因此不要绕过 `mise` 直接运行内部 Python 模块。

第一次使用时，先查看本地 Web Runtime：

```bash
mise exec -- bin/tapmaker web-runtime status
```

如果返回“未同步”，执行一次：

```bash
mise exec -- bin/tapmaker web-runtime sync
```

然后启动项目。以 `worldline-reincarnator` 的测试目标为例：

```bash
mise exec -- bin/tapmaker web worldline-reincarnator --deployment test
```

程序会打印类似下面的地址，并默认自动打开浏览器：

```text
http://127.0.0.1:8765/?skip_login&verbose=true&screen_orientation=landscape&local_engine=true
```

修改 Lua 或资源后保存即可。页面会检查本地 revision，发现变化后自动重载。调试完成后回到终端，按 `Ctrl-C` 停止服务。

> [!tip] 日常开发只需要重复最后一条 `web` 命令。Runtime 同步是用户级缓存，不必每次启动都重新下载。

## 两个命令分别做了什么

### `web-runtime sync`

这个命令会读取官方 engine CDN 的 `latest.json` 与 manifest，下载 Web Runtime 的三个核心文件：

- `UrhoXRuntime.js`
- `UrhoXRuntime.wasm`
- `UrhoXRuntime.data`

每个文件下载后都会校验大小和 CRC32，通过后才写入当前 Runtime 标记。只手动保存一个 `.wasm` 文件并不足以启动。

默认缓存位置是：

- macOS：`~/Library/Caches/TapMaker/web-runtime`
- Linux 等系统：`$XDG_CACHE_HOME/tapmaker/web-runtime`，未设置 `XDG_CACHE_HOME` 时使用 `~/.cache/tapmaker/web-runtime`

需要改位置时，可以使用 `TAPMAKER_WEB_RUNTIME_CACHE` 环境变量，也可以在命令上传 `--cache`。

### `web <project>`

这个命令读取工作区的 `tapmaker.workspace.toml`，再根据项目 `tapmaker.toml` 中的 mounts、entry 和 deployment 配置启动一个本地 HTTP 服务。

服务不会先把整个项目复制到临时目录。它会扫描每个 mount，将文件转成 manifest 记录，当 Player 请求 `/assets/<uuid>-<crc32>.<ext>` 时再读取对应的源文件。这也是它能直接反映 worktree 改动的原因。

## `local_web.py` 的代码结构

整个实现可以分为四层。

### 1. Runtime 缓存

`sync_web_runtime()` 负责下载和校验官方 Runtime，`current_web_runtime()` 通过 `current.json` 找到当前可用版本。

这层只本地化 UrhoX Runtime 三件套。页面 Player 外壳、`engine-res`、`official-res` 以及尚未命中缓存的官方资源仍可能访问 CDN，所以这是“项目文件不上传”，不是“完全离线运行”。

### 2. 项目快照与 manifest

`LocalWebProject` 把项目挂载树转成 `AssetRecord`，主要完成这些工作：

- 忽略 `.meta` 本身，但优先使用 `.meta` 里的 UUID。
- 没有 UUID 时，根据项目名和虚拟路径生成稳定 UUID。
- 为文件计算 CRC32 和大小，生成 Player 需要的资源名。
- 将 Lua、JSON、XML、material、prefab 等需要阻塞启动的文件加入 `#blocking` 组。
- 根据 deployment 生成 BuildInfo，并提供本地 `settings.json`。
- 过滤 `.DS_Store`、AppleDouble、`Thumbs.db`、`__MACOSX` 等系统元数据。
- 不同 mount 产生同一有效 `fs_path` 时直接报错，而不是静默覆盖。

扫描结果会使用文件修改时间、大小与 `.meta` 状态作为签名。没有变化的资源会复用已有 `AssetRecord`，避免每次探活都重新读取和计算所有文件。

### 3. 本地 HTTP 协议

`LocalWebServer` 基于 Python 的 `ThreadingHTTPServer`，对外提供 Player 启动所需的端点：

- `/`：本地 Player 页面。
- `/latest.json`、`/local/version.json`：本地版本信息。
- `/project.json`：项目信息和入口。
- `/local/manifest-<client>.json`：当前项目 manifest。
- `/assets/...`：当前 worktree 中的资源。
- `/__tapmaker/revision`：页面热重载探活。

返回中还会带上 COOP、COEP 与 CORS 相关 header，以满足 WebAssembly 和跨源资源的运行要求。

### 4. 页面热重载

本地页面每秒请求一次 revision。服务端发现挂载树变化后，更新 manifest 的 `client` 标识，页面随后执行 `location.reload()`。

本地 Runtime 的 `version` 始终是 `local`，与 `version.toml` 中的发布版本无关。变化的是 manifest client，而不是 version。这样可以保留稳定的 OPFS 资源缓存命名空间，避免每改一次源码就让按需资源全部重下。

## 常用参数

### 选择 deployment

```bash
mise exec -- bin/tapmaker web <project> --deployment test
```

deployment 决定本地预览使用的 entry 与 `.project` 配置。日常验证通常选 `test`，不应为了本地调试而操作 production 部署缓存。

### 不自动打开浏览器

```bash
mise exec -- bin/tapmaker web <project> --deployment test --no-open
```

### 更换端口

```bash
mise exec -- bin/tapmaker web <project> --deployment test --port 9000
```

### 选择 Runtime 模式

```bash
# 默认：有本地缓存就用本地，否则走 CDN
mise exec -- bin/tapmaker web <project> --runtime auto

# 强制使用本地 Runtime，未同步时直接报错
mise exec -- bin/tapmaker web <project> --runtime local

# 强制使用远程 Runtime，用于排查本地缓存差异
mise exec -- bin/tapmaker web <project> --runtime remote
```

### 局域网访问

```bash
mise exec -- bin/tapmaker web <project> --deployment test --host 0.0.0.0
```

此时同一局域网内的其他设备可以通过开发机 IP 访问。本地服务没有登录保护，还会允许跨源读取资源，因此不要绑定到公网网卡或把端口暴露给不可信网络。

## 本地平台 mock

Web Player 使用 `skip_login` 启动时，Runtime 自身的 `userId` 是 `0`。很多游戏会把这解释为“未登录”，进而无法进入正常流程。

`tapmaker web` 默认会动态包装项目入口，在执行真实入口之前注入一组最小 mock：

- `lobby.GetMyUserId()` 返回固定的本地用户 `900000001`。
- `GetUserNickname()` 返回“本地测试玩家”。
- `clientCloud:Get()` 和 `clientCloud:Set()` 提供当前页面生命周期内的内存存储。

这些代码只存在于 localhost 动态生成的入口，不会写回项目源码、部署缓存或远程构建。需要观察 Runtime 原始行为时可以关闭：

```bash
mise exec -- bin/tapmaker web <project> --deployment test --no-platform-mock
```

> [!warning] 这个 mock 只是让本地功能流程可以跑起来，不代表完成了 TapTap 真实登录、云存档、排行榜、广告或平台权限验证。

## 它与 `test` 和 `deploy` 的边界

| 命令 | 适合用途 | 上传/远程构建 | 修改发布版本 |
| --- | --- | --- | --- |
| `bin/tapmaker web <project>` | 日常 Lua、UI 和资源快速反馈 | 否 | 否 |
| `bin/tapmaker test <project>` | 执行项目声明的本地自动化测试 | 否 | 否 |
| `bin/tapmaker deploy <project> --target test` | 验收真实 Maker 环境、平台能力和远程预览 | 是 | 默认递增 |
| `bin/tapmaker deploy <project> --target production` | 发布已通过当次 test 验收的版本 | 是 | 默认递增 |

本地 Web 快的代价是它故意绕开了真实平台和远程构建环境。正确的工作流是：

1. 用 `web` 快速迭代。
2. 用项目测试与 Lua 静态检查保护基本正确性。
3. 需要真实平台验收时，通过仓库统一入口执行 `deploy --target test`。
4. 用户明确验收该次 test 后，才能对同一源码 revision 执行 production。

`web` 命令本身不会自动运行项目测试或静态检查，不要把“浏览器里能玩”当成完整验收。

## 常见问题

### CLI 提示没有 `web` 命令

先执行：

```bash
mise exec -- bin/tapmaker --help
```

如果子命令中没有 `web` 和 `web-runtime`，当前分支尚未包含本地 Web 预览功能。它最初由 `105fb509` 提交引入，本文所依据的资源缓存修复位于 [`66af4d61`](https://github.com/iceprosurface/tapmaker/commit/66af4d61d8af1777f1a3152f343e72e96091a5af)。

### `--runtime local` 提示尚未同步

运行：

```bash
mise exec -- bin/tapmaker web-runtime sync
mise exec -- bin/tapmaker web-runtime status
```

如果使用了自定义 `--cache`，`sync`、`status` 和 `web --runtime-cache` 必须指向同一个目录。

### 端口被占用

默认端口是 `8765`。换一个端口即可：

```bash
mise exec -- bin/tapmaker web <project> --deployment test --port 8766
```

### 报“无法唯一定位 Lua 入口”

平台 mock 需要在 mounts 中唯一找到 deployment 声明的 entry。检查 `tapmaker.toml` 的 entry 与 mounts 映射，不要让两个挂载映射出同一入口。只为排查问题时，可以临时用 `--no-platform-mock` 确认错误是否来自入口包装。

### 修改后没有刷新

先直接访问 `/__tapmaker/revision` 观察 revision 是否变化，再检查文件是否真的位于项目 mounts 中。热更新的实际行为是“整页重载”，因此当前内存状态会重置，它不是 Lua 函数级热替换。

### 看到引擎资源 WARNING

不要仅根据 WARNING 数量判断本地映射失败。先确认具体项目资源的 manifest 记录、UUID、CRC、`fs_path` 和 `/assets/...` 请求，再用代表性图片、音频、材质或脚本的实际加载结果判断。如果同一条官方 engine-res 或 official-res 告警在远程预览也存在，它可能是官方 Runtime 告警，而不是 `local_web.py` 的资源映射问题。

## 一个可复制的日常检查清单

1. 确认启动的 project 和 deployment 正确。
2. 使用手机横屏视口验证，默认可以按 `844 × 390` 检查。
3. 确认入口脚本已执行，目标功能可见或可操作。
4. 检查浏览器控制台与引擎日志，不能有与当次改动相关的 `ERROR`。
5. 实际加载一个本次改动涉及的代表性资源。
6. 调试结束后用 `Ctrl-C` 停止服务。
7. 需要平台事实或对外验收时，转入受控的 `deploy --target test` 流程。

## 源码入口

- [`local_web.py`](https://github.com/iceprosurface/tapmaker/blob/66af4d61d8af1777f1a3152f343e72e96091a5af/tools/tapmaker/src/tapmaker_workspace/local_web.py)
- [`cli.py`](https://github.com/iceprosurface/tapmaker/blob/66af4d61d8af1777f1a3152f343e72e96091a5af/tools/tapmaker/src/tapmaker_workspace/cli.py)
- [`test_local_web.py`](https://github.com/iceprosurface/tapmaker/blob/66af4d61d8af1777f1a3152f343e72e96091a5af/tools/tapmaker/tests/test_local_web.py)

这套本地预览的核心思路很简单：保留官方 Web Player 的运行方式，只把“项目资源从哪里来”替换为当前 worktree。它不试图伪造一个完整线上环境，而是专注于缩短日常修改的反馈回路。只要记住这条边界，它就是 TapMaker 日常开发中最省时间的工具之一。
