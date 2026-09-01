import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_ACCOUNT_NAME,
  anonymizeAccountRecord,
  isAnonymousAccountName,
  rawAccountNeedsAnonymizationPersist,
  scrubText,
  syntheticEmail,
  syntheticName,
} from "./anonymize";
import { emptyJob, emptySnapshot } from "./store";
import type { AccountRecord } from "./types";

function accountWithPeople(name: string, extra?: Partial<AccountRecord>): AccountRecord {
  const snapshot = emptySnapshot();
  snapshot.source = "sample";
  snapshot.provisionedUsers = 2;
  snapshot.users = [
    {
      id: "u-b",
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
      agentIds30: ["Ask Agent"],
    },
    {
      id: "u-a",
      email: "marcus.cole@acme.test",
      name: "Marcus Cole",
      type: "passive",
      power: false,
      introDate: "2026-02-01",
      firstReturnDate: null,
      lastActiveDate: "2026-08-10",
      activeDays30: 2,
      activeDates30: [],
      agents30: 1,
      agentIds30: ["Ask Agent"],
    },
  ];
  return {
    id: "acc-1",
    name,
    createdAt: "2026-08-01T00:00:00.000Z",
    connections: {},
    snapshot,
    job: emptyJob(),
    directory: [
      { id: "u-b", email: "ava.chen@acme.test", name: "Ava Chen" },
      { id: "u-a", email: "marcus.cole@acme.test", name: "Marcus Cole" },
    ],
    callSentiment: [
      {
        id: "c1",
        date: "2026-08-01",
        title: "Weekly sync with Ava Chen",
        source: "sample",
        score: 0.2,
        label: "neutral",
        moodSummary: "Ava Chen said ava.chen@acme.test is blocked on search.",
      },
    ],
    growthSignals: [
      {
        id: "g1",
        callId: "c1",
        date: "2026-08-01",
        title: "Weekly sync with Ava Chen",
        category: "meetings",
        excerpt: "Ava Chen wants meetings because action items are lost.",
        problem: "Ava Chen keeps losing action items after OAC.",
        matchedKeywords: ["looking at meetings"],
        source: "sample",
      },
    ],
    ...extra,
  };
}

describe("isAnonymousAccountName", () => {
  it("treats Vortex Construction and the old Turner label as the test account", () => {
    expect(isAnonymousAccountName("Vortex Construction")).toBe(true);
    expect(isAnonymousAccountName(" vortex construction ")).toBe(true);
    expect(isAnonymousAccountName("Turner")).toBe(true);
    expect(isAnonymousAccountName("Grunley")).toBe(false);
  });
});

describe("anonymizeAccountRecord", () => {
  it("rewrites people, emails, and free-text mentions to stable User NN identities", () => {
    const anonymized = anonymizeAccountRecord(accountWithPeople("Vortex Construction"));
    expect(anonymized.name).toBe(ANONYMOUS_ACCOUNT_NAME);
    expect(anonymized.anonymized).toBe(true);

    const names = anonymized.snapshot.users.map((user) => user.name).sort();
    const emails = anonymized.snapshot.users.map((user) => user.email).sort();
    expect(names).toEqual([syntheticName(0), syntheticName(1)].sort());
    expect(emails).toEqual([syntheticEmail(0), syntheticEmail(1)].sort());
    expect(anonymized.snapshot.users.every((user) => user.email?.endsWith("@internal.test"))).toBe(
      true,
    );

    const avaIndex = anonymized.snapshot.users.findIndex((user) => user.id === "u-b");
    const ava = anonymized.snapshot.users[avaIndex]!;
    expect(anonymized.directory.find((user) => user.id === "u-b")?.name).toBe(ava.name);
    expect(anonymized.callSentiment[0]?.title).toBe(`Weekly sync with ${ava.name}`);
    expect(anonymized.callSentiment[0]?.moodSummary).toContain(ava.name);
    expect(anonymized.callSentiment[0]?.moodSummary).toContain(ava.email);
    expect(anonymized.callSentiment[0]?.moodSummary).not.toMatch(/ava\.chen/i);
    expect(anonymized.growthSignals[0]?.excerpt).not.toMatch(/Ava Chen/);
    expect(anonymized.growthSignals[0]?.problem).not.toMatch(/Ava Chen/);
  });

  it("scrubs leftover emails even when they are not in the directory", () => {
    expect(scrubText("Ping dean.laudo@grunley.com please", [])).toBe(
      "Ping user@internal.test please",
    );
  });

  it("is stable when run twice", () => {
    const once = anonymizeAccountRecord(accountWithPeople("Turner"));
    const twice = anonymizeAccountRecord(once);
    expect(twice.snapshot.users.map((user) => user.email)).toEqual(
      once.snapshot.users.map((user) => user.email),
    );
  });
});

describe("rawAccountNeedsAnonymizationPersist", () => {
  it("detects Turner and real PII on a Vortex-shaped account", () => {
    expect(
      rawAccountNeedsAnonymizationPersist({
        accounts: [{ name: "Turner", snapshot: { users: [{ email: "a@acme.test", name: "Ava" }] } }],
      }),
    ).toBe(true);
    expect(
      rawAccountNeedsAnonymizationPersist({
        accounts: [
          {
            name: "Vortex Construction",
            anonymized: true,
            snapshot: { users: [{ email: "user01@internal.test", name: "User 01" }] },
          },
        ],
      }),
    ).toBe(false);
    expect(
      rawAccountNeedsAnonymizationPersist({
        accounts: [{ name: "Grunley", snapshot: { users: [{ email: "a@grunley.com", name: "Ada" }] } }],
      }),
    ).toBe(false);
  });
});
