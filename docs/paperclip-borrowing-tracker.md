# Paperclip 借鉴追踪表

Status: Draft  
Last updated: 2026-03-13  
Purpose: 记录 `cyber-company` 可以从 `paperclip` 借鉴的能力、当前采纳状态、计划落点、预期收益，以及后续架构升级时的回填方式

## 1. 使用方式

这份文档的目标不是证明 `cyber-company` 要变成 `paperclip`，而是回答三个更实际的问题：

1. `paperclip` 有哪些成熟能力值得系统性借鉴
2. 当前方案到底借鉴了哪些点，借鉴到什么程度
3. 每一轮架构升级之后，我们如何回看节奏、效果和偏差

更新原则：

- 每个可借鉴点使用固定 ID
- 每次方案落地时，必须在“当前采用情况”里更新状态
- 每个版本计划都要显式引用相关 ID
- 如果决定不借鉴，也要记录原因，避免反复讨论

## 2. 状态说明

| 状态 | 含义 |
|---|---|
| `observed` | 在 `paperclip` 中识别到，但尚未进入本项目规划 |
| `candidate` | 判断值得借鉴，已进入讨论或文档建议 |
| `planned` | 已进入明确版本计划 |
| `active` | 当前唯一施工切片正在实现 |
| `stabilizing` | 主实现已落地，但还没达到关闭标准，处于收尾与验证阶段 |
| `adopted` | 已落地到当前架构或产品 |
| `rejected` | 明确决定不借鉴或暂不借鉴 |

补充说明：

- `in_progress` 只保留在历史记录里，表示旧文档阶段曾用过更粗的状态口径。
- 从当前版本开始，实时状态统一拆成 `active` 和 `stabilizing`，避免“看起来一直全都在做”的误解。

## 2.1 状态粒度说明

这张表记录的是“顶层借鉴项状态”，不是“当前并行施工数”。

也就是说：

- 同时只允许一个 `active`
- 可以有多个 `stabilizing`

当前推荐的执行约束是：

- 顶层借鉴项同时只能有一个 `active`
  原因：当前项目按单人串行推进，主施工焦点必须唯一。
- 已落主实现但没关单的项统一记为 `stabilizing`
  原因：这些项仍然开放，但不是当前主施工焦点。
- 实施层面始终只保留一个“当前唯一施工切片”
  原因：当前项目按单人串行推进，真正并行开工只会放大上下文切换和状态漂移。

截至 2026-03-13，当前没有新的 `active` 顶层借鉴项。

V1 closeout 结论：

- `PC-STATE-01`
  已在 V1 范围 adopt：关键对象的 revision / command / material-change 语义已经从“半投影”收成了更稳的 authority-owned 边界。
- `PC-STATE-03`
  已在 V1 范围 adopt：主线对象、执行对象、证据对象的分层已经够稳定，读路径 repair 也已拆出。
- `PC-GOV-03`
  已在 V1 范围 adopt：对象 lifecycle audit、workflow payload audit 和高信号 operator action audit 都已经进入统一 company event log。

## 2.2 关单规则

为了避免 `stabilizing` 长期堆积成技术债，这份追踪表从当前版本开始采用以下规则：

1. 顶层借鉴项只有在“当前目标范围”完成时才允许关闭
   也就是不能为了好看而提前标成 `adopted`。
2. 但也不允许把残余问题无限挂在原项上
   如果主实现已经完成、剩余内容已经明显变成下一轮工作，必须把残余内容拆成新的切片或新的借鉴项，而不是继续把原项一直挂成 `stabilizing`。
3. `stabilizing` 只能是短暂停留状态
   默认要求是在后续 1 个当前施工切片内决定去向：
   - 关单，升级为 `adopted`
   - 或拆出残余工作，把当前项降噪后关单
4. 如果某项连续 1 个当前施工切片没有继续推进，又没有明确残余拆分
   默认视为状态维护失败，必须优先整理，而不是继续开新主线。

当前关闭标准采用 4 条硬条件：

- 当前 scope 的主实现已落地
- 对应验证已跑通，至少包括定向测试或构建验证
- 文档已经回填，且“残余问题”被明确写出来
- 残余问题如果存在，已经被拆到新的切片，而不是继续挂在原项里

## 3. 借鉴总原则

只借鉴以下类型的能力：

- 让系统更稳
- 让状态更可信
- 让自动化更可控
- 让部署、恢复、诊断更成熟

不借鉴以下方向作为主线：

- issue-first 的用户叙事
- 通用 agent company OS 的产品表面
- 过早的平台化复杂度

## 3.1 一眼看懂

### 已经借到手的

- `PC-OPS-01` / `PC-OPS-02`
  已经有 V1 Doctor 基线、四层状态区分、固定回归清单，以及 `Connect / Settings Doctor` 的共享诊断摘要表达。
- `PC-STATE-02`
  `Requirement / Room / Room Binding / Round / Mission / Conversation State / Work Item / Dispatch / Artifact / DecisionTicket` 的主链 mutation 都已切到 authority command，正常 UI 交互已不再依赖浏览器整份 `/runtime` 回灌。
- 页面收口配套
  这不是 `paperclip` 的原始对象能力，但属于同一类“减少双重真相”的借鉴结果：菜单分组、主线快切、共享摘要模块，开始让 UI 只保留少数权威入口。

### 刚完成 closeout 的

`PC-STATE-01` + `PC-STATE-03` + `PC-GOV-03`
  已在 V1 范围 adopt。`docs/v1-phase3-authority-object-boundaries.md` 对应的三刀都已落地：revision baseline、显式决策命令、read-path cleanup、lifecycle/workflow/operator audit 都已经形成闭环。最后一轮又继续把 `RequirementAggregate` 的 no-op reconcile / duplicate evidence / no-op transition 收进统一 material-change 规则，并把 `Board / Lobby / Requirement Center / CEO` 的高信号异常入口纳入 `operator_action_recorded`。
### 紧随其后的下一步

- `PC-GOV-01`
  已在当前最小 V2 范围 adopt：`layoff approval gate + department change approval gate + automation enable approval gate` 已经打通，approval 已不再只是一次性的确认框，而是 company-level durable governance object。
- `PC-GOV-02` / `PC-EXEC-01`
  是更合理的下一轮焦点：在最小 approval foundation 收口后，再继续补预算护栏和自动化 run ledger，而不是把所有高风险动作都继续堆在同一个 `PC-GOV-01` 里。

### 明确不借的

- 不把 `issue` 变成前台主线对象。
- 不把产品表面改成通用 agent company OS。
- 不因为 `paperclip` 做了多 adapter / 多用户治理，就提前把当前项目带进平台复杂度。

## 3.2 最新 upstream 核验

最新核验时间：2026-03-13  
最新核验 commit：`5201222ce7c73d50c4cf021ea6fdd24bd401dfe6`

这次重新核验的重点不是重新做一份对比，而是确认 `paperclip` 主干最新实现有没有改变我们的判断。结论是：没有改方向，反而更强化了当前这套借鉴节奏。

