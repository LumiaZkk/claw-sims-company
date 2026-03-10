import { gateway } from "../../application/gateway";
import type {
  CompanyEvent,
  CompanyEventsListResult,
} from "../../domain/delegation/events";

const DEFAULT_EVENT_PAGE_LIMIT = 500;
const DEFAULT_EVENT_MAX_PAGES = 10;

export async function appendDelegationEvent(event: CompanyEvent) {
  return gateway.appendCompanyEvent(event);
}

export async function listDelegationEventPage(params: {
  companyId: string;
  cursor?: string;
  limit?: number;
}): Promise<CompanyEventsListResult> {
  return gateway.listCompanyEvents(params);
}

export async function listAllDelegationEvents(
  companyId: string,
  options?: {
    limit?: number;
    maxPages?: number;
  },
) {
  const events: CompanyEventsListResult["events"] = [];
  let cursor: string | null | undefined;
  let pageCount = 0;
  const limit = options?.limit ?? DEFAULT_EVENT_PAGE_LIMIT;
  const maxPages = options?.maxPages ?? DEFAULT_EVENT_MAX_PAGES;

  do {
    const page = await listDelegationEventPage({
      companyId,
      cursor: cursor ?? undefined,
      limit,
    });
    events.push(...page.events);
    cursor = page.nextCursor;
    pageCount += 1;
  } while (cursor && pageCount < maxPages);

  return events;
}
