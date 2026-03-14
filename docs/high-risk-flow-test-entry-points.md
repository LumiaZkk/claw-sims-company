# High-risk Flow Test Entry Points

Status: Active  
Last updated: 2026-03-14

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
| 验收门禁 / closeout | `src/application/mission/requirement-acceptance-gate.ts`、`src/application/mission/requirement-closeout-report.ts` | `src/application/mission/requirement-acceptance-gate.test.ts`、`src/application/mission/requirement-closeout-report.test.ts`、`src/presentation/requirement-center/components/RequirementAcceptancePanel.test.tsx` | `/requirement` 查看 closeout 证据与 gate |
| takeover 闭环 | `src/application/delegation/takeover-case.ts`、`src/application/delegation/use-takeover-case-workflow.ts` | `src/application/delegation/takeover-case.test.ts`、`src/application/delegation/use-takeover-case-workflow.test.ts`、`src/presentation/shared/TakeoverCasePanel.test.tsx` | `Board -> Ops -> Chat` 完成 `assigned -> in_progress -> resolved -> archived` |
| Workspace closeout / delivery summary | `src/application/workspace/platform-closeout.ts`、`src/presentation/workspace/components/WorkspaceCloseoutStatusCard.tsx` | `src/application/workspace/platform-closeout.test.ts`、`src/presentation/workspace/components/WorkspaceCloseoutStatusCard.test.tsx` | `/workspace` 查看 closeout 状态卡与资源来源提示 |
| 断连 / 重连 / endpoint 切换 | `src/infrastructure/gateway/store.ts`、`src/application/gateway/authority-health.ts` | `src/infrastructure/gateway/store.test.ts`、`src/application/gateway/authority-health.test.ts`、`src/components/system/gateway-status-banner.test.tsx` | `/connect` 从失效 endpoint 切到在线 endpoint；稳定页断连后只出现连接提示 |
| restore / import / operator control plane | `src/application/gateway/authority-health.ts` 的 `buildAuthorityOperatorControlPlaneModel()` | `src/application/gateway/authority-health.test.ts`、`src/presentation/shared/AuthorityOperatorControlPlaneCard.test.tsx` | `/connect` 与 `/settings` 可见 `doctor / backup / restore / rehearse` |
| CEO heartbeat / event continuation | `src/application/org/company-heartbeat.ts`、`src/application/org/company-heartbeat-history.ts` | `src/application/org/company-heartbeat.test.ts`、`src/application/org/company-heartbeat-history.test.ts`、`src/presentation/shared/HeartbeatAuditList.test.tsx` | `/settings` 或 `/requirement` 查看 heartbeat run ledger、触发原因和动作摘要 |

## Maintenance Rule

- 新增主路径工作流时，先在这里登记进入点，再补测试。
- 如果某条测试继续只能依赖整页挂载或人工 seed 数据，先补共享 surface，再补浏览器 smoke。
- 如果浏览器 smoke 需要隔离 authority，必须把用到的 companyId、roomId、端口和环境限制写回 `progress.md`。
