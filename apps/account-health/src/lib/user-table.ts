import { ENGAGEMENT_LABELS, ENGAGEMENT_TYPES, type EngagementType } from "./lifecycle";
import type { ClassifiedUser } from "./types";

export type UserSortKey =
  | "user"
  | "stage"
  | "intro"
  | "firstReturn"
  | "lastActive"
  | "days"
  | "chats"
  | "agents";

export type UserSortDirection = "asc" | "desc";

export type UserSort = {
  key: UserSortKey;
  direction: UserSortDirection;
};

const STAGE_ORDER = new Map(ENGAGEMENT_TYPES.map((type, index) => [type, index]));

function userLabel(user: ClassifiedUser): string {
  return (user.name ?? user.email ?? user.id).toLowerCase();
}

function compareNullableDate(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function compareNullableNumber(a: number | undefined, b: number | undefined): number {
  const left = a ?? -1;
  const right = b ?? -1;
  return left - right;
}

export function nextUserSort(current: UserSort | null, key: UserSortKey): UserSort {
  if (current?.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: "asc" };
}

export function filterUsers(
  users: ClassifiedUser[],
  options: { query?: string; stage?: EngagementType | null },
): ClassifiedUser[] {
  const needle = options.query?.trim().toLowerCase() ?? "";
  return users.filter((user) => {
    if (options.stage && user.type !== options.stage) return false;
    if (!needle) return true;
    const haystack = `${user.name ?? ""} ${user.email ?? ""} ${user.id} ${ENGAGEMENT_LABELS[user.type]}`.toLowerCase();
    return haystack.includes(needle);
  });
}

export function sortUsers(users: ClassifiedUser[], sort: UserSort | null): ClassifiedUser[] {
  const direction = sort?.direction === "desc" ? -1 : 1;
  const key = sort?.key ?? "stage";

  return [...users].sort((a, b) => {
    let delta = 0;
    switch (key) {
      case "user":
        delta = userLabel(a).localeCompare(userLabel(b));
        break;
      case "stage":
        delta = (STAGE_ORDER.get(a.type) ?? 0) - (STAGE_ORDER.get(b.type) ?? 0);
        break;
      case "intro":
        delta = compareNullableDate(a.introDate, b.introDate);
        break;
      case "firstReturn":
        delta = compareNullableDate(a.firstReturnDate, b.firstReturnDate);
        break;
      case "lastActive":
        delta = compareNullableDate(a.lastActiveDate, b.lastActiveDate);
        break;
      case "days":
        delta = a.activeDays30 - b.activeDays30;
        break;
      case "chats":
        delta = compareNullableNumber(a.chats30, b.chats30);
        break;
      case "agents":
        delta = a.agents30 - b.agents30;
        if (delta === 0) {
          delta = (a.agentIds30 ?? []).join(",").localeCompare((b.agentIds30 ?? []).join(","));
        }
        break;
      default:
        delta = 0;
    }
    if (delta !== 0) return delta * direction;
    const fallback = userLabel(a).localeCompare(userLabel(b));
    if (fallback !== 0) return fallback;
    return a.id.localeCompare(b.id);
  });
}
