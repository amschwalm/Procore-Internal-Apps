import { existsSync, readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { snapshotFromInsights } from "./classify-insights";
import { parseInsightsFile, parseInsightsTable, tableFromCsv } from "./insights-import";

const HEADER =
  "Email,Time,question,answer,Time,phoenixTrace,A. Uniques of [Deprecated] Agent Conversation: Question and Answer (Answer not recorded),B. Uniques of Agent Conversation Question & Answer";

function row(email: string, iso: string, question = "q", answer = "a"): string {
  return `${email},"Jan 1, 2026",${question},${answer},${iso},undefined,0,1`;
}

const REAL_FILE =
  "/home/ubuntu/.cursor/projects/workspace/uploads/Agent_Interactions_Insights_2024-09-08_to_2026-08-29_5936.csv";

describe("snapshotFromInsights", () => {
  const now = new Date("2026-08-30T15:00:00.000Z");

  it("classifies intro, churned, lapsed, passive, and sticky", () => {
    const csv = [
      HEADER,
      row("intro@acme.test", "2026-08-30T10:00:00"),
      row("churn@acme.test", "2026-06-01T10:00:00"),
      row("lapse@acme.test", "2026-06-01T10:00:00"),
      row("lapse@acme.test", "2026-06-08T10:00:00"),
      row("pass@acme.test", "2026-06-01T10:00:00"),
      row("pass@acme.test", "2026-08-10T10:00:00"),
      row("stick@acme.test", "2026-06-01T10:00:00"),
      row("stick@acme.test", "2026-08-02T10:00:00"),
      row("stick@acme.test", "2026-08-04T10:00:00"),
      row("stick@acme.test", "2026-08-06T10:00:00"),
      row("stick@acme.test", "2026-08-08T10:00:00"),
      row("stick@acme.test", "2026-08-10T10:00:00"),
    ].join("\n");

    const snapshot = snapshotFromInsights(parseInsightsTable(tableFromCsv(csv)), { now });
    expect(snapshot.source).toBe("upload");
    expect(snapshot.attribution).toBe("user");
    expect(snapshot.counts).toEqual({
      non_user: 0,
      intro: 1,
      churned: 1,
      lapsed: 1,
      passive: 1,
      sticky: 1,
      advanced: 0,
    });
    expect(snapshot.attributionNote).toContain("more than 100");

    const stickyUser = snapshot.users.find((user) => user.email === "stick@acme.test");
    expect(stickyUser?.conversionEntryDate).toBe("2026-08-10");
    expect(stickyUser?.daysToConversion).toBe(70);

    const passiveUser = snapshot.users.find((user) => user.email === "pass@acme.test");
    expect(passiveUser?.daysToConversion).toBeNull();
  });

  it("advanced when a person has more than 100 Q&A rows in 30 days", () => {
    const rows = [HEADER, row("power@acme.test", "2026-06-01T10:00:00")];
    for (let i = 0; i < 101; i += 1) {
      const day = 1 + (i % 6);
      rows.push(row("power@acme.test", `2026-08-0${day}T10:00:00`));
    }
    const snapshot = snapshotFromInsights(parseInsightsTable(tableFromCsv(rows.join("\n"))), { now });
    expect(snapshot.counts.advanced).toBe(1);
    expect(snapshot.users[0]?.chats30).toBe(101);
    expect(snapshot.users[0]?.chats90).toBe(101);
    expect(snapshot.users[0]?.conversionEntryDate).toBe("2026-08-05");
    expect(snapshot.users[0]?.daysToConversion).toBe(65);
  });

  it("marks directory people who are missing from the file as Non-User", () => {
    const csv = [HEADER, row("active@acme.test", "2026-08-10T10:00:00")].join("\n");
    const snapshot = snapshotFromInsights(parseInsightsTable(tableFromCsv(csv)), {
      now,
      directory: [
        { id: "1", email: "active@acme.test", name: "Active" },
        { id: "2", email: "quiet@acme.test", name: "Quiet" },
      ],
    });
    expect(snapshot.counts.non_user).toBe(1);
    expect(snapshot.counts.churned).toBe(1);
    expect(snapshot.provisionedUsers).toBe(2);
    expect(snapshot.users.find((user) => user.email === "quiet@acme.test")?.name).toBe("Quiet");
  });

  it("attaches a tool relevance summary computed from every row's question and answer text", () => {
    const csv = [
      HEADER,
      row("a@acme.test", "2026-06-01T10:00:00", "how many RFIs are open", "12 RFIs are open"),
      row("a@acme.test", "2026-06-02T10:00:00", "draft an RFI for the wall", ""),
      row("b@acme.test", "2026-06-01T10:00:00", "what spec section covers soil cells", "section 32"),
      row("c@acme.test", "2026-06-01T10:00:00", "hello there", "how can I help"),
    ].join("\n");

    const snapshot = snapshotFromInsights(parseInsightsTable(tableFromCsv(csv)), { now });
    expect(snapshot.toolRelevance?.totalRows).toBe(4);
    expect(snapshot.toolRelevance?.matchedRows).toBe(3);
    expect(snapshot.toolRelevance?.unmatchedRows).toBe(1);
    expect(snapshot.toolRelevance?.tools[0]).toMatchObject({ toolId: "rfis", count: 2 });
  });

  it("summarizes 30-day conversation volume and weekly buckets from completed rows", () => {
    const csv = [
      HEADER,
      row("a@acme.test", "2026-08-20T10:00:00"),
      row("a@acme.test", "2026-08-10T10:00:00"),
      row("b@acme.test", "2026-07-15T10:00:00"),
      row("c@acme.test", "2026-06-01T10:00:00"),
    ].join("\n");
    const snapshot = snapshotFromInsights(parseInsightsTable(tableFromCsv(csv)), { now });
    expect(snapshot.conversationVolume).toEqual({
      current30: 2,
      prior30: 1,
      deltaAbs: 1,
      deltaPct: 100,
    });
    expect(snapshot.conversationsByWeek?.some((week) => week.count > 0)).toBe(true);
    expect(snapshot.conversationsByWeek?.reduce((sum, week) => sum + week.count, 0)).toBe(4);
  });

  it("counts every uploaded row toward toolRelevance, even without a matching keyword", () => {
    const csv = [HEADER, row("a@acme.test", "2026-06-01T10:00:00")].join("\n");
    const snapshot = snapshotFromInsights(parseInsightsTable(tableFromCsv(csv)), { now });
    expect(snapshot.toolRelevance?.totalRows).toBe(1);
    expect(snapshot.toolRelevance?.matchedRows).toBe(0);
    expect(snapshot.toolRelevance?.tools).toEqual([]);
  });
});

describe("Grunley insights export", () => {
  it.skipIf(!existsSync(REAL_FILE))("matches the hand count as of 30 Aug 2026", async () => {
    const parsed = await parseInsightsFile(readFileSync(REAL_FILE), "insights.csv");
    const snapshot = snapshotFromInsights(parsed, {
      now: new Date("2026-08-30T15:00:00.000Z"),
      fileName: "insights.csv",
    });
    expect(snapshot.provisionedUsers).toBe(24);
    expect(snapshot.counts).toEqual({
      non_user: 0,
      intro: 0,
      churned: 4,
      lapsed: 12,
      passive: 5,
      sticky: 3,
      advanced: 0,
    });
    const sticky = snapshot.users.filter((user) => user.type === "sticky");
    expect(sticky).toHaveLength(3);
    expect(sticky.every((user) => (user.chats30 ?? 0) >= user.activeDays30)).toBe(true);
    expect(Math.max(...sticky.map((user) => user.chats30 ?? 0))).toBeGreaterThan(0);
    expect(sticky.every((user) => (user.chats90 ?? 0) >= (user.chats30 ?? 0))).toBe(true);
    expect(sticky.every((user) => user.daysToConversion !== null)).toBe(true);

    expect(snapshot.toolRelevance?.totalRows).toBe(1125);
    expect(snapshot.toolRelevance?.matchedRows).toBe(948);
    expect(snapshot.toolRelevance?.unmatchedRows).toBe(177);
    expect(snapshot.toolRelevance?.tools[0]).toMatchObject({
      toolId: "specifications",
      count: 252,
    });
    const topFive = snapshot.toolRelevance?.tools.slice(0, 5).map((tool) => tool.toolId);
    expect(topFive).toEqual([
      "specifications",
      "submittals",
      "drawings",
      "commitments",
      "rfis",
    ]);
    expect(snapshot.conversationVolume?.current30).toBeGreaterThan(0);
    expect(snapshot.conversationVolume?.prior30).toBeGreaterThan(0);
    expect(snapshot.conversationsByWeek?.length).toBeGreaterThan(0);
  });
});
