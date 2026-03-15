// @vitest-environment jsdom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { ApprovalRecord } from "../../../domain/governance/types";
import type { HireConfig } from "../../../ui/immersive-hire-dialog";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { useLobbyPageState } from "./useLobbyPageState";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HookState = ReturnType<typeof useLobbyPageState>;

type MockCommands = {
  buildBlueprintText: ReturnType<typeof vi.fn>;
  syncKnowledge: ReturnType<typeof vi.fn>;
  hireEmployee: ReturnType<typeof vi.fn>;
  updateRole: ReturnType<typeof vi.fn>;
  fireEmployee: ReturnType<typeof vi.fn>;
  resolveApproval: ReturnType<typeof vi.fn>;
  assignQuickTask: ReturnType<typeof vi.fn>;
  buildGroupChatRoute: ReturnType<typeof vi.fn>;
  recoverCommunication: ReturnType<typeof vi.fn>;
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let hookState: HookState | null = null;

function createCommands(overrides: Partial<MockCommands> = {}): MockCommands {
  return {
    buildBlueprintText: vi.fn(() => "blueprint"),
    syncKnowledge: vi.fn().mockResolvedValue(0),
    hireEmployee: vi.fn().mockResolvedValue("agent-1"),
    updateRole: vi.fn().mockResolvedValue(true),
    fireEmployee: vi.fn().mockResolvedValue({ mode: "executed" }),
    resolveApproval: vi.fn().mockImplementation(async (approval: ApprovalRecord) => approval),
    assignQuickTask: vi.fn().mockResolvedValue(true),
    buildGroupChatRoute: vi.fn().mockResolvedValue("/chat/group"),
    recoverCommunication: vi.fn().mockResolvedValue({
      requestsAdded: 0,
      requestsUpdated: 0,
      tasksRecovered: 0,
      handoffsRecovered: 0,
    }),
    ...overrides,
  };
}

function HookHarness(props: {
  activeCompanyId: string;
  commands: MockCommands;
  ceoAgentId: string | null;
}) {
  hookState = useLobbyPageState(props);
  return null;
}

function renderHarness(commands: MockCommands) {
  act(() => {
    root!.render(
      <HookHarness activeCompanyId="company-1" commands={commands} ceoAgentId="ceo-1" />,
    );
  });
}

describe("useLobbyPageState", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    hookState = null;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    hookState = null;
    vi.clearAllMocks();
  });

  it("closes the hire dialog and navigates to chat after a successful hire", async () => {
    const commands = createCommands({
      hireEmployee: vi.fn().mockResolvedValue("agent-growth-1"),
    });
    renderHarness(commands);

    await act(async () => {
      hookState!.setHireDialogOpen(true);
    });
    expect(hookState!.hireDialogOpen).toBe(true);

    const config: HireConfig = {
      role: "Growth Strategist",
      description: "负责增长实验与渠道评估",
      modelTier: "reasoning",
      budget: 12,
      traits: "数据驱动",
      templateSelection: {
        templateId: "template-growth-strategist",
        sourceType: "template",
      },
    };

    await act(async () => {
      await hookState!.handleHireSubmit(config);
    });

    expect(commands.hireEmployee).toHaveBeenCalledWith(config);
    expect(hookState!.hireDialogOpen).toBe(false);
    expect(navigateMock).toHaveBeenCalledWith("/chat/agent-growth-1");
  });

  it("keeps the hire dialog open when no agent id is returned", async () => {
    const commands = createCommands({
      hireEmployee: vi.fn().mockResolvedValue(null),
    });
    renderHarness(commands);

    await act(async () => {
      hookState!.setHireDialogOpen(true);
    });

    await act(async () => {
      await hookState!.handleHireSubmit({
        role: "Compliance Officer",
        description: "负责制度审查与风险控制",
        modelTier: "standard",
        budget: 5,
        traits: "",
        templateSelection: {
          templateId: null,
          sourceType: "blank",
        },
      });
    });

    expect(hookState!.hireDialogOpen).toBe(true);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