- `packages/db/src/schema/issues.ts`
  继续把执行锁、执行 run 关联、workspace settings 绑定在 durable issue 上，说明它的执行控制语义是围绕稳态对象展开的。
- `packages/db/src/schema/approvals.ts`
  approval 不是临时 UI 交互，而是带 `requestedBy* / decidedBy* / status / payload` 的持久化治理对象。
- `packages/db/src/schema/heartbeat_runs.ts`
  heartbeat run 不只是“定时器跑了一次”，而是带 `status / usageJson / resultJson / contextSnapshot / logRef` 的长期执行记录。
- `cli/src/commands/doctor.ts`
  doctor 不是单一 ping，而是分层检查、可修复检查、修复后复验的一整套入口。
- `cli/src/commands/db-backup.ts`
  备份不是隐藏实现，而是显式 CLI 能力，包含 backup dir、retention 和 connection source。

这进一步支持当前判断：

- `cyber-company` 应该继续借 `paperclip` 的稳态对象、doctor、backup、approval 这些底座能力。
- `cyber-company` 不应该把前台主线改成 issue/productivity 工具表面。

## 4. 借鉴清单总览

| ID | 类别 | Paperclip 能力 | 对 `cyber-company` 的建议 | 当前状态 | 目标版本 |
|---|---|---|---|---|---|
| `PC-STATE-01` | 状态模型 | durable entity + schema-backed writes | 把关键对象从 runtime projection 提升为更稳定实体 | `adopted` | V1 |
| `PC-STATE-02` | 状态模型 | command/transaction 风格更新 | 用 command/event 替代浏览器整份 runtime 回灌 | `adopted` | V1 |
| `PC-STATE-03` | 状态模型 | execution record 与 business record 分层 | 区分主线对象、执行对象、证据对象 | `adopted` | V1 |
| `PC-GOV-01` | 治理 | approval 对象 | 引入轻量 approval gate | `adopted` | V2 |
| `PC-GOV-02` | 治理 | budget / usage guardrail | requirement 或 agent 级预算提醒与软限制 | `planned` | V2 |
| `PC-GOV-03` | 治理 | audit trail | 关键动作保留可追溯轨迹 | `adopted` | V1 |
| `PC-EXEC-01` | 执行 | heartbeat run records | 自动化/班次执行日志稳定建模 | `planned` | V2 |
| `PC-EXEC-02` | 执行 | task checkout / execution locking | 对高风险执行对象增加锁与拥有权语义 | `candidate` | V2 |
| `PC-EXEC-03` | 执行 | persistent task session | 提升 requirement / dispatch 的恢复一致性 | `candidate` | V2 |
| `PC-WS-01` | 工作区 | execution workspace policy | 明确执行目录、交付目录、镜像目录边界 | `planned` | V2 |
| `PC-WS-02` | 工作区 | worktree / isolated workspace thinking | 为复杂项目执行预留更强隔离能力 | `candidate` | Later |
| `PC-OPS-01` | 运维 | doctor/self-check | 增加 authority 自检与修复入口 | `adopted` | V1 |
| `PC-OPS-02` | 运维 | startup health / startup banner | 强化 authority 启动信息与异常分型 | `adopted` | V1 |
| `PC-OPS-03` | 运维 | migrations / backup | 增加 authority 数据迁移与备份恢复路径 | `adopted` | V1 |
| `PC-OPS-04` | 运维 | local-first onboarding | 提升本地一键跑通和恢复体验 | `adopted` | V1 |
| `PC-ADAPTER-01` | 执行器抽象 | adapter boundary | 把 executor capability 从 OpenClaw 专属逻辑里抽出来 | `candidate` | V2 |
| `PC-ADAPTER-02` | 执行器抽象 | environment / capability checks | 执行器接入前做能力与环境检查 | `candidate` | V2 |
| `PC-AUTH-01` | 权限 | user/company membership & permission model | 只在确实需要多用户治理时引入，当前不抢优先级 | `observed` | Later |
| `PC-PROD-01` | 产品支撑 | costs / usage visibility | 把成本/执行代价做得更可信 | `candidate` | V2 |
| `PC-PROD-02` | 产品支撑 | activity / inbox semantics | 提升跨视图事件可追踪性 | `candidate` | V2 |

## 5. 详细借鉴项

### `PC-STATE-01` 关键对象稳定化

- Paperclip 参考：
  - `issues`
  - `approvals`
  - `heartbeat_runs`
- 借鉴点：
  - 关键对象应有稳定 schema、明确写入边界和长期语义
- 对应到本项目：
  - `RequirementAggregate`
  - `Dispatch`
  - `DecisionTicket`
  - `Artifact`
  - `RequirementRoom`
- 不直接照搬的地方：
  - 不把 `issue` 当作前台主线对象
- 当前采用情况：
  - 已在 V1 范围 adopt
  - 已补 `docs/v1-phase3-authority-object-boundaries.md`
  - 已把 `RequirementRoom / Dispatch / Artifact / DecisionTicket` 的 revision baseline 落到类型、持久化和 authority-backed command 路径
  - 已补上 `DecisionTicket` 的显式 `resolve / cancel` 命令
  - `loadRuntime()` 已不再在主读路径上自动写回
  - `support request / escalation` 也已补上 governance-side revision baseline，自治治理对象不再只靠 `updatedAt`
  - `RequirementAggregate` 的 no-op reconcile / duplicate evidence / no-op transition 已开始按 material-change 规则稳定处理，不再无条件刷新 `updatedAt / revision / changedFields`
  - 已把 `Board / Lobby / Requirement Center / CEO` 的高信号异常入口纳入统一 operator audit
- 预期收益：
  - 降低漂移、双重真相、读时自愈写回带来的不确定性

### `PC-STATE-02` 命令式写入替代快照回灌

- Paperclip 参考：
  - service 层显式 `create/update`
- 借鉴点：
  - 用“业务命令”替代“浏览器整份状态同步”
- 对应到本项目：
  - 浏览器逐步停止成为 runtime 主写者
  - authority 成为单写者
- 不直接照搬的地方：
  - 不需要复制完整的 service/API 面，只需要先把主线写入路径收紧
- 当前采用情况：
  - `requirement.transition`、`requirement.promote`、`room.append`、`room.delete`、`room-bindings.upsert`、`dispatch.create`、`dispatch.delete`、`artifact.upsert`、`artifact.sync-mirror`、`artifact.delete` 已切到 authority command 写入
  - `mission.upsert`、`mission.delete`、`conversation-state.upsert`、`conversation-state.delete`、`work-item.upsert`、`work-item.delete`、`round.upsert`、`round.delete` 也已切到 authority command 写入
  - room binding 的复合身份键已统一，authority 不再只按 `roomId + conversationId` 落库
  - `/runtime` compatibility path 已经没有 daily mutation slice，normal UI 下不再通过 `/runtime` push 运行态
  - authority-owned 现在覆盖：`rooms / missions / conversation-state / work-items / requirements / requirement-evidence / primary-requirement / rounds / dispatches / artifacts / room-bindings / support-requests / escalations / decision-tickets / agent-sessions / agent-runs / agent-runtime / agent-statuses`
  - front-end compatibility push 和 authority merge 都已经开始共享这套 owned-slice 边界，不再各自硬编码一份
  - `CompanyAuthoritySyncHost` 在 compatibility slice 归零后，已经停止正常 authority-backed UI 交互下的 `/runtime` push；`/runtime` 剩余角色只保留 restore/import/legacy manual recovery
