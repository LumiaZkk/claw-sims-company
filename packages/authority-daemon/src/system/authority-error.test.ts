import { describe, expect, it } from "vitest";
import {
  AuthorityHttpError,
  authorityBadRequest,
  authorityConflict,
  authorityNotFound,
  authorityUnsupported,
  getAuthorityHttpErrorMessage,
  getAuthorityHttpErrorStatus,
  isAuthorityHttpError,
} from "./authority-error";

describe("authority-error", () => {
  it("builds typed HTTP errors for common authority control-plane cases", () => {
    expect(authorityBadRequest("bad input")).toMatchObject({ status: 400, message: "bad input" });
    expect(authorityNotFound("missing company")).toMatchObject({ status: 404, message: "missing company" });
    expect(authorityConflict("stale revision")).toMatchObject({ status: 409, message: "stale revision" });
    expect(authorityUnsupported("unsupported")).toMatchObject({ status: 501, message: "unsupported" });
  });

  it("extracts status/message from typed and untyped errors", () => {
    const typed = new AuthorityHttpError(422, "unprocessable");
    expect(isAuthorityHttpError(typed)).toBe(true);
    expect(getAuthorityHttpErrorStatus(typed)).toBe(422);
    expect(getAuthorityHttpErrorMessage(typed)).toBe("unprocessable");

    expect(isAuthorityHttpError(new Error("boom"))).toBe(false);
    expect(getAuthorityHttpErrorStatus(new Error("boom"))).toBe(500);
    expect(getAuthorityHttpErrorMessage(new Error("boom"))).toBe("boom");
    expect(getAuthorityHttpErrorMessage("plain")).toBe("plain");
  });
});
