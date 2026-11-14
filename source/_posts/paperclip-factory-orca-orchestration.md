---
title: "Paperclip、Factory 与 Orca 深度对比：任务拆解、多 Agent 编排、上下文共享与失败恢复"
date: 2026-11-14 18:00:00
tags:
  - AI Agent
  - 工程
  - 调研
---

Paperclip 把任务放进一个持续运转的 Agent 组织，Factory 把大型软件项目组织为 Workstreams 或 Missions，Orca 则为不同编码 Agent 提供工作区和受监督的任务执行协议。三者真正的差别，藏在任务与执行尝试是否分离、上下文如何交接、失败之后依据什么继续，以及谁有权认定工作完成。

<!-- more -->

本文核对日期为 **2026 年 11 月 14 日（Asia/Shanghai）**。结论基于官方文档以及 Paperclip、Orca 的部分开源实现，未进行三款产品的安装对照实验或故障注入。因此，本文比较的是产品机制与证据完整度，不是成功率、性能或采购排名。

证据分为三种：**文档确认**表示官方明确描述；**源码观察**表示在固定提交中检查到对应结构或逻辑；**分析判断**表示依据这些材料推导出的架构意义。没有发现某项公开说明，不等于产品没有该能力。

## 先看结论：三种编排中心

| 维度 | Paperclip | Factory | Orca |
| --- | --- | --- | --- |
| 核心对象 | 持续存在的组织、角色和 Issue | Workstream 或 Mission | 工作区、Run、Task、Dispatch |
| 谁决定拆分 | CEO / 管理者 Agent；接受的计划可生成子任务 | Workstream 协调者动态委派；Mission 先规划 feature 和 milestone | 人或协调者 Agent 创建任务与依赖 |
| 主要协作方式 | 分配任务、事件唤醒、评论与状态回写 | 独立 Droid 会话向协调者汇报，配合共享文件 | 不同 Agent 的 Worker，通过消息与受监督 Dispatch 协作 |
| 共享上下文 | Issue、祖先链、计划文档、评论、附件、继续执行摘要 | Workstream brief、跨机器共享文件；配置与技能继承 | Task spec、Worker preamble、消息与工作目录 |
| 恢复重点 | 任务所有权、运行恢复、分类重试、停滞任务检查 | 人与协调者协作重规划；验证失败转为修复工作 | 执行尝试身份、消息确认、显式重试、进程归属 |
| 最值得借鉴 | 长期任务与组织管理 | 有验收过程的软件交付 | 跨 Agent 的执行协议与工作台 |

