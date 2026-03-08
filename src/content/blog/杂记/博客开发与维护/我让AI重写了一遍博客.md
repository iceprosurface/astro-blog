---
title: 我让 AI 重写了一遍博客
date: 2026-01-20T13:25:11+08:00
updated: 2026-01-20T13:25:11+08:00
permalink: /blog/ai-rewrite-blog/
tags:
  - 博客开发
  - AI
ccby: true
comments: true
no-rss: false
---

## 古法手搓 vs 赛博念咒

曾经，为了在大屏上多显示两行文字，我可以在 CSS 的迷宫里转悠一下午；为了一个不明所以的 Webpack 报错，能把 StackOverflow 翻个底朝天。那时候写博客，七分靠在这个破烂的构建系统上修修补补，三分才是在写字。我们将这种纯手工打磨、每一行代码都浸透着脱发焦虑的工艺，尊称为——**古法编程**。

而现在？现在的版本 T0 答案必然是**今法编程**。

什么是今法编程（[vibe-coding](../../知识库/名词/Vibe-Coding.md)）？

就是打开 IDE，唤起 AI，然后开始念咒："给我重构这个组件，要骚，要快，要用 Next.js，不要给我整那是谁都没见过的怪异语法。"
然后你只需要做一件事：**Review（找茬）**。

