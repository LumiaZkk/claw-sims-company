export function normalizeCompanyEventsPageRows<T extends { seq: number }>(input: {
  rows: T[];
  limit: number;
  recent?: boolean;
}) {
  const pageLimit = Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit)) : 200;
  const hasMore = input.rows.length > pageLimit;
  const slicedRows = hasMore ? input.rows.slice(0, pageLimit) : input.rows;
  const orderedRows = input.recent ? [...slicedRows].reverse() : slicedRows;
  return {
    rows: orderedRows,
    nextCursor:
      hasMore && slicedRows.length > 0 ? String(slicedRows[slicedRows.length - 1]!.seq) : null,
  };
}
