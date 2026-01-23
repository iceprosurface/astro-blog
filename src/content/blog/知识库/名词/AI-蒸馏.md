---
title: AI 蒸馏
date: 2026-01-23T15:35:00+08:00
updated: 2026-01-23T15:35:00+08:00
permalink: /terminology/ai-distillation/
tags:
  - 术语
  - AI
ccby: true
draft: false
comments: true
no-rss: true
---

**知识蒸馏**（Knowledge Distillation）是机器学习领域的一种模型压缩（Model Compression）技术，旨在通过监督学习将一个大型、复杂、高性能的**教师模型**（Teacher Model）所习得的知识（Knowledge）提取并迁移到一个较小的、易于部署的**学生模型**（Student Model）中。

该概念由 Geoffrey Hinton 等人在 2015 年的论文《Distilling the Knowledge in a Neural Network》中正式系统化提出。

### 基本原理

知识蒸馏的核心思想是利用教师模型输出的**类概率分布**（Class Probabilities）作为“软目标”（Soft Targets）来引导学生模型的训练。

与仅包含单一正确类别的“硬目标”（Hard Targets，即 One-hot 编码）相比，软目标包含了教师模型对非正确类别的相似度判断（例如：在分类任务中判断一张图片为“狗”的同时，由于其具有“狼”的特征而给予较高的概率，这一分布蕴含了丰富的类别间拓扑关系）。

### 数学表达

在蒸馏过程中，通常使用带有**温度系数**（Temperature, $T$）的 Softmax 函数来平滑教师模型的输出分布：

$$q_i = \frac{\exp(z_i / T)}{\sum_j \exp(z_j / T)}$$

其中：
- $z_i$ 是模型的逻辑输出（Logits）。
- $T$ 为温度参数。当 $T > 1$ 时，概率分布变得更加平滑，使得学生模型能更充分地捕捉到教师模型对负标签（Negative Labels）的知识。

### 损失函数 (Loss Function)

蒸馏训练的总损失 $L_{total}$ 通常由两部分加权组成：
1. **蒸馏损失（Distillation Loss）**：学生模型预测分布与教师模型软目标分布之间的 Kullback-Leibler 散度（KL Divergence）。
2. **学生损失（Student Loss）**：学生模型预测与真实硬标签（Ground Truth）之间的交叉熵损失。

### AI 时代的演进

在生成式人工智能（AIGC）和大语言模型（LLM）语境下，知识蒸馏的应用范畴已从传统的模型规模缩减扩展至以下领域：

- **能力平移**：将万亿级参数模型（如 GPT-4）的推理逻辑、思维链（Chain of Thought）通过生成的合成数据迁移至轻量级开源模型。
- **特定领域适配**：利用通用强模型在特定私有语料上的推理结果作为监督信号，训练更高效的垂类小模型。
- **逻辑消解**：作为一种技术扩散手段，导致了领先者技术壁垒的快速“蒸馏性”流失，使得模型能力的领先窗口期极度缩短。

