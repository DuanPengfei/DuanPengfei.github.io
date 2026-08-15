---
title: DeepSeek Harness 与 Cordis：插件化 Agent 微内核的架构启示
date: 2026-08-15 18:54:54
tags:
  - AI Agent
  - DeepSeek
  - 调研
---

DeepSeek Harness 不是一个 DeepSeek API 包装器，而是一套把模型、工具、Session、沙箱、Agent Loop 和交互界面都做成可替换组件的 Agent runtime。真正值得研究的不是它的 Web UI，而是两条贯穿系统的约束：Cordis 管理插件的依赖与可逆生命周期，append-only Session 日志管理模型上下文、恢复、回放与审计。

<!-- more -->

> 本文是截至 2026-08-14 的源码研究快照。源码核查固定在 DeepSeek 官方仓库 commit [`47f9438`](https://github.com/deepseek-ai/deepseek-harness/commit/47f943859bef60e4160492346772ded9b24f765a)，避免把后续变化混入当时的判断。事实、架构判断与采用建议在下文分开表述。

## 先说结论

- 它更像“Agent 微内核 + 官方编码 Agent”，而不只是一个 CLI。
- “一切皆插件”不是口号：Cordis 负责响应式依赖和可逆注册，Session 日志负责统一数据真源。
- 代码中的架构约束相当完整，但研究时仍处于 Developer Preview，发布治理、稳定版本和公开实战证据都很早。
- 它适合架构研究、插件实验和隔离环境中的试点；不应仅凭项目热度直接进入关键生产链路。

## 研究基线与证据边界

本次研究只把官方仓库、固定提交中的源码和文档、官方 npm 元数据，以及 Cordis 论文仓库当作主要证据。

| 项目 | 研究快照 |
| --- | --- |
| 官方仓库 | [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) |
| 源码基线 | [`47f943859bef60e4160492346772ded9b24f765a`](https://github.com/deepseek-ai/deepseek-harness/tree/47f943859bef60e4160492346772ded9b24f765a) |
| 源码版本 | `0.1.0-rc.5` |
| 研究时 npm `latest` | [`@deepseek-ai/dsh` 的 `0.1.0-rc.6`](https://registry.npmjs.org/%40deepseek-ai%2Fdsh) |
| 许可证 | [MIT](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/LICENSE) |
| 理论背景 | Cordis 论文 [《A Programming Paradigm for Spatiotemporal Composability》](https://github.com/cordiverse/paper/blob/948a07b369c62adb3b12e102458be5c18dfb69b9/paper.pdf) |

这里有一个重要限制：研究时 npm 的 `rc.6` 高于仓库源码的 `rc.5`，但公开元数据不足以把这个 tarball 唯一对应到某个 Git commit。因此，本文谈架构时以固定源码提交为准，不把 npm 版本差异解释成已确认的代码变化。

## 它到底是什么

从官方[架构说明](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/architecture.md#L9-L52)与[包分层](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/README.md#L7-L69)看，DeepSeek Harness 可以分成六层：

| 层次 | 作用 |
| --- | --- |
| Profile / Bundle | 决定进程运行 Web、Headless 或自定义组合 |
| Cordis 插件树 | 提供 Service、typed events、依赖注入与可逆注册 |
| Agent Preset | 决定单个 Session 获得哪些工具、提示词和委派能力 |
| Core services | Session、System Prompt、Tools、Agent Loop 与 LLM |
| Capability seams | 文件系统、Shell、沙箱、Skills、Subagent、Workflow、Web、LSP 等 |
| Surface | Web UI、Headless CLI、ACP/JSON-RPC 与 Python SDK |

模型适配器、工具注册表、Session 日志和 Agent Loop 都是插件。常见能力按照 `Service Definition → Provider → Consumer` 拆分：Definition 定义稳定契约，Provider 提供实现，Consumer 只依赖契约。这使替换实现不必改写整个运行时。

我的判断是：它的核心资产是“插件化控制平面 + Session 事件数据平面”。出厂编码 Agent 只是这套平台的第一个重要消费者。

## 机制一：保持很薄的 Agent Loop

一个 Turn 可以包含多个 Step；每个 Step 对应一次模型请求及其工具执行。固定提交中的[主循环源码](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent-loop/src/agent.ts#L113-L400)大致呈现以下顺序：

```text
followup / steer / inject
→ inbox → turn/start → claim
→ assemble prompt/context → agent/pre-step
→ step/start → log user messages
→ derive model history → LLM stream
→ log assistant chunks/message
→ tool pipeline → step/end
→ turn/end
```

压缩、重试、权限、沙箱、计划模式、Subagent 和 UI 没有全部硬编码在这个循环里，而是通过事件和插件接入。这样做的直接收益是：策略可以替换，主循环不必复制；代价则是系统行为分散在插件图中，诊断工具和组合可视化变得非常重要。

## 机制二：工具调用先过受控流水线

官方的[工具执行说明](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/tool-execution-pipeline.zh.md)与[调度源码](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent-loop/src/tool-calls.ts#L121-L289)把一次调用组织为：

```text
记录 tool/call
→ tools/pre-execute
→ approval 与单调守卫
→ tools/execute
→ tool body
→ tools/post-execute
→ normalization
→ finalizeContent
→ tools/result
→ 将 tool/result 持久化到 Session
```

可并行的调用进入有界滚动池，独占调用形成 barrier。并行发生在工具主体，策略判断、结果持久化以及模型看到结果的顺序仍受到约束；没有可用审批通道时，`ask` 会按 fail-closed 处理。

这个设计的价值不只是“能调用工具”，而是把权限、并发、持久化和模型可见性放进同一条可检查的路径。对任何 Agent 平台来说，这比在各个工具内部零散补判断更容易审计。

## 机制三：模型可见意味着已经记录

Session 的核心不变量可以概括为：**model-visible means logged**。用户消息、Assistant 输出、工具调用与结果、压缩和取消等事件进入 append-only 日志；UI、恢复、fork、telemetry 和模型历史再从这份日志投影。相关结构可见于 [Session 类型](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/types.ts#L230-L333)和[模型表层投影](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/surface.ts#L70-L114)。

这避免了三类常见漂移：模型看过但 UI 没有、UI 展示过但恢复不了、审计日志与真实上下文不一致。

但 append 成功不等于每条事件立即 `fsync`。研究快照中的默认持久化采用 write-behind，并在下一次模型请求或顶层工具副作用前执行 fail-closed checkpoint。准确说法是“关键副作用前确保落盘”，不是“每个 Turn 结束都同步写盘”。

## 机制四：Cordis 管理可逆作用与响应式依赖

Cordis 所说的“时空可组合性”可以落到两个工程问题：

- **时间**：组件卸载时，能否撤回它安装的监听、服务和注册？
- **空间**：Provider 出现、消失或被替换时，依赖它的组件能否正确停启？

核心机制包括：

1. `ctx.effect()` 安装作用并返回 disposer，卸载时按逆序撤回；
2. 插件通过 `inject` 声明依赖，依赖不满足时保持 inactive；
3. Fiber 协调 loading、active、unloading 与 failure，并先排空 dependents；
4. Loader/HMR 对配置变化做增量 reconciliation，候选加载失败时保留旧组件。

DeepSeek Harness 没有简单追随上游包，而是 vendored 固定版本，并记录了重入式 dispose、事务化配置 reload 等加固，见固定提交中的 [vendor 说明](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/vendor/README.md)。

这里必须划清保证边界：runtime 无法证明 disposer 一定正确；只有通过 Context 安装的作用才受生命周期管理；文件写入、网络发送和已经产生的模型输出不会自动回滚；`node:vm` 也不是针对恶意插件的安全边界。可逆插件不等于任意 Agent 行为都能“撤销”。

## 默认能力与信任边界

研究快照中的 [Base Bundle](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/bundle/base/cordis.patch.yml)组合了模型、JSONL Session、Shell/FS、Skills、Plan、Goal、Compaction、Subagent、Workflow、Todo 与 Web Search 等能力。

动态 Cordis 能力尤其值得谨慎：官方说明明确指出其 VM 主要隔离全局变量，不构成安全沙箱，应按可以执行 Bash 的信任等级对待。见 [`cordis-host-runner` 的信任边界](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/extensions/cordis-host-runner/README.md#L28-L40)。

这提醒我们：插件架构解决的是组合与生命周期，不自动解决供应链、权限最小化和不可信代码隔离。生产系统仍需要独立的身份、网络、文件系统和审批边界。

## 成熟度：架构完整，但产品仍早

正向证据是，代码已经显式处理取消、并发、持久化、失败回滚和配置热更新；测试也覆盖单元、snapshot、浏览器与跨平台沙箱等不同层次。

谨慎信号同样清楚：

- 固定提交的 [README](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/README.zh.md#L5-L11) 明确标注 Developer Preview，并提示可能出现破坏性变化；
- 研究时没有稳定 tag 或 GitHub Release，npm `rc.6` 与源码 `rc.5` 也缺少可验证的提交绑定；
- 固定提交对应的一次[真实 API e2e 作业](https://github.com/deepseek-ai/deepseek-harness/actions/runs/31701562200/job/94451698344)在 preflight 因缺少外部 API Key 而未实际运行，因此既不能算模型链路通过，也不能推断为产品回归；
- [`BENCHMARK.md`](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/BENCHMARK.md)给出了运行方法，但没有公开质量、成本或性能结果；
- 研究快照中的[贡献政策](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/CONTRIBUTING.zh.md)暂不接受外部 PR。

所以更准确的评价是：**工程基础扎实，公开产品与治理仍处在早期阶段。**

## 采用建议

| 用途 | 判断 |
| --- | --- |
| 学习 Agent runtime、插件化和事件溯源 | 很值得 |
| 构建自有 Harness 或插件平台原型 | 值得试点 |
| 隔离环境中的内部编码 Agent | 可条件采用 |
| 直接替代成熟工具进入关键生产 | 暂不建议 |
| 让 Agent 自动改写自身 Harness | 仅限实验环境 |

如果现在试用，建议固定准确 commit 或 tarball，在可丢弃 workspace 中运行，保持遥测关闭，先禁用动态 Cordis 和未审计的第三方插件，并至少验证六条路径：多步工具循环、取消与恢复、并发 barrier、权限升级拒绝、失败插件热替换、Session flush/restart。

## 最值得带走的四个设计原则

1. **组合必须可检查。** 插件化越彻底，越需要能导出依赖图、有效配置和事件链。
2. **注册必须伴随 disposer。** 监听器、服务、定时器和外部资源都应把释放动作纳入 contract。
3. **切换应当事务化。** 用 `candidate → validate → commit → retire-old`，避免先销毁旧实现再赌新实现能启动。
4. **状态应有单一真源。** 模型上下文、UI、恢复和审计从同一事件日志投影，少维护几份“差不多一致”的状态。

DeepSeek Harness 最有启发性的地方，不是提供了多少工具，而是尝试把 Agent runtime 中最难推理的部分——依赖变化、插件回收、工具副作用与上下文持久化——变成明确的系统约束。它值得研究，也值得在受控环境中验证；但在稳定发布、可追溯分发、公开基准和长期治理证据出现之前，仍应把它当作高质量的开发者预览，而不是已经成熟的生产底座。

## 后续观察清单

- 首个稳定 tag/release，以及 npm 包与 Git commit 的可追溯绑定；
- Cordis 论文定稿与更强的形式化验证；
- 长任务成功率、质量、成本和资源占用等公开基准；
- 高频插件替换下的内存泄漏、延迟与 in-flight task 连续性；
- 文档同步、公开安全政策和外部协作机制。
