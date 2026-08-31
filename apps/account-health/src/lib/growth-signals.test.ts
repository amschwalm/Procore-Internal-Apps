import { describe, expect, it } from "vitest";
import {
  extractGrowthSignals,
  matchGrowthAreasForText,
  sampleGrowthCalls,
  summarizeGrowthSignals,
} from "./growth-signals";

const REAL_MESSAGE_TEXT = `*Datagrid × FEMS — On-Site Implementation Review (Aug 21, 2026)*

Bottom line up front — focused on how Dean Laudo is using Datagrid and Procore for at-scale document search and submittal workflows. Search-based use cases are landing well, but complexity at scale remains a blocker.

📌 *Key topics*
• Concrete ticket search across ~300 inspector PDFs
• Submittal compliance digest agent — consolidating attachments
• Submittal duplication registry — Phase A vs. Phase B
• SQL completeness in the Procore embedded experience

➡️ *Next steps*
• Reconfigure the digest agent on item 0110001
• Escalate the embedded-experience SQL/permissioning completeness issue`;

describe("matchGrowthAreasForText", () => {
  it("returns nothing for empty or unrelated text", () => {
    expect(matchGrowthAreasForText("")).toEqual([]);
    expect(matchGrowthAreasForText("We reviewed the punch items on level 2.")).toEqual([]);
  });

  it("matches the real FEMS call summary against expansion-style categories", () => {
    const matches = matchGrowthAreasForText(REAL_MESSAGE_TEXT);
    const categories = matches.map((match) => match.category);
    expect(categories).toContain("new_agent");
    expect(categories).toContain("expansion");
    expect(categories).toContain("integration");
    expect(categories).toContain("workflow");
  });

  it("does not treat 'enterprise' as an ERP integration hit", () => {
    const matches = matchGrowthAreasForText(
      "Procurement is asking about an enterprise rollout and more seats after SSO.",
    );
    expect(matches.map((match) => match.category)).toEqual(["enterprise"]);
  });
});

describe("extractGrowthSignals / summarizeGrowthSignals", () => {
  it("emits one signal per matching category on a call", () => {
    const signals = extractGrowthSignals([
      {
        id: "1",
        date: "2026-08-21",
        title: "FEMS review",
        text: REAL_MESSAGE_TEXT,
        source: "slack",
      },
    ]);
    expect(signals.every((signal) => signal.callId === "1")).toBe(true);
    expect(new Set(signals.map((signal) => signal.category)).size).toBe(signals.length);
    expect(signals.some((signal) => signal.excerpt.toLowerCase().includes("digest agent"))).toBe(
      true,
    );
  });

  it("ranks areas by unique call count", () => {
    const signals = extractGrowthSignals([
      {
        id: "a",
        date: "2026-08-01",
        title: "A",
        text: "They want another agent for RFIs and a training workshop.",
        source: "sample",
      },
      {
        id: "b",
        date: "2026-08-08",
        title: "B",
        text: "Enablement is the next step. Also another agent for daily logs.",
        source: "sample",
      },
    ]);
    const summary = summarizeGrowthSignals(signals, 3);
    expect(summary.totalCalls).toBe(3);
    expect(summary.matchedCalls).toBe(2);
    expect(summary.unmatchedCalls).toBe(1);
    expect(summary.areas.find((area) => area.category === "new_agent")?.count).toBe(2);
    expect(summary.areas.find((area) => area.category === "training")?.count).toBe(2);
  });
});

describe("sampleGrowthCalls", () => {
  it("covers every growth category across the sample bodies", () => {
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
    expect(categories.has("new_agent")).toBe(true);
    expect(categories.has("enterprise")).toBe(true);
    expect(categories.has("expansion")).toBe(true);
    expect(categories.has("integration")).toBe(true);
    expect(categories.has("workflow")).toBe(true);
    expect(categories.has("training")).toBe(true);
  });
});
