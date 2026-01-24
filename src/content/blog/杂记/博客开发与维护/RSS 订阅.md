---
title: RSS 订阅说明
date: 2024-07-03T22:16:57+08:00
updated: 2026-01-24T20:27:00+08:00
permalink: /blog/rss/
tags: 
ccby: false
draft: false
comments: true
no-rss: true
---
目前博客开放两个 RSS 订阅源：

**最新内容订阅**（显示最近 15 条）：
[https://iceprosurface.com/index.xml](https://iceprosurface.com/index.xml)

**全量订阅**（包含所有标记的文章）：
[https://iceprosurface.com/rss-full.xml](https://iceprosurface.com/rss-full.xml)

## RSS 收录策略

由于博客现在采用卡片笔记的方式存放大量的灵感和快速笔记，因此 RSS 订阅采用**主动标记**的收录策略：只有明确标记为需要发布到 RSS 的内容才会出现在订阅源中。

这样可以确保订阅者收到的都是经过整理的、有价值的内容，而不会被大量的碎片化笔记所打扰。

## 其他说明

- **excalidraw 图表**：RSS 中会排除所有的 excalidraw 渲染和内部显示，主要是因为不带交互的 excalidraw 体验不佳。保留了 data-excalidraw 地址，未来可能会考虑支持。
- **mermaid 图表**：RSS 中的 mermaid 图表会通过某些代码转图的服务来实现访问，不保证稳定访问。
- **no-rss 标记**：标记为 `no-rss: true` 的页面不会出现在 RSS 中。