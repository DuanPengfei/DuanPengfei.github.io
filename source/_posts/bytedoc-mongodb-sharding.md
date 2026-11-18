---
title: "从扩一个从库到迁一个分片：ByteDoc 与原生 MongoDB 的架构差异"
date: 2026-11-18 16:00:00
tags:
  - MongoDB
  - 调研
---

假设订单库有一个写入特别频繁的租户。值班同学在控制台加了节点，过了一会儿，监控里的写入压力仍然集中在原来的主节点。要解释这件事，先得弄清楚加的是哪种节点。增加一个从库，改变的是哪些机器可以承担读取。增加一个 shard，改变的是哪些副本集可以拥有数据。要让新 shard 接手已有订单的写入，还要把相应的分片键范围迁过去。

<!-- more -->

这一区别也解释了两份技术资料看似矛盾的描述。字节跳动团队在 ByteDoc 3.0 的分享中，把秒级扩展读能力列为扩从库的目标。火山引擎的公有云文档则提醒用户，添加 shard 后要等待数据均衡，才能充分发挥扩容效果。两者谈的是不同的操作。[ByteDoc 3.0 技术分享](https://developer.volcengine.com/articles/7599494249788211227) · [火山引擎 Shard 变配说明](https://docs.volcengine.com/docs/mongodb/modify-shard-config?lang=zh)

本文用原生 MongoDB 8.0 作为对照。ByteDoc 3.0 指字节跳动团队在 2022 年公开介绍的系统，火山引擎对外提供的服务名为“文档数据库 MongoDB 版”。公开资料没有给出两者逐版本的内核对应关系。具体到公有云实例，架构和使用行为以产品文档为依据。[字节跳动技术团队原文](https://maimai.cn/article/detail?efid=HAExfqBtNUHH3SbrcxNIfA&fid=1730280299) · [火山引擎产品介绍](https://docs.volcengine.com/docs/mongodb/about-mongodb?lang=zh)

## 应用如何找到一笔订单

在原生 MongoDB 中，应用把查询交给路由进程 `mongos`。假设订单集合按 `tenantId` 做范围分片，配置服务器记录各个键范围属于哪个 shard。`mongos` 缓存这份映射，按租户查询时可以把请求发到拥有该范围的 shard。每个 shard 自身是一个副本集，其 Primary 承接写入。即使用哈希分片，MongoDB 也只是先把键值转换成哈希值，再按哈希值所在的范围路由。[MongoDB 8.0 分片架构](https://www.mongodb.com/docs/v8.0/sharding/) · [哈希分片机制](https://www.mongodb.com/docs/v8.0/core/hashed-sharding/)

火山引擎公开的分片模型与此一致。用户通过分片键定义集合的分布，可以选择范围分片、哈希分片或复合键。集群仍有 Mongos、ConfigServer 和 Shard 三类组件。公有云把部署方式做成了产品配置，例如每个 shard 默认包含一个主节点、一个从节点和一个隐藏节点，用户可以单独调整分片数和代理节点配置。[产品架构](https://docs.volcengine.com/docs/mongodb/about-mongodb?lang=zh) · [分片集群使用指南](https://docs.volcengine.com/docs/mongodb/ug-for-sharding-cluster?lang=zh)

## 扩容后，哪些请求能用上新资源

ByteDoc 3.0 团队披露的变化主要发生在部署和存储层。早期版本的计算和存储资源绑定在虚拟机上。到 3.0，团队将数据下沉到存储层，使用 Kubernetes 调度计算实例，并由 ByteDoc Operator 组建集群、扩展从库和管理跨机房的副本部署。这样，计算资源可以按需分配。团队在这里讨论的“秒级”对应读能力扩展目标，文章没有给出任意大小键范围的跨 shard 迁移耗时。[ByteDoc 3.0 云原生实践](https://developer.volcengine.com/articles/7599494249788211227)

回到订单库，同样是增加资源，业务看到的结果取决于具体操作。

| 操作 | 新资源可以承担什么 | 租户写入的去向 |
|---|---|---|
| 给 Shard A 加只读节点 | 读取偏好允许访问从库的查询 | 仍由 A 的 Primary 承接 |
| 增加 Mongos | 更多连接和请求路由工作 | 仍由原来拥有该范围的 shard 承接 |
| 增加 Shard B 并完成范围迁移 | B 开始承担迁入范围的读写 | 迁入范围的写入转向 B 的 Primary |

这个例子还隐含一个条件。如果完整分片键只有 `tenantId`，一个租户的所有订单都取同一个键值。范围迁移能把这个租户从 A 搬到 B，却无法让 A 和 B 同时分担该租户的订单写入。在 `tenantId` 后面加入具有足够多不同取值的字段，才有机会把租户内部的数据分到多个范围。相应地，只带租户条件的查询也可能需要访问多个 shard。这项取舍在两者公开的分片模型中都存在。[MongoDB 分片键选择](https://www.mongodb.com/docs/v8.0/core/sharding-choose-a-shard-key/) · [火山引擎分片指南](https://docs.volcengine.com/docs/mongodb/ug-for-sharding-cluster?lang=zh)

## 迁移时，最后一笔并发写入去了哪里

假设某笔订单已经从 A 复制到 B。就在复制完成之后，业务又在 A 把订单状态从“待支付”改成“已支付”。如果此刻直接把路由切到 B，用户就可能再次看到“待支付”。原生 MongoDB 的范围迁移需要同时解决两个问题：让 B 收到最后一次修改，并让 A 停止以旧归属接受写入。

在原生 `r8.0.0` 的实现中，复制期间 A 继续处理业务读写，同时跟踪迁移范围内已提交的修改。B 分批拉取数据，再拉取需要重新加载的文档和删除信息。接近同步时，A 进入写临界区。B 在收到最终同步信号后至少再检查一次增量，并等待所需的复制确认。这最后一次检查覆盖了“上一次检查队列为空，到源端真正停止写入”之间的窗口。[源端增量跟踪实现](https://github.com/mongodb/mongo/blob/r8.0.0/src/mongo/db/s/migration_chunk_cloner_source.cpp) · [目标端最终同步实现](https://github.com/mongodb/mongo/blob/r8.0.0/src/mongo/db/s/migration_destination_manager.cpp)

B 准备好以后，A 在请求配置服务器提交归属变化之前，也会阻塞源 shard 上对该集合的读取。归属切到 B 后，使用旧路由的请求会遇到版本检查，路由层据此刷新。A 上的旧数据稍后异步删除。这里有三个不同的完成时刻：B 拿到了数据、配置服务器提交了归属、A 清理了旧副本。观察到其中一个，并不能推出另外两个已经发生。[源端提交实现](https://github.com/mongodb/mongo/blob/r8.0.0/src/mongo/db/s/migration_source_manager.cpp) · [路由版本协议](https://github.com/mongodb/mongo/blob/r8.0.0/src/mongo/db/s/README_versioning_protocols.md)

如果配置服务器已提交，而成功响应在网络中丢失，A 看到的只是一次超时。原生 MongoDB 恢复时先看持久化的迁移决定；如果尚无决定，就向配置服务器核实。提交成功，保留 B 的数据并清理 A；确认未提交，则保留 A 并清理 B 的临时副本。火山引擎对外说明了 Balancer 支持在线迁移、迁移会增加负载，可以配置活动时间窗口。公开资料没有披露 ByteDoc 在这个故障窗口如何判定提交结果，也未说明跨 shard 时是否复用底层存储块。因此，上述时序有固定版本的上游源码可查，公有云的具体内核实现仍待证实。[原生迁移恢复设计](https://github.com/mongodb/mongo/blob/r8.0.0/src/mongo/db/s/README_migrations.md) · [火山引擎 Balancer 说明](https://docs.volcengine.com/docs/mongodb/ug-for-sharding-cluster?lang=zh)

## 文档里的均衡算法为何看起来不同

火山引擎分片指南用各 shard 之间的 **chunk 数量差异**解释均衡触发条件，还提到了 MongoDB 4.2 的自动切块行为。原生 MongoDB 8.0 手册则按**同一集合在不同 shard 上的数据量差异**描述阈值。以默认 128 MB 的范围大小为例，常规数据量均衡的阈值为 384 MB。上游也明确说明，从 6.0.3 起，旧的自动切块机制不再执行。两份文档确实有差异，但要据此认定火山引擎修改了均衡算法，还缺少同一内核版本下的实现或运行证据。[火山引擎分片指南](https://docs.volcengine.com/docs/mongodb/ug-for-sharding-cluster?lang=zh) · [MongoDB 8.0 均衡阈值](https://www.mongodb.com/docs/v8.0/core/sharding-balancer-administration/#migration-thresholds) · [自动切块版本变更](https://www.mongodb.com/docs/v8.0/reference/method/sh.disableautosplit/)

因此，判断一次扩容是否解决了开头的订单热点，要看两个具体事实：新节点能处理哪类请求，以及热点键范围最终归谁所有。ByteDoc 公开的工程实践解释了如何更快地提供计算资源。真正决定这笔订单写到哪里的，仍然是分片键、范围归属以及那次归属切换是否已经提交。