上述归类是本文的分析框架。基础来源分别是 [Paperclip 委派说明](https://docs.paperclip.ing/guides/org/delegation/)、[Factory Workstreams](https://docs.factory.com/workstreams/overview)、[Factory Missions](https://docs.factory.com/missions/overview) 和 [Orca 编排文档](https://orca.dev/docs/cli/orchestration)。

需要先排除三个误解：多个会话同时工作，不自动等于任务依赖被正确调度；Agent 能继续聊天，不自动等于外部操作不会重复；任务显示完成，也不自动等于成果通过验收。

## Paperclip：围绕长期任务组织 Agent

### 拆解从组织目标进入任务树

Paperclip 的委派路径是：用户给出目标，CEO Agent 提出策略，经过审批后创建任务并分派给下属；下属执行、回写进度，管理者继续监督和处理阻塞。它支持继续细化子任务，也允许 Agent 提出增聘请求。因此，“拆解”不是单独一次生成计划，而是组织运行中的持续动作。[委派机制](https://docs.paperclip.ing/guides/org/delegation/)

这里至少存在两种不同关系。`parentId` 表示工作归属和分解层级；`blockedByIssueIds` 表示执行阻塞。父子任务不应被理解为天然的串行关系。Issue API 还区分 `createdFrom`：它记录任务来自哪次运行，而不是父任务或依赖。这种拆分有助于回答三个不同问题：为什么做、什么时候能做、是谁创建的。[Issue API](https://docs.paperclip.ing/reference/api/issues/)

接受计划后的子任务生成，另有幂等记录。官方文档描述按接受的计划修订跟踪生成进度，重复请求复用记录。源码中的 `issue_plan_decompositions` 保存计划修订、请求指纹、预期子任务、已生成子任务 ID、拥有者和完成时间，并对公司、源任务、计划修订建立联合唯一索引。[计划拆解说明](https://docs.paperclip.ing/experimental/plan-decomposition-panel/) · [固定提交中的表结构](https://github.com/paperclipai/paperclip/blob/54c3616ad97f20eb71f36f61edb014705ca74364/packages/db/src/schema/issue_plan_decompositions.ts)

**分析判断：**这是比“让模型输出待办列表”更扎实的产品设计：计划有修订身份，拆解有持久记录。但唯一索引本身不能证明整个生成过程的所有崩溃窗口都已正确处理，更不能把文档里的 exactly-once 扩大成“每个外部工具操作只发生一次”。

### 编排靠唤醒、领取和回写

Paperclip 的 Heartbeat 指一次被调度的工作窗口，不只是“我还活着”的信号。官方执行协议包括读取身份和审批、获取任务、选择工作、checkout、理解上下文、执行、更新状态以及必要时委派。

checkout 成功意味着本次运行获得任务执行权；重复领取自己的任务可幂等成功，其他 Agent 已拥有任务时返回 `409 Conflict`。官方明确要求此时换任务，不能把冲突当成普通瞬时故障持续重试。状态修改还携带运行 ID，用于检查归属。[Heartbeat 协议](https://docs.paperclip.ing/guides/projects-workflow/routines/)

这使并行协作落在共享任务系统上：不同 Agent 可以领取不同任务；多人协作一个大目标时，应分解成不同子任务，而不是争抢同一个 Issue。具体调度公平性、最大并发和吞吐上限，本次未做验证。

### 上下文共享分成任务事实与会话连续性

Paperclip 提供 `heartbeat-context` 接口，返回精简任务、祖先、项目与目标摘要、评论游标、唤醒评论、附件摘要，以及适用时的计划评审反馈。它的作用是为一次唤醒提供必要背景，而不是把所有 Agent 的完整聊天记录合并。[上下文接口](https://docs.paperclip.ing/reference/api/issues/#heartbeat-context)

源码抽查还看到继续执行摘要、祖先信息和唤醒评论的组装逻辑。因此，跨 Agent 的可靠交接点应当是可持久读取的任务资料；某个 Agent 的私有历史只是补充。[上下文组装源码](https://github.com/paperclipai/paperclip/blob/54c3616ad97f20eb71f36f61edb014705ca74364/server/src/services/heartbeat/task-context.ts)

会话是否续接则由执行路径决定。例如 Codex 适配器文档区分 ACP、经典 CLI 和原生 Runner，并描述不同的会话持久方式。更换目录或执行引擎可能产生新会话，不能把一种适配器的行为推广到所有 Agent。[Codex 适配器](https://docs.paperclip.ing/reference/adapters/codex/)

**分析判断：**Paperclip 比较适合让 Agent 的职责长期存在、每次执行短暂发生。即使换模型或重开会话，任务系统仍保存“为什么做、做到了哪里、等待谁”。代价是交接文档、摘要和评论必须及时维护；平台保存了资料，不代表模型一定读取到了正确版本。

### 失败恢复覆盖运行故障和错误停工

应将 Paperclip 的恢复能力分开看：

| 故障类型 | 已核对的机制 | 不能据此推断的保证 |
| --- | --- | --- |
| 领取冲突 | 409 后退出争抢，改选任务 | 不代表业务系统中的外部资源也被锁定 |
| 执行环境临时故障 | 源码存在分类、延迟和次数受限的重试逻辑 | 不代表每种错误都自动重试 |
| Runner / 服务重启 | 检查旧运行、进程与 turn 的证据，再决定恢复路径 | 不代表盲目重放中断请求是安全的 |
| 任务树错误地停止 | 可选 Task Watchdog 检查停止原因并恢复后续路径 | 不代表所有任务默认受到二次验收 |

运行恢复实现的一个重要细节是区分“确实收到 provider 的终止事件”和“只是本地事件流结束”。`restart-interrupted-turn.ts` 检查 `providerTerminalObserved`，对某些无法确认结果的 turn 记录 `native.interrupted_turn_outcome_unknown`，并明确保存 `replayed: false`；它还沿运行链检查是否已经进行过自动继续。这里的恢复依据是证据与来源，而不是简单的超时重发。[恢复源码](https://github.com/paperclipai/paperclip/blob/54c3616ad97f20eb71f36f61edb014705ca74364/server/src/services/heartbeat/restart-interrupted-turn.ts) · [重试实现](https://github.com/paperclipai/paperclip/blob/54c3616ad97f20eb71f36f61edb014705ca74364/server/src/services/heartbeat/retries.ts)

需保留一个版本边界：适配器文档描述了原生 Codex 在特定重启情形下续接原会话；当前源码同时存在新会话接续已保存工作的分支。本次没有运行完整调用链，不能把它们简化为统一的“重启后一定原地继续”。

Task Watchdog 则解决另一种失败：没有报错，但整个任务子树停住了。它是按 Issue 启用的检查 Agent，对停止状态做复核，并用状态指纹避免重复审查相同停滞。官方还明确区分仅提示输出沉默的监控、自动 liveness recovery 与这个语义检查器；输出沉默监控本身不会自动取消运行。Watchdog 不能越过审批和服务器权限边界。[Task Watchdogs](https://docs.paperclip.ing/guides/projects-workflow/task-watchdogs/)

**分析判断：**Paperclip 的亮点是承认“模型误判完成、误判阻塞”本身也是需要处理的故障。它仍需要可信验收证据，否则第二个 Agent 只是再次相信第一个 Agent 的总结。

## Factory：必须分开看 Workstreams 与 Missions

### Workstreams 是持续的动态委派

每个 Workstream 有一个协调者和多个独立 Droid 会话。协调者负责拆分工作、发送 brief、追踪进度和收集结果；它可以复用已有 Agent，也可以中断当前轮次重新定向。Worker 不会自动看到用户与协调者的完整对话，因此 brief 的完整性直接影响执行质量。用户可以直接进入 Worker 会话，但官方建议把改动方向同步告诉协调者。[Steer a Workstream](https://docs.factory.com/workstreams/steer)

这体现了一个实际限制：用户、协调者和 Worker 都可能改变计划，但它们的对话上下文并不天然一致。平台允许多入口控制，仍需要明确的计划同步路径。

机器选择也参与调度。协调者读取机器描述来分配工作，例如具有移动端代码库、Xcode 和模拟器的机器适合 iOS 任务。Environment 可以为每个 Agent 创建独立云端机器；本地或既有 Droid Computer 上的 Agent 则可能共享机器与工作目录，不能一概写成“每个 Worker 都有独立沙箱”。[机器与放置规则](https://docs.factory.com/workstreams/machines)

Workstreams 当前仍标为 Beta，官方列出的开放套餐与企业产品范围并不完全一致。购买或部署时，应单独核对该功能的实际开放状态，而不是只看 Factory 的整体企业能力。[Workstreams 概览](https://docs.factory.com/workstreams/overview)

### Missions 是计划、里程碑与验证的执行循环

Missions 在执行前与用户明确范围，形成 feature、顺序、milestone 和所需技能。里程碑不仅展示进度，还决定验证发生的时机。官方配置将验证区分为 scrutiny 与 user-testing，可单独配置验证模型，也存在跳过验证的设置。[Missions 概览](https://docs.factory.com/missions/overview) · [配置参考](https://docs.factory.com/missions/reference)

其基本循环可以概括为：

```text
目标与约束 → feature / milestone 计划 → 执行 feature
                                          ↓
                                 里程碑验证与用户场景测试
                                          ↓
                            通过：继续；失败：增加修复工作
```

这是依据官方说明绘制的概念流程，不代表已核实其内部状态机。官方规划文档给出的初始估算是“feature 数 + 两倍 milestone 数”的 Worker 运行次数；验证失败会产生额外修复 feature，因此只是下限估算。[Planning & Validation](https://docs.factory.com/missions/planning)

有一个容易夸大的地方：Missions 文档仍把“并行化是否改善结果”列为探索问题。因此，可以确认它有多 Agent 角色和结构化执行，但不应把 Workstreams 已明确描述的并行委派能力，自动等同于 Missions 任意依赖图上的并行调度保证。[Missions 的开放问题](https://docs.factory.com/missions/overview#open-questions)

**分析判断：**Missions 最值得借鉴的是把验证嵌入任务结构。一个里程碑什么时候结束，取决于验收安排，而不只是模型说“这一阶段完成了”。不过，验证可以跳过，能否真正验收还依赖代码库提供可启动、可观察、可驱动的测试环境。

### 上下文通过 brief、共享资料与独立会话组合

Workstream 的共享文件夹让不同机器上的协调者和 Worker 读写计划、发现、交接文档与报告；代码改动仍保存在仓库中，通过 PR 交付。共享文件夹与聊天同步有不同控制项，关闭相应配置会影响共享行为。[共享文件夹](https://docs.factory.com/workstreams/shared-folder)

应把三种数据区分开：brief 是分工指令；共享文件是协作资料；Worker 会话保存自己的过程。共享文件可见，不等于它已进入每个 Agent 当前的模型上下文。协调者也有独立的会话压缩配置，这进一步说明长任务不可能永远依靠原始聊天记录。[Workstream 设置](https://docs.factory.com/workstreams/settings)

公开文档没有在本次核查范围内说明共享文件的并发冲突策略、版本一致性和写入事务语义。因此，“跨机器同步”不能直接解释为“多个 Agent 同写一个文件不会丢失内容”。较稳妥的使用方式是给不同 Worker 分配独立产物路径，再由协调者整合；这是本文建议，不是 Factory 的默认保证。

### 故障恢复公开证据的边界

Factory 明确提供人工介入路径：Missions 卡住时暂停协调者，描述问题并要求调整；验证失败可引出修复工作。它还区分执行位置的存活行为：云端机器可在笔记本关闭后继续，本地 Workstream 在退出桌面应用后停止，Remote Control 机器需要保持开机联网。[CLI 运行与干预](https://docs.factory.com/missions/running-cli) · [机器生命周期](https://docs.factory.com/workstreams/machines)

这些说明能支持“持续执行与重规划”，尚不足以证明数据库级别的执行恢复语义。本次公开资料未确认以下问题：协调者崩溃后怎样恢复完整调度状态；外部写入成功但回执丢失时怎样去重；任务重试次数如何跨重启保存；部分失败时如何恢复资源与任务身份。

**分析判断：**Factory 在计划、Worker、共享资料和验收界面上描述得较完整；内部一致性与恢复协议的可审查程度低于开源项目。本次未取得其核心编排实现，不能据此判定恢复能力较弱，只能说证据不足以作同等强度的结论。

## Orca：把不同 Agent 纳入显式执行协议

### Task 与 Dispatch 是理解编排的关键

Orca 用 Run 组织任务与消息，用 Task 表示要完成的工作，用 Dispatch 表示一次执行尝试。Run 本身不自动做 Worker 放置；拆解和启动动作仍由协调者执行。任务依赖与决策关卡提供运行约束，不能替代协调者的计划质量。[编排文档](https://orca.dev/docs/cli/orchestration)

源码核对提供了比功能介绍更明确的证据：创建 Task 时要求存在 Run，父任务和依赖必须属于同一 Run；依赖未全部完成时初始状态为 pending，否则为 ready。后续依赖完成会触发 ready 状态推进。Dispatch 创建则检查任务必须 ready，并在保存点内建立尝试记录与更新任务状态，冲突时回滚。[Task 存储实现](https://github.com/stablyai/orca/blob/98d73ddcae601b252892c78aba313bffee6a8d92/src/main/runtime/orchestration/db/tasks/task-store.ts) · [Dispatch 实现](https://github.com/stablyai/orca/blob/98d73ddcae601b252892c78aba313bffee6a8d92/src/main/runtime/orchestration/db/dispatch-context/dispatch-context-store.ts)

这说明 Orca 的编排不是仅靠提示词约定先后顺序，数据库中确实有依赖与执行状态。但源码静态检查不能替代并发竞争、数据库损坏或主机故障测试。

### 上下文靠任务简报与消息协议交接

Worker 启动时收到 preamble，里面有任务身份、如何向协调者汇报、如何询问阻塞问题等约定；后续工作可作为新的简报进入同一会话。源码中可以看到明确的汇报模板和再派发提示。它没有因此变成“所有 Worker 共享同一个模型上下文”。[Worker preamble 源码](https://github.com/stablyai/orca/blob/98d73ddcae601b252892c78aba313bffee6a8d92/src/main/runtime/orchestration/workers/launch/worker-dispatch-preamble.ts)

文件协作则取决于工作区选择。官方协调者指南要求同时编辑相同文件的 Worker 使用不同工作区，并由协调者在每次唤醒后启动 ready 任务。它提供机制，合并代码和维护共享约定仍需要工作流设计。[协调者循环](https://github.com/stablyai/orca/blob/98d73ddcae601b252892c78aba313bffee6a8d92/skill-guides/orchestration/references/coordinator-loop.md)

### 恢复强调身份与不确定状态

Orca 的恢复指南区分失败、停止和“无法证明已停止”。重试关联原 Dispatch，并留在原 Task；启动位置要重新指定。当前指南还规定同一重试链三次启动失败后熔断，Worker 自报任务失败不计入这一启动失败计数。这里应把它视为当前恢复契约，本次没有实测熔断。[恢复与清理指南](https://github.com/stablyai/orca/blob/98d73ddcae601b252892c78aba313bffee6a8d92/skill-guides/orchestration/references/recovery-and-cleanup.md)

该指南同时指出：没有输出、启动超时或存活状态不可验证，都不能单独证明进程已经退出；逻辑放弃一个 Dispatch 也不等于取消底层物理执行。**分析判断：**这是一个重要的分布式系统边界——控制面认为任务结束，执行机器上仍可能有进程继续写文件。

还要区分两种经常被称作“恢复”的能力。Orca 后台 daemon 持有 PTY，因此退出前台应用后仍可重新附着原进程；主机重启或 daemon 死亡则会结束这些进程，下一次恢复界面与历史输出不代表旧进程复活。[Session restore](https://orca.dev/docs/model/session-restore)

另外，官方的 worktree checkpoints 页面描述的是工作区状态备注与卡片状态，适合给人和 Agent 留下进展信息，不是 CPU、文件系统或工具调用的可重放快照。[Worktree checkpoints](https://orca.dev/docs/cli/worktree-checkpoints)

## 横向比较：同一种故障，恢复对象不同

| 场景 | Paperclip | Factory | Orca |
| --- | --- | --- | --- |
| 计划重复提交 | 文档有计划修订幂等记录，源码有对应唯一约束 | 本次未确认等价公开契约 | Task / Dispatch 分离不等于计划生成幂等，需另查调用路径 |
| 两个 Worker 领取同一工作 | checkout 与 run 归属检查 | 协调者分工明确，领取竞争细节未公开确认 | ready 检查与 Dispatch 状态事务 |
| 上下文太长 | 精简任务上下文、继续执行摘要、适配器会话机制 | brief、共享文件与协调者压缩配置 | 任务简报、消息与 Agent 自身上下文机制 |
| 进程失联 | 检查恢复证据，按运行路径决定续接或重试 | 公开说明重在机器存活与人工干预 | 明确区分未知、停止与放弃 |
| 工作错误地停住 | 按任务启用 Watchdog 复核 | 协调者重规划；Mission 验证产生修复项 | 协调者检查任务、消息与阻塞关系 |
| 已执行外部操作但未收到回执 | 源码避免把未知结果简单视为可重放；外部系统仍需对账 | 未确认统一保证 | 尝试身份不能单独保证外部 API 幂等 |

这张表汇总前文证据，不是“有 / 无”功能打分。尤其不能将资料公开程度当成可靠性排名。

更严格的恢复评估应至少拆成五层：界面和历史记录恢复、进程重新附着、模型会话继续、任务重新调度、外部副作用核对。只有前四层正常，也可能发生重复发消息、重复开 PR 或重复写入业务记录。

## 用同一个项目理解三种产品

假设要把一个服务从旧鉴权协议迁移到新协议，需要后端修改、客户端适配、兼容测试和发布文档。以下是依据产品机制设计的使用示例，未经实测。

在 **Paperclip** 中，可以建立迁移目标和父 Issue，再由管理者分解并分配角色任务。客户端任务通过阻塞关系等待接口契约，结果写回任务文档与评论；最后由审查流程或 Watchdog 检查是否仍有未解决项。它适合把迁移放入持续运作的团队任务体系。

在 **Factory Missions** 中，可以先把接口兼容、客户端切换和旧逻辑移除规划为里程碑，在每个阶段安排验证，失败后新增修复项。在 **Workstreams** 中，则可以让协调者持续分派后端、客户端和测试工作，通过共享资料与 PR 汇总。这两个入口服务于不同程度的预先规划。

在 **Orca** 中，可以创建含依赖的 Task：先完成接口契约，再并行启动后端与客户端 Worker，最后执行集成验证。每次重试仍属于原任务，但有独立 Dispatch；代码隔离使用工作区，最终审查和整合由协调者安排。它适合保留现有 CLI Agent，并补足统一监督能力。

## 对 Agent 平台设计的启示

如果要建设自己的 Agent Factory，最值得组合借鉴的是：Paperclip 的长期任务与责任关系，Factory 的里程碑验收，Orca 的执行尝试身份。

一个可审查的最小对象模型可以是：

```text
目标 → 计划修订 → 任务与依赖 → 执行尝试 → 执行环境
                       ↓          ↓
                  验收条件     事件、产物、外部操作凭据
                       └──── 验证与恢复决策 ────┘
```

这是本文提出的设计建议，不是三家产品共同采用的内部模型。设计时应明确：

- **计划与执行分开。** 修改计划不能悄悄改变已经运行的尝试；需要记录修订和受影响任务。
- **任务与尝试分开。** 重试不能丢掉前次运行的产物、费用和未知副作用。
- **共享资料与私有历史分开。** 交接使用明确版本的任务事实和产物链接，不依赖复制整个聊天记录。
- **完成与验收分开。** Worker 可以声明完成，最终完成状态应依赖可检查的结果。
- **存活与进展分开。** 进程活着不代表在推进；没有输出也不代表已经死亡。
- **恢复与重放分开。** 对未知外部结果先核对，再决定续接、补偿或重试。

这些原则比增加 Worker 数量更直接地影响长任务的可控性。

## 下一轮实测怎样验证

推荐用同一代码仓库、相近模型预算和同一验收条件，执行下列实验。Factory 要分别测试 Missions 与 Workstreams，并区分 Local、Environment 和既有 Droid Computer。

| 实验 | 注入方式 | 重点观察 |
| --- | --- | --- |
| 重复计划 | 同一计划确认两次，在子任务生成中断后继续 | 是否重复创建任务，修订与子任务是否完整关联 |
| 领取竞争 | 两个 Worker 同时接受同一任务 | 是否只有一个有效拥有者，拒绝是否可见 |
| 协调者重启 | Worker 正在运行时重启协调层 | 是否重复派发，原 Worker 是否被识别 |
| 未知外部结果 | 外部操作成功后丢失回执 | 是否对账、暂停或重复操作 |
| 依赖失败 | 上游任务失败，下游等待 | 是否错误启动下游，能否重规划 |
| 上下文冲突 | 两个 Worker 更新同一共享资料 | 是否丢写，谁负责整合，读取版本能否追踪 |
| 错误完成 | Worker 报告成功但验收测试失败 | 是否重新打开工作，是否产生有界修复循环 |
| 预算耗尽 | 执行中触发配额上限 | 是否保存状态，恢复后是否重复执行 |

应记录完成率、重复外部操作数、恢复耗时、人工介入次数、返工量和总成本。单独统计 Agent 数量或生成代码行数，无法回答编排器是否真正改善交付。

## 证据范围与复核入口

| 对象 | 发布者与材料类型 | 本次版本依据 | 复核范围 |
| --- | --- | --- | --- |
| Paperclip | paperclipai 官方文档与开源仓库 | `54c3616ad97f20eb71f36f61edb014705ca74364` | 抽查计划拆解表结构、上下文组装、重试与重启恢复；未执行测试 |
| Factory | Factory 官方产品文档 | 2026-11-14 访问的在线文档 | Workstreams、Missions、机器、共享文件、验证与干预；未取得核心实现 |
| Orca | Stably 官方文档与开源仓库 | `98d73ddcae601b252892c78aba313bffee6a8d92` | 抽查 Task / Dispatch、Worker preamble 与恢复契约；未执行测试 |

官方在线文档多未标注单页发布日期，本文使用访问日期，不把搜索抓取日期当成发布时间。开源默认分支也不必然对应用户已安装的稳定版本。Orca 编排层仍有实验性提示；Factory Workstreams 为 Beta；Paperclip 的部分界面和 Runner 路径也有实验性标记，实际使用需核对具体版本与执行路径。

对当前选型，研究持续任务运营优先看 Paperclip，研究软件项目的规划与验收优先看 Factory，研究兼容多种编码 Agent 的工作台和执行契约优先看 Orca。可靠性结论应等到故障注入结果之后再下，而不是从产品演示或静态源码直接推定。
