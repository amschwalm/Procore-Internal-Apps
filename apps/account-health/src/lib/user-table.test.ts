import { describe, expect, it } from "vitest";
import type { ClassifiedUser } from "./types";
import { filterUsers, nextUserSort, sortUsers } from "./user-table";

function user(overrides: Partial<ClassifiedUser> & Pick<ClassifiedUser, "id" | "type">): ClassifiedUser {
  return {
    power: false,
    introDate: null,
    firstReturnDate: null,
    lastActiveDate: null,
    activeDays30: 0,
    activeDates30: [],
    agents30: 0,
    agentIds30: [],
    chats30: 0,
    name: overrides.id,
    ...overrides,
  };
}

const rows: ClassifiedUser[] = [
  user({
    id: "a",
    name: "Ava",
    email: "ava@acme.test",
    type: "sticky",
    introDate: "2026-08-01",
    lastActiveDate: "2026-08-20",
    activeDays30: 6,
    chats30: 12,
    agents30: 1,
  }),
  user({
    id: "b",
    name: "Ben",
    email: "ben@acme.test",
    type: "churned",
    introDate: "2026-07-01",
    lastActiveDate: "2026-07-01",
    activeDays30: 0,
    chats30: 0,
  }),
  user({
    id: "c",
    name: "Cara",
    email: "cara@other.test",
    type: "passive",
    introDate: "2026-06-01",
    firstReturnDate: "2026-08-10",
    lastActiveDate: "2026-08-18",
    activeDays30: 2,
    chats30: 4,
    agents30: 2,
    agentIds30: ["x", "y"],
  }),
];

describe("filterUsers", () => {
  it("filters by name or email", () => {
    expect(filterUsers(rows, { query: "ava" }).map((row) => row.id)).toEqual(["a"]);
    expect(filterUsers(rows, { query: "other.test" }).map((row) => row.id)).toEqual(["c"]);
  });

  it("filters by stage label and selected stage", () => {
    expect(filterUsers(rows, { query: "churned" }).map((row) => row.id)).toEqual(["b"]);
    expect(filterUsers(rows, { stage: "sticky" }).map((row) => row.id)).toEqual(["a"]);
  });
});

describe("sortUsers", () => {
  it("defaults to stage order then name", () => {
    expect(sortUsers(rows, null).map((row) => row.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by last active descending", () => {
    expect(
      sortUsers(rows, { key: "lastActive", direction: "desc" }).map((row) => row.id),
    ).toEqual(["a", "c", "b"]);
  });

  it("sorts by days then name", () => {
    expect(sortUsers(rows, { key: "days", direction: "desc" }).map((row) => row.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});

describe("nextUserSort", () => {
  it("starts ascending then toggles descending", () => {
    const first = nextUserSort(null, "user");
    expect(first).toEqual({ key: "user", direction: "asc" });
    expect(nextUserSort(first, "user")).toEqual({ key: "user", direction: "desc" });
    expect(nextUserSort(first, "days")).toEqual({ key: "days", direction: "asc" });
  });
});
