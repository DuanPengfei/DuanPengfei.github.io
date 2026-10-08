---
title: "Agent SDK 产品形态全景：Framework、Runtime、Harness、CLI 与通用运行契约"
date: 2026-08-20 12:03:01
tags:
  - AI Agent
  - Agent SDK
  - 工程
  - 调研
---

Agent SDK 并不是单一品类：LangChain/LangGraph、Eino、OpenAI Agents SDK 与 Claude Agent SDK 分别掌握不同层次的执行权。本文以 Framework、Runtime、Harness、Managed Platform 和 Protocol SDK 为坐标，梳理主流产品，并提出以统一运行契约而非统一 Agent DSL 为核心的通用沉淀路线。

<!-- more -->

> 调研日期：2026-08-19（Asia/Shanghai）
> 调研类型：关键词驱动的技术与产品形态深研
> 证据口径：优先使用官方文档、官方仓库和官方规范；文中明确区分“官方定义”和“本文判断”
> 结论边界：这是一份类型学与产品架构报告，不是市场份额、性能 benchmark 或采购排名

> 时效声明：本文是截至 2026-08-19 的产品与协议快照；滚动文档、版本、Preview/GA 状态及兼容性可能变化，实施或选型前请按具体版本复核。

## TL;DR

1. **市场并不存在统一的 “Agent SDK” 定义。** 厂商会把 framework、runtime、harness、CLI、托管平台甚至协议客户端都叫 SDK。更可靠的办法不是看名字，而是看它拥有哪一段执行权：谁管理 Agent loop、工具、状态、工作区、权限和部署。
2. **可以把核心产品归为 6 类：** Model Client SDK、Agent Framework/ADK、Orchestration Runtime、Agent Harness SDK、Managed Agent Platform、Interoperability/Protocol SDK。垂直领域和低代码 Builder 是横切维度或产品界面，不宜再与这 6 类并列计数。
3. **LangChain 是高层 Agent Framework；LangGraph 是低层、可持久化的 Orchestration Runtime。** 二者是上下层关系，不是两个同类框架换皮。LangChain 官方也明确将 framework、runtime、harness 分开。
4. **Eino 是一套集成型框架栈。** 它同时提供组件抽象、ADK、ReAct/多 Agent、`compose` graph/workflow、streaming、interrupt/resume 与 DeepAgent；实质上横跨 LangChain 式 framework、LangGraph 式 runtime 和一部分 harness 能力。
5. **OpenAI Agents SDK 与 Claude Agent SDK 不是同一层。** OpenAI Agents SDK 的主定位是轻量 Agent framework + 本地 orchestration runtime，虽然 2026 年的 sandbox agents、shell、workspace 能力已开始向 harness 扩展；Claude Agent SDK 则是把 Claude Code 的工具、agent loop、上下文管理、权限、sessions、skills、subagents 和 checkpointing 作为“完整 harness”提供给开发者。
6. **Claude Agent SDK 更应与 Codex SDK、GitHub Copilot SDK、Deep Agents SDK、Microsoft Harness Agent 比较。** 这些产品共同特征是复用一个已经能独立完成任务的 Agent 产品内核，而不是只提供拼装 Agent 的抽象。
7. **CLI 可以成为 SDK 的底座，但“有 CLI”不等于“就是 SDK”。** `prompt -> text` 只是交互命令；有 JSON/JSONL、退出码和非 TTY 模式可称 Headless CLI/CLI API；再有稳定双向协议、session/resume/cancel、审批、版本协商和错误模型，可称 embeddable runtime；外面再提供类型安全的语言客户端、生命周期封装、版本绑定、文档与测试，整体就是成立的 **CLI-backed SDK**。
8. **如果目标是“Agent SDK 通用沉淀”，不建议先造另一个 `Agent(...)` 框架。** 更值得沉淀的是一套 **Agent Runtime Contract / ABI**：统一 Run/Thread/Turn 生命周期、事件流、工具调用、审批、取消、恢复、制品、用量、错误、权限与可观测性；内部 Agent 构造仍允许 LangGraph、Eino、OpenAI Agents SDK、Claude/Codex/Copilot harness 各自保留原生能力。

## 1. 研究问题与关键词地图

### 1.1 核心问题

- 市面上的 “Agent SDK” 到底有多少类？
- LangChain/LangGraph、Eino、OpenAI Agents SDK、Claude Agent SDK 分别处在哪一层？
- 用 CLI/子进程方式向其他系统暴露 Agent，是否可以定位为 SDK？
- 如果要做通用沉淀，应该统一 Agent 的“定义方式”，还是统一 Agent 的“运行契约”？

### 1.2 扩展关键词

- Agent framework / ADK / multi-agent framework
- Agent orchestration runtime / durable execution / graph workflow
- Agent harness / coding agent harness / batteries-included agent
- Headless Agent CLI / CLI API / subprocess SDK / app server
- Agent runtime / managed agents / agent platform / control plane
- MCP / A2A / ACP / AG-UI
- session / thread / turn / run / event stream / checkpoint / approval / sandbox
- capability negotiation / conformance suite / protocol versioning

### 1.3 一个必要的术语澄清

传统软件语境里，SDK 通常是“供开发者调用的一组库、工具、文档与样例”，framework 更强调生命周期和控制反转；但 Agent 产品把这条界线打散了。只要一个库拥有 agent loop，它在运行语义上就是 framework/runtime，即使包名叫 SDK。反过来，一个 SDK 也完全可以在内部拉起子进程或连接远端服务；**SDK 是开发者契约和产品交付方式，不是进程拓扑。**

## 2. 不按厂商命名，按三维坐标分类

判断一个产品是什么，至少要同时回答三组问题。

### 2.1 能力层：它拥有哪段执行权？

