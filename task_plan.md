# Task Plan: Company Communication Closed Loop

## Goal
Implement company-level intent APIs, append-only company event logs, and frontend replay/sync so company communication state is platform-managed and can be rebuilt when the page reopens.

## Current Phase
Phase 5

## Phases
### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Create project structure if needed
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Add gateway company event log RPCs and durable storage
- [x] Add company intent tools for dispatch/report/subtask
- [x] Add frontend event client, replay, and unified sync service
- [x] Update prompts/templates to prefer company intent tools
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
- [x] Review all output files
- [x] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** in_progress

## Key Questions
1. Where should company communication durable truth live?
2. How do we keep legacy session-history recovery compatible while moving to event-backed projections?
3. How do we prevent agents from choosing the wrong transport for roster communication?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use gateway append-only JSONL files keyed by `companyId` for company events | Durable, simple to inspect, and compatible with replay on page reopen |
| Add business-intent tools instead of teaching agents to pick low-level session tools | Removes transport selection from model decision space |
| Keep legacy history recovery as fallback after event replay | Allows compatible rollout without breaking existing conversations |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- Existing browser local storage remains warm cache only.
- Current project spans `/Users/zkk/openclaw` and `/Users/zkk/openclaw/cyber-company`; edits must stay compatible across both.
