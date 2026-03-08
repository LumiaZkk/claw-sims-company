# Progress

## 2026-03-08
- 独立 worktree 上继续执行 `WorkItem + Room + Capability` 收口计划
- 完成 `RoundRecord` actor 归一化和房间真相源去 `providerConversationRefs`
- 浏览器确认 `CEO / 工作看板 / 运营大厅` 不再复活旧任务
- 本轮继续推进：
  - `ArtifactRecord.content`
  - `WorkspacePage` artifact-first
  - `agentFiles` 能力缺失时的页面降级
  - 剩余 session-key 泄漏清理
- 本轮新增收口：
  - 群聊房间路由不再把 `sk=` 暴露到 URL
  - `CompanyLobby / BoardPage` 不再用 `sessionKey.includes(':group:')` 判断房间型工作项
  - 房间消息转回聊天气泡时优先使用产品 `room.id`，不再把 provider conversation id 回灌成可见房间身份
  - `ChatPage` 房间 owner / sender 恢复逻辑进一步减少 `parseAgentIdFromSessionKey(...)` 回退
- 验证：
  - `vitest`：`requirement-room / work-item / reconciler / requirement-overview` 通过
  - `pnpm build` 通过
  - 浏览器：
    - `/chat/co-ceo` 正常恢复新会话态
    - 页面链接中不再出现 `sk=` 房间参数
    - `/board` 与 `/ops` 仍正常读取当前 `WorkItem` 视图
browser validation start 2026-03-08 21:06:23
- Removed room sk query exposure from room routes and aligned room/workitem detection to product ids.
- Running browser regression on /ops and /workspace after room-route cleanup.
- 本轮最终收口：
  - `CompanyLobby` 首屏完全改成 `WorkItem` 驱动，只保留当前负责人、当前环节、下一步、进度和主动作
  - `WorkspacePage` 默认切到 artifact-first 视图，正文/设定/审校报告优先，工具/系统镜像降到次级
  - `ChatPage` 历史恢复路径新增房间签名短路和 store no-op bailout，修复 `Maximum update depth exceeded`
  - 房间路由与房间消息身份回到产品 `roomId / workItemId`，不再以 `sk=` 或 provider conversation id 暴露给用户
  - `Room / WorkItem / Round` 的迁移层仍保留对旧 session key 的兼容解析，但仅用于老数据归一化，不再驱动页面主状态
- 最终验证：
  - `vitest` 15 个测试文件、47 个测试全部通过
  - `pnpm build` 通过
  - 浏览器回归通过：
    - `/chat/co-ceo` 历史恢复成功，页面无 React 无限更新，控制台 0 个 error
    - `/ops` 首屏显示 `WorkItem` 驱动的负责人/阶段/下一步
    - `/workspace` 首屏显示 artifact-first 的工作目录与产品产物心智
