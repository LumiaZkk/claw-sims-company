import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import { resolveAuthorityCompanyManagementRoute } from "./company-management-routes";

function createDeps() {
  return {
    saveConfig: vi.fn().mockResolvedValue({ status: 200, payload: { ok: true, kind: "config" } }),
    createCompany: vi.fn().mockResolvedValue({ status: 200, payload: { ok: true, kind: "create" } }),
    retryCompanyProvisioning: vi
      .fn()
      .mockResolvedValue({ status: 200, payload: { ok: true, kind: "retry" } }),
    hireEmployee: vi.fn().mockResolvedValue({ status: 200, payload: { ok: true, kind: "hire" } }),
    batchHireEmployees: vi.fn().mockResolvedValue({ status: 200, payload: { ok: true, kind: "batch" } }),
    deleteCompany: vi.fn().mockResolvedValue({ status: 200, payload: { ok: true, kind: "delete" } }),
    switchCompany: vi.fn().mockResolvedValue({ status: 200, payload: { ok: true, kind: "switch" } }),
  };
}

describe("resolveAuthorityCompanyManagementRoute", () => {
  it("delegates config and company create routes", async () => {
    const deps = createDeps();
    const configResult = await resolveAuthorityCompanyManagementRoute({
      method: "PUT",
      url: new URL("http://authority.local/config"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn().mockResolvedValue({ config: { companies: [] } }),
      deps,
    });

    expect(deps.saveConfig).toHaveBeenCalledWith({ companies: [] });
    expect(configResult).toEqual({ status: 200, payload: { ok: true, kind: "config" } });

    const createResult = await resolveAuthorityCompanyManagementRoute({
      method: "POST",
      url: new URL("http://authority.local/companies"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn().mockResolvedValue({ companyName: "Nova" }),
      deps,
    });

    expect(deps.createCompany).toHaveBeenCalledWith({ companyName: "Nova" });
    expect(createResult).toEqual({ status: 200, payload: { ok: true, kind: "create" } });
  });

  it("delegates provisioning retry and switch company", async () => {
    const deps = createDeps();
    const retryResult = await resolveAuthorityCompanyManagementRoute({
      method: "POST",
      url: new URL("http://authority.local/companies/company%201/provisioning/retry"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(deps.retryCompanyProvisioning).toHaveBeenCalledWith("company 1");
    expect(retryResult).toEqual({ status: 200, payload: { ok: true, kind: "retry" } });

    const switchResult = await resolveAuthorityCompanyManagementRoute({
      method: "POST",
      url: new URL("http://authority.local/company/switch"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn().mockResolvedValue({ companyId: "company-2" }),
      deps,
    });

    expect(deps.switchCompany).toHaveBeenCalledWith({ companyId: "company-2" });
    expect(switchResult).toEqual({ status: 200, payload: { ok: true, kind: "switch" } });
  });

  it("delegates hire, batch hire, and delete", async () => {
    const deps = createDeps();
    const hireResult = await resolveAuthorityCompanyManagementRoute({
      method: "POST",
      url: new URL("http://authority.local/companies/company-1/employees"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn().mockResolvedValue({ role: "cto" }),
      deps,
    });

    expect(deps.hireEmployee).toHaveBeenCalledWith({
      companyId: "company-1",
      body: { role: "cto" },
    });
    expect(hireResult).toEqual({ status: 200, payload: { ok: true, kind: "hire" } });

    const batchResult = await resolveAuthorityCompanyManagementRoute({
      method: "POST",
      url: new URL("http://authority.local/companies/company-1/employees/batch"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn().mockResolvedValue({ hires: [{ role: "writer" }] }),
      deps,
    });

    expect(deps.batchHireEmployees).toHaveBeenCalledWith({
      companyId: "company-1",
      body: { hires: [{ role: "writer" }] },
    });
    expect(batchResult).toEqual({ status: 200, payload: { ok: true, kind: "batch" } });

    const deleteResult = await resolveAuthorityCompanyManagementRoute({
      method: "DELETE",
      url: new URL("http://authority.local/companies/company-1"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(deps.deleteCompany).toHaveBeenCalledWith("company-1");
    expect(deleteResult).toEqual({ status: 200, payload: { ok: true, kind: "delete" } });
  });

  it("returns null for non-company-management routes", async () => {
    const deps = createDeps();
    const result = await resolveAuthorityCompanyManagementRoute({
      method: "GET",
      url: new URL("http://authority.local/sessions"),
      request: {} as IncomingMessage,
      readJsonBody: vi.fn(),
      deps,
    });

    expect(result).toBeNull();
  });
});