- 预期收益：
  - 降低 race condition、整片覆盖和旧 snapshot 回灌

### `PC-STATE-03` 主线对象 / 执行对象 / 证据对象分层

- Paperclip 参考：
  - issue、approval、heartbeat_run、activity 分工清晰
- 借鉴点：
  - 不同语义对象不要混在同一层 runtime 快照里理解
- 对应到本项目：
  - 用户主线对象：`RequirementAggregate`
  - 执行对象：`Dispatch`、`WorkItem`
  - 证据对象：`RequirementEvidenceEvent`、`Artifact`、chat control signal
- 当前采用情况：
  - 已在 V1 范围 adopt
  - 已补 `docs/v1-phase3-authority-object-boundaries.md`
  - revision baseline 已经补到 `RequirementAggregate / RequirementRoom / Dispatch / Artifact / DecisionTicket / SupportRequest / Escalation`
  - 显式 decision command 已经落地
  - repair 已从主读路径拆出
  - `RequirementAggregate` 的 reconcile / evidence / transition 也已开始按统一 material-change 规则处理

### `PC-GOV-01` 轻量审批

- Paperclip 参考：
  - `approvals`
- 借鉴点：
  - 对危险动作和高成本动作增加明确确认点
- 对应到本项目：
  - 自动化启用
  - 组织变更
  - 高风险恢复动作
  - 重大 requirement transition
- 当前采用情况：
  - 已在当前最小 V2 范围 adopt
  - 最新 upstream 的 `approvals.ts` 进一步确认这类对象适合做成 durable governance entity，而不是一次性的前端确认框
  - 已新增 company-level `ApprovalRecord` durable object，并通过 authority command 写入/决策
  - 第一条 gate 已落在 `employee_fire`：当 `humanApprovalRequiredForLayoffs` 打开时，离职动作不再直接穿透，而是先生成 approval record
  - 第二条 gate 已扩到 `department_change`：当 `humanApprovalRequiredForDepartmentCreateRemove` 打开时，新增/归档部门不会直接写入，而是先生成 approval record
  - 第三条 gate 已扩到 `automation_enable`：当 `humanApprovalRequiredForAutomationEnable` 打开时，新建自动化或重新启用自动化不会直接执行，而是先生成 approval record
  - `Lobby` 已新增待审批面板，可直接批准/拒绝上述审批；批准后才继续执行离职流程、部门配置落盘或自动化创建/恢复启用
  - `Org Directory` 现在既会为离职发起 approval，也会为“新增/归档部门”发起 approval；`Automation` 页面也已接入同一套 approval gate
  - 更高风险但当前产品面还没有成熟入口的动作，例如 `runtime restore`，明确拆到下一轮切片，不继续挂在当前 closeout 范围里

### `PC-GOV-02` 预算与使用量护栏

- Paperclip 参考：
  - 预算与成本控制语义
- 借鉴点：
  - 自动化放权前先把 guardrail 做出来
- 对应到本项目：
  - requirement 级预算提醒
  - agent 级软限制
  - automation 使用量异常提示
- 当前采用情况：
  - 已进入 V2 计划

### `PC-GOV-03` 审计轨迹

- Paperclip 参考：
  - issue / approval / run log / activity 的可追踪性
- 借鉴点：
  - 系统需要回答“谁改了什么、为什么、什么时候”
- 对应到本项目：
  - requirement transition
  - dispatch 生命周期
  - 验收动作
  - decision resolve / cancel
  - 恢复动作
- 当前采用情况：
  - 已在 V1 范围 adopt
  - `DecisionTicket` 的 `decision.upsert / delete / resolve / cancel` 已开始写入 authority company event log
  - `dispatch.create / delete` 已开始写入 `dispatch_record_upserted / dispatch_record_deleted`
  - `room.append / delete` 已开始写入 `room_record_upserted / room_record_deleted`
  - `room-bindings.upsert` 已开始写入 `room_bindings_upserted`
  - `artifact.upsert / delete / sync-mirror` 已开始写入 `artifact_record_upserted / artifact_record_deleted / artifact_mirror_synced`
  - 显式 `repairRuntimeIfNeeded()` 已开始写入 `runtime_repaired`
  - 事件载荷已补 `ticketId / decisionType / status / resolution / resolutionOptionId / revision`，以及 dispatch / repair 的关键摘要字段
  - requirement workflow payload 已补 `source / changedFields / previous*`
  - 显式 operator recovery、chat focus action、takeover pack copy、group chat route、lobby 组织动作，以及 `Board / Lobby / Requirement Center / CEO` 的高信号异常入口都已进入统一的 `operator_action_recorded`
- 预期收益：
  - 关键决策动作不再只是 runtime 状态变化，而是有时间、对象和 revision 的可追溯记录

### `PC-EXEC-01` 自动化执行记录

- Paperclip 参考：
  - `heartbeat_runs`
- 借鉴点：
  - 自动化不只要有 cron，还要有稳定 run record
- 对应到本项目：
  - automation 执行日志
  - 成功/失败/中断原因
  - requirement 与 automation run 的关联
- 当前采用情况：
  - 已进入 V2 计划
  - 最新 upstream 的 `heartbeat_runs.ts` 已把 `status / usage / result / context snapshot / log ref` 做成一等记录，进一步确认这条借鉴方向正确

### `PC-EXEC-02` 执行锁与拥有权

- Paperclip 参考：
  - checkout / execution run linkage
- 借鉴点：
  - 高价值执行对象应有“谁在执行、何时锁定、何时释放”的语义
- 对应到本项目：
  - `Dispatch`
  - 关键 `WorkItem`
- 当前采用情况：
  - 候选项，尚未规划到实现阶段

### `PC-EXEC-03` 持续执行会话恢复

- Paperclip 参考：
  - persistent task sessions
- 借鉴点：
  - 恢复后不应只剩文本历史，而应该能恢复工作上下文
- 对应到本项目：
  - requirement / dispatch / room 的恢复一致性
- 当前采用情况：
  - 候选项

### `PC-WS-01` 工作区策略

- Paperclip 参考：
  - project execution workspace settings
  - default agent workspace model
- 借鉴点：
  - 执行空间、交付空间、镜像空间要有稳定边界
- 对应到本项目：
  - authority 文件镜像
  - workspace 交付区
  - executor 工作目录
- 当前采用情况：
  - 已进入 V2 计划

### `PC-WS-02` 隔离式工作区

