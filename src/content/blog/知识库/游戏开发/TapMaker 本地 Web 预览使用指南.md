---
title: TapMaker Local Web：只用代码目录和入口启动本地预览
date: 2026-08-31T15:44:00+08:00
updated: 2026-08-31T16:34:23+08:00
permalink: /2026/tapmaker-local-web-preview/
tags:
  - TapMaker
  - 游戏开发
  - 工程化
ai:
  collected: false
  reviewed: false
  note: 本文由 GPT-5.6-sol 根据 TapMaker Local Web 公开仓库的当前实现重新整理，尚待人工复核。
  tools:
    - name: GPT-5.6-sol
      usage: 结构重写、技术说明与脱敏检查
ccby: true
draft: true
comments: true
no-rss: true
---

修改一行 Lua、调整一个按钮或替换一张图片，却要走完整的远程构建流程，往往会让开发反馈变得很慢。[TapMaker Local Web](https://github.com/iceprosurface/tapmaker-local-web-skill) 提供了另一条路径：在本机启动一个资源服务，让 Web Player 直接读取指定目录中的脚本和资源。

它不要求真实 Maker 项目，不要求 project id，也不要求部署缓存。启动预览只需要两个输入：本地代码目录和 Lua 入口。

<!-- more -->

> [!important] 免责声明
> 本项目是由社区开发者独立维护的非官方开源工具，仅供软件开发、技术研究、学习交流和本地调试使用。本项目与 TapTap、TapMaker 及其运营方、关联公司不存在隶属、授权、合作、赞助、认可或背书关系，也不代表 TapTap 或 TapMaker 官方立场。文中出现的产品名称、商标和标识归各自权利人所有。使用者应自行遵守适用的服务条款、开发者协议、软件许可和法律法规，并自行承担使用风险。本工具不应作为正式发布、生产部署或官方验收的替代方案。

## 最短使用方式

如果使用 Codex，可以把它作为 Agent Skill 一键安装：

```bash
npx skills add iceprosurface/tapmaker-local-web-skill -g -a codex -y
```

重启 Codex 后，直接提供代码目录和入口：

```text
使用 $tapmaker-local-web 预览本地项目。
代码目录：/absolute/path/to/game-content
入口：scripts/main.lua
```

Skill 自带可执行的 Python 实现，不需要从其他仓库复制脚本，也不会要求绑定远程 Maker 项目。

如果希望直接操作 CLI，可以克隆公开仓库：

```bash
git clone https://github.com/iceprosurface/tapmaker-local-web-skill.git
cd tapmaker-local-web-skill
uv sync --project skills/tapmaker-local-web/scripts
```

然后启动任意本地内容目录：

```bash
uv run --project skills/tapmaker-local-web/scripts tapmaker-local-web \
  web \
  --code /absolute/path/to/game-content \
  --entry scripts/main.lua
```

默认地址通常为：

```text
http://127.0.0.1:8765/?skip_login&verbose=true&screen_orientation=landscape&entry=scripts/main.lua
```

保存脚本或资源后，页面会自动重新加载。按 `Ctrl-C` 可以停止服务。

## 为什么不需要 project id

本地预览的资源来源就是 `--code` 指向的目录，入口则由 `--entry` 明确指定，因此工具不需要借助远程 project id 查找项目。

例如：

```text
--code  /project/game-content
--entry scripts/main.lua
```

工具实际读取的入口是：

```text
/project/game-content/scripts/main.lua
```

为了兼容 Player 协议，服务内部会根据规范化后的代码目录和 entry 生成一个稳定的本地命名空间。这个值只用于区分本地缓存：

- 不是 Maker project id；
- 不需要用户填写；
- 不用于远程查询或计费；
- 不会把本机代码路径写进浏览器 URL。

因此，对外操作模型可以概括为：

```text
代码目录 + Lua entry → 本地 manifest → Web Player
```

## 本地服务做了什么

启动后，工具会递归扫描代码目录，并把普通文件转换为 Player 可以读取的资源记录。

每条记录包含：

- 资源 UUID；
- 文件扩展名；
- CRC32；
- 文件大小；
- Player 使用的 `fs_path`；
- 是否属于启动阶段的 blocking 资源。

如果资源旁存在 `.meta`，工具会读取其中已有的 UUID；没有 `.meta` 时，则根据本地命名空间和虚拟路径生成稳定 UUID。`.meta` 本身不会作为游戏资源发布。

服务会动态提供这些端点：

| 地址 | 用途 |
| --- | --- |
| `/` | Player 页面 |
| `/latest.json` | 当前本地版本与 manifest client |
| `/project.json` | 本地协议信息与 entry |
| `/local/manifest-<client>.json` | 当前资源 manifest |
| `/assets/...` | 按需读取本地资源 |
| `/__tapmaker/revision` | 热重载状态 |
| `/UrhoXRuntime.*` | 本地 Runtime 模式下的核心文件 |

项目文件不会先复制到一个部署目录。Player 请求具体资源时，服务再从 `--code` 目录读取对应文件。

## 热重载原理

这里的热重载是“文件变化检测 + 整页刷新”，不是 Lua 函数级热替换。

浏览器每秒请求一次：

```text
/__tapmaker/revision
```

服务端会扫描代码目录，并以文件路径、纳秒级修改时间、文件大小和 `.meta` 状态构造 fingerprint。发现新增、删除或修改后：

1. 复用未变化资源的缓存记录；
2. 重新读取发生变化的文件；
3. 更新 CRC32、资源 URL 和 manifest；
4. 增加 revision，并生成新的 manifest client；
5. 浏览器发现 revision 改变后执行 `location.reload()`。

资源 URL 包含 UUID 和 CRC：

```text
/assets/<uuid>-<crc>.<ext>
```

因此文件发生变化后会产生新的资源地址，避免继续命中旧内容。由于最终执行的是整页 reload，Lua 内存状态和当前游戏进度都会重置。

当前实现采用轮询而不是文件系统 watcher。每次探活仍需遍历目录和读取文件元数据，但没有变化的文件不会重复读取内容或计算 CRC。大型仓库最好把 `--code` 指向最小的游戏内容目录。

## Runtime 的三种模式

### `auto`

默认模式。有完整的本地 Runtime 缓存时使用本地文件，否则回退到 CDN。

```bash
tapmaker-local-web web \
  --code /path/to/game-content \
  --entry scripts/main.lua \
  --runtime auto
```

### `local`

强制使用已同步的本地 Runtime。缓存不存在或校验不完整时直接报错，适合检查本地 Runtime 是否可用。

### `remote`

强制使用 CDN Runtime，适合排查本地缓存差异。

同步本地 Runtime：

```bash
uv run --project skills/tapmaker-local-web/scripts tapmaker-local-web \
  web-runtime sync
```

同步过程会下载并校验：

- `UrhoXRuntime.js`
- `UrhoXRuntime.wasm`
- `UrhoXRuntime.data`

只有三个文件全部通过大小和 CRC32 校验，缓存才会被视为可用。

本地 Runtime 只覆盖核心三件套。Player 外壳、engine-res、official-res 和未缓存的公共资源仍可能访问 CDN，所以不能把它描述成完全离线模式。

## 可交互的脱敏 Demo

仓库包含一个不依赖真实游戏内容的 demo：

```bash
uv run --project skills/tapmaker-local-web/scripts tapmaker-local-web \
  web \
  --code examples/demo-project \
  --entry scripts/main.lua \
  --runtime remote \
  --no-open
```

页面提供“开始游戏”“+1 加分”和“重置”按钮，可以检查：

- UI 是否实际渲染；
- 鼠标或触摸点击是否响应；
- Lua 状态是否更新；
- 修改入口后页面是否自动重载。

demo 只使用公开 UI 组件和普通示例数据，不包含真实项目代码、资源、UUID、凭据或部署配置。

## 本地平台 mock 的边界

使用 `skip_login` 启动 Player 时没有真实平台用户。为了让依赖基础用户信息的本地流程可以运行，工具默认在内存中包装入口，并提供最小替身：

- 固定的本地测试用户；
- 本地测试昵称；
- 页面生命周期内的 `clientCloud:Get/Set`。

原始入口会以内存别名加载，包装代码不会写回本地项目。需要观察没有 mock 的 Runtime 原始行为时，可以使用：

```bash
tapmaker-local-web web \
  --code /path/to/game-content \
  --entry scripts/main.lua \
  --no-platform-mock
```

这个 mock 不能证明以下能力可用：

- 真实 TapTap 登录；
- 真实云存档；
- 排行榜与广告；
- 平台权限；
- 远程项目绑定；
- production 行为。

涉及这些能力时，仍然需要使用受控的官方测试与发布流程验收。

## 隐私与安全边界

工具默认只监听 `127.0.0.1`，不会把本地项目上传到 Maker 或其他项目服务，也不会读取 `--code` 目录之外的文件。

以下内容会被自动排除：

- `.git`
- `.project`
- `.maker-mcp`
- `.env` 和其他隐藏路径
- `.venv`
- `node_modules`
- `__pycache__`
- 常见操作系统元数据

尽管如此，仍应把 `--code` 指向最小的游戏内容目录。其他未被过滤的普通文件可能进入本地 manifest，不要把包含无关文档或明文秘密的宽泛仓库根目录直接交给预览器。

使用下面的参数会让同一网络内的其他设备访问服务：

```bash
tapmaker-local-web web \
  --code /path/to/game-content \
  --entry scripts/main.lua \
  --host 0.0.0.0
```

本地服务没有登录保护，并允许跨源读取资源。只有在可信局域网内确实需要多设备测试时才应这样做，不能暴露到公网。

## 常见问题

### 页面打开后没有内容

先确认入口文件存在，并查看浏览器控制台与引擎日志。一个只执行 `print()` 的 Lua 文件不会自动产生可见画面；需要通过 UI、NanoVG、Scene 或其他渲染接口创建内容。仓库 demo 可以作为最小可见性检查。

### 修改文件后没有刷新

直接访问 `/__tapmaker/revision`，观察 revision 是否变化。然后确认修改的文件位于 `--code` 目录中，且没有被隐藏文件规则排除。

### 入口被拒绝

`--entry` 必须满足三个条件：

- 是相对于 `--code` 的路径；
- 指向实际存在的文件；
- 不包含 `..`，也不能越出代码目录。

### 看到 engine-res 或 official-res WARNING

不要只根据 WARNING 数量判断项目失败。应先核对项目资源的 manifest、UUID、CRC、`fs_path` 和 `/assets/...` 请求，再用代表性脚本、图片、音频或材质是否实际加载作为判断依据。

### 端口被占用

指定其他端口：

```bash
tapmaker-local-web web \
  --code /path/to/game-content \
  --entry scripts/main.lua \
  --port 8766
```

## 它适合什么，不适合什么

TapMaker Local Web 适合缩短这些工作的反馈时间：

- Lua 逻辑调整；
- UI 布局和按钮交互；
- 图片、音频、材质与 prefab 检查；
- manifest、UUID、CRC 与路径问题诊断；
- 本地平台替身下的基础流程验证。

它不适合替代：

- 真实账号与平台能力验收；
- 远程 Maker 环境验证；
- production 构建；
- 正式发布流程。

最重要的边界是：它保留 Player 的运行方式，但把项目资源来源替换为 localhost。这样可以快速验证本地代码，却不会把“本地能运行”包装成“已经完成官方环境验收”。

## 审查清单

在把文章或工具用于实际项目之前，可以按下面的清单复核：

1. 启动命令只需要 `--code` 和 `--entry`，没有真实 project id。
2. 代码目录没有包含私有文档、凭据或无关项目。
3. 页面入口实际执行，目标 UI 或玩法可见、可操作。
4. 修改代表性资源后，revision 变化并触发整页刷新。
5. 浏览器与引擎日志没有与本次修改相关的错误。
6. 真实平台能力仍通过正式测试流程验收。

项目代码、安装方式和最新参数以 [TapMaker Local Web GitHub 仓库](https://github.com/iceprosurface/tapmaker-local-web-skill) 为准。
