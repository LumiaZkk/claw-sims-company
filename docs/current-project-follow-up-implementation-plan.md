# Current Project Follow-up Implementation Plan

Status: Complete  
Last updated: 2026-03-14

## 1. 文档目的

这份文档把 2026-03-13 基于当前工作树完成的静态 review，整理成后续可执行、可追踪、可验收的实施计划。

它服务于三个目标：

1. 把“现在还有哪些结构性问题”收口成明确工作流，而不是停留在口头判断。
2. 给后续开发提供统一的推进顺序，避免一边继续叠功能、一边让核心边界继续变重。
3. 提供一个可持续更新的进度底稿，方便每轮迭代直接记录“已完成 / 下一个 / 风险 / 待决策”。

## 1.1 文档角色分工

为避免后续继续出现“多份文档都在讲计划，但没人知道该看哪份”的问题，当前文档按下面方式分工：

- `docs/current-project-follow-up-implementation-plan.md`
  - 唯一执行底稿
  - 唯一工作流状态面板
  - 唯一里程碑与周更入口
- `docs/current-product-user-experience-review.md`
  - 产品与用户视角发现说明
  - 解释“为什么这些工作流值得优先做”
- `docs/product-next-steps.md`
  - 面向用户感知价值的优先级说明
  - 用来辅助排序，不单独管理状态
- `task_plan.md / progress.md / findings.md`
  - 会话级 working log
  - 记录每次推进、决策、风险和验证结果

后续如果需要汇报进度，默认先更新这份实施文档，再回写其他 supporting docs。

## 2. 评审基线

本计划基于以下材料整理：

- 当前工作树源码状态（2026-03-13）
- 补充分析文档：`/Users/zkk/.gemini/antigravity/brain/b968ae3e-b789-441d-b7cf-8b6e3ff4dc57/cyber-company-product-analysis.md.resolved`
- 产品/用户视角补充审查：`docs/current-product-user-experience-review.md`
- 已有路线和平台文档：
  - `docs/v1-stability-roadmap.md`
  - `docs/cyber-company-evolution-direction.md`
  - `docs/cto-platform-execution-plan.md`
  - `docs/cto-platform-delivery-standard.md`

本计划默认以下判断已经成立：

- authority 单写者方向已经基本站稳，`Requirement / Work Item / Dispatch / Artifact / Decision` 等核心主链已明显 command 化。
- compatibility-owned runtime slice 已归零，但快照同步壳、fallback projection 和 legacy runtime store 还未完全退出主认知路径。
- 产品当前最主要的问题不再是“功能不够多”，而是“结构还没完全收口”。
- 同时，产品表面仍然暴露了过多内部运行/治理结构，尚未完全兑现文档里定义的单条用户路径。
- `CEO heartbeat` 不应另起第二套自治真相源，而应在现有 `CompanyOpsEngine` 之上产品化，并由 Cyber Company 自身系统作为 heartbeat 配置与状态的权威来源。

## 3. 当前判断摘要

### 已明显改善的部分

- authority 正常主链写入已不再依赖日常 `/runtime` 回灌。
- 稳定连接后的断连体验已经从全屏遮罩，收口到 toast 提示。
- workspace policy、execution locking、session recovery、executor capability/readiness、成本可信度、跨页面 activity 语义等近期切片已经落地。

### 仍然需要优先解决的部分

- `Requirement Center` 仍然是高耦合页面，不符合“需求中心只负责主线摘要与决策”的目标。
- 验收闭环仍然偏状态流转，尚未升级成“基于交付物和校验结果的内容级闭环”。
- 人工接管仍然主要依赖“打开会话 + 复制接管包 + 手动继续”。
- 现有后台 ops cycle 已经存在，但还没有产品化成用户可感知的 CEO 自主巡检能力。
- authority 兼容壳和 legacy store 仍在，导致“正常主链”和“恢复/兼容旁路”没有完全切开。
- `packages/authority-daemon/src/server.ts` 和多个前台页面仍然过大，回归面持续偏高。
- 高风险前台页面缺少对应测试护栏。
- 资源显式声明主路径、兼容分支清理、operator backup/restore 页面入口等平台尾项还没有完全关单。

## 4. 实施原则

后续推进默认遵守以下原则：

1. 不优先新开顶层功能页，先收口核心结构边界。
2. 正常业务路径继续朝 authority-only projection 推进；restore/import/manual recovery 单独作为 operator control plane 管理。
3. `Requirement Center` 只承载主线摘要、验收决策和必要跳转，不重新变成 `Board / Workspace / Ops` 的合集。
4. “验收通过”必须绑定可见交付证据、来源链路和校验结果，不能只靠按钮改状态。
5. “人工接管”必须有显式对象、状态、审计和回灌，而不是只生成文本包。
6. 每条工作流都必须带上测试、文档和验收方式，不接受“只改代码不补护栏”。
7. 业务 heartbeat 以 Cyber Company 自身系统为单一权威；如需沿用 OpenClaw heartbeat，只允许由系统单向下发配置并回收结果，不允许形成第二套平行调度与状态源。

## 5. 总体推进顺序

建议按下面顺序推进，不建议并行拉太多主线：

### Phase A: 主线边界收口

目标：先把最直接影响产品理解和回归面的部分收掉。

- `WS-01` Requirement Center 边界拆分
- `WS-02` 验收闭环升级成内容级 closeout
- `WS-09` CEO 巡检产品化
- `WS-06` 前台高风险流测试补齐第一轮骨架

### 当前执行建议（2026-03-14）

`M1` 的核心切片已经落地，当前建议转入 `M2` 的第一阶段，优先把接管闭环和 authority 兼容壳继续收口，再决定是否进入 daemon 模块化。

建议本周按下面顺序推进：

1. `WS-03`：继续补人工接管的“手工结果回填 / 重新派发给 agent”
2. `WS-04`：把 runtime inspector / fallback 语义和 compat-only control plane 继续切开
3. `WS-06`：跟上 `WS-03 / WS-04` 的浏览器验收和自动化护栏
4. `WS-05`：等 `WS-04` 再收一刀后再开始 daemon 模块化

暂缓事项：

- `WS-07 / WS-08`：保留在 `M3`，不要提前稀释资源

### Phase B: 运行态与接管闭环

目标：把“异常怎么接住、如何恢复、如何回灌”做成正式产品语义。

- `WS-03` 人工接管产品化
- `WS-04` authority 兼容壳清理
- `WS-05` authority daemon 模块化

### Phase C: 平台尾项与文档关单

目标：把仍写在文档里的尾项真正落到产品、代码和运维入口。

- `WS-07` 平台尾项关单
- `WS-08` 术语与信息架构统一

## 6. 主跟踪面板

