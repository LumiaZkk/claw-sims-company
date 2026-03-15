# High-risk Flow Test Entry Points

Status: Active  
Last updated: 2026-03-15

## Purpose

这份文档把当前高风险前台流的“最小测试进入点”固定下来，避免后续所有验证都只能从整页挂载或整套 authority/browser 环境开始。

原则：

1. 每条高风险流至少要有一个 surface/view-model 级进入点。
2. 每条高风险流至少要有一个页面或浏览器 smoke。
3. 新功能如果改动主路径，必须优先复用这里的进入点；如果复用不了，就先补新的进入点再写页面测试。

## Entry Matrix

| 工作流 | 主进入点 | 自动化护栏 | 浏览器验收基线 |
| --- | --- | --- | --- |
| 正常推进 requirement | `src/application/delegation/requirement-room-entry.ts` 的 `resolveRequirementRoomEntryTarget()` | `src/application/delegation/requirement-room-entry.test.ts`、`src/application/mission/requirement-center-page-view-model.test.ts` | `connect -> select -> /requirement -> 进入需求房` |
| 验收门禁 / closeout | `src/application/mission/requirement-acceptance-gate.ts`、`src/application/mission/requirement-closeout-report.ts` | `src/application/mission/requirement-acceptance-gate.test.ts`、`src/application/mission/requirement-closeout-report.test.ts`、`src/pages/requirement-center/components/RequirementAcceptancePanel.test.tsx` | `/requirement` 查看 closeout 证据与 gate |
| 项目追踪与归档 | `packages/authority-daemon/src/company/authority-project-store.ts`、`packages/authority-daemon/src/company/company-state-routes.ts`、`src/pages/projects/Page.tsx` | `packages/authority-daemon/src/company/company-state-routes.test.ts` | `connect -> select -> /projects -> 新建项目 -> /projects/:id -> 写入摘要 -> 归档 -> 列表筛选` |
| takeover 闭环 | `src/application/delegation/takeover-case.ts`、`src/application/delegation/use-takeover-case-workflow.ts` | `src/application/delegation/takeover-case.test.ts`、`src/application/delegation/use-takeover-case-workflow.test.ts`、`src/shared/presentation/TakeoverCasePanel.test.tsx` | `Board -> Ops -> Chat` 完成 `assigned -> in_progress -> resolved -> archived` |
| 招聘 / 入职主路径 | `src/domain/org/hiring.ts`、`src/lib/agent-ops.ts`、`packages/authority-daemon/src/company/company-management-service.ts` | `src/domain/org/hiring.test.ts`、`src/domain/org/talent-market.test.ts`、`src/ui/immersive-hire-dialog.test.tsx`、`src/pages/lobby/hooks/useLobbyPageState.test.tsx`、`src/lib/agent-ops.test.ts`、`packages/authority-daemon/src/company/company-management-service.test.ts`、`packages/authority-daemon/src/company/company-management-routes.test.ts` | `Lobby / Org -> 打开 hire dialog -> 提交 -> 跳到新员工 chat` |
| blueprint 导入创建公司 | `src/application/company/blueprint.ts`、`packages/authority-daemon/src/company/company-management-service.ts`、`src/pages/company-create/Page.tsx` | `src/application/company/blueprint.test.ts`、`src/pages/company-create/Page.test.tsx`、`packages/authority-daemon/src/company/company-management-service.test.ts` | `/create` 选择「从蓝图导入」 -> 提交 -> 创建成功 |
| Workspace closeout / delivery summary | `src/application/workspace/platform-closeout.ts`、`src/pages/workspace/components/WorkspaceCloseoutStatusCard.tsx` | `src/application/workspace/platform-closeout.test.ts`、`src/pages/workspace/components/WorkspaceCloseoutStatusCard.test.tsx` | `/workspace` 查看 closeout 状态卡与资源来源提示 |
| 断连 / 重连 / endpoint 切换 | `src/infrastructure/gateway/store.ts`、`src/application/gateway/authority-health.ts` | `src/infrastructure/gateway/store.test.ts`、`src/application/gateway/authority-health.test.ts`、`src/system/gateway-status-banner.test.tsx` | `/connect` 从失效 endpoint 切到在线 endpoint；稳定页断连后只出现连接提示 |
| restore / import / operator control plane | `src/application/gateway/authority-health.ts` 的 `buildAuthorityOperatorControlPlaneModel()` | `src/application/gateway/authority-health.test.ts`、`src/shared/presentation/AuthorityOperatorControlPlaneCard.test.tsx` | `/connect` 与 `/settings` 可见 `doctor / backup / restore / rehearse` |
| CEO heartbeat / event continuation | `src/application/org/company-heartbeat.ts`、`src/application/org/company-heartbeat-history.ts` | `src/application/org/company-heartbeat.test.ts`、`src/application/org/company-heartbeat-history.test.ts`、`src/shared/presentation/HeartbeatAuditList.test.tsx` | `/settings` 或 `/requirement` 查看 heartbeat run ledger、触发原因和动作摘要 |

## Maintenance Rule

- 新增主路径工作流时，先在这里登记进入点，再补测试。
- 如果某条测试继续只能依赖整页挂载或人工 seed 数据，先补共享 surface，再补浏览器 smoke。
- 如果浏览器 smoke 需要隔离 authority，必须把用到的 companyId、roomId、端口和环境限制写回 `progress.md`。
- 如果已经执行了一轮正式浏览器 smoke，结果还应落在对应 initiative 的 `browser-acceptance-report-YYYY-MM-DD.md`。
- 如果是 `multi-agent-collaboration-rearchitecture` 相关主路径，还必须同步更新 `docs/multi-agent-collaboration-rearchitecture-browser-acceptance-plan.md`。
