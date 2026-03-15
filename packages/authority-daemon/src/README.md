# Authority Daemon 目录地图

`authority-daemon` 现在按上下文整理为以下目录：

- `system/`
  - 进程入口后的组装、HTTP/WS、control route、ops CLI、后台任务。
- `company/`
  - 公司创建、切换、删除、公司状态、workspace bootstrap、公司级 ops 编排、公司配置 store、公司事件 store。
- `agent/`
  - 员工 agent 会话、聊天命令、聊天 service、agent file、session status repair、agent runtime 补偿逻辑。
- `collaboration/`
  - requirement / mission / room / dispatch / artifact / decision ticket 的 authority canonical runtime 与 command 路由。
- `executor/`
  - OpenClaw bridge、gateway proxy、managed file mirror、executor config/status、native integration、executor state store。
- `persistence/`
  - SQLite schema、SQLite 打开逻辑、shared helper、repository façade。

根目录只保留兼容入口：

- `server.ts`
- `ops-cli.ts`

## 改动指引

- 改 HTTP 路由注册或返回格式：
  - 先看 `system/authority-route-registry.ts`
  - 再看对应上下文的 `*-routes.ts`
- 改公司生命周期、招聘、删除、切换公司：
  - 看 `company/`
- 改员工 agent 会话、聊天发送、session 修复、agent file：
  - 看 `agent/`
- 改 requirement、mission、dispatch、room、artifact、decision runtime：
  - 看 `collaboration/`
- 改 OpenClaw、gateway、executor 状态、native stream：
  - 看 `executor/`
- 改 SQLite schema、持久化读写、event/session/file 存储：
  - 先看对应领域目录下的 `*store.ts`
  - 再看 `persistence/` 下的 schema / sqlite / façade

## 约束

- 不要把业务逻辑重新放回 `system/authority-app.ts`。
- 不要让 `persistence/` 直接调用 OpenClaw bridge。
- 不要让 `executor/` 持有公司级 policy。
- 不要新增“跨域总仓库”文件；优先把 store 落到领域目录。
- 员工 agent 与协作是当前 backend 的核心域；新需求先判断是否属于这两类，再决定是否落到 `company/` 或 `executor/`。
- 新功能优先先判断归属上下文，再落文件。