| ID | 工作流 | 优先级 | 当前状态 | 主要产出 | 依赖 |
| --- | --- | --- | --- | --- | --- |
| WS-01 | Requirement Center 边界拆分 | P0 | complete | 新的 application/view-model 边界与页面拆分 | 无 |
| WS-02 | 验收闭环内容化 | P0 | complete | closeout report、验收门禁、交付证据面板 | WS-01 |
| WS-03 | 人工接管产品化 | P0 | complete | takeover case、接管分派/回灌闭环 | WS-01 |
| WS-04 | authority 兼容壳清理 | P1 | complete | recovery-only compat path、legacy store 收缩 | WS-03 |
| WS-05 | authority daemon 模块化 | P1 | complete | route/handler/service 拆分、测试护栏 | 无 |
| WS-06 | 前台高风险流测试补齐 | P0 | complete | unit/integration/smoke 覆盖 | WS-01、WS-02、WS-03 |
| WS-07 | 平台尾项关单 | P1 | complete | 资源显式主路径、backup/restore 入口、兼容分支清理 | WS-04、WS-05 |
| WS-08 | 术语与信息架构统一 | P2 | complete | glossary -> README/UI/PRD 对齐 | WS-01、WS-07 |
| WS-09 | CEO 巡检产品化 | P0 | complete | heartbeat run surface、自动续推、暂停与护栏 | 无 |

## 7. 详细工作流

## WS-01 Requirement Center 边界拆分

### 背景

当前 `src/pages/requirement-center/Page.tsx` 仍然直接依赖 board runtime、communication sync、task backfill 等跨域 hook，同时承担主线摘要、验收、决策票、Workspace 摘要、Ops 跳转等多类职责。

这说明“需求中心是主线摘要页”的方向在产品上成立了，但代码边界还没有真正落地。

### 当前证据

- `src/pages/requirement-center/Page.tsx` 当前 1336 行。
- 页面直接引入 `useBoardCommunicationSync`、`useBoardRuntimeState`、`useBoardTaskBackfill`。
- 同一页面里同时存在主线摘要、验收操作、决策票处理、Workspace 摘要和 Ops 跳转逻辑。

### 目标

把 Requirement Center 收口成“主线摘要 + 验收决策 + 必要跳转”的组合页，而不是继续作为跨页面语义聚合器。

### 实施任务

- [x] 新建 `RequirementCenterSurface` 或等价 application-layer 组合器，统一输出页面所需只读视图模型。
- [x] 将 `useBoardRuntimeState`、`useBoardCommunicationSync`、`useBoardTaskBackfill` 的直接依赖移出页面组件，沉到 application 层组合器或独立 adapter。
- [x] 抽出独立子模块：
  - [x] `RequirementSummaryCard`
  - [x] `RequirementAcceptancePanel`
  - [x] `RequirementDecisionPanel`
  - [x] `RequirementDeliverySummaryCard`
  - [x] `RequirementOpsSummaryCard`
- [x] 明确“页面内保留什么 / 只跳转不展开什么”：
  - [x] Workspace 只显示交付摘要，不在需求中心内重建正文阅读器
  - [x] Ops 只显示异常摘要，不在需求中心内重建恢复面板
  - [x] Board 只通过共享摘要表达执行状态，不再反向把 board runtime 语义整包灌入页面
- [x] 将 `Page.tsx` 压缩到单文件可维护体量，建议目标 `< 600` 行。

### 产出物

- 新的 Requirement Center view-model 组合器
- 拆分后的页面子组件
- 对应测试骨架和页面职责说明

### 验收标准

- `Requirement Center` 页面本体不再直接引用 board 子域 hook。
- 页面职责可以清楚说明为“主线摘要、验收、决策、跳转”四类。
- 页面体量明显下降，复杂逻辑移动到应用层或子组件。
- `docs/requirement-center-information-architecture.md` 更新为最终职责边界版本。

### 主要风险

- 当前页面承接了很多“临时方便”的共享语义，拆分时容易把已有小修小补打散。
- 如果先拆 UI、不先定义 view-model 边界，最终只会从一个巨组件变成多个薄壳组件。

## WS-02 验收闭环内容化

### 背景

当前 Requirement Center 的验收按钮主要修改 `status / acceptanceStatus / acceptanceNote / nextAction`，而 Workspace 虽然已经有“规则与校验”“知识与验收”“能力验证与发布”等支撑能力，但还没有成为主验收门禁。

### 当前证据

- `src/pages/requirement-center/Page.tsx` 中 `runAcceptanceAction()` 主要处理状态流转。
- `src/application/company/workspace-apps.ts` 已存在 `规则与校验`、`知识与验收` 等 app 入口。
- `src/pages/workspace/components/WorkspacePageContent.tsx` 已展示“自动验收后的知识正文”和“自动验收结果”。
- `src/application/workspace/platform-closeout.ts` 已存在 closeout 检查，但未作为 Requirement Center 主验收门禁。

### 目标

让“申请验收”和“验收通过”真正绑定交付物、来源链路、校验结果和 closeout 结果，避免 Requirement Center 继续停留在流程型状态机。

### 实施任务

- [x] 定义显式 `RequirementCloseoutReport` 或等价对象，至少包含：
  - [x] 当前 requirement id / revision
  - [x] 交付物摘要
  - [x] 来源文件或来源会话链路
  - [x] consistency 校验结果
  - [x] knowledge/acceptance 摘要
  - [x] platform closeout 检查结果
  - [x] 未通过项与阻塞原因
- [x] 将 Workspace 的现有校验能力统一收成共享 closeout projection，不让 Requirement Center 自己拼字段。
- [x] 为 “request acceptance” 增加门禁判断：
  - [x] 没有交付证据时不能进入正式待验收
  - [x] 有阻塞校验项时必须明确展示原因
  - [x] 可允许部分警告项，但要有显式理由和审计记录
- [x] 为 “accept” 增加通过前校验：
  - [x] 必须存在 closeout report
  - [x] 必须能看到关键交付物来源
  - [x] 必须有已通过或明确豁免的校验结果
- [x] 为“继续修改 / 驳回重开”记录结构化反馈，不只写 `acceptanceNote`
- [x] Requirement Center 新增 closeout 卡片，展示：
  - [x] 当前交付摘要
  - [x] 校验通过/阻塞项
  - [x] 来源链路
  - [x] 最近一次 closeout report 时间
  - [x] 规则校验结果
  - [x] 知识与验收摘要

### 产出物

- closeout report 模型与投影逻辑
- Requirement Center 验收门禁面板
- Workspace -> Requirement Center 的共享 closeout surface
- 验收流测试

### 验收标准

- “申请验收”不再只是改状态，必须生成或引用一份明确 closeout report。
- “验收通过”可以在 UI 中说明“为什么可以通过”。
- Workspace 校验结果成为 Requirement Center 主验收闭环的一部分，而不是旁路能力。
- `docs/requirement-center-acceptance-checklists.md` 与实现保持一致。

### 主要风险

- 如果 closeout report 只做成新的展示对象，而不参与门禁，最终又会沦为“好看的附加信息”。
- 如果把所有 warning 都设计成 hard block，会导致体验变差，需要先区分 blocking vs advisory。