![古法编程vs今法编程](https://cdn.iceprosurface.com/upload/md/202601201527258.jpg)

没错，上面这图都是 gemini 倾力相助。

看着 AI 在屏幕上以人类这辈子都无法企及的速度疯狂输出代码，我不禁感叹：这哪是编程啊，这分明是赛博资本家在压榨硅基劳工。但这感觉……**真香**。

就像你发现有个免费的高级打工人，随叫随到，还能自动端茶倒水，你唯一要做的就是验收一下工作成果。这种体验，谁用谁知道？

于是，看着我那个虽然还能跑但已经甚至都不太想打开的旧博客项目，一个大胆的想法诞生了：
**"既然你这么能写，把我的博客整个重写一遍不过分吧？"**

这个项目的重构，我大致只花了两个周末的时间。

准确地说，核心开发工作主要集中在上周末的周六和周日。我使用了 `opencode` 配合 `oh my opencode` 作为 Agent 调度中心，让它们在后台整整跑了两天。

在这 48 小时里，除了提供必要的**Prompt** 和编写少量的 AI 完全无法完成的核心逻辑外（其实主要是些需要 human-in-the-loop 的判断，但 AI 也给了很好的框架建议），我全程几乎没有介入具体的代码编写。从架构搭建到组件细节，整个项目的基础设施完全是由 AI 自主实现的。

甚至可以说，我更像是一个"项目经理"而不是"程序员"。AI 才是那个真正的"搬砖人"。

> [!important] 或许今天 AI 尚未由能完全独立的完成一项复杂的工作，但我相信这一天可能不太远了——或者说，已经不远了？


## 时代的洪流：从"力大砖飞"到智能编排

在过去的几个月里，我一直保持着高强度的 AI 辅助编程习惯。**Agent 工艺带来的效率提升不仅是显而易见的，更是不可比拟的。** 在公司的项目上，单人 + Agent Workflow 的搭建达到了 **1 + 1 = 4** 的夸张效率提升[注：实际编码时间占比约 20%，因此虽然编码效率提升 4 倍，但整体项目周期提升可能没有那么明显]。

这不是什么"提升一点点"，这是那种"别人还在写第一行代码，你已经完成整个功能模块"的碾压式提升。

面对这种级别的模式变迁，任何试图对抗的行为都无异于螳臂当车。我的前同事 [Xsw1m](../../朋友圈/Xsw1m.md) 曾提到至今他的同事还是对 AI 编程嗤之以鼻，但在我看来，**时代的洪流从来不会等待个人**。这种效率革命的发生并非偶然，而是源于两大历史进程的交汇：**算力的疯狂普惠** 与 **Agent 架构的代际演进**。

![算力的普惠](https://cdn.iceprosurface.com/upload/md/202601201416884.png)

### 1. 算力的普惠：力大砖飞的底气

我们正在经历一个疯狂的降本周期：**从 2022 年 11 月到 2024 年 10 月，同等性能的推理成本下降了超过 280 倍**[^1]。

这什么概念？就是以前花 2000 美刀能跑的模型，现在 7 美刀就能跑；或者说，以前用得像奢侈品的 AI 能力，现在白菜价随便买。这不是"降本"，这是"降价大甩卖"级别的狂欢。

依据我个人的体验，目前国产模型距离世界顶尖模型的差距大约在 **7 个月**左右[^2][^3]。这一感受也得到了 Epoch AI 报告和 Google DeepMind CEO Demis Hassabis 的印证：数据显示自 2023 年以来，中国 AI 模型平均落后美国 7 个月（范围 4-14 个月）[^2]；而在 CNBC 的访谈中，Hassabis 也表示中国模型可能只落后"几个月"[^3]。

这意味着，随着算力的指数级增长和顶尖模型蒸馏技术的优化，到今年年底，我们很可能在本地旗舰手机上就能运行 GPT-4 级别的模型，或者以忽略不计的成本调用它们。想想看，以前需要集群服务器才能跑的模型，现在揣在兜里就能跑——这变化，可以说是"从奢侈品到日用品"的跨越。

只要势头不改，**2026 很可能是 AI 应用"力大砖飞"的真正拐点。**

### 2. Agent 的进化：标准化与自主协作的元年

如果说 2024 年是大语言模型能力大爆发的一年，那么 **2026 年必然是 Agent 真正走向普罗大众的元年**。我们正在见证 Agent 从最基础的 **Tool Calling（工具调用）** 快速向更高层次的 **多智能体协作编排（Multi-Agent Orchestration）** 迁移。

这就像从"单个打工人"进化到"整个建筑团队"，从"手动操作"进化到"智能施工队"。

这种演进体现在三个维度：

*   **从单点到协作**：从 2023 年仅会被动响应 Function Calling 的机器人，进化为 2024 年以 **CrewAI**（角色导向的团队协作框架）[^4]、**LangGraph**（图驱动的工作流框架）[^5] 为代表的协作网络。LangChain 团队指出，CrewAI 采用角色模型模拟人类团队协作，而 LangGraph 则通过有向图提供更细粒度的控制[^5]。

简单说就是：以前的 Agent 像个"万能工具人"，你给什么它做什么；现在的 Agent 像个"专业团队"，有研发有设计有测试，互相配合互相监督。Agent 开始像人类团队一样分工（研究、写作、审查），这种"微服务化"的架构正在重塑 AI 应用。

*   **标准化互联**：**Model Context Protocol (MCP)** 的出现成为了 AI 的"USB-C 接口"，打破了系统间的孤岛[^6]。Anthropic 于 2024 年 11 月首次提出 MCP 作为开源协议，OpenAI 和 Microsoft 相继宣布支持[^7][^9]，Google Cloud 也于 2025 年 12 月宣布提供完全托管的远程 MCP 服务器[^8]。

这就像以前每个 AI 应用都得自己"造轮子"对接各种服务，现在有了统一接口，像 USB-C 一样即插即用。Anthropic 提了个想法，OpenAI 说了"好啊"，Microsoft 说"我也来"，Google 说"算我一个"，然后大家就开始一起干——这场景，放在几年前想都不敢想。随着 OpenAI、Google 等巨头的采纳，Agent 与外部系统的交互正在走向事实标准。

*   **从被动到主动**：现代 Agent 具备了 **自主规划（Autonomous Planning）** 能力，能够在最小人工干预下执行复杂任务。Gartner 预测到 2026 年底，**40% 的企业应用将嵌入 AI Agent**[^10]，相较于 2025 年不足 5% 的水平实现爆发式增长。

就是说，以前企业用 AI 还在"试试看"，现在直接"默认开"。这不是小步子，这是跑步前进的节奏。

### 3. 2026：普罗大众的 Agent 之年

所有这些技术进步最终汇聚成一个结论：**Agent 不再是极客的玩具，而是每个人日常生活的一部分。**

我们将看到 Agent 从"辅助工具"升级为自主管理工作流的"数字同事"；看到它们开始为消费者做购买决策，催生"Agent SEO"；甚至延伸到物理世界，驱动机器人和自动驾驶。当然，治理与安全挑战依然存在，但趋势已不可逆转。

就像以前说"智能手机会改变生活"时，还有一堆人觉得是噱头——现在看看，出门不带手机就像出门没穿裤子。AI Agent 也正在走这条路，而且走得更快。


[^1]: NVIDIA. How to Economics of Inference Can Maximize AI Value[EB/OL]. NVIDIA, 2025[2025-04-23]. https://nvidianews.com/how-to-economics-of-inference-can-maximize-ai-value

[^2]: Emberson L. Chinese AI models have lagged US frontier by 7 months on average since 2023[EB/OL]. Epoch AI, 2026[2026-01-02]. https://epoch.ai/data-insights/us-vs-china-eci

[^3]: InvestingLive. China only months behind US AI models, DeepMind CEO tells CNBC[EB/OL]. InvestingLive, 2026[2026-01-15]. https://investinglive.com/stock-market-update/china-only-months-behind-us-ai-models-deepmind-ceo-tells-cnbc-china-has-nearly-caught-up-20260115/

[^4]: IBM Developer. Comparing AI agent frameworks: CrewAI, LangGraph, and BeeAI[EB/OL]. IBM Developer, 2025[2025-03-20]. https://developer.ibm.com/articles/awb-comparing-ai-agent-frameworks-crewai-langgraph-and-beeai/

[^5]: LangChain Blog. LangGraph: Multi-Agent Workflows[EB/OL]. LangChain, 2024[2024-01-23]. https://blog.langchain.com/langgraph-multi-agent-workflows

[^6]: OpenAI. Model Context Protocol (MCP)[EB/OL]. OpenAI, 2025[2025-01-01]. https://openai.github.io/openai-agents-js/guides/mcp

[^7]: Cloud Wars. OpenAI and Microsoft Support Model Context Protocol (MCP)[EB/OL]. Cloud Wars, 2025[2025-04-16]. https://cloudwars.com/ai/openai-and-microsoft-support-model-context-protocol-mcp-ushering-in-unprecedented-ai-agent-interoperability

[^8]: TechCrunch. Google launches managed MCP servers that let AI agents simply plug into its tools[EB/OL]. TechCrunch, 2025[2025-12-10]. https://techcrunch.com/2025/12/10/google-is-going-all-in-on-mcp-servers-agent-ready-by-design/

[^9]: Cloud Wars. OpenAI and Microsoft Support Model Context Protocol (MCP)[EB/OL]. Cloud Wars, 2025[2025-04-16]. https://cloudwars.com/ai/openai-and-microsoft-support-model-context-protocol-mcp-ushering-in-unprecedented-ai-agent-interoperability

[^10]: CTimes Tech. Gartner: 40% of Enterprise Apps to Use AI Agents by 2026[EB/OL]. CTimes Tech, 2026[2026-01-12]. https://ctimes.tech/en/2026/01/12/gartner-40-of-enterprise-apps-to-use-ai-agents-by-2026/
