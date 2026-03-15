# Current Product & User Experience Review

Status: Draft  
Last updated: 2026-03-14

## 1. 目的

这份文档补充 2026-03-13 的工程 review，从产品和用户视角重新审查当前项目。

关注点不是“代码是否优雅”，而是：

- 普通用户能不能看懂主路径
- 页面职责是否符合产品定义
- 验收、排障、交付是否让用户有信任感
- 高级能力是否在错误的时机暴露给了错误的用户

## 2. 审查基线

本次审查基于以下材料：

- 当前代码实现
- `docs/cyber-company-prd.md`
- `docs/requirement-center-information-architecture.md`
- `docs/requirement-center-interaction-spec.md`
- `docs/current-project-follow-up-implementation-plan.md`

产品主路径的目标定义已经很清楚：

1. 用户在 CEO 首页提出目标
2. CEO 深聊负责澄清与收敛
3. 需求中心承接主线摘要、执行、协作、交付和验收
4. 需要看结果时进入 Workspace
5. 出现阻塞时进入 Ops，再返回需求中心

也就是说，当前最核心的问题已经不是“没有主路径”，而是“主路径定义出来了，但产品表面还没有完全围着它收口”。

## 3. 先说结论

当前产品已经具备比较清晰的主线叙事雏形，尤其是：

- CEO 首页的发起动作已经比较直白
- CEO 深聊到需求中心的过渡卡已经成型
- 需求中心的四个主要动作基本符合交互 spec
- Ops 和 Workspace 的角色在文档里已经写得很清楚

但从用户视角看，项目现在仍然存在 5 个高优先级问题：

1. 单条主路径已经定义，但“运行态 / Ops / 看板”等高级面板仍然被过早暴露为主导航和首屏动作。
2. Workspace 同时承担“交付查看”和“平台能力中台”两种角色，普通用户容易迷失。
3. 验收区仍然缺少足够的“为什么可以验收 / 为什么不能验收”的证据表达，信任感不足。
4. Ops/运营大厅虽然定位为排障中心，但当前产品语义仍然混入审批、团队管理、快速派活、知识同步等广义控制台动作。
5. 页面命名和按钮语义已开始收口，但关键时刻仍有重复动作和术语漂移，影响理解成本。
6. 系统已经有后台自治循环，但用户还感受不到“CEO 会自己继续推进”。

## 4. 正向观察

## 4.1 CEO 首页已经有正确的起点感

当前 CEO 首页的核心文案是“先说目标，再由 CEO 调度团队”，同时提供直接输入框、示例 prompt、以及“交给 CEO 推进”的主按钮。

这套表达对新用户是友好的，因为它没有要求用户先理解角色编排、部门设计或执行器细节。

## 4.2 CEO 深聊到需求中心的桥接是有效的

`已收敛需求` 卡片已经把“发起/澄清阶段”和“开始推进阶段”区分开了，这符合 interaction spec 里的设计意图。

这意味着产品已经不再只是聊天连续体，而是开始把“目标形成主线”变成一个可见状态切换。

## 4.3 Requirement Center 的四个主动作大体正确

需求中心已经常驻：

- 去协作
- 看交付
- 去排障
- 打开负责人

这和交互 spec 是一致的，说明主枢纽页面的动作骨架已经搭起来了。

## 5. 核心发现

## 5.1 [P1] 单条主路径已经定义，但高阶运行面仍然暴露得过早

### 现象

产品文档定义的主路径是 `CEO 首页 -> CEO 深聊 -> 需求中心 -> Workspace/Ops`。  
但当前真实导航和首屏动作里，`运行态` 仍然被放在极高优先级位置：

- 顶部 `主线快切` 里直接包含 `运行态`
- 左侧导航的 `主线` 分组里把 `运行态` 和 `需求中心` 并列，而且都标成 primary
- CEO 首页首屏按钮除了“打开需求中心/进入 CEO 深聊”，还直接给出“打开运营大厅”“查看运行态”
- 运营大厅首屏也直接给出“查看运行态”

### 用户影响

这会让普通用户在最开始就感觉系统有多个“主入口”，而不是一条清晰推进链。

更具体地说：

- 用户会分不清 `运行态` 是调试页、主工作台，还是必须经常看的首页
- 用户会过早暴露在系统内部健康度与执行细节上
- 团队虽然在文档里主张“需求中心是唯一主中枢”，但产品表面还没有完全兑现这件事

### 证据

- `docs/cyber-company-prd.md`
- `docs/requirement-center-information-architecture.md`
- `src/App.tsx`
- `src/pages/ceo/Page.tsx`
- `src/pages/lobby/components/LobbySections.tsx`

### 建议

