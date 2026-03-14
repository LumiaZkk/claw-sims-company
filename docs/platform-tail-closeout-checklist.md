# Platform Tail Closeout Checklist

Status: Complete  
Last updated: 2026-03-14

## 1. Closeout Summary

平台尾项当前已完成收口，剩余内容不再作为 `WS-07` 的未关单项保留。

结论：

- Resource 业务主路径已经明确以显式声明为准，`inferred` 只保留为展示/草案补位。
- Settings / Connect 已提供正式的 backup / restore / doctor / rehearse 入口。
- compat/legacy 分支已整理成 inventory，并给出保留原因、移除条件和目标日期。
- 文档尾项和产品行为已经对齐到同一份验收矩阵。

## 2. Resource Main-path Evidence

| 目标 | 当前实现证据 | 自动化证据 |
| --- | --- | --- |
| 正式业务判断不依赖 inferred resource | `src/application/workspace/platform-closeout.ts` 的 `FORMAL_RESOURCE_ORIGINS` 只承认 `declared / manifest` | `src/application/workspace/platform-closeout.test.ts` |
| 正式执行输入忽略 inferred resource | `src/application/workspace/skill-runner.ts` 只把正式资源带入正式执行输入 | `src/application/workspace/skill-runner.test.ts` 中 `ignores inferred resources when building formal execution input` |
| inferred manifest 不能成为权威来源 | `src/application/workspace/app-manifest.ts` 只接受显式 manifest 来源 | `src/application/workspace/app-manifest.test.ts` 中 `does not treat inferred manifest files as authoritative manifest sources` |
| UI 若保留 inferred，只能作为草案/提示 | `src/presentation/workspace/components/WorkspacePageContent.tsx` 对 inferred 资源展示 outline badge 与提示文案，不把它描述成正式判断来源 | 浏览器 `/workspace` 资源详情页提示文案 |

## 3. Operator Control Plane Evidence

| 目标 | 当前实现证据 | 自动化证据 |
| --- | --- | --- |
| 页面内可直接理解恢复动作 | `src/application/gateway/authority-health.ts` 的 `buildAuthorityOperatorControlPlaneModel()` | `src/application/gateway/authority-health.test.ts` |
| 页面内可直接触发 doctor / backup / restore / rehearse | `src/presentation/shared/AuthorityOperatorControlPlaneCard.tsx` | `src/presentation/shared/AuthorityOperatorControlPlaneCard.test.tsx` |
| Connect/Settings 成为正式入口 | `src/presentation/connect/Page.tsx`、`src/presentation/settings/components/SettingsSections.tsx` | 浏览器 `/connect`、`/settings` smoke |

## 4. Compat Inventory

| 分支/兜底 | 当前保留原因 | 移除条件 | 计划日期 |
| --- | --- | --- | --- |
| `src/application/runtime-inspector/index.ts` 中的恢复/兼容来源视图 | 仍需向 operator 解释 authority 数据与恢复补位的差异 | authority bootstrap 能直接输出同级别恢复诊断，且前台不再依赖 legacy store 观察面 | 2026-04-15 |
| `src/infrastructure/authority/runtime-sync-store.ts` 中的 compat diagnostics | 仍需给 Settings Doctor 展示 compat path 指标，避免恢复链路失明 | `compatibilityPathEnabled` 固定关闭且恢复链路完全迁到 operator-only snapshot | 2026-04-15 |
| `packages/authority-daemon/src/legacy-compat/company-workspace-smoke-fixtures.ts` | 仍承担旧 smoke 数据夹具，方便隔离 authority 回归 | workspace bootstrap smoke 全部迁到 canonical bootstrap fixtures | 2026-05-01 |

## 5. Acceptance Matrix

| 平台尾项 | 实现落点 | 自动化/浏览器验证 |
| --- | --- | --- |
| Resource 主路径显式声明化 | `platform-closeout.ts`、`skill-runner.ts`、`app-manifest.ts`、Workspace inferred warning UI | `platform-closeout.test.ts`、`skill-runner.test.ts`、`app-manifest.test.ts`、浏览器 `/workspace` |
| backup / restore 页面入口 | `authority-health.ts`、`AuthorityOperatorControlPlaneCard.tsx`、Connect/Settings 页面 | `authority-health.test.ts`、`AuthorityOperatorControlPlaneCard.test.tsx`、浏览器 `/connect` `/settings` |
| compat inventory 与移除计划 | 本文档第 4 节 inventory | 文档审计 + `Settings Doctor` sync diagnostics |
| 文档尾项与产品行为对齐 | `docs/current-project-follow-up-implementation-plan.md`、本文档、`docs/high-risk-flow-test-entry-points.md` | 本轮实施文档回写与浏览器 smoke |
