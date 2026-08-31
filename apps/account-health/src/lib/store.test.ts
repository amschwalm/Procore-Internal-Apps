import { describe, expect, it } from "vitest";
import {
  applyAccountState,
  emptyAccountState,
  emptySnapshot,
  inferAccountName,
  migrateWorkspace,
  publicAccounts,
} from "./store";
import type { AccountRecord } from "./types";

describe("inferAccountName", () => {
  it("uses the most common non-Procore email domain", () => {
    const snapshot = emptySnapshot();
    snapshot.users = [
      { id: "1", email: "a@grunley.com", name: "A", type: "non_user", power: false, introDate: null, firstReturnDate: null, lastActiveDate: null, activeDays30: 0, activeDates30: [], agents30: 0, agentIds30: [] },
      { id: "2", email: "b@grunley.com", name: "B", type: "non_user", power: false, introDate: null, firstReturnDate: null, lastActiveDate: null, activeDays30: 0, activeDates30: [], agents30: 0, agentIds30: [] },
      { id: "3", email: "c@procore.com", name: "C", type: "non_user", power: false, introDate: null, firstReturnDate: null, lastActiveDate: null, activeDays30: 0, activeDates30: [], agents30: 0, agentIds30: [] },
    ];
    expect(inferAccountName(snapshot)).toBe("Grunley");
  });
});

describe("migrateWorkspace", () => {
  it("wraps a legacy single-org file as one account", () => {
    const snapshot = emptySnapshot();
    snapshot.source = "upload";
    snapshot.provisionedUsers = 2;
    snapshot.users = [
      { id: "1", email: "a@grunley.com", name: "A", type: "sticky", power: false, introDate: null, firstReturnDate: null, lastActiveDate: null, activeDays30: 5, activeDates30: [], agents30: 0, agentIds30: [] },
    ];
    const workspace = migrateWorkspace({
      connections: { datagrid: { apiKey: "dg_test" } },
      snapshot,
      job: { status: "success", mode: "upload", startedAt: null, finishedAt: null, steps: [], error: null, failedStep: null },
      directory: [],
    });
    expect(workspace.accounts).toHaveLength(1);
    expect(workspace.accounts[0]?.name).toBe("Grunley");
    expect(workspace.currentAccountId).toBe(workspace.accounts[0]?.id);
    expect(workspace.accounts[0]?.connections.datagrid?.apiKey).toBe("dg_test");
  });

  it("keeps an already migrated workspace", () => {
    const account: AccountRecord = {
      id: "acc-1",
      name: "Acme",
      createdAt: "2026-08-30T00:00:00.000Z",
      connections: {},
      snapshot: emptySnapshot(),
      job: {
        status: "idle",
        mode: null,
        startedAt: null,
        finishedAt: null,
        steps: [],
        error: null,
        failedStep: null,
      },
      directory: [],
      callSentiment: [],
      growthSignals: [],
    };
    const workspace = migrateWorkspace({
      currentAccountId: "acc-1",
      accounts: [account],
    });
    expect(workspace.accounts[0]?.name).toBe("Acme");
    expect(workspace.currentAccountId).toBe("acc-1");
  });

  it("returns no accounts for a blank file", () => {
    expect(migrateWorkspace({})).toEqual({ currentAccountId: null, accounts: [] });
  });
});

describe("publicAccounts", () => {
  it("marks the current account", () => {
    const snapshot = emptySnapshot();
    snapshot.provisionedUsers = 12;
    const listed = publicAccounts({
      currentAccountId: "b",
      accounts: [
        {
          id: "b",
          name: "Beta",
          createdAt: "2026-08-01T00:00:00.000Z",
          connections: {},
          snapshot,
          job: {
            status: "idle",
            mode: null,
            startedAt: null,
            finishedAt: null,
            steps: [],
            error: null,
            failedStep: null,
          },
          directory: [],
          callSentiment: [],
          growthSignals: [],
        },
        {
          id: "a",
          name: "Alpha",
          createdAt: "2026-08-02T00:00:00.000Z",
          connections: {},
          snapshot: emptySnapshot(),
          job: {
            status: "idle",
            mode: null,
            startedAt: null,
            finishedAt: null,
            steps: [],
            error: null,
            failedStep: null,
          },
          directory: [],
          callSentiment: [],
          growthSignals: [],
        },
      ],
    });
    expect(listed.map((account) => account.name)).toEqual(["Alpha", "Beta"]);
    expect(listed.find((account) => account.id === "b")?.current).toBe(true);
    expect(listed.find((account) => account.id === "b")?.userCount).toBe(12);
    expect(listed.every((account) => account.anonymized === false)).toBe(true);
  });
});

