# Requirement Center Acceptance Checklists

Status: Active  
Last updated: 2026-03-14

## 1. User Journey Checklist

- 从 CEO 首页输入模糊需求后，可以进入 CEO 深聊
- CEO 深聊形成主线后，出现“已收敛需求卡”
- 用户可以从卡片直接进入需求中心
- 用户不需要先理解 Board / Ops / Workspace 的区别，也能继续推进

## 2. Page Consistency Checklist

- 需求中心展示的 owner / stage / nextAction 与当前主线一致
- Board、需求中心、需求房、Workspace 不出现主线漂移
- 刷新后当前主线仍保持一致
- 主线时间线可以看到 promotion / progress / acceptance / reopen 的连续记录

## 3. Requirement Stability Checklist

- 无关会话更新不会切换当前主线
- 远程 chat / company event 只作为 evidence 入站
- 需求中心不会因为异步补账而整块卸载
- company events 补账按增量进行，不会持续扫全量历史

## 4. Room Transparency Checklist

- 群发消息能看出派给了哪些成员
- 成员回复能看出来自谁
- 已回流消息能尽量关联到 dispatch
- 用户不会把房间误解为单一 provider 群线程

## 5. Acceptance Loop Checklist

- 执行完成后不会静默结束，必须进入“待你验收”
- 发起验收前能看到交付物、来源链路、规则校验结果、知识/验收摘要和 Workspace closeout 当前状态
- 如果缺少交付证据或 closeout 阻塞，发起验收条件会明确显示原因
- 如果只有提醒项，验收区会明确告诉用户“可继续但需说明”，而不是静默放行
- 验收通过后显示“已完成”
- 继续修改后返回执行态
- 驳回重开后返回执行态
- 继续修改和驳回重开都不会创建第二条 primary requirement
- 发起验收、验收通过、驳回重开会立即反映到主线时间线
- 规则校验结果会显示最近报告、锚点覆盖和待补齐锚点
- 知识与验收摘要会显示最近可复用的知识卡片或验收总结，而不是只留在 Workspace 正文里

## 6. Ops Recovery Checklist

- 需求中心可直接进入 Ops
- Ops 排障后可以返回需求中心
- 恢复当前阻塞不会切换主线
