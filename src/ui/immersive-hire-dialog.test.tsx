// @vitest-environment jsdom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { AgentTemplateDefinition } from "../domain/org/types";
import { ImmersiveHireDialog, type HireConfig } from "./immersive-hire-dialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
}

if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0)) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((handle: number) => clearTimeout(handle)) as typeof cancelAnimationFrame;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderDialog(props: Partial<React.ComponentProps<typeof ImmersiveHireDialog>> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn();
  const onOpenChange = props.onOpenChange ?? vi.fn();

  act(() => {
    root!.render(
      <ImmersiveHireDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        busy={false}
        templates={[]}
        companyId="company-1"
        {...props}
      />,
    );
  });

  return { onSubmit, onOpenChange };
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement | HTMLTextAreaElement;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
}

async function inputText(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    setNativeValue(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function clickElement(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  expect(element).not.toBeNull();
  return element as T;
}

function requireButton(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(label),
  );
  expect(button).not.toBeUndefined();
  return button as HTMLButtonElement;
}

function getTraitsTextarea() {
  return requireElement<HTMLTextAreaElement>(
    'textarea[placeholder*="说话应当简短有力"]',
  );
}

describe("ImmersiveHireDialog", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("submits a blank hire flow without template selection", async () => {
    const onSubmit = vi.fn<(_: HireConfig) => Promise<void>>().mockResolvedValue(undefined);
    renderDialog({ onSubmit, templates: [], companyId: "company-1" });

    await inputText(
      requireElement<HTMLInputElement>('input[placeholder="例如：主前端架构师"]'),
      "Compliance Officer",
    );
    await inputText(
      requireElement<HTMLTextAreaElement>('textarea[placeholder*="描述该节点应当处理"]'),
      "负责制度审查与风险控制",
    );

    expect(requireButton("进入下一环").disabled).toBe(false);
    await clickElement(requireButton("进入下一环"));
    await clickElement(requireButton("进入下一环"));
    await inputText(getTraitsTextarea(), "严谨、审慎、边界清晰");
    await clickElement(requireButton("部署节点"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      role: "Compliance Officer",
      description: "负责制度审查与风险控制",
      modelTier: "standard",
      budget: 5,
      traits: "严谨、审慎、边界清晰",
      templateSelection: {
        templateId: null,
        sourceType: "blank",
      },
    });
  });

  it("applies a matched template and submits template-backed hire config", async () => {
    const onSubmit = vi.fn<(_: HireConfig) => Promise<void>>().mockResolvedValue(undefined);
    const template: AgentTemplateDefinition = {
      id: "template-growth-strategist",
      title: "Growth Strategist",
      summary: "负责增长实验与渠道评估。",
      roleFamily: "growth",
      tags: ["growth"],
      domainTags: [],
      collaborationTags: [],
      defaultTraits: "数据驱动、结构化沟通",
      recommendedModelTier: "reasoning",
      defaultBudgetUsd: 12,
      status: "ready",
      updatedAt: 1,
    };

    renderDialog({
      onSubmit,
      templates: [template],
      companyId: "company-1",
    });

    await inputText(
      requireElement<HTMLInputElement>('input[placeholder="例如：主前端架构师"]'),
      "Growth Strategist",
    );
    await inputText(
      requireElement<HTMLTextAreaElement>('textarea[placeholder*="描述该节点应当处理"]'),
      "负责增长实验与渠道评估",
    );

    expect(document.body.textContent).toContain("Growth Strategist");
    expect(document.body.textContent).toContain("匹配");

    await clickElement(requireButton("应用模板"));
    expect(document.body.textContent).toContain("已应用模板");

    await clickElement(requireButton("进入下一环"));
    expect(
      requireElement<HTMLInputElement>('input[name="modelTier"][value="reasoning"]').checked,
    ).toBe(true);
    expect(document.body.textContent).toContain("$12.00");

    await clickElement(requireButton("进入下一环"));
    expect(getTraitsTextarea().value).toBe("数据驱动、结构化沟通");

    await clickElement(requireButton("部署节点"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0]![0];
    expect(submitted.role).toBe("Growth Strategist");
    expect(submitted.description).toBe("负责增长实验与渠道评估");
    expect(submitted.modelTier).toBe("reasoning");
    expect(submitted.budget).toBe(12);
    expect(submitted.traits).toBe("数据驱动、结构化沟通");
    expect(submitted.templateSelection).toEqual(
      expect.objectContaining({
        templateId: "template-growth-strategist",
        sourceType: "template",
        match: expect.objectContaining({
          templateId: "template-growth-strategist",
        }),
      }),
    );
  });
});
