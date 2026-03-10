# Requirement Center Interaction Spec

Status: Draft  
Last updated: 2026-03-10

## 1. Requirement Center Page

### Summary Block

必须展示：

- 当前主线标题
- 当前状态
- 当前负责人
- 当前阶段
- 下一步
- 最近更新时间

### Primary CTAs

需求中心必须始终保留 4 个入口：

- 去协作
- 看交付
- 去排障
- 打开负责人

### Execution Block

必须展示：

- 当前任务顺序
- 每个任务的拥有者
- 执行态标签
- 已完成步骤 / 总步骤

### Timeline Block

必须展示：

- workflow event、chat evidence 和本地验收动作组成的主线时间线
- 进入需求中心、进入协作/交付、进入 Ops、验收动作的轻量指标
- 同一 revision 的本地动作和 company event 需要去重，避免重复刷屏

### Collaboration Block

必须展示：

- 当前需求房标题
- 最近协作摘要
- 派单数量
- 参与成员数量
- 最近同步时间
- 最近 4 条房间消息

每条房间消息必须尽量标明：

- 来自谁
- 派给谁
- 对应哪次 dispatch

### Deliverables Block

必须展示：

- 最近交付物列表
- 来源成员
- 工作区
- 更新时间
- 大小或摘要
- 打开完整 Workspace 的入口

### Acceptance Block

必须展示：

- 当前验收状态
- 状态说明
- 验收通过
- 继续修改
- 驳回重开

只有在结果已收口时，才允许出现“发起验收”。

## 2. CEO Deep Chat Settled Card

### Trigger

当 CEO 深聊已经形成当前主线 requirement aggregate 时出现。

### Fields

- 已收敛需求标识
- 当前状态
- 标题
- 摘要
- 当前负责人
- 当前阶段
- 下一步

### Actions

- 开始推进这条需求
- 进入需求房
- 打开负责人
- 查看详情

### Design Intention

让用户明确感知“现在已经从发起/澄清阶段进入主线推进阶段”。

## 3. Requirement Room Transparency

### Goal

减少用户把需求房误解为“唯一真实群聊线程”的概率。

### Message-level Display

对房间消息增加以下展示：

- 派给谁
- 来自谁
- 对应派单标题
- 当前派单状态

### System Rule

如果底层是多个 direct session 投影回房间，前台必须承认这一点，而不是假装所有成员都在同一原生线程里。

## 4. Acceptance Actions

### 发起验收

- 将主线切到“待你验收”
- 不自动等同于完成
- 立即写入主线时间线，不依赖远端补账后才可见

### 验收通过

- 将主线标记为“已完成”
- 保留当前结果作为本次需求闭环

### 继续修改

- 将主线退回执行态
- 不创建第二条主线

### 驳回重开

- 将主线退回执行态
- 显式保留“驳回重开”语义
- 不创建第二条主线