- 对普通用户默认导航收口为：`CEO 首页 / 需求中心 / 工作目录`
- `运行态 / 运营大厅 / 工作看板` 退到“高级入口”或“按需暴露”的层级
- 当系统确实检测到异常时，再通过 contextual CTA 把用户引向 Ops 或 Runtime

## 5.2 [P1] Workspace 角色漂移严重，既像交付区，又像 CTO 中台

### 现象

根据信息架构，Workspace 应回答“结果在哪里、质量怎么样”。  
但当前 Workspace 首屏和默认动作同时强调：

- 发起规则校验能力需求
- 发起内容查看 App 需求
- 注册已有 App/Page
- 固化推荐应用
- AppManifest
- capability requests/issues
- workflow capability bindings
- 技术中台回路

它已经不只是“交付物视图”，而更像“公司专属平台控制台 + 交付查看器”的混合体。

### 用户影响

这会把两类人混在一起：

- 想看交付结果、做验收判断的业务用户
- 想配置公司能力、治理 app、补平台能力的高级操作者/CTO

结果就是：

- 普通用户进入 Workspace 后，不知道自己该先看文件、看知识、看报告，还是去发布 App
- 产品原本想把 Workspace 定义成“结果视图”，但首屏先给人的却是“平台管理后台”的感觉
- 交付与平台治理两条心智模型缠在一起，后续会不断侵蚀 Requirement Center 的收口成果

### 证据

- `docs/requirement-center-information-architecture.md`
- `src/pages/workspace/components/WorkspacePageContent.tsx`
- `src/pages/workspace/Page.tsx`

### 建议

- 把 Workspace 拆成至少两层：
  - 默认层：交付视图
  - 高级层：工作目录治理/CTO 工坊
- 普通用户默认进入时，首屏先展示：
  - 当前主线交付摘要
  - 可读正文/设定/报告
  - 验收相关检查结果
- `AppManifest / Capability / Workflow binding / Skill run` 这些内容应后置到“高级管理”标签或独立页面

## 5.3 [P1] 验收区仍然缺少让用户放心拍板的证据表达

### 现象

需求中心的验收区目前已经把状态区分为：

- 发起验收
- 验收通过
- 继续修改
- 驳回重开

这在流程语义上是正确的。  
但当前用户在按下这些按钮前，页面里并没有一个足够明确的 closeout 证据区来回答：

- 这次到底交付了什么
- 哪些检查已经通过
- 哪些风险仍然存在
- 为什么现在可以正式通过

交付区虽然能列出最近文件，但它更像“最近产物列表”，还不是“验收证据面板”。

### 用户影响

- 用户会觉得验收更像流程按钮，而不是基于证据做决策
- 当结果不够好时，用户只能凭感觉选择“继续修改 / 驳回重开”
- 这会削弱产品建立“可托付的 AI 团队”这一心智目标

### 证据

- `docs/requirement-center-interaction-spec.md`
- `src/pages/requirement-center/Page.tsx`
- `src/pages/workspace/components/WorkspacePageContent.tsx`

### 建议

- 在需求中心增加“验收依据”区域，而不只是“验收动作”区域
- 默认展示：
  - 交付物摘要
  - 来源链路
  - 校验结果
  - 最近 closeout 时间
  - 未通过项
- “发起验收”按钮应直接关联一份 closeout report，而不是单独存在

## 5.4 [P2] Ops 的页面角色仍然比文档定义更宽

### 现象

文档把 Ops 定义为“异常与排障中心”。  
但当前运营大厅除了异常与恢复外，还混入了：

- 待处理审批
- 团队指标
- 快速派活
- 知识同步
- 复制 blueprint
- 招聘/调岗/解雇
- 成员状态与最近活动

它更像“公司控制台”而不是纯粹的“排障中心”。

### 用户影响

- 用户会不确定自己进入 Ops 是为了处理异常，还是为了做组织管理
- `需求中心负责主线 / Ops 负责排障` 的心智边界会再次变模糊
- 对于不是操盘手的用户，Ops 页面会显得过重

### 证据

- `docs/cyber-company-prd.md`
- `docs/requirement-center-information-architecture.md`
- `src/pages/lobby/Page.tsx`
- `src/pages/lobby/components/LobbySections.tsx`

### 建议

- 明确区分 `Ops` 与 `Company Control`
- 保留当前运营大厅为 operator 视图没问题，但产品语义上不应再把它表述成纯排障页
- 更理想的做法是：
  - `Ops`：异常、阻塞、接管、恢复
  - `组织控制/控制台`：审批、成员调整、快速派活、知识同步

## 5.5 [P2] 关键过渡节点仍有重复动作，削弱“下一步只有一个”的清晰度

### 现象

CEO 深聊中的 `已收敛需求` 卡片同时提供：

- 开始推进这条需求
- 查看详情

这两个动作当前都指向需求中心。  
从产品角度看，这属于“关键阶段切换时重复给出相同去向的不同按钮”。