- Paperclip 参考：
  - worktree-local instance thinking
- 借鉴点：
  - 对复杂任务或多实验场景，执行环境隔离很重要
- 对应到本项目：
  - 暂时只作为后续演进候选，不抢当前优先级
- 当前采用情况：
  - 候选项

### `PC-OPS-01` Authority Doctor

- Paperclip 参考：
  - `paperclipai doctor`
- 借鉴点：
  - 本地 authority 需要一套“哪里坏了”的统一检查器
- 对应到本项目：
  - authority 是否启动
  - SQLite 是否可用
  - OpenClaw executor 是否就绪
  - token / URL / provider 配置是否有效
- 当前采用情况：
  - 设置页已落一版 Doctor 基线，能先区分 Gateway / Authority / Executor / Runtime 四层状态
  - `Connect` 与 `Settings Doctor` 已开始共用 `ConnectionDiagnosisSummary`，减少“首次接入”和“稳态诊断”两套表达的漂移
  - 还没有完整的修复动作和独立 Doctor 命令

### `PC-OPS-02` 启动体检与健康信息

- Paperclip 参考：
  - startup banner
  - migration summary
  - health endpoint
- 借鉴点：
  - 把当前系统的灰状态显式化
- 对应到本项目：
  - connect / settings / ops 统一诊断模型
  - authority 启动信息面板
- 当前采用情况：
  - 设置页已展示统一诊断模型和固定回归清单
  - `Connect` 已接入共享诊断摘要组件，开始和 `Settings Doctor` 复用同一套诊断表达
  - ops 视图尚未完全接入同一套模型

### `PC-OPS-03` 迁移与备份恢复

- Paperclip 参考：
  - migration / db backup 流程
- 借鉴点：
  - authority 数据层需要更标准的演进与恢复路径
- 对应到本项目：
  - schema migration
  - snapshot backup
  - restore path
- 当前采用情况：
  - 已在 V1 范围 adopt
  - 已新增 `authority:backup` CLI，开始具备显式本地备份入口
  - 已新增 `authority:restore` CLI，开始具备显式本地恢复入口，并自动留下 `pre-restore` safety backup
  - 已新增 `authority:migrate -- --plan`，可以先输出 migration plan，再决定是否执行 metadata backfill
  - 已新增 `authority:rehearse --latest`，可以先把备份恢复到隔离 rehearsal home，并用 doctor 验证备份本身是否可用
  - backup 已开始支持最小 retention，doctor 也已开始看见 backup inventory
  - 真实环境里已跑通 `backup -> backups -> doctor -> preflight -> migrate --plan -> restore --plan -> rehearse`
  - 最新 upstream 的 `db-backup.ts` 说明 backup / retention / connection source 适合做成显式入口，而不是只留给底层实现细节

### `PC-OPS-04` 本地一键跑通

- Paperclip 参考：
  - onboard / run
- 借鉴点：
  - 减少“本地跑起来但实际不可用”的假启动
- 对应到本项目：
  - dev 启动前检查 authority / gateway / executor 依赖
- 当前采用情况：
  - 已在 V1 范围 adopt
  - 已新增 `authority:doctor` CLI，开始具备显式本地体检入口
  - 已新增 `authority:preflight` CLI，并接进 `npm run dev` 与 `npm run authority:start`
  - `authority:doctor` / `authority:preflight` 的关键信息已回推到 `Settings Doctor` 与 `Connect`
  - 真实环境已经完成一轮 `doctor / preflight / backup / backups / migrate --plan` smoke
  - 最新 upstream 的 `doctor.ts` 和 `DEVELOPING.md` 进一步确认：run 前检查、自检、修复提示应该是一条完整链路，不该拆散在多处页面里

### `PC-ADAPTER-01` 执行器能力边界

- Paperclip 参考：
  - adapter packages
- 借鉴点：
  - 执行器差异应该被边界吸收，而不是散落在产品逻辑里
- 对应到本项目：
  - executor capability model
  - authority bridge contract
- 当前采用情况：
  - 候选项，V2 更合适

### `PC-ADAPTER-02` 执行器环境检查

- Paperclip 参考：
  - adapter environment test
- 借鉴点：
  - 接入前先知道“能不能跑、缺什么、哪些能力不可用”
- 对应到本项目：
  - OpenClaw executor readiness
  - provider model availability
  - file mirror/path capability
- 当前采用情况：
  - 候选项

### `PC-AUTH-01` 多用户权限模型

- Paperclip 参考：
  - membership / permission / user role model
- 借鉴点：
  - 多用户治理最终会需要，但当前不是最高优先级
- 对应到本项目：
  - 仅在项目从 solo operator 转向 multi-user control plane 时再推进
- 当前采用情况：
  - 观察项

### `PC-PROD-01` 可信成本视图

- Paperclip 参考：
  - costs / usage reporting
- 借鉴点：
  - 成本与结果要对得上，才有放权基础
- 对应到本项目：
  - dashboard 成本可信度
  - requirement 级别成本归因
- 当前采用情况：
  - 候选项

### `PC-PROD-02` 跨视图活动语义

- Paperclip 参考：
  - activity / inbox semantics
- 借鉴点：
  - 系统应该统一表达“发生了什么、现在该看哪里”
- 对应到本项目：
  - CEO 首页、Requirement Center、Ops、Board 之间的事件链路
- 当前采用情况：
  - 候选项

## 6. 当前方案已采用和已纳入计划的部分

这里不再用模糊口径描述“有没有借鉴”，而是直接沿用本表状态体系。

状态以：

- 第 4 节“借鉴清单总览”
- `docs/v1-stability-roadmap.md`

为准。

