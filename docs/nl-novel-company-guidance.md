# NL 小说公司：AI 自主驱动的网文生产指南

Status: Draft
Last updated: 2026-03-13

## 1. 目标

以"NL 小说公司"为样板，说明如何用 Cyber Company 搭建一个 **AI 自主驱动** 的多 Agent 网文小说生产团队。

核心原则：

- **用户 = 老板**：只负责提需求、看结果、偶尔拍板
- **Agent = 员工**：自主思考、自主执行、自主进化
- **系统 = 公司制度**：自动派单、自动升级、自动校准

## 2. 与 Paperclip 的对比：选哪条路

| 维度 | Cyber Company | Paperclip |
|------|--------------|-----------|
| 定位 | 需求控制平面：围绕"一条需求主线"做闭环 | 通用编排平台：围绕"issue + heartbeat"做调度 |
| 前台主线 | RequirementAggregate（需求 → 验收） | Issue（创建 → checkout → 完成） |
| Agent 驱动 | CEO 对话 → 需求收敛 → 自动派单 → 回执 | heartbeat cron + event trigger |
| 自治能力 | OpsEngine 自动生成 support request / escalation | heartbeat_runs 定时执行 |
| 治理 | Approval Gate + Budget Guardrail | Approval + Budget（更成熟） |
| 协作模型 | 派单制（dispatch + report） | checkout 锁 + 任务分配 |
| 适合场景 | 需求驱动、有明确交付物的团队 | 7×24 自治运转、多 adapter 平台 |

**对 NL 小说公司的判断**：

Cyber Company 更适合。原因：

1. 小说生产是典型的"需求驱动 → 交付物明确"场景
2. CEO → 责编 → 编剧/美工/校对 的派单制天然匹配公司隐喻
3. 需求中心的验收闭环适合章节级交付
4. Paperclip 的 heartbeat 模式更适合"持续巡检"类场景，不是创作类

## 3. 组织架构设计

### 3.1 推荐架构

```
老板（你）
  └── CEO（总调度）
        ├── HR（组织管理）
        ├── CTO（技术底座）
        ├── COO（运营节奏）
        └── 创作部（业务核心）
              ├── 责编（部门负责人）
              ├── 主笔（核心创作）
              ├── 世界观架构师（设定管理）
              └── 校对编辑（质量把关）
```

### 3.2 角色定义

需要在 `src/application/company/templates.ts` 中新增 NL 模板：

```typescript
{
  id: 'novel-studio',
  name: '📚 网文工作室',
  description: 'AI 自主驱动的长篇网文小说生产团队',
  icon: '📚',
  employees: [
    {
      role: '责编',
      nickname: '老陈',
      soul: '资深网文责编，擅长把控剧情节奏、角色弧光和市场卖点。负责拆解大纲为章节计划，分配写作任务，审核成稿质量，决定是否返稿修改。',
      reportsToRole: 'ceo',
    },
    {
      role: '主笔',
      nickname: '阿墨',
      soul: '网文写手，擅长玄幻/都市/系统文等多品类创作。收到责编的章节任务后独立完成初稿，注重节奏感、爽点密度和钩子设计。',
      reportsToRole: 'coo', // 归入创作部
    },
    {
      role: '世界观架构师',
      nickname: '小设',
      soul: '负责维护小说的设定集文档：角色关系图、地图、力量体系、时间线。确保不同章节的设定不矛盾，主动发现 bug 并提醒责编。',
      reportsToRole: 'coo',
    },
    {
      role: '校对编辑',
      nickname: '小校',
      soul: '严格的文字质检员。检查错别字、逻辑硬伤、前后矛盾、节奏拖沓。给出明确的修改意见清单，不通过则打回。',
      reportsToRole: 'coo',
    },
  ],
}
```

### 3.3 CEO Soul 的关键约束（已内置）

当前 `meta-agent-souls.ts` 中的 CEO Soul 已经具备以下对小说公司至关重要的内置行为：

1. **业务归属先判定**：CEO 不会把"写小说"错派给 CTO/COO/HR，而是会识别为业务交付，派给创作部
2. **结构化控制输出**：CEO 的每条回复会附带隐藏的 `metadata.control`，包含 `requirementDraft`（需求草案），系统据此自动形成主线
3. **渐进收敛**：CEO 不会一上来就全面展开，而是先复述理解，给 1-2 个建议下一步
4. **委派合同**：CEO 使用 `company_dispatch` 正式派单，而非口头指派

## 4. 核心工作流：从"我想写本小说"到自动交付

### 4.1 第一阶段：需求发起（用户介入 ≈ 5 分钟）

```
用户在 CEO 首页输入：
→ "我想写一本都市重生的网文，主角带着前世记忆回到 2010 年，
   利用信息差和商业嗅觉逐步崛起。100 万字，日更 3000 字。"
```

CEO 收到后会：

