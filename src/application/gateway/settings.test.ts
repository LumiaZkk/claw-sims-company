import { describe, expect, it } from "vitest";
import { buildGatewayRefreshIssue } from "./settings";

describe("buildGatewayRefreshIssue", () => {
  it("downgrades optional missing-scope failures to a warning", () => {
    const issue = buildGatewayRefreshIssue([
      {
        id: "companyEvents",
        label: "最近巡检审计",
        message: "{\"error\":\"missing scope: operator.read\"}",
        required: false,
      },
      {
        id: "skills",
        label: "技能状态",
        message: "missing scope: operator.admin",
        required: false,
      },
    ]);

    expect(issue).toMatchObject({
      severity: "warning",
      message:
        "部分扩展诊断暂时不可用：最近巡检审计、技能状态。下游 OpenClaw 尚未授予 operator.read 权限。",
    });
  });

  it("downgrades core permission failures to a warning", () => {
    const issue = buildGatewayRefreshIssue([
      {
        id: "status",
        label: "Authority 状态",
        message: "missing scope: operator.read",
        required: true,
      },
      {
        id: "models",
        label: "模型目录",
        message: "network timeout",
        required: false,
      },
    ]);

    expect(issue).toMatchObject({
      severity: "warning",
      message:
        "部分核心诊断受当前 OpenClaw 权限限制：Authority 状态。下游 OpenClaw 尚未授予 operator.read 权限。",
    });
  });

  it("keeps non-permission core failures as blocking errors", () => {
    const issue = buildGatewayRefreshIssue([
      {
        id: "configSnapshot",
        label: "配置快照",
        message: "upstream timeout",
        required: true,
      },
    ]);

    expect(issue).toMatchObject({
      severity: "error",
      message: "设置页核心数据刷新失败：配置快照。upstream timeout",
    });
  });

  it("returns null when every refresh request succeeds", () => {
    expect(buildGatewayRefreshIssue([])).toBeNull();
  });
});
