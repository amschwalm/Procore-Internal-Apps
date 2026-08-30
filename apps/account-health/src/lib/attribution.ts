const AUTHOR_KEYS = [
  "user_id",
  "userId",
  "created_by",
  "createdBy",
  "created_by_user_id",
  "createdByUserId",
  "author_id",
  "authorId",
  "owner_id",
  "ownerId",
  "created_by_id",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function extractAuthorId(record: unknown): { id: string; field: string } | null {
  const obj = asRecord(record);
  if (!obj) return null;

  for (const key of AUTHOR_KEYS) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return { id: value, field: key };
    }
  }

  const nestedUser = asRecord(obj.user);
  if (nestedUser && typeof nestedUser.id === "string" && nestedUser.id.trim()) {
    return { id: nestedUser.id, field: "user.id" };
  }

  const nestedAuthor = asRecord(obj.author);
  if (nestedAuthor && typeof nestedAuthor.id === "string" && nestedAuthor.id.trim()) {
    return { id: nestedAuthor.id, field: "author.id" };
  }

  return null;
}

export function isBuilderAgent(agent: unknown): boolean {
  const obj = asRecord(agent);
  if (!obj) return false;
  return obj.managed_by_app == null;
}

export function isQualifyingKnowledge(knowledge: unknown): boolean {
  const obj = asRecord(knowledge);
  if (!obj) return false;
  const status = obj.status;
  if (status === "ready" || status === "partial") return true;
  const rows = asRecord(obj.row_counts);
  return typeof rows?.completed === "number" && rows.completed > 0;
}