| 类型 | 核心职责 | 它通常不负责 | 代表产品 |
|---|---|---|---|
| 1. Model Client SDK | 调模型 API、streaming、tool-call 原始消息、重试/认证 | 完整 Agent loop、工具实际执行、长期状态 | OpenAI/Anthropic/Google 的普通 API Client SDK |
| 2. Agent Framework / ADK | `Agent`、tool、handoff、middleware、multi-agent pattern、基础 loop | 通用耐久执行、完整工作区和生产托管未必内建 | LangChain、OpenAI Agents SDK、Google ADK、Pydantic AI、CrewAI |
| 3. Orchestration Runtime | graph/workflow、checkpoint、resume、streaming、HITL、durable state | 高层 prompt/角色和成套工具未必内建 | LangGraph、Temporal/Inngest 类耐久引擎、Eino Compose、Microsoft Workflows |
| 4. Agent Harness SDK | loop + 内置工具 + workspace/sandbox + context engineering + permissions + sessions | 通常不追求最低抽象或完全模型中立 | Claude Agent SDK、Codex SDK、GitHub Copilot SDK、Deep Agents SDK、Microsoft Harness Agent |
| 5. Managed Agent Platform | 托管 runtime、sandbox、memory、identity、gateway、observability、deployment | 本地可移植性和底层控制通常有限 | Anthropic Managed Agents、AWS AgentCore、Google Agent Runtime、Microsoft Foundry Agent Service |
| 6. Interoperability / Protocol SDK | 实现连接和互操作标准 | 不拥有 Agent 的推理、loop 或业务目标 | MCP SDK、A2A SDK、ACP clients、AG-UI SDK |

**本文判断：** 这 6 类比“框架类/厂商类/CLI 类”更稳定，因为它按责任边界分类。一个产品可以横跨多类；分类结果应该允许“主类型 + 次类型”，不必强行一产品一格。

### 2.2 交付面：开发者怎么接入？

| 交付形态 | 典型拓扑 | 优点 | 主要代价 |
|---|---|---|---|
| In-process library | 应用直接 import package | 类型体验好、低延迟、回调自然 | 语言绑定、依赖冲突、崩溃域相同 |
| Headless CLI | 每次启动命令，stdin/stdout 传输 | 脚本/CI 友好、跨语言 | 启动成本、单次调用、错误/流协议常偏薄 |
| Library + bundled subprocess | SDK 管理固定版本的 Agent binary | 复用成熟 harness，同时给原生 API | 二进制分发、信号/背压/版本与平台兼容 |
| Long-running daemon/app-server | SDK 连接本地或邻近常驻进程 | 多 session、低摊销、深度事件与审批 | 进程治理、租户隔离、升级和资源回收 |
| Remote API / managed service | SDK 调 HTTPS/SSE/WebSocket/gRPC | 部署简单、弹性和治理集中 | 数据边界、网络依赖、服务锁定、成本 |

### 2.3 约束范围：它想统一到什么程度？

- **Model-agnostic / framework-agnostic：** 追求适配多模型和多框架，如 LangGraph、Eino、Google ADK、Strands、AgentCore。
- **Provider-native：** 对某一模型/平台体验最好，但可提供有限的第三方 provider，如 OpenAI Agents SDK。
- **Product-native / domain-specific：** 直接复用某个完整 Agent 产品或领域运行时，如 Claude Agent SDK、Codex SDK、Copilot SDK、voice/browser/security SDK。

“垂直 SDK”不是第 7 个能力层；它可以是 framework、harness 或 managed platform，只是把工具、prompt、评测和安全策略预装到某一领域。

## 3. 代表产品的实质定位

| 产品 | 官方表述要点 | 本文主分类 | 本文判断 |
|---|---|---|---|
| LangChain | Agent framework，提供模型、工具、agent loop 与 middleware 抽象 | Agent Framework | 高层、快速开发；复杂耐久编排下沉到 LangGraph |
| LangGraph | “low-level orchestration framework and runtime”，强调 durable execution、streaming、HITL、persistence | Orchestration Runtime | 统一的是状态图和运行语义，不是成套 Agent 产品 |
| Eino | Go LLM application framework；Components + ADK + Composition + DeepAgent | Integrated Framework + Runtime | 接近 LangChain + LangGraph + 部分 harness 的一体化 Go 栈 |
| OpenAI Agents SDK | 少量 primitives、内建 loop、handoffs、guardrails、sessions、tracing；默认 Responses API | Provider-native Framework + Runtime | 一般用途 Agent 构建 SDK；2026 年 sandbox/workspace 能力使其向 harness 扩展 |
| Claude Agent SDK | “Claude Code as a library”；复用同一工具、loop 与 context management | Product-native Agent Harness SDK | 完整、强约束、Claude-first；不是仅做 LLM 编排 |
| Codex SDK | Programmatically control local Codex agents；thread、resume、sandbox | Domain Agent Harness SDK | 编码领域的本地 Agent 产品内核；Python SDK 通过 app-server/JSON-RPC 控制固定 runtime |
| GitHub Copilot SDK | 暴露 Copilot CLI 背后的 agent runtime，多语言客户端通过 JSON-RPC 管理 CLI server | Domain Agent Harness SDK | CLI-backed SDK 的强证据；SDK 和 runtime binary 是明确分层的 |
| Google ADK 2.0 | 开源 agent development framework；agents、graph workflows、multi-agent、runtime、evaluation、deployment | Integrated Framework + Runtime | 横跨构建和运行，但保持多模型、可自托管/可云托管 |
| Microsoft Agent Framework | Agents + Harness Agent + Workflows + Integrations；AutoGen/Semantic Kernel 的直接后继 | Integrated Framework + Harness + Runtime | 明确把三层放在一套产品中，是市场“层次融合”的代表 |
| Strands Agents | Model-driven、model-agnostic；当前官方 monorepo/叙事强调 “build an agent harness” | Model-agnostic Harness + Framework SDK | 仍让开发者控制 loop/hooks，但已把 context、limits、observability 等 harness 能力产品化；与 AgentCore 是“自建 harness/托管层”分工 |
| AWS Bedrock AgentCore | Runtime、Memory、Gateway、Browser、Code Interpreter、Identity、Policy、Observability、Evaluation | Managed Agent Platform | 可承载多框架/多模型，但基础设施层仍形成 AWS 绑定 |
| AWS AgentCore Harness | 配置 model、prompt、tools、memory、limits，由服务提供 orchestration loop | Managed Agent Harness | 与 AgentCore Runtime 不同：前者替用户运行 loop，后者托管用户自带 Agent 代码 |
| MCP / A2A / ACP / AG-UI SDK | 工具与数据、Agent 间、Client 与本地 Agent、Agent 与前端的互操作 | Protocol SDK | 解决连接契约，不替代 Agent framework/runtime/harness |

