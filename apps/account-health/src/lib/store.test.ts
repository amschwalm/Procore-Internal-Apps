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

  it("refuses to save when no account exists", () => {
    expect(() =>
      applyAccountState({ currentAccountId: null, accounts: [] }, emptyAccountState()),
    ).toThrow("Create an account before saving data.");
  });
});
