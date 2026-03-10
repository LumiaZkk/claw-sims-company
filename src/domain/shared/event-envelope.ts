export interface DomainEventEnvelope<
  TContext extends string = string,
  TKind extends string = string,
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  context: TContext;
  aggregateId: string;
  kind: TKind;
  occurredAt: number;
  actorId: string;
  causationId?: string;
  correlationId?: string;
  payload: TPayload;
}
