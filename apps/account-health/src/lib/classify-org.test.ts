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
  });
});
