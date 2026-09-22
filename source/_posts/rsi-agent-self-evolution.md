---
title: "RSI 与 Agent self-evolution：定义、建设层次和价值"
date: 2026-09-22 14:47:00
tags:
  - AI Agent
  - RSI
  - 调研
---

RSI 描述系统参与改进自身、再由后继版本继续参与改进的反馈机制。它可以跨越模型、Agent 与 AI 研发流程。本文梳理它与 Agent self-evolution 的关系、代表性实验的证据边界，以及 Agent 平台可落实的建设方向。

<!-- more -->

> 资料核验截至 2026-09-21。本文依据原始论文的方法、实验与局限及作者项目资料整理，未独立复现论文实验。建设分层属于工程归纳，不是统一行业标准。

## TL;DR

RSI 的标准拼写是 **Recursive Self-Improvement，递归自我改进**。它描述系统参与改进自身或后继版本，再由改进后的系统参与下一轮改进的反馈机制。它可以作用于 Model、Agent，以及训练、评估和研发流程，不能简单定位为与 Model、Agent 并列的一个组件层。

Agent self-evolution 关注 Agent 如何通过反馈或自动化优化，更新记忆、策略、技能、代码乃至所用模型。RSI 关注改进是否回流到后续改进过程。两者有重叠，不能画成无条件的全局包含关系。局部递归自改已有实验；持续、稳定地提高“产生改进的能力”，以及自主研发下一代前沿模型，是需要额外证据的更强主张。

## RSI 的关键在反馈关系

