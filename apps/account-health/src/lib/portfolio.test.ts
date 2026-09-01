import { describe, expect, it } from "vitest";
import { buildSamplePortfolio } from "./portfolio-sample";
import {
  UNASSIGNED_CSE,
  companyFromAccount,
  conversationsPerUser,
  filterCompanies,
  nextPortfolioSort,
  overlayLiveAccounts,
  sortCompanies,
  summarizePortfolio,
  uniqueAgentsUsed,
} from "./portfolio";
import { emptyJob, emptySnapshot } from "./store";
import type { AccountRecord } from "./types";

describe("buildSamplePortfolio", () => {
  it("builds 121 companies with the pack split from the usage visual", () => {
    const companies = buildSamplePortfolio();
    expect(companies).toHaveLength(121);
    expect(companies.filter((row) => row.pack === "enterprise")).toHaveLength(1);
    expect(companies.filter((row) => row.pack === "pro")).toHaveLength(1);
    expect(companies.filter((row) => row.pack === "starter")).toHaveLength(4);
    expect(companies.filter((row) => row.pack === "none")).toHaveLength(115);
    expect(companies.some((row) => row.name === "Grunley")).toBe(true);
    expect(companies.some((row) => row.name === "Vortex Construction")).toBe(true);
    expect(companies.find((row) => row.name === "Grunley")?.cse).toBe("Ronak Parikh");
    expect(companies.find((row) => row.name === "Vortex Construction")?.cse).toBe(UNASSIGNED_CSE);
  });

  it("is deterministic", () => {
    const a = buildSamplePortfolio();
    const b = buildSamplePortfolio();
    expect(a.map((row) => row.name)).toEqual(b.map((row) => row.name));
    expect(a.map((row) => row.activeUsers)).toEqual(b.map((row) => row.activeUsers));
  });
});

describe("summarizePortfolio", () => {
  it("aggregates KPIs and pack columns from the company rows", () => {
    const companies = buildSamplePortfolio();
    const summary = summarizePortfolio(companies, "2026-08-31T00:00:00.000Z");
    expect(summary.companyCount).toBe(121);
    expect(summary.companiesWithPacks).toBe(6);
    expect(summary.activeUsers).toBeGreaterThan(1000);
    expect(summary.agentConversations).toBeGreaterThan(1000);
    expect(summary.packs.map((col) => col.pack)).toEqual(["enterprise", "pro", "starter", "none"]);
    expect(summary.packs[0]?.companies).toBe(1);
    expect(summary.packs[3]?.companies).toBe(115);
    expect(summary.asOf).toBe("2026-08-31T00:00:00.000Z");
    expect(summary.capUtilPct).not.toBeNull();
  });
});

describe("sort / filter", () => {
  const companies = buildSamplePortfolio();

  it("sorts by CSE of record, with Unassigned last", () => {
    const sorted = sortCompanies(companies, { key: "cse", direction: "asc" });
    expect(sorted[0]?.cse).not.toBe(UNASSIGNED_CSE);
    expect(sorted[sorted.length - 1]?.cse).toBe(UNASSIGNED_CSE);
    const names = sorted.filter((row) => row.cse === "Brian Cerrato").map((row) => row.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("toggles CSE sort direction", () => {
    const first = nextPortfolioSort(null, "cse");
    expect(first).toEqual({ key: "cse", direction: "asc" });
    expect(nextPortfolioSort(first, "cse")).toEqual({ key: "cse", direction: "desc" });
  });

  it("filters by CSE, segment, pack, and company name", () => {
    const ronak = filterCompanies(companies, { cse: "Ronak Parikh" });
    expect(ronak.length).toBeGreaterThan(0);
    expect(ronak.every((row) => row.cse === "Ronak Parikh")).toBe(true);

    const starter = filterCompanies(companies, { pack: "starter" });
    expect(starter).toHaveLength(4);

    const consigli = filterCompanies(companies, { query: "consigli" });
    expect(consigli.map((row) => row.name)).toEqual(["Consigli Construction Co., Inc - HQ"]);
  });
});

describe("overlayLiveAccounts", () => {
  it("replaces Grunley / Vortex sample rows with live metrics and keeps CSE / pack", () => {
    const snapshot = emptySnapshot();
    snapshot.counts.passive = 5;
    snapshot.counts.sticky = 3;
    snapshot.counts.advanced = 2;
    snapshot.conversationVolume = {
      current30: 136,
      prior30: 119,
      deltaAbs: 17,
      deltaPct: 14.3,
    };
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
        activeDays30: 6,
        activeDates30: [],
        agents30: 2,
        agentIds30: ["agent-a", "agent-b"],
      },
    ];
    const grunley: AccountRecord = {
      id: "live-grunley",
      name: "Grunley",
      createdAt: "2026-08-01T00:00:00.000Z",
      connections: {},
      snapshot,
      job: emptyJob(),
      directory: [],
      callSentiment: [],
      growthSignals: [],
    };
    const merged = overlayLiveAccounts(buildSamplePortfolio(), [grunley]);
    const row = merged.find((company) => company.name === "Grunley")!;
    expect(row.accountId).toBe("live-grunley");
    expect(row.activeUsers).toBe(10);
    expect(row.agentConversations).toBe(136);
    expect(row.momPct).toBeCloseTo(14.3);
    expect(row.activeAgents).toBe(2);
    expect(row.pack).toBe("enterprise");
    expect(row.cse).toBe("Ronak Parikh");
    expect(JSON.stringify(row)).not.toMatch(/@grunley\.com|Ada Lovelace/);
  });
});

describe("companyFromAccount / uniqueAgentsUsed", () => {
  it("counts distinct agents and active users with our lifecycle labels", () => {
    expect(
      uniqueAgentsUsed([
        {
          id: "1",
          type: "sticky",
          power: false,
          introDate: null,
          firstReturnDate: null,
          lastActiveDate: null,
          activeDays30: 5,
          activeDates30: [],
          agents30: 2,
          agentIds30: ["a", "b"],
        },
        {
          id: "2",
          type: "passive",
          power: false,
          introDate: null,
          firstReturnDate: null,
          lastActiveDate: null,
          activeDays30: 2,
          activeDates30: [],
          agents30: 1,
          agentIds30: ["b"],
        },
      ]),
    ).toBe(2);
  });

  it("treats conversations per active user as null when nobody is active", () => {
    expect(
      conversationsPerUser({
        id: "x",
        name: "Empty",
        segment: "unknown",
        pack: "none",
        cse: UNASSIGNED_CSE,
        activeUsers: 0,
        agentConversations: 12,
        activeAgents: 0,
        agentsCreated: 0,
        credits: 0,
        momPct: null,
        accountId: null,
      }),
    ).toBeNull();
  });
});
