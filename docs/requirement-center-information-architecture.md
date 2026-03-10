# Requirement Center Information Architecture

Status: Draft  
Last updated: 2026-03-10

## Goal

把当前 `CEO / Board / Ops / 需求房 / Workspace` 的分散体验，收敛为“发起 -> 收敛 -> 推进 -> 交付 -> 验收”的单条用户路径。

## Top-level Structure

- CEO 首页
  - 只负责发起需求
  - 用户问题：我要说什么目标
- CEO 深聊
  - 只负责澄清与收敛
  - 用户问题：这件事到底要做什么
- 需求中心
  - 当前唯一主中枢
  - 用户问题：现在做到哪了、谁负责、我下一步点哪里
- Ops
  - 异常与排障中心
  - 用户问题：为什么卡住了、谁没回复、哪里超时了
- Workspace
  - 交付物视图
  - 用户问题：结果在哪里、质量怎么样

## Requirement Center Structure

- 需求摘要区
  - 标题
  - 当前状态
  - 当前负责人
  - 当前阶段
  - 下一步
- 执行区
  - 当前任务顺序
  - 当前执行状态
  - 已完成/总步骤
- 协作区
  - 需求房入口
  - 最近协作回流
  - 派单透明信息
- 交付区
  - 最近文件
  - 产物镜像
  - 打开 Workspace 的入口
- 验收区
  - 待你验收
  - 验收通过
  - 继续修改
  - 驳回重开
- 排障入口
  - 恢复当前阻塞
  - 打开 Ops

## Page Responsibility Rules

- CEO 首页不能承载执行细节
- CEO 深聊不能承载最终交付查看
- 需求中心不能承载完整排障细节
- Ops 不承担主线叙事
- Workspace 不承担立项和派单入口

## Navigation Rules

- CEO 深聊一旦形成主线，必须出现明确入口去需求中心
- 需求中心必须始终提供：
  - 去协作
  - 看交付
  - 去排障
  - 打开负责人
- Ops 排障后必须能返回需求中心继续推进

## State Source Rule

- 前台“当前主线”统一建立在 `RequirementAggregate` 上
- Board、需求中心、Workspace、需求房只能读取这条主线投影
- OpenClaw / Gateway 提供执行与证据，不直接决定前台主线归属