describe("applyAccountState", () => {
  it("writes only the targeted account and leaves the current selection alone", () => {
    const alphaSnapshot = emptySnapshot();
    const betaSnapshot = emptySnapshot();
    alphaSnapshot.provisionedUsers = 3;
    betaSnapshot.provisionedUsers = 9;
    const workspace = {
      currentAccountId: "beta",
      accounts: [
        {
          id: "alpha",
          name: "Alpha",
          createdAt: "2026-08-01T00:00:00.000Z",
          connections: {},
          snapshot: alphaSnapshot,
          job: emptyAccountState().job,
          directory: [],
          callSentiment: [],
          growthSignals: [],
        },
        {
          id: "beta",
          name: "Beta",
          createdAt: "2026-08-02T00:00:00.000Z",
          connections: {},
          snapshot: betaSnapshot,
          job: emptyAccountState().job,
          directory: [],
          callSentiment: [],
          growthSignals: [],
        },
      ],
    };
    const next = applyAccountState(workspace, {
      accountId: "alpha",
      accountName: "Alpha",
      anonymized: false,
      connections: { datagrid: { apiKey: "dg_alpha" } },
      snapshot: { ...alphaSnapshot, provisionedUsers: 12 },
      job: emptyAccountState().job,
      directory: [],
      callSentiment: [],
      growthSignals: [],
    });
    expect(next.currentAccountId).toBe("beta");
    expect(next.accounts.find((account) => account.id === "alpha")?.snapshot.provisionedUsers).toBe(12);
    expect(next.accounts.find((account) => account.id === "alpha")?.connections.datagrid?.apiKey).toBe("dg_alpha");
    expect(next.accounts.find((account) => account.id === "beta")?.snapshot.provisionedUsers).toBe(9);
  });

  it("renames Turner to Vortex Construction and strips customer names on read", () => {
    const snapshot = emptySnapshot();
    snapshot.source = "sample";
    snapshot.users = [
      {
        id: "u1",
        email: "ava.chen@acme.test",
        name: "Ava Chen",
        type: "sticky",
        power: false,
        introDate: "2026-01-01",
        firstReturnDate: "2026-01-03",
        lastActiveDate: "2026-08-01",
        activeDays30: 6,
        activeDates30: [],
        agents30: 1,
        agentIds30: [],
      },
    ];
    const workspace = migrateWorkspace({
      currentAccountId: "t1",
      accounts: [
        {
          id: "t1",
          name: "Turner",
          createdAt: "2026-08-01T00:00:00.000Z",
          connections: {},
          snapshot,
          job: emptyAccountState().job,
          directory: [{ id: "u1", email: "ava.chen@acme.test", name: "Ava Chen" }],
          callSentiment: [
            {
              id: "c1",
              date: "2026-08-01",
              title: "Weekly sync with Ava Chen",
              source: "sample",
              score: 0,
              label: "neutral",
              moodSummary: "Ava Chen walked through the ladder.",
            },
          ],
          growthSignals: [],
        },
      ],
    });
    const vortex = workspace.accounts[0]!;
    expect(vortex.name).toBe("Vortex Construction");
    expect(vortex.anonymized).toBe(true);
    expect(vortex.snapshot.users[0]?.name).toBe("User 01");
    expect(vortex.snapshot.users[0]?.email).toBe("user01@internal.test");
    expect(vortex.directory[0]?.name).toBe("User 01");
    expect(vortex.callSentiment[0]?.title).toBe("Weekly sync with User 01");
    expect(vortex.callSentiment[0]?.moodSummary).not.toMatch(/Ava Chen/);
  });

  it("keeps real people on a non-test account", () => {
    const snapshot = emptySnapshot();
    snapshot.users = [
      {
        id: "u1",
        email: "a@grunley.com",
        name: "Ada Lovelace",
        type: "sticky",
        power: false,
        introDate: null,
        firstReturnDate: null,
        lastActiveDate: null,
        activeDays30: 5,
        activeDates30: [],
        agents30: 0,
        agentIds30: [],
      },
    ];
    const workspace = migrateWorkspace({
      currentAccountId: "g1",
      accounts: [
        {
          id: "g1",
          name: "Grunley",
          createdAt: "2026-08-01T00:00:00.000Z",
          connections: {},
          snapshot,
          job: emptyAccountState().job,
          directory: [],
          callSentiment: [],
          growthSignals: [],
        },
      ],
    });
    expect(workspace.accounts[0]?.name).toBe("Grunley");
    expect(workspace.accounts[0]?.anonymized).toBe(false);
    expect(workspace.accounts[0]?.snapshot.users[0]?.name).toBe("Ada Lovelace");
    expect(workspace.accounts[0]?.snapshot.users[0]?.email).toBe("a@grunley.com");
  });

  it("anonymizes sample people when writing to Vortex Construction", () => {
    const snapshot = emptySnapshot();
    snapshot.source = "sample";
    snapshot.provisionedUsers = 1;
    snapshot.users = [
      {
        id: "s1",
        email: "ava.chen@acme.test",
        name: "Ava Chen",
        type: "intro",
        power: false,
        introDate: "2026-08-01",
        firstReturnDate: null,
        lastActiveDate: "2026-08-01",
        activeDays30: 1,
        activeDates30: ["2026-08-01"],
        agents30: 1,
        agentIds30: ["Ask Agent"],
      },
    ];
    const workspace = {
      currentAccountId: "v1",
      accounts: [
        {
          id: "v1",
          name: "Vortex Construction",
          anonymized: true,
          createdAt: "2026-08-01T00:00:00.000Z",
          connections: {},
          snapshot: emptySnapshot(),
          job: emptyAccountState().job,
          directory: [],
          callSentiment: [],
          growthSignals: [],
        },
      ],
    };
    const next = applyAccountState(workspace, {
      accountId: "v1",
      accountName: "Vortex Construction",
      anonymized: true,
      connections: {},
      snapshot,
      job: emptyAccountState().job,
      directory: [{ id: "s1", email: "ava.chen@acme.test", name: "Ava Chen" }],
      callSentiment: [],
      growthSignals: [],
    });
    const vortex = next.accounts[0]!;
    expect(vortex.snapshot.users[0]?.name).toBe("User 01");
    expect(vortex.snapshot.users[0]?.email).toBe("user01@internal.test");
    expect(vortex.directory[0]?.email).toBe("user01@internal.test");
    expect(JSON.stringify(vortex)).not.toMatch(/ava\.chen|Ava Chen/i);
  });

  it("refuses to save when no account exists", () => {
    expect(() =>
      applyAccountState({ currentAccountId: null, accounts: [] }, emptyAccountState()),
    ).toThrow("Create an account before saving data.");
  });
});
