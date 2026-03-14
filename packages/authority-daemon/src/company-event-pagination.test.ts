import { describe, expect, it } from "vitest";
import { normalizeCompanyEventsPageRows } from "./company-event-pagination";

describe("normalizeCompanyEventsPageRows", () => {
  it("returns ascending rows as-is and clears nextCursor on the last page", () => {
    const page = normalizeCompanyEventsPageRows({
      rows: [{ seq: 11 }, { seq: 12 }],
      limit: 2,
    });

    expect(page.rows.map((row) => row.seq)).toEqual([11, 12]);
    expect(page.nextCursor).toBeNull();
  });

  it("uses the last emitted seq as nextCursor when more ascending rows remain", () => {
    const page = normalizeCompanyEventsPageRows({
      rows: [{ seq: 11 }, { seq: 12 }, { seq: 13 }],
      limit: 2,
    });

    expect(page.rows.map((row) => row.seq)).toEqual([11, 12]);
    expect(page.nextCursor).toBe("12");
  });

  it("reverses recent-first rows back to ascending order and keeps the older cursor", () => {
    const page = normalizeCompanyEventsPageRows({
      rows: [{ seq: 30 }, { seq: 29 }, { seq: 28 }],
      limit: 2,
      recent: true,
    });

    expect(page.rows.map((row) => row.seq)).toEqual([29, 30]);
    expect(page.nextCursor).toBe("29");
  });
});