## WS-03 人工接管产品化

### 背景

当前产品已经能识别需要人工接管的链路，也能生成 takeover pack，但主要操作仍是“打开对应会话”“复制接管包”“人工手动继续”，闭环没有被正式建模。

### 当前证据

- `src/pages/lobby/Page.tsx` 与 `src/pages/board/Page.tsx` 的人工接管主动作仍是跳转到对应会话。
- `src/pages/chat/hooks/useChatCoordinationActions.ts` 的主动作仍是复制 takeover pack。
- `src/application/governance/focus-summary.ts` 明确提示用户可以复制接管包并手动继续。
- `src/application/delegation/closed-loop.ts` 当前更多负责 reconciliation，而不是正式 takeover workflow。

### 目标

把人工接管从“文本包 + 人工执行习惯”升级成正式的产品工作流和状态对象。

### 实施任务

- [x] 定义显式 `TakeoverCase` 或等价领域对象，至少包含：
  - [x] 来源 session / requirement / dispatch
  - [x] 当前 owner
  - [x] 失败摘要
  - [x] 推荐下一步
  - [x] 当前状态：`detected / acknowledged / assigned / in_progress / resolved / archived`
  - [x] 审计字段与时间戳
- [x] 定义 authority command / event：
  - [x] 创建接管 case
  - [x] 确认接管
  - [x] 指派接管人
  - [x] 标记已恢复自动执行或已人工完成
  - [x] 关闭接管 case
- [x] 把“重新派单”“打开会话”“复制接管包”收口为正式 action 集合，而不是散落在 Board / Lobby / Chat 各自生成按钮。
- [x] 在 `Lobby / Board / Chat / Ops` 复用同一套 takeover summary 组件和状态表达。
- [x] recovery 和 takeover 分开：
  - [x] communication recovery 继续负责从历史和事件里补回闭环状态
  - [x] takeover case 负责“现在谁接手、怎么继续、是否结案”
- [x] 为接管完成后的回灌设计固定动作：
  - [x] 手工完成结果回填
  - [x] 重新派发给 agent
  - [x] 标记链路恢复

### 产出物

- takeover case 模型、authority command 与审计事件
- 共享 takeover summary / detail panel
- 结构化接管动作流
- 对应测试与演示路径

### 验收标准

- “人工接管”不再只有文本包，而是可见、可指派、可关闭的对象。
- Board / Lobby / Chat / Ops 使用同一套接管状态表达。
- 接管完成后能显式回灌到 requirement / dispatch / session 状态，而不是留在会话文本里。
- 接管流程具备可搜索的审计事件。

### 主要风险

- 如果不先定义 takeover case 和 command，继续从 UI 开始补按钮，会把现有分散动作再做大一轮。

## WS-04 authority 兼容壳清理

### 背景

compatibility-owned runtime slice 已归零，但 `CompanyAuthoritySyncHost` 仍保留 snapshot push/pull 结构，runtime inspector 也仍存在 fallback projection，legacy runtime store 仍是前台通用入口。

### 当前证据

- `src/infrastructure/authority/runtime-slice-ownership.ts` 中 compatibility slice 已为空。
- `src/system/company-authority-sync-host.tsx` 仍保留整份 runtime snapshot 的 push/pull 逻辑。
- `src/infrastructure/authority/runtime-sync-store.ts` 仍保留 `compatibility_snapshot` / `command_preferred` 模式。
- `src/infrastructure/company/runtime/store.ts` 仍明确标注为 legacy runtime store。

### 目标

把“正常 authority 主链”和“restore/import/manual recovery 旁路”彻底切开，让兼容逻辑只存在于 operator control plane。

### 实施任务

- [x] 将 `CompanyAuthoritySyncHost` 拆成更清晰的职责层：
  - [x] authority hydration
  - [x] recovery/import bridge
  - [x] sync diagnostics
- [x] `bootstrap.updated` 改走 silent bootstrap refresh，不再回退到 `loadConfig()` 级别的整页恢复。
- [x] compatibility path 关闭时不再挂载 runtime snapshot push 订阅。
- [x] 正常 authority-backed UI 路径不再触发整份 runtime snapshot push。
- [x] runtime inspector 中对 fallback 的语义从“正常 projection 补位”改成“恢复/兼容来源”，避免误读为主路径。
- [x] 逐步减少页面直接依赖 legacy runtime store：
  - [x] 先从 Requirement Center
  - [x] Chat 子组件通过 page surface 透传 `activeArtifacts / activeDispatches`
  - [x] Chat 的 closed-loop / room reply / assignment action 不再在子层直接读取 `activeArtifacts / activeDispatches / activeRoomRecords`
  - [x] 再到 Workspace / Board / Lobby
- [x] 把 restore/import/manual recovery 的触发与说明明确归到 Settings / Connect / operator tooling。
  - [x] Connect / Settings Doctor 显式展示 operator control plane 与标准命令入口
  - [x] 一键 `plan / apply / rehearse` 触发已产品化

### 产出物

- 拆分后的 authority sync host
- recovery-only compat path 说明与实现
- 缩小后的 legacy runtime store 读写面

### 验收标准

- 正常主链页面推进 requirement 时，不再依赖 snapshot push/pull。
- runtime inspector 能清楚区分 authority 数据、恢复数据、兼容补位数据。
- restore/import/manual recovery 有明确入口和文案，不再和正常业务路径混在一起。

### 主要风险

- 如果页面仍然统一从 legacy store 抓数据，即使主写入已 command 化，认知上仍会像“双头真相”。

## WS-09 CEO 巡检产品化

### 背景

当前 authority 侧已经存在 `CompanyOpsEngine`，并且会按固定周期自动运行 `runCompanyOpsCycle()`。  
它已经能做支持请求创建、阻塞升级、组织自动校准和 `lastEngineRunAt / lastEngineActions` 更新。

但从产品视角看，这仍然主要是后台治理引擎，而不是用户可感知的“CEO 会自己巡检、自己继续推进”。

### 当前证据

- `packages/authority-daemon/src/company-ops-engine.ts` 中 `CompanyOpsEngine` 默认每 60 秒跑一轮循环。
- 当前 cycle 会自动创建支持请求、触发升级、处理组织策略建议，并写入 `ops_cycle_applied` 事件。
- `company.orgSettings.autonomyState` 已持久化 `lastEngineRunAt` 和 `lastEngineActions`。
- 但当前前台还没有把这套能力解释成“CEO 上次巡检 / 本轮动作 / 下一次巡检 / 可暂停”的产品表达。

### 目标

把现有后台 ops cycle 升级成一个对用户可见、可理解、可控的 `CEO heartbeat` 产品能力。

### 架构约束

`CEO heartbeat` 的业务真相源必须保留在 Cyber Company 自身系统里，而不是挪到 OpenClaw heartbeat 配置中。

换句话说：