### 用户影响

- 用户会在最关键的阶段切换时多想一步：“这两个入口到底有什么区别？”
- 明明应该强化“现在进入主线推进”的确定感，却被重复 CTA 稀释了

### 证据

- `docs/requirement-center-interaction-spec.md`
- `src/pages/chat/components/ChatSettledRequirementCard.tsx`

### 建议

- 在这个节点只保留一个主 CTA
- 例如保留“开始推进这条需求”
- `查看详情` 可以删掉，或者改成真正不同的二级目标

## 5.6 [P3] 产品命名开始收口，但还没有形成统一品牌语言

### 现象

当前仓库中仍混用：

- `Operations Hall`
- `运营大厅`
- `Ops`

同时还有：

- `工作目录`
- `Workspace`
- `公司应用`

文档已经在努力建立 glossary，但产品层还没有做到彻底一致。

### 用户影响

- onboarding 成本偏高
- 用户在文档、导航、页面之间来回跳时，会怀疑这些是不是不同概念

### 证据

- `README.md`
- `docs/requirement-center-glossary.md`
- `docs/cyber-company-prd.md`
- `src/App.tsx`

### 建议

- 固定每个一级入口只保留一套用户命名
- glossary 作为唯一真相源，回写 README、导航、空状态和卡片标题

## 5.7 [P1] 系统已经有后台自治循环，但还没有形成可感知的 CEO 巡检体验

### 现象

当前 authority 侧已经存在 `CompanyOpsEngine`，并且会按固定周期自动运行一轮 `runCompanyOpsCycle()`。

它已经能做一些后台自治动作，例如：

- 自动创建支持请求
- 超时或阻塞时升级到 CEO
- 做组织自动校准
- 持续更新 `lastEngineRunAt` 和 `lastEngineActions`

但从产品视角看，这套能力目前更像“后台治理循环”，而不是用户能感知到的“CEO 会自己巡检并推动主线继续前进”。

特别是现在还缺少以下体验：

- 回执返回后，CEO 自动读回执并继续派下一步
- 用户能看到“CEO 上次巡检是什么时候、做了什么、下一步准备做什么”
- 用户可以暂停或配置这类自动巡检

### 用户影响

- 用户会感觉系统还是需要自己不断“推一下”才会继续前进
- “AI 团队会自主推进”这个承诺没有在产品表面被真正感知到
- 已有后台自治能力没有转化成用户信任

### 证据

- `packages/authority-daemon/src/company-ops-engine.ts`
- `packages/authority-daemon/src/server.ts`
- `src/pages/ceo/Page.tsx`
- `src/pages/requirement-center/Page.tsx`

### 建议

- 把现有 `CompanyOpsEngine` 升级成一个可见的 `CEO heartbeat` 产品能力，而不是另起一套完全平行的自治引擎
- 第一阶段先不追求复杂自动决策，优先把“最近巡检 / 最近动作 / 下一次巡检 / 可暂停”产品化
- 第二阶段再接“已回答 dispatch 自动续推”“阶段性汇报”“预算与审批护栏”
- `CEO heartbeat` 的业务配置与状态应由 Cyber Company 自身系统保存；如果沿用 OpenClaw heartbeat，只做单向同步，不形成第二套配置真相源

## 6. 产品层待做事项

这轮产品审查不建议另起完全独立的新路线，优先并入已有实施计划：

| 产品问题 | 对应实施计划 |
| --- | --- |
| 主路径暴露太多高阶入口 | `WS-01 Requirement Center 边界拆分` + `WS-08 术语与信息架构统一` |
| Workspace 角色漂移 | `WS-01` 的边界收口，并建议追加 Workspace audience split 子任务 |
| 验收缺少证据表达 | `WS-02 验收闭环内容化` |
| 接管产品化不足 | `WS-03 人工接管产品化` |
| Ops 语义过宽 | `WS-08`，必要时补一个 `Ops vs Control` 重命名/拆分子任务 |
| 重复 CTA 与命名漂移 | `WS-08` |

## 7. 建议优先级

如果只从产品和用户感知出发，推荐优先顺序是：

1. 收口导航和首屏 CTA，减少高阶入口前置
2. 把现有后台 ops cycle 产品化成 CEO 可感知的 heartbeat
3. 把 Workspace 默认层改成“交付视图优先”
4. 给 Requirement Center 增加“验收依据”区
5. 把人工接管做成正式 case
6. 最后统一 Ops / Workspace / Requirement Center 的命名与职责表述

## 8. 一句话结论

当前产品最大的问题不是“没有产品方向”，而是“方向已经写清楚了，但表面仍然保留了太多工程/运营内部结构”。  

下一阶段最重要的不是继续往系统里加页面，而是让普通用户真的只需要沿着那条主路径走，就能理解系统、推进需求、判断结果。
