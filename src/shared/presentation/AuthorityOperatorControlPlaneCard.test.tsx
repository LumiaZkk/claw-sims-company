import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthorityOperatorControlPlaneCard } from "./AuthorityOperatorControlPlaneCard";

describe("AuthorityOperatorControlPlaneCard", () => {
  it("renders the operator control plane summary, commands, and action buttons", () => {
    const html = renderToStaticMarkup(
      <AuthorityOperatorControlPlaneCard
        model={{
          title: "恢复 / 导入 / 手工修复入口",
          summary: "所有 restore / import / manual recovery 都应该在 Connect 或 Settings Doctor 里判断并发起。",
          detail: "schema v1 · 标准备份 2 份",
          entries: [
            {
              id: "doctor",
              title: "先跑 Authority Doctor",
              summary: "先确认控制面状态。",
              command: "npm run authority:doctor",
              actionLabel: "运行 doctor",
            },
            {
              id: "restore-plan",
              title: "恢复前先看 plan",
              summary: "不要在业务页里直接手工补写。",
              command: "npm run authority:restore -- --latest --plan",
              actionLabel: "查看 restore plan",
            },
            {
              id: "restore-apply",
              title: "确认 plan 后再正式恢复",
              summary: "会覆盖当前 authority SQLite。",
              command: "npm run authority:restore -- --latest --force",
              actionLabel: "正式恢复 latest 备份",
              confirmationTitle: "确认正式恢复 Authority",
              confirmationDescription: "会先生成 safety backup。",
              confirmationText: "RESTORE",
            },
          ],
        }}
        onExecuteEntry={vi.fn()}
      />,
    );

    expect(html).toContain("恢复 / 导入 / 手工修复入口");
    expect(html).toContain("Connect 或 Settings Doctor");
    expect(html).toContain("npm run authority:doctor");
    expect(html).toContain("npm run authority:restore -- --latest --plan");
    expect(html).toContain("npm run authority:restore -- --latest --force");
    expect(html).toContain("运行 doctor");
    expect(html).toContain("正式恢复 latest 备份");
  });
});