- heartbeat 的开关、频率、预算护栏、暂停状态、最近一次运行结果，由 Cyber Company 保存和解释
- 如果沿用 OpenClaw heartbeat，只把它当作执行/唤醒通道，由系统单向同步配置
- OpenClaw 不应成为第二套 heartbeat 权威源，也不应直接承接业务 heartbeat 的最终状态

### 实施任务

- [x] 为现有 ops cycle 增加显式 heartbeat 视图模型，至少包含：
  - [x] 上次巡检时间
  - [x] 最近动作摘要
  - [x] 下次计划巡检时间
  - [x] 本轮是否成功 / 失败 / 超时
- [x] 定义 heartbeat policy 的权威归属，至少包含：
  - [x] Cyber Company 持久化的 heartbeat 开关、频率、预算护栏、暂停状态
  - [x] OpenClaw heartbeat 的同步映射关系
  - [x] `managed by Cyber Company` 的漂移约束与回写策略
- [x] 在 CEO 首页或需求中心补一个轻量 heartbeat 卡片，说明：
  - [x] CEO 最近一次巡检做了什么
  - [x] 系统当前会不会继续自动推进
  - [x] 用户是否需要介入
- [x] 在设置中增加 heartbeat 开关和频率策略入口，至少支持：
  - [x] 暂停自动巡检
  - [x] 查看当前预算/护栏约束
- [x] 第二阶段接入更强的自主推进行为：
  - [x] 已 answered dispatch 的自动续推
  - [x] 阶段性汇报
  - [x] 超时巡检结果摘要
- [x] 将 heartbeat 审计接入事件线或 run ledger，而不只留在临时状态里。
- [x] 明确底层 heartbeat 与业务 heartbeat 的分层边界：
  - [x] 底层 heartbeat 负责 agent 唤醒与健康信号
  - [x] 业务 heartbeat 负责 CEO 巡检语义、产品表达与审计

### 产出物

- CEO heartbeat surface
- heartbeat 状态卡片或日志面板
- 设置页 heartbeat 控制
- 审计或 run ledger 记录
- heartbeat policy 与 OpenClaw 同步约束说明

### 验收标准

- 用户可以直接看到“CEO 最近一次巡检时间和结果”。
- 用户离开系统一段时间后回来，能感知系统是否在继续自动推进。
- heartbeat 有暂停入口、预算约束和可追溯记录。
- 不另起一套平行自治引擎，尽量复用现有 `CompanyOpsEngine`。
- heartbeat 开关或频率调整以 Cyber Company 配置为准，不允许出现 OpenClaw 与产品设置双向漂移。

### 主要风险

- 如果直接做“自动继续推进”，但没有先给用户可见状态与暂停控制，信任感会反而下降。
- 如果另起第二套 heartbeat 机制，会和现有 `CompanyOpsEngine` 职责重叠。
- 如果 heartbeat 配置真相源落在 OpenClaw 一侧，后续很容易重新引入“双头配置”和运行时漂移。

## WS-05 authority daemon 模块化

### 背景

`packages/authority-daemon/src/server.ts` 仍然接近 5000 行，是当前最明显的后端维护热点之一。

### 当前证据

- `packages/authority-daemon/src/server.ts` 当前 4675 行，仍低于初始审计时的 5497 行。
- control routes、company state routes、runtime command routes、company management routes 已开始拆出；`executor-status.ts` 现在也已接住 capability/config snapshot 之外的 health/bootstrap/readiness 组装，`company-management-commands.ts` 与 `chat-send-command.ts` 已开始承接具体业务命令。
- 新增 `authority-route-result.ts` 与 `authority-http-route-dispatch.ts`，统一了 route result/post-commit 与 response/dispatch helper；但共享 error mapping，以及更多 service 级命令处理仍留在入口文件或其直接闭包依赖里。

### 目标

把 authority daemon 从“大路由入口文件”拆成稳定的模块边界，降低回归风险和后续 feature slice 的修改冲突。

### 实施任务

- [x] 先按职责切目录，而不是按 HTTP path 机械拆文件：
  - [x] bootstrap / health
  - [x] runtime commands
  - [x] operator tooling
  - [x] backup / restore / doctor
  - [x] executor capability / readiness
- [x] 提取共享 schema、response builder、error mapping 和 audit helper。
  - [x] route result / post-commit helper
  - [x] response builder / route attempts dispatch helper
- [x] shared error mapping / typed HTTP error helper
- [x] 将“业务命令处理”和“transport 层路由接线”分离。
- [x] 将测试从“大而全 server 测试”补成模块级测试。
- [x] 逐步引入 route registry 或同等机制，降低 server 入口噪声。
  - [x] 顺序 route attempts dispatcher
  - [x] HTTP route registry wrapper

### 产出物

- 拆分后的 authority daemon 模块目录
- 模块级测试和共享 helper
- 更新后的开发约束说明

### 验收标准

- `server.ts` 明显缩小，成为装配层而不是实现层。
- 新增 operator/control features 时，不需要继续往同一个入口文件追加长段逻辑。
- 模块测试可以独立验证 capability/readiness/backup/runtime command 行为。

### 主要风险

- 如果直接“按路由一刀切”，但不抽 shared helper，最终会从一个巨文件变成多个复制粘贴文件。

## WS-06 前台高风险流测试补齐

### 背景

当前 presentation 层测试主要集中在 chat 子域，`Requirement Center / Workspace / Runtime / Board / Lobby` 这些高风险入口缺少对应护栏。

### 当前证据

- 当前能找到的 presentation tests 主要位于 `src/pages/chat/**`。
- `src/pages/requirement-center`、`src/pages/workspace`、`src/pages/runtime`、`src/pages/board`、`src/pages/lobby` 下未发现对应测试文件。

### 目标

为最容易回归的前台流建立最小可持续测试矩阵，优先覆盖主线推进、验收、接管、恢复和断连体验。

### 实施任务

- [x] 补齐以下单元或集成测试入口：
  - [x] Requirement Center 主线摘要与验收流
  - [x] Board / Lobby 的 takeover 与 recovery 摘要
  - [x] Workspace closeout / delivery summary
  - [x] Runtime 启动、恢复、断连/重连提示
- [x] 建立最小 smoke 场景：
  - [x] 正常推进一条 requirement
  - [x] 缺交付证据时无法正式发起验收
  - [x] takeover case 从 detected -> assigned -> resolved
  - [x] 稳定连接后断连只出现连接提示，不出现整页阻断
  - [x] 失效 authority endpoint 改到在线地址后，会退出旧 reconnect banner，且后续探测只命中新 endpoint
  - [x] restore/import 模式与正常 authority 模式可区分
  - [x] 定义每个工作流的“测试进入点”，避免所有测试都只能从整页挂载开始。
- [x] 在关键共享 surface 层补测试，而不只测 UI 文案。

### 产出物

- 新增测试文件与 smoke 场景
- 各工作流对应的 view-model 测试入口

### 验收标准

