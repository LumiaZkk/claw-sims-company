# WorkItem + Room + Capability 收口计划

## 最终状态
- [x] `WorkItem` 真相源优先接入 `ChatPage / BoardPage / CompanyLobby / WorkspacePage`
- [x] 产品房间稳定化，按 `workItemId` 复用房间
- [x] `BackendCore -> provider` 桥接与弱后端测试桩
- [x] `RoundRecord` actor 归一化，历史不再依赖页面时 session-key 解析
- [x] `WorkspacePage` artifact-first，provider files 仅做镜像补充
- [x] 历史恢复无限更新修复并通过浏览器回归
- [x] 清理主路径中的 session-key / provider 语义泄漏
- [x] 最终浏览器回归

## 已完成清单
1. [x] `WorkItem` 成为主页面唯一任务真相源
2. [x] `Room` 成为主房间真相源，并以 `workItemId` 固定复用
3. [x] `Artifact` 成为工作目录主数据源，业务文档优先、工具镜像降级
4. [x] `Round` 成为历史轮次主索引，并支持恢复当前会话
5. [x] `BackendCore` 固化为新 provider 的接入门槛
6. [x] 弱能力 provider 测试桩在 `virtual-actor + product-room + product-archive + product-store` 模式下通过
7. [x] `CompanyLobby` 首屏改为 `WorkItem` 驱动，不再以旧请求/SLA/交接作为主心智
8. [x] 群聊房间链接不再暴露 `sk=`，房间身份回到产品 `roomId/workItemId`
9. [x] 历史恢复不再触发 `Maximum update depth exceeded`

## 兼容层保留项
1. `parseAgentIdFromSessionKey(...)` 仍保留在迁移/兼容层与少量旧直连路径中，用于老数据恢复，不再驱动主状态
2. OpenClaw adapter 内部仍会保留 provider-specific 的工作区路径和原生能力映射，但这些语义已不再泄漏到产品主视图
