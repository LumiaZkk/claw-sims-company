export const RECENT_COMPANY_EVENTS_LIMIT = 20;

export function getRecentCompanyEventsSince() {
  return Date.now() - 24 * 60 * 60 * 1000;
}