- 新工作流落地时，至少同步新增一个 surface 测试和一个页面或流程测试。
- `Requirement Center / Workspace / Board / Lobby / Runtime` 都有最少一层自动化护栏。

### 主要风险

- 如果仍旧先做页面大挂载测试、没有共享 surface 测试，测试会既重又脆。

## WS-07 平台尾项关单

### 背景

现有平台文档仍明确写着几项未完全关单的尾项：

- Resource 业务主路径还没有完全只依赖显式声明
- 仍有临时兼容的旧分支和兜底
- Settings / Connect 还没有直接在页面里触发 backup / restore

### 当前证据

- `docs/cto-platform-execution-plan.md` 仍明确写着“Resource 的业务主路径还没有完全只依赖显式声明”。
- 同一文档仍写着“清理仍然只是临时兼容的旧分支和兜底”。
- `docs/v1-stability-roadmap.md` 仍注明 Settings / Connect 还不能直接在页面里触发 backup / restore。

### 目标

把已经在文档里明确列出的“最后一公里”落到产品、实现和运维入口，而不是长期停留在 roadmap。

### 实施任务

- [x] 完成 resource 主路径显式声明化的最终排查：
  - [x] 业务判断不再依赖 inferred resource
  - [x] UI 中若保留 inferred，只能作为草案/提示
- [x] 清理当前仍然存在的兼容分支和兜底逻辑，逐项标注“保留原因 / 移除条件 / 计划日期”。
- [x] 在 Settings / Connect 增加 backup / restore 的正式入口与说明。
- [x] 完成最终验收矩阵，把文档尾项和产品行为一一对齐。

### 产出物

- 平台尾项 closeout checklist
- backup / restore 页面入口
- compat cleanup 清单

### 验收标准

- 平台文档里列出的未关单项有明确实现或明确移除计划。
- operator 不再只能通过 CLI 理解关键恢复动作。
- inferred resource 不再进入正式业务主判断。

### 主要风险

- 如果不先列清 compat inventory，清理工作很容易长期变成“感觉还剩一点”。

## WS-08 术语与信息架构统一

### 背景

仓库已经补了 glossary，并且 README、PRD、信息架构文档与主导航已基本对齐；这一工作流的尾项主要是把剩余高信号页面文案收口到同一套主线路径表达。

### 当前证据

- `README.md`、`docs/cyber-company-prd.md`、`docs/requirement-center-information-architecture.md` 已统一使用 `Ops / 当前主线` 作为主路径术语。
- `docs/requirement-center-glossary.md` 已明确要求高信号 UI 不再混用 `当前需求 / 主线需求 / 目标`，也不再混用 `Operations Hall / 运营大厅`。
- Board / Ops / Runtime / Lobby 仍残留少量“当前需求 / 当前目标”类文案，需要最后一轮可见页面收口。

### 目标

让“需求中心 / 主线 / Ops / Workspace / Board / CEO Home”各自承担什么职责，在文档和 UI 中保持稳定表达。

### 实施任务

- [ ] 以 `docs/requirement-center-glossary.md` 为基准，列出当前仍混用的关键术语：
  - [x] `Ops` vs `Operations Hall`
  - [x] `需求中心` vs `Requirement Center`
  - [x] `主线需求` vs `当前需求` vs `目标`
- [x] 统一 README、PRD、信息架构文档与页面标题。
- [x] 统一导航、空状态、摘要组件中的职责描述。
- [x] 在 onboarding 文档中加入“页面职责对照表”。

### 产出物

- 统一后的 glossary 和页面职责表
- README / PRD / onboarding 文档更新
- 页面内文案对齐

### 验收标准

- README、PRD、glossary、主导航四处对同一页面的命名一致。
- 新成员只看文档就能理解“去哪里看主线、去哪里看排障、去哪里看交付、去哪里看执行态”。

### 主要风险

- 如果只改文档不改页面文案，或者只改页面不回写 glossary，很快会再次漂移。

## 8. 建议里程碑

| 里程碑 | 建议范围 | 完成判定 |
| --- | --- | --- |
| M1 | `WS-01 + WS-02 + WS-09 + WS-06(首轮)` | Requirement Center 不再是巨型跨域页，验收有 closeout 门禁，用户能感知 CEO 自动巡检，关键前台流开始有自动化护栏 |
| M2 | `WS-03 + WS-04` | takeover 成为正式对象，兼容壳退到 recovery-only control plane |
| M3 | `WS-05 + WS-07 + WS-08` | authority daemon 入口模块化，平台尾项关单，术语与信息架构稳定 |

## 9. 每周更新方式

建议每轮跟进只更新这份文档，不再新开平行清单。

### 更新规则

1. 先更新第 6 节主跟踪面板中的状态。
2. 再更新“当前执行建议”是否有变化，避免同时激活太多工作流。
3. 再到对应工作流里勾选完成项。
4. 最后在下面的变更记录里追加一条“本轮完成 / 下轮计划 / 风险 / 待决策”。

### 状态定义

- `ready`：可以立即开始，本轮允许被拉起
- `planned`：已进入当前里程碑，但依赖项或切片顺序还没到
- `parked`：方向明确，但刻意延后，避免并行过多
- `backlog`：已确认要做，但不在当前里程碑窗口
- `complete`：本轮定义范围内已完成

### 周更模板

```md
## YYYY-MM-DD

- Overall: green / yellow / red
- Done:
  - ...
- Next:
  - ...
- Risks:
  - ...
- Decisions Needed:
  - ...
```

## 10. 变更记录

## 2026-03-13

- 基于当前工作树 review、新旧路线文档和补充分析报告，创建首版实施文档。
- 明确 8 条后续工作流和 3 个建议里程碑。
- 结论：下一阶段应优先做结构收口，而不是继续扩展新的主功能面。

## 2026-03-14

