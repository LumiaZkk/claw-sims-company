# CTO Workspace Skill Contract

Status: Active  
Last updated: 2026-03-13

## 1. 目的

这份文档定义 CTO 在 agent workspace 中编写真实 Skill 脚本时，需要遵守的输入输出契约。

目标只有两个：

- 让脚本拿到**稳定、可复用**的平台上下文，而不是每次临时猜参数
- 让平台能够把脚本输出稳定写回 `Resource`，并进入 `SkillRun` 台账

## 2. 输入契约

平台会把一个 JSON 字符串注入到环境变量：

- `CYBER_COMPANY_SKILL_INPUT_JSON`

脚本需要自己读取并解析这个 JSON。

当前版本：

- `version: 1`

### 2.1 输入结构

```json
{
  "version": 1,
  "requestedAt": 1760000000000,
  "company": {
    "id": "company-1",
    "name": "小说公司",
    "template": "novel"
  },
  "skill": {
    "id": "reader.build-index",
    "title": "重建阅读索引",
    "summary": "把正文、设定和报告重新整理成阅读器可直接消费的资源清单。",
    "entryPath": "scripts/build-reader-index.ts",
    "allowedTriggers": ["app_action"],
    "writesResourceTypes": ["document", "report"],
    "manifestActionIds": ["trigger-reader-index"],
    "appIds": ["app:reader"]
  },
  "app": {
    "id": "app:reader",
    "slug": "reader",
    "title": "小说阅读器",
    "template": "reader",
    "surface": "template",
    "manifestArtifactId": "workspace-app-manifest:company-1:app:reader"
  },
  "manifest": {
    "appId": "app:reader",
    "appSlug": "reader",
    "title": "小说阅读器 AppManifest",
    "draft": false,
    "sectionIds": ["reader-content", "reader-reference", "reader-reports"],
    "actionIds": ["trigger-reader-index", "report-reader-issue"]
  },
  "workItem": {
    "id": "work-1"
  },
  "trigger": {
    "type": "app_action",
    "actionId": "trigger-reader-index",
    "label": "小说阅读器",
    "requestedByActorId": "coo-1",
    "requestedByLabel": "COO"
  },
  "resources": {
    "count": 3,
    "byType": [
      { "resourceType": "document", "count": 2 },
      { "resourceType": "report", "count": 1 }
    ],
    "entries": [
      {
        "key": "cto-1:chapter-1.md",
        "artifactId": "artifact-1",
        "name": "第1章.md",
        "path": "chapters/chapter-1.md",
        "resourceType": "document",
        "tags": ["story.chapter", "company.resource"]
      }
    ]
  }
}
```

### 2.2 输入使用规则

- `resources.entries` 是**平台当前允许这个 skill 看到的资源范围**，不是全公司所有文件。
- `tags` 是内部语义槽位，脚本可以依赖它筛选资源，但不要把它直接显示成前台文案。
- `app / manifest / workItem` 可能为 `null`，脚本必须兼容空值。
- `resources.entries` 默认只给资源元信息，不直接给全文内容；脚本如需读文件，需要根据 `path` 自己读 workspace 文件。

## 3. 输出契约

脚本成功时，推荐向 stdout 输出一段 JSON。  
平台会尝试把 stdout 解析成结构化结果。

当前版本：

- `version: 1`

### 3.1 输出结构

```json
{
  "version": 1,
  "runSummary": "已构建正式资源",
  "successTitle": "脚本已执行",
  "successDetail": "本次运行来自 workspace 脚本。",
  "bindAppManifestArtifactId": "workspace-app-manifest:company-1:app:reader",
  "resources": [
    {
      "id": "resource:reader-index",
      "title": "章节索引",
      "kind": "skill_result",
      "status": "ready",
      "summary": "脚本已生成章节索引。",
      "content": "# 章节索引",
      "resourceType": "document",
      "resourceTags": ["story.chapter"],
      "source": {
        "name": "reader-index.md",
        "path": "out/reader-index.md"
      }
    }
  ]
}
```

### 3.2 输出使用规则

- `resources` 是推荐字段；`artifacts` 仍兼容，但不再建议新增使用。
- `resourceType` 必须是平台支持的类型之一：
  - `document`
  - `report`
  - `dataset`
  - `media`
  - `state`
  - `tool`
  - `other`
- `resourceTags` 会和平台自己的标签合并，不需要脚本重复写：
  - `company.resource`
  - `tech.skill-result`
  - `skill.{skillId}`
  - `app.{appId}`
- `bindAppManifestArtifactId` 只在脚本本次产出的是新的 `AppManifest` 时使用。

## 4. 平台回退规则

如果 stdout 不是可解析 JSON，或者没有返回 `resources`：

- 平台仍会保留这次 `SkillRun`
- 平台会生成一份通用 `skill_result` 记录 stdout / stderr
- 平台不会因为解析失败就吞掉这次执行

这条规则的目的，是让 CTO 可以先把脚本跑通，再逐步升级为结构化输出。

## 5. 最小示例

### JavaScript / TypeScript

```ts
const input = JSON.parse(process.env.CYBER_COMPANY_SKILL_INPUT_JSON || "{}");

console.log(
  JSON.stringify({
    version: 1,
    runSummary: `已处理 ${input.resources?.count ?? 0} 份资源`,
    successTitle: "脚本已执行",
    successDetail: "本次运行来自 workspace 脚本。",
    resources: [
      {
        title: "Skill 结果",
        kind: "skill_result",
        resourceType: "report",
        resourceTags: ["qa.report"],
        content: "# 执行结果\n\n脚本已完成。",
        source: {
          name: "skill-output.md",
          path: "out/skill-output.md"
        }
      }
    ]
  }),
);
```

### Python

```python
import json
import os

input_data = json.loads(os.environ.get("CYBER_COMPANY_SKILL_INPUT_JSON", "{}"))

print(json.dumps({
    "version": 1,
    "runSummary": f"已处理 {input_data.get('resources', {}).get('count', 0)} 份资源",
    "successTitle": "脚本已执行",
    "successDetail": "本次运行来自 workspace 脚本。",
    "resources": [
        {
            "title": "Skill 结果",
            "kind": "skill_result",
            "resourceType": "report",
            "resourceTags": ["qa.report"],
            "content": "# 执行结果\n\n脚本已完成。",
            "source": {
                "name": "skill-output.md",
                "path": "out/skill-output.md"
            }
        }
    ]
}))
```

## 6. 设计边界

- 这个 contract 解决的是“脚本怎么接平台”，不是“脚本怎么做业务判断”。
- 业务语义应尽量落在：
  - `resourceType`
  - `tags`
  - `AppManifest`
  - 模板体验层
- 不允许因为换业务场景就再发明一套新的脚本输入输出主模型。