| 借鉴项 ID | 当前状态 | 当前采用程度 | 落在哪份文档 |
|---|---|---|---|
| `PC-OPS-01` | `adopted` | authority 结构化修复建议已贯通 CLI、`/health`、Connect、Settings Doctor 和共享 helper，operator 对同一类问题已经能看到统一的标题、原因、下一步动作和推荐命令 | `docs/v1-stability-roadmap.md` |
| `PC-OPS-02` | `adopted` | startup diagnosis 已从 Connect / Settings 延伸到产品内全局 authority 风险 banner，authority 风险不再只藏在设置页或首次接入流程里 | `docs/v1-stability-roadmap.md` |
| `PC-STATE-02` | `adopted` | 主线切换、房间写删、round 写删、mission / conversation-state / work-item 写删、派单写删、产物写删/镜像同步都已切到 authority command；compatibility-owned runtime slice 已归零，Doctor 可直接显示 authority-owned 边界，正常 authority-backed UI 交互也不再通过 `/runtime` push 状态 | `docs/v1-stability-roadmap.md` |
| `PC-STATE-01` | `adopted` | V1 Phase 3 已完成 Slice A-1、Slice A-2、Slice A-3：revision baseline 已覆盖 `RequirementAggregate / RequirementRoom / Dispatch / Artifact / DecisionTicket / SupportRequest / Escalation`，`DecisionTicket` 已有显式 `resolve / cancel` 命令，`support request / escalation` 具备 governance-side revision 语义，`RequirementAggregate` 的 no-op reconcile / duplicate evidence / no-op transition 也已收进统一 material-change 规则 | `docs/v1-phase3-authority-object-boundaries.md` |
| `PC-STATE-03` | `adopted` | V1 Phase 3 已完成 Slice A-1、Slice A-2、Slice A-3：执行对象与决策对象按 authority-owned 方式收实，主读路径 repair 已拆出，workflow payload 与 material-change 规则也已经对齐 | `docs/v1-phase3-authority-object-boundaries.md` |
| `PC-GOV-03` | `adopted` | 已为 decision / dispatch / room / binding / artifact / runtime repair / company-ops lifecycle 补 company event audit，并让 `requirement_*` workflow payload 与高信号 operator action 一起进入统一治理日志；现在 `Board / Lobby / Requirement Center / CEO` 的关键异常入口也已纳入 `operator_action_recorded` | `docs/v1-phase3-authority-object-boundaries.md` |
| `PC-OPS-03` | `adopted` | 已新增 `authority:backup`、`authority:backups`、`authority:migrate`、`authority:rehearse` 和 `authority:restore` CLI，并补齐 `authority:migrate -- --plan`；真实环境里已跑通 `backup -> backups -> doctor -> preflight -> migrate --plan -> restore --plan -> rehearse` 主链，migration / restore decision loop 已在 V1 范围闭环 | `docs/v1-stability-roadmap.md` |
| `PC-OPS-04` | `adopted` | 本地接入/自检/启动前检查链路已经在真实环境完成 smoke：`authority:doctor` 为 `ready`、`authority:preflight` 为 `ready`、`authority:backup`/`authority:backups` 已闭合，Settings / Connect 也已回推 `schema version / integrity / backup` 结论 | `docs/v1-stability-roadmap.md` |
| `PC-GOV-01` | `adopted` | company-level `ApprovalRecord` 已落地，当前已打通 `employee_fire`、`department_change` 与 `automation_enable` 三条 approval gate，`Lobby` 可批准后继续执行原动作或恢复自动化启用 | `docs/cyber-company-evolution-direction.md` |
| `PC-GOV-02` | `planned` | 已纳入 V2 预算护栏 | `docs/cyber-company-evolution-direction.md` |
| `PC-WS-01` | `planned` | 已纳入 V2 workspace policy | `docs/cyber-company-evolution-direction.md` |
| `PC-EXEC-01` | `planned` | 已纳入 V2 自动化执行记录 | `docs/cyber-company-evolution-direction.md` |
| `PC-ADAPTER-01` | `candidate` | 已明确提出 capability boundary，但暂不进入 V1 实现 | `docs/cyber-company-evolution-direction.md` |

## 7. 当前明确不借鉴为主线的部分

以下 Paperclip 特征不作为当前主线借鉴目标：

| 对标项 | 原因 |
|---|---|
| issue-first 产品叙事 | 会冲掉 Requirement Center 主线 |
| 通用 agent company OS 产品表面 | 会稀释当前最有辨识度的需求控制平面定位 |
| 过早多 runtime 平台化 | 当前真正问题是主线稳定性，不是 adapter 数量 |
| 过重多用户治理优先级 | 当前主要用户仍偏 solo operator |

## 8. 版本节奏建议

### V1: Requirement Control Plane Hardening

应重点推进这些借鉴项：

- `PC-STATE-01`
- `PC-STATE-02`
- `PC-STATE-03`
- `PC-OPS-01`
- `PC-OPS-02`
- `PC-OPS-03`
- `PC-OPS-04`

预期效果：

- 主线更稳
- 状态更可信
- authority 更容易诊断和恢复

### V2: Managed Autonomy Layer

应重点推进这些借鉴项：

- `PC-GOV-01`
- `PC-GOV-02`
- `PC-GOV-03`
- `PC-EXEC-01`
- `PC-EXEC-02`
- `PC-EXEC-03`
- `PC-WS-01`
- `PC-ADAPTER-01`
- `PC-ADAPTER-02`
- `PC-PROD-01`
- `PC-PROD-02`

预期效果：

- 自动化更可控
- 失败更容易解释
- 放权更安全

## 9. 每次架构升级后怎么更新

每次升级建议至少更新这 4 处：

1. 更新本表的状态字段
2. 在对应版本文档中引用本次涉及的借鉴项 ID
3. 记录“引入了什么稳定性提升”
4. 记录“代价是什么，是否出现副作用”

推荐追加一行简短变更记录：

