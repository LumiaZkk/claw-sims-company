import { describe, expect, it } from "vitest";
import {
  isInternalAssistantMonologueText,
  normalizeTruthText,
  stripTruthInternalMonologue,
} from "./message-truth";

describe("message truth filtering", () => {
  it("drops pure internal assistant monologue", () => {
    const text =
      "**Reviewing SOUL.md** I need to review my SOUL.md to understand my role. Let me check my identity and confirm my role.";

    expect(isInternalAssistantMonologueText(text)).toBe(true);
    expect(stripTruthInternalMonologue(text)).toBe("");
    expect(normalizeTruthText(text)).toBe("");
  });

  it("keeps the user-facing answer and strips the internal prelude", () => {
    const text = [
      "**Reviewing SOUL.md** I need to review my SOUL.md to understand my role.",
      "Let me check the current status: The boss is now asking whether I still remember what I do.",
      "【当前状态】我是赛博公司 CEO，只负责拆解、派单、验收、汇报。",
      "## 📋 任务追踪",
      "- [/] 1. CEO 整合最终执行方案并交付老板",
    ].join("\n\n");

    expect(isInternalAssistantMonologueText(text)).toBe(false);
    expect(stripTruthInternalMonologue(text).startsWith("【当前状态】")).toBe(true);
    expect(normalizeTruthText(text)).toBe("【当前状态】我是赛博公司 CEO，只负责拆解、派单、验收、汇报。");
  });
});