- `WS-04 / WS-06`：补齐 authority endpoint 草稿态到底层 backend adapter 的同步，修掉“UI 已切新地址，但后台仍持续请求旧 endpoint”的问题；浏览器在 `/connect` 从失效 `18896` 切到在线 `18898` 后，顶部 reconnect banner 已消失，页面内抓到的新 fetch 只剩 `18898/bootstrap` 与 `18898/health`。
- `WS-05`：新增 `authority-route-registry.ts`，将 control/company-state/runtime/company-management/chat 五组 route 组装收进统一 registry；`server.ts` 进一步降到 `4675` 行。
- `WS-06`：新增 `resolveRequirementRoomEntryTarget()` 作为共享 requirement room 进入点，`Requirement Center / Board / Chat` 已统一复用；浏览器也已在隔离 `18901` authority 上跑通 `connect -> select nl -> /requirement -> 进入需求房`，并确认主链落到 `room:workitem:topic:mission:10tzafe`。
- 整理现有产品/实施文档分工，明确本文件为唯一执行底稿。
- 将工作流状态从统一 `todo` 收口为 `ready / planned / parked / backlog`，方便后续按里程碑管理进度。
- 补充 `CEO heartbeat` 的单一权威原则：业务 heartbeat 由 Cyber Company 自身系统定义，OpenClaw heartbeat 只作为单向同步的执行层。
- 明确当前建议只激活 `M1`，并以 `WS-01 -> WS-09 -> WS-02 -> WS-06` 作为最近推进顺序。
- `WS-01` 已落第一刀：新增 `requirement-center-page-view-model` 与共享 board/runtime hooks，把 `Requirement Center` 对 board 子域 hook 的直接依赖移出页面组件。
- 首轮验证已完成：`npm test -- src/application/mission/requirement-center-page-view-model.test.ts`、`npm run build`，并通过浏览器 smoke 打开 `/requirement` 与 `/board`。
- `WS-01` 已完成第二刀：`Requirement Center` 继续拆出 `RequirementSummaryCard / RequirementEmptyStateCard / RequirementAcceptancePanel / RequirementDeliverySummaryCard / RequirementOpsSummaryCard` 等子组件，页面本体已压缩到 600 行以内。
- `WS-02` 已完成本轮关单：`RequirementCloseoutReport` 现在不仅展示交付物/验收依据，还会收口 `规则校验结果`、`知识与验收摘要`，并直接进入 `RequirementAcceptanceGate` 与主验收面板。
- `WS-09` 已继续收口：`CompanyOpsEngine` 会为每轮 heartbeat 追加 `heartbeat_cycle_checked` 审计事件；设置页现在直接展示最近巡检审计、触发方式和本轮动作，不再只看 `lastEngineActions`。
- `WS-06` 已补第一轮护栏：新增 `RequirementAcceptancePanel.test.tsx`、`RequirementHeartbeatCard.test.tsx`、`gateway-status-banner.test.tsx`、`requirement-acceptance-gate.test.ts`，并补充 closeout/report surface 测试。
- `WS-03` 已完成产品化主闭环：新增 `takeover.transition` command、`takeover_case_updated` 事件、共享 `TakeoverCasePanel`，并让 `Board / Lobby / Chat` 共用同一套接管状态与动作。
- `WS-03` 已补齐接管完成后的固定动作：现在支持“手工结果回填 / 重新派发给 agent / 标记链路恢复”，并把 `dispatchId` 和审计结果回写到 authority。
- `WS-04` 已完成第一刀：新增 `refreshAuthorityBootstrapSilently()`，`CompanyAuthoritySyncHost` 在 `bootstrap.updated` 时不再调用 `loadConfig()`，且在 compatibility slice 为空时不再挂 snapshot push 订阅。
- `WS-04` 已继续收口第二刀：`Runtime Inspector` 将 fallback 文案统一改成“恢复/兼容来源”，明确这只是观察和排障补位，而不是业务主写入路径。
- `WS-04` 已继续收口第三刀：Chat 子组件不再各自直接订阅 `activeArtifacts / activeDispatches`，统一改由 chat page surface 透传，减少正常页面链路上的 legacy store 扩散。
- `WS-04` 已继续收口第四刀：`useChatClosedLoop`、`useChatSessionRuntime`、`ChatAssignmentActions` 不再在子层直接读取 runtime store，统一改由 `ChatPageContent` 透传 `activeArtifacts / activeDispatches / activeRoomRecords`。
- `WS-04` 已继续收口第五刀：`Connect` 与 `Settings Doctor` 新增统一的 `恢复 / 导入 / 手工修复入口` 卡片，把 restore/manual recovery 的判断边界显式收回 operator control plane。
- `WS-04` 已继续收口第六刀：`CompanyAuthoritySyncHost` 现在拆成 authority hydration / recovery bridge / compatibility sync 两层，后续继续清 legacy store 时不必再在一个 hook 里同时改 push、pull 和恢复逻辑。
- `WS-04` 的 operator control plane 已从“命令说明卡”升级成可执行入口：`Connect / Settings Doctor` 现在都能直接跑 `doctor / backup / restore plan / restore apply / rehearse`。
- `WS-04` 已补齐 `sync diagnostics`：`Settings Doctor` 现在会显式展示 command / pull / push / compat 四项同步诊断，不再只在内部状态里区分 compat path。
- `WS-05` 已落第一刀：authority daemon 的 operator action 逻辑已从 `server.ts` 提取到独立的 `operator-actions.ts`，为后续继续拆 route / service 铺路。
- `WS-05` 已继续收口第二刀：`/health /bootstrap /operator/actions /executor /gateway/request` 这组控制面路由已提取到 `control-routes.ts`，`server.ts` 对这部分开始退回装配层；同时补了 `control-routes.test.ts`，让 daemon 模块测试不再只靠全量 server 入口。
- `WS-08` 已落第一刀：侧边导航、`/ops` 页面标题、CEO 入口、Runtime 跳转和 README 已统一使用 `Ops`，不再混用 `Operations Hall / 运营大厅`。
- `WS-09` 已继续收口第二刀：heartbeat 审计现在由共享 `HeartbeatAuditList` 同时进入 `Settings` 和 `Requirement Center`，主路径与设置页看到的是同一条 company event-derived run ledger，而不是两套展示。
- `WS-08` 已继续收口第二刀：`docs/requirement-center-glossary.md` 新增标准命名约束，`docs/engineering-onboarding.md` 也补上了页面职责对照表，后续改导航或空状态时有统一参照。
- `WS-05` 已继续收口第三刀：`/companies/:id/runtime`、`/companies/:id/events`、`/companies/:id/collaboration-scope/:agentId` 已提取到 `company-state-routes.ts`，`server.ts` 对这组 company state 查询/同步路径进一步退回装配层；同时补了 `company-state-routes.test.ts`。
- `WS-05` 已继续收口第四刀：`/actors`、`/sessions/*`、`/agents/*` 和大部分 `/commands/*` 已提取到 `runtime-command-routes.ts`，并补上 `runtime-command-routes.test.ts`；`server.ts` 已进一步缩到 5237 行。
- `WS-05` 已继续收口第五刀：`/config`、`/companies`、`/companies/:id/provisioning/retry`、`/companies/:id/employees*`、`/company/switch`、`DELETE /companies/:id` 已提取到 `company-management-routes.ts`，浏览器上的 `/select -> 进入公司` 主链继续可用；当前 `server.ts` 因新增命令函数仍有 5308 行，说明下一步要继续把业务 handler 从装配层抽成 service。
- `WS-05` 已继续收口第六刀：config/create/retry/hire/delete/switch 这组公司管理命令已进一步沉到 `company-management-commands.ts`，并补上模块测试；`server.ts` 已缩到 5093 行，开始更像装配层而不是命令实现层。
- `WS-05` 已继续收口第七刀：executor health/bootstrap/readiness 组装已收进 `executor-status.ts`，并补上模块测试；`server.ts` 已进一步降到 4988 行，executor capability/readiness 不再主要靠入口文件内联拼装。
- `WS-05` 已继续收口第八刀：route result 与 post-commit side-effect 已统一进 `authority-route-result.ts`，`company-state / runtime-command / company-management / control` 四套路由开始共用同一份结果契约；`server.ts` 已进一步降到 4975 行。
- `WS-05` 已继续收口第九刀：`authority-http-route-dispatch.ts` 已统一 response builder 与顺序 route attempts dispatch，`server.ts` 对 control/company-state/runtime-command/company-management 四套路由进一步退回装配层；最新已降到 4954 行。
- `WS-05` 已继续收口第十刀：`chat.send` 已沉到 `chat-send-command.ts`，`server.ts` 不再内联组装 chat dispatch / executor run / runtime accepted event；最新已进一步降到 4926 行。直连 smoke 已确认这条命令不再报 `Value of "this" must be of type Crypto`，当前剩余的是既有 `operator.write` scope 限制。
- `WS-05` 已继续收口第十一刀：`gateway-proxy.ts` 已接住 `sessions.list / session_status / sessions.resolve / sessions.reset / sessions.delete / agents.files.set` 的方法级代理逻辑，`server.ts` 已进一步降到 4809 行。直连 `POST /gateway/request` 的 `sessions.list` smoke 已确认代理链仍通，当前剩余错误已回到既有 `missing scope: operator.read`。
- `WS-05` 已继续收口第十二刀：`runtime-session-status-repair.ts` 已接住 session_status read-repair 的候选筛选、unsupported break 和广播逻辑，`server.ts` 已进一步降到 4715 行。浏览器 smoke 继续确认 `/runtime` 能稳定进入业务页且没有整页 restoring。
- `WS-05` 已继续收口第十三刀：`executor-config-command.ts` 已接住 `PATCH /executor` 的 config merge / bridge patch / broadcast / managed sync 逻辑，`server.ts` 已进一步降到 4699 行。最新隔离 authority `18897` 上的 `GET /executor -> PATCH /executor` direct smoke 已确认这条 control-plane 命令链可用。
- `WS-05` 已继续收口第十四刀：`chat-command-routes.ts` 已接住 `/commands/chat.send` 的 route 分派与 post-commit 广播，`server.ts` 不再单独维护这条 chat command 分支。最新隔离 authority `18898` 上的 `POST /commands/chat.send` direct smoke 已确认这条 route 主链可达，当前剩余错误已回到既有 `missing scope: operator.write`。
- `WS-05` 已完成最后一刀：新增 `authority-error.ts` 与 `sendAuthorityCaughtError()`，把 typed HTTP error / top-level error mapping 收成共享契约；`chat-send-command.ts`、`runtime-command-routes.ts`、`gateway-proxy.ts` 和 `server.ts` 现在不再把显式 bad request / not found / unsupported 全部打成 500。
- `WS-09` 已完成第二阶段产品化：`heartbeat_cycle_checked` 事件现在会记录事件续推原因，`HeartbeatAuditList` 会展示“需求房新增回报 / 派单已更新 / 接管状态已变化”等触发原因，并把事件续推、阶段性汇报和超时巡检动作一起落进同一条 run ledger。
- `WS-06` 的测试进入点已经正式归档在 `docs/high-risk-flow-test-entry-points.md`，后续 requirement / acceptance / takeover / closeout / reconnect / heartbeat 都有共享 surface 级进入点，不再默认从整页挂载起步。
- `WS-07` 已关单：`docs/platform-tail-closeout-checklist.md` 记录了 resource explicit 主路径证据、operator control plane 入口、compat inventory 和最终验收矩阵。
- `WS-08` 已继续收口第三刀：Board、Ops、Runtime、Lobby 的高信号文案统一切到 `当前主线 / 当前指令`，包括 `查看当前主线看板`、`只同步当前主线`、`当前主线成员` 等入口与摘要文案。
- `WS-06` 已补第二轮浏览器 smoke：在隔离 `18896` authority 上，`Requirement Center` 的 `需求变更` 动作已能从前台点击一路写回 authority，`revision / updatedAt` 均会增长，说明真实 requirement mutation 主链是通的。
- 最新浏览器回归：隔离 `18896` authority 的 `/settings` 仍能显示 `Authority 同步诊断`、`恢复 / 导入 / 手工修复入口`、`CEO heartbeat`；当前 `Authority / Executor` 状态仍会因 OpenClaw scope 缺口落到 `degraded / blocked`，但这是环境噪音，不是本轮 executor-status 抽离回归。
- 最新验证：
  - `npm test -- src/application/mission/requirement-acceptance-gate.test.ts src/pages/requirement-center/components/RequirementAcceptancePanel.test.tsx src/application/mission/requirement-closeout-report.test.ts src/application/mission/requirement-center-page-view-model.test.ts src/application/org/company-heartbeat.test.ts src/system/gateway-status-banner.test.tsx`
  - `npm test -- src/application/delegation/takeover-case.test.ts src/shared/presentation/TakeoverCasePanel.test.tsx src/application/delegation/use-takeover-case-workflow.test.ts`
  - `npm test -- src/infrastructure/authority/bootstrap-command.test.ts src/application/delegation/takeover-case.test.ts src/shared/presentation/TakeoverCasePanel.test.tsx src/application/delegation/use-takeover-case-workflow.test.ts`
  - `npm run build`
  - 浏览器验收：重连本机 authority 后，确认 `/requirement` 展示 closeout 门禁说明与证据面板，`/settings` 展示 heartbeat 策略卡和单一权威文案。
  - 浏览器验收：在 `18890` authority 上构造 smoke takeover case，并通过 `Board -> Ops -> Chat` 完成 `assigned -> in_progress -> resolved -> archived` 全链路验证；`Board` 归档后已不再显示接管项。
  - 浏览器验收：在 `/ops` 停留页内通过后台触发 `approval.request / approval.resolve`，确认 `待拍板` 能实时完成 `0 -> 1 -> 0` 变化，且 `正在恢复公司上下文...` 观察计数始终为 `0`。
  - 浏览器验收：打开 `/runtime`，确认运行态总览正常渲染，authority canonical badge 与来源说明仍可正常显示。
  - 浏览器 smoke：打开 `/chat/z1-8776e4-ceo?cid=8776e452-17bd-4034-b0f1-e423a3a21407`，确认聊天页、消息流和输入区正常渲染。
  - 浏览器 smoke：重启本机 `18890` authority 后重新打开 `/chat/z1-8776e4-ceo?cid=8776e452-17bd-4034-b0f1-e423a3a21407`，确认页面恢复后消息流、输入区和控制台都正常，控制台 error 为 `0`。
  - `npm test -- src/application/gateway/authority-health.test.ts src/shared/presentation/AuthorityOperatorControlPlaneCard.test.tsx`
  - `npm test -- src/application/delegation/takeover-case.test.ts src/application/delegation/use-takeover-case-workflow.test.ts src/shared/presentation/TakeoverCasePanel.test.tsx`
  - 浏览器验收：使用隔离的 `4173` 前端 + `18892` authority，先完成“回填人工结论并恢复”，再完成“重新派发给 COO”，并确认 Board 面板出现“最近人工结论 / 最近重新派发”以及 authority 中新增 `redispatched` 审计和 `dispatch:takeover:*` 记录。
  - 浏览器验收：在 `Connect` 页面确认新的 `恢复 / 导入 / 手工修复入口` 卡片可见，显示 `doctor / backup / restore --plan / rehearse` 标准命令。
  - 浏览器验收：切回已在线的 `18790` authority 后打开 `/settings`，确认 `Settings Doctor` 里同样出现 operator control plane 卡片，浏览器控制台 error 为 `0`。
  - `npm test -- src/pages/workspace/components/WorkspaceCloseoutStatusCard.test.tsx src/application/gateway/authority-health.test.ts src/shared/presentation/AuthorityOperatorControlPlaneCard.test.tsx src/application/runtime-inspector/index.test.ts`
  - 浏览器验收：`/workspace` 正常加载，新的 Workspace closeout surface 未引入白屏；当前 console error 主要来自隔离 authority 缺 OpenClaw token 的已知环境限制。
  - 浏览器验收：在稳定连接的 `/settings` 停留页主动停掉 `18894` authority，只出现顶部连接告警和页内“连接中断，正在重连”，没有重新进入整页 restoring overlay；恢复 authority 后手动点“重连”，页面可回到 `Gateway 已连接 / Runtime · ready`。
  - 浏览器验收：`/settings` 保持可区分“正常 command_preferred 主路径”与“restore / import / manual recovery 只应在 Doctor 入口触发”的产品边界，并继续展示 heartbeat 单一权威源文案。
  - `npm test -- src/application/org/company-heartbeat-history.test.ts src/application/org/company-heartbeat.test.ts src/pages/requirement-center/components/RequirementHeartbeatCard.test.tsx packages/authority-daemon/src/company-ops-engine.test.ts packages/authority-daemon/src/operator-actions.test.ts`
  - `npm run build`
  - 浏览器验收：在隔离 `18894` authority 的 `/settings` 页面确认 `CEO heartbeat` 出现“最近巡检审计”区块，能同时看到“已跳过 / 已运行”状态、触发方式和动作明细。
  - 浏览器验收：打开 `/ops`，确认页面标题、左侧导航和主线提示文案都已统一使用 `Ops`。
  - `npm test -- src/shared/presentation/HeartbeatAuditList.test.tsx src/pages/requirement-center/components/RequirementHeartbeatCard.test.tsx src/application/org/company-heartbeat-history.test.ts src/application/org/company-heartbeat.test.ts`
  - `npm run build`
  - 浏览器验收：在 `18895` authority + `4174` preview 的 `/settings` 页面确认 `CEO heartbeat` 继续展示“最近巡检审计”，且新的共享审计列表和 `Authority 同步诊断` 同时可见。
  - `npm test -- packages/authority-daemon/src/runtime-command-routes.test.ts packages/authority-daemon/src/control-routes.test.ts packages/authority-daemon/src/company-state-routes.test.ts packages/authority-daemon/src/executor-status.test.ts`
  - `npm run build`
  - 浏览器验收：使用 `4174` preview + 通过标准备份起的隔离 `18896` authority，从 `/connect` 切换 endpoint 后验证 `/runtime`、`/settings`、`/chat/main` 都能进入页面或稳定落到错误态，不会白屏。
  - 浏览器验收：`/settings` 中 `Authority 同步诊断`、`恢复 / 导入 / 手工修复入口`、`CEO heartbeat` 与 `Authority 执行后端` 区块正常渲染；当前 console 500 仍主要来自 OpenClaw `operator.read / operator.admin` scope 限制。
  - `npm test -- packages/authority-daemon/src/company-management-routes.test.ts packages/authority-daemon/src/runtime-command-routes.test.ts packages/authority-daemon/src/company-state-routes.test.ts packages/authority-daemon/src/control-routes.test.ts`
  - `npm run build`
  - 浏览器验收：在同一套 `4174` preview + `18896` authority 上打开 `/select`，执行 `nl -> 进入`，确认能正常切到 `/runtime`，随后进入 `/settings`，公司上下文、诊断卡和 heartbeat 区块都仍然正确显示。
  - 浏览器验收：同一环境下打开 `/requirement`，确认页面在当前公司缺少已形成主线时正常落到空状态，不会因为 heartbeat 审计组件接入而白屏；当前公司未进入可展示 heartbeat 卡片的主线路径，这一点已作为数据前提记录。
  - `npm test -- packages/authority-daemon/src/control-routes.test.ts packages/authority-daemon/src/operator-actions.test.ts packages/authority-daemon/src/company-ops-engine.test.ts`
  - `npm test -- packages/authority-daemon/src/company-state-routes.test.ts packages/authority-daemon/src/control-routes.test.ts`
  - `npm run build`
  - 浏览器验收：切到 `nl` 公司后打开 `/board`，确认切公司后的恢复能回到业务页，且看板继续保持主线摘要与执行入口可用。
  - 浏览器验收：打开 `/ops`，确认首屏 CTA 和摘要文案已统一为 `查看当前主线看板`、`只同步当前主线`、`当前主线成员`。
  - 浏览器验收：打开 `/runtime`，确认 Runtime 剧场卡片中的标签已从 `当前目标` 收口为 `当前指令`。
  - `npm run build`
  - 浏览器验收：重启 `18895` authority 后重新打开 `/settings`，确认拆分 control routes 后，Doctor、同步诊断、运维入口和 heartbeat 审计仍可正常显示；当前 console 里的 500 仍是既有 OpenClaw scope 噪音，不是路由拆分回归。
  - `WS-05 / WS-09 / WS-06` 最终收尾已补 recent-events 主链：authority `company.events.list` 现在支持 `recent=1&limit=N` 的 tail 读取，并修掉最后一页 `nextCursor` 不归零的问题；`Settings` 与 `Requirement Center` 都已切到这条链，真实页面不再只看到旧分页头部。
  - 浏览器验收：使用 `4174` preview + `18903` 保活 authority，在 `/connect` 确认 `Authority 控制面探测` 与 `恢复 / 导入 / 手工修复入口` 仍可见；进入 `nl` 后，`/settings` 与 `/requirement` 都已显示 `最近巡检审计`，且 requirement 页的 `CEO 巡检` 卡片已接入真实 company events。

## 11. 使用说明

这份文档适合在以下场景直接复用：

- 每轮开发前，先确认当前只推进哪一到两条工作流。
- 做 code review 或里程碑复盘时，用第 6 节和第 10 节快速判断“是否真的在收口”。
- 需要向他人解释后续计划时，优先引用这份文档，而不是把多个历史 roadmap 混在一起。

如果后续某个工作流已经实质完成，建议同步回写对应专项文档和路线图，避免这份实施计划长期变成新的“总文档黑洞”。