| 日期 | 版本/PR | 借鉴项 ID | 变更摘要 | 预期效果 | 实际效果 |
|---|---|---|---|---|---|
| 2026-03-12 | 文档基线 | `PC-STATE-01`, `PC-OPS-01` | 建立借鉴追踪机制并纳入 V1/V2 规划 | 让后续架构升级更可追踪 | 待实现 |
| 2026-03-13 | V1 起步 | `PC-OPS-01`, `PC-OPS-02`, `PC-STATE-02` | 设置页落 Doctor 基线；Requirement / room / dispatch 切到 authority command | 先看清哪层异常，并减少主线写入对 `/runtime` 的依赖 | 已落第一批基础能力，后续继续扩主线 |
| 2026-03-13 | V1 收口切片 | `PC-OPS-01`, `PC-OPS-02`, `PC-STATE-02` | Connect / Settings 共用诊断摘要；primary requirement、room delete、dispatch delete、artifact 写入切到 authority command | 让页面语义更一致，并继续减少 authority-backed 模式下的本地写入 | 已收住主要 UI 重复表达，并补齐主链 destructive/action 写边界 |
| 2026-03-13 | Paperclip refresh | `PC-STATE-01`, `PC-STATE-03`, `PC-OPS-03`, `PC-OPS-04`, `PC-GOV-01`, `PC-EXEC-01` | 按最新 `paperclip` master 重新核验 durable object / doctor / backup / heartbeat run / approval，并把状态改成更贴近当前节奏的 planned / in_progress | 让“已经借到哪一步、下一步该借什么”更直观，不再停留在旧快照判断 | 判断未变，但优先级表达更清楚 |
| 2026-03-13 | Phase 3 kickoff | `PC-STATE-01`, `PC-STATE-03` | 新增 authority 对象边界设计稿，明确 `RequirementAggregate / RequirementRoom / Dispatch / Artifact / DecisionTicket` 的字段分层、revision 与 command 边界 | 让 Phase 3 从“知道该做什么”推进到“知道先怎么做” | 已启动 Phase 3，等待类型和持久化实现切片 |
| 2026-03-13 | Phase 3 Slice A-1 | `PC-STATE-01`, `PC-STATE-03` | 补齐 `RequirementRoom / Dispatch / Artifact / DecisionTicket` revision baseline，并让 `DecisionTicket` 开始走 authority command | 让关键对象不再只有设计稿，而是开始具备更稳定的 revision 与单写者路径 | `Slice A-1` 已完成，下一步进入显式决策命令语义 |
| 2026-03-13 | Phase 3 Slice A-2 kickoff | `PC-STATE-01`, `PC-STATE-03` | 为 `DecisionTicket` 新增显式 `decision.resolve / decision.cancel` 命令，并把 Requirement Center / Chat 的决策动作切到新命令 | 让“补票”和“做决定”在 authority 中分成两种清晰语义 | `Slice A-2` 已启动，剩余是 read-repair / audit 规则 |
| 2026-03-13 | Phase 3 read-path cleanup | `PC-STATE-01`, `PC-STATE-03` | 把 `loadRuntime()` 从“读时写回”改成纯读，新增显式 `repairRuntimeIfNeeded()` 并在 authority 启动时执行一次 | 让主读路径更可预测，减少隐式状态漂移 | 主读路径已收口，剩余是 audit 规则 |
| 2026-03-13 | Phase 3 decision audit | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为 `decision.resolve / decision.cancel` 补 company event audit，记录 `ticketId / decisionType / status / resolution / resolutionOptionId / revision` | 让关键决策动作从“只改 runtime”升级为“可追溯事件” | 第一批审计事件已落地，后续继续向 requirement / dispatch / repair 扩面 |
| 2026-03-13 | Phase 3 dispatch/repair audit | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为 `dispatch.create / delete` 补 `dispatch_record_upserted / dispatch_record_deleted`，并让显式 `runtime repair` 写入 `runtime_repaired` | 让 authority 的执行记录变化和自修动作也进入统一事件流 | 第一批 audit 已扩到 decision / dispatch / repair，下一步继续统一剩余 operator-level 审计规则 |
| 2026-03-13 | Phase 3 room/artifact audit | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为 `room.append / delete`、`room-bindings.upsert`、`artifact.upsert / delete / sync-mirror` 补 company event audit | 让第一性协作对象的状态变化基本都能在 authority event log 里追溯 | 第一批 audit 已扩到 decision / dispatch / room / binding / artifact / repair，下一步继续统一 requirement workflow 与 operator action 审计 |
| 2026-03-13 | Phase 3 decision lifecycle audit | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为 `decision.upsert / delete` 补 `decision_record_upserted / decision_record_deleted`，把决策对象从 create/update 到 resolve/cancel 都纳入统一事件流 | 让 DecisionTicket 不再只有“结果”可追溯，而是完整生命周期可追溯 | 第一批决策生命周期审计已落地，下一步继续统一 requirement workflow 与 operator action 审计 |
| 2026-03-13 | Phase 3 ops lifecycle audit | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为 `companyOpsEngine` 生成或收走的 `support request / escalation / decision` 补 `ops_cycle_applied`、对应 `*_record_upserted` 和 `*_record_deleted` 事件 | 让自治引擎造成的治理对象变化也能完整追溯到 event log，而不是只看最终 runtime | 第一批自治治理对象 lifecycle audit 已落地，下一步继续统一 requirement workflow 与 operator action 审计 |
| 2026-03-13 | Phase 3 requirement workflow payload audit | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为 `requirement_*` workflow event payload 补 `source / changedFields / previousAggregateId / previousOwner* / previousRoomId / previousRevision` 等上下文，并统一 authority 与本地写入路径 | 让主线推进不只“有事件”，还能解释是谁因为什么字段变化推进了主线 | 主线 workflow 事件已更可解释，下一步继续统一 operator action 审计 |
| 2026-03-13 | Phase 3 operator recovery audit | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为 `chat / board / requirement center / lobby` 的显式 communication recovery 补 `operator_action_recorded`，记录 `surface / outcome / summary / error` | 让人工触发的恢复动作也进入统一治理轨迹，而不是只留在本地 toast/progress | 第一批 operator action 审计已落地，下一步继续扩到其它显式人工干预 |
| 2026-03-13 | Phase 3 focus action audit | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为 chat 的显式 `focus action` 派发补 `operator_action_recorded`，记录 `focusActionId / label / targetActorId / dispatchId / trackingId` | 让人工从 chat 发起的催办、重派、继续推进不只表现为后续 dispatch 变化，而是保留操作意图 | 第一批 chat focus action 审计已落地，下一步继续扩到更多显式人工干预 |
| 2026-03-13 | Phase 3 lobby operator action audit | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为运营大厅的显式 `blueprint copy / knowledge sync / group chat / quick task / hire / role update / fire` 补 `operator_action_recorded`，记录 `targetActorId / taskPreview / role / budget / knowledgeCount / memberCount` 等操作上下文 | 让人工从运营大厅做组织与协同动作时，也能留下操作意图与失败记录，而不是只看后续对象变化 | 第一批 lobby operator action 审计已落地，下一步继续扩到更多显式人工干预 |
| 2026-03-13 | Phase 3 takeover-pack audit | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为 chat 的显式 `复制接管包` 补 `operator_action_recorded`，记录 `noteLength` 等接管上下文 | 让人工真正接手执行链路时，能在治理日志里看到“接管包已被领取”，而不是只看到系统进入人工接管态 | 第一批 manual takeover operator action 审计已落地，下一步继续扩到更多显式人工干预 |
| 2026-03-13 | Phase 4 doctor/backup CLI | `PC-OPS-03`, `PC-OPS-04` | 新增 `authority:doctor` 和 `authority:backup`，让 authority 首次具备显式本地体检与手工备份入口 | 让 authority 不再只是“能跑”，而是开始具备“坏了能看、先备份再处理”的 operator tooling | Phase 4 已启动，下一步继续补 restore / startup preflight |
| 2026-03-13 | Phase 4 restore/preflight CLI | `PC-OPS-03`, `PC-OPS-04` | 新增 `authority:restore` 和 `authority:preflight`，让 authority 具备显式恢复与启动前检查入口，并把 preflight 接进 `npm run dev` / `npm run authority:start` | 让 Phase 4 从“能看、能备份”继续推进到“能恢复、启动前先检查” | Phase 4 的最小闭环已形成，下一步继续补 retention / restore UX / settings 回推 |
| 2026-03-13 | Phase 4 backup retention baseline | `PC-OPS-03`, `PC-OPS-04` | 为 `authority:backup` 增加最小 retention，并让 `authority:doctor` 直接显示 backup inventory | 让 authority operator tooling 不只会生成备份，还开始具备最小的备份治理能力 | retention 基线已落地，下一步继续补 restore UX / settings 回推 |
| 2026-03-13 | Phase 4 UI visibility | `PC-OPS-03`, `PC-OPS-04` | 把 authority `/health` 扩成带 doctor / preflight / backup inventory 的运维快照，并回推到 Settings Doctor 与 Connect 探测卡片 | 让 operator tooling 不只在终端可用，也能在产品里直接看见当前 authority 控制面的运维状态 | Phase 4 已进入“终端可用 + UI 可见”，下一步继续补 restore UX / startup checks |
| 2026-03-13 | Phase 4 restore UX baseline | `PC-OPS-03`, `PC-OPS-04` | 新增 `authority:backups` 备份清单入口，并让 `authority:restore` 支持 `--latest` | 让 operator 不再需要手工翻找备份路径，恢复路径更接近真实可用 | Phase 4 已从“能恢复”推进到“恢复更顺手”，下一步继续补 startup checks |
| 2026-03-13 | Phase 4 degraded preflight | `PC-OPS-04` | 让 `authority:preflight` 区分 `ready / degraded / blocked`，把“数据库存在但没备份 / 备份过旧”标成真实风险，并把 warning 回推到 Settings / Connect | 让启动前检查不再只是“能不能启动”，而是开始回答“现在适不适合继续跑” | Phase 4 的 startup checks 已更贴近真实运维风险，下一步继续补 restore 保护 |
| 2026-03-13 | Phase 4 restore guardrail | `PC-OPS-03`, `PC-OPS-04` | 为 `authority:restore` 增加 `--plan / --force / --allow-safety-backup`，默认阻止直接恢复 safety backup 或用旧备份覆盖更新数据库 | 让恢复路径从“能用”推进到“默认更安全、更可解释” | Phase 4 已开始具备真正的 restore 保护，下一步继续补 migration / restore 闭环 |
| 2026-03-13 | Phase 4 schema baseline | `PC-OPS-03`, `PC-OPS-04` | 让 authority server 开始写入 `schemaVersion` metadata，并让 doctor / preflight / restore plan 都开始显示 schema version，同时阻止恢复来自更高 schema 版本的备份 | 让 Phase 4 从“文件级 backup/restore”推进到“开始具备 migration 基线” | Phase 4 已不只是在看文件和时间，也开始显式判断库结构代际，下一步继续补更正式的 migration / restore 闭环 |
| 2026-03-13 | Phase 4 schema UI visibility | `PC-OPS-03`, `PC-OPS-04` | 把 authority health 里的 schema version 继续回推到 Settings Doctor 与 Connect 探测卡片，让页面也能直接显示当前 authority 库结构代际 | 让 schema 基线不再只停在 CLI/operator 视角，而是进入日常产品诊断视角 | Phase 4 现在已经做到“CLI 可见 + health 可见 + UI 可见”，下一步继续补更正式的 migration / restore 闭环 |
| 2026-03-13 | Phase 4 metadata migrate baseline | `PC-OPS-03`, `PC-OPS-04` | 新增 `authority:migrate` CLI，并让 doctor / preflight 对缺失 `schemaVersion` metadata 的老库给出显式迁移提示 | 让 migration 不再只是“未来要做”，而是已经有第一版显式 operator 入口 | Phase 4 已从“schema 基线存在”推进到“schema 基线可回填”，下一步继续补更正式的 migration / restore 闭环 |
| 2026-03-13 | Phase 4 integrity guardrail | `PC-OPS-03`, `PC-OPS-04` | 让 doctor / preflight 显式执行 SQLite `integrity_check`，并把坏库 / 不可读库标成 `blocked`，同时把 integrity 状态回推到 Settings / Connect | 让 operator tooling 从“知道库是哪一代、有没有备份”继续推进到“知道这份库本身是不是健康可用” | Phase 4 已开始具备 DB 健康守卫，下一步继续补更正式的 migration / restore 闭环 |
| 2026-03-13 | Phase 4 real-environment smoke | `PC-OPS-03`, `PC-OPS-04` | 在真实 authority 数据目录里完成 `backup -> backups -> doctor -> preflight -> restore --latest --plan` 验证；当前环境已到 `doctor=ready / preflight=ready`，restore plan 也会默认阻止对更新库的回滚 | 让 Phase 4 不再只是“测试里可用”，而是已经在真实 operator 环境里闭过一轮主链 smoke | `PC-OPS-04` 已达到关单条件，当前唯一 active 收缩为 `PC-OPS-03` |
| 2026-03-13 | Phase 4 restore rehearsal | `PC-OPS-03` | 新增 `authority:rehearse`，把备份恢复到隔离 rehearsal home，并同时给出 rehearsal doctor 结果和 live restore plan 状态 | 让 restore 不再只分“计划”和“真正覆盖”，中间多一层“先演练恢复”的 operator 决策支点 | 现在已经能区分“备份本身是好的”与“live restore 当前会被 guardrail 阻断”，剩余收口进一步压缩到 restore decision loop |
| 2026-03-13 | Phase 4 migrate plan closeout | `PC-OPS-03` | 为 `authority:migrate` 补上 `--plan`，让 migration 也具备“先看计划、再决定是否执行”的 operator 决策环节，并在真实环境完成 `authority:migrate -- --plan` smoke | 让 Phase 4 的 operator tooling 从 `backup/restore` 扩展到完整的 `plan / apply / rehearse / restore` 闭环 | `PC-OPS-03` 已达到 V1 关单条件，当前唯一 active 切回 `PC-OPS-01` |
| 2026-03-13 | Phase 1 startup diagnosis closeout | `PC-OPS-01`, `PC-OPS-02` | authority 结构化修复建议已贯通 CLI、`/health`、Connect、Settings Doctor 和产品内全局 authority 风险 banner，并补齐 shared helper / CLI guidance / banner model 的定向测试 | 让 self-check 与 startup health 不再分散在不同入口里用不同语义表达；进入产品后也能直接看到当前 authority 风险和推荐动作 | `PC-OPS-01` 与 `PC-OPS-02` 已达到 V1 关单标准，当前唯一 active 切回 `PC-STATE-02` |
| 2026-03-13 | Phase 2 compatibility-slice guardrail | `PC-STATE-02` | 新增 compatibility snapshot builder，并让 `CompanyAuthoritySyncHost` 在 authority-backed 模式下只通过 `/runtime` 推送 compatibility slices；authority merge 也开始强制保留房间、派单、产物、房间绑定、支持请求、升级项和决策票这些 authority-owned slices，并在 merge 后重新 reconcile requirement control | 让 `/runtime` 兼容路径不再能直接整片覆盖 authority 对象，把这条老路径从“半主写”继续压回“受控兼容通道” | `PC-STATE-02` 继续保持 active，下一步继续梳理剩余 local mutation 的归属边界 |
| 2026-03-13 | Phase 2 requirement-boundary guardrail | `PC-STATE-02` | 继续把 `requirement aggregates / requirement evidence / primary requirement` 纳入 authority-owned 保护，front-end compatibility push 与 authority merge 开始共享同一份 runtime slice ownership 定义，Settings Doctor 也开始显式展示 compatibility vs authority-owned slice 边界 | 让主线字段不再因为 `/runtime` 兼容同步留下灰色地带，后续继续 command 化时也不会再靠记忆维护 owned-slice 列表 | `PC-STATE-02` 继续保持 active，下一步继续梳理剩余 `mission / work-item / round / agent-runtime` 的归属边界 |
| 2026-03-13 | Phase 2 local-side-effect guardrail | `PC-STATE-02` | authority-backed 模式下，`conversation-state / mission / work-item` 的本地兼容写入不再顺手重算 `aggregate / evidence / primary / room`，相关回归测试已覆盖 conversation-state 和 mission/work-item 写入不会改坏 authority-owned 主线字段 | 让 compatibility slice 继续存在时也尽量只改自己的 slice，不再制造“本地先漂一下，再被 authority 拉回去”的 UI 抖动 | `PC-STATE-02` 继续保持 active，下一步继续梳理 `round / agent-runtime` 的归属边界 |
| 2026-03-13 | Phase 2 agent-projection guardrail | `PC-STATE-02` | 把 authority 端本来就会重算的 `agent-runtime / agent-statuses` 从 compatibility-owned 挪到 authority-owned，front-end compatibility push、authority merge 和 Doctor 边界展示同步跟上，剩余兼容范围缩到 `round / agent-sessions / agent-runs` | 让由 authority 投影计算出来的 agent runtime 真相不再被旧 `/runtime` 兼容路径回灌覆盖，也让后续只剩真正还没 command 化的 session/run 原始记录需要继续梳理 | `PC-STATE-02` 继续保持 active，下一步继续梳理 `round / agent-sessions / agent-runs` 的归属边界 |
| 2026-03-13 | Phase 2 round-and-session guardrail | `PC-STATE-02` | 把 `round.upsert / round.delete` 切到 authority command，并把 `rounds / agent-sessions / agent-runs` 一起从 compatibility-owned 收进 authority-owned；front-end compatibility push、authority merge 和 Doctor 边界展示同步跟上 | 让 `/runtime` 兼容路径不再覆盖 round 归档，也不再回灌 authority 已维护的 session/run 投影，剩余兼容范围压缩到 `mission / conversation-state / work-item` | `PC-STATE-02` 继续保持 active，下一步继续梳理 `mission / conversation-state / work-item` 的长期归属 |
| 2026-03-13 | Phase 2 command-path closeout | `PC-STATE-02` | 把 `mission.upsert/delete`、`conversation-state.upsert/delete`、`work-item.upsert/delete` 都切到 authority command，并让 `activeMissionRecords / activeConversationStates / activeWorkItems` 从 compatibility-owned 收进 authority-owned；`CompanyAuthoritySyncHost` 在 compatibility slice 归零后停止正常 authority-backed UI 交互下的 `/runtime` push | 让 `/runtime` 正式退出正常 UI 写入链路，只保留 restore/import/legacy manual recovery 角色，command-path closeout 在 V1 范围达到关单标准 | `PC-STATE-02` 已升级为 `adopted`，下一轮建议启动 `PC-STATE-01 / PC-STATE-03 / PC-GOV-03` |
| 2026-03-13 | Phase 3 governance-side revision baseline | `PC-STATE-01`, `PC-STATE-03`, `PC-GOV-03` | 为 `support request / escalation` 补 revision baseline，并让 `companyOpsEngine` 生成或刷新这两类治理对象时按 material change 递增 revision；对应的 `support_request_record_*` / `escalation_record_*` audit payload 也开始稳定带上 revision | 让自治治理对象不再只有 `DecisionTicket` 具备 revision 语义，company event audit 也能明确看见 support/escalation 是第几次实质变化 | `Phase 3 / Slice A-3` 已启动，当前唯一 active 已切到 `PC-STATE-01` |
| 2026-03-13 | Phase 3 aggregate material-change cleanup | `PC-STATE-01`, `PC-STATE-03`, `PC-GOV-03` | 为 `RequirementAggregate` 新增统一 material-diff 语义，让 reconcile 在无实质变化时保持 `updatedAt` 稳定，duplicate evidence / no-op transition 不再无条件 bump `revision`，`requirement_*` workflow payload 的 `changedFields` 也开始按真实 diff 生成 | 让主线对象和治理侧对象开始共享同一套“material change 才算对象变化”的稳态规则，减少虚假主线抖动和难解释的 audit 噪音 | `Phase 3 / Slice A-3` 继续推进，下一步主要剩余 operator-level audit closeout |
| 2026-03-13 | Phase 3 operator-route closeout | `PC-GOV-03`, `PC-STATE-01`, `PC-STATE-03` | 为 `Board / Lobby` 的“查看接管包”、`Requirement Center` 的“去排障 / 打开 Ops”、`CEO 首页` 的“查看运营异常”补 `operator_action_recorded`，把高信号异常入口也纳入统一治理日志 | 让 Phase 3 不再只记录“对象改了什么”，也记录“人从哪里开始介入当前异常链路”，从而满足 V1 范围的治理 closeout | `PC-STATE-01 / PC-STATE-03 / PC-GOV-03` 已在 V1 范围达到关单标准 |
| 2026-03-13 | Phase 5 layoff approval gate | `PC-GOV-01` | 新增 company-level `ApprovalRecord` durable object、authority `approval.request / approval.resolve` 命令，以及 `Lobby` 待审批面板；当 `humanApprovalRequiredForLayoffs` 打开时，离职动作先生成 approval，批准后才继续下发离职流程 | 让 approval 第一次成为产品级治理对象，而不是一次性的前端确认框；同时把最危险的组织动作先纳入一个明确、可追踪、可反悔的 gate | `PC-GOV-01` 已进入当前唯一 active 切片，下一步继续扩到更多高风险动作 |
| 2026-03-13 | Phase 5 department change approval gate | `PC-GOV-01` | 把同一套 approval gate 扩到 `department_change`：当 `humanApprovalRequiredForDepartmentCreateRemove` 打开时，新增/归档部门不会直接写入，而是先形成 approval record，并在 `Lobby` 批准后继续执行部门配置落盘 | 让 approval 不再只有单条 layoff 样板，而是开始覆盖第二类高风险组织动作；同时复用同一套 durable object、authority command 和产品审批面板，验证这条治理对象线具备扩展性 | `PC-GOV-01` 继续保持当前唯一 active，下一步再扩到 restore / automation enable 等更高风险动作 |
| 2026-03-13 | Phase 5 automation enable approval gate | `PC-GOV-01` | 把同一套 approval gate 扩到 `automation_enable`：当 `humanApprovalRequiredForAutomationEnable` 打开时，新建自动化和重新启用自动化不会直接执行，而是先生成 approval record，并在 `Lobby` 批准后继续执行 cron 创建或恢复启用 | 让 approval 从“组织动作安全阀”扩到“自动化放权安全阀”，证明 durable approval object 能跨组织与自动化两个产品面复用 | `PC-GOV-01` 已达到当前最小 V2 关单范围，后续更高风险动作拆到新切片而不是继续把原项挂着 |

## 10. 判断标准

如果后续一个升级项满足下面至少两个条件，就值得优先推进：

- 明显减少双重真相
- 明显减少恢复成本
- 明显降低自动化失控风险
- 明显提升状态可解释性
- 不会冲掉 Requirement Center 主线

如果一个升级项虽然“很平台”，但会削弱以上目标，就不应该因为它像 `paperclip` 而优先做。