1. 读取 `company-context.json` 检查当前员工和能力
2. 判定这是"业务交付"，归创作部负责
3. 回复用户：当前理解 + 建议下一步 + 是否可推进
4. 在 `metadata.control` 中写入 `requirementDraft`，系统自动形成需求主线

用户只需回复"可以，开始吧"——后续全部自动。

### 4.2 第二阶段：自动拆解与派单（零介入）

CEO 进入执行后：

1. **写入 TASK-BOARD.md**：拆分为 P0/P1 任务，分配给具体员工
2. **通过 `company_dispatch` 派单给责编**：
   - 消息包含：需求标题、当前判断、步骤要求、下一步动作
   - 系统自动附加回执要求（`acknowledged / answered / blocked`）
3. **责编收到后自动接单**：
   - 制定章节计划（前 10 章大纲）
   - 通过 `company_dispatch` 继续派给主笔、世界观架构师
4. **主笔/架构师/校对自动执行**：各自按照自己的 Soul 定义独立工作

### 4.3 第三阶段：自主协作循环（零介入）

当前系统已具备的自动协作机制：

| 机制 | 代码位置 | 功能 |
|------|---------|------|
| **自动派单** | `dispatch-planning.ts` | 基于当前步骤自动识别下一接棒人并派发 |
| **回执协议** | `dispatch-policy.ts` | 30s 传输确认 + 5min 业务回执提醒 |
| **Support Request** | `company-ops-engine.ts` | 业务部门自动向 HR/CTO/COO 发起支持请求 |
| **SLA 升级** | `company-ops-engine.ts` | 超时未响应自动升级为 Escalation，通知 CEO |
| **负载评估** | `company-ops-engine.ts` | 自动计算部门负载分数，连续过载触发校准 |
| **组织自校准** | `org-fit.ts` | 自动调整部门结构和人员配置 |

**小说场景下的协作流转示例**：

```
责编：派单给主笔 → "请写第 1-3 章初稿，参考世界观设定文档"
  ↓
主笔：acknowledged → 开始创作 → answered（提交初稿）
  ↓
责编：审核初稿 → 派单给校对 → "请校对第 1-3 章"
  ↓
校对：检查后 → answered（返回修改清单）
  ↓
责编：判断是否通过
  → 通过：汇报 CEO，CEO 更新需求中心状态
  → 不通过：重新派单给主笔 → "请按以下意见修改"
```

### 4.4 第四阶段：异常自愈（零介入）

当前 `CompanyOpsEngine` 已实现的自治逻辑：

1. **主笔超时未回执** → 系统自动生成 Support Request
2. **Support Request 超 SLA** → 自动升级为 Escalation，通知 CEO 介入
3. **部门持续过载** → 自动触发 `autoCalibrateOrganization`，建议 CEO 通过 HR 补人
4. **工作项阻塞** → 自动分类阻塞原因（需要 HR 补人 / 需要 CTO 工具支持 / 需要 COO 流程调整）

**小说场景的异常处理示例**：

```
主笔写到第 20 章发现力量体系有矛盾
  → 主笔 report 状态为 blocked
  → OpsEngine 识别为"需要 CTO 支持"（如果是工具问题）
     或生成 Support Request 给世界观架构师
  → 架构师收到后修正设定，给主笔发 dispatch
  → 主笔继续创作
  → 全程用户零感知
```

### 4.5 第五阶段：验收（用户介入 ≈ 2 分钟）

当责编认为阶段性成果已就绪，CEO 会在需求中心触发验收：

1. 需求中心显示"待你验收"
2. 用户查看交付物（章节文件）
3. 选择：通过 / 继续修改 / 驳回重开
4. 如果通过，需求闭环；如果驳回，自动回到执行态

## 5. 实现自主进化的关键开发建议

### 5.1 当前已具备的自主进化能力

| 能力 | 当前状态 | 说明 |
|------|---------|------|
| 组织自校准 | ✅ 已实现 | `autoCalibrateOrganization` 自动调整部门和汇报线 |
| 自动派单 | ✅ 已实现 | `buildAutoDispatchPlan` 基于步骤自动识别接棒人 |
| SLA 升级 | ✅ 已实现 | 超时自动升级，有 `supportSlaHours` 可配 |
| 负载均衡 | ✅ 已实现 | `calculateDepartmentLoadScore` 自动计算 |
| Approval Gate | ✅ 已实现 | 离职/部门变更/自动化启用需人工审批 |
| 预算护栏 | ✅ 已实现 | `automationMonthlyBudgetUsd` 软预算 |

### 5.2 需要增强以实现"省心"体验的能力

#### P0：CEO 连续执行链路

**现状**：CEO 目前在收到用户"可以开始"后，可以自主派单。但当回执返回后，需要用户"推一下"才会继续下一轮。

**建议**：增强 CEO 的 heartbeat 机制——定时检查所有开放派单的回执情况，自动触发下一轮动作：