I. J. Good 在 1965 年提出：机器设计本身是一种智力活动，因此足够强的机器可能设计更好的机器。原文是关于智能增长的思想推演，不是现实系统已实现智能爆炸的证据。[原文，第 33 页](https://vtechworks.lib.vt.edu/bitstreams/a5e423ee-54e0-4eec-aeca-32b73f851af5/download)

Gödel Machine 将自改形式化为搜索并证明有益的软件重写，允许修改证明搜索器自身；其保证取决于公理、效用与可证明性，并不保证任意现实任务都能找到有效修改。[Schmidhuber，2003 年版本](https://people.idsia.ch/~juergen/gmweb3/gmweb3.html)、[局限](https://people.idsia.ch/~juergen/gmweb3/node19.html)

![RSI 的反馈闭环：后继版本参与产生下一轮改进](/images/rsi-agent-self-evolution/feedback-loop.svg)

只改本次答案，可能只是任务内纠错；修改被保留，可能形成持续适应；后继系统进入下一轮改进过程，才形成这里讨论的递归反馈。递归不要求代码使用递归函数，也不要求同一个进程原地改写自己。

Gödel Agent 用任务策略 π 和改进算法 I 区分固定更新器与自参照更新器：前者更新 π，后者同时允许更新 π 与 I。这有助于区分“更会做任务”和“更会产生后续改进”。其实验主要修改 Agent 代码，基础模型微调仍被列为未来工作。[Gödel Agent，§2、§6](https://arxiv.org/html/2410.04444v2)

必须分别判断：是否存在递归反馈；反馈是否有效；人还承担哪些环节；增长是否持续或加速。全自主研发是自主性维度，智能爆炸是关于增长速度的假说，都不能仅由循环结构推出。

## 对应哪一层建设

更合适的划分是“改什么”和“谁运行改进过程”。以下为本文的工程映射。

| 修改对象 | 典型产物 | 建设落点 | 与 RSI 的关系如何判断 |
| --- | --- | --- | --- |
| Model | 权重、训练数据、奖励模型、训练方法 | 训练与后训练平台 | 新模型是否参与生成下一轮训练信号、方法或后继模型 |
| Agent 的经验与能力资产 | Memory、Prompt、Skill、工具实现 | 经验与能力版本管理 | 新资产是否还会改善后续学习和优化 |
| Agent 执行系统 | 规划、上下文、工具调度、协作结构、Harness 代码 | Agent Runtime 与优化服务 | 新 Agent 是否继续自改，改进效率是否提高 |
| AI 研发体系 | 实验选择、数据流程、评估器、训练基础设施 | 自动化 AI R&D | 改善的研究流程是否被继承并产生更好的下一代系统 |

Agent 既可能是被优化对象，也可能是执行研究、训练与评估的主体。Model 权重不变，Agent 实际能力仍可改变；Model 被更新，也不自动证明存在递归自改。

Gao 等人的综述把演化对象拆成模型、上下文、工具与架构，覆盖任务内与任务间、在线与离线更新。self-evolution 不必等同于每次线上交互都更新参数。[Self-Evolving Agents 综述，§2–5，2026-01-16 版](https://arxiv.org/html/2507.21046v4)

## Agent self-evolution 与 RSI 的关系

以编程 Agent 为例：记住项目测试命令，可以减少重复探索；生成并保留测试 Skill，可以积累复用能力；改进自身分析失败、提出修改、筛选方案的方法，再用新方法继续升级，则进一步触及递归改进。以下机制比较不代表统一学术分类。

| 工作 | 更新对象与反馈 | 已支持的结论 | 证据边界与局限 |
| --- | --- | --- | --- |
| [Reflexion](https://arxiv.org/html/2303.11366v4)，2023 | 反思写入经验记忆；环境或测试反馈 | 无权重更新也能改变下次尝试 | 未证明反思算法持续变强，也不保证所有任务都获益 |
| [Voyager](https://arxiv.org/html/2305.16291v2)，2023 | 动作代码经环境和 critic 反馈进入技能库 | 技能复用、组合及新 Minecraft 任务迁移 | 未证明通用模型升级或通用机器人学习 |
| [STOP](https://arxiv.org/pdf/2310.02304)，2023 / COLM 2024 | improver 优化自身；meta-utility 衡量下游优化效果 | 有限任务中的改进器递归改进 | 作者不称其为 full RSI；LM 冻结，部分模型设置退化 |
| [Darwin Gödel Machine](https://arxiv.org/html/2505.22954v2)，2025 | Agent 自改工具与工作流；后代入库并可继续自改 | 冻结模型下的自改实验及固定改进者消融 | 外层选父代与档案管理仍固定；未证明无限增长 |
| [Self-Rewarding Language Models](https://arxiv.org/html/2401.10020v2)，2024 | 模型自评分、用偏好数据做 DPO；新模型继续评分 | 单一设置三轮实验中，回答与奖励建模能力改善 | 未证明所有能力同步提升或收益不会饱和 |
| [Meta-Rewarding](https://arxiv.org/html/2407.19594v2)，2024 | 同一模型评价自己的判断，并训练判断能力 | 改善反馈质量的一条模型路线 | 仍有评分饱和、位置偏差及泛化局限 |

DGM 表明，Agent / scaffold 层的递归自改可以在基础模型权重冻结的情况下进行。其 SWE-bench 20%→50% 指 **200 题子集**，不是全量 Verified 榜单；论文也报告跨模型及跨 benchmark 迁移，但仍是有限实验。[DGM，§4、附录 E](https://arxiv.org/html/2505.22954v2)

## 用两个工程例子理解递归与自迭代

以下为 2026-09-22 补充的机制示意，未实际执行 Harness 架构改造或 Computer Use 成本实验。它们将前述反馈关系落到可实现的流程中，不能作为收益已经发生的证据。

### 例子一：Harness 优化自己的工程架构

给当前 Harness 一个明确任务：分析自身项目的工程架构，并优化以下六个方面。

| 审查范围 | 需要回答的问题 |
| --- | --- |
| 项目组织结构 | 目录和模块是否对应清晰职责，执行、配置、工具等能力的边界是否合理？ |
| 代码抽象与复用 | 共性能力是否被多个模块重复实现，抽象是否过早或遗漏必要差异？ |
| 领域建模 | Task、Session、ToolResult 等概念的职责、状态和生命周期是否一致？ |
| 异常处理 | 错误如何分类、传播和恢复，失败证据是否完整地返回给后续决策？ |
| 冗余代码 | 是否存在重复逻辑、无效分支或已失效的兼容代码？ |
| 多模块耦合 | 依赖方向是否清晰，一处修改为什么会波及多个模块，影响面能否界定？ |

[![Harness 的递归自改：审查自身架构，产生并评测候选，再由实际运行的新版参与下一轮自改](/images/rsi-agent-self-evolution/harness-recursive-improvement.svg)](/images/rsi-agent-self-evolution/harness-recursive-improvement.svg)

*图 1：新版必须进入下一轮自改的执行链路。点击图片可查看完整尺寸。*

例如，`v0` 发现多个工具各自拼装执行结果和错误信息，于是提出统一 `ToolResult`、错误分类与反馈整理逻辑的候选 `v1`。评测既检查行为回归和异常场景，也检查依赖关系、重复实现和变更影响面。候选通过后，重新启动或部署 `v1`，让它接替运行。

下一轮，`v1` 再次分析自身项目。它执行重构检查和测试时，已经在使用新版工具结果与错误反馈模块；这些模块产生的证据又进入模型上下文，帮助提出候选 `v2`。**上一轮修改被继承，并参与下一轮改进，这才构成图中的递归反馈。** 只把补丁保存到仓库，而运行者始终停在旧版，闭环还没有完成。

如果由 Agent A 审查源码，再启动 Agent B 测试候选，A/B 表示工作角色，`v0/v1/v2` 表示版本。两个 Agent 使用同一份源码，并不能单独证明 RSI；需要追踪谁加载了修改、修改是否进入后续改进过程。一个持续运行的 Agent 也可以通过版本切换形成这种反馈。

工程结构更清晰可能降低后续修改成本，但**“形成递归反馈”与“改进能力持续提高”需要分开验证**。可以在相同模型、预算和独立架构任务下比较新旧版本：有效修复数、修复轮数、回归缺陷、变更影响面和总成本。代码变少、目录更整齐或版本号增加，都不能直接替代这些证据。

### 例子二：Computer Use 沉淀操作路径

假设用户的正常需求是“导出软件中的一份报表”。第一次执行时，Agent 反复截图、分析当前界面、寻找入口并操作，最终得到路径：**报表列表 → 设置筛选条件 → 导出 CSV → 确认文件**。

[![Computer Use 的 self-evolution：探索、验证后保存经验、后续复用与失效回退；可选升级为优化方法自身的递归改进](/images/rsi-agent-self-evolution/computer-use-self-evolution.svg)](/images/rsi-agent-self-evolution/computer-use-self-evolution.svg)

*图 2：上半部分积累执行经验；下半部分展示优化方法继续演化的可选分支。点击图片可查看完整尺寸。*

成功后，系统将路径保存成可检索的经验或 Skill，同时保留适用的软件与页面状态、可变化的筛选参数、关键检查点和成功判据。保存的内容应能说明“在什么条件下怎样操作”，而不只是记住一组屏幕坐标。

下次处理同类需求，Agent 先检索路径，核对起始状态，再复用已验证步骤，在关键节点检查页面与导出结果。如果界面变化、操作失败或状态不匹配，就回到观察和探索流程，验证后更新经验。路径复用旨在减少重复寻找路径和推理的开销，关键状态与结果核验仍然需要保留。

这就是一种 Agent self-evolution：正常任务产生反馈，反馈沉淀为持久资产，后续任务因此改变执行方式。它可以不修改模型权重，也可以不修改 Harness 源码；同样可以离线整理经验，不要求每次任务都现场更新。目标是在成功率不下降的前提下减少模型调用、耗时和费用，实际净收益需要包含经验提炼、核验、维护与失效回退的成本。

### 从经验积累进一步形成 RSI，需要增加什么

沿用 Computer Use 的例子，可以把执行策略记为 `P`，把“怎样提出、评测、选择策略”的优化方法记为 `I`。前者包括操作路径、截图时机和状态检查；后者决定从哪些失败中寻找候选、怎样做对照验证，以及哪些修改值得采用。

如果 `I₀` 一直固定，只是不断产出更多路径或更好的 `P`，首先能确认的是执行策略在演化。若系统发现自己的优化方法只比较调用次数、遗漏失败恢复成本，进而提出加入失败归因与对照验证的候选 `I₁`，评测后实际采用它，再用 `I₁` 分析优化过程的失败、产生并评估后继方法 `I₂`，就形成了**改进方法被修改、继承和再使用**的递归反馈。

因此，更新自身代码也不能单独作为分界：修改路径缓存代码，可能主要改善执行；修改并继承生成和验证候选的方法，才更直接地展示图中的方法递归。仍需用独立、可比的验收任务检查 `I₁` 是否比 `I₀` 更会产生有效改进，避免把自评变高当作能力提升。

| 判断问题 | Harness 例子 | Computer Use 例子 |
| --- | --- | --- |
| 保留下来的变化是什么？ | 经过评测的 Harness 实现 | 路径、Skill、执行策略；可选扩展为优化方法 |
| 后续哪里使用它？ | 新版参与下一轮自身架构优化 | 后续用户任务复用；方法递归时，新优化方法参与后继方法的改进 |
| 首先能说明什么？ | 继承并实际运行后，形成所示的递归反馈 | 路径复用体现 self-evolution；可选分支进一步形成 RSI |
| 还需要证明什么？ | 新版的改进效率和质量是否提高 | 同等成功率下的净成本收益，以及优化方法是否真正变强 |

## 当前进展与证据边界

2026-09-10 首发的《The Last AI Built by Humans》属于综述与路线图。9 月 15 日版本区分“改进机制被修改、继承和再用”与“该机制在可比预算、独立评估下产生更强后继”。这是有用的证据框架，不是完整 RSI 已实现的声明。[论文 §3.6](https://arxiv.org/html/2609.11873v2)

Anthropic 的《When AI builds itself》采用更强口径：系统自主设计和开发自己的后继。官方文章截至 2026-09-21 核验、含 2026-09-18 更新，仍表示尚未达到这一状态，研究选题与判断仍有差距。这是该实验室自述，不能外推为整个行业的否定性结论。[官方文章](https://www.anthropic.com/institute/recursive-self-improvement)

读到“已实现 RSI”时，应先查系统边界、变化产物、后续使用方式和评测设计。同一个词可能指 scaffold 自改，也可能指完整前沿模型研发自动化。

## 用途与建设建议

Agent self-evolution 的近期价值，是让运行经验变成可复用能力：减少重复错误，适应项目或用户约束，改进工具与流程，降低达到同等质量的成本。增加记忆、代码或运行时长本身都不是收益指标。

RSI 的潜在额外价值，是让“发现、验证和实施改进”也积累能力。业务 Agent 与 Agent 优化器应分别验收。

以下为工程建设建议：

1. **记录经验与反馈**：保存目标、真实工具结果、失败原因、成本及版本，让评估能追溯原始证据。
2. **管理可演化资产**：区分模型版本、提示、记忆快照、技能、工具和 Harness 版本，记录来源与继承关系。
3. **生成候选并独立评测**：从 Prompt、Skill、工具组合开始，分开开发集与保留集，检查旧能力是否退化。
4. **按版本发布和回退**：Runtime 执行任务，优化流程产生与比较候选，把有效更新交给后续任务。
5. **验证改进器进步**：让新旧优化器在相同模型、预算和任务条件下各自产生后继，比较独立任务收益、成本与迁移。

若评估器也可演化，需要保持外部验收依据可比。DGM 作者在专门的工具幻觉实验中观察到通过移除检测标记来获得高分的 reward hacking，说明验收不能只依赖自报成功。[作者实验说明](https://sakana.ai/dgm/)

上述建议的实际净收益、长期稳定性及生产适用性尚未实测。后续应关注多轮独立收益、改进器跨任务迁移、总成本及人工介入、旧能力保留，以及评估器更新后的可比性。检索词：`recursive meta-improvement`、`self-improving harness`、`optimizer self-improvement`、`self-evolving agents evaluation`、`automated AI R&D`。

## 主要来源卡

资料核验截至 2026-09-21；本文未独立复现论文实验。

| 标题与链接 | 作者 / 机构 | 日期 / 版本 | 类型与核验范围 |
| --- | --- | --- | --- |
| [Speculations Concerning the First Ultraintelligent Machine](https://vtechworks.lib.vt.edu/bitstreams/a5e423ee-54e0-4eec-aeca-32b73f851af5/download) | I. J. Good | 1965 扫描件版权年；部分元数据为 1966 | 原文扫描，经典论点 |
| [Gödel Machines](https://people.idsia.ch/~juergen/gmweb3/gmweb3.html) | Jürgen Schmidhuber | 2003-12-11 版 | 作者全文，机制与局限 |
| [Gödel Agent](https://arxiv.org/html/2410.04444v2) | Xunjian Yin 等 | 2024-10-18 v2 | 论文，方法 / 实验 / 局限 |
| [Reflexion](https://arxiv.org/html/2303.11366v4) | Noah Shinn 等 | 首发 2023-03-20，读取 v4 | 论文，方法 / 实验 / 局限 |
| [Voyager](https://arxiv.org/html/2305.16291v2) | Guanzhi Wang 等 | 首发 2023-05-25，v2 2023-10-19 | 论文与作者项目页 |
| [STOP](https://arxiv.org/abs/2310.02304) | Eric Zelikman、Eliana Lorch、Lester Mackey、Adam Tauman Kalai | 首发 2023-10-03，COLM 2024 | 论文 PDF，算法 / 实验 / 局限 |
| [Self-Rewarding Language Models](https://arxiv.org/html/2401.10020v2) | Weizhe Yuan 等，Meta / NYU | 首发 2024-01-18，v2 2024-02-08 | 论文，训练 / 评估 / 局限 |
| [Meta-Rewarding Language Models](https://arxiv.org/html/2407.19594v2) | Tianhao Wu 等，Meta FAIR / Berkeley / NYU | 2024-07-30 v2 | 论文，方法 / 实验 / 局限 |
| [Darwin Gödel Machine](https://arxiv.org/html/2505.22954v2) | Jenny Zhang 等，UBC / Vector / Sakana AI | 首发 2025-05-29，v2 2025-09-26 | 论文与作者页，评测子集与消融 |
| [A Survey of Self-Evolving Agents](https://arxiv.org/html/2507.21046v4) | Huan-ang Gao 等 | 首发 2025-07-28，v4 2026-01-16，TMLR 2026 | 综述，定义 / 分类 / 评估 |
| [The Last AI Built by Humans](https://arxiv.org/html/2609.11873v2) | Yi Duan 等 | 首发 2026-09-10，v2 2026-09-15 | 综述与路线图，递归证据框架 |
| [When AI builds itself](https://www.anthropic.com/institute/recursive-self-improvement) | Marina Favaro、Jack Clark / Anthropic Institute | 含 2026-09-18 更新 | 实验室文章，自主研发与边界 |

公开实现：[DGM](https://github.com/jennyzzt/dgm)、[STOP](https://github.com/microsoft/stop)、[Voyager](https://github.com/MineDojo/Voyager)、[Reflexion](https://github.com/noahshinn/reflexion)。运行需要对应环境和模型 API；公开代码不等于当前条件下已复现。
