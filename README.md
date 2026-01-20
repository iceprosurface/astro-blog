# Astro Blog - 数字花园迁移方案 (Digital Garden Migration)

> 这是一个基于 Astro 框架构建的数字花园，从 [quartz-blog](https://github.com/iceprosurface/quartz-blog) 迁移而来。本项目是一个 100% 由 AI 驱动开发的实验性产物，旨在验证复杂系统迁移的可行性。

## 🚨 极高风险警告 / EXTREME CRITICAL WARNING

> **🛑 严禁 Fork！严禁直接运行！严禁将内部代码用于生产环境！**
>
> **STOP: Do NOT fork, clone, or use this code for any purpose. IT IS AN EXPERIMENTAL ARTIFACT.**

本项目是 **AI 生成的实验产物**，内部包含大量由不同 AI 模型交织生成的非标准逻辑、潜在的安全隐患以及极度复杂的路径耦合。
**在任何情况下，都不要尝试直接复用本项目代码。你可能会面临无法维护、数据丢失或路径映射完全错误的后果！**

### 🌟 核心亮点 / Key Features

- **PathMapper 核心引擎**
  一套基于相对路径的单例映射系统，负责全站链接的规范化、Permalinks 生成以及文件夹层级解析。
- **无损链接对齐 (Link Alignment)**
  自研 Rehype 插件，支持 Wikilinks 和相对链接的动态解析，确保 Obsidian 风格的笔记可以直接在 Astro 中完美渲染，无需手动修改链接。
- **SEO 完全兼容**
  内置历史 URL 重定向系统 (`redirects.json`) 与语义化路径管理，确保从旧平台迁移后的 SEO 权重不受影响。
- **增强型 Markdown 生态**
  支持 Callouts (Obsidian 风格)、MathJax、脚注与异步目录生成。

### 🤖 AI 实现说明 / Implementation Notes

- **AI 浓度**: **95%+** 的代码完全由 AI 辅助编写。
- **提示词规模**: 累计消耗约 **80,000+** 字的 Prompts（含 AI 生成和人工创建）。
- **人工干预**: 仅约 **4%** 的核心代码（主要是路径映射边界情况）由人工进行“手术刀式”修正。

---

## 🏆 核心开发团队 / Credits

本项目由一支专业的 AI 明星团队倾情打造：

+ **首席调度官(Director)**:**GLM4.7** -负责全局统筹与指挥。
+ **首席架构师(Chief Architect)**:**GPT 5.2** -负责整体规划与逻辑构建。
+ **视觉魔法师(UI Designer)**:**Gemini 3 Pro/Flash**-负责 UI 编写与像素级审美。
+ **特击攻坚手(Specialist)**:**CLaude 4.5 Sonnet/0pus** -负责处理极端的逻辑挑战与疑难杂症。
+ **首席端茶送水官&一键三连工程师(iceprosurface)**:-负责提供电力能源、点击"生成"按钮以及在代码跑通时发出惊叹。

---

## ⚠️ 免责声明 / Disclaimer

1. **自用限定 / Personal Use Only**
   本项目是深度定制的“技术孤岛”，代码对第三方而言**极度不可靠且不规范**。
2. **AI 性质 / AI-Generated Nature**
   作者不保证其安全性、严密性或任何程度的“正确性”，亦不对 AI 引入的任何“非预期行为”负责。
3. **责任撇清 / Liability Disclaimer**
   **严禁将本项目作为生产模板！** 作者不承担任何法律责任，拒绝提供任何技术支持。

**请将其视为一份 AI 工程实验报告，而非一个可用的开源软件。**

---

## 📄 协议 / License

此项目的授权分为两部分：

### 1. 代码部分 / Source Code

本博客的源代码（包括但不限于 HTML, CSS, JavaScript, 模版文件、组件、插件）采用 [MIT License](./LICENSE) 授权。

The source code of this blog is licensed under the **MIT License**.

### 2. 内容部分 / Creative Content

本博客的内容授权根据文章类型不同，遵循以下原则：

**原创文章**（除非另有说明）：
- 采用 **[CC BY-NC-SA 4.0](./LICENSE-CONTENT)**（署名-非商业性使用-相同方式共享 4.0 国际）许可协议
- 转载或使用请遵守署名协议
- 文章底部会显示永久链接和授权声明

**转载内容**：
- 文章会显示"注意：本文转载自..."的提示
- 请遵循原作者的授权声明
- 阅读原文请点击文章中的原始链接

**知识库/笔记类内容**：
- 部分书籍笔记、方法论等可能不显示授权声明，因作者无法判断提供合适的授权声明

The blog content licensing follows:

**Original articles** (unless otherwise noted):
- Licensed under **[CC BY-NC-SA 4.0](./LICENSE-CONTENT)** International License
- Must comply with attribution requirements when reusing

**Reprinted content**:
- Shows reprint notice with original source
- Follow the original author's license

**Knowledge base/notes**:
- Some content may not show license (personal notes)
- Use with caution

[![CC BY-NC-SA 4.0](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)](./LICENSE-CONTENT)