### 3.1 其他代表产品应如何放置

- **LlamaIndex：** 数据/RAG 中心的 Agent framework + workflow；优势在数据连接、索引、检索与知识 Agent。[官方仓库](https://github.com/run-llama/llama_index)
- **CrewAI：** role/crew/flow 取向的 multi-agent framework；用较强的组织隐喻降低多 Agent 编排门槛。[官方文档](https://docs.crewai.com/index)
- **Pydantic AI：** Python 类型与依赖注入取向的 Agent framework，强调 typed inputs/outputs 和测试体验；durable execution 可接 Temporal、DBOS、Prefect、Restate 等外部引擎。[官方仓库](https://github.com/pydantic/pydantic-ai)
- **AutoGen / Semantic Kernel：** 仍有存量生态；AutoGen 官方仓库当前标为 maintenance mode，Microsoft 已把 Agent Framework 定位为 AutoGen 与 Semantic Kernel 的后继整合方向，新选型需单独核验迁移路线。[AutoGen 官方仓库](https://github.com/microsoft/autogen)、[Microsoft Agent Framework](https://github.com/microsoft/agent-framework)
- **Mastra / Vercel AI SDK：** TypeScript/full-stack 取向。Mastra 同时提供 Agent 与显式 workflow；Vercel AI SDK 提供版本化 `Agent` interface、tool loop 和 UI stream，说明“前后端一体化 SDK”也是一条横切产品路线。[Mastra Workflows](https://mastra.ai/ai-workflows)、[Vercel AI SDK Agent interface](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent)
- **Dify / Langflow / Flowise / 各云 Agent Builder：** 首先是 visual builder / application platform；可以附带 SDK，但“有 SDK”不代表 Builder 本身就是一种新的 Agent runtime 类别。[Dify](https://docs.dify.ai/)、[Langflow](https://docs.langflow.org/)、[Flowise](https://docs.flowiseai.com/)

## 4. 四类代表产品的深度对位

### 4.1 LangChain：高层构建框架

LangChain 负责让开发者快速获得标准的 model、message、tool、agent loop、middleware 和 integration 抽象。其价值是统一常见构建体验，而不是把所有长任务都变成可恢复的状态机。

官方依据：[LangChain 的 framework/runtime/harness 产品分层](https://docs.langchain.com/oss/python/concepts/products)、[LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)。

**适合：** 简单到中等复杂度的 Agent 应用、需要大量模型/工具集成、团队希望形成共同编程范式。

**不应误解为：** 它天然等于可靠的分布式 runtime、sandbox 或完整 Agent 产品。

### 4.2 LangGraph：低层编排与耐久运行时

LangGraph 官方将自己定义为面向 long-running、stateful agents 的低层 orchestration framework and runtime，核心能力包括 durable execution、streaming、human-in-the-loop 和 persistence。它不抽象你的 prompt 或 Agent architecture，并且可不依赖 LangChain 使用。

官方依据：[LangGraph Overview](https://docs.langchain.com/oss/python/langgraph/overview)、[LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)。

**适合：** 需要显式状态图、确定性步骤与 Agent 步骤混排、故障恢复、暂停审批、长任务。

**不应误解为：** 一个 batteries-included 的通用 Agent harness。

### 4.3 Eino：Go 生态的一体化构建栈

Eino 的官方仓库同时列出：

- `ChatModel`、`Tool`、`Retriever`、`ChatTemplate` 等 components；
- ADK：tool use、multi-agent coordination、context、interrupt/resume 和预制 Agent pattern；
- `compose`：graph/workflow，可单独运行或暴露为 Agent tool；
- DeepAgent：拆解任务、subagents、progress tracking，并可配置 shell、Python、web search 等工具；
- streaming、callbacks/aspects、checkpoint 与可视化 DevOps。

因此把 Eino 简单叫“LangChain 的 Go 版”已经不够准确。**本文判断：Eino 是 integrated Agent application framework，内部同时含 framework、runtime 和可选 harness 层。**

官方依据：[CloudWeGo Eino 官方仓库](https://github.com/cloudwego/eino)、[Eino 官方文档索引](https://github.com/cloudwego/eino/blob/main/llms.txt)。

截至 2026-08-19，官方最新 release 为 [`v0.9.15`](https://github.com/cloudwego/eino/releases/tag/v0.9.15)。0.x 是 API 稳定承诺需要单独核验的信号，不是对技术成熟度的负面结论。

### 4.4 OpenAI Agents SDK 与 Claude Agent SDK：同名、不同产品哲学

| 维度 | OpenAI Agents SDK | Claude Agent SDK |
|---|---|---|
| 起点 | 用少量 primitives 构建 Agent 应用 | 把 Claude Code 的完整执行内核做成可编程产品 |
| 核心对象 | Agent、Runner、tool、handoff、guardrail、session、trace | query/client、内置 tools、sessions、permissions、hooks、subagents、skills/plugins、checkpoint |
| loop | SDK Runner 管理 turn/tool/handoff | 复用 Claude Code agent loop |
| 工具世界 | 函数工具、MCP、hosted tools；新版本含 sandbox agents | 文件、编辑、Bash、web 等成套工具默认可用 |
| 工作区/隔离 | 传统 Agent 可由应用提供；sandbox agents 已支持真实隔离工作区 | 工作区、文件与命令执行是核心产品语义 |
| 模型开放度 | OpenAI 默认，但官方支持非 OpenAI provider/adapter；功能并非完全等价 | Claude-first，体验和语义与 Claude Code 深度绑定 |
| 主要类比对象 | LangChain、Google ADK、Strands、Pydantic AI | Codex SDK、Copilot SDK、Deep Agents、Microsoft Harness Agent |

**最重要的结论：** 不要用包名中的 “SDK” 判断层级。OpenAI Agents SDK 行为上首先是 framework/runtime；Claude Agent SDK 行为上首先是 harness SDK。

官方依据：[OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)、[OpenAI Agents SDK 的模型适配](https://openai.github.io/openai-agents-python/models/)、[Claude Agent SDK Overview](https://code.claude.com/docs/en/agent-sdk/overview)。

## 5. CLI 暴露能不能定位成 SDK？

### 5.1 先给结论

**能，但 CLI 是传输/部署机制，不是产品类别。** SDK 可以在内部启动并管理一个本地 executable，也可以连接 daemon 或远端服务。用户看到的是否是 SDK，取决于它是否提供稳定的开发者契约，而不是代码是否运行在同一个进程。

市场已有三组一手证据：

| 产品 | 官方实现事实 | 说明 |
|---|---|---|
| Claude Agent SDK | Python/TypeScript library 复用 Claude Code agent loop；托管文档说明 SDK 会启动并监管 `claude` 子进程，且包内绑定 CLI 版本 | product-native、subprocess-backed harness SDK |
| OpenAI Codex SDK | TypeScript SDK 包装 `codex` CLI，以 stdin/stdout JSONL 通信；Python SDK 通过本地 App Server 的 JSON-RPC 接入 | coding-agent SDK；CLI/runtime binary 与语言客户端分层 |
| GitHub Copilot SDK | 多语言 SDK 通过 JSON-RPC 控制 Copilot CLI server，并负责服务进程生命周期 | subprocess-backed SDK 的最直白案例 |

对应官方材料：[Claude Agent SDK Hosting](https://code.claude.com/docs/en/agent-sdk/hosting)、[Codex TypeScript SDK README](https://github.com/openai/codex/blob/main/sdk/typescript/README.md)、[GitHub Copilot SDK](https://github.com/github/copilot-sdk)。

一个容易误读的细节是：Claude 概览页说 SDK 在“你的进程/基础设施”运行 loop，但 Hosting 页明确说明实际由 SDK 拉起独立 `claude` 子进程。这里的“你的进程”应理解为**自托管应用边界**，而不是与 Python/Node 代码共享同一地址空间。GitHub Copilot 官方仓库则进一步明确其 SDK 已 GA、遵循 SemVer，并由 SDK 自动管理 CLI server 生命周期。

### 5.2 建议采用两条轴，而不是把 CLI 当成第 7 类

| 轴 | 可选值 |
|---|---|
| 执行位置 | 进程内 / 本地子进程 / 本地 daemon / 远程托管服务 |
| 开发者接口 | 语言库 / 一次性 CLI / 双向协议 / HTTP-SSE-WebSocket-gRPC API |

所以会出现 `语言 SDK -> 本地 CLI runtime -> JSONL/JSON-RPC`、`语言 SDK -> 远程 API`、`CLI -> 远程 API` 等组合。它们没有高低之分，只是在延迟、隔离、分发、可控性和运维成本上不同。

### 5.3 CLI 产品的成熟度分级

```text
L0 交互式 CLI
   人在终端中操作，输出主要供人阅读

L1 Headless 文本调用
   非 TTY；stdin/prompt 输入，stdout 文本输出

L2 Structured CLI API
   JSON/JSONL、稳定退出码、结构化 schema、session/resume

L3 Embeddable Agent Runtime / Server
   长驻双向协议、request id、stream、cancel、approval、并发 session、能力协商

L4 Language-native Agent SDK
   类型、错误、生命周期、异步迭代、版本绑定、文档、测试与兼容策略
```

远程托管不是 L5，而是另一条部署轴。L4 SDK 既可以包装本地二进制，也可以连接远端。

### 5.4 什么时候可以诚实地叫 SDK？

**本文建议：以下五项至少满足前四项。**

1. 有语言原生包，用户不需要自行拼 shell、解析 stdout。
2. 有稳定、类型化的请求、事件、错误和终态模型。
3. SDK 管理进程启动、ready、取消、超时、退出、重启与异常清理。
4. 抽象 session/thread、stream、tool call、approval、artifact、usage 等 Agent 语义。
5. 明确 runtime 版本绑定、协议版本、向后兼容和 deprecation 策略。

只有 `--prompt`、JSON、stderr 和退出码时，更准确的名称是 **Headless Agent CLI / CLI API**。有长驻双向控制面、但没有语言客户端时，可称 **Agent Runtime Server / Agent Protocol**。两者之上再提供原生开发体验，才是 **subprocess-backed Agent SDK**。

### 5.5 CLI/runtime 集成最容易低估的工程成本

- stdout 必须只承载协议，日志稳定走 stderr；定义 JSONL framing、单条大小上限和 backpressure。
- terminal event 与 process exit 必须一致；需要处理事件完成但进程未退、进程崩溃但无终态事件两种情况。
- 取消要清理整个进程树，并区分 user cancel、timeout、policy deny、runtime crash。
- 固定或协商 binary/runtime 版本；不能默认“系统里碰巧有一个兼容 CLI”。
- `cwd`、配置目录、认证、session、cache 和用户级插件必须可隔离；子进程边界本身不是安全沙箱。
- 必须限制环境变量、密钥、网络、文件系统、hooks、MCP server 和仓库指令的自动继承。

## 6. 协议 SDK 在哪里：MCP、ACP、A2A、AG-UI 不是同一个问题

| 协议 | 主要关系 | 核心对象 | 对通用 Agent SDK 的位置 |
|---|---|---|---|
| MCP | Agent/Host ↔ tools、resources、prompts | 能力发现与调用 | Tool/Context Provider SPI；不代替 Agent runtime |
| ACP | Client/IDE ↔ 本地 Agent | session、prompt、stream、cancel、permission、fs/terminal | 最接近本地 Agent runtime 的标准控制面 adapter |
| A2A | 独立 Agent ↔ 独立 Agent | Agent Card、message、task、artifact、stream | 远程 Agent federation adapter |
| AG-UI | Agent backend ↔ 用户界面 | event stream、state、tool/UI interaction | 前端事件投影和交互 adapter |

[事实] [ACP](https://agentclientprotocol.com/protocol/v1/overview) 基于 JSON-RPC 2.0，通常由客户端启动本地 Agent 子进程，覆盖 session、prompt、updates、cancel、权限、文件与终端能力；它最像“应用如何控制一个本地 Agent”的协议。

[事实] [A2A](https://a2a-protocol.org/latest/specification/) 面向实现不透明的独立 Agent，公开的是身份、能力和任务生命周期；它不负责工作区、shell 进程树或某个 harness 的内部 checkpoint。

[事实] [AG-UI](https://docs.ag-ui.com/introduction) 面向 Agent 与用户界面的实时交互；它与 MCP、A2A 是互补关系。

[事实] 截至本报告日期，MCP 当前 2026-07-28 版本已经把核心协议改为无状态，并移除旧的 initialize/session-id 语义；其中心仍是 tools/resources/prompts 等能力，而不是完整 Agent run 控制面。[MCP 2026-07-28 说明](https://blog.modelcontextprotocol.io/posts/2026-07-28/)

**本文判断：** 通用 Agent SDK 应复用这些协议，而不是重新定义四套标准；但内部仍需要一个更丰富的 canonical event model，因为 ACP/A2A/MCP/AG-UI 各自只覆盖一段边界。把 Agent 包成一个 MCP tool 可以完成“调用”，却会压扁审批、取消、diff、子 Agent、checkpoint 和长任务恢复语义。

## 7. 市场正在形成的 6 个产品趋势

### 7.1 Framework 与 durable runtime 正在合流

LangChain 依赖 LangGraph，Eino 内含 Compose，Google ADK 2.0 增加 graph workflow runtime，Microsoft Agent Framework 同时提供 Agent、Harness Agent 和 Workflow。纯粹只做 `while tool_call` 的 SDK 越来越难满足生产需求。

### 7.2 Harness 成为新的高价值层

Claude、Codex、Copilot、Deep Agents 和 Microsoft Harness Agent 的共同点是预先组合工作区、工具、权限、上下文策略、sessions 和 subagents。Strands 当前也主动使用 harness 定位，但它仍允许用户选择模型并控制 loop/hooks，是“可组装 harness”而非 Claude/Codex 式产品内核。**Harness 已经不是单一供应商专属名词，而是一条从 framework 到成品 Agent 的连续谱。**

### 7.3 CLI 正从人机产品变成可嵌入 runtime

Claude Code、Codex、Copilot、Gemini CLI、Goose 都在增加 JSONL、session/resume、headless、ACP 或 app-server。其意义不是“CLI 赢了”，而是现成 Agent 产品内核正在通过稳定协议被二次集成。

### 7.4 Managed platform 从“部署”扩展到完整控制面

AgentCore、Vertex/Google Agent Runtime、Microsoft Foundry、Anthropic Managed Agents 不只托管容器，还提供 memory、identity、gateway、sandbox、policy、observability、evaluation。AWS 当前还明确区分 AgentCore Runtime（托管用户自带代码，loop 由用户负责）与 AgentCore Harness（服务提供 loop，用户以配置定义 Agent）。通用 SDK 若把这些写死在 core 中，会迅速绑定某个云；更合适的是定义 SPI 和 adapter。[AgentCore Harness vs. Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-vs-runtime.html)

### 7.5 多 Agent 已变成基础 pattern，但还不是可靠性证明

Handoff、supervisor、swarm、group chat、agent-as-tool 几乎成为所有框架标配；然而“能调多个 Agent”不等于“可恢复、可幂等、可审计”。生产判断仍应看状态模型、失败语义、checkpoint、审批和事件账本。

### 7.6 可观测、评测与安全开始成为 SDK 一等接口

Tracing/OTel、eval、guardrail、policy、human approval 和 sandbox 已从外围工具进入 SDK/runtime。通用层至少要保留 trace context、usage、policy decision 与 artifact lineage，不能只统一 prompt 和 final answer。

## 8. 通用 Agent SDK 的沉淀建议：做 Universal Agent Runtime SDK

### 8.1 不建议从“再造一个 Agent 类”开始

构造层已经高度拥挤，而且各家差异恰恰是价值来源：LangGraph 的显式图、Eino 的 Go 组件系统、OpenAI Agents 的 handoff/guardrail、Claude/Codex 的 workspace harness。若强行统一构造 DSL，通常只会得到最低公共子集。

更有通用价值的分界线是：

> **统一应用如何启动、观察、控制、恢复和治理一个 Agent；不强制统一 Agent 内部如何思考与编排。**

### 8.2 建议架构

![Universal Agent Runtime SDK 建议架构](/images/agent-sdk-landscape-universal-runtime/architecture.svg)

*图：统一运行契约位于业务应用与异构 Agent 实现之间；策略、状态和观测是横切控制面，MCP、ACP、A2A 与 AG-UI 分别作为不同边界的适配器。*

### 8.3 Core Contract：统一最小但完整的运行语义

建议核心对象：

- `AgentDescriptor`：id、vendor、version、capabilities、input/output schema、extension namespace。
- `Session/Thread`：可持续对话或任务容器；不要假设所有厂商同时拥有 session、thread、run 三层。
- `Run/Turn`：一次可取消、可追踪、有明确终态的执行。
- `Item`：message、tool call/result、approval、artifact、diff、checkpoint、subagent、usage、error。
- `AgentEvent`：append-only 事件，带 `event_id`、`sequence`、`run_id`、时间、trace context 和 vendor payload。
- `CapabilitySet`：streaming、resume、fork、approval、structured output、diff、subagent、checkpoint、custom tools、sandbox 等。

建议核心方法：

```ts
interface AgentRuntime {
  describe(): Promise<AgentDescriptor>;
  start(input: RunInput, options?: RunOptions): AsyncIterable<AgentEvent>;
  resume(ref: ResumeRef, input?: RunInput): AsyncIterable<AgentEvent>;
  cancel(runId: string, reason?: string): Promise<void>;
  respondApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
}
```

这段接口应被视为语义草图，不是立即冻结的 API。首先要用异构 adapter 的 conformance test 反推边界。

### 8.4 事件模型：这是整个通用层最值得沉淀的部分

建议标准事件至少包含：

```text
run.started
turn.started
message.delta / message.completed
tool.requested / tool.started / tool.completed / tool.failed
approval.required / approval.resolved
artifact.created / artifact.updated
checkpoint.created
subagent.started / subagent.completed
usage.updated
warning
run.completed / run.failed / run.cancelled
```

关键约束：

- 每个 run 恰好一个终态事件；process exit 只是 transport 信号，不直接等于业务成功。
- tool request/result 必须可关联；外部副作用使用 idempotency key，但不要承诺无法证明的 exactly-once。
- delta 可丢弃或重放时要有明确规则；checkpoint 与 event sequence 要能建立恢复边界。
- canonical 字段保持小而稳定；厂商特有的 diff、reasoning、computer-use、citation 等放到 `extensions.<vendor>`，不丢弃原始 payload。

### 8.5 Adapter 分层

| Adapter | 代表接入 | 需要解决的主要问题 |
|---|---|---|
| Native Framework Adapter | LangGraph、Eino、OpenAI Agents SDK、Google ADK | callback/event 对齐、状态/工具语义映射、应用进程隔离 |
| Subprocess Harness Adapter | Claude、Codex、Copilot、Goose | binary pin、JSONL/RPC、进程树、cwd/config/auth 隔离、背压 |
| ACP Adapter | Gemini/Copilot/其他 ACP agents | capability negotiation、session/update 到 canonical event 的映射 |
| Managed Runtime Adapter | AgentCore、Foundry、Vertex、厂商 Agent API | auth、tenant、网络重试、异步任务、配额、远端取消 |
| A2A Adapter | 独立远端 agents | Agent Card、task/artifact/stream、能力与信任边界 |
| Tool Provider Adapter | MCP、native function、tool gateway | schema、权限、secret、幂等、结果大小和超时 |

### 8.6 六个可替换的 SPI

Core 不应自己吃下所有基础设施，建议把以下能力定义成端口：

1. `StateStore`：event ledger、checkpoint、resume cursor。
2. `ArtifactStore`：文件、diff、媒体、结构化产物和 lineage。
3. `ToolProvider`：native/MCP/gateway tools。
4. `SandboxProvider`：process/container/VM/remote sandbox。
5. `PolicyProvider`：permission、approval、network/file/command policy。
6. `TelemetryProvider`：OpenTelemetry、cost/usage、eval、audit export。

再单列 `SecretBroker` 与 `IdentityProvider` 也合理，但不建议让业务插件直接读取全量环境变量。

### 8.7 能力协商必须是一等设计

调用方不能假设每个 adapter 都支持所有操作。例如：

```json
{
  "streaming": true,
  "resume": "checkpoint",
  "approval": ["tool", "file", "network"],
  "artifacts": ["file", "diff"],
  "subagents": true,
  "sandbox": "process",
  "structuredOutput": true
}
```

当能力不存在时，SDK 应在调用前返回 `CapabilityUnsupported`，而不是运行一半再静默降级。**统一核心 + 能力协商 + 厂商扩展**，比“所有 Agent 看起来完全一样”更诚实。

## 9. 产品路线选择

### 9.1 四种可能方向

| 方向 | 价值 | 竞争/风险 | 建议 |
|---|---|---|---|
| A. 新 Agent 构建框架 | 统一写 Agent 的 DX | 市场极拥挤；难胜过各语言原生生态 | 除非有独特语言/场景，不作为第一步 |
| B. Universal Runtime SDK/Bridge | 一套 API 控制异构 Agent；解决企业集成重复劳动 | 需要严谨事件语义与 adapter 维护 | **首选** |
| C. Opinionated Harness SDK | 针对 coding/research/data 提供高成功率成品 | 场景价值高，但模型/工具/安全强约束 | 可作为 B 之上的 profile |
| D. Managed Control Plane | 统一托管、策略、审计、评测、成本 | 建设和运营重，进入云平台竞争 | 作为后续产品，不先做 |

### 9.2 推荐产品定义

> **Universal Agent Runtime SDK**：面向应用开发者的语言原生 SDK，对上提供统一 Agent 生命周期、事件、控制、权限和观测 API；对下适配 native framework、CLI/JSONL、ACP、厂商 app-server 和远程 A2A/managed runtime；MCP 位于工具能力层。

这个定义允许你同时支持：

- “我用 Eino/LangGraph 写了一个 Agent，想用统一接口运行”；
- “我想把 Claude/Codex/Copilot 接入自己的 IDE/平台”；
- “我只有一个 headless CLI，想逐步升级为 runtime + SDK”；
- “同一业务想在本地 Agent 和远程托管 Agent 之间切换”；
- “企业希望统一审批、审计、trace、成本和安全策略”。

### 9.3 MVP：先证明语义可移植，而不是追求 adapter 数量

**阶段 0：2 周，contract spike**

- 选一个 embedded framework（建议 Eino 或 LangGraph）和一个 subprocess harness（建议 Claude 或 Codex）。
- 用真实任务采集两边事件，形成 golden traces。
- 只冻结 `start/stream/cancel/approve/resume` 和 10–15 个核心事件。
- 写出 capability matrix 与无法映射的 vendor extensions。

**阶段 1：4–6 周，MVP**

- TypeScript 或 Go 先做一个语言；另一个客户端从 schema 生成或手写薄封装。
- 实现 native adapter、subprocess adapter、event ledger、基本 policy hooks。
- 覆盖 text/tool/artifact/diff/approval/usage/terminal states。
- 交付 conformance runner 和两套 reference adapters；没有 conformance 就不要称“通用”。

**阶段 2：6–12 周，production hardening**

- crash/restart/resume、backpressure、process-tree cleanup、tenant isolation。
- OTel、secret broker、sandbox SPI、artifact store、schema/version negotiation。
- 增加 ACP adapter 与 MCP tool provider。

**阶段 3：按需求扩展**

- A2A federation、AG-UI projection、managed runtime adapters。
- coding/research/data harness profiles。
- 集中式 policy/eval/observability control plane。

### 9.4 四个 go/no-go 验收门

1. **异构一致性：** embedded framework 和 subprocess harness 能否通过同一套生命周期/终态测试？
2. **故障恢复：** 进程在 tool call 前后崩溃时，能否明确知道可安全重试、需人工确认还是已经产生副作用？
3. **非最低公共子集：** vendor-specific diff、citations、computer-use 是否能完整透传，同时 portable core 仍稳定？
4. **真实降本：** 接入第二个 Agent 时，业务侧新增代码、测试和运维工作是否显著少于直接接厂商 SDK？

## 10. Conformance Suite：通用 SDK 的护城河

建议把兼容性测试作为产品核心，而不是文档附件。至少覆盖：

| 类别 | 必测场景 |
|---|---|
| Lifecycle | start、正常完成、业务失败、runtime crash、cancel、timeout、重复 cancel |
| Streaming | delta 顺序、背压、断连、重连、重复事件、超大 payload |
| Tools | call/result 配对、并行调用、schema error、超时、幂等键、半完成副作用 |
| Approval | allow/deny/modify、审批超时、断线后恢复、重复 decision |
| State | resume、checkpoint、fork（若支持）、版本升级后的恢复 |
| Process | ready handshake、stderr 噪声、非零退出、僵尸/子孙进程清理 |
| Isolation | cwd、用户配置、插件、MCP、凭据、环境变量和 session 目录 |
| Compatibility | 协议版本、runtime binary 版本、未知事件/字段、deprecation |
| Observability | trace/span 关联、usage、artifact lineage、policy/audit event |

每个 adapter 应输出一份机器可读 capability/conformance report。营销上的“支持某产品”应意味着通过了固定版本的测试，而不是 demo 能跑。

## 11. 风险与反模式

### 11.1 最大风险：制造“语义可移植”的幻觉

不同产品的 session、thread、checkpoint、tool、approval 定义并不相同。最危险的做法是用相同方法名掩盖不同可靠性。解决办法是 capability、明确错误、extension namespace 和逐 adapter 语义文档。

### 11.2 把本地子进程当成安全边界

subprocess 只提供故障/依赖隔离的一部分，不自动限制文件、网络、Keychain、浏览器、子进程和用户配置。安全属性必须由 sandbox、policy、secret broker 和可审计 approval 明确提供。

### 11.3 隐式继承用户环境

开发机里的全局配置、skills、hooks、MCP server、仓库指令和登录态会造成“本地可用、服务端失控”以及提示注入/供应链风险。生产 adapter 默认应采用 bare/isolated profile，并逐项 allowlist。

### 11.4 在 core 中复制云平台

Memory、identity、gateway、sandbox、evaluation、scheduler 都有不同企业实现。Core 应规定 contract 和 telemetry，不应过早绑定单一数据库、队列或云。

### 11.5 把多 Agent 数量当成功能成熟度

Agent 越多，失败组合、token 成本、权限边界和可观测复杂度越高。优先验证单 Agent + 工具 + durable control，再按真实任务引入 delegation。

## 12. 证据卡与来源

以下均为一手来源；动态文档的“日期”按本报告访问日 2026-08-19 记录。

| 来源 | 发布方 / 日期 | 类型 | 本报告使用的证据 |
|---|---|---|---|
| [Runtimes, frameworks, and harnesses](https://docs.langchain.com/oss/python/concepts/products) | LangChain / 访问 2026-08-19 | 官方概念文档 | framework、runtime、harness 的明确分层；LangChain/LangGraph/Claude Agent SDK 的相对位置 |
| [LangGraph Overview](https://docs.langchain.com/oss/python/langgraph/overview) | LangChain / 访问 2026-08-19 | 官方文档 | low-level orchestration runtime、durable execution、HITL、persistence |
| [Eino](https://github.com/cloudwego/eino) | CloudWeGo / 访问 2026-08-19 | 官方仓库 | Components、ADK、Compose、DeepAgent、streaming、interrupt/resume |
| [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) | OpenAI / 访问 2026-08-19 | 官方文档 | primitives、loop、handoffs、guardrails、sessions、tracing、sandbox agents |
| [Claude Agent SDK Overview](https://code.claude.com/docs/en/agent-sdk/overview) | Anthropic / 访问 2026-08-19 | 官方文档 | 复用 Claude Code tools/loop/context；SDK、CLI、Client SDK、Managed Agents 的区分 |
| [Hosting the Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/hosting) | Anthropic / 访问 2026-08-19 | 官方文档 | SDK 启动/监管 CLI 子进程、进程资源与版本绑定 |
| [Codex SDK](https://developers.openai.com/codex/sdk) | OpenAI / 访问 2026-08-19 | 官方文档 | 本地 Codex agents、thread/start/continue/resume、sandbox |
| [Codex App Server](https://developers.openai.com/codex/app-server) | OpenAI / 访问 2026-08-19 | 官方文档 | JSON-RPC-lite、stdio JSONL、thread/turn/item、审批与事件 |
| [GitHub Copilot SDK](https://github.com/github/copilot-sdk) | GitHub / 访问 2026-08-19 | 官方仓库 | 多语言 SDK、CLI server、JSON-RPC、进程管理 |
| [Google ADK](https://adk.dev/) | Google / 访问 2026-08-19 | 官方文档 | 多语言 Agent framework、graph workflow runtime、eval/deploy |
| [Microsoft Agent Framework Overview](https://learn.microsoft.com/en-us/agent-framework/overview/) | Microsoft / 更新 2026-08-10 | 官方文档 | Agent、Harness Agent、Workflow、integration 与 AutoGen/SK 后继路线 |
| [Strands Agents Harness SDK](https://github.com/strands-agents/harness-sdk) | Strands/AWS / 访问 2026-08-19 | 官方仓库 | model-driven、model-agnostic；Python/TypeScript loop、context、limits、observability 与 harness 定位 |
| [Amazon Bedrock AgentCore FAQ](https://aws.amazon.com/bedrock/agentcore/faqs/) | AWS / 访问 2026-08-19 | 官方产品文档 | Runtime、Memory、Gateway、Browser、Code Interpreter、Identity、Policy、Observability、Eval |
| [AgentCore Harness vs. Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-vs-runtime.html) | AWS / 访问 2026-08-19 | 官方概念文档 | Managed harness 提供 orchestration loop；Runtime 托管用户自带代码与 loop |
| [ACP v1 Overview](https://agentclientprotocol.com/protocol/v1/overview) | ACP / 访问 2026-08-19 | 官方规范 | 本地 client-agent JSON-RPC 生命周期与能力 |
| [A2A Specification](https://a2a-protocol.org/latest/specification/) | A2A Project / 访问 2026-08-19 | 官方规范 | Agent Card、message/task/artifact、stream 与远程 Agent 互操作 |
| [MCP 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) | MCP Project / 2026-07-28 | 官方发布说明 | 当前 stateless 核心与 initialize/session-id 变化 |
| [AG-UI Introduction](https://docs.ag-ui.com/introduction) | AG-UI / 访问 2026-08-19 | 官方文档 | Agent-UI 事件交互及与 MCP/A2A 的边界 |

## 13. 研究限制、后续观察与可验证假设

### 13.1 限制

- 本报告回答“产品形态和架构边界”，没有可靠统一口径来计算市场份额、客户数或真实生产采用率。
- 多数文档是滚动更新页；版本、preview/GA 状态和 API 会继续变化，正式选型前需锁定具体版本重新核验。
- 厂商自己的分类有营销立场；本文用跨产品责任边界做二次归类，并明确标注“本文判断”。
- 没有对各 SDK 做相同任务 benchmark；“更完整”不等于“任务效果更好、成本更低或安全更高”。
- 对低代码 Builder 和大量垂直 Agent SDK 仅做类型定位，没有逐一展开，因为它们不改变核心分类法。

### 13.2 接下来值得持续观察

- ACP 是否形成跨 IDE/本地 Agent 的稳定生态，以及与各厂商 app-server 的能力差距。
- A2A v1 的生产采用、身份/授权和长任务互操作是否真正落地。
- MCP stateless 新版本的 SDK 迁移与 capability discovery 实践。
- Claude/Codex/Copilot subprocess-backed SDK 的版本兼容、托管隔离和非编码场景扩展。
- OpenAI Agents SDK sandbox agents、Google ADK 2.0、Microsoft Harness Agent 是否继续向完整 harness 收敛。
- Eino 进入 1.x 后的 API 稳定承诺与生产 runtime 边界。
- Managed Agent platform 是否出现可移植的 state/artifact/policy 接口，还是继续形成云内锁定。

### 13.3 建议先验证的三条产品假设

1. 企业真正重复建设的不是 `Agent` 类，而是 session、events、approval、cancel、resume、sandbox 和 observability 的接入层。
2. 用一个 embedded adapter + 一个 subprocess adapter 就能发现 80% 的语义冲突；比一开始接 10 个框架更有学习价值。
3. 用户愿意为“统一治理与可验证兼容性”付费，但未必为“又一套跨框架 DSL”迁移。

这三条都是产品假设，不是已被本报告证明的市场事实。下一步应通过 5–10 个真实集成访谈与两套 reference adapter 原型验证。
