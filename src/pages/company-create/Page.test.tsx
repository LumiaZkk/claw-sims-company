// @vitest-environment jsdom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

const {
  navigateMock,
  useCompanyCreateAppMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useCompanyCreateAppMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../application/company/create-company", () => ({
  useCompanyCreateApp: (input: unknown) => useCompanyCreateAppMock(input),
}));

vi.mock("../../system/toast-store", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import { CompanyCreatePresentationPage } from "./Page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderPage() {
  act(() => {
    root!.render(<CompanyCreatePresentationPage />);
  });
}

function requireButton(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(label),
  );
  expect(button).not.toBeUndefined();
  return button as HTMLButtonElement;
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
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

describe("CompanyCreatePresentationPage", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useCompanyCreateAppMock.mockImplementation(() => ({
      creationError: null,
      creationProgress: {
        current: 0,
        message: "等待开始...",
        history: [],
      },
      creationTotalSteps: 4,
      handleCreate: vi.fn().mockResolvedValue(null),
      isCreating: false,
    }));
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows blueprint parse errors and keeps submit disabled for invalid content", async () => {
    renderPage();

    await clickElement(requireButton("从蓝图导入"));
    await inputText(
      document.querySelector('textarea[placeholder*="粘贴 blueprint.v1 JSON"]') as HTMLTextAreaElement,
      "{ invalid json",
    );

    expect(document.body.textContent).toContain("蓝图无法解析");
    expect(requireButton("创建并进入").disabled).toBe(true);
  });

  it("accepts a valid blueprint flow and navigates to runtime after creation", async () => {
    vi.useFakeTimers();
    const handleCreateMock = vi.fn().mockResolvedValue({
      companyId: "company-2",
      companyName: "Blueprint Studio",
      warnings: [],
    });
    useCompanyCreateAppMock.mockImplementation(() => ({
      creationError: null,
      creationProgress: {
        current: 0,
        message: "等待开始...",
        history: [],
      },
      creationTotalSteps: 4,
      handleCreate: handleCreateMock,
      isCreating: false,
    }));

    renderPage();

    await clickElement(requireButton("从蓝图导入"));
    await inputText(
      document.querySelector('input[placeholder="公司名称（可选）"]') as HTMLInputElement,
      "Blueprint Studio",
    );

    const blueprintText = JSON.stringify({
      kind: "cyber-company.blueprint.v1",
      sourceCompanyName: "Source Co",
      template: "blank",
      icon: "🏢",
      description: "Blueprint import",
      exportedAt: 1,
      employees: [
        {
          blueprintId: "member:1",
          nickname: "Ops",
          role: "Ops Coordinator",
          isMeta: false,
        },
      ],
      departments: [],
      quickPrompts: [],
      automations: [],
      knowledgeItems: [],
    });

    await inputText(
      document.querySelector('textarea[placeholder*="粘贴 blueprint.v1 JSON"]') as HTMLTextAreaElement,
      blueprintText,
    );

    expect(document.body.textContent).toContain("已解析：1 名成员，0 个部门。");
    expect(requireButton("创建并进入").disabled).toBe(false);

    await clickElement(requireButton("创建并进入"));
    await act(async () => {
      await Promise.resolve();
    });

    expect(handleCreateMock).toHaveBeenCalledTimes(1);
    expect(useCompanyCreateAppMock).toHaveBeenLastCalledWith({
      companyName: "Blueprint Studio",
      mode: "blueprint",
      blueprintText,
    });
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "公司创建完成",
      "「Blueprint Studio」已上线。",
    );

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(navigateMock).toHaveBeenCalledWith("/runtime");
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
