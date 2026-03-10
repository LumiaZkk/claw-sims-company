import { useMemo, useState } from "react";
import { persistCompanyConfig } from "./config";
import { useCompanyShellCommands, useCompanyShellQuery } from "./shell";
import { parseCompanyBlueprint } from "./blueprint";
import { COMPANY_TEMPLATES } from "./templates";
import { gateway } from "../gateway";
import {
  allocateCompanyAgentNamespace,
  buildCompanyRoleAgentName,
  collectExistingAgentHandles,
} from "../../domain/org/agent-naming";
import {
  generateCeoSoul,
  generateCooSoul,
  generateCtoSoul,
  generateHrSoul,
} from "../../domain/org/meta-agent-souls";
import type { Company, Department, EmployeeRef, CyberCompanyConfig } from "../../domain/org/types";

export const BLUEPRINT_TEMPLATE_ID = "__blueprint__";
const META_DEPARTMENT_NAMES = new Set(["管理中枢", "人力资源部", "技术部", "运营部"]);

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useCompanyCreateApp(input: {
  companyName: string;
  blueprintText: string;
  selectedTemplate: string;
}) {
  const { config } = useCompanyShellQuery();
  const { loadConfig } = useCompanyShellCommands();
  const creationTotalSteps = 8;
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [creationProgress, setCreationProgress] = useState<{
    current: number;
    message: string;
    history: string[];
  }>({
    current: 0,
    message: "等待开始...",
    history: [],
  });

  const importedBlueprint = useMemo(
    () => parseCompanyBlueprint(input.blueprintText),
    [input.blueprintText],
  );
  const isBlueprintTemplate = input.selectedTemplate === BLUEPRINT_TEMPLATE_ID;

  const updateProgress = (current: number, message: string) => {
    setCreationProgress((state) => ({
      current,
      message,
      history: [...state.history, message],
    }));
  };

  const handleCreate = async () => {
    const blueprint = isBlueprintTemplate ? importedBlueprint : null;
    const finalCompanyName = (input.companyName || blueprint?.sourceCompanyName || "").trim();
    if (!finalCompanyName) {
      return null;
    }
    if (isBlueprintTemplate && !blueprint) {
      setCreationError("蓝图解析失败，请粘贴有效的 cyber-company.blueprint.v1 JSON。");
      return null;
    }
    setIsCreating(true);
    setCreationError(null);
    setCreationProgress({ current: 0, message: "等待开始...", history: [] });
    updateProgress(1, `正在创建公司「${finalCompanyName}」...`);

    try {
      const templateId = blueprint?.template || input.selectedTemplate;
      const template = COMPANY_TEMPLATES.find((item) => item.id === templateId);
      const { agents: existingAgents } = await gateway.listAgents();
      const baseAgentName = allocateCompanyAgentNamespace(
        finalCompanyName,
        collectExistingAgentHandles(existingAgents),
      );
      const blueprintAgentIdMap = new Map<string, string>();
      const blueprintBindings: Array<{
        blueprintId: string;
        agentId: string;
        reportsToBlueprintId?: string;
        departmentName?: string;
      }> = [];

      const ceoAgentName = buildCompanyRoleAgentName(baseAgentName, "ceo");
      const hrAgentName = buildCompanyRoleAgentName(baseAgentName, "hr");
      const ctoAgentName = buildCompanyRoleAgentName(baseAgentName, "cto");
      const cooAgentName = buildCompanyRoleAgentName(baseAgentName, "coo");

      updateProgress(2, `正在创建 CEO 角色：${ceoAgentName}`);
      const ceoMeta = await gateway.createAgent(ceoAgentName);
      await sleep(600);

      updateProgress(3, "正在为 CEO 注入 SOUL 记忆...");
      await gateway.setAgentFile(ceoMeta.agentId, "SOUL.md", generateCeoSoul(finalCompanyName));

      updateProgress(4, "正在创建管理层角色（HR / CTO / COO）...");
      const hrMeta = await gateway.createAgent(hrAgentName);
      await sleep(600);
      await gateway.setAgentFile(hrMeta.agentId, "SOUL.md", generateHrSoul(finalCompanyName));

      const ctoMeta = await gateway.createAgent(ctoAgentName);
      await sleep(600);
      await gateway.setAgentFile(ctoMeta.agentId, "SOUL.md", generateCtoSoul(finalCompanyName));

      const cooMeta = await gateway.createAgent(cooAgentName);
      await sleep(600);
      await gateway.setAgentFile(cooMeta.agentId, "SOUL.md", generateCooSoul(finalCompanyName));

      if (blueprint) {
        blueprintAgentIdMap.set("meta:ceo", ceoMeta.agentId);
        blueprintAgentIdMap.set("meta:hr", hrMeta.agentId);
        blueprintAgentIdMap.set("meta:cto", ctoMeta.agentId);
        blueprintAgentIdMap.set("meta:coo", cooMeta.agentId);
      }

      updateProgress(5, "正在根据模板招聘业务员工...");
      const metaDepartments: Department[] = [
        { id: crypto.randomUUID(), name: "管理中枢", leadAgentId: ceoMeta.agentId, color: "slate", order: 0 },
        { id: crypto.randomUUID(), name: "人力资源部", leadAgentId: hrMeta.agentId, color: "rose", order: 1 },
        { id: crypto.randomUUID(), name: "技术部", leadAgentId: ctoMeta.agentId, color: "indigo", order: 2 },
        { id: crypto.randomUUID(), name: "运营部", leadAgentId: cooMeta.agentId, color: "emerald", order: 3 },
      ];

      const deptByLead = new Map(metaDepartments.map((department) => [department.leadAgentId, department.id] as const));

      const employeeRefs: EmployeeRef[] = [
        {
          agentId: ceoMeta.agentId,
          nickname: "CEO",
          role: "Chief Executive Officer",
          isMeta: true,
          metaRole: "ceo",
          departmentId: deptByLead.get(ceoMeta.agentId),
        },
        {
          agentId: hrMeta.agentId,
          nickname: "HR",
          role: "Human Resources Director",
          isMeta: true,
          metaRole: "hr",
          reportsTo: ceoMeta.agentId,
          departmentId: deptByLead.get(hrMeta.agentId),
        },
        {
          agentId: ctoMeta.agentId,
          nickname: "CTO",
          role: "Chief Technology Officer",
          isMeta: true,
          metaRole: "cto",
          reportsTo: ceoMeta.agentId,
          departmentId: deptByLead.get(ctoMeta.agentId),
        },
        {
          agentId: cooMeta.agentId,
          nickname: "COO",
          role: "Chief Operating Officer",
          isMeta: true,
          metaRole: "coo",
          reportsTo: ceoMeta.agentId,
          departmentId: deptByLead.get(cooMeta.agentId),
        },
      ];

      const reportsToMap: Record<string, string> = {
        ceo: ceoMeta.agentId,
        hr: hrMeta.agentId,
        cto: ctoMeta.agentId,
        coo: cooMeta.agentId,
      };

      if (blueprint) {
        const importedEmployees = blueprint.employees.filter((employee) => !employee.isMeta);
        for (let idx = 0; idx < importedEmployees.length; idx += 1) {
          const employee = importedEmployees[idx];
          const employeeSafeId = `${baseAgentName}-bp-${idx}`;
          updateProgress(5, `正在复制蓝图员工：${employee.nickname}（${employee.role}）`);

          const agentRef = await gateway.createAgent(employeeSafeId);
          await sleep(600);
          await gateway.setAgentFile(
            agentRef.agentId,
            "SOUL.md",
            `# 你的身份\n你在 "${finalCompanyName}" 担任 ${employee.role}。大家叫你 ${employee.nickname}。\n\n## 职责\n你需要严格按照该公司的共享知识、交接约束和角色边界执行任务，并及时回填结构化交付物。`,
          );

          blueprintAgentIdMap.set(employee.blueprintId, agentRef.agentId);
          blueprintBindings.push({
            blueprintId: employee.blueprintId,
            agentId: agentRef.agentId,
            reportsToBlueprintId: employee.reportsToBlueprintId,
            departmentName: employee.departmentName,
          });

          employeeRefs.push({
            agentId: agentRef.agentId,
            nickname: employee.nickname,
            role: employee.role,
            isMeta: false,
          });
        }
      } else if (template && template.employees.length > 0) {
        for (let idx = 0; idx < template.employees.length; idx += 1) {
          const employee = template.employees[idx];
          const employeeSafeId = `${baseAgentName}-emp-${idx}`;
          updateProgress(5, `正在配置员工：${employee.nickname}（${employee.role}）`);

          const agentRef = await gateway.createAgent(employeeSafeId);
          await sleep(600);
          await gateway.setAgentFile(
            agentRef.agentId,
            "SOUL.md",
            `# 你的身份\n你在 "${finalCompanyName}" 担任 ${employee.role}。大家叫你 ${employee.nickname}。\n\n## 职责\n${employee.soul}\n\n你的顶头上司是公司的 CEO。`,
          );

          employeeRefs.push({
            agentId: agentRef.agentId,
            nickname: employee.nickname,
            role: employee.role,
            isMeta: false,
            reportsTo: employee.reportsToRole ? reportsToMap[employee.reportsToRole] : ceoMeta.agentId,
            departmentId: deptByLead.get(
              employee.reportsToRole ? reportsToMap[employee.reportsToRole] : ceoMeta.agentId,
            ),
          });
        }
      }

      let finalDepartments = metaDepartments;
      if (blueprint) {
        const existingDepartmentNames = new Set(metaDepartments.map((department) => department.name));
        const importedDepartments = blueprint.departments
          .filter((department) => !META_DEPARTMENT_NAMES.has(department.name))
          .filter((department) => !existingDepartmentNames.has(department.name))
          .map((department, index) => ({
            id: crypto.randomUUID(),
            name: department.name,
            leadAgentId:
              (department.leadBlueprintId
                ? blueprintAgentIdMap.get(department.leadBlueprintId)
                : undefined) ?? cooMeta.agentId,
            color: department.color,
            order: department.order ?? metaDepartments.length + index,
          }));

        finalDepartments = [...metaDepartments, ...importedDepartments];
        const deptIdByName = new Map(finalDepartments.map((department) => [department.name, department.id]));

        for (let idx = 0; idx < employeeRefs.length; idx += 1) {
          const binding = blueprintBindings.find((item) => item.agentId === employeeRefs[idx].agentId);
          if (!binding) {
            continue;
          }
          employeeRefs[idx] = {
            ...employeeRefs[idx],
            reportsTo:
              (binding.reportsToBlueprintId
                ? blueprintAgentIdMap.get(binding.reportsToBlueprintId)
                : undefined) ?? ceoMeta.agentId,
            departmentId: binding.departmentName
              ? deptIdByName.get(binding.departmentName) ?? employeeRefs[idx].departmentId
              : employeeRefs[idx].departmentId,
          };
        }
      }

      updateProgress(6, "正在同步默认技能基线...");
      const skillSync = await gateway.alignAgentSkillsToDefaults(
        employeeRefs.map((employee) => employee.agentId),
      );
      updateProgress(
        6,
        skillSync.updated > 0
          ? `已完成 ${skillSync.updated} 名员工的技能同步。`
          : "技能基线已是最新，无需额外同步。",
      );

      updateProgress(7, "正在写入公司配置与组织注册表...");
      const quickPrompts = blueprint
        ? blueprint.quickPrompts
            .map((prompt) => ({
              label: prompt.label,
              icon: prompt.icon,
              prompt: prompt.prompt,
              targetAgentId:
                (prompt.targetBlueprintId
                  ? blueprintAgentIdMap.get(prompt.targetBlueprintId)
                  : undefined) ?? ceoMeta.agentId,
            }))
            .filter((prompt) => prompt.label.trim().length > 0 && prompt.prompt.trim().length > 0)
        : [];
      const newCompany: Company = {
        id: crypto.randomUUID(),
        name: finalCompanyName,
        description: blueprint?.description || template?.description || "",
        icon: blueprint?.icon || template?.icon || "🏢",
        template: templateId,
        orgSettings: {
          autoCalibrate: true,
        },
        departments: finalDepartments,
        employees: employeeRefs,
        quickPrompts,
        knowledgeItems: blueprint?.knowledgeItems ?? [],
        createdAt: Date.now(),
      };

      const newConfig: CyberCompanyConfig = config
        ? {
            ...config,
            companies: [...config.companies, newCompany],
            activeCompanyId: newCompany.id,
          }
        : {
            version: 1,
            companies: [newCompany],
            activeCompanyId: newCompany.id,
            preferences: { theme: "classic", locale: "zh-CN" },
          };

      const saved = await persistCompanyConfig(newConfig);
      if (!saved) {
        throw new Error("Failed to persist company configuration");
      }

      if (blueprint && blueprint.automations.length > 0) {
        updateProgress(8, "正在复制蓝图中的自动化班次...");
        const results = await Promise.allSettled(
          blueprint.automations.map((automation) => {
            const agentId =
              (automation.targetBlueprintId
                ? blueprintAgentIdMap.get(automation.targetBlueprintId)
                : undefined) ?? ceoMeta.agentId;
            if (!agentId) {
              return Promise.resolve();
            }

            return gateway.addCron({
              name: automation.name,
              agentId,
              enabled: true,
              sessionTarget: "main",
              wakeMode: "now",
              schedule: automation.expr
                ? { kind: "cron", expr: automation.expr }
                : { kind: "every", everyMs: automation.everyMs ?? 3600000 },
              payload: {
                kind: "agentTurn",
                message: automation.task,
              },
            });
          }),
        );

        const successCount = results.filter((result) => result.status === "fulfilled").length;
        if (successCount > 0) {
          updateProgress(8, `已复制 ${successCount} 条自动化班次。`);
        }
      }

      updateProgress(8, "正在刷新本地配置并准备进入总部大厅...");
      await loadConfig();
      setIsCreating(false);
      return { companyName: finalCompanyName };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCreationError(message);
      setIsCreating(false);
      throw error;
    }
  };

  return {
    BLUEPRINT_TEMPLATE_ID,
    COMPANY_TEMPLATES,
    creationError,
    creationProgress,
    creationTotalSteps,
    handleCreate,
    importedBlueprint,
    isBlueprintTemplate,
    isCreating,
  };
}
