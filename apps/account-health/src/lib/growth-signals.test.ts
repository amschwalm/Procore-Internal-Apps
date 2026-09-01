import { describe, expect, it } from "vitest";
import {
  GROWTH_CATEGORIES,
  GROWTH_HINTS,
  GROWTH_LABELS,
  extractGrowthSignals,
  extractProblem,
  matchGrowthAreasForText,
  normalizeGrowthSignals,
  sampleGrowthCalls,
  summarizeGrowthSignals,
} from "./growth-signals";

const FEMS_TEXT = `*Datagrid × FEMS — On-Site Implementation Review (Aug 21, 2026)*

Bottom line up front — focused on how Dean Laudo is using Datagrid and Procore for at-scale document search and submittal workflows. Search-based use cases are landing well, but complexity at scale remains a blocker.

📌 *Key topics*
• Concrete ticket search across ~300 inspector PDFs
• Submittal compliance digest agent — consolidating attachments
• Submittal duplication registry — Phase A vs. Phase B
• SQL completeness in the Procore embedded experience

➡️ *Next steps*
• Reconfigure the digest agent on item 0110001
• Escalate the embedded-experience SQL/permissioning completeness issue`;

const MEETINGS_TEXT = `
  We are looking at meetings in Procore. We keep losing action items after
  weekly OAC. There is no follow-up. The current process is not working.
`;

describe("matchGrowthAreasForText", () => {
  it("returns nothing for empty or unrelated text", () => {
    expect(matchGrowthAreasForText("")).toEqual([]);
    expect(matchGrowthAreasForText("Just a status update. No product discussion.")).toEqual([]);
  });

  it("does not treat a 'Meetings agreed' footer as a meetings use case", () => {
    expect(
      matchGrowthAreasForText(
        "Meetings agreed: online working session on the 28th; on-site Thursday afternoon.",
      ).map((match) => match.category),
    ).not.toContain("meetings");
  });

  it("matches the real FEMS call summary against target use cases, not enterprise motion", () => {
    const categories = matchGrowthAreasForText(FEMS_TEXT).map((match) => match.category);
    expect(categories).toContain("search");
    expect(categories).toContain("submittals");
    expect(categories).toContain("compliance");
    expect(categories).not.toContain("enterprise");
    expect(categories).not.toContain("expansion");
    expect(categories).not.toContain("new_agent");
  });

  it("does not flag seats / SSO / rollout as a use case", () => {
    expect(
      matchGrowthAreasForText(
        "Procurement is asking about an enterprise rollout and more seats after SSO.",
      ),
    ).toEqual([]);
  });

  it("matches meetings when the customer names the use case and a field problem", () => {
    const categories = matchGrowthAreasForText(MEETINGS_TEXT).map((match) => match.category);
    expect(categories).toContain("meetings");
  });
});

describe("extractProblem", () => {
  it("pulls the sentence that states why they care", () => {
    const problem = extractProblem(MEETINGS_TEXT);
    expect(problem?.toLowerCase()).toMatch(/losing action items|not working|follow-up/);
  });
});

describe("extractGrowthSignals / summarizeGrowthSignals", () => {
  it("emits one signal per matching use case, with a problem statement", () => {
    const signals = extractGrowthSignals([
      {
        id: "1",
        date: "2026-08-21",
        title: "FEMS review",
        text: FEMS_TEXT,
        source: "slack",
      },
    ]);
    expect(signals.every((signal) => signal.callId === "1")).toBe(true);
    expect(new Set(signals.map((signal) => signal.category)).size).toBe(signals.length);
    expect(signals.every((signal) => signal.problem.length > 10)).toBe(true);
    expect(signals.some((signal) => signal.excerpt.toLowerCase().includes("document search"))).toBe(
      true,
    );
  });

  it("keeps the problem that sparked a meetings interest", () => {
    const signals = extractGrowthSignals([
      {
        id: "m",
        date: "2026-08-01",
        title: "Kickoff",
        text: MEETINGS_TEXT,
        source: "sample",
      },
    ]);
    const meetings = signals.find((signal) => signal.category === "meetings");
    expect(meetings).toBeTruthy();
    expect(meetings?.problem.toLowerCase()).toMatch(/losing|action items|not working|follow-up/);
  });

  it("ranks areas by unique call count and surfaces the problem as the hint", () => {
    const signals = extractGrowthSignals([
      {
        id: "a",
        date: "2026-08-01",
        title: "A",
        text: MEETINGS_TEXT,
        source: "sample",
      },
      {
        id: "b",
        date: "2026-08-08",
        title: "B",
        text: "Looking at meetings in Procore again. Punch list is a mess — we cannot close items before turnover.",
        source: "sample",
      },
    ]);
    const summary = summarizeGrowthSignals(signals, 3);
    expect(summary.totalCalls).toBe(3);
    expect(summary.matchedCalls).toBe(2);
    expect(summary.unmatchedCalls).toBe(1);
    expect(summary.areas[0]?.category).toBe("meetings");
    expect(summary.areas[0]?.count).toBe(2);
    expect(summary.areas.find((area) => area.category === "punch_list")?.hint.toLowerCase()).toMatch(
      /punch|cannot close|mess/,
    );
  });

  it("drops leftover enterprise-motion categories from persisted state", () => {
    const cleaned = normalizeGrowthSignals([
      {
        id: "old",
        callId: "1",
        date: "2026-01-01",
        title: "QBR",
        category: "enterprise",
        excerpt: "SSO and more seats",
        problem: "They want SSO",
        matchedKeywords: ["sso"],
        source: "sample",
      },
      {
        id: "keep",
        callId: "2",
        date: "2026-08-01",
        title: "Kickoff",
        category: "meetings",
        excerpt: "looking at meetings",
        problem: "",
        matchedKeywords: ["looking at meetings"],
        source: "sample",
      },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]?.category).toBe("meetings");
    expect(cleaned[0]?.problem).toBe(GROWTH_HINTS.meetings);
  });
});

describe("sampleGrowthCalls", () => {
  it("covers target use cases, including meetings plus a problem", () => {
    const calls = sampleGrowthCalls([
      { id: "s0", date: "2026-03-01", title: "A" },
      { id: "s1", date: "2026-04-01", title: "B" },
      { id: "s2", date: "2026-05-01", title: "C" },
      { id: "s3", date: "2026-06-01", title: "D" },
      { id: "s4", date: "2026-07-01", title: "E" },
      { id: "s5", date: "2026-08-01", title: "F" },
    ]);
    const signals = extractGrowthSignals(calls);
    const categories = new Set(signals.map((signal) => signal.category));
    expect(categories.has("meetings")).toBe(true);
    expect(categories.has("search")).toBe(true);
    expect(categories.has("rfis")).toBe(true);
    expect(categories.has("submittals")).toBe(true);
    expect(categories.has("punch_list")).toBe(true);
    expect(categories.has("daily_log")).toBe(true);
    const meetings = signals.find((signal) => signal.category === "meetings");
    expect(meetings?.problem.toLowerCase()).toMatch(/action items|minutes|captured/);
  });
});

describe("growth labels", () => {
  it("covers every use case with a label and default problem hint", () => {
    expect(GROWTH_CATEGORIES).toHaveLength(Object.keys(GROWTH_LABELS).length);
    for (const id of GROWTH_CATEGORIES) {
      expect(GROWTH_LABELS[id].length).toBeGreaterThan(0);
      expect(GROWTH_HINTS[id].length).toBeGreaterThan(10);
    }
  });
});
