export const META_ROLES = ["ceo", "hr", "cto", "coo"] as const;

export type MetaRole = (typeof META_ROLES)[number];
export type SupportMetaRole = Exclude<MetaRole, "ceo">;

export function isMetaRole(value: unknown): value is MetaRole {
  return typeof value === "string" && META_ROLES.some((candidate) => candidate === value);
}

export function isSupportMetaRole(metaRole: MetaRole | null | undefined): metaRole is SupportMetaRole {
  return metaRole === "hr" || metaRole === "cto" || metaRole === "coo";
}