```
每 N 分钟：
  1. 扫描所有 status=answered 的 dispatch
  2. CEO 自动读取回执内容
  3. 决定下一步：继续派下一轮 / 汇总结果 / 升级问题
  4. 自动执行，不等用户
```

这正是 Paperclip 的 heartbeat_runs 模式。建议借鉴 `PC-EXEC-01` 的 run ledger 基线，让 CEO 的定时巡检有记录、有成功/失败状态、有可追溯性。

#### P1：创作知识沉淀层

**现状**：Agent 之间通过派单传递信息，但没有统一的"设定集"知识库。

**建议**：利用 Artifact 系统，让世界观架构师维护一组 canonical artifact：

- `WORLDVIEW.md` — 力量体系、地理、时间线
- `CHARACTERS.md` — 角色关系图、性格设定
- `STYLE-GUIDE.md` — 文风、禁忌词
- `CHAPTER-OUTLINE.md` — 全书大纲

所有创作者在写作前先读取这些文件。这利用了现有的 `workspace` + `agent_files` 机制。

#### P2：质量反馈闭环

**现状**：校对结果通过 dispatch 文本传递，没有结构化的质量指标。

**建议**：让校对编辑的回执包含结构化评分：

```json
{
  "chapter": 3,
  "score": 72,
  "issues": ["前后矛盾: 第2章说主角28岁，第3章变成30岁", "节奏拖沓: 中段议论过多"],
  "pass": false
}
```

CEO 可据此自动决定是否返稿，不需要人工判断。

## 6. 自治策略配置

在 Settings 中配置以下参数以实现最大自治度：

```typescript
// autonomy-policy.ts 中的关键配置
{
  autoApproveInternalReassignments: true,   // 内部调配自动批准
  autoApproveSupportRequests: true,          // 支持请求自动批准
  humanApprovalRequiredForLayoffs: true,     // 解雇仍需人工（安全阀）
  humanApprovalRequiredForAutomationEnable: false, // 自动化无需审批
  automationMonthlyBudgetUsd: 100,           // 月预算上限
  supportSlaHours: 2,                        // 小说场景收紧到 2 小时
  departmentBlockerEscalationHours: 1,       // 阻塞 1 小时即升级
}
```

```typescript
// collaboration-policy.ts 中的关键配置
{
  allowDepartmentLeadToDispatchWithinDepartment: true,  // 责编可直接派单给主笔
  allowDepartmentMembersWithinDepartment: true,         // 部门内成员可互派
  allowDepartmentLeadToDispatchToSupportLeads: true,    // 责编可请求技术支持
}
```

## 7. 用户日常操作手册（老板视角）

### 每天需要做的（≈ 5 分钟）

1. 打开 **需求中心**，看当前主线状态
2. 如果有"待你验收"标记，看交付物并通过/驳回
3. 如果有"待你决策"的决策票，选一个选项

### 偶尔需要做的

- 在 CEO 首页发起新需求（"再开一本仙侠文"）
- 在 Settings 里调整预算或 SLA 参数
- 在运营大厅查看成本和执行报表

### 不需要做的

- ❌ 不需要手动给每个 Agent 派活
- ❌ 不需要协调 Agent 之间的交接
- ❌ 不需要处理 Agent 报错（系统自动升级）
- ❌ 不需要手动更新任务看板

## 8. 与 Paperclip 的具体差异对开发的启示

### 8.1 应该从 Paperclip 借鉴的

| 借鉴点 | 原因 | 对小说公司的价值 |
|-------|------|----------------|
| Heartbeat Run | 让 CEO 定时自主巡检 | CEO 不用被"推"才干活 |
| Run Ledger | 记录每次自动执行的结果 | 老板能回看"昨晚写了什么" |
| 执行锁 (Checkout) | 明确"谁在写哪一章" | 避免两个 Agent 写同一章 |
| Doctor 自检 | 启动前检查环境就绪 | 减少"连不上"的体验割裂 |

### 8.2 不应该照搬的

| Paperclip 做法 | 原因 |
|---------------|------|
| Issue-first 前台 | 小说创作不是工单系统，需求主线更自然 |
| PostgreSQL 后端 | 当前 SQLite 本地优先更适合个人使用场景 |
| 多 Adapter 平台 | 现阶段不需要，OpenClaw-first 够用 |
| 通用 Agent 公司模板 | 小说公司需要高度定制的 Soul 和协作流程 |

## 9. 总结

NL 小说公司的核心公式：

```
用户发需求
  → CEO 自主拆解派单
    → 责编分章节给主笔/架构师/校对
      → 各 Agent 独立执行 + 回执驱动下一轮
        → 异常自动升级 + SLA 护栏
          → 阶段交付 → 用户验收
```

当前 Cyber Company 已经具备了 80% 的基础能力。剩下 20% 的关键缺口是 **CEO 的 heartbeat 自主巡检** 和 **创作知识沉淀层**——这两项补齐后，"老板只看不管"就能真正落地。
