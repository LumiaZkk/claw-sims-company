import type { GatewaySettingsQueryResult } from "../../../application/gateway/settings";
import type {
  CompanyAutonomyPolicy,
  CompanyHeartbeatPolicy,
  CompanyWorkspacePolicy,
} from "../../../domain/org/types";
import { ActionFormDialog } from "../../../ui/action-form-dialog";
import type { RunCommand } from "./settings-helpers";

export function SettingsDialogs(props: {
  executorDialogOpen: boolean;
  setExecutorDialogOpen: (open: boolean) => void;
  automationBudgetDialogOpen: boolean;
  setAutomationBudgetDialogOpen: (open: boolean) => void;
  heartbeatDialogOpen: boolean;
  setHeartbeatDialogOpen: (open: boolean) => void;
  workspacePolicyDialogOpen: boolean;
  setWorkspacePolicyDialogOpen: (open: boolean) => void;
  activeCompany: GatewaySettingsQueryResult["activeCompany"];
  autonomyPolicySaving: boolean;
  heartbeatPolicySaving: boolean;
  workspacePolicySaving: boolean;
  executorConfig: GatewaySettingsQueryResult["executorConfig"];
  telegramDialogOpen: boolean;
  setTelegramDialogOpen: (open: boolean) => void;
  providerKeyDialogOpen: boolean;
  setProviderKeyDialogOpen: (open: boolean) => void;
  providerKeyTarget: string | null;
  setProviderKeyTarget: (provider: string | null) => void;
  addProviderDialogOpen: boolean;
  setAddProviderDialogOpen: (open: boolean) => void;
  executorSaving: boolean;
  telegramSaving: boolean;
  providerKeySaving: boolean;
  addProviderSaving: boolean;
  handleExecutorConfigSubmit: (values: Record<string, string>) => Promise<{ title: string; description: string } | null>;
  handleUpdateAutonomyPolicy: (
    autonomyPolicy: CompanyAutonomyPolicy,
  ) => Promise<{ title: string; description: string } | null>;
  handleUpdateHeartbeatPolicy: (
    heartbeatPolicy: CompanyHeartbeatPolicy,
  ) => Promise<{ title: string; description: string } | null>;
  handleUpdateWorkspacePolicy: (
    workspacePolicy: CompanyWorkspacePolicy,
  ) => Promise<{ title: string; description: string } | null>;
  handleTelegramSubmit: (values: Record<string, string>) => Promise<{ title: string; description: string } | null>;
  onProviderKeySubmit: (provider: string | null, values: Record<string, string>) => Promise<{ title: string; description: string } | null>;
  handleAddProviderSubmit: (values: Record<string, string>) => Promise<{ title: string; description: string } | null>;
  runCommand: RunCommand;
}) {
  const {
    executorDialogOpen,
    setExecutorDialogOpen,
    automationBudgetDialogOpen,
    setAutomationBudgetDialogOpen,
    heartbeatDialogOpen,
    setHeartbeatDialogOpen,
    workspacePolicyDialogOpen,
    setWorkspacePolicyDialogOpen,
    activeCompany,
    autonomyPolicySaving,
    heartbeatPolicySaving,
    workspacePolicySaving,
    executorConfig,
    telegramDialogOpen,
    setTelegramDialogOpen,
    providerKeyDialogOpen,
    setProviderKeyDialogOpen,
    providerKeyTarget,
    setProviderKeyTarget,
    addProviderDialogOpen,
    setAddProviderDialogOpen,
    executorSaving,
    telegramSaving,
    providerKeySaving,
    addProviderSaving,
    handleExecutorConfigSubmit,
    handleUpdateAutonomyPolicy,
    handleUpdateHeartbeatPolicy,
    handleUpdateWorkspacePolicy,
    handleTelegramSubmit,
    onProviderKeySubmit,
    handleAddProviderSubmit,
    runCommand,
  } = props;

  return (
    <>
      <ActionFormDialog
        open={workspacePolicyDialogOpen}
        onOpenChange={setWorkspacePolicyDialogOpen}
        title="调整工作目录边界"
        description="工作目录默认以正式产品产物为真相源。这里控制执行器工作区镜像是否只做补位，以及执行结果先写工作区还是直接写交付区。"
        confirmLabel="保存工作目录边界"
        busy={workspacePolicySaving}
        fields={[
          {
            name: "disableProviderMirror",
            label: "关闭执行器工作区镜像补位（工作目录只读正式产物）",
            type: "checkbox",
            defaultValue:
              activeCompany?.orgSettings?.workspacePolicy?.providerMirrorMode === "disabled" ? "true" : "false",
          },
          {
            name: "writeDirectlyToDeliveryArtifacts",
            label: "执行结果直接沉淀到交付区，不先写执行器工作区",
            type: "checkbox",
            defaultValue:
              activeCompany?.orgSettings?.workspacePolicy?.executorWriteTarget === "delivery_artifacts"
                ? "true"
                : "false",
          },
        ]}
        onSubmit={async (values) => {
          if (!activeCompany) {
            return;
          }
          const result = await runCommand(
            () =>
              handleUpdateWorkspacePolicy({
                ...(activeCompany.orgSettings?.workspacePolicy ?? {}),
                deliverySource: "artifact_store",
                providerMirrorMode: values.disableProviderMirror === "true" ? "disabled" : "fallback",
                executorWriteTarget:
                  values.writeDirectlyToDeliveryArtifacts === "true"
                    ? "delivery_artifacts"
                    : "agent_workspace",
              }),
            "工作目录边界更新失败",
          );
          if (result) {
            setWorkspacePolicyDialogOpen(false);
          }
        }}
      />

      <ActionFormDialog
        open={automationBudgetDialogOpen}
        onOpenChange={setAutomationBudgetDialogOpen}
        title="调整自动化预算护栏"
        description="设置近 30 天 usage 成本的软上限。留空或填 0 表示关闭这条软护栏，只保留已有审批策略。"
        confirmLabel="保存预算护栏"
        busy={autonomyPolicySaving}
        fields={[
          {
            name: "automationMonthlyBudgetUsd",
            label: "近 30 天预算上限 (USD)",
            type: "text",
            required: false,
            defaultValue:
              typeof activeCompany?.orgSettings?.autonomyPolicy?.automationMonthlyBudgetUsd === "number" &&
              Number.isFinite(activeCompany.orgSettings.autonomyPolicy.automationMonthlyBudgetUsd) &&
              activeCompany.orgSettings.autonomyPolicy.automationMonthlyBudgetUsd > 0
                ? String(activeCompany.orgSettings.autonomyPolicy.automationMonthlyBudgetUsd)
                : "",
            placeholder: "例如: 25",
          },
        ]}
        onSubmit={async (values) => {
          if (!activeCompany) {
            return;
          }
          const rawValue = values.automationMonthlyBudgetUsd?.trim() ?? "";
          const parsedBudget = rawValue.length === 0 ? 0 : Number(rawValue);
          if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
            throw new Error("请输入大于等于 0 的预算金额。");
          }
          const result = await runCommand(
            () =>
              handleUpdateAutonomyPolicy({
                ...(activeCompany.orgSettings?.autonomyPolicy ?? {}),
                automationMonthlyBudgetUsd: parsedBudget,
              }),
            "自动化预算护栏更新失败",
          );
          if (result) {
            setAutomationBudgetDialogOpen(false);
          }
        }}
      />

      <ActionFormDialog
        open={heartbeatDialogOpen}
        onOpenChange={setHeartbeatDialogOpen}
        title="调整 CEO heartbeat"
        description="业务 heartbeat 的权威配置保留在当前系统里。这里控制后台定时巡检是否启用、是否暂停、以及默认巡检频率。"
        confirmLabel="保存 heartbeat 策略"
        busy={heartbeatPolicySaving}
        fields={[
          {
            name: "enabled",
            label: "启用后台定时巡检",
            type: "checkbox",
            defaultValue: activeCompany?.orgSettings?.heartbeatPolicy?.enabled === false ? "false" : "true",
          },
          {
            name: "paused",
            label: "暂时暂停后台定时巡检（保留配置）",
            type: "checkbox",
            defaultValue: activeCompany?.orgSettings?.heartbeatPolicy?.paused ? "true" : "false",
          },
          {
            name: "intervalMinutes",
            label: "巡检周期（分钟）",
            type: "text",
            required: true,
            defaultValue: String(activeCompany?.orgSettings?.heartbeatPolicy?.intervalMinutes ?? 5),
            placeholder: "例如: 5",
          },
          {
            name: "syncTarget",
            label: "同步到 OpenClaw 作为执行/唤醒层",
            type: "checkbox",
            defaultValue:
              activeCompany?.orgSettings?.heartbeatPolicy?.syncTarget === "none" ? "false" : "true",
          },
        ]}
        onSubmit={async (values) => {
          if (!activeCompany) {
            return;
          }
          const rawInterval = values.intervalMinutes?.trim() ?? "";
          const parsedInterval = Number(rawInterval);
          if (!Number.isFinite(parsedInterval) || parsedInterval < 1) {
            throw new Error("请输入大于等于 1 的巡检周期。");
          }
          const result = await runCommand(
            () =>
              handleUpdateHeartbeatPolicy({
                ...(activeCompany.orgSettings?.heartbeatPolicy ?? {}),
                enabled: values.enabled !== "false",
                paused: values.paused === "true",
                intervalMinutes: Math.max(1, Math.floor(parsedInterval)),
                sourceOfTruth: "cyber_company",
                syncTarget: values.syncTarget === "false" ? "none" : "openclaw",
              }),
            "CEO heartbeat 策略更新失败",
          );
          if (result) {
            setHeartbeatDialogOpen(false);
          }
        }}
      />

      <ActionFormDialog
        open={executorDialogOpen}
        onOpenChange={setExecutorDialogOpen}
        title="更新下游 OpenClaw 执行器"
        description="浏览器只连接 Authority。这里配置的是 Authority 内部挂接的 OpenClaw 地址和令牌；如果下游需要 operator 权限，这里的 token 需要先配好。"
        confirmLabel="保存并重连执行器"
        busy={executorSaving}
        fields={[
          {
            name: "openclawUrl",
            label: "OpenClaw URL",
            type: "text",
            required: true,
            defaultValue: executorConfig?.openclaw.url ?? "",
            placeholder: "例如: ws://127.0.0.1:18789",
          },
          {
            name: "openclawToken",
            label: "OpenClaw Token",
            type: "password",
            required: false,
            placeholder: executorConfig?.openclaw.tokenConfigured ? "留空表示保持原 token 不变" : "未配置时这里基本是必填",
          },
        ]}
        onSubmit={async (values) => {
          const result = await runCommand(
            () => handleExecutorConfigSubmit(values),
            "执行后端配置失败",
          );
          if (result) {
            setExecutorDialogOpen(false);
          }
        }}
      />

      <ActionFormDialog
        open={telegramDialogOpen}
        onOpenChange={setTelegramDialogOpen}
        title="打通 Telegram 通道"
        description="填入机器人令牌，赛博公司底层将即时接管 Telegram 流量通信并分发响应。"
        confirmLabel="装载配置并重启网络"
        busy={telegramSaving}
        fields={[
          {
            name: "botToken",
            label: "Bot Token",
            type: "password",
            required: true,
            placeholder: "例如: 123456789:ABCDE...",
          },
        ]}
        onSubmit={async (values) => {
          const result = await runCommand(
            () => handleTelegramSubmit(values),
            "Telegram 配置失败",
          );
          if (result) {
            setTelegramDialogOpen(false);
          }
        }}
      />

      <ActionFormDialog
        open={providerKeyDialogOpen}
        onOpenChange={setProviderKeyDialogOpen}
        title={`更新 ${providerKeyTarget || ""} 鉴权密钥`}
        description="系统底层将更新此算力通道的 API Key。此操作仅替换配置，尚未生效至具体特工。"
        confirmLabel="装载专属密钥"
        busy={providerKeySaving}
        fields={[
          {
            name: "apiKey",
            label: "API Key",
            type: "password",
            required: true,
            placeholder: "例如: sk-xxxxxxxxxxxxxxxx",
          },
        ]}
        onSubmit={async (values) => {
          const result = await runCommand(
            () => onProviderKeySubmit(providerKeyTarget, values),
            "供应商密钥更新失败",
          );
          if (result) {
            setProviderKeyDialogOpen(false);
            setProviderKeyTarget(null);
          }
        }}
      />

      <ActionFormDialog
        open={addProviderDialogOpen}
        onOpenChange={setAddProviderDialogOpen}
        title="添加自定义模型供应商"
        description="系统底层将挂载新的算力连通渠道，支持兼容标准 OpenAI Base URL 的第三方提货商中转。"
        confirmLabel="注册集成通道"
        busy={addProviderSaving}
        fields={[
          {
            name: "providerName",
            label: "供应商标识 (Provider Name)",
            type: "text",
            required: true,
            placeholder: "例如: openai, openrouter, deepseek, ali...",
          },
          {
            name: "baseUrl",
            label: "代理端点 (Base URL) - 选填",
            type: "text",
            required: false,
            placeholder: "例如: https://api.deepseek.com/v1",
          },
          {
            name: "apiKey",
            label: "授权令牌 (API Key)",
            type: "password",
            required: true,
            placeholder: "例如: sk-xxxxxxxx",
          },
        ]}
        onSubmit={async (values) => {
          const result = await runCommand(
            () => handleAddProviderSubmit(values),
            "新增供应商失败",
          );
          if (result) {
            setAddProviderDialogOpen(false);
          }
        }}
      />
    </>
  );
}
