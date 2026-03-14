import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GatewayStatusBanner } from "./gateway-status-banner";

const useGatewayStoreMock = vi.fn();

vi.mock("../../application/gateway", () => ({
  useGatewayStore: () => useGatewayStoreMock(),
}));

describe("GatewayStatusBanner", () => {
  it("stays hidden before the first successful connection", () => {
    useGatewayStoreMock.mockReturnValue({
      connected: false,
      hasEverConnected: false,
      phase: "idle",
      error: null,
      url: "http://127.0.0.1:18890",
      token: "",
      connect: vi.fn(),
      providerId: "authority",
      providers: [{ id: "authority", label: "Authority" }],
    });

    expect(renderToStaticMarkup(<GatewayStatusBanner />)).toBe("");
  });

  it("shows reconnect guidance after the connection drops", () => {
    useGatewayStoreMock.mockReturnValue({
      connected: false,
      hasEverConnected: true,
      phase: "reconnecting",
      error: "ws disconnected",
      url: "http://127.0.0.1:18890",
      token: "",
      connect: vi.fn(),
      providerId: "authority",
      providers: [{ id: "authority", label: "Authority" }],
    });

    const html = renderToStaticMarkup(<GatewayStatusBanner />);
    expect(html).toContain("Authority 连接已断开，正在重连");
    expect(html).toContain("立即重试");
    expect(html).toContain("ws disconnected");
  });

  it("stays hidden for offline draft state after the user stops reconnecting", () => {
    useGatewayStoreMock.mockReturnValue({
      connected: false,
      hasEverConnected: true,
      phase: "offline",
      error: null,
      url: "http://127.0.0.1:18898",
      token: "",
      connect: vi.fn(),
      providerId: "authority",
      providers: [{ id: "authority", label: "Authority" }],
    });

    expect(renderToStaticMarkup(<GatewayStatusBanner />)).toBe("");
  });
});
