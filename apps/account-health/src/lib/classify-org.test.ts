import { describe, expect, it } from "vitest";
import { snapshotFromOrg } from "./classify-org";
import type { SyncedOrg } from "./datagrid";

function org(overrides: Partial<SyncedOrg> = {}): SyncedOrg {
  return {
    users: [{ id: "u1", email: "a@b.com", first_name: "Ada", last_name: "Lovelace" }],
    teamspaces: [
      { id: "home", name: "Home" },
      { id: "other", name: "Other" },
    ],
    conversations: [],
    discoveredAuthorFields: [],
    agents: [],
    knowledge: [],
    connections: [{ id: "conn-1" }],
    keyScope: "org",
    homeTeamspaceId: "home",
    teamspacesSynced: 1,
    ...overrides,
  };
}

describe("snapshotFromOrg", () => {
  it("explains an org-scoped key when stages cannot be assigned", () => {
    const snapshot = snapshotFromOrg(org(), new Date("2026-08-30T12:00:00.000Z"));
    expect(snapshot.attribution).toBe("unavailable");
    expect(snapshot.provisionedUsers).toBe(1);
    expect(snapshot.counts.non_user).toBe(1);
    expect(snapshot.orgPower).toBe(true);
    expect(snapshot.attributionNote).toContain("org-scoped");
    expect(snapshot.attributionNote).toContain("1 of 2");
    expect(snapshot.users[0]?.daysToConversion).toBeNull();
    expect(snapshot.users[0]?.conversionEntryDate).toBeNull();
  });

  it("computes daysToConversion when the key attributes conversations", () => {
    const now = new Date("2026-08-30T12:00:00.000Z");
    const conversations = [8, 6, 4, 2, 1].map((daysAgo) => ({
      id: `c-${daysAgo}`,
      created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
      participated_agent_ids: ["agent-a"],
      authorId: "u1",
      authorField: "user_id",
      completed: true,
    }));
    const snapshot = snapshotFromOrg(
      org({ conversations, discoveredAuthorFields: ["user_id"] }),
      now,
    );
    expect(snapshot.attribution).toBe("user");
    const user = snapshot.users.find((u) => u.id === "u1");
    expect(user?.type).toBe("sticky");
    expect(user?.daysToConversion).not.toBeNull();
    expect(user?.conversionEntryDate).toBe(user?.lastActiveDate);
    expect(snapshot.conversationVolume?.current30).toBe(5);
  });

  it("still reports conversation volume when authors are missing", () => {
    const now = new Date("2026-08-30T12:00:00.000Z");
    const snapshot = snapshotFromOrg(
      org({
        conversations: [
          {
            id: "c1",
            created_at: "2026-08-20T12:00:00.000Z",
            authorId: null,
            authorField: null,
            completed: true,
          },
          {
            id: "c2",
            created_at: "2026-07-10T12:00:00.000Z",
            authorId: null,
            authorField: null,
            completed: true,
          },
        ],
      }),
      now,
    );
    expect(snapshot.attribution).toBe("unavailable");
    expect(snapshot.conversationVolume).toEqual({
      current30: 1,
      prior30: 1,
      deltaAbs: 0,
      deltaPct: 0,
    });
  });
});
