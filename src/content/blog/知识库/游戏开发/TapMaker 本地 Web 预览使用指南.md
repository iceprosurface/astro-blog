---
title: 我给 TapMaker 做了一个不需要 Project ID 的本地预览器
date: 2026-08-31T15:44:00+08:00
updated: 2026-08-31T16:37:10+08:00
permalink: /2026/tapmaker-local-web-preview/
tags:
  - TapMaker
  - 游戏开发
  - 工程化
ai:
  collected: false
  reviewed: false
  note: 本文由 GPT-5.6-sol 协助整理项目复盘，尚待人工复核。
  tools:
    - name: GPT-5.6-sol
      usage: 结构重写、技术说明与脱敏检查
ccby: true
draft: true
comments: true
no-rss: true
---

最近在做 TapMaker 项目时，我遇到了一个很实际的问题：远程预览适合最终验收，但不适合高频调 UI。

改一行 Lua、挪一个按钮或者替换一张图片，如果每次都要走完整的构建链路，真正写代码的时间反而没有等待多。于是我开始研究，能不能保留 Web Player 的运行环境，只把项目资源换成本机目录。

最后做出来的就是 [TapMaker Local Web](https://github.com/iceprosurface/tapmaker-local-web-skill)。

<!-- more -->

> [!important] 免责声明
> 这是社区开发者独立维护的非官方开源项目，仅供开发、学习、研究和本地调试使用，与 TapTap、TapMaker 及其运营方、关联公司不存在隶属、授权、合作、赞助、认可或背书关系，也不代表官方立场。它不能替代正式构建、平台能力验证或生产发布流程。

## 一开始，我以为它需要 Project ID

最初的设计思路很自然：提供 project id、本地代码地址和 entry，然后让预览器知道“现在要打开哪个项目”。

但继续拆协议后发现，这个问题其实问反了。

远程环境需要 project id，是因为服务端要根据它查找项目、权限和资源。本地预览的资源已经由用户明确指定，代码就在 `--code` 目录里，启动入口也由 `--entry` 给出。既然不需要去远程查询项目，就没有理由再让用户填写一个真实 project id。

真正必要的输入只有两个：

```text
本地代码目录 + Lua entry
```

Player 协议内部仍然需要一个用于区分缓存的标识，所以工具会根据代码目录和 entry 自动生成稳定的本地命名空间。它不是 Maker project id，不需要用户关心，也不会参与远程查询。

这个调整让工具从“某个工作区里的辅助命令”变成了一个独立工具：只要目录里有可运行的 Lua 入口，就可以尝试打开。

## 我实际上劫持的是资源来源

这里的“本地预览”并不是重新实现一套游戏引擎。

工具启动了一个 localhost 服务，按照 Web Player 能理解的格式提供 manifest、项目描述和资源文件。Player 仍然按照原来的方式启动，只是原本应该从远程读取的项目资源，现在改为从本机读取。

启动时，服务会扫描指定目录：

- 有 `.meta` 时沿用已有 UUID；
- 没有 UUID 时生成稳定的本地 UUID；
- 根据文件内容计算 CRC32；
- 把 Lua、图片、材质等资源写进本地 manifest；
- Player 请求具体资源时，再从本机目录读取文件。

所以这个工具的核心并不是“创建一个假的线上项目”，而是把资源加载这一段替换成 localhost。

## 热重载也比预想中简单

为了让它适合调试，还需要解决保存文件后的刷新问题。

当前实现没有引入复杂的文件监听服务。页面每秒请求一次 revision，服务端用文件路径、修改时间、大小和 `.meta` 状态判断目录有没有变化。

发生变化后，它会重建对应的资源记录和 manifest，然后让页面整页 reload。资源地址包含 UUID 和 CRC，因此修改后的文件会获得新的 URL，不会误用旧缓存。

它不是 Lua 函数级热替换，当前游戏状态会在刷新后重置。但对于 UI、脚本入口、图片和材质的快速检查，这种方式已经足够直接，而且实现与排错都比较简单。

## 做成公开项目后，脱敏比功能更重要

最初的代码来自自己的开发环境，整理成公开工具时不能简单地把原目录复制出去。

我最后把运行接口收敛成了 `--code` 和 `--entry`，删除了对特定工作区、项目清单、部署目标和真实项目 ID 的依赖。同时补上了几条安全边界：

- 默认只监听 `127.0.0.1`；
- 不把本机代码路径写进浏览器 URL；
- 拒绝越出代码目录的 entry；
- 自动过滤 `.git`、`.env`、`.project`、`.maker-mcp`、虚拟环境和其他隐藏目录；
- 不上传本地项目文件；
- 仓库 demo 不包含真实游戏内容、凭据或项目 UUID。

我还给 demo 加了一个真正可操作的界面，而不是只在控制台打印一句启动日志。现在打开页面后可以点击“开始游戏”“+1 加分”和“重置”，至少能够一眼确认 UI 渲染、点击响应和热重载是否正常。

## 它解决的是反馈速度，不是正式验收

本地预览可以检查 Lua 逻辑、UI、图片、音频、材质和资源路径，但它不会自动获得真实平台环境。

项目内置的本地账号和云值 mock 只用于让基础流程跑起来，不能证明真实登录、云存档、排行榜、广告或平台权限可用。涉及这些能力时，还是要回到正式测试和发布流程。

这个边界很重要：本地能运行，说明当前代码可以被 Player 加载；它不等于已经通过官方环境验收。

## 现在怎么使用

如果使用 Codex，可以直接安装成 Agent Skill：

```bash
npx skills add iceprosurface/tapmaker-local-web-skill -g -a codex -y
```

然后告诉 Agent 两个参数：

```text
使用 $tapmaker-local-web 预览本地项目。
代码目录：/absolute/path/to/game-content
入口：scripts/main.lua
```

也可以 clone 仓库后直接运行 CLI。完整安装方式、Runtime 模式、命令参数、测试与排错说明都放在项目 README 中，这里就不重复展开了。

项目地址：[iceprosurface/tapmaker-local-web-skill](https://github.com/iceprosurface/tapmaker-local-web-skill)

如果你也在开发 TapMaker 项目，并且觉得“改一行代码却要等一次远程构建”很影响节奏，可以试试这个本地反馈环。
